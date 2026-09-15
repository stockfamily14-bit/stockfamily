import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type AnalysisMode =
  | 'business'
  | 'financial_trend'
  | 'red_flags'
  | 'valuation'
  | 'stress_test'
  | 'quarterly_kpi'

type FinancialItem = {
  year?: string
  quarter?: string
  label?: string
  fetched_at?: string
  data?: Record<string, unknown>
}

type FinancialAnalysis = {
  latest: FinancialItem
  previous?: FinancialItem
  sameQuarterLastYear?: FinancialItem
  oldest: FinancialItem
  items: FinancialItem[]
  availableQuarters: number
  coverage: string
  revenueCagr: number | null
  revenueYoY: number | null
  revenueQoQ: number | null
  netIncomeYoY: number | null
  netIncomeQoQ: number | null
  latestRevenue: number | null
  previousRevenue: number | null
  latestNetIncome: number | null
  previousNetIncome: number | null
  latestMargin: number | null
  previousMargin: number | null
  avgMargin: number | null
  marginChangePp: number | null
  interestToPretax: number | null
  nonOperatingShare: number | null
  qualityScore: number
  qualityStatus: 'Low Risk' | 'Medium Risk' | 'High Risk'
  redFlags: Array<{
    level: 'LOW' | 'MEDIUM' | 'HIGH'
    issue: string
    evidence: string
    implication: string
  }>
}

const BUSINESS_DATABASE: Record<
  string,
  {
    overview: string
    risks: string[]
  }
> = {
  TLKM: {
    overview:
      'TLKM (PT Telkom Indonesia Tbk) adalah perusahaan telekomunikasi besar di Indonesia dengan bisnis konektivitas, Telkomsel, FMC, data center, cloud, dan infrastruktur digital.',
    risks: [
      'Persaingan harga paket data dapat menekan ARPU.',
      'Kebutuhan capex tinggi untuk infrastruktur digital.',
      'Penurunan bisnis legacy seperti SMS dan voice.',
      'Risiko regulasi spektrum dan tarif.',
      'Persaingan teknologi dan perubahan perilaku konsumen.'
    ]
  },

  BBCA: {
    overview:
      'BBCA (PT Bank Central Asia Tbk) adalah bank besar Indonesia dengan kekuatan pada dana murah, transaksi, kredit, dan ekosistem digital.',
    risks: [
      'Perubahan suku bunga dapat mempengaruhi margin.',
      'Risiko kualitas kredit ketika ekonomi melemah.',
      'Persaingan bank digital dan fintech.',
      'Risiko operasional dan keamanan siber.',
      'Valuasi premium dapat membatasi upside.'
    ]
  },

  BUMI: {
    overview:
      'BUMI (PT Bumi Resources Tbk) merupakan perusahaan pertambangan batubara yang kinerjanya sensitif terhadap harga komoditas dan kondisi industri pertambangan.',
    risks: [
      'Volatilitas harga batubara.',
      'Perubahan regulasi royalti dan DMO.',
      'Risiko transisi energi.',
      'Risiko operasional tambang dan cuaca.',
      'Perubahan biaya produksi dan kewajiban hilirisasi.'
    ]
  }
}

const GENERIC_BUSINESS = (symbol: string) => ({
  overview: `${symbol} adalah perusahaan terbuka yang terdaftar di Bursa Efek Indonesia (IDX). Analisis fundamental pada halaman ini menggunakan data laporan keuangan yang tersedia dari sumber financials.`,
  risks: [
    'Perubahan kondisi makroekonomi.',
    'Persaingan industri.',
    'Perubahan regulasi.',
    'Tekanan margin dan biaya operasional.',
    'Risiko pertumbuhan laba tidak sesuai ekspektasi.'
  ]
})

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function pctChange(current: number | null, previous: number | null) {
  if (
    current === null ||
    previous === null ||
    previous === 0
  ) {
    return null
  }

  return ((current - previous) / Math.abs(previous)) * 100
}

