'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '10px 12px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const, textAlign: 'right' as const }

function toComma(v: number | string) {
  const n = typeof v === 'string' ? Number(String(v).replace(/,/g, '')) : v
  return isNaN(n) || n === 0 ? '' : n.toLocaleString('ko-KR')
}
function fromComma(s: string) { return Number(String(s).replace(/[^0-9]/g, '')) || 0 }

export default function GoalPage() {
  const supabase = createSupabaseBrowserClient()
  const now = new Date()
  const [yr, setYr] = useState(now.getFullYear())
  const [mo, setMo] = useState(now.getMonth() + 1)
  const [storeId, setStoreId] = useState('')
  const [myRole, setMyRole] = useState('')
  const [weekdayGoal, setWeekdayGoal] = useState(0)
  const [weekendGoal, setWeekendGoal] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id)
    setMyRole(user.role)
    loadGoal(store.id, yr, mo)
  }, [yr, mo])

  async function loadGoal(sid: string, y: number, m: number) {
    const { data } = await supabase.from('goals').select('*').eq('store_id', sid).eq('year', y).eq('month', m).single()
    if (data) { setWeekdayGoal(data.weekday_goal || 0); setWeekendGoal(data.weekend_goal || 0) }
    else { setWeekdayGoal(0); setWeekendGoal(0) }
  }

  async function saveGoal() {
    if (!storeId) return
    setSaving(true)
    await supabase.from('goals').upsert({ store_id: storeId, year: yr, month: mo, weekday_goal: weekdayGoal, weekend_goal: weekendGoal }, { onConflict: 'store_id,year,month' })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const isOwner = myRole === 'owner'
  const totalGoal = weekdayGoal * 20 + weekendGoal * 8
  const monthlyAvg = totalGoal / 28

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>🎯 목표매출</span>
      </div>

      {/* 월 선택 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={() => { if (mo===1){setYr(yr-1);setMo(12)}else setMo(mo-1) }}
          style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: '#555', fontSize: 14 }}>←</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>{yr}년 {mo}월</span>
        <button onClick={() => { if (mo===12){setYr(yr+1);setMo(1)}else setMo(mo+1) }}
          style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: '#555', fontSize: 14 }}>→</button>
      </div>

      {/* 목표 입력 */}
      <div style={bx}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 14 }}>일별 목표 설정</div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>📅 평일 목표</span>
            <span style={{ fontSize: 11, color: '#999' }}>월~금 (약 20일)</span>
          </div>
          <input value={toComma(weekdayGoal)} onChange={e => setWeekdayGoal(fromComma(e.target.value))}
            placeholder="0" style={inp} readOnly={!isOwner} />
          {weekdayGoal > 0 && <div style={{ fontSize: 11, color: '#FF6B35', textAlign: 'right', marginTop: 4 }}>{weekdayGoal.toLocaleString('ko-KR')}원/일</div>}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: '#555', fontWeight: 500 }}>🎉 주말 목표</span>
            <span style={{ fontSize: 11, color: '#999' }}>토~일 (약 8일)</span>
          </div>
          <input value={toComma(weekendGoal)} onChange={e => setWeekendGoal(fromComma(e.target.value))}
            placeholder="0" style={inp} readOnly={!isOwner} />
          {weekendGoal > 0 && <div style={{ fontSize: 11, color: '#6C5CE7', textAlign: 'right', marginTop: 4 }}>{weekendGoal.toLocaleString('ko-KR')}원/일</div>}
        </div>

        {isOwner && (
          <button onClick={saveGoal} disabled={saving}
            style={{ width: '100%', padding: 12, borderRadius: 10, background: saved ? '#00B894' : saving ? '#ccc' : 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {saved ? '✓ 저장완료!' : saving ? '저장 중...' : '💾 저장'}
          </button>
        )}
      </div>

      {/* 월 예상 합계 */}
      {totalGoal > 0 && (
        <div style={bx}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>📊 {mo}월 예상 매출</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1, background: '#FFF5F0', borderRadius: 12, padding: 14, border: '1px solid rgba(255,107,53,0.2)' }}>
              <div style={{ fontSize: 10, color: '#FF6B35', fontWeight: 600, marginBottom: 4 }}>평일 합계</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#FF6B35' }}>{(weekdayGoal * 20 / 10000).toFixed(0)}<span style={{ fontSize: 12 }}>만원</span></div>
            </div>
            <div style={{ flex: 1, background: '#F5F0FF', borderRadius: 12, padding: 14, border: '1px solid rgba(108,92,231,0.2)' }}>
              <div style={{ fontSize: 10, color: '#6C5CE7', fontWeight: 600, marginBottom: 4 }}>주말 합계</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#6C5CE7' }}>{(weekendGoal * 8 / 10000).toFixed(0)}<span style={{ fontSize: 12 }}>만원</span></div>
            </div>
          </div>
          <div style={{ background: 'linear-gradient(135deg,rgba(255,107,53,0.1),rgba(232,67,147,0.1))', borderRadius: 12, padding: 14, border: '1px solid rgba(255,107,53,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#555' }}>월 목표 합계</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#FF6B35' }}>{(totalGoal / 10000).toFixed(0)}<span style={{ fontSize: 13 }}>만원</span></span>
            </div>
            <div style={{ fontSize: 11, color: '#999', marginTop: 4, textAlign: 'right' }}>일 평균 약 {(monthlyAvg / 10000).toFixed(1)}만원</div>
          </div>
        </div>
      )}

      {!isOwner && (
        <div style={{ textAlign: 'center', padding: 16, fontSize: 12, color: '#bbb' }}>
          목표 설정은 대표만 가능합니다
        </div>
      )}
    </div>
  )
}