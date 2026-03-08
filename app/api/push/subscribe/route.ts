import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    // ✅ role, userName 추가로 받기
    const { subscription, userId, storeId, role, userName } = await req.json()

    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('profile_id', userId)
      .eq('store_id', storeId)
      .limit(1)

    if (existing && existing.length > 0) {
      await supabase
        .from('push_subscriptions')
        .update({
          endpoint: subscription.endpoint,
          keys: subscription.keys,
          subscription: subscription,
          role: role || 'employee',       // ✅ 추가
          user_name: userName || null,    // ✅ 추가
        })
        .eq('id', existing[0].id)
    } else {
      await supabase
        .from('push_subscriptions')
        .insert({
          profile_id: userId,
          store_id: storeId,
          endpoint: subscription.endpoint,
          keys: subscription.keys,
          subscription: subscription,
          role: role || 'employee',       // ✅ 추가
          user_name: userName || null,    // ✅ 추가
          settings: {
            attendance: true, late: true, absent: true, request: true,
            notice: true, closing: false, inventory: true, schedule: true,
          },
        })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}