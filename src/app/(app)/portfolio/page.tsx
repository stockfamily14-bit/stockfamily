import { createClient } from '@/utils/supabase/server'
import { getUserSubscription } from '@/utils/subscription'
import ProGuard from '@/components/ProGuard'

export default async function PortfolioPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const subscription = user ? await getUserSubscription(user.id) : { isActive: false }

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Portfolio Management</h1>
          <p className="text-sm text-slate-400">
            Pantau alokasi aset, posisi terbuka, dan akumulasi keuntungan portofolio saham Anda secara real-time.
          </p>
        </div>
      </div>

      <ProGuard isPro={subscription.isActive} featureName="Portfolio Tracking & Asset Allocation">
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Ringkasan Portofolio Pro</h3>
            <span className="text-xs bg-[#00D084]/10 text-[#00D084] border border-[#00D084]/30 px-3 py-1 rounded-full font-bold">
              PRO ACTIVE
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-white/5 space-y-1">
              <span className="text-xs text-slate-400">Total Nilai Aset</span>
              <p className="text-lg font-bold text-white">Rp 125.400.000</p>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-white/5 space-y-1">
              <span className="text-xs text-slate-400">Total Profit / Loss</span>
              <p className="text-lg font-bold text-[#00D084]">+Rp 12.850.000 (+11.4%)</p>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-white/5 space-y-1">
              <span className="text-xs text-slate-400">Cash Available</span>
              <p className="text-lg font-bold text-white">Rp 15.200.000</p>
            </div>
          </div>
        </div>
      </ProGuard>
    </div>
  )
}