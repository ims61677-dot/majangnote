'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import BottomNav from '@/components/BottomNav'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import PushSetup from '@/components/PushSetup'

const PC_NAV = [
  { href: '/attendance',  ic: '🕐', l: '출퇴근' },
  { href: '/notice',      ic: '📢', l: '공지' },
  { href: '/closing',     ic: '📝', l: '마감' },
  { href: '/schedule',    ic: '📅', l: '스케줄' },
  { href: '/inventory',   ic: '📦', l: '재고&발주' },
  { href: '/analytics',   ic: '📈', l: '분석' },
  { href: '/staff',       ic: '👥', l: '직원관리' },
  { href: '/recipe',      ic: '🍳', l: '레시피' },
  { href: '/goal',        ic: '🎯', l: '목표매출' },
  { href: '/suggestions', ic: '💬', l: '건의&제보' },
  { href: '/advance',     ic: '💸', l: '선입금' },
  { href: '/mypage',      ic: '👤', l: '마이페이지' },
]

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createSupabaseBrowserClient()
  const [user, setUser] = useState<any>(null)
  const [store, setStore] = useState<any>(null)
  const [stores, setStores] = useState<any[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [isPC, setIsPC] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [badge, setBadge] = useState(0)

  useEffect(() => {
    function check() { setIsPC(window.innerWidth >= 1024) }
    check()
    setMounted(true)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const u = localStorage.getItem('mj_user')
    const s = localStorage.getItem('mj_store')
    const expire = localStorage.getItem('mj_user_expire')

    if (!u || !s) { router.push('/login'); return }
    if (expire && Date.now() > Number(expire)) {
      localStorage.removeItem('mj_user')
      localStorage.removeItem('mj_store')
      localStorage.removeItem('mj_user_expire')
      router.push('/login')
      return
    }
    if (!expire) {
      localStorage.setItem('mj_user_expire', String(Date.now() + 30 * 24 * 60 * 60 * 1000))
    }

    const parsedUser = JSON.parse(u)

    const WEAK_PINS = ['1234', '0000', '9999', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9876']
    if (WEAK_PINS.includes(parsedUser.pin)) {
      router.push('/change-pin')
      return
    }

    setUser(parsedUser)
    setStore(JSON.parse(s))
    loadStores(parsedUser.id)
    loadBadge()
  }, [])

  async function loadStores(uid: string) {
    const { data } = await supabase
      .from('store_members').select('*, stores(*)')
      .eq('profile_id', uid).eq('active', true)
    setStores(data || [])
  }

  async function loadBadge() {
    try {
      const st = JSON.parse(localStorage.getItem('mj_store') || '{}')
      const u = JSON.parse(localStorage.getItem('mj_user') || '{}')
      if (!st.id || !u.nm) return
      const { count } = await supabase
        .from('suggestion_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', st.id).eq('target_name', u.nm).eq('is_read', false)
      setBadge(count || 0)
    } catch {}
  }

  function switchStore(member: any) {
    const updatedUser = { ...user, role: member.role }
    localStorage.setItem('mj_user', JSON.stringify(updatedUser))
    localStorage.setItem('mj_store', JSON.stringify(member.stores))
    setUser(updatedUser)
    setStore(member.stores)
    setShowDropdown(false)
    window.location.href = '/attendance'
  }

  function logout() {
    localStorage.removeItem('mj_user')
    localStorage.removeItem('mj_store')
    localStorage.removeItem('mj_user_expire')
    router.push('/login')
  }

  const isOwner = user?.role === 'owner'

  const isFullWidth = [
    '/attendance', '/schedule', '/analytics',
    '/inventory', '/closing', '/notice'
  ].includes(pathname)

  if (!mounted) {
    return (
      <div style={{ minHeight: '100vh', background: '#F4F6F9' }}>
        <main style={{ padding: '16px 16px 100px' }}>{children}</main>
      </div>
    )
  }

  if (isPC) {
    return (
      <div style={{ minHeight: '100vh', background: '#F4F6F9', display: 'flex', flexDirection: 'column' }}>
        <header style={{
          background: '#fff', borderBottom: '1px solid #E8ECF0',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          position: 'sticky', top: 0, zIndex: 50,
          padding: '0 24px', display: 'flex', alignItems: 'center', gap: 0, height: 56,
        }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div onClick={() => setShowDropdown(p => !p)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 0', marginRight: 24 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8,
                background: 'linear-gradient(135deg,#FF6B35,#E84393)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0,
              }}>M</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', lineHeight: 1 }}>매장노트</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                  <span style={{ fontSize: 11, color: '#FF6B35', fontWeight: 600 }}>{store?.name || ''}</span>
                  <span style={{ fontSize: 9, color: '#FF6B35' }}>▼</span>
                </div>
              </div>
            </div>

            {showDropdown && (
              <>
                <div onClick={() => setShowDropdown(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
                <div style={{
                  position: 'absolute', top: '100%', left: 0, marginTop: 8,
                  background: '#fff', borderRadius: 14, border: '1px solid #E8ECF0',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220, zIndex: 99, overflow: 'hidden',
                }}>
                  <div style={{ padding: '10px 14px 6px', fontSize: 11, color: '#aaa', fontWeight: 600 }}>매장 선택</div>
                  {stores.map(member => {
                    const isCurrent = member.stores?.id === store?.id
                    return (
                      <div key={member.id} onClick={() => switchStore(member)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 14px', cursor: 'pointer',
                          background: isCurrent ? '#FFF5F0' : '#fff',
                          borderTop: '1px solid #F4F6F9',
                        }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: isCurrent ? 'linear-gradient(135deg,#FF6B35,#E84393)' : '#F4F6F9',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 800, color: isCurrent ? '#fff' : '#999',
                        }}>{member.stores?.name?.charAt(0)}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: isCurrent ? '#FF6B35' : '#1a1a2e' }}>{member.stores?.name}</div>
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
                        style={{
                          width: '100%', padding: '8px 0', borderRadius: 8,
                          background: 'rgba(255,107,53,0.06)', border: '1px dashed rgba(255,107,53,0.3)',
                          color: '#FF6B35', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}>+ 새 매장 추가</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div style={{ width: 1, height: 28, background: '#E8ECF0', marginRight: 20, flexShrink: 0 }} />

          <nav style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {PC_NAV.map(item => {
              const active = pathname.startsWith(item.href)
              const isSuggestions = item.href === '/suggestions'
              return (
                <Link key={item.href} href={item.href} style={{ textDecoration: 'none', flexShrink: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                    background: active ? '#FFF0EB' : 'transparent',
                    color: active ? '#FF6B35' : '#555',
                    fontWeight: active ? 700 : 500, fontSize: 13,
                    transition: 'all 0.15s', position: 'relative',
                  }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#F8F9FB' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 15 }}>{item.ic}</span>
                    <span>{item.l}</span>
                    {isSuggestions && badge > 0 && (
                      <span style={{
                        minWidth: 16, height: 16, borderRadius: 8,
                        background: '#FF6B35', color: '#fff',
                        fontSize: 9, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 3px',
                      }}>{badge > 9 ? '9+' : badge}</span>
                    )}
                    {active && (
                      <div style={{
                        position: 'absolute', bottom: -9, left: '50%',
                        transform: 'translateX(-50%)',
                        width: '70%', height: 2, borderRadius: 2, background: '#FF6B35',
                      }} />
                    )}
                  </div>
                </Link>
              )
            })}
          </nav>

          <button onClick={logout} style={{
            background: 'none', border: '1px solid #E8ECF0',
            color: '#999', padding: '5px 12px', borderRadius: 8,
            cursor: 'pointer', fontSize: 12, fontWeight: 500, flexShrink: 0, marginLeft: 12,
          }}>로그아웃</button>
        </header>

        <main style={{ flex: 1, padding: '20px 24px 24px' }}>
          {children}
        </main>

        <PushSetup />
      </div>
    )
  }

  const isTablet = window.innerWidth >= 768

  return (
    <div style={{
      maxWidth: isFullWidth ? '100%' : (isTablet ? 900 : 480),
      margin: '0 auto', minHeight: '100vh',
      display: 'flex', flexDirection: 'column', background: '#F4F6F9',
    }}>
      <header style={{
        background: '#ffffff', padding: '14px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid #E8ECF0', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ position: 'relative' }}>
          <div onClick={() => setShowDropdown(p => !p)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg,#FF6B35,#E84393)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#fff',
            }}>M</div>
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
              <div onClick={() => setShowDropdown(false)} style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 8,
                background: '#fff', borderRadius: 14, border: '1px solid #E8ECF0',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 220, zIndex: 99, overflow: 'hidden',
              }}>
                <div style={{ padding: '10px 14px 6px', fontSize: 11, color: '#aaa', fontWeight: 600 }}>매장 선택</div>
                {stores.map(member => {
                  const isCurrent = member.stores?.id === store?.id
                  return (
                    <div key={member.id} onClick={() => switchStore(member)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', cursor: 'pointer',
                        background: isCurrent ? '#FFF5F0' : '#fff',
                        borderTop: '1px solid #F4F6F9',
                      }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: isCurrent ? 'linear-gradient(135deg,#FF6B35,#E84393)' : '#F4F6F9',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800, color: isCurrent ? '#fff' : '#999',
                      }}>{member.stores?.name?.charAt(0)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isCurrent ? '#FF6B35' : '#1a1a2e' }}>{member.stores?.name}</div>
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
                      style={{
                        width: '100%', padding: '8px 0', borderRadius: 8,
                        background: 'rgba(255,107,53,0.06)', border: '1px dashed rgba(255,107,53,0.3)',
                        color: '#FF6B35', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}>+ 새 매장 추가</button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <button onClick={logout} style={{
          background: 'none', border: '1px solid #E8ECF0',
          color: '#999', padding: '5px 12px', borderRadius: 8,
          cursor: 'pointer', fontSize: 12, fontWeight: 500,
        }}>로그아웃</button>
      </header>

      <main style={{ flex: 1, padding: '16px 16px 100px' }}>
        {children}
      </main>

      <PushSetup />
      <BottomNav current={pathname} />
    </div>
  )
}