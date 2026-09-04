import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { runTradeEngine, type TradeState, type TradeDirection } from './trade-engine'

const MONITORED_STATUSES = ['PUBLISHED', 'ACTIVE', 'TARGET_1_HIT', 'TARGET_2_HIT'] as const
const MAX_PRICE_AGE_MS = 5 * 60 * 1000

type InsightRow = {
  id: string; ticker: string; direction: TradeDirection; status: string
  entry_1: number | string | null; entry_1_weight: number | string | null; entry_1_filled: boolean | null; entry_1_filled_at: string | null
  entry_2: number | string | null; entry_2_weight: number | string | null; entry_2_filled: boolean | null; entry_2_filled_at: string | null
  entry_3: number | string | null; entry_3_weight: number | string | null; entry_3_filled: boolean | null; entry_3_filled_at: string | null
  target_1: number | string | null; target_1_hit: boolean | null; target_1_hit_at: string | null
  target_2: number | string | null; target_2_hit: boolean | null; target_2_hit_at: string | null
  target_3: number | string | null; target_3_hit: boolean | null; target_3_hit_at: string | null
  invalidation: number | string | null; filled_weight: number | string | null; average_entry: number | string | null
  current_price: number | string | null; pnl_points: number | string | null; pnl_percent: number | string | null
  last_price_at: string | null; stopped_at: string | null
  trigger: number | string | null; activated_at: string | null
}

type LatestPriceRow = { ticker: string; price: number | string | null; recorded_at: string | null }

function asNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toTradeState(row: InsightRow): TradeState {
  const status: TradeState['status'] =
    row.status === 'ACTIVE' || row.status === 'TARGET_1_HIT' || row.status === 'TARGET_2_HIT' || row.status === 'TARGET_3_HIT' || row.status === 'STOPPED' || row.status === 'CLOSED'
      ? row.status
      : 'PUBLISHED'

  return {
    status,
    currentPrice: asNumber(row.current_price) ?? 0,
    entries: [
      { price: asNumber(row.entry_1) ?? 0, weight: asNumber(row.entry_1_weight) ?? 0.4, filled: row.entry_1_filled === true },
      { price: asNumber(row.entry_2) ?? 0, weight: asNumber(row.entry_2_weight) ?? 0.3, filled: row.entry_2_filled === true },
      { price: asNumber(row.entry_3) ?? 0, weight: asNumber(row.entry_3_weight) ?? 0.3, filled: row.entry_3_filled === true },
    ],
    targets: [
      { price: asNumber(row.target_1) ?? 0, hit: row.target_1_hit === true },
      { price: asNumber(row.target_2) ?? 0, hit: row.target_2_hit === true },
      { price: asNumber(row.target_3) ?? 0, hit: row.target_3_hit === true },
    ],
    filledWeight: asNumber(row.filled_weight) ?? 0,
    averageEntry: asNumber(row.average_entry),
    pnlPoints: asNumber(row.pnl_points),
    pnlPercent: asNumber(row.pnl_percent),
    entry1FilledAt: row.entry_1_filled_at,
    entry2FilledAt: row.entry_2_filled_at,
    entry3FilledAt: row.entry_3_filled_at,
    target1HitAt: row.target_1_hit_at,
    target2HitAt: row.target_2_hit_at,
    target3HitAt: row.target_3_hit_at,
    stoppedAt: row.stopped_at,
    triggerHit: false,
    triggerHitAt: null,
    activatedAt: row.activated_at,
  }
}

function getOutcome(status: TradeState['status']) {
  if (status === 'TARGET_1_HIT') return 'TARGET_1'
  if (status === 'TARGET_2_HIT') return 'TARGET_2'
  if (status === 'TARGET_3_HIT') return 'TARGET_3'
  if (status === 'STOPPED') return 'STOP'
  return null
}

// ============================================================
// NOTIFICATION QUEUE (Fase A — cuma catat event, belum kirim)
// ============================================================

type NotificationEventType = 'ACTIVATED' | 'TARGET_1_HIT' | 'TARGET_2_HIT' | 'TARGET_3_HIT' | 'STOPPED'

function buildNotificationCopy(
  eventType: NotificationEventType,
  ticker: string,
  direction: TradeDirection,
  extra: { price?: number | null; pnlPercent?: number | null } = {},
): { title: string; message: string } {
  const dirLabel = direction === 'LONG' ? 'Long' : 'Short'

  switch (eventType) {
    case 'ACTIVATED':
      return {
        title: `${ticker} sekarang ACTIVE`,
        message: `Signal ${dirLabel} ${ticker} sudah aktif${extra.price != null ? ` di harga ${extra.price}` : ''}.`,
      }
    case 'TARGET_1_HIT':
      return {
        title: `${ticker} kena Target 1`,
        message: `Signal ${dirLabel} ${ticker} mencapai Target 1${extra.pnlPercent != null ? ` (${extra.pnlPercent.toFixed(2)}%)` : ''}.`,
      }
    case 'TARGET_2_HIT':
      return {
        title: `${ticker} kena Target 2`,
        message: `Signal ${dirLabel} ${ticker} mencapai Target 2${extra.pnlPercent != null ? ` (${extra.pnlPercent.toFixed(2)}%)` : ''}.`,
      }
    case 'TARGET_3_HIT':
      return {
        title: `${ticker} kena Target 3 (Closed)`,
        message: `Signal ${dirLabel} ${ticker} mencapai Target 3 dan ditutup${extra.pnlPercent != null ? ` (${extra.pnlPercent.toFixed(2)}%)` : ''}.`,
      }
    case 'STOPPED':
      return {
        title: `${ticker} kena Stop`,
        message: `Signal ${dirLabel} ${ticker} tersentuh invalidation/stop level.`,
      }
  }
}

