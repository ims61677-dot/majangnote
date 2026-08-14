'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const TYPE_ICON: Record<string, string> = {
  attendance: '🕐', late: '⏰', request: '✍️', notice: '📢',
  closing: '📒', inventory: '📦', schedule: '📅',
}

function seenKey(userId: string) { return `mj_notif_seen_${userId}` }

function timeAgo(iso: string) {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return '방금 전'
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}일 전`
  return `${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function NotificationsPage() {
  const supabase = createSupabaseBrowserClient()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [multiStore, setMultiStore] = useState(false)

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (store.id) load(store.id, user)
  }, [])

  async function load(storeId: string, user: any) {
    setLoading(true)

    // 알림은 소속된 모든 지점 기준으로 옴 (푸시 구독도 전지점 자동 등록되므로 알림함도 전지점 조회)
    let storeIds: string[] = [storeId]
    let storeNames: Record<string, string> = {}
    if (user?.id) {
      const { data: memberships } = await supabase
        .from('store_members').select('store_id, stores(id, name)').eq('profile_id', user.id).eq('active', true)
      const ids = new Set<string>()
      ;(memberships || []).forEach((m: any) => {
        if (m.stores) { ids.add(m.stores.id); storeNames[m.stores.id] = m.stores.name }
      })
      if (ids.size > 0) storeIds = Array.from(ids)
    }
    setMultiStore(storeIds.length > 1)

    const { data } = await supabase
      .from('notification_logs')
      .select('*')
      .in('store_id', storeIds)
      .order('created_at', { ascending: false })
      .limit(150)

    const mine = (data || []).filter((l: any) => {
      if (l.exclude_user_id && l.exclude_user_id === user.id) return false
      if (l.target_roles && l.target_roles.length > 0 && !l.target_roles.includes(user.role)) return false
      if (l.target_user_name && l.target_user_name !== user.nm) return false
      return true
    }).map((l: any) => ({ ...l, storeName: storeNames[l.store_id] || '' }))
    setLogs(mine)
    setLoading(false)

    // 읽음 처리: 마지막으로 열어본 시간을 저장해서 배지 카운트를 초기화
    if (user?.id) localStorage.setItem(seenKey(user.id), new Date().toISOString())
  }

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, color: '#1a1a2e' }}>🔔 알림함</div>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>최근 받았던 알림을 다시 확인할 수 있어요</div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 13 }}>⏳ 불러오는 중...</div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔕</div>
          <div style={{ fontSize: 13 }}>받은 알림이 없어요</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {logs.map(l => (
            <div key={l.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 12,
              background: '#fff', border: '1px solid #E8ECF0',
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{TYPE_ICON[l.type] || '🔔'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{l.title || '알림'}</div>
                  {multiStore && l.storeName && (
                    <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(108,92,231,0.1)', color: '#6C5CE7', fontWeight: 600 }}>{l.storeName}</span>
                  )}
                </div>
                {l.body && <div style={{ fontSize: 12, color: '#666', marginTop: 3, lineHeight: 1.5 }}>{l.body}</div>}
              </div>
              <span style={{ fontSize: 10, color: '#bbb', flexShrink: 0, whiteSpace: 'nowrap' }}>{timeAgo(l.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
