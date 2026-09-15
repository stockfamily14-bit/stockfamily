'use client'
import { useEffect, useRef, useState } from 'react'
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  LineStyle,
  AreaSeries,
} from 'lightweight-charts'

type Props = { history?: any[]; chartData?: any[] }

function calcVWAP(data: any[], windowSize = 14) {
  return data
    .map((d, idx) => {
      const start = Math.max(0, idx - windowSize + 1)
      const slice = data.slice(start, idx + 1)

      let totalPV = 0
      let totalVol = 0

      slice.forEach((row) => {
        const high = Number(row.high || row.close)
        const low = Number(row.low || row.close)
        const close = Number(row.close)
        const typicalPrice = (high + low + close) / 3
        const vol = Number(row.volume || 0)

        totalPV += typicalPrice * (vol > 0 ? vol : 1)
        totalVol += vol > 0 ? vol : 1
      })

      const vwapVal = totalVol > 0 ? totalPV / totalVol : Number(d.close)
      return {
        time: d.trade_date ?? d.date,
        value: vwapVal,
      }
    })
    .filter((d) => typeof d.time === 'string' && Number.isFinite(d.value))
}

function evaluatePhase(row: any, vwapVal: number) {
  if (!row) return { phase: 'Normal / Consolidation', color: '#64748b', desc: 'Menunggu trigger konfirmasi' }

  const close = Number(row.close || 0)
  const foreignNet = Number(row.foreign_buy || 0) - Number(row.foreign_sell || 0)
  const cobi = Number(row.cobi_ratio || 50)
  const nvr = Number(row.nvr || 0)

  if (close > vwapVal && (foreignNet > 0 || cobi > 65)) {
    return { phase: 'Strong Accumulation', color: '#10b981', desc: 'Buy / Hold (Follow Trend)' }
  } else if (close > vwapVal && foreignNet <= 0 && cobi < 35) {
    return { phase: 'Bull Trap (Fakeout)', color: '#f59e0b', desc: 'Avoid / Wait & See' }
  } else if (close < vwapVal && foreignNet < 0) {
    return { phase: 'Distribution / Exit', color: '#ef4444', desc: 'Take Profit / Stop Loss' }
  } else if (nvr > 100 || row.events?.includes('ACCUMULATION')) {
    return { phase: 'Strategic Re-alignment', color: '#8b5cf6', desc: 'Monitoring Pasar Nego / Block Deal' }
  }
  return { phase: 'Accumulation / Re-test', color: '#06b6d4', desc: 'Validasi Area Support' }
}

