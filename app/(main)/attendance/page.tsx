'use client'
import { useEffect, useState, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const supabase = createSupabaseBrowserClient()

function pad(n: number) { return String(n).padStart(2, '0') }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
function fmtTime(ts: string | null) {
  if (!ts) return null
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fmtDuration(inTs: string, outTs: string) {
  const diff = Math.floor((new Date(outTs).getTime() - new Date(inTs).getTime()) / 60000)
  const h = Math.floor(diff / 60), m = diff % 60
  return `${h}시간${m > 0 ? ` ${m}분` : ''}`
}
function timeToMinutes(t: string | null | undefined): number {
  if (!t) return -1
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function tsToMinutes(ts: string | null | undefined): number {
  if (!ts) return -1
  const d = new Date(ts)
  return d.getHours() * 60 + d.getMinutes()
}
function isPastDate(dateStr: string, today: string): boolean {
  return dateStr < today
}
function fmtW(n: number) {
  if (n >= 100000000) return (n / 100000000).toFixed(1).replace(/\.0$/, '') + '억원'
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '만원'
  return n.toLocaleString('ko-KR') + '원'
}
function getRateColor(rate: number) {
  return rate >= 100 ? '#00B894' : rate >= 80 ? '#FF6B35' : rate >= 60 ? '#F39C12' : '#E84393'
}

// 공휴일 (목표 페이지와 동일)
const KR_HOLIDAYS: Record<string, string> = {
  '0101':'신정','0301':'삼일절','0505':'어린이날','0606':'현충일',
  '0815':'광복절','1003':'개천절','1009':'한글날','1225':'크리스마스','0501':'근로자의날',
  '20250128':'설 전날','20250129':'설날','20250130':'설 다음날',
  '20250506':'대체공휴일','20250605':'대체공휴일',
  '20251005':'추석 전날','20251006':'추석','20251007':'추석 다음날','20251008':'대체공휴일',
  '20260216':'설 전날','20260217':'설날','20260218':'설 다음날',
  '20260302':'대체공휴일','20260524':'부처님오신날',
  '20260924':'추석 전날','20260925':'추석','20260926':'추석 다음날',
  '20270206':'설 전날','20270207':'설날','20270208':'설 다음날',
  '20270513':'부처님오신날',
  '20271014':'추석 전날','20271015':'추석','20271016':'추석 다음날',
}
function isRedDay(y: number, m: number, d: number): boolean {
  const dow = new Date(y, m - 1, d).getDay()
  const mmdd = `${pad(m)}${pad(d)}`
  const full  = `${y}${mmdd}`
  return dow === 0 || dow === 6 || !!(KR_HOLIDAYS[full] || KR_HOLIDAYS[mmdd])
}

// Issue 타입 (목표 페이지와 동일)
type Issue = { id: string; text: string; imageUrl?: string; imageBase64?: string }

// ★ 이번 달 전체 지적사항 파싱 (모든 주차 합산)
function parseAllMonthIssues(raw: any): Issue[] {
  if (!raw) return []
  const result: Issue[] = []
  try {
    for (const key of Object.keys(raw)) {
      const val = raw[key]
      if (Array.isArray(val)) {
        val.filter((v: any) => v && v.id && v.text).forEach((v: any) => result.push(v))
      } else if (val && typeof val === 'object') {
        if (val.issue1?.trim()) result.push({ id: `legacy1_${key}`, text: val.issue1 })
        if (val.issue2?.trim()) result.push({ id: `legacy2_${key}`, text: val.issue2 })
      }
    }
  } catch(e) {}
  return result
}

function parseWeekIssues(raw: any): Record<number, Issue[]> {
  if (!raw) return {}
  const result: Record<number, Issue[]> = {}
  try {
    for (const key of Object.keys(raw)) {
      const val = raw[key]; const weekNum = Number(key)
      if (Array.isArray(val)) {
        result[weekNum] = val.filter((v: any) => v && v.id && v.text)
      } else if (val && typeof val === 'object') {
        const items: Issue[] = []
        if (val.issue1?.trim()) items.push({ id: 'legacy1', text: val.issue1 })
        if (val.issue2?.trim()) items.push({ id: 'legacy2', text: val.issue2 })
        result[weekNum] = items
      }
    }
  } catch(e) {}
  return result
}

const DOW = ['일','월','화','수','목','금','토']
const DOW_KR = ['일요일','월요일','화요일','수요일','목요일','금요일','토요일']

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  normal:      { label: '정상',         color: '#00B894', bg: 'rgba(0,184,148,0.1)',    icon: '✅' },
  late:        { label: '지각',         color: '#E84393', bg: 'rgba(232,67,147,0.1)',   icon: '🔴' },
  early:       { label: '조기퇴근',     color: '#6C5CE7', bg: 'rgba(108,92,231,0.1)',   icon: '🌙' },
  late_early:  { label: '지각+조기퇴근',color: '#E84393', bg: 'rgba(232,67,147,0.15)', icon: '⚠️' },
  absent:      { label: '결근',         color: '#b2bec3', bg: 'rgba(178,190,195,0.15)',icon: '❌' },
  no_clockout: { label: '퇴근누락',     color: '#b8860b', bg: 'rgba(253,203,110,0.15)',icon: '⏰' },
  no_clockin:  { label: '출근누락',     color: '#FF6B35', bg: 'rgba(255,107,53,0.15)', icon: '🚫' },
  working:     { label: '근무중',       color: '#FF6B35', bg: 'rgba(255,107,53,0.1)',   icon: '💼' },
  pending:     { label: '대기',         color: '#bbb',    bg: 'rgba(170,170,170,0.08)',icon: '⏳' },
}

const bx: React.CSSProperties = {
  background: '#fff', borderRadius: 16, border: '1px solid #E8ECF0',
  padding: 18, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
}

// ══════════════════════════════════════
// 직원 근태 수정 모달 (대표 전용)
// ══════════════════════════════════════
function StaffAttendanceEditModal({ item, storeId, workDate, onClose, onSaved }: {
  item: any; storeId: string; workDate: string; onClose: () => void; onSaved: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [scheduleStatus, setScheduleStatus] = useState<string>(item.scheduleStatus || 'work')
  function tsToHHMM(ts: string | null) {
    if (!ts) return ''
    const d = new Date(ts)
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }
  const [clockIn,  setClockIn]  = useState(tsToHHMM(item.att?.clock_in  || null))
  const [clockOut, setClockOut] = useState(tsToHHMM(item.att?.clock_out || null))
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await supabase.from('schedules').update({ status: scheduleStatus })
        .eq('store_id', storeId).eq('staff_name', item.nm).eq('schedule_date', workDate)
      if (scheduleStatus === 'absent') {
        if (item.att?.id) {
          await supabase.from('attendance').update({ status: 'absent', clock_in: null, clock_out: null }).eq('id', item.att.id)
        } else if (item.pid) {
          await supabase.from('attendance').upsert({ profile_id: item.pid, store_id: storeId, work_date: workDate, status: 'absent', clock_in: null, clock_out: null }, { onConflict: 'profile_id,store_id,work_date' })
        }
      } else if (item.pid) {
        function toISO(hhmm: string) { if (!hhmm) return null; return `${workDate}T${hhmm}:00+09:00` }
        const newIn = toISO(clockIn), newOut = toISO(clockOut)
        const isLate  = item.expected_in  && newIn  ? (new Date(newIn).getHours()*60+new Date(newIn).getMinutes())   > timeToMinutes(item.expected_in)  : false
        const isEarly = item.expected_out && newOut ? (new Date(newOut).getHours()*60+new Date(newOut).getMinutes()) < timeToMinutes(item.expected_out) : false
        let newStatus = 'normal'
        if (isLate && isEarly) newStatus = 'late_early'
        else if (isLate)  newStatus = 'late'
        else if (isEarly) newStatus = 'early'
        else if (newIn && !newOut) newStatus = 'working'
        if (item.att?.id) {
          await supabase.from('attendance').update({ clock_in: newIn, clock_out: newOut || null, status: newStatus }).eq('id', item.att.id)
        } else if (newIn) {
          await supabase.from('attendance').upsert({ profile_id: item.pid, store_id: storeId, work_date: workDate, clock_in: newIn, clock_out: newOut || null, status: newStatus }, { onConflict: 'profile_id,store_id,work_date' })
        }
        const syncStatus = newStatus === 'working' ? 'work' : newStatus === 'absent' ? 'absent' : scheduleStatus
        if (syncStatus !== scheduleStatus) {
          await supabase.from('schedules').update({ status: syncStatus }).eq('store_id', storeId).eq('staff_name', item.nm).eq('schedule_date', workDate)
        }
      }
      onSaved(); onClose()
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:2000, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:24, paddingBottom:44 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#FF6B35,#E84393)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:15 }}>{item.nm?.charAt(0)}</div>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:'#1a1a2e' }}>{item.nm}</div>
              <div style={{ fontSize:11, color:'#aaa' }}>기준 {item.expected_in||'--'} ~ {item.expected_out||'--'}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#888', marginBottom:8 }}>📋 스케줄 상태</div>
          <div style={{ display:'flex', gap:8 }}>
            {[{v:'work',l:'근무',color:'#00B894'},{v:'half',l:'반차',color:'#6C5CE7'},{v:'absent',l:'결근',color:'#b2bec3'}].map(opt => (
              <button key={opt.v} onClick={() => setScheduleStatus(opt.v)}
                style={{ flex:1, padding:'10px 0', borderRadius:10, border:`2px solid ${scheduleStatus===opt.v?opt.color:'#E8ECF0'}`, background:scheduleStatus===opt.v?`${opt.color}15`:'#fff', color:scheduleStatus===opt.v?opt.color:'#aaa', fontSize:13, fontWeight:700, cursor:'pointer' }}>{opt.l}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:22, opacity: scheduleStatus==='absent' ? 0.35 : 1 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#888', marginBottom:8 }}>🕐 출퇴근 시간</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <div style={{ fontSize:11, color:'#aaa', marginBottom:5 }}>출근</div>
              <input type="time" value={clockIn} onChange={e => setClockIn(e.target.value)} disabled={scheduleStatus==='absent'} style={{ width:'100%', padding:'11px 12px', borderRadius:10, border:'1px solid #E8ECF0', background:'#F8F9FB', fontSize:14, color:'#1a1a2e', outline:'none', boxSizing:'border-box' }} />
            </div>
            <div>
              <div style={{ fontSize:11, color:'#aaa', marginBottom:5 }}>퇴근</div>
              <input type="time" value={clockOut} onChange={e => setClockOut(e.target.value)} disabled={scheduleStatus==='absent'} style={{ width:'100%', padding:'11px 12px', borderRadius:10, border:'1px solid #E8ECF0', background:'#F8F9FB', fontSize:14, color:'#1a1a2e', outline:'none', boxSizing:'border-box' }} />
            </div>
          </div>
          {clockIn && clockOut && scheduleStatus !== 'absent' && <div style={{ marginTop:8, fontSize:11, color:'#4a6cf7', fontWeight:600 }}>⚡ 저장 시 기준시간 대비 지각·조퇴 자동 계산됩니다</div>}
        </div>
        <button onClick={save} disabled={saving} style={{ width:'100%', padding:14, borderRadius:12, border:'none', background:'linear-gradient(135deg,#FF6B35,#E84393)', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? '저장 중...' : '💾 저장'}
        </button>
      </div>
    </div>
  )
}

// ══════════════════════════════════════
// 직원별 근무시간 설정 모달 (대표만)
// ══════════════════════════════════════
function StaffScheduleModal({ staff, storeId, onClose, onSaved }: {
  staff: { id: string; nm: string; expected_in?: string; expected_out?: string }
  storeId: string; onClose: () => void; onSaved: () => void
}) {
  const [inTime,  setInTime]  = useState(staff.expected_in  || '')
  const [outTime, setOutTime] = useState(staff.expected_out || '')
  const [saving,  setSaving]  = useState(false)
  async function save() {
    setSaving(true)
    await supabase.from('store_members').update({ expected_clock_in: inTime || null, expected_clock_out: outTime || null }).eq('store_id', storeId).eq('profile_id', staff.id)
    setSaving(false); onSaved(); onClose()
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:24, paddingBottom:44 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>⏰ {staff.nm} 근무시간 설정</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ background:'rgba(255,107,53,0.06)', borderRadius:10, padding:'10px 12px', marginBottom:16, fontSize:12, color:'#FF6B35', fontWeight:600 }}>
          ⚡ 설정 시간 기준으로 지각·조기퇴근·퇴근누락이 자동 판단됩니다
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
          <div>
            <div style={{ fontSize:11, color:'#aaa', fontWeight:600, marginBottom:6 }}>출근 기준시간</div>
            <input type="time" value={inTime} onChange={e => setInTime(e.target.value)} style={{ width:'100%', padding:'12px', borderRadius:10, border:'1px solid #E8ECF0', background:'#F8F9FB', fontSize:14, color:'#1a1a2e', outline:'none', boxSizing:'border-box' }} />
            <div style={{ fontSize:10, color:'#bbb', marginTop:4 }}>이 시간 이후 출근 → 지각</div>
          </div>
          <div>
            <div style={{ fontSize:11, color:'#aaa', fontWeight:600, marginBottom:6 }}>퇴근 기준시간</div>
            <input type="time" value={outTime} onChange={e => setOutTime(e.target.value)} style={{ width:'100%', padding:'12px', borderRadius:10, border:'1px solid #E8ECF0', background:'#F8F9FB', fontSize:14, color:'#1a1a2e', outline:'none', boxSizing:'border-box' }} />
            <div style={{ fontSize:10, color:'#bbb', marginTop:4 }}>이 시간 이전 퇴근 → 조기퇴근</div>
          </div>
        </div>
        <button onClick={save} disabled={saving} style={{ width:'100%', padding:14, borderRadius:12, border:'none', background:'linear-gradient(135deg,#FF6B35,#E84393)', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? '저장 중...' : '💾 저장'}
        </button>
      </div>
    </div>
  )
}

function StaffTimePanel({ storeId, staffList, onClose, onSaved }: {
  storeId: string; staffList: any[]; onClose: () => void; onSaved: () => void
}) {
  const [selected, setSelected] = useState<any>(null)
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, paddingBottom:44, maxHeight:'80vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>⏰ 직원별 근무시간 설정</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ background:'rgba(232,67,147,0.05)', borderRadius:10, padding:'8px 12px', marginBottom:14, fontSize:11, color:'#E84393', fontWeight:600 }}>👑 대표만 설정 가능합니다</div>
        {staffList.map(s => (
          <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', background:'#F8F9FB', borderRadius:12, marginBottom:8 }}>
            <div style={{ width:36, height:36, borderRadius:10, flexShrink:0, background:'linear-gradient(135deg,#FF6B35,#E84393)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:'#fff' }}>{s.nm?.charAt(0)}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{s.nm}</div>
              <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>{s.expected_in?`출근기준 ${s.expected_in}`:'출근 미설정'}{' · '}{s.expected_out?`퇴근기준 ${s.expected_out}`:'퇴근 미설정'}</div>
            </div>
            <button onClick={() => setSelected(s)} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #E8ECF0', background:'#fff', color:'#6C5CE7', fontSize:12, fontWeight:700, cursor:'pointer' }}>설정</button>
          </div>
        ))}
      </div>
      {selected && <StaffScheduleModal staff={selected} storeId={storeId} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); onSaved() }} />}
    </div>
  )
}

function RequestModal({ today, onClose, onSubmit }: {
  today: string; onClose: () => void
  onSubmit: (type: string, ci: string, co: string, reason: string) => void
}) {
  const [type,   setType]   = useState<'clock_in'|'clock_out'|'both'>('clock_in')
  const [ci,     setCi]     = useState('')
  const [co,     setCo]     = useState('')
  const [reason, setReason] = useState('')
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:24, paddingBottom:44 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>✏️ 출퇴근 수정 요청</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ background:'rgba(108,92,231,0.06)', borderRadius:10, padding:'10px 12px', marginBottom:16, fontSize:12, color:'#6C5CE7', fontWeight:600 }}>📋 요청 후 대표 승인 시 반영됩니다</div>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, color:'#aaa', fontWeight:600, marginBottom:8 }}>요청 유형</div>
          <div style={{ display:'flex', gap:8 }}>
            {([{v:'clock_in',l:'출근 누락'},{v:'clock_out',l:'퇴근 누락'},{v:'both',l:'출퇴근 모두'}] as const).map(o => (
              <button key={o.v} onClick={() => setType(o.v)} style={{ flex:1, padding:'8px 0', borderRadius:10, cursor:'pointer', border:type===o.v?'1.5px solid #6C5CE7':'1px solid #E8ECF0', background:type===o.v?'rgba(108,92,231,0.08)':'#F8F9FB', color:type===o.v?'#6C5CE7':'#888', fontSize:12, fontWeight:type===o.v?700:400 }}>{o.l}</button>
            ))}
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns: type==='both' ? '1fr 1fr' : '1fr', gap:10, marginBottom:14 }}>
          {(type==='clock_in'||type==='both') && <div><div style={{ fontSize:11, color:'#aaa', fontWeight:600, marginBottom:6 }}>출근 시간</div><input type="time" value={ci} onChange={e => setCi(e.target.value)} style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid #E8ECF0', background:'#F8F9FB', fontSize:14, color:'#1a1a2e', outline:'none', boxSizing:'border-box' }} /></div>}
          {(type==='clock_out'||type==='both') && <div><div style={{ fontSize:11, color:'#aaa', fontWeight:600, marginBottom:6 }}>퇴근 시간</div><input type="time" value={co} onChange={e => setCo(e.target.value)} style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid #E8ECF0', background:'#F8F9FB', fontSize:14, color:'#1a1a2e', outline:'none', boxSizing:'border-box' }} /></div>}
        </div>
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, color:'#aaa', fontWeight:600, marginBottom:6 }}>사유</div>
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="수정이 필요한 사유를 입력해주세요" rows={3} style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid #E8ECF0', background:'#F8F9FB', fontSize:13, color:'#1a1a2e', outline:'none', resize:'none', boxSizing:'border-box' }} />
        </div>
        <button onClick={() => { if (!reason.trim()) return alert('사유를 입력해주세요'); onSubmit(type, ci, co, reason) }} style={{ width:'100%', padding:14, borderRadius:12, border:'none', background:'linear-gradient(135deg,#6C5CE7,#E84393)', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer' }}>요청 보내기</button>
      </div>
    </div>
  )
}

