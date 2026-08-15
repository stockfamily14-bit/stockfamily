export type Candle = {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type Analysis = {
  lastPrice: number
  changePercent: number | null

  ma20: number | null
  ma50: number | null
  rsi14: number | null
  momentum5d: number | null
  momentum20d: number | null
  volumeRatio: number | null

  support: number | null
  resistance: number | null
  distanceToSupport: number | null
  distanceToResistance: number | null

  marketStructure: 'BULLISH' | 'BEARISH' | 'RANGE' | 'UNKNOWN'
  setup:
    | 'BREAKOUT'
    | 'PULLBACK'
    | 'MOMENTUM'
    | 'RANGE'
    | 'BREAKDOWN'
    | 'NONE'

  trendScore: number
  momentumScore: number
  volumeScore: number
  structureScore: number
  riskScore: number
  score: number

  signal: 'BULLISH' | 'WATCH' | 'BEARISH'
  risk: 'LOW' | 'MEDIUM' | 'HIGH'

  entry: number | null
  trigger: number | null
  invalidation: number | null
  target1: number | null
  target2: number | null
  riskPercent: number | null
  rr: number | null

  action:
    | 'BUY_ON_CONFIRMATION'
    | 'WAIT_CONFIRMATION'
    | 'WAIT_PULLBACK'
    | 'AVOID'

  actionReason: string
  reasons: string[]
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

function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null

  let gain = 0
  let loss = 0

  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1]

    if (diff > 0) gain += diff
    else loss += Math.abs(diff)
  }

  let avgGain = gain / period
  let avgLoss = loss / period

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1]

    const currentGain = diff > 0 ? diff : 0
    const currentLoss = diff < 0 ? Math.abs(diff) : 0

    avgGain = (avgGain * (period - 1) + currentGain) / period
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period
  }

  if (avgLoss === 0) return 100

  const rs = avgGain / avgLoss

  return 100 - 100 / (1 + rs)
}

function momentum(values: number[], days: number): number | null {
  if (values.length < days + 1) return null

  const previous = values[values.length - 1 - days]
  const current = values[values.length - 1]

  if (!previous) return null

  return ((current - previous) / previous) * 100
}

function volumeRatio(values: number[], period = 20): number | null {
  if (values.length < period + 1) return null

  const current = values[values.length - 1]
  const average = sma(values.slice(0, -1), period)

  if (!average) return null

  return current / average
}

function detectStructure(candles: Candle[]) {
  if (candles.length < 20) return 'UNKNOWN' as const

  const recent = candles.slice(-10)
  const previous = candles.slice(-20, -10)

  const recentHigh = Math.max(...recent.map(c => c.high))
  const previousHigh = Math.max(...previous.map(c => c.high))

  const recentLow = Math.min(...recent.map(c => c.low))
  const previousLow = Math.min(...previous.map(c => c.low))

  if (recentHigh > previousHigh && recentLow > previousLow) {
    return 'BULLISH' as const
  }

  if (recentHigh < previousHigh && recentLow < previousLow) {
    return 'BEARISH' as const
  }

  return 'RANGE' as const
}

function getLevels(candles: Candle[]) {
  if (candles.length < 20) {
    return {
      support: null,
      resistance: null,
    }
  }

  const recent = candles.slice(-20)

  return {
    support: Math.min(...recent.map(c => c.low)),
    resistance: Math.max(...recent.map(c => c.high)),
  }
}

function tickSize(price: number) {
  if (price < 200) return 1
  if (price < 500) return 2
  if (price < 2000) return 5
  if (price < 5000) return 10
  return 25
}

function roundTick(value: number) {
  const tick = tickSize(value)
  return Math.round(value / tick) * tick
}

function scoreTrend(
  price: number,
  ma20: number | null,
  ma50: number | null,
  previousMa20: number | null,
  previousMa50: number | null
) {
  let score = 50

  if (ma20 != null) {
    score += price > ma20 ? 15 : -15
  }

  if (ma50 != null) {
    score += price > ma50 ? 15 : -15
  }

  if (ma20 != null && ma50 != null) {
    score += ma20 > ma50 ? 15 : -15
  }

  if (
    ma20 != null &&
    previousMa20 != null &&
    ma20 > previousMa20
  ) {
    score += 5
  }

  if (
    ma50 != null &&
    previousMa50 != null &&
    ma50 > previousMa50
  ) {
    score += 5
  }

  return clamp(score)
}

function scoreMomentum(
  rsiValue: number | null,
  momentum5: number | null,
  momentum20: number | null
) {
  let score = 50

  if (rsiValue != null) {
    if (rsiValue >= 55 && rsiValue <= 70) score += 20
    else if (rsiValue > 70) score += 5
    else if (rsiValue < 40) score -= 20
  }

  if (momentum5 != null) {
    if (momentum5 > 3) score += 15
    else if (momentum5 > 0) score += 8
    else if (momentum5 < -3) score -= 15
  }

  if (momentum20 != null) {
    if (momentum20 > 5) score += 15
    else if (momentum20 < -5) score -= 15
  }

  return clamp(score)
}

