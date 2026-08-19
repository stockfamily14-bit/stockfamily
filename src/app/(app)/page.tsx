import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

function qualLabel(score: number, positive: string, neutral: string, negative: string) {
  if (score >= 65) return positive
  if (score >= 45) return neutral
  return negative
}

function getBreadthInsight(snapshot: any) {
  const score = Number(snapshot.breadth_score)
  const advancing = snapshot.advancing
  const declining = snapshot.declining
  const ratio = declining > 0 ? advancing / declining : advancing > 0 ? 2 : 1

  let label = 'Neutral'
  let emoji = '\u{1F7E1}'
  if (score >= 65) {
    label = 'Strong'
    emoji = '\u{1F7E2}'
  } else if (score < 45) {
    label = 'Weak'
    emoji = '\u{1F7E2}'
  }

  let note = `${Number(snapshot.above_ma20_pct).toFixed(0)}% saham masih berada di atas MA20.`
  if (ratio < 0.5 && score >= 45) {
    label += ' / Weakening'
    note += " Namun saham turun (" + declining + ") jauh lebih banyak dibanding naik (" + advancing + ") hari ini - tekanan jual jangka pendek meningkat."
  } else if (ratio > 1.5) {
    note += ` Saham naik (${advancing}) juga lebih banyak dibanding turun (${declining}), mendukung struktur breadth yang sehat.`
  } else {
    note += ` Saham naik (${advancing}) dan turun (${declining}) relatif seimbang hari ini.`
  }

  return { emoji, label, note }
}

const radarMeta = [
  { key: 'breakoutWatch', label: 'Breakout Watch', icon: '\u{1F680}', desc: (n: number) => `${n} saham mendekati/breakout resistance` },
  { key: 'momentum', label: 'Momentum', icon: '\u{1F525}', desc: (n: number) => `${n} saham menunjukkan momentum positif` },
  { key: 'nearSupport', label: 'Near Support', icon: '\u{1F3AF}', desc: (n: number) => `${n} saham berada dekat area support` },
  { key: 'unusualVolume', label: 'Unusual Volume', icon: '\u{1F4CA}', desc: (n: number) => `${n} saham dengan volume tidak biasa` },
  { key: 'distribution', label: 'Distribution', icon: '\u{26A0}\u{FE0F}', desc: (n: number) =>`${n} saham menunjukkan tekanan jual` },
]

const biasColor: Record<string, string> = {
  'STRONG BULLISH': String.fromCodePoint(0x1F7E2),
  BULLISH: String.fromCodePoint(0x1F7E2),
  NEUTRAL: String.fromCodePoint(0x1F7E1),
  BEARISH: String.fromCodePoint(0x1F534),
  'STRONG BEARISH': String.fromCodePoint(0x1F534),
}

