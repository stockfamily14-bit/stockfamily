export type Candle = {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type MarketStructure = 'BULLISH' | 'BEARISH' | 'RANGE' | 'UNKNOWN'
export type SetupType = 'BREAKOUT' | 'PULLBACK' | 'MOMENTUM' | 'RANGE' | 'BREAKDOWN' | 'NONE'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type SignalLabel = 'BULLISH' | 'WATCH' | 'BEARISH'

export type FinalAction =
  | 'BUY_ON_CONFIRMATION'
  | 'WAIT_CONFIRMATION'
  | 'WAIT_PULLBACK'
  | 'AVOID'

export type TradePlanStatus =
  | 'VALID'
  | 'WAIT_CONFIRMATION'
  | 'UNATTRACTIVE_RR'
  | 'NO_SETUP'

export type TradePlan = {
  status: TradePlanStatus
  entry: number | null
  trigger: number | null
  retestLow: number | null
  retestHigh: number | null
  invalidation: number | null
  target1: number | null
  target2: number | null
  target3: number | null
  riskPoints: number | null
  rewardPoints: number | null
  riskReward: number | null
  riskPercent: number | null
  finalAction: FinalAction
  actionReason: string
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null
  const slice = values.slice(-period)
  return slice.reduce((sum, value) => sum + value, 0) / period
}

function previousSma(values: number[], period: number): number | null {
  if (values.length < period + 1) return null
  return sma(values.slice(0, -1), period)
}

function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null
  let gainSum = 0
  let lossSum = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gainSum += diff
    else lossSum += Math.abs(diff)
  }
  let avgGain = gainSum / period
  let avgLoss = lossSum / period
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? Math.abs(diff) : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
  }
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

function momentum(closes: number[], daysBack: number): number | null {
  if (closes.length < daysBack + 1) return null
  const past = closes[closes.length - 1 - daysBack]
  const now = closes[closes.length - 1]
  if (!Number.isFinite(past) || past === 0) return null
  return ((now - past) / past) * 100
}

function volumeRatio(volumes: number[], period = 20): number | null {
  if (volumes.length < period + 1) return null
  const latest = volumes[volumes.length - 1]
  const baseline = sma(volumes.slice(0, -1), period)
  if (!baseline || baseline <= 0) return null
  return latest / baseline
}

function supportResistance(candles: Candle[], lookback = 20) {
  if (candles.length < lookback + 1) return { support: null, resistance: null }
  const previous = candles.slice(0, -1).slice(-lookback)
  return {
    support: Math.min(...previous.map((c) => c.low)),
    resistance: Math.max(...previous.map((c) => c.high)),
  }
}

function volatility(closes: number[], period = 20): number | null {
  if (closes.length < period + 1) return null
  const recent = closes.slice(-(period + 1))
  const returns: number[] = []
  for (let i = 1; i < recent.length; i++) {
    const previous = recent[i - 1]
    if (previous !== 0) returns.push((recent[i] - previous) / previous)
  }
  if (!returns.length) return null
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length
  return Math.sqrt(variance) * 100
}

function detectMarketStructure(candles: Candle[]): MarketStructure {
  if (candles.length < 10) return 'UNKNOWN'
  const recent = candles.slice(-10)
  const firstHalf = recent.slice(0, 5)
  const secondHalf = recent.slice(5)
  const firstHigh = Math.max(...firstHalf.map((c) => c.high))
  const secondHigh = Math.max(...secondHalf.map((c) => c.high))
  const firstLow = Math.min(...firstHalf.map((c) => c.low))
  const secondLow = Math.min(...secondHalf.map((c) => c.low))
  if (secondHigh > firstHigh && secondLow > firstLow) return 'BULLISH'
  if (secondHigh < firstHigh && secondLow < firstLow) return 'BEARISH'
  return 'RANGE'
}

function calculateTrendScore(lastPrice: number, ma20: number | null, ma50: number | null, previousMa20: number | null, previousMa50: number | null) {
  let score = 50
  if (ma20 != null) score += lastPrice > ma20 ? 15 : -15
  if (ma50 != null) score += lastPrice > ma50 ? 15 : -15
  if (ma20 != null && ma50 != null) score += ma20 > ma50 ? 10 : -10
  if (ma20 != null && previousMa20 != null) score += ma20 > previousMa20 ? 5 : -5
  if (ma50 != null && previousMa50 != null) score += ma50 > previousMa50 ? 5 : -5
  return clamp(score)
}

