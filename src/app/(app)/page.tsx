import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import RefreshButton from './RefreshButton'
import { analyzeStock, type Candle } from '@/lib/analysis/technical'

function qualLabel(
  score: number,
  positive: string,
  neutral: string,
  negative: string,
) {
  if (score >= 65) return positive
  if (score >= 45) return neutral
  return negative
}

function getBreadthInsight(snapshot: any) {
  const score = Number(snapshot.breadth_score)
  const advancing = Number(snapshot.advancing ?? 0)
  const declining = Number(snapshot.declining ?? 0)
  const ratio =
    declining > 0 ? advancing / declining : advancing > 0 ? 2 : 1

  let label = 'Neutral'
  let tone = 'neutral'

  if (score >= 65) {
    label = 'Strong'
    tone = 'positive'
  } else if (score < 45) {
    label = 'Weak'
    tone = 'negative'
  }

  let note = `${Number(snapshot.above_ma20_pct).toFixed(0)}% saham masih berada di atas MA20.`

  if (ratio < 0.5 && score >= 45) {
    label += ' / Weakening'
    tone = 'warning'
    note += ` Namun saham turun (${declining}) jauh lebih banyak dibanding naik (${advancing}) hari ini — tekanan jual jangka pendek meningkat.`
  } else if (ratio > 1.5) {
    note += ` Saham naik (${advancing}) juga lebih banyak dibanding turun (${declining}), mendukung struktur breadth yang sehat.`
  } else {
    note += ` Saham naik (${advancing}) dan turun (${declining}) relatif seimbang hari ini.`
  }

  return { label, tone, note }
}

function getFreshness(computedAt: string | null | undefined) {
  if (!computedAt) {
    return {
      status: 'ERROR',
      label: 'Data belum tersedia',
      dot: 'bg-red-500',
      color: 'text-red-400',
    }
  }

  const ageMin = (Date.now() - new Date(computedAt).getTime()) / 60000

  if (ageMin <= 20) {
    return {
      status: 'LIVE',
      label: `LIVE • ${Math.round(ageMin)} menit lalu`,
      dot: 'bg-emerald-500',
      color: 'text-emerald-400',
    }
  }

  if (ageMin <= 90) {
    return {
      status: 'RECENT',
      label: `RECENT • ${Math.round(ageMin)} menit lalu`,
      dot: 'bg-amber-500',
      color: 'text-amber-400',
    }
  }

  return {
    status: 'STALE',
    label: `STALE • ${Math.round(ageMin)} menit lalu`,
    dot: 'bg-red-500',
    color: 'text-red-400',
  }
}

const radarMeta = [
  {
    key: 'breakoutWatch',
    label: 'Breakout Watch',
    short: 'Breakout',
    accent: 'text-violet-400',
    icon: '↗',
    desc: (n: number) => `${n} kandidat breakout`,
  },
  {
    key: 'momentum',
    label: 'Momentum',
    short: 'Momentum',
    accent: 'text-orange-400',
    icon: '↯',
    desc: (n: number) => `${n} saham dengan momentum`,
  },
  {
    key: 'nearSupport',
    label: 'Near Support',
    short: 'Support',
    accent: 'text-sky-400',
    icon: '◎',
    desc: (n: number) => `${n} saham dekat support`,
  },
  {
    key: 'unusualVolume',
    label: 'Unusual Volume',
    short: 'Volume',
    accent: 'text-cyan-400',
    icon: '▥',
    desc: (n: number) => `${n} saham volume tidak biasa`,
  },
  {
    key: 'distribution',
    label: 'Distribution',
    short: 'Distribution',
    accent: 'text-red-400',
    icon: '↓',
    desc: (n: number) => `${n} saham dengan tekanan jual`,
  },
]

const biasColor: Record<string, string> = {
  'STRONG BULLISH': 'text-emerald-400',
  BULLISH: 'text-emerald-400',
  NEUTRAL: 'text-amber-400',
  BEARISH: 'text-red-400',
  'STRONG BEARISH': 'text-red-400',
}

