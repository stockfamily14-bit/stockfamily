import { createClient } from '@/lib/supabase/server'

export async function isAdmin(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return false

    const { data } = await supabase
      .from('user_memberships')
      .select('role')
      .eq('user_id', user.id)
      .single()

    return String(data?.role ?? '').toUpperCase() === 'ADMIN'
  } catch {
    return false
  }
}
