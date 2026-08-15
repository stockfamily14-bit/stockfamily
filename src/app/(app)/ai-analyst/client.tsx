'use client'

import { useState } from 'react'
import { askAnalyst, getLocalAnalysis } from './actions'

type TopStock = {
  ticker: string
  name: string
  price: number | null
  volume: number | null
}

type TradePlan = {
  status: 'VALID' | 'WAIT_CONFIRMATION' | 'UNATTRACTIVE_RR' | 'NO_SETUP'
  entry: number | null
  trigger: number | null
  invalidation: number | null
  target1: number | null
  target2: number | null
  target3: number | null
  riskReward: number | null
  riskPercent: number | null
  actionReason: string
}

type Analysis = {
  ticker: string
  name: string
  lastPrice: number
  aiScore: number
  label: 'BULLISH' | 'WATCH' | 'BEARISH'
  setup: 'BREAKOUT' | 'PULLBACK' | 'MOMENTUM' | 'RANGE' | 'BREAKDOWN' | 'NONE'
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  tradeAction: string
  reasons: string[]
  risks: string[]
  tradePlan: TradePlan
}

const quickPrompts = [
  'Ringkasan singkat kondisi saham ini',
  'Apa risiko utama saham ini?',
  'Cocok untuk trading jangka pendek atau investasi jangka panjang?',
]

const setupLabel: Record<Analysis['setup'], string> = {
  BREAKOUT: 'Breakout',
  PULLBACK: 'Pullback',
  MOMENTUM: 'Momentum',
  RANGE: 'Range',
  BREAKDOWN: 'Breakdown',
  NONE: 'Belum ada setup jelas',
}

const statusLabel: Record<TradePlan['status'], string> = {
  VALID: 'Setup Valid',
  WAIT_CONFIRMATION: 'Menunggu Konfirmasi',
  UNATTRACTIVE_RR: 'R:R Tidak Menarik Saat Ini',
  NO_SETUP: 'Belum Ada Setup Jelas',
}

function rp(n: number | null) {
  return n != null ? `Rp${Math.round(n).toLocaleString('id-ID')}` : '-'
}

