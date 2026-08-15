import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

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
  let emoji = '🟡'
  if (score >= 65) {
    label = 'Strong'
    emoji = '🟢'
  } else if (score < 45) {
    label = 'Weak'
    emoji = '🔴'
  }

  let note = `${Number(snapshot.above_ma20_pct).toFixed(0)}% saham masih berada di atas MA20.`
  if (ratio < 0.5 && score >= 45) {
    label += ' / Weakening'
    note += ` Namun saham turun (${declining}) jauh lebih banyak dibanding naik (${advancing}) hari ini — tekanan jual jangka pendek meningkat.`
  } else if (ratio > 1.5) {
    note += ` Saham naik (${advancing}) juga lebih banyak dibanding turun (${declining}), mendukung struktur breadth yang sehat.`
  } else {
    note += ` Saham naik (${advancing}) dan turun (${declining}) relatif seimbang hari ini.`
  }

  return { emoji, label, note }
}

const radarMeta = [
  { key: 'breakoutWatch', label: 'Breakout Watch', icon: '🚀', desc: (n: number) => `${n} saham mendekati/breakout resistance` },
  { key: 'momentum', label: 'Momentum', icon: '🔥', desc: (n: number) => `${n} saham menunjukkan momentum positif` },
  { key: 'nearSupport', label: 'Near Support', icon: '🎯', desc: (n: number) => `${n} saham berada dekat area support` },
  { key: 'unusualVolume', label: 'Unusual Volume', icon: '📊', desc: (n: number) => `${n} saham dengan volume tidak biasa` },
  { key: 'distribution', label: 'Distribution', icon: '⚠️', desc: (n: number) => `${n} saham menunjukkan tekanan jual` },
]

const biasColor: Record<string, string> = {
  'STRONG BULLISH': 'text-emerald-600',
  BULLISH: 'text-emerald-600',
  NEUTRAL: 'text-amber-600',
  BEARISH: 'text-red-600',
  'STRONG BEARISH': 'text-red-600',
}

const biasEmoji: Record<string, string> = {
  'STRONG BULLISH': '🟢',
  BULLISH: '🟢',
  NEUTRAL: '🟡',
  BEARISH: '🔴',
  'STRONG BEARISH': '🔴',
}

async function generateBrief(snapshot: any): Promise<string> {
  const fallback = `Market saat ini cenderung ${snapshot.market_bias_label.toLowerCase()} (skor ${snapshot.market_bias_score}/100). ${Number(snapshot.above_ma20_pct).toFixed(0)}% saham berada di atas MA20, dengan ${snapshot.advancing} saham naik vs ${snapshot.declining} saham turun. Fokus pada saham dengan setup jelas dan hindari mengejar saham yang sudah terlalu extended.`

  if (!process.env.ANTHROPIC_API_KEY) return fallback

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 200,
      system:
        'Kamu adalah AI Market Brief di StockFamily. Tugasmu HANYA menjelaskan data yang diberikan dalam 3-4 kalimat singkat berbahasa Indonesia, bukan menentukan sendiri arah market. Jangan mengarang angka di luar data yang diberikan.',
      messages: [
        {
          role: 'user',
          content: `Data market hari ini: Bias ${snapshot.market_bias_label} (skor ${snapshot.market_bias_score}/100), IHSG ${snapshot.ihsg_price} (${snapshot.ihsg_change_percent >= 0 ? '+' : ''}${Number(snapshot.ihsg_change_percent).toFixed(2)}%), ${Number(snapshot.above_ma20_pct).toFixed(0)}% saham di atas MA20, ${snapshot.advancing} saham naik vs ${snapshot.declining} saham turun vs ${snapshot.unchanged ?? 0} tetap. Radar: ${snapshot.radar.breakoutWatch} breakout watch, ${snapshot.radar.momentum} momentum, ${snapshot.radar.distribution} distribution. Jelaskan kondisi ini secara singkat.`,
        },
      ],
    })
    const textBlock = response.content.find((b) => b.type === 'text')
    return textBlock && 'text' in textBlock ? textBlock.text : fallback
  } catch {
    return fallback
  }
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

  const brief = await generateBrief(snapshot)
  const radar = snapshot.radar as Record<string, number>
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
        <p className="text-xs font-semibold uppercase text-neutral-500">Market Bias</p>
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
        <p className="text-xs font-semibold uppercase text-neutral-500">Market Bias Score</p>
        <p className={`mt-1 text-3xl font-bold ${biasColor[snapshot.market_bias_label]}`}>
          {snapshot.market_bias_score}/100
        </p>
        <p className="text-sm text-neutral-500">{snapshot.market_bias_label}</p>
      </div>

      <div className="rounded-xl border border-neutral-200 p-5">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase text-neutral-500">Market Breadth</p>
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
        <p className="text-xs font-semibold uppercase text-neutral-500">🔥 Top Opportunities</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {topOpportunities?.map((s) => (
            <div key={s.ticker} className="rounded-lg border border-neutral-200 p-3">
              <p className="font-semibold text-neutral-900">{s.ticker}</p>
              <p className="truncate text-xs text-neutral-500">{s.name}</p>
              <p className="mt-1 text-xs text-neutral-500">{s.setup}</p>
              <p className="text-lg font-bold text-neutral-900">{s.aiScore}/100</p>
            </div>
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
            <div key={r.key} className="rounded-lg bg-neutral-50 p-3 text-center">
              <p className="text-lg">{r.icon}</p>
              <p className="text-xs text-neutral-500">{r.label}</p>
              <p className="text-lg font-bold text-neutral-900">{radar[r.key] ?? 0}</p>
              <p className="mt-1 text-[11px] leading-tight text-neutral-400">{r.desc(radar[r.key] ?? 0)}</p>
            </div>
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