import AdminTabs from '@/components/admin/AdminTabs'
import { isAdmin } from '@/lib/auth/admin'

export default async function AdminPage() {
  const admin = await isAdmin()

  if (!admin) {
    return (
      <div className="sf-page">
        <div className="sf-card p-8 text-center">
          <h1 className="text-xl font-semibold text-white">Akses ditolak</h1>
          <p className="mt-2 text-sm text-slate-400">
            Halaman ini khusus admin.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="sf-page">
      <header className="sf-page-header">
        <h1 className="sf-page-title">Admin Panel</h1>
        <p className="sf-page-description">Khusus admin.</p>
      </header>
      <AdminTabs />
    </div>
  )
}
