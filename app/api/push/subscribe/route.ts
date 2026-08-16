import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { subscription, userId, storeId, role, userName } = await req.json()
    const endpointTail = (subscription?.endpoint || '').slice(-24)
    console.log('[push/subscribe] 요청 수신', { userId, storeId, role, userName, endpointTail })

    // ✅ 이 계정이 속한 모든 활성 지점을 찾아서, 전부 다 구독 등록
    const { data: memberships } = await supabase
      .from('store_members')
      .select('store_id')
      .eq('profile_id', userId)
      .eq('active', true)

    let storeIds = Array.from(new Set((memberships || []).map((m: any) => m.store_id).filter(Boolean)))
    if (storeIds.length === 0 && storeId) storeIds = [storeId] // 소속 지점을 못 찾으면, 전달받은 지점만이라도 등록

    if (storeIds.length === 0) {
      return NextResponse.json({ success: true, storesSubscribed: 0 })
    }

    const errors: string[] = []

    for (const sid of storeIds) {
      // ⚠️ endpoint(기기/브라우저별 고유값)까지 같이 조건에 넣어야 함 — profile_id+store_id로만 찾으면
      // 같은 사람이 PC/휴대폰 등 여러 기기에서 접속했을 때 기기마다 서로 다른 구독을 덮어써버려서,
      // 결국 "가장 최근에 로그인한 기기 딱 하나"만 알림을 받는 문제가 생김
      const { data: existing, error: selectError } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint')
        .eq('profile_id', userId)
        .eq('store_id', sid)
        .eq('endpoint', subscription.endpoint)
        .limit(1)

      console.log('[push/subscribe] 지점 처리', { sid, existingCount: existing?.length || 0, selectError: selectError?.message })

      if (existing && existing.length > 0) {
        console.log('[push/subscribe] → UPDATE 실행', { sid, id: existing[0].id })
        const { error } = await supabase
          .from('push_subscriptions')
          .update({
            endpoint: subscription.endpoint,
            keys: subscription.keys,
            role: role || 'employee',
            user_name: userName || null,
          })
          .eq('id', existing[0].id)
        if (error) errors.push(error.message)
      } else {
        console.log('[push/subscribe] → INSERT 실행', { sid, endpointTail })
        const { error } = await supabase
          .from('push_subscriptions')
          .insert({
            profile_id: userId,
            store_id: sid,
            endpoint: subscription.endpoint,
            keys: subscription.keys,
            role: role || 'employee',
            user_name: userName || null,
            settings: {
              attendance: true, late: true, absent: true, request: true,
              notice: true, closing: false, inventory: true, schedule: true,
            },
          })
        if (error) { errors.push(error.message); console.log('[push/subscribe] INSERT 실패', error.message) }
      }
    }
    console.log('[push/subscribe] 완료', { storeIds, errors })

    if (errors.length > 0) return NextResponse.json({ error: errors.join('; ') }, { status: 500 })
    return NextResponse.json({ success: true, storesSubscribed: storeIds.length })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}