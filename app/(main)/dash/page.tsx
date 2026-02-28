'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import YearMonthPicker from '@/components/YearMonthPicker'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }

function fmtW(n: number) {
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만원'
  return n.toLocaleString('ko-KR') + '원'
}
function fmtWFull(n: number) { return n.toLocaleString('ko-KR') + '원' }

function getStatus(tot: number, minQty: number, warnQty: number) {
  if (tot <= minQty) return 'low'
  if (tot <= warnQty) return 'warn'
  return 'ok'
}

// 이번 주 월~일 날짜 범위
function getThisWeekRange(year: number, month: number) {
  const today = new Date()
  const dow = today.getDay() // 0=일
  const mon = new Date(today); mon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  return { from: fmt(mon), to: fmt(sun), monDay: mon.getDate(), sunDay: sun.getDate() }
}

// 프로그레스바
function ProgressBar({ value, color = '#FF6B35', height = 10 }: { value: number; color?: string; height?: number }) {
  const pct = Math.min(Math.max(value, 0), 100)
  return (
    <div style={{ width:'100%', height, borderRadius:height, background:'#F0F2F5', overflow:'hidden' }}>
      <div style={{ width:`${pct}%`, height:'100%', borderRadius:height, background: pct >= 100 ? '#00B894' : color, transition:'width 0.5s ease' }} />
    </div>
  )
}

