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

// 이 상태들이 "아직 안 끝난 발주" — 재고탭 미완료 배지와 동일 기준
const PENDING_STATUSES = ['pending', 'requested', 'ordered', 'issue']
const OVERDUE_DAYS = 2 // 재고탭에서 "🔴 2일 이상 미수령" 배지와 동일 기준

export async function GET(req: NextRequest) {
  // Vercel Cron이 자동으로 보내는 인증 헤더 확인
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const { data: stores } = await supabase.from('stores').select('id, name')
    if (!stores || stores.length === 0) return NextResponse.json({ sent: 0 })

    const cutoff = new Date(Date.now() - OVERDUE_DAYS * 24 * 60 * 60 * 1000).toISOString()

    let totalSent = 0
    const results: any[] = []

    for (const store of stores) {
      const { data: overdue } = await supabase
        .from('orders')
        .select('id, item_name, quantity, unit, status, ordered_at')
        .eq('store_id', store.id)
        .in('status', PENDING_STATUSES)
        .lt('ordered_at', cutoff)
        .order('ordered_at', { ascending: true })

      if (!overdue || overdue.length === 0) {
        results.push({ store: store.name, sent: 0, overdue: 0 })
        continue
      }

      const first = overdue[0]
      const title = `⏳ ${store.name} 미수령 발주 ${overdue.length}건`
      const body = overdue.length === 1
        ? `${first.item_name} ${first.quantity}${first.unit} — 발주 후 ${OVERDUE_DAYS}일 넘게 수령 안 됐어요`
        : `${first.item_name} 외 ${overdue.length - 1}건 — 발주 후 ${OVERDUE_DAYS}일 넘게 수령 안 됐어요`

      try {
        await supabase.from('notification_logs').insert({
          store_id: store.id, type: 'order', title, body, url: '/inventory?tab=order', target_roles: ['owner', 'manager'],
        })
      } catch {}

      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('store_id', store.id)
        .not('endpoint', 'is', null)

      const targets = (subs || []).filter((sub: any) => {
        if (!['owner', 'manager'].includes(sub.role)) return false
        if (sub.settings && sub.settings['order'] === false) return false
        if (!sub.endpoint || !sub.keys) return false
        return true
      })

      const payload = JSON.stringify({ title, body, url: '/inventory?tab=order' })
      const sendResults = await Promise.allSettled(
        targets.map((sub: any) => webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload))
      )
      // 만료/무효화된 구독(410/404) 정리
      sendResults.forEach((r, i) => {
        if (r.status === 'rejected') {
          const statusCode = (r.reason as any)?.statusCode
          if (statusCode === 404 || statusCode === 410) {
            supabase.from('push_subscriptions').delete().eq('id', targets[i].id).then(() => {})
          }
        }
      })
      const sent = sendResults.filter(r => r.status === 'fulfilled').length
      totalSent += sent
      results.push({ store: store.name, sent, overdue: overdue.length })
    }

    return NextResponse.json({ totalSent, results })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
