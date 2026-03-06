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
    const { title, body, url, userIds } = await req.json()

    const { data: subscriptions, error: dbError } = await supabase
      .from('push_subscriptions')
      .select('*')

    // 디버그 정보 표시
    if (dbError) {
      return NextResponse.json({ error: 'DB Error', detail: dbError }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ 
        error: 'No subscriptions found',
        debug: { data: subscriptions, dbError }
      }, { status: 404 })
    }

    const payload = JSON.stringify({
      title: title || '매장노트',
      body: body || '새로운 알림이 있습니다.',
      url: url || '/login',
    })

    const errors: string[] = []
    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        )
      )
    )

    const success = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length
    results.forEach((r) => {
      if (r.status === 'rejected') errors.push(String(r.reason))
    })

    return NextResponse.json({ success, failed, errors })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}