'use client'
import { useEffect, useState, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const supabase = createSupabaseBrowserClient()

function pad(n: number) { return String(n).padStart(2, '0') }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
function fmtTime(ts: string | null) {
  if (!ts) return '-'
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function fmtDuration(inTs: string, outTs: string) {
  const diff = Math.floor((new Date(outTs).getTime() - new Date(inTs).getTime()) / 60000)
  const h = Math.floor(diff / 60), m = diff % 60
  return `${h}시간${m > 0 ? ` ${m}분` : ''}`
}

const DOW = ['일','월','화','수','목','금','토']

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  normal:  { label: '정상', color: '#00B894', bg: 'rgba(0,184,148,0.1)',    icon: '✅' },
  late:    { label: '지각', color: '#E84393', bg: 'rgba(232,67,147,0.1)',   icon: '🔴' },
  early:   { label: '조퇴', color: '#6C5CE7', bg: 'rgba(108,92,231,0.1)',   icon: '🌙' },
  absent:  { label: '결근', color: '#E84393', bg: 'rgba(232,67,147,0.15)',  icon: '❌' },
  working: { label: '근무중', color: '#FF6B35', bg: 'rgba(255,107,53,0.1)', icon: '💼' },
  pending: { label: '대기', color: '#bbb',    bg: 'rgba(170,170,170,0.08)', icon: '⏳' },
}

const bx: React.CSSProperties = {
  background: '#fff', borderRadius: 16, border: '1px solid #E8ECF0',
  padding: 18, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
}

// ── 수정 요청 모달 ──
function RequestModal({ today, onClose, onSubmit }: {
  today: string; onClose: () => void
  onSubmit: (type: string, ci: string, co: string, reason: string) => void
}) {
  const [type, setType] = useState<'clock_in'|'clock_out'|'both'>('clock_in')
  const [ci, setCi] = useState('')
  const [co, setCo] = useState('')
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
            {[{v:'clock_in' as const,l:'출근 누락'},{v:'clock_out' as const,l:'퇴근 누락'},{v:'both' as const,l:'출퇴근 모두'}].map(o => (
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
  const [loading, setLoading] = useState(true)
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
    if (req.request_type==='clock_in'||req.request_type==='both') updates.clock_in = req.requested_clock_in
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
            {req.requested_clock_in && <div style={{ fontSize:12, color:'#555', marginBottom:2 }}>출근: {fmtTime(req.requested_clock_in)}</div>}
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
  const today = toDateStr(new Date())
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
  const allChecked = notices.length === 0 || notices.every(n => checkedNotices.has(n.id))

  const [todaySchedule, setTodaySchedule] = useState<any>(null)
  const [attendance,    setAttendance]    = useState<any>(null)
  const [attLoading,    setAttLoading]    = useState(true)
  const [boardList,     setBoardList]     = useState<any[]>([])
  const [tab,           setTab]           = useState<'today'|'history'>('today')

  // 기록 조회
  const [histYear,   setHistYear]   = useState(nowDate.getFullYear())
  const [histMonth,  setHistMonth]  = useState(nowDate.getMonth())
  const [staffList,  setStaffList]  = useState<{ id: string; nm: string }[]>([])
  const [allAttData, setAllAttData] = useState<any[]>([])  // 전직원 출퇴근 데이터

  const [showRequest,    setShowRequest]    = useState(false)
  const [showOwnerPanel, setShowOwnerPanel] = useState(false)
  const [pendingCount,   setPendingCount]   = useState(0)

  const canClockIn  = wifiOk && allChecked && !attendance?.clock_in
  const canClockOut = wifiOk && !!attendance?.clock_in && !attendance?.clock_out

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
  async function loadBoard(sid: string) {
    const { data: todaySchedules } = await supabase.from('schedules')
      .select('staff_name, status').eq('store_id', sid).eq('schedule_date', today).in('status', ['work','half'])
    const { data: members } = await supabase.from('store_members')
      .select('profile_id, profiles(nm)').eq('store_id', sid).eq('active', true)
    const nameToId: Record<string, string> = {}
    ;(members || []).forEach((m: any) => { nameToId[m.profiles?.nm] = m.profile_id })
    const { data: attRecords } = await supabase.from('attendance').select('*').eq('store_id', sid).eq('work_date', today)
    const attMap: Record<string, any> = {}
    ;(attRecords || []).forEach((a: any) => { attMap[a.profile_id] = a })
    setBoardList((todaySchedules || []).map((s: any) => {
      const pid = nameToId[s.staff_name] || ''
      const att = attMap[pid] || null
      let status = 'pending'
      if (att?.clock_out) status = att.status || 'normal'
      else if (att?.clock_in) status = 'working'
      return { pid, nm: s.staff_name, att, status }
    }))
  }
  async function loadPendingCount(sid: string) {
    const { count } = await supabase.from('attendance_requests')
      .select('*', { count:'exact', head:true }).eq('store_id', sid).eq('status', 'pending')
    setPendingCount(count || 0)
  }
  async function loadStaffList(sid: string) {
    const { data } = await supabase.from('store_members')
      .select('profile_id, profiles(nm)').eq('store_id', sid).eq('active', true)
    setStaffList((data || []).map((m: any) => ({ id: m.profile_id, nm: m.profiles?.nm || '' })))
  }

  // 전직원 출퇴근 데이터 (기록 조회용)
  async function loadAllAttendance(sid: string, y: number, m: number) {
    const from = `${y}-${pad(m+1)}-01`
    const to   = `${y}-${pad(m+1)}-${pad(new Date(y, m+1, 0).getDate())}`
    const { data } = await supabase.from('attendance')
      .select('*, profiles(nm)')
      .eq('store_id', sid)
      .gte('work_date', from).lte('work_date', to)
      .order('work_date', { ascending: true })
    setAllAttData(data || [])
  }

  async function clockIn() {
    if (!canClockIn) return
    const rec = { store_id:storeId, profile_id:profileId, work_date:today,
      clock_in:new Date().toISOString(), status:'normal', is_late:false, late_minutes:0 }
    const { data: existing } = await supabase.from('attendance').select('id')
      .eq('store_id', storeId).eq('profile_id', profileId).eq('work_date', today).maybeSingle()
    if (existing) await supabase.from('attendance').update({ clock_in: rec.clock_in }).eq('id', existing.id)
    else await supabase.from('attendance').insert(rec)
    await loadMyAttendance(profileId, storeId)
    await loadBoard(storeId)
  }
  async function clockOut() {
    if (!canClockOut || !attendance) return
    await supabase.from('attendance').update({
      clock_out: new Date().toISOString(), status: attendance.is_late ? 'late' : 'normal'
    }).eq('id', attendance.id)
    await loadMyAttendance(profileId, storeId)
    await loadBoard(storeId)
  }
  async function registerIp() {
    if (!currentIp || !storeId) return
    await supabase.from('stores').update({ allowed_ip: currentIp }).eq('id', storeId)
    setAllowedIp(currentIp)
    alert(`✅ IP 등록 완료\n${currentIp}`)
  }
  async function submitRequest(type: string, ci: string, co: string, reason: string) {
    const toTs = (t: string) => t ? `${today}T${t}:00+09:00` : null
    await supabase.from('attendance_requests').insert({
      store_id:storeId, profile_id:profileId, work_date:today, request_type:type,
      requested_clock_in: ci ? toTs(ci) : null, requested_clock_out: co ? toTs(co) : null, reason
    })
    setShowRequest(false)
    alert('✅ 수정 요청이 전송되었습니다')
  }

  function prevMonth() {
    if (histMonth === 0) { setHistYear(y => y-1); setHistMonth(11) }
    else setHistMonth(m => m-1)
  }
  function nextMonth() {
    if (histMonth === 11) { setHistYear(y => y+1); setHistMonth(0) }
    else setHistMonth(m => m+1)
  }

  // 전직원 × 날짜 표 데이터 가공
  const lastDate = new Date(histYear, histMonth + 1, 0).getDate()
  const dateRange = Array.from({ length: lastDate }, (_, i) => {
    const d = i + 1
    return `${histYear}-${pad(histMonth+1)}-${pad(d)}`
  })

  // profile_id → nm 맵
  const pidToNm = useMemo(() => {
    const m: Record<string, string> = {}
    staffList.forEach(s => { m[s.id] = s.nm })
    return m
  }, [staffList])

  // attData를 { profile_id: { work_date: record } } 로 변환
  const attMatrix = useMemo(() => {
    const m: Record<string, Record<string, any>> = {}
    allAttData.forEach(r => {
      if (!m[r.profile_id]) m[r.profile_id] = {}
      m[r.profile_id][r.work_date] = r
    })
    return m
  }, [allAttData])

  // 직원 목록 (사원 본인은 본인만)
  const visibleStaff = canSeeAll
    ? staffList
    : staffList.filter(s => s.id === profileId)

  return (
    <div style={{ maxWidth: '100%' }}>
      <style>{`
        .att-page { padding: 16px; max-width: 480px; margin: 0 auto; }
        @media (min-width: 768px) {
          .att-page { max-width: 100%; padding: 24px 32px; }
          .today-grid { display: grid !important; grid-template-columns: 400px 1fr; gap: 20px; align-items: start; }
          .board-card { margin-bottom: 0 !important; }
        }
        .att-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .att-table th { background: #F4F6F9; color: #888; font-weight: 600; padding: 8px 6px; text-align: center; position: sticky; top: 0; z-index: 1; white-space: nowrap; }
        .att-table th:first-child { position: sticky; left: 0; z-index: 2; background: #F4F6F9; }
        .att-table td { padding: 7px 6px; text-align: center; border-bottom: 1px solid #F4F6F9; vertical-align: middle; }
        .att-table td:first-child { position: sticky; left: 0; background: #fff; font-weight: 700; color: #1a1a2e; font-size: 12px; z-index: 1; min-width: 52px; }
        .att-table tr:hover td { background: rgba(255,107,53,0.03); }
        .att-table tr:hover td:first-child { background: rgba(255,107,53,0.05); }
        .cell-normal  { color: #00B894; font-weight: 700; }
        .cell-late    { color: #E84393; font-weight: 700; }
        .cell-absent  { color: #E84393; }
        .cell-working { color: #FF6B35; font-weight: 700; }
        .cell-empty   { color: #ddd; }
        .today-col    { background: rgba(255,107,53,0.04) !important; }
      `}</style>

      <div className="att-page">
        {/* 헤더 */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:17, fontWeight:700, color:'#1a1a2e' }}>🕐 출퇴근</span>
          {canSeeAll && (
            <button onClick={() => setShowOwnerPanel(true)}
              style={{ padding:'6px 14px', borderRadius:10, cursor:'pointer',
                background: pendingCount > 0 ? 'rgba(232,67,147,0.1)' : '#F4F6F9',
                border: pendingCount > 0 ? '1px solid rgba(232,67,147,0.3)' : '1px solid #E8ECF0',
                color: pendingCount > 0 ? '#E84393' : '#888', fontSize:12, fontWeight:700 }}>
              ✏️ 수정요청
              {pendingCount > 0 && (
                <span style={{ marginLeft:6, background:'#E84393', color:'#fff',
                  borderRadius:10, padding:'1px 6px', fontSize:10 }}>{pendingCount}</span>
              )}
            </button>
          )}
        </div>

        {/* 탭 */}
        <div style={{ display:'flex', background:'#F4F6F9', borderRadius:12, padding:4, marginBottom:16 }}>
          {[{v:'today',l:'오늘'},{v:'history',l:'📋 기록 조회'}].map(t => (
            <button key={t.v} onClick={() => setTab(t.v as any)}
              style={{ flex:1, padding:'9px 0', borderRadius:10, border:'none', cursor:'pointer',
                fontSize:13, fontWeight: tab===t.v ? 700 : 400,
                background: tab===t.v ? '#fff' : 'transparent',
                color: tab===t.v ? '#1a1a2e' : '#aaa',
                boxShadow: tab===t.v ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
              {t.l}
            </button>
          ))}
        </div>

        {/* ════ 오늘 탭 ════ */}
        {tab === 'today' && (
          <>
            {/* 와이파이 */}
            <div style={{ borderRadius:12, padding:'10px 14px', marginBottom:12,
              display:'flex', alignItems:'center', gap:10, fontSize:13, fontWeight:600,
              background: wifiOk ? 'rgba(0,184,148,0.08)' : 'rgba(232,67,147,0.08)',
              border: `1px solid ${wifiOk ? 'rgba(0,184,148,0.3)' : 'rgba(232,67,147,0.3)'}`,
              color: wifiOk ? '#00B894' : '#E84393' }}>
              <span>📶</span>
              <span style={{ flex:1 }}>
                {ipLoading ? '와이파이 확인중...' :
                  !allowedIp ? '매장 IP 미등록 — 대표가 먼저 IP를 등록해주세요' :
                  wifiOk     ? '매장 와이파이 연결됨 — 출퇴근 가능' :
                               '매장 와이파이 미연결 — 출퇴근 불가'}
              </span>
            </div>

            <div className="today-grid" style={{ display:'block' }}>
              {/* 왼쪽: 출퇴근 + IP */}
              <div>
                {/* 전달사항 */}
                {notices.length > 0 && !attendance?.clock_in && (
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
                          border: `2px solid ${checkedNotices.has(n.id) ? '#FF6B35' : '#ddd'}`,
                          background: checkedNotices.has(n.id) ? '#FF6B35' : '#fff',
                          display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {checkedNotices.has(n.id) && <span style={{ color:'#fff', fontSize:11, fontWeight:800 }}>✓</span>}
                        </div>
                        <div>
                          <div style={{ fontSize:13, lineHeight:1.5,
                            color: checkedNotices.has(n.id) ? '#bbb' : '#555',
                            textDecoration: checkedNotices.has(n.id) ? 'line-through' : 'none' }}>
                            {n.content || n.title}
                          </div>
                          {n.author_nm && <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>작성: {n.author_nm}</div>}
                        </div>
                      </div>
                    ))}
                    {!allChecked && (
                      <div style={{ marginTop:10, padding:'8px 12px', borderRadius:8,
                        background:'rgba(232,67,147,0.06)', fontSize:12, color:'#E84393', fontWeight:600 }}>
                        ⚠️ 전달사항을 모두 확인해야 출근할 수 있어요
                      </div>
                    )}
                  </div>
                )}

                {/* 출퇴근 카드 */}
                <div style={bx}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:14 }}>🕐 출퇴근</div>
                  <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px',
                    background:'#F8F9FB', borderRadius:12, marginBottom:16 }}>
                    <div style={{ width:10, height:10, borderRadius:'50%',
                      background: attendance?.clock_out ? '#636e72' : attendance?.clock_in ? '#00B894' : '#aaa' }} />
                    <span style={{ fontSize:13, fontWeight:600, color:'#888', flex:1 }}>
                      {attLoading ? '확인중...' :
                        attendance?.clock_out ? '퇴근 완료' :
                        attendance?.clock_in  ? '근무중' :
                        todaySchedule         ? '출근 대기중' : '오늘 스케줄 없음'}
                    </span>
                    {attendance?.clock_in && (
                      <span style={{ fontSize:12, fontWeight:700, color:'#1a1a2e' }}>
                        {fmtTime(attendance.clock_in)} 출근
                        {attendance.clock_out && ` → ${fmtTime(attendance.clock_out)} 퇴근`}
                      </span>
                    )}
                  </div>
                  {!attendance?.clock_out && (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                      <button onClick={clockIn} disabled={!canClockIn}
                        style={{ padding:'18px 10px', borderRadius:14, border:'none', fontSize:14, fontWeight:700,
                          cursor: canClockIn ? 'pointer' : 'not-allowed', opacity: canClockIn ? 1 : 0.3,
                          background:'linear-gradient(135deg,#FF6B35,#E84393)', color:'#fff',
                          boxShadow: canClockIn ? '0 4px 16px rgba(255,107,53,0.35)' : 'none',
                          display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                        <span style={{ fontSize:24 }}>✅</span>출근
                      </button>
                      <button onClick={clockOut} disabled={!canClockOut}
                        style={{ padding:'18px 10px', borderRadius:14, border:'none', fontSize:14, fontWeight:700,
                          cursor: canClockOut ? 'pointer' : 'not-allowed', opacity: canClockOut ? 1 : 0.3,
                          background:'linear-gradient(135deg,#636e72,#2d3436)', color:'#fff',
                          boxShadow: canClockOut ? '0 4px 16px rgba(0,0,0,0.2)' : 'none',
                          display:'flex', flexDirection:'column', alignItems:'center', gap:5 }}>
                        <span style={{ fontSize:24 }}>🔴</span>퇴근
                      </button>
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

                {/* 대표 IP 설정 */}
                {isOwner && (
                  <div style={bx}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:10 }}>📶 매장 IP 설정</div>
                    <div style={{ fontSize:12, color:'#aaa', marginBottom:12 }}>매장 와이파이에 연결된 상태에서 등록하세요</div>
                    <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
                      <div style={{ flex:1, padding:'10px 14px', background:'#F8F9FB', borderRadius:10,
                        border:'1px solid #E8ECF0', fontSize:13, fontWeight:600, color:'#1a1a2e' }}>
                        현재 IP: <span style={{ color:'#FF6B35' }}>{currentIp || '확인중...'}</span>
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
              </div>

              {/* 오늘 현황판 */}
              <div style={bx} className="board-card">
                <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:14,
                  display:'flex', alignItems:'center' }}>
                  👥 오늘 출퇴근 현황
                  <span style={{ fontSize:11, color:'#aaa', fontWeight:500, marginLeft:'auto' }}>
                    {nowDate.getMonth()+1}월 {nowDate.getDate()}일
                  </span>
                </div>
                {boardList.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'28px 0', color:'#bbb', fontSize:13 }}>오늘 스케줄이 없습니다</div>
                ) : boardList.map(item => {
                  const st = STATUS_MAP[item.status] || STATUS_MAP.pending
                  return (
                    <div key={item.pid || item.nm} style={{ display:'flex', alignItems:'center', gap:12,
                      padding:'11px 0', borderBottom:'1px solid #F8F9FB' }}>
                      <div style={{ width:36, height:36, borderRadius:10, flexShrink:0,
                        background:'linear-gradient(135deg,#FF6B35,#E84393)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:14, fontWeight:800, color:'#fff' }}>
                        {item.nm?.charAt(0)}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{item.nm}</div>
                        <div style={{ fontSize:11, color:'#aaa', marginTop:1 }}>
                          {item.att?.clock_in ? `${fmtTime(item.att.clock_in)} 출근` : '미출근'}
                          {item.att?.clock_out ? ` → ${fmtTime(item.att.clock_out)} 퇴근` : ''}
                        </div>
                      </div>
                      <div style={{ fontSize:10, padding:'3px 10px', borderRadius:20,
                        fontWeight:700, background:st.bg, color:st.color }}>
                        {st.icon} {st.label}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* ════ 기록 조회 탭 ════ */}
        {tab === 'history' && (
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

            {/* 전직원 출퇴근 표 */}
            <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8ECF0',
              boxShadow:'0 1px 4px rgba(0,0,0,0.04)', overflow:'hidden' }}>
              <div style={{ overflowX:'auto' }}>
                <table className="att-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth:60 }}>직원</th>
                      {dateRange.map(dateStr => {
                        const d = new Date(dateStr + 'T00:00:00')
                        const dow = d.getDay()
                        const isToday = dateStr === today
                        return (
                          <th key={dateStr}
                            style={{
                              color: isToday ? '#FF6B35' : dow===0 ? '#E84393' : dow===6 ? '#2DC6D6' : '#888',
                              background: isToday ? 'rgba(255,107,53,0.08)' : undefined,
                              minWidth: 52,
                            }}>
                            <div>{d.getDate()}</div>
                            <div style={{ fontSize:9, fontWeight:400 }}>{DOW[dow]}</div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleStaff.map(staff => (
                      <tr key={staff.id}>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ width:24, height:24, borderRadius:6, flexShrink:0,
                              background:'linear-gradient(135deg,#FF6B35,#E84393)',
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:11, fontWeight:800, color:'#fff' }}>
                              {staff.nm?.charAt(0)}
                            </div>
                            <span style={{ fontSize:12, color:'#1a1a2e', fontWeight:700, whiteSpace:'nowrap' }}>
                              {staff.nm}
                            </span>
                          </div>
                        </td>
                        {dateRange.map(dateStr => {
                          const rec = attMatrix[staff.id]?.[dateStr]
                          const isToday = dateStr === today
                          const d = new Date(dateStr + 'T00:00:00')
                          const dow = d.getDay()
                          if (!rec) {
                            return (
                              <td key={dateStr}
                                className={isToday ? 'today-col' : ''}
                                style={{ color: dow===0||dow===6 ? '#ddd' : '#eee', fontSize:11 }}>
                                —
                              </td>
                            )
                          }
                          const st = STATUS_MAP[rec.status] || STATUS_MAP.pending
                          return (
                            <td key={dateStr} className={isToday ? 'today-col' : ''}>
                              <div style={{ fontSize:10, color:st.color, fontWeight:700, marginBottom:1 }}>
                                {st.icon}
                              </div>
                              {rec.clock_in && (
                                <div style={{ fontSize:10, color:'#555' }}>{fmtTime(rec.clock_in)}</div>
                              )}
                              {rec.clock_out && (
                                <div style={{ fontSize:10, color:'#888' }}>{fmtTime(rec.clock_out)}</div>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 범례 */}
              <div style={{ display:'flex', gap:16, padding:'12px 16px', borderTop:'1px solid #F4F6F9',
                flexWrap:'wrap' }}>
                {Object.entries(STATUS_MAP).filter(([k]) => k !== 'pending').map(([k, v]) => (
                  <div key={k} style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ fontSize:12 }}>{v.icon}</span>
                    <span style={{ fontSize:11, color:'#888' }}>{v.label}</span>
                  </div>
                ))}
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
      </div>
    </div>
  )
}