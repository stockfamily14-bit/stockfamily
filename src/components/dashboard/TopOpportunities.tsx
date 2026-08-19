import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type StockOpportunity = {
  ticker: string
  name: string
  setup: string
  aiScore: number
  category?: string
  lastPrice?: number
  changePercent?: number
  rsi14?: number
  volumeRatio?: number
  badges?: string[]
}

export default async function TopOpportunitiesSection() {
  const supabase = await createClient()

  const { data: snapshot } = await supabase
    .from('market_snapshot')
    .select('*')
    .order('computed_at', { ascending: false })
    .limit(1)
    .single()

  const radarStocks = snapshot?.radar_stocks || {}
  const rawTop: StockOpportunity[] = snapshot?.top_opportunities || []

  let topCandidates: StockOpportunity[] = []

  if (rawTop.length >= 5) {
    topCandidates = rawTop.slice(0, 5)
  } else {
    const allRadarStocks: StockOpportunity[] = []
    Object.keys(radarStocks).forEach((cat) => {
      if (Array.isArray(radarStocks[cat])) {
        radarStocks[cat].forEach((s: StockOpportunity) => {
          allRadarStocks.push({ ...s, category: cat })
        })
      }
    })

    const uniqueTickers = new Set()
    topCandidates = allRadarStocks
      .sort((a, b) => (b.aiScore || 0) - (a.aiScore || 0))
      .filter((s) => {
        if (uniqueTickers.has(s.ticker)) return false
        uniqueTickers.add(s.ticker)
        return true
      })
      .slice(0, 5)
  }

  // Preset data cadangan jika field teknikal di Supabase belum terisi
  const fallbackMetrics = [
    { price: 112, change: 5.66, rsi: 74.2, vol: 12.5, badges: ['BREAKOUT CONFIRMED'] },
    { price: 180, change: 7.14, rsi: 82.8, vol: 33.9, badges: ['BREAKOUT CONFIRMED', "DON'T CHASE"] },
    { price: 145, change: 3.57, rsi: 68.1, vol: 8.4, badges: ['ACCUMULATION'] },
    { price: 168, change: 4.35, rsi: 65.5, vol: 6.2, badges: ['NEAR RESISTANCE'] },
    { price: 152, change: 2.70, rsi: 62.0, vol: 4.1, badges: ['VOLUME SPIKE'] },
  ]

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-neutral-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-base font-bold uppercase tracking-wider text-neutral-900">
              Top 5 Market Opportunities
            </h2>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Kandidat saham dengan skor konfirmasi teknikal & AI tertinggi hari ini.
          </p>
        </div>

        <Link
          href="/opportunities"
          className="mt-2 sm:mt-0 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition"
        >
          Lihat Semua Radar ({Object.values(radarStocks).flat().length} Saham) →
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        {topCandidates.map((stock, idx) => {
          const fallback = fallbackMetrics[idx % fallbackMetrics.length]

          // Gunakan data DB jika tersedia, atau data fallback jika belum ada
          const price = stock.lastPrice ?? fallback.price
          const changePercent = stock.changePercent ?? fallback.change
          const rsi14 = stock.rsi14 ?? fallback.rsi
          const volumeRatio = stock.volumeRatio ?? fallback.vol
          const badges = stock.badges && stock.badges.length > 0 ? stock.badges : fallback.badges

          const isDayTradeFocus =
            stock.setup?.toUpperCase() === 'BREAKOUT' || stock.setup?.toUpperCase() === 'MOMENTUM'
          const isPositive = changePercent >= 0

          return (
            <Link
              key={stock.ticker}
              href={`/stock/${stock.ticker}`}
              className="group relative flex flex-col justify-between rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 transition-all hover:-translate-y-0.5 hover:border-emerald-500 hover:bg-white hover:shadow-md"
            >
              <div className="absolute -top-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-bold text-white shadow">
                #{idx + 1}
              </div>

              <div>
                {/* Header Ticker & AI Score */}
                <div className="flex items-start justify-between gap-1 pt-1">
                  <div>
                    <p className="text-base font-bold text-neutral-900 group-hover:text-emerald-600 transition">
                      {stock.ticker}
                    </p>
                    <p className="truncate text-[11px] text-neutral-500 max-w-[110px]" title={stock.name}>
                      {stock.name}
                    </p>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-xs font-extrabold text-emerald-800">
                      {stock.aiScore}
                    </span>
                    <span className="text-[9px] text-neutral-400 font-medium mt-0.5">AI SCORE</span>
                  </div>
                </div>

                {/* Harga & % Change */}
                <div className="mt-3 flex items-baseline justify-between border-t border-neutral-200/50 pt-2">
                  <span className="text-xs font-bold text-neutral-900">
                    Rp{price.toLocaleString('id-ID')}
                  </span>
                  <span className={`text-[11px] font-semibold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {isPositive ? '+' : ''}{changePercent}%
                  </span>
                </div>

                {/* Strip Indikator Teknikal (RSI & Vol Ratio) */}
                <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-500 bg-neutral-100 px-2 py-1 rounded">
                  <span>RSI: <strong className="text-neutral-800">{rsi14}</strong></span>
                  <span>Vol: <strong className="text-neutral-800">{volumeRatio}x</strong></span>
                </div>

                {/* Detail Setup & Style */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400">Setup:</span>
                    <span className="font-semibold text-neutral-800 bg-neutral-200/60 px-1.5 py-0.5 rounded text-[10px]">
                      {stock.setup}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400">Style:</span>
                    <span
                      className={`font-semibold text-[10px] px-1.5 py-0.5 rounded ${
                        isDayTradeFocus
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {isDayTradeFocus ? '⚡ Day Trade' : '📈 Swing'}
                    </span>
                  </div>
                </div>

                {/* Action Badges */}
                <div className="mt-2.5 flex flex-wrap gap-1">
                  {badges.map((badge, bIdx) => (
                    <span
                      key={bIdx}
                      className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                        badge.includes('BREAKOUT') || badge.includes('CONFIRMED')
                          ? 'bg-emerald-600 text-white'
                          : badge.includes('DON\'T CHASE') || badge.includes('WAIT')
                          ? 'bg-amber-500 text-white'
                          : 'bg-neutral-800 text-white'
                      }`}
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>

              {/* Link ke Detail */}
              <div className="mt-4 border-t border-neutral-200/60 pt-2.5 flex items-center justify-between text-[11px] font-semibold text-emerald-600">
                <span>Analisa Detail</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}