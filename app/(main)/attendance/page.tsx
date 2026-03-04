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

const DOW = ['일','월','화','수','목','금','토']

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
    await supabase.from('store_members')
      .update({ expected_clock_in: inTime || null, expected_clock_out: outTime || null })
      .eq('store_id', storeId).eq('profile_id', staff.id)
    setSaving(false); onSaved(); onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000,
      display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480,
        borderRadius:'20px 20px 0 0', padding:24, paddingBottom:44 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>⏰ {staff.nm} 근무시간 설정</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ background:'rgba(255,107,53,0.06)', borderRadius:10, padding:'10px 12px',
          marginBottom:16, fontSize:12, color:'#FF6B35', fontWeight:600 }}>
          ⚡ 설정 시간 기준으로 지각·조기퇴근·퇴근누락이 자동 판단됩니다
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:20 }}>
          <div>
            <div style={{ fontSize:11, color:'#aaa', fontWeight:600, marginBottom:6 }}>출근 기준시간</div>
            <input type="time" value={inTime} onChange={e => setInTime(e.target.value)}
              style={{ width:'100%', padding:'12px', borderRadius:10, border:'1px solid #E8ECF0',
                background:'#F8F9FB', fontSize:14, color:'#1a1a2e', outline:'none', boxSizing:'border-box' }} />
            <div style={{ fontSize:10, color:'#bbb', marginTop:4 }}>이 시간 이후 출근 → 지각</div>
          </div>
          <div>
            <div style={{ fontSize:11, color:'#aaa', fontWeight:600, marginBottom:6 }}>퇴근 기준시간</div>
            <input type="time" value={outTime} onChange={e => setOutTime(e.target.value)}
              style={{ width:'100%', padding:'12px', borderRadius:10, border:'1px solid #E8ECF0',
                background:'#F8F9FB', fontSize:14, color:'#1a1a2e', outline:'none', boxSizing:'border-box' }} />
            <div style={{ fontSize:10, color:'#bbb', marginTop:4 }}>이 시간 이전 퇴근 → 조기퇴근</div>
          </div>
        </div>
        <button onClick={save} disabled={saving}
          style={{ width:'100%', padding:14, borderRadius:12, border:'none',
            background:'linear-gradient(135deg,#FF6B35,#E84393)', color:'#fff',
            fontSize:14, fontWeight:700, cursor:'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? '저장 중...' : '💾 저장'}
        </button>
      </div>
    </div>
  )
}

// ── 직원 목록 패널 ──
function StaffTimePanel({ storeId, staffList, onClose, onSaved }: {
  storeId: string; staffList: any[]; onClose: () => void; onSaved: () => void
}) {
  const [selected, setSelected] = useState<any>(null)
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999,
      display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480,
        borderRadius:'20px 20px 0 0', padding:20, paddingBottom:44, maxHeight:'80vh', overflowY:'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>⏰ 직원별 근무시간 설정</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ background:'rgba(232,67,147,0.05)', borderRadius:10, padding:'8px 12px',
          marginBottom:14, fontSize:11, color:'#E84393', fontWeight:600 }}>
          👑 대표만 설정 가능합니다
        </div>
        {staffList.map(s => (
          <div key={s.id} style={{ display:'flex', alignItems:'center', gap:12,
            padding:'12px 14px', background:'#F8F9FB', borderRadius:12, marginBottom:8 }}>
            <div style={{ width:36, height:36, borderRadius:10, flexShrink:0,
              background:'linear-gradient(135deg,#FF6B35,#E84393)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:14, fontWeight:800, color:'#fff' }}>{s.nm?.charAt(0)}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{s.nm}</div>
              <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>
                {s.expected_in  ? `출근기준 ${s.expected_in}` : '출근 미설정'}
                {' · '}
                {s.expected_out ? `퇴근기준 ${s.expected_out}` : '퇴근 미설정'}
              </div>
            </div>
            <button onClick={() => setSelected(s)}
              style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #E8ECF0',
                background:'#fff', color:'#6C5CE7', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              설정
            </button>
          </div>
        ))}
      </div>
      {selected && (
        <StaffScheduleModal staff={selected} storeId={storeId}
          onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); onSaved() }} />
      )}
    </div>
  )
}

// ── 수정 요청 모달 ──
function RequestModal({ today, onClose, onSubmit }: {
  today: string; onClose: () => void
  onSubmit: (type: string, ci: string, co: string, reason: string) => void
}) {
  const [type,   setType]   = useState<'clock_in'|'clock_out'|'both'>('clock_in')
  const [ci,     setCi]     = useState('')
  const [co,     setCo]     = useState('')
  const [reason, setReason] = useState('')
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999,
      display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0',
        padding:24, paddingBottom:44 }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>✏️ 출퇴근 수정 요청</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ background:'rgba(108,92,231,0.06)', borderRadius:10, padding:'10px 12px',
          marginBottom:16, fontSize:12, color:'#6C5CE7', fontWeight:600 }}>
          📋 요청 후 대표 승인 시 반영됩니다
        </div>
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, color:'#aaa', fontWeight:600, marginBottom:8 }}>요청 유형</div>
          <div style={{ display:'flex', gap:8 }}>
            {([{v:'clock_in',l:'출근 누락'},{v:'clock_out',l:'퇴근 누락'},{v:'both',l:'출퇴근 모두'}] as const).map(o => (
              <button key={o.v} onClick={() => setType(o.v)}
                style={{ flex:1, padding:'8px 0', borderRadius:10, cursor:'pointer',
                  border: type===o.v ? '1.5px solid #6C5CE7' : '1px solid #E8ECF0',
                  background: type===o.v ? 'rgba(108,92,231,0.08)' : '#F8F9FB',
                  color: type===o.v ? '#6C5CE7' : '#888',
                  fontSize:12, fontWeight: type===o.v ? 700 : 400 }}>{o.l}</button>
            ))}
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns: type==='both' ? '1fr 1fr' : '1fr', gap:10, marginBottom:14 }}>
          {(type==='clock_in'||type==='both') && (
            <div>
              <div style={{ fontSize:11, color:'#aaa', fontWeight:600, marginBottom:6 }}>출근 시간</div>
              <input type="time" value={ci} onChange={e => setCi(e.target.value)}
                style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid #E8ECF0',
                  background:'#F8F9FB', fontSize:14, color:'#1a1a2e', outline:'none', boxSizing:'border-box' }} />
            </div>
          )}
          {(type==='clock_out'||type==='both') && (
            <div>
              <div style={{ fontSize:11, color:'#aaa', fontWeight:600, marginBottom:6 }}>퇴근 시간</div>
              <input type="time" value={co} onChange={e => setCo(e.target.value)}
                style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid #E8ECF0',
                  background:'#F8F9FB', fontSize:14, color:'#1a1a2e', outline:'none', boxSizing:'border-box' }} />
            </div>
          )}
        </div>
        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, color:'#aaa', fontWeight:600, marginBottom:6 }}>사유</div>
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            placeholder="수정이 필요한 사유를 입력해주세요" rows={3}
            style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid #E8ECF0',
              background:'#F8F9FB', fontSize:13, color:'#1a1a2e', outline:'none', resize:'none', boxSizing:'border-box' }} />
        </div>
        <button onClick={() => { if (!reason.trim()) return alert('사유를 입력해주세요'); onSubmit(type, ci, co, reason) }}
          style={{ width:'100%', padding:14, borderRadius:12, border:'none',
            background:'linear-gradient(135deg,#6C5CE7,#E84393)', color:'#fff',
            fontSize:14, fontWeight:700, cursor:'pointer' }}>요청 보내기</button>
      </div>
    </div>
  )
}