async function queueNotification(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  insightId: string,
  ticker: string,
  direction: TradeDirection,
  eventType: NotificationEventType,
  extra: { price?: number | null; pnlPercent?: number | null } = {},
) {
  const { title, message } = buildNotificationCopy(eventType, ticker, direction, extra)

  const { error } = await supabase.from('notification_queue').insert({
    insight_id: insightId,
    ticker,
    event_type: eventType,
    title,
    message,
  })

  if (error) {
    // Notifikasi gagal dicatat tidak boleh menggagalkan proses monitor
    // utama (yang mengurus status trading) — cukup di-log.
    console.error(`Gagal queue notifikasi ${eventType} untuk ${ticker}:`, error.message)
  }
}

/**
 * Bandingkan status sebelum & sesudah untuk mendeteksi transisi apa saja
 * yang terjadi, lalu antrikan notifikasi yang sesuai. Dipanggil SEBELUM
 * status baru ditulis ke DB, supaya "previousStatus" akurat.
 */
async function queueTransitionNotifications(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  row: InsightRow,
  state: TradeState,
) {
  const previousStatus = row.status
  const newStatus = state.status

  if (previousStatus === newStatus) return

  const extra = { price: state.currentPrice, pnlPercent: state.pnlPercent }

  if (previousStatus === 'PUBLISHED' && newStatus === 'ACTIVE') {
    await queueNotification(supabase, row.id, row.ticker, row.direction, 'ACTIVATED', extra)
  }
  if (newStatus === 'TARGET_1_HIT' && previousStatus !== 'TARGET_1_HIT') {
    await queueNotification(supabase, row.id, row.ticker, row.direction, 'TARGET_1_HIT', extra)
  }
  if (newStatus === 'TARGET_2_HIT' && previousStatus !== 'TARGET_2_HIT') {
    await queueNotification(supabase, row.id, row.ticker, row.direction, 'TARGET_2_HIT', extra)
  }
  if (newStatus === 'TARGET_3_HIT' && previousStatus !== 'TARGET_3_HIT') {
    await queueNotification(supabase, row.id, row.ticker, row.direction, 'TARGET_3_HIT', extra)
  }
  if (newStatus === 'STOPPED' && previousStatus !== 'STOPPED') {
    await queueNotification(supabase, row.id, row.ticker, row.direction, 'STOPPED', extra)
  }
}

