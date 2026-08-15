import { config } from 'dotenv'
config({ path: '.env.local' })

import YahooFinance from 'yahoo-finance2'
import { getSupabaseAdmin } from '../src/lib/supabase/admin'

const yahooFinance = new YahooFinance()
const supabaseAdmin = getSupabaseAdmin()

const tickers = ['BBCA.JK', 'BBRI.JK', 'TLKM.JK']

async function run() {
  for (const ticker of tickers) {
    const quote = await yahooFinance.quote(ticker)
    const cleanTicker = ticker.replace('.JK', '')

    await supabaseAdmin.from('stocks').upsert({
      ticker: cleanTicker,
      name: quote.longName ?? quote.shortName ?? cleanTicker,
    })

    await supabaseAdmin.from('stock_prices').insert({
      ticker: cleanTicker,
      price: quote.regularMarketPrice,
      volume: quote.regularMarketVolume,
    })

    console.log(`Tersimpan: ${cleanTicker} - Rp${quote.regularMarketPrice}`)
  }
}

run()