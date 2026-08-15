import { config } from 'dotenv'
config({ path: '.env.local' })

import YahooFinance from 'yahoo-finance2'

const yahooFinance = new YahooFinance()

async function test() {
  const period1 = new Date()
  period1.setDate(period1.getDate() - 90)

  const result = await yahooFinance.chart('^JKSE', {
    period1,
    interval: '1d',
  })

  console.log('Jumlah hari data IHSG:', result.quotes.length)
  console.log('3 hari terakhir:', result.quotes.slice(-3))
}

test()