const biasSoft: Record<string, string> = {
  'STRONG BULLISH': 'bg-emerald-500/[0.06] border-emerald-400/20',
  BULLISH: 'bg-emerald-500/[0.06] border-emerald-400/20',
  NEUTRAL: 'bg-amber-500/[0.06] border-amber-400/20',
  BEARISH: 'bg-red-500/[0.06] border-red-400/20',
  'STRONG BEARISH': 'bg-red-500/[0.06] border-red-400/20',
}

const actionColor: Record<string, string> = {
  BUY_ON_CONFIRMATION: 'bg-emerald-600 text-white',
  WAIT_PULLBACK: 'bg-amber-500 text-white',
  AVOID: 'bg-red-600 text-white',
  WAIT_CONFIRMATION: 'bg-neutral-600 text-white',
}

const actionLabel: Record<string, string> = {
  BUY_ON_CONFIRMATION: 'BUY ON CONFIRMATION',
  WAIT_PULLBACK: "DON'T CHASE",
  AVOID: 'AVOID',
  WAIT_CONFIRMATION: 'WAIT CONFIRMATION',
}

type RadarStock = {
  ticker: string
  name: string
  aiScore: number
  setup: string
  price?: number | null
}

type RadarBucket = {
  count: number
  stocks: RadarStock[]
}

async function getCandles(
  supabase: any,
  ticker: string,
): Promise<Candle[]> {
  const { data } = await supabase
    .from('stock_ohlcv')
    .select('*')
    .eq('ticker', ticker)
    .order('date', { ascending: true })

  return (data ?? []).map((r: any) => ({
    date: r.date,
    open: Number(r.open),
    high: Number(r.high),
    low: Number(r.low),
    close: Number(r.close),
    volume: Number(r.volume),
  }))
}

