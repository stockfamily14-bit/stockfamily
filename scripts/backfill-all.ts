import { config } from 'dotenv'
config({ path: '.env.local' })

import YahooFinance from 'yahoo-finance2'
import { getSupabaseAdmin } from '../src/lib/supabase/admin'

const yahooFinance = new YahooFinance()
const supabaseAdmin = getSupabaseAdmin()

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function run() {
  const { data: stocks } = await supabaseAdmin.from('stocks').select('ticker')
  const tickers = (stocks ?? []).map((s) => s.ticker)

  console.log(`Total saham: ${tickers.length}`)

  const period1 = new Date()
  period1.setDate(period1.getDate() - 90)

  let success = 0
  let failed = 0

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i]

    try {
      const result = await yahooFinance.chart(`${ticker}.JK`, {
        period1,
        interval: '1d',
      })

      const rows = result.quotes
        .filter((q) => q.close != null)
        .map((q) => ({
          ticker,
          date: q.date.toISOString().split('T')[0],
          open: q.open,
          high: q.high,
          low: q.low,
          close: q.close,
          volume: q.volume,
        }))

      if (rows.length) {
        await supabaseAdmin.from('stock_ohlcv').upsert(rows, { onConflict: 'ticker,date' })
      }

      success++
    } catch {
      failed++
    }

    if ((i + 1) % 50 === 0) {
      console.log(`Progress: ${i + 1}/${tickers.length} (sukses: ${success}, gagal: ${failed})`)
    }

    await sleep(300)
  }

  console.log(`Selesai! Sukses: ${success}, Gagal: ${failed}`)
}

run()