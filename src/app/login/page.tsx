import { login, signup } from './actions'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; redirect?: string }>
}) {
  const params = await searchParams
  const message = params.message
  const redirectTo = params.redirect || '/dashboard'

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-black/50">
        
        {/* Header Branding */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">StockFamily</h1>
          <p className="mt-1 text-sm text-slate-400">Trade Smarter, Together.</p>
        </div>

        {/* Form Autentikasi */}
        <form className="space-y-4">
          <input type="hidden" name="redirect" value={redirectTo} />
          
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-slate-300">
              Email
            </label>
            <input 
              id="email" 
              name="email" 
              type="email" 
              required 
              placeholder="nama@email.com"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" 
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-slate-300">
              Password
            </label>
            <input 
              id="password" 
              name="password" 
              type="password" 
              required 
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" 
            />
          <div className="text-right mt-1">
            <a href="/forgot-password" className="text-xs text-slate-400 hover:text-[#00D084] transition">Lupa password?</a>
          </div>
          </div>

          {message && (
            <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
              {message}
            </p>
          )}

          {/* Tombol Aksi Login & Daftar */}
          <div className="flex gap-3 pt-2">
            <button 
              formAction={login} 
              className="flex-1 rounded-xl bg-emerald-500 px-3 py-2.5 text-sm font-semibold text-slate-950 transition-all hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
            >
              Masuk
            </button>
            <button 
              formAction={signup} 
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:border-slate-600"
            >
              Daftar
            </button>
          </div>
        </form>

        {/* Footer Link Kembali */}
        <div className="mt-6 text-center">
          <a href="/" className="text-xs text-slate-500 transition-colors hover:text-slate-400">
            ← Kembali ke Beranda
          </a>
        </div>

      </div>
    </div>
  )
}