export default function AIAnalystClient({ topStocks }: { topStocks: TopStock[] }) {
  const [ticker, setTicker] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState('')

  async function handleAnalyze(t: string) {
    setTicker(t)
    setAnalysis(null)
    setAnalysisError('')
    setAnalysisLoading(true)
    try {
      const result = await getLocalAnalysis(t)
      if (!result) {
        setAnalysisError('Data historis belum cukup untuk saham ini.')
      } else {
        setAnalysis(result as unknown as Analysis)
      }
    } catch {
      setAnalysisError('Gagal mengambil analisa.')
    } finally {
      setAnalysisLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setAnswer('')
    try {
      const result = await askAnalyst(question, ticker)
      setAnswer(result)
    } catch {
      setAnswer('Terjadi kesalahan, coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  const labelColor =
    analysis?.label === 'BULLISH'
      ? 'text-emerald-600'
      : analysis?.label === 'BEARISH'
        ? 'text-red-600'
        : 'text-amber-600'

  const labelEmoji = analysis?.label === 'BULLISH' ? '🟢' : analysis?.label === 'BEARISH' ? '🔴' : '🟡'

  const riskLevelColor =
    analysis?.riskLevel === 'LOW'
      ? 'text-emerald-600'
      : analysis?.riskLevel === 'HIGH'
        ? 'text-red-600'
        : 'text-amber-600'

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-neutral-900">AI Analyst</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Skor lokal dihitung dari data historis 90 hari. Klik saham untuk lihat analisa.
      </p>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-700">Top 5 Volume Tertinggi Hari Ini</h2>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {topStocks.map((stock, i) => (
            <button
              key={stock.ticker}
              onClick={() => handleAnalyze(stock.ticker)}
              className="rounded-xl border border-neutral-200 p-3 text-left hover:border-neutral-400"
            >
              <p className="text-xs text-neutral-400">#{i + 1}</p>
              <p className="font-semibold text-neutral-900">{stock.ticker}</p>
              <p className="truncate text-xs text-neutral-500">{stock.name}</p>
              <p className="mt-1 text-sm font-medium text-neutral-900">
                {stock.price != null ? `Rp${stock.price.toLocaleString('id-ID')}` : '-'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {analysisLoading && <p className="mt-6 text-sm text-neutral-500">Menghitung analisa...</p>}
      {analysisError && <p className="mt-6 text-sm text-red-600">{analysisError}</p>}

      {analysis && (
        <div className="mt-6 rounded-xl border border-neutral-200 p-5">
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="text-xl font-bold text-neutral-900">
                {analysis.ticker} — {analysis.aiScore}/100
              </h2>
              <p className={`mt-1 text-sm font-semibold ${labelColor}`}>
                {labelEmoji} {analysis.label} · Setup: {setupLabel[analysis.setup]}
              </p>
              <p className={`mt-0.5 text-xs font-medium ${riskLevelColor}`}>Risiko: {analysis.riskLevel}</p>
            </div>
            <p className="text-lg font-semibold text-neutral-900">{rp(analysis.lastPrice)}</p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-neutral-500">Why Now</p>
              <ul className="mt-1 space-y-1 text-sm text-neutral-700">
                {analysis.reasons.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-500">Risk</p>
              <ul className="mt-1 space-y-1 text-sm text-neutral-700">
                {analysis.risks.length === 0 && <li>• Tidak ada risiko signifikan terdeteksi</li>}
                {analysis.risks.map((r) => (
                  <li key={r}>• {r}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-neutral-50 p-3">
            <p className="text-xs font-semibold text-neutral-500">
              Trade Plan — {statusLabel[analysis.tradePlan.status]}
            </p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">{analysis.tradeAction}</p>
            <p className="mt-1 text-xs text-neutral-500">{analysis.tradePlan.actionReason}</p>

            {analysis.tradePlan.status === 'VALID' ? (
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-neutral-700 sm:grid-cols-5">
                <p>Entry → {rp(analysis.tradePlan.entry)}</p>
                <p>Invalidation → {rp(analysis.tradePlan.invalidation)}</p>
                <p>Target 1 → {rp(analysis.tradePlan.target1)}</p>
                <p>Target 2 → {rp(analysis.tradePlan.target2)}</p>
                <p>
                  R:R → {analysis.tradePlan.riskReward != null ? `1:${analysis.tradePlan.riskReward.toFixed(1)}` : '-'}
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-neutral-500">
                {analysis.tradePlan.status === 'WAIT_CONFIRMATION' &&
                  analysis.tradePlan.trigger != null &&
                  `Pantau breakout di atas ${rp(analysis.tradePlan.trigger)}.`}
                {analysis.tradePlan.status === 'UNATTRACTIVE_RR' &&
                  'Setup terdeteksi tapi rasio risk/reward-nya kurang menarik saat ini.'}
                {analysis.tradePlan.status === 'NO_SETUP' &&
                  'Belum ada setup trading yang jelas untuk saham ini saat ini.'}
              </p>
            )}
          </div>

          <p className="mt-3 text-xs text-neutral-400">
            Dihitung otomatis dari data historis, bukan rekomendasi investasi. Selalu lakukan riset sendiri.
          </p>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-neutral-200 p-4">
        <h2 className="text-sm font-semibold text-neutral-700">Tanya AI</h2>
        <form onSubmit={handleSubmit} className="mt-3 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">Kode saham (opsional)</label>
            <input
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="Misal: BBCA"
              className="w-40 rounded-lg border border-neutral-300 px-3 py-2 text-sm uppercase focus:border-neutral-900 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-700">Pertanyaan</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
              rows={3}
              placeholder="Misal: Bagaimana kondisi saham ini sekarang?"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-900 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {quickPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setQuestion(prompt)}
                className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50"
              >
                {prompt}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {loading ? 'Menganalisa...' : 'Tanya'}
          </button>
        </form>

        {answer && (
          <div className="mt-4 rounded-xl bg-neutral-50 p-4">
            <p className="whitespace-pre-wrap text-sm text-neutral-800">{answer}</p>
          </div>
        )}
      </div>
    </div>
  )
}