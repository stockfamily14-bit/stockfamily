import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import OpportunitiesClient from './OpportunitiesClient'

export const dynamic = 'force-dynamic'

const radarMeta = [
  {
    key: 'breakoutWatch',
    label: 'Breakout Watch',
    icon: '',
    description:
      'Saham mendekati atau menembus resistance dengan konfirmasi volume.',
    accent: 'emerald',
  },
  {
    key: 'momentum',
    label: 'Momentum',
    icon: '',
    description:
      'Saham dalam tren naik kuat dengan ekspansi RSI positif.',
    accent: 'cyan',
  },
  {
    key: 'nearSupport',
    label: 'Near Support',
    icon: '',
    description:
      'Saham berada dekat area demand/support dengan Risk/Reward optimal.',
    accent: 'amber',
  },
  {
    key: 'unusualVolume',
    label: 'Unusual Volume',
    icon: '',
    description:
      'Aktivitas akumulasi volume tidak biasa di atas rata-rata 20 hari.',
    accent: 'violet',
  },
  {
    key: 'distribution',
    label: 'Distribution',
    icon: '!',
    description:
      'Saham menunjukkan tekanan jual tinggi atau indikasi breakdown.',
    accent: 'red',
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
    <div className="min-h-screen bg-[#07090e] px-4 py-6 font-sans text-slate-300 sm:px-6 md:px-8">
      {/* BREADCRUMB & HEADER */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-500 transition-colors hover:text-cyan-400"
        >
           Kembali ke Dashboard
        </Link>

        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Market Opportunities
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Kandidat saham berdasarkan analisis radar indikator teknikal StockFamily.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Market Radar
          </span>
        </div>
      </div>

      {/* RADAR TABS / CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {radarMeta.map((item) => {
          const active = selectedType === item.key
          const count = radar[item.key]?.count ?? 0

          return (
            <Link
              key={item.key}
              href={`/opportunities?type=${item.key}`}
              scroll={false}
              className={`group relative flex min-h-[135px] flex-col justify-between overflow-hidden rounded-2xl border p-4 transition-all duration-200 cursor-pointer ${
                active
                  ? 'bg-[#0f172a] border-cyan-400/80 shadow-[0_0_25px_rgba(34,211,238,0.15)] ring-1 ring-cyan-400/50'
                  : 'bg-[#0b101d] border-white/5 hover:border-white/15 hover:bg-[#0f1626]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-black uppercase tracking-wider ${
                      active ? 'text-cyan-400' : 'text-slate-400'
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="text-sm font-bold text-slate-400 opacity-80 transition-transform group-hover:scale-125">
                    {item.icon}
                  </span>
                </div>
                <p
                  className={`mt-2 text-2xl font-black font-mono tracking-tight ${
                    active ? 'text-white' : 'text-slate-200'
                  }`}
                >
                  {count}
                </p>
              </div>
              <p className="mt-2 line-clamp-2 text-[10px] leading-relaxed text-slate-500">
                {item.description}
              </p>
            </Link>
          )
        })}
      </div>

      {/* CLIENT TABLE */}
      <OpportunitiesClient
        stocks={activeStocks}
        selectedRadar={selectedRadar}
        selectedType={selectedType}
        activeCount={activeCount}
      />

      {/* SYSTEM STATUS FOOTER */}
      <div className="mt-6 flex flex-col justify-between gap-3 rounded-2xl border border-white/5 bg-[#0b101d] p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Engine Status:
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-mono font-bold ${
              snapshot?.refresh_status === 'SUCCESS'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}
          >
            {snapshot?.refresh_status === 'SUCCESS'
              ? ' Live & Synced'
              : ' Updating'}
          </span>
        </div>
        <p className="font-mono text-[11px] text-slate-500">
          Last Synced:{' '}
          {snapshot?.computed_at
            ? new Date(snapshot.computed_at).toLocaleString('id-ID')
            : '-'}
        </p>
      </div>
    </div>
  )
}