// 날짜별 바 차트
function BarChart({ data, maxVal, monthLabel }: { data: {d:number,t:number}[]; maxVal: number; monthLabel: number }) {
  if (!data.length) return null
  const barW = Math.max(Math.floor(300 / data.length) - 2, 8)
  return (
    <div style={{ overflowX:'auto', paddingBottom:4 }}>
      <div style={{ display:'flex', alignItems:'flex-end', gap:2, minWidth: data.length * (barW+2), height:80 }}>
        {data.map(s => {
          const h = maxVal > 0 ? Math.max(Math.round((s.t / maxVal) * 72), 4) : 4
          const isHigh = s.t === maxVal
          return (
            <div key={s.d} style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1 }}>
              <div style={{ width:'100%', height:h, borderRadius:'4px 4px 0 0',
                background: isHigh ? 'linear-gradient(180deg,#FF6B35,#E84393)' : 'rgba(255,107,53,0.5)',
                transition:'height 0.3s' }} />
              <div style={{ fontSize:8, color:'#bbb', marginTop:2, whiteSpace:'nowrap' }}>{s.d}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function DashPage() {
  const supabase = createSupabaseBrowserClient()
  const router = useRouter()
  const now = new Date()
  const [yr, setYr] = useState(now.getFullYear())
  const [mo, setMo] = useState(now.getMonth()) // 0-based
  const [storeId, setStoreId] = useState('')

  const [closings, setClosings] = useState<any[]>([])
  const [salesRows, setSalesRows] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [stock, setStock] = useState<any[]>([])
  const [goal, setGoal] = useState<any>(null)

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    if (!store.id) return
    setStoreId(store.id)
  }, [])

  useEffect(() => {
    if (!storeId) return
    loadAll(storeId)
  }, [storeId, yr, mo])

  useEffect(() => {
    function handleFocus() {
      const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
      if (store.id && store.id !== storeId) setStoreId(store.id)
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [storeId])

  async function loadAll(sid: string) {
    const moNum = mo + 1
    const from = `${yr}-${String(moNum).padStart(2,'0')}-01`
    const to = `${yr}-${String(moNum).padStart(2,'0')}-${String(new Date(yr, mo+1, 0).getDate()).padStart(2,'0')}`

    // 마감일지
    const { data: cls } = await supabase.from('closings').select('id, closing_date').eq('store_id', sid).gte('closing_date', from).lte('closing_date', to)
    setClosings(cls || [])
    if (cls && cls.length > 0) {
      const { data: sv } = await supabase.from('closing_sales').select('closing_id, amount').in('closing_id', cls.map((c:any) => c.id))
      setSalesRows(sv || [])
    } else { setSalesRows([]) }

    // 목표
    const { data: g } = await supabase.from('goals').select('*').eq('store_id', sid).eq('year', yr).eq('month', moNum).single()
    setGoal(g || null)

    // 재고
    const { data: it } = await supabase.from('inventory_items').select('id, name, unit, min_qty, warn_qty').eq('store_id', sid)
    setItems(it || [])
    if (it && it.length > 0) {
      const { data: st } = await supabase.from('inventory_stock').select('item_id, quantity').in('item_id', it.map((x:any) => x.id))
      setStock(st || [])
    }
  }

  const dailySales = useMemo(() => {
    return closings.map(cl => {
      const total = salesRows.filter(s => s.closing_id === cl.id).reduce((sum, s) => sum + (s.amount || 0), 0)
      const day = parseInt(cl.closing_date.split('-')[2])
      return { d: day, t: total, date: cl.closing_date }
    }).filter(x => x.t > 0).sort((a,b) => a.d - b.d)
  }, [closings, salesRows])

  const stats = useMemo(() => {
    if (!dailySales.length) return null
    const tot = dailySales.reduce((a, x) => a + x.t, 0)
    const mx = dailySales.reduce((a, b) => a.t > b.t ? a : b)
    return { tot, avg: Math.round(tot / dailySales.length), days: dailySales.length, mx }
  }, [dailySales])

  // 목표 달성률
  const monthGoal = useMemo(() => {
    if (!goal) return 0
    // 이번 달 실제 평일/주말 수 계산
    const daysInMonth = new Date(yr, mo+1, 0).getDate()
    let weekdays = 0, weekends = 0
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(yr, mo, d).getDay()
      if (dow === 0 || dow === 6) weekends++; else weekdays++
    }
    return (goal.weekday_goal || 0) * weekdays + (goal.weekend_goal || 0) * weekends
  }, [goal, yr, mo])

  const achieveRate = monthGoal > 0 && stats ? Math.round((stats.tot / monthGoal) * 100) : 0

  // 이번 주 매출
  const weekSales = useMemo(() => {
    const { from, to } = getThisWeekRange(yr, mo)
    return dailySales.filter(s => s.date >= from && s.date <= to).reduce((sum, s) => sum + s.t, 0)
  }, [dailySales, yr, mo])

  // 이번 주 목표 (평일5 + 주말2 기준)
  const weekGoal = useMemo(() => {
    if (!goal) return 0
    return (goal.weekday_goal || 0) * 5 + (goal.weekend_goal || 0) * 2
  }, [goal])

  const weekAchieveRate = weekGoal > 0 ? Math.round((weekSales / weekGoal) * 100) : 0

  // 재고
  const totalQtyMap = useMemo(() => {
    const map: Record<string, number> = {}
    stock.forEach(s => { map[s.item_id] = (map[s.item_id] || 0) + (s.quantity || 0) })
    return map
  }, [stock])

  const lowItems = useMemo(() => items.filter(item => getStatus(totalQtyMap[item.id] ?? 0, item.min_qty ?? 1, item.warn_qty ?? 3) === 'low'), [items, totalQtyMap])
  const warnItems = useMemo(() => items.filter(item => getStatus(totalQtyMap[item.id] ?? 0, item.min_qty ?? 1, item.warn_qty ?? 3) === 'warn'), [items, totalQtyMap])
  const hasAlert = lowItems.length > 0 || warnItems.length > 0

  const maxSales = dailySales.length ? Math.max(...dailySales.map(s => s.t)) : 0
  const isCurrentMonth = yr === now.getFullYear() && mo === now.getMonth()

  return (
    <div>
      {/* 월 선택 */}
      <div style={{ marginBottom: 16 }}>
        <YearMonthPicker year={yr} month={mo} onChange={(y, m) => { setYr(y); setMo(m) }} color="#FF6B35" />
      </div>

      {/* 재고 알림 - 심플하게 */}
      {hasAlert && (
        <div onClick={() => router.push('/inventory')} style={{ ...bx, cursor:'pointer',
          border: lowItems.length > 0 ? '1px solid rgba(232,67,147,0.4)' : '1px solid rgba(253,196,0,0.4)',
          background: lowItems.length > 0 ? 'rgba(232,67,147,0.03)' : 'rgba(253,196,0,0.03)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:16 }}>{lowItems.length > 0 ? '🚨' : '⚠️'}</span>
              <span style={{ fontSize:13, fontWeight:700, color: lowItems.length > 0 ? '#E84393' : '#B8860B' }}>재고 알림</span>
              {lowItems.length > 0 && (
                <span style={{ fontSize:11, background:'rgba(232,67,147,0.12)', color:'#E84393', padding:'2px 8px', borderRadius:6, fontWeight:700 }}>
                  부족 {lowItems.length}건
                </span>
              )}
              {warnItems.length > 0 && (
                <span style={{ fontSize:11, background:'rgba(253,196,0,0.15)', color:'#B8860B', padding:'2px 8px', borderRadius:6, fontWeight:700 }}>
                  주의 {warnItems.length}건
                </span>
              )}
            </div>
            <span style={{ fontSize:11, color:'#bbb' }}>재고 탭 →</span>
          </div>
        </div>
      )}

      {/* 월 목표 달성률 */}
      <div style={bx}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>🎯 {mo+1}월 목표 달성률</span>
          {monthGoal > 0 && (
            <span style={{ fontSize:12, color: achieveRate >= 100 ? '#00B894' : '#FF6B35', fontWeight:700 }}>
              {achieveRate}%
            </span>
          )}
        </div>
        {monthGoal > 0 ? (
          <>
            <ProgressBar value={achieveRate} color="#FF6B35" height={12} />
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
              <div>
                <div style={{ fontSize:10, color:'#aaa' }}>현재 매출</div>
                <div style={{ fontSize:15, fontWeight:800, color:'#FF6B35' }}>{fmtW(stats?.tot || 0)}</div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:10, color:'#aaa' }}>월 목표</div>
                <div style={{ fontSize:15, fontWeight:800, color:'#1a1a2e' }}>{fmtW(monthGoal)}</div>
              </div>
            </div>
            {achieveRate >= 100 && (
              <div style={{ marginTop:10, textAlign:'center', fontSize:12, color:'#00B894', fontWeight:700, background:'rgba(0,184,148,0.08)', borderRadius:8, padding:'6px 0' }}>
                🎉 이번 달 목표 달성!
              </div>
            )}
            {achieveRate < 100 && stats && (
              <div style={{ marginTop:8, fontSize:11, color:'#aaa', textAlign:'right' }}>
                목표까지 {fmtW(monthGoal - stats.tot)} 남음
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign:'center', padding:'12px 0', color:'#bbb', fontSize:12 }}>
            목표매출 탭에서 이번 달 목표를 설정해주세요
          </div>
        )}
      </div>

      {/* 주간 목표 달성률 - 이번 달일 때만 표시 */}
      {isCurrentMonth && (
        <div style={bx}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>📅 이번 주 달성률</span>
            {weekGoal > 0 && (
              <span style={{ fontSize:12, color: weekAchieveRate >= 100 ? '#00B894' : '#6C5CE7', fontWeight:700 }}>
                {weekAchieveRate}%
              </span>
            )}
          </div>
          {weekGoal > 0 ? (
            <>
              <ProgressBar value={weekAchieveRate} color="#6C5CE7" height={12} />
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
                <div>
                  <div style={{ fontSize:10, color:'#aaa' }}>이번 주 매출</div>
                  <div style={{ fontSize:15, fontWeight:800, color:'#6C5CE7' }}>{fmtW(weekSales)}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:10, color:'#aaa' }}>주간 목표</div>
                  <div style={{ fontSize:15, fontWeight:800, color:'#1a1a2e' }}>{fmtW(weekGoal)}</div>
                </div>
              </div>
              {weekAchieveRate >= 100 && (
                <div style={{ marginTop:10, textAlign:'center', fontSize:12, color:'#00B894', fontWeight:700, background:'rgba(0,184,148,0.08)', borderRadius:8, padding:'6px 0' }}>
                  🎉 이번 주 목표 달성!
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign:'center', padding:'12px 0', color:'#bbb', fontSize:12 }}>
              목표매출 탭에서 목표를 설정해주세요
            </div>
          )}
        </div>
      )}

      {/* 매출 요약 카드 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
        <div style={{ ...bx, marginBottom:0 }}>
          <div style={{ fontSize:11, color:'#999', marginBottom:4 }}>총 매출</div>
          <div style={{ fontSize:18, fontWeight:800, color:'#FF6B35' }}>{stats ? fmtW(stats.tot) : '0원'}</div>
        </div>
        <div style={{ ...bx, marginBottom:0 }}>
          <div style={{ fontSize:11, color:'#999', marginBottom:4 }}>일 평균</div>
          <div style={{ fontSize:18, fontWeight:800, color:'#1a1a2e' }}>{stats ? fmtW(stats.avg) : '0원'}</div>
        </div>
        <div style={{ ...bx, marginBottom:0 }}>
          <div style={{ fontSize:11, color:'#999', marginBottom:4 }}>영업일</div>
          <div style={{ fontSize:18, fontWeight:800, color:'#1a1a2e' }}>{stats ? stats.days + '일' : '0일'}</div>
        </div>
        <div style={{ ...bx, marginBottom:0 }}>
          <div style={{ fontSize:11, color:'#999', marginBottom:4 }}>최고 매출</div>
          <div style={{ fontSize:18, fontWeight:800, color:'#1a1a2e' }}>{stats ? fmtW(stats.mx.t) : '0원'}</div>
          {stats && <div style={{ fontSize:9, color:'#bbb', marginTop:2 }}>{mo+1}월 {stats.mx.d}일</div>}
        </div>
      </div>

      {/* 날짜별 바 차트 */}
      {dailySales.length > 0 && (
        <div style={bx}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>📊 일별 매출</span>
            <span style={{ fontSize:10, color:'#bbb' }}>{mo+1}월 {dailySales.length}일 영업</span>
          </div>
          <BarChart data={dailySales} maxVal={maxSales} monthLabel={mo+1} />
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontSize:10, color:'#bbb' }}>
            <span>최저 {fmtW(Math.min(...dailySales.map(s => s.t)))}</span>
            <span>최고 {fmtW(maxSales)}</span>
          </div>
        </div>
      )}

      {/* 마감 일지 리스트 */}
      <div style={bx}>
        <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:12 }}>📋 마감 일지</div>
        {dailySales.length === 0 ? (
          <div style={{ textAlign:'center', padding:'20px 0', color:'#bbb', fontSize:13 }}>이번 달 마감 데이터가 없습니다</div>
        ) : (
          [...dailySales].sort((a,b) => b.d - a.d).map(s => (
            <div key={s.d} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid #F4F6F9' }}>
              <span style={{ fontSize:13, color:'#666' }}>{mo+1}월 {s.d}일</span>
              <div style={{ textAlign:'right' }}>
                <span style={{ fontSize:14, fontWeight:700, color:'#FF6B35' }}>{fmtWFull(s.t)}</span>
                {monthGoal > 0 && (
                  <div style={{ fontSize:10, color:'#bbb' }}>
                    {(() => {
                      const dow = new Date(yr, mo, s.d).getDay()
                      const dayGoal = (dow === 0 || dow === 6) ? (goal?.weekend_goal || 0) : (goal?.weekday_goal || 0)
                      if (!dayGoal) return null
                      const rate = Math.round((s.t / dayGoal) * 100)
                      return <span style={{ color: rate >= 100 ? '#00B894' : rate >= 80 ? '#FF6B35' : '#E84393' }}>목표대비 {rate}%</span>
                    })()}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}