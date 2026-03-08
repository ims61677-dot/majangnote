import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

webpush.setVapidDetails(
  'mailto:' + process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { store_id, title, message, url, target } = await req.json()
    let query = supabase.from('push_subscriptions').select('*').eq('store_id', store_id)
    if (target === 'employees') query = query.eq('role', 'employee')
    if (target === 'owner') query = query.eq('role', 'owner')
    const { data: subs, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 })
    const payload = JSON.stringify({ title: title || 'Store Note', body: message, url: url || '/notice' })
    let sent = 0
    await Promise.all(subs.map(async (sub: any) => {
      try { await webpush.sendNotification(sub.subscription, payload); sent++ }
      catch (err: any) { if (err.statusCode === 404 || err.statusCode === 410) await supabase.from('push_subscriptions').delete().eq('id', sub.id) }
    }))
    return NextResponse.json({ sent })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}