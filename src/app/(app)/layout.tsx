import UserProfileDropdown from '@/components/layout/UserProfileDropdown'
import type { ReactNode } from 'react'
import AppSidebar from '@/components/layout/AppSidebar'
import { isAdmin } from '@/lib/auth/admin'

export default async function AppLayout({
  children,
}: {
  children: ReactNode
}) {
  const admin = await isAdmin()

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="flex min-h-screen">

        <AppSidebar isAdmin={admin} />

        <main className="min-w-0 flex-1 bg-[var(--background)]">
          <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[var(--border)] bg-[var(--background-secondary)]/95 px-7 backdrop-blur">
            <div>
              <p className="text-xs font-medium text-[var(--muted)]">
                StockFamily Workspace
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs text-[var(--secondary)] md:block">
                Indonesian Stock Market
              </div>

              <UserProfileDropdown />
            </div>
          </header>

          <div className="mx-auto w-full max-w-[1800px]">
            {children}
          </div>
        </main>

      </div>
    </div>
  )
}
