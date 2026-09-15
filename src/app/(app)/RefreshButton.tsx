'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RefreshButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')

  async function handleRefresh() {
    if (loading) return

    setLoading(true)
    setStatus('idle')

    try {
      const response = await fetch('/api/sync-market', {
        method: 'GET',
        cache: 'no-store',
      })

      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.success) {
        throw new Error(body?.error ?? 'Market sync failed')
      }

      setStatus('success')
      router.refresh()

      setTimeout(() => {
        setStatus('idle')
      }, 2500)
    } catch (error) {
      console.error('Market refresh failed:', error)
      setStatus('error')

      setTimeout(() => {
        setStatus('idle')
      }, 3000)
    } finally {
      setLoading(false)
    }
  }

  const label = loading
    ? '⟳ Updating...'
    : status === 'success'
      ? '✓ Updated'
      : status === 'error'
        ? 'Retry Refresh'
        : '↻ Refresh'

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={loading}
      aria-live="polite"
      className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-sm transition-all hover:border-neutral-400 hover:bg-neutral-50 hover:text-neutral-900 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
    >
      <span
        className={loading ? 'inline-block animate-spin' : ''}
        aria-hidden="true"
      >
        {loading ? '⟳' : status === 'success' ? '✓' : '↻'}
      </span>
      {label.replace(/^[⟳✓↻]\s*/, '')}
    </button>
  )
}
