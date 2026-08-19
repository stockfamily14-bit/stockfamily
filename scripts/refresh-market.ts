import { config } from 'dotenv'
config({ path: '.env.local' })

import YahooFinance from 'yahoo-finance2'
import { getSupabaseAdmin } from '../src/lib/supabase/admin'
import { analyzeStock, type Candle } from '../src/lib/analysis/technical'

const yahooFinance = new YahooFinance()
const supabaseAdmin = getSupabaseAdmin()

const BATCH_SIZE = 50
const BATCH_DELAY_MS = 500

// ============================================================
// MARKET SESSION
// ============================================================

function isWeekdayWIB(): boolean {
  const now = new Date()
  const wib = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }))
  const day = wib.getDay()
  return day >= 1 && day <= 5
}

function isMarketHoursWIB(): boolean {
  if (!isWeekdayWIB()) return false

  const now = new Date()
  const wib = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }))

  const hour = wib.getHours()
  const minute = wib.getMinutes()
  const time = hour * 60 + minute

  const marketOpen = 9 * 60
  const marketClose = 16 * 60

  return time >= marketOpen && time < marketClose
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================
// REFRESH PRICE DATA
// ============================================================

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
}

async function refreshPrices(): Promise<RefreshResult> {
  const fetchedAt = new Date().toISOString()

  const { data: stocks, error } = await supabaseAdmin
    .from('stocks')
    .select('ticker')
    .neq('ticker', 'IHSG')

  if (error) {
    throw new Error(`Gagal mengambil universe saham: ${error.message}`)
  }

  const tickers = (stocks ?? [])
    .map((s) => String(s.ticker).trim().toUpperCase())
    .filter(Boolean)

  console.log(`Refresh harga untuk ${tickers.length} saham...`)

  let successfulBatches = 0
  let failedBatches = 0

  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch = tickers.slice(i, i + BATCH_SIZE)
    const symbols = batch.map((ticker) => `${ticker}.JK`)

    try {
      const quotes = await yahooFinance.quote(symbols)
      const quoteArray = Array.isArray(quotes) ? quotes : [quotes]

      const priceRows = quoteArray
        .filter((q) => q.regularMarketPrice != null)
        .map((q) => ({
          ticker: q.symbol.replace('.JK', ''),
          price: Number(q.regularMarketPrice),
          volume: q.regularMarketVolume != null ? Number(q.regularMarketVolume) : null,
        }))

      if (priceRows.length > 0) {
        const { error: insertError } = await supabaseAdmin.from('stock_prices').insert(priceRows)
        if (insertError) throw new Error(insertError.message)
      }

      successfulBatches++
      console.log(
        `Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(tickers.length / BATCH_SIZE)} sukses — ${priceRows.length} quotes`
      )
    } catch (err) {
      failedBatches++
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} gagal:`, err)
    }

    if (i + BATCH_SIZE < tickers.length) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  // IHSG live quote — dikecualikan dari batch di atas karena kode Yahoo-nya
  // beda (^JKSE, bukan .JK).
  let ihsgQuote: IhsgQuote | null = null

  try {
    const quote = await yahooFinance.quote('^JKSE')

    if (quote.regularMarketPrice != null) {
      ihsgQuote = {
        price: Number(quote.regularMarketPrice),
        changePercent:
          quote.regularMarketChangePercent != null ? Number(quote.regularMarketChangePercent) : null,
      }

      const { error: ihsgInsertError } = await supabaseAdmin.from('stock_prices').insert({
        ticker: 'IHSG',
        price: ihsgQuote.price,
        volume: quote.regularMarketVolume != null ? Number(quote.regularMarketVolume) : null,
      })

      if (ihsgInsertError) {
        console.error('Gagal simpan quote IHSG:', ihsgInsertError.message)
      } else {
        console.log(`IHSG live: ${ihsgQuote.price} (${ihsgQuote.changePercent?.toFixed(2)}%)`)
      }
    }
  } catch (err) {
    console.error('Gagal ambil quote IHSG live:', err)
  }

  const success = failedBatches === 0

  console.log(`Refresh selesai — sukses: ${successfulBatches}, gagal: ${failedBatches}`)

  return {
    success,
    fetchedAt,
    totalTickers: tickers.length,
    successfulBatches,
    failedBatches,
    ihsgQuote,
  }
}

// ============================================================
// GET CANDLES
// ============================================================

async function getCandles(ticker: string): Promise<Candle[]> {
  const { data, error } = await supabaseAdmin
    .from('stock_ohlcv')
    .select('*')
    .eq('ticker', ticker)
    .order('date', { ascending: true })

  if (error) {
    console.error(`Gagal mengambil OHLCV ${ticker}:`, error.message)
    return []
  }

  let candles: Candle[] = (data ?? []).map((r) => ({
    date: r.date,
    open: Number(r.open),
    high: Number(r.high),
    low: Number(r.low),
    close: Number(r.close),
    volume: Number(r.volume),
  }))

  const last = candles[candles.length - 1]
  if (last && last.volume === 0 && candles.length > 1) {
    candles = candles.slice(0, -1)
  }

  return candles
}

// ============================================================
// COMPUTE MARKET SNAPSHOT
// ============================================================

type RadarStock = { ticker: string; name: string; aiScore: number; setup: string }

async function computeSnapshot(refresh: RefreshResult): Promise<boolean> {
  console.log('Hitung ulang market snapshot...')

  if (!refresh.success) {
    console.warn('Refresh tidak penuh. Snapshot baru TIDAK dipublish.')
    return false
  }

  const ihsgCandles = await getCandles('IHSG')

  if (ihsgCandles.length < 20) {
    console.error('Data IHSG tidak cukup untuk snapshot.')
    return false
  }

  const ihsgAnalysis = analyzeStock(ihsgCandles)

  const displayPrice = refresh.ihsgQuote?.price ?? ihsgAnalysis.lastPrice
  const displayChangePercent = refresh.ihsgQuote?.changePercent ?? ihsgAnalysis.changePercent

  const { data: topPrices, error: topPricesError } = await supabaseAdmin
    .from('latest_prices')
    .select('*')
    .neq('ticker', 'IHSG')
    .order('volume', { ascending: false, nullsFirst: false })
    .limit(300)

  if (topPricesError) {
    console.error('Gagal mengambil active universe:', topPricesError.message)
    return false
  }

  const universe = (topPrices ?? []).map((p) => String(p.ticker).trim().toUpperCase()).filter(Boolean)

  console.log(`Active Universe: ${universe.length} saham (Top 300 volume)`)

  const { data: stockNames } = await supabaseAdmin.from('stocks').select('ticker, name').in('ticker', universe)
  const nameMap = new Map((stockNames ?? []).map((s) => [s.ticker, s.name]))

  let aboveMA20 = 0
  let aboveMA50 = 0
  let advancing = 0
  let declining = 0
  let unchanged = 0
  let newHigh = 0
  let newLow = 0
  let analyzed = 0

  const radarCounts = {
    breakoutWatch: 0,
    momentum: 0,
    nearSupport: 0,
    unusualVolume: 0,
    distribution: 0,
  }

  // Daftar saham PER KATEGORI radar — inilah yang bikin halaman
  // /opportunities?type=X bisa nampilin saham yang benar-benar sesuai.
  const radarStocks: Record<string, RadarStock[]> = {
    breakoutWatch: [],
    momentum: [],
    nearSupport: [],
    unusualVolume: [],
    distribution: [],
  }

  const scored: RadarStock[] = []

  for (const ticker of universe) {
    const candles = await getCandles(ticker)
    if (candles.length < 20) continue

    let result
    try {
      result = analyzeStock(candles)
    } catch (err) {
      console.error(`Technical analysis gagal ${ticker}:`, err)
      continue
    }

    analyzed++

    if (result.ma20 != null && result.lastPrice > result.ma20) aboveMA20++
    if (result.ma50 != null && result.lastPrice > result.ma50) aboveMA50++

    if (result.changePercent != null) {
      if (result.changePercent > 0) advancing++
      else if (result.changePercent < 0) declining++
      else unchanged++
    }

    const recent90 = candles.slice(-90)
    if (recent90.length >= 2) {
      const current = recent90[recent90.length - 1]
      const previous89 = recent90.slice(0, -1)
      const previousHigh90 = Math.max(...previous89.map((c) => c.close))
      const previousLow90 = Math.min(...previous89.map((c) => c.close))
      if (current.close >= previousHigh90) newHigh++
      if (current.close <= previousLow90) newLow++
    }

    const stockEntry: RadarStock = {
      ticker,
      name: nameMap.get(ticker) ?? ticker,
      aiScore: result.aiScore,
      setup: result.setup,
    }

    if (result.nearResistance || result.setup === 'BREAKOUT') {
      radarCounts.breakoutWatch++
      radarStocks.breakoutWatch.push(stockEntry)
    }
    if (result.setup === 'MOMENTUM') {
      radarCounts.momentum++
      radarStocks.momentum.push(stockEntry)
    }
    if (result.nearSupport) {
      radarCounts.nearSupport++
      radarStocks.nearSupport.push(stockEntry)
    }
    if (result.volumeRatio != null && result.volumeRatio > 2) {
      radarCounts.unusualVolume++
      radarStocks.unusualVolume.push(stockEntry)
    }
    if (result.breakdown) {
      radarCounts.distribution++
      radarStocks.distribution.push(stockEntry)
    }

    scored.push(stockEntry)
  }

  // Urutkan tiap kategori dari skor tertinggi, batasi 30 saham per kategori
  // supaya ukuran datanya tidak membengkak.
  for (const key of Object.keys(radarStocks)) {
    radarStocks[key] = radarStocks[key].sort((a, b) => b.aiScore - a.aiScore).slice(0, 30)
  }

  const aboveMA20Pct = analyzed > 0 ? (aboveMA20 / analyzed) * 100 : 0
  const aboveMA50Pct = analyzed > 0 ? (aboveMA50 / analyzed) * 100 : 0
  const advanceDeclineRatio = declining > 0 ? advancing / declining : advancing > 0 ? 2 : 1

  let breadthScore = (aboveMA20Pct + aboveMA50Pct) / 2
  if (advanceDeclineRatio > 1.5) breadthScore += 10
  else if (advanceDeclineRatio < 0.67) breadthScore -= 10
  breadthScore = Math.max(0, Math.min(100, breadthScore))

  const marketBiasScore = Math.round(
    ihsgAnalysis.trendScore * 0.3 +
      ihsgAnalysis.momentumScore * 0.2 +
      breadthScore * 0.25 +
      ihsgAnalysis.volumeScore * 0.15 +
      ihsgAnalysis.riskScore * 0.1
  )

  let marketBiasLabel = 'NEUTRAL'
  if (marketBiasScore >= 80) marketBiasLabel = 'STRONG BULLISH'
  else if (marketBiasScore >= 65) marketBiasLabel = 'BULLISH'
  else if (marketBiasScore >= 50) marketBiasLabel = 'NEUTRAL'
  else if (marketBiasScore >= 35) marketBiasLabel = 'BEARISH'
  else marketBiasLabel = 'STRONG BEARISH'

  const topOpportunities = scored
    .filter((s) => s.setup !== 'BREAKDOWN')
    .sort((a, b) => b.aiScore - a.aiScore)
    .slice(0, 5)

  const aiBrief = buildMarketInsight({
    marketBiasLabel,
    marketBiasScore,
    aboveMA20Pct,
    aboveMA50Pct,
    advancing,
    declining,
    unchanged,
    radarCounts,
    riskScore: ihsgAnalysis.riskScore,
  })

  const { error } = await supabaseAdmin.from('market_snapshot').insert({
    fetched_at: refresh.fetchedAt,
    computed_at: new Date().toISOString(),

    refresh_status: 'SUCCESS',
    successful_batches: refresh.successfulBatches,
    failed_batches: refresh.failedBatches,

    ihsg_price: displayPrice,
    ihsg_change_percent: displayChangePercent,

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

    radar: radarCounts,
    radar_stocks: radarStocks,
    top_opportunities: topOpportunities,

    ai_brief: aiBrief,
  })

  if (error) {
    console.error('Gagal menyimpan market snapshot:', error.message)
    return false
  }

  console.log(`Snapshot tersimpan: ${marketBiasLabel} (${marketBiasScore}/100)`)
  console.log(`IHSG: ${displayPrice} (${displayChangePercent?.toFixed(2)}%)`)
  console.log(`Analyzed: ${analyzed} stocks`)

  return true
}

// ============================================================
// DETERMINISTIC MARKET INSIGHT
// ============================================================

function buildMarketInsight(data: {
  marketBiasLabel: string
  marketBiasScore: number
  aboveMA20Pct: number
  aboveMA50Pct: number
  advancing: number
  declining: number
  unchanged: number
  radarCounts: {
    breakoutWatch: number
    momentum: number
    nearSupport: number
    unusualVolume: number
    distribution: number
  }
  riskScore: number
}): string {
  const { marketBiasLabel, marketBiasScore, aboveMA20Pct, advancing, declining, radarCounts, riskScore } = data

  const parts: string[] = []

  parts.push(`IHSG saat ini berada dalam kondisi ${marketBiasLabel.toLowerCase()} dengan market score ${marketBiasScore}/100.`)

  if (aboveMA20Pct >= 60) {
    parts.push(`${aboveMA20Pct.toFixed(0)}% active universe berada di atas MA20, menunjukkan participation jangka pendek yang cukup kuat.`)
  } else if (aboveMA20Pct < 40) {
    parts.push(`Hanya ${aboveMA20Pct.toFixed(0)}% active universe berada di atas MA20, sehingga breadth jangka pendek masih lemah.`)
  } else {
    parts.push(`Breadth jangka pendek masih mixed dengan ${aboveMA20Pct.toFixed(0)}% active universe berada di atas MA20.`)
  }

  if (advancing > declining) {
    parts.push(`Advancing stocks (${advancing}) masih lebih banyak daripada declining (${declining}).`)
  } else if (declining > advancing) {
    parts.push(`Declining stocks (${declining}) lebih dominan dibanding advancing (${advancing}).`)
  } else {
    parts.push(`Advancing dan declining stocks relatif seimbang (${advancing} vs ${declining}).`)
  }

  if (radarCounts.breakoutWatch > 0) parts.push(`${radarCounts.breakoutWatch} saham masuk radar breakout.`)
  if (radarCounts.unusualVolume > 0) parts.push(`${radarCounts.unusualVolume} saham menunjukkan unusual volume.`)
  if (radarCounts.distribution > 0) parts.push(`${radarCounts.distribution} saham menunjukkan indikasi distribution/breakdown.`)

  if (riskScore >= 70) parts.push('Risk score relatif terkendali.')
  else if (riskScore <= 40) parts.push('Volatilitas dan risk condition perlu diperhatikan.')
  else parts.push('Risk condition berada pada level moderat.')

  return parts.join(' ')
}

// ============================================================
// REFRESH POLICY
// ============================================================

async function shouldRefreshOutsideMarket(): Promise<boolean> {
  const { data: latestSnapshot, error } = await supabaseAdmin
    .from('market_snapshot')
    .select('fetched_at')
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Gagal membaca snapshot terakhir:', error.message)
    return true
  }

  if (!latestSnapshot?.fetched_at) return true

  const lastFetched = new Date(latestSnapshot.fetched_at).getTime()
  const ageMs = Date.now() - lastFetched

  return ageMs >= 60 * 60 * 1000
}

// ============================================================
// MAIN
// ============================================================

async function run() {
  const force = process.argv.includes('--force')
  const marketOpen = isMarketHoursWIB()

  if (!force) {
    if (marketOpen) {
      console.log('IDX market aktif — menjalankan refresh.')
    } else {
      const shouldRefresh = await shouldRefreshOutsideMarket()
      if (!shouldRefresh) {
        console.log('Di luar jam market dan snapshot masih fresh. Skip refresh.')
        return
      }
      console.log('Di luar jam market tetapi snapshot sudah >60 menit. Refresh.')
    }
  } else {
    console.log('Force mode aktif — refresh tetap dijalankan.')
  }

  const refresh = await refreshPrices()
  const success = await computeSnapshot(refresh)

  if (!success) {
    console.error('Refresh selesai tetapi snapshot baru tidak dipublish.')
    process.exitCode = 1
    return
  }

  console.log('Selesai!')
}

run().catch((error) => {
  console.error('Fatal error:', error)
  process.exitCode = 1
})