'use client'
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import YearMonthPicker from '@/components/YearMonthPicker'

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
function CellPopup({ staffName, dateStr, current, role, myName, onSave, onRequest, onDelete, onClose }: {
  staffName: string; dateStr: string; current: any | null
  role: string; myName: string
  onSave: (status: string, position: string, note: string) => void
  onRequest: (status: string, note: string) => void
  onDelete: () => void; onClose: () => void
}) {
  const [status, setStatus] = useState(current?.status || 'work')
  const [position, setPosition] = useState(current?.position || '')
  const [note, setNote] = useState(current?.note || '')
  const [requestNote, setRequestNote] = useState('')
  const [mode, setMode] = useState<'edit'|'request'>('edit')
  const parts = dateStr.split('-')
  const dow = ['일','월','화','수','목','금','토'][new Date(dateStr).getDay()]

  const isOwner = role === 'owner'
  const isManager = role === 'manager'

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, padding:20, width:'100%', maxWidth:320, boxShadow:'0 8px 32px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}>

        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>{staffName}</div>
          <div style={{ fontSize:12, color:'#aaa', marginTop:2 }}>{parts[1]}월 {parts[2]}일 ({dow})</div>
        </div>

        {/* 관리자: 탭 전환 */}
        {isManager && (
          <div style={{ display:'flex', background:'#F4F6F9', borderRadius:10, padding:3, marginBottom:14 }}>
            <button onClick={() => setMode('edit')}
              style={{ flex:1, padding:'6px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:mode==='edit'?700:400,
                background:mode==='edit'?'#fff':'transparent', color:mode==='edit'?'#1a1a2e':'#aaa',
                boxShadow:mode==='edit'?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>
              포지션 편집
            </button>
            <button onClick={() => setMode('request')}
              style={{ flex:1, padding:'6px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:mode==='request'?700:400,
                background:mode==='request'?'#fff':'transparent', color:mode==='request'?'#E84393':'#aaa',
                boxShadow:mode==='request'?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>
              휴일 변경 요청
            </button>
          </div>
        )}

        {/* 대표 or 관리자 포지션 편집 모드 */}
        {(isOwner || (isManager && mode === 'edit')) && (
          <>
            {/* 대표만 상태 변경 가능 */}
            {isOwner && (
              <>
                <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>상태</div>
                <div style={{ display:'flex', gap:6, marginBottom:14 }}>
                  {(['work','off','half'] as const).map(s => (
                    <button key={s} onClick={() => setStatus(s)}
                      style={{ flex:1, padding:'9px 0', borderRadius:10,
                        border: status===s ? `1.5px solid ${STATUS_COLOR[s]}` : '1px solid #E8ECF0',
                        background: status===s ? STATUS_BG[s] : '#F4F6F9',
                        color: status===s ? STATUS_COLOR[s] : '#aaa',
                        fontSize:12, fontWeight:status===s?700:400, cursor:'pointer' }}>
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* 포지션 - 대표/관리자 모두 가능 */}
            <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>포지션</div>
            <div style={{ display:'flex', gap:6, marginBottom:14 }}>
              {(['','K','H','KH']).map(p => (
                <button key={p} onClick={() => setPosition(p)}
                  style={{ flex:1, padding:'7px 0', borderRadius:9,
                    border: position===p ? `1.5px solid ${POS_COLOR[p]||'#999'}` : '1px solid #E8ECF0',
                    background: position===p ? `${POS_COLOR[p]||'#888'}18` : '#F4F6F9',
                    color: position===p ? (POS_COLOR[p]||'#555') : '#aaa',
                    fontSize:12, fontWeight:position===p?700:400, cursor:'pointer' }}>
                  {p||'없음'}
                </button>
              ))}
            </div>

            <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>메모</div>
            <input value={note} onChange={e => setNote(e.target.value)}
              placeholder="병원, 생일, 야채샐러드..."
              style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'#F8F9FB', border:'1px solid #E0E4E8', fontSize:13, outline:'none', boxSizing:'border-box' as const, marginBottom:16 }} />

            <div style={{ display:'flex', gap:8 }}>
              {current && isOwner && (
                <button onClick={onDelete}
                  style={{ padding:'10px 14px', borderRadius:10, background:'rgba(232,67,147,0.08)', border:'1px solid rgba(232,67,147,0.25)', color:'#E84393', fontSize:12, cursor:'pointer', fontWeight:600 }}>
                  삭제
                </button>
              )}
              <button onClick={() => onSave(isOwner ? status : (current?.status || 'work'), position, note)}
                style={{ flex:1, padding:'10px 0', borderRadius:10, background:'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                저장
              </button>
            </div>
          </>
        )}

        {/* 관리자 휴일 변경 요청 모드 */}
        {isManager && mode === 'request' && (
          <>
            <div style={{ background:'rgba(232,67,147,0.06)', borderRadius:12, padding:12, marginBottom:14, border:'1px solid rgba(232,67,147,0.15)' }}>
              <div style={{ fontSize:11, color:'#E84393', fontWeight:600, marginBottom:4 }}>📋 휴일 변경 요청</div>
              <div style={{ fontSize:11, color:'#888' }}>대표 승인 후 반영됩니다</div>
            </div>

            <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>요청 상태</div>
            <div style={{ display:'flex', gap:6, marginBottom:14 }}>
              {(['work','off','half'] as const).map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  style={{ flex:1, padding:'9px 0', borderRadius:10,
                    border: status===s ? `1.5px solid ${STATUS_COLOR[s]}` : '1px solid #E8ECF0',
                    background: status===s ? STATUS_BG[s] : '#F4F6F9',
                    color: status===s ? STATUS_COLOR[s] : '#aaa',
                    fontSize:12, fontWeight:status===s?700:400, cursor:'pointer' }}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>

            <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>요청 사유</div>
            <input value={requestNote} onChange={e => setRequestNote(e.target.value)}
              placeholder="변경 사유를 입력해주세요"
              style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'#F8F9FB', border:'1px solid #E0E4E8', fontSize:13, outline:'none', boxSizing:'border-box' as const, marginBottom:16 }} />

            <button onClick={() => onRequest(status, requestNote)}
              style={{ width:'100%', padding:'10px 0', borderRadius:10, background:'linear-gradient(135deg,#E84393,#FF6B35)', border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>
              변경 요청 보내기
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── 요청 승인 패널 (대표용) ───
function RequestPanel({ storeId, myName, onClose, onApproved }: {
  storeId: string; myName: string; onClose: () => void; onApproved: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [requests, setRequests] = useState<any[]>([])

  useEffect(() => { loadRequests() }, [])

  async function loadRequests() {
    const { data } = await supabase.from('schedule_requests')
      .select('*').eq('store_id', storeId).eq('status', 'pending')
      .order('created_at', { ascending: false })
    setRequests(data || [])
  }

  async function handleApprove(req: any) {
    // 스케줄 변경
    await supabase.from('schedules').upsert({
      store_id: storeId, staff_name: req.staff_name,
      schedule_date: req.schedule_date, status: req.requested_status,
      position: null, note: req.note
    }, { onConflict: 'store_id,staff_name,schedule_date' })
    // 요청 승인 처리
    await supabase.from('schedule_requests').update({
      status: 'approved', reviewed_by: myName, reviewed_at: new Date().toISOString()
    }).eq('id', req.id)
    loadRequests(); onApproved()
  }

  async function handleReject(req: any) {
    await supabase.from('schedule_requests').update({
      status: 'rejected', reviewed_by: myName, reviewed_at: new Date().toISOString()
    }).eq('id', req.id)
    loadRequests()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'80vh', overflowY:'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>📋 휴일 변경 요청</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>

        {requests.length === 0 ? (
          <div style={{ textAlign:'center', padding:32, color:'#bbb' }}>
            <div style={{ fontSize:20, marginBottom:8 }}>✅</div>
            <div style={{ fontSize:13 }}>대기 중인 요청이 없습니다</div>
          </div>
        ) : requests.map(req => (
          <div key={req.id} style={{ background:'#fff', borderRadius:14, border:'1px solid rgba(232,67,147,0.2)', padding:14, marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div>
                <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{req.staff_name}</span>
                <span style={{ fontSize:11, color:'#aaa', marginLeft:8 }}>{req.schedule_date}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                {req.current_status && (
                  <span style={{ fontSize:10, color:STATUS_COLOR[req.current_status], background:STATUS_BG[req.current_status], padding:'2px 7px', borderRadius:6, fontWeight:700 }}>
                    {STATUS_LABEL[req.current_status]}
                  </span>
                )}
                <span style={{ fontSize:12, color:'#aaa' }}>→</span>
                <span style={{ fontSize:10, color:STATUS_COLOR[req.requested_status], background:STATUS_BG[req.requested_status], padding:'2px 7px', borderRadius:6, fontWeight:700 }}>
                  {STATUS_LABEL[req.requested_status]}
                </span>
              </div>
            </div>
            {req.note && <div style={{ fontSize:11, color:'#888', marginBottom:10, padding:'6px 10px', background:'#F8F9FB', borderRadius:8 }}>{req.note}</div>}
            <div style={{ fontSize:10, color:'#aaa', marginBottom:10 }}>요청자: {req.requester_nm} · {new Date(req.created_at).toLocaleDateString('ko')}</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => handleReject(req)}
                style={{ flex:1, padding:'8px 0', borderRadius:10, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#aaa', fontSize:12, cursor:'pointer', fontWeight:600 }}>
                거절
              </button>
              <button onClick={() => handleApprove(req)}
                style={{ flex:2, padding:'8px 0', borderRadius:10, background:'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:12, cursor:'pointer', fontWeight:700 }}>
                ✓ 승인
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 그리드 편집기 ───
function GridEditor({ year, month, schedules, staffList, role, storeId, myName, onSaved, onChangeMonth, pendingCount }: {
  year: number; month: number; schedules: any[]
  staffList: string[]; role: string; storeId: string; myName: string
  onSaved: () => void; onChangeMonth: (y: number, m: number) => void
  pendingCount: number
}) {
  const supabase = createSupabaseBrowserClient()
  const [popup, setPopup] = useState<{ staff: string; date: string } | null>(null)
  const [showRequests, setShowRequests] = useState(false)
  const today = toDateStr(new Date())
  const daysInMonth = getDaysInMonth(year, month)
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth])

  const isOwner = role === 'owner'
  const isManager = role === 'manager'
  const isStaff = role === 'staff'

  // 스크롤 동기화
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const bodyScrollRefs = useRef<(HTMLDivElement | null)[]>([])
  const footerScrollRef = useRef<HTMLDivElement>(null)
  const isSyncing = useRef(false)

  const syncScroll = useCallback((left: number) => {
    if (isSyncing.current) return
    isSyncing.current = true
    headerScrollRef.current && (headerScrollRef.current.scrollLeft = left)
    bodyScrollRefs.current.forEach(r => r && (r.scrollLeft = left))
    footerScrollRef.current && (footerScrollRef.current.scrollLeft = left)
    setTimeout(() => { isSyncing.current = false }, 50)
  }, [])

  useEffect(() => {
    const todayDay = parseInt(today.split('-')[2])
    setTimeout(() => syncScroll(Math.max(0, (todayDay - 3) * 44)), 150)
  }, [year, month, staffList])

  // 보여줄 직원 (직원은 본인만)
  const visibleStaff = isStaff ? staffList.filter(n => n === myName) : staffList

  const scheduleMap = useMemo(() => {
    const m: Record<string, any> = {}
    schedules.forEach(s => { m[`${s.staff_name}-${s.schedule_date}`] = s })
    return m
  }, [schedules])

  const popupData = popup ? (scheduleMap[`${popup.staff}-${popup.date}`] || null) : null

  // 셀 클릭 가능 여부
  function canClick(staff: string, hasSchedule: boolean) {
    if (isOwner) return true
    if (isManager) return hasSchedule // 관리자는 기존 근무 있는 셀만 클릭 가능
    return false // 직원은 읽기 전용
  }

  async function handleSave(status: string, position: string, note: string) {
    if (!popup) return
    await supabase.from('schedules').upsert({
      store_id: storeId, staff_name: popup.staff, schedule_date: popup.date,
      status, position: position || null, note: note || null
    }, { onConflict: 'store_id,staff_name,schedule_date' })
    setPopup(null); onSaved()
  }

  async function handleRequest(status: string, note: string) {
    if (!popup) return
    const current = scheduleMap[`${popup.staff}-${popup.date}`]
    await supabase.from('schedule_requests').insert({
      store_id: storeId, requester_nm: myName, staff_name: popup.staff,
      schedule_date: popup.date, requested_status: status,
      current_status: current?.status || null, note: note || null
    })
    setPopup(null)
    alert('변경 요청이 전송되었습니다!')
  }

  async function handleDelete() {
    if (!popup || !popupData) return
    await supabase.from('schedules').delete().eq('id', popupData.id)
    setPopup(null); onSaved()
  }

  if (visibleStaff.length === 0) return (
    <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8ECF0', padding:32, textAlign:'center' }}>
      <div style={{ fontSize:24, marginBottom:8 }}>👥</div>
      <div style={{ fontSize:13, color:'#bbb' }}>직원이 없습니다</div>
    </div>
  )

  return (
    <div>
      {popup && (
        <CellPopup staffName={popup.staff} dateStr={popup.date} current={popupData}
          role={role} myName={myName}
          onSave={handleSave} onRequest={handleRequest} onDelete={handleDelete} onClose={() => setPopup(null)} />
      )}
      {showRequests && (
        <RequestPanel storeId={storeId} myName={myName}
          onClose={() => setShowRequests(false)} onApproved={() => { onSaved(); setShowRequests(false) }} />
      )}

      {/* 헤더 */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <div style={{ flex:1 }}>
          <YearMonthPicker year={year} month={month} onChange={onChangeMonth} color="#6C5CE7" />
        </div>
        {isOwner && (
          <button onClick={() => setShowRequests(true)}
            style={{ padding:'7px 12px', borderRadius:10, background: pendingCount>0?'rgba(232,67,147,0.1)':'#F4F6F9', border: pendingCount>0?'1px solid rgba(232,67,147,0.3)':'1px solid #E8ECF0', color: pendingCount>0?'#E84393':'#aaa', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
            📋 요청 {pendingCount > 0 && <span style={{ background:'#E84393', color:'#fff', borderRadius:10, padding:'1px 6px', fontSize:10, marginLeft:4 }}>{pendingCount}</span>}
          </button>
        )}
      </div>

      {/* 범례 */}
      <div style={{ display:'flex', gap:10, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
        {Object.entries(STATUS_LABEL).map(([k,v]) => (
          <div key={k} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:10, height:10, borderRadius:3, background:STATUS_BG[k], border:`1px solid ${STATUS_COLOR[k]}` }} />
            <span style={{ fontSize:10, color:'#888' }}>{v}</span>
          </div>
        ))}
        <span style={{ fontSize:10, color:'#FF6B35', fontWeight:700 }}>K</span>
        <span style={{ fontSize:10, color:'#2DC6D6', fontWeight:700 }}>H</span>
        <span style={{ fontSize:10, color:'#6C5CE7', fontWeight:700 }}>KH</span>
        {isStaff && <span style={{ fontSize:10, color:'#bbb', marginLeft:'auto' }}>읽기 전용</span>}
        {isManager && <span style={{ fontSize:10, color:'#aaa', marginLeft:'auto' }}>포지션 편집 / 휴일 요청 가능</span>}
        {isOwner && <span style={{ fontSize:10, color:'#aaa', marginLeft:'auto' }}>셀 눌러서 편집</span>}
      </div>

      {/* 그리드 */}
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8ECF0', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
        {/* 헤더 행 */}
        <div style={{ display:'flex', borderBottom:'2px solid #E8ECF0' }}>
          <div style={{ minWidth:68, flexShrink:0, background:'#F8F9FB', borderRight:'2px solid #E8ECF0', display:'flex', alignItems:'center', justifyContent:'center', padding:'8px 4px' }}>
            <span style={{ fontSize:10, color:'#aaa', fontWeight:700 }}>이름</span>
          </div>
          <div ref={headerScrollRef} style={{ flex:1, overflowX:'auto', display:'flex' }}
            onScroll={e => syncScroll(e.currentTarget.scrollLeft)}>
            {days.map(day => {
              const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`
              const dow = new Date(dateStr).getDay()
              const isToday = dateStr === today
              const isSun = dow===0; const isSat = dow===6
              return (
                <div key={day} style={{ minWidth:44, flexShrink:0, padding:'6px 2px', textAlign:'center',
                  background:isToday?'rgba(108,92,231,0.07)':'#F8F9FB', borderRight:'1px solid #F0F2F5' }}>
                  <div style={{ fontSize:11, fontWeight:isToday?700:500, color:isToday?'#6C5CE7':isSun?'#E84393':isSat?'#2DC6D6':'#555' }}>{day}</div>
                  <div style={{ fontSize:9, color:isSun?'#E84393':isSat?'#2DC6D6':'#bbb' }}>{['일','월','화','수','목','금','토'][dow]}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 직원 행 */}
        {visibleStaff.map((staff, si) => (
          <div key={staff} style={{ display:'flex', borderTop:si>0?'1px solid #F0F2F5':'none' }}>
            <div style={{ minWidth:68, flexShrink:0, background:'#FAFBFC', borderRight:'2px solid #E8ECF0',
              display:'flex', alignItems:'center', justifyContent:'center', padding:'4px 6px', minHeight:52 }}>
              <span style={{ fontSize:11, fontWeight:600, color:'#1a1a2e', textAlign:'center', wordBreak:'keep-all', lineHeight:1.3 }}>{staff}</span>
            </div>
            <div ref={el => { bodyScrollRefs.current[si] = el }}
              style={{ flex:1, overflowX:'auto', display:'flex' }}
              onScroll={e => syncScroll(e.currentTarget.scrollLeft)}>
              {days.map(day => {
                const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`
                const s = scheduleMap[`${staff}-${dateStr}`]
                const dow = new Date(dateStr).getDay()
                const isToday = dateStr === today
                const isSun = dow===0; const isSat = dow===6
                const clickable = canClick(staff, !!s)
                return (
                  <div key={day}
                    onClick={() => clickable && setPopup({ staff, date: dateStr })}
                    style={{ minWidth:44, flexShrink:0, borderRight:'1px solid #F0F2F5', minHeight:52,
                      background:s?STATUS_BG[s.status]:isToday?'rgba(108,92,231,0.03)':isSun||isSat?'#FAFBFC':'#fff',
                      cursor:clickable?'pointer':'default',
                      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1 }}>
                    {s ? (
                      <>
                        <span style={{ fontSize:9, fontWeight:700, color:STATUS_COLOR[s.status], lineHeight:1.2 }}>{STATUS_LABEL[s.status]}</span>
                        {s.position && <span style={{ fontSize:9, fontWeight:700, color:POS_COLOR[s.position]||'#888' }}>{s.position}</span>}
                        {s.note && <span style={{ fontSize:7, color:'#999', maxWidth:40, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.note}</span>}
                      </>
                    ) : clickable ? (
                      <span style={{ fontSize:16, color:'#ebebeb', lineHeight:1 }}>+</span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* 출근 합계 */}
        <div style={{ display:'flex', borderTop:'2px solid #E8ECF0', background:'#F8F9FB' }}>
          <div style={{ minWidth:68, flexShrink:0, borderRight:'2px solid #E8ECF0', display:'flex', alignItems:'center', justifyContent:'center', padding:'4px 0' }}>
            <span style={{ fontSize:9, color:'#6C5CE7', fontWeight:700 }}>출근</span>
          </div>
          <div ref={footerScrollRef} style={{ flex:1, overflowX:'auto', display:'flex' }}
            onScroll={e => syncScroll(e.currentTarget.scrollLeft)}>
            {days.map(day => {
              const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`
              const cnt = visibleStaff.filter(staff => {
                const s = scheduleMap[`${staff}-${dateStr}`]
                return s && (s.status==='work'||s.status==='half')
              }).length
              return (
                <div key={day} style={{ minWidth:44, flexShrink:0, borderRight:'1px solid #F0F2F5', minHeight:28, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {cnt>0 && <span style={{ fontSize:10, fontWeight:700, color:'#6C5CE7' }}>{cnt}</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 월간 요약 */}
      <div style={{ marginTop:16 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#1a1a2e', marginBottom:8 }}>월간 요약</div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {visibleStaff.map(staff => {
            const ss = schedules.filter(s => s.staff_name===staff)
            const work = ss.filter(s => s.status==='work').length
            const off = ss.filter(s => s.status==='off').length
            const half = ss.filter(s => s.status==='half').length
            return (
              <div key={staff} style={{ background:'#fff', borderRadius:12, border:'1px solid #E8ECF0', padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:13, fontWeight:600, color:'#1a1a2e' }}>{staff}</span>
                <div style={{ display:'flex', gap:10 }}>
                  <span style={{ fontSize:11, color:'#6C5CE7', fontWeight:700 }}>근무 {work}</span>
                  {half>0 && <span style={{ fontSize:11, color:'#FF6B35', fontWeight:700 }}>반차 {half}</span>}
                  <span style={{ fontSize:11, color:'#E84393', fontWeight:700 }}>휴일 {off}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── 월간 캘린더 ───
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
    const m: Record<string, { work:number; off:number }> = {}
    schedules.forEach(s => {
      if (!m[s.schedule_date]) m[s.schedule_date] = { work:0, off:0 }
      if (s.status==='work'||s.status==='half') m[s.schedule_date].work++
      else m[s.schedule_date].off++
    })
    return m
  }, [schedules])

  const weeks: (number|null)[][] = []
  let week: (number|null)[] = Array(firstDay).fill(null)
  for (let d=1; d<=daysInMonth; d++) {
    week.push(d)
    if (week.length===7) { weeks.push(week); week=[] }
  }
  if (week.length>0) { while(week.length<7) week.push(null); weeks.push(week) }

  const selSchedules = schedules.filter(s => s.schedule_date===selectedDate)
    .sort((a,b) => a.staff_name.localeCompare(b.staff_name))

  return (
    <div>
      <div style={{ marginBottom:14 }}>
        <YearMonthPicker year={year} month={month} onChange={onChangeMonth} color="#6C5CE7" />
      </div>

      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8ECF0', padding:'14px 10px', marginBottom:14, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:6 }}>
          {['일','월','화','수','목','금','토'].map((d,i) => (
            <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:600, color:i===0?'#E84393':i===6?'#2DC6D6':'#aaa' }}>{d}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:3 }}>
            {week.map((day, di) => {
              if (!day) return <div key={di} />
              const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`
              const info = dayMap[dateStr]
              const isSel = dateStr===selectedDate
              const isToday = dateStr===today
              return (
                <button key={di} onClick={() => onDayClick(dateStr)}
                  style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'4px 2px', borderRadius:10, cursor:'pointer', minHeight:50,
                    border:isSel?'2px solid #6C5CE7':isToday?'1.5px solid rgba(108,92,231,0.3)':'1px solid transparent',
                    background:isSel?'rgba(108,92,231,0.08)':'transparent' }}>
                  <span style={{ fontSize:12, fontWeight:isSel||isToday?700:400, color:isSel?'#6C5CE7':di===0?'#E84393':di===6?'#2DC6D6':'#1a1a2e' }}>{day}</span>
                  {info && (
                    <div style={{ display:'flex', flexDirection:'column', gap:1, marginTop:2, width:'100%', alignItems:'center' }}>
                      {info.work>0 && <span style={{ fontSize:8, background:'rgba(108,92,231,0.15)', color:'#6C5CE7', borderRadius:4, padding:'0px 3px', fontWeight:700 }}>{info.work}명</span>}
                      {info.off>0 && <span style={{ fontSize:8, background:'rgba(232,67,147,0.1)', color:'#E84393', borderRadius:4, padding:'0px 3px' }}>휴{info.off}</span>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:10 }}>
        {selectedDate.replace(/-/g,'.')}
        {selectedDate===today && <span style={{ fontSize:10, color:'#FF6B35', background:'rgba(255,107,53,0.1)', padding:'1px 7px', borderRadius:6, marginLeft:6 }}>오늘</span>}
      </div>
      {selSchedules.length===0 ? (
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E8ECF0', padding:'24px 0', textAlign:'center', color:'#bbb' }}>
          <div style={{ fontSize:18, marginBottom:6 }}>📅</div>
          <div style={{ fontSize:12 }}>스케줄이 없습니다</div>
        </div>
      ) : selSchedules.map(s => (
        <div key={s.id} style={{ background:'#fff', borderRadius:12, border:`1px solid ${STATUS_COLOR[s.status]}30`, padding:'10px 14px', marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:STATUS_COLOR[s.status], flexShrink:0 }} />
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
  const [role, setRole] = useState('staff')
  const [schedules, setSchedules] = useState<any[]>([])
  const [staffList, setStaffList] = useState<string[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [viewTab, setViewTab] = useState<'grid'|'month'>('grid')
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
    setRole(user.role || 'staff')
    loadStaff(store.id)
    loadData(store.id, nowD.getFullYear(), nowD.getMonth())
    if (user.role === 'owner') loadPendingCount(store.id)
  }, [])

  async function loadData(sid: string, y: number, m: number) {
    const pad = (n: number) => String(n).padStart(2,'0')
    const start = `${y}-${pad(m+1)}-01`
    const end = `${y}-${pad(m+1)}-${pad(getDaysInMonth(y,m))}`
    const { data } = await supabase.from('schedules').select('*')
      .eq('store_id', sid).gte('schedule_date', start).lte('schedule_date', end)
      .order('schedule_date')
    setSchedules(data || [])
  }

  async function loadStaff(sid: string) {
    const { data } = await supabase.from('store_members')
      .select('profile_id, role, active, profiles(nm)')
      .eq('store_id', sid).eq('active', true)
    const names = (data || []).map((m: any) => m.profiles?.nm).filter(Boolean).sort()
    setStaffList(names)
  }

  async function loadPendingCount(sid: string) {
    const { count } = await supabase.from('schedule_requests')
      .select('*', { count:'exact', head:true }).eq('store_id', sid).eq('status', 'pending')
    setPendingCount(count || 0)
  }

  function handleChangeMonth(y: number, m: number) {
    setCalYear(y); setCalMonth(m)
    loadData(storeId, y, m)
  }

  const tabBtn = (active: boolean) => ({
    flex:1, padding:'9px 0', borderRadius:10, border:'none', cursor:'pointer' as const,
    fontSize:13, fontWeight:active?700:400,
    background:active?'#fff':'transparent', color:active?'#1a1a2e':'#aaa',
    boxShadow:active?'0 1px 4px rgba(0,0,0,0.08)':'none',
  })

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <span style={{ fontSize:17, fontWeight:700, color:'#1a1a2e' }}>📅 스케줄</span>
        {/* 역할 배지 */}
        <span style={{ fontSize:10, padding:'3px 10px', borderRadius:10,
          background:role==='owner'?'rgba(108,92,231,0.1)':role==='manager'?'rgba(255,107,53,0.1)':'rgba(0,184,148,0.1)',
          color:role==='owner'?'#6C5CE7':role==='manager'?'#FF6B35':'#00B894', fontWeight:700 }}>
          {role==='owner'?'대표':role==='manager'?'관리자':'직원'}
        </span>
      </div>

      <div style={{ display:'flex', background:'#F4F6F9', borderRadius:12, padding:4, marginBottom:16 }}>
        <button style={tabBtn(viewTab==='grid')} onClick={() => setViewTab('grid')}>📊 그리드 편집</button>
        <button style={tabBtn(viewTab==='month')} onClick={() => setViewTab('month')}>📅 월간 보기</button>
      </div>

      {viewTab==='grid' && (
        <GridEditor year={calYear} month={calMonth} schedules={schedules} staffList={staffList}
          role={role} storeId={storeId} myName={myName} pendingCount={pendingCount}
          onSaved={() => { loadData(storeId, calYear, calMonth); if(role==='owner') loadPendingCount(storeId) }}
          onChangeMonth={handleChangeMonth} />
      )}
      {viewTab==='month' && (
        <MonthlyView year={calYear} month={calMonth} schedules={schedules}
          onChangeMonth={handleChangeMonth} selectedDate={selectedDate} onDayClick={setSelectedDate} />
      )}
    </div>
  )
}