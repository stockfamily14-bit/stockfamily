export type SFSCRERow = {
  trade_date: string
  score: number
  previousScore: number
  structure: number
  momentum: number
  flow: number
  participation: number
  risk: number
  regime: number
  state: string
  direction: 'UP' | 'DOWN' | 'NEUTRAL'
  flowAcceleration: number
  events: string[]
  insights: { type: 'Trend' | 'Flow' | 'Risk'; text: string }[]
}

type Row = {
  trade_date: string
  close: number
  high: number
  low: number
  volume: number
  foreign_buy?: number
  foreign_sell?: number
  bid_volume?: number
  offer_volume?: number
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo))
const avg = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
const sma = (xs: number[], n: number) => xs.length >= n ? avg(xs.slice(-n)) : null
const pct = (a: number, b: number) => b ? (a / b - 1) * 100 : 0
const scoreAroundZero = (x: number, scale: number) => clamp(50 + (x / scale) * 50)

function stdev(xs: number[]) {
  if (xs.length < 2) return 0
  const m = avg(xs)
  return Math.sqrt(avg(xs.map(x => (x - m) ** 2)))
}

export function calcSFSCRETHistory(rows: Row[]): SFSCRERow[] {
  const clean = rows.filter(r => Number(r.close) > 0).map(r => ({
    ...r,
    close: Number(r.close), high: Number(r.high || r.close), low: Number(r.low || r.close), volume: Number(r.volume || 0),
    foreign_buy: Number(r.foreign_buy || 0), foreign_sell: Number(r.foreign_sell || 0),
    bid_volume: Number(r.bid_volume || 0), offer_volume: Number(r.offer_volume || 0),
  }))

  return clean.map((r, i) => {
    const closes = clean.slice(0, i + 1).map(x => x.close)
    const vols = clean.slice(0, i + 1).map(x => x.volume)
    const fnet = clean.slice(0, i + 1).map(x => (x.foreign_buy || 0) - (x.foreign_sell || 0))
    const ma20 = sma(closes, 20)
    const ma50 = sma(closes, 50)
    const ma20Base = ma20 ?? r.close
    const ma50Base = ma50 ?? r.close
    const ret5 = i >= 5 ? pct(r.close, clean[i - 5].close) : 0
    const ret20 = i >= 20 ? pct(r.close, clean[i - 20].close) : ret5
    const returns = closes.slice(-21).map((c, j, a) => j ? pct(c, a[j - 1]) : 0).slice(1)
    const volPct = stdev(returns)
    const avgVol20 = avg(vols.slice(-20))
    const volRatio = avgVol20 > 0 ? r.volume / avgVol20 : 1
    const prior10 = closes.slice(Math.max(0, closes.length - 11), -1)
    const higherHigh = prior10.length >= 5 ? r.high >= Math.max(...prior10) : false
    const lowerLow = prior10.length >= 5 ? r.low <= Math.min(...prior10) : false

    const maAlignment = ma20 != null && ma50 != null && ma20 >= ma50 ? 15 : 0
    const priceVs20 = ma20 != null ? scoreAroundZero(pct(r.close, ma20Base), 8) : 50
    const priceVs50 = ma50 != null ? scoreAroundZero(pct(r.close, ma50Base), 12) : 50
    const structure = clamp(priceVs20 * 0.35 + priceVs50 * 0.35 + maAlignment + (higherHigh ? 15 : 0) - (lowerLow ? 12 : 0))

    const momentum = clamp(scoreAroundZero(ret5, 6) * 0.55 + scoreAroundZero(ret20, 12) * 0.45)

    const avgAbsF = avg(fnet.slice(-20).map(Math.abs)) || 1
    const currentF = fnet[fnet.length - 1] || 0
    const prevF = fnet.length > 1 ? fnet[fnet.length - 2] || 0 : 0
    const flow = clamp(50 + (currentF / avgAbsF) * 35 + (avg(fnet.slice(-5)) / avgAbsF) * 15)

    const bid = r.bid_volume || 0
    const offer = r.offer_volume || 0
    const pressure = bid + offer > 0 ? (bid / (bid + offer)) * 100 : 50
    const participation = clamp(pressure * 0.45 + scoreAroundZero((volRatio - 1) * 100, 80) * 0.55)

    const distancePenalty = ma20 != null ? Math.abs(pct(r.close, ma20Base)) * 3 : 0
    const volatilityPenalty = volPct * 7
    const risk = clamp(100 - distancePenalty - volatilityPenalty)

    const recent = clean.slice(Math.max(0, i - 9), i + 1)
    const trendPersistence = recent.length && ma20 != null ? avg(recent.map(x => x.close >= ma20 ? 100 : 0)) : 50
    const volatilityStability = clamp(100 - volPct * 12)
    const regime = clamp(trendPersistence * 0.65 + volatilityStability * 0.35)
    const score = Math.round(clamp(structure * 0.25 + momentum * 0.20 + flow * 0.20 + participation * 0.15 + risk * 0.10 + regime * 0.10))

    let state = 'ACCUMULATION'
    if (score >= 85 && momentum >= 65 && structure >= 70) state = 'EXPANSION'
    else if (score >= 75 && structure >= 65) state = 'CONFIRMED_TREND'
    else if (score >= 60 && momentum >= 55) state = 'EARLY_TREND'

    const direction = score >= 60 ? 'UP' : score <= 40 ? 'DOWN' : 'NEUTRAL'
    const flowAcceleration = Math.round(((currentF - prevF) / avgAbsF) * 100) / 100
    const events: string[] = []
    if (higherHigh && volRatio >= 1.15) events.push('BREAKOUT')
    if (currentF > 0 && avg(fnet.slice(-5)) > 0) events.push('ACCUMULATION')

    const insights = [
      { type: 'Trend' as const, text: ma20 != null && ma50 != null && r.close > ma20 && ma20 >= ma50 ? 'Harga di atas MA20 dan MA50; struktur tren mendukung.' : 'Struktur tren belum sepenuhnya terkonfirmasi.' },
      { type: 'Flow' as const, text: avg(fnet.slice(-5)) > 0 ? 'Foreign flow 5 hari terakhir cenderung akumulatif.' : 'Foreign flow belum menunjukkan akumulasi yang konsisten.' },
      { type: 'Risk' as const, text: ma20 != null && Math.abs(pct(r.close, ma20Base)) > 6 ? 'Harga cukup jauh dari MA20; risiko pullback meningkat.' : 'Jarak harga terhadap MA20 masih relatif terkendali.' },
    ]

    return { trade_date: r.trade_date, score, previousScore: i > 0 ? 0 : 0, structure: Math.round(structure), momentum: Math.round(momentum), flow: Math.round(flow), participation: Math.round(participation), risk: Math.round(risk), regime: Math.round(regime), state, direction, flowAcceleration, events, insights }
  })
}
