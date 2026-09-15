'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/ai-analyst', label: 'AI Analyst' },
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/screener', label: 'Screener' },
  { href: '/journal', label: 'Journal' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/academy', label: 'Academy' },
  { href: '/insight', label: 'Insight' },
]

export default function AppSidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname()

  return (
    <aside className="hidden w-60 shrink-0 border-r border-[var(--border)] bg-[var(--background-secondary)] px-5 py-6 md:block">
      <div className="mb-8">
        <h1 className="text-lg font-bold text-[var(--foreground)]">StockFamily</h1>
        <p className="text-xs text-[var(--muted)]">Trade Smarter, Together.</p>
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-[var(--surface)] text-[var(--foreground)]'
                  : 'text-[var(--secondary)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]'
              }`}
            >
              {item.label}
            </Link>
          )
        })}

        {isAdmin && (
          <Link
            href="/admin"
            className="mt-4 rounded-lg border border-emerald-500/30 px-3 py-2 text-sm font-medium text-emerald-500 hover:bg-emerald-500/10"
          >
            Admin Panel
          </Link>
        )}
      </nav>
    </aside>
  )
}