export default function SFAlphaChart({ history = [], chartData = [] }: Props) {
  const pRef = useRef<HTMLDivElement>(null)
  const sRef = useRef<HTMLDivElement>(null)
  const pChart = useRef<any>(null)
  const sChart = useRef<any>(null)

  const [currentPhase, setCurrentPhase] = useState<{ phase: string; color: string; desc: string }>({
    phase: 'Initializing...',
    color: '#64748b',
    desc: '-',
  })

  useEffect(() => {
    const priceData = chartData
    if (!pRef.current || !sRef.current || priceData.length === 0) return
    try {
      pChart.current?.remove()
      sChart.current?.remove()
    } catch {}

    const common = {
      layout: { background: { type: ColorType.Solid, color: '#0b141c' }, textColor: '#718096' },
      grid: { vertLines: { color: '#12202a' }, horzLines: { color: '#12202a' } },
      rightPriceScale: { 
        borderColor: '#1d2a34',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: { 
        timeVisible: false, 
        borderColor: '#1d2a34', 
        rightOffset: 5,
      },
      crosshair: { vertLine: { color: '#31515f' }, horzLine: { color: '#31515f' } },
    }

    const c1 = createChart(pRef.current, { ...common, height: 420, width: pRef.current.clientWidth })

    const areaSeries: any = (c1 as any).addSeries(AreaSeries, {
      topColor: 'rgba(148, 163, 184, 0.12)',
      bottomColor: 'rgba(148, 163, 184, 0.01)',
      lineColor: 'transparent',
      priceLineVisible: false,
      lastValueVisible: false,
    })
    const highRangeData = priceData
      .map((d) => ({ time: d.trade_date ?? d.date, value: Number(d.high || d.close) }))
      .filter((d) => typeof d.time === 'string' && Number.isFinite(d.value))
    areaSeries.setData(highRangeData)

    const candleSeries: any = (c1 as any).addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
      borderVisible: false,
      title: 'Price',
    })
    const candles = priceData
      .map((d) => ({
        time: d.trade_date ?? d.date,
        open: +d.open,
        high: +d.high,
        low: +d.low,
        close: +d.close,
      }))
      .filter(
        (d) =>
          typeof d.time === 'string' &&
          Number.isFinite(d.open) &&
          Number.isFinite(d.high) &&
          Number.isFinite(d.low) &&
          Number.isFinite(d.close)
      )
    candleSeries.setData(candles)

    const vwapValues = calcVWAP(priceData)
    const vwapSeries: any = (c1 as any).addSeries(LineSeries, {
      color: '#f97316',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: true,
      title: 'VWAP',
    })
    vwapSeries.setData(vwapValues)

    const volumeSeries: any = (c1 as any).addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      priceLineVisible: false,
      lastValueVisible: false,
    })
    volumeSeries.setData(
      priceData
        .map((d, i) => ({
          time: d.trade_date ?? d.date,
          value: Number(d.volume || 0),
          color:
            i === 0 || Number(d.close) >= Number(priceData[i - 1]?.close)
              ? 'rgba(16,185,129,.25)'
              : 'rgba(239,68,68,.25)',
        }))
        .filter((d) => typeof d.time === 'string' && Number.isFinite(d.value))
    )
    c1.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })

    const markers: any[] = []
    const validVolumes = priceData.map((d) => Number(d.volume || 0)).filter((v) => v > 0)
    const avgVol = validVolumes.length > 0 ? validVolumes.reduce((acc, curr) => acc + curr, 0) / validVolumes.length : 0

    priceData.forEach((d) => {
      const date = d.trade_date ?? d.date
      const vol = Number(d.volume || 0)
      const foreignNet = Math.abs(Number(d.foreign_buy || 0) - Number(d.foreign_sell || 0))

      if ((avgVol > 0 && vol > avgVol * 1.8) || foreignNet > 500000) {
        markers.push({
          time: date,
          position: 'aboveBar',
          color: '#a855f7',
          shape: 'square',
          text: ' Block Deal',
        })
      }
    })

    if (Array.isArray(history)) {
      history.forEach((h) => {
        if (h?.events?.includes('ACCUMULATION')) {
          markers.push({
            time: h.trade_date ?? h.date,
            position: 'belowBar',
            color: '#10b981',
            shape: 'arrowUp',
            text: 'Bottoming Zone',
          })
        }
      })
    }

    try {
      const sortedMarkers = markers.sort((a, b) => (a.time > b.time ? 1 : -1))
      if (candleSeries && typeof candleSeries.setMarkers === 'function') {
        candleSeries.setMarkers(sortedMarkers)
      }
    } catch (e) {
      console.error('Gagal memasang markers:', e)
    }

    if (priceData.length > 0) {
      const lastBar = priceData[priceData.length - 1]
      const lastVwap = vwapValues[vwapValues.length - 1]?.value || lastBar.close
      setCurrentPhase(evaluatePhase(lastBar, lastVwap))
    }

    const c2 = createChart(sRef.current, { ...common, height: 160, width: sRef.current.clientWidth })

    const smiSeries: any = (c2 as any).addSeries(LineSeries, {
      color: '#8b5cf6',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    })

    const historyMap = new Map(Array.isArray(history) ? history.map((h) => [h.trade_date ?? h.date, Number(h.score ?? 50)]) : [])
    const smiData = priceData
      .map((d) => {
        const timeKey = d.trade_date ?? d.date
        return {
          time: timeKey,
          value: historyMap.has(timeKey) ? historyMap.get(timeKey)! : 50,
        }
      })
      .filter((d) => typeof d.time === 'string' && Number.isFinite(d.value))

    smiSeries.setData(smiData)

    smiSeries.createPriceLine?.({
      price: 65,
      color: '#10b981',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'Strong Accumulation Zone (>65)',
    })

    smiSeries.createPriceLine?.({
      price: 50,
      color: '#64748b',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: false,
    })

    smiSeries.createPriceLine?.({
      price: 35,
      color: '#ef4444',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'Distribution Zone (<35)',
    })

    let isSyncing = false
    const ts1 = c1.timeScale()
    const ts2 = c2.timeScale()

    ts1.subscribeVisibleLogicalRangeChange((range) => {
      if (isSyncing || !range) return
      isSyncing = true
      ts2.setVisibleLogicalRange(range)
      isSyncing = false
    })

    ts2.subscribeVisibleLogicalRangeChange((range) => {
      if (isSyncing || !range) return
      isSyncing = true
      ts1.setVisibleLogicalRange(range)
      isSyncing = false
    })

    const handleResize = () => {
      if (pRef.current) c1.applyOptions({ width: pRef.current.clientWidth })
      if (sRef.current) c2.applyOptions({ width: sRef.current.clientWidth })
    }

    pChart.current = c1
    sChart.current = c2
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      try {
        c1.remove()
        c2.remove()
      } catch {}
    }
  }, [history, chartData])

  const priceData = chartData
  const last = priceData[priceData.length - 1]

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/15 bg-[#0b141c] shadow-[0_18px_55px_rgba(0,0,0,.18)]">
        <div className="absolute left-4 top-4 z-10 flex items-center gap-3 rounded-xl border border-white/10 bg-[#0b141c]/90 px-3.5 py-2 backdrop-blur-md">
          <div
            className="h-3 w-3 animate-pulse rounded-full"
            style={{ backgroundColor: currentPhase.color }}
          />
          <div>
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              Smart Money Phase
            </div>
            <div className="text-xs font-extrabold tracking-wide text-white" style={{ color: currentPhase.color }}>
              {currentPhase.phase}
            </div>
            <div className="text-[10px] text-slate-300 font-medium">{currentPhase.desc}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/0 px-4 py-3 pl-56">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">
              Composite Smart Money &amp; Flow Overlay
            </div>
            <div className="mt-1 flex items-center gap-3 text-[10px]">
              <span className="font-bold text-emerald-400"> Candlestick</span>
              <span className="font-bold text-orange-400">--- VWAP (Smart Benchmark)</span>
              <span className="font-bold text-purple-400"> Block Deal Anomaly</span>
            </div>
          </div>
          <div className="text-[10px] font-bold text-slate-400">
            {last ? `Last: Rp${Number(last.close).toLocaleString('id-ID')}` : ''}
          </div>
        </div>
        <div ref={pRef} className="w-full px-1" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-cyan-500/10 bg-[#0b141c]">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">
            Unified Smart Money Flow Index (Single Oscillator: Foreign Flow + COBI + ATS)
          </div>
          <div className="text-[9px] text-slate-500">SMI Score (0 - 100)</div>
        </div>
        <div ref={sRef} className="w-full px-1" />
      </div>
    </div>
  )
}
