'use client'
import { use, useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { calcSFSCRETHistory } from '@/lib/analysis/scret'
import { analyzeStock, type Candle } from '@/lib/analysis/technical'
import SFAlphaGauge from '@/components/stock/SFAlphaGauge'
import SFAlphaChart from '@/components/stock/SFAlphaChart'
import SmartMoneyPhaseTable from '@/components/stock/SmartMoneyPhaseTable'
import WatchlistButton from './WatchlistButton'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)


const stateLabel: Record<string, string> = {
  ACCUMULATION: 'Accumulation',
  EARLY_TREND: 'Early Trend',
  CONFIRMED_TREND: 'Confirmed Trend',
  EXPANSION: 'Expansion',
}

const stateTone: Record<string, string> = {
  ACCUMULATION: 'text-amber-300 border-amber-400/25 bg-amber-400/10',
  EARLY_TREND: 'text-sky-300 border-sky-400/25 bg-sky-400/10',
  CONFIRMED_TREND: 'text-emerald-300 border-emerald-400/25 bg-emerald-400/10',
  EXPANSION: 'text-violet-300 border-violet-400/25 bg-violet-400/10',
}

function stateBarTone(state: string) {
  if (state === 'ACCUMULATION') return 'bg-amber-400'
  if (state === 'EARLY_TREND') return 'bg-sky-400'
  if (state === 'CONFIRMED_TREND') return 'bg-emerald-400'
  if (state === 'EXPANSION') return 'bg-violet-400'
  return 'bg-slate-700'
}

