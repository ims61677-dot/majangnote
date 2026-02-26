'use client'
import { useEffect, useState, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDay(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

const STATUS_LABEL: Record<string, string> = { work: '근무', off: '휴일', half: '반차' }
const STATUS_COLOR: Record<string, string> = { work: '#6C5CE7', off: '#E84393', half: '#FF6B35' }
const STATUS_BG: Record<string, string> = { work: 'rgba(108,92,231,0.1)', off: 'rgba(232,67,147,0.1)', half: 'rgba(255,107,53,0.1)' }
const POSITION_COLOR: Record<string, string> = { K: '#FF6B35', H: '#2DC6D6', KH: '#6C5CE7', '': '#aaa' }

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }

// ─── 월간 캘린더 탭 ───
function MonthlyView({ year, month, schedules, staffList, onChangeMonth, onDayClick, selectedDate }: {
  year: number; month: number; schedules: any[]
  staffList: string[]; onChangeMonth: (y: number, m: number) => void
  onDayClick: (d: string) => void; selectedDate: string
}) {
  const today = toDateStr(new Date())
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDay(year, month)
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`

  // 날짜별 요약
  const dayMap = useMemo(() => {
    const m: Record<string, { work: number; off: number }> = {}
    schedules.forEach(s => {
      if (!m[s.schedule_date]) m[s.schedule_date] = { work: 0, off: 0 }
      if (s.status === 'work' || s.status === 'half') m[s.schedule_date].work++
      else m[s.schedule_date].off++
    })
    return m
  }, [schedules])

  const weeks: (number | null)[][] = []
  let week: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d)
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week) }

  // 선택된 날짜의 스케줄
  const selectedSchedules = schedules.filter(s => s.schedule_date === selectedDate)
    .sort((a, b) => a.staff_name.localeCompare(b.staff_name))

  return (
    <div>
      {/* 월 네비게이션 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <button onClick={() => month===0 ? onChangeMonth(year-1,11) : onChangeMonth(year,month-1)}
          style={{ width:36, height:36, borderRadius:10, background:'#F4F6F9', border:'1px solid #E8ECF0', fontSize:18, color:'#888', cursor:'pointer' }}>‹</button>
        <span style={{ fontSize:17, fontWeight:700, color:'#1a1a2e' }}>{year}년 {month+1}월</span>
        <button onClick={() => month===11 ? onChangeMonth(year+1,0) : onChangeMonth(year,month+1)}
          style={{ width:36, height:36, borderRadius:10, background:'#F4F6F9', border:'1px solid #E8ECF0', fontSize:18, color:'#888', cursor:'pointer' }}>›</button>
      </div>

      {/* 캘린더 */}
      <div style={{ ...bx, padding:'14px 10px' }}>
        {/* 요일 헤더 */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:6 }}>
          {['일','월','화','수','목','금','토'].map((d,i) => (
            <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:600, color:i===0?'#E84393':i===6?'#2DC6D6':'#aaa', padding:'2px 0' }}>{d}</div>
          ))}
        </div>
        {/* 날짜 */}
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
            {week.map((day, di) => {
              if (!day) return <div key={di} />
              const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`
              const info = dayMap[dateStr]
              const isSelected = dateStr === selectedDate
              const isToday = dateStr === today
              return (
                <button key={di} onClick={() => onDayClick(dateStr)}
                  style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'4px 2px', borderRadius:10, cursor:'pointer', minHeight:48,
                    border: isSelected?'2px solid #6C5CE7':isToday?'1.5px solid rgba(108,92,231,0.3)':'1px solid transparent',
                    background: isSelected?'rgba(108,92,231,0.08)':'transparent' }}>
                  <span style={{ fontSize:12, fontWeight:isSelected||isToday?700:400, color:isSelected?'#6C5CE7':di===0?'#E84393':di===6?'#2DC6D6':'#1a1a2e' }}>{day}</span>
                  {info && (
                    <div style={{ display:'flex', flexDirection:'column', gap:1, marginTop:2, width:'100%', alignItems:'center' }}>
                      {info.work > 0 && <span style={{ fontSize:8, background:'rgba(108,92,231,0.15)', color:'#6C5CE7', borderRadius:4, padding:'1px 4px', fontWeight:700 }}>{info.work}명</span>}
                      {info.off > 0 && <span style={{ fontSize:8, background:'rgba(232,67,147,0.12)', color:'#E84393', borderRadius:4, padding:'1px 4px' }}>휴{info.off}</span>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* 선택 날짜 상세 */}
      {selectedDate && (
        <div>
          <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:10, paddingLeft:2 }}>
            {selectedDate.replace(/-/g,'.')} 스케줄
            {selectedDate === today && <span style={{ fontSize:10, color:'#FF6B35', background:'rgba(255,107,53,0.1)', padding:'1px 7px', borderRadius:6, marginLeft:6 }}>오늘</span>}
          </div>
          {selectedSchedules.length === 0 ? (
            <div style={{ ...bx, textAlign:'center', padding:24, color:'#bbb' }}>
              <div style={{ fontSize:18, marginBottom:6 }}>📅</div>
              <div style={{ fontSize:12 }}>이 날의 스케줄이 없습니다</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {selectedSchedules.map(s => (
                <div key={s.id} style={{ background:'#fff', borderRadius:12, border:`1px solid ${STATUS_COLOR[s.status]}30`, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:STATUS_COLOR[s.status], flexShrink:0 }} />
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:'#1a1a2e' }}>{s.staff_name}</div>
                      {s.note && <div style={{ fontSize:10, color:'#aaa', marginTop:1 }}>{s.note}</div>}
                    </div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    {s.position && (
                      <span style={{ fontSize:10, padding:'2px 8px', borderRadius:6, background:`${POSITION_COLOR[s.position]}20`, color:POSITION_COLOR[s.position], fontWeight:700 }}>{s.position}</span>
                    )}
                    <span style={{ fontSize:11, padding:'3px 9px', borderRadius:8, background:STATUS_BG[s.status], color:STATUS_COLOR[s.status], fontWeight:700 }}>{STATUS_LABEL[s.status]}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 직원별 탭 ───
function StaffView({ year, month, schedules, staffList, myName, isManager, onChangeMonth }: {
  year: number; month: number; schedules: any[]
  staffList: string[]; myName: string; isManager: boolean
  onChangeMonth: (y: number, m: number) => void
}) {
  const [selectedStaff, setSelectedStaff] = useState(myName)
  const today = toDateStr(new Date())
  const daysInMonth = getDaysInMonth(year, month)
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`

  // 본인이 아닌 경우 직원 선택 불가 (PT 권한)
  const viewableStaff = isManager ? staffList : [myName]

  useEffect(() => {
    if (!isManager) setSelectedStaff(myName)
  }, [myName, isManager])

  const staffSchedules = useMemo(() => {
    const m: Record<string, any> = {}
    schedules.filter(s => s.staff_name === selectedStaff).forEach(s => { m[s.schedule_date] = s })
    return m
  }, [schedules, selectedStaff])

  const workDays = Object.values(staffSchedules).filter(s => s.status === 'work').length
  const offDays = Object.values(staffSchedules).filter(s => s.status === 'off').length
  const halfDays = Object.values(staffSchedules).filter(s => s.status === 'half').length

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <div>
      {/* 월 네비게이션 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <button onClick={() => month===0 ? onChangeMonth(year-1,11) : onChangeMonth(year,month-1)}
          style={{ width:36, height:36, borderRadius:10, background:'#F4F6F9', border:'1px solid #E8ECF0', fontSize:18, color:'#888', cursor:'pointer' }}>‹</button>
        <span style={{ fontSize:17, fontWeight:700, color:'#1a1a2e' }}>{year}년 {month+1}월</span>
        <button onClick={() => month===11 ? onChangeMonth(year+1,0) : onChangeMonth(year,month+1)}
          style={{ width:36, height:36, borderRadius:10, background:'#F4F6F9', border:'1px solid #E8ECF0', fontSize:18, color:'#888', cursor:'pointer' }}>›</button>
      </div>

      {/* 직원 선택 (매니저/대표만) */}
      {isManager && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
          {staffList.map(name => (
            <button key={name} onClick={() => setSelectedStaff(name)}
              style={{ padding:'6px 14px', borderRadius:20, border:selectedStaff===name?'1px solid #6C5CE7':'1px solid #E8ECF0',
                background:selectedStaff===name?'rgba(108,92,231,0.1)':'#F4F6F9',
                color:selectedStaff===name?'#6C5CE7':'#888', fontSize:12, fontWeight:selectedStaff===name?700:400, cursor:'pointer' }}>
              {name}
            </button>
          ))}
        </div>
      )}

      {/* 요약 카드 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:14 }}>
        <div style={{ background:'rgba(108,92,231,0.08)', borderRadius:12, padding:'10px 0', textAlign:'center', border:'1px solid rgba(108,92,231,0.2)' }}>
          <div style={{ fontSize:20, fontWeight:800, color:'#6C5CE7' }}>{workDays}</div>
          <div style={{ fontSize:10, color:'#6C5CE7', marginTop:2 }}>근무</div>
        </div>
        <div style={{ background:'rgba(232,67,147,0.08)', borderRadius:12, padding:'10px 0', textAlign:'center', border:'1px solid rgba(232,67,147,0.2)' }}>
          <div style={{ fontSize:20, fontWeight:800, color:'#E84393' }}>{offDays}</div>
          <div style={{ fontSize:10, color:'#E84393', marginTop:2 }}>휴일</div>
        </div>
        <div style={{ background:'rgba(255,107,53,0.08)', borderRadius:12, padding:'10px 0', textAlign:'center', border:'1px solid rgba(255,107,53,0.2)' }}>
          <div style={{ fontSize:20, fontWeight:800, color:'#FF6B35' }}>{halfDays}</div>
          <div style={{ fontSize:10, color:'#FF6B35', marginTop:2 }}>반차</div>
        </div>
      </div>

      {/* 날짜별 리스트 */}
      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {days.map(day => {
          const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`
          const s = staffSchedules[dateStr]
          const dow = new Date(dateStr).getDay()
          const isToday = dateStr === today
          const isSun = dow === 0
          const isSat = dow === 6
          const dowLabel = ['일','월','화','수','목','금','토'][dow]

          return (
            <div key={day} style={{ display:'flex', alignItems:'center', padding:'8px 12px', borderRadius:10,
              background: isToday?'rgba(108,92,231,0.05)':s?.status==='off'?'rgba(232,67,147,0.02)':'#fff',
              border: isToday?'1.5px solid rgba(108,92,231,0.25)':'1px solid #F0F2F5' }}>
              {/* 날짜 */}
              <div style={{ minWidth:44, display:'flex', alignItems:'baseline', gap:4 }}>
                <span style={{ fontSize:14, fontWeight:isToday?700:400, color:isSun?'#E84393':isSat?'#2DC6D6':isToday?'#6C5CE7':'#1a1a2e' }}>{day}</span>
                <span style={{ fontSize:10, color:isSun?'#E84393':isSat?'#2DC6D6':'#bbb' }}>{dowLabel}</span>
              </div>

              {/* 스케줄 */}
              {s ? (
                <div style={{ flex:1, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    {s.position && (
                      <span style={{ fontSize:10, padding:'1px 7px', borderRadius:6, background:`${POSITION_COLOR[s.position]}20`, color:POSITION_COLOR[s.position], fontWeight:700 }}>{s.position}</span>
                    )}
                    {s.note && <span style={{ fontSize:11, color:'#888' }}>{s.note}</span>}
                  </div>
                  <span style={{ fontSize:11, padding:'2px 10px', borderRadius:8, background:STATUS_BG[s.status], color:STATUS_COLOR[s.status], fontWeight:700 }}>{STATUS_LABEL[s.status]}</span>
                </div>
              ) : (
                <div style={{ flex:1, display:'flex', justifyContent:'flex-end' }}>
                  <span style={{ fontSize:10, color:'#ddd' }}>-</span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 스케줄 입력 폼 ───
function ScheduleForm({ storeId, staffList, year, month, onSaved, onClose, editData }: {
  storeId: string; staffList: string[]; year: number; month: number
  onSaved: () => void; onClose: () => void; editData?: any
}) {
  const supabase = createSupabaseBrowserClient()
  const [staffName, setStaffName] = useState(editData?.staff_name || staffList[0] || '')
  const [startDate, setStartDate] = useState(editData?.schedule_date || toDateStr(new Date()))
  const [endDate, setEndDate] = useState(editData?.schedule_date || toDateStr(new Date()))
  const [status, setStatus] = useState(editData?.status || 'work')
  const [position, setPosition] = useState(editData?.position || '')
  const [note, setNote] = useState(editData?.note || '')
  const [isSaving, setIsSaving] = useState(false)
  const [bulkMode, setBulkMode] = useState(false) // 기간 일괄 입력

  async function handleSave() {
    if (!staffName || !startDate) return
    setIsSaving(true)
    try {
      if (editData) {
        await supabase.from('schedules').update({ status, position: position || null, note: note || null }).eq('id', editData.id)
      } else {
        // 기간 내 모든 날짜 생성
        const start = new Date(startDate)
        const end = new Date(bulkMode ? endDate : startDate)
        const rows = []
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          rows.push({ store_id: storeId, staff_name: staffName, schedule_date: toDateStr(new Date(d)), status, position: position || null, note: note || null })
        }
        await supabase.from('schedules').upsert(rows, { onConflict: 'store_id,staff_name,schedule_date' })
      }
      onSaved(); onClose()
    } catch (e: any) { alert('저장 실패: ' + e?.message) }
    finally { setIsSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>{editData ? '✏️ 스케줄 수정' : '📅 스케줄 추가'}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>

        {/* 직원 선택 */}
        <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>직원</div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
          {staffList.map(name => (
            <button key={name} onClick={() => setStaffName(name)}
              style={{ padding:'6px 14px', borderRadius:20, border:staffName===name?'1px solid #6C5CE7':'1px solid #E8ECF0',
                background:staffName===name?'rgba(108,92,231,0.1)':'#F4F6F9',
                color:staffName===name?'#6C5CE7':'#888', fontSize:12, fontWeight:staffName===name?700:400, cursor:'pointer' }}>
              {name}
            </button>
          ))}
        </div>

        {/* 기간 모드 토글 */}
        {!editData && (
          <button onClick={() => setBulkMode(p => !p)}
            style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12, padding:'7px 12px', borderRadius:8,
              border:bulkMode?'1px solid rgba(108,92,231,0.4)':'1px solid #E8ECF0',
              background:bulkMode?'rgba(108,92,231,0.08)':'#F4F6F9', cursor:'pointer', width:'100%' }}>
            <span style={{ fontSize:12, color:bulkMode?'#6C5CE7':'#888' }}>{bulkMode ? '📆 기간 일괄 입력 (ON)' : '📅 단일 날짜 입력'}</span>
          </button>
        )}

        {/* 날짜 */}
        <div style={{ display:'flex', gap:8, marginBottom:14 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, color:'#888', marginBottom:4 }}>{bulkMode ? '시작일' : '날짜'}</div>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'#F8F9FB', border:'1px solid #E0E4E8', fontSize:13, outline:'none', boxSizing:'border-box' as const }} />
          </div>
          {bulkMode && (
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:'#888', marginBottom:4 }}>종료일</div>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate}
                style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'#F8F9FB', border:'1px solid #E0E4E8', fontSize:13, outline:'none', boxSizing:'border-box' as const }} />
            </div>
          )}
        </div>

        {/* 상태 */}
        <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>상태</div>
        <div style={{ display:'flex', gap:6, marginBottom:14 }}>
          {(['work','off','half'] as const).map(s => (
            <button key={s} onClick={() => setStatus(s)}
              style={{ flex:1, padding:'9px 0', borderRadius:10, border:status===s?`1px solid ${STATUS_COLOR[s]}`:'1px solid #E8ECF0',
                background:status===s?STATUS_BG[s]:'#F4F6F9', color:status===s?STATUS_COLOR[s]:'#888',
                fontSize:12, fontWeight:status===s?700:400, cursor:'pointer' }}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {/* 포지션 */}
        <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>포지션</div>
        <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
          {['', 'K', 'H', 'KH'].map(p => (
            <button key={p} onClick={() => setPosition(p)}
              style={{ padding:'7px 14px', borderRadius:10, border:position===p?`1px solid ${POSITION_COLOR[p] || '#aaa'}`:'1px solid #E8ECF0',
                background:position===p?`${POSITION_COLOR[p] || '#aaa'}15`:'#F4F6F9',
                color:position===p?(POSITION_COLOR[p] || '#aaa'):'#888',
                fontSize:12, fontWeight:position===p?700:400, cursor:'pointer' }}>
              {p || '없음'}
            </button>
          ))}
        </div>

        {/* 메모 */}
        <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>메모 (선택)</div>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="예: 병원, 생일, 야채샐러드..."
          style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'#F8F9FB', border:'1px solid #E0E4E8', fontSize:13, outline:'none', boxSizing:'border-box' as const, marginBottom:16 }} />

        <button onClick={handleSave} disabled={isSaving}
          style={{ width:'100%', padding:'13px 0', borderRadius:14, background:isSaving?'#ddd':'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:14, fontWeight:700, cursor:isSaving?'not-allowed':'pointer' }}>
          {isSaving ? '저장 중...' : editData ? '수정 저장' : bulkMode ? `${startDate} ~ ${endDate} 일괄 저장` : '저장'}
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// 메인
// ═══════════════════════════════════════
export default function SchedulePage() {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState('')
  const [myName, setMyName] = useState('')
  const [isManager, setIsManager] = useState(false)
  const [schedules, setSchedules] = useState<any[]>([])
  const [staffList, setStaffList] = useState<string[]>([])
  const [viewTab, setViewTab] = useState<'month' | 'staff'>('month')
  const [showForm, setShowForm] = useState(false)
  const nowD = new Date()
  const [calYear, setCalYear] = useState(nowD.getFullYear())
  const [calMonth, setCalMonth] = useState(nowD.getMonth())
  const [selectedDate, setSelectedDate] = useState(toDateStr(nowD))

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id)
    setMyName(user.nm || '')
    setIsManager(user.role === 'owner' || user.role === 'manager')
    loadData(store.id, nowD.getFullYear(), nowD.getMonth())
    loadStaff(store.id)
  }, [])

  async function loadData(sid: string, y: number, m: number) {
    const startDate = `${y}-${String(m+1).padStart(2,'0')}-01`
    const endDate = `${y}-${String(m+1).padStart(2,'0')}-${String(getDaysInMonth(y, m)).padStart(2,'0')}`
    const { data } = await supabase.from('schedules').select('*').eq('store_id', sid).gte('schedule_date', startDate).lte('schedule_date', endDate).order('schedule_date')
    setSchedules(data || [])
  }

  async function loadStaff(sid: string) {
    const { data } = await supabase.from('mj_user').select('nm').eq('store_id', sid).eq('is_active', true).order('nm')
    setStaffList((data || []).map((u: any) => u.nm).filter(Boolean))
  }

  function handleChangeMonth(y: number, m: number) {
    setCalYear(y); setCalMonth(m)
    loadData(storeId, y, m)
  }

  async function deleteSchedule(id: string) {
    if (!confirm('삭제할까요?')) return
    await supabase.from('schedules').delete().eq('id', id)
    loadData(storeId, calYear, calMonth)
  }

  const tabBtn = (active: boolean) => ({
    flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer' as const,
    fontSize: 13, fontWeight: active ? 700 : 400,
    background: active ? '#fff' : 'transparent', color: active ? '#1a1a2e' : '#aaa',
    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
  })

  return (
    <div>
      {showForm && (
        <ScheduleForm storeId={storeId} staffList={staffList} year={calYear} month={calMonth}
          onSaved={() => loadData(storeId, calYear, calMonth)} onClose={() => setShowForm(false)} />
      )}

      {/* 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <span style={{ fontSize:17, fontWeight:700, color:'#1a1a2e' }}>📅 스케줄</span>
        {isManager && (
          <button onClick={() => setShowForm(true)}
            style={{ padding:'7px 14px', borderRadius:10, background:'rgba(108,92,231,0.1)', border:'1px solid rgba(108,92,231,0.3)', color:'#6C5CE7', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            + 스케줄 추가
          </button>
        )}
      </div>

      {/* 뷰 탭 */}
      <div style={{ display:'flex', background:'#F4F6F9', borderRadius:12, padding:4, marginBottom:16 }}>
        <button style={tabBtn(viewTab==='month')} onClick={() => setViewTab('month')}>📅 월간 캘린더</button>
        <button style={tabBtn(viewTab==='staff')} onClick={() => setViewTab('staff')}>👤 직원별</button>
      </div>

      {viewTab === 'month' && (
        <MonthlyView year={calYear} month={calMonth} schedules={schedules} staffList={staffList}
          onChangeMonth={handleChangeMonth} onDayClick={setSelectedDate} selectedDate={selectedDate} />
      )}
      {viewTab === 'staff' && (
        <StaffView year={calYear} month={calMonth} schedules={schedules} staffList={staffList}
          myName={myName} isManager={isManager} onChangeMonth={handleChangeMonth} />
      )}
    </div>
  )
}