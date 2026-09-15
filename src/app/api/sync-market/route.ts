import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { analyzeStock, type Candle } from '@/lib/analysis/technical'
import YahooFinance from 'yahoo-finance2'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const yahooFinance = new YahooFinance()

const QUOTE_BATCH_SIZE = 50
const QUOTE_BATCH_DELAY_MS = 500

const OHLCV_CONCURRENCY = 10
const OHLCV_DELAY_MS = 150

const ACTIVE_UNIVERSE_LIMIT = 300
const RADAR_LIMIT = 30

const RADAR_KEYS = [
  'breakoutWatch',
  'momentum',
  'nearSupport',
  'unusualVolume',
  'distribution',
] as const

type RadarKey = (typeof RADAR_KEYS)[number]

type IhsgQuote = {
  price: number
  changePercent: number | null
}

type RefreshResult = {
  success: boolean
  fetchedAt: string
  totalTickers: number
  successfulBatches: number
  failedBatches: number
  ihsgQuote: IhsgQuote | null
  ohlcv: {
    attempted: number
    successful: number
    failed: number
    candlesUpserted: number
  }
}

type RadarStock = {
  ticker: string
  name: string
  aiScore: number
  setup: string
  price: number | null
}

type RadarEntry = {
  count: number
  stocks: RadarStock[]
}

type RadarData = Record<RadarKey, RadarEntry>

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function round(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n) : 0
}

function emptyRadar(): RadarData {
  return {
    breakoutWatch: {
      count: 0,
      stocks: [],
    },
    momentum: {
      count: 0,
      stocks: [],
    },
    nearSupport: {
      count: 0,
      stocks: [],
    },
    unusualVolume: {
      count: 0,
      stocks: [],
    },
    distribution: {
      count: 0,
      stocks: [],
    },
  }
}

function toDateString(value: unknown): string | null {
  if (!value) return null

  if (typeof value === 'string') {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/)
    if (match) return match[0]

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return null

    return parsed.toISOString().slice(0, 10)
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === 'number') {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return null

    return parsed.toISOString().slice(0, 10)
  }

  return null
}

function isValidOhlcvRow(row: {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}) {
  return (
    Boolean(row.date) &&
    Number.isFinite(row.open) &&
    Number.isFinite(row.high) &&
    Number.isFinite(row.low) &&
    Number.isFinite(row.close) &&
    Number.isFinite(row.volume) &&
    row.open > 0 &&
    row.high > 0 &&
    row.low > 0 &&
    row.close > 0 &&
    row.high >= row.low
  )
}

/*
 * Ambil candle harian terbaru dari Yahoo Finance.
 *
 * Kita mengambil beberapa hari terakhir supaya:
 * - candle terbaru tersedia,
 * - jika hari terakhir belum valid / volume 0,
 *   candle sebelumnya tetap tersedia,
 * - tidak perlu mendownload seluruh historical data lagi.
 */
async function refreshTickerOhlcv(ticker: string) {
  const symbol = `${ticker}.JK`

  const period2 = new Date()
  const period1 = new Date()
  period1.setDate(period1.getDate() - 7)

  const result: any = await yahooFinance.chart(symbol, {
    period1,
    period2,
    interval: '1d',
  })

  const quotes = Array.isArray(result?.quotes)
    ? result.quotes
    : []

  const rows = quotes
    .map((quote: any) => {
      const date = toDateString(quote?.date)

      return {
        ticker,
        date: date ?? '',
        open: Number(quote?.open),
        high: Number(quote?.high),
        low: Number(quote?.low),
        close: Number(quote?.close),
        volume: Number(quote?.volume ?? 0),
      }
    })
    .filter(isValidOhlcvRow)

  return rows
}

/*
 * Refresh daily OHLCV.
 *
 * Hanya mengambil beberapa hari terakhir dari Yahoo,
 * kemudian UPSERT ke stock_ohlcv.
 *
 * Dengan begitu historical data 2026-02-23 sampai sekarang
 * tetap dipertahankan.
 */
