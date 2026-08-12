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

// 한국시간(KST) 기준 오늘 날짜 'YYYY-MM-DD'
function todayKST() {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return kst.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  // Vercel Cron이 자동으로 보내는 인증 헤더 확인
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const today = todayKST()
    const [y, m, d] = today.split('-').map(Number)
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`
    const daysInMonth = new Date(y, m, 0).getDate()
    const elapsedDays = d

    const { data: stores } = await supabase.from('stores').select('id, name')
    if (!stores || stores.length === 0) return NextResponse.json({ sent: 0 })

    let totalSent = 0
    const results: any[] = []

    for (const store of stores) {
      const { data: closings } = await supabase
        .from('closings')
        .select('id, closing_date')
        .eq('store_id', store.id)
        .gte('closing_date', monthStart)
        .lte('closing_date', today)

      const todayClosing = (closings || []).find((c: any) => c.closing_date === today)
      const closingIds = (closings || []).map((c: any) => c.id)
      const closingDateMap: Record<string, string> = {}
      ;(closings || []).forEach((c: any) => { closingDateMap[c.id] = c.closing_date })

      let todaySales = 0
      let monthSales = 0
      if (closingIds.length > 0) {
        const { data: salesRows } = await supabase
          .from('closing_sales')
          .select('closing_id, amount')
          .in('closing_id', closingIds)
        ;(salesRows || []).forEach((r: any) => {
          monthSales += r.amount || 0
          if (closingDateMap[r.closing_id] === today) todaySales += r.amount || 0
        })
      }

      const projected = elapsedDays > 0 ? Math.round((monthSales / elapsedDays) * daysInMonth) : 0

      const title = `📊 ${store.name} 일일 결산`
      const body = todayClosing
        ? `오늘 매출 ${todaySales.toLocaleString()}원 · 이번달 누적 ${monthSales.toLocaleString()}원 · 이번달 예상 ${projected.toLocaleString()}원`
        : `⚠️ 오늘 마감일지가 아직 저장되지 않았어요 · 이번달 누적 ${monthSales.toLocaleString()}원 · 이번달 예상 ${projected.toLocaleString()}원`

      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('store_id', store.id)
        .not('endpoint', 'is', null)

      const targets = (subs || []).filter((sub: any) => {
        if (!['owner', 'manager'].includes(sub.role)) return false
        if (sub.settings && sub.settings['closing'] === false) return false
        if (!sub.endpoint || !sub.keys) return false
        return true
      })

      const payload = JSON.stringify({ title, body, url: '/closing' })
      const sendResults = await Promise.allSettled(
        targets.map((sub: any) => webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload))
      )
      const sent = sendResults.filter(r => r.status === 'fulfilled').length
      totalSent += sent
      results.push({ store: store.name, sent, todaySales, monthSales, projected, hasTodayClosing: !!todayClosing })
    }

    return NextResponse.json({ totalSent, results })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
