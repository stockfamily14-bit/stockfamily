export type TradeDirection = 'LONG' | 'SHORT'

export type EntryLevel = {
  price: number
  weight: number
  filled: boolean
}

export type TargetLevel = {
  price: number
  hit: boolean
}

export type TradeState = {
  status:
    | 'PUBLISHED'
    | 'ACTIVE'
    | 'TARGET_1_HIT'
    | 'TARGET_2_HIT'
    | 'TARGET_3_HIT'
    | 'STOPPED'
    | 'CLOSED'
  currentPrice: number
  entries: EntryLevel[]
  targets: TargetLevel[]
  filledWeight: number
  averageEntry: number | null
  pnlPoints: number | null
  pnlPercent: number | null
  entry1FilledAt: string | null
  entry2FilledAt: string | null
  entry3FilledAt: string | null
  target1HitAt: string | null
  target2HitAt: string | null
  target3HitAt: string | null
  stoppedAt: string | null
  triggerHit: boolean
  triggerHitAt: string | null
  activatedAt: string | null
}

export type TradeEngineInput = {
  direction: TradeDirection
  currentPrice: number
  entry1: number | null
  entry2: number | null
  entry3: number | null
  entry1Weight?: number
  entry2Weight?: number
  entry3Weight?: number
  target1: number | null
  target2: number | null
  target3: number | null
  invalidation: number | null
  trigger: number | null
  previousState?: TradeState | null
}

const DEFAULT_ENTRY_WEIGHTS = {
  entry1: 0.4,
  entry2: 0.3,
  entry3: 0.3,
} as const

function isFiniteNumber(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value)
}

function now() {
  return new Date().toISOString()
}

function calculateAverageEntry(entries: EntryLevel[]) {
  const filled = entries.filter(
    (entry) =>
      entry.filled &&
      Number.isFinite(entry.price) &&
      Number.isFinite(entry.weight) &&
      entry.weight > 0,
  )

  if (filled.length === 0) return null

  const totalWeight = filled.reduce((sum, entry) => sum + entry.weight, 0)
  if (totalWeight <= 0) return null

  const weightedValue = filled.reduce(
    (sum, entry) => sum + entry.price * entry.weight,
    0,
  )

  return weightedValue / totalWeight
}

function calculatePnl(
  direction: TradeDirection,
  currentPrice: number,
  averageEntry: number | null,
) {
  if (
    averageEntry === null ||
    !Number.isFinite(currentPrice) ||
    !Number.isFinite(averageEntry) ||
    averageEntry === 0
  ) {
    return { pnlPoints: null, pnlPercent: null }
  }

  const pnlPoints =
    direction === 'LONG'
      ? currentPrice - averageEntry
      : averageEntry - currentPrice

  const pnlPercent = (pnlPoints / averageEntry) * 100

  return { pnlPoints, pnlPercent }
}

function entryWasHit(
  direction: TradeDirection,
  currentPrice: number,
  entryPrice: number,
) {
  if (direction === 'LONG') return currentPrice <= entryPrice
  return currentPrice >= entryPrice
}

// Trigger = konfirmasi breakout, arahnya KEBALIKAN dari entry.
// LONG: entry menangkap retrace turun (currentPrice <= entry),
//       trigger menangkap breakout naik (currentPrice >= trigger).
// SHORT: entry menangkap retrace naik, trigger menangkap breakdown turun.
function triggerWasHit(
  direction: TradeDirection,
  currentPrice: number,
  triggerPrice: number,
) {
  if (direction === 'LONG') return currentPrice >= triggerPrice
  return currentPrice <= triggerPrice
}

function targetWasHit(
  direction: TradeDirection,
  currentPrice: number,
  targetPrice: number,
) {
  if (direction === 'LONG') return currentPrice >= targetPrice
  return currentPrice <= targetPrice
}

function invalidationWasHit(
  direction: TradeDirection,
  currentPrice: number,
  invalidation: number,
) {
  if (direction === 'LONG') return currentPrice <= invalidation
  return currentPrice >= invalidation
}

function createEntries(input: TradeEngineInput): EntryLevel[] {
  return [
    {
      price: input.entry1 ?? 0,
      weight: input.entry1Weight ?? DEFAULT_ENTRY_WEIGHTS.entry1,
      filled: false,
    },
    {
      price: input.entry2 ?? 0,
      weight: input.entry2Weight ?? DEFAULT_ENTRY_WEIGHTS.entry2,
      filled: false,
    },
    {
      price: input.entry3 ?? 0,
      weight: input.entry3Weight ?? DEFAULT_ENTRY_WEIGHTS.entry3,
      filled: false,
    },
  ]
}

function createTargets(input: TradeEngineInput): TargetLevel[] {
  return [
    { price: input.target1 ?? 0, hit: false },
    { price: input.target2 ?? 0, hit: false },
    { price: input.target3 ?? 0, hit: false },
  ]
}

function cloneState(input: TradeEngineInput): TradeState {
  const previous = input.previousState

  return {
    status: previous?.status ?? 'PUBLISHED',
    currentPrice: input.currentPrice,
    entries: previous?.entries
      ? previous.entries.map((entry) => ({ ...entry }))
      : createEntries(input),
    targets: previous?.targets
      ? previous.targets.map((target) => ({ ...target }))
      : createTargets(input),
    filledWeight: previous?.filledWeight ?? 0,
    averageEntry: previous?.averageEntry ?? null,
    pnlPoints: previous?.pnlPoints ?? null,
    pnlPercent: previous?.pnlPercent ?? null,
    entry1FilledAt: previous?.entry1FilledAt ?? null,
    entry2FilledAt: previous?.entry2FilledAt ?? null,
    entry3FilledAt: previous?.entry3FilledAt ?? null,
    target1HitAt: previous?.target1HitAt ?? null,
    target2HitAt: previous?.target2HitAt ?? null,
    target3HitAt: previous?.target3HitAt ?? null,
    stoppedAt: previous?.stoppedAt ?? null,
    triggerHit: previous?.triggerHit ?? false,
    triggerHitAt: previous?.triggerHitAt ?? null,
    activatedAt: previous?.activatedAt ?? null,
  }
}

