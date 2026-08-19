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
  action_badge?: 'DON\'T CHASE' | 'NEAR RESISTANCE' | 'ACCUMULATION' | 'VOLUME SPIKE' | 'BREAKOUT CONFIRMED'
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

export default function TopOpportunitiesCard({ item }: { item: Opportunity }) {
  const plan = getTradingPlan(item)

  return (
    <div className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition p-4 rounded-xl space-y-3 shadow-sm">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-base font-bold text-white tracking-wide">{item.ticker}</h3>
          <p className="text-[11px] text-neutral-400 truncate max-w-[150px]" title={item.name}>
            {item.name}
          </p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded">
            AI SCORE {item.ai_score}
          </span>
        </div>
      </div>

      <div className="flex justify-between items-baseline pt-1">
        <div>
          <span className="text-lg font-extrabold text-white">
            Rp{item.price?.toLocaleString('id-ID')}
          </span>
          <span className={`ml-2 text-xs font-semibold ${item.change_percent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {item.change_percent >= 0 ? `+${item.change_percent.toFixed(2)}%` : `${item.change_percent.toFixed(2)}%`}
          </span>
        </div>
        <div className="text-right text-[11px] text-neutral-400 font-mono">
          <span>RSI: <strong className="text-white">{item.rsi}</strong></span>
          <span className="ml-2">Vol: <strong className="text-white">{item.volume_ratio}x</strong></span>
        </div>
      </div>

      {/* 🎯 TRADING PLAN BOX */}
      <div className="bg-neutral-950/80 border border-neutral-800/80 p-2.5 rounded-lg space-y-1.5 text-xs font-mono">
        <div className="flex justify-between items-center text-[10px] text-neutral-400 border-b border-neutral-800 pb-1">
          <span className="font-sans font-medium text-neutral-300">🎯 RUNNING PLAN</span>
          <span className="text-emerald-400 font-semibold">RRR {plan.rrr}</span>
        </div>
        
        <div className="grid grid-cols-3 gap-1 text-[11px] pt-0.5">
          <div>
            <span className="block text-[9px] text-neutral-500 font-sans">ENTRY</span>
            <span className="font-semibold text-neutral-200">{plan.entryZone}</span>
          </div>
          <div className="text-center">
            <span className="block text-[9px] text-red-400/80 font-sans">STOP LOSS</span>
            <span className="font-semibold text-red-400">{plan.sl}</span>
          </div>
          <div className="text-right">
            <span className="block text-[9px] text-emerald-400/80 font-sans">TARGET</span>
            <span className="font-semibold text-emerald-400">{plan.tp}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center pt-1">
        <div className="flex gap-1.5 items-center">
          <span className="text-[10px] font-bold px-2 py-0.5 bg-neutral-800 text-neutral-200 rounded uppercase">
            {item.setup}
          </span>
          {item.action_badge === "DON'T CHASE" && (
            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500 text-black rounded animate-pulse">
              ⚠️ DON'T CHASE
            </span>
          )}
          {item.action_badge === 'BREAKOUT CONFIRMED' && (
            <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded">
              BREAKOUT
            </span>
          )}
        </div>

        <Link 
          href={`/stock/${item.ticker}`}
          className="text-[11px] font-medium text-emerald-400 hover:text-emerald-300 transition flex items-center gap-0.5"
        >
          Analisis Detail &rarr;
        </Link>
      </div>
    </div>
  )
}