const biasEmoji: Record<string, string> = {
  'STRONG BULLISH': String.fromCodePoint(0x1F7E2),
  BULLISH: String.fromCodePoint(0x1F7E2),
  NEUTRAL: String.fromCodePoint(0x1F7E1),
  BEARISH: String.fromCodePoint(0x1F534),
  'STRONG BEARISH': String.fromCodePoint(0x1F534),
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
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Snapshot market belum tersedia. Jalankan script compute-snapshot dulu.
        </p>
      </div>
    )
  }

  const brief = snapshot.ai_brief ?? null
  const radar = snapshot.radar as Record<string, { count: number; stocks: any[] }>
  const topOpportunities = snapshot.top_opportunities as { ticker: string; name: string; aiScore: number; setup: string }[]
  const breadthInsight = getBreadthInsight(snapshot)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Diperbarui {new Date(snapshot.computed_at).toLocaleString('id-ID')}
        </p>
      </div>

      <div className="rounded-xl border border-neutral-200 p-5">
        <p className="text-xs font-semibold uppercase text-neutral-500">Market Bias - IHSG</p>
        <div className="mt-2 flex items-baseline justify-between">
          <p className={`text-xl font-bold ${biasColor[snapshot.market_bias_label]}`}>
            {biasEmoji[snapshot.market_bias_label]} {snapshot.market_bias_label}
          </p>
          <div className="text-right">
            <p className="text-lg font-semibold text-neutral-900">
              {Number(snapshot.ihsg_price).toLocaleString('id-ID')}
            </p>
            <p className={snapshot.ihsg_change_percent >= 0 ? 'text-sm text-emerald-600' : 'text-sm text-red-600'}>
              {snapshot.ihsg_change_percent >= 0 ? '+' : ''}
              {Number(snapshot.ihsg_change_percent).toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div>
            <p className="text-xs text-neutral-500">Trend</p>
            <p className="font-medium text-neutral-900">{qualLabel(snapshot.trend_score, 'Bullish', 'Netral', 'Bearish')}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Momentum</p>
            <p className="font-medium text-neutral-900">{qualLabel(snapshot.momentum_score, 'Positive', 'Netral', 'Negative')}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Breadth</p>
            <p className="font-medium text-neutral-900">{qualLabel(snapshot.breadth_score, 'Strong', 'Netral', 'Weak')}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Volume</p>
            <p className="font-medium text-neutral-900">{qualLabel(snapshot.volume_score, 'Expanding', 'Netral', 'Shrinking')}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Risk</p>
            <p className="font-medium text-neutral-900">{qualLabel(snapshot.risk_score, 'Normal', 'Waspada', 'Tinggi')}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 p-5">
        <p className="text-xs font-semibold uppercase text-neutral-500">IHSG Market Score</p>
        <p className={`mt-1 text-3xl font-bold ${biasColor[snapshot.market_bias_label]}`}>
          {snapshot.market_bias_score}/100
        </p>
        <p className="text-sm text-neutral-500">{snapshot.market_bias_label}</p>
<p className="mt-2 text-xs text-neutral-400">
  Composite score berdasarkan Trend, Momentum, Breadth, Volume, dan Risk.
</p>
      </div>

      <div className="rounded-xl border border-neutral-200 p-5">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase text-neutral-500">Market Breadth - IDXStocks</p>
          <p className="text-sm font-semibold text-neutral-900">{Number(snapshot.breadth_score)}/100</p>
        </div>
        <p className="mt-1 text-sm font-semibold text-neutral-900">
          {breadthInsight.emoji} {breadthInsight.label}
        </p>
        <p className="mt-1 text-xs text-neutral-500">{breadthInsight.note}</p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-neutral-500">Above MA20</p>
            <p className="text-lg font-semibold text-neutral-900">{Number(snapshot.above_ma20_pct).toFixed(0)}%</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Above MA50</p>
            <p className="text-lg font-semibold text-neutral-900">{Number(snapshot.above_ma50_pct).toFixed(0)}%</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Advancing / Declining / Tetap</p>
            <p className="text-lg font-semibold text-neutral-900">
              {snapshot.advancing} / {snapshot.declining} / {snapshot.unchanged ?? 0}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">New High (90D)</p>
            <p className="text-lg font-semibold text-emerald-600">{snapshot.new_high_90d}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">New Low (90D)</p>
            <p className="text-lg font-semibold text-red-600">{snapshot.new_low_90d}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 p-5">
        <p className="text-xs font-semibold uppercase text-neutral-500">Top Opportunities</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {topOpportunities?.map((s) => (
            <Link key={s.ticker} href={`/stock/${s.ticker}`} className="block rounded-lg border border-neutral-200 p-3 transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <p className="font-semibold text-neutral-900">{s.ticker}</p>
              <p className="truncate text-xs text-neutral-500">{s.name}</p>
              <p className="mt-1 text-xs text-neutral-500">{s.setup}</p>
              <p className="text-lg font-bold text-neutral-900">{s.aiScore}/100</p>
            </Link>
          ))}
          {(!topOpportunities || topOpportunities.length === 0) && (
            <p className="text-sm text-neutral-500">Belum ada saham dengan skor menonjol hari ini.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 p-5">
        <p className="text-xs font-semibold uppercase text-neutral-500">Market Radar</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
          {radarMeta.map((r) => (
            <Link key={r.key} href={`/opportunities?type=${r.key}`} className="block rounded-lg bg-neutral-50 p-3 text-center transition hover:bg-neutral-100 focus:outline-none focus:ring-2focus:ring-emerald-500">
              <p className="text-lg">{r.icon}</p>
              <p className="text-xs text-neutral-500">{r.label}</p>
              <p className="text-lg font-bold text-neutral-900">{radar[r.key]?.count ?? 0}</p>
              <p className="mt-1 text-[11px] leading-tight text-neutral-400">{r.desc(radar[r.key]?.count ?? 0)}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
        <p className="text-xs font-semibold uppercase text-neutral-500">AI Market Brief</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-800">{brief}</p>
        <p className="mt-2 text-xs text-neutral-400">
          AI hanya menjelaskan hasil engine, bukan menentukan arah market.
        </p>
      </div>
    </div>
  )
}