// ── 대표 수정 요청 패널 ──
function OwnerRequestPanel({ storeId, onClose, onApproved }: {
  storeId: string; onClose: () => void; onApproved: () => void
}) {
  const [requests, setRequests] = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  useEffect(() => { loadRequests() }, [])
  async function loadRequests() {
    const { data } = await supabase.from('attendance_requests')
      .select('*, profiles(nm)').eq('store_id', storeId).eq('status', 'pending')
      .order('created_at', { ascending: false })
    setRequests(data || []); setLoading(false)
  }
  async function approve(req: any) {
    const { data: existing } = await supabase.from('attendance')
      .select('*').eq('store_id', storeId).eq('profile_id', req.profile_id)
      .eq('work_date', req.work_date).maybeSingle()
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
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999,
      display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0',
        padding:20, paddingBottom:44, maxHeight:'80vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>✏️ 수정 요청 처리</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>
        {loading ? <div style={{ textAlign:'center', padding:40, color:'#bbb' }}>로딩중...</div>
        : requests.length === 0 ? (
          <div style={{ textAlign:'center', padding:40, color:'#bbb' }}>
            <div style={{ fontSize:24, marginBottom:8 }}>✅</div>
            <div style={{ fontSize:13 }}>대기 중인 요청이 없습니다</div>
          </div>
        ) : requests.map(req => (
          <div key={req.id} style={{ background:'#F8F9FB', borderRadius:14, padding:14, marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{req.profiles?.nm}</span>
              <span style={{ fontSize:11, color:'#aaa' }}>{req.work_date}</span>
            </div>
            <div style={{ fontSize:11, color:'#6C5CE7', fontWeight:600, marginBottom:6 }}>
              {req.request_type==='clock_in' ? '출근 누락' : req.request_type==='clock_out' ? '퇴근 누락' : '출퇴근 모두'}
            </div>
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

  const [notices,        setNotices]        = useState<any[]>([])
  const [checkedNotices, setCheckedNotices] = useState<Set<string>>(new Set())
  // ★ 전달사항 전체 체크해야 출근 가능
  const allChecked = notices.length === 0 || notices.every(n => checkedNotices.has(n.id))

  const [todaySchedule, setTodaySchedule]   = useState<any>(null)
  const [attendance,    setAttendance]       = useState<any>(null)
  const [attLoading,    setAttLoading]       = useState(true)
  const [boardList,     setBoardList]        = useState<any[]>([])
  const [tab,           setTab]              = useState<'today'|'history'>('today')

  const [histYear,          setHistYear]          = useState(nowDate.getFullYear())
  const [histMonth,         setHistMonth]          = useState(nowDate.getMonth())
  const [staffList,         setStaffList]          = useState<any[]>([])
  const [allAttData,        setAllAttData]         = useState<any[]>([])
  const [showRequest,       setShowRequest]        = useState(false)
  const [showOwnerPanel,    setShowOwnerPanel]     = useState(false)
  const [showStaffTimePanel,setShowStaffTimePanel] = useState(false)
  const [pendingCount,      setPendingCount]       = useState(0)

  // ★ 직원 본인 이번달 통계 (오늘 탭용)
  const [myMonthData, setMyMonthData] = useState<any[]>([])

  // attLoading 끝날 때까지 출근 버튼 비활성 — 로딩 전에 눌리는 버그 방지
  const canClockIn  = !attLoading && wifiOk && allChecked && !attendance?.clock_in
  const canClockOut = !attLoading && wifiOk && !!attendance?.clock_in && !attendance?.clock_out

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('mj_user')  || '{}')
    const s = JSON.parse(localStorage.getItem('mj_store') || '{}')
    if (!u.id || !s.id) return
    setProfileId(u.id); setStoreId(s.id)
    setMyName(u.nm || ''); setRole(u.role || 'staff')
    fetchCurrentIp()
    loadAllowedIp(s.id)
    loadTodayNotices(s.id)
    loadMyAttendance(u.id, s.id)
    loadTodaySchedule(u.nm, s.id)
    loadBoard(s.id)
    loadStaffList(s.id)
    loadMyMonthData(u.id, s.id)
    if (u.role==='owner'||u.role==='manager') loadPendingCount(s.id)
  }, [])

  useEffect(() => {
    if (storeId) loadAllAttendance(storeId, histYear, histMonth)
  }, [histYear, histMonth, storeId])

  async function fetchCurrentIp() {
    try { const r = await fetch('https://api.ipify.org?format=json'); const d = await r.json(); setCurrentIp(d.ip) }
    catch { setCurrentIp('') }
    setIpLoading(false)
  }
  async function loadAllowedIp(sid: string) {
    const { data } = await supabase.from('stores').select('allowed_ip').eq('id', sid).single()
    setAllowedIp(data?.allowed_ip || '')
  }
  async function loadTodayNotices(sid: string) {
    const { data } = await supabase.from('notices').select('id, title, content, author_nm')
      .eq('store_id', sid).order('created_at', { ascending: false }).limit(5)
    setNotices(data || [])
  }
  async function loadMyAttendance(pid: string, sid: string) {
    const { data } = await supabase.from('attendance').select('*')
      .eq('profile_id', pid).eq('store_id', sid).eq('work_date', today).maybeSingle()
    setAttendance(data || null); setAttLoading(false)
  }
  async function loadTodaySchedule(nm: string, sid: string) {
    const { data } = await supabase.from('schedules').select('*')
      .eq('store_id', sid).eq('staff_name', nm).eq('schedule_date', today).maybeSingle()
    setTodaySchedule(data || null)
  }

  // ★ 직원 본인 이번달 출근 기록 (오늘 탭 통계용)
  async function loadMyMonthData(pid: string, sid: string) {
    const monthStart = `${today.slice(0,7)}-01`
    const { data } = await supabase.from('attendance')
      .select('status, clock_in, clock_out, work_date')
      .eq('store_id', sid).eq('profile_id', pid)
      .gte('work_date', monthStart).lte('work_date', today)
    setMyMonthData(data || [])
  }

  async function loadBoard(sid: string) {
    const { data: todaySchedules } = await supabase.from('schedules')
      .select('staff_name, status')
      .eq('store_id', sid).eq('schedule_date', today).in('status', ['work','half'])

    const { data: members } = await supabase.from('store_members')
      .select('profile_id, profiles(nm), expected_clock_in, expected_clock_out')
      .eq('store_id', sid).eq('active', true)

    const nameToInfo: Record<string, { id:string; expected_in?:string; expected_out?:string }> = {}
    ;(members || []).forEach((m: any) => {
      nameToInfo[m.profiles?.nm] = { id:m.profile_id, expected_in:m.expected_clock_in, expected_out:m.expected_clock_out }
    })

    const { data: attRecords } = await supabase.from('attendance')
      .select('*').eq('store_id', sid).eq('work_date', today)
    const attMap: Record<string, any> = {}
    ;(attRecords || []).forEach((a: any) => { attMap[a.profile_id] = a })

    // 이번달 누적 집계
    const monthStart = `${today.slice(0,7)}-01`
    const { data: monthAtt } = await supabase.from('attendance')
      .select('profile_id, status, clock_in, clock_out, work_date')
      .eq('store_id', sid).gte('work_date', monthStart).lte('work_date', today)

    const lateMap:       Record<string, number> = {}
    const noClockOutMap: Record<string, number> = {}
    const noClockInMap:  Record<string, number> = {}
    ;(monthAtt || []).forEach((a: any) => {
      const pid = a.profile_id
      if (a.status==='late'||a.status==='late_early') lateMap[pid] = (lateMap[pid]||0)+1
      if (isPastDate(a.work_date, today) && a.clock_in && !a.clock_out && a.status!=='absent' && a.status!=='no_clockin')
        noClockOutMap[pid] = (noClockOutMap[pid]||0)+1
      if (a.status==='no_clockin'||a.status==='absent')
        noClockInMap[pid] = (noClockInMap[pid]||0)+1
    })

    setBoardList((todaySchedules||[]).map((s: any) => {
      const info = nameToInfo[s.staff_name] || {}
      const pid  = info.id || ''
      const att  = attMap[pid] || null
      let status = 'pending'
      if (att) {
        const isLate  = info.expected_in  ? tsToMinutes(att.clock_in) > timeToMinutes(info.expected_in)   : (att.is_late||false)
        const isEarly = info.expected_out && att.clock_out ? tsToMinutes(att.clock_out) < timeToMinutes(info.expected_out) : false
        if (att.clock_out) {
          if (isLate && isEarly) status='late_early'
          else if (isLate)  status='late'
          else if (isEarly) status='early'
          else status='normal'
        } else if (att.clock_in) status='working'
      }
      return {
        pid, nm:s.staff_name, att, status,
        expected_in:info.expected_in, expected_out:info.expected_out,
        lateCount:lateMap[pid]||0, noClockOutCount:noClockOutMap[pid]||0, noClockInCount:noClockInMap[pid]||0,
      }
    }))
  }

  async function loadPendingCount(sid: string) {
    const { count } = await supabase.from('attendance_requests')
      .select('*', { count:'exact', head:true }).eq('store_id', sid).eq('status', 'pending')
    setPendingCount(count||0)
  }

  async function loadStaffList(sid: string) {
    const { data } = await supabase.from('store_members')
      .select('profile_id, profiles(nm), expected_clock_in, expected_clock_out')
      .eq('store_id', sid).eq('active', true)
    setStaffList((data||[]).map((m: any) => ({
      id:m.profile_id, nm:m.profiles?.nm||'',
      expected_in:m.expected_clock_in||'', expected_out:m.expected_clock_out||'',
    })))
  }

  async function loadAllAttendance(sid: string, y: number, m: number) {
    const from = `${y}-${pad(m+1)}-01`
    const to   = `${y}-${pad(m+1)}-${pad(new Date(y,m+1,0).getDate())}`
    const { data } = await supabase.from('attendance')
      .select('*, profiles(nm)').eq('store_id', sid).gte('work_date', from).lte('work_date', to)
    setAllAttData(data||[])
  }

  async function clockIn() {
    if (!canClockIn) return
    const nowTs  = new Date().toISOString()
    const myInfo = staffList.find(s => s.id === profileId)
    const isLate = myInfo?.expected_in ? tsToMinutes(nowTs) > timeToMinutes(myInfo.expected_in) : false
    const lateMin = isLate && myInfo?.expected_in ? tsToMinutes(nowTs) - timeToMinutes(myInfo.expected_in) : 0
    const rec = { store_id:storeId, profile_id:profileId, work_date:today,
      clock_in:nowTs, status:isLate?'late':'normal', is_late:isLate, late_minutes:lateMin }
    const { data: existing } = await supabase.from('attendance').select('id')
      .eq('store_id', storeId).eq('profile_id', profileId).eq('work_date', today).maybeSingle()
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
    await supabase.from('attendance_requests').insert({
      store_id:storeId, profile_id:profileId, work_date:today, request_type:type,
      requested_clock_in:ci?toTs(ci):null, requested_clock_out:co?toTs(co):null, reason
    })
    setShowRequest(false); alert('✅ 수정 요청이 전송되었습니다')
  }

  function prevMonth() {
    if (histMonth===0) { setHistYear(y=>y-1); setHistMonth(11) } else setHistMonth(m=>m-1)
  }
  function nextMonth() {
    if (histMonth===11) { setHistYear(y=>y+1); setHistMonth(0) } else setHistMonth(m=>m+1)
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
    return visibleStaff.map(staff => {
      const rec = attMatrix[staff.id]?.[dateStr]
      return { nm:staff.nm, id:staff.id, rec, expected_in:staff.expected_in, expected_out:staff.expected_out, dateStr }
    }).filter(x => x.rec)
  }

  // ★ 월별 통계: 정상/지각/조기퇴근/결근/퇴근누락/출근누락
  const monthStats = useMemo(() => {
    const stats: Record<string, { normal:number; late:number; early:number; absent:number; late_early:number; no_clockout:number; no_clockin:number }> = {}
    visibleStaff.forEach(s => { stats[s.id]={ normal:0, late:0, early:0, absent:0, late_early:0, no_clockout:0, no_clockin:0 } })
    allAttData.forEach(r => {
      if (!stats[r.profile_id]) return
      const st = r.status||'normal'
      if      (st==='normal')    stats[r.profile_id].normal++
      else if (st==='late')      stats[r.profile_id].late++
      else if (st==='early')     stats[r.profile_id].early++
      else if (st==='absent')    { stats[r.profile_id].absent++; stats[r.profile_id].no_clockin++ }
      else if (st==='late_early') stats[r.profile_id].late_early++
      else if (st==='no_clockin') stats[r.profile_id].no_clockin++
      // 당일 지난 기록 중 퇴근 없으면 퇴근누락
      if (isPastDate(r.work_date, today) && r.clock_in && !r.clock_out && st!=='absent' && st!=='no_clockin')
        stats[r.profile_id].no_clockout++
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
    : !allChecked
    ? '전달사항을 모두 확인(체크)해야 출근할 수 있어요'
    : attendance?.clock_in ? '이미 출근했습니다' : null

  return (
    <div style={{ minHeight:'100vh', background:'#F4F6F9' }}>
      <style>{`
        .att-wrap { max-width:480px; margin:0 auto; padding:16px 16px 100px; }
        @media(min-width:768px){
          .att-wrap { max-width:100%; padding:24px 40px 40px; }
          .cal-grid { grid-template-columns:repeat(7,1fr)!important; }
        }
      `}</style>
      <div className="att-wrap">

        {/* 헤더 */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:17, fontWeight:700, color:'#1a1a2e' }}>🕐 출퇴근</span>
          <div style={{ display:'flex', gap:8 }}>
            {/* ★ 시간설정: 대표(owner)만 */}
            {isOwner && (
              <button onClick={() => setShowStaffTimePanel(true)}
                style={{ padding:'6px 12px', borderRadius:10, cursor:'pointer',
                  background:'rgba(108,92,231,0.08)', border:'1px solid rgba(108,92,231,0.2)',
                  color:'#6C5CE7', fontSize:12, fontWeight:700 }}>
                ⏰ 시간설정
              </button>
            )}
            {canSeeAll && (
              <button onClick={() => setShowOwnerPanel(true)}
                style={{ padding:'6px 14px', borderRadius:10, cursor:'pointer',
                  background: pendingCount>0 ? 'rgba(232,67,147,0.1)' : '#F4F6F9',
                  border: pendingCount>0 ? '1px solid rgba(232,67,147,0.3)' : '1px solid #E8ECF0',
                  color: pendingCount>0 ? '#E84393' : '#888', fontSize:12, fontWeight:700 }}>
                ✏️ 수정요청
                {pendingCount>0 && (
                  <span style={{ marginLeft:6, background:'#E84393', color:'#fff',
                    borderRadius:10, padding:'1px 6px', fontSize:10 }}>{pendingCount}</span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* 탭 */}
        <div style={{ display:'flex', background:'#E8ECF0', borderRadius:12, padding:4, marginBottom:16 }}>
          {([{v:'today',l:'오늘'},{v:'history',l:'📋 기록 조회'}] as const).map(t => (
            <button key={t.v} onClick={() => setTab(t.v)}
              style={{ flex:1, padding:'9px 0', borderRadius:10, border:'none', cursor:'pointer',
                fontSize:13, fontWeight:tab===t.v?700:400,
                background:tab===t.v?'#fff':'transparent',
                color:tab===t.v?'#1a1a2e':'#aaa',
                boxShadow:tab===t.v?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>
              {t.l}
            </button>
          ))}
        </div>

        {/* ════ 오늘 탭 ════ */}
        {tab==='today' && (
          <>
            {/* 와이파이 */}
            <div style={{ borderRadius:12, padding:'10px 14px', marginBottom:12,
              display:'flex', alignItems:'center', gap:10, fontSize:13, fontWeight:600,
              background:wifiOk?'rgba(0,184,148,0.08)':'rgba(232,67,147,0.08)',
              border:`1px solid ${wifiOk?'rgba(0,184,148,0.3)':'rgba(232,67,147,0.3)'}`,
              color:wifiOk?'#00B894':'#E84393' }}>
              <span>📶</span>
              <span style={{ flex:1 }}>
                {ipLoading?'와이파이 확인중...' :
                  !allowedIp?'매장 IP 미등록 — 대표가 먼저 IP를 등록해주세요':
                  wifiOk?'매장 와이파이 연결됨 — 출퇴근 가능':
                  '매장 와이파이 미연결 — 출퇴근 불가'}
              </span>
            </div>

            {/* ★ 전달사항: 공지가 있고 아직 출근 전이면 표시. 출근 후엔 숨김 */}
            {notices.length>0 && !attendance?.clock_in && (
              <div style={bx}>
                <div style={{ fontSize:13, fontWeight:700, color:'#E84393', marginBottom:12,
                  display:'flex', alignItems:'center', gap:6 }}>
                  📢 출근 전 전달사항 확인 필수
                  <span style={{ fontSize:10, color:'#aaa', fontWeight:500, marginLeft:'auto' }}>
                    {checkedNotices.size}/{notices.length} 확인
                  </span>
                </div>
                {notices.map(n => (
                  <div key={n.id} onClick={() => {
                    const next = new Set(checkedNotices)
                    next.has(n.id) ? next.delete(n.id) : next.add(n.id)
                    setCheckedNotices(next)
                  }} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 0',
                    borderBottom:'1px solid #F8F9FB', cursor:'pointer' }}>
                    <div style={{ width:20, height:20, borderRadius:6, flexShrink:0, marginTop:2,
                      border:`2px solid ${checkedNotices.has(n.id)?'#FF6B35':'#ddd'}`,
                      background:checkedNotices.has(n.id)?'#FF6B35':'#fff',
                      display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {checkedNotices.has(n.id) && <span style={{ color:'#fff', fontSize:11, fontWeight:800 }}>✓</span>}
                    </div>
                    <div>
                      <div style={{ fontSize:13, lineHeight:1.5,
                        color:checkedNotices.has(n.id)?'#bbb':'#555',
                        textDecoration:checkedNotices.has(n.id)?'line-through':'none' }}>
                        {n.content||n.title}
                      </div>
                      {n.author_nm && <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>작성: {n.author_nm}</div>}
                    </div>
                  </div>
                ))}
                {!allChecked ? (
                  <div style={{ marginTop:10, padding:'10px 12px', borderRadius:8,
                    background:'rgba(232,67,147,0.06)', fontSize:12, color:'#E84393', fontWeight:600 }}>
                    ⚠️ 전달사항을 모두 확인(체크)해야 출근 버튼이 활성화됩니다
                  </div>
                ) : (
                  <div style={{ marginTop:10, padding:'8px 12px', borderRadius:8,
                    background:'rgba(0,184,148,0.06)', fontSize:12, color:'#00B894', fontWeight:600 }}>
                    ✅ 전달사항 확인 완료 — 출근할 수 있어요!
                  </div>
                )}
              </div>
            )}

            {/* ★ 본인 이번달 근태 요약 카드 */}
            {(() => {
              if (myMonthData.length === 0) return null
              const stat = { normal:0, late:0, early:0, late_early:0, no_clockout:0, no_clockin:0, absent:0 }
              myMonthData.forEach(r => {
                const st = r.status || 'normal'
                if      (st==='normal')     stat.normal++
                else if (st==='late')       stat.late++
                else if (st==='early')      stat.early++
                else if (st==='late_early') stat.late_early++
                else if (st==='absent')     { stat.absent++; stat.no_clockin++ }
                else if (st==='no_clockin') stat.no_clockin++
                if (isPastDate(r.work_date, today) && r.clock_in && !r.clock_out
                    && st!=='absent' && st!=='no_clockin') stat.no_clockout++
              })
              const totalLate  = stat.late + stat.late_early
              const totalEarly = stat.early + stat.late_early
              return (
                <div style={bx}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:12,
                    display:'flex', alignItems:'center' }}>
                    📊 이번달 내 근태
                    <span style={{ fontSize:11, color:'#aaa', fontWeight:500, marginLeft:'auto' }}>
                      {nowDate.getMonth()+1}월 기준
                    </span>
                  </div>
                  <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                    {[
                      { label:'정상',     value:stat.normal,  color:'#00B894', bg:'rgba(0,184,148,0.08)' },
                      { label:'지각',     value:totalLate,    color:'#E84393', bg:'rgba(232,67,147,0.08)' },
                      { label:'조기퇴근', value:totalEarly,   color:'#6C5CE7', bg:'rgba(108,92,231,0.08)' },
                      { label:'결근',     value:stat.absent,  color:'#b2bec3', bg:'rgba(178,190,195,0.10)' },
                    ].map(item => (
                      <div key={item.label} style={{ flex:1, textAlign:'center', padding:'8px 4px',
                        background:item.bg, borderRadius:10 }}>
                        <div style={{ fontSize:17, fontWeight:800, color:item.color }}>{item.value}</div>
                        <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>{item.label}</div>
                      </div>
                    ))}
                  </div>
                  {(stat.no_clockout > 0 || stat.no_clockin > 0) && (
                    <div style={{ display:'flex', gap:6 }}>
                      {stat.no_clockout > 0 && (
                        <div style={{ flex:1, textAlign:'center', padding:'7px 4px',
                          background:'rgba(253,203,110,0.13)', borderRadius:10 }}>
                          <div style={{ fontSize:17, fontWeight:800, color:'#b8860b' }}>{stat.no_clockout}</div>
                          <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>퇴근누락</div>
                        </div>
                      )}
                      {stat.no_clockin > 0 && (
                        <div style={{ flex:1, textAlign:'center', padding:'7px 4px',
                          background:'rgba(255,107,53,0.09)', borderRadius:10 }}>
                          <div style={{ fontSize:17, fontWeight:800, color:'#FF6B35' }}>{stat.no_clockin}</div>
                          <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>출근누락</div>
                        </div>
                      )}
                      <div style={{ flex: stat.no_clockout>0 && stat.no_clockin>0 ? 2 : 3 }} />
                    </div>
                  )}
                </div>
              )
            })()}

            {/* 출퇴근 카드 */}
            <div style={bx}>
              <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:14 }}>🕐 출퇴근</div>
              {(() => {
                const myInfo = staffList.find(s => s.id===profileId)
                if (!myInfo?.expected_in && !myInfo?.expected_out) return null
                return (
                  <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                    {myInfo.expected_in && (
                      <div style={{ flex:1, padding:'7px 10px', background:'rgba(255,107,53,0.06)',
                        borderRadius:8, border:'1px solid rgba(255,107,53,0.15)' }}>
                        <div style={{ fontSize:10, color:'#aaa', marginBottom:2 }}>출근 기준</div>
                        <div style={{ fontSize:13, fontWeight:700, color:'#FF6B35' }}>{myInfo.expected_in}</div>
                      </div>
                    )}
                    {myInfo.expected_out && (
                      <div style={{ flex:1, padding:'7px 10px', background:'rgba(108,92,231,0.06)',
                        borderRadius:8, border:'1px solid rgba(108,92,231,0.15)' }}>
                        <div style={{ fontSize:10, color:'#aaa', marginBottom:2 }}>퇴근 기준</div>
                        <div style={{ fontSize:13, fontWeight:700, color:'#6C5CE7' }}>{myInfo.expected_out}</div>
                      </div>
                    )}
                  </div>
                )
              })()}

              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px',
                background:'#F8F9FB', borderRadius:12, marginBottom:16 }}>
                <div style={{ width:10, height:10, borderRadius:'50%',
                  background:attendance?.clock_out?'#636e72':attendance?.clock_in?'#00B894':'#aaa' }} />
                <span style={{ fontSize:13, fontWeight:600, color:'#888', flex:1 }}>
                  {attLoading?'확인중...':attendance?.clock_out?'퇴근 완료':attendance?.clock_in?'근무중':todaySchedule?'출근 대기중':'오늘 스케줄 없음'}
                </span>
                {attendance?.clock_in && (
                  <span style={{ fontSize:12, fontWeight:700, color:'#1a1a2e' }}>
                    {fmtTime(attendance.clock_in)} 출근
                    {attendance.clock_out && ` → ${fmtTime(attendance.clock_out)} 퇴근`}
                  </span>
                )}
              </div>

              {attendance?.status && !['normal','working','pending'].includes(attendance.status) && (
                <div style={{ marginBottom:12, padding:'8px 12px', borderRadius:10,
                  background:STATUS_MAP[attendance.status]?.bg||'#F8F9FB',
                  border:`1px solid ${(STATUS_MAP[attendance.status]?.color||'#ddd')}30`,
                  display:'flex', alignItems:'center', gap:8 }}>
                  <span>{STATUS_MAP[attendance.status]?.icon}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:STATUS_MAP[attendance.status]?.color }}>
                    {STATUS_MAP[attendance.status]?.label}
                    {attendance.late_minutes>0 && ` (${attendance.late_minutes}분 지각)`}
                  </span>
                </div>
              )}

              {!attendance?.clock_out && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                  <button onClick={clockIn} disabled={!canClockIn}
                    style={{ padding:'18px 10px', borderRadius:14, border:'none', fontSize:14, fontWeight:700,
                      cursor:canClockIn?'pointer':'not-allowed', opacity:canClockIn?1:0.3,
                      background:'linear-gradient(135deg,#FF6B35,#E84393)', color:'#fff',
                      boxShadow:canClockIn?'0 4px 16px rgba(255,107,53,0.35)':'none',
                      display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                    <span style={{ fontSize:24 }}>✅</span>출근
                  </button>
                  <button onClick={clockOut} disabled={!canClockOut}
                    style={{ padding:'18px 10px', borderRadius:14, border:'none', fontSize:14, fontWeight:700,
                      cursor:canClockOut?'pointer':'not-allowed', opacity:canClockOut?1:0.3,
                      background:'linear-gradient(135deg,#636e72,#2d3436)', color:'#fff',
                      boxShadow:canClockOut?'0 4px 16px rgba(0,0,0,0.2)':'none',
                      display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                    <span style={{ fontSize:24 }}>🔴</span>퇴근
                  </button>
                </div>
              )}

              {clockInBlockReason && !attendance?.clock_in && (
                <div style={{ marginBottom:10, padding:'8px 12px', borderRadius:8,
                  background:'rgba(232,67,147,0.04)', fontSize:12, color:'#E84393',
                  border:'1px solid rgba(232,67,147,0.15)', fontWeight:600 }}>
                  🔒 {clockInBlockReason}
                </div>
              )}

              {attendance?.clock_out && (
                <div style={{ padding:'14px', background:'rgba(0,184,148,0.06)',
                  border:'1px solid rgba(0,184,148,0.2)', borderRadius:12, marginBottom:10, textAlign:'center' }}>
                  <div style={{ fontSize:11, color:'#aaa', marginBottom:4 }}>오늘 실근무시간</div>
                  <div style={{ fontSize:22, fontWeight:800, color:'#00B894' }}>
                    {fmtDuration(attendance.clock_in, attendance.clock_out)}
                  </div>
                  <div style={{ fontSize:11, color:'#aaa', marginTop:4 }}>
                    {fmtTime(attendance.clock_in)} 출근 → {fmtTime(attendance.clock_out)} 퇴근
                  </div>
                </div>
              )}

              <button onClick={() => setShowRequest(true)}
                style={{ width:'100%', padding:13, borderRadius:12,
                  border:'1px dashed rgba(108,92,231,0.4)', background:'rgba(108,92,231,0.05)',
                  color:'#6C5CE7', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                ✏️ 출퇴근 누락 수정 요청
              </button>
            </div>

            {/* IP 설정 (대표) */}
            {isOwner && (
              <div style={bx}>
                <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:10 }}>📶 매장 IP 설정</div>
                <div style={{ fontSize:12, color:'#aaa', marginBottom:12 }}>매장 와이파이에 연결된 상태에서 등록하세요</div>
                <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
                  <div style={{ flex:1, padding:'10px 14px', background:'#F8F9FB', borderRadius:10,
                    border:'1px solid #E8ECF0', fontSize:13, fontWeight:600, color:'#1a1a2e' }}>
                    현재 IP: <span style={{ color:'#FF6B35' }}>{currentIp||'확인중...'}</span>
                  </div>
                  <button onClick={registerIp}
                    style={{ padding:'10px 16px', borderRadius:10, border:'none',
                      background:'linear-gradient(135deg,#FF6B35,#E84393)', color:'#fff',
                      fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                    📶 등록
                  </button>
                </div>
                {allowedIp && (
                  <div style={{ padding:'8px 12px', background:'rgba(0,184,148,0.06)',
                    borderRadius:8, fontSize:11, color:'#00B894', fontWeight:600 }}>
                    ✅ 등록된 IP: {allowedIp}
                  </div>
                )}
              </div>
            )}

            {/* ★ 오늘 현황판 */}
            <div style={bx}>
              <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:14,
                display:'flex', alignItems:'center' }}>
                👥 오늘 출퇴근 현황
                <span style={{ fontSize:11, color:'#aaa', fontWeight:500, marginLeft:'auto' }}>
                  {nowDate.getMonth()+1}월 {nowDate.getDate()}일
                </span>
              </div>
              {boardList.length===0 ? (
                <div style={{ textAlign:'center', padding:'28px 0', color:'#bbb', fontSize:13 }}>오늘 스케줄이 없습니다</div>
              ) : boardList.map(item => {
                const st = STATUS_MAP[item.status]||STATUS_MAP.pending
                const hasBadge = item.lateCount>0||item.noClockOutCount>0||item.noClockInCount>0
                return (
                  <div key={item.pid||item.nm} style={{ padding:'11px 0', borderBottom:'1px solid #F8F9FB' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:36, height:36, borderRadius:10, flexShrink:0,
                        background:'linear-gradient(135deg,#FF6B35,#E84393)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:14, fontWeight:800, color:'#fff' }}>
                        {item.nm?.charAt(0)}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{item.nm}</div>
                        <div style={{ fontSize:11, color:'#aaa', marginTop:1 }}>
                          {item.att?.clock_in?`${fmtTime(item.att.clock_in)} 출근`:'미출근'}
                          {item.att?.clock_out?` → ${fmtTime(item.att.clock_out)} 퇴근`:''}
                          {item.expected_in&&<span style={{ marginLeft:6, color:'#ddd' }}>(기준 {item.expected_in})</span>}
                        </div>
                      </div>
                      <div style={{ fontSize:10, padding:'3px 10px', borderRadius:20,
                        fontWeight:700, background:st.bg, color:st.color }}>
                        {st.icon} {st.label}
                      </div>
                    </div>
                    {/* ★ 이번달 누적 뱃지 */}
                    {hasBadge && (
                      <div style={{ display:'flex', gap:6, marginTop:6, paddingLeft:48, flexWrap:'wrap' }}>
                        {item.lateCount>0 && (
                          <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10,
                            background:'rgba(232,67,147,0.10)', color:'#E84393', fontWeight:700 }}>
                            🔴 지각 {item.lateCount}회
                          </span>
                        )}
                        {item.noClockOutCount>0 && (
                          <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10,
                            background:'rgba(253,203,110,0.18)', color:'#b8860b', fontWeight:700 }}>
                            ⏰ 퇴근누락 {item.noClockOutCount}회
                          </span>
                        )}
                        {item.noClockInCount>0 && (
                          <span style={{ fontSize:10, padding:'2px 8px', borderRadius:10,
                            background:'rgba(255,107,53,0.12)', color:'#FF6B35', fontWeight:700 }}>
                            🚫 출근누락 {item.noClockInCount}회
                          </span>
                        )}
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
            {/* 월 선택 */}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
              <button onClick={prevMonth}
                style={{ width:36, height:36, borderRadius:10, border:'1px solid #E8ECF0',
                  background:'#fff', cursor:'pointer', fontSize:18,
                  display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
              <span style={{ flex:1, textAlign:'center', fontSize:15, fontWeight:800, color:'#1a1a2e' }}>
                {histYear}년 {histMonth+1}월
              </span>
              <button onClick={nextMonth}
                style={{ width:36, height:36, borderRadius:10, border:'1px solid #E8ECF0',
                  background:'#fff', cursor:'pointer', fontSize:18,
                  display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
            </div>

            {/* ★ 직원별 월간 근태 통계 카드 */}
            {visibleStaff.length>0 && (
              <div style={{ marginBottom:16 }}>
                {visibleStaff.map(s => {
                  const stat  = monthStats[s.id]||{ normal:0, late:0, early:0, absent:0, late_early:0, no_clockout:0, no_clockin:0 }
                  const totalLate  = stat.late+stat.late_early
                  const totalEarly = stat.early+stat.late_early
                  const color = staffColorMap[s.id]||'#999'
                  return (
                    <div key={s.id} style={{ background:'#fff', borderRadius:14, border:'1px solid #E8ECF0',
                      padding:'12px 14px', marginBottom:8, boxShadow:'0 1px 4px rgba(0,0,0,0.03)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }} />
                        <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{s.nm}</span>
                        <span style={{ fontSize:11, color:'#aaa', marginLeft:'auto' }}>{histYear}.{pad(histMonth+1)} 근태</span>
                      </div>
                      {/* 1행: 정상 / 지각 / 조기퇴근 / 결근 */}
                      <div style={{ display:'flex', gap:6, marginBottom:6 }}>
                        {[
                          { label:'정상',     value:stat.normal,  color:'#00B894', bg:'rgba(0,184,148,0.08)' },
                          { label:'지각',     value:totalLate,    color:'#E84393', bg:'rgba(232,67,147,0.08)' },
                          { label:'조기퇴근', value:totalEarly,   color:'#6C5CE7', bg:'rgba(108,92,231,0.08)' },
                          { label:'결근',     value:stat.absent,  color:'#b2bec3', bg:'rgba(178,190,195,0.10)' },
                        ].map(item => (
                          <div key={item.label} style={{ flex:1, textAlign:'center', padding:'8px 4px',
                            background:item.bg, borderRadius:10 }}>
                            <div style={{ fontSize:16, fontWeight:800, color:item.color }}>{item.value}</div>
                            <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>{item.label}</div>
                          </div>
                        ))}
                      </div>
                      {/* ★ 2행: 퇴근누락 / 출근누락 */}
                      <div style={{ display:'flex', gap:6 }}>
                        <div style={{ flex:1, textAlign:'center', padding:'8px 4px',
                          background:'rgba(253,203,110,0.13)', borderRadius:10 }}>
                          <div style={{ fontSize:16, fontWeight:800, color:'#b8860b' }}>{stat.no_clockout}</div>
                          <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>퇴근누락</div>
                        </div>
                        <div style={{ flex:1, textAlign:'center', padding:'8px 4px',
                          background:'rgba(255,107,53,0.09)', borderRadius:10 }}>
                          <div style={{ fontSize:16, fontWeight:800, color:'#FF6B35' }}>{stat.no_clockin}</div>
                          <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>출근누락</div>
                        </div>
                        <div style={{ flex:2 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 직원 색상 범례 */}
            {visibleStaff.length>0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:12, padding:'10px 14px',
                background:'#fff', borderRadius:12, border:'1px solid #E8ECF0' }}>
                {visibleStaff.map(s => (
                  <div key={s.id} style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:staffColorMap[s.id]||'#999' }} />
                    <span style={{ fontSize:12, color:'#555', fontWeight:500 }}>{s.nm}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 캘린더 */}
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8ECF0',
              boxShadow:'0 1px 4px rgba(0,0,0,0.04)', overflow:'hidden' }}>
              <div className="cal-grid" style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)',
                borderBottom:'1px solid #F0F2F5' }}>
                {DOW.map((d,i) => (
                  <div key={d} style={{ textAlign:'center', padding:'10px 4px', fontSize:12, fontWeight:700,
                    color:i===0?'#E84393':i===6?'#2DC6D6':'#888', background:'#F8F9FB' }}>{d}</div>
                ))}
              </div>
              <div className="cal-grid" style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
                {Array.from({ length:firstDow }).map((_,i) => (
                  <div key={`e-${i}`} style={{ minHeight:80, borderRight:'1px solid #F0F2F5',
                    borderBottom:'1px solid #F0F2F5', background:'#FAFAFA' }} />
                ))}
                {Array.from({ length:lastDate }).map((_,i) => {
                  const day     = i+1
                  const dateStr = `${histYear}-${pad(histMonth+1)}-${pad(day)}`
                  const dow     = (firstDow+i)%7
                  const isToday = dateStr===today
                  const dayAtts = getDayAttendance(day)
                  return (
                    <div key={day} style={{ minHeight:80, padding:'6px 6px 8px',
                      borderRight:'1px solid #F0F2F5', borderBottom:'1px solid #F0F2F5',
                      background:isToday?'rgba(255,107,53,0.04)':'#fff' }}>
                      <div style={{ marginBottom:4 }}>
                        <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
                          width:22, height:22, borderRadius:'50%', fontSize:12,
                          fontWeight:isToday?800:500,
                          background:isToday?'#FF6B35':'transparent',
                          color:isToday?'#fff':dow===0?'#E84393':dow===6?'#2DC6D6':'#1a1a2e',
                        }}>{day}</span>
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                        {dayAtts.map(({ nm, id, rec, expected_in, expected_out }) => {
                          const isPast  = isPastDate(dateStr, today)
                          const isLate  = expected_in  && rec.clock_in  ? tsToMinutes(rec.clock_in)  > timeToMinutes(expected_in)  : false
                          const isEarly = expected_out && rec.clock_out ? tsToMinutes(rec.clock_out) < timeToMinutes(expected_out) : false
                          let calStatus = rec.status||'normal'
                          // ★ 당일 지난 후 퇴근 기록 없으면 퇴근누락
                          if (isPast && rec.clock_in && !rec.clock_out && !['absent','no_clockin'].includes(calStatus)) {
                            calStatus='no_clockout'
                          } else if (rec.clock_out) {
                            if (isLate&&isEarly) calStatus='late_early'
                            else if (isLate)  calStatus='late'
                            else if (isEarly) calStatus='early'
                            else calStatus='normal'
                          } else if (rec.clock_in) calStatus='working'
                          const st    = STATUS_MAP[calStatus]||STATUS_MAP.normal
                          const color = staffColorMap[id]||'#999'
                          return (
                            <div key={id} style={{ background:`${color}15`, borderLeft:`3px solid ${color}`,
                              borderRadius:'0 4px 4px 0', padding:'2px 5px', fontSize:10, lineHeight:1.4 }}>
                              <div style={{ fontWeight:700, color, marginBottom:1 }}>{nm}</div>
                              <div style={{ color:'#666' }}>
                                {fmtTime(rec.clock_in)||'-'} {rec.clock_out?`→${fmtTime(rec.clock_out)}`:rec.clock_in?'근무중':''}
                              </div>
                              {calStatus!=='normal'&&calStatus!=='working' && (
                                <div style={{ color:st.color, fontSize:9, fontWeight:700 }}>{st.icon} {st.label}</div>
                              )}
                            </div>
                          )
                        })}
                        {dayAtts.length===0 && (
                          <div style={{ fontSize:10, color:'#ddd', textAlign:'center', paddingTop:4 }}>—</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {showRequest && (
          <RequestModal today={today} onClose={() => setShowRequest(false)} onSubmit={submitRequest} />
        )}
        {showOwnerPanel && (
          <OwnerRequestPanel storeId={storeId}
            onClose={() => setShowOwnerPanel(false)}
            onApproved={() => { loadPendingCount(storeId); setShowOwnerPanel(false) }} />
        )}
        {showStaffTimePanel && (
          <StaffTimePanel storeId={storeId} staffList={staffList}
            onClose={() => setShowStaffTimePanel(false)}
            onSaved={() => loadStaffList(storeId)} />
        )}
      </div>
    </div>
  )
}