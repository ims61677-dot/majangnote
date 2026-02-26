'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const bx = {
  background: '#ffffff',
  borderRadius: 16,
  border: '1px solid #E8ECF0',
  padding: 16,
  marginBottom: 12,
  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
}

function fmtW(n: number) { return n.toLocaleString('ko-KR') + '원' }

export default function DashPage() {
  const supabase = createSupabaseBrowserClient()
  const router = useRouter()
  const now = new Date()
  const [yr, setYr] = useState(now.getFullYear())
  const [mo, setMo] = useState(now.getMonth() + 1)
  const [storeId, setStoreId] = useState('')

  // 마감일지 매출
  const [closings, setClosings] = useState<any[]>([])       // closings rows
  const [salesRows, setSalesRows] = useState<any[]>([])     // closing_sales rows

  // 재고
  const [inventory, setInventory] = useState<any[]>([])

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    if (!store.id) return
    setStoreId(store.id)
  }, [])

  useEffect(() => {
    if (!storeId) return
    loadSales(storeId)
    loadInventory(storeId)
  }, [storeId, yr, mo])

  useEffect(() => {
    function handleFocus() {
      const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
      if (store.id && store.id !== storeId) setStoreId(store.id)
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [storeId])

  async function loadSales(sid: string) {
    const from = `${yr}-${String(mo).padStart(2, '0')}-01`
    const to = `${yr}-${String(mo).padStart(2, '0')}-${String(new Date(yr, mo, 0).getDate()).padStart(2, '0')}`

    // ✅ closing_date 컬럼으로 올바르게 조회
    const { data: cls } = await supabase
      .from('closings')
      .select('id, closing_date')
      .eq('store_id', sid)
      .gte('closing_date', from)
      .lte('closing_date', to)
    setClosings(cls || [])

    if (!cls || cls.length === 0) { setSalesRows([]); return }

    // ✅ closing_sales 테이블에서 매출 조회
    const { data: sv } = await supabase
      .from('closing_sales')
      .select('closing_id, platform, amount')
      .in('closing_id', cls.map((c: any) => c.id))
    setSalesRows(sv || [])
  }

  async function loadInventory(sid: string) {
    const { data } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('store_id', sid)
    setInventory(data || [])
  }

  // 날짜별 매출 합산
  const dailySales = useMemo(() => {
    return closings.map(cl => {
      const total = salesRows
        .filter(s => s.closing_id === cl.id)
        .reduce((sum, s) => sum + (s.amount || 0), 0)
      const day = parseInt(cl.closing_date.split('-')[2])
      return { d: day, t: total, date: cl.closing_date }
    }).filter(x => x.t > 0)
  }, [closings, salesRows])

  const stats = useMemo(() => {
    if (!dailySales.length) return null
    const tot = dailySales.reduce((a, x) => a + x.t, 0)
    return {
      tot,
      avg: Math.round(tot / dailySales.length),
      days: dailySales.length,
      mx: dailySales.reduce((a, b) => a.t > b.t ? a : b),
    }
  }, [dailySales])

  // 재고 부족/주의 필터
  const alertItems = useMemo(() => {
    return inventory.filter(item => {
      if (item.status === 'low' || item.status === 'out') return true
      // status 없으면 수량으로 판단
      if (item.quantity !== null && item.quantity !== undefined) {
        if (item.quantity === 0) return true
        if (item.min_quantity && item.quantity <= item.min_quantity) return true
      }
      return false
    })
  }, [inventory])

  const dangerItems = alertItems.filter(i => i.quantity === 0 || i.status === 'out')
  const warnItems = alertItems.filter(i => i.quantity !== 0 && i.status !== 'out')

  return (
    <div>
      {/* 월 선택 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={() => { if (mo === 1) { setYr(yr - 1); setMo(12) } else setMo(mo - 1) }}
          style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: '#555', fontSize: 14 }}>←</button>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>{yr}년 {mo}월</span>
        <button onClick={() => { if (mo === 12) { setYr(yr + 1); setMo(1) } else setMo(mo + 1) }}
          style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: '#555', fontSize: 14 }}>→</button>
      </div>

      {/* 재고 알림 - 부족/주의 있을 때만 표시 */}
      {alertItems.length > 0 && (
        <div
          onClick={() => router.push('/inventory')}
          style={{
            ...bx,
            cursor: 'pointer',
            border: dangerItems.length > 0 ? '1px solid rgba(232,67,147,0.4)' : '1px solid rgba(253,196,0,0.4)',
            background: dangerItems.length > 0 ? 'rgba(232,67,147,0.04)' : 'rgba(253,196,0,0.04)',
          }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>{dangerItems.length > 0 ? '🚨' : '⚠️'}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: dangerItems.length > 0 ? '#E84393' : '#B8860B' }}>
                재고 {dangerItems.length > 0 ? '부족' : '주의'} 알림
              </span>
            </div>
            <span style={{ fontSize: 11, color: '#aaa' }}>재고 탭으로 →</span>
          </div>

          {/* 부족 (수량 0) */}
          {dangerItems.length > 0 && (
            <div style={{ marginBottom: warnItems.length > 0 ? 8 : 0 }}>
              {dangerItems.slice(0, 3).map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: 'rgba(232,67,147,0.08)', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#1a1a2e' }}>{item.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#E84393', background: 'rgba(232,67,147,0.12)', padding: '2px 8px', borderRadius: 6 }}>재고 없음</span>
                </div>
              ))}
              {dangerItems.length > 3 && (
                <div style={{ fontSize: 11, color: '#E84393', textAlign: 'center', marginTop: 2 }}>외 {dangerItems.length - 3}개 더</div>
              )}
            </div>
          )}

          {/* 주의 (최소수량 이하) */}
          {warnItems.length > 0 && (
            <div>
              {warnItems.slice(0, 3).map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: 'rgba(253,196,0,0.08)', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#1a1a2e' }}>{item.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#B8860B', background: 'rgba(253,196,0,0.15)', padding: '2px 8px', borderRadius: 6 }}>
                    {item.quantity !== undefined ? `${item.quantity}${item.unit || ''}` : '주의'}
                  </span>
                </div>
              ))}
              {warnItems.length > 3 && (
                <div style={{ fontSize: 11, color: '#B8860B', textAlign: 'center', marginTop: 2 }}>외 {warnItems.length - 3}개 더</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 매출 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div style={{ ...bx, marginBottom: 0 }}>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>총 매출</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#FF6B35' }}>{stats ? fmtW(stats.tot) : '0원'}</div>
        </div>
        <div style={{ ...bx, marginBottom: 0 }}>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>일 평균</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e' }}>{stats ? fmtW(stats.avg) : '0원'}</div>
        </div>
        <div style={{ ...bx, marginBottom: 0 }}>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>영업일</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e' }}>{stats ? stats.days + '일' : '0일'}</div>
        </div>
        <div style={{ ...bx, marginBottom: 0 }}>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>최고 매출</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e' }}>{stats ? fmtW(stats.mx.t) : '0원'}</div>
        </div>
      </div>

      {/* 일별 매출 목록 */}
      <div style={bx}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>📋 마감 일지</div>
        {dailySales.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#bbb', fontSize: 13 }}>
            이번 달 마감 데이터가 없습니다
          </div>
        ) : (
          dailySales.sort((a, b) => b.d - a.d).map(s => (
            <div key={s.d} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F4F6F9' }}>
              <span style={{ fontSize: 13, color: '#666' }}>{mo}월 {s.d}일</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#FF6B35' }}>{fmtW(s.t)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}