function ScoreBar({ score }: { score: number }) {
  const value = Math.max(0, Math.min(100, Number(score) || 0))

  return (
    <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-emerald-300 transition-all"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

function Metric({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'positive' | 'negative' | 'warning'
}) {
  const valueClass = {
    default: 'text-white',
    positive: 'text-emerald-400',
    negative: 'text-red-400',
    warning: 'text-amber-400',
  }[tone]

  return (
    <div className="rounded-xl border border-white/[0.09] bg-[#07131a] p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className={`mt-1.5 text-xl font-semibold tracking-tight ${valueClass}`}>
        {value}
      </p>
    </div>
  )
}


function Sparkline({
  values,
  positive = true,
}: {
  values: number[]
  positive?: boolean
}) {
  const clean = values.filter((v) => Number.isFinite(v))
  if (clean.length < 2) {
    return <div className="h-8 w-28 rounded bg-white/[0.03]" />
  }

  const min = Math.min(...clean)
  const max = Math.max(...clean)
  const range = max - min || 1
  const points = clean
    .map((v, i) => {
      const x = (i / (clean.length - 1)) * 100
      const y = 28 - ((v - min) / range) * 24
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-28 overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? 'rgb(52 211 153)' : 'rgb(248 113 113)'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: snapshot } = await supabase
    .from('market_snapshot')
    .select('*')
    .order('computed_at', { ascending: false })
    .limit(1)
    .single()

  if (!snapshot) {
    return (
      <div className="min-h-full bg-[#050c11] p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-400">
            Data market belum tersedia.
          </p>
        </div>
      </div>
    )
  }

  const brief = snapshot.ai_brief ?? null

  /*
   * Radar supports both the current shape:
   * { breakoutWatch: { count, stocks }, ... }
   * and the older shape where radar stocks were stored directly as arrays.
   */
  const rawRadar = snapshot.radar ?? {}
  const rawRadarStocks = snapshot.radar_stocks ?? {}

  const radarObject =
    typeof rawRadar === 'string'
      ? (() => {
          try {
            return JSON.parse(rawRadar)
          } catch {
            return {}
          }
        })()
      : rawRadar

  const legacyRadarStocks =
    typeof rawRadarStocks === 'string'
      ? (() => {
          try {
            return JSON.parse(rawRadarStocks)
          } catch {
            return {}
          }
        })()
      : rawRadarStocks

  const radarCounts: Record<string, number> = {}
  const radarStocks: Record<string, RadarStock[]> = {}

  for (const item of radarMeta) {
    const bucket = radarObject?.[item.key]
    const legacy = legacyRadarStocks?.[item.key]

    if (
      bucket &&
      typeof bucket === 'object' &&
      !Array.isArray(bucket)
    ) {
      radarCounts[item.key] = Number(bucket.count ?? 0)
      radarStocks[item.key] = Array.isArray(bucket.stocks)
        ? bucket.stocks
        : []
    } else {
      radarCounts[item.key] = Number(
        Array.isArray(bucket)
          ? bucket.length
          : Array.isArray(legacy)
            ? legacy.length
            : 0,
      )
      radarStocks[item.key] = Array.isArray(legacy)
        ? legacy
        : Array.isArray(bucket)
          ? bucket
          : []
    }
  }

  const topOpportunities =
    (snapshot.top_opportunities as RadarStock[]) ?? []

  const breadthInsight = getBreadthInsight(snapshot)
  const freshness = getFreshness(snapshot.computed_at)
  const marketBias = String(snapshot.market_bias_label ?? 'NEUTRAL')
  const marketScore = Number(snapshot.market_bias_score ?? 0)

  const enrichedOpportunities = await Promise.all(
    topOpportunities.map(async (s) => {
      const candles = await getCandles(supabase, s.ticker)

      if (candles.length < 20) {
        return { ...s, analysis: null, sparkline: candles.slice(-18).map((c) => c.close) }
      }

      try {
        return {
          ...s,
          analysis: analyzeStock(candles),
          sparkline: candles.slice(-18).map((c) => c.close),
        }
      } catch {
        return { ...s, analysis: null, sparkline: candles.slice(-18).map((c) => c.close) }
      }
    }),
  )

  const scoreFactors = [
    {
      label: 'Trend',
      value: qualLabel(snapshot.trend_score, 'Bullish', 'Netral', 'Bearish'),
      score: Number(snapshot.trend_score ?? 0),
    },
    {
      label: 'Momentum',
      value: qualLabel(
        snapshot.momentum_score,
        'Positive',
        'Netral',
        'Negative',
      ),
      score: Number(snapshot.momentum_score ?? 0),
    },
    {
      label: 'Breadth',
      value: qualLabel(snapshot.breadth_score, 'Strong', 'Netral', 'Weak'),
      score: Number(snapshot.breadth_score ?? 0),
    },
    {
      label: 'Volume',
      value: qualLabel(
        snapshot.volume_score,
        'Expanding',
        'Netral',
        'Shrinking',
      ),
      score: Number(snapshot.volume_score ?? 0),
    },
    {
      label: 'Risk',
      value: qualLabel(snapshot.risk_score, 'Normal', 'Waspada', 'Tinggi'),
      score: Number(snapshot.risk_score ?? 0),
    },
  ]

  return (
    <div className="min-h-full bg-[#03080c] text-white">
      <div className="relative mx-auto max-w-[1680px] space-y-5 overflow-hidden p-3 sm:p-5 lg:p-7">
        <div className="pointer-events-none absolute -left-32 top-0 h-80 w-80 rounded-full bg-cyan-400/[0.035] blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-24 h-96 w-96 rounded-full bg-emerald-400/[0.025] blur-3xl" />

        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-white/[0.08] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan-400/70">StockFamily Intelligence</div>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                Market Dashboard
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-wide ${freshness.status === 'LIVE'
                  ? 'border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-300'
                  : freshness.status === 'RECENT'
                    ? 'border-amber-400/20 bg-amber-500/[0.08] text-amber-300'
                    : 'border-red-400/20 bg-red-500/[0.08] text-red-300'
                  }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${freshness.dot}`} />
                {freshness.status}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-slate-400">
              Market regime, breadth & actionable signals
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Data freshness
              </p>
              <p className={`mt-0.5 text-xs font-medium ${freshness.color}`}>
                {freshness.label}
              </p>
            </div>
            <RefreshButton />
          </div>
        </header>

        {/* Hero market overview */}
        <section
          className={`overflow-hidden rounded-2xl border bg-gradient-to-br from-[#07131a] via-[#061018] to-[#041016] shadow-[0_24px_80px_rgba(0,0,0,0.34)] ${biasSoft[marketBias] ?? 'border-white/[0.09]'
            }`}
        >
          <div className="grid lg:grid-cols-[1.45fr_0.8fr]">
            <div className="relative p-6 sm:p-8 lg:p-9">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                    IHSG Market Overview
                  </p>
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <p className="font-mono text-5xl font-black tracking-[-0.04em] text-white sm:text-6xl">
                      {Number(snapshot.ihsg_price).toLocaleString('id-ID', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    <p
                      className={`pb-1.5 font-mono text-sm font-semibold ${Number(snapshot.ihsg_change_percent) >= 0
                        ? 'text-emerald-400'
                        : 'text-red-400'
                        }`}
                    >
                      {Number(snapshot.ihsg_change_percent) >= 0 ? '+' : ''}
                      {Number(snapshot.ihsg_change_percent).toFixed(2)}%
                    </p>
                  </div>
                  <div className="mt-4 flex items-center gap-2.5">
                    <span
                      className={`h-2 w-2 rounded-full ${marketBias.includes('BULLISH')
                        ? 'bg-emerald-500'
                        : marketBias.includes('BEARISH')
                          ? 'bg-red-500'
                          : 'bg-amber-500'
                        }`}
                    />
                    <span
                      className={`text-sm font-bold ${biasColor[marketBias] ?? 'text-slate-300'
                        }`}
                    >
                      {marketBias}
                    </span>
                  </div>
                </div>

                <div className="hidden items-center gap-4 sm:flex">
                  <div
                    className="relative flex h-24 w-24 items-center justify-center rounded-full"
                    style={{
                      background: `conic-gradient(from 220deg, ${marketBias.includes('BEARISH') ? 'rgb(248 113 113)' : marketBias === 'NEUTRAL' ? 'rgb(251 191 36)' : 'rgb(52 211 153)'} ${Math.max(0, Math.min(100, marketScore)) * 3.6}deg, rgba(255,255,255,.05) 0deg)`,
                    }}
                  >
                    <div className="flex h-[76px] w-[76px] flex-col items-center justify-center rounded-full bg-[#061018]">
                      <span className="font-mono text-2xl font-black text-white">{marketScore}</span>
                      <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500">Score</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Market regime
                    </p>
                    <p className={`mt-1 text-sm font-black ${biasColor[marketBias] ?? 'text-slate-300'}`}>
                      {marketBias}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">Composite intelligence</p>
                  </div>
                </div>
              </div>

              <div className="mt-7">
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <span>Market score</span>
                  <span>{marketScore}/100</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full ${marketBias.includes('BULLISH')
                      ? 'bg-emerald-500'
                      : marketBias.includes('BEARISH')
                        ? 'bg-red-500'
                        : 'bg-amber-500'
                      }`}
                    style={{
                      width: `${Math.max(0, Math.min(100, marketScore))}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-white/[0.09] bg-[#07131a]/[0.025] p-6 lg:border-l lg:border-t-0 sm:p-8">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-1">
                {scoreFactors.map((factor) => (
                  <div
                    key={factor.label}
                    className="group rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5 transition hover:border-white/[0.14] hover:bg-white/[0.04] lg:flex lg:items-center lg:justify-between"
                  >
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {factor.label}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-100">
                        {factor.value}
                      </p>
                    </div>
                    <span className="mt-2 block font-mono text-xs text-slate-500 lg:mt-0">
                      {Math.round(factor.score)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Breadth */}
        <section className="rounded-2xl border border-white/[0.09] bg-[#061017]/90 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Market Breadth
                </p>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-400">
                  {Number(snapshot.breadth_score)}/100
                </span>
              </div>
              <p className="mt-2 text-lg font-bold tracking-tight text-white">
                {breadthInsight.label}
              </p>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-400">
                {breadthInsight.note}
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Metric
              label="Above MA20"
              value={`${Number(snapshot.above_ma20_pct).toFixed(0)}%`}
              tone={
                Number(snapshot.above_ma20_pct) >= 50
                  ? 'positive'
                  : 'warning'
              }
            />
            <Metric
              label="Above MA50"
              value={`${Number(snapshot.above_ma50_pct).toFixed(0)}%`}
              tone={
                Number(snapshot.above_ma50_pct) >= 50
                  ? 'positive'
                  : 'warning'
              }
            />
            <Metric
              label="Advancing"
              value={String(snapshot.advancing ?? 0)}
              tone="positive"
            />
            <Metric
              label="Declining"
              value={String(snapshot.declining ?? 0)}
              tone="negative"
            />
            <Metric
              label="New High / Low"
              value={`${snapshot.new_high_90d ?? 0} / ${snapshot.new_low_90d ?? 0}`}
            />
          </div>
        </section>

        {/* Top opportunities */}
        <section className="rounded-2xl border border-white/[0.09] bg-[#061017]/90 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] sm:p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Top Opportunities
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">
                Highest-conviction setups
              </h2>
            </div>
            <span className="hidden rounded-full bg-white/[0.06] px-3 py-1 text-[10px] font-semibold text-slate-400 sm:block">
              Top {enrichedOpportunities.length}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {enrichedOpportunities.map((s, index) => {
              const a = s.analysis
              const tp = a?.tradePlan

              return (
                <Link
                  key={s.ticker}
                  href={`/stock/${s.ticker}`}
                  className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.045] to-white/[0.018] p-4 transition duration-200 hover:-translate-y-1 hover:border-emerald-400/20 hover:shadow-[0_16px_45px_rgba(0,0,0,.25)] sm:p-5"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#02070a] font-mono text-xs font-bold text-white">
                      {String(index + 1).padStart(2, '0')}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-base font-bold tracking-tight text-white">
                            {s.ticker}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            {s.name}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono text-xl font-bold text-white">
                            {s.aiScore}
                          </p>
                          <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                            AI Score
                          </p>
                        </div>
                      </div>

                      {a && (
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">

                          <p className="font-mono text-sm font-semibold text-slate-100">
                            Rp{Math.round(a.lastPrice).toLocaleString('id-ID')}
                          </p>
                          <span
                            className={`font-mono text-xs font-semibold ${a.changePercent != null &&
                              a.changePercent >= 0
                              ? 'text-emerald-400'
                              : 'text-red-400'
                              }`}
                          >
                            {a.changePercent != null
                              ? `${a.changePercent >= 0 ? '+' : ''}${a.changePercent.toFixed(2)}%`
                              : ''}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            RSI {a.rsi != null ? a.rsi.toFixed(1) : '-'} · Vol{' '}
                            {a.volumeRatio != null
                              ? `${a.volumeRatio.toFixed(1)}x`
                              : '-'}
                          </span>
                          </div>
                          <Sparkline
                            values={s.sparkline ?? []}
                            positive={a.changePercent == null || a.changePercent >= 0}
                          />
                        </div>
                      )}

                      <ScoreBar score={s.aiScore} />

                      {tp && (
                        <div className="mt-4 rounded-xl bg-[#050c11] p-3.5">
                          <div className="flex items-center justify-between gap-3">
                            <span
                              className={`rounded-md px-2 py-1 text-[9px] font-bold tracking-wide ${actionColor[tp.finalAction] ?? 'bg-neutral-600 text-white'
                                }`}
                            >
                              {actionLabel[tp.finalAction] ?? tp.status}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              R:R{' '}
                              {tp.riskReward != null
                                ? `1:${tp.riskReward.toFixed(1)}`
                                : '-'}
                            </span>
                          </div>

                          {tp.status === 'VALID' && (
                            <div className="mt-3 grid grid-cols-3 gap-3">
                              <div>
                                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                                  Entry
                                </p>
                                <p className="mt-1 font-mono text-xs font-semibold text-slate-100">
                                  Rp{tp.entry?.toLocaleString('id-ID')}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                                  Stop Loss
                                </p>
                                <p className="mt-1 font-mono text-xs font-semibold text-red-400">
                                  Rp{tp.invalidation?.toLocaleString('id-ID')}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                                  Target
                                </p>
                                <p className="mt-1 font-mono text-xs font-semibold text-emerald-400">
                                  Rp{tp.target1?.toLocaleString('id-ID')}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        {s.setup}
                      </p>
                    </div>
                  </div>
                </Link>
              )
            })}

            {enrichedOpportunities.length === 0 && (
              <p className="text-sm text-slate-400">
                Belum ada saham dengan skor menonjol hari ini.
              </p>
            )}
          </div>
        </section>

        {/* Radar */}
        <section className="rounded-2xl border border-white/[0.09] bg-[#061017]/90 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.18)] sm:p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Market Radar
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">
                Where the market is moving
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Click a signal to explore opportunities
            </p>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {radarMeta.map((r) => {
              const count = radarCounts[r.key] ?? 0
              const tickers = (radarStocks[r.key] ?? [])
                .slice(0, 4)
                .map((s) => s.ticker)

              return (
                <Link
                  key={r.key}
                  href={`/opportunities?type=${r.key}`}
                  className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 transition duration-200 hover:-translate-y-1 hover:border-white/[0.16] hover:bg-white/[0.045] hover:shadow-[0_16px_45px_rgba(0,0,0,.22)]"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-xl bg-[#07131a] font-mono text-sm font-bold shadow-sm ${r.accent}`}
                    >
                      {r.icon}
                    </span>
                    <span className="font-mono text-2xl font-bold tracking-tight text-white">
                      {count}
                    </span>
                  </div>

                  <p className="mt-4 text-xs font-semibold text-slate-100">
                    {r.label}
                  </p>

                  <div className="mt-2 min-h-9">
                    {tickers.length > 0 ? (
                      <p className="font-mono text-[10px] leading-4 text-slate-400">
                        {tickers.join(' · ')}
                      </p>
                    ) : (
                      <p className="text-[10px] leading-4 text-slate-500">
                        {r.desc(count)}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 text-[9px] font-bold uppercase tracking-wider text-slate-500 transition group-hover:text-slate-300">
                    View signal →
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* AI brief */}
        <section className="relative overflow-hidden rounded-2xl border border-cyan-400/10 bg-gradient-to-br from-[#07131a] to-[#02070a] text-white shadow-[0_18px_55px_rgba(0,0,0,.25)]">
          <div className="p-5 sm:p-6 lg:p-7">
            <div className="flex items-start gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#07131a]/10 text-sm font-bold text-white">
                ✦
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  AI Market Brief
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Explanation of the current engine output
                </p>
              </div>
            </div>

            <p className="mt-5 max-w-5xl whitespace-pre-wrap text-sm leading-6 text-slate-200">
              {brief ?? 'Belum ada AI brief untuk snapshot ini.'}
            </p>

            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="text-[10px] leading-4 text-slate-400">
                AI hanya menjelaskan hasil engine, bukan menentukan arah market.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
