import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import OpportunitiesClient from './OpportunitiesClient'

export const dynamic = 'force-dynamic'

const radarMeta = [
  {
    key: 'breakoutWatch',
    label: 'Breakout Watch',
    icon: '↗',
    description:
      'Saham mendekati atau menembus resistance dengan konfirmasi volume.',
  },
  {
    key: 'momentum',
    label: 'Momentum',
    icon: '▲',
    description:
      'Saham dalam tren naik kuat dengan ekspansi RSI positif.',
  },
  {
    key: 'nearSupport',
    label: 'Near Support',
    icon: '◎',
    description:
      'Saham berada dekat area demand/support dengan Risk/Reward optimal.',
  },
  {
    key: 'unusualVolume',
    label: 'Unusual Volume',
    icon: '▥',
    description:
      'Aktivitas akumulasi volume tidak biasa di atas rata-rata 20 hari.',
  },
  {
    key: 'distribution',
    label: 'Distribution',
    icon: '!',
    description:
      'Saham menunjukkan tekanan jual tinggi atau indikasi breakdown.',
  },
] as const

type StockCandidate = {
  ticker: string
  name: string
  setup: string
  aiScore: number
  price?: number
}

type RadarEntry = {
  count: number
  stocks: StockCandidate[]
}

type RadarData = Record<string, RadarEntry>

export default async function OpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const params = await searchParams
  const selectedType = params.type || 'breakoutWatch'

  const supabase = await createClient()

  const { data: snapshot } = await supabase
    .from('market_snapshot')
    .select('*')
    .order('computed_at', { ascending: false })
    .limit(1)
    .single()

  const rawRadar = snapshot?.radar
  const rawRadarStocks = snapshot?.radar_stocks

  let parsedRadar: any = rawRadar
  if (typeof parsedRadar === 'string') {
    try {
      parsedRadar = JSON.parse(parsedRadar)
    } catch {
      parsedRadar = {}
    }
  }

  let parsedRadarStocks: any = rawRadarStocks
  if (typeof parsedRadarStocks === 'string') {
    try {
      parsedRadarStocks = JSON.parse(parsedRadarStocks)
    } catch {
      parsedRadarStocks = {}
    }
  }

  const radar = Object.fromEntries(
    radarMeta.map((meta) => {
      const value = parsedRadar?.[meta.key]
      const legacyStocks = parsedRadarStocks?.[meta.key]

      if (value && typeof value === 'object') {
        return [
          meta.key,
          {
            count:
              typeof value.count === 'number'
                ? value.count
                : Array.isArray(value.stocks)
                  ? value.stocks.length
                  : 0,
            stocks: Array.isArray(value.stocks)
              ? value.stocks
              : Array.isArray(legacyStocks)
                ? legacyStocks
                : [],
          },
        ]
      }

      return [
        meta.key,
        {
          count:
            typeof value.count === 'number'
              ? value
              : Array.isArray(legacyStocks)
                ? legacyStocks.length
                : 0,
          stocks: Array.isArray(legacyStocks) ? legacyStocks : [],
        },
      ]
    })
  ) as RadarData

  const selectedRadar =
    radarMeta.find((item) => item.key === selectedType) ?? radarMeta[0]

  const selectedEntry = radar[selectedRadar.key] ?? {
    count: 0,
    stocks: [],
  }

  const activeStocks = selectedEntry.stocks ?? []
  const activeCount = selectedEntry.count ?? activeStocks.length

  return (
    <div className="min-h-screen bg-[#08090a] px-4 py-5 font-sans text-neutral-300 sm:px-6 sm:py-6 lg:px-7">
      {/* BREADCRUMB & HEADER */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 font-mono text-[10px] font-medium text-neutral-600 transition-colors hover:text-emerald-400"
        >
          ← Kembali ke Dashboard
        </Link>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-[-0.03em] text-white sm:text-[30px]">
              Market Opportunities
            </h1>
            <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-neutral-500">
              Kandidat saham berdasarkan analisis radar indikator teknikal StockFamily.
            </p>
          </div>
          <span className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.05)] sm:inline-flex">
            ● Live Market Radar
          </span>
        </div>
      </div>

      {/* RADAR TABS (DARK MODE TERMINAL STYLE) */}
      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-5 sm:gap-3">
        {radarMeta.map((item) => {
          const active = selectedType === item.key
          const count = radar[item.key]?.count ?? 0

          return (
            <Link
              key={item.key}
              href={`/opportunities?type=${item.key}`}
              className={`group relative flex min-h-[132px] flex-col justify-between overflow-hidden rounded-xl border p-4 transition-all duration-200 ${
                active
                  ? 'bg-[#12161f] border-emerald-500/80 shadow-[0_12px_32px_rgba(16,185,129,0.10)] ring-1 ring-emerald-500/30'
                  : 'bg-[#101216] border-white/[0.06] hover:-translate-y-0.5 hover:border-white/[0.14] hover:bg-[#15171c] hover:shadow-[0_10px_28px_rgba(0,0,0,0.22)]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-[0.09em] ${
                      active ? 'text-emerald-400' : 'text-neutral-500'
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="text-base opacity-80 transition-transform group-hover:scale-110">{item.icon}</span>
                </div>
                <p
                  className={`mt-3 text-[25px] font-black font-mono tracking-tight ${
                    active ? 'text-white' : 'text-neutral-200'
                  }`}
                >
                  {count}
                </p>
              </div>
              <p className="mt-3 line-clamp-2 text-[9px] leading-relaxed text-neutral-600">
                {item.description}
              </p>
            </Link>
          )
        })}
      </div>

      <OpportunitiesClient
        stocks={activeStocks}
        selectedRadar={selectedRadar}
        selectedType={selectedType}
        activeCount={activeCount}
      />
      {/* SYSTEM STATUS FOOTER */}
      <div className="mt-6 flex flex-col justify-between gap-3 rounded-xl border border-white/[0.07] bg-[#0f1115] p-3.5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-neutral-600">
            Engine Status:
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-mono font-bold ${
              snapshot?.refresh_status === 'SUCCESS'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}
          >
            {snapshot?.refresh_status === 'SUCCESS'
              ? '● Live & Synced'
              : '● Updating'}
          </span>
        </div>
        <p className="font-mono text-[10px] text-neutral-600">
          Last Synced:{' '}
          {snapshot?.computed_at
            ? new Date(snapshot.computed_at).toLocaleString('id-ID')
            : '-'}
        </p>
      </div>
    </div>
  )
}
