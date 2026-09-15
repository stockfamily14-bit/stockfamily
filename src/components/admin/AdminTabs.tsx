'use client'

import { useState } from 'react'
import IdxUploadPanel from './IdxUploadPanel'
import SignalUploadPanel from './SignalUploadPanel'

type Tab = 'idx' | 'signal'

export default function AdminTabs() {
  const [tab, setTab] = useState<Tab>('idx')

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab('idx')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            tab === 'idx'
              ? 'bg-emerald-500 font-semibold text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          Upload Data IDX
        </button>
        <button
          type="button"
          onClick={() => setTab('signal')}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
            tab === 'signal'
              ? 'bg-emerald-500 font-semibold text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          Upload Signal
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-5 backdrop-blur-sm">
        {tab === 'idx' ? <IdxUploadPanel /> : <SignalUploadPanel />}
      </div>
    </div>
  )
}
