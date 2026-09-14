import { createClient } from '@/utils/supabase/server'
import { getUserSubscription } from '@/utils/subscription'
import ProGuard from '@/components/ProGuard'

export default async function JournalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const subscription = user ? await getUserSubscription(user.id) : { isActive: false }

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Trading Journal Pro</h1>
          <p className="text-sm text-slate-400">
            Catat, evaluasi, dan ukur performa portofolio harian Anda secara sistematis untuk mendisiplinkan strategi trading.
          </p>
        </div>
      </div>

      <ProGuard isPro={subscription.isActive} featureName="Trading Journal & Evaluasi Kinerja">
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Rekapitulasi Trade Harian</h3>
            <span className="text-xs bg-[#00D084]/10 text-[#00D084] border border-[#00D084]/30 px-3 py-1 rounded-full font-bold">
              PRO ACTIVE
            </span>
          </div>
          <p className="text-sm text-slate-300">
            Akses penuh ke statistik win rate, risk-to-reward ratio, dan catatan psikologi trading Anda terbuka.
          </p>
        </div>
      </ProGuard>
    </div>
  )
}