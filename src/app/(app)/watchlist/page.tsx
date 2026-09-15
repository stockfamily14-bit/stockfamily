import { createClient } from '@/lib/supabase/server'
import { addToWatchlist, removeFromWatchlist } from './actions'

export default async function WatchlistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: watchlistItems } = await supabase
    .from('watchlists')
    .select('ticker')
    .eq('user_id', user!.id)

  const tickers = (watchlistItems ?? []).map((w) => w.ticker)

  const { data: stockDetails } = tickers.length
    ? await supabase.from('stocks').select('*').in('ticker', tickers)
    : { data: [] as any[] }

  const { data: prices } = tickers.length
    ? await supabase.from('latest_prices').select('*').in('ticker', tickers)
    : { data: [] as any[] }

    const cards = tickers.map((ticker) => {
    const stock = stockDetails?.find((s) => s.ticker === ticker)
    const price = prices?.find((p) => p.ticker === ticker)
    return {
      ticker,
      name: stock?.name ?? ticker,
      price: price?.price,
      volume: price?.volume,
    }
  })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Watchlist</h1>

      <form action={addToWatchlist} className="mt-4 flex gap-2">
        <input
          name="ticker"
          placeholder="Kode saham, misal BBCA"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm uppercase focus:border-neutral-900 focus:outline-none"
          required
        />
        <button
          type="submit"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Tambah
        </button>
      </form>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.length === 0 && (
          <p className="text-sm text-neutral-500">Belum ada saham di watchlist kamu.</p>
        )}
        {cards.map((stock) => (
          <div key={stock.ticker} className="rounded-xl border border-neutral-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-neutral-900">{stock.ticker}</p>
                <p className="text-xs text-neutral-500">{stock.name}</p>
              </div>
              <form action={removeFromWatchlist}>
                <input type="hidden" name="ticker" value={stock.ticker} />
                <button type="submit" className="text-xs text-neutral-400 hover:text-red-600">
                  Hapus
                </button>
              </form>
            </div>
            <p className="mt-3 text-xl font-semibold text-neutral-900">
              {stock.price != null ? `Rp${Number(stock.price).toLocaleString('id-ID')}` : '-'}
            </p>
            <p className="text-xs text-neutral-500">
              Volume: {stock.volume != null ? Number(stock.volume).toLocaleString('id-ID') : '-'}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}