async function refreshOhlcv(tickers: string[]) {
  const supabase = getSupabaseAdmin()

  let successful = 0
  let failed = 0
  let candlesUpserted = 0

  for (
    let i = 0;
    i < tickers.length;
    i += OHLCV_CONCURRENCY
  ) {
    const batch = tickers.slice(
      i,
      i + OHLCV_CONCURRENCY,
    )

    const results = await Promise.all(
      batch.map(async (ticker) => {
        try {
          const rows = await refreshTickerOhlcv(ticker)

          if (rows.length === 0) {
            throw new Error(
              `Tidak ada candle valid dari Yahoo untuk ${ticker}`,
            )
          }

          const { error } = await supabase
            .from('stock_ohlcv')
            .upsert(rows, {
              onConflict: 'ticker,date',
            })

          if (error) {
            throw new Error(error.message)
          }

          return {
            ticker,
            success: true,
            rows: rows.length,
          }
        } catch (error: any) {
          console.error(
            `OHLCV ${ticker} gagal:`,
            error?.message ?? error,
          )

          return {
            ticker,
            success: false,
            rows: 0,
          }
        }
      }),
    )

    for (const result of results) {
      if (result.success) {
        successful++
        candlesUpserted += result.rows
      } else {
        failed++
      }
    }

    if (i + OHLCV_CONCURRENCY < tickers.length) {
      await sleep(OHLCV_DELAY_MS)
    }
  }

  return {
    attempted: tickers.length,
    successful,
    failed,
    candlesUpserted,
  }
}

/*
 * Refresh realtime quotes.
 */
async function refreshPrices(): Promise<RefreshResult> {
  const supabase = getSupabaseAdmin()
  const fetchedAt = new Date().toISOString()

  const { data: stocks, error } = await supabase
    .from('stocks')
    .select('ticker')
    .neq('ticker', 'IHSG')

  if (error) {
    throw new Error(
      `Gagal mengambil universe saham: ${error.message}`,
    )
  }

  const tickers = (stocks ?? [])
    .map((row: any) =>
      String(row.ticker)
        .trim()
        .toUpperCase(),
    )
    .filter(Boolean)

  let successfulBatches = 0
  let failedBatches = 0

  /*
   * Current quotes
   */
  for (
    let i = 0;
    i < tickers.length;
    i += QUOTE_BATCH_SIZE
  ) {
    const batch = tickers.slice(
      i,
      i + QUOTE_BATCH_SIZE,
    )

    const symbols = batch.map(
      (ticker) => `${ticker}.JK`,
    )

    try {
      const quotes: any =
        await yahooFinance.quote(symbols)

      const quoteArray = Array.isArray(quotes)
        ? quotes
        : [quotes]

      const priceRows = quoteArray
        .filter(
          (q: any) =>
            q?.regularMarketPrice != null &&
            q?.symbol,
        )
        .map((q: any) => ({
          ticker: String(q.symbol).replace(
            /\.JK$/i,
            '',
          ),
          price: Number(
            q.regularMarketPrice,
          ),
          volume:
            q.regularMarketVolume != null
              ? Number(
                  q.regularMarketVolume,
                )
              : null,
        }))
        .filter((row: any) =>
          Number.isFinite(row.price),
        )

      if (priceRows.length > 0) {
        const { error: insertError } =
          await supabase
            .from('stock_prices')
            .insert(priceRows)

        if (insertError) {
          throw new Error(insertError.message)
        }
      }

      successfulBatches++
    } catch (error) {
      failedBatches++

      console.error(
        `Yahoo quote batch ${
          Math.floor(
            i / QUOTE_BATCH_SIZE,
          ) + 1
        } gagal:`,
        error,
      )
    }

    if (
      i + QUOTE_BATCH_SIZE <
      tickers.length
    ) {
      await sleep(
        QUOTE_BATCH_DELAY_MS,
      )
    }
  }

  /*
   * IHSG
   */
  let ihsgQuote: IhsgQuote | null = null

  try {
    const quote: any =
      await yahooFinance.quote(
        '^JKSE',
      )

    if (
      quote?.regularMarketPrice != null
    ) {
      ihsgQuote = {
        price: Number(
          quote.regularMarketPrice,
        ),
        changePercent:
          quote.regularMarketChangePercent !=
          null
            ? Number(
                quote.regularMarketChangePercent,
              )
            : null,
      }

      const {
        error: ihsgError,
      } = await supabase
        .from('stock_prices')
        .insert({
          ticker: 'IHSG',
          price: ihsgQuote.price,
          volume:
            quote.regularMarketVolume != null
              ? Number(
                  quote.regularMarketVolume,
                )
              : null,
        })

      if (ihsgError) {
        console.error(
          'Gagal simpan quote IHSG:',
          ihsgError.message,
        )
      }
    }
  } catch (error) {
    console.error(
      'Gagal mengambil quote IHSG:',
      error,
    )
  }

  /*
   * Update daily OHLCV untuk seluruh universe.
   *
   * Historical lama tidak dihapus.
   */
  const ohlcv =
    await refreshOhlcv(tickers)

  return {
    success: failedBatches === 0,
    fetchedAt,
    totalTickers: tickers.length,
    successfulBatches,
    failedBatches,
    ihsgQuote,
    ohlcv,
  }
}

