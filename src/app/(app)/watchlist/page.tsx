import { createClient } from '@/utils/supabase/server'
import { getUserSubscription } from '@/utils/subscription'
import ProGuard from '@/components/ProGuard'

export default async function WatchlistPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const subscription = user ? await getUserSubscription(user.id) : { isActive: false }

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Pro Watchlist</h1>
          <p className="text-sm text-slate-400">
            Daftar pantauan emiten pilihan dengan peringatan harga dan sinyal teknikal otomatis.
          </p>
        </div>
      </div>

      <ProGuard isPro={subscription.isActive} featureName="Watchlist Tanpa Batas & Price Alert">
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Daftar Pantauan Aktif</h3>
            <span className="text-xs bg-[#00D084]/10 text-[#00D084] border border-[#00D084]/30 px-3 py-1 rounded-full font-bold">
              PRO ACTIVE
            </span>
          </div>
          <div className="text-sm text-slate-300">
            Simpan hingga tak terbatas emiten favorit Anda dan pantau pergerakan harganya secara langsung di sini.
          </div>
        </div>
      </ProGuard>
    </div>
  )
}