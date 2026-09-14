import { createClient } from '@/utils/supabase/server'
import { getUserSubscription } from '@/utils/subscription'
import ProGuard from '@/components/ProGuard'

export default async function AIAnalystPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const subscription = user ? await getUserSubscription(user.id) : { isActive: false }

  return (
    <div className="max-w-7xl mx-auto space-y-6 py-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">AI Market Analyst</h1>
          <p className="text-sm text-slate-400">
            Dapatkan wawasan, analisis sentimen, dan proyeksi tren emiten bursa secara otomatis menggunakan kecerdasan buatan.
          </p>
        </div>
      </div>

      <ProGuard isPro={subscription.isActive} featureName="AI Market Analyst & Smart Insights">
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Sesi Analisis AI Terbaru</h3>
            <span className="text-xs bg-[#00D084]/10 text-[#00D084] border border-[#00D084]/30 px-3 py-1 rounded-full font-bold">
              PRO ACTIVE
            </span>
          </div>

          <div className="bg-slate-950 p-5 rounded-xl border border-white/5 space-y-3">
            <div className="flex items-center space-x-2 text-xs text-[#00D084]">
              <span className="w-2 h-2 rounded-full bg-[#00D084] animate-pulse"></span>
              <span>Sistem AI Siap Menganalisis Pergerakan Sektoral</span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Masukkan emiten atau pilih sektor pilihan untuk melihat rangkuman performa teknikal, akumulasi bandarmologi, dan proyeksi risiko harian secara mendalam.
            </p>
          </div>
        </div>
      </ProGuard>
    </div>
  )
}