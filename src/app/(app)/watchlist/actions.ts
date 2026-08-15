'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function addToWatchlist(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const ticker = (formData.get('ticker') as string).trim().toUpperCase()

  await supabase.from('watchlists').insert({ user_id: user.id, ticker })

  revalidatePath('/watchlist')
}

export async function removeFromWatchlist(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const ticker = formData.get('ticker') as string

  await supabase.from('watchlists').delete().eq('user_id', user.id).eq('ticker', ticker)

  revalidatePath('/watchlist')
}