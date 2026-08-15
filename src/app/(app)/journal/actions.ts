'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function addJournalEntry(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const ticker = (formData.get('ticker') as string).trim().toUpperCase()
  const type = formData.get('type') as string
  const price = Number(formData.get('price'))
  const quantity = Number(formData.get('quantity'))
  const notes = formData.get('notes') as string

  await supabase.from('journal_entries').insert({
    user_id: user.id,
    ticker,
    type,
    price,
    quantity,
    notes: notes || null,
  })

  revalidatePath('/journal')
  revalidatePath('/portfolio')
}

export async function deleteJournalEntry(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const id = formData.get('id') as string

  await supabase.from('journal_entries').delete().eq('user_id', user.id).eq('id', id)

  revalidatePath('/journal')
  revalidatePath('/portfolio')
}