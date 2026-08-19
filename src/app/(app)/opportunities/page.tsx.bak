import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const radarMeta = [
  {
    key: 'breakoutWatch',
    label: 'Breakout Watch',
    description: 'Saham mendekati atau menembus resistance.',
  },
  {
    key: 'momentum',
    label: 'Momentum',
    description: 'Saham dengan momentum positif.',
  },
  {
    key: 'nearSupport',
    label: 'Near Support',
    description: 'Saham berada dekat area support.',
  },
  {
    key: 'unusualVolume',
    label: 'Unusual Volume',
    description: 'Saham dengan aktivitas volume tidak biasa.',
  },
  {
    key: 'distribution',
    label: 'Distribution',
    description: 'Saham yang menunjukkan tekanan jual.',
  },
] as const

type Opportunity = {
  ticker: string
  name: string
  aiScore: number
  setup: string
}

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const params = await searchParams
  const selectedType = params.type

  const supabase = await createClient()

  const { data: snapshot } = await supabase
    .from('market_snapshot')
    .select('*')
    .order('computed_at', { ascending: false })
    .limit(1)
    .single()

  const opportunities =
    (snapshot?.top_opportunities as Opportunity[] | null) ?? []

  const radar =
    (snapshot?.radar as Record<string, number> | null) ?? {}

  const selectedRadar = radarMeta.find((item) => item.key === selectedType)

  return (
    <div className="space-y-6 p-6">

      <div>
        <Link
          href="/"
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Kembali ke Dashboard
        </Link>

        <h1 className="mt-3 text-2xl font-semibold text-neutral-900">
          Market Opportunities
        </h1>

        <p className="mt-1 text-sm text-neutral-500">
          Kandidat saham berdasarkan market radar StockFamily.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
        {radarMeta.map((item) => {
          const active = selectedType === item.key
          const count = radar[item.key] ?? 0

          return (
            <Link
              key={item.key}
              href={`/opportunities?type=${item.key}`}
              className={`rounded-xl border p-4 transition ${
                active
                  ? 'border-emerald-500 bg-emerald-50'
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

      <div className="rounded-xl border border-neutral-200 bg-white p-5">

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-neutral-500">
              {selectedRadar?.label ?? 'Top Opportunities'}
            </p>

            <h2 className="mt-1 text-lg font-semibold text-neutral-900">
              {selectedRadar
                ? selectedRadar.description
                : 'Kandidat saham terbaik dari opportunity engine.'}
            </h2>
          </div>

          <Link
            href="/opportunities"
            className="text-xs text-neutral-500 hover:text-neutral-900"
          >
            Reset Filter
          </Link>
        </div>

        {opportunities.length > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">

            {opportunities.map((stock) => (
              <Link
                key={stock.ticker}
                href={`/stock/${stock.ticker}`}
                className="rounded-xl border border-neutral-200 p-4 transition hover:border-neutral-400 hover:bg-neutral-50"
              >
                <div className="flex items-start justify-between">

                  <div>
                    <p className="text-lg font-bold text-neutral-900">
                      {stock.ticker}
                    </p>

                    <p className="mt-1 truncate text-xs text-neutral-500">
                      {stock.name}
                    </p>
                  </div>

                  <div className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
                    {stock.aiScore}/100
                  </div>

                </div>

                <div className="mt-4">
                  <p className="text-[11px] uppercase text-neutral-400">
                    Setup
                  </p>

                  <p className="mt-1 text-sm font-medium text-neutral-800">
                    {stock.setup}
                  </p>
                </div>

                <p className="mt-4 text-xs font-medium text-emerald-600">
                  Lihat Stock Detail →
                </p>
              </Link>
            ))}

          </div>
        ) : (
          <div className="mt-5 rounded-lg bg-neutral-50 p-8 text-center">
            <p className="font-semibold text-neutral-800">
              Belum ada kandidat.
            </p>

            <p className="mt-1 text-xs text-neutral-500">
              Opportunity engine belum menghasilkan saham untuk radar ini.
            </p>
          </div>
        )}

      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
        <p className="text-xs font-semibold uppercase text-neutral-500">
          Data Note
        </p>

        <p className="mt-2 text-xs leading-5 text-neutral-500">
          Opportunity saat ini menggunakan top_opportunities dari market
          snapshot. Radar merupakan klasifikasi awal berdasarkan engine
          market. Tahap berikutnya dapat menambahkan radar category eksplisit
          pada setiap saham.
        </p>
      </div>

    </div>
  )
}