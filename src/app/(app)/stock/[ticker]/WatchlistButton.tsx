'use client'

import { useEffect, useState } from 'react'

type Props = {
  ticker?: string
  stockCode?: string
  code?: string
}

export default function WatchlistButton({ ticker, stockCode, code }: Props) {
  const finalCode = (ticker || stockCode || code || 'NZIA').toUpperCase()
  const [inWatchlist, setInWatchlist] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    try {
      const wl = JSON.parse(localStorage.getItem('sf_watchlist') || '[]')
      setInWatchlist(wl.includes(finalCode))
    } catch {}
  }, [finalCode])

  const toggle = () => {
    setLoading(true)

    try {
      const wl: string[] = JSON.parse(localStorage.getItem('sf_watchlist') || '[]')
      let next: string[]

      if (wl.includes(finalCode)) {
        next = wl.filter((c) => c !== finalCode)
        setInWatchlist(false)
      } else {
        next = [...wl, finalCode]
        setInWatchlist(true)
      }

      localStorage.setItem('sf_watchlist', JSON.stringify(next))
    } catch {}

    setTimeout(() => setLoading(false), 300)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
        inWatchlist
          ? 'bg-amber-400 text-black border-amber-400'
          : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
      }`}
    >
      {loading ? '...' : inWatchlist ? '★ Watchlist' : '☆ Watchlist'}
    </button>
  )
}