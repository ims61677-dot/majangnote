'use client'
import { useEffect, useState, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const }
const ta = { ...{ width: '100%', padding: '10px 12px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, resize: 'vertical' as const, minHeight: 80 } }

function toComma(v: number) { return v > 0 ? v.toLocaleString('ko-KR') : '' }
function fromComma(s: string) { return Number(String(s).replace(/[^0-9]/g, '')) || 0 }
function fmtW(n: number) {
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만원'
  return n.toLocaleString('ko-KR') + '원'
}

function ProgressBar({ value, color = '#FF6B35', height = 8 }: { value: number; color?: string; height?: number }) {
  const pct = Math.min(Math.max(value, 0), 100)
  return (
    <div style={{ width: '100%', height, borderRadius: height, background: '#F0F2F5', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: height, background: pct >= 100 ? '#00B894' : color, transition: 'width 0.5s ease' }} />
    </div>
  )
}

// 날짜 유틸
function getDaysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate() }
function getDow(y: number, m: number, d: number) { return new Date(y, m - 1, d).getDay() }
function getWeekNumber(y: number, m: number, d: number) {
  const date = new Date(y, m - 1, d)
  const startOfMonth = new Date(y, m - 1, 1)
  const startDow = startOfMonth.getDay()
  return Math.ceil((d + (startDow === 0 ? 6 : startDow - 1)) / 7)
}
function getWeeksInMonth(y: number, m: number) {
  const days = getDaysInMonth(y, m)
  return getWeekNumber(y, m, days)
}
function getWeekDays(y: number, m: number, week: number) {
  const days = []
  const total = getDaysInMonth(y, m)
  for (let d = 1; d <= total; d++) {
    if (getWeekNumber(y, m, d) === week) days.push(d)
  }
  return days
}

const TABS = ['월 목표', '주 목표', '일 목표', '리뷰', '액션플랜']
const DOW_LABEL = ['일', '월', '화', '수', '목', '금', '토']
const FAIL_CHECKS = ['날씨/외부 요인', '인력 부족', '재고 부족', '서비스 문제', '경쟁사 영향', '마케팅 부족', '시즌 비수기', '기타']

export default function GoalPage() {
  const supabase = createSupabaseBrowserClient()
  const now = new Date()
  const [yr, setYr] = useState(now.getFullYear())
  const [mo, setMo] = useState(now.getMonth() + 1)
  const [storeId, setStoreId] = useState('')
  const [myRole, setMyRole] = useState('')
  const [myName, setMyName] = useState('')
  const [tab, setTab] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // 목표 데이터
  const [monthGoal, setMonthGoal] = useState(0)
  const [weekGoals, setWeekGoals] = useState<Record<number, number>>({})
  const [dayGoals, setDayGoals] = useState<Record<number, number>>({})
  const [goalNote, setGoalNote] = useState('')

  // 실제 매출 데이터
  const [dailySales, setDailySales] = useState<Record<number, number>>({})

  // 리뷰
  const [goodPoints, setGoodPoints] = useState('')
  const [badPoints, setBadPoints] = useState('')
  const [nextStrategy, setNextStrategy] = useState('')
  const [failReasons, setFailReasons] = useState<string[]>([])
  const [failComment, setFailComment] = useState('')

  // 액션 플랜
  const [actionPlans, setActionPlans] = useState<any[]>([])
  const [newPlanTitle, setNewPlanTitle] = useState('')
  const [newPlanDesc, setNewPlanDesc] = useState('')
  const [showAddPlan, setShowAddPlan] = useState(false)

  const isOwner = myRole === 'owner'
  const isManager = myRole === 'manager'
  const canEdit = isOwner || isManager
  const totalWeeks = getWeeksInMonth(yr, mo)
  const daysInMonth = getDaysInMonth(yr, mo)

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id)
    setMyRole(user.role)
    setMyName(user.nm || '')
    loadAll(store.id, yr, mo)
  }, [yr, mo])

  async function loadAll(sid: string, y: number, m: number) {
    // 목표 로드
    const { data: g } = await supabase.from('goals').select('*').eq('store_id', sid).eq('year', y).eq('month', m).single()
    if (g) {
      setMonthGoal(g.weekday_goal * 20 + g.weekend_goal * 8 || 0)
      setWeekGoals(g.weekly_goals || {})
      setDayGoals(g.daily_goals || {})
      setGoalNote(g.note || '')
    } else {
      setMonthGoal(0); setWeekGoals({}); setDayGoals({}); setGoalNote('')
    }

    // 실제 매출 로드
    const from = `${y}-${String(m).padStart(2, '0')}-01`
    const to = `${y}-${String(m).padStart(2, '0')}-${String(getDaysInMonth(y, m)).padStart(2, '0')}`
    const { data: cls } = await supabase.from('closings').select('id, closing_date').eq('store_id', sid).gte('closing_date', from).lte('closing_date', to)
    if (cls && cls.length > 0) {
      const { data: sv } = await supabase.from('closing_sales').select('closing_id, amount').in('closing_id', cls.map((c: any) => c.id))
      const map: Record<number, number> = {}
      cls.forEach((cl: any) => {
        const day = parseInt(cl.closing_date.split('-')[2])
        const total = (sv || []).filter((s: any) => s.closing_id === cl.id).reduce((a: number, s: any) => a + (s.amount || 0), 0)
        if (total > 0) map[day] = total
      })
      setDailySales(map)
    } else { setDailySales({}) }

    // 리뷰 로드
    const { data: rv } = await supabase.from('goal_reviews').select('*').eq('store_id', sid).eq('year', y).eq('month', m).single()
    if (rv) {
      setGoodPoints(rv.good_points || ''); setBadPoints(rv.bad_points || '')
      setNextStrategy(rv.next_strategy || ''); setFailReasons(rv.fail_reasons || [])
      setFailComment(rv.fail_comment || '')
    } else { setGoodPoints(''); setBadPoints(''); setNextStrategy(''); setFailReasons([]); setFailComment('') }

    // 액션 플랜 로드
    const { data: ap } = await supabase.from('goal_action_plans').select('*').eq('store_id', sid).eq('year', y).eq('month', m).order('sort_order')
    setActionPlans(ap || [])
  }

  // 매출 집계
  const totalSales = useMemo(() => Object.values(dailySales).reduce((a, b) => a + b, 0), [dailySales])
  const weekSales = useMemo(() => {
    const map: Record<number, number> = {}
    Object.entries(dailySales).forEach(([d, t]) => {
      const w = getWeekNumber(yr, mo, parseInt(d))
      map[w] = (map[w] || 0) + t
    })
    return map
  }, [dailySales, yr, mo])

  const monthAchieve = monthGoal > 0 ? Math.round((totalSales / monthGoal) * 100) : 0

  async function saveGoals() {
    if (!storeId || !canEdit) return
    setSaving(true)
    await supabase.from('goals').upsert({
      store_id: storeId, year: yr, month: mo,
      weekday_goal: 0, weekend_goal: 0,
      weekly_goals: weekGoals, daily_goals: dayGoals, note: goalNote
    }, { onConflict: 'store_id,year,month' })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveReview() {
    if (!storeId || !canEdit) return
    setSaving(true)
    await supabase.from('goal_reviews').upsert({
      store_id: storeId, year: yr, month: mo,
      good_points: goodPoints, bad_points: badPoints,
      next_strategy: nextStrategy, fail_reasons: failReasons,
      fail_comment: failComment, created_by: myName
    }, { onConflict: 'store_id,year,month' })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function addActionPlan() {
    if (!newPlanTitle.trim() || !storeId) return
    const { data } = await supabase.from('goal_action_plans').insert({
      store_id: storeId, year: yr, month: mo,
      title: newPlanTitle.trim(), description: newPlanDesc.trim() || null,
      sort_order: actionPlans.length, created_by: myName
    }).select().single()
    if (data) setActionPlans(p => [...p, data])
    setNewPlanTitle(''); setNewPlanDesc(''); setShowAddPlan(false)
  }

  async function togglePlan(id: string, checked: boolean) {
    await supabase.from('goal_action_plans').update({ is_checked: checked, checked_by: checked ? myName : null, checked_at: checked ? new Date().toISOString() : null }).eq('id', id)
    setActionPlans(p => p.map(a => a.id === id ? { ...a, is_checked: checked, checked_by: checked ? myName : null } : a))
  }

  async function deletePlan(id: string) {
    if (!confirm('삭제할까요?')) return
    await supabase.from('goal_action_plans').delete().eq('id', id)
    setActionPlans(p => p.filter(a => a.id !== id))
  }

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>🎯 목표매출</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => { if (mo === 1) { setYr(yr - 1); setMo(12) } else setMo(mo - 1) }}
            style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 14 }}>←</button>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', minWidth: 80, textAlign: 'center' }}>{yr}년 {mo}월</span>
          <button onClick={() => { if (mo === 12) { setYr(yr + 1); setMo(1) } else setMo(mo + 1) }}
            style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 14 }}>→</button>
        </div>
      </div>

      {/* 월 달성률 요약 */}
      <div style={{ ...bx, background: 'linear-gradient(135deg,rgba(255,107,53,0.06),rgba(232,67,147,0.06))', border: '1px solid rgba(255,107,53,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{mo}월 전체 달성률</span>
          <span style={{ fontSize: 16, fontWeight: 900, color: monthAchieve >= 100 ? '#00B894' : '#FF6B35' }}>{monthAchieve}%</span>
        </div>
        <ProgressBar value={monthAchieve} color="#FF6B35" height={12} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 10, color: '#aaa' }}>실제 매출</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#FF6B35' }}>{fmtW(totalSales)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#aaa' }}>월 목표</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a2e' }}>{monthGoal > 0 ? fmtW(monthGoal) : '미설정'}</div>
          </div>
        </div>
        {monthGoal > 0 && totalSales < monthGoal && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#aaa', textAlign: 'right' }}>목표까지 {fmtW(monthGoal - totalSales)} 남음</div>
        )}
        {monthAchieve >= 100 && (
          <div style={{ marginTop: 10, textAlign: 'center', fontSize: 12, color: '#00B894', fontWeight: 700, background: 'rgba(0,184,148,0.08)', borderRadius: 8, padding: '6px 0' }}>🎉 이번 달 목표 달성!</div>
        )}
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto' }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)}
            style={{ padding: '7px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              background: tab === i ? 'linear-gradient(135deg,#FF6B35,#E84393)' : '#F4F6F9',
              color: tab === i ? '#fff' : '#888' }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── 월 목표 탭 ── */}
      {tab === 0 && (
        <div>
          <div style={bx}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 14 }}>📅 {mo}월 목표 설정</div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>월 목표 금액</div>
            <input value={toComma(monthGoal)} onChange={e => canEdit && setMonthGoal(fromComma(e.target.value))}
              placeholder="0" readOnly={!canEdit}
              style={{ ...inp, textAlign: 'right', marginBottom: 12, fontSize: 18, fontWeight: 700 }} />
            <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>메모</div>
            <textarea value={goalNote} onChange={e => canEdit && setGoalNote(e.target.value)}
              placeholder="목표 설정 배경, 전략 메모..." style={ta} readOnly={!canEdit} />
            {canEdit && (
              <button onClick={saveGoals} disabled={saving}
                style={{ width: '100%', marginTop: 12, padding: 12, borderRadius: 10, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  background: saved ? '#00B894' : saving ? '#ccc' : 'linear-gradient(135deg,#FF6B35,#E84393)' }}>
                {saved ? '✓ 저장완료!' : saving ? '저장 중...' : '💾 저장'}
              </button>
            )}
          </div>

          {/* 월간 캘린더 */}
          <div style={bx}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>📊 일별 현황</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 6 }}>
              {DOW_LABEL.map(d => (
                <div key={d} style={{ fontSize: 10, color: '#bbb', textAlign: 'center', fontWeight: 600 }}>{d}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
              {/* 빈 칸 */}
              {Array.from({ length: getDow(yr, mo, 1) }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const d = i + 1
                const dow = getDow(yr, mo, d)
                const sale = dailySales[d] || 0
                const goal = dayGoals[d] || 0
                const rate = goal > 0 ? Math.round((sale / goal) * 100) : null
                const isToday = yr === now.getFullYear() && mo === now.getMonth() + 1 && d === now.getDate()
                const isWeekend = dow === 0 || dow === 6
                return (
                  <div key={d} style={{ borderRadius: 8, padding: '4px 2px', textAlign: 'center', minHeight: 52,
                    background: sale > 0 ? (rate !== null && rate >= 100 ? 'rgba(0,184,148,0.08)' : 'rgba(255,107,53,0.06)') : '#F8F9FB',
                    border: isToday ? '2px solid #FF6B35' : '1px solid #F0F2F5' }}>
                    <div style={{ fontSize: 11, fontWeight: isToday ? 800 : 500, color: isWeekend ? '#6C5CE7' : '#555' }}>{d}</div>
                    {sale > 0 && <div style={{ fontSize: 9, color: '#FF6B35', fontWeight: 700, marginTop: 1 }}>{fmtW(sale)}</div>}
                    {rate !== null && <div style={{ fontSize: 8, color: rate >= 100 ? '#00B894' : '#E84393', fontWeight: 600 }}>{rate}%</div>}
                    {goal > 0 && sale === 0 && <div style={{ fontSize: 8, color: '#ccc' }}>목표{fmtW(goal)}</div>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── 주 목표 탭 ── */}
      {tab === 1 && (
        <div>
          {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(week => {
            const weekDays = getWeekDays(yr, mo, week)
            const wGoal = weekGoals[week] || 0
            const wSale = weekSales[week] || 0
            const wRate = wGoal > 0 ? Math.round((wSale / wGoal) * 100) : 0
            return (
              <div key={week} style={bx}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{week}주차 ({mo}월 {weekDays[0]}일~{weekDays[weekDays.length - 1]}일)</span>
                  {wGoal > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: wRate >= 100 ? '#00B894' : '#6C5CE7' }}>{wRate}%</span>}
                </div>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>주간 목표</div>
                <input value={toComma(wGoal)} onChange={e => canEdit && setWeekGoals(p => ({ ...p, [week]: fromComma(e.target.value) }))}
                  placeholder="0" readOnly={!canEdit}
                  style={{ ...inp, textAlign: 'right', marginBottom: wGoal > 0 ? 10 : 0 }} />
                {wGoal > 0 && (
                  <>
                    <ProgressBar value={wRate} color="#6C5CE7" height={8} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      <div style={{ fontSize: 11, color: '#aaa' }}>실제 {fmtW(wSale)}</div>
                      <div style={{ fontSize: 11, color: '#aaa' }}>목표 {fmtW(wGoal)}</div>
                    </div>
                    {/* 해당 주 일별 매출 */}
                    <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
                      {weekDays.map(d => {
                        const dow = getDow(yr, mo, d)
                        const sale = dailySales[d] || 0
                        return (
                          <div key={d} style={{ flex: 1, textAlign: 'center', background: sale > 0 ? 'rgba(108,92,231,0.08)' : '#F8F9FB', borderRadius: 8, padding: '6px 2px' }}>
                            <div style={{ fontSize: 9, color: dow === 0 || dow === 6 ? '#6C5CE7' : '#aaa' }}>{DOW_LABEL[dow]}</div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#555', marginTop: 2 }}>{d}</div>
                            {sale > 0 && <div style={{ fontSize: 9, color: '#FF6B35', fontWeight: 700, marginTop: 2 }}>{fmtW(sale)}</div>}
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            )
          })}
          {canEdit && (
            <button onClick={saveGoals} disabled={saving}
              style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                background: saved ? '#00B894' : saving ? '#ccc' : 'linear-gradient(135deg,#FF6B35,#E84393)' }}>
              {saved ? '✓ 저장완료!' : saving ? '저장 중...' : '💾 주간 목표 저장'}
            </button>
          )}
        </div>
      )}

      {/* ── 일 목표 탭 ── */}
      {tab === 2 && (
        <div>
          <div style={{ fontSize: 12, color: '#aaa', marginBottom: 12, textAlign: 'center' }}>날짜별 목표를 직접 설정하세요</div>
          {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(week => {
            const weekDays = getWeekDays(yr, mo, week)
            return (
              <div key={week} style={bx}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 10 }}>{week}주차</div>
                {weekDays.map(d => {
                  const dow = getDow(yr, mo, d)
                  const isWeekend = dow === 0 || dow === 6
                  const sale = dailySales[d] || 0
                  const goal = dayGoals[d] || 0
                  const rate = goal > 0 ? Math.round((sale / goal) * 100) : null
                  return (
                    <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '8px 10px', borderRadius: 10,
                      background: sale > 0 ? 'rgba(255,107,53,0.04)' : '#F8F9FB', border: '1px solid #F0F2F5' }}>
                      <div style={{ minWidth: 36, textAlign: 'center' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: isWeekend ? '#6C5CE7' : '#1a1a2e' }}>{d}일</div>
                        <div style={{ fontSize: 9, color: '#bbb' }}>{DOW_LABEL[dow]}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <input value={toComma(goal)} onChange={e => canEdit && setDayGoals(p => ({ ...p, [d]: fromComma(e.target.value) }))}
                          placeholder="목표 입력" readOnly={!canEdit}
                          style={{ ...inp, padding: '6px 10px', fontSize: 13, textAlign: 'right' }} />
                      </div>
                      <div style={{ minWidth: 70, textAlign: 'right' }}>
                        {sale > 0 ? (
                          <>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#FF6B35' }}>{fmtW(sale)}</div>
                            {rate !== null && <div style={{ fontSize: 10, color: rate >= 100 ? '#00B894' : '#E84393', fontWeight: 600 }}>{rate}%</div>}
                          </>
                        ) : (
                          <div style={{ fontSize: 10, color: '#ccc' }}>미기록</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
          {canEdit && (
            <button onClick={saveGoals} disabled={saving}
              style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                background: saved ? '#00B894' : saving ? '#ccc' : 'linear-gradient(135deg,#FF6B35,#E84393)' }}>
              {saved ? '✓ 저장완료!' : saving ? '저장 중...' : '💾 일별 목표 저장'}
            </button>
          )}
        </div>
      )}

      {/* ── 리뷰 탭 ── */}
      {tab === 3 && (
        <div>
          {/* 달성률 요약 */}
          <div style={{ ...bx, background: monthAchieve >= 100 ? 'rgba(0,184,148,0.06)' : 'rgba(232,67,147,0.06)', border: `1px solid ${monthAchieve >= 100 ? 'rgba(0,184,148,0.3)' : 'rgba(232,67,147,0.3)'}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: monthAchieve >= 100 ? '#00B894' : '#E84393' }}>
              {monthAchieve >= 100 ? '🎉 목표 달성!' : `😓 목표 미달성 (${monthAchieve}%)`}
            </div>
            <div style={{ fontSize: 12, color: '#888' }}>
              실제 매출 <strong style={{ color: '#FF6B35' }}>{fmtW(totalSales)}</strong> / 목표 <strong>{monthGoal > 0 ? fmtW(monthGoal) : '미설정'}</strong>
            </div>
          </div>

          {/* 실패 체크리스트 (미달성 시) */}
          {monthAchieve < 100 && monthGoal > 0 && (
            <div style={bx}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>❓ 미달성 원인 체크</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {FAIL_CHECKS.map(fc => (
                  <label key={fc} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, cursor: canEdit ? 'pointer' : 'default',
                    background: failReasons.includes(fc) ? 'rgba(232,67,147,0.08)' : '#F8F9FB',
                    border: `1px solid ${failReasons.includes(fc) ? 'rgba(232,67,147,0.3)' : '#E8ECF0'}` }}>
                    <input type="checkbox" checked={failReasons.includes(fc)} disabled={!canEdit}
                      onChange={e => setFailReasons(p => e.target.checked ? [...p, fc] : p.filter(r => r !== fc))}
                      style={{ accentColor: '#E84393' }} />
                    <span style={{ fontSize: 11, color: failReasons.includes(fc) ? '#E84393' : '#666', fontWeight: failReasons.includes(fc) ? 700 : 400 }}>{fc}</span>
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>추가 코멘트</div>
              <textarea value={failComment} onChange={e => canEdit && setFailComment(e.target.value)}
                placeholder="미달성 원인에 대한 상세 내용..." style={ta} readOnly={!canEdit} />
            </div>
          )}

          {/* 월간 리뷰 */}
          <div style={bx}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 14 }}>📝 월간 리뷰</div>
            <div style={{ fontSize: 11, color: '#00B894', fontWeight: 700, marginBottom: 6 }}>✅ 잘한 점</div>
            <textarea value={goodPoints} onChange={e => canEdit && setGoodPoints(e.target.value)}
              placeholder="이번 달 잘한 점, 성과..." style={{ ...ta, marginBottom: 12, borderColor: 'rgba(0,184,148,0.3)' }} readOnly={!canEdit} />
            <div style={{ fontSize: 11, color: '#E84393', fontWeight: 700, marginBottom: 6 }}>⚠️ 개선할 점</div>
            <textarea value={badPoints} onChange={e => canEdit && setBadPoints(e.target.value)}
              placeholder="이번 달 부족했던 점, 문제..." style={{ ...ta, marginBottom: 12, borderColor: 'rgba(232,67,147,0.3)' }} readOnly={!canEdit} />
            <div style={{ fontSize: 11, color: '#6C5CE7', fontWeight: 700, marginBottom: 6 }}>🚀 다음 달 전략</div>
            <textarea value={nextStrategy} onChange={e => canEdit && setNextStrategy(e.target.value)}
              placeholder="다음 달 목표 달성을 위한 전략..." style={{ ...ta, borderColor: 'rgba(108,92,231,0.3)' }} readOnly={!canEdit} />
          </div>

          {canEdit && (
            <button onClick={saveReview} disabled={saving}
              style={{ width: '100%', padding: 12, borderRadius: 10, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                background: saved ? '#00B894' : saving ? '#ccc' : 'linear-gradient(135deg,#FF6B35,#E84393)' }}>
              {saved ? '✓ 저장완료!' : saving ? '저장 중...' : '💾 리뷰 저장'}
            </button>
          )}
          {!canEdit && <div style={{ textAlign: 'center', padding: 12, fontSize: 12, color: '#bbb' }}>리뷰 작성은 대표/관리자만 가능합니다</div>}
        </div>
      )}

      {/* ── 액션 플랜 탭 ── */}
      {tab === 4 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 13, color: '#888' }}>완료 </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#00B894' }}>{actionPlans.filter(a => a.is_checked).length}</span>
              <span style={{ fontSize: 13, color: '#888' }}> / {actionPlans.length}개</span>
            </div>
            {canEdit && (
              <button onClick={() => setShowAddPlan(p => !p)}
                style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', color: '#FF6B35', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                + 추가
              </button>
            )}
          </div>

          {showAddPlan && canEdit && (
            <div style={{ ...bx, border: '1px solid rgba(255,107,53,0.3)', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>새 액션 플랜</div>
              <input value={newPlanTitle} onChange={e => setNewPlanTitle(e.target.value)} placeholder="액션 플랜 제목 (예: 점심 할인 이벤트 진행)" style={{ ...inp, marginBottom: 8 }} />
              <textarea value={newPlanDesc} onChange={e => setNewPlanDesc(e.target.value)} placeholder="상세 내용 (선택)" style={{ ...ta, minHeight: 60, marginBottom: 10 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={addActionPlan} style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>추가</button>
                <button onClick={() => setShowAddPlan(false)} style={{ padding: '10px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 13, cursor: 'pointer' }}>취소</button>
              </div>
            </div>
          )}

          {actionPlans.length === 0 && (
            <div style={{ ...bx, textAlign: 'center', padding: 32, color: '#bbb' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📋</div>
              <div style={{ fontSize: 13 }}>액션 플랜을 추가해보세요</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>매출 올리기 위한 구체적인 실행 계획</div>
            </div>
          )}

          {actionPlans.map((plan, idx) => (
            <div key={plan.id} style={{ ...bx, border: plan.is_checked ? '1px solid rgba(0,184,148,0.3)' : '1px solid #E8ECF0',
              background: plan.is_checked ? 'rgba(0,184,148,0.04)' : '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div onClick={() => togglePlan(plan.id, !plan.is_checked)}
                  style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${plan.is_checked ? '#00B894' : '#E0E4E8'}`,
                    background: plan.is_checked ? '#00B894' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0, marginTop: 2 }}>
                  {plan.is_checked && <span style={{ color: '#fff', fontSize: 14, fontWeight: 900 }}>✓</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: plan.is_checked ? '#aaa' : '#1a1a2e',
                    textDecoration: plan.is_checked ? 'line-through' : 'none', marginBottom: plan.description ? 4 : 0 }}>
                    {plan.title}
                  </div>
                  {plan.description && <div style={{ fontSize: 12, color: '#aaa', lineHeight: 1.5 }}>{plan.description}</div>}
                  {plan.is_checked && plan.checked_by && (
                    <div style={{ fontSize: 10, color: '#00B894', marginTop: 4 }}>✓ {plan.checked_by} 완료</div>
                  )}
                </div>
                {canEdit && (
                  <button onClick={() => deletePlan(plan.id)}
                    style={{ background: 'none', border: 'none', color: '#ddd', fontSize: 16, cursor: 'pointer', padding: '0 4px' }}>✕</button>
                )}
              </div>
            </div>
          ))}

          {actionPlans.length > 0 && (
            <div style={{ ...bx, background: '#F8F9FB' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 8 }}>진행률</div>
              <ProgressBar value={actionPlans.length > 0 ? Math.round((actionPlans.filter(a => a.is_checked).length / actionPlans.length) * 100) : 0} color="#00B894" height={10} />
              <div style={{ fontSize: 11, color: '#aaa', marginTop: 6, textAlign: 'right' }}>
                {actionPlans.filter(a => a.is_checked).length}/{actionPlans.length} 완료
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}