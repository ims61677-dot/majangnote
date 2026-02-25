'use client'
import { useEffect, useState, useCallback } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const COLORS = ['#FF6B35','#2DC6D6','#6C5CE7','#00B894','#E84393','#FDCB6E','#74B9FF','#A29BFE']

export default function SchedulePage() {
  const supabase = createSupabaseBrowserClient()
  const now = new Date()
  const [yr, setYr] = useState(now.getFullYear())
  const [mo, setMo] = useState(now.getMonth() + 1)
  const [storeId, setStoreId] = useState('')
  const [role, setRole] = useState('')
  const [userName, setUserName] = useState('')
  const [staffList, setStaffList] = useState<any[]>([])
  const [schedules, setSchedules] = useState<Record<string, any>>({})
  const [requests, setRequests] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [schDetail, setSchDetail] = useState<{nm:string,d:number}|null>(null)

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id); setRole(user.role); setUserName(user.nm)
    loadStaff(store.id)
    loadSchedules(store.id, yr, mo)
    loadRequests(store.id)
  }, [yr, mo])

  async function loadStaff(sid: string) {
    const { data } = await supabase.from('store_members').select('profiles(id,nm,role), role').eq('store_id', sid).eq('active', true)
    if (data) setStaffList(data.map((m: any, i: number) => ({ nm: m.profiles.nm, role: m.profiles.role, c: COLORS[i % COLORS.length] })))
  }

  async function loadSchedules(sid: string, y: number, m: number) {
    const from = `${y}-${String(m).padStart(2,'0')}-01`
    const to = `${y}-${String(m).padStart(2,'0')}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`
    const { data } = await supabase.from('schedules').select('*').eq('store_id', sid).gte('date', from).lte('date', to)
    const map: Record<string,any> = {}
    if (data) data.forEach((s: any) => { map[s.profile_nm + '-' + s.date] = s })
    setSchedules(map)
  }

  async function loadRequests(sid: string) {
    const { data } = await supabase.from('schedule_requests').select('*').eq('store_id', sid).eq('status', 'pending')
    setRequests(data || [])
  }

  const getVal = useCallback((nm: string, d: number) => {
    const dateStr = `${yr}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    return schedules[nm + '-' + dateStr] || { status: '휴일', position: '', note: '' }
  }, [schedules, yr, mo])

  async function toggleCell(nm: string, d: number) {
    if (role === 'staff' || role === 'pt') return
    const dateStr = `${yr}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const old = getVal(nm, d)
    let next: any
    if (old.status === '휴일') next = { status: '근무', position: '' }
    else if (old.status === '근무' && !old.position) next = { status: '근무', position: 'K' }
    else if (old.position === 'K') next = { status: '근무', position: 'H' }
    else next = { status: '휴일', position: '' }
    setSaving(true)
    await supabase.from('schedules').upsert({
      store_id: storeId, profile_nm: nm, date: dateStr,
      status: next.status, position: next.position || '', note: old.note || ''
    }, { onConflict: 'store_id,profile_nm,date' })
    setSchedules(p => ({ ...p, [nm + '-' + dateStr]: { ...old, ...next } }))
    setSaving(false)
  }

  async function approveReq(reqId: string) {
    const req = requests.find(r => r.id === reqId)
    if (!req) return
    await supabase.from('schedules').upsert({ store_id: storeId, profile_nm: req.profile_nm, date: req.date, status: req.to_status, position: req.to_pos || '' }, { onConflict: 'store_id,profile_nm,date' })
    await supabase.from('schedule_requests').update({ status: 'approved' }).eq('id', reqId)
    setSchedules(p => ({ ...p, [req.profile_nm + '-' + req.date]: { status: req.to_status, position: req.to_pos || '' } }))
    setRequests(p => p.filter(r => r.id !== reqId))
  }

  async function rejectReq(reqId: string) {
    await supabase.from('schedule_requests').update({ status: 'rejected' }).eq('id', reqId)
    setRequests(p => p.filter(r => r.id !== reqId))
  }

  const canEdit = role === 'owner' || role === 'manager'
  const dm = new Date(yr, mo, 0).getDate()
  const days = Array.from({ length: dm }, (_, i) => i + 1)
  const DAYS = ['일','월','화','수','목','금','토']
  const cellW = 30

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>📅 스케줄</span>
        {saving && <span style={{ fontSize: 10, color: '#FF6B35' }}>저장 중...</span>}
      </div>

      {/* 승인 대기 */}
      {role === 'owner' && requests.length > 0 && (
        <div style={{ background: '#FFF5F0', border: '1px solid rgba(255,107,53,0.3)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#FF6B35', marginBottom: 8 }}>⏳ 승인 대기 {requests.length}건</div>
          {requests.map((req: any) => (
            <div key={req.id} style={{ padding: '8px 0', borderBottom: '1px solid #F4F6F9' }}>
              <div style={{ fontSize: 12, color: '#1a1a2e' }}>{req.requester_nm} → {req.profile_nm} {req.date} {req.to_status}{req.to_pos ? '('+req.to_pos+')' : ''}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={() => approveReq(req.id)}
                  style={{ padding: '5px 12px', borderRadius: 6, background: 'rgba(0,184,148,0.1)', border: '1px solid rgba(0,184,148,0.3)', color: '#00B894', fontSize: 11, cursor: 'pointer' }}>승인</button>
                <button onClick={() => rejectReq(req.id)}
                  style={{ padding: '5px 12px', borderRadius: 6, background: 'rgba(232,67,147,0.08)', border: '1px solid rgba(232,67,147,0.3)', color: '#E84393', fontSize: 11, cursor: 'pointer' }}>거절</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 월 선택 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={() => { if (mo===1){setYr(yr-1);setMo(12)}else setMo(mo-1) }}
          style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: '#555', fontSize: 14 }}>←</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>{yr}년 {mo}월</span>
        <button onClick={() => { if (mo===12){setYr(yr+1);setMo(1)}else setMo(mo+1) }}
          style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: '#555', fontSize: 14 }}>→</button>
      </div>

      {/* 범례 */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        {[{ l:'K - 키친', c:'#FF6B35' },{ l:'H - 홀', c:'#2DC6D6' },{ l:'근무', c:'#888' }].map(x => (
          <div key={x.l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: x.c }} />
            <span style={{ fontSize: 10, color: '#999' }}>{x.l}</span>
          </div>
        ))}
      </div>

      {/* 스케줄 테이블 */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #E8ECF0', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ minWidth: 70 + days.length * cellW }}>
          {/* 헤더 */}
          <div style={{ display: 'flex', borderBottom: '1px solid #E8ECF0', background: '#F8F9FB' }}>
            <div style={{ width: 70, minWidth: 70, padding: '6px 8px', fontSize: 10, color: '#999', fontWeight: 600 }}>이름</div>
            {days.map(d => {
              const dw = new Date(yr, mo - 1, d).getDay()
              return <div key={d} style={{ width: cellW, minWidth: cellW, textAlign: 'center', padding: '6px 0',
                fontSize: 9, fontWeight: 700, color: dw===0?'#E84393':dw===6?'#4A90E2':'#999' }}>{d}</div>
            })}
          </div>
          {/* 직원 행 */}
          {staffList.map(s => (
            <div key={s.nm} style={{ display: 'flex', borderBottom: '1px solid #F4F6F9' }}>
              <div style={{ width: 70, minWidth: 70, padding: '5px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: s.c, flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1a1a2e' }}>{s.nm}</span>
              </div>
              {days.map(d => {
                const v = getVal(s.nm, d)
                const w = v.status === '근무'
                const posColor = v.position === 'K' ? '#FF6B35' : v.position === 'H' ? '#2DC6D6' : '#555'
                const dw = new Date(yr, mo-1, d).getDay()
                return (
                  <div key={d} onClick={() => canEdit ? toggleCell(s.nm, d) : setSchDetail({ nm: s.nm, d })}
                    style={{ width: cellW, minWidth: cellW, textAlign: 'center', padding: '4px 0', cursor: 'pointer',
                      background: dw===0||dw===6 ? '#FAFBFC' : 'transparent' }}>
                    <div style={{ width: 20, height: 20, borderRadius: 4, margin: '0 auto',
                      background: w ? (v.position === 'K' ? 'rgba(255,107,53,0.15)' : v.position === 'H' ? 'rgba(45,198,214,0.15)' : '#F0F8FF') : 'transparent',
                      border: w ? `1px solid ${v.position==='K'?'rgba(255,107,53,0.4)':v.position==='H'?'rgba(45,198,214,0.4)':'#ddd'}` : '1px solid transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700,
                      color: w ? posColor : '#ddd' }}>
                      {w ? (v.position || '●') : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 상세 팝업 */}
      {schDetail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setSchDetail(null)}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 -4px 20px rgba(0,0,0,0.1)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#1a1a2e' }}>
              {schDetail.nm} — {mo}/{schDetail.d}
            </div>
            {(() => {
              const v = getVal(schDetail.nm, schDetail.d)
              return (
                <div>
                  <div style={{ fontSize: 13, marginBottom: 6, color: '#555' }}>
                    상태: <span style={{ color: v.status === '근무' ? '#00B894' : '#bbb', fontWeight: 700 }}>{v.status}</span>
                    {v.position && <span style={{ color: v.position==='K'?'#FF6B35':'#2DC6D6', marginLeft: 8 }}>포지션: {v.position}</span>}
                  </div>
                  {v.note && <div style={{ fontSize: 11, color: '#888' }}>📝 {v.note}</div>}
                </div>
              )
            })()}
            <button onClick={() => setSchDetail(null)}
              style={{ marginTop: 16, width: '100%', padding: 12, borderRadius: 10, background: '#F4F6F9', border: 'none', color: '#888', cursor: 'pointer' }}>닫기</button>
          </div>
        </div>
      )}
    </div>
  )
}