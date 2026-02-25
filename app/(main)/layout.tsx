'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import BottomNav from '@/components/BottomNav'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [store, setStore] = useState<any>(null)

  useEffect(() => {
    const u = localStorage.getItem('mj_user')
    const s = localStorage.getItem('mj_store')
    if (!u || !s) { router.push('/login'); return }
    setUser(JSON.parse(u))
    setStore(JSON.parse(s))
  }, [])

  return (
    <div style={{
      maxWidth: 480, margin: '0 auto', minHeight: '100vh',
      display: 'flex', flexDirection: 'column', background: '#F4F6F9',
    }}>
      <header style={{
        background: '#ffffff',
        padding: '14px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid #E8ECF0',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        {/* 매장명 클릭 → 매장 선택 화면 */}
        <div
          onClick={() => router.push('/select-store')}
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg,#FF6B35,#E84393)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: '#fff',
          }}>M</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', lineHeight: 1 }}>매장노트</div>
              <span style={{ fontSize: 10, color: '#ccc' }}>⌄</span>
            </div>
            <div style={{ fontSize: 11, color: '#FF6B35', marginTop: 1, fontWeight: 600 }}>
              {store?.name || ''}
            </div>
          </div>
        </div>

        <button
          onClick={() => { localStorage.clear(); router.push('/login') }}
          style={{
            background: 'none', border: '1px solid #E8ECF0',
            color: '#999', padding: '5px 12px', borderRadius: 8,
            cursor: 'pointer', fontSize: 12, fontWeight: 500,
          }}>
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