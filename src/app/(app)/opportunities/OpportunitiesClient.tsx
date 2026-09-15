'use client'

import { useState } from 'react'
import Link from 'next/link'

type StockCandidate = {
  ticker: string
  name: string
  setup: string
  aiScore: number
  price?: number
}

type RadarMeta = {
  key: string
  label: string
  icon: string
  description: string
}

export default function OpportunitiesClient({
  stocks,
  selectedRadar,
  activeCount,
}: {
  stocks: StockCandidate[]
  selectedRadar: RadarMeta
  selectedType: string
  activeCount: number
}) {
  const [searchQuery, setSearchQuery] = useState('')

  // Filter saham berdasarkan Ticker atau Nama Emiten
  const filteredStocks = stocks.filter((stock) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      stock.ticker.toLowerCase().includes(q) ||
      stock.name.toLowerCase().includes(q)
    )
  })

  function getScoreColor(score: number) {
    if (score >= 80) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    if (score >= 70) return 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20'
    if (score >= 60) return 'text-amber-300 bg-amber-500/10 border-amber-500/20'
    return 'text-slate-400 bg-slate-500/10 border-slate-500/20'
  }

  function getSetupBadge(setup?: string) {
    const val = (setup || '').toUpperCase()
    if (val.includes('BREAKOUT')) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
    if (val.includes('MOMENTUM')) return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
    if (val.includes('SUPPORT')) return 'border-amber-500/30 bg-amber-500/10 text-amber-300'
    if (val.includes('VOLUME')) return 'border-violet-500/30 bg-violet-500/10 text-violet-300'
    if (val.includes('DISTRIBUTION')) return 'border-red-500/30 bg-red-500/10 text-red-400'
    return 'border-slate-500/30 bg-slate-500/10 text-slate-300'
  }

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-white/5 bg-[#0b101d] shadow-2xl">
      {/* CARD HEADER & SEARCH BAR */}
      <div className="flex flex-col gap-3 border-b border-white/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base text-cyan-400">{selectedRadar.icon}</span>
          <h2 className="text-sm font-bold text-white tracking-wide">
            {selectedRadar.label}
          </h2>
          <span className="ml-1 rounded-full bg-white/5 px-2.5 py-0.5 font-mono text-[10px] font-bold text-slate-400">
            {filteredStocks.length} / {activeCount}
          </span>
        </div>

        {/* INPUT SEARCH TICKER */}
        <div className="relative w-full sm:w-64">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari ticker / nama..."
            className="w-full rounded-xl border border-white/10 bg-black/20 py-1.5 pl-8 pr-8 font-mono text-xs text-white placeholder-slate-500 outline-none transition-all focus:border-cyan-400/50 focus:bg-black/40 focus:ring-1 focus:ring-cyan-400/30"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-xs text-slate-500 hover:text-slate-300"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {filteredStocks.length === 0 ? (
        <p className="px-4 py-12 text-center text-xs text-slate-500">
          {searchQuery
            ? `Tidak ada hasil pencarian untuk "${searchQuery}"`
            : 'Belum ada kandidat saham untuk kategori ini.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.01] font-mono text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3.5">Kode</th>
                <th className="px-5 py-3.5">Nama</th>
                <th className="px-5 py-3.5">Setup</th>
                <th className="px-5 py-3.5 text-right">Harga</th>
                <th className="px-5 py-3.5 text-center">AI Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredStocks.map((stock, index) => {
                const setupText = stock.setup || selectedRadar.label
                return (
                  <tr key={stock.ticker || index} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5 font-mono font-black">
                      <Link 
                        href={`/stock/${stock.ticker}`} 
                        className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 hover:underline decoration-cyan-400/50 underline-offset-4 transition-all"
                      >
                        {stock.ticker}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-200">
                      {stock.name}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block rounded-md border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase ${getSetupBadge(setupText)}`}>
                        {setupText}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-200">
                      {stock.price ? `Rp ${stock.price.toLocaleString('id-ID')}` : <span className="text-slate-600">-</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2.5">
                        <span className={`inline-flex h-6 min-w-[34px] items-center justify-center rounded-md border font-mono text-xs font-black ${getScoreColor(stock.aiScore)}`}>
                          {stock.aiScore ?? '-'}
                        </span>
                        {typeof stock.aiScore === 'number' && (
                          <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-slate-800 sm:block">
                            <div
                              className={`h-full ${stock.aiScore >= 80 ? 'bg-emerald-400' : stock.aiScore >= 70 ? 'bg-cyan-400' : 'bg-amber-400'}`}
                              style={{ width: `${Math.min(100, Math.max(0, stock.aiScore))}%` }}
                            />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
