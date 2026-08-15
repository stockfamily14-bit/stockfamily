import { createClient } from '@/lib/supabase/server'

export default async function PortfolioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: entries } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', user!.id)

  const grouped: Record<string, { buyQty: number; buyCost: number; sellQty: number }> = {}

  for (const entry of entries ?? []) {
    if (!grouped[entry.ticker]) {
      grouped[entry.ticker] = { buyQty: 0, buyCost: 0, sellQty: 0 }
    }
    if (entry.type === 'buy') {
      grouped[entry.ticker].buyQty += entry.quantity
      grouped[entry.ticker].buyCost += entry.quantity * Number(entry.price)
    } else {
      grouped[entry.ticker].sellQty += entry.quantity
    }
  }

  const holdings = Object.entries(grouped)
    .map(([ticker, data]) => {
      const netQty = data.buyQty - data.sellQty
      const avgBuyPrice = data.buyQty > 0 ? data.buyCost / data.buyQty : 0
      return { ticker, netQty, avgBuyPrice }
    })
    .filter((h) => h.netQty > 0)

  const tickers = holdings.map((h) => h.ticker)

  const { data: stockDetails } = tickers.length
    ? await supabase.from('stocks').select('*').in('ticker', tickers)
    : { data: [] as any[] }

  const { data: prices } = tickers.length
    ? await supabase.from('latest_prices').select('*').in('ticker', tickers)
    : { data: [] as any[] }

  const rows = holdings.map((h) => {
    const stock = stockDetails?.find((s) => s.ticker === h.ticker)
    const priceInfo = prices?.find((p) => p.ticker === h.ticker)
    const currentPrice = priceInfo?.price != null ? Number(priceInfo.price) : null
    const costBasis = h.netQty * h.avgBuyPrice
    const currentValue = currentPrice != null ? h.netQty * currentPrice : null
    const pnl = currentValue != null ? currentValue - costBasis : null
    const pnlPercent = pnl != null && costBasis > 0 ? (pnl / costBasis) * 100 : null

    return {
      ticker: h.ticker,
      name: stock?.name ?? h.ticker,
      qty: h.netQty,
      avgBuyPrice: h.avgBuyPrice,
      currentPrice,
      costBasis,
      currentValue,
      pnl,
      pnlPercent,
    }
  })

  const totalCost = rows.reduce((sum, r) => sum + r.costBasis, 0)
  const totalValue = rows.reduce((sum, r) => sum + (r.currentValue ?? r.costBasis), 0)
  const totalPnl = totalValue - totalCost
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Portfolio</h1>
      <p className="mt-1 text-sm text-neutral-500">Dihitung otomatis dari catatan Journal kamu.</p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 p-4">
          <p className="text-xs text-neutral-500">Total Modal</p>
          <p className="mt-1 text-xl font-semibold text-neutral-900">
            Rp{totalCost.toLocaleString('id-ID')}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-4">
          <p className="text-xs text-neutral-500">Nilai Sekarang</p>
          <p className="mt-1 text-xl font-semibold text-neutral-900">
            Rp{totalValue.toLocaleString('id-ID')}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 p-4">
          <p className="text-xs text-neutral-500">Untung/Rugi</p>
          <p className={`mt-1 text-xl font-semibold ${totalPnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {totalPnl >= 0 ? '+' : ''}Rp{totalPnl.toLocaleString('id-ID')} ({totalPnlPercent.toFixed(1)}%)
          </p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-500">
              <th className="py-2 pr-4">Kode</th>
              <th className="py-2 pr-4">Nama</th>
              <th className="py-2 pr-4">Lembar</th>
              <th className="py-2 pr-4">Avg Beli</th>
              <th className="py-2 pr-4">Harga Now</th>
              <th className="py-2 pr-4">Nilai</th>
              <th className="py-2 pr-4">Untung/Rugi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.ticker} className="border-b border-neutral-100">
                <td className="py-2 pr-4 font-medium text-neutral-900">{row.ticker}</td>
                <td className="py-2 pr-4 text-neutral-600">{row.name}</td>
                <td className="py-2 pr-4">{row.qty.toLocaleString('id-ID')}</td>
                <td className="py-2 pr-4">Rp{Math.round(row.avgBuyPrice).toLocaleString('id-ID')}</td>
                <td className="py-2 pr-4">
                  {row.currentPrice != null ? `Rp${row.currentPrice.toLocaleString('id-ID')}` : '-'}
                </td>
                <td className="py-2 pr-4">
                  {row.currentValue != null ? `Rp${Math.round(row.currentValue).toLocaleString('id-ID')}` : '-'}
                </td>
                <td className={`py-2 pr-4 ${row.pnl != null && row.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {row.pnl != null
                    ? `${row.pnl >= 0 ? '+' : ''}Rp${Math.round(row.pnl).toLocaleString('id-ID')} (${row.pnlPercent?.toFixed(1)}%)`
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="mt-4 text-sm text-neutral-500">
            Belum ada saham yang dimiliki. Tambahkan transaksi beli di halaman Journal.
          </p>
        )}
      </div>
    </div>
  )
}