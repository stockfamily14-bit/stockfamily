import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { runTradeEngine, type TradeState, type TradeDirection } from './trade-engine'
import { persistState } from './persist'
import { MONITORED_STATUSES, asNumber, toTradeState, type InsightRow as BaseInsightRow } from './monitor'

type InsightRow = BaseInsightRow & {
  published_at: string | null
  last_reconciled_date: string | null
}

type OhlcRow = {
  date: string
  open: number | string | null
  high: number | string | null
  low: number | string | null
  close: number | string | null
}

const MARKET_CLOSE_UTC_HOUR = '09' // 16:00 WIB = 09:00 UTC

export async function reconcileDailyOHLC() {
  const supabase = getSupabaseAdmin()

  const { data: insights, error: insightError } = await supabase
    .from('insight_signals')
    .select(`
      id, ticker, direction, status, published_at, last_reconciled_date,
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

  if (insightError) throw new Error(`Gagal load insights untuk reconcile: ${insightError.message}`)

  const rows = (insights ?? []) as InsightRow[]
  if (rows.length === 0) return { success: true, processed: 0, daysApplied: 0, errors: [] }

  let processed = 0
  let daysApplied = 0
  const errors: Array<{ id: string; ticker: string; error: string }> = []

  for (const row of rows) {
    try {
      const startDateStr = row.last_reconciled_date ?? (row.published_at ? row.published_at.slice(0, 10) : null)
      if (!startDateStr) { continue }

      const { data: ohlcRows, error: ohlcError } = await supabase
        .from('stock_ohlcv')
        .select('date, open, high, low, close')
        .eq('ticker', row.ticker)
        .gt('date', startDateStr)
        .order('date', { ascending: true })

      if (ohlcError) throw new Error(`Gagal load OHLCV ${row.ticker}: ${ohlcError.message}`)

      const days = (ohlcRows ?? []) as OhlcRow[]
      if (days.length === 0) { processed += 1; continue }

      let state: TradeState = toTradeState(row)
      let lastDateProcessed: string | null = null

      for (const day of days) {
        if (state.status === 'CLOSED' || state.status === 'STOPPED') break

        const high = asNumber(day.high)
        const low = asNumber(day.low)
        const close = asNumber(day.close)
        if (high === null || low === null) continue

        const dayTimestamp = `${day.date}T${MARKET_CLOSE_UTC_HOUR}:00:00.000Z`

        // Urutan dalam sehari: LONG -> low dulu (entry retrace), baru high
        // (target/breakout). SHORT -> sebaliknya.
        const firstPrice = row.direction === 'LONG' ? low : high
        const secondPrice = row.direction === 'LONG' ? high : low

        const baseInput = {
          direction: row.direction as TradeDirection,
          entry1: asNumber(row.entry_1), entry1Weight: asNumber(row.entry_1_weight) ?? 0.4,
          entry2: asNumber(row.entry_2), entry2Weight: asNumber(row.entry_2_weight) ?? 0.3,
          entry3: asNumber(row.entry_3), entry3Weight: asNumber(row.entry_3_weight) ?? 0.3,
          target1: asNumber(row.target_1), target2: asNumber(row.target_2), target3: asNumber(row.target_3),
          invalidation: asNumber(row.invalidation),
          trigger: asNumber(row.trigger),
          nowOverride: dayTimestamp,
        }

        state = runTradeEngine({ ...baseInput, currentPrice: firstPrice, previousState: state })

        if (state.status !== 'CLOSED' && state.status !== 'STOPPED') {
          state = runTradeEngine({ ...baseInput, currentPrice: secondPrice, previousState: state })
        }

        // Tutup hari dengan harga close, supaya current_price yang tersimpan
        // mencerminkan penutupan, bukan nyangkut di ekstrem intraday.
        if (close !== null && state.status !== 'CLOSED' && state.status !== 'STOPPED') {
          state = runTradeEngine({ ...baseInput, currentPrice: close, previousState: state })
        } else if (close !== null) {
          state = { ...state, currentPrice: close }
        }

        lastDateProcessed = day.date
        daysApplied += 1
      }

      if (lastDateProcessed) {
        await persistState(
          supabase,
          { id: row.id, ticker: row.ticker, direction: row.direction, status: row.status },
          state,
          `${lastDateProcessed}T${MARKET_CLOSE_UTC_HOUR}:00:00.000Z`,
        )

        const { error: dateUpdateError } = await supabase
          .from('insight_signals')
          .update({ last_reconciled_date: lastDateProcessed })
          .eq('id', row.id)

        if (dateUpdateError) {
          console.error(`Gagal update last_reconciled_date ${row.ticker}:`, dateUpdateError.message)
        }
      }

      processed += 1
    } catch (error) {
      errors.push({ id: row.id, ticker: row.ticker, error: error instanceof Error ? error.message : String(error) })
    }
  }

  return { success: errors.length === 0, processed, daysApplied, errors }
}