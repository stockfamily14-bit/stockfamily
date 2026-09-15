'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function UserProfileDropdown() {
  const [email, setEmail] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null)
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface)] text-sm font-semibold text-[var(--foreground)] border border-[var(--border)]"
      >
        {email ? email.charAt(0).toUpperCase() : '?'}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-lg border border-[var(--border)] bg-[var(--background-secondary)] p-2 shadow-lg z-30">
          <p className="truncate px-2 py-1 text-xs text-[var(--muted)]">{email ?? 'Not signed in'}</p>
          <button
            onClick={handleLogout}
            className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-sm text-red-400 hover:bg-red-500/10"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  )
}
