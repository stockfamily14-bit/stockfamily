import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { TradeState, TradeDirection } from './trade-engine'

export type PersistableRow = {
  id: string
  ticker: string
  direction: TradeDirection
  status: string
}

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
    console.error(`Gagal queue notifikasi ${eventType} untuk ${ticker}:`, error.message)
  }
}

async function queueTransitionNotifications(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  row: PersistableRow,
  state: TradeState,
) {
  const previousStatus = row.status
  const newStatus = state.status

  if (previousStatus === newStatus) return

  const extra = { price: state.currentPrice, pnlPercent: state.pnlPercent }

  const wasNeverActivated = previousStatus === 'PUBLISHED'
  const crossedIntoActiveOrBeyond = ['ACTIVE', 'TARGET_1_HIT', 'TARGET_2_HIT', 'TARGET_3_HIT', 'STOPPED'].includes(newStatus)

  if (wasNeverActivated && crossedIntoActiveOrBeyond) {
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

/**
 * Tentukan outcome final untuk status STOPPED berdasarkan hasil aktual --
 * bukan diasumsikan selalu rugi. Kalau SL+ (breakeven lock) sudah aktif
 * (karena T1 pernah kena), hasil di titik stop biasanya mendekati 0% atau
 * malah positif -- itu dikategorikan BREAKEVEN, bukan STOP (loss).
 */
function resolveStoppedOutcome(pnlPercent: number | null): 'STOP' | 'BREAKEVEN' {
  if (pnlPercent !== null && pnlPercent >= 0) return 'BREAKEVEN'
  return 'STOP'
}

export async function persistState(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  row: PersistableRow,
  state: TradeState,
  priceRecordedAt: string,
) {
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
    payload.outcome = null
    payload.result_percent = null
  } else if (state.status === 'STOPPED') {
    const outcome = resolveStoppedOutcome(state.pnlPercent)
    payload.status = 'STOPPED'
    payload.outcome = outcome
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