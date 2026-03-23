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


// ── 공개 여부 판단 ──────────────────────────────────────────────
function isScheduleVisible(year: number, month: number, nowYear: number, nowMonth: number, isPublished: boolean, role: string) {
  if (role === 'owner') return true
  if (year < nowYear || (year === nowYear && month < nowMonth)) return true  // 과거
  if (year === nowYear && month === nowMonth) return true  // 당월 항상 공개
  return isPublished  // 미래: 공개 여부에 따라
}

// ── 휴무요청 기간 판단 ──────────────────────────────────────────
function isOffRequestOpen(settings: any, viewYear: number, viewMonth: number): boolean {
  if (!settings) return false
  const now = new Date()
  const nowDay = now.getDate()
  const nowMonth = now.getMonth()   // 0-based
  const nowYear = now.getFullYear()
  // 다음달 계산
  const nextMonthNum = nowMonth === 11 ? 0 : nowMonth + 1
  const nextMonthYear = nowMonth === 11 ? nowYear + 1 : nowYear
  // 보고 있는 달이 다음달이어야 함
  if (viewYear !== nextMonthYear || viewMonth !== nextMonthNum) return false
  // 자동 오픈 조건: open_day <= 오늘 <= close_day
  const autoOpen = nowDay >= (settings.request_open_day || 25)
  const autoClose = nowDay <= (settings.request_close_day || 31)
  return settings.request_is_open || (autoOpen && autoClose)
}