function calculateMomentumScore(rsiValue: number | null, momentum5d: number | null, momentum20d: number | null) {
  let score = 50
  if (rsiValue != null) {
    if (rsiValue >= 50 && rsiValue <= 65) score += 20
    else if (rsiValue > 65 && rsiValue <= 70) score += 15
    else if (rsiValue > 70) score += 8
    else if (rsiValue >= 30 && rsiValue < 40) score -= 15
    else if (rsiValue < 30) score -= 20
  }
  if (momentum5d != null) score += clamp(momentum5d * 2, -20, 20)
  if (momentum20d != null) score += clamp(momentum20d, -15, 15)
  return clamp(score)
}

function calculateVolumeScore(volRatio: number | null) {
  if (volRatio == null) return 50
  if (volRatio >= 2.5) return 95
  if (volRatio >= 2) return 90
  if (volRatio >= 1.5) return 78
  if (volRatio >= 1.2) return 68
  if (volRatio >= 1) return 58
  if (volRatio >= 0.7) return 45
  return 35
}

function calculateStructureScore(args: { marketStructure: MarketStructure; breakout: boolean; breakdown: boolean; nearResistance: boolean; nearSupport: boolean }) {
  if (args.breakout) return 95
  if (args.breakdown) return 15
  let score = 50
  if (args.marketStructure === 'BULLISH') score += 20
  if (args.marketStructure === 'BEARISH') score -= 20
  if (args.nearResistance) score += 3
  if (args.nearSupport) score -= 3
  return clamp(score)
}

function calculateRiskScore(args: { volatilityValue: number | null; rsiValue: number | null; distToSupport: number | null; distToResistance: number | null; volumeRatioValue: number | null }) {
  let score = 70
  const { volatilityValue, rsiValue, distToSupport, distToResistance, volumeRatioValue } = args
  if (volatilityValue != null) {
    if (volatilityValue >= 6) score -= 35
    else if (volatilityValue >= 4) score -= 20
    else if (volatilityValue >= 2) score -= 8
    else score += 5
  }
  if (rsiValue != null && rsiValue > 70) score -= 12
  if (rsiValue != null && rsiValue < 30) score -= 5
  if (distToSupport != null && distToSupport < 2) score += 8
  else if (distToSupport != null && distToSupport > 10) score -= 5
  if (distToResistance != null && distToResistance < 2) score -= 12
  else if (distToResistance != null && distToResistance > 8) score += 5
  if (volumeRatioValue != null && volumeRatioValue < 0.7) score -= 8
  return clamp(score)
}

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 70) return 'LOW'
  if (score >= 45) return 'MEDIUM'
  return 'HIGH'
}

function detectSetup(args: { breakout: boolean; breakdown: boolean; nearSupport: boolean; nearResistance: boolean; momentum5d: number | null; marketStructure: MarketStructure }): SetupType {
  if (args.breakout) return 'BREAKOUT'
  if (args.breakdown) return 'BREAKDOWN'
  if (args.nearSupport && args.marketStructure === 'BULLISH') return 'PULLBACK'
  if (args.momentum5d != null && args.momentum5d > 3 && args.marketStructure === 'BULLISH') return 'MOMENTUM'
  if (args.nearResistance) return 'RANGE'
  return 'NONE'
}


function tickSize(price: number) {
  if (price < 200) return 1
  if (price < 500) return 2
  if (price < 2000) return 5
  if (price < 5000) return 10
  return 25
}

function roundToTick(price: number) {
  const tick = tickSize(price)
  return Math.round(price / tick) * tick
}

function recentLow(candles: Candle[], lookback: number) {
  const recent = candles.slice(-lookback)
  return recent.length ? Math.min(...recent.map((c) => c.low)) : null
}

