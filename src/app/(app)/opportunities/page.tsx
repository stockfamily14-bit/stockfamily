import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

// Mencegah Next.js memicu route caching agar perpindahan tab merespons seketika
export const dynamic = 'force-dynamic'

const radarMeta = [
  {
    key: 'breakoutWatch',
    label: 'Breakout Watch',
    description: 'Saham mendekati atau menembus resistance dengan konfirmasi volume.',
  },
  {
    key: 'momentum',
    label: 'Momentum',
    description: 'Saham dalam tren naik kuat dengan ekspansi RSI positif.',
  },
  {
    key: 'nearSupport',
    label: 'Near Support',
    description: 'Saham berada dekat area demand/support dengan Risk/Reward optimal.',
  },
  {
    key: 'unusualVolume',
    label: 'Unusual Volume',
    description: 'Aktivitas akumulasi volume tidak biasa di atas rata-rata 20 hari.',
  },
  {
    key: 'distribution',
    label: 'Distribution',
    description: 'Saham menunjukkan tekanan jual tinggi atau indikasi breakdown.',
  },
] as const

type StockCandidate = {
  ticker: string
  name: string
  setup: string
  aiScore: number
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const params = await searchParams
  const selectedType = params.type || 'breakoutWatch'

  const supabase = await createClient()

  // Ambil data market snapshot terbaru dari Supabase
  const { data: snapshot } = await supabase
    .from('market_snapshot')
    .select('*')
    .order('computed_at', { ascending: false })
    .limit(1)
    .single()

  const radarCounts = snapshot?.radar || {}
  const radarStocks = snapshot?.radar_stocks || {}

  // Tentukan data aktif berdasarkan tab URL
  const selectedRadar = radarMeta.find((item) => item.key === selectedType) || radarMeta[0]
  
  // Ambil list saham asli dari database sesuai tab yang diklik
  const activeStocks: StockCandidate[] = radarStocks[selectedType] || []
  const activeCount: number = radarCounts[selectedType] ?? activeStocks.length

  return (
    <div className="space-y-6 p-6 font-sans">
      <div>
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:text-neutral-900 transition"
        >
          ← Kembali ke Dashboard
        </Link>

        <h1 className="mt-3 text-2xl font-semibold text-neutral-900">
          Market Opportunities
        </h1>

        <p className="mt-1 text-sm text-neutral-500">
          Kandidat saham berprobabilitas tinggi berdasarkan analisis radar StockFamily.
        </p>
      </div>

      {/* Header Cards (Radar Categories) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        {radarMeta.map((item) => {
          const active = selectedType === item.key
          const count = radarCounts[item.key] ?? (radarStocks[item.key]?.length || 0)

          return (
            <Link
              key={item.key}
              href={`/opportunities?type=${item.key}`}
              className={`rounded-xl border p-4 transition ${
                active
                  ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-sm'
                  : 'border-neutral-200 bg-white hover:bg-neutral-50'
              }`}
            >
              <p className="text-xs font-semibold text-neutral-500">
                {item.label}
              </p>

              <p className="mt-2 text-2xl font-bold text-neutral-900">
                {count}
              </p>

              <p className="mt-1 text-[11px] leading-4 text-neutral-500">
                {item.description}
              </p>
            </Link>
          )
        })}
      </div>

      {/* Grid List Saham Kandidat */}
      <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
              {selectedRadar.label} ({activeCount})
            </p>

            <h2 className="mt-1 text-lg font-semibold text-neutral-900">
              {selectedRadar.description}
            </h2>
          </div>

          <Link
            href="/opportunities?type=breakoutWatch"
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition"
          >
            Reset Filter
          </Link>
        </div>

        {activeStocks.length > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeStocks.map((stock) => {
              const isDistribution = selectedType === 'distribution'
              const isHighProb = stock.aiScore >= 80

              return (
                <Link
                  key={stock.ticker}
                  href={`/stock/${stock.ticker}`}
                  className="group relative rounded-xl border border-neutral-200 p-4 transition hover:border-emerald-500 hover:shadow-md bg-white"
                >
                  {isHighProb && !isDistribution && (
                    <div className="absolute -top-2.5 right-3 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                      🔥 HIGH PROBABILITY
                    </div>
                  )}

                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-lg font-bold text-neutral-900 group-hover:text-emerald-600">
                        {stock.ticker}
                      </p>

                      <p className="mt-0.5 truncate text-xs text-neutral-500 max-w-[200px]">
                        {stock.name}
                      </p>
                    </div>

                    <div
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                        isDistribution
                          ? 'bg-red-100 text-red-700'
                          : stock.aiScore >= 80
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {stock.aiScore}/100
                    </div>
                  </div>

                  <div className="mt-4 border-t border-neutral-100 pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                      TECHNICAL SETUP
                    </p>

                    <p className="mt-1 text-xs font-semibold text-neutral-800">
                      {stock.setup || selectedRadar.label.toUpperCase()}
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-1 text-xs font-medium text-emerald-600">
                    <span>Lihat Analysis & Level →</span>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-lg bg-neutral-50 p-8 text-center border border-dashed border-neutral-200">
            <p className="font-semibold text-neutral-800">
              Belum Ada Kandidat Terdeteksi
            </p>

            <p className="mt-1 text-xs text-neutral-500">
              Market Engine belum menemukan kandidat saham yang memenuhi kriteria untuk kategori ini.
            </p>
          </div>
        )}
      </div>

      {/* Engine Status Information */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Technical Market Engine Status
          </p>
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
            {snapshot?.refresh_status === 'SUCCESS' ? 'Live & Synced' : 'Updating'}
          </span>
        </div>

        <p className="mt-2 text-xs leading-5 text-neutral-600">
          Data ditarik secara terinkronisasi dari Market Engine Supabase (`computed_at`: {snapshot?.computed_at ? new Date(snapshot.computed_at).toLocaleString('id-ID') : '-'}). Seluruh indikator teknikal, skor AI, dan daftar saham bergerak secara alami berdasarkan kondisi riil pasar.
        </p>
      </div>
    </div>
  )
}
