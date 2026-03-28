import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // Added "await" here because createClient is now an async function
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subscription } = await req.json()
  const { endpoint, keys: { p256dh, auth } } = subscription

  await supabase.from('push_subscriptions').upsert({
    user_id: user.id, 
    endpoint, 
    p256dh, 
    auth
  }, { onConflict: 'endpoint' })

  return NextResponse.json({ ok: true })
}
