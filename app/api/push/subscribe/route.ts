import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { subscription, userId, storeId } = await req.json()

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
