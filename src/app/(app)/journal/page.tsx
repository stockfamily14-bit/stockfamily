import { createClient } from '@/lib/supabase/server'
import { addJournalEntry, deleteJournalEntry } from './actions'

export default async function JournalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: entries } = await supabase
    .from('journal_entries')
    .select('*')
    .eq('user_id', user!.id)
    .order('transaction_date', { ascending: false })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-neutral-900">Journal</h1>
      <p className="mt-1 text-sm text-neutral-500">Catat transaksi beli/jual saham kamu di sini.</p>

      <form action={addJournalEntry} className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-neutral-200 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-700">Kode saham</label>
          <input
            name="ticker"
            required
            className="w-28 rounded-lg border border-neutral-300 px-3 py-2 text-sm uppercase focus:border-neutral-900 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-700">Tipe</label>
          <select
            name="type"
            required
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
          >
            <option value="buy">Beli</option>
            <option value="sell">Jual</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-700">Harga</label>
          <input
            type="number"
            name="price"
            required
            className="w-28 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-700">Jumlah lembar</label>
          <input
            type="number"
            name="quantity"
            required
            className="w-32 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-700">Catatan (opsional)</label>
          <input
            name="notes"
            className="w-48 rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Tambah
        </button>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-500">
              <th className="py-2 pr-4">Tanggal</th>
              <th className="py-2 pr-4">Kode</th>
              <th className="py-2 pr-4">Tipe</th>
              <th className="py-2 pr-4">Harga</th>
              <th className="py-2 pr-4">Jumlah</th>
              <th className="py-2 pr-4">Catatan</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {(entries ?? []).map((entry) => (
              <tr key={entry.id} className="border-b border-neutral-100">
                <td className="py-2 pr-4">{entry.transaction_date}</td>
                <td className="py-2 pr-4 font-medium text-neutral-900">{entry.ticker}</td>
                <td className="py-2 pr-4">
                  <span className={entry.type === 'buy' ? 'text-emerald-600' : 'text-red-600'}>
                    {entry.type === 'buy' ? 'Beli' : 'Jual'}
                  </span>
                </td>
                <td className="py-2 pr-4">Rp{Number(entry.price).toLocaleString('id-ID')}</td>
                <td className="py-2 pr-4">{Number(entry.quantity).toLocaleString('id-ID')}</td>
                <td className="py-2 pr-4 text-neutral-500">{entry.notes ?? '-'}</td>
                <td className="py-2 pr-4">
                  <form action={deleteJournalEntry}>
                    <input type="hidden" name="id" value={entry.id} />
                    <button type="submit" className="text-xs text-neutral-400 hover:text-red-600">
                      Hapus
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(entries ?? []).length === 0 && (
          <p className="mt-4 text-sm text-neutral-500">Belum ada catatan transaksi.</p>
        )}
      </div>
    </div>
  )
}