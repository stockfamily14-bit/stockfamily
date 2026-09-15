'use client'
import { useMemo } from 'react'

type OHLCVItem = {
  date?: string
  trade_date?: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  value: number
  frequency: number
  foreign_buy: number
  foreign_sell: number
}

function compactNumber(value: number) {
  const n = Math.abs(value)
  if (n >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(2)}T`
  if (n >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString('id-ID')
}

export default function SmartMoneyPhaseTable({ ohlcv = [] }: { ohlcv: OHLCVItem[] }) {
  const tableData = useMemo(() => {
    if (!ohlcv || ohlcv.length === 0) return []

    return [...ohlcv].reverse().map((r) => {
      const fnNet = Number(r.foreign_buy || 0) - Number(r.foreign_sell || 0)
      const vol = Number(r.volume || 0)
      const freq = Number(r.frequency || 0)
      const ats = freq > 0 ? Math.round(vol / freq) : 0

      return {
        date: r.trade_date ?? r.date ?? 'N/A',
        close: Number(r.close || 0),
        volume: vol,
        value: Number(r.value || 0),
        frequency: freq,
        ats,
        foreignNet: fnNet,
      }
    })
  }, [ohlcv])

  if (!ohlcv || ohlcv.length === 0) {
    return (
      <section className="rounded-2xl border border-cyan-500/10 bg-[#0b1721] p-5 text-center text-xs text-slate-500">
        Data Smart Money Phase sedang dimuat atau tidak tersedia.
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-500/10 bg-[#0b1721]">
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-3.5">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[.18em] text-slate-500">
            Smart Money &amp; Flow Historical ({tableData.length} Data Transaksi)
          </div>
          <div className="mt-0.5 text-xs text-slate-400">
            Analisis akumulasi, transaksi besar (ATS), dan net foreign flow
          </div>
        </div>
      </div>

      <div className="max-h-[500px] overflow-y-auto overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 border-b border-white/5 bg-[#0b1721] text-[9px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3 text-right">Close</th>
              <th className="px-4 py-3 text-right">Volume</th>
              <th className="px-4 py-3 text-right">Value</th>
              <th className="px-4 py-3 text-right">Freq</th>
              <th className="px-4 py-3 text-right">ATS (Vol/Freq)</th>
              <th className="px-4 py-3 text-right">Foreign Net</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 font-medium text-slate-300">
            {tableData.map((row, idx) => (
              <tr key={`${row.date}-${idx}`} className="hover:bg-white/[.02]">
                <td className="px-4 py-2.5 font-semibold text-slate-200">{row.date}</td>
                <td className="px-4 py-2.5 text-right font-bold text-white">
                  Rp{row.close.toLocaleString('id-ID')}
                </td>
                <td className="px-4 py-2.5 text-right text-slate-400">{compactNumber(row.volume)}</td>
                <td className="px-4 py-2.5 text-right text-slate-400">{compactNumber(row.value)}</td>
                <td className="px-4 py-2.5 text-right text-slate-400">{compactNumber(row.frequency)}</td>
                <td className="px-4 py-2.5 text-right font-bold text-cyan-300">
                  {compactNumber(row.ats)}
                </td>
                <td
                  className={`px-4 py-2.5 text-right font-bold ${
                    row.foreignNet > 0
                      ? 'text-emerald-400'
                      : row.foreignNet < 0
                      ? 'text-red-400'
                      : 'text-slate-500'
                  }`}
                >
                  {row.foreignNet > 0 ? '+' : ''}
                  {compactNumber(row.foreignNet)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