function buildTradePlan({
  candles,
  lastPrice,
  resistance,
  support,
  setup,
  breakout,
  breakdown,
  aiScore,
  riskLevel,
  rsiValue,
  volRatio,
}: {
  candles: Candle[]
  lastPrice: number
  resistance: number | null
  support: number | null
  setup: SetupType
  breakout: boolean
  breakdown: boolean
  aiScore: number
  riskLevel: RiskLevel
  rsiValue: number | null
  volRatio: number | null
}): TradePlan {
  const empty = (
    status: TradePlanStatus,
    finalAction: FinalAction,
    actionReason: string,
  ): TradePlan => ({
    status,
    entry: null,
    trigger: null,
    retestLow: null,
    retestHigh: null,
    invalidation: null,
    target1: null,
    target2: null,
    target3: null,
    riskPoints: null,
    rewardPoints: null,
    riskReward: null,
    riskPercent: null,
    finalAction,
    actionReason,
  })

  if (breakdown || setup === 'BREAKDOWN' || lastPrice <= 0) {
    return empty('NO_SETUP', 'AVOID', 'Struktur bearish/breakdown. Belum ada setup long yang valid.')
  }

  let entry: number | null = null
  let trigger: number | null = null
  let invalidation: number | null = null
  let retestLow: number | null = null
  let retestHigh: number | null = null

  if (setup === 'BREAKOUT' && resistance != null) {
    const tick = tickSize(resistance)
    trigger = roundToTick(resistance + tick)
    entry = trigger
    const buffer = Math.max(tick, resistance * 0.02)
    invalidation = roundToTick(resistance - buffer)
    retestLow = roundToTick(resistance * 0.985)
    retestHigh = roundToTick(resistance * 1.01)
  } else if (setup === 'PULLBACK') {
    entry = lastPrice
    trigger = roundToTick(lastPrice)
    const localSupport = recentLow(candles, 5)
    const candidateSupport =
      localSupport != null && localSupport < lastPrice
        ? localSupport
        : support != null && support < lastPrice
          ? support
          : null

    if (candidateSupport == null) {
      return empty('WAIT_CONFIRMATION', 'WAIT_CONFIRMATION', 'Belum ditemukan support lokal yang cukup dekat untuk invalidation.')
    }

    const buffer = Math.max(tickSize(candidateSupport), candidateSupport * 0.01)
    invalidation = roundToTick(candidateSupport - buffer)
    retestLow = roundToTick(candidateSupport)
    retestHigh = roundToTick(candidateSupport * 1.02)
  } else if (setup === 'MOMENTUM') {
    entry = lastPrice
    trigger = roundToTick(lastPrice)
    const localSupport = recentLow(candles, 5)
    const candidateSupport =
      localSupport != null && localSupport < lastPrice
        ? localSupport
        : support != null && support < lastPrice
          ? support
          : null

    if (candidateSupport == null) {
      return empty('WAIT_CONFIRMATION', 'WAIT_CONFIRMATION', 'Momentum ada, tetapi invalidation lokal belum jelas.')
    }

    const buffer = Math.max(tickSize(candidateSupport), candidateSupport * 0.015)
    invalidation = roundToTick(candidateSupport - buffer)

    // Saat momentum sudah extended, area yang dipantau adalah retest support,
    // bukan harga sekarang. Ini membuat WAIT FOR PULLBACK benar-benar actionable.
    retestLow = roundToTick(candidateSupport)
    retestHigh = roundToTick(candidateSupport * 1.02)
  } else if (setup === 'RANGE') {
    return {
      ...empty('WAIT_CONFIRMATION', 'WAIT_CONFIRMATION', 'Harga masih berada dalam range. Tunggu breakout atau pullback yang lebih jelas.'),
      trigger: resistance != null ? roundToTick(resistance + tickSize(resistance)) : null,
    }
  } else {
    return empty('NO_SETUP', 'AVOID', 'Belum ditemukan setup trading yang jelas.')
  }

  if (entry == null || invalidation == null || invalidation >= entry) {
    return {
      ...empty('WAIT_CONFIRMATION', 'WAIT_CONFIRMATION', 'Entry atau invalidation belum cukup jelas untuk membentuk trade plan.'),
      entry,
      trigger,
      retestLow,
      retestHigh,
    }
  }

  const riskPoints = entry - invalidation
  const riskPercent = (riskPoints / entry) * 100

  let target1 = roundToTick(entry + riskPoints)
  let target2 = roundToTick(entry + riskPoints * 2)
  let target3 = roundToTick(entry + riskPoints * 3)

  if (setup === 'PULLBACK' && resistance != null && resistance > entry) {
    target1 = Math.min(target1, roundToTick(resistance))
  }

  if (target1 <= entry) target1 = roundToTick(entry + tickSize(entry))
  if (target2 <= target1) target2 = roundToTick(target1 + riskPoints)
  if (target3 <= target2) target3 = roundToTick(target2 + riskPoints)

  const rewardPoints = target2 - entry
  const riskReward = rewardPoints / riskPoints

  const overbought = rsiValue != null && rsiValue > 70
  const weakVolume = volRatio != null && volRatio < 1
  const highRisk = riskLevel === 'HIGH'
  const strongScore = aiScore >= 70
  const watchScore = aiScore >= 60

  let status: TradePlanStatus = riskReward >= 1.5 ? 'VALID' : 'UNATTRACTIVE_RR'
  let finalAction: FinalAction = 'WAIT_CONFIRMATION'
  let actionReason = 'Setup belum cukup kuat untuk entry.'

  if (riskReward < 1.5) {
    status = 'UNATTRACTIVE_RR'
    finalAction = 'AVOID'
    actionReason = 'R:R di bawah 1:1.5 sehingga trade tidak menarik.'
  } else if (overbought && highRisk) {
    status = 'WAIT_CONFIRMATION'
    finalAction = 'WAIT_PULLBACK'
    actionReason = 'Momentum sudah extended dan risk tinggi; lebih aman menunggu pullback.'
  } else if (overbought || (weakVolume && setup === 'MOMENTUM')) {
    status = 'WAIT_CONFIRMATION'
    finalAction = 'WAIT_CONFIRMATION'
    actionReason = overbought
      ? 'RSI overbought; tunggu konfirmasi lanjutan atau pullback.'
      : 'Momentum ada tetapi volume belum mendukung.'
  } else if (setup === 'BREAKOUT' && !breakout) {
    status = 'WAIT_CONFIRMATION'
    finalAction = 'WAIT_CONFIRMATION'
    actionReason = 'Breakout belum terkonfirmasi di atas resistance.'
  } else if (strongScore && !highRisk) {
    status = 'VALID'
    finalAction = 'BUY_ON_CONFIRMATION'
    actionReason = 'Trend, momentum, struktur, dan R:R mendukung; tetap tunggu trigger.'
  } else if (watchScore) {
    status = 'WAIT_CONFIRMATION'
    finalAction = 'WAIT_CONFIRMATION'
    actionReason = 'Setup cukup menarik tetapi belum memenuhi seluruh filter kualitas.'
  } else {
    status = 'WAIT_CONFIRMATION'
    finalAction = 'WAIT_CONFIRMATION'
    actionReason = 'Skor belum cukup kuat untuk entry agresif.'
  }

  if (finalAction !== 'BUY_ON_CONFIRMATION' && status === 'VALID') {
    status = 'WAIT_CONFIRMATION'
  }

  return {
    status,
    entry,
    trigger,
    retestLow,
    retestHigh,
    invalidation,
    target1,
    target2,
    target3,
    riskPoints,
    rewardPoints,
    riskReward,
    riskPercent,
    finalAction,
    actionReason,
  }
}