async function getCandles(
  ticker: string,
): Promise<Candle[]> {
  const supabase =
    getSupabaseAdmin()

  const {
    data,
    error,
  } = await supabase
    .from('stock_ohlcv')
    .select('*')
    .eq('ticker', ticker)
    .order('date', {
      ascending: true,
    })

  if (error) {
    console.error(
      `Gagal mengambil OHLCV ${ticker}:`,
      error.message,
    )

    return []
  }

  let candles: Candle[] = (
    data ?? []
  ).map((row: any) => ({
    date: row.date,
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume),
  }))

  /*
   * Jika candle terakhir memiliki volume 0,
   * kemungkinan merupakan candle kosong / non-trading.
   */
  const last =
    candles[candles.length - 1]

  if (
    last &&
    last.volume === 0 &&
    candles.length > 1
  ) {
    candles =
      candles.slice(0, -1)
  }

  return candles
}

function buildMarketInsight(input: {
  marketBiasLabel: string
  marketBiasScore: number
  aboveMA20Pct: number
  aboveMA50Pct: number
  advancing: number
  declining: number
  unchanged: number
  radar: RadarData
  riskScore: number
}) {
  const parts: string[] = []

  parts.push(
    `IHSG berada dalam kondisi ${input.marketBiasLabel.toLowerCase()} dengan market score ${input.marketBiasScore}/100.`,
  )

  if (input.aboveMA20Pct >= 60) {
    parts.push(
      `${input.aboveMA20Pct.toFixed(0)}% active universe berada di atas MA20, menunjukkan participation jangka pendek yang cukup kuat.`,
    )
  } else if (input.aboveMA20Pct < 40) {
    parts.push(
      `Hanya ${input.aboveMA20Pct.toFixed(0)}% active universe berada di atas MA20, sehingga breadth jangka pendek masih lemah.`,
    )
  } else {
    parts.push(
      `Breadth jangka pendek masih mixed dengan ${input.aboveMA20Pct.toFixed(0)}% active universe berada di atas MA20.`,
    )
  }

  if (
    input.advancing >
    input.declining
  ) {
    parts.push(
      `Advancing stocks (${input.advancing}) lebih banyak daripada declining (${input.declining}).`,
    )
  } else if (
    input.declining >
    input.advancing
  ) {
    parts.push(
      `Declining stocks (${input.declining}) lebih dominan daripada advancing (${input.advancing}).`,
    )
  } else {
    parts.push(
      `Advancing dan declining stocks relatif seimbang (${input.advancing} vs ${input.declining}).`,
    )
  }

  if (
    input.radar.breakoutWatch
      .count > 0
  ) {
    parts.push(
      `${input.radar.breakoutWatch.count} saham masuk radar breakout.`,
    )
  }

  if (
    input.radar.unusualVolume
      .count > 0
  ) {
    parts.push(
      `${input.radar.unusualVolume.count} saham menunjukkan unusual volume.`,
    )
  }

  if (
    input.radar.distribution
      .count > 0
  ) {
    parts.push(
      `${input.radar.distribution.count} saham menunjukkan indikasi distribution/breakdown.`,
    )
  }

  if (input.riskScore >= 70) {
    parts.push(
      'Risk condition relatif terkendali.',
    )
  } else if (
    input.riskScore <= 40
  ) {
    parts.push(
      'Volatilitas dan risk condition perlu diperhatikan.',
    )
  } else {
    parts.push(
      'Risk condition berada pada level moderat.',
    )
  }

  return parts.join(' ')
}

