'use client'
import { useEffect, useState, useMemo } from 'react'
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
  const now = new Date()
  const [yr, setYr] = useState(now.getFullYear())
  const [mo, setMo] = useState(now.getMonth() + 1)
  const [closings, setClosings] = useState<any[]>([])
  const [channels, setChannels] = useState<any[]>([])
  const [storeId, setStoreId] = useState('')

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    if (!store.id) return
    setStoreId(store.id)
  }, [])

  useEffect(() => {
    if (!storeId) return
    loadData(storeId)
  }, [storeId, yr, mo])

  // 매장 변경 감지 (포커스 돌아올 때마다 체크)
  useEffect(() => {
    function handleFocus() {
      const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
      if (store.id && store.id !== storeId) {
        setStoreId(store.id)
      }
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [storeId])

  async function loadData(sid: string) {
    const from = `${yr}-${String(mo).padStart(2,'0')}-01`
    const to = `${yr}-${String(mo).padStart(2,'0')}-${String(new Date(yr,mo,0).getDate()).padStart(2,'0')}`
    const { data: cl } = await supabase.from('closings')
      .select('*').eq('store_id', sid).gte('date', from).lte('date', to)
    setClosings(cl || [])
    const { data: ch } = await supabase.from('sales_channels')
      .select('*').eq('store_id', sid).order('sort_order')
    setChannels(ch || [])
  }

  const sales = useMemo(() => {
    return closings.map(cl => {
      const cd: Record<string,number> = cl.channel_data || {}
      let t = 0
      channels.forEach((ch: any) => { t += cd[ch.key] || 0 })
      return { d: parseInt(cl.date.split('-')[2]), t }
    }).filter(x => x.t > 0)
  }, [closings, channels])

  const stats = useMemo(() => {
    if (!sales.length) return null
    const tot = sales.reduce((a, x) => a + x.t, 0)
    return {
      tot,
      avg: Math.round(tot / sales.length),
      days: sales.length,
      mx: sales.reduce((a, b) => a.t > b.t ? a : b),
    }
  }, [sales])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={() => { if (mo===1){setYr(yr-1);setMo(12)}else setMo(mo-1) }}
          style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: '#555', fontSize: 14 }}>←</button>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>{yr}년 {mo}월</span>
        <button onClick={() => { if (mo===12){setYr(yr+1);setMo(1)}else setMo(mo+1) }}
          style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: '#555', fontSize: 14 }}>→</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div style={{ ...bx, marginBottom: 0 }}>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>총 매출</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#FF6B35' }}>
            {stats ? fmtW(stats.tot) : '0원'}
          </div>
        </div>
        <div style={{ ...bx, marginBottom: 0 }}>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>일 평균</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e' }}>
            {stats ? fmtW(stats.avg) : '0원'}
          </div>
        </div>
        <div style={{ ...bx, marginBottom: 0 }}>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>영업일</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e' }}>
            {stats ? stats.days + '일' : '0일'}
          </div>
        </div>
        <div style={{ ...bx, marginBottom: 0 }}>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 6 }}>최고 매출</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e' }}>
            {stats ? fmtW(stats.mx.t) : '0원'}
          </div>
        </div>
      </div>

      <div style={bx}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>마감 일지</div>
        {sales.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#bbb', fontSize: 13 }}>
            이번 달 마감 데이터가 없습니다
          </div>
        ) : (
          sales.sort((a,b) => b.d - a.d).map(s => (
            <div key={s.d} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 0', borderBottom: '1px solid #F4F6F9' }}>
              <span style={{ fontSize: 13, color: '#666' }}>{mo}월 {s.d}일</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#FF6B35' }}>{fmtW(s.t)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}