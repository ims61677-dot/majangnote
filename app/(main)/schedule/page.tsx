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

const STATUS_LABEL: Record<string, string> = { work: '근무', off: '휴일', half: '반차', absent: '결근', early: '조퇴', etc: '기타' }
const STATUS_COLOR: Record<string, string> = { work: '#6C5CE7', off: '#E84393', half: '#FF6B35', absent: '#E67E22', early: '#00B894', etc: '#8E44AD' }
const STATUS_BG: Record<string, string> = { work: 'rgba(108,92,231,0.15)', off: 'rgba(232,67,147,0.13)', half: 'rgba(255,107,53,0.13)', absent: 'rgba(230,126,34,0.13)', early: 'rgba(0,184,148,0.13)', etc: 'rgba(142,68,173,0.15)' }
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

function isScheduleVisible(year: number, month: number, nowYear: number, nowMonth: number, isPublished: boolean, role: string) {
  if (role === 'owner') return true
  if (year < nowYear || (year === nowYear && month < nowMonth)) return true
  if (year === nowYear && month === nowMonth) return true
  return isPublished
}

function isOffRequestOpen(settings: any, viewYear: number, viewMonth: number): boolean {
  if (!settings) return false
  const now = new Date()
  const nowDay = now.getDate()
  const nowMonth = now.getMonth()
  const nowYear = now.getFullYear()
  const nextMonthNum = nowMonth === 11 ? 0 : nowMonth + 1
  const nextMonthYear = nowMonth === 11 ? nowYear + 1 : nowYear
  if (viewYear !== nextMonthYear || viewMonth !== nextMonthNum) return false
  const autoOpen = nowDay >= (settings.request_open_day || 25)
  const autoClose = nowDay <= (settings.request_close_day || 31)
  return settings.request_is_open || (autoOpen && autoClose)
}

function getBlockedDates(year: number, month: number, manualBlocked: string[]): Set<string> {
  const blocked = new Set<string>(manualBlocked || [])
  const holidays = getHolidays(year)
  Object.keys(holidays).forEach(d => blocked.add(d))
  blocked.add(`${year}-12-24`)
  return blocked
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
  } else if (['work', 'half', 'off', 'etc'].includes(scheduleStatus)) {
    const { data: existing } = await supabase.from('attendance')
      .select('id, status').eq('profile_id', pid).eq('store_id', storeId).eq('work_date', scheduleDate).maybeSingle()
    if (existing?.status === 'absent') await supabase.from('attendance').delete().eq('id', existing.id)
  }
}

async function logScheduleEdit(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  storeId: string, editorName: string, staffName: string, scheduleDate: string,
  action: string, oldStatus: string | null, newStatus: string | null
) {
  try {
    await supabase.from('schedule_edit_logs').insert({
      store_id: storeId, editor_name: editorName, staff_name: staffName,
      schedule_date: scheduleDate, action, old_status: oldStatus, new_status: newStatus,
    })
  } catch (e) { console.warn('log failed', e) }
}