async function computeSnapshot(
  refresh: RefreshResult,
) {
  const supabase =
    getSupabaseAdmin()

  /*
   * IHSG
   */
  const ihsgCandles =
    await getCandles('IHSG')

  if (ihsgCandles.length < 20) {
    throw new Error(
      'Data IHSG tidak cukup untuk menghitung market snapshot.',
    )
  }

  const ihsgAnalysis: any =
    analyzeStock(ihsgCandles)

  const displayPrice =
    refresh.ihsgQuote?.price ??
    Number(
      ihsgAnalysis.lastPrice ?? 0,
    )

  const displayChangePercent =
    refresh.ihsgQuote
      ?.changePercent ??
    (ihsgAnalysis.changePercent !=
    null
      ? Number(
          ihsgAnalysis.changePercent,
        )
      : 0)

  /*
   * Active universe:
   * 300 saham dengan volume quote terbesar.
   */
  const {
    data: topPrices,
    error: topPricesError,
  } = await supabase
    .from('latest_prices')
    .select('*')
    .neq('ticker', 'IHSG')
    .order('volume', {
      ascending: false,
      nullsFirst: false,
    })
    .limit(
      ACTIVE_UNIVERSE_LIMIT,
    )

  if (topPricesError) {
    throw new Error(
      `Gagal mengambil latest prices: ${topPricesError.message}`,
    )
  }

  const universe = (
    topPrices ?? []
  )
    .map((row: any) =>
      String(row.ticker)
        .trim()
        .toUpperCase(),
    )
    .filter(Boolean)

  const priceMap =
    new Map<string, number>()

  for (const row of topPrices ?? []) {
    const ticker = String(
      (row as any).ticker,
    )
      .trim()
      .toUpperCase()

    const price = Number(
      (row as any).price,
    )

    if (
      ticker &&
      Number.isFinite(price)
    ) {
      priceMap.set(
        ticker,
        price,
      )
    }
  }

  /*
   * Stock names
   */
  const {
    data: stockNames,
    error: stockNamesError,
  } = await supabase
    .from('stocks')
    .select('ticker, name')
    .in('ticker', universe)

  if (stockNamesError) {
    throw new Error(
      `Gagal mengambil nama saham: ${stockNamesError.message}`,
    )
  }

  const nameMap =
    new Map<string, string>()

  for (
    const row of stockNames ?? []
  ) {
    nameMap.set(
      String(
        (row as any).ticker,
      )
        .trim()
        .toUpperCase(),
      String(
        (row as any).name ??
          (row as any).ticker,
      ),
    )
  }

  const radarCandidates: Record<
    RadarKey,
    RadarStock[]
  > = {
    breakoutWatch: [],
    momentum: [],
    nearSupport: [],
    unusualVolume: [],
    distribution: [],
  }

  let aboveMA20 = 0
  let aboveMA50 = 0
  let advancing = 0
  let declining = 0
  let unchanged = 0
  let newHigh = 0
  let newLow = 0
  let analyzed = 0

  /*
   * Analyze active universe.
   */
  for (const ticker of universe) {
    const candles =
      await getCandles(ticker)

    if (candles.length < 20) {
      continue
    }

    let analysis: any

    try {
      analysis =
        analyzeStock(candles)
    } catch (error) {
      console.error(
        `Technical analysis gagal ${ticker}:`,
        error,
      )

      continue
    }

    analyzed++

    if (
      analysis.ma20 != null &&
      Number(
        analysis.lastPrice,
      ) >
        Number(analysis.ma20)
    ) {
      aboveMA20++
    }

    if (
      analysis.ma50 != null &&
      Number(
        analysis.lastPrice,
      ) >
        Number(analysis.ma50)
    ) {
      aboveMA50++
    }

    if (
      analysis.changePercent !=
      null
    ) {
      if (
        Number(
          analysis.changePercent,
        ) > 0
      ) {
        advancing++
      } else if (
        Number(
          analysis.changePercent,
        ) < 0
      ) {
        declining++
      } else {
        unchanged++
      }
    }

    /*
     * New High / New Low 90D
     */
    const recent90 =
      candles.slice(-90)

    if (recent90.length >= 2) {
      const current =
        recent90[
          recent90.length - 1
        ]

      const previous =
        recent90.slice(0, -1)

      const previousHigh =
        Math.max(
          ...previous.map(
            (c) => c.close,
          ),
        )

      const previousLow =
        Math.min(
          ...previous.map(
            (c) => c.close,
          ),
        )

      if (
        current.close >=
        previousHigh
      ) {
        newHigh++
      }

      if (
        current.close <=
        previousLow
      ) {
        newLow++
      }
    }

    const stockEntry: RadarStock =
      {
        ticker,
        name:
          nameMap.get(ticker) ??
          ticker,
        aiScore: round(
          analysis.aiScore,
        ),
        setup: String(
          analysis.setup ??
            'TECHNICAL SETUP',
        ),
        price:
          priceMap.get(ticker) ??
          (analysis.lastPrice != null
            ? Number(
                analysis.lastPrice,
              )
            : null),
      }

    if (
      analysis.nearResistance ||
      analysis.setup ===
        'BREAKOUT'
    ) {
      radarCandidates.breakoutWatch.push(
        stockEntry,
      )
    }

    if (
      analysis.setup ===
      'MOMENTUM'
    ) {
      radarCandidates.momentum.push(
        stockEntry,
      )
    }

    if (analysis.nearSupport) {
      radarCandidates.nearSupport.push(
        stockEntry,
      )
    }

    if (
      analysis.volumeRatio !=
        null &&
      Number(
        analysis.volumeRatio,
      ) > 2
    ) {
      radarCandidates.unusualVolume.push(
        stockEntry,
      )
    }

    if (analysis.breakdown) {
      radarCandidates.distribution.push(
        stockEntry,
      )
    }
  }

  /*
   * Radar:
   *
   * count = seluruh kandidat
   * stocks = hanya Top 30
   */
  const radar =
    emptyRadar()

  for (const key of RADAR_KEYS) {
    const sorted =
      radarCandidates[key].sort(
        (a, b) =>
          b.aiScore -
          a.aiScore,
      )

    radar[key] = {
      count: sorted.length,
      stocks:
        sorted.slice(
          0,
          RADAR_LIMIT,
        ),
    }
  }

  /*
   * Breadth
   */
  const aboveMA20Pct =
    analyzed > 0
      ? (aboveMA20 /
          analyzed) *
        100
      : 0

  const aboveMA50Pct =
    analyzed > 0
      ? (aboveMA50 /
          analyzed) *
        100
      : 0

  const advanceDeclineRatio =
    declining > 0
      ? advancing /
        declining
      : advancing > 0
        ? 2
        : 1

  let breadthScore =
    (aboveMA20Pct +
      aboveMA50Pct) /
    2

  if (
    advanceDeclineRatio >
    1.5
  ) {
    breadthScore += 10
  } else if (
    advanceDeclineRatio <
    0.67
  ) {
    breadthScore -= 10
  }

  breadthScore =
    clamp(breadthScore)

  /*
   * IHSG technical scores
   */
  const trendScore =
    clamp(
      round(
        ihsgAnalysis.trendScore,
      ),
    )

  const momentumScore =
    clamp(
      round(
        ihsgAnalysis.momentumScore,
      ),
    )

  const volumeScore =
    clamp(
      round(
        ihsgAnalysis.volumeScore,
      ),
    )

  const riskScore =
    clamp(
      round(
        ihsgAnalysis.riskScore,
      ),
    )

  /*
   * Market Score
   */
  const marketBiasScore =
    round(
      trendScore * 0.3 +
        momentumScore * 0.2 +
        breadthScore * 0.25 +
        volumeScore * 0.15 +
        riskScore * 0.1,
    )

  let marketBiasLabel =
    'NEUTRAL'

  if (
    marketBiasScore >= 80
  ) {
    marketBiasLabel =
      'STRONG BULLISH'
  } else if (
    marketBiasScore >= 65
  ) {
    marketBiasLabel =
      'BULLISH'
  } else if (
    marketBiasScore >= 50
  ) {
    marketBiasLabel =
      'NEUTRAL'
  } else if (
    marketBiasScore >= 35
  ) {
    marketBiasLabel =
      'BEARISH'
  } else {
    marketBiasLabel =
      'STRONG BEARISH'
  }

  /*
   * Top Opportunities:
   * gabungkan seluruh radar candidate,
   * hilangkan duplicate ticker,
   * kemudian ambil Top 5.
   */
  const allStocks =
    RADAR_KEYS.flatMap(
      (key) =>
        radarCandidates[key],
    )

  const uniqueStocks =
    new Map<
      string,
      RadarStock
    >()

  for (const stock of allStocks) {
    const existing =
      uniqueStocks.get(
        stock.ticker,
      )

    if (
      !existing ||
      stock.aiScore >
        existing.aiScore
    ) {
      uniqueStocks.set(
        stock.ticker,
        stock,
      )
    }
  }

  const topOpportunities =
    Array.from(
      uniqueStocks.values(),
    )
      .filter(
        (stock) =>
          stock.setup !==
          'BREAKDOWN',
      )
      .sort(
        (a, b) =>
          b.aiScore -
          a.aiScore,
      )
      .slice(0, 5)

  const computedAt =
    new Date().toISOString()

  const aiBrief =
    buildMarketInsight({
      marketBiasLabel,
      marketBiasScore,
      aboveMA20Pct,
      aboveMA50Pct,
      advancing,
      declining,
      unchanged,
      radar,
      riskScore,
    })

  /*
   * Snapshot payload.
   */
  const snapshotPayload = {
    fetched_at:
      refresh.fetchedAt,

    computed_at:
      computedAt,

    refresh_status:
      'SUCCESS',

    successful_batches:
      refresh.successfulBatches,

    failed_batches:
      refresh.failedBatches,

    ihsg_price:
      Math.round(
        displayPrice,
      ),

    ihsg_change_percent:
      displayChangePercent,

    market_bias_score:
      marketBiasScore,

    market_bias_label:
      marketBiasLabel,

    trend_score:
      trendScore,

    momentum_score:
      momentumScore,

    breadth_score:
      round(
        breadthScore,
      ),

    volume_score:
      volumeScore,

    risk_score:
      riskScore,

    above_ma20_pct:
      aboveMA20Pct,

    above_ma50_pct:
      aboveMA50Pct,

    advancing,

    declining,

    unchanged,

    new_high_90d:
      newHigh,

    new_low_90d:
      newLow,

    radar,

    /*
     * Backward compatibility
     * dengan dashboard / snapshot lama.
     */
    radar_stocks:
      radar,

    top_opportunities:
      topOpportunities,

    ai_brief:
      aiBrief,
  }

  /*
   * Update existing latest snapshot,
   * atau insert jika belum ada.
   */
  const {
    data: latestSnapshot,
    error:
      latestSnapshotError,
  } = await supabase
    .from('market_snapshot')
    .select('id')
    .order('computed_at', {
      ascending: false,
    })
    .limit(1)
    .maybeSingle()

  if (latestSnapshotError) {
    throw new Error(
      `Gagal membaca market_snapshot: ${latestSnapshotError.message}`,
    )
  }

  let snapshotId:
    | number
    | string
    | null = null

  if (
    latestSnapshot?.id !=
    null
  ) {
    const { error } =
      await supabase
        .from(
          'market_snapshot',
        )
        .update(
          snapshotPayload,
        )
        .eq(
          'id',
          latestSnapshot.id,
        )

    if (error) {
      throw new Error(
        `Gagal update market_snapshot: ${error.message}`,
      )
    }

    snapshotId =
      latestSnapshot.id
  } else {
    const {
      data,
      error,
    } = await supabase
      .from(
        'market_snapshot',
      )
      .insert(
        snapshotPayload,
      )
      .select('id')
      .single()

    if (error) {
      throw new Error(
        `Gagal insert market_snapshot: ${error.message}`,
      )
    }

    snapshotId =
      data?.id ?? null
  }

  /*
   * Update market_overview.
   */
  const {
    error: overviewError,
  } = await supabase
    .from(
      'market_overview',
    )
    .upsert({
      id: 1,

      bias:
        marketBiasLabel,

      score:
        marketBiasScore,

      trend:
        trendScore >= 65
          ? 'Bullish'
          : trendScore >=
              45
            ? 'Neutral'
            : 'Bearish',

      momentum:
        momentumScore >= 65
          ? 'Positive'
          : momentumScore >=
              45
            ? 'Neutral'
            : 'Negative',

      breadth:
        breadthScore >= 65
          ? 'Strong'
          : breadthScore >=
              45
            ? 'Neutral'
            : 'Weak',

      volume:
        volumeScore >= 65
          ? 'Active'
          : volumeScore >=
              45
            ? 'Neutral'
            : 'Shrinking',

      risk:
        riskScore >= 65
          ? 'Normal'
          : riskScore >=
              45
            ? 'Waspada'
            : 'Tinggi',

      ihsg_price:
        Math.round(
          displayPrice,
        ),

      ihsg_change_percent:
        displayChangePercent,

      above_ma20_percent:
        aboveMA20Pct,

      above_ma50_percent:
        aboveMA50Pct,

      new_high_90d:
        newHigh,

      new_low_90d:
        newLow,

      advancing,

      declining,

      unchanged,

      updated_at:
        computedAt,
    })

  if (overviewError) {
    console.error(
      'Gagal update market_overview:',
      overviewError.message,
    )
  }

  return {
    snapshotId,

    computedAt,

    ihsg: {
      price:
        Math.round(
          displayPrice,
        ),
      changePercent:
        displayChangePercent,
    },

    market: {
      bias:
        marketBiasLabel,
      score:
        marketBiasScore,
    },

    stocks: {
      loaded:
        universe.length,
      analyzed,
    },

    breadth: {
      aboveMA20:
        aboveMA20Pct,
      aboveMA50:
        aboveMA50Pct,
      advancing,
      declining,
      unchanged,
      newHigh90:
        newHigh,
      newLow90:
        newLow,
    },

    radar,

    topOpportunities,

    ohlcv: refresh.ohlcv,
  }
}

