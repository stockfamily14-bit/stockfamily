import { config } from 'dotenv'
config({ path: '.env.local' })

import YahooFinance from 'yahoo-finance2'

const yahooFinance = new YahooFinance()

async function test() {
  const period1 = new Date()
  period1.setDate(period1.getDate() - 90)

  const result = await yahooFinance.chart('BBCA.JK', {
    period1,
    interval: '1d',
  })

  console.log('Jumlah hari data:', result.quotes.length)
  console.log('3 hari pertama:', result.quotes.slice(0, 3))
  console.log('3 hari terakhir:', result.quotes.slice(-3))
}

test()