"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type Props = {
  updatedAt: string
  marketOpen: boolean
}

export default function DashboardRefresh({ updatedAt, marketOpen }: Props) {
  const router = useRouter()
  const [updating, setUpdating] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(updatedAt)

  const refresh = async () => {
    if (updating) return

    setUpdating(true)

    try {
      router.refresh()
      setLastUpdated(new Date().toISOString())
    } finally {
      setTimeout(() => setUpdating(false), 1000)
    }
  }

  useEffect(() => {
    const interval = marketOpen
      ? 5 * 60 * 1000
      : 60 * 60 * 1000

    let timer: ReturnType<typeof setInterval> | null = null

    const start = () => {
      if (document.visibilityState !== "visible") return

      if (timer) clearInterval(timer)

      timer = setInterval(() => {
        if (document.visibilityState === "visible") {
          refresh()
        }
      }, interval)
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        start()
      } else if (timer) {
        clearInterval(timer)
        timer = null
      }
    }

    start()
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      if (timer) clearInterval(timer)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [marketOpen])

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
      <span>
        Last updated {new Date(lastUpdated).toLocaleTimeString("id-ID")}
      </span>

      <span>•</span>

      <span>Yahoo Finance</span>

      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          updating
            ? "bg-amber-50 text-amber-700"
            : "bg-emerald-50 text-emerald-700"
        }`}
      >
        {updating ? "UPDATING..." : "LIVE/RECENT"}
      </span>

      <button
        type="button"
        onClick={refresh}
        disabled={updating}
        className="rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {updating ? "⟳ Updating..." : "↻ Refresh"}
      </button>
    </div>
  )
}
