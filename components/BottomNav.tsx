'use client'
import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/dash',     ic: '📊', l: '대시' },
  { href: '/schedule', ic: '📅', l: '스케줄' },
  { href: '/closing',  ic: '📝', l: '마감' },
  { href: '/notice',   ic: '📢', l: '공지' },
  { href: '/more',     ic: '☰',  l: '더보기' },
]

const MORE_ITEMS = [
  { href: '/inventory', ic: '📦', l: '재고' },
  { href: '/recipe',    ic: '🍳', l: '레시피' },
  { href: '/staff',     ic: '👥', l: '직원관리' },
  { href: '/goal',      ic: '🎯', l: '목표매출' },
  { href: '/mypage',    ic: '📋', l: '마이페이지' },
  { href: '/export',    ic: '📥', l: '내보내기' },
]

const MORE_PATHS = MORE_ITEMS.map(m => m.href)

export default function BottomNav({ current }: { current: string }) {
  const [showMore, setShowMore] = useState(false)
  const isMore = MORE_PATHS.some(p => current.startsWith(p))

  return (
    <>
      {/* 더보기 오버레이 */}
      {showMore && (
        <div
          onClick={() => setShowMore(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)', zIndex: 99,
          }}
        />
      )}

      {/* 더보기 패널 */}
      {showMore && (
        <div style={{
          position: 'fixed', bottom: 68, left: 16, right: 16,
          background: 'rgba(18,18,28,0.98)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: 16, zIndex: 100,
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
        }}>
          {MORE_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setShowMore(false)}
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                textAlign: 'center', padding: '14px 8px', borderRadius: 14,
                background: current.startsWith(item.href)
                  ? 'rgba(255,107,53,0.15)'
                  : 'rgba(255,255,255,0.03)',
                border: current.startsWith(item.href)
                  ? '1px solid rgba(255,107,53,0.3)'
                  : '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
              }}>
                <div style={{ fontSize: 22 }}>{item.ic}</div>
                <div style={{
                  fontSize: 10, marginTop: 4,
                  color: current.startsWith(item.href) ? '#FF6B35' : '#888',
                  fontWeight: current.startsWith(item.href) ? 700 : 400,
                }}>
                  {item.l}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* 하단 탭바 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(10,10,15,0.97)', backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-around',
        padding: '6px 0 16px', zIndex: 101,
      }}>
        {TABS.map(t => {
          if (t.href === '/more') {
            const active = isMore || showMore
            return (
              <div
                key="/more"
                onClick={() => setShowMore(v => !v)}
                style={{ textAlign: 'center', padding: '4px 8px', cursor: 'pointer', minWidth: 48 }}
              >
                <div style={{ fontSize: 18 }}>{t.ic}</div>
                <div style={{
                  fontSize: 9, marginTop: 1,
                  color: active ? '#FF6B35' : '#444',
                  fontWeight: active ? 700 : 400,
                }}>{t.l}</div>
              </div>
            )
          }
          const active = current.startsWith(t.href)
          return (
            <Link key={t.href} href={t.href} style={{ textDecoration: 'none' }}>
              <div style={{ textAlign: 'center', padding: '4px 8px', cursor: 'pointer', minWidth: 48 }}>
                <div style={{ fontSize: 18 }}>{t.ic}</div>
                <div style={{
                  fontSize: 9, marginTop: 1,
                  color: active ? '#FF6B35' : '#444',
                  fontWeight: active ? 700 : 400,
                }}>{t.l}</div>
              </div>
            </Link>
          )
        })}
      </div>
    </>
  )
}