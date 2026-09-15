import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth/admin'
import { parseIdxSummaryFile } from '@/lib/idx-summary/parse'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const UPSERT_CHUNK = 400

type FileResult = {
  filename: string
  ok: boolean
  tradeDate?: string
  rows?: number
  error?: string
}

async function upsertRows(
  rows: ReturnType<typeof parseIdxSummaryFile>['rows'],
) {
  const supabase = getSupabaseAdmin()

  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const chunk = rows.slice(i, i + UPSERT_CHUNK)
    const { error } = await supabase.from('daily_market_summary').upsert(chunk, {
      onConflict: 'trade_date,stock_code',
    })

    if (error) {
      throw new Error(error.message)
    }
  }
}

export async function POST(request: Request) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json(
      { success: false, error: 'FORBIDDEN', message: 'Khusus admin.' },
      { status: 403 },
    )
  }

  const formData = await request.formData()
  const files = formData
    .getAll('files')
    .filter((value): value is File => value instanceof File)

  if (files.length === 0) {
    return NextResponse.json(
      { success: false, error: 'NO_FILES', message: 'Tidak ada file yang diunggah.' },
      { status: 400 },
    )
  }

  const results: FileResult[] = []

  for (const file of files) {
    try {
      const buffer = Buffer.from(await file.arrayBuffer())
      const parsed = parseIdxSummaryFile(buffer, file.name)
      await upsertRows(parsed.rows)
      results.push({
        filename: file.name,
        ok: true,
        tradeDate: parsed.tradeDate,
        rows: parsed.rows.length,
      })
    } catch (error) {
      results.push({
        filename: file.name,
        ok: false,
        error: error instanceof Error ? error.message : 'Gagal memproses file.',
      })
    }
  }

  const failed = results.filter((item) => !item.ok).length

  return NextResponse.json({
    success: failed === 0,
    results,
  })
}
