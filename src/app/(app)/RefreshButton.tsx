'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RefreshButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleRefresh() {
    setLoading(true)
    router.refresh()
    setTimeout(() => setLoading(false), 1000)
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={loading}
      className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
    >
      {loading ? '⟳ Updating...' : '↻ Refresh'}
    </button>
  )
}