function scoreVolume(ratio: number | null) {
  if (ratio == null) return 50
  if (ratio >= 2.5) return 95
  if (ratio >= 2) return 90
  if (ratio >= 1.5) return 78
  if (ratio >= 1.2) return 68
  if (ratio >= 1) return 58
  if (ratio >= 0.7) return 45
  return 35
}

export function analyzeStock(input: Candle[]): Analysis {
  const candles = [...input]
    .filter(
      c =>
        Number.isFinite(c.close) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.volume)
    )
    .sort(
      (a, b) =>
        new Date(a.date).getTime() -
        new Date(b.date).getTime()
    )

  if (candles.length < 20) {
    throw new Error('Minimal 20 candle diperlukan untuk technical analysis.')
  }

  const closes = candles.map(c => c.close)
  const volumes = candles.map(c => c.volume)

  const last = candles[candles.length - 1]
  const previous = candles[candles.length - 2]

  const price = last.close

  const changePercent =
    previous.close !== 0
      ? ((price - previous.close) / previous.close) * 100
      : null

  const ma20 = sma(closes, 20)
  const ma50 = sma(closes, 50)

  const previousMa20 = previousSma(closes, 20)
  const previousMa50 = previousSma(closes, 50)

  const rsi14 = rsi(closes)
  const momentum5d = momentum(closes, 5)
  const momentum20d = momentum(closes, 20)

  const volRatio = volumeRatio(volumes)

  const levels = getLevels(candles)

  const support = levels.support
  const resistance = levels.resistance

  const distanceToSupport =
    support != null
      ? ((price - support) / price) * 100
      : null

  const distanceToResistance =
    resistance != null
      ? ((resistance - price) / price) * 100
      : null

  const nearSupport =
    distanceToSupport != null &&
    distanceToSupport >= 0 &&
    distanceToSupport <= 3

  const nearResistance =
    distanceToResistance != null &&
    distanceToResistance >= 0 &&
    distanceToResistance <= 3

  const breakout =
    resistance != null &&
    price > resistance &&
    (volRatio == null || volRatio >= 1.2)

  const breakdown =
    support != null &&
    price < support &&
    (volRatio == null || volRatio >= 1.2)

  const structure = detectStructure(candles)

  let setup:
    | 'BREAKOUT'
    | 'PULLBACK'
    | 'MOMENTUM'
    | 'RANGE'
    | 'BREAKDOWN'
    | 'NONE' = 'NONE'

  if (breakout) setup = 'BREAKOUT'
  else if (breakdown) setup = 'BREAKDOWN'
  else if (nearSupport && structure === 'BULLISH') setup = 'PULLBACK'
  else if (
    momentum5d != null &&
    momentum5d > 3 &&
    structure === 'BULLISH'
  ) setup = 'MOMENTUM'
  else if (nearResistance) setup = 'RANGE'

  const trendScore = scoreTrend(
    price,
    ma20,
    ma50,
    previousMa20,
    previousMa50
  )

  const momentumScore = scoreMomentum(
    rsi14,
    momentum5d,
    momentum20d
  )

  const volumeScore = scoreVolume(volRatio)

  let structureScore = 50

  if (structure === 'BULLISH') structureScore += 20
  if (structure === 'BEARISH') structureScore -= 20
  if (breakout) structureScore = 95
  if (breakdown) structureScore = 15

  structureScore = clamp(structureScore)

  let riskScore = 70

  if (rsi14 != null && rsi14 > 70) riskScore -= 12
  if (volRatio != null && volRatio < 0.7) riskScore -= 8

  if (
    distanceToResistance != null &&
    distanceToResistance < 2
  ) {
    riskScore -= 12
  }

  if (
    distanceToSupport != null &&
    distanceToSupport < 2
  ) {
    riskScore += 8
  }

  riskScore = clamp(riskScore)

  const score = Math.round(
    trendScore * 0.25 +
    momentumScore * 0.2 +
    volumeScore * 0.15 +
    structureScore * 0.25 +
    riskScore * 0.15
  )

  let signal: 'BULLISH' | 'WATCH' | 'BEARISH' = 'WATCH'

  if (breakdown || score < 45) signal = 'BEARISH'
  else if (score >= 70) signal = 'BULLISH'

  const risk =
    riskScore >= 70
      ? 'LOW'
      : riskScore >= 45
        ? 'MEDIUM'
        : 'HIGH'

  const reasons: string[] = []

  if (ma20 != null) {
    reasons.push(
      price > ma20
        ? 'Harga berada di atas MA20'
        : 'Harga berada di bawah MA20'
    )
  }

  if (ma50 != null) {
    reasons.push(
      price > ma50
        ? 'Harga berada di atas MA50'
        : 'Harga berada di bawah MA50'
    )
  }

  if (ma20 != null && ma50 != null) {
    reasons.push(
      ma20 > ma50
        ? 'MA20 berada di atas MA50'
        : 'MA20 berada di bawah MA50'
    )
  }

  if (volRatio != null && volRatio >= 1.5) {
    reasons.push(
      `Volume ${volRatio.toFixed(1)}x rata-rata 20D`
    )
  }

  if (momentum5d != null) {
    reasons.push(
      `Momentum 5D ${
        momentum5d >= 0 ? '+' : ''
      }${momentum5d.toFixed(1)}%`
    )
  }

  if (structure === 'BULLISH') {
    reasons.push('Struktur higher high / higher low')
  }

  if (structure === 'BEARISH') {
    reasons.push('Struktur lower high / lower low')
  }

  if (breakout) {
    reasons.push(
      'Harga menembus resistance dengan volume'
    )
  } else if (breakdown) {
    reasons.push(
      'Harga menembus support dengan volume'
    )
  } else if (setup === 'PULLBACK') {
    reasons.push(
      'Setup pullback ke area support'
    )
  } else if (setup === 'MOMENTUM') {
    reasons.push(
      'Setup momentum continuation'
    )
  }

  let entry: number | null = null
  let trigger: number | null = null
  let invalidation: number | null = null
  let target1: number | null = null
  let target2: number | null = null
  let riskPercent: number | null = null
  let rr: number | null = null

  if (setup === 'BREAKOUT' && resistance != null) {
    trigger = roundTick(resistance)
    entry = roundTick(resistance * 1.002)
    invalidation = roundTick(
      resistance * 0.985
    )
  } else if (
    setup === 'PULLBACK' &&
    support != null
  ) {
    entry = roundTick(
      Math.max(price, support)
    )
    trigger = entry
    invalidation = roundTick(
      support * 0.985
    )
  } else if (
    setup === 'MOMENTUM'
  ) {
    entry = price
    trigger = price
    invalidation = roundTick(
      price * 0.97
    )
  }

  if (
    entry != null &&
    invalidation != null &&
    invalidation < entry
  ) {
    const riskPoints =
      entry - invalidation

    riskPercent =
      (riskPoints / entry) * 100

    target1 = roundTick(
      entry + riskPoints
    )

    target2 = roundTick(
      entry + riskPoints * 2
    )

    if (
      setup === 'PULLBACK' &&
      resistance != null &&
      resistance > entry
    ) {
      target1 = roundTick(
        Math.min(
          target1,
          resistance
        )
      )
    }

    rr =
      (target2 - entry) /
      riskPoints
  }

  let action:
    | 'BUY_ON_CONFIRMATION'
    | 'WAIT_CONFIRMATION'
    | 'WAIT_PULLBACK'
    | 'AVOID' =
    'WAIT_CONFIRMATION'

  let actionReason =
    'Setup belum cukup kuat untuk entry.'

  if (rr != null && rr < 1.5) {
    action = 'AVOID'
    actionReason =
      'Risk/reward di bawah 1:1.5.'
  } else if (
    rsi14 != null &&
    rsi14 > 70 &&
    risk === 'HIGH'
  ) {
    action = 'WAIT_PULLBACK'
    actionReason =
      'Momentum sudah extended dan risk tinggi.'
  } else if (
    rsi14 != null &&
    rsi14 > 70
  ) {
    action = 'WAIT_CONFIRMATION'
    actionReason =
      'RSI overbought; tunggu pullback atau konfirmasi lanjutan.'
  } else if (
    setup === 'BREAKOUT' &&
    !breakout
  ) {
    action = 'WAIT_CONFIRMATION'
    actionReason =
      'Breakout belum terkonfirmasi.'
  } else if (
    score >= 70 &&
    risk !== 'HIGH'
  ) {
    action = 'BUY_ON_CONFIRMATION'
    actionReason =
      'Trend, momentum, struktur dan risk/reward mendukung.'
  } else {
    action = 'WAIT_CONFIRMATION'
    actionReason =
      'Setup menarik tetapi belum memenuhi seluruh filter.'
  }

  return {
    lastPrice: price,
    changePercent,

    ma20,
    ma50,
    rsi14,
    momentum5d,
    momentum20d,
    volumeRatio: volRatio,

    support,
    resistance,
    distanceToSupport,
    distanceToResistance,

    marketStructure: structure,
    setup,

    trendScore,
    momentumScore,
    volumeScore,
    structureScore,
    riskScore,
    score,

    signal,
    risk,

    entry,
    trigger,
    invalidation,
    target1,
    target2,
    riskPercent,
    rr,

    action,
    actionReason,
    reasons,
  }
}