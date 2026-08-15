import Link from 'next/link'
import type { ReactNode } from 'react'

const navItems = [
  { href: '/', label: 'Dashboard' },
  { href: '/ai-analyst', label: 'AI Analyst' },
  { href: '/watchlist', label: 'Watchlist' },
  { href: '/screener', label: 'Screener' },
  { href: '/journal', label: 'Journal' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/academy', label: 'Academy' },
  { href: '/insight', label: 'Insight' },
]

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-neutral-200 bg-neutral-50 p-4">
        <div className="mb-6 px-2">
          <h2 className="text-lg font-semibold text-neutral-900">StockFamily</h2>
          <p className="text-xs text-neutral-400">Trade Smarter, Together.</p>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 bg-white">{children}</main>
    </div>
  )
}