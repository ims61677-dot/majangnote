'use client'
import { useEffect, useState, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import YearMonthPicker from '@/components/YearMonthPicker'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, textAlign: 'right' as const }
const ta = { width: '100%', padding: '9px 12px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 12, outline: 'none', boxSizing: 'border-box' as const, resize: 'vertical' as const, minHeight: 70, lineHeight: 1.6 }

function toComma(v: number) { return v > 0 ? v.toLocaleString('ko-KR') : '' }
function fromComma(s: string) { return Number(String(s).replace(/[^0-9]/g, '')) || 0 }
function fmtW(n: number) {
  if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '억'
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만원'
  return n.toLocaleString('ko-KR') + '원'
}

function ProgressBar({ value, color = '#FF6B35', height = 8 }: { value: number; color?: string; height?: number }) {
  const pct = Math.min(Math.max(value, 0), 100)
  return (
    <div style={{ width: '100%', height, borderRadius: height, background: '#F0F2F5', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: height, background: pct >= 100 ? '#00B894' : color, transition: 'width 0.5s' }} />
    </div>
  )
}

function getDaysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate() }
function getDow(y: number, m: number, d: number) { return new Date(y, m - 1, d).getDay() }
function getWeekNum(y: number, m: number, d: number) {
  const startDow = new Date(y, m - 1, 1).getDay()
  return Math.ceil((d + (startDow === 0 ? 6 : startDow - 1)) / 7)
}
function getWeeksInMonth(y: number, m: number) {
  return getWeekNum(y, m, getDaysInMonth(y, m))
}
function getWeekDays(y: number, m: number, week: number) {
  const days: number[] = []
  for (let d = 1; d <= getDaysInMonth(y, m); d++) {
    if (getWeekNum(y, m, d) === week) days.push(d)
  }
  return days
}

const DOW = ['일', '월', '화', '수', '목', '금', '토']
const FAIL_CHECKS = ['날씨/외부요인', '인력 부족', '재고 부족', '서비스 문제', '경쟁사 영향', '마케팅 부족', '시즌 비수기', '기타']

