'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

const STATUS_LABEL: Record<string, string> = { work: '근무', off: '휴일', half: '반차' }
const STATUS_COLOR: Record<string, string> = { work: '#6C5CE7', off: '#E84393', half: '#FF6B35' }
const STATUS_BG: Record<string, string> = { work: 'rgba(108,92,231,0.15)', off: 'rgba(232,67,147,0.13)', half: 'rgba(255,107,53,0.13)' }
const POS_COLOR: Record<string, string> = { K: '#FF6B35', H: '#2DC6D6', KH: '#6C5CE7' }

// ─── 셀 팝업 ───
function CellPopup({ staffName, dateStr, current, onSave, onDelete, onClose }: {
  staffName: string; dateStr: string; current: any | null
  onSave: (status: string, position: string, note: string) => void
  onDelete: () => void; onClose: () => void
}) {
  const [status, setStatus] = useState(current?.status || 'work')
  const [position, setPosition] = useState(current?.position || '')
  const [note, setNote] = useState(current?.note || '')
  const dow = ['일','월','화','수','목','금','토'][new Date(dateStr).getDay()]
  const [d, m] = dateStr.split('-').slice(1)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, padding:20, width:'100%', maxWidth:320 }} onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#1a1a2e' }}>{staffName}</div>
          <div style={{ fontSize:12, color:'#aaa', marginTop:2 }}>{m}월 {d}일 ({dow})</div>
        </div>

        {/* 상태 선택 */}
        <div style={{ display:'flex', gap:6, marginBottom:12 }}>
          {(['work','off','half'] as const).map(s => (
            <button key={s} onClick={() => setStatus(s)}
              style={{ flex:1, padding:'9px 0', borderRadius:10, border:status===s?`1.5px solid ${STATUS_COLOR[s]}`:'1px solid #E8ECF0',
                background:status===s?STATUS_BG[s]:'#F4F6F9', color:status===s?STATUS_COLOR[s]:'#aaa',
                fontSize:12, fontWeight:status===s?700:400, cursor:'pointer' }}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {/* 포지션 */}
        <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>포지션</div>
        <div style={{ display:'flex', gap:6, marginBottom:12 }}>
          {(['', 'K', 'H', 'KH'] as const).map(p => (
            <button key={p} onClick={() => setPosition(p)}
              style={{ flex:1, padding:'7px 0', borderRadius:9, border:position===p?`1.5px solid ${POS_COLOR[p]||'#aaa'}`:'1px solid #E8ECF0',
                background:position===p?`${POS_COLOR[p]||'#888'}18`:'#F4F6F9',
                color:position===p?(POS_COLOR[p]||'#555'):'#aaa',
                fontSize:12, fontWeight:position===p?700:400, cursor:'pointer' }}>
              {p||'없음'}
            </button>
          ))}
        </div>

        {/* 메모 */}
        <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>메모</div>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="병원, 생일, 야채샐러드..."
          style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'#F8F9FB', border:'1px solid #E0E4E8', fontSize:13, outline:'none', boxSizing:'border-box' as const, marginBottom:14 }} />

        {/* 버튼 */}
        <div style={{ display:'flex', gap:8 }}>
          {current && (
            <button onClick={onDelete}
              style={{ padding:'10px 14px', borderRadius:10, background:'rgba(232,67,147,0.08)', border:'1px solid rgba(232,67,147,0.2)', color:'#E84393', fontSize:12, cursor:'pointer' }}>삭제</button>
          )}
          <button onClick={() => onSave(status, position, note)}
            style={{ flex:1, padding:'10px 0', borderRadius:10, background:'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
            저장
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 그리드 에디터 ───
function GridEditor({ year, month, schedules, staffList, isManager, storeId, myName, onSaved, onChangeMonth }: {
  year: number; month: number; schedules: any[]
  staffList: string[]; isManager: boolean; storeId: string; myName: string
  onSaved: () => void; onChangeMonth: (y: number, m: number) => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [popup, setPopup] = useState<{ staff: string; date: string } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const today = toDateStr(new Date())
  const daysInMonth = getDaysInMonth(year, month)
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  // 보여줄 직원 목록 (사원은 본인만)
  const visibleStaff = isManager ? staffList : staffList.filter(n => n === myName)

  // 스케줄 맵: staffName-date -> schedule
  const scheduleMap = useMemo(() => {
    const m: Record<string, any> = {}
    schedules.forEach(s => { m[`${s.staff_name}-${s.schedule_date}`] = s })
    return m
  }, [schedules])

  // 오늘 컬럼으로 스크롤
  useEffect(() => {
    if (!scrollRef.current) return
    const todayDay = parseInt(today.split('-')[2])
    const cellW = 44
    const offset = (todayDay - 3) * cellW
    scrollRef.current.scrollLeft = Math.max(0, offset)
  }, [year, month])

  const popupData = popup ? scheduleMap[`${popup.staff}-${popup.date}`] || null : null

  async function handleSave(status: string, position: string, note: string) {
    if (!popup) return
    await supabase.from('schedules').upsert({
      store_id: storeId, staff_name: popup.staff, schedule_date: popup.date,
      status, position: position || null, note: note || null
    }, { onConflict: 'store_id,staff_name,schedule_date' })
    setPopup(null); onSaved()
  }

  async function handleDelete() {
    if (!popup || !popupData) return
    await supabase.from('schedules').delete().eq('id', popupData.id)
    setPopup(null); onSaved()
  }

  return (
    <div>
      {popup && (
        <CellPopup staffName={popup.staff} dateStr={popup.date} current={popupData}
          onSave={handleSave} onDelete={handleDelete} onClose={() => setPopup(null)} />
      )}

      {/* 월 네비게이션 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <button onClick={() => month===0 ? onChangeMonth(year-1,11) : onChangeMonth(year,month-1)}
          style={{ width:36, height:36, borderRadius:10, background:'#F4F6F9', border:'1px solid #E8ECF0', fontSize:18, color:'#888', cursor:'pointer' }}>‹</button>
        <span style={{ fontSize:17, fontWeight:700, color:'#1a1a2e' }}>{year}년 {month+1}월</span>
        <button onClick={() => month===11 ? onChangeMonth(year+1,0) : onChangeMonth(year,month+1)}
          style={{ width:36, height:36, borderRadius:10, background:'#F4F6F9', border:'1px solid #E8ECF0', fontSize:18, color:'#888', cursor:'pointer' }}>›</button>
      </div>

      {/* 범례 */}
      <div style={{ display:'flex', gap:10, marginBottom:12, flexWrap:'wrap' }}>
        {Object.entries(STATUS_LABEL).map(([k, v]) => (
          <div key={k} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:10, height:10, borderRadius:3, background:STATUS_BG[k], border:`1px solid ${STATUS_COLOR[k]}` }} />
            <span style={{ fontSize:10, color:'#888' }}>{v}</span>
          </div>
        ))}
        {Object.entries(POS_COLOR).map(([k, v]) => (
          <div key={k} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ fontSize:10, fontWeight:700, color:v }}>{k}</span>
          </div>
        ))}
        {isManager && <span style={{ fontSize:10, color:'#bbb', marginLeft:'auto' }}>셀 눌러서 편집</span>}
      </div>

      {/* 그리드 */}
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8ECF0', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
        {/* 헤더 - 가로 스크롤 */}
        <div style={{ display:'flex' }}>
          {/* 이름 컬럼 고정 */}
          <div style={{ minWidth:64, flexShrink:0, background:'#F8F9FB', borderRight:'2px solid #E8ECF0', borderBottom:'1px solid #E8ECF0', padding:'8px 0', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontSize:10, color:'#aaa', fontWeight:600 }}>이름</span>
          </div>
          {/* 날짜 헤더 - 스크롤 영역 */}
          <div ref={scrollRef} style={{ flex:1, overflowX:'auto', display:'flex' }}
            onScroll={e => {
              // 바디 스크롤과 동기화
              const target = e.currentTarget
              document.querySelectorAll('.grid-body-scroll').forEach(el => { (el as HTMLElement).scrollLeft = target.scrollLeft })
            }}>
            {days.map(day => {
              const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`
              const dow = new Date(dateStr).getDay()
              const isToday = dateStr === today
              const isSun = dow === 0; const isSat = dow === 6
              return (
                <div key={day} style={{ minWidth:44, flexShrink:0, background:isToday?'rgba(108,92,231,0.06)':'#F8F9FB',
                  borderRight:'1px solid #F0F2F5', borderBottom:'1px solid #E8ECF0', padding:'6px 2px', textAlign:'center' }}>
                  <div style={{ fontSize:11, fontWeight:isToday?700:400, color:isToday?'#6C5CE7':isSun?'#E84393':isSat?'#2DC6D6':'#1a1a2e' }}>{day}</div>
                  <div style={{ fontSize:9, color:isSun?'#E84393':isSat?'#2DC6D6':'#bbb' }}>{['일','월','화','수','목','금','토'][dow]}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 바디 */}
        {visibleStaff.map((staff, si) => (
          <div key={staff} style={{ display:'flex', borderTop: si > 0 ? '1px solid #F0F2F5' : 'none' }}>
            {/* 이름 고정 */}
            <div style={{ minWidth:64, flexShrink:0, background:'#FAFBFC', borderRight:'2px solid #E8ECF0', padding:'0 6px', display:'flex', alignItems:'center', justifyContent:'center', minHeight:52 }}>
              <span style={{ fontSize:11, fontWeight:600, color:'#1a1a2e', textAlign:'center', wordBreak:'keep-all' }}>{staff}</span>
            </div>
            {/* 셀들 */}
            <div className="grid-body-scroll" style={{ flex:1, overflowX:'auto', display:'flex' }}>
              {days.map(day => {
                const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`
                const s = scheduleMap[`${staff}-${dateStr}`]
                const dow = new Date(dateStr).getDay()
                const isToday = dateStr === today
                const isSun = dow === 0; const isSat = dow === 6
                const canEdit = isManager

                return (
                  <div key={day}
                    onClick={() => canEdit && setPopup({ staff, date: dateStr })}
                    style={{ minWidth:44, flexShrink:0, borderRight:'1px solid #F0F2F5', minHeight:52,
                      background: s ? STATUS_BG[s.status] : isToday?'rgba(108,92,231,0.03)':isSun||isSat?'#FAFBFC':'#fff',
                      cursor:canEdit?'pointer':'default', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
                      transition:'background 0.1s' }}>
                    {s ? (
                      <>
                        <span style={{ fontSize:9, fontWeight:700, color:STATUS_COLOR[s.status] }}>{STATUS_LABEL[s.status]}</span>
                        {s.position && <span style={{ fontSize:9, fontWeight:700, color:POS_COLOR[s.position] }}>{s.position}</span>}
                        {s.note && <span style={{ fontSize:8, color:'#aaa', maxWidth:38, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.note}</span>}
                      </>
                    ) : (
                      canEdit && <span style={{ fontSize:14, color:'#e0e0e0' }}>+</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* 월간 합계 행 */}
        <div style={{ display:'flex', borderTop:'2px solid #E8ECF0', background:'#F8F9FB' }}>
          <div style={{ minWidth:64, flexShrink:0, borderRight:'2px solid #E8ECF0', padding:'6px 0', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontSize:9, color:'#aaa', fontWeight:700 }}>출근</span>
          </div>
          <div style={{ flex:1, overflowX:'auto', display:'flex' }}>
            {days.map(day => {
              const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`
              const cnt = visibleStaff.filter(staff => {
                const s = scheduleMap[`${staff}-${dateStr}`]
                return s && (s.status === 'work' || s.status === 'half')
              }).length
              return (
                <div key={day} style={{ minWidth:44, flexShrink:0, borderRight:'1px solid #F0F2F5', display:'flex', alignItems:'center', justifyContent:'center', minHeight:28 }}>
                  {cnt > 0 && <span style={{ fontSize:9, fontWeight:700, color:'#6C5CE7' }}>{cnt}</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 직원별 월 요약 */}
      <div style={{ marginTop:14 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#1a1a2e', marginBottom:8, paddingLeft:2 }}>월간 요약</div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {visibleStaff.map(staff => {
            const staffSched = schedules.filter(s => s.staff_name === staff)
            const work = staffSched.filter(s => s.status === 'work').length
            const off = staffSched.filter(s => s.status === 'off').length
            const half = staffSched.filter(s => s.status === 'half').length
            return (
              <div key={staff} style={{ background:'#fff', borderRadius:12, border:'1px solid #E8ECF0', padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:13, fontWeight:600, color:'#1a1a2e' }}>{staff}</span>
                <div style={{ display:'flex', gap:8 }}>
                  <span style={{ fontSize:11, color:'#6C5CE7', fontWeight:700 }}>근무 {work}일</span>
                  {half > 0 && <span style={{ fontSize:11, color:'#FF6B35', fontWeight:700 }}>반차 {half}일</span>}
                  <span style={{ fontSize:11, color:'#E84393', fontWeight:700 }}>휴일 {off}일</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── 월간 캘린더 탭 ───
function MonthlyView({ year, month, schedules, onChangeMonth, selectedDate, onDayClick }: {
  year: number; month: number; schedules: any[]
  onChangeMonth: (y: number, m: number) => void
  selectedDate: string; onDayClick: (d: string) => void
}) {
  const today = toDateStr(new Date())
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = new Date(year, month, 1).getDay()
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`

  const dayMap = useMemo(() => {
    const m: Record<string, { work: number; off: number; names: string[] }> = {}
    schedules.forEach(s => {
      if (!m[s.schedule_date]) m[s.schedule_date] = { work: 0, off: 0, names: [] }
      if (s.status === 'work' || s.status === 'half') { m[s.schedule_date].work++; m[s.schedule_date].names.push(s.staff_name) }
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

  const selectedSchedules = schedules.filter(s => s.schedule_date === selectedDate)
    .sort((a, b) => a.staff_name.localeCompare(b.staff_name))

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <button onClick={() => month===0 ? onChangeMonth(year-1,11) : onChangeMonth(year,month-1)}
          style={{ width:36, height:36, borderRadius:10, background:'#F4F6F9', border:'1px solid #E8ECF0', fontSize:18, color:'#888', cursor:'pointer' }}>‹</button>
        <span style={{ fontSize:17, fontWeight:700, color:'#1a1a2e' }}>{year}년 {month+1}월</span>
        <button onClick={() => month===11 ? onChangeMonth(year+1,0) : onChangeMonth(year,month+1)}
          style={{ width:36, height:36, borderRadius:10, background:'#F4F6F9', border:'1px solid #E8ECF0', fontSize:18, color:'#888', cursor:'pointer' }}>›</button>
      </div>

      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8ECF0', padding:'14px 10px', marginBottom:14, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:6 }}>
          {['일','월','화','수','목','금','토'].map((d,i) => (
            <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:600, color:i===0?'#E84393':i===6?'#2DC6D6':'#aaa', padding:'2px 0' }}>{d}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:3 }}>
            {week.map((day, di) => {
              if (!day) return <div key={di} />
              const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`
              const info = dayMap[dateStr]
              const isSelected = dateStr === selectedDate
              const isToday = dateStr === today
              return (
                <button key={di} onClick={() => onDayClick(dateStr)}
                  style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'4px 2px', borderRadius:10, cursor:'pointer', minHeight:50,
                    border: isSelected?'2px solid #6C5CE7':isToday?'1.5px solid rgba(108,92,231,0.3)':'1px solid transparent',
                    background: isSelected?'rgba(108,92,231,0.08)':'transparent' }}>
                  <span style={{ fontSize:12, fontWeight:isSelected||isToday?700:400, color:isSelected?'#6C5CE7':di===0?'#E84393':di===6?'#2DC6D6':'#1a1a2e' }}>{day}</span>
                  {info && (
                    <div style={{ display:'flex', flexDirection:'column', gap:1, marginTop:2, width:'100%', alignItems:'center' }}>
                      {info.work > 0 && <span style={{ fontSize:8, background:'rgba(108,92,231,0.15)', color:'#6C5CE7', borderRadius:4, padding:'0px 3px', fontWeight:700 }}>{info.work}명</span>}
                      {info.off > 0 && <span style={{ fontSize:8, background:'rgba(232,67,147,0.1)', color:'#E84393', borderRadius:4, padding:'0px 3px' }}>휴{info.off}</span>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* 선택 날짜 상세 */}
      <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:10, paddingLeft:2 }}>
        {selectedDate.replace(/-/g,'.')}
        {selectedDate === today && <span style={{ fontSize:10, color:'#FF6B35', background:'rgba(255,107,53,0.1)', padding:'1px 7px', borderRadius:6, marginLeft:6 }}>오늘</span>}
      </div>
      {selectedSchedules.length === 0 ? (
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E8ECF0', padding:'24px 0', textAlign:'center', color:'#bbb' }}>
          <div style={{ fontSize:18, marginBottom:6 }}>📅</div>
          <div style={{ fontSize:12 }}>스케줄이 없습니다</div>
        </div>
      ) : selectedSchedules.map(s => (
        <div key={s.id} style={{ background:'#fff', borderRadius:12, border:`1px solid ${STATUS_COLOR[s.status]}30`, padding:'10px 14px', marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:STATUS_COLOR[s.status] }} />
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'#1a1a2e' }}>{s.staff_name}</div>
              {s.note && <div style={{ fontSize:10, color:'#aaa', marginTop:1 }}>{s.note}</div>}
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            {s.position && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:6, background:`${POS_COLOR[s.position]}20`, color:POS_COLOR[s.position], fontWeight:700 }}>{s.position}</span>}
            <span style={{ fontSize:11, padding:'3px 9px', borderRadius:8, background:STATUS_BG[s.status], color:STATUS_COLOR[s.status], fontWeight:700 }}>{STATUS_LABEL[s.status]}</span>
          </div>
        </div>
      ))}
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
  const [viewTab, setViewTab] = useState<'grid' | 'month'>('grid')
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
    const pad = (n: number) => String(n).padStart(2,'0')
    const start = `${y}-${pad(m+1)}-01`
    const end = `${y}-${pad(m+1)}-${pad(getDaysInMonth(y,m))}`
    const { data } = await supabase.from('schedules').select('*').eq('store_id', sid).gte('schedule_date', start).lte('schedule_date', end).order('schedule_date')
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

  const tabBtn = (active: boolean) => ({
    flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer' as const,
    fontSize: 13, fontWeight: active ? 700 : 400,
    background: active ? '#fff' : 'transparent', color: active ? '#1a1a2e' : '#aaa',
    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
  })

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <span style={{ fontSize:17, fontWeight:700, color:'#1a1a2e' }}>📅 스케줄</span>
        {isManager && viewTab === 'grid' && (
          <span style={{ fontSize:11, color:'#aaa' }}>셀을 눌러 스케줄을 편집하세요</span>
        )}
      </div>

      {/* 탭 */}
      <div style={{ display:'flex', background:'#F4F6F9', borderRadius:12, padding:4, marginBottom:16 }}>
        <button style={tabBtn(viewTab==='grid')} onClick={() => setViewTab('grid')}>📊 그리드 편집</button>
        <button style={tabBtn(viewTab==='month')} onClick={() => setViewTab('month')}>📅 월간 보기</button>
      </div>

      {viewTab === 'grid' && (
        <GridEditor year={calYear} month={calMonth} schedules={schedules} staffList={staffList}
          isManager={isManager} storeId={storeId} myName={myName}
          onSaved={() => loadData(storeId, calYear, calMonth)} onChangeMonth={handleChangeMonth} />
      )}
      {viewTab === 'month' && (
        <MonthlyView year={calYear} month={calMonth} schedules={schedules}
          onChangeMonth={handleChangeMonth} selectedDate={selectedDate} onDayClick={setSelectedDate} />
      )}
    </div>
  )
}