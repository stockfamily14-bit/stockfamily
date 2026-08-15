import { createClient } from '@/lib/supabase/server'
import AIAnalystClient from './client'

export default async function AIAnalystPage() {
  const supabase = await createClient()

  const { data: prices } = await supabase
    .from('latest_prices')
    .select('*')
    .order('volume', { ascending: false, nullsFirst: false })
    .limit(5)

  const tickers = (prices ?? []).map((p) => p.ticker)

  const { data: stockDetails } = tickers.length
    ? await supabase.from('stocks').select('*').in('ticker', tickers)
    : { data: [] as any[] }

  const topStocks = (prices ?? []).map((p) => {
    const stock = stockDetails?.find((s) => s.ticker === p.ticker)
    return {
      ticker: p.ticker,
      name: stock?.name ?? p.ticker,
      price: p.price != null ? Number(p.price) : null,
      volume: p.volume != null ? Number(p.volume) : null,
    }
  })

  return <AIAnalystClient topStocks={topStocks} />
}