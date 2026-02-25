'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SelectStorePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [stores, setStores] = useState<any[]>([])
  const [showNewStore, setShowNewStore] = useState(false)
  const [newStoreName, setNewStoreName] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!u.id) { router.push('/login'); return }
    setUser(u)
    loadStores(u.id)
  }, [])

  async function loadStores(uid: string) {
    // 이 직원이 속한 매장 목록 불러오기
    const { data } = await supabase
      .from('store_members')
      .select('*, stores(*)')
      .eq('profile_id', uid)
      .eq('active', true)
    setStores(data || [])
  }

  async function createStore() {
    if (!newStoreName.trim() || !user) return
    setLoading(true)
    // 매장 생성
    const { data: store } = await supabase
      .from('stores').insert({ name: newStoreName.trim() }).select().single()
    if (store) {
      // 생성자를 owner로 매장에 연결
      await supabase.from('store_members').insert({
        store_id: store.id, profile_id: user.id, role: 'owner', active: true
      })
      // 유저 role을 owner로 업데이트
      await supabase.from('profiles').update({ role: 'owner' }).eq('id', user.id)
      setNewStoreName('')
      setShowNewStore(false)
      await loadStores(user.id)
    }
    setLoading(false)
  }

  function selectStore(member: any) {
    const updatedUser = { ...user, role: member.role }
    localStorage.setItem('mj_user', JSON.stringify(updatedUser))
    localStorage.setItem('mj_store', JSON.stringify(member.stores))
    router.push('/dash')
  }

  const inp = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1px solid #E0E4E8', background: '#F8F9FB',
    color: '#1a1a2e', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#F4F6F9' }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 24px' }}>

        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 68, height: 68, borderRadius: 20, margin: '0 auto',
            background: 'linear-gradient(135deg,#FF6B35,#E84393)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, fontWeight: 800, color: '#fff',
            boxShadow: '0 8px 24px rgba(255,107,53,0.3)' }}>
            {user?.nm?.charAt(0) || 'M'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e', marginTop: 14 }}>
            안녕하세요, {user?.nm}님!
          </div>
          <div style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>어떤 매장을 이용하시겠어요?</div>
        </div>

        {/* 매장 목록 */}
        <div style={{ background: '#fff', borderRadius: 20, padding: 24,
          border: '1px solid #E8ECF0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>

          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 14 }}>📍 매장 선택</div>

          {stores.length === 0 && !showNewStore && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#bbb', fontSize: 13 }}>
              소속된 매장이 없습니다<br />
              <span style={{ fontSize: 11 }}>새 매장을 추가하거나 대표에게 등록 요청하세요</span>
            </div>
          )}

          {stores.map(member => (
            <button key={member.id} onClick={() => selectStore(member)}
              style={{ width: '100%', padding: '14px 16px', borderRadius: 12, marginBottom: 8,
                background: '#F8F9FB', border: '1px solid #E8ECF0',
                cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12,
                background: 'linear-gradient(135deg,#FF6B35,#E84393)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: '#fff', fontWeight: 800, flexShrink: 0 }}>
                {member.stores?.name?.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{member.stores?.name}</div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                  {member.role === 'owner' ? '대표' : member.role === 'manager' ? '관리자' : member.role === 'pt' ? 'PT' : '사원'}
                </div>
              </div>
              <span style={{ fontSize: 18, color: '#ddd' }}>→</span>
            </button>
          ))}

          {/* 새 매장 추가 */}
          {!showNewStore ? (
            <button onClick={() => setShowNewStore(true)}
              style={{ width: '100%', padding: '12px 0', borderRadius: 12, marginTop: 4,
                background: 'rgba(255,107,53,0.06)', border: '1px dashed rgba(255,107,53,0.4)',
                color: '#FF6B35', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              + 새 매장 추가
            </button>
          ) : (
            <div style={{ marginTop: 8 }}>
              <input value={newStoreName} onChange={e => setNewStoreName(e.target.value)}
                placeholder="매장 이름 입력" style={{ ...inp, marginBottom: 8 }}
                onKeyDown={e => e.key === 'Enter' && createStore()} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={createStore} disabled={loading}
                  style={{ flex: 1, padding: '10px 0', borderRadius: 10,
                    background: loading ? '#ccc' : 'linear-gradient(135deg,#FF6B35,#E84393)',
                    border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {loading ? '생성 중...' : '추가'}
                </button>
                <button onClick={() => { setShowNewStore(false); setNewStoreName('') }}
                  style={{ padding: '10px 16px', borderRadius: 10,
                    background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
              </div>
            </div>
          )}
        </div>

        {/* 로그아웃 */}
        <button onClick={() => { localStorage.clear(); router.push('/login') }}
          style={{ width: '100%', marginTop: 12, padding: '12px 0', borderRadius: 12,
            background: 'none', border: '1px solid #E8ECF0', color: '#bbb',
            fontSize: 13, cursor: 'pointer' }}>
          다른 계정으로 로그인
        </button>
      </div>
    </div>
  )
}