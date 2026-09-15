'use client'
import { useEffect, useRef, useState } from 'react'

type Latest = {
  score: number
  structure: number
  momentum: number
  flow: number
  participation: number
  risk: number
  regime: number
  state: string
  direction: 'UP' | 'DOWN' | 'NEUTRAL'
  flowAcceleration: number
  events: string[]
  insights: { type: 'Trend' | 'Flow' | 'Risk'; text: string }[]
}

const stateLabel: Record<string, string> = {
  ACCUMULATION: 'ACCUMULATION',
  EARLY_TREND: 'EARLY TREND',
  CONFIRMED_TREND: 'CONFIRMED TREND',
  EXPANSION: 'EXPANSION',
}

const stateTone: Record<string, string> = {
  ACCUMULATION: 'text-amber-300 bg-amber-400/10 border-amber-400/25',
  EARLY_TREND: 'text-sky-300 bg-sky-400/10 border-sky-400/25',
  CONFIRMED_TREND: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/25',
  EXPANSION: 'text-violet-300 bg-violet-400/10 border-violet-400/25',
}

function scoreTone(score: number) {
  if (score >= 75) return { label: 'STRONG BULLISH', text: 'text-emerald-400', ring: '#10b981' }
  if (score >= 60) return { label: 'BULLISH', text: 'text-emerald-300', ring: '#22c55e' }
  if (score >= 45) return { label: 'NEUTRAL', text: 'text-amber-300', ring: '#eab308' }
  if (score >= 30) return { label: 'WEAK', text: 'text-orange-400', ring: '#f97316' }
  return { label: 'BEARISH', text: 'text-red-400', ring: '#ef4444' }
}

export default function SFAlphaGauge({ latest }: { latest: Latest; history?: any[] }) {
  const [displayScore, setDisplayScore] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tone = scoreTone(latest.score)

  useEffect(() => {
    let frame = 0
    const started = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - started) / 700, 1)
      setDisplayScore(Math.round(latest.score * (1 - Math.pow(1 - p, 3))))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [latest.score])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    const size = 188
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)

    const cx = size / 2
    const cy = size / 2
    const radius = 68
    const start = -Math.PI * 0.75
    const end = Math.PI * 0.75
    const progress = Math.max(0, Math.min(displayScore, 100)) / 100

    ctx.beginPath()
    ctx.arc(cx, cy, radius, start, end)
    ctx.strokeStyle = '#17212a'
    ctx.lineWidth = 13
    ctx.lineCap = 'round'
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(cx, cy, radius, start, start + (end - start) * progress)
    ctx.strokeStyle = tone.ring
    ctx.lineWidth = 13
    ctx.lineCap = 'round'
    ctx.shadowColor = tone.ring
    ctx.shadowBlur = 14
    ctx.stroke()
    ctx.shadowBlur = 0
  }, [displayScore, tone.ring])

  const comps = [
    ['Structure', latest.structure],
    ['Momentum', latest.momentum],
    ['Flow', latest.flow],
    ['Participation', latest.participation],
    ['Risk', latest.risk],
    ['Regime', latest.regime],
  ] as const

  return (
    <div className="overflow-hidden rounded-2xl border border-cyan-500/15 bg-[#0d1720] shadow-[0_18px_55px_rgba(0,0,0,.22)]">
      <div className="border-b border-white/5 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,.8)]" />
              <div className="text-sm font-black tracking-wide text-white">SF SCRET</div>
            </div>
            <div className="mt-1 text-[10px] text-slate-500">StockFamily Composite Regime &amp; Trend Engine</div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[.03] px-2.5 py-1 text-[9px] font-bold tracking-wider text-slate-500">INTELLIGENCE</span>
        </div>
      </div>

      <div className="grid grid-cols-[188px_1fr] items-center gap-1 px-4 py-4">
        <div className="relative flex h-[160px] items-center justify-center">
          <canvas ref={canvasRef} className="absolute" />
          <div className="relative z-10 mt-1 text-center">
            <div className="text-[40px] font-black leading-none text-white">{displayScore}</div>
            <div className="mt-1 text-[10px] font-semibold text-slate-500">/100</div>
          </div>
        </div>
        <div className="min-w-0">
          <div className={`text-lg font-black tracking-tight ${tone.text}`}>{tone.label}</div>
          <div className="mt-1 text-[10px] text-slate-500">Current state</div>
          <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[9px] font-bold ${stateTone[latest.state] || 'border-white/10 bg-white/5 text-slate-400'}`}>
            {stateLabel[latest.state] || latest.state}
          </span>
          <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500">
            <span className={latest.direction === 'UP' ? 'text-emerald-400' : latest.direction === 'DOWN' ? 'text-red-400' : 'text-amber-300'}>
              {latest.direction === 'UP' ? '↑' : latest.direction === 'DOWN' ? '↓' : '•'}
            </span>
            <span>{latest.direction === 'UP' ? 'Positive composite bias' : latest.direction === 'DOWN' ? 'Negative composite bias' : 'Balanced composite bias'}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Component Scores</div>
          <div className="text-[9px] text-slate-600">0–100</div>
        </div>
        <div className="space-y-2.5">
          {comps.map(([label, value]) => (
            <div key={label}>
              <div className="mb-1 flex items-center justify-between text-[10px]">
                <span className="text-slate-400">{label}</span>
                <span className="font-bold text-slate-200">{value}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800/90">
                <div className={`h-full rounded-full ${label === 'Risk' ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
