"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type Props = {
  computedAt: string
}

function getRefreshInterval() {
  const now = new Date()
  const day = now.getDay()
  const hour = now.getHours()
  const minute = now.getMinutes()

  const weekday = day >= 1 && day <= 5
  const marketOpen =
    weekday &&
    ((hour === 9 && minute >= 0) ||
      (hour > 9 && hour < 16))

  return marketOpen ? 5 * 60 * 1000 : 60 * 60 * 1000
}

function isFresh(computedAt: string) {
  const age = Date.now() - new Date(computedAt).getTime()

  return age <= getRefreshInterval()
}

export default function DashboardRefresh({ computedAt }: Props) {
  const router = useRouter()

  const [updating, setUpdating] = useState(false)
  const [status, setStatus] = useState<"LIVE/RECENT" | "STALE">(
    isFresh(computedAt) ? "LIVE/RECENT" : "STALE"
  )

  async function refreshDashboard() {
    if (updating) return

    setUpdating(true)

    try {
      router.refresh()
      setStatus("LIVE/RECENT")
    } catch {
      setStatus("STALE")
    } finally {
      setTimeout(() => {
        setUpdating(false)
      }, 800)
    }
  }

  useEffect(() => {
    const interval = getRefreshInterval()

    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return

      if (!isFresh(computedAt)) {
        refreshDashboard()
      }
    }, interval)

    function handleVisibility() {
      if (document.visibilityState !== "visible") return

      if (!isFresh(computedAt)) {
        refreshDashboard()
      } else {
        setStatus("LIVE/RECENT")
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      clearInterval(timer)
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [computedAt])

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
      <span>
        Last updated{" "}
        {new Date(computedAt).toLocaleTimeString("id-ID")}
      </span>

      <span>• Yahoo Finance</span>

      <span
        className={
          status === "LIVE/RECENT"
            ? "font-medium text-emerald-600"
            : "font-medium text-amber-600"
        }
      >
        • {status}
      </span>

      <button
        type="button"
        onClick={refreshDashboard}
        disabled={updating}
        className="rounded-md border border-neutral-200 px-2 py-1 font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {updating ? "⟳ Updating..." : "↻ Refresh"}
      </button>
    </div>
  )
}
