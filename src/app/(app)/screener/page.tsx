import { createClient } from '@/lib/supabase/server'
import { addToWatchlist } from '../watchlist/actions'

export default async function ScreenerPage({
  searchParams,
}: {
  searchParams: Promise<{ minPrice?: string; maxPrice?: string; minVolume?: string }>
}) {
  const { minPrice, maxPrice, minVolume } = await searchParams
  const supabase = await createClient()

  let query = supabase.from('latest_prices').select('*')

  if (minPrice) query = query.gte('price', Number(minPrice))
  if (maxPrice) query = query.lte('price', Number(maxPrice))
  if (minVolume) query = query.gte('volume', Number(minVolume))

  const { data: prices } = await query
    .order('volume', { ascending: false, nullsFirst: false })
    .limit(100)

  const tickers = (prices ?? []).map((p) => p.ticker)

  const { data: stockDetails } = tickers.length
    ? await supabase.from('stocks').select('*').in('ticker', tickers)
    : { data: [] as any[] }

  const rows = (prices ?? []).map((p) => {
    const stock = stockDetails?.find((s) => s.ticker === p.ticker)
    return {
      ticker: p.ticker,
      name: stock?.name ?? p.ticker,
      price: p.price,
      volume: p.volume,
    }
  })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Screener</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Menampilkan maksimal 100 saham, diurutkan dari volume tertinggi.
      </p>

      <form method="get" className="mt-4 flex flex-wrap gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-700">Harga min</label>
          <input
            type="number"
            name="minPrice"
            defaultValue={minPrice}
            className="w-28 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-700">Harga max</label>
          <input
            type="number"
            name="maxPrice"
            defaultValue={maxPrice}
            className="w-28 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-700">Volume min</label>
          <input
            type="number"
            name="minVolume"
            defaultValue={minVolume}
            className="w-36 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Filter
          </button>
        </div>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-500">
              <th className="py-2 pr-4">Kode</th>
              <th className="py-2 pr-4">Nama</th>
              <th className="py-2 pr-4">Harga</th>
              <th className="py-2 pr-4">Volume</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.ticker} className="border-b border-neutral-100">
                <td className="py-2 pr-4 font-medium text-neutral-900">{row.ticker}</td>
                <td className="py-2 pr-4 text-neutral-600">{row.name}</td>
                <td className="py-2 pr-4">
                  {row.price != null ? `Rp${Number(row.price).toLocaleString('id-ID')}` : '-'}
                </td>
                <td className="py-2 pr-4">
                  {row.volume != null ? Number(row.volume).toLocaleString('id-ID') : '-'}
                </td>
                <td className="py-2 pr-4">
                  <form action={addToWatchlist}>
                    <input type="hidden" name="ticker" value={row.ticker} />
                    <button type="submit" className="text-xs text-neutral-500 hover:text-neutral-900">
                      + Watchlist
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="mt-4 text-sm text-neutral-500">Tidak ada saham yang cocok dengan filter.</p>
        )}
      </div>
    </div>
  )
}