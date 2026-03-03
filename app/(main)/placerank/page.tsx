'use client'
import { usePathname } from 'next/navigation'
import BottomNav from '@/components/BottomNav'
import PlaceRankChecker from '@/components/PlaceRankChecker'

export default function PlaceRankPage() {
  const pathname = usePathname()
  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 100px' }}>
        <PlaceRankChecker />
      </div>
      <BottomNav current={pathname} />
    </div>
  )
}