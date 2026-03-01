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
const DOW_LABEL = ['일','월','화','수','목','금','토']

// ─── 셀 팝업 (기존 그대로) ───
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
  const dow = DOW_LABEL[new Date(dateStr).getDay()]
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
        {isManager && (
          <div style={{ display:'flex', background:'#F4F6F9', borderRadius:10, padding:3, marginBottom:14 }}>
            <button onClick={() => setMode('edit')}
              style={{ flex:1, padding:'6px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:mode==='edit'?700:400,
                background:mode==='edit'?'#fff':'transparent', color:mode==='edit'?'#1a1a2e':'#aaa',
                boxShadow:mode==='edit'?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>포지션 편집</button>
            <button onClick={() => setMode('request')}
              style={{ flex:1, padding:'6px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:mode==='request'?700:400,
                background:mode==='request'?'#fff':'transparent', color:mode==='request'?'#E84393':'#aaa',
                boxShadow:mode==='request'?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>휴일 변경 요청</button>
          </div>
        )}
        {(isOwner || (isManager && mode === 'edit')) && (
          <>
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
                        fontSize:12, fontWeight:status===s?700:400, cursor:'pointer' }}>{STATUS_LABEL[s]}</button>
                  ))}
                </div>
              </>
            )}
            <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>포지션</div>
            <div style={{ display:'flex', gap:6, marginBottom:14 }}>
              {(['','K','H','KH']).map(p => (
                <button key={p} onClick={() => setPosition(p)}
                  style={{ flex:1, padding:'7px 0', borderRadius:9,
                    border: position===p ? `1.5px solid ${POS_COLOR[p]||'#999'}` : '1px solid #E8ECF0',
                    background: position===p ? `${POS_COLOR[p]||'#888'}18` : '#F4F6F9',
                    color: position===p ? (POS_COLOR[p]||'#555') : '#aaa',
                    fontSize:12, fontWeight:position===p?700:400, cursor:'pointer' }}>{p||'없음'}</button>
              ))}
            </div>
            <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>메모</div>
            <input value={note} onChange={e => setNote(e.target.value)}
              placeholder="병원, 생일, 야채샐러드..."
              style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'#F8F9FB', border:'1px solid #E0E4E8', fontSize:13, outline:'none', boxSizing:'border-box' as const, marginBottom:16 }} />
            <div style={{ display:'flex', gap:8 }}>
              {current && isOwner && (
                <button onClick={onDelete}
                  style={{ padding:'10px 14px', borderRadius:10, background:'rgba(232,67,147,0.08)', border:'1px solid rgba(232,67,147,0.25)', color:'#E84393', fontSize:12, cursor:'pointer', fontWeight:600 }}>삭제</button>
              )}
              <button onClick={() => onSave(isOwner ? status : (current?.status || 'work'), position, note)}
                style={{ flex:1, padding:'10px 0', borderRadius:10, background:'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>저장</button>
            </div>
          </>
        )}
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
                    fontSize:12, fontWeight:status===s?700:400, cursor:'pointer' }}>{STATUS_LABEL[s]}</button>
              ))}
            </div>
            <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>요청 사유</div>
            <input value={requestNote} onChange={e => setRequestNote(e.target.value)}
              placeholder="변경 사유를 입력해주세요"
              style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'#F8F9FB', border:'1px solid #E0E4E8', fontSize:13, outline:'none', boxSizing:'border-box' as const, marginBottom:16 }} />
            <button onClick={() => onRequest(status, requestNote)}
              style={{ width:'100%', padding:'10px 0', borderRadius:10, background:'linear-gradient(135deg,#E84393,#FF6B35)', border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>변경 요청 보내기</button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── 요청 승인 패널 (기존 그대로) ───
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
    await supabase.from('schedules').upsert({
      store_id: storeId, staff_name: req.staff_name,
      schedule_date: req.schedule_date, status: req.requested_status,
      position: null, note: req.note
    }, { onConflict: 'store_id,staff_name,schedule_date' })
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
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'80vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
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
                {req.current_status && <span style={{ fontSize:10, color:STATUS_COLOR[req.current_status], background:STATUS_BG[req.current_status], padding:'2px 7px', borderRadius:6, fontWeight:700 }}>{STATUS_LABEL[req.current_status]}</span>}
                <span style={{ fontSize:12, color:'#aaa' }}>→</span>
                <span style={{ fontSize:10, color:STATUS_COLOR[req.requested_status], background:STATUS_BG[req.requested_status], padding:'2px 7px', borderRadius:6, fontWeight:700 }}>{STATUS_LABEL[req.requested_status]}</span>
              </div>
            </div>
            {req.note && <div style={{ fontSize:11, color:'#888', marginBottom:10, padding:'6px 10px', background:'#F8F9FB', borderRadius:8 }}>{req.note}</div>}
            <div style={{ fontSize:10, color:'#aaa', marginBottom:10 }}>요청자: {req.requester_nm} · {new Date(req.created_at).toLocaleDateString('ko')}</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => handleReject(req)} style={{ flex:1, padding:'8px 0', borderRadius:10, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#aaa', fontSize:12, cursor:'pointer', fontWeight:600 }}>거절</button>
              <button onClick={() => handleApprove(req)} style={{ flex:2, padding:'8px 0', borderRadius:10, background:'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:12, cursor:'pointer', fontWeight:700 }}>✓ 승인</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// PC 전용 그리드 (날짜↓ × 직원→ — 엑셀 방향)
// ════════════════════════════════════════
function PCGridEditor({ year, month, schedules, staffList, role, storeId, myName, onSaved, onChangeMonth, pendingCount }: {
  year: number; month: number; schedules: any[]
  staffList: string[]; role: string; storeId: string; myName: string
  onSaved: () => void; onChangeMonth: (y: number, m: number) => void
  pendingCount: number
}) {
  const supabase = createSupabaseBrowserClient()
  const [popup, setPopup] = useState<{ staff: string; date: string } | null>(null)
  const [showRequests, setShowRequests] = useState(false)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [dragOrder, setDragOrder] = useState<string[]>([])
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const today = toDateStr(new Date())
  const daysInMonth = getDaysInMonth(year, month)
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth])
  const isOwner = role === 'owner'
  const isManager = role === 'manager'
  const isStaff = role === 'staff'
  const visibleStaff = isStaff ? staffList.filter(n => n === myName) : staffList

  // 순서 모달 열 때 현재 순서 복사
  function openOrderModal() {
    setDragOrder([...visibleStaff])
    setShowOrderModal(true)
  }
  function saveOrder() {
    localStorage.setItem(`staff_order_${storeId}`, JSON.stringify(dragOrder))
    setShowOrderModal(false)
    // staffList를 직접 갱신 (페이지 리로드 없이)
    onSaved()
  }
  function handleDragStart(idx: number) { setDragIdx(idx) }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    const next = [...dragOrder]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(idx, 0, moved)
    setDragOrder(next)
    setDragIdx(idx)
  }
  function handleDragEnd() { setDragIdx(null) }

  const scheduleMap = useMemo(() => {
    const m: Record<string, any> = {}
    schedules.forEach(s => { m[`${s.staff_name}-${s.schedule_date}`] = s })
    return m
  }, [schedules])

  const popupData = popup ? (scheduleMap[`${popup.staff}-${popup.date}`] || null) : null

  function canClick(staff: string, hasSchedule: boolean) {
    if (isOwner) return true
    if (isManager) return hasSchedule
    return false
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
    setPopup(null); alert('변경 요청이 전송되었습니다!')
  }
  async function handleDelete() {
    if (!popup || !popupData) return
    await supabase.from('schedules').delete().eq('id', popupData.id)
    setPopup(null); onSaved()
  }

  // 직원별 합계
  const staffTotals = useMemo(() => {
    const t: Record<string, { work: number; off: number; half: number }> = {}
    visibleStaff.forEach(s => { t[s] = { work:0, off:0, half:0 } })
    schedules.forEach(s => {
      if (t[s.staff_name]) t[s.staff_name][s.status as 'work'|'off'|'half'] = (t[s.staff_name][s.status as 'work'|'off'|'half'] || 0) + 1
    })
    return t
  }, [schedules, visibleStaff])

  return (
    <>
      {popup && (
        <CellPopup staffName={popup.staff} dateStr={popup.date} current={popupData}
          role={role} myName={myName}
          onSave={handleSave} onRequest={handleRequest} onDelete={handleDelete} onClose={() => setPopup(null)} />
      )}
      {showRequests && (
        <RequestPanel storeId={storeId} myName={myName}
          onClose={() => setShowRequests(false)} onApproved={() => { onSaved(); setShowRequests(false) }} />
      )}

      {/* 직원 순서 변경 모달 */}
      {showOrderModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setShowOrderModal(false)}>
          <div style={{ background:'#fff', borderRadius:20, padding:24, width:320, boxShadow:'0 8px 32px rgba(0,0,0,0.18)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>👥 직원 순서 변경</div>
            <div style={{ fontSize:11, color:'#aaa', marginBottom:16 }}>드래그해서 순서를 바꿔보세요</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:20 }}>
              {dragOrder.map((name, idx) => (
                <div key={name}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={e => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'10px 14px', borderRadius:10,
                    background: dragIdx===idx ? 'rgba(108,92,231,0.08)' : '#F8F9FB',
                    border: dragIdx===idx ? '1px solid rgba(108,92,231,0.3)' : '1px solid #E8ECF0',
                    cursor:'grab', userSelect:'none',
                    transition:'background 0.1s',
                  }}>
                  <span style={{ color:'#bbb', fontSize:14 }}>⠿</span>
                  <span style={{ fontSize:13, fontWeight:600, color:'#1a1a2e' }}>{name}</span>
                  <span style={{ marginLeft:'auto', fontSize:11, color:'#bbb' }}>{idx+1}</span>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setShowOrderModal(false)}
                style={{ flex:1, padding:'10px 0', borderRadius:10, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', fontSize:13, cursor:'pointer' }}>취소</button>
              <button onClick={saveOrder}
                style={{ flex:2, padding:'10px 0', borderRadius:10, background:'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>저장</button>
            </div>
          </div>
        </div>
      )}

      {/* PC 헤더 바 */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
        <YearMonthPicker year={year} month={month} onChange={onChangeMonth} color="#6C5CE7" />
        <div style={{ display:'flex', gap:8, alignItems:'center', marginLeft:'auto' }}>
          {/* 범례 */}
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {Object.entries(STATUS_LABEL).map(([k,v]) => (
              <div key={k} style={{ display:'flex', alignItems:'center', gap:3 }}>
                <div style={{ width:9, height:9, borderRadius:2, background:STATUS_BG[k], border:`1px solid ${STATUS_COLOR[k]}` }} />
                <span style={{ fontSize:10, color:'#888' }}>{v}</span>
              </div>
            ))}
            {['K','H','KH'].map(p => (
              <span key={p} style={{ fontSize:10, color:POS_COLOR[p], fontWeight:700 }}>{p}</span>
            ))}
          </div>
          {isOwner && (
            <button onClick={openOrderModal}
              style={{ padding:'6px 12px', borderRadius:9, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#6B7684', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
              ↕ 순서
            </button>
          )}
          {isOwner && (
            <button onClick={() => setShowRequests(true)}
              style={{ padding:'6px 12px', borderRadius:9, background: pendingCount>0?'rgba(232,67,147,0.1)':'#F4F6F9', border: pendingCount>0?'1px solid rgba(232,67,147,0.3)':'1px solid #E8ECF0', color: pendingCount>0?'#E84393':'#aaa', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
              📋 요청{pendingCount > 0 && <span style={{ background:'#E84393', color:'#fff', borderRadius:10, padding:'1px 6px', fontSize:10, marginLeft:4 }}>{pendingCount}</span>}
            </button>
          )}
        </div>
      </div>

      {/* ── 테이블: 날짜↓ × 직원→ ── */}
      <div style={{ overflowX:'auto', borderRadius:14, border:'1px solid #E8ECF0', boxShadow:'0 1px 6px rgba(0,0,0,0.05)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', background:'#fff', fontSize:12, tableLayout:'fixed' }}>
          <colgroup>
            <col style={{ width:72 }} />
            {visibleStaff.map(() => <col key={Math.random()} />)}
            <col style={{ width:52 }} />
          </colgroup>

          {/* 직원 이름 헤더 */}
          <thead>
            <tr>
              <th style={{ background:'#F8F9FB', borderBottom:'2px solid #E8ECF0', borderRight:'2px solid #E8ECF0', padding:'10px 8px', fontSize:10, color:'#aaa', fontWeight:700, textAlign:'left', position:'sticky', top:0, zIndex:3 }}>날짜</th>
              {visibleStaff.map(name => (
                <th key={name} style={{ background:'#F8F9FB', borderBottom:'2px solid #E8ECF0', borderRight:'1px solid #ECEEF2', padding:'10px 4px', fontSize:12, color:'#1a1a2e', fontWeight:700, textAlign:'center', position:'sticky', top:0, zIndex:3 }}>
                  {name}
                </th>
              ))}
              <th style={{ background:'#F8F9FB', borderBottom:'2px solid #E8ECF0', padding:'10px 4px', fontSize:10, color:'#6C5CE7', fontWeight:700, textAlign:'center', position:'sticky', top:0, zIndex:3 }}>출근</th>
            </tr>
          </thead>

          <tbody>
            {days.map(day => {
              const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`
              const dow = new Date(dateStr).getDay()
              const isToday = dateStr === today
              const isSun = dow === 0
              const isSat = dow === 6
              const workCnt = visibleStaff.filter(s => {
                const sc = scheduleMap[`${s}-${dateStr}`]
                return sc && (sc.status === 'work' || sc.status === 'half')
              }).length

              const rowBg = isSun ? 'rgba(232,67,147,0.025)' : isSat ? 'rgba(108,92,231,0.025)' : isToday ? 'rgba(108,92,231,0.04)' : '#fff'

              return (
                <tr key={day} style={{ background: rowBg }}>
                  {/* 날짜 열 */}
                  <td style={{
                    borderBottom:'1px solid #ECEEF2', borderRight:'2px solid #E8ECF0',
                    padding:'0 8px', height:40,
                    background: isSun ? 'rgba(232,67,147,0.06)' : isSat ? 'rgba(108,92,231,0.05)' : isToday ? 'rgba(108,92,231,0.07)' : '#FAFBFC',
                    position:'sticky', left:0, zIndex:1
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <span style={{ fontSize:13, fontWeight: isToday ? 700 : 500, color: isToday?'#6C5CE7' : isSun?'#E84393' : isSat?'#6C5CE7' : '#1a1a2e' }}>{day}</span>
                      <span style={{ fontSize:10, fontWeight:600, color: isSun?'#E84393' : isSat?'#6C5CE7' : '#bbb' }}>{DOW_LABEL[dow]}</span>
                      {isToday && <span style={{ fontSize:8, background:'#6C5CE7', color:'#fff', borderRadius:4, padding:'1px 4px', fontWeight:700 }}>오늘</span>}
                    </div>
                  </td>

                  {/* 직원별 셀 */}
                  {visibleStaff.map(staff => {
                    const sc = scheduleMap[`${staff}-${dateStr}`]
                    const clickable = canClick(staff, !!sc)
                    return (
                      <td key={staff}
                        onClick={() => clickable && setPopup({ staff, date: dateStr })}
                        style={{
                          borderBottom:'1px solid #ECEEF2', borderRight:'1px solid #ECEEF2',
                          padding:0, height:40, textAlign:'center', verticalAlign:'middle',
                          cursor: clickable ? 'pointer' : 'default',
                          transition:'background 0.1s',
                          background: sc ? STATUS_BG[sc.status] : undefined,
                        }}
                        onMouseEnter={e => { if(clickable && !sc) (e.currentTarget as HTMLElement).style.background='rgba(108,92,231,0.04)' }}
                        onMouseLeave={e => { if(!sc) (e.currentTarget as HTMLElement).style.background='' }}
                      >
                        {sc ? (
                          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1, height:'100%', padding:'2px 3px' }}>
                            <span style={{ fontSize:10, fontWeight:700, color:STATUS_COLOR[sc.status] }}>{STATUS_LABEL[sc.status]}</span>
                            {sc.position && <span style={{ fontSize:9, fontWeight:700, color:POS_COLOR[sc.position] }}>{sc.position}</span>}
                            {sc.note && (
                              <span title={sc.note} style={{ fontSize:8, color:'#FF6B35', maxWidth:60, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>
                                {sc.note}
                              </span>
                            )}
                          </div>
                        ) : clickable ? (
                          <span style={{ fontSize:18, color:'#e0e0e0', lineHeight:1 }}>+</span>
                        ) : null}
                      </td>
                    )
                  })}

                  {/* 출근 인원 */}
                  <td style={{ borderBottom:'1px solid #ECEEF2', padding:0, textAlign:'center', height:40 }}>
                    {workCnt > 0 && (
                      <span style={{ fontSize:12, fontWeight:700, color: workCnt < 3 ? '#E84393' : '#6C5CE7' }}>{workCnt}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>

          {/* 합계 행 */}
          <tfoot>
            <tr>
              <td style={{ background:'#F4F5F8', borderTop:'2px solid #E8ECF0', borderRight:'2px solid #E8ECF0', padding:'8px', fontSize:10, color:'#888', fontWeight:700, position:'sticky', left:0 }}>합계</td>
              {visibleStaff.map(name => {
                const t = staffTotals[name] || { work:0, off:0, half:0 }
                return (
                  <td key={name} style={{ background:'#F4F5F8', borderTop:'2px solid #E8ECF0', borderRight:'1px solid #ECEEF2', padding:'6px 4px', textAlign:'center' }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:1, alignItems:'center' }}>
                      <span style={{ fontSize:12, fontWeight:700, color:'#6C5CE7' }}>{t.work}일</span>
                      {t.half > 0 && <span style={{ fontSize:9, color:'#FF6B35' }}>반{t.half}</span>}
                      <span style={{ fontSize:10, color:'#E84393' }}>휴{t.off}</span>
                    </div>
                  </td>
                )
              })}
              <td style={{ background:'#F4F5F8', borderTop:'2px solid #E8ECF0' }} />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  )
}

// ════════════════════════════════════════
// 모바일 그리드 (기존 방향 유지)
// ════════════════════════════════════════
function MobileGridEditor({ year, month, schedules, staffList, role, storeId, myName, onSaved, onChangeMonth, pendingCount }: {
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
  const visibleStaff = isStaff ? staffList.filter(n => n === myName) : staffList

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

  const scheduleMap = useMemo(() => {
    const m: Record<string, any> = {}
    schedules.forEach(s => { m[`${s.staff_name}-${s.schedule_date}`] = s })
    return m
  }, [schedules])

  const popupData = popup ? (scheduleMap[`${popup.staff}-${popup.date}`] || null) : null

  function canClick(staff: string, hasSchedule: boolean) {
    if (isOwner) return true
    if (isManager) return hasSchedule
    return false
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
    setPopup(null); alert('변경 요청이 전송되었습니다!')
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
          role={role} myName={myName}
          onSave={handleSave} onRequest={handleRequest} onDelete={handleDelete} onClose={() => setPopup(null)} />
      )}
      {showRequests && (
        <RequestPanel storeId={storeId} myName={myName}
          onClose={() => setShowRequests(false)} onApproved={() => { onSaved(); setShowRequests(false) }} />
      )}
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
      <div style={{ display:'flex', gap:10, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
        {Object.entries(STATUS_LABEL).map(([k,v]) => (
          <div key={k} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:10, height:10, borderRadius:3, background:STATUS_BG[k], border:`1px solid ${STATUS_COLOR[k]}` }} />
            <span style={{ fontSize:10, color:'#888' }}>{v}</span>
          </div>
        ))}
        {isStaff && <span style={{ fontSize:10, color:'#bbb', marginLeft:'auto' }}>읽기 전용</span>}
        {isManager && <span style={{ fontSize:10, color:'#aaa', marginLeft:'auto' }}>포지션 편집 / 휴일 요청 가능</span>}
        {isOwner && <span style={{ fontSize:10, color:'#aaa', marginLeft:'auto' }}>셀 눌러서 편집</span>}
      </div>
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8ECF0', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
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
                <div key={day} style={{ minWidth:44, flexShrink:0, padding:'6px 2px', textAlign:'center', background:isToday?'rgba(108,92,231,0.07)':'#F8F9FB', borderRight:'1px solid #F0F2F5' }}>
                  <div style={{ fontSize:11, fontWeight:isToday?700:500, color:isToday?'#6C5CE7':isSun?'#E84393':isSat?'#2DC6D6':'#555' }}>{day}</div>
                  <div style={{ fontSize:9, color:isSun?'#E84393':isSat?'#2DC6D6':'#bbb' }}>{DOW_LABEL[dow]}</div>
                </div>
              )
            })}
          </div>
        </div>
        {visibleStaff.map((staff, si) => (
          <div key={staff} style={{ display:'flex', borderTop:si>0?'1px solid #F0F2F5':'none' }}>
            <div style={{ minWidth:68, flexShrink:0, background:'#FAFBFC', borderRight:'2px solid #E8ECF0', display:'flex', alignItems:'center', justifyContent:'center', padding:'4px 6px', minHeight:52 }}>
              <span style={{ fontSize:11, fontWeight:600, color:'#1a1a2e', textAlign:'center', wordBreak:'keep-all' as const, lineHeight:1.3 }}>{staff}</span>
            </div>
            <div ref={el => { bodyScrollRefs.current[si] = el }} style={{ flex:1, overflowX:'auto', display:'flex' }}
              onScroll={e => syncScroll(e.currentTarget.scrollLeft)}>
              {days.map(day => {
                const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`
                const s = scheduleMap[`${staff}-${dateStr}`]
                const dow = new Date(dateStr).getDay()
                const isToday = dateStr === today
                const isSun = dow===0; const isSat = dow===6
                const clickable = canClick(staff, !!s)
                return (
                  <div key={day} onClick={() => clickable && setPopup({ staff, date: dateStr })}
                    style={{ minWidth:44, flexShrink:0, borderRight:'1px solid #F0F2F5', minHeight:52,
                      background:s?STATUS_BG[s.status]:isToday?'rgba(108,92,231,0.03)':isSun||isSat?'#FAFBFC':'#fff',
                      cursor:clickable?'pointer':'default', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1 }}>
                    {s ? (
                      <>
                        <span style={{ fontSize:9, fontWeight:700, color:STATUS_COLOR[s.status] }}>{STATUS_LABEL[s.status]}</span>
                        {s.position && <span style={{ fontSize:9, fontWeight:700, color:POS_COLOR[s.position]||'#888' }}>{s.position}</span>}
                        {s.note && <span style={{ fontSize:7, color:'#999', maxWidth:40, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{s.note}</span>}
                      </>
                    ) : clickable ? <span style={{ fontSize:16, color:'#ebebeb' }}>+</span> : null}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
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

// ─── 월간 캘린더 (기존 그대로) ───
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
  const selSchedules = schedules.filter(s => s.schedule_date===selectedDate).sort((a,b) => a.staff_name.localeCompare(b.staff_name))
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

// ════════════════════════════════════════
// 메인
// ════════════════════════════════════════
export default function SchedulePage() {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState('')
  const [myName, setMyName] = useState('')
  const [role, setRole] = useState('staff')
  const [schedules, setSchedules] = useState<any[]>([])
  const [staffList, setStaffList] = useState<string[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [viewTab, setViewTab] = useState<'grid'|'month'>('grid')
  const [isPC, setIsPC] = useState(false)
  const nowD = new Date()
  const [calYear, setCalYear] = useState(nowD.getFullYear())
  const [calMonth, setCalMonth] = useState(nowD.getMonth())
  const [selectedDate, setSelectedDate] = useState(toDateStr(nowD))

  // PC 감지
  useEffect(() => {
    const check = () => setIsPC(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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
    const names = (data || []).map((m: any) => m.profiles?.nm).filter(Boolean)
    // localStorage에 저장된 순서 적용
    const savedOrder: string[] = JSON.parse(localStorage.getItem(`staff_order_${sid}`) || '[]')
    if (savedOrder.length > 0) {
      const ordered = [
        ...savedOrder.filter((n: string) => names.includes(n)),
        ...names.filter((n: string) => !savedOrder.includes(n)).sort()
      ]
      setStaffList(ordered)
    } else {
      setStaffList(names.sort())
    }
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
    fontSize:13, fontWeight: active ? 700 : 400,
    background: active ? '#fff' : 'transparent',
    color: active ? '#1a1a2e' : '#aaa',
    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
  })

  const sharedProps = {
    year: calYear, month: calMonth, schedules, staffList,
    role, storeId, myName, pendingCount,
    onSaved: () => { loadData(storeId, calYear, calMonth); if(role==='owner') loadPendingCount(storeId) },
    onChangeMonth: handleChangeMonth,
  }

  const PC_NAV_TABS = [
    { href: '/dash',      ic: '📊', l: '대시' },
    { href: '/schedule',  ic: '📅', l: '스케줄' },
    { href: '/closing',   ic: '📝', l: '마감' },
    { href: '/notice',    ic: '📢', l: '공지' },
    { href: '/inventory', ic: '📦', l: '재고' },
    { href: '/recipe',    ic: '🍳', l: '레시피' },
    { href: '/staff',     ic: '👥', l: '직원관리' },
    { href: '/goal',      ic: '🎯', l: '목표매출' },
    { href: '/mypage',    ic: '📋', l: '마이페이지' },
    { href: '/export',    ic: '📥', l: '내보내기' },
  ]

  // PC 풀스크린 모드
  if (isPC) return (
    <div style={{ position:'fixed', inset:0, background:'#F4F6F9', zIndex:200, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* PC 전용 헤더 */}
      <header style={{ background:'#fff', borderBottom:'1px solid #E8ECF0', boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
        display:'flex', alignItems:'center', padding:'0 24px', height:54, flexShrink:0, gap:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#FF6B35,#E84393)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:'#fff' }}>M</div>
          <div>
            <div style={{ fontSize:14, fontWeight:700, color:'#1a1a2e', lineHeight:1 }}>매장노트</div>
            <div style={{ fontSize:10, color:'#FF6B35', fontWeight:600, marginTop:1 }}>{JSON.parse(typeof window !== 'undefined' ? localStorage.getItem('mj_store') || '{}' : '{}').name || ''}</div>
          </div>
        </div>
        <nav style={{ display:'flex', gap:2, flex:1, justifyContent:'center' }}>
          {PC_NAV_TABS.map(t => {
            const active = t.href === '/schedule'
            return (
              <a key={t.href} href={t.href} style={{ textDecoration:'none' }}>
                <div style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 11px', borderRadius:8, cursor:'pointer',
                  background: active ? 'rgba(255,107,53,0.08)' : 'transparent',
                  borderBottom: active ? '2px solid #FF6B35' : '2px solid transparent' }}>
                  <span style={{ fontSize:13 }}>{t.ic}</span>
                  <span style={{ fontSize:12, fontWeight: active?700:500, color: active?'#FF6B35':'#888', whiteSpace:'nowrap' }}>{t.l}</span>
                </div>
              </a>
            )
          })}
        </nav>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <span style={{ fontSize:10, padding:'3px 10px', borderRadius:10,
            background:role==='owner'?'rgba(108,92,231,0.1)':role==='manager'?'rgba(255,107,53,0.1)':'rgba(0,184,148,0.1)',
            color:role==='owner'?'#6C5CE7':role==='manager'?'#FF6B35':'#00B894', fontWeight:700 }}>
            {role==='owner'?'대표':role==='manager'?'관리자':'직원'}
          </span>
          <button onClick={() => { localStorage.clear(); window.location.href='/login' }}
            style={{ background:'none', border:'1px solid #E8ECF0', color:'#999', padding:'5px 12px', borderRadius:8, cursor:'pointer', fontSize:12 }}>
            로그아웃
          </button>
        </div>
      </header>

      {/* PC 탭 */}
      <div style={{ background:'#fff', borderBottom:'1px solid #E8ECF0', padding:'0 24px', display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
        <button style={{ ...tabBtn(viewTab==='grid'), flex:'none', padding:'10px 20px' }} onClick={() => setViewTab('grid')}>📊 그리드 편집</button>
        <button style={{ ...tabBtn(viewTab==='month'), flex:'none', padding:'10px 20px' }} onClick={() => setViewTab('month')}>📅 월간 보기</button>
      </div>

      {/* 컨텐츠 */}
      <div style={{ flex:1, overflow:'auto', padding:'20px 24px' }}>
        {viewTab==='grid' && <PCGridEditor {...sharedProps} />}
        {viewTab==='month' && (
          <MonthlyView year={calYear} month={calMonth} schedules={schedules}
            onChangeMonth={handleChangeMonth} selectedDate={selectedDate} onDayClick={setSelectedDate} />
        )}
      </div>
    </div>
  )

  // 모바일 기존 그대로
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <span style={{ fontSize:17, fontWeight:700, color:'#1a1a2e' }}>📅 스케줄</span>
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

      {viewTab==='grid' && <MobileGridEditor {...sharedProps} />}
      {viewTab==='month' && (
        <MonthlyView year={calYear} month={calMonth} schedules={schedules}
          onChangeMonth={handleChangeMonth} selectedDate={selectedDate} onDayClick={setSelectedDate} />
      )}
    </div>
  )
}