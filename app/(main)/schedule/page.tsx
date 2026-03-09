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

const STATUS_LABEL: Record<string, string> = { work: '근무', off: '휴일', half: '반차', absent: '결근', early: '조퇴' }
const STATUS_COLOR: Record<string, string> = { work: '#6C5CE7', off: '#E84393', half: '#FF6B35', absent: '#E67E22', early: '#00B894' }
const STATUS_BG: Record<string, string> = { work: 'rgba(108,92,231,0.15)', off: 'rgba(232,67,147,0.13)', half: 'rgba(255,107,53,0.13)', absent: 'rgba(230,126,34,0.13)', early: 'rgba(0,184,148,0.13)' }
const POS_COLOR: Record<string, string> = { K: '#FF6B35', H: '#2DC6D6', KH: '#6C5CE7' }
const DOW_LABEL = ['일','월','화','수','목','금','토']

function getHolidays(year: number): Record<string, string> {
  const h: Record<string, string> = {
    [`${year}-01-01`]: '신정', [`${year}-03-01`]: '삼일절', [`${year}-05-05`]: '어린이날',
    [`${year}-06-06`]: '현충일', [`${year}-08-15`]: '광복절', [`${year}-10-03`]: '개천절',
    [`${year}-10-09`]: '한글날', [`${year}-12-25`]: '크리스마스',
  }
  if (year === 2025) Object.assign(h, {
    '2025-01-28': '설날연휴', '2025-01-29': '설날', '2025-01-30': '설날연휴',
    '2025-05-05': '어린이날/부처님오신날',
    '2025-10-03': '추석연휴', '2025-10-05': '추석', '2025-10-06': '추석연휴', '2025-10-07': '대체공휴일',
  })
  if (year === 2026) Object.assign(h, {
    '2026-02-16': '설날연휴', '2026-02-17': '설날', '2026-02-18': '설날연휴', '2026-02-19': '대체공휴일',
    '2026-03-02': '대체공휴일', '2026-05-24': '부처님오신날',
    '2026-09-24': '추석연휴', '2026-09-25': '추석', '2026-09-26': '추석연휴', '2026-09-27': '대체공휴일',
    '2026-10-04': '대체공휴일',
  })
  return h
}

async function syncAttendance(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  storeId: string, staffName: string, scheduleDate: string,
  scheduleStatus: string, earlyTime?: string
) {
  const { data: members } = await supabase
    .from('store_members').select('profile_id, profiles!inner(nm)').eq('store_id', storeId).eq('active', true)
  const member = (members || []).find((m: any) => m.profiles?.nm === staffName)
  if (!member) return
  const pid = member.profile_id
  if (scheduleStatus === 'absent') {
    await supabase.from('attendance').upsert({
      profile_id: pid, store_id: storeId, work_date: scheduleDate, status: 'absent', clock_in: null, clock_out: null
    }, { onConflict: 'profile_id,store_id,work_date' })
  } else if (scheduleStatus === 'early' && earlyTime) {
    const { data: existing } = await supabase.from('attendance')
      .select('id').eq('profile_id', pid).eq('store_id', storeId).eq('work_date', scheduleDate).maybeSingle()
    if (existing?.id) await supabase.from('attendance').update({ clock_out: `${scheduleDate}T${earlyTime}:00+09:00`, status: 'early' }).eq('id', existing.id)
  } else if (['work', 'half', 'off'].includes(scheduleStatus)) {
    const { data: existing } = await supabase.from('attendance')
      .select('id, status').eq('profile_id', pid).eq('store_id', storeId).eq('work_date', scheduleDate).maybeSingle()
    if (existing?.status === 'absent') await supabase.from('attendance').delete().eq('id', existing.id)
  }
}


// ── 수정이력 기록 헬퍼 ──────────────────────────────────────
async function logScheduleEdit(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  storeId: string,
  editorName: string,
  staffName: string,
  scheduleDate: string,
  action: string,        // 'upsert' | 'delete' | 'bulk_upsert' | 'bulk_delete'
  oldStatus: string | null,
  newStatus: string | null
) {
  try {
    await supabase.from('schedule_edit_logs').insert({
      store_id: storeId,
      editor_name: editorName,
      staff_name: staffName,
      schedule_date: scheduleDate,
      action,
      old_status: oldStatus,
      new_status: newStatus,
    })
  } catch (e) {
    console.warn('log failed', e)
  }
}

// ─── BulkPopup (NEW) ─────────────────────────────────────────
function BulkPopup({ staffName, dates, onApply, onClose }: {
  staffName: string; dates: string[]; onApply: (s: string) => void | Promise<void>; onClose: () => void
}) {
  const sorted = [...dates].sort()
  const fmt = (d: string) => d.split('-').slice(1).map(Number).join('/')
  const label = dates.length === 1 ? fmt(sorted[0]) : `${fmt(sorted[0])} ~ ${fmt(sorted[sorted.length-1])}`
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, padding:22, width:'100%', maxWidth:320, boxShadow:'0 8px 40px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>{staffName}</div>
          <div style={{ fontSize:12, color:'#888', marginTop:6, padding:'6px 12px', background:'rgba(108,92,231,0.07)', borderRadius:9, display:'inline-block' }}>
            📅 {label} · <strong style={{ color:'#6C5CE7' }}>{dates.length}일</strong> 일괄 적용
          </div>
        </div>
        <div style={{ fontSize:11, color:'#aaa', marginBottom:10 }}>적용할 상태를 선택하세요</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:8 }}>
          {(['work','off','half'] as const).map(s => (
            <button key={s} onClick={() => onApply(s)}
              style={{ padding:'14px 0', borderRadius:12, border:`1.5px solid ${STATUS_COLOR[s]}`, background:STATUS_BG[s], color:STATUS_COLOR[s], fontSize:13, fontWeight:700, cursor:'pointer' }}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:8 }}>
          {(['absent','early'] as const).map(s => (
            <button key={s} onClick={() => onApply(s)}
              style={{ padding:'14px 0', borderRadius:12, border:`1.5px solid ${STATUS_COLOR[s]}`, background:STATUS_BG[s], color:STATUS_COLOR[s], fontSize:13, fontWeight:700, cursor:'pointer' }}>
              {STATUS_LABEL[s]}
            </button>
          ))}
          <button onClick={onClose}
            style={{ padding:'14px 0', borderRadius:12, border:'1px solid #E8ECF0', background:'#F4F6F9', color:'#999', fontSize:13, cursor:'pointer' }}>
            취소
          </button>
        </div>
        <button onClick={() => onApply('__delete__')}
          style={{ width:'100%', padding:'12px 0', borderRadius:12, border:'1.5px solid rgba(232,67,147,0.4)', background:'rgba(232,67,147,0.07)', color:'#E84393', fontSize:13, fontWeight:700, cursor:'pointer' }}>
          🗑 선택 {dates.length}일 전체 삭제
        </button>
      </div>
    </div>
  )
}