export async function GET() {
  try {
    console.log(
      '========================================',
    )

    console.log(
      'STOCKFAMILY MARKET SYNC START',
    )

    console.log(
      '========================================',
    )

    const refresh =
      await refreshPrices()

    /*
     * Quote batch boleh gagal sebagian,
     * tetapi kita tidak publish snapshot
     * jika quote refresh gagal total/sebagian.
     */
    if (!refresh.success) {
      return Response.json(
        {
          success: false,

          error:
            'Sebagian batch Yahoo Finance gagal. Snapshot tidak dipublish.',

          refresh,
        },
        {
          status: 502,
        },
      )
    }

    const snapshot =
      await computeSnapshot(
        refresh,
      )

    console.log(
      '========================================',
    )

    console.log(
      'STOCKFAMILY MARKET SYNC SUCCESS',
    )

    console.log(
      `Snapshot ID: ${snapshot.snapshotId}`,
    )

    console.log(
      `Stocks analyzed: ${snapshot.stocks.analyzed}`,
    )

    console.log(
      `OHLCV upserted: ${snapshot.ohlcv.candlesUpserted}`,
    )

    console.log(
      '========================================',
    )

    return Response.json({
      success: true,

      message:
        'Market data synced successfully',

      ...snapshot,
    })
  } catch (error: any) {
    console.error(
      'SYNC MARKET ERROR:',
      error,
    )

    return Response.json(
      {
        success: false,

        error:
          error?.message ??
          'Market sync failed',
      },
      {
        status: 500,
      },
    )
  }
}
