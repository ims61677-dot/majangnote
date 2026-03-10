'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const MOBILE_TABS = [
  { href: '/dash',     ic: '📊', l: '대시' },
  { href: '/schedule', ic: '📅', l: '스케줄' },
  { href: '/closing',  ic: '📝', l: '마감' },
  { href: '/notice',   ic: '📢', l: '공지' },
  { href: '/more',     ic: '☰',  l: '더보기' },
]

// 태블릿 — 핵심 7개 + 더보기
const TABLET_TABS = [
  { href: '/dash',       ic: '📊', l: '대시' },
  { href: '/schedule',   ic: '📅', l: '스케줄' },
  { href: '/closing',    ic: '📝', l: '마감' },
  { href: '/notice',     ic: '📢', l: '공지' },
  { href: '/inventory',  ic: '📦', l: '재고' },
  { href: '/analytics',  ic: '📈', l: '분석' },
  { href: '/attendance', ic: '🕐', l: '출퇴근' },
  { href: '/more',       ic: '☰',  l: '더보기' },
]

const MORE_ITEMS = [
  { href: '/analytics',   ic: '📈', l: '분석' },
  { href: '/inventory',   ic: '📦', l: '재고&발주' },
  { href: '/recipe',      ic: '🍳', l: '레시피' },
  { href: '/staff',       ic: '👥', l: '직원관리' },
  { href: '/goal',        ic: '🎯', l: '목표매출' },
  { href: '/attendance',  ic: '🕐', l: '출퇴근' },
  { href: '/placerank',   ic: '📍', l: '순위' },
  { href: '/suggestions', ic: '💬', l: '건의&제보' },
  { href: '/mypage',      ic: '📋', l: '마이페이지' },
  { href: '/export',      ic: '📥', l: '내보내기' },
]

// 태블릿 더보기에는 이미 바에 있는 것 제외
const TABLET_MORE_ITEMS = MORE_ITEMS.filter(
  m => !['/inventory', '/analytics', '/attendance'].includes(m.href)
)

const MORE_PATHS = MORE_ITEMS.map(m => m.href)

type ScreenType = 'mobile' | 'tablet' | 'pc'

