'use client'

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from 'react'
import { createInsightSignal } from '@/lib/actions/insight-actions'

const inputClass =
  'w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'

const readOnlyInputClass =
  'w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 placeholder:text-slate-600'

const labelClass = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-slate-400'
const errorTextClass = 'mt-1 text-[11px] text-red-400'

type StockOption = { ticker: string; name: string }

function parseNum(value: string): number | null {
  if (!value.trim()) return null
  const n = Number(value.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

export default function SignalUploadPanel() {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [ticker, setTicker] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyLocked, setCompanyLocked] = useState(false)
  const [suggestions, setSuggestions] = useState<StockOption[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = ticker.trim().toUpperCase()
    if (q.length < 2 || companyLocked) {
      setSuggestions([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stocks/lookup?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setSuggestions(data.results ?? [])
        setShowSuggestions(true)
      } catch {
        setSuggestions([])
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [ticker, companyLocked])

  function selectStock(stock: StockOption) {
    setTicker(stock.ticker)
    setCompanyName(stock.name)
    setCompanyLocked(true)
    setShowSuggestions(false)
    setSuggestions([])
  }

  const [entry1, setEntry1] = useState('')
  const [target1, setTarget1] = useState('')
  const [invalidation, setInvalidation] = useState('')
  const [direction, setDirection] = useState('LONG')

  const computedRR = useMemo(() => {
    const e = parseNum(entry1)
    const t = parseNum(target1)
    const i = parseNum(invalidation)
    if (e === null || t === null || i === null) return null
    const reward = Math.abs(t - e)
    const risk = Math.abs(e - i)
    if (risk === 0) return null
    return reward / risk
  }, [entry1, target1, invalidation])

  const [w1, setW1] = useState('0.4')
  const [w2, setW2] = useState('0.3')
  const [w3, setW3] = useState('0.3')

  function readTextFD(formData: FormData, key: string): string {
    return String(formData.get(key) ?? '').trim()
  }

  function validateBeforeSubmit(formData: FormData): boolean {
    const errors: Record<string, string> = {}

    if (!parseNum(entry1) && !readTextFD(formData, 'entry_1')) {
      errors.entry_1 = 'Entry 1 wajib diisi.'
    }

    const weights = [w1, w2, w3].map((w) => parseNum(w))
    const filledWeights = weights.filter((w) => w !== null) as number[]
    if (filledWeights.length > 0) {
      const sum = filledWeights.reduce((a, b) => a + b, 0)
      if (Math.abs(sum - 1) > 0.01) {
        errors.weights = `Total Weight harus 1.0 (sekarang ${sum.toFixed(2)}).`
      }
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    setMessage(null)

    if (!validateBeforeSubmit(formData)) {
      setMessage({ ok: false, text: 'Cek kembali field yang ditandai merah.' })
      return
    }

    if (computedRR !== null) {
      formData.set('risk_reward', computedRR.toFixed(2))
    }

    startTransition(async () => {
      const result = await createInsightSignal(formData)
      if (result.ok) {
        setMessage({ ok: true, text: 'Signal berhasil disimpan.' })
        form.reset()
        setTicker('')
        setCompanyName('')
        setCompanyLocked(false)
        setSuggestions([])
        setEntry1('')
        setTarget1('')
        setInvalidation('')
        setW1('0.4')
        setW2('0.3')
        setW3('0.3')
        setFieldErrors({})
      } else {
        setMessage({ ok: false, text: result.error ?? 'Gagal menyimpan signal.' })
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" autoComplete="off">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="relative">
          <label className={labelClass} htmlFor="ticker">
            Ticker
          </label>
          <input
            id="ticker"
            name="ticker"
            required
            autoComplete="off"
            className={inputClass}
            placeholder="BBCA"
            value={ticker}
            onChange={(e) => {
              setTicker(e.target.value)
              setCompanyLocked(false)
            }}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true)
            }}
            onBlur={() => setShowSuggestions(false)}
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-800 bg-slate-900 shadow-xl">
              {suggestions.map((s) => (
                <li key={s.ticker}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      selectStock(s)
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-white hover:bg-emerald-500/10"
                  >
                    <span className="font-semibold">{s.ticker}</span>
                    <span className="text-slate-400">{s.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="md:col-span-2">
          <label className={labelClass} htmlFor="company_name">
            Perusahaan
          </label>
          <input
            id="company_name"
            name="company_name"
            required
            autoComplete="off"
            readOnly={companyLocked}
            className={companyLocked ? readOnlyInputClass : inputClass}
            placeholder="Bank Central Asia"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
          {companyLocked && (
            <button
              type="button"
              onClick={() => setCompanyLocked(false)}
              className="mt-1 text-[11px] text-emerald-400 hover:underline"
            >
              Auto-filled dari database — klik untuk edit manual
            </button>
          )}
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="title">
          Judul
        </label>
        <input
          id="title"
          name="title"
          required
          className={inputClass}
          placeholder="Breakout MA20 dengan foreign inflow"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="signal_type">
            Setup
          </label>
          <select id="signal_type" name="signal_type" required className={inputClass} defaultValue="BREAKOUT">
            <option value="BREAKOUT">BREAKOUT</option>
            <option value="PULLBACK">PULLBACK</option>
            <option value="MOMENTUM">MOMENTUM</option>
            <option value="RANGE">RANGE</option>
            <option value="REVERSAL">REVERSAL</option>
            <option value="OTHER">OTHER</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="direction">
            Direction
          </label>
          <select
            id="direction"
            name="direction"
            required
            className={inputClass}
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
          >
            <option value="LONG">LONG</option>
            <option value="SHORT">SHORT</option>
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="timeframe">
            Timeframe
          </label>
          <select id="timeframe" name="timeframe" required className={inputClass} defaultValue="D1">
            <option value="D1">D1</option>
            <option value="H4">H4</option>
            <option value="H1">H1</option>
            <option value="W1">W1</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Field name="trigger" label="Trigger" />
        <div>
          <label className={labelClass} htmlFor="entry_1">
            Entry 1
          </label>
          <input
            id="entry_1"
            name="entry_1"
            type="number"
            step="any"
            className={inputClass}
            value={entry1}
            onChange={(e) => setEntry1(e.target.value)}
          />
          {fieldErrors.entry_1 && <p className={errorTextClass}>{fieldErrors.entry_1}</p>}
        </div>
        <Field name="entry_2" label="Entry 2" />
        <Field name="entry_3" label="Entry 3" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field name="entry_1_weight" label="Weight 1" value={w1} onChange={setW1} />
        <Field name="entry_2_weight" label="Weight 2" value={w2} onChange={setW2} />
        <Field name="entry_3_weight" label="Weight 3" value={w3} onChange={setW3} />
      </div>
      {fieldErrors.weights && <p className={`-mt-3 ${errorTextClass}`}>{fieldErrors.weights}</p>}

      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <label className={labelClass} htmlFor="target_1">
            Target 1
          </label>
          <input
            id="target_1"
            name="target_1"
            type="number"
            step="any"
            className={inputClass}
            value={target1}
            onChange={(e) => setTarget1(e.target.value)}
          />
        </div>
        <Field name="target_2" label="Target 2" />
        <Field name="target_3" label="Target 3" />
        <div>
          <label className={labelClass} htmlFor="invalidation">
            Invalidation
          </label>
          <input
            id="invalidation"
            name="invalidation"
            type="number"
            step="any"
            className={inputClass}
            value={invalidation}
            onChange={(e) => setInvalidation(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="risk_reward">
            Risk Reward <span className="normal-case text-slate-500">(otomatis)</span>
          </label>
          <input
            id="risk_reward"
            name="risk_reward"
            readOnly
            className={readOnlyInputClass}
            value={computedRR !== null ? `${computedRR.toFixed(2)} : 1` : '—'}
          />
        </div>
        <Field name="entry_min" label="Entry Min" />
        <Field name="entry_max" label="Entry Max" />
      </div>

      <div>
        <label className={labelClass} htmlFor="chart_image_url">
          Chart Image URL
        </label>
        <input id="chart_image_url" name="chart_image_url" className={inputClass} placeholder="https://..." />
      </div>

      <div>
        <label className={labelClass} htmlFor="thesis">
          Thesis
        </label>
        <textarea id="thesis" name="thesis" rows={4} className={inputClass} />
      </div>

      <div>
        <label className={labelClass} htmlFor="technical_note">
          Technical Note
        </label>
        <textarea id="technical_note" name="technical_note" rows={3} className={inputClass} />
      </div>

      {message && (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            message.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : 'border-red-500/30 bg-red-500/10 text-red-400'
          }`}
        >
          {message.text}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? 'Menyimpan...' : 'Publish Signal'}
      </button>
    </form>
  )
}

function Field({
  name,
  label,
  placeholder,
  value,
  onChange,
}: {
  name: string
  label: string
  placeholder?: string
  value?: string
  onChange?: (value: string) => void
}) {
  const controlled = value !== undefined
  return (
    <div>
      <label className={labelClass} htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        step="any"
        className={inputClass}
        placeholder={placeholder}
        {...(controlled
          ? { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange?.(e.target.value) }
          : {})}
      />
    </div>
  )
}
