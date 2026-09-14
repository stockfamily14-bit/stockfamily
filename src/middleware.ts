import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  const isPublicPage =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/sync-market') ||
    pathname.startsWith('/_next')

  const isPublicApi =
    pathname === '/api/sync-market' ||
    pathname === '/api/stock/financials' ||
    pathname === '/api/insight/monitor' ||
    pathname === '/api/insight/monitor/debug' ||
    pathname === '/api/edge/test-level1' ||
    pathname === '/api/edge/debug-env' ||
    pathname === '/api/edge/test-level2' ||
    pathname === '/api/edge/test-analysis' ||
    pathname === '/api/edge/test-level3' ||
    pathname === '/api/edge/test-engine' ||
    pathname === '/api/edge/debug-accumulation' ||
    pathname === '/api/edge/test-production' ||
    pathname === '/api/edge/test-stages'

  const isApiRoute = pathname.startsWith('/api/')

  if (isApiRoute) {
    if (isPublicApi) return supabaseResponse
    if (!user) {
      return NextResponse.json({ success: false, error: 'UNAUTHORIZED', message: 'Authentication required' }, { status: 401 })
    }
    return supabaseResponse
  }

  // kalo udah login, jangan boleh ke /login lagi -> lempar ke /dashboard
  if (user && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  // kalo belum login dan akses private route (dashboard, screener, etc)
  if (!user && !isPublicPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', request.nextUrl.pathname + request.nextUrl.search)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}