export function runTradeEngine(input: TradeEngineInput): TradeState {
  if (!Number.isFinite(input.currentPrice)) {
    throw new Error('Current price must be a finite number')
  }

  if (input.entry1Weight !== undefined && input.entry1Weight > 1) {
    throw new Error('Entry 1 weight must be stored as a fraction, e.g. 0.40')
  }
  if (input.entry2Weight !== undefined && input.entry2Weight > 1) {
    throw new Error('Entry 2 weight must be stored as a fraction, e.g. 0.30')
  }
  if (input.entry3Weight !== undefined && input.entry3Weight > 1) {
    throw new Error('Entry 3 weight must be stored as a fraction, e.g. 0.30')
  }

  const state = cloneState(input)
  state.currentPrice = input.currentPrice

  if (state.status === 'CLOSED' || state.status === 'STOPPED') {
    const pnl = calculatePnl(
      input.direction,
      state.currentPrice,
      state.averageEntry,
    )
    state.pnlPoints = pnl.pnlPoints
    state.pnlPercent = pnl.pnlPercent
    return state
  }

  // Cek entry (retrace) seperti biasa.
  state.entries.forEach((entry, index) => {
    if (
      entry.filled ||
      !Number.isFinite(entry.price) ||
      entry.price <= 0 ||
      !Number.isFinite(entry.weight) ||
      entry.weight <= 0
    ) {
      return
    }

    if (entryWasHit(input.direction, state.currentPrice, entry.price)) {
      entry.filled = true
      const timestamp = now()

      if (index === 0) state.entry1FilledAt = timestamp
      if (index === 1) state.entry2FilledAt = timestamp
      if (index === 2) state.entry3FilledAt = timestamp
    }
  })

  // Cek trigger (breakout) secara independen dari entry.
  if (
    !state.triggerHit &&
    isFiniteNumber(input.trigger) &&
    input.trigger > 0 &&
    triggerWasHit(input.direction, state.currentPrice, input.trigger)
  ) {
    state.triggerHit = true
    state.triggerHitAt = now()
  }

  state.filledWeight = state.entries
    .filter((entry) => entry.filled)
    .reduce((sum, entry) => sum + entry.weight, 0)

  state.averageEntry = calculateAverageEntry(state.entries)

  const hasEntryBasis = state.filledWeight > 0 && state.averageEntry !== null

  // Jalur aktivasi: entry filled ATAU trigger tersentuh.
  if (!hasEntryBasis && !state.triggerHit) {
    state.status = 'PUBLISHED'
    state.pnlPoints = null
    state.pnlPercent = null
    return state
  }

  if (state.status === 'PUBLISHED') {
    state.status = 'ACTIVE'
    if (!state.activatedAt) {
      state.activatedAt = now()
    }
  }

  // PnL hanya bisa dihitung kalau sudah ada entry yang benar-benar filled.
  // Trigger-only (belum ada entry filled) tetap ACTIVE tapi PnL null,
  // karena belum ada average entry price sebagai basis hitung.
  const pnl = hasEntryBasis
    ? calculatePnl(input.direction, state.currentPrice, state.averageEntry)
    : { pnlPoints: null, pnlPercent: null }
  state.pnlPoints = pnl.pnlPoints
  state.pnlPercent = pnl.pnlPercent

  // Invalidation/target hanya relevan kalau sudah ada entry basis untuk pnl.
  if (!hasEntryBasis) {
    return state
  }

  if (
    isFiniteNumber(input.invalidation) &&
    input.invalidation > 0 &&
    invalidationWasHit(
      input.direction,
      state.currentPrice,
      input.invalidation,
    )
  ) {
    state.status = 'STOPPED'

    if (!state.stoppedAt) {
      state.stoppedAt = now()
    }

    return state
  }

  if (
    !state.targets[0].hit &&
    Number.isFinite(state.targets[0].price) &&
    state.targets[0].price > 0 &&
    targetWasHit(
      input.direction,
      state.currentPrice,
      state.targets[0].price,
    )
  ) {
    state.targets[0].hit = true

    if (!state.target1HitAt) {
      state.target1HitAt = now()
    }

    state.status = 'TARGET_1_HIT'
  }

  if (
    !state.targets[1].hit &&
    Number.isFinite(state.targets[1].price) &&
    state.targets[1].price > 0 &&
    targetWasHit(
      input.direction,
      state.currentPrice,
      state.targets[1].price,
    )
  ) {
    state.targets[1].hit = true

    if (!state.target2HitAt) {
      state.target2HitAt = now()
    }

    state.status = 'TARGET_2_HIT'
  }

  if (
    !state.targets[2].hit &&
    Number.isFinite(state.targets[2].price) &&
    state.targets[2].price > 0 &&
    targetWasHit(
      input.direction,
      state.currentPrice,
      state.targets[2].price,
    )
  ) {
    state.targets[2].hit = true

    if (!state.target3HitAt) {
      state.target3HitAt = now()
    }

    state.status = 'TARGET_3_HIT'
  }

  return state
}