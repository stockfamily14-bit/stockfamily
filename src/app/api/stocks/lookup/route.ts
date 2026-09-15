import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim().toUpperCase()
  if (!query) {
    return NextResponse.json({ results: [] })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('stocks')
    .select('ticker, name')
    .ilike('ticker', `${query}%`)
    .order('ticker', { ascending: true })
    .limit(8)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ results: data ?? [] })
}
