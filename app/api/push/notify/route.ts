import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

webpush.setVapidDetails(
  'mailto:majangnote@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { type, storeId, title, body, url, excludeUserId } = await req.json()

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('store_id', storeId)
      .not('endpoint', 'is', null)

    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0 })
    }

    const targets = subs.filter(sub => {
      if (excludeUserId && sub.profile_id === excludeUserId) return false
      if (sub.settings && sub.settings[type] === false) return false
      if (!sub.endpoint || !sub.keys) return false
      return true
    })

    const payload = JSON.stringify({
      title: title || '매장노트',
      body: body || '새로운 알림이 있습니다.',
      url: url || '/login',
    })

    const results = await Promise.allSettled(
      targets.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        )
      )
    )

    const success = results.filter(r => r.status === 'fulfilled').length
    return NextResponse.json({ sent: success, total: targets.length })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