export default function GoalPage() {
  const supabase = createSupabaseBrowserClient()
  const now = new Date()
  const [yr, setYr] = useState(now.getFullYear())
  const [mo, setMo] = useState(now.getMonth()) // 0-based for YearMonthPicker
  const [storeId, setStoreId] = useState('')
  const [myRole, setMyRole] = useState('')
  const [myName, setMyName] = useState('')

  // 주간 목표: { [week]: { weekday: number, weekend: number } }
  const [weekGoals, setWeekGoals] = useState<Record<number, { weekday: number; weekend: number }>>({})
  // 주간 리뷰: { [week]: { failReasons, comment, action } }
  const [weekReviews, setWeekReviews] = useState<Record<number, { failReasons: string[]; comment: string; action: string }>>({})
  // 실제 매출
  const [dailySales, setDailySales] = useState<Record<number, number>>({})
  const [saving, setSaving] = useState(false)
  const [savedWeek, setSavedWeek] = useState<number | null>(null)
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null)

  const canEdit = myRole === 'owner' || myRole === 'manager'
  const moNum = mo + 1
  const totalWeeks = getWeeksInMonth(yr, moNum)
  const daysInMonth = getDaysInMonth(yr, moNum)

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id)
    setMyRole(user.role || '')
    setMyName(user.nm || '')
    loadAll(store.id, yr, moNum)
  }, [yr, mo])

  async function loadAll(sid: string, y: number, m: number) {
    // 목표 로드
    const { data: g } = await supabase.from('goals').select('*').eq('store_id', sid).eq('year', y).eq('month', m).single()
    if (g?.weekly_goals) setWeekGoals(g.weekly_goals)
    else setWeekGoals({})
    if (g?.week_reviews) setWeekReviews(g.week_reviews)
    else setWeekReviews({})

    // 실제 매출 로드 (마감일지 연동)
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
    } else setDailySales({})
  }

  // 주간 목표 계산
  const weekCalc = useMemo(() => {
    const result: Record<number, { goal: number; actual: number; weekdays: number; weekends: number }> = {}
    for (let w = 1; w <= totalWeeks; w++) {
      const days = getWeekDays(yr, moNum, w)
      let weekdays = 0, weekends = 0, actual = 0
      days.forEach(d => {
        const dow = getDow(yr, moNum, d)
        if (dow === 0 || dow === 6) weekends++; else weekdays++
        actual += dailySales[d] || 0
      })
      const wg = weekGoals[w] || { weekday: 0, weekend: 0 }
      const goal = wg.weekday * weekdays + wg.weekend * weekends
      result[w] = { goal, actual, weekdays, weekends }
    }
    return result
  }, [weekGoals, dailySales, yr, moNum, totalWeeks])

  // 월 목표 자동 합산
  const monthGoalTotal = useMemo(() => Object.values(weekCalc).reduce((a, b) => a + b.goal, 0), [weekCalc])
  const monthActualTotal = useMemo(() => Object.values(dailySales).reduce((a, b) => a + b, 0), [dailySales])
  const monthRate = monthGoalTotal > 0 ? Math.round((monthActualTotal / monthGoalTotal) * 100) : 0

  // 평균 weekday/weekend 목표 계산 (대시보드 연동용)
  const avgWeekday = useMemo(() => {
    const vals = Object.values(weekGoals).map(w => w.weekday).filter(v => v > 0)
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
  }, [weekGoals])
  const avgWeekend = useMemo(() => {
    const vals = Object.values(weekGoals).map(w => w.weekend).filter(v => v > 0)
    return vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
  }, [weekGoals])

  async function saveWeek(week: number) {
    if (!storeId || !canEdit) return
    setSaving(true)
    const newWeekGoals = { ...weekGoals }
    const newWeekReviews = { ...weekReviews }

    // goals 테이블에 저장 + 대시보드 연동용 weekday_goal/weekend_goal도 업데이트
    await supabase.from('goals').upsert({
      store_id: storeId, year: yr, month: moNum,
      weekday_goal: avgWeekday,
      weekend_goal: avgWeekend,
      weekly_goals: newWeekGoals,
      week_reviews: newWeekReviews,
    }, { onConflict: 'store_id,year,month' })

    setSaving(false)
    setSavedWeek(week)
    setTimeout(() => setSavedWeek(null), 2000)
  }

  function setWeekGoal(week: number, field: 'weekday' | 'weekend', val: number) {
    setWeekGoals(p => ({ ...p, [week]: { ...(p[week] || { weekday: 0, weekend: 0 }), [field]: val } }))
  }
  function setWeekReview(week: number, field: string, val: any) {
    setWeekReviews(p => ({ ...p, [week]: { ...(p[week] || { failReasons: [], comment: '', action: '' }), [field]: val } }))
  }

  return (
    <div>
      {/* YearMonthPicker */}
      <div style={{ marginBottom: 16 }}>
        <YearMonthPicker year={yr} month={mo} onChange={(y, m) => { setYr(y); setMo(m) }} color="#FF6B35" />
      </div>

      {/* 월 목표 요약 (자동 합산) */}
      <div style={{ ...bx, background: 'linear-gradient(135deg,rgba(255,107,53,0.07),rgba(232,67,147,0.07))', border: '1px solid rgba(255,107,53,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>📊 {moNum}월 전체 현황</div>
            <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>주간 목표 자동 합산</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: monthRate >= 100 ? '#00B894' : '#FF6B35' }}>{monthRate}%</div>
          </div>
        </div>
        <ProgressBar value={monthRate} color="#FF6B35" height={12} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
          <div>
            <div style={{ fontSize: 10, color: '#aaa' }}>실제 매출</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#FF6B35' }}>{fmtW(monthActualTotal)}</div>
          </div>
          {monthGoalTotal > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#aaa' }}>남은 금액</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: monthActualTotal >= monthGoalTotal ? '#00B894' : '#E84393' }}>
                {monthActualTotal >= monthGoalTotal ? '🎉 달성!' : fmtW(monthGoalTotal - monthActualTotal)}
              </div>
            </div>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: '#aaa' }}>월 목표 합계</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a2e' }}>{monthGoalTotal > 0 ? fmtW(monthGoalTotal) : '미설정'}</div>
          </div>
        </div>
      </div>

      {/* 주차별 카드 */}
      {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(week => {
        const days = getWeekDays(yr, moNum, week)
        const calc = weekCalc[week] || { goal: 0, actual: 0, weekdays: 0, weekends: 0 }
        const rate = calc.goal > 0 ? Math.round((calc.actual / calc.goal) * 100) : 0
        const wg = weekGoals[week] || { weekday: 0, weekend: 0 }
        const wr = weekReviews[week] || { failReasons: [], comment: '', action: '' }
        const isExpanded = expandedWeek === week
        const isCurrentWeek = yr === now.getFullYear() && moNum === now.getMonth() + 1 &&
          days.includes(now.getDate())
        const isSaved = savedWeek === week

        return (
          <div key={week} style={{ ...bx, border: isCurrentWeek ? '2px solid rgba(255,107,53,0.4)' : '1px solid #E8ECF0' }}>
            {/* 주차 헤더 */}
            <div onClick={() => setExpandedWeek(isExpanded ? null : week)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isCurrentWeek && <span style={{ fontSize: 10, background: 'rgba(255,107,53,0.15)', color: '#FF6B35', padding: '2px 7px', borderRadius: 6, fontWeight: 700 }}>이번 주</span>}
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{week}주차</span>
                  <span style={{ fontSize: 11, color: '#aaa' }}>{moNum}/{days[0]} ~ {moNum}/{days[days.length - 1]}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {calc.goal > 0 && (
                    <span style={{ fontSize: 13, fontWeight: 800, color: rate >= 100 ? '#00B894' : rate >= 70 ? '#FF6B35' : '#E84393' }}>
                      {rate}%
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: '#ccc' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* 주간 프로그레스바 */}
              {calc.goal > 0 && (
                <>
                  <ProgressBar value={rate} color={rate >= 100 ? '#00B894' : '#6C5CE7'} height={8} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontSize: 11, color: '#aaa' }}>실제 {fmtW(calc.actual)}</span>
                    <span style={{ fontSize: 11, color: '#aaa' }}>목표 {fmtW(calc.goal)}</span>
                  </div>
                </>
              )}

              {/* 일별 미니 현황 */}
              <div style={{ display: 'flex', gap: 3, marginTop: 10 }}>
                {days.map(d => {
                  const dow = getDow(yr, moNum, d)
                  const sale = dailySales[d] || 0
                  const isWeekend = dow === 0 || dow === 6
                  const isToday = yr === now.getFullYear() && moNum === now.getMonth() + 1 && d === now.getDate()
                  const dayGoal = isWeekend ? (wg.weekend || 0) : (wg.weekday || 0)
                  const dayRate = dayGoal > 0 && sale > 0 ? Math.round((sale / dayGoal) * 100) : null
                  return (
                    <div key={d} style={{ flex: 1, textAlign: 'center', borderRadius: 8, padding: '5px 2px',
                      background: sale > 0 ? (dayRate !== null && dayRate >= 100 ? 'rgba(0,184,148,0.1)' : 'rgba(255,107,53,0.07)') : '#F8F9FB',
                      border: isToday ? '2px solid #FF6B35' : '1px solid #F0F0F0' }}>
                      <div style={{ fontSize: 9, color: isWeekend ? '#6C5CE7' : '#bbb', fontWeight: 600 }}>{DOW[dow]}</div>
                      <div style={{ fontSize: 11, fontWeight: isToday ? 800 : 500, color: '#555', marginTop: 1 }}>{d}</div>
                      {sale > 0 && <div style={{ fontSize: 8, color: '#FF6B35', fontWeight: 700, marginTop: 1 }}>{fmtW(sale)}</div>}
                      {dayRate !== null && <div style={{ fontSize: 7, color: dayRate >= 100 ? '#00B894' : '#E84393', fontWeight: 700 }}>{dayRate}%</div>}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 확장 영역 */}
            {isExpanded && (
              <div style={{ marginTop: 16, borderTop: '1px solid #F4F6F9', paddingTop: 16 }}>

                {/* 목표 입력 */}
                {canEdit && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 10 }}>🎯 목표 설정</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ background: '#FFF5F0', borderRadius: 12, padding: 12, border: '1px solid rgba(255,107,53,0.2)' }}>
                        <div style={{ fontSize: 10, color: '#FF6B35', fontWeight: 700, marginBottom: 6 }}>
                          📅 평일 목표 ({calc.weekdays}일)
                        </div>
                        <input value={toComma(wg.weekday)} onChange={e => setWeekGoal(week, 'weekday', fromComma(e.target.value))}
                          placeholder="0" style={{ ...inp, background: '#fff', fontSize: 13 }} />
                        {wg.weekday > 0 && <div style={{ fontSize: 9, color: '#FF6B35', textAlign: 'right', marginTop: 3 }}>합계 {fmtW(wg.weekday * calc.weekdays)}</div>}
                      </div>
                      <div style={{ background: '#F5F0FF', borderRadius: 12, padding: 12, border: '1px solid rgba(108,92,231,0.2)' }}>
                        <div style={{ fontSize: 10, color: '#6C5CE7', fontWeight: 700, marginBottom: 6 }}>
                          🎉 주말/공휴일 목표 ({calc.weekends}일)
                        </div>
                        <input value={toComma(wg.weekend)} onChange={e => setWeekGoal(week, 'weekend', fromComma(e.target.value))}
                          placeholder="0" style={{ ...inp, background: '#fff', fontSize: 13 }} />
                        {wg.weekend > 0 && <div style={{ fontSize: 9, color: '#6C5CE7', textAlign: 'right', marginTop: 3 }}>합계 {fmtW(wg.weekend * calc.weekends)}</div>}
                      </div>
                    </div>
                    {calc.goal > 0 && (
                      <div style={{ marginTop: 8, background: 'rgba(255,107,53,0.06)', borderRadius: 10, padding: '8px 12px', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 12, color: '#888' }}>이번 주 목표 합계</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#FF6B35' }}>{fmtW(calc.goal)}</span>
                      </div>
                    )}
                  </div>
                )}

                {!canEdit && calc.goal > 0 && (
                  <div style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ background: '#FFF5F0', borderRadius: 12, padding: 12 }}>
                      <div style={{ fontSize: 10, color: '#FF6B35', fontWeight: 700 }}>평일 목표</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#FF6B35', marginTop: 4 }}>{fmtW(wg.weekday)}</div>
                    </div>
                    <div style={{ background: '#F5F0FF', borderRadius: 12, padding: 12 }}>
                      <div style={{ fontSize: 10, color: '#6C5CE7', fontWeight: 700 }}>주말/공휴일 목표</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#6C5CE7', marginTop: 4 }}>{fmtW(wg.weekend)}</div>
                    </div>
                  </div>
                )}

                {/* 리뷰 & 액션 */}
                <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 10 }}>📝 주간 리뷰</div>

                {/* 미달성 시 원인 체크 */}
                {calc.goal > 0 && calc.actual < calc.goal && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: '#E84393', fontWeight: 600, marginBottom: 8 }}>미달성 원인</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {FAIL_CHECKS.map(fc => (
                        <label key={fc} onClick={() => !canEdit ? null : undefined} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8,
                          background: wr.failReasons?.includes(fc) ? 'rgba(232,67,147,0.08)' : '#F8F9FB',
                          border: `1px solid ${wr.failReasons?.includes(fc) ? 'rgba(232,67,147,0.25)' : '#E8ECF0'}`,
                          cursor: canEdit ? 'pointer' : 'default' }}>
                          <input type="checkbox" checked={wr.failReasons?.includes(fc) || false} disabled={!canEdit}
                            onChange={e => setWeekReview(week, 'failReasons', e.target.checked ? [...(wr.failReasons || []), fc] : (wr.failReasons || []).filter((r: string) => r !== fc))}
                            style={{ accentColor: '#E84393', flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: wr.failReasons?.includes(fc) ? '#E84393' : '#666' }}>{fc}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ fontSize: 11, color: '#888', marginBottom: 5 }}>코멘트 / 분석</div>
                <textarea value={wr.comment || ''} onChange={e => canEdit && setWeekReview(week, 'comment', e.target.value)}
                  placeholder={canEdit ? "이번 주 성과 분석, 특이사항..." : "작성된 내용이 없습니다"}
                  style={{ ...ta, marginBottom: 10 }} readOnly={!canEdit} />

                <div style={{ fontSize: 11, color: '#6C5CE7', fontWeight: 600, marginBottom: 5 }}>🚀 다음 주 액션 플랜</div>
                <textarea value={wr.action || ''} onChange={e => canEdit && setWeekReview(week, 'action', e.target.value)}
                  placeholder={canEdit ? "다음 주 매출 향상을 위한 구체적인 실행 계획..." : "작성된 내용이 없습니다"}
                  style={{ ...ta, borderColor: 'rgba(108,92,231,0.3)' }} readOnly={!canEdit} />

                {canEdit && (
                  <button onClick={() => saveWeek(week)} disabled={saving}
                    style={{ width: '100%', marginTop: 12, padding: '11px 0', borderRadius: 10, border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      background: isSaved ? '#00B894' : saving ? '#ddd' : 'linear-gradient(135deg,#FF6B35,#E84393)' }}>
                    {isSaved ? '✓ 저장완료!' : saving ? '저장 중...' : '💾 저장'}
                  </button>
                )}
                {!canEdit && <div style={{ marginTop: 10, textAlign: 'center', fontSize: 11, color: '#ccc' }}>목표 설정은 대표/관리자만 가능합니다</div>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}