// ── 휴무 요청 불가 날짜 (공휴일 자동 차단) ──────────────────────
function getBlockedDates(year: number, month: number, manualBlocked: string[]): Set<string> {
  const blocked = new Set<string>(manualBlocked || [])
  const holidays = getHolidays(year)
  // 공휴일 + 크리스마스이브 자동 차단
  Object.keys(holidays).forEach(d => blocked.add(d))
  blocked.add(`${year}-12-24`)  // 크리스마스이브
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
          {(['absent','early','etc'] as const).map(s => (
            <button key={s} onClick={() => onApply(s)}
              style={{ padding:'14px 0', borderRadius:12, border:`1.5px solid ${STATUS_COLOR[s]}`, background:STATUS_BG[s], color:STATUS_COLOR[s], fontSize:13, fontWeight:700, cursor:'pointer' }}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:8, marginBottom:8 }}>
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
        {/* ── 휴무요청 UI (staff 또는 owner 확인) ── */}
        {(canRequestOff || offRequest) && (
          <div style={{ marginTop: (role==='owner'||role==='manager') ? 16 : 0 }}>
            {role !== 'owner' && (
              <>
                {offRequest ? (
                  staffName === myName ? (
                    // 내 요청
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
                    // 다른 직원 요청 - 읽기 전용
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

// ─── OffRequestSettingsBar ────────────────────────────────────
function OffRequestSettingsBar({ settings, onToggleOpen, onSaveDays, onSaveBlockedDates, isActuallyOpen, year, month }: {
  settings: any
  onToggleOpen: () => Promise<void>
  onSaveDays: (openDay: number, closeDay: number) => Promise<void>
  onSaveBlockedDates: (dates: string[]) => Promise<void>
  isActuallyOpen: boolean
  year: number
  month: number
}) {
  const [open, setOpen] = useState(false)
  const [openDay, setOpenDay] = useState(settings?.request_open_day ?? 25)
  const [closeDay, setCloseDay] = useState(settings?.request_close_day ?? 31)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'period'|'block'>('period')
  const isOpen = isActuallyOpen

  // 현재 차단된 날짜 목록 (해당 월만)
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`
  const allBlocked: string[] = settings?.blocked_dates || []
  const thisMonthBlocked = allBlocked.filter((d: string) => d.startsWith(monthStr))

  const daysInMonth = new Date(year, month+1, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  function isDateBlocked(day: number) {
    return thisMonthBlocked.includes(`${monthStr}-${String(day).padStart(2,'0')}`)
  }

  async function toggleBlockDate(day: number) {
    const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`
    let next: string[]
    if (isDateBlocked(day)) {
      next = allBlocked.filter((d: string) => d !== dateStr)
    } else {
      next = [...allBlocked, dateStr]
    }
    await onSaveBlockedDates(next)
  }

  async function saveDays() {
    setSaving(true)
    await onSaveDays(openDay, closeDay)
    setSaving(false)
    setOpen(false)
  }

  const DOW = ['일','월','화','수','목','금','토']

  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:12, background: isOpen?'rgba(255,200,0,0.08)':'rgba(200,200,200,0.08)', border: isOpen?'1px solid rgba(255,200,0,0.3)':'1px solid #E8ECF0' }}>
        <span style={{ fontSize:13 }}>{isOpen ? '🙏' : '🔒'}</span>
        <div style={{ flex:1 }}>
          <span style={{ fontSize:12, fontWeight:700, color: isOpen?'#CC9900':'#aaa' }}>
            {isOpen ? '직원 휴무 요청 중' : '휴무 요청 닫힘'}
          </span>
          <span style={{ fontSize:10, color:'#bbb', marginLeft:8 }}>
            (자동: 매월 {settings?.request_open_day??25}일~{settings?.request_close_day??31}일)
          </span>
          {thisMonthBlocked.length > 0 && (
            <span style={{ fontSize:10, color:'#E84393', marginLeft:8 }}>🚫 {thisMonthBlocked.length}일 차단</span>
          )}
        </div>
        <button onClick={() => setOpen(v => !v)} style={{ padding:'4px 10px', borderRadius:7, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', fontSize:11, cursor:'pointer' }}>⚙️ 설정</button>
        <button onClick={onToggleOpen} style={{ padding:'5px 12px', borderRadius:8, border:'none', cursor:'pointer', fontSize:11, fontWeight:700, background: isOpen?'rgba(232,67,147,0.1)':'rgba(255,200,0,0.15)', color: isOpen?'#E84393':'#CC9900' }}>
          {isOpen ? '닫기' : '열기'}
        </button>
      </div>
      {open && (
        <div style={{ padding:'14px', background:'#fff', borderRadius:12, border:'1px solid #E8ECF0', marginTop:6, boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
          {/* 탭 */}
          <div style={{ display:'flex', gap:6, marginBottom:14 }}>
            {(['period','block'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ flex:1, padding:'7px 0', borderRadius:9, border:'none', cursor:'pointer', fontSize:11, fontWeight:700,
                  background: tab===t ? 'linear-gradient(135deg,#6C5CE7,#E84393)' : '#F4F6F9',
                  color: tab===t ? '#fff' : '#aaa' }}>
                {t==='period' ? '📅 자동 오픈 기간' : '🚫 요청 불가일 설정'}
              </button>
            ))}
          </div>

          {tab === 'period' && (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:'#aaa', marginBottom:4 }}>오픈 시작일 (매월)</div>
                  <input type="number" min={1} max={31} value={openDay} onChange={e => setOpenDay(Number(e.target.value))}
                    style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'1px solid #E8ECF0', fontSize:13, outline:'none', boxSizing:'border-box' as const }} />
                </div>
                <span style={{ color:'#bbb', marginTop:14 }}>~</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, color:'#aaa', marginBottom:4 }}>마감일 (매월)</div>
                  <input type="number" min={1} max={31} value={closeDay} onChange={e => setCloseDay(Number(e.target.value))}
                    style={{ width:'100%', padding:'7px 10px', borderRadius:8, border:'1px solid #E8ECF0', fontSize:13, outline:'none', boxSizing:'border-box' as const }} />
                </div>
              </div>
              <div style={{ fontSize:10, color:'#aaa', marginBottom:10 }}>예: 25일~31일로 설정하면 매월 25일부터 말일까지 자동으로 요청 오픈</div>
              <button onClick={saveDays} disabled={saving} style={{ width:'100%', padding:'9px 0', borderRadius:9, background:'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor: saving?'not-allowed':'pointer' }}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </>
          )}

          {tab === 'block' && (
            <>
              <div style={{ fontSize:10, color:'#aaa', marginBottom:10 }}>
                탭하면 즉시 저장돼요. 차단된 날은 직원이 휴무 신청할 수 없어요.
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:4 }}>
                {['일','월','화','수','목','금','토'].map(d => (
                  <div key={d} style={{ textAlign:'center', fontSize:9, color:'#bbb', fontWeight:700, paddingBottom:2 }}>{d}</div>
                ))}
                {/* 첫 날 앞 빈칸 */}
                {Array.from({ length: new Date(year, month, 1).getDay() }, (_, i) => (
                  <div key={`empty-${i}`} />
                ))}
                {days.map(day => {
                  const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`
                  const dow = new Date(dateStr).getDay()
                  const blocked = isDateBlocked(day)
                  const isSun = dow === 0; const isSat = dow === 6
                  return (
                    <button key={day} onClick={() => toggleBlockDate(day)}
                      style={{ padding:'6px 2px', borderRadius:8, border: blocked?'2px solid #E84393':'1px solid #E8ECF0',
                        background: blocked?'rgba(232,67,147,0.1)':'#F8F9FB',
                        color: blocked?'#E84393':isSun?'#E84393':isSat?'#6C5CE7':'#555',
                        fontSize:11, fontWeight: blocked?700:400, cursor:'pointer', textAlign:'center' as const,
                        transition:'all 0.1s' }}>
                      {blocked ? '🚫' : day}
                    </button>
                  )
                })}
              </div>
              {thisMonthBlocked.length > 0 && (
                <div style={{ marginTop:10, padding:'8px 10px', background:'rgba(232,67,147,0.05)', borderRadius:8, fontSize:10, color:'#E84393' }}>
                  차단된 날: {thisMonthBlocked.map(d => d.slice(-2) + '일').join(', ')}
                  <button onClick={async () => {
                    await onSaveBlockedDates(allBlocked.filter((d: string) => !d.startsWith(monthStr)))
                  }} style={{ marginLeft:8, padding:'2px 7px', borderRadius:5, border:'1px solid rgba(232,67,147,0.3)', background:'none', color:'#E84393', fontSize:10, cursor:'pointer' }}>
                    전체 해제
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
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
// ─── ManageOffRequestBar (전지점 관리용 휴무설정바) ────────────
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

  function isDateBlocked(day: number) {
    return thisMonthBlocked.includes(`${monthStr}-${String(day).padStart(2,'0')}`)
  }

  async function toggleBlockDate(day: number) {
    const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`
    const next = isDateBlocked(day)
      ? allBlocked.filter((d: string) => d !== dateStr)
      : [...allBlocked, dateStr]
    await supabase.from('schedule_settings').upsert({ store_id: sid, blocked_dates: next, updated_at: new Date().toISOString() }, { onConflict: 'store_id' })
    onRefresh()
  }

  async function savePeriod() {
    setSaving(true)
    await supabase.from('schedule_settings').upsert({ store_id: sid, request_open_day: openDay, request_close_day: closeDay, updated_at: new Date().toISOString() }, { onConflict: 'store_id' })
    setSaving(false)
    setOpen(false)
    onRefresh()
  }

  return (
    <div style={{ padding:'8px 14px', borderBottom:'1px solid #ECEEF2' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ fontSize:11, fontWeight:700, color: isOpen?'#CC9900':'#aaa', flex:1 }}>
          {isOpen ? '🙏 휴무 요청 열림' : '🔒 휴무 요청 닫힘'}
          <span style={{ fontSize:9, color:'#bbb', marginLeft:6, fontWeight:400 }}>(자동: 매월 {settings?.request_open_day??25}~{settings?.request_close_day??31}일)</span>
          {thisMonthBlocked.length > 0 && <span style={{ fontSize:9, color:'#E84393', marginLeft:6 }}>🚫{thisMonthBlocked.length}일 차단</span>}
        </span>
        <button onClick={e => { e.stopPropagation(); setOpen(v => !v) }}
          style={{ padding:'3px 8px', borderRadius:6, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', fontSize:10, cursor:'pointer' }}>⚙️</button>
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
              <button key={t} onClick={() => setTab(t)}
                style={{ flex:1, padding:'5px 0', borderRadius:7, border:'none', cursor:'pointer', fontSize:10, fontWeight:700,
                  background: tab===t ? 'linear-gradient(135deg,#6C5CE7,#E84393)' : '#fff',
                  color: tab===t ? '#fff' : '#aaa', boxShadow: tab===t ? '0 1px 4px rgba(108,92,231,0.3)' : 'none' }}>
                {t==='period' ? '📅 자동 오픈 기간' : '🚫 요청 불가일'}
              </button>
            ))}
          </div>
          {tab === 'period' && (
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <input type="number" min={1} max={31} value={openDay} onChange={e => setOpenDay(Number(e.target.value))}
                style={{ flex:1, padding:'6px 8px', borderRadius:7, border:'1px solid #E8ECF0', fontSize:12, outline:'none' }} />
              <span style={{ color:'#bbb', fontSize:11 }}>~</span>
              <input type="number" min={1} max={31} value={closeDay} onChange={e => setCloseDay(Number(e.target.value))}
                style={{ flex:1, padding:'6px 8px', borderRadius:7, border:'1px solid #E8ECF0', fontSize:12, outline:'none' }} />
              <button onClick={savePeriod} disabled={saving}
                style={{ padding:'6px 14px', borderRadius:7, background:'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                {saving ? '...' : '저장'}
              </button>
            </div>
          )}
          {tab === 'block' && (
            <>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:3 }}>
                {['일','월','화','수','목','금','토'].map(d => (
                  <div key={d} style={{ textAlign:'center', fontSize:8, color:'#bbb', fontWeight:700, paddingBottom:2 }}>{d}</div>
                ))}
                {Array.from({ length: new Date(year, month, 1).getDay() }, (_, i) => <div key={`e${i}`} />)}
                {days.map(day => {
                  const dow = new Date(`${monthStr}-${String(day).padStart(2,'0')}`).getDay()
                  const blocked = isDateBlocked(day)
                  return (
                    <button key={day} onClick={() => toggleBlockDate(day)}
                      style={{ padding:'4px 1px', borderRadius:6, border: blocked?'2px solid #E84393':'1px solid #E8ECF0',
                        background: blocked?'rgba(232,67,147,0.1)':'#fff',
                        color: blocked?'#E84393':dow===0?'#E84393':dow===6?'#6C5CE7':'#555',
                        fontSize:10, fontWeight: blocked?700:400, cursor:'pointer' }}>
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

// ManageView - 전지점 관리 탭
// ════════════════════════════════════════
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
  // 복사·붙여넣기 (지점별 + 직원별)
  const [manageCopied, setManageCopied] = useState<{ sid: string; staff: string } | null>(null)
  const [backingUp, setBackingUp] = useState(false)

  async function handleManagePaste(targetSid: string, targetStaff: string) {
    if (!manageCopied) return
    const src = storeData[manageCopied.sid]?.schedules.filter((s: any) => s.staff_name === manageCopied.staff) || []
    if (src.length === 0) { alert(`${manageCopied.staff}의 스케줄이 없습니다`); setManageCopied(null); return }
    if (!window.confirm(`${manageCopied.staff}의 스케줄(${src.length}건)을 ${targetStaff}에 붙여넣을까요?\n기존 스케줄은 덮어씌워집니다.`)) return
    await supabase.from('schedules').upsert(
      src.map((s: any) => ({ store_id: targetSid, staff_name: targetStaff, schedule_date: s.schedule_date, status: s.status, position: s.position, note: s.note })),
      { onConflict: 'store_id,staff_name,schedule_date' }
    )
    setManageCopied(null)
    loadAll()
  }

  function exportManageExcel() {
    const pad = (n: number) => String(n).padStart(2,'0')
    const DOW_KR = ['일','월','화','수','목','금','토']
    const STATUS_KR: Record<string,string> = { work:'근무', off:'휴일', half:'반차', absent:'결근', early:'조퇴' }
    const holidays = getHolidays(year)
    const daysInMonthE = getDaysInMonth(year, month)
    const monthStrE = `${year}-${pad(month+1)}`

    // 지점별 시트 데이터를 하나의 CSV로 합치기
    const bom = '\uFEFF'
    const allRows: string[][] = []

    storeItems.forEach((member: any) => {
      const sid = member.stores?.id
      const storeName = member.stores?.name || ''
      const d = storeData[sid]
      if (!d) return
      const { schedules: scheds, staff } = d
      const schedMap: Record<string,any> = {}
      scheds.forEach((s: any) => { schedMap[`${s.staff_name}-${s.schedule_date}`] = s })
      const sOffReqMap: Record<string,any> = {}
      ;(d.offRequests || []).forEach((r: any) => { sOffReqMap[`${r.staff_name}-${r.request_date}`] = r })

      // 지점 구분 헤더
      allRows.push([`[${storeName}] ${year}년 ${month+1}월`])
      allRows.push(['날짜', '요일', ...staff, '출근수'])

      for (let day = 1; day <= daysInMonthE; day++) {
        const dateStr = `${monthStrE}-${pad(day)}`
        const dow = new Date(dateStr).getDay()
        const holiday = holidays[dateStr] ? ` (${holidays[dateStr]})` : ''
        const row: string[] = [`${month+1}/${day}${holiday}`, DOW_KR[dow]]
        let workCnt = 0
        staff.forEach((name: string) => {
          const sc = schedMap[`${name}-${dateStr}`]
          const offR = sOffReqMap[`${name}-${dateStr}`]
          if (sc) {
            const label = STATUS_KR[sc.status] || sc.status
            const pos = sc.position ? ` [${sc.position}]` : ''
            const confirmed = sc.is_confirmed ? ' 🔒' : ''
            row.push(`${label}${pos}${confirmed}`)
            if (sc.status==='work'||sc.status==='half'||sc.status==='early') workCnt++
          } else if (offR?.status === 'approved') {
            row.push(`🔒확정 (${offR.reason})`)
          } else if (offR?.status === 'pending') {
            row.push(`🙏요청 (${offR.reason})`)
          } else {
            row.push('')
          }
        })
        row.push(String(workCnt))
        allRows.push(row)
      }
      allRows.push([]) // 지점 간 빈 줄
    })

    const csv = bom + allRows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `전지점_스케줄_${year}년${month+1}월.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const today = toDateStr(new Date())
  const tomorrow = toDateStr(new Date(Date.now() + 86400000))
  const nowD = new Date()
  const nowYear = nowD.getFullYear()
  const nowMonth = nowD.getMonth()

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
      const [schedsRes, reqsRes, staffRes, inactiveStaffRes, settingsRes, offReqsRes] = await Promise.all([
        supabase.from('schedules').select('*').eq('store_id', sid).gte('schedule_date', startDate).lte('schedule_date', endDate),
        supabase.from('schedule_requests').select('*').eq('store_id', sid).eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('store_members').select('profile_id, sort_order, profiles(nm)').eq('store_id', sid).eq('active', true),
        supabase.from('store_members').select('profile_id, sort_order, profiles(nm)').eq('store_id', sid).eq('active', false),
        supabase.from('schedule_settings').select('*').eq('store_id', sid).maybeSingle(),
        supabase.from('off_requests').select('*').eq('store_id', sid).eq('target_month', `${year}-${pad(month+1)}`),
      ])
      // 활성 직원
      const activeNames = (staffRes.data || [])
        .map((m: any) => ({ nm: m.profiles?.nm || '', order: m.sort_order ?? 9999 }))
        .filter((m: any) => m.nm)
        .sort((a: any, b: any) => a.order - b.order)
        .map((m: any) => m.nm)
      // 비활성 직원 중 당월 스케줄 있는 경우만 추가 (맨 뒤에)
      const schedNamesInMonth = new Set((schedsRes.data || []).map((s: any) => s.staff_name))
      const inactiveWithSched = (inactiveStaffRes.data || [])
        .map((m: any) => m.profiles?.nm || '')
        .filter((nm: string) => nm && !activeNames.includes(nm) && schedNamesInMonth.has(nm))
      const staffNames = [...activeNames, ...inactiveWithSched]
      newData[sid] = { schedules: schedsRes.data || [], requests: reqsRes.data || [], staff: staffNames, settings: settingsRes.data || null, offRequests: offReqsRes.data || [] }
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
    const d = storeData[sid]
    const schedMap: Record<string,any> = {}
    if (d) d.schedules.forEach((s: any) => { schedMap[`${s.staff_name}-${s.schedule_date}`] = s })

    if (status === '__delete__') {
      // 삭제: 한 번에 in 쿼리로 처리
      await supabase.from('schedules').delete()
        .eq('store_id', sid).eq('staff_name', staff).in('schedule_date', dates)
      await Promise.all(dates.map(async dateStr => {
        const prev = schedMap[`${staff}-${dateStr}`]
        await syncAttendance(supabase, sid, staff, dateStr, 'work')
        await logScheduleEdit(supabase, sid, myName, staff, dateStr, 'bulk_delete', prev?.status || null, null)
      }))
    } else {
      // upsert: 한 번에 배열로 처리
      await supabase.from('schedules').upsert(
        dates.map(dateStr => ({ store_id: sid, staff_name: staff, schedule_date: dateStr, status, position: null, note: null })),
        { onConflict: 'store_id,staff_name,schedule_date' }
      )
      await Promise.all(dates.map(async dateStr => {
        const prev = schedMap[`${staff}-${dateStr}`]
        await syncAttendance(supabase, sid, staff, dateStr, status)
        await logScheduleEdit(supabase, sid, myName, staff, dateStr, 'bulk_upsert', prev?.status || null, status)
      }))
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
  const totalOffPending = Object.values(storeData).reduce((s, d) => s + (d.offRequests || []).filter((r: any) => r.status === 'pending').length, 0)
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

  async function handleFullBackup() {
    setBackingUp(true)
    try {
      const sids = storeItems.map((m: any) => m.stores?.id).filter(Boolean)
      const storeNames: Record<string, string> = {}
      storeItems.forEach((m: any) => { if (m.stores?.id) storeNames[m.stores.id] = m.stores.name || '' })

      // 전체 스케줄 데이터 가져오기
      const { data: allSchedules } = await supabase
        .from('schedules').select('*').in('store_id', sids).order('store_id').order('schedule_date')

      const bom = '\uFEFF'
      const headers = ['지점명', '직원명', '날짜', '상태', '포지션', '메모']
      const rows = [headers]
      ;(allSchedules || []).forEach((s: any) => {
        const STATUS: Record<string,string> = { work:'근무', off:'휴일', half:'반차', absent:'결근', early:'조퇴' }
        rows.push([
          storeNames[s.store_id] || s.store_id,
          s.staff_name || '',
          s.schedule_date || '',
          STATUS[s.status] || s.status || '',
          s.position || '',
          (s.note || '').replace(/^\[조퇴:\d{2}:\d{2}\]\s*/, ''),
        ])
      })

      const csv = bom + rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const today = new Date()
      a.download = `매장노트_전체백업_${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch(e) {
      alert('백업 실패: ' + e)
    }
    setBackingUp(false)
  }

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

      {/* 전체 백업 버튼 */}
      <div style={{ marginBottom:12, padding:'10px 14px', background:'rgba(255,200,0,0.06)', borderRadius:12, border:'1px solid rgba(255,200,0,0.25)', display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:13 }}>💾</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#CC9900' }}>전체 데이터 백업</div>
          <div style={{ fontSize:10, color:'#aaa' }}>전 지점 스케줄을 CSV로 저장 — 매달 1일에 한 번 눌러두세요</div>
        </div>
        <button onClick={handleFullBackup} disabled={backingUp}
          style={{ padding:'7px 16px', borderRadius:9, background: backingUp ? '#F4F6F9' : 'linear-gradient(135deg,#FFD700,#FF6B35)', border:'none', color: backingUp ? '#aaa' : '#fff', fontSize:12, fontWeight:700, cursor: backingUp ? 'not-allowed' : 'pointer', flexShrink:0 }}>
          {backingUp ? '⏳ 백업 중...' : '📥 백업 다운로드'}
        </button>
      </div>

      {/* 섹션 탭 + 엑셀 버튼 */}
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
        <button onClick={exportManageExcel} style={{ padding:'7px 14px', borderRadius:10, background:'rgba(0,184,148,0.1)', border:'1px solid rgba(0,184,148,0.3)', color:'#00B894', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0, whiteSpace:'nowrap' as const }}>📥 엑셀</button>
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
            const { schedules: scheds, staff, settings: sSettings, offRequests: sOffReqs } = d
            const isExpanded = gridExpanded[sid] !== false
            const schedMap: Record<string,any> = {}
            scheds.forEach(s => { schedMap[`${s.staff_name}-${s.schedule_date}`] = s })
            const sOffReqMap: Record<string,any> = {}
            ;(sOffReqs || []).forEach((r: any) => { sOffReqMap[`${r.staff_name}-${r.request_date}`] = r })
            const sIsPublished = sSettings?.is_published || false
            const sIsFuture = year > nowYear || (year === nowYear && month > nowMonth)
            const sMonthStr = `${year}-${String(month+1).padStart(2,'0')}`
            const sRequestOpen = isOffRequestOpen(sSettings, year, month)

            return (
              <div key={sid} style={{ marginBottom:18, background:'#fff', borderRadius:14, border:'1px solid #E8ECF0', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                {/* 지점 헤더 */}
                <div onClick={() => setGridExpanded(prev => ({ ...prev, [sid]: !isExpanded }))}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 14px', cursor:'pointer', background:'#F8F9FB', borderBottom: isExpanded ? '1px solid #E8ECF0' : 'none' }}>
                  <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#FF6B35,#E84393)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'#fff', flexShrink:0 }}>
                    {storeName.charAt(0)}
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', flex:1 }}>{storeName}</span>
                  {sIsFuture && (
                    <span style={{ fontSize:10, padding:'2px 8px', borderRadius:6, background: sIsPublished?'rgba(0,184,148,0.12)':'rgba(108,92,231,0.1)', color: sIsPublished?'#00B894':'#6C5CE7', fontWeight:700 }}>
                      {sIsPublished ? '👁 공개' : '🔒 비공개'}
                    </span>
                  )}
                  {sIsFuture && sRequestOpen && (
                    <span style={{ fontSize:10, padding:'2px 8px', borderRadius:6, background:'rgba(255,200,0,0.12)', color:'#CC9900', fontWeight:700 }}>🙏 요청중</span>
                  )}
                  <span style={{ fontSize:11, color:'#bbb' }}>직원 {staff.length}명</span>
                  <span style={{ fontSize:11, color:'#ccc', marginLeft:4 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
                {/* 그리드 테이블 */}
                {isExpanded && (
                  <div>
                  {/* 공개/비공개 배너 */}
                  {sIsFuture && (
                    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', background: sIsPublished?'rgba(0,184,148,0.06)':'rgba(108,92,231,0.05)', borderBottom:'1px solid #ECEEF2' }}>
                      <span style={{ fontSize:12 }}>{sIsPublished ? '👁' : '🔒'}</span>
                      <span style={{ fontSize:11, fontWeight:700, color: sIsPublished?'#00B894':'#6C5CE7', flex:1 }}>{sIsPublished ? '직원에게 공개됨' : '직원에게 비공개'}</span>
                      <button onClick={async (e) => {
                        e.stopPropagation()
                        const newVal = !sIsPublished
                        await supabase.from('schedule_settings')
                          .upsert({ store_id: sid, is_published: newVal, published_month: sMonthStr, updated_at: new Date().toISOString() }, { onConflict: 'store_id' })
                        loadAll()
                      }} style={{ padding:'4px 12px', borderRadius:7, border:'none', cursor:'pointer', fontSize:11, fontWeight:700, background: sIsPublished?'rgba(232,67,147,0.1)':'rgba(0,184,148,0.15)', color: sIsPublished?'#E84393':'#00B894' }}>
                        {sIsPublished ? '🔒 비공개로' : '👁 공개하기'}
                      </button>
                    </div>
                  )}
                  {/* 휴무요청 설정바 - 전체 기능 (요청 불가일 포함) */}
                  {sIsFuture && (
                    <ManageOffRequestBar
                      sid={sid}
                      settings={sSettings}
                      isOpen={sRequestOpen}
                      year={year}
                      month={month}
                      supabase={supabase}
                      onRefresh={loadAll}
                    />
                  )}
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
                                    <button onClick={e => { e.stopPropagation(); setManageCopied(null) }}
                                      style={{ fontSize:8, background:'rgba(108,92,231,0.12)', border:'1px solid #6C5CE7', color:'#6C5CE7', borderRadius:4, padding:'1px 5px', cursor:'pointer', fontWeight:700 }}>취소</button>
                                  ) : canPaste ? (
                                    <button onClick={e => { e.stopPropagation(); handleManagePaste(sid, name) }}
                                      style={{ fontSize:8, background:'rgba(232,67,147,0.1)', border:'1px solid #E84393', color:'#E84393', borderRadius:4, padding:'1px 5px', cursor:'pointer', fontWeight:700 }}>붙여넣기</button>
                                  ) : (
                                    <button onClick={e => { e.stopPropagation(); setManageCopied({ sid, staff: name }) }}
                                      style={{ fontSize:8, background:'#F4F6F9', border:'1px solid #E0E4E8', color:'#aaa', borderRadius:4, padding:'1px 5px', cursor:'pointer' }}>복사</button>
                                  )}
                                </div>
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {allDays.map(day => {
                          const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`
                          const dow = new Date(dateStr).getDay()
                          const isToday = dateStr === today
                          const isSun = dow === 0; const isSat = dow === 6
                          const sBlockedDates = getBlockedDates(year, month+1, sSettings?.blocked_dates || [])
                          const isDayBlocked = sIsFuture && sBlockedDates.has(dateStr)
                          return (
                            <tr key={day} style={{ background: isDayBlocked ? 'rgba(200,200,200,0.08)' : isToday ? 'rgba(108,92,231,0.05)' : isSun ? 'rgba(232,67,147,0.02)' : '#fff', borderTop: dow===1&&day!==1 ? '2px solid #D0D4E8' : undefined }}>
                              <td style={{ padding:'1px 2px', borderBottom:'1px solid #F4F6F9', borderRight:'2px solid #E8ECF0', height:24, position:'sticky', left:0, background: isToday ? 'rgba(108,92,231,0.07)' : isSun ? 'rgba(232,67,147,0.05)' : isSat ? 'rgba(108,92,231,0.03)' : '#FAFBFC', zIndex:1 }}>
                                <div style={{ display:'flex', flexDirection:'row', alignItems:'center', justifyContent:'center', gap:2 }}>
                                  <span style={{ fontSize:9, fontWeight:isToday?700:400, color:isToday?'#6C5CE7':isSun?'#E84393':isSat?'#6C5CE7':'#555', lineHeight:1 }}>{day}</span>
                                  <span style={{ fontSize:7, color:isSun?'#E84393':isSat?'#6C5CE7':'#ccc', lineHeight:1 }}>{DOW_LABEL[dow]}</span>
                                </div>
                              </td>
                              {staff.map(name => {
                                const sc = schedMap[`${name}-${dateStr}`]
                                const offR = sOffReqMap[`${name}-${dateStr}`]
                                const inDrag = manageDragSel?.sid === sid && manageDragSel?.staff === name &&
                                  day >= Math.min(manageDragSel.startDay, manageDragSel.endDay) &&
                                  day <= Math.max(manageDragSel.startDay, manageDragSel.endDay)
                                // 선착순: 다른 직원이 이미 신청한 날
                                const takenByOtherM = sIsFuture && sRequestOpen && !offR
                                  ? (sOffReqs||[]).find((r:any) => r.request_date===dateStr && r.staff_name!==name && (r.status==='pending'||r.status==='approved'))
                                  : null

                                let cellBg = inDrag ? 'rgba(108,92,231,0.22)' : sc ? (sc.is_confirmed ? 'rgba(232,67,147,0.13)' : STATUS_BG[sc.status])
                                  : offR?.status==='approved' ? 'rgba(232,67,147,0.22)'
                                  : offR?.status==='pending' ? 'rgba(255,200,0,0.15)'
                                  : isDayBlocked ? 'rgba(200,200,200,0.15)'
                                  : takenByOtherM ? 'rgba(220,220,220,0.2)'
                                  : undefined

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
                                          {offR?.status==='pending' && <span style={{ fontSize:8 }}>🙏</span>}
                                          {offR?.status==='approved' && <span style={{ fontSize:8 }}>✅</span>}
                                        </div>
                                      )
                                      if (offR?.status==='approved') return (
                                        <div style={{ display:'flex', flexDirection:'column', width:'100%', height:'100%' }}>
                                          <div style={{ height:2, background:'#E84393', width:'100%' }} />
                                          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, gap:0 }}>
                                            <span style={{ fontSize:9 }}>🔒</span>
                                            <span style={{ fontSize:7, fontWeight:700, color:'#E84393' }}>확정</span>
                                          </div>
                                        </div>
                                      )
                                      if (offR?.status==='pending') return (
                                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0 }}>
                                          <span style={{ fontSize:10 }}>🙏</span>
                                          <span style={{ fontSize:7, color:'#CC9900', maxWidth:32, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={offR.reason}>{offR.reason}</span>
                                        </div>
                                      )
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
                etc: ss.filter(s => s.status === 'etc').length,
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
                        {(['work','off','half','absent','early','etc'] as const).map(s => (
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

      {/* ── 섹션 4: 승인 대기 요청 ── */}
      {section === 'requests' && (
        <div>
          {(totalPending + totalOffPending) === 0 ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:'#bbb' }}>
              <div style={{ fontSize:28, marginBottom:8 }}>✅</div>
              <div style={{ fontSize:13 }}>모든 지점 승인 대기 없음</div>
            </div>
          ) : storeItems.map((member: any) => {
            const sid = member.stores?.id
            const storeName = member.stores?.name || ''
            const d = storeData[sid]
            if (!d) return null
            const pendingOffReqs = (d.offRequests || []).filter((r: any) => r.status === 'pending')
            if (d.requests.length === 0 && pendingOffReqs.length === 0) return null
            return (
              <div key={sid} style={{ marginBottom:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <div style={{ width:24, height:24, borderRadius:6, background:'linear-gradient(135deg,#FF6B35,#E84393)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#fff', flexShrink:0 }}>
                    {storeName.charAt(0)}
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{storeName}</span>
                  {d.requests.length > 0 && <span style={{ background:'rgba(232,67,147,0.1)', color:'#E84393', borderRadius:8, padding:'1px 8px', fontSize:11, fontWeight:700 }}>📋 {d.requests.length}건</span>}
                  {pendingOffReqs.length > 0 && <span style={{ background:'rgba(255,200,0,0.12)', color:'#CC9900', borderRadius:8, padding:'1px 8px', fontSize:11, fontWeight:700 }}>🙏 {pendingOffReqs.length}건</span>}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {/* 스케줄 변경 요청 */}
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
                        <button onClick={() => handleApprove(sid, req)} disabled={approvingId === req.id}
                          style={{ flex:2, padding:'8px 0', borderRadius:9, background:'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:12, cursor:'pointer', fontWeight:700, opacity: approvingId === req.id ? 0.7 : 1 }}>
                          {approvingId === req.id ? '처리 중...' : '✓ 승인'}
                        </button>
                      </div>
                    </div>
                  ))}
                  {/* 휴무 요청 */}
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
                        <button onClick={async () => { await supabase.from('off_requests').update({ status: 'rejected' }).eq('id', req.id); loadAll() }}
                          style={{ flex:1, padding:'8px 0', borderRadius:9, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#aaa', fontSize:12, cursor:'pointer', fontWeight:600 }}>거부</button>
                        <button onClick={async () => { await supabase.from('off_requests').update({ status: 'approved' }).eq('id', req.id); loadAll() }}
                          style={{ flex:2, padding:'8px 0', borderRadius:9, background:'linear-gradient(135deg,#00B894,#6C5CE7)', border:'none', color:'#fff', fontSize:12, cursor:'pointer', fontWeight:700 }}>✓ 승인</button>
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
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════
// PC 그리드 (drag + copy-paste 추가)
// ════════════════════════════════════════
function PCGridEditor({ year, month, schedules, staffList, role, storeId, myName, onSaved, onReorderStaff, onChangeMonth, pendingCount, scheduleSettings, offRequests, nowYear, nowMonth, onOffRequestsChange, onSettingsChange }: {
  year: number; month: number; schedules: any[]
  staffList: string[]; role: string; storeId: string; myName: string
  onSaved: () => void; onReorderStaff: (newOrder: string[]) => void
  onChangeMonth: (y: number, m: number) => void
  pendingCount: number
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

  // 공개/비공개 판단
  const isPublished = scheduleSettings?.is_published || false
  const visible = isScheduleVisible(year, month, nowYear, nowMonth, isPublished, role)
  const isFuture = year > nowYear || (year === nowYear && month > nowMonth)
  const isCurrent = year === nowYear && month === nowMonth

  // 휴무요청 관련
  const requestOpen = isOffRequestOpen(scheduleSettings, year, month)
  const blockedDates = useMemo(() => getBlockedDates(year, month+1, scheduleSettings?.blocked_dates || []), [year, month, scheduleSettings])
  const offRequestMap = useMemo(() => {
    const m: Record<string, any> = {}
    offRequests.forEach(r => { m[`${r.staff_name}-${r.request_date}`] = r })
    return m
  }, [offRequests])

  // 미래달 요청기간엔 전직원 표시 (서로 요청 현황 볼 수 있게)
  const visibleStaff = (isStaff && !(isFuture && requestOpen)) ? staffList.filter(n => n === myName) : staffList

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
    const { staff, dates } = bulkTarget
    if (status === '__delete__') {
      // 삭제: in 쿼리로 한 번에
      await supabase.from('schedules').delete()
        .eq('store_id', storeId).eq('staff_name', staff).in('schedule_date', dates)
      await Promise.all(dates.map(async dateStr => {
        const prev = scheduleMap[`${staff}-${dateStr}`]
        await syncAttendance(supabase, storeId, staff, dateStr, 'work')
        await logScheduleEdit(supabase, storeId, myName, staff, dateStr, 'bulk_delete', prev?.status || null, null)
      }))
    } else {
      // upsert: 배열로 한 번에
      await supabase.from('schedules').upsert(
        dates.map(dateStr => ({ store_id: storeId, staff_name: staff, schedule_date: dateStr, status, position: null, note: null })),
        { onConflict: 'store_id,staff_name,schedule_date' }
      )
      await Promise.all(dates.map(async dateStr => {
        const prev = scheduleMap[`${staff}-${dateStr}`]
        await syncAttendance(supabase, storeId, staff, dateStr, status)
        await logScheduleEdit(supabase, storeId, myName, staff, dateStr, 'bulk_upsert', prev?.status || null, status)
      }))
    }
    setBulkTarget(null)
    onSaved()
  }

  async function handlePasteToStaff(targetStaff: string) {
    if (!copiedStaff || copiedStaff === targetStaff) return
    const src = schedules.filter(s => s.staff_name === copiedStaff)
    if (src.length === 0) { alert(`${copiedStaff}의 스케줄이 없습니다`); setCopiedStaff(null); return }
    if (!confirm(`${copiedStaff}의 스케줄(${src.length}건)을 ${targetStaff}에 붙여넣을까요?\n기존 스케줄은 덮어씌워집니다.`)) return
    // 한 번에 배열로 upsert
    await supabase.from('schedules').upsert(
      src.map(s => ({ store_id: storeId, staff_name: targetStaff, schedule_date: s.schedule_date, status: s.status, position: s.position, note: s.note })),
      { onConflict: 'store_id,staff_name,schedule_date' }
    )
    setCopiedStaff(null)
    onSaved()
  }

  function openOrderModal() { setDragOrder([...visibleStaff]); setShowOrderModal(true) }

  function exportToExcel() {
    const pad = (n: number) => String(n).padStart(2,'0')
    const DOW_KR = ['일','월','화','수','목','금','토']
    const holidays = getHolidays(year)
    // 헤더
    const headers = ['날짜', '요일', ...visibleStaff, '출근수']
    const rows = [headers]
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${monthStr}-${pad(d)}`
      const dow = new Date(dateStr).getDay()
      const holiday = holidays[dateStr] ? ` (${holidays[dateStr]})` : ''
      const row: string[] = [`${month+1}/${d}${holiday}`, DOW_KR[dow]]
      let workCnt = 0
      visibleStaff.forEach(staff => {
        const sc = scheduleMap[`${staff}-${dateStr}`]
        const offReq = offRequestMap[`${staff}-${dateStr}`]
        if (sc) {
          const label = STATUS_LABEL[sc.status] || sc.status
          const pos = sc.position ? ` [${sc.position}]` : ''
          const note = sc.note ? ` (${sc.note.replace(/^\[조퇴:\d{2}:\d{2}\]\s*/,'')})` : ''
          row.push(`${label}${pos}${note}`)
          if (sc.status==='work'||sc.status==='half'||sc.status==='early') workCnt++
        } else if (offReq?.status === 'approved') {
          row.push(`🔒휴일확정 (${offReq.reason})`)
        } else if (offReq?.status === 'pending') {
          row.push(`🙏휴무요청 (${offReq.reason})`)
        } else {
          row.push('')
        }
      })
      row.push(String(workCnt))
      rows.push(row)
    }
    // CSV 생성 (엑셀에서 열림)
    const bom = '﻿' // 한글 깨짐 방지
    const csv = bom + rows.map(r => r.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `스케줄_${year}년${month+1}월.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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

  async function handleSave(status: string, position: string, note: string, confirmed?: boolean) {
    if (!popup) return
    const prev = scheduleMap[`${popup.staff}-${popup.date}`]
    // 매니저는 확정된 셀 수정 불가
    if (isManager && prev?.is_confirmed) { alert('🔒 대표가 확정한 날은 수정할 수 없어요'); return }
    await supabase.from('schedules').upsert(
      { store_id: storeId, staff_name: popup.staff, schedule_date: popup.date, status, position: position || null, note: note || null, ...(isOwner ? { is_confirmed: confirmed ?? false } : {}) },
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
    // 매니저는 확정된 셀 요청 불가
    if (isManager && current?.is_confirmed) { alert('🔒 대표가 확정한 날은 변경 요청할 수 없어요'); return }
    await supabase.from('schedule_requests').insert({ store_id: storeId, requester_nm: myName, staff_name: popup.staff, schedule_date: popup.date, requested_status: status, current_status: current?.status || null, note: note || null })
    setPopup(null); alert('변경 요청이 전송되었습니다!')
  }

  async function handleDelete() {
    if (!popup || !popupData) return
    // 매니저는 확정된 셀 삭제 불가
    if (isManager && popupData?.is_confirmed) { alert('🔒 대표가 확정한 날은 삭제할 수 없어요'); return }
    const prev = scheduleMap[`${popup.staff}-${popup.date}`]
    await supabase.from('schedules').delete().eq('id', popupData.id)
    await syncAttendance(supabase, storeId, popup.staff, popup.date, 'work')
    await logScheduleEdit(supabase, storeId, myName, popup.staff, popup.date, 'delete', prev?.status || null, null)
    setPopup(null); onSaved()
  }

  const staffTotals = useMemo(() => {
    const t: Record<string, { work:number; off:number; half:number; absent:number; early:number; etc:number; K:number; H:number; KH:number }> = {}
    visibleStaff.forEach(s => { t[s] = { work:0, off:0, half:0, absent:0, early:0, etc:0, K:0, H:0, KH:0 } })
    schedules.forEach(s => {
      if (!t[s.staff_name]) return
      const st = s.status as string
      if (st === 'work') t[s.staff_name].work++
      else if (st === 'off') t[s.staff_name].off++
      else if (st === 'half') t[s.staff_name].half++
      else if (st === 'absent') t[s.staff_name].absent++
      else if (st === 'early') t[s.staff_name].early++
      else if (st === 'etc') t[s.staff_name].etc++
      if (s.position === 'K') t[s.staff_name].K++
      else if (s.position === 'H') t[s.staff_name].H++
      else if (s.position === 'KH') t[s.staff_name].KH++
    })
    return t
  }, [schedules, visibleStaff])

  return (
    <>
      {popup && (() => {
        const offReq = offRequestMap[`${popup.staff}-${popup.date}`]
        const isBlocked2 = isFuture && blockedDates.has(popup.date)
        const takenByOther2 = isFuture && requestOpen && !isOwner && popup.staff === myName && !offReq
          ? offRequests.find((r: any) => r.request_date === popup.date && r.staff_name !== myName && (r.status === 'pending' || r.status === 'approved')) || null
          : null
        const canReqOff = isFuture && requestOpen && !isOwner && popup.staff === myName && !isBlocked2 && !offReq && !takenByOther2
        return <CellPopup
          staffName={popup.staff} dateStr={popup.date} current={popupData}
          role={role} myName={myName}
          onSave={handleSave} onRequest={handleRequest} onDelete={handleDelete} onClose={() => setPopup(null)}
          offRequest={offReq} canRequestOff={canReqOff} isBlocked={isBlocked2}
          onOffRequest={async (reason) => {
            const pad = (n: number) => String(n).padStart(2,'0')
            const targetMonth = `${year}-${pad(month+1)}`
            await supabase.from('off_requests').insert({ store_id: storeId, staff_name: popup.staff, target_month: targetMonth, request_date: popup.date, reason, status: 'pending' })
            onOffRequestsChange()
          }}
          onOffRequestCancel={async () => {
            if (offReq) { await supabase.from('off_requests').delete().eq('id', offReq.id); onOffRequestsChange() }
          }}
          onOffRequestApprove={async () => {
            if (offReq) { await supabase.from('off_requests').update({ status: 'approved' }).eq('id', offReq.id); onOffRequestsChange() }
          }}
          onOffRequestReject={async () => {
            if (offReq) { await supabase.from('off_requests').update({ status: 'rejected' }).eq('id', offReq.id); onOffRequestsChange() }
          }}
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
          {(isOwner || isManager) && <button onClick={exportToExcel} style={{ padding:'6px 12px', borderRadius:9, background:'rgba(0,184,148,0.1)', border:'1px solid rgba(0,184,148,0.3)', color:'#00B894', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>📥 엑셀</button>}
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

      {/* ── 공개/비공개 배너 ── */}
      {isFuture && isOwner && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:12, background: isPublished ? 'rgba(0,184,148,0.08)' : 'rgba(108,92,231,0.06)', border: isPublished ? '1px solid rgba(0,184,148,0.25)' : '1px solid rgba(108,92,231,0.2)', marginBottom:10 }}>
          <span style={{ fontSize:13 }}>{isPublished ? '👁' : '🔒'}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:700, color: isPublished ? '#00B894' : '#6C5CE7' }}>{isPublished ? '직원에게 공개됨' : '직원에게 비공개 (잠김)'}</div>
            <div style={{ fontSize:10, color:'#aaa', marginTop:1 }}>{isPublished ? '직원들이 스케줄을 볼 수 있어요' : '직원들에게 스케줄이 보이지 않아요'}</div>
          </div>
          <button onClick={async () => {
            const newVal = !isPublished
            await supabase.from('schedule_settings')
              .upsert({ store_id: storeId, is_published: newVal, published_month: monthStr, updated_at: new Date().toISOString() }, { onConflict: 'store_id' })
            onSettingsChange()
          }} style={{ padding:'6px 14px', borderRadius:9, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, background: isPublished ? 'rgba(232,67,147,0.1)' : 'rgba(0,184,148,0.15)', color: isPublished ? '#E84393' : '#00B894' }}>
            {isPublished ? '🔒 비공개로' : '👁 공개하기'}
          </button>
        </div>
      )}

      {/* ── 미래달 직원 비공개 안내 배너 ── */}
      {isFuture && !isOwner && !visible && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 20px', borderRadius:14, background:'rgba(108,92,231,0.04)', border:'2px dashed rgba(108,92,231,0.2)', marginBottom:10, textAlign:'center' }}>
          <div style={{ fontSize:28, marginBottom:8 }}>📝</div>
          <div style={{ fontSize:14, fontWeight:700, color:'#6C5CE7', marginBottom:4 }}>스케줄 작성 중</div>
          <div style={{ fontSize:12, color:'#aaa' }}>대표가 스케줄을 완성하면 공개됩니다</div>
          {requestOpen && <div style={{ marginTop:10, fontSize:11, color:'#E84393', background:'rgba(232,67,147,0.08)', padding:'5px 12px', borderRadius:8, fontWeight:600 }}>🙏 지금 휴무 요청을 할 수 있어요 (셀 클릭)</div>}
        </div>
      )}

      {/* ── 오너: 휴무요청 기간 설정 ── */}
      {isFuture && isOwner && (
        <OffRequestSettingsBar
          settings={scheduleSettings}
          isActuallyOpen={requestOpen}
          year={year}
          month={month}
          onToggleOpen={async () => {
            const { error } = await supabase.from('schedule_settings')
              .upsert({ store_id: storeId, request_is_open: !requestOpen, updated_at: new Date().toISOString() }, { onConflict: 'store_id' })
            if (error) alert('저장 실패: ' + error.message)
            else onSettingsChange()
          }}
          onSaveDays={async (openDay, closeDay) => {
            const { error } = await supabase.from('schedule_settings')
              .upsert({ store_id: storeId, request_open_day: openDay, request_close_day: closeDay, updated_at: new Date().toISOString() }, { onConflict: 'store_id' })
            if (error) alert('저장 실패: ' + error.message)
            else onSettingsChange()
          }}
          onSaveBlockedDates={async (dates) => {
            const { error } = await supabase.from('schedule_settings')
              .upsert({ store_id: storeId, blocked_dates: dates, updated_at: new Date().toISOString() }, { onConflict: 'store_id' })
            if (error) alert('저장 실패: ' + error.message)
            else onSettingsChange()
          }}
        />
      )}

      <div style={{ overflowX:'auto', borderRadius:14, border:'1px solid #E8ECF0', boxShadow:'0 1px 6px rgba(0,0,0,0.05)' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', background:'#fff', fontSize:12, tableLayout:'fixed', minWidth:600, userSelect:'none' }}>
          <colgroup><col style={{ width:90 }} />{visibleStaff.map((_,i) => <col key={i} />)}<col style={{ width:44 }} /></colgroup>
          <thead>
            <tr>
              <th style={{ background:'#F8F9FB', borderBottom:'2px solid #E8ECF0', borderRight:'2px solid #E8ECF0', padding:'10px 8px', fontSize:10, color:'#aaa', fontWeight:700, textAlign:'left', position:'sticky', top:0, zIndex:3 }}>날짜</th>
              {visibleStaff.map(name => {
                // 요청기간 중 해당 직원의 미래달 요청 수 표시
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
                )
              })}
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
                    const sc = visible ? scheduleMap[`${staff}-${dateStr}`] : null
                    const offReq = offRequestMap[`${staff}-${dateStr}`]
                    const isBlocked = isFuture && blockedDates.has(dateStr)
                    const isMine = staff === myName

                    // 다른 직원이 이 날짜에 이미 신청/확정한 경우 (내 열에 표시용)
                    const takenByOther = isFuture && requestOpen && !isOwner && isMine && !offReq
                      ? offRequests.find((r: any) =>
                          r.request_date === dateStr && r.staff_name !== myName &&
                          (r.status === 'pending' || r.status === 'approved')
                        ) || null
                      : null

                    const canRequestOff = isFuture && requestOpen && !isOwner && isMine && !isBlocked && !offReq && !takenByOther
                    const clickable = canClick(staff, !!sc)
                    const inDrag = isCellInDrag(staff, day)
                    const otherCanView = isFuture && requestOpen && !isOwner && !isMine && !!offReq

                    let earlyTimeDisplay = ''
                    if (sc?.status === 'early' && sc?.note) {
                      const m = sc.note.match(/^\[조퇴:(\d{2}:\d{2})\]/)
                      if (m) earlyTimeDisplay = m[1]
                    }

                    // 셀 배경
                    let cellBg: string | undefined = sc ? (sc.is_confirmed ? 'rgba(232,67,147,0.13)' : STATUS_BG[sc.status]) : undefined
                    if (inDrag) cellBg = 'rgba(108,92,231,0.18)'
                    else if (!sc && offReq?.status === 'approved') cellBg = 'rgba(232,67,147,0.22)'
                    else if (!sc && offReq?.status === 'pending' && isMine) cellBg = 'rgba(255,200,0,0.12)'
                    else if (!sc && offReq?.status === 'pending' && !isMine) cellBg = 'rgba(108,92,231,0.05)'
                    else if (!sc && takenByOther) cellBg = 'rgba(220,220,220,0.25)'
                    else if (isBlocked) cellBg = 'rgba(200,200,200,0.1)'

                    const isNaturallyBlocked = !!takenByOther || isBlocked

                    return (
                      <td key={staff}
                        onMouseDown={e => handleCellMouseDown(staff, day, e)}
                        onMouseEnter={() => handleCellMouseEnter(staff, day)}
                        onClick={() => {
                          if (isMouseDown.current) return
                          if (dragSel) return
                          if (isNaturallyBlocked && !isOwner) return
                          if (offReq || canRequestOff || isOwner || clickable || otherCanView) setPopup({ staff, date: dateStr })
                        }}
                        style={{ borderBottom:'1px solid #ECEEF2', borderRight:'1px solid #ECEEF2', padding:0, height:44, textAlign:'center', verticalAlign:'middle', cursor: isOwner ? 'crosshair' : (canRequestOff || offReq || otherCanView) ? 'pointer' : 'default', transition:'background 0.05s', background: cellBg, outline: inDrag ? '2px solid #6C5CE7' : 'none', outlineOffset:'-2px' }}>
                        {inDrag ? (
                          <span style={{ fontSize:14, color:'#6C5CE7', fontWeight:700 }}>✓</span>
                        ) : sc ? (
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
                            {/* 상단 컬러 바 */}
                            <div style={{ height:3, background:'#E84393', borderRadius:'0 0 2px 2px', flexShrink:0 }} />
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, padding:'1px 2px', gap:1 }}>
                              <span style={{ fontSize:10 }}>🔒</span>
                              <span style={{ fontSize:9, fontWeight:700, color:'#E84393' }}>확정</span>
                              {offReq.reason && <span style={{ fontSize:7, color:'#E84393', maxWidth:60, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', opacity:0.8 }} title={offReq.reason}>{offReq.reason}</span>}
                            </div>
                          </div>
                        ) : offReq?.status === 'pending' ? (
                          isMine ? (
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0 }}>
                              <span style={{ fontSize:14, lineHeight:1.3 }}>🙏</span>
                              <span style={{ fontSize:7, color:'#CC9900', fontWeight:700, maxWidth:60, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={offReq.reason}>{offReq.reason}</span>
                            </div>
                          ) : (
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0, padding:'1px 2px' }}>
                              <span style={{ fontSize:11, lineHeight:1.3 }}>🙏</span>
                              <span style={{ fontSize:7, color:'#6C5CE7', maxWidth:60, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={offReq.reason}>{offReq.reason}</span>
                            </div>
                          )
                        ) : offReq?.status === 'rejected' && isMine ? (
                          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0 }}>
                            <span style={{ fontSize:11, lineHeight:1.2, color:'#E84393' }}>✕</span>
                            <span style={{ fontSize:7, color:'#E84393', fontWeight:700 }}>거부</span>
                          </div>
                        ) : takenByOther ? (
                          // 다른 직원이 신청한 날 → 내 열에 자연스럽게 비워 보임 (클릭 안 됨)
                          null
                        ) : isBlocked ? (
                          null
                        ) : canRequestOff ? (
                          <span style={{ fontSize:18, color:'#e0e0e0', lineHeight:1 }}>+</span>
                        ) : clickable ? (
                          <span style={{ fontSize:18, color:'#e0e0e0', lineHeight:1 }}>+</span>
                        ) : null}
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
                      {t.etc > 0 && <span style={{ fontSize:9, color:'#8E44AD' }}>기{t.etc}</span>}
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
function MobileGridEditor({ year, month, schedules, staffList, role, storeId, myName, onSaved, onChangeMonth, pendingCount, scheduleSettings, offRequests, nowYear, nowMonth, onOffRequestsChange, onSettingsChange }: {
  year: number; month: number; schedules: any[]; staffList: string[]; role: string; storeId: string; myName: string
  onSaved: () => void; onChangeMonth: (y: number, m: number) => void; pendingCount: number
  scheduleSettings: any; offRequests: any[]; nowYear: number; nowMonth: number
  onOffRequestsChange: () => void; onSettingsChange: () => void
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
  const canEdit = isOwner || isManager
  const isPublished = scheduleSettings?.is_published || false
  const visible = isScheduleVisible(year, month, nowYear, nowMonth, isPublished, role)
  const isFuture = year > nowYear || (year === nowYear && month > nowMonth)
  const requestOpen = isOffRequestOpen(scheduleSettings, year, month)
  const blockedDates = useMemo(() => getBlockedDates(year, month+1, scheduleSettings?.blocked_dates || []), [year, month, scheduleSettings])
  const offRequestMap = useMemo(() => {
    const m: Record<string, any> = {}
    offRequests.forEach((r: any) => { m[`${r.staff_name}-${r.request_date}`] = r })
    return m
  }, [offRequests])
  const visibleStaff = (isStaff && !(isFuture && requestOpen)) ? staffList.filter(n => n===myName) : staffList
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

  async function handleSave(status: string, position: string, note: string, confirmed?: boolean) {
    if (!popup) return
    const prev = scheduleMap[`${popup.staff}-${popup.date}`]
    if (isManager && prev?.is_confirmed) { alert('🔒 대표가 확정한 날은 수정할 수 없어요'); return }
    await supabase.from('schedules').upsert(
      { store_id: storeId, staff_name: popup.staff, schedule_date: popup.date, status, position: position||null, note: note||null, ...(isOwner ? { is_confirmed: confirmed ?? false } : {}) },
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
        etc: ss.filter(s=>s.status==='etc').length,
        K: ss.filter(s=>s.position==='K').length, H: ss.filter(s=>s.position==='H').length, KH: ss.filter(s=>s.position==='KH').length,
      }
    })
  }, [schedules, visibleStaff])

  return (
    <div>
      {popup && (() => {
        const offReq = offRequestMap[`${popup.staff}-${popup.date}`]
        const isBlocked2 = isFuture && blockedDates.has(popup.date)
        const takenByOther2 = isFuture && requestOpen && !isOwner && popup.staff === myName && !offReq
          ? offRequests.find((r: any) => r.request_date === popup.date && r.staff_name !== myName && (r.status === 'pending' || r.status === 'approved')) || null
          : null
        const canReqOff = isFuture && requestOpen && !isOwner && popup.staff === myName && !isBlocked2 && !offReq && !takenByOther2
        return <CellPopup
          staffName={popup.staff} dateStr={popup.date} current={popupData}
          role={role} myName={myName}
          onSave={handleSave} onRequest={handleRequest} onDelete={handleDelete} onClose={() => setPopup(null)}
          offRequest={offReq} canRequestOff={canReqOff} isBlocked={isBlocked2}
          onOffRequest={async (reason) => {
            const pad = (n: number) => String(n).padStart(2,'0')
            const targetMonth = `${year}-${pad(month+1)}`
            await supabase.from('off_requests').insert({ store_id: storeId, staff_name: popup.staff, target_month: targetMonth, request_date: popup.date, reason, status: 'pending' })
            onOffRequestsChange()
          }}
          onOffRequestCancel={async () => {
            if (offReq) { await supabase.from('off_requests').delete().eq('id', offReq.id); onOffRequestsChange() }
          }}
          onOffRequestApprove={async () => {
            if (offReq) { await supabase.from('off_requests').update({ status: 'approved' }).eq('id', offReq.id); onOffRequestsChange() }
          }}
          onOffRequestReject={async () => {
            if (offReq) { await supabase.from('off_requests').update({ status: 'rejected' }).eq('id', offReq.id); onOffRequestsChange() }
          }}
        />
      })()}
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
                const offReqM = offRequestMap[`${staff}-${dateStr}`]
                const isMineM = staff === myName
                const isBlockedM = isFuture && blockedDates.has(dateStr)
                const takenByOtherM = isFuture && requestOpen && !isOwner && isMineM && !offReqM
                  ? offRequests.find((r: any) => r.request_date === dateStr && r.staff_name !== myName && (r.status === 'pending' || r.status === 'approved')) || null
                  : null
                const canReqOffM = isFuture && requestOpen && !isOwner && isMineM && !isBlockedM && !offReqM && !takenByOtherM
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
                // 모바일 셀 배경
                let mobileBg = isSelected ? 'rgba(108,92,231,0.2)' : s ? (s.is_confirmed ? 'rgba(232,67,147,0.13)' : STATUS_BG[s.status]) : isToday?'rgba(108,92,231,0.03)':isSun||isSat?'#FAFBFC':'#fff'
                if (!s && offReqM?.status === 'approved') mobileBg = 'rgba(232,67,147,0.22)'
                else if (!s && offReqM?.status === 'pending' && isMineM) mobileBg = 'rgba(255,200,0,0.12)'
                else if (!s && offReqM?.status === 'pending' && !isMineM) mobileBg = 'rgba(108,92,231,0.05)'
                else if (!s && takenByOtherM) mobileBg = 'rgba(220,220,220,0.25)'

                const isNatBlockedM = !!takenByOtherM || isBlockedM

                return (
                  <div key={day}
                    onClick={() => {
                      if (multiMode && (isOwner || isManager)) { toggleSelectCell(staff, dateStr); return }
                      if (isNatBlockedM && !isOwner) return
                      if (offReqM || canReqOffM || clickable || (!isMineM && offReqM)) setPopup({staff, date:dateStr})
                      else if (clickable) setPopup({staff, date:dateStr})
                    }}
                    style={{ minWidth:44, flexShrink:0, borderRight:'1px solid #F0F2F5', minHeight:52,
                      background: mobileBg,
                      cursor: (multiMode && canEdit) ? 'pointer' : (canReqOffM || offReqM || clickable) ? 'pointer' : 'default',
                      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:1,
                      outline: isSelected ? '2px solid #6C5CE7' : 'none', outlineOffset:'-2px' }}>
                    {isSelected ? (
                      <span style={{ fontSize:16, color:'#6C5CE7', fontWeight:700 }}>✓</span>
                    ) : s ? (
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
                        <span style={{ fontSize:10 }}>🔒</span>
                        <span style={{ fontSize:8, fontWeight:700, color:'#E84393' }}>확정</span>
                        {offReqM.reason && <span style={{ fontSize:7, color:'#E84393', maxWidth:38, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const, opacity:0.8 }} title={offReqM.reason}>{offReqM.reason}</span>}
                      </div>
                    ) : offReqM?.status === 'pending' ? (
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0 }}>
                        <span style={{ fontSize:12 }}>🙏</span>
                        <span style={{ fontSize:7, color: isMineM?'#CC9900':'#6C5CE7', maxWidth:40, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }} title={offReqM.reason}>{offReqM.reason}</span>
                      </div>
                    ) : takenByOtherM ? (
                      null
                    ) : (multiMode && canEdit) ? (
                      <span style={{ fontSize:14, color:'#d0d0d0' }}>+</span>
                    ) : canReqOffM ? (
                      <span style={{ fontSize:16, color:'#ebebeb' }}>+</span>
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
            {(['work','off','half','absent','early','etc'] as const).map(s => (
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
                    {s.etc > 0 && <span style={{ fontSize:11, color:'#8E44AD', fontWeight:700 }}>기타 {s.etc}</span>}
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
    const pad = (n: number) => String(n).padStart(2,'0')
    const targetMonth = `${y}-${pad(m+1)}`
    const { data } = await supabase.from('off_requests').select('*').eq('store_id', sid).eq('target_month', targetMonth)
    setOffRequests(data || [])
  }

  async function loadData(sid: string, y: number, m: number) {
    const pad = (n: number) => String(n).padStart(2,'0')
    const { data } = await supabase.from('schedules').select('*').eq('store_id',sid).gte('schedule_date',`${y}-${pad(m+1)}-01`).lte('schedule_date',`${y}-${pad(m+1)}-${pad(getDaysInMonth(y,m))}`).order('schedule_date')
    setSchedules(data||[])
  }

  async function loadStaff(sid: string, y?: number, m?: number) {
    const targetYear = y ?? calYear
    const targetMonth = m ?? calMonth
    const pad = (n: number) => String(n).padStart(2,'0')
    const startDate = `${targetYear}-${pad(targetMonth+1)}-01`
    const endDate = `${targetYear}-${pad(targetMonth+1)}-${pad(getDaysInMonth(targetYear, targetMonth))}`

    const [activeRes, inactiveRes, schedRes] = await Promise.all([
      supabase.from('store_members').select('profile_id, sort_order, profiles(nm)').eq('store_id', sid).eq('active', true),
      supabase.from('store_members').select('profile_id, profiles(nm)').eq('store_id', sid).eq('active', false),
      supabase.from('schedules').select('staff_name').eq('store_id', sid).gte('schedule_date', startDate).lte('schedule_date', endDate),
    ])

    const members = (activeRes.data||[]).map((m: any) => ({ nm: m.profiles?.nm||'', sort_order: m.sort_order ?? 9999 })).filter(m => m.nm)
    const hasDbOrder = members.some(m => m.sort_order !== 9999)

    let activeNames: string[]
    if (hasDbOrder) {
      members.sort((a, b) => a.sort_order - b.sort_order)
      activeNames = members.map(m => m.nm)
    } else {
      const names = members.map(m => m.nm)
      const savedOrder: string[] = JSON.parse(localStorage.getItem(`staff_order_${sid}`)||'[]')
      if (savedOrder.length > 0) {
        activeNames = [...savedOrder.filter((n:string)=>names.includes(n)), ...names.filter((n:string)=>!savedOrder.includes(n)).sort()]
      } else {
        activeNames = names.sort()
      }
    }

    // 비활성 직원 중 당월 스케줄 있는 경우 맨 뒤에 추가
    const schedNames = new Set((schedRes.data||[]).map((s: any) => s.staff_name))
    const inactiveWithSched = (inactiveRes.data||[])
      .map((m: any) => m.profiles?.nm||'')
      .filter((nm: string) => nm && !activeNames.includes(nm) && schedNames.has(nm))

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

  const isOwner = role === 'owner'

  const nowYear = nowD.getFullYear()
  const nowMonth = nowD.getMonth()

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