// ─── CellPopup ───────────────────────────────────────────────
function CellPopup({ staffName, dateStr, current, role, myName, onSave, onRequest, onDelete, onClose }: {
  staffName: string; dateStr: string; current: any | null
  role: string; myName: string
  onSave: (status: string, position: string, note: string) => void
  onRequest: (status: string, note: string) => void
  onDelete: () => void; onClose: () => void
}) {
  const [status, setStatus] = useState(current?.status || 'work')
  const [position, setPosition] = useState(current?.position || '')
  const [earlyTime, setEarlyTime] = useState(() => {
    if (current?.status === 'early' && current?.note) {
      const m = current.note.match(/^\[조퇴:(\d{2}:\d{2})\](.*)$/)
      if (m) return m[1]
    }
    return ''
  })
  const [noteText, setNoteText] = useState(() => {
    if (current?.status === 'early' && current?.note) {
      const m = current.note.match(/^\[조퇴:(\d{2}:\d{2})\](.*)$/)
      if (m) return m[2].trim()
    }
    return current?.note || ''
  })
  const [requestNote, setRequestNote] = useState('')
  const [mode, setMode] = useState<'edit'|'absent_early'|'request'>('edit')
  const parts = dateStr.split('-')
  const dow = DOW_LABEL[new Date(dateStr).getDay()]
  const isOwner = role === 'owner'
  const isManager = role === 'manager'

  function buildNote() {
    if (status === 'early') return earlyTime ? `[조퇴:${earlyTime}]${noteText ? ' ' + noteText : ''}` : noteText
    return noteText
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, padding:20, width:'100%', maxWidth:340, boxShadow:'0 8px 32px rgba(0,0,0,0.18)', maxHeight:'90vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>{staffName}</div>
          <div style={{ fontSize:12, color:'#aaa', marginTop:2 }}>{parts[1]}월 {parts[2]}일 ({dow})</div>
        </div>
        {isManager && (
          <div style={{ display:'flex', background:'#F4F6F9', borderRadius:10, padding:3, marginBottom:14, gap:2 }}>
            <button onClick={() => setMode('edit')} style={{ flex:1, padding:'6px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:11, fontWeight:mode==='edit'?700:400, background:mode==='edit'?'#fff':'transparent', color:mode==='edit'?'#1a1a2e':'#aaa', boxShadow:mode==='edit'?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>포지션</button>
            <button onClick={() => { setMode('absent_early'); setStatus('absent') }} style={{ flex:1, padding:'6px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:11, fontWeight:mode==='absent_early'?700:400, background:mode==='absent_early'?'#fff':'transparent', color:mode==='absent_early'?'#d63031':'#aaa', boxShadow:mode==='absent_early'?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>결근·조퇴</button>
            <button onClick={() => setMode('request')} style={{ flex:1, padding:'6px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:11, fontWeight:mode==='request'?700:400, background:mode==='request'?'#fff':'transparent', color:mode==='request'?'#E84393':'#aaa', boxShadow:mode==='request'?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>휴일요청</button>
          </div>
        )}
        {(isOwner || (isManager && mode === 'edit')) && (
          <>
            {isOwner && (
              <>
                <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>상태</div>
                <div style={{ display:'flex', gap:5, marginBottom:8, flexWrap:'wrap' }}>
                  {(['work','off','half'] as const).map(s => (
                    <button key={s} onClick={() => setStatus(s)} style={{ flex:1, minWidth:60, padding:'9px 0', borderRadius:10, border: status===s ? `1.5px solid ${STATUS_COLOR[s]}` : '1px solid #E8ECF0', background: status===s ? STATUS_BG[s] : '#F4F6F9', color: status===s ? STATUS_COLOR[s] : '#aaa', fontSize:12, fontWeight:status===s?700:400, cursor:'pointer' }}>{STATUS_LABEL[s]}</button>
                  ))}
                </div>
                <div style={{ display:'flex', gap:5, marginBottom:14 }}>
                  {(['absent','early'] as const).map(s => (
                    <button key={s} onClick={() => setStatus(s)} style={{ flex:1, padding:'9px 0', borderRadius:10, border: status===s ? `1.5px solid ${STATUS_COLOR[s]}` : '1px solid #E8ECF0', background: status===s ? STATUS_BG[s] : '#F4F6F9', color: status===s ? STATUS_COLOR[s] : '#aaa', fontSize:12, fontWeight:status===s?700:400, cursor:'pointer' }}>{STATUS_LABEL[s]}</button>
                  ))}
                </div>
                {status === 'early' && (
                  <div style={{ marginBottom:14, padding:'10px 12px', background:'rgba(0,184,148,0.06)', borderRadius:10, border:'1px solid rgba(0,184,148,0.2)' }}>
                    <div style={{ fontSize:11, color:'#00B894', fontWeight:600, marginBottom:8 }}>🌙 조퇴 시간</div>
                    <input type="time" value={earlyTime} onChange={e => setEarlyTime(e.target.value)} style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid rgba(0,184,148,0.3)', background:'#fff', fontSize:14, color:'#1a1a2e', outline:'none', boxSizing:'border-box' as const }} />
                  </div>
                )}
                {status === 'absent' && (
                  <div style={{ marginBottom:14, padding:'10px 12px', background:'rgba(230,126,34,0.06)', borderRadius:10, border:'1px solid rgba(230,126,34,0.2)' }}>
                    <div style={{ fontSize:11, color:'#E67E22', fontWeight:600 }}>❌ 결근 처리 → 출퇴근에도 자동 반영됩니다</div>
                  </div>
                )}
              </>
            )}
            <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>포지션</div>
            <div style={{ display:'flex', gap:6, marginBottom:14 }}>
              {(['','K','H','KH']).map(p => (
                <button key={p} onClick={() => setPosition(p)} style={{ flex:1, padding:'7px 0', borderRadius:9, border: position===p ? `1.5px solid ${POS_COLOR[p]||'#999'}` : '1px solid #E8ECF0', background: position===p ? `${POS_COLOR[p]||'#888'}18` : '#F4F6F9', color: position===p ? (POS_COLOR[p]||'#555') : '#aaa', fontSize:12, fontWeight:position===p?700:400, cursor:'pointer' }}>{p||'없음'}</button>
              ))}
            </div>
            <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>메모</div>
            <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="병원, 생일, 야채샐러드..." style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'#F8F9FB', border:'1px solid #E0E4E8', fontSize:13, outline:'none', boxSizing:'border-box' as const, marginBottom:16 }} />
            <div style={{ display:'flex', gap:8 }}>
              {current && isOwner && <button onClick={onDelete} style={{ padding:'10px 14px', borderRadius:10, background:'rgba(232,67,147,0.08)', border:'1px solid rgba(232,67,147,0.25)', color:'#E84393', fontSize:12, cursor:'pointer', fontWeight:600 }}>삭제</button>}
              <button onClick={() => onSave(isOwner ? status : (current?.status || 'work'), position, buildNote())} style={{ flex:1, padding:'10px 0', borderRadius:10, background:'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>저장</button>
            </div>
          </>
        )}
        {isManager && mode === 'absent_early' && (
          <>
            <div style={{ background:'rgba(230,126,34,0.06)', borderRadius:12, padding:12, marginBottom:14, border:'1px solid rgba(230,126,34,0.15)' }}>
              <div style={{ fontSize:11, color:'#E67E22', fontWeight:600, marginBottom:4 }}>⚠️ 결근·조퇴 직접 저장</div>
              <div style={{ fontSize:11, color:'#888' }}>대표 승인 없이 바로 반영됩니다</div>
            </div>
            <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>상태</div>
            <div style={{ display:'flex', gap:6, marginBottom:14 }}>
              {(['absent','early'] as const).map(s => (
                <button key={s} onClick={() => setStatus(s)} style={{ flex:1, padding:'9px 0', borderRadius:10, border: status===s ? `1.5px solid ${STATUS_COLOR[s]}` : '1px solid #E8ECF0', background: status===s ? STATUS_BG[s] : '#F4F6F9', color: status===s ? STATUS_COLOR[s] : '#aaa', fontSize:12, fontWeight:status===s?700:400, cursor:'pointer' }}>{STATUS_LABEL[s]}</button>
              ))}
            </div>
            {status === 'early' && (
              <div style={{ marginBottom:14, padding:'10px 12px', background:'rgba(0,184,148,0.06)', borderRadius:10, border:'1px solid rgba(0,184,148,0.2)' }}>
                <div style={{ fontSize:11, color:'#00B894', fontWeight:600, marginBottom:8 }}>🌙 조퇴 시간</div>
                <input type="time" value={earlyTime} onChange={e => setEarlyTime(e.target.value)} style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid rgba(0,184,148,0.3)', background:'#fff', fontSize:14, color:'#1a1a2e', outline:'none', boxSizing:'border-box' as const }} />
              </div>
            )}
            {status === 'absent' && (
              <div style={{ marginBottom:14, padding:'10px 12px', background:'rgba(230,126,34,0.06)', borderRadius:10, border:'1px solid rgba(230,126,34,0.2)' }}>
                <div style={{ fontSize:11, color:'#E67E22', fontWeight:600 }}>❌ 결근 처리 → 출퇴근에도 자동 반영됩니다</div>
              </div>
            )}
            <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>메모</div>
            <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="사유 입력..." style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'#F8F9FB', border:'1px solid #E0E4E8', fontSize:13, outline:'none', boxSizing:'border-box' as const, marginBottom:16 }} />
            <button onClick={() => onSave(status, current?.position || '', buildNote())} style={{ width:'100%', padding:'10px 0', borderRadius:10, background:'linear-gradient(135deg,#E67E22,#e17055)', border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>저장</button>
          </>
        )}
        {isManager && mode === 'request' && (
          <>
            <div style={{ background:'rgba(232,67,147,0.06)', borderRadius:12, padding:12, marginBottom:14, border:'1px solid rgba(232,67,147,0.15)' }}>
              <div style={{ fontSize:11, color:'#E84393', fontWeight:600, marginBottom:4 }}>📋 휴일 변경 요청</div>
              <div style={{ fontSize:11, color:'#888' }}>대표 승인 후 반영됩니다</div>
            </div>
            <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>요청 상태</div>
            <div style={{ display:'flex', gap:5, marginBottom:8, flexWrap:'wrap' }}>
              {(['work','off','half'] as const).map(s => (
                <button key={s} onClick={() => setStatus(s)} style={{ flex:1, padding:'9px 0', borderRadius:10, border: status===s ? `1.5px solid ${STATUS_COLOR[s]}` : '1px solid #E8ECF0', background: status===s ? STATUS_BG[s] : '#F4F6F9', color: status===s ? STATUS_COLOR[s] : '#aaa', fontSize:12, fontWeight:status===s?700:400, cursor:'pointer' }}>{STATUS_LABEL[s]}</button>
              ))}
            </div>
            <div style={{ display:'flex', gap:5, marginBottom:14 }}>
              {(['absent','early'] as const).map(s => (
                <button key={s} onClick={() => setStatus(s)} style={{ flex:1, padding:'9px 0', borderRadius:10, border: status===s ? `1.5px solid ${STATUS_COLOR[s]}` : '1px solid #E8ECF0', background: status===s ? STATUS_BG[s] : '#F4F6F9', color: status===s ? STATUS_COLOR[s] : '#aaa', fontSize:12, fontWeight:status===s?700:400, cursor:'pointer' }}>{STATUS_LABEL[s]}</button>
              ))}
            </div>
            <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>요청 사유</div>
            <input value={requestNote} onChange={e => setRequestNote(e.target.value)} placeholder="변경 사유를 입력해주세요" style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'#F8F9FB', border:'1px solid #E0E4E8', fontSize:13, outline:'none', boxSizing:'border-box' as const, marginBottom:16 }} />
            <button onClick={() => onRequest(status, requestNote)} style={{ width:'100%', padding:'10px 0', borderRadius:10, background:'linear-gradient(135deg,#E84393,#FF6B35)', border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>변경 요청 보내기</button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── RequestPanel ─────────────────────────────────────────────
function RequestPanel({ storeId, myName, onClose, onApproved }: {
  storeId: string; myName: string; onClose: () => void; onApproved: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [requests, setRequests] = useState<any[]>([])
  useEffect(() => { loadRequests() }, [])
  async function loadRequests() {
    const { data } = await supabase.from('schedule_requests').select('*').eq('store_id', storeId).eq('status', 'pending').order('created_at', { ascending: false })
    setRequests(data || [])
  }
  async function handleApprove(req: any) {
    await supabase.from('schedules').upsert(
      { store_id: storeId, staff_name: req.staff_name, schedule_date: req.schedule_date, status: req.requested_status, position: null, note: req.note },
      { onConflict: 'store_id,staff_name,schedule_date' }
    )
    const earlyMatch = req.note?.match(/^\[조퇴:(\d{2}:\d{2})\]/)
    await syncAttendance(supabase, storeId, req.staff_name, req.schedule_date, req.requested_status, earlyMatch?.[1])
    await supabase.from('schedule_requests').update({ status: 'approved', reviewed_by: myName, reviewed_at: new Date().toISOString() }).eq('id', req.id)
    loadRequests(); onApproved()
  }
  async function handleReject(req: any) {
    await supabase.from('schedule_requests').update({ status: 'rejected', reviewed_by: myName, reviewed_at: new Date().toISOString() }).eq('id', req.id)
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
          <div style={{ textAlign:'center', padding:32, color:'#bbb' }}><div style={{ fontSize:20, marginBottom:8 }}>✅</div><div style={{ fontSize:13 }}>대기 중인 요청이 없습니다</div></div>
        ) : requests.map(req => (
          <div key={req.id} style={{ background:'#fff', borderRadius:14, border:'1px solid rgba(232,67,147,0.2)', padding:14, marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div><span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{req.staff_name}</span><span style={{ fontSize:11, color:'#aaa', marginLeft:8 }}>{req.schedule_date}</span></div>
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
// ManageView - 전지점 관리 탭
// ════════════════════════════════════════
function ManageView({ profileId, myName, year: initYear, month: initMonth }: {
  profileId: string; myName: string; year: number; month: number
}) {
  const supabase = createSupabaseBrowserClient()
  const [year, setYear] = useState(initYear)
  const [month, setMonth] = useState(initMonth)
  const [storeItems, setStoreItems] = useState<any[]>([])
  const [storeData, setStoreData] = useState<Record<string, { schedules: any[]; requests: any[]; staff: string[] }>>({})
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  // 섹션 탭
  const [section, setSection] = useState<'today'|'grid'|'summary'|'requests'|'logs'>('today')
  const [logs, setLogs] = useState<any[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [editPopup, setEditPopup] = useState<{ sid: string; staff: string; date: string; current: any|null } | null>(null)
  // 드래그 일괄편집
  const [manageDragSel, setManageDragSel] = useState<{ sid: string; staff: string; startDay: number; endDay: number } | null>(null)
  const manageDragRef = useRef<typeof manageDragSel>(null)
  const manageMouseDown = useRef(false)
  const [manageBulkTarget, setManageBulkTarget] = useState<{ sid: string; staff: string; dates: string[] } | null>(null)
  // 월간 그리드: 펼친 지점
  const [gridExpanded, setGridExpanded] = useState<Record<string, boolean>>({})

  const today = toDateStr(new Date())
  const tomorrow = toDateStr(new Date(Date.now() + 86400000))

  useEffect(() => { loadAll() }, [year, month])
  useEffect(() => { setYear(initYear); setMonth(initMonth) }, [initYear, initMonth])

  useEffect(() => {
    const onMouseUp = () => {
      if (manageMouseDown.current && manageDragRef.current) {
        const drag = manageDragRef.current
        const daysInMonth = getDaysInMonth(drag.sid ? parseInt(drag.sid) : year, month)
        const s = Math.min(drag.startDay, drag.endDay)
        const e = Math.max(drag.startDay, drag.endDay)
        const dates: string[] = []
        for (let d = s; d <= e; d++) {
          dates.push(`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
        }
        if (dates.length > 1) {
          setManageBulkTarget({ sid: drag.sid, staff: drag.staff, dates })
          setManageDragSel(null)
        } else {
          // 단일 셀 → editPopup
          const dateStr = dates[0]
          // find current
          const d2 = storeData[drag.sid]
          const sc = d2 ? d2.schedules.find((sc: any) => sc.staff_name === drag.staff && sc.schedule_date === dateStr) : null
          setEditPopup({ sid: drag.sid, staff: drag.staff, date: dateStr, current: sc || null })
          setManageDragSel(null)
        }
      }
      manageMouseDown.current = false
      manageDragRef.current = null
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [storeData, year, month])

  async function loadAll() {
    setLoading(true)
    const { data: members } = await supabase
      .from('store_members').select('*, stores(*)').eq('profile_id', profileId).eq('active', true)
    const myStores = (members || [])
    setStoreItems(myStores)

    const pad = (n: number) => String(n).padStart(2, '0')
    const startDate = `${year}-${pad(month+1)}-01`
    const endDate = `${year}-${pad(month+1)}-${pad(getDaysInMonth(year, month))}`

    const newData: typeof storeData = {}
    await Promise.all(myStores.map(async (member: any) => {
      const sid = member.stores?.id
      if (!sid) return
      const [schedsRes, reqsRes, staffRes] = await Promise.all([
        supabase.from('schedules').select('*').eq('store_id', sid).gte('schedule_date', startDate).lte('schedule_date', endDate),
        supabase.from('schedule_requests').select('*').eq('store_id', sid).eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('store_members').select('profile_id, sort_order, profiles(nm)').eq('store_id', sid).eq('active', true),
      ])
      const staffNames = (staffRes.data || [])
        .map((m: any) => ({ nm: m.profiles?.nm || '', order: m.sort_order ?? 9999 }))
        .filter((m: any) => m.nm)
        .sort((a: any, b: any) => a.order - b.order)
        .map((m: any) => m.nm)
      newData[sid] = { schedules: schedsRes.data || [], requests: reqsRes.data || [], staff: staffNames }
    }))

    setStoreData(newData)
    setLoading(false)
    // 기본 전부 펼침
    const expanded: Record<string, boolean> = {}
    myStores.forEach((m: any) => { if (m.stores?.id) expanded[m.stores.id] = true })
    setGridExpanded(expanded)
  }

  // 전지점 그리드 드래그 일괄 저장
  async function handleManageBulkApply(status: string) {
    if (!manageBulkTarget) return
    const { sid, staff, dates } = manageBulkTarget
    // 해당 지점 schedMap 구성
    const d = storeData[sid]
    const schedMap: Record<string,any> = {}
    if (d) d.schedules.forEach((s: any) => { schedMap[`${s.staff_name}-${s.schedule_date}`] = s })

    if (status === '__delete__') {
      for (const dateStr of dates) {
        const prev = schedMap[`${staff}-${dateStr}`]
        await supabase.from('schedules').delete()
          .eq('store_id', sid).eq('staff_name', staff).eq('schedule_date', dateStr)
        await syncAttendance(supabase, sid, staff, dateStr, 'work')
        await logScheduleEdit(supabase, sid, myName, staff, dateStr, 'bulk_delete', prev?.status || null, null)
      }
    } else {
      for (const dateStr of dates) {
        const prev = schedMap[`${staff}-${dateStr}`]
        await supabase.from('schedules').upsert(
          { store_id: sid, staff_name: staff, schedule_date: dateStr, status, position: null, note: null },
          { onConflict: 'store_id,staff_name,schedule_date' }
        )
        await syncAttendance(supabase, sid, staff, dateStr, status)
        await logScheduleEdit(supabase, sid, myName, staff, dateStr, 'bulk_upsert', prev?.status || null, status)
      }
    }
    setManageBulkTarget(null)
    loadAll()
  }

  async function loadLogs() {
    setLogsLoading(true)
    // gather all store ids
    const sids = storeItems.map((m: any) => m.stores?.id).filter(Boolean)
    if (sids.length === 0) { setLogsLoading(false); return }
    const { data } = await supabase
      .from('schedule_edit_logs')
      .select('*')
      .in('store_id', sids)
      .order('created_at', { ascending: false })
      .limit(200)
    setLogs(data || [])
    setLogsLoading(false)
  }

  async function handleApprove(sid: string, req: any) {
    setApprovingId(req.id)
    await supabase.from('schedules').upsert(
      { store_id: sid, staff_name: req.staff_name, schedule_date: req.schedule_date, status: req.requested_status, position: null, note: req.note },
      { onConflict: 'store_id,staff_name,schedule_date' }
    )
    const earlyMatch = req.note?.match(/^\[조퇴:(\d{2}:\d{2})\]/)
    await syncAttendance(supabase, sid, req.staff_name, req.schedule_date, req.requested_status, earlyMatch?.[1])
    await supabase.from('schedule_requests').update({ status: 'approved', reviewed_by: myName, reviewed_at: new Date().toISOString() }).eq('id', req.id)
    setApprovingId(null)
    loadAll()
  }

  async function handleReject(sid: string, req: any) {
    await supabase.from('schedule_requests').update({ status: 'rejected', reviewed_by: myName, reviewed_at: new Date().toISOString() }).eq('id', req.id)
    loadAll()
  }

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:60, gap:12 }}>
      <div style={{ fontSize:28 }}>⏳</div>
      <div style={{ fontSize:13, color:'#aaa' }}>전 지점 데이터 불러오는 중...</div>
    </div>
  )

  const totalPending = Object.values(storeData).reduce((s, d) => s + d.requests.length, 0)
  const totalStaff = Object.values(storeData).reduce((s, d) => s + d.staff.length, 0)
  const daysInMonth = getDaysInMonth(year, month)
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`
  const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  // 섹션 탭 버튼 스타일
  const secBtn = (active: boolean) => ({
    flex: 1, padding: '8px 4px', borderRadius: 9, border: 'none', cursor: 'pointer' as const,
    fontSize: 11, fontWeight: active ? 700 : 400,
    background: active ? '#fff' : 'transparent',
    color: active ? '#1a1a2e' : '#aaa',
    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
    whiteSpace: 'nowrap' as const,
  })

  return (
    <div>
      {/* 상단 요약 카드 */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:16 }}>
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E8ECF0', padding:'12px 8px', textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:800, color:'#6C5CE7' }}>{storeItems.length}</div>
          <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>전체 지점</div>
        </div>
        <div style={{ background: totalPending > 0 ? 'rgba(232,67,147,0.05)' : '#fff', borderRadius:14, border:`1.5px solid ${totalPending > 0 ? 'rgba(232,67,147,0.3)' : '#E8ECF0'}`, padding:'12px 8px', textAlign:'center', cursor:'pointer' }}
          onClick={() => setSection('requests')}>
          <div style={{ fontSize:22, fontWeight:800, color: totalPending > 0 ? '#E84393' : '#bbb' }}>{totalPending}</div>
          <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>승인 대기</div>
        </div>
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E8ECF0', padding:'12px 8px', textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:800, color:'#FF6B35' }}>{totalStaff}</div>
          <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>전체 직원</div>
        </div>
      </div>

      {/* 섹션 탭 */}
      <div style={{ display:'flex', background:'#F4F6F9', borderRadius:12, padding:4, marginBottom:16, gap:2 }}>
        <button style={secBtn(section==='today')} onClick={() => setSection('today')}>👥 오늘/내일</button>
        <button style={secBtn(section==='grid')} onClick={() => setSection('grid')}>📊 월간그리드</button>
        <button style={secBtn(section==='summary')} onClick={() => setSection('summary')}>📈 근무요약</button>
        <button style={{ ...secBtn(section==='requests'), position:'relative' }} onClick={() => setSection('requests')}>
          📋 요청
          {totalPending > 0 && <span style={{ position:'absolute', top:2, right:2, background:'#E84393', color:'#fff', borderRadius:6, padding:'0 4px', fontSize:8, fontWeight:700 }}>{totalPending}</span>}
        </button>
        <button style={secBtn(section==='logs')} onClick={() => { setSection('logs'); loadLogs() }}>🕐 이력</button>
      </div>

      {/* ── 섹션 1: 오늘 / 내일 출근자 ── */}
      {section === 'today' && (
        <div>
          {(['오늘', '내일'] as const).map((label, li) => {
            const dateStr = li === 0 ? today : tomorrow
            const dow = DOW_LABEL[new Date(dateStr).getDay()]
            const parts = dateStr.split('-')
            return (
              <div key={label} style={{ marginBottom:20 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                  <span style={{ fontSize:14, fontWeight:700, color:'#1a1a2e' }}>
                    {label === '오늘' ? '🌞' : '🌙'} {label}
                  </span>
                  <span style={{ fontSize:12, color:'#888' }}>{parts[1]}월 {parts[2]}일 ({dow})</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {storeItems.map((member: any) => {
                    const sid = member.stores?.id
                    const storeName = member.stores?.name || ''
                    const d = storeData[sid]
                    if (!d) return null
                    const workers = d.schedules.filter(s => s.schedule_date === dateStr && (s.status === 'work' || s.status === 'half' || s.status === 'early'))
                    const offWorkers = d.schedules.filter(s => s.schedule_date === dateStr && s.status === 'off')
                    const absentWorkers = d.schedules.filter(s => s.schedule_date === dateStr && s.status === 'absent')
                    return (
                      <div key={sid} style={{ background:'#fff', borderRadius:14, border:'1px solid #E8ECF0', padding:'12px 14px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                        {/* 지점명 */}
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                          <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#FF6B35,#E84393)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#fff', flexShrink:0 }}>
                            {storeName.charAt(0)}
                          </div>
                          <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{storeName}</span>
                          <span style={{ marginLeft:'auto', fontSize:11, fontWeight:700, color: workers.length > 0 ? '#6C5CE7' : '#bbb' }}>
                            {workers.length > 0 ? `${workers.length}명 출근` : '스케줄 없음'}
                          </span>
                        </div>
                        {/* 출근자 목록 */}
                        {workers.length > 0 ? (
                          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                            {workers.map((s: any) => (
                              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:20, background:STATUS_BG[s.status], border:`1px solid ${STATUS_COLOR[s.status]}40` }}>
                                <span style={{ fontSize:12, fontWeight:700, color:'#1a1a2e' }}>{s.staff_name}</span>
                                {s.status !== 'work' && (
                                  <span style={{ fontSize:9, color:STATUS_COLOR[s.status], fontWeight:700 }}>{STATUS_LABEL[s.status]}</span>
                                )}
                                {s.position && (
                                  <span style={{ fontSize:9, color:POS_COLOR[s.position], fontWeight:700 }}>{s.position}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize:12, color:'#bbb', padding:'4px 0' }}>등록된 출근자 없음</div>
                        )}
                        {/* 휴일/결근자 */}
                        {(offWorkers.length > 0 || absentWorkers.length > 0) && (
                          <div style={{ display:'flex', gap:6, marginTop:8, paddingTop:8, borderTop:'1px solid #F4F6F9', flexWrap:'wrap' }}>
                            {offWorkers.map((s: any) => (
                              <span key={s.id} style={{ fontSize:10, color:STATUS_COLOR.off, background:STATUS_BG.off, padding:'2px 8px', borderRadius:10 }}>{s.staff_name} 휴일</span>
                            ))}
                            {absentWorkers.map((s: any) => (
                              <span key={s.id} style={{ fontSize:10, color:STATUS_COLOR.absent, background:STATUS_BG.absent, padding:'2px 8px', borderRadius:10, fontWeight:700 }}>{s.staff_name} 결근</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 섹션 2: 전지점 월간 그리드 ── */}
      {section === 'grid' && (
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <span style={{ fontSize:11, color:'#aaa' }}>지점명 눌러서 접기/펼치기</span>
            <YearMonthPicker year={year} month={month} onChange={(y,m) => { setYear(y); setMonth(m) }} color="#6C5CE7" />
          </div>
          {storeItems.map((member: any) => {
            const sid = member.stores?.id
            const storeName = member.stores?.name || ''
            const d = storeData[sid]
            if (!d) return null
            const { schedules: scheds, staff } = d
            const isExpanded = gridExpanded[sid] !== false
            const schedMap: Record<string,any> = {}
            scheds.forEach(s => { schedMap[`${s.staff_name}-${s.schedule_date}`] = s })

            return (
              <div key={sid} style={{ marginBottom:18, background:'#fff', borderRadius:14, border:'1px solid #E8ECF0', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                {/* 지점 헤더 */}
                <div onClick={() => setGridExpanded(prev => ({ ...prev, [sid]: !isExpanded }))}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', cursor:'pointer', background:'#F8F9FB', borderBottom: isExpanded ? '1px solid #E8ECF0' : 'none' }}>
                  <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#FF6B35,#E84393)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'#fff', flexShrink:0 }}>
                    {storeName.charAt(0)}
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', flex:1 }}>{storeName}</span>
                  <span style={{ fontSize:11, color:'#bbb' }}>직원 {staff.length}명</span>
                  <span style={{ fontSize:11, color:'#ccc', marginLeft:4 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
                {/* 그리드 테이블 */}
                {isExpanded && (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ borderCollapse:'collapse', fontSize:10, minWidth: staff.length * 36 + 70, width:'100%', tableLayout:'fixed', userSelect:'none' }}>
                      <colgroup>
                        <col style={{ width:34 }} />
                        {staff.map((_,i) => <col key={i} style={{ width: Math.max(36, Math.floor((500 - 60) / Math.max(staff.length, 1))) }} />)}
                      </colgroup>
                      <thead>
                        <tr style={{ background:'#F8F9FB' }}>
                          <th style={{ padding:'3px 2px', borderBottom:'1px solid #E8ECF0', borderRight:'2px solid #E8ECF0', color:'#aaa', fontWeight:700, fontSize:8, textAlign:'center', position:'sticky', left:0, background:'#F8F9FB', zIndex:2 }}>날</th>
                          {staff.map(name => (
                            <th key={name} style={{ padding:'5px 2px', borderBottom:'1px solid #E8ECF0', borderRight:'1px solid #ECEEF2', color:'#1a1a2e', fontWeight:700, textAlign:'center', fontSize:10 }}>
                              {name.length > 3 ? name.slice(0,3) + '.' : name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allDays.map(day => {
                          const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`
                          const dow = new Date(dateStr).getDay()
                          const isToday = dateStr === today
                          const isSun = dow === 0; const isSat = dow === 6
                          const workCnt = staff.filter(s => { const sc = schedMap[`${s}-${dateStr}`]; return sc && (sc.status==='work'||sc.status==='half'||sc.status==='early') }).length
                          return (
                            <tr key={day} style={{ background: isToday ? 'rgba(108,92,231,0.05)' : isSun ? 'rgba(232,67,147,0.02)' : '#fff', borderTop: dow===1&&day!==1 ? '2px solid #D0D4E8' : undefined }}>
                              <td style={{ padding:'1px 2px', borderBottom:'1px solid #F4F6F9', borderRight:'2px solid #E8ECF0', height:24, position:'sticky', left:0, background: isToday ? 'rgba(108,92,231,0.07)' : isSun ? 'rgba(232,67,147,0.05)' : isSat ? 'rgba(108,92,231,0.03)' : '#FAFBFC', zIndex:1 }}>
                                <div style={{ display:'flex', flexDirection:'row', alignItems:'center', justifyContent:'center', gap:2 }}>
                                  <span style={{ fontSize:9, fontWeight:isToday?700:400, color:isToday?'#6C5CE7':isSun?'#E84393':isSat?'#6C5CE7':'#555', lineHeight:1 }}>{day}</span>
                                  <span style={{ fontSize:7, color:isSun?'#E84393':isSat?'#6C5CE7':'#ccc', lineHeight:1 }}>{DOW_LABEL[dow]}</span>
                                </div>
                              </td>
                              {staff.map(name => {
                                const sc = schedMap[`${name}-${dateStr}`]
                                const inDrag = manageDragSel?.sid === sid && manageDragSel?.staff === name &&
                                  day >= Math.min(manageDragSel.startDay, manageDragSel.endDay) &&
                                  day <= Math.max(manageDragSel.startDay, manageDragSel.endDay)
                                return (
                                  <td key={name}
                                    onMouseDown={() => {
                                      manageMouseDown.current = true
                                      const drag = { sid, staff: name, startDay: day, endDay: day }
                                      manageDragRef.current = drag
                                      setManageDragSel(drag)
                                    }}
                                    onMouseEnter={() => {
                                      if (manageMouseDown.current && manageDragRef.current?.sid === sid && manageDragRef.current?.staff === name) {
                                        const updated = { ...manageDragRef.current, endDay: day }
                                        manageDragRef.current = updated
                                        setManageDragSel({ ...updated })
                                      }
                                    }}
                                    style={{ borderBottom:'1px solid #F4F6F9', borderRight:'1px solid #ECEEF2', height:24, textAlign:'center', verticalAlign:'middle', background: inDrag ? 'rgba(108,92,231,0.22)' : sc ? STATUS_BG[sc.status] : undefined, padding:0, cursor:'crosshair', outline: inDrag ? '2px solid #6C5CE7' : 'none', outlineOffset:'-2px', transition:'background 0.04s' }}>
                                    {sc ? (
                                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0 }}>
                                        <span style={{ fontSize:8, fontWeight:700, color: inDrag ? '#6C5CE7' : STATUS_COLOR[sc.status], lineHeight:1.3 }}>{STATUS_LABEL[sc.status]}</span>
                                        {sc.position && <span style={{ fontSize:7, color:POS_COLOR[sc.position], fontWeight:700 }}>{sc.position}</span>}
                                      </div>
                                    ) : <span style={{ fontSize:12, color: inDrag ? '#6C5CE7' : '#e8e8e8' }}>+</span>}
                                  </td>
                                )
                              })}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── 섹션 3: 근무 요약 ── */}
      {section === 'summary' && (
        <div>
          {storeItems.map((member: any) => {
            const sid = member.stores?.id
            const storeName = member.stores?.name || ''
            const d = storeData[sid]
            if (!d) return null
            const { schedules: scheds, staff } = d
            const summary = staff.map(name => {
              const ss = scheds.filter(s => s.staff_name === name)
              return {
                name,
                work: ss.filter(s => s.status === 'work').length,
                off: ss.filter(s => s.status === 'off').length,
                half: ss.filter(s => s.status === 'half').length,
                absent: ss.filter(s => s.status === 'absent').length,
                early: ss.filter(s => s.status === 'early').length,
              }
            })
            return (
              <div key={sid} style={{ marginBottom:16, background:'#fff', borderRadius:14, border:'1px solid #E8ECF0', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 14px', background:'#F8F9FB', borderBottom:'1px solid #E8ECF0' }}>
                  <div style={{ width:26, height:26, borderRadius:7, background:'linear-gradient(135deg,#FF6B35,#E84393)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'#fff', flexShrink:0 }}>
                    {storeName.charAt(0)}
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{storeName}</span>
                  <span style={{ marginLeft:'auto', fontSize:11, color:'#aaa' }}>{year}년 {month+1}월</span>
                </div>
                {summary.length === 0 ? (
                  <div style={{ padding:'16px', textAlign:'center', color:'#bbb', fontSize:12 }}>직원 없음</div>
                ) : (
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                    <thead>
                      <tr style={{ background:'#FAFBFC' }}>
                        <th style={{ padding:'7px 12px', textAlign:'left', color:'#888', fontWeight:700, borderBottom:'1px solid #F0F2F5', fontSize:10 }}>직원</th>
                        {(['work','off','half','absent','early'] as const).map(s => (
                          <th key={s} style={{ padding:'7px 6px', textAlign:'center', color:STATUS_COLOR[s], fontWeight:700, borderBottom:'1px solid #F0F2F5', fontSize:9 }}>{STATUS_LABEL[s]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {summary.map((s, idx) => (
                        <tr key={s.name} style={{ background: idx % 2 === 0 ? '#fff' : '#FAFBFC', borderBottom:'1px solid #F4F6F9' }}>
                          <td style={{ padding:'8px 12px', fontWeight:600, color:'#1a1a2e' }}>{s.name}</td>
                          <td style={{ padding:'8px 6px', textAlign:'center', fontWeight:700, color: s.work > 0 ? STATUS_COLOR.work : '#ddd' }}>{s.work || '-'}</td>
                          <td style={{ padding:'8px 6px', textAlign:'center', color: s.off > 0 ? STATUS_COLOR.off : '#ddd' }}>{s.off || '-'}</td>
                          <td style={{ padding:'8px 6px', textAlign:'center', color: s.half > 0 ? STATUS_COLOR.half : '#ddd' }}>{s.half || '-'}</td>
                          <td style={{ padding:'8px 6px', textAlign:'center', color: s.absent > 0 ? STATUS_COLOR.absent : '#ddd', fontWeight: s.absent > 0 ? 700 : 400 }}>{s.absent || '-'}</td>
                          <td style={{ padding:'8px 6px', textAlign:'center', color: s.early > 0 ? STATUS_COLOR.early : '#ddd' }}>{s.early || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── 섹션 4: 승인 대기 요청 ── */}
      {section === 'requests' && (
        <div>
          {totalPending === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:'#bbb' }}>
              <div style={{ fontSize:28, marginBottom:8 }}>✅</div>
              <div style={{ fontSize:13 }}>모든 지점 승인 대기 없음</div>
            </div>
          ) : storeItems.map((member: any) => {
            const sid = member.stores?.id
            const storeName = member.stores?.name || ''
            const d = storeData[sid]
            if (!d || d.requests.length === 0) return null
            return (
              <div key={sid} style={{ marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <div style={{ width:24, height:24, borderRadius:6, background:'linear-gradient(135deg,#FF6B35,#E84393)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#fff', flexShrink:0 }}>
                    {storeName.charAt(0)}
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{storeName}</span>
                  <span style={{ background:'rgba(232,67,147,0.1)', color:'#E84393', borderRadius:8, padding:'1px 8px', fontSize:11, fontWeight:700 }}>{d.requests.length}건</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {d.requests.map((req: any) => (
                    <div key={req.id} style={{ background:'#fff', border:'1px solid rgba(232,67,147,0.18)', borderRadius:12, padding:'12px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: req.note ? 6 : 10 }}>
                        <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{req.staff_name}</span>
                        <span style={{ fontSize:11, color:'#bbb' }}>{req.schedule_date}</span>
                        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:5 }}>
                          {req.current_status && <span style={{ fontSize:10, color:STATUS_COLOR[req.current_status], background:STATUS_BG[req.current_status], padding:'2px 7px', borderRadius:5, fontWeight:700 }}>{STATUS_LABEL[req.current_status]}</span>}
                          <span style={{ fontSize:10, color:'#bbb' }}>→</span>
                          <span style={{ fontSize:10, color:STATUS_COLOR[req.requested_status], background:STATUS_BG[req.requested_status], padding:'2px 7px', borderRadius:5, fontWeight:700 }}>{STATUS_LABEL[req.requested_status]}</span>
                        </div>
                      </div>
                      {req.note && <div style={{ fontSize:11, color:'#888', marginBottom:8, padding:'5px 9px', background:'#F8F9FB', borderRadius:7 }}>{req.note}</div>}
                      <div style={{ fontSize:10, color:'#bbb', marginBottom:8 }}>요청자: {req.requester_nm} · {new Date(req.created_at).toLocaleDateString('ko')}</div>
                      <div style={{ display:'flex', gap:8 }}>
                        <button onClick={() => handleReject(sid, req)} style={{ flex:1, padding:'8px 0', borderRadius:9, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#aaa', fontSize:12, cursor:'pointer', fontWeight:600 }}>거절</button>
                        <button onClick={() => handleApprove(sid, req)} disabled={approvingId === req.id}
                          style={{ flex:2, padding:'8px 0', borderRadius:9, background:'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:12, cursor:'pointer', fontWeight:700, opacity: approvingId === req.id ? 0.7 : 1 }}>
                          {approvingId === req.id ? '처리 중...' : '✓ 승인'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 섹션 5: 수정이력 ── */}
      {section === 'logs' && (
        <div>
          {logsLoading ? (
            <div style={{ textAlign:'center', padding:40, color:'#aaa', fontSize:13 }}>⏳ 불러오는 중...</div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign:'center', padding:40, color:'#bbb' }}>
              <div style={{ fontSize:24, marginBottom:8 }}>📋</div>
              <div style={{ fontSize:13 }}>수정 이력이 없습니다</div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize:11, color:'#aaa', marginBottom:12 }}>최근 200건 · 전 지점</div>
              {logs.map((log: any) => {
                const storeName = storeItems.find((m: any) => m.stores?.id === log.store_id)?.stores?.name || ''
                const dt = new Date(log.created_at)
                const dateLabel = `${dt.getMonth()+1}/${dt.getDate()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`
                const actionLabel: Record<string,string> = { upsert:'개별변경', delete:'개별삭제', bulk_upsert:'일괄변경', bulk_delete:'일괄삭제' }
                const isBulk = log.action.startsWith('bulk')
                const isDel = log.action.includes('delete')
                return (
                  <div key={log.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#fff', borderRadius:12, border:'1px solid #F0F2F5', marginBottom:6 }}>
                    <div style={{ width:34, height:34, borderRadius:10, background: isDel ? 'rgba(232,67,147,0.1)' : 'rgba(108,92,231,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                      {isDel ? '🗑' : '✏️'}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                        <span style={{ fontSize:12, fontWeight:700, color:'#1a1a2e' }}>{log.editor_name}</span>
                        <span style={{ fontSize:10, color:'#aaa' }}>→</span>
                        <span style={{ fontSize:12, color:'#555', fontWeight:600 }}>{log.staff_name}</span>
                        <span style={{ fontSize:10, color:'#bbb' }}>{log.schedule_date}</span>
                        {isBulk && <span style={{ fontSize:9, background:'rgba(108,92,231,0.1)', color:'#6C5CE7', borderRadius:5, padding:'1px 5px', fontWeight:700 }}>일괄</span>}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:3 }}>
                        {log.old_status && <span style={{ fontSize:10, color:STATUS_COLOR[log.old_status], background:STATUS_BG[log.old_status], padding:'1px 6px', borderRadius:5, fontWeight:700 }}>{STATUS_LABEL[log.old_status]}</span>}
                        {log.old_status && log.new_status && <span style={{ fontSize:10, color:'#ccc' }}>→</span>}
                        {log.new_status && <span style={{ fontSize:10, color:STATUS_COLOR[log.new_status], background:STATUS_BG[log.new_status], padding:'1px 6px', borderRadius:5, fontWeight:700 }}>{STATUS_LABEL[log.new_status]}</span>}
                        {isDel && !log.old_status && <span style={{ fontSize:10, color:'#E84393' }}>삭제됨</span>}
                        <span style={{ marginLeft:'auto', fontSize:9, color:'#bbb', flexShrink:0 }}>{storeName}</span>
                      </div>
                    </div>
                    <div style={{ fontSize:10, color:'#bbb', flexShrink:0 }}>{dateLabel}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 관리탭 드래그 일괄편집 팝업 */}
      {manageBulkTarget && (
        <BulkPopup
          staffName={manageBulkTarget.staff}
          dates={manageBulkTarget.dates}
          onApply={handleManageBulkApply}
          onClose={() => setManageBulkTarget(null)}
        />
      )}

      {/* 관리탭 그리드 편집 팝업 */}
      {editPopup && (
        <CellPopup
          staffName={editPopup.staff}
          dateStr={editPopup.date}
          current={editPopup.current}
          role="owner"
          myName={myName}
          onSave={async (status, position, note) => {
            await supabase.from('schedules').upsert(
              { store_id: editPopup.sid, staff_name: editPopup.staff, schedule_date: editPopup.date, status, position: position||null, note: note||null },
              { onConflict: 'store_id,staff_name,schedule_date' }
            )
            const earlyMatch = note?.match(/^\[조퇴:(\d{2}:\d{2})\]/)
            await syncAttendance(supabase, editPopup.sid, editPopup.staff, editPopup.date, status, earlyMatch?.[1])
            await logScheduleEdit(supabase, editPopup.sid, myName, editPopup.staff, editPopup.date, 'upsert', editPopup.current?.status||null, status)
            setEditPopup(null); loadAll()
          }}
          onRequest={async () => {}}
          onDelete={async () => {
            if (!editPopup.current) return
            await supabase.from('schedules').delete().eq('id', editPopup.current.id)
            await syncAttendance(supabase, editPopup.sid, editPopup.staff, editPopup.date, 'work')
            await logScheduleEdit(supabase, editPopup.sid, myName, editPopup.staff, editPopup.date, 'delete', editPopup.current?.status||null, null)
            setEditPopup(null); loadAll()
          }}
          onClose={() => setEditPopup(null)}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════
// PC 그리드 (drag + copy-paste 추가)
// ════════════════════════════════════════
function PCGridEditor({ year, month, schedules, staffList, role, storeId, myName, onSaved, onReorderStaff, onChangeMonth, pendingCount }: {
  year: number; month: number; schedules: any[]
  staffList: string[]; role: string; storeId: string; myName: string
  onSaved: () => void; onReorderStaff: (newOrder: string[]) => void
  onChangeMonth: (y: number, m: number) => void
  pendingCount: number
}) {
  const supabase = createSupabaseBrowserClient()
  const [popup, setPopup] = useState<{ staff: string; date: string } | null>(null)
  const [showRequests, setShowRequests] = useState(false)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [dragOrder, setDragOrder] = useState<string[]>([])
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  // ── 드래그 셀 선택 (NEW) ──
  const [dragSel, setDragSel] = useState<{ staff: string; startDay: number; endDay: number } | null>(null)
  const dragSelRef = useRef<typeof dragSel>(null)
  const isMouseDown = useRef(false)
  const [bulkTarget, setBulkTarget] = useState<{ staff: string; dates: string[] } | null>(null)

  // ── 복사·붙여넣기 (NEW) ──
  const [copiedStaff, setCopiedStaff] = useState<string | null>(null)

  const today = toDateStr(new Date())
  const daysInMonth = getDaysInMonth(year, month)
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth])
  const holidays = useMemo(() => getHolidays(year), [year])
  const isOwner = role === 'owner'
  const isManager = role === 'manager'
  const isStaff = role === 'staff'
  const visibleStaff = isStaff ? staffList.filter(n => n === myName) : staffList

  // 드래그 mouseup 전역 처리
  useEffect(() => {
    function onWindowMouseUp() {
      if (!isMouseDown.current) return
      isMouseDown.current = false
      const ds = dragSelRef.current
      if (!ds) return
      const min = Math.min(ds.startDay, ds.endDay)
      const max = Math.max(ds.startDay, ds.endDay)
      dragSelRef.current = null
      setDragSel(null)
      if (min === max) {
        setPopup({ staff: ds.staff, date: `${monthStr}-${String(min).padStart(2,'0')}` })
      } else {
        const dates: string[] = []
        for (let d = min; d <= max; d++) dates.push(`${monthStr}-${String(d).padStart(2,'0')}`)
        setBulkTarget({ staff: ds.staff, dates })
      }
    }
    window.addEventListener('mouseup', onWindowMouseUp)
    return () => window.removeEventListener('mouseup', onWindowMouseUp)
  }, [monthStr])

  function handleCellMouseDown(staff: string, day: number, e: React.MouseEvent) {
    if (!isOwner) return
    e.preventDefault()
    isMouseDown.current = true
    const next = { staff, startDay: day, endDay: day }
    dragSelRef.current = next
    setDragSel(next)
  }

  function handleCellMouseEnter(staff: string, day: number) {
    if (!isMouseDown.current || !dragSelRef.current || dragSelRef.current.staff !== staff) return
    const next = { ...dragSelRef.current, endDay: day }
    dragSelRef.current = next
    setDragSel(next)
  }

  function isCellInDrag(staff: string, day: number) {
    if (!dragSel || dragSel.staff !== staff) return false
    const min = Math.min(dragSel.startDay, dragSel.endDay)
    const max = Math.max(dragSel.startDay, dragSel.endDay)
    return day >= min && day <= max
  }

  async function handleBulkApply(status: string) {
    if (!bulkTarget) return
    if (status === '__delete__') {
      for (const dateStr of bulkTarget.dates) {
        const prev = scheduleMap[`${bulkTarget.staff}-${dateStr}`]
        await supabase.from('schedules').delete()
          .eq('store_id', storeId).eq('staff_name', bulkTarget.staff).eq('schedule_date', dateStr)
        await syncAttendance(supabase, storeId, bulkTarget.staff, dateStr, 'work')
        await logScheduleEdit(supabase, storeId, myName, bulkTarget.staff, dateStr, 'bulk_delete', prev?.status || null, null)
      }
    } else {
      for (const dateStr of bulkTarget.dates) {
        const prev = scheduleMap[`${bulkTarget.staff}-${dateStr}`]
        await supabase.from('schedules').upsert(
          { store_id: storeId, staff_name: bulkTarget.staff, schedule_date: dateStr, status, position: null, note: null },
          { onConflict: 'store_id,staff_name,schedule_date' }
        )
        await syncAttendance(supabase, storeId, bulkTarget.staff, dateStr, status)
        await logScheduleEdit(supabase, storeId, myName, bulkTarget.staff, dateStr, 'bulk_upsert', prev?.status || null, status)
      }
    }
    setBulkTarget(null)
    onSaved()
  }

  async function handlePasteToStaff(targetStaff: string) {
    if (!copiedStaff || copiedStaff === targetStaff) return
    const src = schedules.filter(s => s.staff_name === copiedStaff)
    if (src.length === 0) { alert(`${copiedStaff}의 스케줄이 없습니다`); setCopiedStaff(null); return }
    if (!confirm(`${copiedStaff}의 스케줄(${src.length}건)을 ${targetStaff}에 붙여넣을까요?\n기존 스케줄은 덮어씌워집니다.`)) return
    for (const s of src) {
      await supabase.from('schedules').upsert(
        { store_id: storeId, staff_name: targetStaff, schedule_date: s.schedule_date, status: s.status, position: s.position, note: s.note },
        { onConflict: 'store_id,staff_name,schedule_date' }
      )
    }
    setCopiedStaff(null)
    onSaved()
  }

  function openOrderModal() { setDragOrder([...visibleStaff]); setShowOrderModal(true) }

  async function saveOrder() {
    setSaving(true)
    try {
      const { data: members } = await supabase.from('store_members').select('profile_id, profiles!inner(nm)').eq('store_id', storeId).eq('active', true)
      if (members) {
        for (let i = 0; i < dragOrder.length; i++) {
          const nm = dragOrder[i]
          const member = members.find((m: any) => m.profiles?.nm === nm)
          if (member) await supabase.from('store_members').update({ sort_order: i }).eq('store_id', storeId).eq('profile_id', member.profile_id)
        }
      }
      localStorage.setItem(`staff_order_${storeId}`, JSON.stringify(dragOrder))
    } catch (e) {
      localStorage.setItem(`staff_order_${storeId}`, JSON.stringify(dragOrder))
    }
    setShowOrderModal(false); onReorderStaff(dragOrder); setSaving(false)
  }

  function handleDragStart(idx: number) { setDragIdx(idx) }
  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    const next = [...dragOrder]; const [moved] = next.splice(dragIdx, 1); next.splice(idx, 0, moved)
    setDragOrder(next); setDragIdx(idx)
  }
  function handleDragEnd() { setDragIdx(null) }

  const scheduleMap = useMemo(() => {
    const m: Record<string, any> = {}
    schedules.forEach(s => { m[`${s.staff_name}-${s.schedule_date}`] = s })
    return m
  }, [schedules])

  const popupData = popup ? (scheduleMap[`${popup.staff}-${popup.date}`] || null) : null
  function canClick(staff: string, hasSchedule: boolean) { if (isOwner) return true; if (isManager) return hasSchedule; return false }

  async function handleSave(status: string, position: string, note: string) {
    if (!popup) return
    const prev = scheduleMap[`${popup.staff}-${popup.date}`]
    await supabase.from('schedules').upsert(
      { store_id: storeId, staff_name: popup.staff, schedule_date: popup.date, status, position: position || null, note: note || null },
      { onConflict: 'store_id,staff_name,schedule_date' }
    )
    const earlyMatch = note?.match(/^\[조퇴:(\d{2}:\d{2})\]/)
    await syncAttendance(supabase, storeId, popup.staff, popup.date, status, earlyMatch?.[1])
    await logScheduleEdit(supabase, storeId, myName, popup.staff, popup.date, 'upsert', prev?.status || null, status)
    setPopup(null); onSaved()
  }

  async function handleRequest(status: string, note: string) {
    if (!popup) return
    const current = scheduleMap[`${popup.staff}-${popup.date}`]
    await supabase.from('schedule_requests').insert({ store_id: storeId, requester_nm: myName, staff_name: popup.staff, schedule_date: popup.date, requested_status: status, current_status: current?.status || null, note: note || null })
    setPopup(null); alert('변경 요청이 전송되었습니다!')
  }

  async function handleDelete() {
    if (!popup || !popupData) return
    const prev = scheduleMap[`${popup.staff}-${popup.date}`]
    await supabase.from('schedules').delete().eq('id', popupData.id)
    await syncAttendance(supabase, storeId, popup.staff, popup.date, 'work')
    await logScheduleEdit(supabase, storeId, myName, popup.staff, popup.date, 'delete', prev?.status || null, null)
    setPopup(null); onSaved()
  }

  const staffTotals = useMemo(() => {
    const t: Record<string, { work:number; off:number; half:number; absent:number; early:number; K:number; H:number; KH:number }> = {}
    visibleStaff.forEach(s => { t[s] = { work:0, off:0, half:0, absent:0, early:0, K:0, H:0, KH:0 } })
    schedules.forEach(s => {
      if (!t[s.staff_name]) return
      const st = s.status as string
      if (st === 'work') t[s.staff_name].work++
      else if (st === 'off') t[s.staff_name].off++
      else if (st === 'half') t[s.staff_name].half++
      else if (st === 'absent') t[s.staff_name].absent++
      else if (st === 'early') t[s.staff_name].early++
      if (s.position === 'K') t[s.staff_name].K++
      else if (s.position === 'H') t[s.staff_name].H++
      else if (s.position === 'KH') t[s.staff_name].KH++
    })
    return t
  }, [schedules, visibleStaff])

  return (
    <>
      {popup && <CellPopup staffName={popup.staff} dateStr={popup.date} current={popupData} role={role} myName={myName} onSave={handleSave} onRequest={handleRequest} onDelete={handleDelete} onClose={() => setPopup(null)} />}
      {bulkTarget && <BulkPopup staffName={bulkTarget.staff} dates={bulkTarget.dates} onApply={handleBulkApply} onClose={() => setBulkTarget(null)} />}
      {showRequests && <RequestPanel storeId={storeId} myName={myName} onClose={() => setShowRequests(false)} onApproved={() => { onSaved(); setShowRequests(false) }} />}

      {showOrderModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={() => setShowOrderModal(false)}>
          <div style={{ background:'#fff', borderRadius:20, padding:24, width:320, boxShadow:'0 8px 32px rgba(0,0,0,0.18)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:2 }}>👥 직원 순서 변경</div>
            <div style={{ fontSize:11, color:'#aaa', marginBottom:4 }}>드래그해서 순서를 바꿔보세요</div>
            <div style={{ fontSize:10, color:'#6C5CE7', background:'rgba(108,92,231,0.07)', borderRadius:8, padding:'6px 10px', marginBottom:16 }}>✅ 저장 시 모든 계정에서 동일한 순서로 표시됩니다</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:20 }}>
              {dragOrder.map((name, idx) => (
                <div key={name} draggable onDragStart={() => handleDragStart(idx)} onDragOver={e => handleDragOver(e, idx)} onDragEnd={handleDragEnd}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10, background: dragIdx===idx ? 'rgba(108,92,231,0.08)' : '#F8F9FB', border: dragIdx===idx ? '1px solid rgba(108,92,231,0.3)' : '1px solid #E8ECF0', cursor:'grab', userSelect:'none', transition:'background 0.1s' }}>
                  <span style={{ color:'#bbb', fontSize:14 }}>⠿</span>
                  <span style={{ fontSize:13, fontWeight:600, color:'#1a1a2e' }}>{name}</span>
                  <span style={{ marginLeft:'auto', fontSize:11, color:'#bbb' }}>{idx+1}</span>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setShowOrderModal(false)} style={{ flex:1, padding:'10px 0', borderRadius:10, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', fontSize:13, cursor:'pointer' }}>취소</button>
              <button onClick={saveOrder} disabled={saving} style={{ flex:2, padding:'10px 0', borderRadius:10, background:'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? '저장 중...' : '저장'}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
        <YearMonthPicker year={year} month={month} onChange={onChangeMonth} color="#6C5CE7" />
        <div style={{ display:'flex', gap:8, alignItems:'center', marginLeft:'auto' }}>
          {/* 복사 모드 안내 */}
          {copiedStaff && (
            <div style={{ padding:'5px 12px', borderRadius:9, background:'rgba(108,92,231,0.1)', border:'1px solid rgba(108,92,231,0.3)', color:'#6C5CE7', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>
              <span>📋 {copiedStaff} 복사 중</span>
              <button onClick={() => setCopiedStaff(null)} style={{ background:'none', border:'none', color:'#6C5CE7', cursor:'pointer', fontSize:13, lineHeight:1 }}>✕</button>
            </div>
          )}
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {Object.entries(STATUS_LABEL).map(([k,v]) => (<div key={k} style={{ display:'flex', alignItems:'center', gap:3 }}><div style={{ width:9, height:9, borderRadius:2, background:STATUS_BG[k], border:`1px solid ${STATUS_COLOR[k]}` }} /><span style={{ fontSize:10, color:'#888' }}>{v}</span></div>))}
            {['K','H','KH'].map(p => <span key={p} style={{ fontSize:10, color:POS_COLOR[p], fontWeight:700 }}>{p}</span>)}
          </div>
          {isOwner && <button onClick={openOrderModal} style={{ padding:'6px 12px', borderRadius:9, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#6B7684', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>↕ 순서</button>}
          {isOwner && <button onClick={() => setShowRequests(true)} style={{ padding:'6px 12px', borderRadius:9, background: pendingCount>0?'rgba(232,67,147,0.1)':'#F4F6F9', border: pendingCount>0?'1px solid rgba(232,67,147,0.3)':'1px solid #E8ECF0', color: pendingCount>0?'#E84393':'#aaa', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>📋 요청{pendingCount > 0 && <span style={{ background:'#E84393', color:'#fff', borderRadius:10, padding:'1px 6px', fontSize:10, marginLeft:4 }}>{pendingCount}</span>}</button>}
        </div>
      </div>

      {/* 드래그 안내 (owner만) */}
      {isOwner && (
        <div style={{ fontSize:10, color:'#bbb', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
          <span>💡 셀을 마우스로 드래그하면 여러 날 일괄 적용</span>
          <span style={{ color:'#d0d0d0' }}>·</span>
          <span>직원 이름 아래 [복사] 버튼으로 스케줄 패턴 복사</span>
        </div>
      )}

      <div style={{ overflowX:'auto', borderRadius:14, border:'1px solid #E8ECF0', boxShadow:'0 1px 6px rgba(0,0,0,0.05)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', background:'#fff', fontSize:12, tableLayout:'fixed', minWidth:600, userSelect:'none' }}>
          <colgroup><col style={{ width:90 }} />{visibleStaff.map((_,i) => <col key={i} />)}<col style={{ width:44 }} /></colgroup>
          <thead>
            <tr>
              <th style={{ background:'#F8F9FB', borderBottom:'2px solid #E8ECF0', borderRight:'2px solid #E8ECF0', padding:'10px 8px', fontSize:10, color:'#aaa', fontWeight:700, textAlign:'left', position:'sticky', top:0, zIndex:3 }}>날짜</th>
              {visibleStaff.map(name => (
                <th key={name} style={{ background:'#F8F9FB', borderBottom:'2px solid #E8ECF0', borderRight:'1px solid #ECEEF2', padding:'8px 4px', fontSize:12, color:'#1a1a2e', fontWeight:700, textAlign:'center', position:'sticky', top:0, zIndex:3 }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                    <span>{name}</span>
                    {/* 복사/붙여넣기 버튼 (NEW) */}
                    {isOwner && (
                      copiedStaff === name ? (
                        <button onClick={e => { e.stopPropagation(); setCopiedStaff(null) }}
                          style={{ fontSize:9, background:'rgba(108,92,231,0.12)', border:'1px solid #6C5CE7', color:'#6C5CE7', borderRadius:5, padding:'2px 7px', cursor:'pointer', fontWeight:700 }}>복사 취소</button>
                      ) : copiedStaff ? (
                        <button onClick={e => { e.stopPropagation(); handlePasteToStaff(name) }}
                          style={{ fontSize:9, background:'rgba(232,67,147,0.1)', border:'1px solid #E84393', color:'#E84393', borderRadius:5, padding:'2px 7px', cursor:'pointer', fontWeight:700, animation:'pulse 1s infinite' }}>여기 붙여넣기</button>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); setCopiedStaff(name) }}
                          style={{ fontSize:9, background:'#F4F6F9', border:'1px solid #E0E4E8', color:'#aaa', borderRadius:5, padding:'2px 7px', cursor:'pointer' }}>복사</button>
                      )
                    )}
                  </div>
                </th>
              ))}
              <th style={{ background:'#F8F9FB', borderBottom:'2px solid #E8ECF0', padding:'10px 4px', fontSize:10, color:'#6C5CE7', fontWeight:700, textAlign:'center', position:'sticky', top:0, zIndex:3 }}>출근</th>
            </tr>
          </thead>
          <tbody>
            {days.map(day => {
              const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`
              const dow = new Date(dateStr).getDay()
              const isToday = dateStr === today; const isSun = dow===0; const isSat = dow===6
              const workCnt = visibleStaff.filter(s => { const sc = scheduleMap[`${s}-${dateStr}`]; return sc && (sc.status==='work'||sc.status==='half'||sc.status==='early') }).length
              return (
                <tr key={day} style={{ background: isSun?'rgba(232,67,147,0.025)':isSat?'rgba(108,92,231,0.025)':isToday?'rgba(108,92,231,0.04)':'#fff', borderTop: dow===1&&day!==1?'2px solid #D0D4E8':undefined }}>
                  <td style={{ borderBottom:'1px solid #ECEEF2', borderRight:'2px solid #E8ECF0', padding:'0 8px', height:44, background: isSun||holidays[dateStr]?'rgba(232,67,147,0.06)':isSat?'rgba(108,92,231,0.05)':isToday?'rgba(108,92,231,0.07)':'#FAFBFC', position:'sticky', left:0, zIndex:1 }}>
                    <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', gap:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <span style={{ fontSize:13, fontWeight:isToday?700:500, color:isToday?'#6C5CE7':(isSun||holidays[dateStr])?'#E84393':isSat?'#6C5CE7':'#1a1a2e', lineHeight:1 }}>{day}</span>
                        <span style={{ fontSize:10, fontWeight:600, color:(isSun||holidays[dateStr])?'#E84393':isSat?'#6C5CE7':'#bbb', lineHeight:1 }}>{DOW_LABEL[dow]}</span>
                        {isToday && <span style={{ fontSize:8, background:'#6C5CE7', color:'#fff', borderRadius:3, padding:'1px 4px', fontWeight:700 }}>오늘</span>}
                      </div>
                      {holidays[dateStr] && <span style={{ fontSize:8, color:'#E84393', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:78, lineHeight:1.2 }}>{holidays[dateStr]}</span>}
                    </div>
                  </td>
                  {visibleStaff.map(staff => {
                    const sc = scheduleMap[`${staff}-${dateStr}`]
                    const clickable = canClick(staff, !!sc)
                    const inDrag = isCellInDrag(staff, day)
                    let earlyTimeDisplay = ''
                    if (sc?.status === 'early' && sc?.note) {
                      const m = sc.note.match(/^\[조퇴:(\d{2}:\d{2})\]/)
                      if (m) earlyTimeDisplay = m[1]
                    }
                    return (
                      <td key={staff}
                        onMouseDown={e => handleCellMouseDown(staff, day, e)}
                        onMouseEnter={() => handleCellMouseEnter(staff, day)}
                        onClick={() => { if (isMouseDown.current) return; if (clickable && !dragSel) setPopup({ staff, date: dateStr }) }}
                        style={{ borderBottom:'1px solid #ECEEF2', borderRight:'1px solid #ECEEF2', padding:0, height:44, textAlign:'center', verticalAlign:'middle', cursor: isOwner ? 'crosshair' : clickable ? 'pointer' : 'default', transition:'background 0.05s', background: inDrag ? 'rgba(108,92,231,0.18)' : sc ? STATUS_BG[sc.status] : undefined, outline: inDrag ? '2px solid #6C5CE7' : 'none', outlineOffset:'-2px' }}>
                        {inDrag ? (
                          <span style={{ fontSize:14, color:'#6C5CE7', fontWeight:700 }}>✓</span>
                        ) : sc ? (
                          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1, height:'100%', padding:'2px 3px' }}>
                            <span style={{ fontSize:10, fontWeight:700, color:STATUS_COLOR[sc.status] }}>{STATUS_LABEL[sc.status]}</span>
                            {earlyTimeDisplay && <span style={{ fontSize:8, color:'#00B894', fontWeight:600 }}>{earlyTimeDisplay}</span>}
                            {sc.position && <span style={{ fontSize:9, fontWeight:700, color:POS_COLOR[sc.position] }}>{sc.position}</span>}
                            {sc.note && !earlyTimeDisplay && <span title={sc.note} style={{ fontSize:8, color:'#FF6B35', maxWidth:60, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>{sc.note}</span>}
                          </div>
                        ) : clickable ? <span style={{ fontSize:18, color:'#e0e0e0', lineHeight:1 }}>+</span> : null}
                      </td>
                    )
                  })}
                  <td style={{ borderBottom:'1px solid #ECEEF2', padding:0, textAlign:'center', height:44 }}>{workCnt>0&&<span style={{ fontSize:12, fontWeight:700, color:workCnt<3?'#E84393':'#6C5CE7' }}>{workCnt}</span>}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td style={{ background:'#F4F5F8', borderTop:'2px solid #E8ECF0', borderRight:'2px solid #E8ECF0', padding:'8px', fontSize:10, color:'#888', fontWeight:700, position:'sticky', left:0 }}>합계</td>
              {visibleStaff.map(name => {
                const t = staffTotals[name] || { work:0, off:0, half:0, absent:0, early:0, K:0, H:0, KH:0 }
                return (
                  <td key={name} style={{ background:'#F4F5F8', borderTop:'2px solid #E8ECF0', borderRight:'1px solid #ECEEF2', padding:'5px 3px', textAlign:'center' }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:1, alignItems:'center' }}>
                      <span style={{ fontSize:11, fontWeight:700, color:'#6C5CE7' }}>{t.work}일</span>
                      {t.half > 0 && <span style={{ fontSize:9, color:'#FF6B35' }}>반{t.half}</span>}
                      {t.early > 0 && <span style={{ fontSize:9, color:'#00B894' }}>조{t.early}</span>}
                      {t.absent > 0 && <span style={{ fontSize:9, color:'#E67E22' }}>결{t.absent}</span>}
                      <span style={{ fontSize:9, color:'#E84393' }}>휴{t.off}</span>
                      {(t.K > 0 || t.H > 0 || t.KH > 0) && (
                        <div style={{ display:'flex', gap:3, marginTop:1 }}>
                          {t.K > 0 && <span style={{ fontSize:8, color:POS_COLOR.K, fontWeight:700 }}>K{t.K}</span>}
                          {t.H > 0 && <span style={{ fontSize:8, color:POS_COLOR.H, fontWeight:700 }}>H{t.H}</span>}
                          {t.KH > 0 && <span style={{ fontSize:8, color:POS_COLOR.KH, fontWeight:700 }}>KH{t.KH}</span>}
                        </div>
                      )}
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
// 모바일 그리드 (다중선택 모드 추가)
// ════════════════════════════════════════
function MobileGridEditor({ year, month, schedules, staffList, role, storeId, myName, onSaved, onChangeMonth, pendingCount }: {
  year: number; month: number; schedules: any[]; staffList: string[]; role: string; storeId: string; myName: string
  onSaved: () => void; onChangeMonth: (y: number, m: number) => void; pendingCount: number
}) {
  const supabase = createSupabaseBrowserClient()
  const [popup, setPopup] = useState<{ staff: string; date: string } | null>(null)
  const [showRequests, setShowRequests] = useState(false)

  // ── 다중 선택 모드 (NEW) ──
  const [multiMode, setMultiMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set()) // "staff|date"

  const today = toDateStr(new Date())
  const daysInMonth = getDaysInMonth(year, month)
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth])
  const isOwner = role==='owner'; const isManager = role==='manager'; const isStaff = role==='staff'
  const visibleStaff = isStaff ? staffList.filter(n => n===myName) : staffList
  const canEdit = isOwner || isManager
  const headerScrollRef = useRef<HTMLDivElement>(null)
  const bodyScrollRefs = useRef<(HTMLDivElement|null)[]>([])
  const footerScrollRef = useRef<HTMLDivElement>(null)
  const isSyncing = useRef(false)
  const syncScroll = useCallback((left: number) => {
    if (isSyncing.current) return; isSyncing.current = true
    headerScrollRef.current && (headerScrollRef.current.scrollLeft = left)
    bodyScrollRefs.current.forEach(r => r && (r.scrollLeft = left))
    footerScrollRef.current && (footerScrollRef.current.scrollLeft = left)
    setTimeout(() => { isSyncing.current = false }, 50)
  }, [])
  useEffect(() => { const d = parseInt(today.split('-')[2]); setTimeout(() => syncScroll(Math.max(0,(d-3)*44)), 150) }, [year, month, staffList])

  const scheduleMap = useMemo(() => { const m: Record<string,any>={}; schedules.forEach(s=>{m[`${s.staff_name}-${s.schedule_date}`]=s}); return m }, [schedules])
  const popupData = popup ? (scheduleMap[`${popup.staff}-${popup.date}`]||null) : null
  function canClick(staff: string, hasSchedule: boolean) { if(isOwner)return true; if(isManager)return hasSchedule; return false }

  function toggleSelectCell(staff: string, dateStr: string) {
    const key = `${staff}|${dateStr}`
    setSelected(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })
  }

  async function applyBulk(status: string) {
    for (const key of selected) {
      const [staff, dateStr] = key.split('|')
      const prev = scheduleMap[`${staff}-${dateStr}`]
      if (status === '__delete__') {
        await supabase.from('schedules').delete()
          .eq('store_id', storeId).eq('staff_name', staff).eq('schedule_date', dateStr)
        await syncAttendance(supabase, storeId, staff, dateStr, 'work')
        await logScheduleEdit(supabase, storeId, myName, staff, dateStr, 'bulk_delete', prev?.status || null, null)
      } else {
        await supabase.from('schedules').upsert(
          { store_id: storeId, staff_name: staff, schedule_date: dateStr, status, position: null, note: null },
          { onConflict: 'store_id,staff_name,schedule_date' }
        )
        await syncAttendance(supabase, storeId, staff, dateStr, status)
        await logScheduleEdit(supabase, storeId, myName, staff, dateStr, 'bulk_upsert', prev?.status || null, status)
      }
    }
    setSelected(new Set()); setMultiMode(false); onSaved()
  }

  async function handleSave(status: string, position: string, note: string) {
    if (!popup) return
    const prev = scheduleMap[`${popup.staff}-${popup.date}`]
    await supabase.from('schedules').upsert(
      { store_id: storeId, staff_name: popup.staff, schedule_date: popup.date, status, position: position||null, note: note||null },
      { onConflict: 'store_id,staff_name,schedule_date' }
    )
    const earlyMatch = note?.match(/^\[조퇴:(\d{2}:\d{2})\]/)
    await syncAttendance(supabase, storeId, popup.staff, popup.date, status, earlyMatch?.[1])
    await logScheduleEdit(supabase, storeId, myName, popup.staff, popup.date, 'upsert', prev?.status || null, status)
    setPopup(null); onSaved()
  }

  async function handleRequest(status: string, note: string) {
    if (!popup) return
    const current = scheduleMap[`${popup.staff}-${popup.date}`]
    await supabase.from('schedule_requests').insert({ store_id: storeId, requester_nm: myName, staff_name: popup.staff, schedule_date: popup.date, requested_status: status, current_status: current?.status||null, note: note||null })
    setPopup(null); alert('변경 요청이 전송되었습니다!')
  }

  async function handleDelete() {
    if (!popup || !popupData) return
    const prev = scheduleMap[`${popup.staff}-${popup.date}`]
    await supabase.from('schedules').delete().eq('id', popupData.id)
    await syncAttendance(supabase, storeId, popup.staff, popup.date, 'work')
    await logScheduleEdit(supabase, storeId, myName, popup.staff, popup.date, 'delete', prev?.status || null, null)
    setPopup(null); onSaved()
  }

  const staffSummary = useMemo(() => {
    return visibleStaff.map(staff => {
      const ss = schedules.filter(s => s.staff_name === staff)
      return {
        name: staff,
        work: ss.filter(s=>s.status==='work').length, off: ss.filter(s=>s.status==='off').length,
        half: ss.filter(s=>s.status==='half').length, absent: ss.filter(s=>s.status==='absent').length,
        early: ss.filter(s=>s.status==='early').length,
        K: ss.filter(s=>s.position==='K').length, H: ss.filter(s=>s.position==='H').length, KH: ss.filter(s=>s.position==='KH').length,
      }
    })
  }, [schedules, visibleStaff])

  return (
    <div>
      {popup && <CellPopup staffName={popup.staff} dateStr={popup.date} current={popupData} role={role} myName={myName} onSave={handleSave} onRequest={handleRequest} onDelete={handleDelete} onClose={() => setPopup(null)} />}
      {showRequests && <RequestPanel storeId={storeId} myName={myName} onClose={() => setShowRequests(false)} onApproved={() => { onSaved(); setShowRequests(false) }} />}

      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <div style={{ flex:1 }}><YearMonthPicker year={year} month={month} onChange={onChangeMonth} color="#6C5CE7" /></div>
        {/* 다중 선택 버튼 (NEW) */}
        {canEdit && (
          <button onClick={() => { setMultiMode(v => !v); setSelected(new Set()) }}
            style={{ padding:'7px 12px', borderRadius:10, background: multiMode ? 'rgba(108,92,231,0.12)' : '#F4F6F9', border: multiMode ? '1.5px solid #6C5CE7' : '1px solid #E8ECF0', color: multiMode ? '#6C5CE7' : '#888', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
            {multiMode ? `☑ ${selected.size}개 선택` : '☑ 선택'}
          </button>
        )}
        {isOwner && !multiMode && (
          <button onClick={() => setShowRequests(true)}
            style={{ padding:'7px 12px', borderRadius:10, background:pendingCount>0?'rgba(232,67,147,0.1)':'#F4F6F9', border:pendingCount>0?'1px solid rgba(232,67,147,0.3)':'1px solid #E8ECF0', color:pendingCount>0?'#E84393':'#aaa', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>
            📋{pendingCount>0&&<span style={{ background:'#E84393',color:'#fff',borderRadius:10,padding:'1px 6px',fontSize:10,marginLeft:4 }}>{pendingCount}</span>}
          </button>
        )}
      </div>

      {/* 다중 선택 안내 */}
      {multiMode && (
        <div style={{ padding:'8px 12px', background:'rgba(108,92,231,0.07)', borderRadius:10, marginBottom:12, fontSize:11, color:'#6C5CE7', fontWeight:600 }}>
          셀을 탭해서 여러 날 선택 후 아래 상태 버튼으로 일괄 적용하세요
        </div>
      )}

      {!multiMode && (
        <div style={{ display:'flex', gap:10, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
          {Object.entries(STATUS_LABEL).map(([k,v]) => (<div key={k} style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{ width:10, height:10, borderRadius:3, background:STATUS_BG[k], border:`1px solid ${STATUS_COLOR[k]}` }}/><span style={{ fontSize:10, color:'#888' }}>{v}</span></div>))}
          {isStaff&&<span style={{ fontSize:10, color:'#bbb', marginLeft:'auto' }}>읽기 전용</span>}
          {isManager&&<span style={{ fontSize:10, color:'#aaa', marginLeft:'auto' }}>포지션 편집 / 휴일 요청 가능</span>}
          {isOwner&&<span style={{ fontSize:10, color:'#aaa', marginLeft:'auto' }}>셀 눌러서 편집</span>}
        </div>
      )}

      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8ECF0', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display:'flex', borderBottom:'2px solid #E8ECF0' }}>
          <div style={{ minWidth:68, flexShrink:0, background:'#F8F9FB', borderRight:'2px solid #E8ECF0', display:'flex', alignItems:'center', justifyContent:'center', padding:'8px 4px' }}><span style={{ fontSize:10, color:'#aaa', fontWeight:700 }}>이름</span></div>
          <div ref={headerScrollRef} style={{ flex:1, overflowX:'auto', display:'flex' }} onScroll={e => syncScroll(e.currentTarget.scrollLeft)}>
            {days.map(day => { const dateStr=`${monthStr}-${String(day).padStart(2,'0')}`; const dow=new Date(dateStr).getDay(); const isToday=dateStr===today; const isSun=dow===0; const isSat=dow===6; return (<div key={day} style={{ minWidth:44, flexShrink:0, padding:'6px 2px', textAlign:'center', background:isToday?'rgba(108,92,231,0.07)':'#F8F9FB', borderRight:'1px solid #F0F2F5' }}><div style={{ fontSize:11, fontWeight:isToday?700:500, color:isToday?'#6C5CE7':isSun?'#E84393':isSat?'#2DC6D6':'#555' }}>{day}</div><div style={{ fontSize:9, color:isSun?'#E84393':isSat?'#2DC6D6':'#bbb' }}>{DOW_LABEL[dow]}</div></div>) })}
          </div>
        </div>
        {visibleStaff.map((staff, si) => (
          <div key={staff} style={{ display:'flex', borderTop:si>0?'1px solid #F0F2F5':'none' }}>
            <div style={{ minWidth:68, flexShrink:0, background:'#FAFBFC', borderRight:'2px solid #E8ECF0', display:'flex', alignItems:'center', justifyContent:'center', padding:'4px 6px', minHeight:52 }}><span style={{ fontSize:11, fontWeight:600, color:'#1a1a2e', textAlign:'center', wordBreak:'keep-all' as const, lineHeight:1.3 }}>{staff}</span></div>
            <div ref={el => { bodyScrollRefs.current[si] = el }} style={{ flex:1, overflowX:'auto', display:'flex' }} onScroll={e => syncScroll(e.currentTarget.scrollLeft)}>
              {days.map(day => {
                const dateStr=`${monthStr}-${String(day).padStart(2,'0')}`
                const s=scheduleMap[`${staff}-${dateStr}`]
                const dow=new Date(dateStr).getDay()
                const isToday=dateStr===today; const isSun=dow===0; const isSat=dow===6
                const clickable=canClick(staff,!!s)
                const selKey = `${staff}|${dateStr}`
                const isSelected = selected.has(selKey)
                let earlyTimeDisplay = ''
                if (s?.status === 'early' && s?.note) {
                  const m = s.note.match(/^\[조퇴:(\d{2}:\d{2})\]/)
                  if (m) earlyTimeDisplay = m[1]
                }
                return (
                  <div key={day}
                    onClick={() => {
                      if (multiMode && (isOwner || isManager)) { toggleSelectCell(staff, dateStr); return }
                      if (clickable) setPopup({staff, date:dateStr})
                    }}
                    style={{ minWidth:44, flexShrink:0, borderRight:'1px solid #F0F2F5', minHeight:52,
                      background: isSelected ? 'rgba(108,92,231,0.2)' : s ? STATUS_BG[s.status] : isToday?'rgba(108,92,231,0.03)':isSun||isSat?'#FAFBFC':'#fff',
                      cursor: (multiMode && canEdit) ? 'pointer' : clickable ? 'pointer' : 'default',
                      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1,
                      outline: isSelected ? '2px solid #6C5CE7' : 'none', outlineOffset:'-2px' }}>
                    {isSelected ? (
                      <span style={{ fontSize:16, color:'#6C5CE7', fontWeight:700 }}>✓</span>
                    ) : s ? (
                      <>
                        <span style={{ fontSize:9, fontWeight:700, color:STATUS_COLOR[s.status] }}>{STATUS_LABEL[s.status]}</span>
                        {earlyTimeDisplay && <span style={{ fontSize:8, color:'#00B894', fontWeight:600 }}>{earlyTimeDisplay}</span>}
                        {s.position && <span style={{ fontSize:9, fontWeight:700, color:POS_COLOR[s.position]||'#888' }}>{s.position}</span>}
                        {s.note && !earlyTimeDisplay && <span style={{ fontSize:7, color:'#999', maxWidth:40, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{s.note}</span>}
                      </>
                    ) : (multiMode && canEdit) ? (
                      <span style={{ fontSize:14, color:'#d0d0d0' }}>+</span>
                    ) : clickable ? <span style={{ fontSize:16, color:'#ebebeb' }}>+</span> : null}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <div style={{ display:'flex', borderTop:'2px solid #E8ECF0', background:'#F8F9FB' }}>
          <div style={{ minWidth:68, flexShrink:0, borderRight:'2px solid #E8ECF0', display:'flex', alignItems:'center', justifyContent:'center', padding:'4px 0' }}><span style={{ fontSize:9, color:'#6C5CE7', fontWeight:700 }}>출근</span></div>
          <div ref={footerScrollRef} style={{ flex:1, overflowX:'auto', display:'flex' }} onScroll={e => syncScroll(e.currentTarget.scrollLeft)}>
            {days.map(day => { const dateStr=`${monthStr}-${String(day).padStart(2,'0')}`; const cnt=visibleStaff.filter(staff=>{const s=scheduleMap[`${staff}-${dateStr}`];return s&&(s.status==='work'||s.status==='half'||s.status==='early')}).length; return (<div key={day} style={{ minWidth:44, flexShrink:0, borderRight:'1px solid #F0F2F5', minHeight:28, display:'flex', alignItems:'center', justifyContent:'center' }}>{cnt>0&&<span style={{ fontSize:10, fontWeight:700, color:'#6C5CE7' }}>{cnt}</span>}</div>) })}
          </div>
        </div>
      </div>

      {/* 다중 선택 일괄 적용 바 (NEW) */}
      {multiMode && selected.size > 0 && (
        <div style={{ position:'fixed', bottom:72, left:0, right:0, padding:'12px 16px', background:'#fff', borderTop:'2px solid #E8ECF0', boxShadow:'0 -4px 20px rgba(0,0,0,0.12)', zIndex:200 }}>
          <div style={{ fontSize:12, color:'#6C5CE7', fontWeight:700, marginBottom:10, textAlign:'center' }}>
            {selected.size}개 선택됨 — 적용할 상태를 선택하세요
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
            {(['work','off','half','absent','early'] as const).map(s => (
              <button key={s} onClick={() => applyBulk(s)}
                style={{ flex:1, minWidth:56, padding:'10px 0', borderRadius:10, border:`1.5px solid ${STATUS_COLOR[s]}`, background:STATUS_BG[s], color:STATUS_COLOR[s], fontSize:12, fontWeight:700, cursor:'pointer' }}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <button onClick={() => applyBulk('__delete__')}
            style={{ width:'100%', padding:'10px 0', borderRadius:10, border:'1.5px solid rgba(232,67,147,0.4)', background:'rgba(232,67,147,0.07)', color:'#E84393', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            🗑 선택 {selected.size}개 삭제
          </button>
        </div>
      )}

      {/* 월간 요약 */}
      {!multiMode && (
        <div style={{ marginTop:16 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#1a1a2e', marginBottom:8 }}>월간 요약</div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {staffSummary.map(s => (
              <div key={s.name} style={{ background:'#fff', borderRadius:12, border:'1px solid #E8ECF0', padding:'10px 14px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: (s.K>0||s.H>0||s.KH>0) ? 6 : 0 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'#1a1a2e' }}>{s.name}</span>
                  <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
                    <span style={{ fontSize:11, color:'#6C5CE7', fontWeight:700 }}>근무 {s.work}</span>
                    {s.half > 0 && <span style={{ fontSize:11, color:'#FF6B35', fontWeight:700 }}>반차 {s.half}</span>}
                    {s.early > 0 && <span style={{ fontSize:11, color:'#00B894', fontWeight:700 }}>조퇴 {s.early}</span>}
                    {s.absent > 0 && <span style={{ fontSize:11, color:'#E67E22', fontWeight:700 }}>결근 {s.absent}</span>}
                    <span style={{ fontSize:11, color:'#E84393', fontWeight:700 }}>휴일 {s.off}</span>
                  </div>
                </div>
                {(s.K>0||s.H>0||s.KH>0) && (
                  <div style={{ display:'flex', gap:8, paddingTop:4, borderTop:'1px solid #F4F6F9' }}>
                    {s.K > 0 && <span style={{ fontSize:10, color:POS_COLOR.K, fontWeight:700 }}>K {s.K}일</span>}
                    {s.H > 0 && <span style={{ fontSize:10, color:POS_COLOR.H, fontWeight:700 }}>H {s.H}일</span>}
                    {s.KH > 0 && <span style={{ fontSize:10, color:POS_COLOR.KH, fontWeight:700 }}>KH {s.KH}일</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 월간 캘린더 ─────────────────────────────────────────────
function MonthlyView({ year, month, schedules, onChangeMonth, selectedDate, onDayClick }: { year: number; month: number; schedules: any[]; onChangeMonth: (y:number,m:number)=>void; selectedDate: string; onDayClick: (d:string)=>void }) {
  const today = toDateStr(new Date()); const daysInMonth = getDaysInMonth(year,month); const firstDay = new Date(year,month,1).getDay(); const monthStr = `${year}-${String(month+1).padStart(2,'0')}`
  const dayMap = useMemo(() => { const m: Record<string,{work:number;off:number}>={};schedules.forEach(s=>{if(!m[s.schedule_date])m[s.schedule_date]={work:0,off:0};if(s.status==='work'||s.status==='half'||s.status==='early')m[s.schedule_date].work++;else m[s.schedule_date].off++});return m },[schedules])
  const weeks:(number|null)[][]=[];let week:(number|null)[]=Array(firstDay).fill(null)
  for(let d=1;d<=daysInMonth;d++){week.push(d);if(week.length===7){weeks.push(week);week=[]}}
  if(week.length>0){while(week.length<7)week.push(null);weeks.push(week)}
  const selSchedules = schedules.filter(s=>s.schedule_date===selectedDate).sort((a,b)=>a.staff_name.localeCompare(b.staff_name))
  return (
    <div>
      <div style={{ marginBottom:14 }}><YearMonthPicker year={year} month={month} onChange={onChangeMonth} color="#6C5CE7" /></div>
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8ECF0', padding:'14px 10px', marginBottom:14, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:6 }}>
          {['일','월','화','수','목','금','토'].map((d,i)=>(<div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:600, color:i===0?'#E84393':i===6?'#2DC6D6':'#aaa' }}>{d}</div>))}
        </div>
        {weeks.map((week,wi)=>(<div key={wi} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:3 }}>{week.map((day,di)=>{if(!day)return<div key={di}/>;const dateStr=`${monthStr}-${String(day).padStart(2,'0')}`;const info=dayMap[dateStr];const isSel=dateStr===selectedDate;const isToday=dateStr===today;return(<button key={di} onClick={()=>onDayClick(dateStr)} style={{ display:'flex',flexDirection:'column',alignItems:'center',padding:'4px 2px',borderRadius:10,cursor:'pointer',minHeight:50,border:isSel?'2px solid #6C5CE7':isToday?'1.5px solid rgba(108,92,231,0.3)':'1px solid transparent',background:isSel?'rgba(108,92,231,0.08)':'transparent' }}><span style={{ fontSize:12,fontWeight:isSel||isToday?700:400,color:isSel?'#6C5CE7':di===0?'#E84393':di===6?'#2DC6D6':'#1a1a2e' }}>{day}</span>{info&&(<div style={{ display:'flex',flexDirection:'column',gap:1,marginTop:2,width:'100%',alignItems:'center' }}>{info.work>0&&<span style={{ fontSize:8,background:'rgba(108,92,231,0.15)',color:'#6C5CE7',borderRadius:4,padding:'0px 3px',fontWeight:700 }}>{info.work}명</span>}{info.off>0&&<span style={{ fontSize:8,background:'rgba(232,67,147,0.1)',color:'#E84393',borderRadius:4,padding:'0px 3px' }}>휴{info.off}</span>}</div>)}</button>)})}</div>))}
      </div>
      <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:10 }}>{selectedDate.replace(/-/g,'.')}{selectedDate===today&&<span style={{ fontSize:10,color:'#FF6B35',background:'rgba(255,107,53,0.1)',padding:'1px 7px',borderRadius:6,marginLeft:6 }}>오늘</span>}</div>
      {selSchedules.length===0?(<div style={{ background:'#fff',borderRadius:14,border:'1px solid #E8ECF0',padding:'24px 0',textAlign:'center',color:'#bbb' }}><div style={{ fontSize:18,marginBottom:6 }}>📅</div><div style={{ fontSize:12 }}>스케줄이 없습니다</div></div>):selSchedules.map(s=>(<div key={s.id} style={{ background:'#fff',borderRadius:12,border:`1px solid ${STATUS_COLOR[s.status]}30`,padding:'10px 14px',marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center' }}><div style={{ display:'flex',alignItems:'center',gap:10 }}><div style={{ width:8,height:8,borderRadius:'50%',background:STATUS_COLOR[s.status],flexShrink:0 }}/><div><div style={{ fontSize:13,fontWeight:600,color:'#1a1a2e' }}>{s.staff_name}</div>{s.note&&<div style={{ fontSize:10,color:'#aaa',marginTop:1 }}>{s.note}</div>}</div></div><div style={{ display:'flex',alignItems:'center',gap:6 }}>{s.position&&<span style={{ fontSize:10,padding:'2px 8px',borderRadius:6,background:`${POS_COLOR[s.position]}20`,color:POS_COLOR[s.position],fontWeight:700 }}>{s.position}</span>}<span style={{ fontSize:11,padding:'3px 9px',borderRadius:8,background:STATUS_BG[s.status],color:STATUS_COLOR[s.status],fontWeight:700 }}>{STATUS_LABEL[s.status]}</span></div></div>))}
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
  const [profileId, setProfileId] = useState('')
  const [role, setRole] = useState('staff')
  const [schedules, setSchedules] = useState<any[]>([])
  const [staffList, setStaffList] = useState<string[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [viewTab, setViewTab] = useState<'grid'|'month'|'manage'>('grid')
  const [isPC, setIsPC] = useState(false)
  const nowD = new Date()
  const [calYear, setCalYear] = useState(nowD.getFullYear())
  const [calMonth, setCalMonth] = useState(nowD.getMonth())
  const [selectedDate, setSelectedDate] = useState(toDateStr(nowD))

  useEffect(() => {
    const check = () => setIsPC(window.innerWidth >= 768)
    check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store')||'{}')
    const user = JSON.parse(localStorage.getItem('mj_user')||'{}')
    if (!store.id) return
    setStoreId(store.id); setMyName(user.nm||''); setRole(user.role||'staff'); setProfileId(user.id||'')
    loadStaff(store.id)
    loadData(store.id, nowD.getFullYear(), nowD.getMonth())
    if (user.role==='owner') loadPendingCount(store.id)
  }, [])

  async function loadData(sid: string, y: number, m: number) {
    const pad = (n: number) => String(n).padStart(2,'0')
    const { data } = await supabase.from('schedules').select('*').eq('store_id',sid).gte('schedule_date',`${y}-${pad(m+1)}-01`).lte('schedule_date',`${y}-${pad(m+1)}-${pad(getDaysInMonth(y,m))}`).order('schedule_date')
    setSchedules(data||[])
  }

  async function loadStaff(sid: string) {
    const { data } = await supabase.from('store_members').select('profile_id, sort_order, profiles(nm)').eq('store_id', sid).eq('active', true)
    const members = (data||[]).map((m: any) => ({ nm: m.profiles?.nm||'', sort_order: m.sort_order ?? 9999 })).filter(m => m.nm)
    const hasDbOrder = members.some(m => m.sort_order !== 9999)
    if (hasDbOrder) {
      members.sort((a, b) => a.sort_order - b.sort_order)
      setStaffList(members.map(m => m.nm))
    } else {
      const names = members.map(m => m.nm)
      const savedOrder: string[] = JSON.parse(localStorage.getItem(`staff_order_${sid}`)||'[]')
      if (savedOrder.length > 0) {
        setStaffList([...savedOrder.filter((n:string)=>names.includes(n)), ...names.filter((n:string)=>!savedOrder.includes(n)).sort()])
      } else {
        setStaffList(names.sort())
      }
    }
  }

  async function loadPendingCount(sid: string) {
    const { count } = await supabase.from('schedule_requests').select('*',{count:'exact',head:true}).eq('store_id',sid).eq('status','pending')
    setPendingCount(count||0)
  }

  function handleChangeMonth(y: number, m: number) { setCalYear(y); setCalMonth(m); loadData(storeId,y,m) }

  const tabBtn = (active: boolean) => ({
    flex:1, padding:'9px 0', borderRadius:10, border:'none', cursor:'pointer' as const,
    fontSize:13, fontWeight: active?700:400, background: active?'#fff':'transparent',
    color: active?'#1a1a2e':'#aaa', boxShadow: active?'0 1px 4px rgba(0,0,0,0.08)':'none',
  })

  const isOwner = role === 'owner'

  const sharedProps = {
    year: calYear, month: calMonth, schedules, staffList, role, storeId, myName, pendingCount,
    onSaved: () => { loadData(storeId,calYear,calMonth); if(role==='owner') loadPendingCount(storeId) },
    onReorderStaff: (newOrder: string[]) => setStaffList(newOrder),
    onChangeMonth: handleChangeMonth,
  }

  if (isPC) return (
    <div>
      <div style={{ display:'flex', background:'#E8ECF0', borderRadius:12, padding:4, marginBottom:16, maxWidth: isOwner ? 480 : 320 }}>
        <button style={tabBtn(viewTab==='grid')} onClick={() => setViewTab('grid')}>📊 그리드 편집</button>
        <button style={tabBtn(viewTab==='month')} onClick={() => setViewTab('month')}>📅 월간 보기</button>
        {isOwner && (
          <button style={tabBtn(viewTab==='manage')} onClick={() => setViewTab('manage')}>
            🏢 전지점 관리
            {pendingCount > 0 && <span style={{ background:'#E84393', color:'#fff', borderRadius:10, padding:'1px 6px', fontSize:10, marginLeft:5 }}>{pendingCount}</span>}
          </button>
        )}
      </div>
      {viewTab==='grid' && <PCGridEditor {...sharedProps} />}
      {viewTab==='month' && <MonthlyView year={calYear} month={calMonth} schedules={schedules} onChangeMonth={handleChangeMonth} selectedDate={selectedDate} onDayClick={setSelectedDate} />}
      {viewTab==='manage' && isOwner && <ManageView profileId={profileId} myName={myName} year={calYear} month={calMonth} />}
    </div>
  )

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <span style={{ fontSize:17, fontWeight:700, color:'#1a1a2e' }}>📅 스케줄</span>
        <span style={{ fontSize:10, padding:'3px 10px', borderRadius:10, background:role==='owner'?'rgba(108,92,231,0.1)':role==='manager'?'rgba(255,107,53,0.1)':'rgba(0,184,148,0.1)', color:role==='owner'?'#6C5CE7':role==='manager'?'#FF6B35':'#00B894', fontWeight:700 }}>
          {role==='owner'?'대표':role==='manager'?'관리자':'직원'}
        </span>
      </div>
      <div style={{ display:'flex', background:'#F4F6F9', borderRadius:12, padding:4, marginBottom:16 }}>
        <button style={tabBtn(viewTab==='grid')} onClick={() => setViewTab('grid')}>📊 그리드</button>
        <button style={tabBtn(viewTab==='month')} onClick={() => setViewTab('month')}>📅 월간</button>
        {isOwner && (
          <button style={{ ...tabBtn(viewTab==='manage'), position:'relative' }} onClick={() => setViewTab('manage')}>
            🏢 관리
            {pendingCount > 0 && (
              <span style={{ position:'absolute', top:4, right:4, background:'#E84393', color:'#fff', borderRadius:8, padding:'0px 5px', fontSize:9, fontWeight:700 }}>{pendingCount}</span>
            )}
          </button>
        )}
      </div>
      {viewTab==='grid' && <MobileGridEditor {...sharedProps} />}
      {viewTab==='month' && <MonthlyView year={calYear} month={calMonth} schedules={schedules} onChangeMonth={handleChangeMonth} selectedDate={selectedDate} onDayClick={setSelectedDate} />}
      {viewTab==='manage' && isOwner && <ManageView profileId={profileId} myName={myName} year={calYear} month={calMonth} />}
    </div>
  )
}