async function persistState(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  row: InsightRow,
  state: TradeState,
  priceRecordedAt: string,
) {
  // Antrikan notifikasi dulu (baca previous status sebelum ke-overwrite).
  await queueTransitionNotifications(supabase, row, state)

  const payload: Record<string, unknown> = {
    current_price: state.currentPrice,
    last_price_at: priceRecordedAt,
    entry_1_filled: state.entries[0]?.filled ?? false,
    entry_1_filled_at: state.entry1FilledAt,
    entry_1_weight: state.entries[0]?.weight ?? 0.4,
    entry_2_filled: state.entries[1]?.filled ?? false,
    entry_2_filled_at: state.entry2FilledAt,
    entry_2_weight: state.entries[1]?.weight ?? 0.3,
    entry_3_filled: state.entries[2]?.filled ?? false,
    entry_3_filled_at: state.entry3FilledAt,
    entry_3_weight: state.entries[2]?.weight ?? 0.3,
    filled_weight: state.filledWeight,
    average_entry: state.averageEntry,
    pnl_points: state.pnlPoints,
    pnl_percent: state.pnlPercent,
    target_1_hit: state.targets[0]?.hit ?? false,
    target_1_hit_at: state.target1HitAt,
    target_2_hit: state.targets[1]?.hit ?? false,
    target_2_hit_at: state.target2HitAt,
    target_3_hit: state.targets[2]?.hit ?? false,
    target_3_hit_at: state.target3HitAt,
    activated_at: state.activatedAt,
    updated_at: new Date().toISOString(),
  }

  if (state.status === 'PUBLISHED') {
    payload.status = 'PUBLISHED'
    payload.outcome = null
  } else if (state.status === 'ACTIVE') {
    payload.status = 'ACTIVE'
    payload.outcome = null
  } else if (state.status === 'TARGET_1_HIT' || state.status === 'TARGET_2_HIT') {
    payload.status = state.status
    payload.outcome = getOutcome(state.status)
    payload.result_percent = state.pnlPercent
  } else if (state.status === 'STOPPED') {
    payload.status = 'STOPPED'
    payload.outcome = 'STOP'
    payload.stopped_at = state.stoppedAt
    payload.result_percent = state.pnlPercent
  }

  if (state.status === 'TARGET_3_HIT') {
    const target3At = state.target3HitAt ?? new Date().toISOString()
    const { error: target3Error } = await supabase
      .from('insight_signals')
      .update({ ...payload, status: 'TARGET_3_HIT', outcome: 'TARGET_3', target_3_hit: true, target_3_hit_at: target3At, result_percent: state.pnlPercent })
      .eq('id', row.id)
      .eq('status', row.status)
    if (target3Error) throw new Error(`Failed to persist TARGET_3_HIT for ${row.ticker}: ${target3Error.message}`)

    const { error: closeError } = await supabase
      .from('insight_signals')
      .update({ status: 'CLOSED', outcome: 'TARGET_3', closed_at: new Date().toISOString(), result_percent: state.pnlPercent, updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'TARGET_3_HIT')
    if (closeError) throw new Error(`Failed to close ${row.ticker} after TARGET_3: ${closeError.message}`)
    return
  }

  const { error } = await supabase
    .from('insight_signals')
    .update(payload)
    .eq('id', row.id)
    .eq('status', row.status)
  if (error) throw new Error(`Failed to persist ${row.ticker}: ${error.message}`)
}

export async function monitorInsights() {
  const supabase = getSupabaseAdmin()

  const { data: insights, error: insightError } = await supabase
    .from('insight_signals')
    .select(`
      id, ticker, direction, status,
      entry_1, entry_1_weight, entry_1_filled, entry_1_filled_at,
      entry_2, entry_2_weight, entry_2_filled, entry_2_filled_at,
      entry_3, entry_3_weight, entry_3_filled, entry_3_filled_at,
      target_1, target_1_hit, target_1_hit_at,
      target_2, target_2_hit, target_2_hit_at,
      target_3, target_3_hit, target_3_hit_at,
      invalidation, filled_weight, average_entry, current_price,
      pnl_points, pnl_percent, last_price_at, stopped_at,
      trigger, activated_at
    `)
    .in('status', [...MONITORED_STATUSES])

  if (insightError) throw new Error(`Failed to load insights: ${insightError.message}`)

  const rows = (insights ?? []) as InsightRow[]
  if (rows.length === 0) return { success: true, scanned: 0, updated: 0, skipped: 0, errors: [] }

  const tickers = [...new Set(rows.map((row) => row.ticker))]
  const { data: latestPrices, error: priceError } = await supabase
    .from('latest_prices')
    .select('ticker, price, recorded_at')
    .in('ticker', tickers)
  if (priceError) throw new Error(`Failed to load latest prices: ${priceError.message}`)

  const latestByTicker = new Map<string, LatestPriceRow>()
  for (const price of (latestPrices ?? []) as LatestPriceRow[]) {
    const existing = latestByTicker.get(price.ticker)
    if (!existing) { latestByTicker.set(price.ticker, price); continue }
    const existingTime = existing.recorded_at ? new Date(existing.recorded_at).getTime() : 0
    const currentTime = price.recorded_at ? new Date(price.recorded_at).getTime() : 0
    if (currentTime >= existingTime) latestByTicker.set(price.ticker, price)
  }

  let updated = 0
  let skipped = 0
  const errors: Array<{ id: string; ticker: string; error: string }> = []

  for (const row of rows) {
    try {
      const latest = latestByTicker.get(row.ticker)
      const currentPrice = latest ? asNumber(latest.price) : null
      const recordedAt = latest?.recorded_at ?? null
      if (currentPrice === null || !recordedAt || !Number.isFinite(new Date(recordedAt).getTime())) { skipped += 1; continue }

      const age = Date.now() - new Date(recordedAt).getTime()
      if (age > MAX_PRICE_AGE_MS || age < -MAX_PRICE_AGE_MS) { skipped += 1; continue }

      const state = runTradeEngine({
        direction: row.direction,
        currentPrice,
        entry1: asNumber(row.entry_1), entry1Weight: asNumber(row.entry_1_weight) ?? 0.4,
        entry2: asNumber(row.entry_2), entry2Weight: asNumber(row.entry_2_weight) ?? 0.3,
        entry3: asNumber(row.entry_3), entry3Weight: asNumber(row.entry_3_weight) ?? 0.3,
        target1: asNumber(row.target_1), target2: asNumber(row.target_2), target3: asNumber(row.target_3),
        invalidation: asNumber(row.invalidation),
        trigger: asNumber(row.trigger),
        previousState: toTradeState(row),
      })

      await persistState(supabase, row, state, recordedAt)
      updated += 1
    } catch (error) {
      errors.push({ id: row.id, ticker: row.ticker, error: error instanceof Error ? error.message : String(error) })
    }
  }

  return { success: errors.length === 0, scanned: rows.length, updated, skipped, errors }
}