function formatPct(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) {
    return 'N/A'
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`
}

function formatMoney(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return 'N/A'
  }

  const abs = Math.abs(value)

  if (abs >= 1_000_000_000_000) {
    return `Rp ${(value / 1_000_000_000_000).toFixed(2)}T`
  }

  if (abs >= 1_000_000_000) {
    return `Rp ${(value / 1_000_000_000).toFixed(2)}M`
  }

  return `Rp ${Math.round(value).toLocaleString('id-ID')}`
}

function financialValue(
  item: FinancialItem | undefined,
  key: string
): number | null {
  if (!item?.data) return null
  return num(item.data[key])
}

function periodIndex(item: FinancialItem) {
  const year = Number(item.year)
  const quarter = Number(item.quarter)

  if (!Number.isFinite(year) || !Number.isFinite(quarter)) {
    return null
  }

  return year * 4 + (quarter - 1)
}

function calculateRevenueCagr(
  oldest: FinancialItem,
  latest: FinancialItem
) {
  const oldestRevenue = financialValue(
    oldest,
    'penjualan_dan_pendapatan_usaha'
  )

  const latestRevenue = financialValue(
    latest,
    'penjualan_dan_pendapatan_usaha'
  )

  const oldIndex = periodIndex(oldest)
  const latestIndex = periodIndex(latest)

  if (
    oldestRevenue === null ||
    latestRevenue === null ||
    oldestRevenue <= 0 ||
    latestRevenue <= 0 ||
    oldIndex === null ||
    latestIndex === null ||
    latestIndex <= oldIndex
  ) {
    return null
  }

  const years = (latestIndex - oldIndex) / 4

  if (years <= 0) {
    return null
  }

  return (
    (Math.pow(latestRevenue / oldestRevenue, 1 / years) - 1) *
    100
  )
}

function analyzeFinancials(
  payload: any
): FinancialAnalysis {
  const items: FinancialItem[] = Array.isArray(payload?.data?.items)
    ? payload.data.items
    : Array.isArray(payload?.items)
      ? payload.items
      : []

  if (items.length === 0) {
    throw new Error(
      'Data laporan keuangan tidak tersedia untuk ticker tersebut.'
    )
  }

  const sorted = [...items].sort((a, b) => {
    const ai = periodIndex(a) ?? 0
    const bi = periodIndex(b) ?? 0
    return bi - ai
  })

  const latest = sorted[0]
  const previous = sorted[1]
  const oldest = sorted[sorted.length - 1]

  const sameQuarterLastYear = sorted.find(
    (item) =>
      String(item.quarter) === String(latest.quarter) &&
      Number(item.year) === Number(latest.year) - 1
  )

  const latestRevenue = financialValue(
    latest,
    'penjualan_dan_pendapatan_usaha'
  )

  const previousRevenue = financialValue(
    previous,
    'penjualan_dan_pendapatan_usaha'
  )

  const latestNetIncome = financialValue(
    latest,
    'laba_rugi'
  )

  const previousNetIncome = financialValue(
    previous,
    'laba_rugi'
  )

  const sameYearNetIncome = financialValue(
    sameQuarterLastYear,
    'laba_rugi'
  )

  const sameYearRevenue = financialValue(
    sameQuarterLastYear,
    'penjualan_dan_pendapatan_usaha'
  )

  const latestPretax = financialValue(
    latest,
    'laba_rugi_sebelum_pajak_penghasilan'
  )

  const latestInterest = financialValue(
    latest,
    'beban_bunga_dan_keuangan'
  )

  const latestOtherIncome = financialValue(
    latest,
    'pendapatan_lainnya'
  )

  const latestOtherGain = financialValue(
    latest,
    'keuntungan_kerugian_lainnya'
  )

  const latestFinancialIncome = financialValue(
    latest,
    'pendapatan_keuangan'
  )

  const latestMargin =
    latestRevenue !== null &&
    latestRevenue !== 0 &&
    latestNetIncome !== null
      ? (latestNetIncome / latestRevenue) * 100
      : null

  const previousMargin =
    previousRevenue !== null &&
    previousRevenue !== 0 &&
    previousNetIncome !== null
      ? (previousNetIncome / previousRevenue) * 100
      : null

  const margins = sorted
    .map((item) => {
      const revenue = financialValue(
        item,
        'penjualan_dan_pendapatan_usaha'
      )

      const profit = financialValue(item, 'laba_rugi')

      if (
        revenue === null ||
        profit === null ||
        revenue === 0
      ) {
        return null
      }

      return (profit / revenue) * 100
    })
    .filter((value): value is number => value !== null)

  const avgMargin =
    margins.length > 0
      ? margins.reduce((sum, value) => sum + value, 0) /
        margins.length
      : null

  const revenueYoY = pctChange(
    latestRevenue,
    sameYearRevenue
  )

  const revenueQoQ = pctChange(
    latestRevenue,
    previousRevenue
  )

  const netIncomeYoY = pctChange(
    latestNetIncome,
    sameYearNetIncome
  )

  const netIncomeQoQ = pctChange(
    latestNetIncome,
    previousNetIncome
  )

  const marginChangePp =
    latestMargin !== null &&
    previousMargin !== null
      ? latestMargin - previousMargin
      : null

  const interestToPretax =
    latestPretax !== null &&
    latestPretax !== 0 &&
    latestInterest !== null
      ? Math.abs(latestInterest) /
        Math.abs(latestPretax)
      : null

  const nonOperating =
    Math.abs(latestOtherIncome ?? 0) +
    Math.abs(latestOtherGain ?? 0) +
    Math.abs(latestFinancialIncome ?? 0)

  const nonOperatingShare =
    latestPretax !== null &&
    latestPretax !== 0
      ? nonOperating / Math.abs(latestPretax)
      : null

  const redFlags: FinancialAnalysis['redFlags'] = []

  if (latestNetIncome !== null && latestNetIncome < 0) {
    redFlags.push({
      level: 'HIGH',
      issue: 'Laba bersih negatif',
      evidence: `Laba bersih terbaru ${formatMoney(latestNetIncome)}.`,
      implication:
        'Profitabilitas sedang berada dalam kondisi yang perlu diwaspadai.'
    })
  }

  if (netIncomeYoY !== null && netIncomeYoY <= -20) {
    redFlags.push({
      level: 'HIGH',
      issue: 'Penurunan laba YoY signifikan',
      evidence: `Laba terbaru berubah ${formatPct(netIncomeYoY)} dibanding kuartal yang sama tahun sebelumnya.`,
      implication:
        'Kenaikan atau kestabilan harga saham perlu didukung oleh perbaikan fundamental berikutnya.'
    })
  } else if (netIncomeYoY !== null && netIncomeYoY <= -10) {
    redFlags.push({
      level: 'MEDIUM',
      issue: 'Laba melemah secara tahunan',
      evidence: `Laba terbaru berubah ${formatPct(netIncomeYoY)} YoY.`,
      implication:
        'Momentum earnings belum mendukung secara kuat.'
    })
  }

  if (revenueYoY !== null && revenueYoY <= -10) {
    redFlags.push({
      level: 'HIGH',
      issue: 'Revenue turun signifikan',
      evidence: `Revenue berubah ${formatPct(revenueYoY)} YoY.`,
      implication:
        'Penurunan top line dapat membatasi pertumbuhan laba.'
    })
  } else if (revenueYoY !== null && revenueYoY < 0) {
    redFlags.push({
      level: 'MEDIUM',
      issue: 'Revenue melemah YoY',
      evidence: `Revenue berubah ${formatPct(revenueYoY)} YoY.`,
      implication:
        'Perlu melihat apakah penurunan hanya sementara atau menjadi tren.'
    })
  }

  if (marginChangePp !== null && marginChangePp <= -3) {
    redFlags.push({
      level: 'HIGH',
      issue: 'Margin tertekan',
      evidence: `Net margin berubah ${marginChangePp.toFixed(1)} percentage point dari kuartal sebelumnya.`,
      implication:
        'Pertumbuhan revenue belum menghasilkan kualitas laba yang lebih baik.'
    })
  } else if (marginChangePp !== null && marginChangePp <= -1) {
    redFlags.push({
      level: 'MEDIUM',
      issue: 'Margin menurun',
      evidence: `Net margin turun ${Math.abs(marginChangePp).toFixed(1)} percentage point.`,
      implication:
        'Perlu konfirmasi apakah tekanan margin berlanjut pada kuartal berikutnya.'
    })
  }

  if (
    nonOperatingShare !== null &&
    nonOperatingShare >= 0.2
  ) {
    redFlags.push({
      level: 'MEDIUM',
      issue: 'Kontribusi non-operasional cukup besar',
      evidence: `Pendapatan/gain non-operasional sekitar ${(nonOperatingShare * 100).toFixed(1)}% dari laba sebelum pajak.`,
      implication:
        'Kualitas laba perlu dibaca hati-hati karena tidak seluruh laba berasal dari operasi utama.'
    })
  }

  if (
    interestToPretax !== null &&
    interestToPretax >= 0.25
  ) {
    redFlags.push({
      level: 'MEDIUM',
      issue: 'Beban bunga relatif besar',
      evidence: `Beban bunga sekitar ${(interestToPretax * 100).toFixed(1)}% dari laba sebelum pajak.`,
      implication:
        'Perubahan biaya pendanaan dapat mempengaruhi profitabilitas.'
    })
  }

  if (redFlags.length === 0) {
    redFlags.push({
      level: 'LOW',
      issue: 'Tidak ada red flag besar dari income statement',
      evidence:
        'Tidak ditemukan penurunan ekstrem pada revenue, laba, atau margin berdasarkan periode yang tersedia.',
      implication:
        'Tetap perlu memonitor laporan kuartal berikutnya dan data neraca/arus kas bila tersedia.'
    })
  }

  const penalty = redFlags.reduce((sum, flag) => {
    if (flag.level === 'HIGH') return sum + 18
    if (flag.level === 'MEDIUM') return sum + 9
    return sum + 2
  }, 0)

  const qualityScore = Math.round(
    clamp(100 - penalty, 35, 95)
  )

  const qualityStatus =
    qualityScore >= 80
      ? 'Low Risk'
      : qualityScore >= 60
        ? 'Medium Risk'
        : 'High Risk'

  const coverage = `${oldest.label || 'periode awal'} → ${
    latest.label || 'periode terbaru'
  }`

  return {
    latest,
    previous,
    sameQuarterLastYear,
    oldest,
    items: sorted,
    availableQuarters: sorted.length,
    coverage,
    revenueCagr: calculateRevenueCagr(oldest, latest),
    revenueYoY,
    revenueQoQ,
    netIncomeYoY,
    netIncomeQoQ,
    latestRevenue,
    previousRevenue,
    latestNetIncome,
    previousNetIncome,
    latestMargin,
    previousMargin,
    avgMargin,
    marginChangePp,
    interestToPretax,
    nonOperatingShare,
    qualityScore,
    qualityStatus,
    redFlags
  }
}

function calculateConviction(
  financials: FinancialAnalysis,
  priceChangePct: number
) {
  const growthScore = clamp(
    50 +
      (financials.revenueCagr ?? 0) * 3 +
      (financials.revenueYoY ?? 0) * 1.5,
    0,
    100
  )

  const profitabilityScore = clamp(
    50 +
      ((financials.latestMargin ?? 0) - 10) * 2.5,
    0,
    100
  )

  const earningsTrendScore = clamp(
    50 +
      (financials.netIncomeYoY ?? 0) * 0.8 +
      (financials.netIncomeQoQ ?? 0) * 0.4,
    0,
    100
  )

  const marketScore = clamp(
    50 + priceChangePct * 3,
    0,
    100
  )

  const score = Math.round(
    growthScore * 0.30 +
      profitabilityScore * 0.25 +
      earningsTrendScore * 0.20 +
      financials.qualityScore * 0.15 +
      marketScore * 0.10
  )

  return {
    score: clamp(score, 0, 100),
    components: {
      growth: Math.round(growthScore),
      profitability: Math.round(profitabilityScore),
      earningsTrend: Math.round(earningsTrendScore),
      quality: financials.qualityScore,
      market: Math.round(marketScore)
    }
  }
}

function calculateScenarioTargets(
  currentPrice: number,
  convictionScore: number,
  financials: FinancialAnalysis
) {
  const marginAdjustment =
    financials.marginChangePp !== null
      ? clamp(
          financials.marginChangePp * 0.01,
          -0.05,
          0.05
        )
      : 0

  const growthAdjustment =
    financials.revenueCagr !== null
      ? clamp(
          financials.revenueCagr * 0.002,
          -0.03,
          0.04
        )
      : 0

  const baseReturn = clamp(
    0.05 +
      (convictionScore - 50) * 0.004 +
      marginAdjustment +
      growthAdjustment,
    -0.10,
    0.30
  )

  const bearReturn = clamp(
    baseReturn - 0.15,
    -0.35,
    0.10
  )

  const bullReturn = clamp(
    baseReturn + 0.15,
    0.05,
    0.50
  )

  return {
    bear: Math.round(currentPrice * (1 + bearReturn)),
    base: Math.round(currentPrice * (1 + baseReturn)),
    bull: Math.round(currentPrice * (1 + bullReturn)),
    returns: {
      bear: bearReturn * 100,
      base: baseReturn * 100,
      bull: bullReturn * 100
    }
  }
}

function auditThesis(
  thesis: string,
  financials: FinancialAnalysis
) {
  const text = thesis.toLowerCase().trim()

  const checks: Array<{
    topic: string
    supported: boolean
    evidence: string
  }> = []

  if (
    text.includes('revenue') ||
    text.includes('pendapatan') ||
    text.includes('sales')
  ) {
    const value = financials.revenueYoY ?? 0

    checks.push({
      topic: 'Revenue',
      supported: value >= 0,
      evidence: `Revenue YoY ${formatPct(financials.revenueYoY)}.`
    })
  }

  if (
    text.includes('laba') ||
    text.includes('profit') ||
    text.includes('earnings')
  ) {
    const value = financials.netIncomeYoY ?? 0

    checks.push({
      topic: 'Laba',
      supported: value >= 0,
      evidence: `Laba bersih YoY ${formatPct(financials.netIncomeYoY)}.`
    })
  }

  if (
    text.includes('margin') ||
    text.includes('margin membaik')
  ) {
    const value = financials.marginChangePp ?? 0

    checks.push({
      topic: 'Margin',
      supported: value >= 0,
      evidence: `Perubahan net margin ${value >= 0 ? '+' : ''}${value.toFixed(1)} percentage point QoQ.`
    })
  }

  if (
    text.includes('growth') ||
    text.includes('tumbuh') ||
    text.includes('pertumbuhan')
  ) {
    const value = financials.revenueCagr ?? 0

    checks.push({
      topic: 'Growth',
      supported: value > 0,
      evidence: `Revenue CAGR periode tersedia ${formatPct(financials.revenueCagr)}.`
    })
  }

  if (checks.length === 0) {
    const weakest = [
      {
        topic: 'Revenue',
        score: financials.revenueYoY ?? 0,
        evidence: `Revenue YoY ${formatPct(financials.revenueYoY)}.`
      },
      {
        topic: 'Laba',
        score: financials.netIncomeYoY ?? 0,
        evidence: `Laba bersih YoY ${formatPct(financials.netIncomeYoY)}.`
      },
      {
        topic: 'Margin',
        score: financials.marginChangePp ?? 0,
        evidence: `Margin berubah ${financials.marginChangePp === null ? 'N/A' : `${financials.marginChangePp.toFixed(1)} pp`}.`
      }
    ].sort((a, b) => a.score - b.score)[0]

    return {
      status: 'MIXED',
      matchedTopics: [],
      summary:
        'Belum ada tesis spesifik yang dapat diuji. Engine menggunakan titik fundamental terlemah sebagai fokus stress test.',
      checks: [],
      mainBias: `Risiko utama saat ini berada pada ${weakest.topic}.`,
      reasonsToFail: [
        {
          reason: `${weakest.topic} tidak berkembang sesuai ekspektasi`,
          evidence: weakest.evidence,
          early_warning:
            'Periksa laporan keuangan kuartal berikutnya.'
        }
      ]
    }
  }

  const supportedCount = checks.filter(
    (check) => check.supported
  ).length

  const status =
    supportedCount === checks.length
      ? 'SUPPORTED'
      : supportedCount === 0
        ? 'CHALLENGED'
        : 'MIXED'

  const firstFailure = checks.find(
    (check) => !check.supported
  )

  return {
    status,
    matchedTopics: checks.map((check) => check.topic),
    summary:
      status === 'SUPPORTED'
        ? 'Tesis memiliki dukungan dari data fundamental yang tersedia.'
        : status === 'CHALLENGED'
          ? 'Tesis bertentangan dengan data fundamental yang tersedia.'
          : 'Sebagian tesis didukung, tetapi terdapat indikator yang perlu diwaspadai.',
    checks,
    mainBias: firstFailure
      ? `Asumsi yang paling perlu diuji: ${firstFailure.topic}.`
      : 'Tesis terlihat konsisten dengan indikator yang diuji, tetapi tetap membutuhkan konfirmasi kuartal berikutnya.',
    reasonsToFail: checks
      .filter((check) => !check.supported)
      .map((check) => ({
        reason: `${check.topic} tidak mendukung tesis`,
        evidence: check.evidence,
        early_warning:
          'Perubahan tren pada laporan keuangan berikutnya.'
      }))
  }
}

async function fetchRealtimeStockData(symbol: string) {
  // Membersihkan ticker agar tidak terjadi double .JK (misal: BUMI.JK.JK)
  const cleanSymbol = symbol.replace(/\.JK$/i, '').trim()
  const formattedSymbol = `${cleanSymbol}.JK`

  const timestamp = Date.now()

  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${formattedSymbol}?interval=1m&range=1d&_t=${timestamp}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        cache: 'no-store'
      }
    )

    if (!response.ok) {
      throw new Error(
        `Yahoo Finance HTTP ${response.status} untuk ticker ${formattedSymbol}`
      )
    }

    const json = await response.json()
    const result = json?.chart?.result?.[0]

    if (!result?.meta) {
      throw new Error(
        'Yahoo Finance tidak mengembalikan metadata harga.'
      )
    }

    const meta = result.meta
    const price = num(meta.regularMarketPrice)

    if (price === null || price <= 0) {
      throw new Error(
        'Harga realtime tidak tersedia.'
      )
    }

    const previousClose =
      num(meta.chartPreviousClose) ??
      num(meta.previousClose) ??
      price

    const change = price - previousClose

    const changePercent =
      previousClose !== 0
        ? (change / previousClose) * 100
        : 0

    return {
      price,
      change,
      changePercent,
      dayHigh: num(meta.regularMarketDayHigh),
      dayLow: num(meta.regularMarketDayLow),
      shortName:
        meta.shortName ||
        meta.longName ||
        symbol,
      source: 'yahoo_finance'
    }
  } catch (error) {
    console.error(
      'Realtime price error:',
      error
    )

    throw new Error(
      'Harga realtime tidak berhasil diambil dari Yahoo Finance.'
    )
  }
}

async function fetchFinancials(
  requestUrl: string,
  symbol: string
) {
  const url = new URL(
    '/api/stock/financials',
    requestUrl
  )

  url.searchParams.set('ticker', symbol)

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store'
  })

  const json = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      json?.error ||
        `Financial API gagal dengan status ${response.status}.`
    )
  }

  if (!json?.data) {
    throw new Error(
      'Financial API tidak mengembalikan data.'
    )
  }

  return {
    payload: json,
    source: json.source || 'unknown'
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const symbol = String(body?.ticker || 'BBCA')
      .toUpperCase()
      .trim()
      .replace(/\.JK$/i, '')

    const mode: AnalysisMode =
      [
        'business',
        'financial_trend',
        'red_flags',
        'valuation',
        'stress_test',
        'quarterly_kpi'
      ].includes(body?.mode)
        ? body.mode
        : 'business'

    const userThesis =
      typeof body?.userThesis === 'string'
        ? body.userThesis.trim()
        : ''

    if (!/^[A-Z0-9]{2,10}$/.test(symbol)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ticker tidak valid.'
        },
        { status: 400 }
      )
    }

    // 1. Harga realtime
    const liveData =
      await fetchRealtimeStockData(symbol)

    // 2. Financials:
    const financialResult =
      await fetchFinancials(req.url, symbol)

    const financials =
      analyzeFinancials(financialResult.payload)

    // 3. Conviction score dinamis
    const conviction =
      calculateConviction(
        financials,
        liveData.changePercent
      )

    // 4. Scenario valuation
    const targets =
      calculateScenarioTargets(
        liveData.price,
        conviction.score,
        financials
      )

    // 5. Thesis stress test
    const thesisAudit =
      auditThesis(
        userThesis,
        financials
      )

    const business =
      BUSINESS_DATABASE[symbol] ||
      GENERIC_BUSINESS(symbol)

    const trendDirection =
      (financials.revenueYoY ?? 0) >= 0 &&
      (financials.netIncomeYoY ?? 0) >= 0
        ? 'Positive'
        : (financials.revenueYoY ?? 0) < 0 &&
            (financials.netIncomeYoY ?? 0) < 0
          ? 'Negative'
          : 'Mixed'

    const stockResponse = {
      score: conviction.score,

      price: liveData.price,

      targets: {
        base: targets.base,
        bear: targets.bear,
        bull: targets.bull
      },

      business: {
        overview:
          `${business.overview} Harga pasar terbaru yang digunakan: ${formatMoney(liveData.price)} (${formatPct(liveData.changePercent, 2)} hari ini).`,
        risks: business.risks
      },

      financial_trend: {
        cagr_revenue:
          financials.revenueCagr === null
            ? 'N/A'
            : formatPct(financials.revenueCagr),

        avg_margin:
          financials.avgMargin === null
            ? 'N/A'
            : `${financials.avgMargin.toFixed(1)}%`,

        latest_margin:
          financials.latestMargin === null
            ? 'N/A'
            : `${financials.latestMargin.toFixed(1)}%`,

        revenue_yoy:
          formatPct(financials.revenueYoY),

        net_income_yoy:
          formatPct(financials.netIncomeYoY),

        revenue_qoq:
          formatPct(financials.revenueQoQ),

        net_income_qoq:
          formatPct(financials.netIncomeQoQ),

        debt_status:
          'Tidak tersedia — endpoint financials saat ini menggunakan Income Statement.',

        period_coverage:
          financials.coverage,

        available_quarters:
          financials.availableQuarters,

        trend_direction: trendDirection,

        latest_revenue:
          formatMoney(financials.latestRevenue),

        latest_net_income:
          formatMoney(financials.latestNetIncome),

        trend_analysis:
          `Data tersedia ${financials.coverage}. Revenue terbaru ${formatMoney(financials.latestRevenue)}, laba bersih terbaru ${formatMoney(financials.latestNetIncome)}, dan net margin terbaru ${
            financials.latestMargin === null
              ? 'N/A'
              : `${financials.latestMargin.toFixed(1)}%`
          }. Revenue YoY ${formatPct(financials.revenueYoY)}, sedangkan laba bersih YoY ${formatPct(financials.netIncomeYoY)}.`
      },

      red_flags: {
        quality_score: financials.qualityScore,
        quality_status: financials.qualityStatus,
        red_flags: financials.redFlags,
        summary:
          `Quality score dihitung dari perubahan revenue, laba, margin, kontribusi non-operasional, dan beban bunga pada data yang tersedia.`
      },

      valuation: {
        fair_value: targets.base,
        bear_case: targets.bear,
        base_case: targets.base,
        bull_case: targets.bull,

        upside:
          `${targets.returns.base >= 0 ? '+' : ''}${targets.returns.base.toFixed(1)}%`,

        bear_return:
          `${targets.returns.bear >= 0 ? '+' : ''}${targets.returns.bear.toFixed(1)}%`,

        bull_return:
          `${targets.returns.bull >= 0 ? '+' : ''}${targets.returns.bull.toFixed(1)}%`,

        method:
          'Scenario-based valuation menggunakan conviction, pertumbuhan revenue, dan perubahan margin.',

        intrinsic_value_available: false,

        warning:
          'Ini bukan intrinsic fair value. Endpoint financials yang tersedia saat ini adalah Income Statement sehingga belum tersedia EPS, book value, shares outstanding, atau balance-sheet multiple yang diperlukan untuk valuasi intrinsik.'
      },

      stress_test: {
        main_bias:
          thesisAudit.mainBias,

        thesis:
          userThesis || null,

        thesis_audit:
          thesisAudit,

        reasons_to_fail:
          thesisAudit.reasonsToFail
      },

      quarterly_kpi: {
        metrics: [
          {
            name: 'Revenue',
            previous: formatMoney(
              financials.previousRevenue
            ),
            latest: formatMoney(
              financials.latestRevenue
            ),
            expectation:
              formatPct(financials.revenueYoY) + ' YoY'
          },

          {
            name: 'Laba Bersih',
            previous: formatMoney(
              financials.previousNetIncome
            ),
            latest: formatMoney(
              financials.latestNetIncome
            ),
            expectation:
              formatPct(financials.netIncomeYoY) + ' YoY'
          },

          {
            name: 'Net Margin',
            previous:
              financials.previousMargin === null
                ? 'N/A'
                : `${financials.previousMargin.toFixed(1)}%`,
            latest:
              financials.latestMargin === null
                ? 'N/A'
                : `${financials.latestMargin.toFixed(1)}%`,
            expectation:
              financials.marginChangePp === null
                ? 'N/A'
                : `${financials.marginChangePp >= 0 ? '+' : ''}${financials.marginChangePp.toFixed(1)} pp`
          },

          {
            name: 'Revenue YoY',
            previous: '-',
            latest:
              formatPct(financials.revenueYoY),
            expectation: 'Semakin positif semakin baik'
          },

          {
            name: 'Laba YoY',
            previous: '-',
            latest:
              formatPct(financials.netIncomeYoY),
            expectation: 'Semakin positif semakin baik'
          },

          {
            name: 'Harga Market',
            previous: formatMoney(
              liveData.price - liveData.change
            ),
            latest: formatMoney(
              liveData.price
            ),
            expectation:
              formatPct(
                liveData.changePercent,
                2
              )
          }
        ]
      }
    }

    const responseData =
      stockResponse[mode]

    return NextResponse.json({
      success: true,
      ticker: symbol,
      mode,
      timestamp: Date.now(),

      data: {
        ...responseData,

        meta: {
          score: stockResponse.score,
          price: stockResponse.price,
          targets: stockResponse.targets,

          risk: {
            score: financials.qualityScore,
            label: financials.qualityStatus
          },

          score_components:
            conviction.components,

          price_source:
            liveData.source,

          financial_source:
            financialResult.source,

          financial_coverage:
            financials.coverage,

          available_quarters:
            financials.availableQuarters,

          latest_period:
            financials.latest.label,

          generated_at:
            new Date().toISOString()
        }
      }
    })
  } catch (error: any) {
    console.error(
      'AI Analyze Error:',
      error
    )

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Gagal memproses analisis AI.'
      },
      {
        status: 502
      }
    )
  }
}