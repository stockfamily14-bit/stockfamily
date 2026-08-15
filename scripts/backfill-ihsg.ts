import { config } from 'dotenv'
config({ path: '.env.local' })

import YahooFinance from 'yahoo-finance2'
import { getSupabaseAdmin } from '../src/lib/supabase/admin'

const yahooFinance = new YahooFinance()
const supabaseAdmin = getSupabaseAdmin()

async function run() {
  const period1 = new Date()
  period1.setDate(period1.getDate() - 90)

  const result = await yahooFinance.chart('^JKSE', {
    period1,
    interval: '1d',
  })

  const rows = result.quotes
    .filter((q) => q.close != null)
    .map((q) => ({
      ticker: 'IHSG',
      date: q.date.toISOString().split('T')[0],
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: q.volume ?? 0,
    }))

  const { error } = await supabaseAdmin.from('stock_ohlcv').upsert(rows, { onConflict: 'ticker,date' })

  if (error) {
    console.error('Gagal:', error)
  } else {
    console.log(`Berhasil simpan ${rows.length} hari data IHSG`)
  }
}

run()