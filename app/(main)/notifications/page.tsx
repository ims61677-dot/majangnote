'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const TYPE_ICON: Record<string, string> = {
  attendance: '🕐', late: '⏰', request: '✍️', notice: '📢',
  closing: '📒', inventory: '📦', schedule: '📅',
}

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
  const router = useRouter()
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

    // 이전에 열어본 시각(업데이트 전)을 기준으로 안 읽은 알림을 표시 — 기기 상관없이 서버에 저장된 값 사용
    let prevSeenAt = '1970-01-01T00:00:00.000Z'
    if (user?.id) {
      const { data: profileRow } = await supabase.from('profiles').select('notif_seen_at').eq('id', user.id).maybeSingle()
      prevSeenAt = profileRow?.notif_seen_at || prevSeenAt
    }

    const mine = (data || []).filter((l: any) => {
      if (l.exclude_user_id && l.exclude_user_id === user.id) return false
      if (l.target_roles && l.target_roles.length > 0 && !l.target_roles.includes(user.role)) return false
      if (l.target_user_name && l.target_user_name !== user.nm) return false
      return true
    }).map((l: any) => ({ ...l, storeName: storeNames[l.store_id] || '', isUnread: l.created_at > prevSeenAt }))
    setLogs(mine)
    setLoading(false)

    // 읽음 처리: 마지막으로 열어본 시간을 서버에 저장 (다른 기기에서도 동일하게 반영)
    if (user?.id) {
      await supabase.from('profiles').update({ notif_seen_at: new Date().toISOString() }).eq('id', user.id)
    }
  }

  function openLog(l: any) {
    router.push(l.url || '/notifications')
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
        <>
          {logs.some(l => l.isUnread) && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#FF6B35', marginBottom: 8, paddingLeft: 2 }}>
                🔴 안 읽은 알림 {logs.filter(l => l.isUnread).length}개
              </div>
              <NotifList logs={logs.filter(l => l.isUnread)} multiStore={multiStore} onOpen={openLog} />
              {logs.some(l => !l.isUnread) && <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', margin: '16px 0 8px', paddingLeft: 2 }}>읽은 알림</div>}
            </>
          )}
          <NotifList logs={logs.filter(l => !l.isUnread)} multiStore={multiStore} onOpen={openLog} />
        </>
      )}
    </div>
  )
}

function NotifList({ logs, multiStore, onOpen }: { logs: any[]; multiStore: boolean; onOpen: (l: any) => void }) {
  if (logs.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {logs.map(l => (
        <div key={l.id} onClick={() => onOpen(l)} style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
          background: l.isUnread ? 'rgba(255,107,53,0.04)' : '#fff',
          border: l.isUnread ? '1px solid rgba(255,107,53,0.25)' : '1px solid #E8ECF0',
        }}>
          <span style={{ fontSize: 18, flexShrink: 0, position: 'relative' }}>
            {TYPE_ICON[l.type] || '🔔'}
            {l.isUnread && <span style={{ position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderRadius: '50%', background: '#FF6B35', border: '1.5px solid #fff' }} />}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{l.title || '알림'}</div>
              {multiStore && l.storeName && (
                <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(108,92,231,0.1)', color: '#6C5CE7', fontWeight: 600 }}>{l.storeName}</span>
              )}
            </div>
            {l.body && <div style={{ fontSize: 12, color: l.isUnread ? '#444' : '#888', marginTop: 3, lineHeight: 1.5 }}>{l.body}</div>}
          </div>
          <span style={{ fontSize: 10, color: '#bbb', flexShrink: 0, whiteSpace: 'nowrap' }}>{timeAgo(l.created_at)}</span>
        </div>
      ))}
    </div>
  )
}