function BulkPopup({ staffName, dates, onApply, onClose }: {
  staffName: string; dates: string[]; onApply: (s: string, note: string) => void | Promise<void>; onClose: () => void
}) {
  const [memo, setMemo] = useState('')
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
            <button key={s} onClick={() => onApply(s, memo)}
              style={{ padding:'14px 0', borderRadius:12, border:`1.5px solid ${STATUS_COLOR[s]}`, background:STATUS_BG[s], color:STATUS_COLOR[s], fontSize:13, fontWeight:700, cursor:'pointer' }}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:8 }}>
          {(['absent','early','etc'] as const).map(s => (
            <button key={s} onClick={() => onApply(s, memo)}
              style={{ padding:'14px 0', borderRadius:12, border:`1.5px solid ${STATUS_COLOR[s]}`, background:STATUS_BG[s], color:STATUS_COLOR[s], fontSize:13, fontWeight:700, cursor:'pointer' }}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        {/* 메모 입력 */}
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>메모 <span style={{ color:'#bbb' }}>(선택 · {dates.length}일 전체 적용)</span></div>
          <input
            value={memo} onChange={e => setMemo(e.target.value)}
            placeholder="야간, 오픈, 마감, 병원... (비워두면 메모 없음)"
            style={{ width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid #E0E4E8', background:'#F8F9FB', fontSize:13, outline:'none', boxSizing:'border-box' as const }}
          />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:8, marginBottom:8 }}>
          <button onClick={onClose}
            style={{ padding:'14px 0', borderRadius:12, border:'1px solid #E8ECF0', background:'#F4F6F9', color:'#999', fontSize:13, cursor:'pointer' }}>
            취소
          </button>
        </div>
        <button onClick={() => onApply('__delete__', '')}
          style={{ width:'100%', padding:'12px 0', borderRadius:12, border:'1.5px solid rgba(232,67,147,0.4)', background:'rgba(232,67,147,0.07)', color:'#E84393', fontSize:13, fontWeight:700, cursor:'pointer' }}>
          🗑 선택 {dates.length}일 전체 삭제
        </button>
      </div>
    </div>
  )
}

function CellPopup({ staffName, dateStr, current, role, myName, onSave, onRequest, onDelete, onClose, offRequest, onOffRequest, onOffRequestCancel, onOffRequestApprove, onOffRequestReject, canRequestOff, isBlocked }: {
  staffName: string; dateStr: string; current: any | null
  role: string; myName: string
  onSave: (status: string, position: string, note: string, confirmed?: boolean) => void
  onRequest: (status: string, note: string) => void
  onDelete: () => void; onClose: () => void
  offRequest?: any; onOffRequest?: (reason: string) => void
  onOffRequestCancel?: () => void; onOffRequestApprove?: () => void; onOffRequestReject?: () => void
  canRequestOff?: boolean; isBlocked?: boolean
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
  const [mode, setMode] = useState<'edit'|'absent_early'|'request'|'offReq'>(() => {
    if (role !== 'owner' && (offRequest || canRequestOff)) return 'offReq'
    return 'edit'
  })
  const [offReason, setOffReason] = useState('')
  const [isConfirmed, setIsConfirmed] = useState(current?.is_confirmed || false)
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
                  {(['absent','early','etc'] as const).map(s => (
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
            {isOwner && (
              <div onClick={() => setIsConfirmed((v: boolean) => !v)}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10, background: isConfirmed ? 'rgba(232,67,147,0.08)' : '#F8F9FB', border: isConfirmed ? '1.5px solid rgba(232,67,147,0.3)' : '1px solid #E8ECF0', marginBottom:12, cursor:'pointer', userSelect:'none' as const }}>
                <span style={{ fontSize:16 }}>{isConfirmed ? '🔒' : '🔓'}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:700, color: isConfirmed ? '#E84393' : '#aaa' }}>{isConfirmed ? '확정 잠금 ON' : '확정 잠금 OFF'}</div>
                  <div style={{ fontSize:10, color:'#bbb' }}>{isConfirmed ? '매니저가 이 날 수정 불가' : '누르면 매니저 수정 차단'}</div>
                </div>
                <div style={{ width:36, height:20, borderRadius:10, background: isConfirmed ? '#E84393' : '#ddd', position:'relative', transition:'background 0.2s' }}>
                  <div style={{ width:16, height:16, borderRadius:'50%', background:'#fff', position:'absolute', top:2, left: isConfirmed ? 18 : 2, transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
                </div>
              </div>
            )}
            <div style={{ display:'flex', gap:8 }}>
              {current && isOwner && <button onClick={onDelete} style={{ padding:'10px 14px', borderRadius:10, background:'rgba(232,67,147,0.08)', border:'1px solid rgba(232,67,147,0.25)', color:'#E84393', fontSize:12, cursor:'pointer', fontWeight:600 }}>삭제</button>}
              <button onClick={() => onSave(isOwner ? status : (current?.status || 'work'), position, buildNote(), isConfirmed)} style={{ flex:1, padding:'10px 0', borderRadius:10, background:'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>저장</button>
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
        {(canRequestOff || offRequest) && (
          <div style={{ marginTop: (role==='owner'||role==='manager') ? 16 : 0 }}>
            {role !== 'owner' && (
              <>
                {offRequest ? (
                  staffName === myName ? (
                    <div style={{ padding:'14px', background: offRequest.status==='approved'?'rgba(232,67,147,0.08)':offRequest.status==='rejected'?'rgba(232,67,147,0.06)':'rgba(255,200,0,0.08)', borderRadius:12, border: `1px solid ${offRequest.status==='approved'?STATUS_COLOR['off']+'40':offRequest.status==='rejected'?'rgba(232,67,147,0.2)':'rgba(255,200,0,0.3)'}` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                        <span style={{ fontSize:18 }}>{offRequest.status==='approved'?'✅':offRequest.status==='rejected'?'❌':'🙏'}</span>
                        <div>
                          <div style={{ fontSize:12, fontWeight:700, color: offRequest.status==='approved'?STATUS_COLOR['off']:offRequest.status==='rejected'?'#E84393':'#CC9900' }}>
                            {offRequest.status==='approved'?'휴무 확정됨 🎉':offRequest.status==='rejected'?'휴무 요청 거부됨':'휴무 요청 대기 중'}
                          </div>
                          <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>사유: {offRequest.reason}</div>
                        </div>
                      </div>
                      {offRequest.status === 'pending' && (
                        <button onClick={onOffRequestCancel} style={{ width:'100%', padding:'8px 0', borderRadius:9, background:'rgba(232,67,147,0.08)', border:'1px solid rgba(232,67,147,0.2)', color:'#E84393', fontSize:12, fontWeight:600, cursor:'pointer' }}>요청 취소하기</button>
                      )}
                    </div>
                  ) : (
                    <div style={{ padding:'14px', background:'rgba(108,92,231,0.05)', borderRadius:12, border:'1px solid rgba(108,92,231,0.15)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                        <span style={{ fontSize:16 }}>{offRequest.status==='approved'?'✅':'🙏'}</span>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:12, fontWeight:700, color: offRequest.status==='approved'?STATUS_COLOR['off']:'#6C5CE7' }}>
                            {staffName}님 {offRequest.status==='approved'?'휴무 확정':'휴무 요청 중'}
                          </div>
                          <div style={{ fontSize:10, color:'#888', marginTop:2 }}>📝 사유: {offRequest.reason}</div>
                        </div>
                      </div>
                      <div style={{ fontSize:10, color:'#bbb', textAlign:'center' }}>배려해주세요 💙</div>
                    </div>
                  )
                ) : canRequestOff ? (
                  <div style={{ padding:'14px', background:'rgba(255,200,0,0.06)', borderRadius:12, border:'1px solid rgba(255,200,0,0.3)' }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'#CC9900', marginBottom:4 }}>🙏 다음 달 휴무 요청</div>
                    <div style={{ fontSize:10, color:'#aaa', marginBottom:10 }}>사유를 입력하고 요청해주세요</div>
                    <input value={offReason} onChange={e => setOffReason(e.target.value)} placeholder="사유 필수 입력 (예: 병원, 가족행사...)" style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'#fff', border:'1px solid rgba(255,200,0,0.4)', fontSize:12, outline:'none', boxSizing:'border-box' as const, marginBottom:10 }} />
                    <button onClick={() => { if (!offReason.trim()) { alert('사유를 입력해주세요'); return }; onOffRequest?.(offReason.trim()); onClose() }} style={{ width:'100%', padding:'9px 0', borderRadius:9, background:'linear-gradient(135deg,#FFD700,#FF6B35)', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>휴무 요청 보내기</button>
                  </div>
                ) : null}
              </>
            )}
            {role === 'owner' && offRequest && (
              <div style={{ padding:'12px', background:'rgba(255,200,0,0.06)', borderRadius:12, border:'1px solid rgba(255,200,0,0.25)', marginTop:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                  <span style={{ fontSize:14 }}>{offRequest.status==='approved'?'✅':offRequest.status==='rejected'?'❌':'🙏'}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:'#CC9900' }}>휴무 요청</span>
                  <span style={{ marginLeft:'auto', fontSize:10, color:'#aaa' }}>{new Date(offRequest.created_at).toLocaleDateString('ko')}</span>
                </div>
                <div style={{ fontSize:11, color:'#555', marginBottom:10, padding:'6px 10px', background:'#F8F9FB', borderRadius:8 }}>사유: {offRequest.reason}</div>
                {offRequest.status === 'pending' && (
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => { onOffRequestReject?.(); onClose() }} style={{ flex:1, padding:'8px 0', borderRadius:9, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#aaa', fontSize:12, cursor:'pointer', fontWeight:600 }}>거부</button>
                    <button onClick={() => { onOffRequestApprove?.(); onClose() }} style={{ flex:2, padding:'8px 0', borderRadius:9, background:'linear-gradient(135deg,#00B894,#6C5CE7)', border:'none', color:'#fff', fontSize:12, cursor:'pointer', fontWeight:700 }}>✓ 승인</button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {isBlocked && !offRequest && (
          <div style={{ marginTop:10, padding:'10px 14px', background:'rgba(200,200,200,0.1)', borderRadius:10, border:'1px solid #E8ECF0', textAlign:'center' }}>
            <span style={{ fontSize:12, color:'#aaa' }}>🚫 요청 불가 날짜 (공휴일/지정일)</span>
          </div>
        )}
      </div>
    </div>
  )
}

function OffRequestSettingsBar({ settings, onToggleOpen, onSaveDays, onSaveBlockedDates, isActuallyOpen, year, month }: {
  settings: any; onToggleOpen: () => Promise<void>; onSaveDays: (openDay: number, closeDay: number) => Promise<void>
  onSaveBlockedDates: (dates: string[]) => Promise<void>; isActuallyOpen: boolean; year: number; month: number
}) {
  const [open, setOpen] = useState(false)
  const [openDay, setOpenDay] = useState(settings?.request_open_day ?? 25)
  const [closeDay, setCloseDay] = useState(settings?.request_close_day ?? 31)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'period'|'block'>('period')
  const isOpen = isActuallyOpen
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`
  const allBlocked: string[] = settings?.blocked_dates || []
  const thisMonthBlocked = allBlocked.filter((d: string) => d.startsWith(monthStr))
  const daysInMonth = new Date(year, month+1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  function isDateBlocked(day: number) { return thisMonthBlocked.includes(`${monthStr}-${String(day).padStart(2,'0')}`) }
  async function toggleBlockDate(day: number) {
    const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`
    const next = isDateBlocked(day) ? allBlocked.filter((d: string) => d !== dateStr) : [...allBlocked, dateStr]
    await onSaveBlockedDates(next)
  }
  async function saveDays() { setSaving(true); await onSaveDays(openDay, closeDay); setSaving(false); setOpen(false) }
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:12, background: isOpen?'rgba(255,200,0,0.08)':'rgba(200,200,200,0.08)', border: isOpen?'1px solid rgba(255,200,0,0.3)':'1px solid #E8ECF0' }}>
        <span style={{ fontSize:13 }}>{isOpen ? '🙏' : '🔒'}</span>
        <div style={{ flex:1 }}>
          <span style={{ fontSize:12, fontWeight:700, color: isOpen?'#CC9900':'#aaa' }}>{isOpen ? '직원 휴무 요청 중' : '휴무 요청 닫힘'}</span>
          <span style={{ fontSize:10, color:'#bbb', marginLeft:8 }}>(자동: 매월 {settings?.request_open_day??25}일~{settings?.request_close_day??31}일)</span>
          {thisMonthBlocked.length > 0 && <span style={{ fontSize:10, color:'#E84393', marginLeft:8 }}>🚫 {thisMonthBlocked.length}일 차단</span>}
        </div>
        <button onClick={() => setOpen(v => !v)} style={{ padding:'4px 10px', borderRadius:7, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', fontSize:11, cursor:'pointer' }}>⚙️ 설정</button>
        <button onClick={onToggleOpen} style={{ padding:'5px 12px', borderRadius:8, border:'none', cursor:'pointer', fontSize:11, fontWeight:700, background: isOpen?'rgba(232,67,147,0.1)':'rgba(255,200,0,0.15)', color: isOpen?'#E84393':'#CC9900' }}>{isOpen ? '닫기' : '열기'}</button>
      </div>
      {open && (
        <div style={{ padding:'14px', background:'#fff', borderRadius:12, border:'1px solid #E8ECF0', marginTop:6, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display:'flex', gap:6, marginBottom:14 }}>
            {(['period','block'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex:1, padding:'7px 0', borderRadius:9, border:'none', cursor:'pointer', fontSize:11, fontWeight:700, background: tab===t ? 'linear-gradient(135deg,#6C5CE7,#E84393)' : '#F4F6F9', color: tab===t ? '#fff' : '#aaa' }}>
                {t==='period' ? '📅 자동 오픈 기간' : '🚫 요청 불가일 설정'}
              </button>
            ))}
          </div>
          {tab === 'period' && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:'#aaa', marginBottom:4 }}>오픈 시작일 (매월)</div>
                  <input type="number" min={1} max={31} value={openDay} onChange={e => setOpenDay(Number(e.target.value))} style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'1px solid #E8ECF0', fontSize:13, outline:'none', boxSizing:'border-box' as const }} />
                </div>
                <span style={{ color:'#bbb', marginTop:14 }}>~</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:'#aaa', marginBottom:4 }}>마감일 (매월)</div>
                  <input type="number" min={1} max={31} value={closeDay} onChange={e => setCloseDay(Number(e.target.value))} style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'1px solid #E8ECF0', fontSize:13, outline:'none', boxSizing:'border-box' as const }} />
                </div>
              </div>
              <div style={{ fontSize:10, color:'#aaa', marginBottom:10 }}>예: 25일~31일로 설정하면 매월 25일부터 말일까지 자동으로 요청 오픈</div>
              <button onClick={saveDays} disabled={saving} style={{ width:'100%', padding:'9px 0', borderRadius:9, background:'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor: saving?'not-allowed':'pointer' }}>{saving ? '저장 중...' : '저장'}</button>
            </>
          )}
          {tab === 'block' && (
            <>
              <div style={{ fontSize:10, color:'#aaa', marginBottom:10 }}>탭하면 즉시 저장돼요. 차단된 날은 직원이 휴무 신청할 수 없어요.</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4 }}>
                {['일','월','화','수','목','금','토'].map(d => (<div key={d} style={{ textAlign:'center', fontSize:9, color:'#bbb', fontWeight:700, paddingBottom:2 }}>{d}</div>))}
                {Array.from({ length: new Date(year, month, 1).getDay() }, (_, i) => (<div key={`empty-${i}`} />))}
                {days.map(day => {
                  const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`
                  const dow = new Date(dateStr).getDay()
                  const blocked = isDateBlocked(day)
                  const isSun = dow === 0; const isSat = dow === 6
                  return (
                    <button key={day} onClick={() => toggleBlockDate(day)} style={{ padding:'6px 2px', borderRadius:8, border: blocked?'2px solid #E84393':'1px solid #E8ECF0', background: blocked?'rgba(232,67,147,0.1)':'#F8F9FB', color: blocked?'#E84393':isSun?'#E84393':isSat?'#6C5CE7':'#555', fontSize:11, fontWeight: blocked?700:400, cursor:'pointer', textAlign:'center' as const, transition:'all 0.1s' }}>
                      {blocked ? '🚫' : day}
                    </button>
                  )
                })}
              </div>
              {thisMonthBlocked.length > 0 && (
                <div style={{ marginTop:10, padding:'8px 10px', background:'rgba(232,67,147,0.05)', borderRadius:8, fontSize:10, color:'#E84393' }}>
                  차단된 날: {thisMonthBlocked.map(d => d.slice(-2) + '일').join(', ')}
                  <button onClick={async () => { await onSaveBlockedDates(allBlocked.filter((d: string) => !d.startsWith(monthStr))) }} style={{ marginLeft:8, padding:'2px 7px', borderRadius:5, border:'1px solid rgba(232,67,147,0.3)', background:'none', color:'#E84393', fontSize:10, cursor:'pointer' }}>전체 해제</button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

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

function ManageOffRequestBar({ sid, settings, isOpen, year, month, supabase, onRefresh }: {
  sid: string; settings: any; isOpen: boolean; year: number; month: number; supabase: any; onRefresh: () => void
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'period'|'block'>('period')
  const [openDay, setOpenDay] = useState(settings?.request_open_day ?? 25)
  const [closeDay, setCloseDay] = useState(settings?.request_close_day ?? 31)
  const [saving, setSaving] = useState(false)
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`
  const allBlocked: string[] = settings?.blocked_dates || []
  const thisMonthBlocked = allBlocked.filter((d: string) => d.startsWith(monthStr))
  const daysInMonth = new Date(year, month+1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  function isDateBlocked(day: number) { return thisMonthBlocked.includes(`${monthStr}-${String(day).padStart(2,'0')}`) }
  async function toggleBlockDate(day: number) {
    const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`
    const next = isDateBlocked(day) ? allBlocked.filter((d: string) => d !== dateStr) : [...allBlocked, dateStr]
    await supabase.from('schedule_settings').upsert({ store_id: sid, blocked_dates: next, updated_at: new Date().toISOString() }, { onConflict: 'store_id' })
    onRefresh()
  }
  async function savePeriod() {
    setSaving(true)
    await supabase.from('schedule_settings').upsert({ store_id: sid, request_open_day: openDay, request_close_day: closeDay, updated_at: new Date().toISOString() }, { onConflict: 'store_id' })
    setSaving(false); setOpen(false); onRefresh()
  }
  return (
    <div style={{ padding:'8px 14px', borderBottom:'1px solid #ECEEF2' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:11, fontWeight:700, color: isOpen?'#CC9900':'#aaa', flex:1 }}>
          {isOpen ? '🙏 휴무 요청 열림' : '🔒 휴무 요청 닫힘'}
          <span style={{ fontSize:9, color:'#bbb', marginLeft:6, fontWeight:400 }}>(자동: 매월 {settings?.request_open_day??25}~{settings?.request_close_day??31}일)</span>
          {thisMonthBlocked.length > 0 && <span style={{ fontSize:9, color:'#E84393', marginLeft:6 }}>🚫{thisMonthBlocked.length}일 차단</span>}
        </span>
        <button onClick={e => { e.stopPropagation(); setOpen(v => !v) }} style={{ padding:'3px 8px', borderRadius:6, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', fontSize:10, cursor:'pointer' }}>⚙️</button>
        <button onClick={async e => {
          e.stopPropagation()
          await supabase.from('schedule_settings').upsert({ store_id: sid, request_is_open: !isOpen, updated_at: new Date().toISOString() }, { onConflict: 'store_id' })
          onRefresh()
        }} style={{ padding:'3px 10px', borderRadius:6, border:'none', cursor:'pointer', fontSize:10, fontWeight:700, background: isOpen?'rgba(232,67,147,0.1)':'rgba(255,200,0,0.15)', color: isOpen?'#E84393':'#CC9900' }}>
          {isOpen ? '닫기' : '열기'}
        </button>
      </div>
      {open && (
        <div style={{ marginTop:8, padding:'12px', background:'#F8F9FB', borderRadius:10, border:'1px solid #E8ECF0' }}>
          <div style={{ display:'flex', gap:4, marginBottom:10 }}>
            {(['period','block'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex:1, padding:'5px 0', borderRadius:7, border:'none', cursor:'pointer', fontSize:10, fontWeight:700, background: tab===t ? 'linear-gradient(135deg,#6C5CE7,#E84393)' : '#fff', color: tab===t ? '#fff' : '#aaa', boxShadow: tab===t ? '0 1px 4px rgba(108,92,231,0.3)' : 'none' }}>
                {t==='period' ? '📅 자동 오픈 기간' : '🚫 요청 불가일'}
              </button>
            ))}
          </div>
          {tab === 'period' && (
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input type="number" min={1} max={31} value={openDay} onChange={e => setOpenDay(Number(e.target.value))} style={{ flex:1, padding:'6px 8px', borderRadius:7, border:'1px solid #E8ECF0', fontSize:12, outline:'none' }} />
              <span style={{ color:'#bbb', fontSize:11 }}>~</span>
              <input type="number" min={1} max={31} value={closeDay} onChange={e => setCloseDay(Number(e.target.value))} style={{ flex:1, padding:'6px 8px', borderRadius:7, border:'1px solid #E8ECF0', fontSize:12, outline:'none' }} />
              <button onClick={savePeriod} disabled={saving} style={{ padding:'6px 14px', borderRadius:7, background:'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer' }}>{saving ? '...' : '저장'}</button>
            </div>
          )}
          {tab === 'block' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:3 }}>
                {['일','월','화','수','목','금','토'].map(d => (<div key={d} style={{ textAlign:'center', fontSize:8, color:'#bbb', fontWeight:700, paddingBottom:2 }}>{d}</div>))}
                {Array.from({ length: new Date(year, month, 1).getDay() }, (_, i) => <div key={`e${i}`} />)}
                {days.map(day => {
                  const dow = new Date(`${monthStr}-${String(day).padStart(2,'0')}`).getDay()
                  const blocked = isDateBlocked(day)
                  return (
                    <button key={day} onClick={() => toggleBlockDate(day)} style={{ padding:'4px 1px', borderRadius:6, border: blocked?'2px solid #E84393':'1px solid #E8ECF0', background: blocked?'rgba(232,67,147,0.1)':'#fff', color: blocked?'#E84393':dow===0?'#E84393':dow===6?'#6C5CE7':'#555', fontSize:10, fontWeight: blocked?700:400, cursor:'pointer' }}>
                      {blocked ? '🚫' : day}
                    </button>
                  )
                })}
              </div>
              {thisMonthBlocked.length > 0 && (
                <div style={{ marginTop:8, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:9, color:'#E84393' }}>차단: {thisMonthBlocked.map(d => d.slice(-2)+'일').join(', ')}</span>
                  <button onClick={async () => {
                    await supabase.from('schedule_settings').upsert({ store_id: sid, blocked_dates: allBlocked.filter((d:string) => !d.startsWith(monthStr)), updated_at: new Date().toISOString() }, { onConflict: 'store_id' })
                    onRefresh()
                  }} style={{ padding:'2px 8px', borderRadius:5, border:'1px solid rgba(232,67,147,0.3)', background:'none', color:'#E84393', fontSize:9, cursor:'pointer' }}>전체 해제</button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ManageView({ profileId, myName, year: initYear, month: initMonth }: {
  profileId: string; myName: string; year: number; month: number
}) {
  const supabase = createSupabaseBrowserClient()
  const [year, setYear] = useState(initYear)
  const [month, setMonth] = useState(initMonth)
  const [storeItems, setStoreItems] = useState<any[]>([])
  const [storeData, setStoreData] = useState<Record<string, { schedules: any[]; requests: any[]; staff: string[]; settings: any; offRequests: any[] }>>({})
  const [loading, setLoading] = useState(true)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [section, setSection] = useState<'today'|'grid'|'summary'|'requests'|'logs'>('today')
  const [logs, setLogs] = useState<any[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [editPopup, setEditPopup] = useState<{ sid: string; staff: string; date: string; current: any|null } | null>(null)
  const [manageDragSel, setManageDragSel] = useState<{ sid: string; staff: string; startDay: number; endDay: number } | null>(null)
  const manageDragRef = useRef<typeof manageDragSel>(null)
  const manageMouseDown = useRef(false)
  const [manageBulkTarget, setManageBulkTarget] = useState<{ sid: string; staff: string; dates: string[] } | null>(null)
  const [gridExpanded, setGridExpanded] = useState<Record<string, boolean>>({})
  const [manageCopied, setManageCopied] = useState<{ sid: string; staff: string } | null>(null)
  const [backingUp, setBackingUp] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const nowDExport = new Date()
  const [exportStartYear, setExportStartYear] = useState(nowDExport.getFullYear())
  const [exportStartMonth, setExportStartMonth] = useState(nowDExport.getMonth() + 1)
  const [exportEndYear, setExportEndYear] = useState(nowDExport.getFullYear())
  const [exportEndMonth, setExportEndMonth] = useState(nowDExport.getMonth() + 1)
  const [exporting, setExporting] = useState(false)

  async function handleManagePaste(targetSid: string, targetStaff: string) {
    if (!manageCopied) return
    const src = storeData[manageCopied.sid]?.schedules.filter((s: any) => s.staff_name === manageCopied.staff) || []
    if (src.length === 0) { alert(`${manageCopied.staff}의 스케줄이 없습니다`); setManageCopied(null); return }
    const pad = (n: number) => String(n).padStart(2,'0')
    const mStr = `${year}-${pad(month+1)}`
    const startDate = `${mStr}-01`; const endDate = `${mStr}-${pad(getDaysInMonth(year, month))}`
    if (!window.confirm(`${manageCopied.staff}의 스케줄을 ${targetStaff}에 붙여넣을까요?\n${targetStaff}의 ${month+1}월 스케줄 전체가 교체됩니다.`)) return
    await supabase.from('schedules').delete()
      .eq('store_id', targetSid).eq('staff_name', targetStaff)
      .gte('schedule_date', startDate).lte('schedule_date', endDate)
    if (src.length > 0) {
      await supabase.from('schedules').upsert(
        src.map((s: any) => ({ store_id: targetSid, staff_name: targetStaff, schedule_date: s.schedule_date, status: s.status, position: s.position, note: s.note })),
        { onConflict: 'store_id,staff_name,schedule_date' }
      )
    }
    setManageCopied(null); loadAll()
  }

  async function exportManageExcel() {
    if (storeItems.length === 0) { alert('지점 데이터가 없습니다.'); return }
    setExporting(true)
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      const pad = (n: number) => String(n).padStart(2,'0')
      const DOW_KR = ['일','월','화','수','목','금','토']
      const CELL_COLOR: Record<string, string> = { work:'FFE8E4FF', off:'FFFCE4F0', half:'FFFFEEE6', absent:'FFFFF3E0', early:'FFE0FAF4', etc:'FFF3E0FF', confirmed:'FFFFD6EC', pending:'FFFFF9E0' }
      const TEXT_COLOR: Record<string, string> = { work:'FF6C5CE7', off:'FFE84393', half:'FFFF6B35', absent:'FFE67E22', early:'FF00B894', etc:'FF8E44AD', confirmed:'FFE84393', pending:'FFCC9900' }
      const thin = (argb = 'FFD8D8D8') => ({ style: 'thin' as const, color: { argb } })
      const med  = (argb = 'FF999999') => ({ style: 'medium' as const, color: { argb } })
      const STORE_COLORS = ['FF1D3557','FF4A148C','FF1B5E20','FF7B2D00','FF37474F']
      const months: { y: number; m: number }[] = []
      let cy = exportStartYear, cm = exportStartMonth
      while (cy < exportEndYear || (cy === exportEndYear && cm <= exportEndMonth)) {
        months.push({ y: cy, m: cm }); cm++; if (cm > 12) { cm = 1; cy++ }
      }
      for (const { y: mY, m: mM } of months) {
        const monthStr = `${mY}-${pad(mM)}`
        const daysInMonthE = getDaysInMonth(mY, mM - 1)
        const holidays = getHolidays(mY)
        const ws = wb.addWorksheet(`${mY}년${mM}월`.slice(0, 31))
        const storeMonthData: { name: string; staff: string[]; schedMap: Record<string,any>; offReqMap: Record<string,any> }[] = []
        const startDate = `${monthStr}-01`; const endDate = `${monthStr}-${pad(daysInMonthE)}`
        await Promise.all(storeItems.map(async (member: any) => {
          const sid = member.stores?.id
          const [schedsRes, staffRes, offReqsRes] = await Promise.all([
            supabase.from('schedules').select('*').eq('store_id', sid).gte('schedule_date', startDate).lte('schedule_date', endDate),
            supabase.from('store_members').select('profile_id, sort_order, profiles(nm)').eq('store_id', sid).eq('active', true),
            supabase.from('off_requests').select('*').eq('store_id', sid).eq('target_month', monthStr),
          ])
          const staffNames = (staffRes.data || []).map((m: any) => ({ nm: m.profiles?.nm || '', order: m.sort_order ?? 9999 })).filter((m: any) => m.nm).sort((a: any, b: any) => a.order - b.order).map((m: any) => m.nm)
          const schedMap: Record<string,any> = {}; (schedsRes.data || []).forEach((s: any) => { schedMap[`${s.staff_name}-${s.schedule_date}`] = s })
          const offReqMap: Record<string,any> = {}; (offReqsRes.data || []).forEach((r: any) => { offReqMap[`${r.staff_name}-${r.request_date}`] = r })
          storeMonthData.push({ name: member.stores?.name || '', staff: staffNames, schedMap, offReqMap })
        }))
        let colOffset = 3
        const storeRanges: { name: string; staff: string[]; start: number; end: number; schedMap: Record<string,any>; offReqMap: Record<string,any> }[] = []
        storeMonthData.forEach(sd => { storeRanges.push({ ...sd, start: colOffset, end: colOffset + sd.staff.length }); colOffset += sd.staff.length + 1 })
        const totalCols = colOffset - 1
        const titleRow = ws.addRow(new Array(totalCols).fill('')); ws.mergeCells(1, 1, 1, totalCols)
        const tc = titleRow.getCell(1); tc.value = `📅 ${mY}년 ${mM}월  전 지점 스케줄`
        tc.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF1A1A2E' } }; tc.font = { bold:true, color:{ argb:'FFFFFFFF' }, size:14 }; tc.alignment = { horizontal:'center', vertical:'middle' }; titleRow.height = 30
        const storeRow = ws.addRow(new Array(totalCols).fill('')); ws.mergeCells(2, 1, 2, 2)
        const dhc = storeRow.getCell(1); dhc.value = '날짜 / 요일'; dhc.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF2C3E50' } }; dhc.font = { bold:true, color:{ argb:'FFFFFFFF' }, size:10 }; dhc.alignment = { horizontal:'center', vertical:'middle' }; dhc.border = { top:thin(), bottom:thin(), left:thin(), right:med() }
        storeRanges.forEach(({ name, start, end }, si) => {
          ws.mergeCells(2, start, 2, end); const c = storeRow.getCell(start); c.value = `🏪 ${name}`
          c.fill = { type:'pattern', pattern:'solid', fgColor:{ argb: STORE_COLORS[si % STORE_COLORS.length] } }; c.font = { bold:true, color:{ argb:'FFFFFFFF' }, size:12 }; c.alignment = { horizontal:'center', vertical:'middle' }; c.border = { top:thin(), bottom:thin(), left:med('FFFFFFFF'), right:med('FFFFFFFF') }
        }); storeRow.height = 24
        const staffRow = ws.addRow(new Array(totalCols).fill(''));
        [1,2].forEach((ci, i) => { const c = staffRow.getCell(ci); c.value = i===0 ? '날짜' : '요일'; c.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF2C3E50' } }; c.font = { bold:true, color:{ argb:'FFFFFFFF' }, size:10 }; c.alignment = { horizontal:'center', vertical:'middle' }; c.border = { top:thin(), bottom:med(), left:thin(), right:i===0?thin():med() } })
        storeRanges.forEach(({ staff, start, end }, si) => {
          const color = STORE_COLORS[si % STORE_COLORS.length]
          staff.forEach((nm, i) => { const c = staffRow.getCell(start + i); c.value = nm; c.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:color } }; c.font = { bold:true, color:{ argb:'FFFFFFFF' }, size:10 }; c.alignment = { horizontal:'center', vertical:'middle' }; c.border = { top:thin(), bottom:med(), left:i===0?med('FFFFFFFF'):thin(), right:thin() } })
          const cc = staffRow.getCell(end); cc.value = '출근↑'; cc.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:color } }; cc.font = { bold:true, color:{ argb:'FFFFFFFF' }, size:9 }; cc.alignment = { horizontal:'center', vertical:'middle' }; cc.border = { top:thin(), bottom:med(), left:thin(), right:med('FFFFFFFF') }
        }); staffRow.height = 20
        ws.getColumn(1).width = 13; ws.getColumn(2).width = 5
        storeRanges.forEach(({ staff, start, end }) => { staff.forEach((_, i) => { ws.getColumn(start + i).width = 10 }); ws.getColumn(end).width = 6 })
        for (let day = 1; day <= daysInMonthE; day++) {
          const dateStr = `${monthStr}-${pad(day)}`; const dow = new Date(dateStr).getDay(); const isHoliday = !!holidays[dateStr]; const isSun = dow === 0; const isSat = dow === 6; const isMonday = dow === 1 && day !== 1; const holiday = isHoliday ? ` (${holidays[dateStr]})` : ''; const topBorder = isMonday ? med('FFAAB0CC') : thin()
          const row = ws.addRow(new Array(totalCols).fill('')); row.height = 20
          const dateBg = isSun||isHoliday ? 'FFFCE4F0' : isSat ? 'FFF0EEFF' : 'FFFAFAFA'; const dateClr = isSun||isHoliday ? 'FFE84393' : isSat ? 'FF6C5CE7' : 'FF333333'
          const dc = row.getCell(1); dc.value = `${mM}/${day}${holiday}`; dc.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:dateBg } }; dc.font = { color:{ argb:dateClr }, size:10 }; dc.alignment = { horizontal:'left', vertical:'middle' }; dc.border = { top:topBorder, bottom:thin(), left:thin(), right:thin() }
          const dw = row.getCell(2); dw.value = DOW_KR[dow]; dw.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:dateBg } }; dw.font = { bold:true, color:{ argb:dateClr }, size:10 }; dw.alignment = { horizontal:'center', vertical:'middle' }; dw.border = { top:topBorder, bottom:thin(), left:thin(), right:med() }
          storeRanges.forEach(({ staff, start, end, schedMap, offReqMap }, si) => {
            let workCnt = 0; const isLastStore = si === storeRanges.length - 1
            staff.forEach((name, i) => {
              const sc = schedMap[`${name}-${dateStr}`]; const offR = offReqMap[`${name}-${dateStr}`]; const cell = row.getCell(start + i)
              cell.alignment = { horizontal:'center', vertical:'middle' }; cell.border = { top:topBorder, bottom:thin(), left:i===0?med('FFFFFFFF'):thin(), right:thin() }
              if (sc) {
                const label = STATUS_LABEL[sc.status] || sc.status; const pos = sc.position ? ` [${sc.position}]` : ''; const note = sc.note ? ` (${sc.note.replace(/\[조퇴:\d{2}:\d{2}\]\s*/,'')})` : ''
                cell.value = `${label}${pos}${note}${sc.is_confirmed?' 🔒':''}`; const key = sc.is_confirmed ? 'confirmed' : sc.status
                if (CELL_COLOR[key]) { cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:CELL_COLOR[key] } }; cell.font = { bold:true, color:{ argb:TEXT_COLOR[key] }, size:10 } }
                if (sc.status==='work'||sc.status==='half'||sc.status==='early') workCnt++
              } else if (offR?.status === 'approved') { cell.value = '🔒 휴일확정'; cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:CELL_COLOR.confirmed } }; cell.font = { bold:true, color:{ argb:TEXT_COLOR.confirmed }, size:10 }
              } else if (offR?.status === 'pending') { cell.value = '🙏 요청중'; cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:CELL_COLOR.pending } }; cell.font = { color:{ argb:TEXT_COLOR.pending }, size:10 }
              } else { cell.font = { color:{ argb:'FFDDDDDD' }, size:9 } }
            })
            const cc = row.getCell(end); cc.value = workCnt || null; cc.font = { bold:true, color:{ argb: workCnt<3?'FFE84393':'FF6C5CE7' }, size:10 }; cc.alignment = { horizontal:'center', vertical:'middle' }; cc.border = { top:topBorder, bottom:thin(), left:thin(), right: isLastStore?med('FFAAAAAA'):med('FFFFFFFF') }
          })
        }
        const sumRow = ws.addRow(new Array(totalCols).fill('')); ws.mergeCells(ws.rowCount, 1, ws.rowCount, 2)
        const sc1 = sumRow.getCell(1); sc1.value = `${mY}년 ${mM}월 합계`; sc1.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFFE8CC' } }; sc1.font = { bold:true, size:11, color:{ argb:'FF1A1A2E' } }; sc1.alignment = { horizontal:'center', vertical:'middle' }; sc1.border = { top:med('FFFF6B35'), bottom:thin(), left:thin(), right:med() }
        storeRanges.forEach(({ staff, start, end, schedMap }) => {
          staff.forEach((name, i) => {
            const cnt = Object.values(schedMap).filter((s: any) => s.staff_name === name && ['work','half','early'].includes(s.status)).length
            const c = sumRow.getCell(start + i); c.value = cnt || null; c.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFFE8CC' } }; c.font = { bold:true, color:{ argb:'FF6C5CE7' }, size:11 }; c.alignment = { horizontal:'center', vertical:'middle' }; c.border = { top:med('FFFF6B35'), bottom:thin(), left:thin(), right:thin() }
          })
          const ec = sumRow.getCell(end); ec.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFFE8CC' } }; ec.border = { top:med('FFFF6B35'), bottom:thin(), left:thin(), right:med('FFFFFFFF') }
        }); sumRow.height = 26; ws.views = [{ state:'frozen', xSplit:2, ySplit:3 }]
      }
      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url
      a.download = `전지점_스케줄_${exportStartYear}년${exportStartMonth}월~${exportEndYear}년${exportEndMonth}월.xlsx`; a.click(); URL.revokeObjectURL(url)
    } catch (e: any) { alert('내보내기 실패: ' + (e?.message || '다시 시도해주세요')) }
    finally { setExporting(false); setShowExportModal(false) }
  }

  const today = toDateStr(new Date()); const tomorrow = toDateStr(new Date(Date.now() + 86400000))
  const nowD = new Date(); const nowYear = nowD.getFullYear(); const nowMonth = nowD.getMonth()

  useEffect(() => { loadAll() }, [year, month])
  useEffect(() => { setYear(initYear); setMonth(initMonth) }, [initYear, initMonth])

  useEffect(() => {
    const onMouseUp = () => {
      if (manageMouseDown.current && manageDragRef.current) {
        const drag = manageDragRef.current
        const s = Math.min(drag.startDay, drag.endDay); const e = Math.max(drag.startDay, drag.endDay)
        const dates: string[] = []
        for (let d = s; d <= e; d++) dates.push(`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
        if (dates.length > 1) { setManageBulkTarget({ sid: drag.sid, staff: drag.staff, dates }); setManageDragSel(null) }
        else {
          const dateStr = dates[0]; const d2 = storeData[drag.sid]
          const sc = d2 ? d2.schedules.find((sc: any) => sc.staff_name === drag.staff && sc.schedule_date === dateStr) : null
          setEditPopup({ sid: drag.sid, staff: drag.staff, date: dateStr, current: sc || null }); setManageDragSel(null)
        }
      }
      manageMouseDown.current = false; manageDragRef.current = null
    }
    window.addEventListener('mouseup', onMouseUp); return () => window.removeEventListener('mouseup', onMouseUp)
  }, [storeData, year, month])

  async function loadAll() {
    setLoading(true)
    const { data: members } = await supabase.from('store_members').select('*, stores(*)').eq('profile_id', profileId).eq('active', true)
    const myStores = (members || []); setStoreItems(myStores)
    const pad = (n: number) => String(n).padStart(2, '0')
    const startDate = `${year}-${pad(month+1)}-01`; const endDate = `${year}-${pad(month+1)}-${pad(getDaysInMonth(year, month))}`
    const newData: typeof storeData = {}
    await Promise.all(myStores.map(async (member: any) => {
      const sid = member.stores?.id; if (!sid) return
      const [schedsRes, reqsRes, staffRes, inactiveStaffRes, settingsRes, offReqsRes] = await Promise.all([
        supabase.from('schedules').select('*').eq('store_id', sid).gte('schedule_date', startDate).lte('schedule_date', endDate),
        supabase.from('schedule_requests').select('*').eq('store_id', sid).eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('store_members').select('profile_id, sort_order, profiles(nm)').eq('store_id', sid).eq('active', true),
        supabase.from('store_members').select('profile_id, sort_order, profiles(nm)').eq('store_id', sid).eq('active', false),
        supabase.from('schedule_settings').select('*').eq('store_id', sid).maybeSingle(),
        supabase.from('off_requests').select('*').eq('store_id', sid).eq('target_month', `${year}-${pad(month+1)}`),
      ])
      const activeNames = (staffRes.data || []).map((m: any) => ({ nm: m.profiles?.nm || '', order: m.sort_order ?? 9999 })).filter((m: any) => m.nm).sort((a: any, b: any) => a.order - b.order).map((m: any) => m.nm)
      const schedNamesInMonth = new Set((schedsRes.data || []).map((s: any) => s.staff_name))
      const inactiveWithSched = (inactiveStaffRes.data || []).map((m: any) => m.profiles?.nm || '').filter((nm: string) => nm && !activeNames.includes(nm) && schedNamesInMonth.has(nm))
      const staffNames = [...activeNames, ...inactiveWithSched]
      newData[sid] = { schedules: schedsRes.data || [], requests: reqsRes.data || [], staff: staffNames, settings: settingsRes.data || null, offRequests: offReqsRes.data || [] }
    }))
    setStoreData(newData); setLoading(false)
    const expanded: Record<string, boolean> = {}; myStores.forEach((m: any) => { if (m.stores?.id) expanded[m.stores.id] = true }); setGridExpanded(expanded)
  }

  async function handleManageBulkApply(status: string, note: string) {
    if (!manageBulkTarget) return
    const { sid, staff, dates } = manageBulkTarget
    const d = storeData[sid]; const schedMap: Record<string,any> = {}
    if (d) d.schedules.forEach((s: any) => { schedMap[`${s.staff_name}-${s.schedule_date}`] = s })
    if (status === '__delete__') {
      await supabase.from('schedules').delete().eq('store_id', sid).eq('staff_name', staff).in('schedule_date', dates)
      await Promise.all(dates.map(async dateStr => { const prev = schedMap[`${staff}-${dateStr}`]; await syncAttendance(supabase, sid, staff, dateStr, 'work'); await logScheduleEdit(supabase, sid, myName, staff, dateStr, 'bulk_delete', prev?.status || null, null) }))
    } else {
      await supabase.from('schedules').upsert(dates.map(dateStr => ({ store_id: sid, staff_name: staff, schedule_date: dateStr, status, position: null, note: note || null })), { onConflict: 'store_id,staff_name,schedule_date' })
      await Promise.all(dates.map(async dateStr => { const prev = schedMap[`${staff}-${dateStr}`]; await syncAttendance(supabase, sid, staff, dateStr, status); await logScheduleEdit(supabase, sid, myName, staff, dateStr, 'bulk_upsert', prev?.status || null, status) }))
    }
    setManageBulkTarget(null); loadAll()
  }

  async function loadLogs() {
    setLogsLoading(true)
    const sids = storeItems.map((m: any) => m.stores?.id).filter(Boolean)
    if (sids.length === 0) { setLogsLoading(false); return }
    const { data } = await supabase.from('schedule_edit_logs').select('*').in('store_id', sids).order('created_at', { ascending: false }).limit(200)
    setLogs(data || []); setLogsLoading(false)
  }

  async function handleApprove(sid: string, req: any) {
    setApprovingId(req.id)
    await supabase.from('schedules').upsert({ store_id: sid, staff_name: req.staff_name, schedule_date: req.schedule_date, status: req.requested_status, position: null, note: req.note }, { onConflict: 'store_id,staff_name,schedule_date' })
    const earlyMatch = req.note?.match(/^\[조퇴:(\d{2}:\d{2})\]/)
    await syncAttendance(supabase, sid, req.staff_name, req.schedule_date, req.requested_status, earlyMatch?.[1])
    await supabase.from('schedule_requests').update({ status: 'approved', reviewed_by: myName, reviewed_at: new Date().toISOString() }).eq('id', req.id)
    setApprovingId(null); loadAll()
  }

  async function handleReject(sid: string, req: any) {
    await supabase.from('schedule_requests').update({ status: 'rejected', reviewed_by: myName, reviewed_at: new Date().toISOString() }).eq('id', req.id); loadAll()
  }

  async function handleFullBackup() {
    setBackingUp(true)
    try {
      const sids = storeItems.map((m: any) => m.stores?.id).filter(Boolean)
      const storeNames: Record<string, string> = {}; storeItems.forEach((m: any) => { if (m.stores?.id) storeNames[m.stores.id] = m.stores.name || '' })
      const { data: allSchedules } = await supabase.from('schedules').select('*').in('store_id', sids).order('store_id').order('schedule_date')
      const bom = '\uFEFF'; const headers = ['지점명', '직원명', '날짜', '상태', '포지션', '메모']; const rows = [headers]
      ;(allSchedules || []).forEach((s: any) => {
        const STATUS: Record<string,string> = { work:'근무', off:'휴일', half:'반차', absent:'결근', early:'조퇴' }
        rows.push([storeNames[s.store_id] || s.store_id, s.staff_name || '', s.schedule_date || '', STATUS[s.status] || s.status || '', s.position || '', (s.note || '').replace(/^\[조퇴:\d{2}:\d{2}\]\s*/, '')])
      })
      const csv = bom + rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url
      const today = new Date(); a.download = `매장노트_전체백업_${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}.csv`; a.click(); URL.revokeObjectURL(url)
    } catch(e) { alert('백업 실패: ' + e) }
    setBackingUp(false)
  }

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:60, gap:12 }}>
      <div style={{ fontSize:28 }}>⏳</div><div style={{ fontSize:13, color:'#aaa' }}>전 지점 데이터 불러오는 중...</div>
    </div>
  )

  const totalPending = Object.values(storeData).reduce((s, d) => s + d.requests.length, 0)
  const totalOffPending = Object.values(storeData).reduce((s, d) => s + (d.offRequests || []).filter((r: any) => r.status === 'pending').length, 0)
  const totalStaff = Object.values(storeData).reduce((s, d) => s + d.staff.length, 0)
  const daysInMonth = getDaysInMonth(year, month); const monthStr = `${year}-${String(month+1).padStart(2,'0')}`; const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const secBtn = (active: boolean) => ({
    flex: 1, padding: '8px 4px', borderRadius: 9, border: 'none', cursor: 'pointer' as const,
    fontSize: 11, fontWeight: active ? 700 : 400, background: active ? '#fff' : 'transparent',
    color: active ? '#1a1a2e' : '#aaa', boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', whiteSpace: 'nowrap' as const,
  })

  return (
    <div>
      {showExportModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={() => setShowExportModal(false)}>
          <div style={{ background:'#fff', borderRadius:20, padding:24, width:'100%', maxWidth:360, boxShadow:'0 8px 32px rgba(0,0,0,0.18)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:16, fontWeight:700, color:'#1a1a2e', marginBottom:4 }}>📥 엑셀 내보내기</div>
            <div style={{ fontSize:11, color:'#aaa', marginBottom:20 }}>월별 시트, 전 지점 한눈에 표시</div>
            <div style={{ display:'flex', gap:12, marginBottom:16 }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:'#888', fontWeight:600, marginBottom:6 }}>시작 월</div>
                <div style={{ display:'flex', gap:6 }}>
                  <input type="number" value={exportStartYear} onChange={e => setExportStartYear(Number(e.target.value))} min={2020} max={2030} style={{ width:70, padding:'8px', borderRadius:8, border:'1px solid #E8ECF0', fontSize:13, outline:'none', textAlign:'center' as const }} />
                  <select value={exportStartMonth} onChange={e => setExportStartMonth(Number(e.target.value))} style={{ flex:1, padding:'8px', borderRadius:8, border:'1px solid #E8ECF0', fontSize:13, outline:'none' }}>
                    {Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{m}월</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:10, color:'#bbb', fontSize:18 }}>~</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:11, color:'#888', fontWeight:600, marginBottom:6 }}>종료 월</div>
                <div style={{ display:'flex', gap:6 }}>
                  <input type="number" value={exportEndYear} onChange={e => setExportEndYear(Number(e.target.value))} min={2020} max={2030} style={{ width:70, padding:'8px', borderRadius:8, border:'1px solid #E8ECF0', fontSize:13, outline:'none', textAlign:'center' as const }} />
                  <select value={exportEndMonth} onChange={e => setExportEndMonth(Number(e.target.value))} style={{ flex:1, padding:'8px', borderRadius:8, border:'1px solid #E8ECF0', fontSize:13, outline:'none' }}>
                    {Array.from({length:12},(_,i)=>i+1).map(m => <option key={m} value={m}>{m}월</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div style={{ padding:'10px 14px', background:'rgba(0,184,148,0.06)', borderRadius:10, border:'1px solid rgba(0,184,148,0.2)', marginBottom:20, fontSize:11, color:'#00B894' }}>
              📋 시트: 월별 분리 &nbsp;|&nbsp; 📊 전 지점 한 시트에 &nbsp;|&nbsp; 🎨 색상 구분
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setShowExportModal(false)} style={{ flex:1, padding:'11px 0', borderRadius:10, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', fontSize:13, cursor:'pointer' }}>취소</button>
              <button onClick={exportManageExcel} style={{ flex:2, padding:'11px 0', borderRadius:10, background:'linear-gradient(135deg,#00B894,#6C5CE7)', border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>📥 내보내기</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:16 }}>
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E8ECF0', padding:'12px 8px', textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:800, color:'#6C5CE7' }}>{storeItems.length}</div>
          <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>전체 지점</div>
        </div>
        <div style={{ background: totalPending > 0 ? 'rgba(232,67,147,0.05)' : '#fff', borderRadius:14, border:`1.5px solid ${totalPending > 0 ? 'rgba(232,67,147,0.3)' : '#E8ECF0'}`, padding:'12px 8px', textAlign:'center', cursor:'pointer' }} onClick={() => setSection('requests')}>
          <div style={{ fontSize:22, fontWeight:800, color: totalPending > 0 ? '#E84393' : '#bbb' }}>{totalPending}</div>
          <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>승인 대기</div>
        </div>
        <div style={{ background:'#fff', borderRadius:14, border:'1px solid #E8ECF0', padding:'12px 8px', textAlign:'center' }}>
          <div style={{ fontSize:22, fontWeight:800, color:'#FF6B35' }}>{totalStaff}</div>
          <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>전체 직원</div>
        </div>
      </div>
      <div style={{ marginBottom:12, padding:'10px 14px', background:'rgba(255,200,0,0.06)', borderRadius:12, border:'1px solid rgba(255,200,0,0.25)', display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:13 }}>💾</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#CC9900' }}>전체 데이터 백업</div>
          <div style={{ fontSize:10, color:'#aaa' }}>전 지점 스케줄을 CSV로 저장 — 매달 1일에 한 번 눌러두세요</div>
        </div>
        <button onClick={handleFullBackup} disabled={backingUp} style={{ padding:'7px 16px', borderRadius:9, background: backingUp ? '#F4F6F9' : 'linear-gradient(135deg,#FFD700,#FF6B35)', border:'none', color: backingUp ? '#aaa' : '#fff', fontSize:12, fontWeight:700, cursor: backingUp ? 'not-allowed' : 'pointer', flexShrink:0 }}>
          {backingUp ? '⏳ 백업 중...' : '📥 백업 다운로드'}
        </button>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
        <div style={{ display:'flex', background:'#F4F6F9', borderRadius:12, padding:4, gap:2, flex:1 }}>
          <button style={secBtn(section==='today')} onClick={() => setSection('today')}>👥 오늘/내일</button>
          <button style={secBtn(section==='grid')} onClick={() => setSection('grid')}>📊 월간그리드</button>
          <button style={secBtn(section==='summary')} onClick={() => setSection('summary')}>📈 근무요약</button>
          <button style={{ ...secBtn(section==='requests'), position:'relative' }} onClick={() => setSection('requests')}>
            📋 요청
            {totalPending > 0 && <span style={{ position:'absolute', top:2, right:2, background:'#E84393', color:'#fff', borderRadius:6, padding:'0 4px', fontSize:8, fontWeight:700 }}>{totalPending}</span>}
          </button>
          <button style={secBtn(section==='logs')} onClick={() => { setSection('logs'); loadLogs() }}>🕐 이력</button>
        </div>
        <button onClick={() => setShowExportModal(true)} disabled={exporting} style={{ padding:'7px 14px', borderRadius:10, background: exporting ? '#F4F6F9' : 'rgba(0,184,148,0.1)', border:'1px solid rgba(0,184,148,0.3)', color: exporting ? '#aaa' : '#00B894', fontSize:12, fontWeight:700, cursor: exporting ? 'not-allowed' : 'pointer', flexShrink:0, whiteSpace:'nowrap' as const }}>{exporting ? '⏳ 내보내는 중...' : '📥 엑셀'}</button>
      </div>

      {section === 'today' && (
        <div>
          {(['오늘', '내일'] as const).map((label, li) => {
            const dateStr = li === 0 ? today : tomorrow; const dow = DOW_LABEL[new Date(dateStr).getDay()]; const parts = dateStr.split('-')
            return (
              <div key={label} style={{ marginBottom:20 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                  <span style={{ fontSize:14, fontWeight:700, color:'#1a1a2e' }}>{label === '오늘' ? '🌞' : '🌙'} {label}</span>
                  <span style={{ fontSize:12, color:'#888' }}>{parts[1]}월 {parts[2]}일 ({dow})</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {storeItems.map((member: any) => {
                    const sid = member.stores?.id; const storeName = member.stores?.name || ''; const d = storeData[sid]; if (!d) return null
                    const workers = d.schedules.filter(s => s.schedule_date === dateStr && (s.status === 'work' || s.status === 'half' || s.status === 'early'))
                    const offWorkers = d.schedules.filter(s => s.schedule_date === dateStr && s.status === 'off')
                    const absentWorkers = d.schedules.filter(s => s.schedule_date === dateStr && s.status === 'absent')
                    return (
                      <div key={sid} style={{ background:'#fff', borderRadius:14, border:'1px solid #E8ECF0', padding:'12px 14px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                          <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#FF6B35,#E84393)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#fff', flexShrink:0 }}>{storeName.charAt(0)}</div>
                          <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{storeName}</span>
                          <span style={{ marginLeft:'auto', fontSize:11, fontWeight:700, color: workers.length > 0 ? '#6C5CE7' : '#bbb' }}>{workers.length > 0 ? `${workers.length}명 출근` : '스케줄 없음'}</span>
                        </div>
                        {workers.length > 0 ? (
                          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                            {workers.map((s: any) => (
                              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:20, background:STATUS_BG[s.status], border:`1px solid ${STATUS_COLOR[s.status]}40` }}>
                                <span style={{ fontSize:12, fontWeight:700, color:'#1a1a2e' }}>{s.staff_name}</span>
                                {s.status !== 'work' && <span style={{ fontSize:9, color:STATUS_COLOR[s.status], fontWeight:700 }}>{STATUS_LABEL[s.status]}</span>}
                                {s.position && <span style={{ fontSize:9, color:POS_COLOR[s.position], fontWeight:700 }}>{s.position}</span>}
                              </div>
                            ))}
                          </div>
                        ) : <div style={{ fontSize:12, color:'#bbb', padding:'4px 0' }}>등록된 출근자 없음</div>}
                        {(offWorkers.length > 0 || absentWorkers.length > 0) && (
                          <div style={{ display:'flex', gap:6, marginTop:8, paddingTop:8, borderTop:'1px solid #F4F6F9', flexWrap:'wrap' }}>
                            {offWorkers.map((s: any) => (<span key={s.id} style={{ fontSize:10, color:STATUS_COLOR.off, background:STATUS_BG.off, padding:'2px 8px', borderRadius:10 }}>{s.staff_name} 휴일</span>))}
                            {absentWorkers.map((s: any) => (<span key={s.id} style={{ fontSize:10, color:STATUS_COLOR.absent, background:STATUS_BG.absent, padding:'2px 8px', borderRadius:10, fontWeight:700 }}>{s.staff_name} 결근</span>))}
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

      {section === 'grid' && (
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <span style={{ fontSize:11, color:'#aaa' }}>지점명 눌러서 접기/펼치기</span>
            <YearMonthPicker year={year} month={month} onChange={(y,m) => { setYear(y); setMonth(m) }} color="#6C5CE7" />
          </div>
          {storeItems.map((member: any) => {
            const sid = member.stores?.id; const storeName = member.stores?.name || ''; const d = storeData[sid]; if (!d) return null
            const { schedules: scheds, staff, settings: sSettings, offRequests: sOffReqs } = d
            const isExpanded = gridExpanded[sid] !== false
            const schedMap: Record<string,any> = {}; scheds.forEach(s => { schedMap[`${s.staff_name}-${s.schedule_date}`] = s })
            const sOffReqMap: Record<string,any> = {}; (sOffReqs || []).forEach((r: any) => { sOffReqMap[`${r.staff_name}-${r.request_date}`] = r })
            const sIsPublished = sSettings?.is_published || false
            const sIsFuture = year > nowYear || (year === nowYear && month > nowMonth)
            const sMonthStr = `${year}-${String(month+1).padStart(2,'0')}`
            const sRequestOpen = isOffRequestOpen(sSettings, year, month)
            return (
              <div key={sid} style={{ marginBottom:18, background:'#fff', borderRadius:14, border:'1px solid #E8ECF0', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                <div onClick={() => setGridExpanded(prev => ({ ...prev, [sid]: !isExpanded }))} style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', cursor:'pointer', background:'#F8F9FB', borderBottom: isExpanded ? '1px solid #E8ECF0' : 'none' }}>
                  <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#FF6B35,#E84393)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'#fff', flexShrink:0 }}>{storeName.charAt(0)}</div>
                  <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', flex:1 }}>{storeName}</span>
                  {sIsFuture && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:6, background: sIsPublished?'rgba(0,184,148,0.12)':'rgba(108,92,231,0.1)', color: sIsPublished?'#00B894':'#6C5CE7', fontWeight:700 }}>{sIsPublished ? '👁 공개' : '🔒 비공개'}</span>}
                  {sIsFuture && sRequestOpen && <span style={{ fontSize:10, padding:'2px 8px', borderRadius:6, background:'rgba(255,200,0,0.12)', color:'#CC9900', fontWeight:700 }}>🙏 요청중</span>}
                  <span style={{ fontSize:11, color:'#bbb' }}>직원 {staff.length}명</span>
                  <span style={{ fontSize:11, color:'#ccc', marginLeft:4 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
                {isExpanded && (
                  <div>
                    {sIsFuture && (
                      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', background: sIsPublished?'rgba(0,184,148,0.06)':'rgba(108,92,231,0.05)', borderBottom:'1px solid #ECEEF2' }}>
                        <span style={{ fontSize:12 }}>{sIsPublished ? '👁' : '🔒'}</span>
                        <span style={{ fontSize:11, fontWeight:700, color: sIsPublished?'#00B894':'#6C5CE7', flex:1 }}>{sIsPublished ? '직원에게 공개됨' : '직원에게 비공개'}</span>
                        <button onClick={async (e) => {
                          e.stopPropagation(); const newVal = !sIsPublished
                          await supabase.from('schedule_settings').upsert({ store_id: sid, is_published: newVal, published_month: sMonthStr, updated_at: new Date().toISOString() }, { onConflict: 'store_id' }); loadAll()
                        }} style={{ padding:'4px 12px', borderRadius:7, border:'none', cursor:'pointer', fontSize:11, fontWeight:700, background: sIsPublished?'rgba(232,67,147,0.1)':'rgba(0,184,148,0.15)', color: sIsPublished?'#E84393':'#00B894' }}>
                          {sIsPublished ? '🔒 비공개로' : '👁 공개하기'}
                        </button>
                      </div>
                    )}
                    {sIsFuture && <ManageOffRequestBar sid={sid} settings={sSettings} isOpen={sRequestOpen} year={year} month={month} supabase={supabase} onRefresh={loadAll} />}
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ borderCollapse:'collapse', fontSize:10, minWidth: staff.length * 36 + 70, width:'100%', tableLayout:'fixed', userSelect:'none' }}>
                        <colgroup>
                          <col style={{ width:34 }} />
                          {staff.map((_,i) => <col key={i} style={{ width: Math.max(36, Math.floor((500 - 60) / Math.max(staff.length, 1))) }} />)}
                        </colgroup>
                        <thead>
                          <tr style={{ background:'#F8F9FB' }}>
                            <th style={{ padding:'3px 2px', borderBottom:'1px solid #E8ECF0', borderRight:'2px solid #E8ECF0', color:'#aaa', fontWeight:700, fontSize:8, textAlign:'center', position:'sticky', left:0, background:'#F8F9FB', zIndex:2 }}>날</th>
                            {staff.map(name => {
                              const pendingCnt = sIsFuture && sRequestOpen ? (sOffReqs||[]).filter((r:any) => r.staff_name===name && r.status==='pending').length : 0
                              const approvedCnt = sIsFuture ? (sOffReqs||[]).filter((r:any) => r.staff_name===name && r.status==='approved').length : 0
                              const isCopied = manageCopied?.sid === sid && manageCopied?.staff === name
                              const canPaste = manageCopied && !(manageCopied.sid === sid && manageCopied.staff === name)
                              return (
                                <th key={name} style={{ padding:'5px 2px', borderBottom:'1px solid #E8ECF0', borderRight:'1px solid #ECEEF2', color:'#1a1a2e', fontWeight:700, textAlign:'center', fontSize:10 }}>
                                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                                    <span>{name.length > 3 ? name.slice(0,3) + '.' : name}</span>
                                    <div style={{ display:'flex', gap:2, flexWrap:'wrap', justifyContent:'center' }}>
                                      {pendingCnt > 0 && <span style={{ fontSize:8, background:'rgba(255,200,0,0.2)', color:'#CC9900', borderRadius:4, padding:'0 4px', fontWeight:700 }}>🙏{pendingCnt}</span>}
                                      {approvedCnt > 0 && <span style={{ fontSize:8, background:STATUS_BG['off'], color:STATUS_COLOR['off'], borderRadius:4, padding:'0 4px', fontWeight:700 }}>휴{approvedCnt}</span>}
                                    </div>
                                    {isCopied ? (
                                      <button onClick={e => { e.stopPropagation(); setManageCopied(null) }} style={{ fontSize:8, background:'rgba(108,92,231,0.12)', border:'1px solid #6C5CE7', color:'#6C5CE7', borderRadius:4, padding:'1px 5px', cursor:'pointer', fontWeight:700 }}>취소</button>
                                    ) : canPaste ? (
                                      <button onClick={e => { e.stopPropagation(); handleManagePaste(sid, name) }} style={{ fontSize:8, background:'rgba(232,67,147,0.1)', border:'1px solid #E84393', color:'#E84393', borderRadius:4, padding:'1px 5px', cursor:'pointer', fontWeight:700 }}>붙여넣기</button>
                                    ) : (
                                      <button onClick={e => { e.stopPropagation(); setManageCopied({ sid, staff: name }) }} style={{ fontSize:8, background:'#F4F6F9', border:'1px solid #E0E4E8', color:'#aaa', borderRadius:4, padding:'1px 5px', cursor:'pointer' }}>복사</button>
                                    )}
                                  </div>
                                </th>
                              )
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {allDays.map(day => {
                            const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`; const dow = new Date(dateStr).getDay(); const isToday = dateStr === today; const isSun = dow === 0; const isSat = dow === 6
                            const sBlockedDates = getBlockedDates(year, month+1, sSettings?.blocked_dates || []); const isDayBlocked = sIsFuture && sBlockedDates.has(dateStr)
                            return (
                              <tr key={day} style={{ background: isDayBlocked ? 'rgba(200,200,200,0.08)' : isToday ? 'rgba(108,92,231,0.05)' : isSun ? 'rgba(232,67,147,0.02)' : '#fff', borderTop: dow===1&&day!==1 ? '2px solid #D0D4E8' : undefined }}>
                                <td style={{ padding:'1px 2px', borderBottom:'1px solid #F4F6F9', borderRight:'2px solid #E8ECF0', height:24, position:'sticky', left:0, background: isToday ? 'rgba(108,92,231,0.07)' : isSun ? 'rgba(232,67,147,0.05)' : isSat ? 'rgba(108,92,231,0.03)' : '#FAFBFC', zIndex:1 }}>
                                  <div style={{ display:'flex', flexDirection:'row', alignItems:'center', justifyContent:'center', gap:2 }}>
                                    <span style={{ fontSize:9, fontWeight:isToday?700:400, color:isToday?'#6C5CE7':isSun?'#E84393':isSat?'#6C5CE7':'#555', lineHeight:1 }}>{day}</span>
                                    <span style={{ fontSize:7, color:isSun?'#E84393':isSat?'#6C5CE7':'#ccc', lineHeight:1 }}>{DOW_LABEL[dow]}</span>
                                  </div>
                                </td>
                                {staff.map(name => {
                                  const sc = schedMap[`${name}-${dateStr}`]; const offR = sOffReqMap[`${name}-${dateStr}`]
                                  const inDrag = manageDragSel?.sid === sid && manageDragSel?.staff === name && day >= Math.min(manageDragSel.startDay, manageDragSel.endDay) && day <= Math.max(manageDragSel.startDay, manageDragSel.endDay)
                                  const takenByOtherM = sIsFuture && sRequestOpen && !offR ? (sOffReqs||[]).find((r:any) => r.request_date===dateStr && r.staff_name!==name && (r.status==='pending'||r.status==='approved')) : null
                                  let cellBg = inDrag ? 'rgba(108,92,231,0.22)' : sc ? (sc.is_confirmed ? 'rgba(232,67,147,0.13)' : STATUS_BG[sc.status]) : offR?.status==='approved' ? 'rgba(232,67,147,0.22)' : offR?.status==='pending' ? 'rgba(255,200,0,0.15)' : isDayBlocked ? 'rgba(200,200,200,0.15)' : takenByOtherM ? 'rgba(220,220,220,0.2)' : undefined
                                  return (
                                    <td key={name}
                                      onMouseDown={() => { manageMouseDown.current = true; const drag = { sid, staff: name, startDay: day, endDay: day }; manageDragRef.current = drag; setManageDragSel(drag) }}
                                      onMouseEnter={() => { if (manageMouseDown.current && manageDragRef.current?.sid === sid && manageDragRef.current?.staff === name) { const updated = { ...manageDragRef.current, endDay: day }; manageDragRef.current = updated; setManageDragSel({ ...updated }) } }}
                                      title={offR ? `${name}: ${offR.reason}` : isDayBlocked ? '요청 불가일' : undefined}
                                      style={{ borderBottom:'1px solid #F4F6F9', borderRight:'1px solid #ECEEF2', height:24, textAlign:'center', verticalAlign:'middle', background: cellBg, padding:0, cursor:'crosshair', outline: inDrag ? '2px solid #6C5CE7' : 'none', outlineOffset:'-2px', transition:'background 0.04s' }}>
                                      {(() => {
                                        if (inDrag) return <span style={{ fontSize:10, color:'#6C5CE7', fontWeight:700 }}>✓</span>
                                        if (sc) return (
                                          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0, width:'100%', height:'100%', position:'relative' }}>
                                            {sc.is_confirmed && <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'#E84393' }} />}
                                            <span style={{ fontSize:8, fontWeight:700, color: sc.is_confirmed ? '#E84393' : STATUS_COLOR[sc.status], lineHeight:1.3, marginTop: sc.is_confirmed ? 2 : 0 }}>{sc.is_confirmed ? '🔒' : STATUS_LABEL[sc.status]}</span>
                                            {sc.is_confirmed && <span style={{ fontSize:6, color:'#E84393', fontWeight:700 }}>{STATUS_LABEL[sc.status]}</span>}
                                            {!sc.is_confirmed && sc.position && <span style={{ fontSize:7, color:POS_COLOR[sc.position], fontWeight:700 }}>{sc.position}</span>}
                                            {sc.note && !sc.is_confirmed && <span title={sc.note} style={{ fontSize:6, color:'#FF6B35', maxWidth:32, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sc.note.replace(/^\[조퇴:\d{2}:\d{2}\]\s*/,'')}</span>}
                                            {offR?.status==='pending' && <span style={{ fontSize:8 }}>🙏</span>}
                                            {offR?.status==='approved' && <span style={{ fontSize:8 }}>✅</span>}
                                          </div>
                                        )
                                        if (offR?.status==='approved') return (<div style={{ display:'flex', flexDirection:'column', width:'100%', height:'100%' }}><div style={{ height:2, background:'#E84393', width:'100%' }} /><div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, gap:0 }}><span style={{ fontSize:9 }}>🔒</span><span style={{ fontSize:7, fontWeight:700, color:'#E84393' }}>확정</span></div></div>)
                                        if (offR?.status==='pending') return (<div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0 }}><span style={{ fontSize:10 }}>🙏</span><span style={{ fontSize:7, color:'#CC9900', maxWidth:32, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={offR.reason}>{offR.reason}</span></div>)
                                        if (offR?.status==='rejected') return <span style={{ fontSize:9, color:'#E84393' }}>❌</span>
                                        if (isDayBlocked) return <span style={{ fontSize:9, color:'#ccc' }}>🚫</span>
                                        if (takenByOtherM) return null
                                        return <span style={{ fontSize:12, color:'#e8e8e8' }}>+</span>
                                      })()}
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {section === 'summary' && (
        <div>
          {storeItems.map((member: any) => {
            const sid = member.stores?.id; const storeName = member.stores?.name || ''; const d = storeData[sid]; if (!d) return null
            const { schedules: scheds, staff } = d
            const summary = staff.map(name => {
              const ss = scheds.filter(s => s.staff_name === name)
              return { name, work: ss.filter(s => s.status === 'work').length, off: ss.filter(s => s.status === 'off').length, half: ss.filter(s => s.status === 'half').length, absent: ss.filter(s => s.status === 'absent').length, early: ss.filter(s => s.status === 'early').length, etc: ss.filter(s => s.status === 'etc').length }
            })
            return (
              <div key={sid} style={{ marginBottom:16, background:'#fff', borderRadius:14, border:'1px solid #E8ECF0', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, padding:'11px 14px', background:'#F8F9FB', borderBottom:'1px solid #E8ECF0' }}>
                  <div style={{ width:26, height:26, borderRadius:7, background:'linear-gradient(135deg,#FF6B35,#E84393)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'#fff', flexShrink:0 }}>{storeName.charAt(0)}</div>
                  <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{storeName}</span>
                  <span style={{ marginLeft:'auto', fontSize:11, color:'#aaa' }}>{year}년 {month+1}월</span>
                </div>
                {summary.length === 0 ? <div style={{ padding:'16px', textAlign:'center', color:'#bbb', fontSize:12 }}>직원 없음</div> : (
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                    <thead>
                      <tr style={{ background:'#FAFBFC' }}>
                        <th style={{ padding:'7px 12px', textAlign:'left', color:'#888', fontWeight:700, borderBottom:'1px solid #F0F2F5', fontSize:10 }}>직원</th>
                        {(['work','off','half','absent','early','etc'] as const).map(s => (<th key={s} style={{ padding:'7px 6px', textAlign:'center', color:STATUS_COLOR[s], fontWeight:700, borderBottom:'1px solid #F0F2F5', fontSize:9 }}>{STATUS_LABEL[s]}</th>))}
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
                          <td style={{ padding:'8px 6px', textAlign:'center', color: s.etc > 0 ? STATUS_COLOR.etc : '#ddd' }}>{s.etc || '-'}</td>
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

      {section === 'requests' && (
        <div>
          {(totalPending + totalOffPending) === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:'#bbb' }}><div style={{ fontSize:28, marginBottom:8 }}>✅</div><div style={{ fontSize:13 }}>모든 지점 승인 대기 없음</div></div>
          ) : storeItems.map((member: any) => {
            const sid = member.stores?.id; const storeName = member.stores?.name || ''; const d = storeData[sid]; if (!d) return null
            const pendingOffReqs = (d.offRequests || []).filter((r: any) => r.status === 'pending')
            if (d.requests.length === 0 && pendingOffReqs.length === 0) return null
            return (
              <div key={sid} style={{ marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <div style={{ width:24, height:24, borderRadius:6, background:'linear-gradient(135deg,#FF6B35,#E84393)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#fff', flexShrink:0 }}>{storeName.charAt(0)}</div>
                  <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{storeName}</span>
                  {d.requests.length > 0 && <span style={{ background:'rgba(232,67,147,0.1)', color:'#E84393', borderRadius:8, padding:'1px 8px', fontSize:11, fontWeight:700 }}>📋 {d.requests.length}건</span>}
                  {pendingOffReqs.length > 0 && <span style={{ background:'rgba(255,200,0,0.12)', color:'#CC9900', borderRadius:8, padding:'1px 8px', fontSize:11, fontWeight:700 }}>🙏 {pendingOffReqs.length}건</span>}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {d.requests.map((req: any) => (
                    <div key={req.id} style={{ background:'#fff', border:'1px solid rgba(232,67,147,0.18)', borderRadius:12, padding:'12px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                        <span style={{ fontSize:9, background:'rgba(232,67,147,0.1)', color:'#E84393', borderRadius:5, padding:'1px 6px', fontWeight:700 }}>📋 변경요청</span>
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
                        <button onClick={() => handleApprove(sid, req)} disabled={approvingId === req.id} style={{ flex:2, padding:'8px 0', borderRadius:9, background:'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:12, cursor:'pointer', fontWeight:700, opacity: approvingId === req.id ? 0.7 : 1 }}>{approvingId === req.id ? '처리 중...' : '✓ 승인'}</button>
                      </div>
                    </div>
                  ))}
                  {pendingOffReqs.map((req: any) => (
                    <div key={req.id} style={{ background:'#fff', border:'1px solid rgba(255,200,0,0.3)', borderRadius:12, padding:'12px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                        <span style={{ fontSize:9, background:'rgba(255,200,0,0.12)', color:'#CC9900', borderRadius:5, padding:'1px 6px', fontWeight:700 }}>🙏 휴무요청</span>
                        <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{req.staff_name}</span>
                        <span style={{ fontSize:11, color:'#bbb' }}>{req.request_date}</span>
                      </div>
                      <div style={{ fontSize:11, color:'#888', marginBottom:8, padding:'5px 9px', background:'#F8F9FB', borderRadius:7 }}>사유: {req.reason}</div>
                      <div style={{ fontSize:10, color:'#bbb', marginBottom:8 }}>{new Date(req.created_at).toLocaleDateString('ko')}</div>
                      <div style={{ display:'flex', gap:8 }}>
                        <button onClick={async () => { await supabase.from('off_requests').update({ status: 'rejected' }).eq('id', req.id); loadAll() }} style={{ flex:1, padding:'8px 0', borderRadius:9, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#aaa', fontSize:12, cursor:'pointer', fontWeight:600 }}>거부</button>
                        <button onClick={async () => { await supabase.from('off_requests').update({ status: 'approved' }).eq('id', req.id); loadAll() }} style={{ flex:2, padding:'8px 0', borderRadius:9, background:'linear-gradient(135deg,#00B894,#6C5CE7)', border:'none', color:'#fff', fontSize:12, cursor:'pointer', fontWeight:700 }}>✓ 승인</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {section === 'logs' && (
        <div>
          {logsLoading ? <div style={{ textAlign:'center', padding:40, color:'#aaa', fontSize:13 }}>⏳ 불러오는 중...</div>
          : logs.length === 0 ? <div style={{ textAlign:'center', padding:40, color:'#bbb' }}><div style={{ fontSize:24, marginBottom:8 }}>📋</div><div style={{ fontSize:13 }}>수정 이력이 없습니다</div></div>
          : (
            <div>
              <div style={{ fontSize:11, color:'#aaa', marginBottom:12 }}>최근 200건 · 전 지점</div>
              {logs.map((log: any) => {
                const storeName = storeItems.find((m: any) => m.stores?.id === log.store_id)?.stores?.name || ''
                const dt = new Date(log.created_at); const dateLabel = `${dt.getMonth()+1}/${dt.getDate()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`
                const isBulk = log.action.startsWith('bulk'); const isDel = log.action.includes('delete')
                return (
                  <div key={log.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#fff', borderRadius:12, border:'1px solid #F0F2F5', marginBottom:6 }}>
                    <div style={{ width:34, height:34, borderRadius:10, background: isDel ? 'rgba(232,67,147,0.1)' : 'rgba(108,92,231,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>{isDel ? '🗑' : '✏️'}</div>
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

      {manageBulkTarget && <BulkPopup staffName={manageBulkTarget.staff} dates={manageBulkTarget.dates} onApply={handleManageBulkApply} onClose={() => setManageBulkTarget(null)} />}

      {/* ✅ 핵심 수정: 전지점 관리탭 그리드 편집 팝업 - 휴무요청 승인/거부 추가 */}
      {editPopup && (() => {
        const editOffReq = (storeData[editPopup.sid]?.offRequests || []).find(
          (r: any) => r.staff_name === editPopup.staff && r.request_date === editPopup.date
        ) || undefined
        return (
          <CellPopup
            staffName={editPopup.staff}
            dateStr={editPopup.date}
            current={editPopup.current}
            role="owner"
            myName={myName}
            onSave={async (status, position, note, confirmedVal) => {
              await supabase.from('schedules').upsert(
                { store_id: editPopup.sid, staff_name: editPopup.staff, schedule_date: editPopup.date, status, position: position||null, note: note||null, is_confirmed: confirmedVal ?? editPopup.current?.is_confirmed ?? false },
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
            offRequest={editOffReq}
            onOffRequestApprove={async () => {
              if (!editOffReq) return
              await supabase.from('off_requests').update({ status: 'approved' }).eq('id', editOffReq.id)
              setEditPopup(null); loadAll()
            }}
            onOffRequestReject={async () => {
              if (!editOffReq) return
              await supabase.from('off_requests').update({ status: 'rejected' }).eq('id', editOffReq.id)
              setEditPopup(null); loadAll()
            }}
            onOffRequestCancel={async () => {
              if (!editOffReq) return
              await supabase.from('off_requests').delete().eq('id', editOffReq.id)
              setEditPopup(null); loadAll()
            }}
          />
        )
      })()}
    </div>
  )
}

function PCGridEditor({ year, month, schedules, staffList, role, storeId, myName, onSaved, onReorderStaff, onChangeMonth, pendingCount, scheduleSettings, offRequests, nowYear, nowMonth, onOffRequestsChange, onSettingsChange }: {
  year: number; month: number; schedules: any[]
  staffList: string[]; role: string; storeId: string; myName: string
  onSaved: () => void; onReorderStaff: (newOrder: string[]) => void
  onChangeMonth: (y: number, m: number) => void; pendingCount: number
  scheduleSettings: any; offRequests: any[]; nowYear: number; nowMonth: number
  onOffRequestsChange: () => void; onSettingsChange: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [popup, setPopup] = useState<{ staff: string; date: string } | null>(null)
  const [showRequests, setShowRequests] = useState(false)
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [dragOrder, setDragOrder] = useState<string[]>([])
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [dragSel, setDragSel] = useState<{ staff: string; startDay: number; endDay: number } | null>(null)
  const dragSelRef = useRef<typeof dragSel>(null)
  const isMouseDown = useRef(false)
  const [bulkTarget, setBulkTarget] = useState<{ staff: string; dates: string[] } | null>(null)
  const [copiedStaff, setCopiedStaff] = useState<string | null>(null)
  const today = toDateStr(new Date())
  const daysInMonth = getDaysInMonth(year, month)
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth])
  const holidays = useMemo(() => getHolidays(year), [year])
  const isOwner = role === 'owner'; const isManager = role === 'manager'; const isStaff = role === 'staff'
  const isPublished = scheduleSettings?.is_published || false
  const visible = isScheduleVisible(year, month, nowYear, nowMonth, isPublished, role)
  const isFuture = year > nowYear || (year === nowYear && month > nowMonth)
  const requestOpen = isOffRequestOpen(scheduleSettings, year, month)
  const blockedDates = useMemo(() => getBlockedDates(year, month+1, scheduleSettings?.blocked_dates || []), [year, month, scheduleSettings])
  const offRequestMap = useMemo(() => { const m: Record<string, any> = {}; offRequests.forEach(r => { m[`${r.staff_name}-${r.request_date}`] = r }); return m }, [offRequests])
  const visibleStaff = (isStaff && !(isFuture && requestOpen)) ? staffList.filter(n => n === myName) : staffList

  useEffect(() => {
    function onWindowMouseUp() {
      if (!isMouseDown.current) return; isMouseDown.current = false
      const ds = dragSelRef.current; if (!ds) return
      const min = Math.min(ds.startDay, ds.endDay); const max = Math.max(ds.startDay, ds.endDay)
      dragSelRef.current = null; setDragSel(null)
      if (min === max) { setPopup({ staff: ds.staff, date: `${monthStr}-${String(min).padStart(2,'0')}` }) }
      else { const dates: string[] = []; for (let d = min; d <= max; d++) dates.push(`${monthStr}-${String(d).padStart(2,'0')}`); setBulkTarget({ staff: ds.staff, dates }) }
    }
    window.addEventListener('mouseup', onWindowMouseUp); return () => window.removeEventListener('mouseup', onWindowMouseUp)
  }, [monthStr])

  function handleCellMouseDown(staff: string, day: number, e: React.MouseEvent) {
    if (!isOwner) return; e.preventDefault(); isMouseDown.current = true
    const next = { staff, startDay: day, endDay: day }; dragSelRef.current = next; setDragSel(next)
  }
  function handleCellMouseEnter(staff: string, day: number) {
    if (!isMouseDown.current || !dragSelRef.current || dragSelRef.current.staff !== staff) return
    const next = { ...dragSelRef.current, endDay: day }; dragSelRef.current = next; setDragSel(next)
  }
  function isCellInDrag(staff: string, day: number) {
    if (!dragSel || dragSel.staff !== staff) return false
    const min = Math.min(dragSel.startDay, dragSel.endDay); const max = Math.max(dragSel.startDay, dragSel.endDay)
    return day >= min && day <= max
  }

  async function handleBulkApply(status: string, note: string) {
    if (!bulkTarget) return
    const { staff, dates } = bulkTarget
    if (status === '__delete__') {
      await supabase.from('schedules').delete().eq('store_id', storeId).eq('staff_name', staff).in('schedule_date', dates)
      await Promise.all(dates.map(async dateStr => { const prev = scheduleMap[`${staff}-${dateStr}`]; await syncAttendance(supabase, storeId, staff, dateStr, 'work'); await logScheduleEdit(supabase, storeId, myName, staff, dateStr, 'bulk_delete', prev?.status || null, null) }))
    } else {
      await supabase.from('schedules').upsert(dates.map(dateStr => ({ store_id: storeId, staff_name: staff, schedule_date: dateStr, status, position: null, note: note || null })), { onConflict: 'store_id,staff_name,schedule_date' })
      await Promise.all(dates.map(async dateStr => { const prev = scheduleMap[`${staff}-${dateStr}`]; await syncAttendance(supabase, storeId, staff, dateStr, status); await logScheduleEdit(supabase, storeId, myName, staff, dateStr, 'bulk_upsert', prev?.status || null, status) }))
    }
    setBulkTarget(null); onSaved()
  }

  async function handlePasteToStaff(targetStaff: string) {
    if (!copiedStaff || copiedStaff === targetStaff) return
    const src = schedules.filter(s => s.staff_name === copiedStaff)
    if (src.length === 0) { alert(`${copiedStaff}의 스케줄이 없습니다`); setCopiedStaff(null); return }
    const pad = (n: number) => String(n).padStart(2,'0')
    const startDate = `${monthStr}-01`; const endDate = `${monthStr}-${pad(daysInMonth)}`
    if (!confirm(`${copiedStaff}의 스케줄을 ${targetStaff}에 붙여넣을까요?\n${targetStaff}의 ${month+1}월 스케줄 전체가 교체됩니다.`)) return
    await supabase.from('schedules').delete()
      .eq('store_id', storeId).eq('staff_name', targetStaff)
      .gte('schedule_date', startDate).lte('schedule_date', endDate)
    if (src.length > 0) {
      await supabase.from('schedules').upsert(
        src.map(s => ({ store_id: storeId, staff_name: targetStaff, schedule_date: s.schedule_date, status: s.status, position: s.position, note: s.note })),
        { onConflict: 'store_id,staff_name,schedule_date' }
      )
    }
    setCopiedStaff(null); onSaved()
  }

  function openOrderModal() { setDragOrder([...visibleStaff]); setShowOrderModal(true) }

  async function exportToExcel() {
    const ExcelJS = (await import('exceljs')).default; const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet(`${year}년 ${month+1}월`)
    const pad = (n: number) => String(n).padStart(2,'0'); const DOW_KR = ['일','월','화','수','목','금','토']; const holidays = getHolidays(year)
    const CELL_COLOR: Record<string, string> = { work: 'FFE8E4FF', off: 'FFFCE4F0', half: 'FFFFEEE6', absent: 'FFFFF3E0', early: 'FFE0FAF4', etc: 'FFF3E0FF', confirmed: 'FFFFD6EC' }
    const TEXT_COLOR: Record<string, string> = { work: 'FF6C5CE7', off: 'FFE84393', half: 'FFFF6B35', absent: 'FFE67E22', early: 'FF00B894', etc: 'FF8E44AD', confirmed: 'FFE84393' }
    const headerRow = ws.addRow(['날짜', '요일', ...visibleStaff, '출근수'])
    headerRow.eachCell(cell => { cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF2C3E50' } }; cell.font = { bold:true, color:{ argb:'FFFFFFFF' }, size:11 }; cell.alignment = { horizontal:'center', vertical:'middle' }; cell.border = { bottom:{ style:'medium', color:{ argb:'FF1a1a2e' } } } })
    ws.getRow(1).height = 22; ws.getColumn(1).width = 14; ws.getColumn(2).width = 6
    visibleStaff.forEach((_, i) => { ws.getColumn(i + 3).width = 12 }); ws.getColumn(visibleStaff.length + 3).width = 8
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${monthStr}-${pad(d)}`; const dow = new Date(dateStr).getDay(); const isHoliday = !!holidays[dateStr]; const isSun = dow === 0; const isSat = dow === 6; const holiday = isHoliday ? ` ${holidays[dateStr]}` : ''
      const rowData: any[] = [`${month+1}/${d}${holiday}`, DOW_KR[dow]]; let workCnt = 0
      const cellInfos: { status: string; position?: string; note?: string; isConfirmed?: boolean; isOffApproved?: boolean; isOffPending?: boolean; reason?: string }[] = []
      visibleStaff.forEach(staff => {
        const sc = scheduleMap[`${staff}-${dateStr}`]; const offReq = offRequestMap[`${staff}-${dateStr}`]
        if (sc) { const label = STATUS_LABEL[sc.status] || sc.status; const pos = sc.position ? ` [${sc.position}]` : ''; const note = sc.note ? ` (${sc.note.replace(/^\[조퇴:\d{2}:\d{2}\]\s*/,'')})` : ''; const confirmed = sc.is_confirmed ? ' 🔒' : ''; rowData.push(`${label}${pos}${note}${confirmed}`); cellInfos.push({ status: sc.status, position: sc.position, note: sc.note, isConfirmed: sc.is_confirmed }); if (sc.status==='work'||sc.status==='half'||sc.status==='early') workCnt++
        } else if (offReq?.status === 'approved') { rowData.push(`🔒 휴일확정 (${offReq.reason})`); cellInfos.push({ status: 'off', isOffApproved: true, reason: offReq.reason })
        } else if (offReq?.status === 'pending') { rowData.push(`🙏 요청중 (${offReq.reason})`); cellInfos.push({ status: 'pending', reason: offReq.reason })
        } else { rowData.push(''); cellInfos.push({ status: '' }) }
      })
      rowData.push(workCnt || ''); const row = ws.addRow(rowData); row.height = 18
      const dateCell = row.getCell(1); const dowCell = row.getCell(2)
      const dateBg = isSun || isHoliday ? 'FFFCE4F0' : isSat ? 'FFF0EEFF' : 'FFF8F9FB'; const dateColor = isSun || isHoliday ? 'FFE84393' : isSat ? 'FF6C5CE7' : 'FF555555'
      dateCell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:dateBg } }; dateCell.font = { color:{ argb:dateColor }, size:10 }; dateCell.alignment = { horizontal:'left', vertical:'middle' }
      dowCell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:dateBg } }; dowCell.font = { color:{ argb:dateColor }, bold:true, size:10 }; dowCell.alignment = { horizontal:'center', vertical:'middle' }
      cellInfos.forEach((info, i) => {
        const cell = row.getCell(i + 3); cell.alignment = { horizontal:'center', vertical:'middle' }; if (!info.status) return
        const bgColor = info.isConfirmed ? CELL_COLOR.confirmed : info.isOffApproved ? CELL_COLOR.off : info.status === 'pending' ? 'FFFFF9E0' : CELL_COLOR[info.status] || 'FFFFFFFF'
        const textColor = info.isConfirmed ? TEXT_COLOR.confirmed : info.isOffApproved ? TEXT_COLOR.off : info.status === 'pending' ? 'FFCC9900' : TEXT_COLOR[info.status] || 'FF333333'
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:bgColor } }; cell.font = { color:{ argb:textColor }, bold: !!info.status, size:10 }
      })
      const cntCell = row.getCell(visibleStaff.length + 3); cntCell.font = { bold:true, color:{ argb: workCnt < 3 ? 'FFE84393' : 'FF6C5CE7' }, size:10 }; cntCell.alignment = { horizontal:'center', vertical:'middle' }
      if (dow === 1 && d !== 1) { row.eachCell(cell => { cell.border = { top:{ style:'medium', color:{ argb:'FFD0D4E8' } } } }) }
    }
    ws.eachRow(row => { row.eachCell(cell => { if (!cell.border?.top?.style) { cell.border = { ...cell.border, top:{ style:'thin', color:{ argb:'FFECEEF2' } }, bottom:{ style:'thin', color:{ argb:'FFECEEF2' } }, left:{ style:'thin', color:{ argb:'FFECEEF2' } }, right:{ style:'thin', color:{ argb:'FFECEEF2' } } } } }) })
    const buf = await wb.xlsx.writeBuffer(); const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `스케줄_${year}년${month+1}월.xlsx`; a.click(); URL.revokeObjectURL(url)
  }

  async function saveOrder() {
    setSaving(true)
    try {
      const { data: members } = await supabase.from('store_members').select('profile_id, profiles!inner(nm)').eq('store_id', storeId).eq('active', true)
      if (members) { for (let i = 0; i < dragOrder.length; i++) { const nm = dragOrder[i]; const member = members.find((m: any) => m.profiles?.nm === nm); if (member) await supabase.from('store_members').update({ sort_order: i }).eq('store_id', storeId).eq('profile_id', member.profile_id) } }
      localStorage.setItem(`staff_order_${storeId}`, JSON.stringify(dragOrder))
    } catch (e) { localStorage.setItem(`staff_order_${storeId}`, JSON.stringify(dragOrder)) }
    setShowOrderModal(false); onReorderStaff(dragOrder); setSaving(false)
  }

  function handleDragStart(idx: number) { setDragIdx(idx) }
  function handleDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); if (dragIdx === null || dragIdx === idx) return; const next = [...dragOrder]; const [moved] = next.splice(dragIdx, 1); next.splice(idx, 0, moved); setDragOrder(next); setDragIdx(idx) }
  function handleDragEnd() { setDragIdx(null) }

  const scheduleMap = useMemo(() => { const m: Record<string, any> = {}; schedules.forEach(s => { m[`${s.staff_name}-${s.schedule_date}`] = s }); return m }, [schedules])
  const popupData = popup ? (scheduleMap[`${popup.staff}-${popup.date}`] || null) : null
  function canClick(staff: string, hasSchedule: boolean) { if (isOwner) return true; if (isManager) return hasSchedule; return false }

  async function handleSave(status: string, position: string, note: string, confirmed?: boolean) {
    if (!popup) return; const prev = scheduleMap[`${popup.staff}-${popup.date}`]
    if (isManager && prev?.is_confirmed) { alert('🔒 대표가 확정한 날은 수정할 수 없어요'); return }
    await supabase.from('schedules').upsert({ store_id: storeId, staff_name: popup.staff, schedule_date: popup.date, status, position: position || null, note: note || null, ...(isOwner ? { is_confirmed: confirmed ?? false } : {}) }, { onConflict: 'store_id,staff_name,schedule_date' })
    const earlyMatch = note?.match(/^\[조퇴:(\d{2}:\d{2})\]/); await syncAttendance(supabase, storeId, popup.staff, popup.date, status, earlyMatch?.[1])
    await logScheduleEdit(supabase, storeId, myName, popup.staff, popup.date, 'upsert', prev?.status || null, status); setPopup(null); onSaved()
  }
  async function handleRequest(status: string, note: string) {
    if (!popup) return; const current = scheduleMap[`${popup.staff}-${popup.date}`]
    if (isManager && current?.is_confirmed) { alert('🔒 대표가 확정한 날은 변경 요청할 수 없어요'); return }
    await supabase.from('schedule_requests').insert({ store_id: storeId, requester_nm: myName, staff_name: popup.staff, schedule_date: popup.date, requested_status: status, current_status: current?.status || null, note: note || null })
    setPopup(null); alert('변경 요청이 전송되었습니다!')
  }
  async function handleDelete() {
    if (!popup || !popupData) return
    if (isManager && popupData?.is_confirmed) { alert('🔒 대표가 확정한 날은 삭제할 수 없어요'); return }
    const prev = scheduleMap[`${popup.staff}-${popup.date}`]
    await supabase.from('schedules').delete().eq('id', popupData.id)
    await syncAttendance(supabase, storeId, popup.staff, popup.date, 'work')
    await logScheduleEdit(supabase, storeId, myName, popup.staff, popup.date, 'delete', prev?.status || null, null); setPopup(null); onSaved()
  }

  const staffTotals = useMemo(() => {
    const t: Record<string, { work:number; off:number; half:number; absent:number; early:number; etc:number; K:number; H:number; KH:number }> = {}
    visibleStaff.forEach(s => { t[s] = { work:0, off:0, half:0, absent:0, early:0, etc:0, K:0, H:0, KH:0 } })
    schedules.forEach(s => {
      if (!t[s.staff_name]) return; const st = s.status as string
      if (st === 'work') t[s.staff_name].work++; else if (st === 'off') t[s.staff_name].off++; else if (st === 'half') t[s.staff_name].half++; else if (st === 'absent') t[s.staff_name].absent++; else if (st === 'early') t[s.staff_name].early++; else if (st === 'etc') t[s.staff_name].etc++
      if (s.position === 'K') t[s.staff_name].K++; else if (s.position === 'H') t[s.staff_name].H++; else if (s.position === 'KH') t[s.staff_name].KH++
    }); return t
  }, [schedules, visibleStaff])

  return (
    <>
      {popup && (() => {
        const offReq = offRequestMap[`${popup.staff}-${popup.date}`]
        const isBlocked2 = isFuture && blockedDates.has(popup.date)
        const takenByOther2 = isFuture && requestOpen && !isOwner && popup.staff === myName && !offReq ? offRequests.find((r: any) => r.request_date === popup.date && r.staff_name !== myName && (r.status === 'pending' || r.status === 'approved')) || null : null
        const canReqOff = isFuture && requestOpen && !isOwner && popup.staff === myName && !isBlocked2 && !offReq && !takenByOther2
        return <CellPopup staffName={popup.staff} dateStr={popup.date} current={popupData} role={role} myName={myName} onSave={handleSave} onRequest={handleRequest} onDelete={handleDelete} onClose={() => setPopup(null)} offRequest={offReq} canRequestOff={canReqOff} isBlocked={isBlocked2}
          onOffRequest={async (reason) => { const pad = (n: number) => String(n).padStart(2,'0'); const targetMonth = `${year}-${pad(month+1)}`; await supabase.from('off_requests').insert({ store_id: storeId, staff_name: popup.staff, target_month: targetMonth, request_date: popup.date, reason, status: 'pending' }); onOffRequestsChange() }}
          onOffRequestCancel={async () => { if (offReq) { await supabase.from('off_requests').delete().eq('id', offReq.id); onOffRequestsChange() } }}
          onOffRequestApprove={async () => { if (offReq) { await supabase.from('off_requests').update({ status: 'approved' }).eq('id', offReq.id); onOffRequestsChange() } }}
          onOffRequestReject={async () => { if (offReq) { await supabase.from('off_requests').update({ status: 'rejected' }).eq('id', offReq.id); onOffRequestsChange() } }}
        />
      })()}
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
                <div key={name} draggable onDragStart={() => handleDragStart(idx)} onDragOver={e => handleDragOver(e, idx)} onDragEnd={handleDragEnd} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10, background: dragIdx===idx ? 'rgba(108,92,231,0.08)' : '#F8F9FB', border: dragIdx===idx ? '1px solid rgba(108,92,231,0.3)' : '1px solid #E8ECF0', cursor:'grab', userSelect:'none', transition:'background 0.1s' }}>
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
          {(isOwner || isManager) && <button onClick={exportToExcel} style={{ padding:'6px 12px', borderRadius:9, background:'rgba(0,184,148,0.1)', border:'1px solid rgba(0,184,148,0.3)', color:'#00B894', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>📥 엑셀</button>}
          {isOwner && <button onClick={() => setShowRequests(true)} style={{ padding:'6px 12px', borderRadius:9, background: pendingCount>0?'rgba(232,67,147,0.1)':'#F4F6F9', border: pendingCount>0?'1px solid rgba(232,67,147,0.3)':'1px solid #E8ECF0', color: pendingCount>0?'#E84393':'#aaa', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>📋 요청{pendingCount > 0 && <span style={{ background:'#E84393', color:'#fff', borderRadius:10, padding:'1px 6px', fontSize:10, marginLeft:4 }}>{pendingCount}</span>}</button>}
        </div>
      </div>
      {isOwner && <div style={{ fontSize:10, color:'#bbb', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}><span>💡 셀을 마우스로 드래그하면 여러 날 일괄 적용</span><span style={{ color:'#d0d0d0' }}>·</span><span>직원 이름 아래 [복사] 버튼으로 스케줄 패턴 복사</span></div>}
      {isFuture && isOwner && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:12, background: isPublished ? 'rgba(0,184,148,0.08)' : 'rgba(108,92,231,0.06)', border: isPublished ? '1px solid rgba(0,184,148,0.25)' : '1px solid rgba(108,92,231,0.2)', marginBottom:10 }}>
          <span style={{ fontSize:13 }}>{isPublished ? '👁' : '🔒'}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:700, color: isPublished ? '#00B894' : '#6C5CE7' }}>{isPublished ? '직원에게 공개됨' : '직원에게 비공개 (잠김)'}</div>
            <div style={{ fontSize:10, color:'#aaa', marginTop:1 }}>{isPublished ? '직원들이 스케줄을 볼 수 있어요' : '직원들에게 스케줄이 보이지 않아요'}</div>
          </div>
          <button onClick={async () => { const newVal = !isPublished; await supabase.from('schedule_settings').upsert({ store_id: storeId, is_published: newVal, published_month: monthStr, updated_at: new Date().toISOString() }, { onConflict: 'store_id' }); onSettingsChange() }} style={{ padding:'6px 14px', borderRadius:9, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, background: isPublished ? 'rgba(232,67,147,0.1)' : 'rgba(0,184,148,0.15)', color: isPublished ? '#E84393' : '#00B894' }}>{isPublished ? '🔒 비공개로' : '👁 공개하기'}</button>
        </div>
      )}
      {isFuture && !isOwner && !visible && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 20px', borderRadius:14, background:'rgba(108,92,231,0.04)', border:'2px dashed rgba(108,92,231,0.2)', marginBottom:10, textAlign:'center' }}>
          <div style={{ fontSize:28, marginBottom:8 }}>📝</div>
          <div style={{ fontSize:14, fontWeight:700, color:'#6C5CE7', marginBottom:4 }}>스케줄 작성 중</div>
          <div style={{ fontSize:12, color:'#aaa' }}>대표가 스케줄을 완성하면 공개됩니다</div>
          {requestOpen && <div style={{ marginTop:10, fontSize:11, color:'#E84393', background:'rgba(232,67,147,0.08)', padding:'5px 12px', borderRadius:8, fontWeight:600 }}>🙏 지금 휴무 요청을 할 수 있어요 (셀 클릭)</div>}
        </div>
      )}
      {isFuture && isOwner && (
        <OffRequestSettingsBar settings={scheduleSettings} isActuallyOpen={requestOpen} year={year} month={month}
          onToggleOpen={async () => { const { error } = await supabase.from('schedule_settings').upsert({ store_id: storeId, request_is_open: !requestOpen, updated_at: new Date().toISOString() }, { onConflict: 'store_id' }); if (error) alert('저장 실패: ' + error.message); else onSettingsChange() }}
          onSaveDays={async (openDay, closeDay) => { const { error } = await supabase.from('schedule_settings').upsert({ store_id: storeId, request_open_day: openDay, request_close_day: closeDay, updated_at: new Date().toISOString() }, { onConflict: 'store_id' }); if (error) alert('저장 실패: ' + error.message); else onSettingsChange() }}
          onSaveBlockedDates={async (dates) => { const { error } = await supabase.from('schedule_settings').upsert({ store_id: storeId, blocked_dates: dates, updated_at: new Date().toISOString() }, { onConflict: 'store_id' }); if (error) alert('저장 실패: ' + error.message); else onSettingsChange() }}
        />
      )}
      <div style={{ overflowX:'auto', borderRadius:14, border:'1px solid #E8ECF0', boxShadow:'0 1px 6px rgba(0,0,0,0.05)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', background:'#fff', fontSize:12, tableLayout:'fixed', minWidth:600, userSelect:'none' }}>
          <colgroup><col style={{ width:90 }} />{visibleStaff.map((_,i) => <col key={i} />)}<col style={{ width:44 }} /></colgroup>
          <thead>
            <tr>
              <th style={{ background:'#F8F9FB', borderBottom:'2px solid #E8ECF0', borderRight:'2px solid #E8ECF0', padding:'10px 8px', fontSize:10, color:'#aaa', fontWeight:700, textAlign:'left', position:'sticky', top:0, zIndex:3 }}>날짜</th>
              {visibleStaff.map(name => {
                const staffPendingCnt = (isFuture && requestOpen) ? offRequests.filter(r => r.staff_name === name && r.status === 'pending').length : 0
                const staffApprovedCnt = (isFuture && requestOpen) ? offRequests.filter(r => r.staff_name === name && r.status === 'approved').length : 0
                return (
                  <th key={name} style={{ background:'#F8F9FB', borderBottom:'2px solid #E8ECF0', borderRight:'1px solid #ECEEF2', padding:'8px 4px', fontSize:12, color:'#1a1a2e', fontWeight:700, textAlign:'center', position:'sticky', top:0, zIndex:3 }}>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                        <span>{name}</span>
                        {staffPendingCnt > 0 && <span style={{ fontSize:9, background:'rgba(255,200,0,0.2)', color:'#CC9900', borderRadius:5, padding:'1px 5px', fontWeight:700 }}>🙏{staffPendingCnt}</span>}
                        {staffApprovedCnt > 0 && <span style={{ fontSize:9, background:STATUS_BG['off'], color:STATUS_COLOR['off'], borderRadius:5, padding:'1px 5px', fontWeight:700 }}>휴{staffApprovedCnt}</span>}
                      </div>
                      {isOwner && (copiedStaff === name ? (
                        <button onClick={e => { e.stopPropagation(); setCopiedStaff(null) }} style={{ fontSize:9, background:'rgba(108,92,231,0.12)', border:'1px solid #6C5CE7', color:'#6C5CE7', borderRadius:5, padding:'2px 7px', cursor:'pointer', fontWeight:700 }}>복사 취소</button>
                      ) : copiedStaff ? (
                        <button onClick={e => { e.stopPropagation(); handlePasteToStaff(name) }} style={{ fontSize:9, background:'rgba(232,67,147,0.1)', border:'1px solid #E84393', color:'#E84393', borderRadius:5, padding:'2px 7px', cursor:'pointer', fontWeight:700, animation:'pulse 1s infinite' }}>여기 붙여넣기</button>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); setCopiedStaff(name) }} style={{ fontSize:9, background:'#F4F6F9', border:'1px solid #E0E4E8', color:'#aaa', borderRadius:5, padding:'2px 7px', cursor:'pointer' }}>복사</button>
                      ))}
                    </div>
                  </th>
                )
              })}
              <th style={{ background:'#F8F9FB', borderBottom:'2px solid #E8ECF0', padding:'10px 4px', fontSize:10, color:'#6C5CE7', fontWeight:700, textAlign:'center', position:'sticky', top:0, zIndex:3 }}>출근</th>
            </tr>
          </thead>
          <tbody>
            {days.map(day => {
              const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`; const dow = new Date(dateStr).getDay(); const isToday = dateStr === today; const isSun = dow===0; const isSat = dow===6
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
                    const sc = visible ? scheduleMap[`${staff}-${dateStr}`] : null; const offReq = offRequestMap[`${staff}-${dateStr}`]
                    const isBlocked = isFuture && blockedDates.has(dateStr); const isMine = staff === myName
                    const takenByOther = isFuture && requestOpen && !isOwner && isMine && !offReq ? offRequests.find((r: any) => r.request_date === dateStr && r.staff_name !== myName && (r.status === 'pending' || r.status === 'approved')) || null : null
                    const canRequestOff = isFuture && requestOpen && !isOwner && isMine && !isBlocked && !offReq && !takenByOther
                    const clickable = canClick(staff, !!sc); const inDrag = isCellInDrag(staff, day); const otherCanView = isFuture && requestOpen && !isOwner && !isMine && !!offReq
                    let earlyTimeDisplay = ''; if (sc?.status === 'early' && sc?.note) { const m = sc.note.match(/^\[조퇴:(\d{2}:\d{2})\]/); if (m) earlyTimeDisplay = m[1] }
                    let cellBg: string | undefined = sc ? (sc.is_confirmed ? 'rgba(232,67,147,0.13)' : STATUS_BG[sc.status]) : undefined
                    if (inDrag) cellBg = 'rgba(108,92,231,0.18)'; else if (!sc && offReq?.status === 'approved') cellBg = 'rgba(232,67,147,0.22)'; else if (!sc && offReq?.status === 'pending' && isMine) cellBg = 'rgba(255,200,0,0.12)'; else if (!sc && offReq?.status === 'pending' && !isMine) cellBg = 'rgba(108,92,231,0.05)'; else if (!sc && takenByOther) cellBg = 'rgba(220,220,220,0.25)'; else if (isBlocked) cellBg = 'rgba(200,200,200,0.1)'
                    const isNaturallyBlocked = !!takenByOther || isBlocked
                    return (
                      <td key={staff} onMouseDown={e => handleCellMouseDown(staff, day, e)} onMouseEnter={() => handleCellMouseEnter(staff, day)}
                        onClick={() => { if (isMouseDown.current) return; if (dragSel) return; if (isNaturallyBlocked && !isOwner) return; if (offReq || canRequestOff || isOwner || clickable || otherCanView) setPopup({ staff, date: dateStr }) }}
                        style={{ borderBottom:'1px solid #ECEEF2', borderRight:'1px solid #ECEEF2', padding:0, height:44, textAlign:'center', verticalAlign:'middle', cursor: isOwner ? 'crosshair' : (canRequestOff || offReq || otherCanView) ? 'pointer' : 'default', transition:'background 0.05s', background: cellBg, outline: inDrag ? '2px solid #6C5CE7' : 'none', outlineOffset:'-2px' }}>
                        {inDrag ? <span style={{ fontSize:14, color:'#6C5CE7', fontWeight:700 }}>✓</span>
                        : sc ? (
                          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1, height:'100%', padding:'2px 3px', position:'relative' }}>
                            {sc.is_confirmed && <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'#E84393', borderRadius:'0 0 2px 2px' }} />}
                            <span style={{ fontSize:10, fontWeight:700, color: sc.is_confirmed ? '#E84393' : STATUS_COLOR[sc.status] }}>{sc.is_confirmed ? '🔒' : STATUS_LABEL[sc.status]}</span>
                            {!sc.is_confirmed && earlyTimeDisplay && <span style={{ fontSize:8, color:'#00B894', fontWeight:600 }}>{earlyTimeDisplay}</span>}
                            {!sc.is_confirmed && sc.position && <span style={{ fontSize:9, fontWeight:700, color:POS_COLOR[sc.position] }}>{sc.position}</span>}
                            {sc.is_confirmed && <span style={{ fontSize:8, fontWeight:700, color:'#E84393' }}>{STATUS_LABEL[sc.status]}</span>}
                            {!sc.is_confirmed && sc.note && !earlyTimeDisplay && <span title={sc.note} style={{ fontSize:8, color:'#FF6B35', maxWidth:60, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>{sc.note}</span>}
                            {offReq?.status === 'pending' && <span style={{ fontSize:8 }}>🙏</span>}
                          </div>
                        ) : offReq?.status === 'approved' ? (
                          <div style={{ display:'flex', flexDirection:'column', width:'100%', height:'100%', overflow:'hidden' }}>
                            <div style={{ height:3, background:'#E84393', borderRadius:'0 0 2px 2px', flexShrink:0 }} />
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, padding:'1px 2px', gap:1 }}>
                              <span style={{ fontSize:10 }}>🔒</span><span style={{ fontSize:9, fontWeight:700, color:'#E84393' }}>확정</span>
                              {offReq.reason && <span style={{ fontSize:7, color:'#E84393', maxWidth:60, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', opacity:0.8 }} title={offReq.reason}>{offReq.reason}</span>}
                            </div>
                          </div>
                        ) : offReq?.status === 'pending' ? (
                          isMine ? <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0 }}><span style={{ fontSize:14, lineHeight:1.3 }}>🙏</span><span style={{ fontSize:7, color:'#CC9900', fontWeight:700, maxWidth:60, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={offReq.reason}>{offReq.reason}</span></div>
                          : <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0, padding:'1px 2px' }}><span style={{ fontSize:11, lineHeight:1.3 }}>🙏</span><span style={{ fontSize:7, color:'#6C5CE7', maxWidth:60, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={offReq.reason}>{offReq.reason}</span></div>
                        ) : offReq?.status === 'rejected' && isMine ? <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0 }}><span style={{ fontSize:11, lineHeight:1.2, color:'#E84393' }}>✕</span><span style={{ fontSize:7, color:'#E84393', fontWeight:700 }}>거부</span></div>
                        : takenByOther ? null : isBlocked ? null : canRequestOff ? <span style={{ fontSize:18, color:'#e0e0e0', lineHeight:1 }}>+</span> : clickable ? <span style={{ fontSize:18, color:'#e0e0e0', lineHeight:1 }}>+</span> : null}
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
                const t = staffTotals[name] || { work:0, off:0, half:0, absent:0, early:0, etc:0, K:0, H:0, KH:0 }
                return (
                  <td key={name} style={{ background:'#F4F5F8', borderTop:'2px solid #E8ECF0', borderRight:'1px solid #ECEEF2', padding:'5px 3px', textAlign:'center' }}>
                    <div style={{ display:'flex', flexDirection:'column', gap:1, alignItems:'center' }}>
                      <span style={{ fontSize:11, fontWeight:700, color:'#6C5CE7' }}>{t.work}일</span>
                      {t.half > 0 && <span style={{ fontSize:9, color:'#FF6B35' }}>반{t.half}</span>}
                      {t.early > 0 && <span style={{ fontSize:9, color:'#00B894' }}>조{t.early}</span>}
                      {t.absent > 0 && <span style={{ fontSize:9, color:'#E67E22' }}>결{t.absent}</span>}
                      {t.etc > 0 && <span style={{ fontSize:9, color:'#8E44AD' }}>기{t.etc}</span>}
                      <span style={{ fontSize:9, color:'#E84393' }}>휴{t.off}</span>
                      {(t.K > 0 || t.H > 0 || t.KH > 0) && (<div style={{ display:'flex', gap:3, marginTop:1 }}>{t.K > 0 && <span style={{ fontSize:8, color:POS_COLOR.K, fontWeight:700 }}>K{t.K}</span>}{t.H > 0 && <span style={{ fontSize:8, color:POS_COLOR.H, fontWeight:700 }}>H{t.H}</span>}{t.KH > 0 && <span style={{ fontSize:8, color:POS_COLOR.KH, fontWeight:700 }}>KH{t.KH}</span>}</div>)}
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

function MobileGridEditor({ year, month, schedules, staffList, role, storeId, myName, onSaved, onChangeMonth, pendingCount, scheduleSettings, offRequests, nowYear, nowMonth, onOffRequestsChange, onSettingsChange }: {
  year: number; month: number; schedules: any[]; staffList: string[]; role: string; storeId: string; myName: string
  onSaved: () => void; onChangeMonth: (y: number, m: number) => void; pendingCount: number
  scheduleSettings: any; offRequests: any[]; nowYear: number; nowMonth: number
  onOffRequestsChange: () => void; onSettingsChange: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [popup, setPopup] = useState<{ staff: string; date: string } | null>(null)
  const [showRequests, setShowRequests] = useState(false)
  const [multiMode, setMultiMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const today = toDateStr(new Date()); const daysInMonth = getDaysInMonth(year, month); const monthStr = `${year}-${String(month+1).padStart(2,'0')}`
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth])
  const isOwner = role==='owner'; const isManager = role==='manager'; const isStaff = role==='staff'; const canEdit = isOwner || isManager
  const isPublished = scheduleSettings?.is_published || false
  const visible = isScheduleVisible(year, month, nowYear, nowMonth, isPublished, role)
  const isFuture = year > nowYear || (year === nowYear && month > nowMonth)
  const requestOpen = isOffRequestOpen(scheduleSettings, year, month)
  const blockedDates = useMemo(() => getBlockedDates(year, month+1, scheduleSettings?.blocked_dates || []), [year, month, scheduleSettings])
  const offRequestMap = useMemo(() => { const m: Record<string, any> = {}; offRequests.forEach((r: any) => { m[`${r.staff_name}-${r.request_date}`] = r }); return m }, [offRequests])
  const visibleStaff = (isStaff && !(isFuture && requestOpen)) ? staffList.filter(n => n===myName) : staffList
  const headerScrollRef = useRef<HTMLDivElement>(null); const bodyScrollRefs = useRef<(HTMLDivElement|null)[]>([]); const footerScrollRef = useRef<HTMLDivElement>(null); const isSyncing = useRef(false)
  const syncScroll = useCallback((left: number) => { if (isSyncing.current) return; isSyncing.current = true; headerScrollRef.current && (headerScrollRef.current.scrollLeft = left); bodyScrollRefs.current.forEach(r => r && (r.scrollLeft = left)); footerScrollRef.current && (footerScrollRef.current.scrollLeft = left); setTimeout(() => { isSyncing.current = false }, 50) }, [])
  useEffect(() => { const d = parseInt(today.split('-')[2]); setTimeout(() => syncScroll(Math.max(0,(d-3)*44)), 150) }, [year, month, staffList])
  const scheduleMap = useMemo(() => { const m: Record<string,any>={}; schedules.forEach(s=>{m[`${s.staff_name}-${s.schedule_date}`]=s}); return m }, [schedules])
  const popupData = popup ? (scheduleMap[`${popup.staff}-${popup.date}`]||null) : null
  function canClick(staff: string, hasSchedule: boolean) { if(isOwner)return true; if(isManager)return hasSchedule; return false }
  function toggleSelectCell(staff: string, dateStr: string) { const key = `${staff}|${dateStr}`; setSelected(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next }) }

  const [bulkMemo, setBulkMemo] = useState('')
  async function applyBulk(status: string) {
    for (const key of selected) {
      const [staff, dateStr] = key.split('|'); const prev = scheduleMap[`${staff}-${dateStr}`]
      if (status === '__delete__') { await supabase.from('schedules').delete().eq('store_id', storeId).eq('staff_name', staff).eq('schedule_date', dateStr); await syncAttendance(supabase, storeId, staff, dateStr, 'work'); await logScheduleEdit(supabase, storeId, myName, staff, dateStr, 'bulk_delete', prev?.status || null, null)
      } else { await supabase.from('schedules').upsert({ store_id: storeId, staff_name: staff, schedule_date: dateStr, status, position: null, note: bulkMemo || null }, { onConflict: 'store_id,staff_name,schedule_date' }); await syncAttendance(supabase, storeId, staff, dateStr, status); await logScheduleEdit(supabase, storeId, myName, staff, dateStr, 'bulk_upsert', prev?.status || null, status) }
    }
    setSelected(new Set()); setMultiMode(false); setBulkMemo(''); onSaved()
  }

  async function handleSave(status: string, position: string, note: string, confirmed?: boolean) {
    if (!popup) return; const prev = scheduleMap[`${popup.staff}-${popup.date}`]
    if (isManager && prev?.is_confirmed) { alert('🔒 대표가 확정한 날은 수정할 수 없어요'); return }
    await supabase.from('schedules').upsert({ store_id: storeId, staff_name: popup.staff, schedule_date: popup.date, status, position: position||null, note: note||null, ...(isOwner ? { is_confirmed: confirmed ?? false } : {}) }, { onConflict: 'store_id,staff_name,schedule_date' })
    const earlyMatch = note?.match(/^\[조퇴:(\d{2}:\d{2})\]/); await syncAttendance(supabase, storeId, popup.staff, popup.date, status, earlyMatch?.[1]); await logScheduleEdit(supabase, storeId, myName, popup.staff, popup.date, 'upsert', prev?.status || null, status); setPopup(null); onSaved()
  }
  async function handleRequest(status: string, note: string) {
    if (!popup) return; const current = scheduleMap[`${popup.staff}-${popup.date}`]
    await supabase.from('schedule_requests').insert({ store_id: storeId, requester_nm: myName, staff_name: popup.staff, schedule_date: popup.date, requested_status: status, current_status: current?.status||null, note: note||null }); setPopup(null); alert('변경 요청이 전송되었습니다!')
  }
  async function handleDelete() {
    if (!popup || !popupData) return; const prev = scheduleMap[`${popup.staff}-${popup.date}`]
    await supabase.from('schedules').delete().eq('id', popupData.id); await syncAttendance(supabase, storeId, popup.staff, popup.date, 'work'); await logScheduleEdit(supabase, storeId, myName, popup.staff, popup.date, 'delete', prev?.status || null, null); setPopup(null); onSaved()
  }

  const staffSummary = useMemo(() => {
    return visibleStaff.map(staff => {
      const ss = schedules.filter(s => s.staff_name === staff)
      return { name: staff, work: ss.filter(s=>s.status==='work').length, off: ss.filter(s=>s.status==='off').length, half: ss.filter(s=>s.status==='half').length, absent: ss.filter(s=>s.status==='absent').length, early: ss.filter(s=>s.status==='early').length, etc: ss.filter(s=>s.status==='etc').length, K: ss.filter(s=>s.position==='K').length, H: ss.filter(s=>s.position==='H').length, KH: ss.filter(s=>s.position==='KH').length }
    })
  }, [schedules, visibleStaff])

  return (
    <div>
      {popup && (() => {
        const offReq = offRequestMap[`${popup.staff}-${popup.date}`]
        const isBlocked2 = isFuture && blockedDates.has(popup.date)
        const takenByOther2 = isFuture && requestOpen && !isOwner && popup.staff === myName && !offReq ? offRequests.find((r: any) => r.request_date === popup.date && r.staff_name !== myName && (r.status === 'pending' || r.status === 'approved')) || null : null
        const canReqOff = isFuture && requestOpen && !isOwner && popup.staff === myName && !isBlocked2 && !offReq && !takenByOther2
        return <CellPopup staffName={popup.staff} dateStr={popup.date} current={popupData} role={role} myName={myName} onSave={handleSave} onRequest={handleRequest} onDelete={handleDelete} onClose={() => setPopup(null)} offRequest={offReq} canRequestOff={canReqOff} isBlocked={isBlocked2}
          onOffRequest={async (reason) => { const pad = (n: number) => String(n).padStart(2,'0'); const targetMonth = `${year}-${pad(month+1)}`; await supabase.from('off_requests').insert({ store_id: storeId, staff_name: popup.staff, target_month: targetMonth, request_date: popup.date, reason, status: 'pending' }); onOffRequestsChange() }}
          onOffRequestCancel={async () => { if (offReq) { await supabase.from('off_requests').delete().eq('id', offReq.id); onOffRequestsChange() } }}
          onOffRequestApprove={async () => { if (offReq) { await supabase.from('off_requests').update({ status: 'approved' }).eq('id', offReq.id); onOffRequestsChange() } }}
          onOffRequestReject={async () => { if (offReq) { await supabase.from('off_requests').update({ status: 'rejected' }).eq('id', offReq.id); onOffRequestsChange() } }}
        />
      })()}
      {showRequests && <RequestPanel storeId={storeId} myName={myName} onClose={() => setShowRequests(false)} onApproved={() => { onSaved(); setShowRequests(false) }} />}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <div style={{ flex:1 }}><YearMonthPicker year={year} month={month} onChange={onChangeMonth} color="#6C5CE7" /></div>
        {canEdit && <button onClick={() => { setMultiMode(v => !v); setSelected(new Set()) }} style={{ padding:'7px 12px', borderRadius:10, background: multiMode ? 'rgba(108,92,231,0.12)' : '#F4F6F9', border: multiMode ? '1.5px solid #6C5CE7' : '1px solid #E8ECF0', color: multiMode ? '#6C5CE7' : '#888', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>{multiMode ? `☑ ${selected.size}개 선택` : '☑ 선택'}</button>}
        {isOwner && !multiMode && <button onClick={() => setShowRequests(true)} style={{ padding:'7px 12px', borderRadius:10, background:pendingCount>0?'rgba(232,67,147,0.1)':'#F4F6F9', border:pendingCount>0?'1px solid rgba(232,67,147,0.3)':'1px solid #E8ECF0', color:pendingCount>0?'#E84393':'#aaa', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>📋{pendingCount>0&&<span style={{ background:'#E84393',color:'#fff',borderRadius:10,padding:'1px 6px',fontSize:10,marginLeft:4 }}>{pendingCount}</span>}</button>}
      </div>
      {multiMode && <div style={{ padding:'8px 12px', background:'rgba(108,92,231,0.07)', borderRadius:10, marginBottom:12, fontSize:11, color:'#6C5CE7', fontWeight:600 }}>셀을 탭해서 여러 날 선택 후 아래 상태 버튼으로 일괄 적용하세요</div>}
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
                const dateStr=`${monthStr}-${String(day).padStart(2,'0')}`; const s = visible ? scheduleMap[`${staff}-${dateStr}`] : null; const offReqM = offRequestMap[`${staff}-${dateStr}`]
                const isMineM = staff === myName; const isBlockedM = isFuture && blockedDates.has(dateStr)
                const takenByOtherM = isFuture && requestOpen && !isOwner && isMineM && !offReqM ? offRequests.find((r: any) => r.request_date === dateStr && r.staff_name !== myName && (r.status === 'pending' || r.status === 'approved')) || null : null
                const canReqOffM = isFuture && requestOpen && !isOwner && isMineM && !isBlockedM && !offReqM && !takenByOtherM
                const dow=new Date(dateStr).getDay(); const isToday=dateStr===today; const isSun=dow===0; const isSat=dow===6; const clickable=canClick(staff,!!s); const selKey = `${staff}|${dateStr}`; const isSelected = selected.has(selKey)
                let earlyTimeDisplay = ''; if (s?.status === 'early' && s?.note) { const m = s.note.match(/^\[조퇴:(\d{2}:\d{2})\]/); if (m) earlyTimeDisplay = m[1] }
                let mobileBg = isSelected ? 'rgba(108,92,231,0.2)' : s ? (s.is_confirmed ? 'rgba(232,67,147,0.13)' : STATUS_BG[s.status]) : isToday?'rgba(108,92,231,0.03)':isSun||isSat?'#FAFBFC':'#fff'
                if (!s && offReqM?.status === 'approved') mobileBg = 'rgba(232,67,147,0.22)'; else if (!s && offReqM?.status === 'pending' && isMineM) mobileBg = 'rgba(255,200,0,0.12)'; else if (!s && offReqM?.status === 'pending' && !isMineM) mobileBg = 'rgba(108,92,231,0.05)'; else if (!s && takenByOtherM) mobileBg = 'rgba(220,220,220,0.25)'
                const isNatBlockedM = !!takenByOtherM || isBlockedM
                return (
                  <div key={day} onClick={() => { if (multiMode && (isOwner || isManager)) { toggleSelectCell(staff, dateStr); return }; if (isNatBlockedM && !isOwner) return; if (offReqM || canReqOffM || clickable || (!isMineM && offReqM)) setPopup({staff, date:dateStr}); else if (clickable) setPopup({staff, date:dateStr}) }}
                    style={{ minWidth:44, flexShrink:0, borderRight:'1px solid #F0F2F5', minHeight:52, background: mobileBg, cursor: (multiMode && canEdit) ? 'pointer' : (canReqOffM || offReqM || clickable) ? 'pointer' : 'default', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1, outline: isSelected ? '2px solid #6C5CE7' : 'none', outlineOffset:'-2px' }}>
                    {isSelected ? <span style={{ fontSize:16, color:'#6C5CE7', fontWeight:700 }}>✓</span>
                    : s ? (
                      <>
                        {s.is_confirmed && <div style={{ height:2, background:'#E84393', width:'100%', borderRadius:'0 0 2px 2px', marginBottom:1 }} />}
                        <span style={{ fontSize:9, fontWeight:700, color: s.is_confirmed ? '#E84393' : STATUS_COLOR[s.status] }}>{s.is_confirmed ? '🔒' : STATUS_LABEL[s.status]}</span>
                        {s.is_confirmed && <span style={{ fontSize:7, fontWeight:700, color:'#E84393' }}>{STATUS_LABEL[s.status]}</span>}
                        {!s.is_confirmed && earlyTimeDisplay && <span style={{ fontSize:8, color:'#00B894', fontWeight:600 }}>{earlyTimeDisplay}</span>}
                        {!s.is_confirmed && s.position && <span style={{ fontSize:9, fontWeight:700, color:POS_COLOR[s.position]||'#888' }}>{s.position}</span>}
                        {!s.is_confirmed && s.note && !earlyTimeDisplay && <span style={{ fontSize:7, color:'#999', maxWidth:40, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>{s.note}</span>}
                      </>
                    ) : offReqM?.status === 'approved' ? (
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0, width:'100%' }}>
                        <div style={{ height:3, background:'#E84393', width:'100%', borderRadius:'0 0 2px 2px', marginBottom:2 }} />
                        <span style={{ fontSize:10 }}>🔒</span><span style={{ fontSize:8, fontWeight:700, color:'#E84393' }}>확정</span>
                        {offReqM.reason && <span style={{ fontSize:7, color:'#E84393', maxWidth:38, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const, opacity:0.8 }} title={offReqM.reason}>{offReqM.reason}</span>}
                      </div>
                    ) : offReqM?.status === 'pending' ? (
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0 }}>
                        <span style={{ fontSize:12 }}>🙏</span>
                        <span style={{ fontSize:7, color: isMineM?'#CC9900':'#6C5CE7', maxWidth:40, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }} title={offReqM.reason}>{offReqM.reason}</span>
                      </div>
                    ) : takenByOtherM ? null : (multiMode && canEdit) ? <span style={{ fontSize:14, color:'#d0d0d0' }}>+</span> : canReqOffM ? <span style={{ fontSize:16, color:'#ebebeb' }}>+</span> : clickable ? <span style={{ fontSize:16, color:'#ebebeb' }}>+</span> : null}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <div style={{ display:'flex', borderTop:'2px solid #E8ECF0', background:'#F8F9FB' }}>
          <div style={{ minWidth:68, flexShrink:0, borderRight:'2px solid #E8ECF0', display:'flex', alignItems:'center', justifyContent:'center', padding:'4px 0' }}><span style={{ fontSize:9, color:'#6C5CE7', fontWeight:700 }}>출근</span></div>
          <div ref={footerScrollRef} style={{ flex:1, overflowX:'auto', display:'flex' }} onScroll={e => syncScroll(e.currentTarget.scrollLeft)}>
            {days.map(day => { const dateStr=`${monthStr}-${String(day).padStart(2,'0')}`; const cnt=visible ? visibleStaff.filter(staff=>{const s=scheduleMap[`${staff}-${dateStr}`];return s&&(s.status==='work'||s.status==='half'||s.status==='early')}).length : 0; return (<div key={day} style={{ minWidth:44, flexShrink:0, borderRight:'1px solid #F0F2F5', minHeight:28, display:'flex', alignItems:'center', justifyContent:'center' }}>{cnt>0&&<span style={{ fontSize:10, fontWeight:700, color:'#6C5CE7' }}>{cnt}</span>}</div>) })}
          </div>
        </div>
      </div>
      {multiMode && selected.size > 0 && (
        <div style={{ position:'fixed', bottom:72, left:0, right:0, padding:'12px 16px', background:'#fff', borderTop:'2px solid #E8ECF0', boxShadow:'0 -4px 20px rgba(0,0,0,0.12)', zIndex:200 }}>
          <div style={{ fontSize:12, color:'#6C5CE7', fontWeight:700, marginBottom:8, textAlign:'center' }}>{selected.size}개 선택됨 — 적용할 상태를 선택하세요</div>
          <input value={bulkMemo} onChange={e => setBulkMemo(e.target.value)} placeholder="메모 입력 (선택 · 전체 적용)" style={{ width:'100%', padding:'8px 12px', borderRadius:10, border:'1px solid #E0E4E8', background:'#F8F9FB', fontSize:12, outline:'none', boxSizing:'border-box' as const, marginBottom:8 }} />
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:8 }}>
            {(['work','off','half','absent','early','etc'] as const).map(s => (<button key={s} onClick={() => applyBulk(s)} style={{ flex:1, minWidth:56, padding:'10px 0', borderRadius:10, border:`1.5px solid ${STATUS_COLOR[s]}`, background:STATUS_BG[s], color:STATUS_COLOR[s], fontSize:12, fontWeight:700, cursor:'pointer' }}>{STATUS_LABEL[s]}</button>))}
          </div>
          <button onClick={() => applyBulk('__delete__')} style={{ width:'100%', padding:'10px 0', borderRadius:10, border:'1.5px solid rgba(232,67,147,0.4)', background:'rgba(232,67,147,0.07)', color:'#E84393', fontSize:12, fontWeight:700, cursor:'pointer' }}>🗑 선택 {selected.size}개 삭제</button>
        </div>
      )}
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
                    {s.etc > 0 && <span style={{ fontSize:11, color:'#8E44AD', fontWeight:700 }}>기타 {s.etc}</span>}
                    <span style={{ fontSize:11, color:'#E84393', fontWeight:700 }}>휴일 {s.off}</span>
                  </div>
                </div>
                {(s.K>0||s.H>0||s.KH>0) && (<div style={{ display:'flex', gap:8, paddingTop:4, borderTop:'1px solid #F4F6F9' }}>{s.K > 0 && <span style={{ fontSize:10, color:POS_COLOR.K, fontWeight:700 }}>K {s.K}일</span>}{s.H > 0 && <span style={{ fontSize:10, color:POS_COLOR.H, fontWeight:700 }}>H {s.H}일</span>}{s.KH > 0 && <span style={{ fontSize:10, color:POS_COLOR.KH, fontWeight:700 }}>KH {s.KH}일</span>}</div>)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function MonthlyView({ year, month, schedules, onChangeMonth, selectedDate, onDayClick, role, scheduleSettings, nowYear, nowMonth }: {
  year: number; month: number; schedules: any[]; onChangeMonth: (y:number,m:number)=>void; selectedDate: string; onDayClick: (d:string)=>void; role?: string; scheduleSettings?: any; nowYear?: number; nowMonth?: number
}) {
  const today = toDateStr(new Date()); const daysInMonth = getDaysInMonth(year,month); const firstDay = new Date(year,month,1).getDay(); const monthStr = `${year}-${String(month+1).padStart(2,'0')}`
  const _nowYear = nowYear ?? new Date().getFullYear(); const _nowMonth = nowMonth ?? new Date().getMonth()
  const isPublished = scheduleSettings?.is_published || false
  const visible = isScheduleVisible(year, month, _nowYear, _nowMonth, isPublished, role || 'owner')
  const visibleSchedules = visible ? schedules : []
  const dayMap = useMemo(() => { const m: Record<string,{work:number;off:number}>={};visibleSchedules.forEach(s=>{if(!m[s.schedule_date])m[s.schedule_date]={work:0,off:0};if(s.status==='work'||s.status==='half'||s.status==='early')m[s.schedule_date].work++;else m[s.schedule_date].off++});return m },[visibleSchedules])
  const weeks:(number|null)[][]=[];let week:(number|null)[]=Array(firstDay).fill(null)
  for(let d=1;d<=daysInMonth;d++){week.push(d);if(week.length===7){weeks.push(week);week=[]}}
  if(week.length>0){while(week.length<7)week.push(null);weeks.push(week)}
  const selSchedules = visibleSchedules.filter(s=>s.schedule_date===selectedDate).sort((a,b)=>a.staff_name.localeCompare(b.staff_name))
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

export default function SchedulePage() {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState('')
  const [myName, setMyName] = useState('')
  const [profileId, setProfileId] = useState('')
  const [role, setRole] = useState('staff')
  const [schedules, setSchedules] = useState<any[]>([])
  const [staffList, setStaffList] = useState<string[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [scheduleSettings, setScheduleSettings] = useState<any>(null)
  const [offRequests, setOffRequests] = useState<any[]>([])
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
    loadStaff(store.id, nowD.getFullYear(), nowD.getMonth())
    loadData(store.id, nowD.getFullYear(), nowD.getMonth())
    loadSettings(store.id)
    loadOffRequests(store.id, nowD.getFullYear(), nowD.getMonth())
    if (user.role==='owner') loadPendingCount(store.id)
  }, [])

  async function loadSettings(sid: string) {
    const { data } = await supabase.from('schedule_settings').select('*').eq('store_id', sid).maybeSingle()
    setScheduleSettings(data || null)
  }
  async function loadOffRequests(sid: string, y: number, m: number) {
    const pad = (n: number) => String(n).padStart(2,'0'); const targetMonth = `${y}-${pad(m+1)}`
    const { data } = await supabase.from('off_requests').select('*').eq('store_id', sid).eq('target_month', targetMonth)
    setOffRequests(data || [])
  }
  async function loadData(sid: string, y: number, m: number) {
    const pad = (n: number) => String(n).padStart(2,'0')
    const { data } = await supabase.from('schedules').select('*').eq('store_id',sid).gte('schedule_date',`${y}-${pad(m+1)}-01`).lte('schedule_date',`${y}-${pad(m+1)}-${pad(getDaysInMonth(y,m))}`).order('schedule_date')
    setSchedules(data||[])
  }
  async function loadStaff(sid: string, y?: number, m?: number) {
    const targetYear = y ?? calYear; const targetMonth = m ?? calMonth
    const pad = (n: number) => String(n).padStart(2,'0')
    const startDate = `${targetYear}-${pad(targetMonth+1)}-01`; const endDate = `${targetYear}-${pad(targetMonth+1)}-${pad(getDaysInMonth(targetYear, targetMonth))}`
    const [activeRes, inactiveRes, schedRes] = await Promise.all([
      supabase.from('store_members').select('profile_id, sort_order, profiles(nm)').eq('store_id', sid).eq('active', true),
      supabase.from('store_members').select('profile_id, profiles(nm)').eq('store_id', sid).eq('active', false),
      supabase.from('schedules').select('staff_name').eq('store_id', sid).gte('schedule_date', startDate).lte('schedule_date', endDate),
    ])
    const members = (activeRes.data||[]).map((m: any) => ({ nm: m.profiles?.nm||'', sort_order: m.sort_order ?? 9999 })).filter(m => m.nm)
    const hasDbOrder = members.some(m => m.sort_order !== 9999)
    let activeNames: string[]
    if (hasDbOrder) { members.sort((a, b) => a.sort_order - b.sort_order); activeNames = members.map(m => m.nm) }
    else {
      const names = members.map(m => m.nm); const savedOrder: string[] = JSON.parse(localStorage.getItem(`staff_order_${sid}`)||'[]')
      if (savedOrder.length > 0) { activeNames = [...savedOrder.filter((n:string)=>names.includes(n)), ...names.filter((n:string)=>!savedOrder.includes(n)).sort()] }
      else { activeNames = names.sort() }
    }
    const schedNames = new Set((schedRes.data||[]).map((s: any) => s.staff_name))
    const inactiveWithSched = (inactiveRes.data||[]).map((m: any) => m.profiles?.nm||'').filter((nm: string) => nm && !activeNames.includes(nm) && schedNames.has(nm))
    setStaffList([...activeNames, ...inactiveWithSched])
  }
  async function loadPendingCount(sid: string) {
    const { count } = await supabase.from('schedule_requests').select('*',{count:'exact',head:true}).eq('store_id',sid).eq('status','pending')
    setPendingCount(count||0)
  }
  function handleChangeMonth(y: number, m: number) { setCalYear(y); setCalMonth(m); loadData(storeId,y,m); loadOffRequests(storeId,y,m); loadStaff(storeId,y,m) }

  const tabBtn = (active: boolean) => ({
    flex:1, padding:'9px 0', borderRadius:10, border:'none', cursor:'pointer' as const,
    fontSize:13, fontWeight: active?700:400, background: active?'#fff':'transparent',
    color: active?'#1a1a2e':'#aaa', boxShadow: active?'0 1px 4px rgba(0,0,0,0.08)':'none',
  })

  const isOwner = role === 'owner'; const nowYear = nowD.getFullYear(); const nowMonth = nowD.getMonth()

  const sharedProps = {
    year: calYear, month: calMonth, schedules, staffList, role, storeId, myName, pendingCount,
    scheduleSettings, offRequests, nowYear, nowMonth,
    onSaved: () => { loadData(storeId,calYear,calMonth); if(role==='owner') loadPendingCount(storeId) },
    onOffRequestsChange: () => loadOffRequests(storeId, calYear, calMonth),
    onSettingsChange: () => loadSettings(storeId),
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
      {viewTab==='month' && <MonthlyView year={calYear} month={calMonth} schedules={schedules} onChangeMonth={handleChangeMonth} selectedDate={selectedDate} onDayClick={setSelectedDate} role={role} scheduleSettings={scheduleSettings} nowYear={nowYear} nowMonth={nowMonth} />}
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
            {pendingCount > 0 && <span style={{ position:'absolute', top:4, right:4, background:'#E84393', color:'#fff', borderRadius:8, padding:'0px 5px', fontSize:9, fontWeight:700 }}>{pendingCount}</span>}
          </button>
        )}
      </div>
      {viewTab==='grid' && <MobileGridEditor {...sharedProps} />}
      {viewTab==='month' && <MonthlyView year={calYear} month={calMonth} schedules={schedules} onChangeMonth={handleChangeMonth} selectedDate={selectedDate} onDayClick={setSelectedDate} role={role} scheduleSettings={scheduleSettings} nowYear={nowYear} nowMonth={nowMonth} />}
      {viewTab==='manage' && isOwner && <ManageView profileId={profileId} myName={myName} year={calYear} month={calMonth} />}
    </div>
  )
}