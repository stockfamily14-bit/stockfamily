import { config } from 'dotenv'
config({ path: '.env.local' })

import * as XLSX from 'xlsx'
import YahooFinance from 'yahoo-finance2'
import { getSupabaseAdmin } from '../src/lib/supabase/admin'

const yahooFinance = new YahooFinance()
const supabaseAdmin = getSupabaseAdmin()

function getStockList(): { code: string; name: string }[] {
  const workbook = XLSX.readFile('data/idx-stocks.xlsx')
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows: any[] = XLSX.utils.sheet_to_json(sheet)

  return rows
    .filter((row) => row['Code'])
    .map((row) => ({
      code: String(row['Code']).trim(),
      name: String(row['Company Name'] ?? row['Code']).trim(),
    }))
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function run() {
  const stocks = getStockList()
  console.log(`Total saham ditemukan: ${stocks.length}`)

  const batchSize = 50
  for (let i = 0; i < stocks.length; i += batchSize) {
    const batch = stocks.slice(i, i + batchSize)
    const symbols = batch.map((s) => `${s.code}.JK`)

    try {
      const quotes = await yahooFinance.quote(symbols)
      const quoteArray = Array.isArray(quotes) ? quotes : [quotes]

      const stockRows: any[] = []
      const priceRows: any[] = []

      for (const quote of quoteArray) {
        const code = quote.symbol.replace('.JK', '')
        const stockInfo = batch.find((s) => s.code === code)

        stockRows.push({ ticker: code, name: stockInfo?.name ?? code })

        if (quote.regularMarketPrice != null) {
          priceRows.push({
            ticker: code,
            price: quote.regularMarketPrice,
            volume: quote.regularMarketVolume ?? null,
          })
        }
      }

      if (stockRows.length) await supabaseAdmin.from('stocks').upsert(stockRows)
      if (priceRows.length) await supabaseAdmin.from('stock_prices').insert(priceRows)

      console.log(`Progress: ${Math.min(i + batchSize, stocks.length)}/${stocks.length}`)
    } catch (err) {
      console.error(`Gagal di batch mulai index ${i}:`, err)
    }

    await sleep(1000)
  }

  console.log('Selesai!')
}

run()