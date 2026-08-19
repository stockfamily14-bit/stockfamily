import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import TopOpportunitiesSection from '@/components/dashboard/TopOpportunities'

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
    note += " Namun saham turun (" + declining + ") jauh lebih banyak dibanding naik (" + advancing + ") hari ini - tekanan jual jangka pendek meningkat."
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
  NEUTRAL: 'text-amber-500',
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

// Helper untuk mengekstrak data radar fleksibel (Mendukung camelCase & snake_case)
function getRadarData(radar: any, topOpportunities: any[], key: string) {
  const possibleKeys: Record<string, string[]> = {
    breakoutWatch: ['breakoutWatch', 'breakout_watch', 'breakout', 'breakout_watchlist'],
    momentum: ['momentum', 'momentum_watch', 'bullish_momentum'],
    nearSupport: ['nearSupport', 'near_support', 'support', 'buy_on_weakness'],
    unusualVolume: ['unusualVolume', 'unusual_volume', 'volume_spike', 'volume'],
    distribution: ['distribution', 'distribution_watch', 'sell_pressure', 'breakdown'],
  }

  const keysToCheck = possibleKeys[key] || [key]
  let rawData: any = null

  if (radar && typeof radar === 'object') {
    for (const k of keysToCheck) {
      if (radar[k] !== undefined && radar[k] !== null) {
        rawData = radar[k]
        break
      }
    }
  }

  let count = 0
  let stocks: any[] = []

  if (rawData) {
    if (Array.isArray(rawData)) {
      stocks = rawData
      count = rawData.length
    } else if (typeof rawData === 'object') {
      stocks = rawData.stocks || rawData.items || rawData.tickers || rawData.data || []
      count = rawData.count ?? stocks.length
    } else if (typeof rawData === 'number') {
      count = rawData
    }
  }

  // Fallback: Jika array radar kosong, ekstrak kandidat dari topOpportunities
  if (stocks.length === 0 && topOpportunities && Array.isArray(topOpportunities)) {
    if (key === 'breakoutWatch') {
      stocks = topOpportunities.filter(s => s.setup?.toUpperCase().includes('BREAKOUT'))
    } else if (key === 'momentum') {
      stocks = topOpportunities.filter(s => s.setup?.toUpperCase().includes('MOMENTUM') || (s.aiScore && s.aiScore >= 85))
    } else if (key === 'nearSupport') {
      stocks = topOpportunities.filter(s => s.setup?.toUpperCase().includes('SUPPORT') || s.setup?.toUpperCase().includes('BOW'))
    } else if (key === 'unusualVolume') {
      stocks = topOpportunities.filter(s => s.setup?.toUpperCase().includes('VOLUME'))
    } else if (key === 'distribution') {
      stocks = topOpportunities.filter(s => s.setup?.toUpperCase().includes('DISTRIBUTION') || s.setup?.toUpperCase().includes('SELL'))
    }

    if (count === 0 && stocks.length > 0) {
      count = stocks.length
    }
  }

  return { count, stocks }
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
  const radar = snapshot.radar ?? {}
  const topOpportunities = (snapshot.top_opportunities ?? []) as { ticker: string; name: string; aiScore: number; setup: string }[]
  const breadthInsight = getBreadthInsight(snapshot)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Diperbarui {new Date(snapshot.computed_at).toLocaleString('id-ID')}
        </p>
      </div>

      {/* IHSG Market Bias */}
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

      {/* IHSG Market Score */}
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

      {/* Market Breadth */}
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

      {/* Top 5 Market Opportunities (Komponen Baru) */}
      <TopOpportunitiesSection />

      {/* Market Radar */}
      <div className="rounded-xl border border-neutral-200 p-5">
        <p className="text-xs font-semibold uppercase text-neutral-500">Market Radar</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
          {radarMeta.map((r) => {
            const data = getRadarData(radar, topOpportunities, r.key)
            const count = data.count
            const stocks = data.stocks
            const remainingCount = Math.max(count - 3, stocks.length - 3)

            return (
              <Link key={r.key} href={`/opportunities?type=${r.key}`} className="block rounded-lg bg-neutral-50 p-3 text-center transition hover:bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <p className="text-lg">{r.icon}</p>
                <p className="text-xs text-neutral-500">{r.label}</p>
                <p className="text-lg font-bold text-neutral-900">{count}</p>
                <p className="mt-1 text-[11px] leading-tight text-neutral-400">{r.desc(count)}</p>

                {stocks.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1 border-t border-neutral-200/60 pt-2">
                    {stocks.slice(0, 3).map((stock: any, idx: number) => {
                      const symbol = typeof stock === 'string' ? stock : (stock.ticker || stock.symbol || stock.code || 'TICKER')
                      return (
                        <span
                          key={idx}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            r.key === 'distribution'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {symbol}
                        </span>
                      )
                    })}
                    {remainingCount > 0 && (
                      <span className="text-[10px] font-semibold text-neutral-500">
                        +{remainingCount}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* AI Market Brief */}
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
