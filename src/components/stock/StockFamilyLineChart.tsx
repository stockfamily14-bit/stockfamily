'use client'

import { useMemo } from 'react'

type Candle = {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

type V3Signal = {
  trade_date: string
  score: number
  tier: 'GOLD' | 'GREEN' | 'YELLOW' | 'ORANGE'
  closePos: number
  foreignRatio: number
  bidOfferImb: number
  rangePct: number
  isValidEntry: boolean
  isTP: boolean
  netForeign: number
}

type Merged = Candle & { v3?: V3Signal }

function calcClosePosFromCandle(c: Candle) {
  if (c.high <= c.low) return 0.5
  return Math.max(0, Math.min(1, (c.close - c.low) / (c.high - c.low)))
}

export default function StockFamilyLineChart({
  candles,
  v3History,
}: {
  candles: Candle[]
  v3History: V3Signal[]
}) {
  const hasSummary = v3History.length > 0

  const data = useMemo(() => {
    const map = new Map<string, V3Signal>()
    v3History.forEach(v => {
      const key1 = v.trade_date
      const key2 = `${key1.slice(0, 4)}-${key1.slice(4, 6)}-${key1.slice(6, 8)}`
      map.set(key1, v)
      map.set(key2, v)
    })
    return candles.slice(-22).map(c => {
      const v = map.get(c.date) || map.get(c.date.replaceAll('-', ''))
      return { ...c, v3: v, closePos: v?.closePos ?? calcClosePosFromCandle(c) } as Merged & { closePos: number }
    })
  }, [candles, v3History])

  if (data.length < 5) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#0d0f10] p-6 text-sm text-neutral-500">
        Belum cukup data (butuh min 5 hari di stock_ohlcv).
      </div>
    )
  }

  const minClose = Math.min(...data.map(d => d.close))
  const maxClose = Math.max(...data.map(d => d.close))
  const padding = (maxClose - minClose) * 0.15 || maxClose * 0.05
  const yMin = minClose - padding
  const yMax = maxClose + padding

  const width = 1000
  const height = 360
  const leftPad = 56
  const rightPad = 24
  const topPad = 16
  const bottomPad = 36
  const chartW = width - leftPad - rightPad
  const chartH = height - topPad - bottomPad

  const x = (i: number) => leftPad + (i / Math.max(1, data.length - 1)) * chartW
  const y = (val: number) => topPad + (1 - (val - yMin) / (yMax - yMin || 1)) * chartH

  const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.close)}`).join(' ')
  const areaD = `${pathD} L ${x(data.length - 1)} ${topPad + chartH} L ${x(0)} ${topPad + chartH} Z`

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0d0f10] p-5 shadow-2xl shadow-black/20">
      {/* HEADER CLEAN - NO V3 TEXT */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-300">Price Action & Accumulation</h3>
          <span className="text-[11px] text-neutral-600">• 22 trading days</span>
        </div>
        <div className="flex items-center gap-2">
          {hasSummary ? (
            <>
              <span className="h-2 w-2 rounded-full bg-amber-400" /> <span className="text-[10px] text-neutral-500">Gold Entry</span>
              <span className="ml-2 h-2 w-2 rounded-full bg-emerald-400" /> <span className="text-[10px] text-neutral-500">Accumulation</span>
              <span className="ml-2 h-2 w-2 rounded-full bg-red-400" /> <span className="text-[10px] text-neutral-500">Distribution</span>
            </>
          ) : (
            <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300">Upload IDX Summary untuk lihat Foreign & BidOffer</span>
          )}
        </div>
      </div>

      {/* CHART */}
      <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.03] bg-[#08090a]">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[360px] w-full">
          {[0, 1, 2, 3].map(i => (
            <g key={i}>
              <line x1={leftPad} x2={width - rightPad} y1={topPad + (i * chartH) / 4} y2={topPad + (i * chartH) / 4} stroke="#171717" strokeWidth={1} />
              <text x={leftPad - 10} y={topPad + (i * chartH) / 4 + 3} textAnchor="end" fontSize="10" fill="#525252">
                {(yMax - (i * (yMax - yMin)) / 4).toFixed(0)}
              </text>
            </g>
          ))}
          <path d={areaD} fill="url(#grad)" />
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={pathD} fill="none" stroke="#fafafa" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) => (
            <line key={`hl-${i}`} x1={x(i)} x2={x(i)} y1={y(d.high)} y2={y(d.low)} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
          ))}
          {/* sinyal hanya kalau ada summary */}
          {hasSummary &&
            data.map((d: any, i) => {
              if (!d.v3) return null
              if (d.v3.isValidEntry) {
                const isGold = d.v3.tier === 'GOLD'
                return (
                  <g key={`e-${i}`}>
                    <circle cx={x(i)} cy={y(d.close)} r={isGold ? 14 : 10} fill={isGold ? '#fbbf24' : '#10b981'} opacity={0.18} />
                    <circle cx={x(i)} cy={y(d.close)} r={isGold ? 7 : 5} fill={isGold ? '#fbbf24' : '#10b981'} stroke="#0d0f10" strokeWidth={2} />
                  </g>
                )
              }
              if (d.v3.isTP) {
                return <circle key={`tp-${i}`} cx={x(i)} cy={y(d.close)} r={5} fill="#ef4444" stroke="#0d0f10" strokeWidth={2} />
              }
              return null
            })}
          {data.map((d, i) => {
            if (i % 4 !== 0 && i !== data.length - 1) return null
            return (
              <text key={`x-${i}`} x={x(i)} y={height - 8} textAnchor="middle" fontSize="10" fill="#525252">
                {d.date.slice(5).replace('-', '/')}
              </text>
            )
          })}
        </svg>
      </div>

      {/* MINI INDICATORS - HANYA TAMPIL KALAU ADA DATA, ATAU FALLBACK CLOSEPOS DARI CANDLE */}
      <div className="mt-4 grid grid-cols-4 gap-3">
        <CleanMini title="Position in Range" hint="0=low,1=high" data={data} getVal={(d: any) => d.closePos} goodLow />
        {hasSummary ? (
          <>
            <CleanMini title="Foreign Flow" hint=">0.6 akumulasi" data={data} getVal={(d: any) => d.v3?.foreignRatio ?? 0.5} />
            <CleanMini title="Bid Strength" hint=">0.5 bid dominan" data={data} getVal={(d: any) => ((d.v3?.bidOfferImb ?? 0) + 1) / 2} />
            <CleanMini title="Conviction" hint="score 0-100" data={data} getVal={(d: any) => (d.v3?.score ?? 0) / 100} />
          </>
        ) : (
          <>
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.01] p-3 text-[11px] text-neutral-500">Foreign Flow<br /><span className="text-[10px]">Upload Ringkasan IDX</span></div>
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.01] p-3 text-[11px] text-neutral-500">Bid Strength<br /><span className="text-[10px]">Upload Ringkasan IDX</span></div>
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.01] p-3 text-[11px] text-neutral-500">Conviction<br /><span className="text-[10px]">Upload Ringkasan IDX</span></div>
          </>
        )}
      </div>

      {/* TABLE - SELALU TAMPIL CLOSEPOS DARI CANDLE, SCORE HANYA KALAU ADA SUMMARY */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full text-[11px]">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-3 py-2.5 text-left">Tanggal</th>
              <th className="px-3 py-2.5 text-right">Close</th>
              <th className="px-3 py-2.5 text-right">Range Pos</th>
              {hasSummary && (
                <>
                  <th className="px-3 py-2.5 text-right">Foreign</th>
                  <th className="px-3 py-2.5 text-right">Score</th>
                  <th className="px-3 py-2.5 text-left">Flow</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {data.slice(-10).reverse().map((d: any) => (
              <tr key={d.date} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="px-3 py-2 text-neutral-300">{d.date}</td>
                <td className="px-3 py-2 text-right font-medium text-white">{d.close}</td>
                <td className="px-3 py-2 text-right">
                  <span className={`${d.closePos <= 0.3 ? 'text-emerald-400' : d.closePos >= 0.8 ? 'text-red-400' : 'text-neutral-400'}`}>{d.closePos.toFixed(2)}</span>
                </td>
                {hasSummary && (
                  <>
                    <td className="px-3 py-2 text-right">{d.v3 ? d.v3.foreignRatio.toFixed(2) : '-'}</td>
                    <td className="px-3 py-2 text-right">
                      {d.v3 ? (
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${d.v3.tier==='GOLD'?'bg-amber-500/15 text-amber-300':d.v3.tier==='GREEN'?'bg-emerald-500/15 text-emerald-300':'bg-white/5 text-neutral-400'}`}>{d.v3.score}</span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2">
                      {d.v3?.isValidEntry ? <span className="text-emerald-400 font-bold">● Accumulation</span> : d.v3?.isTP ? <span className="text-red-400 font-bold">● Distribution</span> : <span className="text-neutral-600">—</span>}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function CleanMini({ title, hint, data, getVal, goodLow }: { title: string; hint: string; data: any[]; getVal: (d: any) => number; goodLow?: boolean }) {
  const width = 200
  const height = 64
  const pad = 8
  const chartW = width - pad * 2
  const chartH = height - pad * 2 - 12
  const points = data.map((d, i) => {
    const v = Math.max(0, Math.min(1, getVal(d)))
    const x = pad + (i / Math.max(1, data.length - 1)) * chartW
    const y = pad + (1 - v) * chartH
    return `${x},${y}`
  }).join(' ')

  const lastVal = data.length ? getVal(data[data.length - 1]) : 0.5
  const isGood = goodLow ? lastVal <= 0.3 : lastVal >= 0.6

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500">{title}</div>
        <div className={`h-1.5 w-1.5 rounded-full ${isGood ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
      </div>
      <div className="text-[10px] text-neutral-600">{hint}</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-2 h-[54px] w-full">
        <line x1={pad} x2={pad + chartW} y1={pad + chartH / 2} y2={pad + chartH / 2} stroke="#1a1a1a" strokeDasharray="3 3" />
        <polyline points={points} fill="none" stroke={isGood ? '#10b981' : '#737373'} strokeWidth={1.6} strokeLinejoin="round" />
        {data.length > 0 && (
          <circle cx={pad + chartW} cy={pad + (1 - Math.max(0, Math.min(1, lastVal))) * chartH} r={3} fill={isGood ? '#10b981' : '#525252'} />
        )}
      </svg>
    </div>
  )
}
