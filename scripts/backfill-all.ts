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
  const { data: stocks, error: stocksError } =
    await supabaseAdmin
      .from('stocks')
      .select('ticker')

  if (stocksError) {
    throw stocksError
  }

  const tickers = (stocks ?? []).map((s) => s.ticker)

  console.log(`Total saham: ${tickers.length}`)

  const period1 = new Date()
  period1.setDate(period1.getDate() - 180)

  let success = 0
  let failed = 0
  let totalCandles = 0

  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i]

    try {
      console.log(
        `[${i + 1}/${tickers.length}] ${ticker}...`
      )

      const result = await yahooFinance.chart(
        `${ticker}.JK`,
        {
          period1,
          interval: '1d',
        }
      )

      const rows = result.quotes
        .filter((q) => q.close != null)
        .map((q) => ({
          ticker,
          date: q.date.toISOString().split('T')[0],
          open: q.open ?? null,
          high: q.high ?? null,
          low: q.low ?? null,
          close: q.close ?? null,
          volume: q.volume ?? null,
        }))

      console.log(`  Yahoo candles: ${rows.length}`)

      if (rows.length === 0) {
        failed++
        console.log('  SKIP: tidak ada candle')
        continue
      }

      const { error: upsertError } =
        await supabaseAdmin
          .from('stock_ohlcv')
          .upsert(rows, {
            onConflict: 'ticker,date',
          })

      if (upsertError) {
        failed++

        console.log(
          '  SUPABASE ERROR:',
          upsertError.message
        )

        continue
      }

      success++
      totalCandles += rows.length

      console.log(
        `  OK: ${rows.length} candle disimpan`
      )
    } catch (error) {
      failed++

      console.log(
        '  ERROR:',
        error instanceof Error
          ? error.message
          : error
      )
    }

    await sleep(300)
  }

  console.log('')
  console.log('================================')
  console.log('BACKFILL SELESAI')
  console.log('================================')
  console.log(`Ticker:       ${tickers.length}`)
  console.log(`Sukses:       ${success}`)
  console.log(`Gagal/skip:   ${failed}`)
  console.log(`Total candle: ${totalCandles}`)
}

run().catch((error) => {
  console.error('FATAL ERROR:')
  console.error(error)
  process.exit(1)
})