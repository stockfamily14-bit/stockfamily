import { createClient } from '@/utils/supabase/server'
import { getUserSubscription } from '@/utils/subscription'
import ProGuard from '@/components/ProGuard'

export default async function ScreenerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Periksa status langganan pengguna
  const subscription = user ? await getUserSubscription(user.id) : { isActive: false }

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Stock Screener Pro</h1>
          <p className="text-sm text-slate-400">
            Saring emiten bursa saham Indonesia secara real-time untuk momentum harian dan strategi trading terbaik.
          </p>
        </div>
      </div>

      {/* Bungkus komponen utama screener dengan ProGuard */}
      <ProGuard isPro={subscription.isActive} featureName="Screener Saham Lanjutan & Filter Momentum">
        <div className="space-y-6">
          {/* Konten Asli Screener (Akan tampil jika user sudah Pro) */}
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Panel Parameter Screener</h3>
              <span className="text-xs bg-[#00D084]/10 text-[#00D084] border border-[#00D084]/30 px-3 py-1 rounded-full font-bold">
                PRO ACTIVE
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-white/5 space-y-2">
                <span className="text-xs text-slate-400">Filter Utama</span>
                <p className="text-sm font-semibold text-white">RSI & Price High (BPJS Mode)</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-white/5 space-y-2">
                <span className="text-xs text-slate-400">Volume Spike</span>
                <p className="text-sm font-semibold text-white">&gt; 2x Rata-rata 5 Hari</p>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-white/5 space-y-2">
                <span className="text-xs text-slate-400">Status Pasar</span>
                <p className="text-sm font-semibold text-[#00D084]">Live IDX Feed Connected</p>
              </div>
            </div>

            {/* Placeholder Tabel Hasil Screener */}
            <div className="overflow-x-auto pt-4">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-white/10 text-slate-400 uppercase">
                  <tr>
                    <th className="py-3 px-4">Kode</th>
                    <th className="py-3 px-4">Nama Saham</th>
                    <th className="py-3 px-4">Harga Terakhir</th>
                    <th className="py-3 px-4">Perubahan</th>
                    <th className="py-3 px-4">Sinyal Momentum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="py-3 px-4 font-bold text-white">BBCA</td>
                    <td className="py-3 px-4">Bank Central Asia Tbk.</td>
                    <td className="py-3 px-4">Rp 10.225</td>
                    <td className="py-3 px-4 text-[#00D084]">+2.25%</td>
                    <td className="py-3 px-4"><span className="bg-[#00D084]/20 text-[#00D084] px-2 py-0.5 rounded text-[10px] font-bold">Strong Buy</span></td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-bold text-white">BBRI</td>
                    <td className="py-3 px-4">Bank Rakyat Indonesia (Persero) Tbk.</td>
                    <td className="py-3 px-4">Rp 4.950</td>
                    <td className="py-3 px-4 text-[#00D084]">+1.85%</td>
                    <td className="py-3 px-4"><span className="bg-[#00D084]/20 text-[#00D084] px-2 py-0.5 rounded text-[10px] font-bold">Momentum</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </ProGuard>
    </div>
  )
}