function OwnerRequestPanel({ storeId, onClose, onApproved }: {
  storeId: string; onClose: () => void; onApproved: () => void
}) {
  const [requests, setRequests] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  useEffect(() => { loadRequests() }, [])
  async function loadRequests() {
    const { data: reqs } = await supabase.from('attendance_requests').select('*').eq('store_id', storeId).eq('status', 'pending').order('created_at', { ascending: false })
    if (!reqs || reqs.length === 0) { setRequests([]); setLoading(false); return }
    const pids = [...new Set(reqs.map((r: any) => r.profile_id))]
    const { data: profs } = await supabase.from('profiles').select('id, nm').in('id', pids)
    const profMap: Record<string, string> = {}
    ;(profs || []).forEach((p: any) => { profMap[p.id] = p.nm })
    setRequests(reqs.map((r: any) => ({ ...r, profiles: { nm: profMap[r.profile_id] || '(이름없음)' } })))
    setLoading(false)
  }
  async function approve(req: any) {
    const { data: existing } = await supabase.from('attendance').select('*').eq('store_id', storeId).eq('profile_id', req.profile_id).eq('work_date', req.work_date).maybeSingle()
    const updates: any = {}
    if (req.request_type==='clock_in' ||req.request_type==='both') updates.clock_in  = req.requested_clock_in
    if (req.request_type==='clock_out'||req.request_type==='both') updates.clock_out = req.requested_clock_out
    if (existing) await supabase.from('attendance').update(updates).eq('id', existing.id)
    else await supabase.from('attendance').insert({ store_id:storeId, profile_id:req.profile_id, work_date:req.work_date, status:'normal', ...updates })
    await supabase.from('attendance_requests').update({ status:'approved' }).eq('id', req.id)
    loadRequests(); onApproved()
  }
  async function reject(req: any) {
    await supabase.from('attendance_requests').update({ status:'rejected' }).eq('id', req.id)
    loadRequests()
  }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, paddingBottom:44, maxHeight:'80vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>✏️ 수정 요청 처리</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>
        {loading ? <div style={{ textAlign:'center', padding:40, color:'#bbb' }}>로딩중...</div>
        : requests.length === 0 ? <div style={{ textAlign:'center', padding:40, color:'#bbb' }}><div style={{ fontSize:24, marginBottom:8 }}>✅</div><div style={{ fontSize:13 }}>대기 중인 요청이 없습니다</div></div>
        : requests.map(req => (
          <div key={req.id} style={{ background:'#F8F9FB', borderRadius:14, padding:14, marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{req.profiles?.nm}</span>
              <span style={{ fontSize:11, color:'#aaa' }}>{req.work_date}</span>
            </div>
            <div style={{ fontSize:11, color:'#6C5CE7', fontWeight:600, marginBottom:6 }}>{req.request_type==='clock_in'?'출근 누락':req.request_type==='clock_out'?'퇴근 누락':'출퇴근 모두'}</div>
            {req.requested_clock_in  && <div style={{ fontSize:12, color:'#555', marginBottom:2 }}>출근: {fmtTime(req.requested_clock_in)}</div>}
            {req.requested_clock_out && <div style={{ fontSize:12, color:'#555', marginBottom:2 }}>퇴근: {fmtTime(req.requested_clock_out)}</div>}
            {req.reason && <div style={{ fontSize:11, color:'#888', padding:'6px 10px', background:'#fff', borderRadius:8, marginTop:6, marginBottom:8 }}>📝 {req.reason}</div>}
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button onClick={() => reject(req)} style={{ flex:1, padding:'8px 0', borderRadius:10, border:'1px solid #E8ECF0', background:'#fff', color:'#888', fontSize:12, fontWeight:600, cursor:'pointer' }}>❌ 거절</button>
              <button onClick={() => approve(req)} style={{ flex:2, padding:'8px 0', borderRadius:10, border:'none', background:'linear-gradient(135deg,#FF6B35,#E84393)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>✅ 승인</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// 메인
// ════════════════════════════════════════
export default function AttendancePage() {
  const today   = toDateStr(new Date())
  const nowDate = new Date()
  const todayDow = nowDate.getDay()

  const [profileId, setProfileId] = useState('')
  const [storeId,   setStoreId]   = useState('')
  const [myName,    setMyName]    = useState('')
  const [role,      setRole]      = useState('staff')

  const isOwner   = role === 'owner'
  const canSeeAll = role === 'owner' || role === 'manager'

  const [currentIp, setCurrentIp] = useState('')
  const [allowedIp, setAllowedIp] = useState('')
  const [ipLoading, setIpLoading] = useState(true)
  const wifiOk = !!allowedIp && currentIp === allowedIp

  const [closingTodos,   setClosingTodos]   = useState<any[]>([])
  const [checkedClosing, setCheckedClosing] = useState<Set<string>>(new Set())
  const [overdueTodos,   setOverdueTodos]   = useState<any[]>([])
  const [checkedOverdue, setCheckedOverdue] = useState<Set<string>>(new Set())
  const [todayTodos,     setTodayTodos]     = useState<any[]>([])
  const [checkedToday,   setCheckedToday]   = useState<Set<string>>(new Set())

  // ★ 이번 주 지적사항
  const [weekIssueList, setWeekIssueList] = useState<Issue[]>([])
  const [issueAcked,    setIssueAcked]    = useState(false)

  // ★ 오늘 목표 매출
  const [todayGoal,  setTodayGoal]  = useState(0)
  const [goalLoaded, setGoalLoaded] = useState(false)
  const [goalAcked,  setGoalAcked]  = useState(false)  // 오늘 목표 확인 체크

  const allTodos = [
    ...closingTodos.map(t => `c-${t.id}`),
    ...overdueTodos.map(t => `o-${t.id}`),
    ...todayTodos.map(t => `t-${t.id}`),
  ]
  const allCheckedIds = new Set([
    ...[...checkedClosing].map(id => `c-${id}`),
    ...[...checkedOverdue].map(id => `o-${id}`),
    ...[...checkedToday].map(id => `t-${id}`),
  ])
  const allChecked = allTodos.length === 0 || allTodos.every(id => allCheckedIds.has(id))

  const [todaySchedule, setTodaySchedule]   = useState<any>(null)
  const [attendance,    setAttendance]       = useState<any>(null)
  const [attLoading,    setAttLoading]       = useState(true)
  const [boardList,     setBoardList]        = useState<any[]>([])
  const [tab, setTab] = useState<'today'|'history'|'all'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('att_tab')
      if (saved === 'today' || saved === 'history' || saved === 'all') return saved as any
    }
    return 'today'
  })

  const [allStores,        setAllStores]        = useState<any[]>([])
  const [allStoresBoard,   setAllStoresBoard]   = useState<Record<string, any[]>>({})
  const [allStoresLoading, setAllStoresLoading] = useState(false)
  const [allView,          setAllView]          = useState<'today'|'month'>('today')
  const [allMonthYear,     setAllMonthYear]     = useState(nowDate.getFullYear())
  const [allMonthMonth,    setAllMonthMonth]    = useState(nowDate.getMonth())
  const [allMonthData,     setAllMonthData]     = useState<Record<string, { staff: any[]; att: any[] }>>({})
  const [allMonthLoading,  setAllMonthLoading]  = useState(false)

  const [histYear,           setHistYear]           = useState(nowDate.getFullYear())
  const [histMonth,          setHistMonth]           = useState(nowDate.getMonth())
  const [staffList,          setStaffList]           = useState<any[]>([])
  const [allAttData,         setAllAttData]          = useState<any[]>([])
  const [showRequest,        setShowRequest]         = useState(false)
  const [showOwnerPanel,     setShowOwnerPanel]      = useState(false)
  const [showStaffTimePanel, setShowStaffTimePanel]  = useState(false)
  const [pendingCount,       setPendingCount]        = useState(0)
  const [editItem,           setEditItem]            = useState<any>(null)
  const [myMonthData,        setMyMonthData]         = useState<any[]>([])

  const hasIssues  = weekIssueList.length > 0
  const canClockIn  = !attLoading && wifiOk && allChecked && (!hasIssues || issueAcked) && !attendance?.clock_in
  const canClockOut = !attLoading && wifiOk && !!attendance?.clock_in && !attendance?.clock_out



  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('mj_user')  || '{}')
    const s = JSON.parse(localStorage.getItem('mj_store') || '{}')
    if (!u.id || !s.id) return
    setProfileId(u.id); setStoreId(s.id)
    setMyName(u.nm || ''); setRole(u.role || 'staff')
    fetchCurrentIp()
    loadAllowedIp(s.id)
    loadClosingTodos(s.id)
    loadOverdueTodos(s.id)
    loadTodayTodos(s.id)
    loadMyAttendance(u.id, s.id)
    loadTodaySchedule(u.nm, s.id)
    loadBoard(s.id)
    loadStaffList(s.id)
    loadMyMonthData(u.id, s.id)
    loadTodayGoalData(s.id)   // ★ 오늘 목표 + 지적사항
    if (u.role==='owner'||u.role==='manager') loadPendingCount(s.id)
    if (u.role==='owner') loadAllStores(u.id)
  }, [])

  useEffect(() => { if (storeId) loadAllAttendance(storeId, histYear, histMonth) }, [histYear, histMonth, storeId])
  useEffect(() => { if (typeof window !== 'undefined') localStorage.setItem('att_tab', tab) }, [tab])
  useEffect(() => { if (tab === 'all' && allStores.length > 0) loadAllStoresBoard(allStores) }, [tab, allStores])
  useEffect(() => {
    if (tab === 'all' && allView === 'month' && allStores.length > 0)
      loadAllMonthData(allStores, allMonthYear, allMonthMonth)
  }, [allView, allMonthYear, allMonthMonth, allStores])

  async function fetchCurrentIp() {
    try { const r = await fetch('https://api.ipify.org?format=json'); const d = await r.json(); setCurrentIp(d.ip) }
    catch { setCurrentIp('') }
    setIpLoading(false)
  }
  async function loadAllowedIp(sid: string) {
    const { data } = await supabase.from('stores').select('allowed_ip').eq('id', sid).single()
    setAllowedIp(data?.allowed_ip || '')
  }

  async function loadClosingTodos(sid: string) {
    const prev = new Date(); prev.setDate(prev.getDate() - 1)
    const prevStr = `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}-${String(prev.getDate()).padStart(2,'0')}`
    const { data: closing } = await supabase.from('closings').select('id').eq('store_id', sid).eq('closing_date', prevStr).maybeSingle()
    if (!closing) { setClosingTodos([]); return }
    const { data: todos } = await supabase.from('closing_next_todos').select('*').eq('closing_id', closing.id).order('created_at')
    setClosingTodos(todos || [])
    if (todos && todos.length > 0) {
      const { data: chks } = await supabase.from('closing_next_todo_checks').select('*').in('todo_id', todos.map((t: any) => t.id))
      const myChecks = new Set<string>()
      ;(chks || []).forEach((c: any) => { if (c.checked_by === myName) myChecks.add(c.todo_id) })
      setCheckedClosing(myChecks)
    }
  }
  async function loadOverdueTodos(sid: string) {
    const results: any[] = []
    for (let i = 1; i <= 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      const { data } = await supabase.from('notices').select('*, notice_todos(*)').eq('store_id', sid).eq('notice_date', dateStr).eq('is_from_closing', false)
      if (!data) continue
      const allIds = data.flatMap((n: any) => (n.notice_todos||[]).map((t: any) => t.id))
      if (allIds.length === 0) continue
      const { data: chks } = await supabase.from('notice_todo_checks').select('*').in('todo_id', allIds)
      const checkMap: Record<string, any[]> = {}
      ;(chks || []).forEach((c: any) => { if (!checkMap[c.todo_id]) checkMap[c.todo_id]=[]; checkMap[c.todo_id].push(c) })
      for (const notice of data)
        for (const todo of (notice.notice_todos || []))
          if ((checkMap[todo.id]||[]).length === 0) results.push({ ...todo, day_count: i })
    }
    setOverdueTodos(results)
  }
  async function loadTodayTodos(sid: string) {
    const { data } = await supabase.from('notices').select('*, notice_todos(*)').eq('store_id', sid).eq('notice_date', today).eq('is_from_closing', false)
    const todos = (data || []).flatMap((n: any) => n.notice_todos || [])
    setTodayTodos(todos)
    if (todos.length > 0) {
      const { data: chks } = await supabase.from('notice_todo_checks').select('*').in('todo_id', todos.map((t: any) => t.id))
      const myChecks = new Set<string>()
      ;(chks || []).forEach((c: any) => { if (c.checked_by === myName) myChecks.add(c.todo_id) })
      setCheckedToday(myChecks)
    }
  }

  // ★ 오늘 목표 매출 + 이번 달 전체 지적사항 한번에 로드
  async function loadTodayGoalData(sid: string) {
    const y = nowDate.getFullYear()
    const m = nowDate.getMonth() + 1
    const d = nowDate.getDate()
    const startDow = new Date(y, m - 1, 1).getDay()
    const weekNum = Math.ceil((d + (startDow === 0 ? 6 : startDow - 1)) / 7)

    const { data: goalData } = await supabase.from('goals')
      .select('week_issues, weekly_goals')
      .eq('store_id', sid).eq('year', y).eq('month', m).maybeSingle()

    // ★ 이번 달 전체 지적사항 (모든 주차 합산)
    const allIssues = parseAllMonthIssues(goalData?.week_issues)
    setWeekIssueList(allIssues)
    if (typeof window !== 'undefined') {
      setIssueAcked(localStorage.getItem(`issue_ack_month_${y}_${m}_${sid}`) === 'true')
    }

    // ★ 오늘 목표: 평일/주말 구분
    const wg = goalData?.weekly_goals?.[weekNum]
    if (wg) {
      const todayIsRed = isRedDay(y, m, d)
      setTodayGoal(todayIsRed ? (wg.weekend || 0) : (wg.weekday || 0))
    }

    // 오늘 목표 확인 체크 복원
    if (typeof window !== 'undefined') {
      setGoalAcked(localStorage.getItem(`goal_ack_${today}_${sid}`) === 'true')
    }
    setGoalLoaded(true)
  }

  async function loadMyAttendance(pid: string, sid: string) {
    const { data } = await supabase.from('attendance').select('*').eq('profile_id', pid).eq('store_id', sid).eq('work_date', today).maybeSingle()
    setAttendance(data || null); setAttLoading(false)
  }
  async function loadTodaySchedule(nm: string, sid: string) {
    const { data } = await supabase.from('schedules').select('*').eq('store_id', sid).eq('staff_name', nm).eq('schedule_date', today).maybeSingle()
    setTodaySchedule(data || null)
  }
  async function loadMyMonthData(pid: string, sid: string) {
    const monthStart = `${today.slice(0,7)}-01`
    const { data } = await supabase.from('attendance').select('status, clock_in, clock_out, work_date').eq('store_id', sid).eq('profile_id', pid).gte('work_date', monthStart).lte('work_date', today)
    setMyMonthData(data || [])
  }

  async function loadBoard(sid: string) {
    const { data: todaySchedules } = await supabase.from('schedules').select('staff_name, status').eq('store_id', sid).eq('schedule_date', today).in('status', ['work','half','absent'])
    const { data: activeData } = await supabase.from('store_members').select('profile_id, expected_clock_in, expected_clock_out, inactive_from').eq('store_id', sid).eq('active', true)
    const { data: inactiveData } = await supabase.from('store_members').select('profile_id, expected_clock_in, expected_clock_out, inactive_from').eq('store_id', sid).eq('active', false).gte('inactive_from', today)
    const allMembers = [...(activeData||[]), ...(inactiveData||[])].filter((m: any) => !m.inactive_from || m.inactive_from > today)
    const memberPids = allMembers.map((m: any) => m.profile_id)
    const { data: memberProfs } = await supabase.from('profiles').select('id, nm').in('id', memberPids)
    const profNameMap: Record<string, string> = {}
    ;(memberProfs||[]).forEach((p: any) => { profNameMap[p.id] = p.nm })
    const nameToInfo: Record<string, { id:string; expected_in?:string; expected_out?:string }> = {}
    ;(allMembers||[]).forEach((m: any) => { const nm = profNameMap[m.profile_id]; if (nm) nameToInfo[nm] = { id:m.profile_id, expected_in:m.expected_clock_in, expected_out:m.expected_clock_out } })
    const { data: attRecords } = await supabase.from('attendance').select('*').eq('store_id', sid).eq('work_date', today)
    const attMap: Record<string, any> = {}
    ;(attRecords || []).forEach((a: any) => { attMap[a.profile_id] = a })
    const monthStart = `${today.slice(0,7)}-01`
    const { data: monthAtt } = await supabase.from('attendance').select('profile_id, status, clock_in, clock_out, work_date').eq('store_id', sid).gte('work_date', monthStart).lte('work_date', today)
    const lateMap: Record<string, number> = {}, noClockOutMap: Record<string, number> = {}, noClockInMap: Record<string, number> = {}
    ;(monthAtt || []).forEach((a: any) => {
      const pid = a.profile_id
      const info = Object.values(nameToInfo).find((v: any) => v.id === pid) as any
      if (info?.expected_in && a.clock_in && tsToMinutes(a.clock_in) > timeToMinutes(info.expected_in)) lateMap[pid] = (lateMap[pid]||0)+1
      if (isPastDate(a.work_date, today) && a.clock_in && !a.clock_out && a.status!=='absent' && a.status!=='no_clockin') noClockOutMap[pid] = (noClockOutMap[pid]||0)+1
      if (a.status==='no_clockin'||a.status==='absent') noClockInMap[pid] = (noClockInMap[pid]||0)+1
    })
    setBoardList((todaySchedules||[]).map((s: any) => {
      const info = nameToInfo[s.staff_name] || {}; const pid = info.id || ''; const att = attMap[pid] || null
      let status = 'pending'
      if (s.status === 'absent') { status = 'absent' }
      else if (att) {
        const isLate  = info.expected_in  && att.clock_in  ? tsToMinutes(att.clock_in)  > timeToMinutes(info.expected_in)  : false
        const isEarly = info.expected_out && att.clock_out ? tsToMinutes(att.clock_out) < timeToMinutes(info.expected_out) : false
        if (att.clock_out) { if (isLate&&isEarly) status='late_early'; else if (isLate) status='late'; else if (isEarly) status='early'; else status='normal' }
        else if (att.clock_in) status='working'
      }
      return { pid, nm:s.staff_name, att, status, scheduleStatus:s.status, expected_in:info.expected_in, expected_out:info.expected_out, lateCount:lateMap[pid]||0, noClockOutCount:noClockOutMap[pid]||0, noClockInCount:noClockInMap[pid]||0 }
    }))
  }

  async function loadAllStores(pid: string) {
    const { data: memberships } = await supabase.from('store_members').select('store_id').eq('profile_id', pid).eq('active', true)
    if (!memberships || memberships.length === 0) return
    const sids = memberships.map((m: any) => m.store_id)
    const { data: stores } = await supabase.from('stores').select('id, name').in('id', sids)
    setAllStores(stores || [])
  }
  async function loadAllStoresBoard(stores: any[]) {
    if (stores.length === 0) return
    setAllStoresLoading(true)
    const result: Record<string, any[]> = {}
    await Promise.all(stores.map(async (store: any) => {
      const sid = store.id
      const { data: todaySchedules } = await supabase.from('schedules').select('staff_name, status').eq('store_id', sid).eq('schedule_date', today).in('status', ['work','half','absent'])
      const { data: activeMemData } = await supabase.from('store_members').select('profile_id, expected_clock_in, expected_clock_out').eq('store_id', sid).eq('active', true)
      const { data: inactMemData } = await supabase.from('store_members').select('profile_id, expected_clock_in, expected_clock_out, inactive_from').eq('store_id', sid).eq('active', false).gte('inactive_from', today)
      const members = [...(activeMemData||[]), ...(inactMemData||[])].filter((m: any) => !m.inactive_from || m.inactive_from > today)
      const memberPids = members.map((m: any) => m.profile_id)
      const { data: memberProfs } = await supabase.from('profiles').select('id, nm').in('id', memberPids)
      const profNameMap: Record<string, string> = {}
      ;(memberProfs||[]).forEach((p: any) => { profNameMap[p.id] = p.nm })
      const nameToInfo: Record<string, any> = {}
      members.forEach((m: any) => { const nm = profNameMap[m.profile_id]; if (nm) nameToInfo[nm] = { id:m.profile_id, expected_in:m.expected_clock_in, expected_out:m.expected_clock_out } })
      const { data: attRecords } = await supabase.from('attendance').select('*').eq('store_id', sid).eq('work_date', today)
      const attMap: Record<string, any> = {}
      ;(attRecords||[]).forEach((a: any) => { attMap[a.profile_id] = a })
      result[sid] = (todaySchedules||[]).map((s: any) => {
        const info = nameToInfo[s.staff_name] || {}; const pid = info.id || ''; const att = attMap[pid] || null
        let status = 'pending'
        if (s.status==='absent') { status='absent' }
        else if (att) {
          const isLate  = info.expected_in  && att.clock_in  ? tsToMinutes(att.clock_in)  > timeToMinutes(info.expected_in)  : false
          const isEarly = info.expected_out && att.clock_out ? tsToMinutes(att.clock_out) < timeToMinutes(info.expected_out) : false
          if (att.clock_out) { if (isLate&&isEarly) status='late_early'; else if (isLate) status='late'; else if (isEarly) status='early'; else status='normal' }
          else if (att.clock_in) status='working'
        }
        return { pid, nm:s.staff_name, att, status, expected_in:info.expected_in, expected_out:info.expected_out }
      })
    }))
    setAllStoresBoard(result); setAllStoresLoading(false)
  }
  async function loadAllMonthData(stores: any[], y: number, m: number) {
    if (stores.length === 0) return
    setAllMonthLoading(true)
    const from = `${y}-${pad(m+1)}-01`, to = `${y}-${pad(m+1)}-${pad(new Date(y,m+1,0).getDate())}`
    const result: Record<string, { staff: any[]; att: any[] }> = {}
    await Promise.all(stores.map(async (store: any) => {
      const sid = store.id
      const { data: activeMembers } = await supabase.from('store_members').select('profile_id, expected_clock_in, expected_clock_out, inactive_from').eq('store_id', sid).eq('active', true)
      const { data: inactiveMembers } = await supabase.from('store_members').select('profile_id, expected_clock_in, expected_clock_out, inactive_from').eq('store_id', sid).eq('active', false)
      const { data: attData } = await supabase.from('attendance').select('*').eq('store_id', sid).gte('work_date', from).lte('work_date', to)
      const attPids = new Set((attData||[]).map((a: any) => a.profile_id))
      const allMembers = [...(activeMembers||[]), ...(inactiveMembers||[]).filter((m: any) => attPids.has(m.profile_id))]
      const memberPids = allMembers.map((m: any) => m.profile_id)
      if (memberPids.length === 0) { result[sid] = { staff: [], att: attData||[] }; return }
      const { data: profs } = await supabase.from('profiles').select('id, nm').in('id', memberPids)
      const profMap: Record<string, string> = {}
      ;(profs||[]).forEach((p: any) => { profMap[p.id] = p.nm })
      result[sid] = { staff: allMembers.map((m: any) => ({ id:m.profile_id, nm:profMap[m.profile_id]||'', expected_in:m.expected_clock_in||'', expected_out:m.expected_clock_out||'', inactive_from:m.inactive_from||null })).filter((s: any) => s.nm), att: attData||[] }
    }))
    setAllMonthData(result); setAllMonthLoading(false)
  }
  async function loadPendingCount(sid: string) {
    const { count } = await supabase.from('attendance_requests').select('*', { count:'exact', head:true }).eq('store_id', sid).eq('status', 'pending')
    setPendingCount(count||0)
  }
  async function loadStaffList(sid: string) {
    const histFrom = `${histYear}-${pad(histMonth+1)}-01`, histTo = `${histYear}-${pad(histMonth+1)}-${pad(new Date(histYear,histMonth+1,0).getDate())}`
    const { data: activeData } = await supabase.from('store_members').select('profile_id, expected_clock_in, expected_clock_out, inactive_from').eq('store_id', sid).eq('active', true)
    const { data: inactiveData } = await supabase.from('store_members').select('profile_id, expected_clock_in, expected_clock_out, inactive_from').eq('store_id', sid).eq('active', false)
    const { data: attInMonth } = await supabase.from('attendance').select('profile_id').eq('store_id', sid).gte('work_date', histFrom).lte('work_date', histTo)
    const attPids = new Set((attInMonth||[]).map((a: any) => a.profile_id))
    const allMembers = [...(activeData||[]), ...(inactiveData||[]).filter((m: any) => attPids.has(m.profile_id))]
    if (allMembers.length === 0) { setStaffList([]); return }
    const pids = allMembers.map((m: any) => m.profile_id)
    const { data: profs } = await supabase.from('profiles').select('id, nm').in('id', pids)
    const profMap: Record<string, string> = {}
    ;(profs||[]).forEach((p: any) => { profMap[p.id] = p.nm })
    setStaffList(allMembers.map((m: any) => ({ id:m.profile_id, nm:profMap[m.profile_id]||'', expected_in:m.expected_clock_in||'', expected_out:m.expected_clock_out||'', inactive_from:m.inactive_from||null })).filter((s: any) => s.nm))
  }
  async function loadAllAttendance(sid: string, y: number, m: number) {
    const from = `${y}-${pad(m+1)}-01`, to = `${y}-${pad(m+1)}-${pad(new Date(y,m+1,0).getDate())}`
    const { data: attData } = await supabase.from('attendance').select('*').eq('store_id', sid).gte('work_date', from).lte('work_date', to)
    if (!attData || attData.length === 0) { setAllAttData([]); return }
    const pids = [...new Set(attData.map((a: any) => a.profile_id))]
    const { data: profs } = await supabase.from('profiles').select('id, nm').in('id', pids as string[])
    const profMap: Record<string, string> = {}
    ;(profs||[]).forEach((p: any) => { profMap[p.id] = p.nm })
    setAllAttData(attData.map((a: any) => ({ ...a, profiles: { nm: profMap[a.profile_id]||'' } })))
  }

  async function clockIn() {
    if (!canClockIn) return
    const nowTs  = new Date().toISOString()
    const myInfo = staffList.find(s => s.id === profileId)
    const isLate = myInfo?.expected_in ? tsToMinutes(nowTs) > timeToMinutes(myInfo.expected_in) : false
    const lateMin = isLate && myInfo?.expected_in ? tsToMinutes(nowTs) - timeToMinutes(myInfo.expected_in) : 0
    const rec = { store_id:storeId, profile_id:profileId, work_date:today, clock_in:nowTs, status:isLate?'late':'normal', is_late:isLate, late_minutes:lateMin }
    const { data: existing } = await supabase.from('attendance').select('id').eq('store_id', storeId).eq('profile_id', profileId).eq('work_date', today).maybeSingle()
    if (existing) await supabase.from('attendance').update({ clock_in:nowTs, status:rec.status, is_late:isLate, late_minutes:lateMin }).eq('id', existing.id)
    else await supabase.from('attendance').insert(rec)
    await loadMyAttendance(profileId, storeId)
    await loadBoard(storeId)
    await loadMyMonthData(profileId, storeId)
  }
  async function clockOut() {
    if (!canClockOut || !attendance) return
    const nowTs   = new Date().toISOString()
    const myInfo  = staffList.find(s => s.id === profileId)
    const isEarly = myInfo?.expected_out ? tsToMinutes(nowTs) < timeToMinutes(myInfo.expected_out) : false
    const wasLate = attendance.is_late || false
    let finalStatus = 'normal'
    if (wasLate && isEarly) finalStatus='late_early'
    else if (wasLate)  finalStatus='late'
    else if (isEarly)  finalStatus='early'
    await supabase.from('attendance').update({ clock_out:nowTs, status:finalStatus, is_early:isEarly }).eq('id', attendance.id)
    await loadMyAttendance(profileId, storeId)
    await loadBoard(storeId)
    await loadMyMonthData(profileId, storeId)
  }
  async function registerIp() {
    if (!currentIp||!storeId) return
    await supabase.from('stores').update({ allowed_ip:currentIp }).eq('id', storeId)
    setAllowedIp(currentIp); alert(`✅ IP 등록 완료\n${currentIp}`)
  }
  async function submitRequest(type: string, ci: string, co: string, reason: string) {
    const toTs = (t: string) => t ? `${today}T${t}:00+09:00` : null
    await supabase.from('attendance_requests').insert({ store_id:storeId, profile_id:profileId, work_date:today, request_type:type, requested_clock_in:ci?toTs(ci):null, requested_clock_out:co?toTs(co):null, reason })
    setShowRequest(false); alert('✅ 수정 요청이 전송되었습니다')
  }

  function prevMonth() { if (histMonth===0) { setHistYear(y=>y-1); setHistMonth(11) } else setHistMonth(m=>m-1) }
  function nextMonth() { if (histMonth===11) { setHistYear(y=>y+1); setHistMonth(0) } else setHistMonth(m=>m+1) }

  // ★ 전지점 출퇴근 엑셀 내보내기
  const [allExporting, setAllExporting] = useState(false)
  async function exportAllStoresExcel() {
    if (allExporting || allStores.length === 0) return
    setAllExporting(true)
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      const y = allMonthYear, m = allMonthMonth
      const lastDay = new Date(y, m+1, 0).getDate()
      const DOW_KR = ['일','월','화','수','목','금','토']
      const STATUS_LABEL: Record<string,string> = {
        normal:'정상', late:'지각', early:'조기퇴근', late_early:'지각+조기퇴근',
        absent:'결근', no_clockout:'퇴근누락', no_clockin:'출근누락', working:'근무중',
      }
      const STATUS_BG: Record<string,string> = {
        normal:'FFE0FAF4', late:'FFFCE4F0', early:'FFF0EEFF', late_early:'FFFCE4F0',
        absent:'FFF5F5F5', no_clockout:'FFFFF9E0', no_clockin:'FFFFEEE6', working:'FFFFEEE6',
      }
      const STATUS_CLR: Record<string,string> = {
        normal:'FF00B894', late:'FFE84393', early:'FF6C5CE7', late_early:'FFE84393',
        absent:'FFb2bec3', no_clockout:'FFb8860b', no_clockin:'FFFF6B35', working:'FFFF6B35',
      }
      const STORE_COLORS = ['FF1D3557','FF4A148C','FF1B5E20','FF7B2D00','FF37474F']
      const thin = () => ({ style:'thin' as const, color:{ argb:'FFE0E4E8' } })
      const med  = () => ({ style:'medium' as const, color:{ argb:'FFaaaaaa' } })

      for (let si = 0; si < allStores.length; si++) {
        const store = allStores[si]
        const d = allMonthData[store.id]
        if (!d) continue
        const { staff, att } = d
        if (staff.length === 0) continue

        const sheetName = (store.name || `지점${si+1}`).slice(0, 31)
        const ws = wb.addWorksheet(sheetName)
        const storeColor = STORE_COLORS[si % STORE_COLORS.length]

        // 출퇴근 맵
        const am: Record<string, Record<string, any>> = {}
        staff.forEach((s: any) => { am[s.id] = {} })
        att.forEach((a: any) => { if (am[a.profile_id]) am[a.profile_id][a.work_date] = a })

        const totalCols = 2 + staff.length + 1

        // 제목 행
        const titleRow = ws.addRow(new Array(totalCols).fill(''))
        ws.mergeCells(1, 1, 1, totalCols)
        const tc = titleRow.getCell(1)
        tc.value = `🏪 ${store.name}  |  ${y}년 ${m+1}월 출퇴근 기록`
        tc.fill = { type:'pattern', pattern:'solid', fgColor:{ argb: storeColor } }
        tc.font = { bold:true, color:{ argb:'FFFFFFFF' }, size:13 }
        tc.alignment = { horizontal:'center', vertical:'middle' }
        titleRow.height = 28

        // 직원명 헤더
        const hRow = ws.addRow(['날짜','요일',...staff.map((s:any)=>s.nm),'출근수'])
        hRow.eachCell((cell, ci) => {
          cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb: ci <= 2 ? 'FF2C3E50' : storeColor } }
          cell.font = { bold:true, color:{ argb:'FFFFFFFF' }, size:11 }
          cell.alignment = { horizontal:'center', vertical:'middle' }
          cell.border = { bottom:med(), right:thin() }
        })
        ws.getRow(2).height = 20

        // 기준시간 행
        const bRow = ws.addRow(['기준','',...staff.map((s:any)=>`${s.expected_in||'--'} ~ ${s.expected_out||'--'}`),''])
        bRow.eachCell(cell => {
          cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF8F0FF' } }
          cell.font = { color:{ argb:'FF6C5CE7' }, size:9 }
          cell.alignment = { horizontal:'center', vertical:'middle' }
          cell.border = { bottom:med(), right:thin() }
        })
        ws.getRow(3).height = 15

        // 열 너비
        ws.getColumn(1).width = 12; ws.getColumn(2).width = 5
        staff.forEach((_:any, i:number) => { ws.getColumn(i+3).width = 15 })
        ws.getColumn(staff.length+3).width = 7

        // 날짜별 행
        for (let day = 1; day <= lastDay; day++) {
          const ds = `${y}-${pad(m+1)}-${pad(day)}`
          const dow = new Date(ds).getDay()
          const isSun = dow===0, isSat = dow===6
          const dateBg = isSun?'FFFCE4F0':isSat?'FFF0EEFF':'FFFAFAFA'
          const dateClr = isSun?'FFE84393':isSat?'FF6C5CE7':'FF333333'
          const isMonday = dow===1 && day!==1

          let workCnt = 0
          const rowData: any[] = [`${m+1}/${day}`, DOW_KR[dow]]
          const cellInfos: { status:string }[] = []

          staff.forEach((s:any) => {
            const r = am[s.id]?.[ds]
            if (!r) { rowData.push(''); cellInfos.push({ status:'' }); return }
            const isPast = ds < today
            const isLate  = s.expected_in  && r.clock_in  ? tsToMinutes(r.clock_in)  > timeToMinutes(s.expected_in)  : false
            const isEarly = s.expected_out && r.clock_out ? tsToMinutes(r.clock_out) < timeToMinutes(s.expected_out) : false
            let st = r.status || 'normal'
            if (!['absent','no_clockin'].includes(st)) {
              if (isPast && r.clock_in && !r.clock_out) st = 'no_clockout'
              else if (r.clock_out) {
                if (isLate&&isEarly) st='late_early'
                else if (isLate)  st='late'
                else if (isEarly) st='early'
                else st='normal'
              } else if (r.clock_in) st='working'
            }
            const ci = fmtTime(r.clock_in)||'', co = fmtTime(r.clock_out)||''
            let val = STATUS_LABEL[st]||st
            if (ci) val += `\n${ci}${co?` → ${co}`:' ~'}`
            if (r.late_minutes > 0) val += `\n지각 ${r.late_minutes}분`
            rowData.push(val)
            cellInfos.push({ status: st })
            if (['normal','late','early','late_early','working'].includes(st)) workCnt++
          })
          rowData.push(workCnt||'')

          const row = ws.addRow(rowData)
          row.height = 34
          const dc = row.getCell(1)
          dc.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:dateBg } }
          dc.font = { color:{ argb:dateClr }, size:10 }
          dc.alignment = { horizontal:'left', vertical:'middle' }
          const dw = row.getCell(2)
          dw.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:dateBg } }
          dw.font = { bold:true, color:{ argb:dateClr }, size:10 }
          dw.alignment = { horizontal:'center', vertical:'middle' }
          cellInfos.forEach((info, i) => {
            const cell = row.getCell(i+3)
            cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true }
            if (!info.status) return
            cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:STATUS_BG[info.status]||'FFFFFFFF' } }
            cell.font = { bold:true, color:{ argb:STATUS_CLR[info.status]||'FF333333' }, size:10 }
          })
          const cc = row.getCell(staff.length+3)
          cc.font = { bold:true, color:{ argb:workCnt<2?'FFE84393':'FF6C5CE7' }, size:11 }
          cc.alignment = { horizontal:'center', vertical:'middle' }
          if (isMonday) row.eachCell(cell => { cell.border = { ...cell.border, top:med() } })
          else row.eachCell(cell => { cell.border = { top:thin(), bottom:thin(), left:thin(), right:thin() } })
        }

        // 합계 행
        const sumData: any[] = ['합계','']
        staff.forEach((s: any) => {
          const recs = att.filter((a:any) => a.profile_id === s.id)
          let normal=0,late=0,early=0,late_early=0,absent=0,no_clockout=0,no_clockin=0
          recs.forEach((r:any) => {
            const isPast = r.work_date < today
            const isLate  = s.expected_in  && r.clock_in  ? tsToMinutes(r.clock_in)  > timeToMinutes(s.expected_in)  : false
            const isEarly = s.expected_out && r.clock_out ? tsToMinutes(r.clock_out) < timeToMinutes(s.expected_out) : false
            const st = r.status||'normal'
            if (st==='absent'||st==='no_clockin') { absent++; no_clockin++; return }
            if (isPast && r.clock_in && !r.clock_out) { no_clockout++; return }
            if (isLate&&isEarly) late_early++
            else if (isLate)  late++
            else if (isEarly) early++
            else normal++
          })
          const totalWork = normal+late+early+late_early
          let summary = `출근 ${totalWork}일`
          if (late+late_early>0)  summary += ` / 지각 ${late+late_early}회`
          if (early+late_early>0) summary += ` / 조퇴 ${early+late_early}회`
          if (absent>0)      summary += ` / 결근 ${absent}일`
          if (no_clockout>0) summary += ` / 퇴근누락 ${no_clockout}회`
          sumData.push(summary)
        })
        sumData.push('')
        const sumRow = ws.addRow(sumData)
        ws.mergeCells(ws.rowCount, 1, ws.rowCount, 2)
        sumRow.height = 22
        sumRow.eachCell(cell => {
          cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFFE8CC' } }
          cell.font = { bold:true, size:9, color:{ argb:'FF1A1A2E' } }
          cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true }
          cell.border = { top:med(), bottom:thin(), left:thin(), right:thin() }
        })
        ws.views = [{ state:'frozen', xSplit:2, ySplit:3 }]
      }

      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `전지점_출퇴근_${y}년${m+1}월.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch(e: any) {
      alert('내보내기 실패: ' + (e?.message || '다시 시도해주세요'))
    } finally {
      setAllExporting(false)
    }
  }

  // ★ 지점별 출퇴근 기록 엑셀 내보내기 (대표 전용)
  const [exporting, setExporting] = useState(false)
  async function exportAttendanceExcel() {
    if (exporting) return
    setExporting(true)
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet(`${histYear}년${histMonth+1}월 출퇴근`)

      const lastDay = new Date(histYear, histMonth+1, 0).getDate()
      const DOW_KR = ['일','월','화','수','목','금','토']

      // 상태 한글 + 색상
      const STATUS_LABEL: Record<string, string> = {
        normal:'정상', late:'지각', early:'조기퇴근', late_early:'지각+조기퇴근',
        absent:'결근', no_clockout:'퇴근누락', no_clockin:'출근누락', working:'근무중', pending:'대기',
      }
      const STATUS_BG: Record<string, string> = {
        normal:'FFE0FAF4', late:'FFFCE4F0', early:'FFF0EEFF', late_early:'FFFCE4F0',
        absent:'FFF5F5F5', no_clockout:'FFFFF9E0', no_clockin:'FFFFEEE6', working:'FFFFEEE6', pending:'FFF8F8F8',
      }
      const STATUS_COLOR: Record<string, string> = {
        normal:'FF00B894', late:'FFE84393', early:'FF6C5CE7', late_early:'FFE84393',
        absent:'FFb2bec3', no_clockout:'FFb8860b', no_clockin:'FFFF6B35', working:'FFFF6B35', pending:'FFbbbbbb',
      }

      const thin = () => ({ style: 'thin' as const, color: { argb: 'FFE0E4E8' } })
      const med  = () => ({ style: 'medium' as const, color: { argb: 'FFaaaaaa' } })

      // staffList에서 visibleStaff 대신 전체 staffList 사용 (대표는 전체 보임)
      const staffForExport = staffList

      // ── 제목 행 ──
      const totalCols = 3 + staffForExport.length  // 날짜, 요일, 출근수(합계), 직원별
      const titleRow = ws.addRow(new Array(totalCols + 1).fill(''))
      ws.mergeCells(1, 1, 1, totalCols + 1)
      const tc = titleRow.getCell(1)
      tc.value = `📋 ${histYear}년 ${histMonth+1}월 출퇴근 기록`
      tc.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF1A1A2E' } }
      tc.font = { bold:true, color:{ argb:'FFFFFFFF' }, size:14 }
      tc.alignment = { horizontal:'center', vertical:'middle' }
      titleRow.height = 30

      // ── 직원 헤더 행 ──
      const headerRow = ws.addRow(['날짜', '요일', ...staffForExport.map((s: any) => s.nm), '출근수'])
      headerRow.eachCell((cell, ci) => {
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb: ci <= 2 ? 'FF2C3E50' : 'FF4A148C' } }
        cell.font = { bold:true, color:{ argb:'FFFFFFFF' }, size:11 }
        cell.alignment = { horizontal:'center', vertical:'middle' }
        cell.border = { bottom:med(), right:thin() }
      })
      ws.getRow(2).height = 22

      // ── 기준시간 행 ──
      const baseRow = ws.addRow(['기준', '', ...staffForExport.map((s: any) => `${s.expected_in||'--'} ~ ${s.expected_out||'--'}`), ''])
      baseRow.eachCell((cell, ci) => {
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFF8F0FF' } }
        cell.font = { color:{ argb:'FF6C5CE7' }, size:9 }
        cell.alignment = { horizontal:'center', vertical:'middle' }
        cell.border = { bottom:med(), right:thin() }
      })
      ws.getRow(3).height = 16

      // ── 열 너비 ──
      ws.getColumn(1).width = 13
      ws.getColumn(2).width = 5
      staffForExport.forEach((_: any, i: number) => { ws.getColumn(i + 3).width = 16 })
      ws.getColumn(staffForExport.length + 3).width = 7

      // 출퇴근 데이터 맵 (profile_id → work_date → record)
      const attMap: Record<string, Record<string, any>> = {}
      allAttData.forEach(r => {
        if (!attMap[r.profile_id]) attMap[r.profile_id] = {}
        attMap[r.profile_id][r.work_date] = r
      })

      // ── 날짜별 데이터 행 ──
      for (let day = 1; day <= lastDay; day++) {
        const dateStr = `${histYear}-${pad(histMonth+1)}-${pad(day)}`
        const dow = new Date(dateStr).getDay()
        const isSun = dow === 0; const isSat = dow === 6
        const isMonday = dow === 1 && day !== 1
        const dateBg = isSun ? 'FFFCE4F0' : isSat ? 'FFF0EEFF' : 'FFFAFAFA'
        const dateClr = isSun ? 'FFE84393' : isSat ? 'FF6C5CE7' : 'FF333333'

        const rowData: any[] = [`${histMonth+1}/${day}`, DOW_KR[dow]]
        let workCnt = 0

        const cellInfos: { status: string; clockIn: string; clockOut: string; lateMin: number }[] = []

        staffForExport.forEach((s: any) => {
          const rec = attMap[s.id]?.[dateStr]
          if (!rec) { rowData.push(''); cellInfos.push({ status:'', clockIn:'', clockOut:'', lateMin:0 }); return }

          // 기준시간 기반 상태 재계산
          const expIn  = s.expected_in
          const expOut = s.expected_out
          const st = rec.status || 'normal'
          let finalStatus = st
          if (!['absent','no_clockin'].includes(st)) {
            const isLate  = expIn  && rec.clock_in  ? tsToMinutes(rec.clock_in)  > timeToMinutes(expIn)  : false
            const isEarly = expOut && rec.clock_out ? tsToMinutes(rec.clock_out) < timeToMinutes(expOut) : false
            if (isPastDate(dateStr, today) && rec.clock_in && !rec.clock_out) finalStatus = 'no_clockout'
            else if (rec.clock_out) {
              if (isLate && isEarly) finalStatus = 'late_early'
              else if (isLate)  finalStatus = 'late'
              else if (isEarly) finalStatus = 'early'
              else finalStatus = 'normal'
            } else if (rec.clock_in) finalStatus = 'working'
          }

          const ciStr = fmtTime(rec.clock_in) || ''
          const coStr = fmtTime(rec.clock_out) || ''
          const lateMin = rec.late_minutes || 0

          let cellVal = STATUS_LABEL[finalStatus] || finalStatus
          if (ciStr) cellVal += `\n${ciStr}${coStr ? ` → ${coStr}` : ' ~'}`
          if (lateMin > 0) cellVal += `\n지각 ${lateMin}분`

          rowData.push(cellVal)
          cellInfos.push({ status: finalStatus, clockIn: ciStr, clockOut: coStr, lateMin })
          if (['normal','late','early','late_early','working'].includes(finalStatus)) workCnt++
        })
        rowData.push(workCnt || '')

        const row = ws.addRow(rowData)
        row.height = 36
        row.alignment = { wrapText: true }

        // 날짜 셀 스타일
        const dc = row.getCell(1)
        dc.fill = { type:'pattern', pattern:'solid', fgColor:{ argb: dateBg } }
        dc.font = { color:{ argb: dateClr }, size:10 }
        dc.alignment = { horizontal:'left', vertical:'middle' }

        const dw = row.getCell(2)
        dw.fill = { type:'pattern', pattern:'solid', fgColor:{ argb: dateBg } }
        dw.font = { bold:true, color:{ argb: dateClr }, size:10 }
        dw.alignment = { horizontal:'center', vertical:'middle' }

        // 직원 셀 스타일
        cellInfos.forEach((info, i) => {
          const cell = row.getCell(i + 3)
          cell.alignment = { horizontal:'center', vertical:'middle', wrapText: true }
          if (!info.status) return
          cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb: STATUS_BG[info.status] || 'FFFFFFFF' } }
          cell.font = { color:{ argb: STATUS_COLOR[info.status] || 'FF333333' }, bold: true, size:10 }
        })

        // 출근수 셀
        const cntCell = row.getCell(staffForExport.length + 3)
        cntCell.font = { bold:true, color:{ argb: workCnt < 2 ? 'FFE84393' : 'FF6C5CE7' }, size:11 }
        cntCell.alignment = { horizontal:'center', vertical:'middle' }

        // 월요일 경계선
        if (isMonday) {
          row.eachCell(cell => { cell.border = { ...cell.border, top: med() } })
        } else {
          row.eachCell(cell => { cell.border = { top:thin(), bottom:thin(), left:thin(), right:thin() } })
        }
      }

      // ── 합계 행 ──
      const sumData: any[] = ['합계', '']
      staffForExport.forEach((s: any) => {
        const stat = monthStats[s.id] || { normal:0, late:0, early:0, absent:0, late_early:0, no_clockout:0, no_clockin:0 }
        const totalWork  = stat.normal + stat.late + stat.early + stat.late_early
        const totalLate  = stat.late  + stat.late_early
        const totalEarly = stat.early + stat.late_early
        let summary = `출근 ${totalWork}일`
        if (totalLate  > 0) summary += ` / 지각 ${totalLate}회`
        if (totalEarly > 0) summary += ` / 조기퇴 ${totalEarly}회`
        if (stat.absent > 0) summary += ` / 결근 ${stat.absent}일`
        if (stat.no_clockout > 0) summary += ` / 퇴근누락 ${stat.no_clockout}회`
        sumData.push(summary)
      })
      sumData.push('')
      const sumRow = ws.addRow(sumData)
      ws.mergeCells(ws.rowCount, 1, ws.rowCount, 2)
      sumRow.height = 24
      sumRow.eachCell(cell => {
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFFE8CC' } }
        cell.font = { bold:true, size:10, color:{ argb:'FF1A1A2E' } }
        cell.alignment = { horizontal:'center', vertical:'middle', wrapText: true }
        cell.border = { top:med(), bottom:thin(), left:thin(), right:thin() }
      })

      // ── 틀 고정 (날짜+요일, 제목+헤더+기준) ──
      ws.views = [{ state:'frozen', xSplit:2, ySplit:3 }]

      // ── 다운로드 ──
      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `출퇴근기록_${histYear}년${histMonth+1}월.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch(e: any) {
      alert('내보내기 실패: ' + (e?.message || '다시 시도해주세요'))
    } finally {
      setExporting(false)
    }
  }

  const firstDow = new Date(histYear, histMonth, 1).getDay()
  const lastDate = new Date(histYear, histMonth+1, 0).getDate()
  const attMatrix = useMemo(() => {
    const m: Record<string, Record<string, any>> = {}
    allAttData.forEach(r => { if (!m[r.profile_id]) m[r.profile_id]={}; m[r.profile_id][r.work_date]=r })
    return m
  }, [allAttData])
  const visibleStaff = canSeeAll ? staffList : staffList.filter(s => s.id===profileId)
  function getDayAttendance(day: number) {
    const dateStr = `${histYear}-${pad(histMonth+1)}-${pad(day)}`
    return visibleStaff.map(staff => { const rec = attMatrix[staff.id]?.[dateStr]; return { nm:staff.nm, id:staff.id, rec, expected_in:staff.expected_in, expected_out:staff.expected_out, dateStr } }).filter(x => x.rec)
  }
  const monthStats = useMemo(() => {
    const stats: Record<string, any> = {}
    visibleStaff.forEach(s => { stats[s.id]={ normal:0, late:0, early:0, absent:0, late_early:0, no_clockout:0, no_clockin:0 } })
    const expMap: Record<string, { in:string; out:string }> = {}
    visibleStaff.forEach(s => { expMap[s.id] = { in: s.expected_in||'', out: s.expected_out||'' } })
    allAttData.forEach(r => {
      if (!stats[r.profile_id]) return
      const exp = expMap[r.profile_id] || { in:'', out:'' }; const st = r.status || 'normal'
      if (st==='absent')     { stats[r.profile_id].absent++; stats[r.profile_id].no_clockin++; return }
      if (st==='no_clockin') { stats[r.profile_id].no_clockin++; return }
      const isLate  = exp.in  && r.clock_in  ? tsToMinutes(r.clock_in)  > timeToMinutes(exp.in)  : false
      const isEarly = exp.out && r.clock_out ? tsToMinutes(r.clock_out) < timeToMinutes(exp.out) : false
      if (isLate&&isEarly) stats[r.profile_id].late_early++
      else if (isLate)  stats[r.profile_id].late++
      else if (isEarly) stats[r.profile_id].early++
      else              stats[r.profile_id].normal++
      if (isPastDate(r.work_date, today) && r.clock_in && !r.clock_out) stats[r.profile_id].no_clockout++
    })
    return stats
  }, [allAttData, visibleStaff, today])

  const STAFF_COLORS = ['#FF6B35','#E84393','#6C5CE7','#2DC6D6','#00B894','#FDCB6E','#A29BFE','#FD79A8','#55EFC4','#74B9FF']
  const staffColorMap = useMemo(() => {
    const m: Record<string, string> = {}
    staffList.forEach((s, i) => { m[s.id]=STAFF_COLORS[i%STAFF_COLORS.length] })
    return m
  }, [staffList])

  const clockInBlockReason = !wifiOk
    ? '매장 와이파이 연결 필요'
    : hasIssues && !issueAcked
    ? '이번 달 지적사항을 확인(체크)해야 출근할 수 있어요'
    : !allChecked
    ? '전달사항을 모두 확인(체크)해야 출근할 수 있어요'
    : attendance?.clock_in ? '이미 출근했습니다' : null

  return (
    <div style={{ minHeight:'100vh', background:'#F4F6F9' }}>
      <style>{`
        .att-wrap { max-width:480px; margin:0 auto; padding:16px 16px 100px; }
        .all-grid { display:grid; grid-template-columns:1fr; gap:12px; }
        @media(min-width:768px){ .att-wrap { max-width:100%; padding:24px 40px 40px; } .cal-grid { grid-template-columns:repeat(7,1fr)!important; } .all-grid { grid-template-columns:repeat(3,1fr); } }
      `}</style>
      <div className="att-wrap">

        {/* 헤더 */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:17, fontWeight:700, color:'#1a1a2e' }}>🕐 출퇴근</span>
          <div style={{ display:'flex', gap:8 }}>
            {isOwner && <button onClick={() => setShowStaffTimePanel(true)} style={{ padding:'6px 12px', borderRadius:10, cursor:'pointer', background:'rgba(108,92,231,0.08)', border:'1px solid rgba(108,92,231,0.2)', color:'#6C5CE7', fontSize:12, fontWeight:700 }}>⏰ 시간설정</button>}
            {canSeeAll && (
              <button onClick={() => setShowOwnerPanel(true)} style={{ padding:'6px 14px', borderRadius:10, cursor:'pointer', background:pendingCount>0?'rgba(232,67,147,0.1)':'#F4F6F9', border:pendingCount>0?'1px solid rgba(232,67,147,0.3)':'1px solid #E8ECF0', color:pendingCount>0?'#E84393':'#888', fontSize:12, fontWeight:700 }}>
                ✏️ 수정요청
                {pendingCount>0 && <span style={{ marginLeft:6, background:'#E84393', color:'#fff', borderRadius:10, padding:'1px 6px', fontSize:10 }}>{pendingCount}</span>}
              </button>
            )}
          </div>
        </div>

        {/* 탭 */}
        <div style={{ display:'flex', background:'#E8ECF0', borderRadius:12, padding:4, marginBottom:16 }}>
          {([{v:'today',l:'오늘'},{v:'history',l:'📋 기록 조회'},...(role==='owner'?[{v:'all',l:'🏪 전지점'}]:[])] as any[]).map((t: any) => (
            <button key={t.v} onClick={() => setTab(t.v)} style={{ flex:1, padding:'9px 0', borderRadius:10, border:'none', cursor:'pointer', fontSize:13, fontWeight:tab===t.v?700:400, background:tab===t.v?'#fff':'transparent', color:tab===t.v?'#1a1a2e':'#aaa', boxShadow:tab===t.v?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>{t.l}</button>
          ))}
        </div>

        {/* ════ 오늘 탭 ════ */}
        {tab==='today' && (
          <>
            {/* ★ 오늘의 목표 매출 카드 — 맨 위 */}
            {goalLoaded && todayGoal > 0 && (
              <div style={{
                borderRadius: 16, marginBottom: 12,
                background: 'linear-gradient(135deg, #FF6B35, #E84393)',
                boxShadow: '0 4px 20px rgba(255,107,53,0.25)'
              }}>
                <div style={{ padding:'18px 20px' }}>
                  {/* 날짜 + 요일 */}
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.75)', fontWeight:600, marginBottom:4 }}>
                    {nowDate.getMonth()+1}월 {nowDate.getDate()}일 {DOW_KR[todayDow]}
                    {isRedDay(nowDate.getFullYear(), nowDate.getMonth()+1, nowDate.getDate()) && (
                      <span style={{ marginLeft:6, fontSize:10, background:'rgba(255,255,255,0.2)', padding:'1px 6px', borderRadius:10 }}>🔴 주말/공휴일</span>
                    )}
                  </div>
                  <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.85)', marginBottom:10 }}>🎯 오늘의 목표 매출</div>

                  {/* 목표 금액 크게 */}
                  <div style={{ fontSize:34, fontWeight:900, color:'#fff', marginBottom:16, letterSpacing:'-0.5px' }}>
                    {fmtW(todayGoal)}
                  </div>

                  {/* 확인 체크박스 */}
                  <div onClick={() => {
                    const next = !goalAcked
                    setGoalAcked(next)
                    if (typeof window !== 'undefined') {
                      localStorage.setItem(`goal_ack_${today}_${storeId}`, String(next))
                    }
                  }} style={{
                    display:'flex', alignItems:'center', gap:10, padding:'11px 14px',
                    background: goalAcked ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)',
                    borderRadius:12, cursor:'pointer',
                    border:`1.5px solid ${goalAcked ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)'}`,
                    transition:'all 0.15s'
                  }}>
                    <div style={{
                      width:22, height:22, borderRadius:7, flexShrink:0,
                      border:`2px solid ${goalAcked ? '#fff' : 'rgba(255,255,255,0.6)'}`,
                      background: goalAcked ? '#fff' : 'transparent',
                      display:'flex', alignItems:'center', justifyContent:'center'
                    }}>
                      {goalAcked && <span style={{ color:'#FF6B35', fontSize:13, fontWeight:900 }}>✓</span>}
                    </div>
                    <span style={{ fontSize:13, fontWeight:700, color:'#fff' }}>
                      {goalAcked ? '✅ 오늘의 목표 확인 완료!' : '오늘의 목표를 확인했습니다'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 와이파이 */}
            <div style={{ borderRadius:12, padding:'10px 14px', marginBottom:12, display:'flex', alignItems:'center', gap:10, fontSize:13, fontWeight:600, background:wifiOk?'rgba(0,184,148,0.08)':'rgba(232,67,147,0.08)', border:`1px solid ${wifiOk?'rgba(0,184,148,0.3)':'rgba(232,67,147,0.3)'}`, color:wifiOk?'#00B894':'#E84393' }}>
              <span>📶</span>
              <span style={{ flex:1 }}>{ipLoading?'와이파이 확인중...':!allowedIp?'매장 IP 미등록 — 대표가 먼저 IP를 등록해주세요':wifiOk?'매장 와이파이 연결됨 — 출퇴근 가능':'매장 와이파이 미연결 — 출퇴근 불가'}</span>
            </div>

            {/* 이번 달 지적사항 */}
            {hasIssues && !attendance?.clock_in && (
              <div style={{ ...bx, border:'2px solid rgba(232,67,147,0.35)', background:'rgba(232,67,147,0.03)', marginBottom:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:'#E84393' }}>📌 이번 달 지적사항</span>
                  <span style={{ fontSize:10, background:'rgba(232,67,147,0.12)', color:'#E84393', padding:'2px 6px', borderRadius:10, fontWeight:700 }}>{weekIssueList.length}건</span>
                  <span style={{ fontSize:10, color:'#aaa', marginLeft:'auto' }}>확인 체크 후 출근 가능</span>
                </div>
                {weekIssueList.map((issue, idx) => (
                  <div key={issue.id} style={{ marginBottom:8, padding:'10px 14px', background:'#fff', borderRadius:10, border:'1px solid rgba(232,67,147,0.18)' }}>
                    <div style={{ fontSize:10, color:'#E84393', fontWeight:700, marginBottom:5 }}>#{idx + 1}</div>
                    <div style={{ fontSize:13, color:'#1a1a2e', lineHeight:1.7 }}>{issue.text}</div>
                    {(issue.imageBase64 || issue.imageUrl) && (
                      <img src={issue.imageBase64 || issue.imageUrl} alt="지적사항 사진"
                        style={{ width:'100%', maxHeight:200, objectFit:'cover', borderRadius:8, marginTop:8, border:'1px solid #E8ECF0', display:'block' }} />
                    )}
                  </div>
                ))}
                <div onClick={() => {
                  if (!wifiOk) { alert('매장 와이파이 연결 후 체크할 수 있습니다'); return }
                  const next = !issueAcked; setIssueAcked(next)
                  const y = nowDate.getFullYear(), m = nowDate.getMonth() + 1
                  if (typeof window !== 'undefined') localStorage.setItem(`issue_ack_month_${y}_${m}_${storeId}`, String(next))
                }} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', background:issueAcked?'rgba(0,184,148,0.08)':'rgba(232,67,147,0.06)', borderRadius:10, cursor:'pointer', border:`1.5px solid ${issueAcked?'rgba(0,184,148,0.35)':'rgba(232,67,147,0.25)'}` }}>
                  <div style={{ width:22, height:22, borderRadius:7, flexShrink:0, border:`2px solid ${issueAcked?'#00B894':'#E84393'}`, background:issueAcked?'#00B894':'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {issueAcked && <span style={{ color:'#fff', fontSize:12, fontWeight:800 }}>✓</span>}
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:issueAcked?'#00B894':'#E84393' }}>{issueAcked?'✅ 이번 달 지적사항 확인 완료!':'이번 달 지적사항을 확인했습니다 (필수)'}</span>
                </div>
              </div>
            )}

            {/* 전달사항 */}
            {allTodos.length > 0 && !attendance?.clock_in && (
              <div style={bx}>
                <div style={{ fontSize:13, fontWeight:700, color:'#E84393', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                  📢 출근 전 전달사항 확인 필수
                  <span style={{ fontSize:10, color:'#aaa', fontWeight:500, marginLeft:'auto' }}>{allCheckedIds.size}/{allTodos.length} 확인</span>
                </div>
                {closingTodos.length > 0 && (
                  <><div style={{ fontSize:10, fontWeight:700, color:'#FF6B35', marginBottom:6, paddingLeft:2 }}>📋 전날 마감 전달사항</div>
                  {closingTodos.map(t => { const checked = checkedClosing.has(t.id); return (
                    <div key={t.id} onClick={() => { if (!wifiOk) { alert('매장 와이파이 연결 후 체크할 수 있습니다'); return } const next = new Set(checkedClosing); checked?next.delete(t.id):next.add(t.id); setCheckedClosing(next); if (!checked) supabase.from('closing_next_todo_checks').insert({ todo_id:t.id, checked_by:myName, checked_at:new Date().toISOString() }); else supabase.from('closing_next_todo_checks').delete().eq('todo_id', t.id).eq('checked_by', myName) }} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 0', borderBottom:'1px solid #F8F9FB', cursor:'pointer' }}>
                      <div style={{ width:20, height:20, borderRadius:6, flexShrink:0, marginTop:2, border:`2px solid ${checked?'#FF6B35':'#ddd'}`, background:checked?'#FF6B35':'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>{checked&&<span style={{ color:'#fff', fontSize:11, fontWeight:800 }}>✓</span>}</div>
                      <div><div style={{ fontSize:13, lineHeight:1.5, color:checked?'#bbb':'#555', textDecoration:checked?'line-through':'none' }}>{t.content}</div>{t.created_by&&<div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>작성: {t.created_by}</div>}</div>
                    </div>
                  )})} </>
                )}
                {overdueTodos.length > 0 && (
                  <><div style={{ fontSize:10, fontWeight:700, color:'#E84393', margin:`${closingTodos.length>0?'10px':0} 0 6px`, paddingLeft:2 }}>⚠️ 미완료 이월 할일</div>
                  {overdueTodos.map(t => { const checked = checkedOverdue.has(t.id); const uc = t.day_count>=3?'#E84393':t.day_count>=2?'#FF6B35':'#FDC400'; return (
                    <div key={t.id} onClick={() => { if (!wifiOk) { alert('매장 와이파이 연결 후 체크할 수 있습니다'); return } const next = new Set(checkedOverdue); checked?next.delete(t.id):next.add(t.id); setCheckedOverdue(next); if (!checked) supabase.from('notice_todo_checks').insert({ todo_id:t.id, checked_by:myName, checked_at:new Date().toISOString() }); else supabase.from('notice_todo_checks').delete().eq('todo_id', t.id).eq('checked_by', myName) }} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 0', borderBottom:'1px solid #F8F9FB', cursor:'pointer' }}>
                      <div style={{ width:20, height:20, borderRadius:6, flexShrink:0, marginTop:2, border:`2px solid ${checked?uc:'#ddd'}`, background:checked?uc:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>{checked&&<span style={{ color:'#fff', fontSize:11, fontWeight:800 }}>✓</span>}</div>
                      <div style={{ flex:1 }}><div style={{ display:'flex', alignItems:'center', gap:6 }}><div style={{ fontSize:13, lineHeight:1.5, color:checked?'#bbb':'#555', textDecoration:checked?'line-through':'none' }}>{t.content}</div><span style={{ fontSize:9, fontWeight:700, color:uc, background:`${uc}15`, padding:'1px 5px', borderRadius:5, flexShrink:0 }}>{t.day_count}일째</span></div>{t.created_by&&<div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>작성: {t.created_by}</div>}</div>
                    </div>
                  )})}</>
                )}
                {todayTodos.length > 0 && (
                  <><div style={{ fontSize:10, fontWeight:700, color:'#6C5CE7', margin:`${closingTodos.length>0||overdueTodos.length>0?'10px':0} 0 6px`, paddingLeft:2 }}>✅ 오늘 할일</div>
                  {todayTodos.map(t => { const checked = checkedToday.has(t.id); return (
                    <div key={t.id} onClick={() => { if (!wifiOk) { alert('매장 와이파이 연결 후 체크할 수 있습니다'); return } const next = new Set(checkedToday); checked?next.delete(t.id):next.add(t.id); setCheckedToday(next); if (!checked) supabase.from('notice_todo_checks').insert({ todo_id:t.id, checked_by:myName, checked_at:new Date().toISOString() }); else supabase.from('notice_todo_checks').delete().eq('todo_id', t.id).eq('checked_by', myName) }} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 0', borderBottom:'1px solid #F8F9FB', cursor:'pointer' }}>
                      <div style={{ width:20, height:20, borderRadius:6, flexShrink:0, marginTop:2, border:`2px solid ${checked?'#6C5CE7':'#ddd'}`, background:checked?'#6C5CE7':'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>{checked&&<span style={{ color:'#fff', fontSize:11, fontWeight:800 }}>✓</span>}</div>
                      <div><div style={{ fontSize:13, lineHeight:1.5, color:checked?'#bbb':'#555', textDecoration:checked?'line-through':'none' }}>{t.content}</div>{t.created_by&&<div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>작성: {t.created_by}</div>}</div>
                    </div>
                  )})}</>
                )}
                {!wifiOk && <div style={{ marginTop:10, padding:'8px 12px', borderRadius:8, background:'rgba(232,67,147,0.06)', fontSize:12, color:'#E84393', fontWeight:600 }}>📶 매장 와이파이 연결 후 체크할 수 있습니다</div>}
                {wifiOk && !allChecked && <div style={{ marginTop:10, padding:'10px 12px', borderRadius:8, background:'rgba(232,67,147,0.06)', fontSize:12, color:'#E84393', fontWeight:600 }}>⚠️ 전달사항을 모두 확인(체크)해야 출근 버튼이 활성화됩니다</div>}
                {wifiOk && allChecked && <div style={{ marginTop:10, padding:'8px 12px', borderRadius:8, background:'rgba(0,184,148,0.06)', fontSize:12, color:'#00B894', fontWeight:600 }}>✅ 전달사항 확인 완료 — 출근할 수 있어요!</div>}
              </div>
            )}

            {/* 본인 이번달 근태 요약 */}
            {(() => {
              if (myMonthData.length === 0) return null
              const myInfo = staffList.find(s => s.id === profileId)
              const expIn = myInfo?.expected_in||'', expOut = myInfo?.expected_out||''
              const stat = { normal:0, late:0, early:0, late_early:0, no_clockout:0, no_clockin:0, absent:0 }
              myMonthData.forEach(r => {
                const st = r.status||'normal'
                if (st==='absent')     { stat.absent++; stat.no_clockin++; return }
                if (st==='no_clockin') { stat.no_clockin++; return }
                const isLate  = expIn  && r.clock_in  ? tsToMinutes(r.clock_in)  > timeToMinutes(expIn)  : false
                const isEarly = expOut && r.clock_out ? tsToMinutes(r.clock_out) < timeToMinutes(expOut) : false
                if (isLate&&isEarly) stat.late_early++; else if (isLate) stat.late++; else if (isEarly) stat.early++; else stat.normal++
                if (isPastDate(r.work_date, today) && r.clock_in && !r.clock_out) stat.no_clockout++
              })
              const totalLate = stat.late+stat.late_early, totalEarly = stat.early+stat.late_early
              return (
                <div style={bx}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:12, display:'flex', alignItems:'center' }}>
                    📊 이번달 내 근태<span style={{ fontSize:11, color:'#aaa', fontWeight:500, marginLeft:'auto' }}>{nowDate.getMonth()+1}월 기준</span>
                  </div>
                  <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                    {[{label:'정상',value:stat.normal,color:'#00B894',bg:'rgba(0,184,148,0.08)'},{label:'지각',value:totalLate,color:'#E84393',bg:'rgba(232,67,147,0.08)'},{label:'조기퇴근',value:totalEarly,color:'#6C5CE7',bg:'rgba(108,92,231,0.08)'},{label:'결근',value:stat.absent,color:'#b2bec3',bg:'rgba(178,190,195,0.10)'}].map(item => (
                      <div key={item.label} style={{ flex:1, textAlign:'center', padding:'8px 4px', background:item.bg, borderRadius:10 }}><div style={{ fontSize:17, fontWeight:800, color:item.color }}>{item.value}</div><div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>{item.label}</div></div>
                    ))}
                  </div>
                  {(stat.no_clockout>0||stat.no_clockin>0) && (
                    <div style={{ display:'flex', gap:6 }}>
                      {stat.no_clockout>0&&<div style={{ flex:1, textAlign:'center', padding:'7px 4px', background:'rgba(253,203,110,0.13)', borderRadius:10 }}><div style={{ fontSize:17, fontWeight:800, color:'#b8860b' }}>{stat.no_clockout}</div><div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>퇴근누락</div></div>}
                      {stat.no_clockin>0&&<div style={{ flex:1, textAlign:'center', padding:'7px 4px', background:'rgba(255,107,53,0.09)', borderRadius:10 }}><div style={{ fontSize:17, fontWeight:800, color:'#FF6B35' }}>{stat.no_clockin}</div><div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>출근누락</div></div>}
                      <div style={{ flex:stat.no_clockout>0&&stat.no_clockin>0?2:3 }} />
                    </div>
                  )}
                </div>
              )
            })()}

            {/* 출퇴근 카드 */}
            <div style={bx}>
              <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:14 }}>🕐 출퇴근</div>
              {(() => { const myInfo = staffList.find(s => s.id===profileId); if (!myInfo?.expected_in&&!myInfo?.expected_out) return null; return (
                <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                  {myInfo.expected_in&&<div style={{ flex:1, padding:'7px 10px', background:'rgba(255,107,53,0.06)', borderRadius:8, border:'1px solid rgba(255,107,53,0.15)' }}><div style={{ fontSize:10, color:'#aaa', marginBottom:2 }}>출근 기준</div><div style={{ fontSize:13, fontWeight:700, color:'#FF6B35' }}>{myInfo.expected_in}</div></div>}
                  {myInfo.expected_out&&<div style={{ flex:1, padding:'7px 10px', background:'rgba(108,92,231,0.06)', borderRadius:8, border:'1px solid rgba(108,92,231,0.15)' }}><div style={{ fontSize:10, color:'#aaa', marginBottom:2 }}>퇴근 기준</div><div style={{ fontSize:13, fontWeight:700, color:'#6C5CE7' }}>{myInfo.expected_out}</div></div>}
                </div>
              )})()}
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', background:'#F8F9FB', borderRadius:12, marginBottom:16 }}>
                <div style={{ width:10, height:10, borderRadius:'50%', background:attendance?.clock_out?'#636e72':attendance?.clock_in?'#00B894':'#aaa' }} />
                <span style={{ fontSize:13, fontWeight:600, color:'#888', flex:1 }}>{attLoading?'확인중...':attendance?.clock_out?'퇴근 완료':attendance?.clock_in?'근무중':todaySchedule?'출근 대기중':'오늘 스케줄 없음'}</span>
                {attendance?.clock_in && <span style={{ fontSize:12, fontWeight:700, color:'#1a1a2e' }}>{fmtTime(attendance.clock_in)} 출근{attendance.clock_out&&` → ${fmtTime(attendance.clock_out)} 퇴근`}</span>}
              </div>
              {attendance?.status && !['normal','working','pending'].includes(attendance.status) && (
                <div style={{ marginBottom:12, padding:'8px 12px', borderRadius:10, background:STATUS_MAP[attendance.status]?.bg||'#F8F9FB', border:`1px solid ${(STATUS_MAP[attendance.status]?.color||'#ddd')}30`, display:'flex', alignItems:'center', gap:8 }}>
                  <span>{STATUS_MAP[attendance.status]?.icon}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:STATUS_MAP[attendance.status]?.color }}>{STATUS_MAP[attendance.status]?.label}{attendance.late_minutes>0&&` (${attendance.late_minutes}분 지각)`}</span>
                </div>
              )}
              {!attendance?.clock_out && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                  <button onClick={clockIn} disabled={!canClockIn} style={{ padding:'18px 10px', borderRadius:14, border:'none', fontSize:14, fontWeight:700, cursor:canClockIn?'pointer':'not-allowed', opacity:canClockIn?1:0.3, background:'linear-gradient(135deg,#FF6B35,#E84393)', color:'#fff', boxShadow:canClockIn?'0 4px 16px rgba(255,107,53,0.35)':'none', display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                    <span style={{ fontSize:24 }}>✅</span>출근
                  </button>
                  <button onClick={clockOut} disabled={!canClockOut} style={{ padding:'18px 10px', borderRadius:14, border:'none', fontSize:14, fontWeight:700, cursor:canClockOut?'pointer':'not-allowed', opacity:canClockOut?1:0.3, background:'linear-gradient(135deg,#636e72,#2d3436)', color:'#fff', boxShadow:canClockOut?'0 4px 16px rgba(0,0,0,0.2)':'none', display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                    <span style={{ fontSize:24 }}>🔴</span>퇴근
                  </button>
                </div>
              )}
              {clockInBlockReason && !attendance?.clock_in && <div style={{ marginBottom:10, padding:'8px 12px', borderRadius:8, background:'rgba(232,67,147,0.04)', fontSize:12, color:'#E84393', border:'1px solid rgba(232,67,147,0.15)', fontWeight:600 }}>🔒 {clockInBlockReason}</div>}
              {attendance?.clock_out && (
                <div style={{ padding:'14px', background:'rgba(0,184,148,0.06)', border:'1px solid rgba(0,184,148,0.2)', borderRadius:12, marginBottom:10, textAlign:'center' }}>
                  <div style={{ fontSize:11, color:'#aaa', marginBottom:4 }}>오늘 실근무시간</div>
                  <div style={{ fontSize:22, fontWeight:800, color:'#00B894' }}>{fmtDuration(attendance.clock_in, attendance.clock_out)}</div>
                  <div style={{ fontSize:11, color:'#aaa', marginTop:4 }}>{fmtTime(attendance.clock_in)} 출근 → {fmtTime(attendance.clock_out)} 퇴근</div>
                </div>
              )}
              <button onClick={() => setShowRequest(true)} style={{ width:'100%', padding:13, borderRadius:12, border:'1px dashed rgba(108,92,231,0.4)', background:'rgba(108,92,231,0.05)', color:'#6C5CE7', fontSize:13, fontWeight:600, cursor:'pointer' }}>✏️ 출퇴근 누락 수정 요청</button>
            </div>

            {/* IP 설정 */}
            {isOwner && (
              <div style={bx}>
                <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:10 }}>📶 매장 IP 설정</div>
                <div style={{ fontSize:12, color:'#aaa', marginBottom:12 }}>매장 와이파이에 연결된 상태에서 등록하세요</div>
                <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
                  <div style={{ flex:1, padding:'10px 14px', background:'#F8F9FB', borderRadius:10, border:'1px solid #E8ECF0', fontSize:13, fontWeight:600, color:'#1a1a2e' }}>현재 IP: <span style={{ color:'#FF6B35' }}>{currentIp||'확인중...'}</span></div>
                  <button onClick={registerIp} style={{ padding:'10px 16px', borderRadius:10, border:'none', background:'linear-gradient(135deg,#FF6B35,#E84393)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>📶 등록</button>
                </div>
                {allowedIp && <div style={{ padding:'8px 12px', background:'rgba(0,184,148,0.06)', borderRadius:8, fontSize:11, color:'#00B894', fontWeight:600 }}>✅ 등록된 IP: {allowedIp}</div>}
              </div>
            )}

            {/* 오늘 현황판 */}
            <div style={bx}>
              <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:role==='owner'?6:14, display:'flex', alignItems:'center' }}>
                👥 오늘 출퇴근 현황<span style={{ fontSize:11, color:'#aaa', fontWeight:500, marginLeft:'auto' }}>{nowDate.getMonth()+1}월 {nowDate.getDate()}일</span>
              </div>
              {role==='owner' && <div style={{ fontSize:11, color:'#4a6cf7', fontWeight:600, marginBottom:12, padding:'6px 10px', background:'rgba(74,108,247,0.07)', borderRadius:8 }}>✏️ 직원 행을 탭하면 근태를 수정할 수 있어요</div>}
              {boardList.length===0 ? <div style={{ textAlign:'center', padding:'28px 0', color:'#bbb', fontSize:13 }}>오늘 스케줄이 없습니다</div>
              : boardList.map(item => {
                const st = STATUS_MAP[item.status]||STATUS_MAP.pending
                const hasBadge = item.lateCount>0||item.noClockOutCount>0||item.noClockInCount>0
                return (
                  <div key={item.pid||item.nm} onClick={() => role==='owner'?setEditItem(item):undefined} style={{ padding:'11px 0', borderBottom:'1px solid #F8F9FB', cursor:role==='owner'?'pointer':'default' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:36, height:36, borderRadius:10, flexShrink:0, background:'linear-gradient(135deg,#FF6B35,#E84393)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:'#fff' }}>{item.nm?.charAt(0)}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{item.nm}</div>
                        <div style={{ fontSize:11, color:'#aaa', marginTop:1 }}>{item.att?.clock_in?`${fmtTime(item.att.clock_in)} 출근`:'미출근'}{item.att?.clock_out?` → ${fmtTime(item.att.clock_out)} 퇴근`:''}{item.expected_in&&<span style={{ marginLeft:6, color:'#ddd' }}>(기준 {item.expected_in})</span>}</div>
                      </div>
                      <div style={{ fontSize:10, padding:'3px 10px', borderRadius:20, fontWeight:700, background:st.bg, color:st.color }}>{st.icon} {st.label}</div>
                    </div>
                    {hasBadge && (
                      <div style={{ display:'flex', gap:6, marginTop:6, paddingLeft:48, flexWrap:'wrap' }}>
                        {item.lateCount>0&&<span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'rgba(232,67,147,0.10)', color:'#E84393', fontWeight:700 }}>🔴 지각 {item.lateCount}회</span>}
                        {item.noClockOutCount>0&&<span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'rgba(253,203,110,0.18)', color:'#b8860b', fontWeight:700 }}>⏰ 퇴근누락 {item.noClockOutCount}회</span>}
                        {item.noClockInCount>0&&<span style={{ fontSize:10, padding:'2px 8px', borderRadius:10, background:'rgba(255,107,53,0.12)', color:'#FF6B35', fontWeight:700 }}>🚫 출근누락 {item.noClockInCount}회</span>}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ════ 기록 조회 탭 ════ */}
        {tab==='history' && (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
              <button onClick={prevMonth} style={{ width:36, height:36, borderRadius:10, border:'1px solid #E8ECF0', background:'#fff', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
              <span style={{ flex:1, textAlign:'center', fontSize:15, fontWeight:800, color:'#1a1a2e' }}>{histYear}년 {histMonth+1}월</span>
              <button onClick={nextMonth} style={{ width:36, height:36, borderRadius:10, border:'1px solid #E8ECF0', background:'#fff', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
              {isOwner && (
                <button onClick={exportAttendanceExcel} disabled={exporting}
                  style={{ padding:'6px 12px', borderRadius:10, border:'1px solid rgba(0,184,148,0.3)', background:'rgba(0,184,148,0.08)', color: exporting ? '#aaa' : '#00B894', fontSize:12, fontWeight:700, cursor: exporting ? 'not-allowed' : 'pointer', flexShrink:0, whiteSpace:'nowrap' }}>
                  {exporting ? '⏳...' : '📥 엑셀'}
                </button>
              )}
            </div>
            {visibleStaff.length>0 && (
              <div style={{ marginBottom:16 }}>
                {visibleStaff.map(s => {
                  const stat = monthStats[s.id]||{ normal:0, late:0, early:0, absent:0, late_early:0, no_clockout:0, no_clockin:0 }
                  const totalLate = stat.late+stat.late_early, totalEarly = stat.early+stat.late_early
                  const color = staffColorMap[s.id]||'#999'
                  return (
                    <div key={s.id} style={{ background:'#fff', borderRadius:14, border:'1px solid #E8ECF0', padding:'12px 14px', marginBottom:8, boxShadow:'0 1px 4px rgba(0,0,0,0.03)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }} />
                        <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{s.nm}</span>
                        {s.inactive_from&&s.inactive_from<=`${histYear}-${pad(histMonth+2)}-01`&&<span style={{ fontSize:10, padding:'1px 7px', borderRadius:6, background:'rgba(232,67,147,0.1)', color:'#E84393', fontWeight:700 }}>🚪 퇴사</span>}
                        <span style={{ fontSize:11, color:'#aaa', marginLeft:'auto' }}>{histYear}.{pad(histMonth+1)} 근태</span>
                      </div>
                      <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                        {[{label:'정상',value:stat.normal,color:'#00B894',bg:'rgba(0,184,148,0.08)'},{label:'지각',value:totalLate,color:'#E84393',bg:'rgba(232,67,147,0.08)'},{label:'조기퇴근',value:totalEarly,color:'#6C5CE7',bg:'rgba(108,92,231,0.08)'},{label:'결근',value:stat.absent,color:'#b2bec3',bg:'rgba(178,190,195,0.10)'}].map(item=>(
                          <div key={item.label} style={{ flex:1, textAlign:'center', padding:'8px 4px', background:item.bg, borderRadius:10 }}><div style={{ fontSize:16, fontWeight:800, color:item.color }}>{item.value}</div><div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>{item.label}</div></div>
                        ))}
                      </div>
                      <div style={{ display:'flex', gap:6 }}>
                        <div style={{ flex:1, textAlign:'center', padding:'8px 4px', background:'rgba(253,203,110,0.13)', borderRadius:10 }}><div style={{ fontSize:16, fontWeight:800, color:'#b8860b' }}>{stat.no_clockout}</div><div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>퇴근누락</div></div>
                        <div style={{ flex:1, textAlign:'center', padding:'8px 4px', background:'rgba(255,107,53,0.09)', borderRadius:10 }}><div style={{ fontSize:16, fontWeight:800, color:'#FF6B35' }}>{stat.no_clockin}</div><div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>출근누락</div></div>
                        <div style={{ flex:2 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {visibleStaff.length>0&&<div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12, padding:'10px 14px', background:'#fff', borderRadius:12, border:'1px solid #E8ECF0' }}>{visibleStaff.map(s=><div key={s.id} style={{ display:'flex', alignItems:'center', gap:5 }}><div style={{ width:10, height:10, borderRadius:'50%', background:staffColorMap[s.id]||'#999' }}/><span style={{ fontSize:12, color:'#555', fontWeight:500 }}>{s.nm}</span></div>)}</div>}
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8ECF0', boxShadow:'0 1px 4px rgba(0,0,0,0.04)', overflow:'hidden' }}>
              <div className="cal-grid" style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:'1px solid #F0F2F5' }}>
                {DOW.map((d,i)=><div key={d} style={{ textAlign:'center', padding:'10px 4px', fontSize:12, fontWeight:700, color:i===0?'#E84393':i===6?'#2DC6D6':'#888', background:'#F8F9FB' }}>{d}</div>)}
              </div>
              <div className="cal-grid" style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
                {Array.from({length:firstDow}).map((_,i)=><div key={`e-${i}`} style={{ minHeight:80, borderRight:'1px solid #F0F2F5', borderBottom:'1px solid #F0F2F5', background:'#FAFAFA' }}/>)}
                {Array.from({length:lastDate}).map((_,i)=>{
                  const day=i+1, dateStr=`${histYear}-${pad(histMonth+1)}-${pad(day)}`, dow=(firstDow+i)%7, isToday=dateStr===today, dayAtts=getDayAttendance(day)
                  return (
                    <div key={day} style={{ minHeight:80, padding:'6px 6px 8px', borderRight:'1px solid #F0F2F5', borderBottom:'1px solid #F0F2F5', background:isToday?'rgba(255,107,53,0.04)':'#fff' }}>
                      <div style={{ marginBottom:4 }}><span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center', width:22, height:22, borderRadius:'50%', fontSize:12, fontWeight:isToday?800:500, background:isToday?'#FF6B35':'transparent', color:isToday?'#fff':dow===0?'#E84393':dow===6?'#2DC6D6':'#1a1a2e' }}>{day}</span></div>
                      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                        {dayAtts.map(({nm,id,rec,expected_in,expected_out})=>{
                          const isPast=isPastDate(dateStr,today), isLate=expected_in&&rec.clock_in?tsToMinutes(rec.clock_in)>timeToMinutes(expected_in):false, isEarly=expected_out&&rec.clock_out?tsToMinutes(rec.clock_out)<timeToMinutes(expected_out):false
                          let calStatus=rec.status||'normal'
                          if (isPast&&rec.clock_in&&!rec.clock_out&&!['absent','no_clockin'].includes(calStatus)) calStatus='no_clockout'
                          else if (rec.clock_out){if(isLate&&isEarly)calStatus='late_early';else if(isLate)calStatus='late';else if(isEarly)calStatus='early';else calStatus='normal'}
                          else if(rec.clock_in)calStatus='working'
                          const st=STATUS_MAP[calStatus]||STATUS_MAP.normal, color=staffColorMap[id]||'#999'
                          return <div key={id} style={{ background:`${color}15`, borderLeft:`3px solid ${color}`, borderRadius:'0 4px 4px 0', padding:'2px 5px', fontSize:10, lineHeight:1.4 }}><div style={{ fontWeight:700, color, marginBottom:1 }}>{nm}</div><div style={{ color:'#666' }}>{fmtTime(rec.clock_in)||'-'}{rec.clock_out?`→${fmtTime(rec.clock_out)}`:rec.clock_in?'근무중':''}</div>{calStatus!=='normal'&&calStatus!=='working'&&<div style={{ color:st.color, fontSize:9, fontWeight:700 }}>{st.icon} {st.label}</div>}</div>
                        })}
                        {dayAtts.length===0&&<div style={{ fontSize:10, color:'#ddd', textAlign:'center', paddingTop:4 }}>—</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ════ 전지점 탭 ════ */}
        {tab==='all' && (
          <>
            <div style={{ display:'flex', background:'#E8ECF0', borderRadius:10, padding:3, marginBottom:16, gap:2 }}>
              {([{v:'today',l:'📋 오늘 현황'},{v:'month',l:'📅 월별 기록'}] as const).map(t=>(
                <button key={t.v} onClick={()=>setAllView(t.v)} style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:13, fontWeight:allView===t.v?700:400, background:allView===t.v?'#fff':'transparent', color:allView===t.v?'#1a1a2e':'#aaa', boxShadow:allView===t.v?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>{t.l}</button>
              ))}
            </div>
            {allView==='today'&&(
              <>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:'#1a1a2e' }}>🏪 전지점 오늘 출근 현황</div>
                  <button onClick={()=>loadAllStoresBoard(allStores)} style={{ background:'#f0f4ff', border:'1px solid #d0d8f0', borderRadius:8, padding:'6px 12px', fontSize:12, fontWeight:600, color:'#4a6cf7', cursor:'pointer' }}>🔄 새로고침</button>
                </div>
                {allStoresLoading?<div style={{ textAlign:'center', padding:40, color:'#aaa', fontSize:14 }}>불러오는 중...</div>
                :allStores.length===0?<div style={{ textAlign:'center', padding:40, color:'#aaa', fontSize:14 }}>등록된 지점이 없습니다</div>
                :<div className="all-grid">{allStores.map((store:any)=>{
                  const board=allStoresBoard[store.id]||[], working=board.filter((b:any)=>b.status==='working').length, done=board.filter((b:any)=>['normal','late','early','late_early'].includes(b.status)).length, problem=board.filter((b:any)=>['late','late_early','no_clockout','no_clockin','absent'].includes(b.status)).length, pending=board.filter((b:any)=>b.status==='pending').length, total=board.length
                  return (
                    <div key={store.id} style={{ background:'#fff', borderRadius:16, border:'1px solid #E8ECF0', padding:14, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                      <div style={{ marginBottom:10 }}><div style={{ fontSize:13, fontWeight:800, color:'#1a1a2e', marginBottom:6 }}>🏪 {store.name}</div><div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>{working>0&&<span style={{ background:'rgba(255,107,53,0.12)', color:'#FF6B35', borderRadius:6, padding:'2px 7px', fontSize:10, fontWeight:700 }}>💼 {working}</span>}{problem>0&&<span style={{ background:'rgba(232,67,147,0.1)', color:'#E84393', borderRadius:6, padding:'2px 7px', fontSize:10, fontWeight:700 }}>⚠️ {problem}</span>}<span style={{ background:'#f4f6f8', color:'#888', borderRadius:6, padding:'2px 7px', fontSize:10, fontWeight:600 }}>전체 {total}</span></div></div>
                      {board.length===0?<div style={{ textAlign:'center', padding:'12px 0', color:'#ccc', fontSize:12 }}>스케줄 없음</div>:<div style={{ display:'flex', flexDirection:'column', gap:5 }}>{board.map((b:any)=>{const st=STATUS_MAP[b.status]||STATUS_MAP.pending;return<div key={b.pid||b.nm} style={{ display:'flex', alignItems:'center', background:st.bg, borderRadius:9, padding:'6px 9px', gap:7 }}><span style={{ fontSize:13 }}>{st.icon}</span><div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:12, fontWeight:700, color:'#1a1a2e', wordBreak:'keep-all' }}>{b.nm}</div><div style={{ fontSize:10, color:st.color, fontWeight:600 }}>{b.att?.clock_in?fmtTime(b.att.clock_in)+(b.att.clock_out?`→${fmtTime(b.att.clock_out)}`:'~'):'미출근'}</div></div><div style={{ fontSize:9, color:st.color, fontWeight:700, flexShrink:0 }}>{st.label}</div></div>})}</div>}
                      {total>0&&<div style={{ display:'flex', gap:3, marginTop:10, borderTop:'1px solid #f0f0f0', paddingTop:8 }}>{[{label:'완료',val:done,color:'#00B894'},{label:'근무중',val:working,color:'#FF6B35'},{label:'대기',val:pending,color:'#bbb'}].map(item=><div key={item.label} style={{ flex:1, textAlign:'center', background:`${item.color}10`, borderRadius:7, padding:'4px 0' }}><div style={{ fontSize:13, fontWeight:800, color:item.color }}>{item.val}</div><div style={{ fontSize:9, color:'#999' }}>{item.label}</div></div>)}</div>}
                    </div>
                  )
                })}</div>}
              </>
            )}
            {allView==='month'&&(
              <>
                <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#888' }}>📅</div>
                  <select value={allMonthYear} onChange={e=>setAllMonthYear(Number(e.target.value))} style={{ flex:1, padding:'9px 12px', borderRadius:10, border:'1px solid #E8ECF0', background:'#fff', fontSize:14, fontWeight:700, color:'#1a1a2e', outline:'none', cursor:'pointer', appearance:'auto' }}>{Array.from({length:5},(_,i)=>nowDate.getFullYear()-2+i).map(y=><option key={y} value={y}>{y}년</option>)}</select>
                  <select value={allMonthMonth} onChange={e=>setAllMonthMonth(Number(e.target.value))} style={{ flex:1, padding:'9px 12px', borderRadius:10, border:'1px solid #E8ECF0', background:'#fff', fontSize:14, fontWeight:700, color:'#1a1a2e', outline:'none', cursor:'pointer', appearance:'auto' }}>{Array.from({length:12},(_,i)=>i).map(m=><option key={m} value={m}>{m+1}월</option>)}</select>
                  <button onClick={exportAllStoresExcel} disabled={allExporting || allMonthLoading || Object.keys(allMonthData).length===0}
                    style={{ padding:'9px 14px', borderRadius:10, border:'1px solid rgba(0,184,148,0.3)', background:'rgba(0,184,148,0.08)', color: (allExporting||allMonthLoading||Object.keys(allMonthData).length===0)?'#aaa':'#00B894', fontSize:12, fontWeight:700, cursor:(allExporting||allMonthLoading||Object.keys(allMonthData).length===0)?'not-allowed':'pointer', flexShrink:0, whiteSpace:'nowrap' }}>
                    {allExporting ? '⏳...' : '📥 엑셀'}
                  </button>
                </div>
                {allMonthLoading?<div style={{ textAlign:'center', padding:40, color:'#aaa', fontSize:14 }}>불러오는 중...</div>
                :allStores.map((store:any)=>{
                  const d=allMonthData[store.id]; if(!d) return <div key={store.id} style={{ ...bx, textAlign:'center', color:'#bbb', padding:20, fontSize:13 }}>로딩 중...</div>
                  const {staff,att}=d, lastDay=new Date(allMonthYear,allMonthMonth+1,0).getDate()
                  const am: Record<string,Record<string,any>>={};staff.forEach((s:any)=>{am[s.id]={}});att.forEach((a:any)=>{if(am[a.profile_id])am[a.profile_id][a.work_date]=a})
                  const ss=staff.map((s:any)=>{let normal=0,late=0,early=0,absent=0,no_clockout=0,no_clockin=0;for(let d2=1;d2<=lastDay;d2++){const ds=`${allMonthYear}-${pad(allMonthMonth+1)}-${pad(d2)}`,r=am[s.id]?.[ds];if(!r)continue;const isLate=s.expected_in&&r.clock_in?tsToMinutes(r.clock_in)>timeToMinutes(s.expected_in):false,isEarly=s.expected_out&&r.clock_out?tsToMinutes(r.clock_out)<timeToMinutes(s.expected_out):false,isPast=ds<today;if(r.status==='absent'||r.status==='no_clockin'){absent++;no_clockin++}else if(isPast&&r.clock_in&&!r.clock_out)no_clockout++;else if(isLate&&isEarly){late++;early++}else if(isLate)late++;else if(isEarly)early++;else if(r.clock_in)normal++}return{...s,normal,late,early,absent,no_clockout,no_clockin}})
                  const sk=`month_open_${store.id}`, isOpen=typeof window!=='undefined'?sessionStorage.getItem(sk)!=='false':true
                  return (
                    <div key={store.id} style={{ ...bx, marginBottom:12 }}>
                      <button onClick={()=>{const next=sessionStorage.getItem(sk)==='false'?'true':'false';sessionStorage.setItem(sk,next);setAllMonthData(p=>({...p}))}} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', background:'none', border:'none', cursor:'pointer', padding:0, marginBottom:isOpen?14:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ fontSize:14, fontWeight:800, color:'#1a1a2e' }}>🏪 {store.name}</span><span style={{ fontSize:11, color:'#aaa' }}>{staff.length}명</span></div>
                        <span style={{ fontSize:13, color:'#bbb' }}>{isOpen?'▲':'▼'}</span>
                      </button>
                      {isOpen&&(staff.length===0?<div style={{ textAlign:'center', padding:'16px 0', color:'#ccc', fontSize:13 }}>등록된 직원 없음</div>:(
                        <>
                          <div style={{ marginBottom:14 }}>{ss.map((s:any)=><div key={s.id} style={{ background:'#F8F9FB', borderRadius:12, padding:'10px 12px', marginBottom:8 }}><div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}><div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', flex:1 }}>{s.nm}</div><div style={{ fontSize:10, color:'#bbb' }}>{s.expected_in||'--'} ~ {s.expected_out||'--'}</div></div><div style={{ display:'flex', gap:4 }}>{[{label:'정상',val:s.normal,color:'#00B894'},{label:'지각',val:s.late,color:'#E84393'},{label:'조퇴',val:s.early,color:'#6C5CE7'},{label:'결근',val:s.absent,color:'#b2bec3'},{label:'퇴근누락',val:s.no_clockout,color:'#b8860b'},{label:'출근누락',val:s.no_clockin,color:'#FF6B35'}].map(item=><div key={item.label} style={{ flex:1, textAlign:'center', background:`${item.color}12`, borderRadius:8, padding:'5px 2px' }}><div style={{ fontSize:13, fontWeight:800, color:item.color }}>{item.val}</div><div style={{ fontSize:9, color:'#aaa', marginTop:1, lineHeight:1.2 }}>{item.label}</div></div>)}</div></div>)}</div>
                          <div style={{ overflowX:'auto' }}>
                            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11, minWidth:staff.length>3?520:undefined }}>
                              <thead><tr style={{ background:'#F4F6F9' }}><th style={{ padding:'6px 8px', textAlign:'left', color:'#888', fontWeight:700, fontSize:11, borderBottom:'1px solid #E8ECF0', position:'sticky', left:0, background:'#F4F6F9', zIndex:1, minWidth:58 }}>날짜</th>{staff.map((s:any)=><th key={s.id} style={{ padding:'6px 4px', textAlign:'center', color:'#1a1a2e', fontWeight:700, fontSize:11, borderBottom:'1px solid #E8ECF0', minWidth:72 }}>{s.nm}</th>)}</tr></thead>
                              <tbody>{Array.from({length:lastDay},(_,i)=>{const day=i+1,ds=`${allMonthYear}-${pad(allMonthMonth+1)}-${pad(day)}`,dow=new Date(allMonthYear,allMonthMonth,day).getDay(),isToday2=ds===today,isWknd=dow===0||dow===6;return<tr key={day} style={{ background:isToday2?'rgba(255,107,53,0.05)':isWknd?'rgba(0,0,0,0.02)':'#fff', borderBottom:'1px solid #F4F6F9' }}><td style={{ padding:'5px 8px', fontWeight:isToday2?800:500, color:isToday2?'#FF6B35':dow===0?'#E84393':dow===6?'#2DC6D6':'#555', fontSize:11, position:'sticky', left:0, background:isToday2?'rgba(255,107,53,0.08)':isWknd?'rgba(0,0,0,0.02)':'#fff', zIndex:1, whiteSpace:'nowrap' }}>{allMonthMonth+1}/{day} <span style={{ fontSize:9, color:'#bbb' }}>{DOW[dow]}</span></td>{staff.map((s:any)=>{const r=am[s.id]?.[ds];if(!r)return<td key={s.id} style={{ padding:'5px 4px', textAlign:'center', color:'#e0e0e0', fontSize:10 }}>—</td>;const isLate=s.expected_in&&r.clock_in?tsToMinutes(r.clock_in)>timeToMinutes(s.expected_in):false,isEarly=s.expected_out&&r.clock_out?tsToMinutes(r.clock_out)<timeToMinutes(s.expected_out):false,isPast=ds<today;let calSt='normal';if(r.status==='absent'||r.status==='no_clockin')calSt='absent';else if(isPast&&r.clock_in&&!r.clock_out)calSt='no_clockout';else if(isLate&&isEarly)calSt='late_early';else if(isLate)calSt='late';else if(isEarly)calSt='early';else if(r.clock_in&&!r.clock_out)calSt='working';const st=STATUS_MAP[calSt]||STATUS_MAP.normal;return<td key={s.id} style={{ padding:'4px', textAlign:'center' }}><div style={{ background:st.bg, borderRadius:6, padding:'3px 2px' }}><div style={{ fontSize:9, fontWeight:700, color:st.color }}>{st.icon} {st.label}</div><div style={{ fontSize:9, color:'#888', marginTop:1 }}>{fmtTime(r.clock_in)||'?'}{r.clock_out?`→${fmtTime(r.clock_out)}`:''}</div></div></td>})}</tr>})}</tbody>
                            </table>
                          </div>
                        </>
                      ))}
                    </div>
                  )
                })}
              </>
            )}
          </>
        )}

        {showRequest&&<RequestModal today={today} onClose={()=>setShowRequest(false)} onSubmit={submitRequest}/>}
        {showOwnerPanel&&<OwnerRequestPanel storeId={storeId} onClose={()=>setShowOwnerPanel(false)} onApproved={()=>{loadPendingCount(storeId);setShowOwnerPanel(false)}}/>}
        {showStaffTimePanel&&<StaffTimePanel storeId={storeId} staffList={staffList} onClose={()=>setShowStaffTimePanel(false)} onSaved={()=>loadStaffList(storeId)}/>}
        {editItem&&<StaffAttendanceEditModal item={editItem} storeId={storeId} workDate={today} onClose={()=>setEditItem(null)} onSaved={()=>{setEditItem(null);loadBoard(storeId)}}/>}
      </div>
    </div>
  )
}