function compactNumber(value: number) {
  const n = Math.abs(value)
  if (n >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}T`
  if (n >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString('id-ID')
}

export default function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = use(params)
  const ticker = (rawTicker || 'NZIA').toUpperCase()

  const [loading, setLoading] = useState(true)
  const [scretHistory, setScretHistory] = useState<any[]>([])
  const [ohlcv, setOhlcv] = useState<any[]>([])
  const [techCandles, setTechCandles] = useState<any[]>([])
  const [latestPrice, setLatestPrice] = useState<number | null>(null)
  const [latestVolume, setLatestVolume] = useState<number | null>(null)
  const [latestRecordedAt, setLatestRecordedAt] = useState<string>('')
  const [lastUpdated, setLastUpdated] = useState<string>('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      setLastUpdated(new Date().toLocaleTimeString('id-ID'))

      // latest_prices is the source of truth for the latest market quote.
      try {
        const { data: quote } = await supabase
          .from('latest_prices')
          .select('price, volume, recorded_at')
          .eq('ticker', ticker)
          .maybeSingle()

        if (quote) {
          setLatestPrice(Number(quote.price ?? 0))
          setLatestVolume(Number(quote.volume ?? 0))
          setLatestRecordedAt(quote.recorded_at ?? '')
        } else {
          setLatestPrice(null)
          setLatestVolume(null)
          setLatestRecordedAt('')
        }
      } catch {
        setLatestPrice(null)
        setLatestVolume(null)
        setLatestRecordedAt('')
      }

      try {
        const { data, error } = await supabase
          .from('daily_market_summary')
          .select('*')
          .eq('stock_code', ticker)
          .order('trade_date', { ascending: true })
          .limit(200)

        if (error) throw error
        if (!data || data.length === 0) {
          setOhlcv([])
          setScretHistory([])
          setLoading(false)
          return
        }

        const mapped = data.map((r: any) => {
          const close = Number(r.close ?? 0)
          return {
            trade_date: r.trade_date,
            stock_code: r.stock_code,
            date: r.trade_date,
            open: Number(r.open ?? close),
            high: Number(r.high ?? close),
            low: Number(r.low ?? close),
            close,
            close_price: close,
            volume: Number(r.volume ?? 0),
            value: Number(r.value ?? 0),
            frequency: Number(r.frequency ?? 0),
            foreign_buy: Number(r.foreign_buy ?? 0),
            foreign_sell: Number(r.foreign_sell ?? 0),
            bid_volume: Number(r.bid_volume ?? 0),
            offer_volume: Number(r.offer_volume ?? 0),
          }
        }).filter((r: any) => r.close > 0)

        setScretHistory(calcSFSCRETHistory(mapped as any))
        setOhlcv(mapped)
      } catch {}
      setLoading(false)
    }
    load()
  }, [ticker])

  useEffect(() => {
    async function loadTechCandles() {
      try {
        const res = await fetch(`/api/stock-ohlcv?ticker=${ticker}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error ?? 'Failed to fetch')
        setTechCandles(json.candles ?? [])
      } catch {
        setTechCandles([])
      }
    }
    loadTechCandles()
  }, [ticker])

  const latest = scretHistory.length ? scretHistory[scretHistory.length - 1] : null
  const lastEOD = ohlcv.length ? ohlcv[ohlcv.length - 1] : null
  // Last Price = latest market quote; Previous Price = latest completed EOD close.
  const displayPrice = latestPrice ?? Number(lastEOD?.close ?? 0)
  const displayPrev = Number(lastEOD?.close ?? 0)
  const displayChange = displayPrice - displayPrev
  const displayChangePercent =
    displayPrev > 0 ? (displayChange / displayPrev) * 100 : 0

  const tech = useMemo(() => {
    if (ohlcv.length < 20) return null
    try {
      const candles: Candle[] = ohlcv.map((o: any) => ({
        date: o.date, open: o.open, high: o.high, low: o.low, close: o.close, volume: o.volume,
      }))
      const analysis = analyzeStock(candles)
      return {
        ma20: analysis.ma20,
        ma50: analysis.ma50,
        volRatio: analysis.volumeRatio,
        momentum5d: analysis.momentum5d,
        rsi: analysis.rsi,
        lastClose: analysis.lastPrice,
        support: analysis.support,
        resistance: analysis.resistance,
        setup: analysis.setup,
        tradeAction: analysis.tradeAction,
        label: analysis.label,
        riskLevel: analysis.riskLevel,
        marketStructure: analysis.marketStructure,
        aiScore: analysis.aiScore,
        tradePlan: analysis.tradePlan,
      }
    } catch { return null }
  }, [ohlcv])

  if (loading) return <div className="min-h-screen bg-[#071018] p-10 text-white">Loading {ticker}...</div>
  if (!lastEOD) return <div className="min-h-screen bg-[#071018] p-10 text-white">Data {ticker} kosong - cek daily_market_summary</div>

  const rangePos = tech?.ma20 ? ((displayPrice - tech.ma20) / tech.ma20) * 100 : null
  const volume = Number(latestVolume ?? lastEOD.volume ?? 0)
  const value = Number(lastEOD.value || 0)
  const frequency = Number(lastEOD.frequency || 0)
  const foreignNet = Number(lastEOD.foreign_buy || 0) - Number(lastEOD.foreign_sell || 0)
  const chartData = techCandles
  const bias = latest?.direction === 'UP' ? 'BULLISH' : latest?.direction === 'DOWN' ? 'BEARISH' : 'NEUTRAL'
  const biasTone = bias === 'BULLISH' ? 'text-emerald-400' : bias === 'BEARISH' ? 'text-red-400' : 'text-amber-300'
  const insightTone = (type: string) => type === 'Risk' ? 'border-amber-400/20 bg-amber-400/[.04] text-amber-300' : type === 'Flow' ? 'border-sky-400/20 bg-sky-400/[.04] text-sky-300' : 'border-emerald-400/20 bg-emerald-400/[.04] text-emerald-300'

  return (
    <div className="min-h-screen bg-[#071018] text-white">
      <div className="mx-auto max-w-[1600px] px-4 py-5 md:px-6 md:py-6 xl:px-8">
        {/* STOCK HEADER */}
        <section className="mb-4 overflow-hidden rounded-2xl border border-cyan-500/10 bg-[#0b1721] shadow-[0_18px_55px_rgba(0,0,0,.18)]">
          <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-sm font-black text-emerald-300">{ticker.slice(0, 3)}</div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h1 className="text-3xl font-black tracking-tight md:text-4xl">{ticker}</h1>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[9px] font-bold text-emerald-300"><span className={`h-1.5 w-1.5 rounded-full bg-emerald-400 ${latestPrice != null ? 'animate-pulse' : ''}`} /> {latestPrice != null ? 'LIVE' : 'EOD'}</span>
                    {latest && <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold ${stateTone[latest.state] || 'border-white/10 bg-white/5 text-slate-400'}`}>{stateLabel[latest.state] || latest.state}</span>}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{ticker}.JK <span className="mx-1.5"></span> updated {latestRecordedAt ? new Date(latestRecordedAt).toLocaleTimeString('id-ID') : lastUpdated} <span className="mx-1.5"></span> Latest market quote</div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-5 lg:justify-end">
              <div className="text-right">
                <div className="text-3xl font-black tracking-tight md:text-4xl">Rp{displayPrice.toLocaleString('id-ID')}</div>
                <div className={`mt-1 text-sm font-bold ${displayChangePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {displayChangePercent >= 0 ? '+' : ''}{displayChangePercent.toFixed(2)}% {displayChange >= 0 ? '' : ''} <span className="text-[10px] font-medium text-slate-500">vs prev Rp{displayPrev.toLocaleString('id-ID')}</span>
                </div>
              </div>
              <div className="hidden h-12 w-px bg-white/5 sm:block" />
              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-2 text-[9px] font-bold">
                  <span className="rounded-lg border border-white/10 bg-white/[.03] px-3 py-1.5 text-slate-400">INDONESIA</span>
                  <span className="rounded-lg border border-cyan-400/15 bg-cyan-400/[.04] px-3 py-1.5 text-cyan-300">{ticker}.JK</span>
                </div>
                <WatchlistButton ticker={ticker} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-white/5 sm:grid-cols-5">
            {[
              ['Volume', compactNumber(volume), ''],
              ['Value', compactNumber(value), ''],
              ['Frequency', compactNumber(frequency), ''],
              ['Foreign Net', compactNumber(foreignNet), foreignNet > 0 ? 'text-emerald-400' : foreignNet < 0 ? 'text-red-400' : 'text-slate-400'],
              ['SCRET Score', latest ? `${latest.score}/100` : '', latest?.score >= 75 ? 'text-emerald-400' : latest?.score >= 45 ? 'text-amber-300' : 'text-red-400'],
            ].map(([label, valueText, tone], i) => (
              <div key={label} className={`border-white/5 px-4 py-3 ${i > 0 ? 'border-l' : ''}`}>
                <div className="text-[9px] font-bold uppercase tracking-[.16em] text-slate-600">{label}</div>
                <div className={`mt-1 text-sm font-bold ${tone || 'text-slate-200'}`}>{valueText}</div>
              </div>
            ))}
          </div>
        </section>

        {/* MAIN INTELLIGENCE LAYOUT */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_370px]">
          <main className="min-w-0 space-y-4">
            <SFAlphaChart history={scretHistory} chartData={chartData} />

            {/* DIPINDAHKAN KE SINI: SMART MONEY PHASE TABLE */}
            <SmartMoneyPhaseTable ohlcv={ohlcv} />

            {latest && (
              <section className="overflow-hidden rounded-2xl border border-cyan-500/10 bg-[#0b1721]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">SF SCRET</div>
                    <div className="mt-0.5 text-xs font-semibold text-slate-300">State &amp; Regime progression</div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[.03] px-2.5 py-1 text-[9px] font-bold text-slate-400">{latest.score}/100</div>
                </div>
                <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-4">
                  {['ACCUMULATION', 'EARLY_TREND', 'CONFIRMED_TREND', 'EXPANSION'].map((state, i) => {
                    const active = latest.state === state
                    return (
                      <div key={state} className={`relative rounded-xl border px-3 py-3 ${active ? stateTone[state] : 'border-white/5 bg-white/[.015]'}`}>
                        <div className={`text-[9px] font-black uppercase tracking-wider ${active ? '' : 'text-slate-600'}`}>{stateLabel[state]}</div>
                        <div className={`mt-2 h-1.5 rounded-full ${active ? stateBarTone(state) : i < ['ACCUMULATION','EARLY_TREND','CONFIRMED_TREND','EXPANSION'].indexOf(latest.state) ? 'bg-slate-600' : 'bg-slate-800'}`} />
                        {active && <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,.8)]" />}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {latest && (
              <section className="rounded-2xl border border-cyan-500/10 bg-[#0b1721] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Key Insights</div>
                    <div className="mt-0.5 text-xs text-slate-500">Tiga sinyal utama dari layer SCRET</div>
                  </div>
                  <span className="text-lg text-amber-300"></span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  {latest.insights.slice(0, 3).map((x: any, i: number) => (
                    <div key={i} className={`rounded-xl border p-3 ${insightTone(x.type)}`}>
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider"><span className="text-base">{x.type === 'Risk' ? '!' : x.type === 'Flow' ? '' : ''}</span>{x.type}</div>
                      <div className="mt-2 text-[11px] leading-relaxed text-slate-300">{x.text}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="grid gap-3 rounded-2xl border border-cyan-500/10 bg-[#0b1721] p-4 md:grid-cols-3">
              <div className="rounded-xl bg-white/[.02] p-3">
                <div className="text-[9px] font-bold uppercase tracking-[.16em] text-slate-600">Market Bias</div>
                <div className={`mt-1 text-lg font-black ${biasTone}`}>{bias}</div>
                <div className="text-[10px] text-slate-500">based on SCRET composite direction</div>
              </div>
              <div className="rounded-xl bg-white/[.02] p-3">
                <div className="text-[9px] font-bold uppercase tracking-[.16em] text-slate-600">SCRET Signal</div>
                <div className="mt-1 text-sm font-bold text-slate-200">{latest?.events?.[0] || 'Monitoring'}</div>
                <div className="text-[10px] text-slate-500">Composite intelligence layer</div>
              </div>
              <div className="rounded-xl bg-white/[.02] p-3">
                <div className="text-[9px] font-bold uppercase tracking-[.16em] text-slate-600">Range Position</div>
                <div className="mt-1 text-lg font-black text-slate-200">{rangePos != null ? `${rangePos >= 0 ? '+' : ''}${rangePos.toFixed(2)}%` : ''}</div>
                <div className="text-[10px] text-slate-500">vs MA20</div>
              </div>
            </section>
          </main>

          <aside className="min-w-0 space-y-4">
            {latest && <SFAlphaGauge latest={latest} />}

            {latest && (
              <section className="rounded-2xl border border-cyan-500/10 bg-[#0b1721] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Key Insights</div>
                    <div className="mt-0.5 text-xs text-slate-500">Quick read</div>
                  </div>
                  <span className="text-amber-300"></span>
                </div>
                <div className="space-y-3">
                  {latest.insights.slice(0, 3).map((x: any, i: number) => (
                    <div key={i} className="flex gap-3 border-b border-white/5 pb-3 last:border-0 last:pb-0">
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${x.type === 'Risk' ? 'bg-amber-400/10 text-amber-300' : 'bg-emerald-400/10 text-emerald-300'}`}>{x.type === 'Risk' ? '!' : ''}</span>
                      <div><div className="text-[10px] font-black uppercase tracking-wider text-slate-300">{x.type}</div><div className="mt-1 text-[10px] leading-relaxed text-slate-500">{x.text}</div></div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* TRADE PLAN */}
            <section className="rounded-2xl border border-cyan-500/10 bg-[#0b1721] p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Trade Plan</div>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[9px] font-bold text-emerald-300">SCREENER</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                <div><div className="text-[9px] text-slate-600">SETUP</div><div className="mt-1 font-semibold text-slate-200">{latest?.state === 'EXPANSION' || latest?.state === 'CONFIRMED_TREND' ? 'Momentum Continuation' : 'Reversal Watch'}</div></div>
                <div><div className="text-[9px] text-slate-600">ACTION</div><div className={`mt-1 inline-block rounded-full border px-2 py-1 text-[9px] font-bold ${tech?.tradePlan?.finalAction ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-white/10 bg-white/5 text-slate-400'}`}>{tech?.tradePlan?.finalAction ? tech.tradePlan.finalAction.replaceAll('_', ' ') : 'NO SETUP'}</div></div>
                <div><div className="text-[9px] text-slate-600">ENTRY</div><div className="mt-1 font-bold text-slate-100">{tech?.tradePlan?.entry != null ? `Rp${Math.round(tech.tradePlan.entry).toLocaleString()}` : '-'}</div></div>
                <div><div className="text-[9px] text-slate-600">STOP</div><div className="mt-1 font-bold text-red-300">{tech?.tradePlan?.invalidation != null ? `Rp${Math.round(tech.tradePlan.invalidation).toLocaleString()}` : '-'}</div></div>
                <div><div className="text-[9px] text-slate-600">TARGET 1 / 2</div><div className="mt-1 font-bold text-emerald-300">{tech?.tradePlan?.target1 != null ? `Rp${Math.round(tech.tradePlan.target1).toLocaleString()}` : '-'} / {tech?.tradePlan?.target2 != null ? `Rp${Math.round(tech.tradePlan.target2).toLocaleString()}` : '-'}</div><div className="mt-0.5 text-[9px] text-slate-600">{tech?.tradePlan?.riskReward != null ? `RR: ${tech.tradePlan.riskReward.toFixed(1)}` : ''}</div></div>
                <div><div className="text-[9px] text-slate-600">SUP / RES</div><div className="mt-1 font-bold text-slate-200">{tech?.support != null ? `Rp${Math.round(tech.support).toLocaleString()}` : '-'} / {tech?.resistance != null ? `Rp${Math.round(tech.resistance).toLocaleString()}` : '-'}</div></div>
              </div>
              <div className="mt-4 rounded-xl border border-white/5 bg-white/[.02] p-3 text-[10px] leading-relaxed text-slate-400">
                {latest && latest.score >= 90 ? 'Power Buy: akumulasi kuat. Entry di pullback.' : latest && latest.score >= 75 ? 'Bullish continuation, tunggu breakout.' : 'Momentum lemah, tunggu konfirmasi. SF SCRET ' + (latest?.score ?? '-') + ' ' + (latest?.regime ?? '')}
              </div>
            </section>

            <section className="rounded-2xl border border-cyan-500/10 bg-[#0b1721] p-4">
              <div className="mb-3 flex items-center justify-between"><div className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">Technical Analysis</div><span className="text-[9px] text-slate-600">LIVE</span></div>
              {tech ? (
                <div className="space-y-2.5 text-[10px]">
                  <div className="flex justify-between"><span className="text-slate-600">MA20 / MA50</span><span className="font-semibold text-slate-200">{tech.ma20 != null ? `Rp${tech.ma20.toFixed(0)}` : '-'} / {tech.ma50 != null ? `Rp${tech.ma50.toFixed(0)}` : '-'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">RSI14</span><span className="font-semibold text-slate-200">{tech.rsi != null ? tech.rsi.toFixed(1) : '-'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Volume Ratio</span><span className="font-semibold text-slate-200">{tech.volRatio != null ? `${tech.volRatio.toFixed(2)}x` : '-'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Momentum 5d</span><span className={tech.momentum5d != null && tech.momentum5d >= 0 ? 'font-semibold text-emerald-400' : 'font-semibold text-red-400'}>{tech.momentum5d != null ? `${tech.momentum5d >= 0 ? '+' : ''}${tech.momentum5d.toFixed(2)}%` : '-'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Market Structure</span><span className={tech.ma20 != null && displayPrice > tech.ma20 ? 'font-semibold text-emerald-400' : 'font-semibold text-red-400'}>{tech.ma20 != null ? (displayPrice > tech.ma20 ? 'BULLISH' : 'BEARISH') : '-'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Source</span><span className="text-slate-500">Yahoo {ticker}.JK</span></div>
                </div>
              ) : <div className="text-[10px] text-slate-600">Loading technical data...</div>}
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}
