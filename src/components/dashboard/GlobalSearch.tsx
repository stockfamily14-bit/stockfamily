'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface StockResult {
  ticker: string
  name: string
  price: number
  change_percent: number
  ai_score?: number
}

const POPULAR_STOCKS: StockResult[] = [
  { ticker: 'SMGA', name: 'Sumber Mineral Global Tbk', price: 112, change_percent: 5.66, ai_score: 89 },
  { ticker: 'ASRI', name: 'Alam Sutera Realty Tbk', price: 180, change_percent: 7.14, ai_score: 87 },
  { ticker: 'BEST', name: 'Bekasi Fajar Industrial Estate', price: 145, change_percent: 3.57, ai_score: 87 },
  { ticker: 'DMAS', name: 'Puradelta Lestari Tbk', price: 168, change_percent: 4.35, ai_score: 86 },
  { ticker: 'AHAP', name: 'Asuransi Harta Aman Tbk', price: 152, change_percent: 2.70, ai_score: 86 },
  { ticker: 'BBCA', name: 'Bank Central Asia Tbk', price: 10250, change_percent: 0.98, ai_score: 82 },
  { ticker: 'BBRI', name: 'Bank Rakyat Indonesia Tbk', price: 5125, change_percent: -0.48, ai_score: 79 },
  { ticker: 'TLKM', name: 'Telkom Indonesia Tbk', price: 2980, change_percent: 1.20, ai_score: 75 },
]

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StockResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      setResults([])
    }
  }, [isOpen])

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (val.trim().length > 0) {
      const filtered = POPULAR_STOCKS.filter(
        (s) =>
          s.ticker.toLowerCase().includes(val.toLowerCase()) ||
          s.name.toLowerCase().includes(val.toLowerCase())
      )
      setResults(filtered)
    } else {
      setResults([])
    }
  }

  const handleSelect = (ticker: string) => {
    setIsOpen(false)
    router.push(`/stock/${ticker}`)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-400 px-3 py-1.5 rounded-lg text-xs transition w-64 justify-between shadow-sm"
      >
        <span className="flex items-center gap-2">
          <span>🔍</span> Cari Ticker (misal: ASRI, BBCA)...
        </span>
        <kbd className="bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded text-[10px] font-mono border border-neutral-700">
          Ctrl K
        </kbd>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-20 p-4">
          <div 
            className="bg-neutral-900 border border-neutral-800 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center px-4 border-b border-neutral-800">
              <span className="text-neutral-400 text-sm">🔍</span>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={handleSearch}
                placeholder="Ketik kode saham atau nama perusahaan..."
                className="w-full bg-transparent border-none outline-none text-white px-3 py-3 text-sm placeholder-neutral-500"
              />
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-400 px-2 py-1 rounded"
              >
                ESC
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {query && results.length === 0 && (
                <div className="p-4 text-center text-xs text-neutral-500">
                  Tidak ditemukan saham dengan kata kunci "{query}"
                </div>
              )}

              {!query && (
                <div className="px-3 py-2 text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                  Sering Dicari
                </div>
              )}

              {(query ? results : POPULAR_STOCKS.slice(0, 5)).map((stock) => (
                <div
                  key={stock.ticker}
                  onClick={() => handleSelect(stock.ticker)}
                  className="flex items-center justify-between p-2.5 hover:bg-neutral-800/80 rounded-lg cursor-pointer transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white text-sm bg-neutral-800 px-2 py-1 rounded border border-neutral-700">
                      {stock.ticker}
                    </span>
                    <div>
                      <p className="text-xs font-medium text-neutral-200">{stock.name}</p>
                      <p className="text-[10px] text-neutral-400">Rp{stock.price.toLocaleString('id-ID')}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span
                      className={`text-xs font-semibold ${
                        stock.change_percent >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {stock.change_percent >= 0 ? `+${stock.change_percent}%` : `${stock.change_percent}%`}
                    </span>
                    {stock.ai_score && (
                      <span className="block text-[9px] text-emerald-500 font-mono">
                        Score {stock.ai_score}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
