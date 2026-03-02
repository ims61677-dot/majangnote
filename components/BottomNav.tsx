'use client'
import Link from 'next/link'
import { useState } from 'react'

const TABS = [
  { href: '/dash',     ic: '📊', l: '대시' },
  { href: '/schedule', ic: '📅', l: '스케줄' },
  { href: '/closing',  ic: '📝', l: '마감' },
  { href: '/notice',   ic: '📢', l: '공지' },
  { href: '/more',     ic: '☰',  l: '더보기' },
]

const MORE_ITEMS = [
  { href: '/analytics',  ic: '📈', l: '분석' },
  { href: '/inventory',  ic: '📦', l: '재고' },
  { href: '/recipe',     ic: '🍳', l: '레시피' },
  { href: '/staff',      ic: '👥', l: '직원관리' },
  { href: '/goal',       ic: '🎯', l: '목표매출' },
  { href: '/attendance', ic: '🕐', l: '출퇴근' },
  { href: '/mypage',     ic: '📋', l: '마이페이지' },
  { href: '/export',     ic: '📥', l: '내보내기' },
]

const MORE_PATHS = MORE_ITEMS.map(m => m.href)

export default function BottomNav({ current }: { current: string }) {
  const [showMore, setShowMore] = useState(false)
  const isMore = MORE_PATHS.some(p => current.startsWith(p))

  return (
    <>
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

      {showMore && (
        <div style={{
          position: 'fixed', bottom: 72, left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 32px)', maxWidth: 448,
          background: '#ffffff',
          border: '1px solid #E8ECF0',
          borderRadius: 20,
          padding: 16, zIndex: 100,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
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
                background: current.startsWith(item.href) ? '#FFF0EB' : '#F8F9FB',
                border: `1px solid ${current.startsWith(item.href) ? '#FF6B35' : '#E8ECF0'}`,
                cursor: 'pointer',
              }}>
                <div style={{ fontSize: 22 }}>{item.ic}</div>
                <div style={{
                  fontSize: 10, marginTop: 4,
                  color: current.startsWith(item.href) ? '#FF6B35' : '#888',
                  fontWeight: current.startsWith(item.href) ? 700 : 500,
                }}>
                  {item.l}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div style={{
        position: 'fixed', bottom: 0, left: '50%',
        transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480,
        background: '#ffffff',
        borderTop: '1px solid #E8ECF0',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
        display: 'flex', justifyContent: 'space-around',
        padding: '8px 0 20px', zIndex: 101,
      }}>
        {TABS.map(t => {
          if (t.href === '/more') {
            const active = isMore || showMore
            return (
              <div
                key="/more"
                onClick={() => setShowMore(v => !v)}
                style={{ textAlign: 'center', padding: '4px 8px', cursor: 'pointer', minWidth: 52 }}
              >
                <div style={{ fontSize: 18 }}>{t.ic}</div>
                <div style={{
                  fontSize: 10, marginTop: 2,
                  color: active ? '#FF6B35' : '#aaa',
                  fontWeight: active ? 700 : 500,
                }}>{t.l}</div>
              </div>
            )
          }
          const active = current.startsWith(t.href)
          return (
            <Link key={t.href} href={t.href} style={{ textDecoration: 'none' }}>
              <div style={{ textAlign: 'center', padding: '4px 8px', cursor: 'pointer', minWidth: 52 }}>
                <div style={{ fontSize: 18 }}>{t.ic}</div>
                <div style={{
                  fontSize: 10, marginTop: 2,
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