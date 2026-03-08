import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { subscription, userId } = await req.json()

    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', subscription.endpoint)
      .limit(1)

    if (existing && existing.length > 0) {
      await supabase
        .from('push_subscriptions')
        .update({ keys: subscription.keys, user_id: userId })
        .eq('endpoint', subscription.endpoint)
    } else {
      await supabase
        .from('push_subscriptions')
        .insert({
          endpoint: subscription.endpoint,
          keys: subscription.keys,
          user_id: userId,
        })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed: ' + String(error) }, { status: 500 })
  }
}
