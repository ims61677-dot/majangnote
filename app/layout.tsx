'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import { createSupabaseBrowserClient } from '@/lib/supabase'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createSupabaseBrowserClient()
  const [user, setUser] = useState<any>(null)
  const [store, setStore] = useState<any>(null)
  const [stores, setStores] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  useEffect(() => {
    const u = localStorage.getItem('mj_user')
    const s = localStorage.getItem('mj_store')
    if (!u || !s) { router.push('/login'); return }
    const parsedUser = JSON.parse(u)
    setUser(parsedUser)
    setStore(JSON.parse(s))
    loadStores(parsedUser.id)
  }, [])

  async function loadStores(uid: string) {
    const { data } = await supabase
      .from('store_members').select('*, stores(*)')
      .eq('profile_id', uid).eq('active', true)
    setStores(data || [])
  }

  function switchStore(member: any) {
    const updatedUser = { ...user, role: member.role }
    localStorage.setItem('mj_user', JSON.stringify(updatedUser))
    localStorage.setItem('mj_store', JSON.stringify(member.stores))
    setUser(updatedUser)
    setStore(member.stores)
    setShowDropdown(false)
    window.location.href = '/dash'
  }

  const isOwner = user?.role === 'owner'

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh',
      display: 'flex', flexDirection: 'column', background: '#F4F6F9' }}>

      <header style={{ background: '#ffffff', padding: '14px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid #E8ECF0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        position: 'sticky', top: 0, zIndex: 50 }}>

        <div style={{ position: 'relative' }}>
          <div onClick={() => setShowDropdown(p => !p)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg,#FF6B35,#E84393)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#fff' }}>M</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', lineHeight: 1 }}>매장노트</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                <div style={{ fontSize: 11, color: '#FF6B35', fontWeight: 600 }}>{store?.name || ''}</div>
                <span style={{ fontSize: 9, color: '#FF6B35' }}>▼</span>
              </div>
            </div>
          </div>

          {showDropdown && (
            <>
              <div onClick={() => setShowDropdown(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
              <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 8,
                background: '#fff', borderRadius: 14, border: '1px solid #E8ECF0',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220, zIndex: 99, overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px 6px', fontSize: 11, color: '#aaa', fontWeight: 600 }}>매장 선택</div>
                {stores.map(member => {
                  const isCurrent = member.stores?.id === store?.id
                  return (
                    <div key={member.id} onClick={() => switchStore(member)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', cursor: 'pointer',
                        background: isCurrent ? '#FFF5F0' : '#fff',
                        borderTop: '1px solid #F4F6F9' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: isCurrent ? 'linear-gradient(135deg,#FF6B35,#E84393)' : '#F4F6F9',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800, color: isCurrent ? '#fff' : '#999' }}>
                        {member.stores?.name?.charAt(0)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isCurrent ? '#FF6B35' : '#1a1a2e' }}>
                          {member.stores?.name}
                        </div>
                        <div style={{ fontSize: 10, color: '#aaa' }}>
                          {member.role === 'owner' ? '대표' : member.role === 'manager' ? '관리자' : member.role === 'pt' ? 'PT' : '사원'}
                        </div>
                      </div>
                      {isCurrent && <span style={{ fontSize: 12, color: '#FF6B35' }}>✓</span>}
                    </div>
                  )
                })}
                {isOwner && (
                  <div style={{ padding: '8px 14px', borderTop: '1px solid #F4F6F9' }}>
                    <button onClick={() => { setShowDropdown(false); router.push('/select-store') }}
                      style={{ width: '100%', padding: '8px 0', borderRadius: 8,
                        background: 'rgba(255,107,53,0.06)', border: '1px dashed rgba(255,107,53,0.3)',
                        color: '#FF6B35', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      + 새 매장 추가
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <button onClick={() => { localStorage.clear(); router.push('/login') }}
          style={{ background: 'none', border: '1px solid #E8ECF0',
            color: '#999', padding: '5px 12px', borderRadius: 8,
            cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
          로그아웃
        </button>
      </header>

      <main style={{ flex: 1, padding: '16px 16px 100px' }}>
        {children}
      </main>
      <BottomNav current={pathname} />
    </div>
  )
}