import { config } from 'dotenv'
config({ path: '.env.local' })

import { getSupabaseAdmin } from '../src/lib/supabase/admin'
import { analyzeStock, type Candle } from '../src/lib/analysis/technical'

const supabaseAdmin = getSupabaseAdmin()

async function getCandles(ticker: string): Promise<Candle[]> {
  const { data, error } = await supabaseAdmin
    .from('stock_ohlcv')
    .select('*')
    .eq('ticker', ticker)
    .order('date', { ascending: true })

  if (error || !data) {
    return []
  }

  return data
    .map((r) => ({
      date: r.date,
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
      volume: Number(r.volume),
    }))
    .filter(
      (c) =>
        Number.isFinite(c.close) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        c.close > 0 &&
        c.high > 0 &&
        c.low > 0
    )
}

async function run() {
  console.log('========================================')
  console.log('StockFamily Market Snapshot Engine')
  console.log('========================================')

  console.log('')
  console.log('Ambil data IHSG...')

  const ihsgCandles = await getCandles('IHSG')

  if (ihsgCandles.length < 20) {
    console.error(
      `Data IHSG tidak cukup. Ditemukan ${ihsgCandles.length} candle, minimal 20.`
    )
    return
  }

  let ihsgAnalysis

  try {
    ihsgAnalysis = analyzeStock(ihsgCandles)
  } catch (error) {
    console.error('Gagal menganalisa IHSG:', error)
    return
  }

  console.log(
    `IHSG: ${ihsgAnalysis.lastPrice} (${ihsgAnalysis.changePercent?.toFixed(2) ?? '-'}%)`
  )

  console.log('')
  console.log('Ambil top 300 saham by volume...')

  const { data: topPrices, error: topPricesError } = await supabaseAdmin
    .from('latest_prices')
    .select('*')
    .neq('ticker', 'IHSG')
    .order('volume', { ascending: false, nullsFirst: false })
    .limit(300)

  if (topPricesError) {
    console.error('Gagal mengambil latest_prices:', topPricesError)
    return
  }

  const universe = (topPrices ?? [])
    .map((p) => p.ticker)
    .filter((ticker): ticker is string => Boolean(ticker))

  console.log(
    `Semesta: ${universe.length} saham, mulai analisa satu per satu...`
  )

  if (universe.length === 0) {
    console.error('Tidak ada saham di universe.')
    return
  }

  const { data: stockNames, error: stockNamesError } = await supabaseAdmin
    .from('stocks')
    .select('*')
    .in('ticker', universe)

  if (stockNamesError) {
    console.warn('Gagal mengambil nama saham:', stockNamesError)
  }

  const nameMap = new Map(
    (stockNames ?? []).map((s) => [s.ticker, s.name])
  )

  let aboveMA20 = 0
  let aboveMA50 = 0
  let advancing = 0
  let declining = 0
  let unchanged = 0
  let newHigh = 0
  let newLow = 0
  let analyzed = 0

  type RadarStock = {
    ticker: string
    name: string
    aiScore: number
    setup: string
    price: number
  }

  type RadarEntry = {
    count: number
    stocks: RadarStock[]
  }

  const radar: Record<string, RadarEntry> = {
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

  const scored: {
    ticker: string
    name: string
    aiScore: number
    setup: string
    label: string
  }[] = []

  for (let i = 0; i < universe.length; i++) {
    const ticker = universe[i]

    const candles = await getCandles(ticker)

    if (candles.length < 20) {
      continue
    }

    let result

    try {
      result = analyzeStock(candles)
    } catch (error) {
      console.warn(`Skip ${ticker}: gagal analisa`)
      continue
    }

    analyzed++

    /*
     * ================================
     * MARKET BREADTH
     * ================================
     */

    if (result.ma20 != null && result.lastPrice > result.ma20) {
      aboveMA20++
    }

    if (result.ma50 != null && result.lastPrice > result.ma50) {
      aboveMA50++
    }

    if (
      result.changePercent != null &&
      Number.isFinite(result.changePercent)
    ) {
      if (result.changePercent > 0) {
        advancing++
      } else if (result.changePercent < 0) {
        declining++
      } else {
        unchanged++
      }
    }

    /*
     * ================================
     * NEW HIGH / NEW LOW
     *
     * Gunakan 90 candle terakhir,
     * bukan seluruh history.
     * ================================
     */

    const recentCandles = candles.slice(-90)
    const recentCloses = recentCandles.map((c) => c.close)

    if (recentCloses.length > 0) {
      const maxClose = Math.max(...recentCloses)
      const minClose = Math.min(...recentCloses)

      if (result.lastPrice >= maxClose) {
        newHigh++
      }

      if (result.lastPrice <= minClose) {
        newLow++
      }
    }

    /*
     * ================================
     * RADAR STOCK ENTRY
     * ================================
     */

    const stockEntry: RadarStock = {
      ticker,
      name: nameMap.get(ticker) ?? ticker,
      aiScore: result.aiScore,
      setup: result.setup,
      price: result.lastPrice,
    }

    /*
     * BREAKOUT WATCH
     */

    if (result.setup === 'BREAKOUT') {
      radar.breakoutWatch.count++
      radar.breakoutWatch.stocks.push(stockEntry)
    }

    /*
     * MOMENTUM
     */

    if (result.setup === 'MOMENTUM') {
      radar.momentum.count++
      radar.momentum.stocks.push(stockEntry)
    }

    /*
     * NEAR SUPPORT
     */

    if (result.nearSupport) {
      radar.nearSupport.count++
      radar.nearSupport.stocks.push(stockEntry)
    }

    /*
     * UNUSUAL VOLUME
     */

    if (
      result.volumeRatio != null &&
      Number.isFinite(result.volumeRatio) &&
      result.volumeRatio > 2
    ) {
      radar.unusualVolume.count++
      radar.unusualVolume.stocks.push(stockEntry)
    }

    /*
     * DISTRIBUTION
     */

    if (result.breakdown) {
      radar.distribution.count++
      radar.distribution.stocks.push(stockEntry)
    }

    /*
     * TOP OPPORTUNITIES
     */

    scored.push({
      ticker,
      name: nameMap.get(ticker) ?? ticker,
      aiScore: result.aiScore,
      setup: result.setup,
      label: result.label,
    })

    if ((i + 1) % 50 === 0) {
      console.log(
        `Progress: ${i + 1}/${universe.length} | analyzed: ${analyzed}`
      )
    }
  }

  console.log('')
  console.log(`Berhasil analisa: ${analyzed}/${universe.length} saham`)

  /*
   * ================================
   * SORT RADAR
   *
   * Database tetap menyimpan:
   *
   * radar = {
   *   breakoutWatch: {
   *     count,
   *     stocks
   *   }
   * }
   *
   * ================================
   */

  for (const key of Object.keys(radar)) {
    radar[key].stocks = radar[key].stocks
      .sort((a, b) => b.aiScore - a.aiScore)
      .slice(0, 20)
  }

  /*
   * ================================
   * MARKET BREADTH SCORE
   * ================================
   */

  const aboveMA20Pct =
    analyzed > 0 ? (aboveMA20 / analyzed) * 100 : 0

  const aboveMA50Pct =
    analyzed > 0 ? (aboveMA50 / analyzed) * 100 : 0

  const advanceDeclineRatio =
    declining > 0
      ? advancing / declining
      : advancing > 0
        ? 2
        : 1

  let breadthScore =
    (aboveMA20Pct + aboveMA50Pct) / 2

  if (advanceDeclineRatio > 1.5) {
    breadthScore += 10
  } else if (advanceDeclineRatio < 0.67) {
    breadthScore -= 10
  }

  breadthScore = Math.max(
    0,
    Math.min(100, breadthScore)
  )

  /*
   * ================================
   * MARKET BIAS
   * ================================
   */

  const marketBiasScore = Math.round(
    ihsgAnalysis.trendScore * 0.3 +
      ihsgAnalysis.momentumScore * 0.2 +
      breadthScore * 0.25 +
      ihsgAnalysis.volumeScore * 0.15 +
      ihsgAnalysis.riskScore * 0.1
  )

  let marketBiasLabel = 'NEUTRAL'

  if (marketBiasScore >= 80) {
    marketBiasLabel = 'STRONG BULLISH'
  } else if (marketBiasScore >= 65) {
    marketBiasLabel = 'BULLISH'
  } else if (marketBiasScore >= 50) {
    marketBiasLabel = 'NEUTRAL'
  } else if (marketBiasScore >= 35) {
    marketBiasLabel = 'BEARISH'
  } else {
    marketBiasLabel = 'STRONG BEARISH'
  }

  /*
   * ================================
   * TOP OPPORTUNITIES
   * ================================
   */

  const topOpportunities = scored
    .filter((s) => s.label !== 'BEARISH')
    .sort((a, b) => b.aiScore - a.aiScore)
    .slice(0, 5)

  /*
   * ================================
   * SNAPSHOT OBJECT
   * ================================
   */

  const snapshot = {
    ihsg_price: ihsgAnalysis.lastPrice,
    ihsg_change_percent: ihsgAnalysis.changePercent,

    market_bias_score: marketBiasScore,
    market_bias_label: marketBiasLabel,

    trend_score: ihsgAnalysis.trendScore,
    momentum_score: ihsgAnalysis.momentumScore,
    breadth_score: Math.round(breadthScore),
    volume_score: ihsgAnalysis.volumeScore,
    risk_score: ihsgAnalysis.riskScore,

    above_ma20_pct: aboveMA20Pct,
    above_ma50_pct: aboveMA50Pct,

    advancing,
    declining,
    unchanged,

    new_high_90d: newHigh,
    new_low_90d: newLow,

    /*
     * PENTING:
     * radar disimpan dalam format nested.
     * Frontend sekarang sudah disesuaikan
     * dengan format ini.
     */
    radar,

    top_opportunities: topOpportunities,

    /*
     * AI brief belum dibuat oleh engine.
     * Biarkan NULL daripada mengarang.
     */
    ai_brief: null,

    refresh_status: 'SUCCESS',
  }

  /*
   * ================================
   * SAVE SNAPSHOT
   * ================================
   */

  const { error } = await supabaseAdmin
    .from('market_snapshot')
    .insert(snapshot)

  if (error) {
    console.error('')
    console.error('========================================')
    console.error('GAGAL SIMPAN SNAPSHOT')
    console.error('========================================')
    console.error(error)
    return
  }

  /*
   * ================================
   * SUCCESS LOG
   * ================================
   */

  console.log('')
  console.log('========================================')
  console.log('Snapshot market berhasil disimpan!')
  console.log('========================================')
  console.log(`Market Bias : ${marketBiasLabel}`)
  console.log(`Market Score: ${marketBiasScore}/100`)
  console.log(`Analyzed    : ${analyzed}`)
  console.log(`Advancing   : ${advancing}`)
  console.log(`Declining   : ${declining}`)
  console.log(`Unchanged   : ${unchanged}`)
  console.log(`Above MA20  : ${aboveMA20Pct.toFixed(1)}%`)
  console.log(`Above MA50  : ${aboveMA50Pct.toFixed(1)}%`)
  console.log('')
  console.log('Top Opportunities:')

  for (const stock of topOpportunities) {
    console.log(
      `- ${stock.ticker} | ${stock.aiScore}/100 | ${stock.setup}`
    )
  }

  console.log('')
  console.log('Radar:')

  for (const [key, value] of Object.entries(radar)) {
    console.log(`- ${key}: ${value.count}`)
  }

  console.log('========================================')
}

run().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})