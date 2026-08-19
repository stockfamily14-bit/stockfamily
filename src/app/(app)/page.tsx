import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import RefreshButton from './RefreshButton'
import { analyzeStock, type Candle } from '@/lib/analysis/technical'

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

function getFreshness(computedAt: string | null | undefined) {
  if (!computedAt) return { status: 'ERROR', label: 'Data belum tersedia', dot: 'bg-red-500', color: 'text-red-600' }

  const ageMin = (Date.now() - new Date(computedAt).getTime()) / 60000

  if (ageMin <= 20) return { status: 'LIVE', label: `LIVE • ${Math.round(ageMin)} menit lalu`, dot: 'bg-emerald-500', color: 'text-emerald-600' }
  if (ageMin <= 90) return { status: 'RECENT', label: `RECENT • ${Math.round(ageMin)} menit lalu`, dot: 'bg-amber-500', color: 'text-amber-600' }
  return { status: 'STALE', label: `STALE • ${Math.round(ageMin)} menit lalu`, dot: 'bg-red-500', color: 'text-red-600' }
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

const actionColor: Record<string, string> = {
  BUY_ON_CONFIRMATION: 'bg-emerald-600',
  WAIT_PULLBACK: 'bg-amber-600',
  AVOID: 'bg-red-600',
  WAIT_CONFIRMATION: 'bg-neutral-500',
}

const actionLabel: Record<string, string> = {
  BUY_ON_CONFIRMATION: 'BUY ON CONFIRMATION',
  WAIT_PULLBACK: "DON'T CHASE",
  AVOID: 'AVOID',
  WAIT_CONFIRMATION: 'WAIT CONFIRMATION',
}

async function getCandles(supabase: any, ticker: string): Promise<Candle[]> {
  const { data } = await supabase.from('stock_ohlcv').select('*').eq('ticker', ticker).order('date', { ascending: true })
  return (data ?? []).map((r: any) => ({
    date: r.date,
    open: Number(r.open),
    high: Number(r.high),
    low: Number(r.low),
    close: Number(r.close),
    volume: Number(r.volume),
  }))
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
        <p className="mt-2 text-sm text-neutral-500">Data market belum tersedia.</p>
      </div>
    )
  }

  const brief = snapshot.ai_brief ?? null
  const radar = snapshot.radar as Record<string, number>
  const radarStocks = (snapshot.radar_stocks as Record<string, { ticker: string; name: string; aiScore: number; setup: string }[]>) ?? {}
  const topOpportunities = (snapshot.top_opportunities as { ticker: string; name: string; aiScore: number; setup: string }[]) ?? []
  const breadthInsight = getBreadthInsight(snapshot)
  const freshness = getFreshness(snapshot.computed_at)

  // Ambil trade plan lengkap untuk 5 Top Opportunities (murah, cuma 5 saham).
  const enrichedOpportunities = await Promise.all(
    topOpportunities.map(async (s) => {
      const candles = await getCandles(supabase, s.ticker)
      if (candles.length < 20) return { ...s, analysis: null }
      try {
        return { ...s, analysis: analyzeStock(candles) }
      } catch {
        return { ...s, analysis: null }
      }
    })
  )

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-neutral-500">
            <span className={`h-2 w-2 rounded-full ${freshness.dot}`} />
            <span className={freshness.color}>{freshness.label}</span>
            <span className="text-neutral-300">•</span>
            <span>Yahoo Finance (delay ~15-20 menit)</span>
          </p>
        </div>
        <RefreshButton />
      </div>

      <div className="rounded-xl border border-neutral-200 p-5">
        <p className="text-xs font-semibold uppercase text-neutral-500">Market Bias — IHSG</p>
        <div className="mt-2 flex items-baseline justify-between">
          <p className={`text-xl font-bold ${biasColor[snapshot.market_bias_label]}`}>
            {biasEmoji[snapshot.market_bias_label]} {snapshot.market_bias_label}
          </p>
          <div className="text-right">
            <p className="text-lg font-semibold text-neutral-900">{Number(snapshot.ihsg_price).toLocaleString('id-ID')}</p>
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
        <p className={`mt-1 text-3xl font-bold ${biasColor[snapshot.market_bias_label]}`}>{snapshot.market_bias_score}/100</p>
        <p className="text-sm text-neutral-500">{snapshot.market_bias_label}</p>
        <p className="mt-2 text-xs text-neutral-400">Composite score berdasarkan Trend, Momentum, Breadth, Volume, dan Risk.</p>
      </div>

      <div className="rounded-xl border border-neutral-200 p-5">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase text-neutral-500">Market Breadth — IDX Stocks</p>
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
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {enrichedOpportunities.map((s) => {
            const a = s.analysis
            const tp = a?.tradePlan
            return (
              <Link
                key={s.ticker}
                href={`/stock/${s.ticker}`}
                className="block rounded-xl border border-neutral-200 p-4 transition hover:border-neutral-400 hover:bg-neutral-50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-neutral-900">{s.ticker}</p>
                    <p className="truncate text-xs text-neutral-500">{s.name}</p>
                  </div>
                  <p className="text-lg font-bold text-neutral-900">{s.aiScore}/100</p>
                </div>

                {a && (
                  <p className="mt-1 text-sm font-semibold text-neutral-900">
                    Rp{Math.round(a.lastPrice).toLocaleString('id-ID')}
                    <span className={a.changePercent != null && a.changePercent >= 0 ? 'ml-2 text-xs text-emerald-600' : 'ml-2 text-xs text-red-600'}>
                      {a.changePercent != null ? `${a.changePercent >= 0 ? '+' : ''}${a.changePercent.toFixed(2)}%` : ''}
                    </span>
                  </p>
                )}

                {a && (
                  <p className="mt-0.5 text-[11px] text-neutral-400">
                    RSI {a.rsi != null ? a.rsi.toFixed(1) : '-'} • Vol {a.volumeRatio != null ? `${a.volumeRatio.toFixed(1)}x` : '-'}
                  </p>
                )}

                {tp && tp.status === 'VALID' && (
                  <div className="mt-3 rounded-lg bg-neutral-50 p-3">
                    <div className="flex items-center justify-between">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold text-white ${actionColor[tp.finalAction]}`}>
                        {actionLabel[tp.finalAction]}
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        R:R {tp.riskReward != null ? `1:${tp.riskReward.toFixed(1)}` : '-'}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <p className="text-neutral-400">Entry</p>
                        <p className="font-semibold text-neutral-800">Rp{tp.entry?.toLocaleString('id-ID')}</p>
                      </div>
                      <div>
                        <p className="text-neutral-400">Stop Loss</p>
                        <p className="font-semibold text-red-600">Rp{tp.invalidation?.toLocaleString('id-ID')}</p>
                      </div>
                      <div>
                        <p className="text-neutral-400">Target</p>
                        <p className="font-semibold text-emerald-600">Rp{tp.target1?.toLocaleString('id-ID')}</p>
                      </div>
                    </div>
                  </div>
                )}

                {tp && tp.status !== 'VALID' && (
                  <div className="mt-3">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold text-white ${actionColor[tp.finalAction] ?? 'bg-neutral-500'}`}>
                      {actionLabel[tp.finalAction] ?? tp.status}
                    </span>
                  </div>
                )}

                <p className="mt-2 text-[11px] uppercase text-neutral-400">{s.setup}</p>
              </Link>
            )
          })}
          {enrichedOpportunities.length === 0 && <p className="text-sm text-neutral-500">Belum ada saham dengan skor menonjol hari ini.</p>}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 p-5">
        <p className="text-xs font-semibold uppercase text-neutral-500">Market Radar</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
          {radarMeta.map((r) => {
            const tickers = (radarStocks[r.key] ?? []).slice(0, 4).map((s) => s.ticker)
            return (
              <Link
                key={r.key}
                href={`/opportunities?type=${r.key}`}
                className="block rounded-lg bg-neutral-50 p-3 text-center transition hover:bg-neutral-100"
              >
                <p className="text-lg">{r.icon}</p>
                <p className="text-xs text-neutral-500">{r.label}</p>
                <p className="text-lg font-bold text-neutral-900">{radar[r.key] ?? 0}</p>
                <p className="mt-1 text-[11px] leading-tight text-neutral-400">
                  {tickers.length > 0 ? tickers.join(', ') : r.desc(radar[r.key] ?? 0)}
                </p>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
        <p className="text-xs font-semibold uppercase text-neutral-500">AI Market Brief</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-800">{brief ?? 'Belum ada AI brief untuk snapshot ini.'}</p>
        <p className="mt-2 text-xs text-neutral-400">AI hanya menjelaskan hasil engine, bukan menentukan arah market.</p>
      </div>
    </div>
  )
}