export default function BottomNav({ current }: { current: string }) {
  const [showMore, setShowMore] = useState(false)
  const [badge, setBadge] = useState(0)
  const [screen, setScreen] = useState<ScreenType>('mobile')
  const isMore = MORE_PATHS.some(p => current.startsWith(p))

  useEffect(() => {
    function updateScreen() {
      const w = window.innerWidth
      if (w >= 1024) setScreen('pc')
      else if (w >= 768) setScreen('tablet')
      else setScreen('mobile')
    }
    updateScreen()
    window.addEventListener('resize', updateScreen)
    return () => window.removeEventListener('resize', updateScreen)
  }, [])

  useEffect(() => { loadBadge() }, [current])

  async function loadBadge() {
    try {
      const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
      const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
      if (!store.id || !user.nm) return
      const supabase = createSupabaseBrowserClient()
      const { count } = await supabase
        .from('suggestion_notifications')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', store.id)
        .eq('target_name', user.nm)
        .eq('is_read', false)
      setBadge(count || 0)
    } catch {}
  }

  // PC는 layout.tsx 헤더에서 처리 — BottomNav는 null 반환
  if (screen === 'pc') return null

  const tabs = screen === 'tablet' ? TABLET_TABS : MOBILE_TABS
  const moreItems = screen === 'tablet' ? TABLET_MORE_ITEMS : MORE_ITEMS

  // 바 너비 / 최대폭
  const barMaxWidth = screen === 'tablet' ? 900 : 480
  const iconSize = screen === 'tablet' ? 20 : 18
  const labelSize = screen === 'tablet' ? 11 : 10

  return (
    <>
      {/* 더보기 오버레이 */}
      {showMore && (
        <div
          onClick={() => setShowMore(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(4px)',
            zIndex: 99,
          }}
        />
      )}

      {/* 더보기 패널 */}
      {showMore && (
        <div style={{
          position: 'fixed', bottom: screen === 'tablet' ? 80 : 72,
          left: '50%', transform: 'translateX(-50%)',
          width: `calc(100% - 32px)`,
          maxWidth: screen === 'tablet' ? 868 : 448,
          background: '#ffffff',
          border: '1px solid #E8ECF0',
          borderRadius: 20,
          padding: 16, zIndex: 100,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
          display: 'grid',
          gridTemplateColumns: screen === 'tablet' ? 'repeat(5, 1fr)' : 'repeat(3, 1fr)',
          gap: 8,
        }}>
          {moreItems.map(item => {
            const isSuggestions = item.href === '/suggestions'
            const isActive = current.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href} onClick={() => setShowMore(false)} style={{ textDecoration: 'none' }}>
                <div style={{
                  textAlign: 'center', padding: '14px 8px', borderRadius: 14,
                  background: isActive ? '#FFF0EB' : '#F8F9FB',
                  border: `1px solid ${isActive ? '#FF6B35' : '#E8ECF0'}`,
                  cursor: 'pointer', position: 'relative',
                }}>
                  <div style={{ fontSize: 22, position: 'relative', display: 'inline-block' }}>
                    {item.ic}
                    {isSuggestions && badge > 0 && (
                      <span style={{
                        position: 'absolute', top: -4, right: -8,
                        minWidth: 16, height: 16, borderRadius: 8,
                        background: '#FF6B35', color: '#fff',
                        fontSize: 9, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '0 3px', border: '1.5px solid #fff',
                      }}>{badge > 9 ? '9+' : badge}</span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 10, marginTop: 4,
                    color: isActive ? '#FF6B35' : '#888',
                    fontWeight: isActive ? 700 : 500,
                  }}>{item.l}</div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* 하단 바 */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: '100%', maxWidth: barMaxWidth,
        background: '#ffffff',
        borderTop: '1px solid #E8ECF0',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
        display: 'flex', justifyContent: 'space-around',
        padding: screen === 'tablet' ? '8px 8px 12px' : '8px 0 20px',
        zIndex: 101,
      }}>
        {tabs.map(t => {
          if (t.href === '/more') {
            const active = isMore || showMore
            return (
              <div
                key="/more"
                onClick={() => setShowMore(v => !v)}
                style={{ textAlign: 'center', padding: '4px 8px', cursor: 'pointer', minWidth: 52, position: 'relative' }}
              >
                <div style={{ fontSize: iconSize, position: 'relative', display: 'inline-block' }}>
                  {t.ic}
                  {badge > 0 && (
                    <span style={{
                      position: 'absolute', top: -4, right: -8,
                      minWidth: 14, height: 14, borderRadius: 7,
                      background: '#FF6B35', color: '#fff',
                      fontSize: 8, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 2px', border: '1.5px solid #fff',
                    }}>{badge > 9 ? '9+' : badge}</span>
                  )}
                </div>
                <div style={{
                  fontSize: labelSize, marginTop: 2,
                  color: active ? '#FF6B35' : '#aaa',
                  fontWeight: active ? 700 : 500,
                }}>{t.l}</div>
              </div>
            )
          }
          const active = current.startsWith(t.href)
          return (
            <Link key={t.href} href={t.href} style={{ textDecoration: 'none' }}>
              <div style={{ textAlign: 'center', padding: '4px 8px', cursor: 'pointer', minWidth: screen === 'tablet' ? 60 : 52 }}>
                <div style={{ fontSize: iconSize }}>{t.ic}</div>
                <div style={{
                  fontSize: labelSize, marginTop: 2,
                  color: active ? '#FF6B35' : '#aaa',
                  fontWeight: active ? 700 : 500,
                }}>{t.l}</div>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}