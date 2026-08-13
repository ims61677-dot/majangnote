import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { subscription, userId, storeId, role, userName } = await req.json()

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
      const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('profile_id', userId)
        .eq('store_id', sid)
        .limit(1)

      if (existing && existing.length > 0) {
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
        if (error) errors.push(error.message)
      }
    }

    if (errors.length > 0) return NextResponse.json({ error: errors.join('; ') }, { status: 500 })
    return NextResponse.json({ success: true, storesSubscribed: storeIds.length })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}