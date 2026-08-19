'use client'

import React from 'react'
import Link from 'next/link'

interface Opportunity {
  ticker: string
  name: string
  price: number
  change_percent: number
  ai_score: number
  rsi: number
  volume_ratio: number
  setup: string
  action_badge?: string
  support_price?: number
  resistance_price?: number
}

function getTradingPlan(item: Opportunity) {
  const currentPrice = item.price || 0
  
  const slPrice = item.support_price 
    ? Math.floor(item.support_price * 0.99) 
    : Math.floor(currentPrice * 0.96)

  const tpPrice = item.resistance_price 
    ? Math.ceil(item.resistance_price) 
    : Math.ceil(currentPrice * 1.07)

  const entryLow = Math.floor(currentPrice * 0.99)
  const entryHigh = currentPrice

  const risk = currentPrice - slPrice
  const reward = tpPrice - currentPrice
  const rrr = risk > 0 ? (reward / risk).toFixed(1) : '1.5'

  return {
    entryZone: `Rp${entryLow.toLocaleString('id-ID')} - Rp${entryHigh.toLocaleString('id-ID')}`,
    sl: `Rp${slPrice.toLocaleString('id-ID')}`,
    tp: `Rp${tpPrice.toLocaleString('id-ID')}`,
    rrr: `1:${rrr}`
  }
}

function SingleCard({ item, rank }: { item: Opportunity; rank: number }) {
  if (!item) return null
  const plan = getTradingPlan(item)
  const price = item.price ?? 0
  const changePercent = item.change_percent ?? 0

  return (
    <div className="bg-neutral-900/90 border border-neutral-800 hover:border-neutral-700 transition p-3.5 rounded-xl space-y-2.5 shadow-sm relative flex flex-col justify-between">
      <div>
        {/* HEADER KARTU */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded">
              #{rank}
            </span>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide leading-none">{item.ticker}</h3>
              <p className="text-[10px] text-neutral-400 truncate max-w-[110px] mt-0.5" title={item.name}>
                {item.name}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-1.5 py-0.5 rounded">
              {item.ai_score ?? 0} AI SCORE
            </span>
          </div>
        </div>

        {/* HARGA REALTIME DARI SUPABASE */}
        <div className="flex justify-between items-baseline pt-2">
          <div>
            <span className="text-base font-extrabold text-white">
              Rp{price.toLocaleString('id-ID')}
            </span>
            <span className={`ml-1.5 text-[11px] font-semibold ${changePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {changePercent >= 0 ? `+${changePercent.toFixed(2)}%` : `${changePercent.toFixed(2)}%`}
            </span>
          </div>
          <div className="text-right text-[10px] text-neutral-400 font-mono">
            <span>RSI: <strong className="text-white">{item.rsi ?? 0}</strong></span>
            <span className="ml-1.5">Vol: <strong className="text-white">{item.volume_ratio ?? 0}x</strong></span>
          </div>
        </div>

        {/* 🎯 TRADING PLAN DARI HARGA LIVE RUNNING */}
        <div className="mt-2.5 bg-neutral-950/90 border border-neutral-800/80 p-2 rounded-lg space-y-1 font-mono">
          <div className="flex justify-between items-center text-[9px] text-neutral-400 border-b border-neutral-800/80 pb-0.5">
            <span className="font-sans font-medium text-neutral-300">🎯 RUNNING PLAN</span>
            <span className="text-emerald-400 font-semibold">RRR {plan.rrr}</span>
          </div>
          
          <div className="grid grid-cols-3 gap-0.5 text-[10px] pt-0.5">
            <div>
              <span className="block text-[8px] text-neutral-500 font-sans">ENTRY</span>
              <span className="font-semibold text-neutral-200">{plan.entryZone}</span>
            </div>
            <div className="text-center">
              <span className="block text-[8px] text-red-400/80 font-sans">STOP LOSS</span>
              <span className="font-semibold text-red-400">{plan.sl}</span>
            </div>
            <div className="text-right">
              <span className="block text-[8px] text-emerald-400/80 font-sans">TARGET</span>
              <span className="font-semibold text-emerald-400">{plan.tp}</span>
            </div>
          </div>
        </div>
      </div>

      {/* BADGES */}
      <div className="pt-2 border-t border-neutral-800/60 flex justify-between items-center">
        <div className="flex gap-1 items-center flex-wrap">
          {item.setup && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded uppercase">
              {item.setup}
            </span>
          )}
          {item.action_badge === "DON'T CHASE" && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-500 text-black rounded animate-pulse">
              DON'T CHASE
            </span>
          )}
          {item.action_badge === 'BREAKOUT CONFIRMED' && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded">
              BREAKOUT CONFIRMED
            </span>
          )}
          {item.action_badge === 'NEAR RESISTANCE' && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded">
              NEAR RESISTANCE
            </span>
          )}
          {item.action_badge === 'ACCUMULATION' && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded">
              ACCUMULATION
            </span>
          )}
          {item.action_badge === 'VOLUME SPIKE' && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-neutral-800 text-neutral-300 rounded">
              VOLUME SPIKE
            </span>
          )}
        </div>

        <Link 
          href={`/stock/${item.ticker}`}
          className="text-[10px] font-medium text-emerald-400 hover:text-emerald-300 transition flex items-center gap-0.5 whitespace-nowrap"
        >
          Analisis Detail &rarr;
        </Link>
      </div>
    </div>
  )
}

export default function TopOpportunities(props: any) {
  let list: Opportunity[] = []

  // Ekstraksi data real-time yang dikirim oleh Supabase/Page
  if (Array.isArray(props)) {
    list = props
  } else if (props && typeof props === 'object') {
    if (Array.isArray(props.opportunities)) list = props.opportunities
    else if (Array.isArray(props.items)) list = props.items
    else if (Array.isArray(props.data)) list = props.data
    else if (Array.isArray(props.topOpportunities)) list = props.topOpportunities
    else if (props.item) list = [props.item]
  }

  // Jika data realtime dari Supabase sedang di-fetch, tampilkan animasi skeleton
  if (!list || list.length === 0) {
    return (
      <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-2xl p-5 space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            <h2 className="text-xs font-bold tracking-wider uppercase text-neutral-200">
              TOP 5 MARKET OPPORTUNITIES (FETCHING LIVE DATA...)
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl h-44 animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-2xl p-5 space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <h2 className="text-xs font-bold tracking-wider uppercase text-neutral-200">
              TOP 5 MARKET OPPORTUNITIES
            </h2>
          </div>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Kandidat saham dengan skor konfirmasi teknikal & AI tertinggi hari ini.
          </p>
        </div>
        <Link 
          href="/screener" 
          className="text-[11px] font-medium text-neutral-400 hover:text-emerald-400 transition"
        >
          Lihat Semua Radar &rarr;
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {list.slice(0, 5).map((item, idx) => (
          <SingleCard key={item.ticker || idx} item={item} rank={idx + 1} />
        ))}
      </div>
    </div>
  )
}
