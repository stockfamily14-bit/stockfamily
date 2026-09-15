'use server'

import { revalidatePath } from 'next/cache'
import { isAdmin } from '@/lib/auth/admin'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export type InsightActionResult = {
  ok: boolean
  error?: string
}

function readText(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

function readNumber(formData: FormData, key: string): number | null {
  const raw = readText(formData, key)
  if (!raw) return null
  const n = Number(raw.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

export async function createInsightSignal(
  formData: FormData,
): Promise<InsightActionResult> {
  const admin = await isAdmin()
  if (!admin) {
    return { ok: false, error: 'Khusus admin.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'Login diperlukan.' }
  }

  const ticker = readText(formData, 'ticker').toUpperCase()
  const companyName = readText(formData, 'company_name')
  const title = readText(formData, 'title')
  const signalType = readText(formData, 'signal_type')
  const direction = readText(formData, 'direction').toUpperCase()
  const timeframe = readText(formData, 'timeframe')

  if (!ticker || !companyName || !title || !signalType || !direction || !timeframe) {
    return {
      ok: false,
      error: 'Ticker, perusahaan, judul, setup, direction, dan timeframe wajib diisi.',
    }
  }

  if (direction !== 'LONG' && direction !== 'SHORT') {
    return { ok: false, error: 'Direction harus LONG atau SHORT.' }
  }

  const now = new Date().toISOString()
  const entry1Weight = readNumber(formData, 'entry_1_weight') ?? 0.4
  const entry2Weight = readNumber(formData, 'entry_2_weight') ?? 0.3
  const entry3Weight = readNumber(formData, 'entry_3_weight') ?? 0.3

  const payload = {
    ticker,
    company_name: companyName,
    title,
    signal_type: signalType,
    direction,
    timeframe,
    trigger: readNumber(formData, 'trigger'),
    entry_min: readNumber(formData, 'entry_min'),
    entry_max: readNumber(formData, 'entry_max'),
    entry_1: readNumber(formData, 'entry_1'),
    entry_2: readNumber(formData, 'entry_2'),
    entry_3: readNumber(formData, 'entry_3'),
    entry_1_weight: entry1Weight,
    entry_2_weight: entry2Weight,
    entry_3_weight: entry3Weight,
    target_1: readNumber(formData, 'target_1'),
    target_2: readNumber(formData, 'target_2'),
    target_3: readNumber(formData, 'target_3'),
    invalidation: readNumber(formData, 'invalidation'),
    risk_reward: readNumber(formData, 'risk_reward'),
    thesis: readText(formData, 'thesis') || null,
    technical_note: readText(formData, 'technical_note') || null,
    chart_image_url: readText(formData, 'chart_image_url') || null,
    status: 'PUBLISHED',
    published_at: now,
    created_by: user.id,
    updated_at: now,
  }

  const adminClient = getSupabaseAdmin()
  const { error } = await adminClient.from('insight_signals').insert(payload)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/insight')
  revalidatePath('/admin')
  return { ok: true }
}