export function analyzeStock(candles: Candle[]) {
  if (!candles || candles.length < 2) throw new Error('Minimal dibutuhkan 2 candle untuk analisis.')

  const sortedCandles = [...candles].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const closes = sortedCandles.map((c) => c.close)
  const volumes = sortedCandles.map((c) => c.volume)
  const lastCandle = sortedCandles[sortedCandles.length - 1]
  const previousCandle = sortedCandles[sortedCandles.length - 2]
  const lastPrice = lastCandle.close
  const prevPrice = previousCandle.close
  const changePercent = prevPrice ? ((lastPrice - prevPrice) / prevPrice) * 100 : null

  const ma20 = sma(closes, 20)
  const ma50 = sma(closes, 50)
  const previousMa20 = previousSma(closes, 20)
  const previousMa50 = previousSma(closes, 50)
  const rsiValue = rsi(closes, 14)
  const momentum5d = momentum(closes, 5)
  const momentum20d = momentum(closes, 20)
  const volRatio = volumeRatio(volumes, 20)
  const volatilityValue = volatility(closes, 20)
  const { support, resistance } = supportResistance(sortedCandles, 20)

  const distToResistance = resistance != null ? ((resistance - lastPrice) / lastPrice) * 100 : null
  const distToSupport = support != null ? ((lastPrice - support) / lastPrice) * 100 : null
  const nearResistance = distToResistance != null && distToResistance >= 0 && distToResistance <= 3
  const nearSupport = distToSupport != null && distToSupport >= 0 && distToSupport <= 3

  const breakout = resistance != null && lastPrice > resistance && (volRatio == null || volRatio >= 1.2)
  const breakdown = support != null && lastPrice < support && (volRatio == null || volRatio >= 1.2)
  const marketStructure = detectMarketStructure(sortedCandles)
  const setup = detectSetup({ breakout, breakdown, nearSupport, nearResistance, momentum5d, marketStructure })

  const trendScore = calculateTrendScore(lastPrice, ma20, ma50, previousMa20, previousMa50)
  const momentumScore = calculateMomentumScore(rsiValue, momentum5d, momentum20d)
  const volumeScore = calculateVolumeScore(volRatio)
  const structureScore = calculateStructureScore({ marketStructure, breakout, breakdown, nearResistance, nearSupport })
  const riskScore = calculateRiskScore({ volatilityValue, rsiValue, distToSupport, distToResistance, volumeRatioValue: volRatio })

  const aiScore = Math.round(trendScore * 0.25 + momentumScore * 0.2 + volumeScore * 0.15 + structureScore * 0.25 + riskScore * 0.15)
  let label: SignalLabel = 'WATCH'
  if (breakdown || aiScore < 45) label = 'BEARISH'
  else if (aiScore >= 70) label = 'BULLISH'

  const riskLevel = riskLevelFromScore(riskScore)
  const reasons: string[] = []
  if (ma20 != null) reasons.push(lastPrice > ma20 ? 'Harga di atas MA20' : 'Harga di bawah MA20')
  if (ma50 != null) reasons.push(lastPrice > ma50 ? 'Harga di atas MA50' : 'Harga di bawah MA50')
  if (ma20 != null && ma50 != null) reasons.push(ma20 > ma50 ? 'MA20 berada di atas MA50' : 'MA20 berada di bawah MA50')
  if (volRatio != null && volRatio >= 1.5) reasons.push(`Volume ${volRatio.toFixed(1)}x rata-rata 20D`)
  if (momentum5d != null) reasons.push(`Momentum 5D ${momentum5d >= 0 ? '+' : ''}${momentum5d.toFixed(1)}%`)
  if (marketStructure === 'BULLISH') reasons.push('Struktur higher high / higher low')
  if (marketStructure === 'BEARISH') reasons.push('Struktur lower high / lower low')
  if (breakout) reasons.push('Close menembus resistance sebelumnya dengan volume')
  else if (breakdown) reasons.push('Close menembus support sebelumnya')
  else if (setup === 'PULLBACK') reasons.push('Setup pullback ke area support')
  else if (setup === 'MOMENTUM') reasons.push('Setup momentum continuation')
  else reasons.push('Breakout belum terkonfirmasi')

  const risks: string[] = []
  if (breakdown) risks.push('Harga berada di bawah support sebelumnya')
  if (volatilityValue != null && volatilityValue >= 4) risks.push('Volatilitas relatif tinggi')
  if (distToResistance != null && distToResistance >= 0 && distToResistance < 3) risks.push('Resistance dekat dengan harga saat ini')
  if (distToSupport != null && distToSupport > 10) risks.push('Jarak ke support cukup jauh')
  if (rsiValue != null && rsiValue > 70) risks.push('RSI >70: momentum kuat tetapi sudah extended')
  if (rsiValue != null && rsiValue < 35) risks.push('RSI rendah: momentum masih lemah')
  if (volRatio != null && volRatio < 0.7) risks.push('Volume di bawah rata-rata 20D')

  const tradePlan = buildTradePlan({
    candles: sortedCandles,
    lastPrice,
    resistance,
    support,
    setup,
    breakout,
    breakdown,
    aiScore,
    riskLevel,
    rsiValue,
    volRatio,
  })

  const tradeAction =
    tradePlan.finalAction === 'BUY_ON_CONFIRMATION'
      ? 'BUY ON CONFIRMATION'
      : tradePlan.finalAction === 'WAIT_PULLBACK'
        ? 'WAIT FOR PULLBACK'
        : tradePlan.finalAction === 'AVOID'
          ? 'AVOID / WAIT'
          : 'WAIT FOR CONFIRMATION'

  return {
    engineVersion: 'technical-v3-final',
    lastPrice,
    changePercent,
    ma20,
    ma50,
    previousMa20,
    previousMa50,
    rsi: rsiValue,
    momentum5d,
    momentum20d,
    volumeRatio: volRatio,
    support,
    resistance,
    distToSupport,
    distToResistance,
    volatility: volatilityValue,
    marketStructure,
    breakout,
    breakdown,
    nearSupport,
    nearResistance,
    setup,
    trendScore,
    momentumScore,
    volumeScore,
    structureScore,
    riskScore,
    aiScore,
    label,
    riskLevel,
    reasons,
    risks,
    tradePlan,

    // Compatibility alias untuk UI lama.
    riskReward: tradePlan.riskReward,

    tradeAction,
    dataQuality: {
      candles: sortedCandles.length,
      hasMA20: ma20 != null,
      hasMA50: ma50 != null,
      hasRSI: rsiValue != null,
      hasVolumeBaseline: volRatio != null,
      hasSupportResistance: support != null && resistance != null,
    },
  }
}