'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
const ROLES: Record<string,string> = { owner:'대표', manager:'관리자', staff:'사원', pt:'PT' }
const ROLE_COLORS: Record<string,string> = { owner:'#FF6B35', manager:'#6C5CE7', staff:'#2DC6D6', pt:'#00B894' }

// ─── 이름 수정 모달 ───
function EditNameModal({ profile, storeId, onClose, onSaved }: {
  profile: any; storeId: string; onClose: () => void; onSaved: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [newName, setNewName] = useState(profile.nm)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!newName.trim() || newName.trim() === profile.nm) { onClose(); return }
    if (!confirm(`"${profile.nm}" → "${newName.trim()}"으로 변경할까요?\n\n스케줄, 마감일지, 공지 등 모든 기록이 자동으로 변경됩니다.`)) return
    setSaving(true)
    const oldName = profile.nm
    const trimmed = newName.trim()
    try {
      await supabase.from('profiles').update({ nm: trimmed }).eq('id', profile.id)
      await supabase.from('schedules').update({ staff_name: trimmed }).eq('store_id', storeId).eq('staff_name', oldName)
      await supabase.from('schedule_requests').update({ staff_name: trimmed }).eq('store_id', storeId).eq('staff_name', oldName)
      await supabase.from('schedule_requests').update({ requester_nm: trimmed }).eq('store_id', storeId).eq('requester_nm', oldName)
      await supabase.from('closings').update({ writer: trimmed }).eq('store_id', storeId).eq('writer', oldName)
      await supabase.from('closings').update({ close_staff: trimmed }).eq('store_id', storeId).eq('close_staff', oldName)
      const { data: closings } = await supabase.from('closings').select('id').eq('store_id', storeId)
      if (closings && closings.length > 0) {
        const ids = closings.map((c: any) => c.id)
        await supabase.from('closing_checks').update({ checked_by: trimmed }).in('closing_id', ids).eq('checked_by', oldName)
        await supabase.from('closing_soldout').update({ created_by: trimmed }).in('closing_id', ids).eq('created_by', oldName)
        await supabase.from('closing_next_todos').update({ created_by: trimmed }).in('closing_id', ids).eq('created_by', oldName)
        await supabase.from('closing_next_todo_checks').update({ checked_by: trimmed }).eq('checked_by', oldName)
      }
      await supabase.from('notices').update({ created_by: trimmed }).eq('store_id', storeId).eq('created_by', oldName)
      await supabase.from('notice_reads').update({ read_by: trimmed }).eq('read_by', oldName)
      await supabase.from('notice_todos').update({ created_by: trimmed }).eq('created_by', oldName)
      await supabase.from('notice_todo_checks').update({ checked_by: trimmed }).eq('checked_by', oldName)
      alert(`✅ "${oldName}" → "${trimmed}" 변경 완료!\n모든 기록이 자동 반영되었습니다.`)
      onSaved(); onClose()
    } catch (e: any) {
      alert('변경 실패: ' + e?.message)
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, padding:24, width:'100%', maxWidth:320 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:15, fontWeight:700, color:'#1a1a2e', marginBottom:4 }}>✏️ 이름 수정</div>
        <div style={{ fontSize:11, color:'#aaa', marginBottom:16 }}>변경 시 스케줄, 마감일지, 공지 등 모든 기록에 자동 반영됩니다</div>
        <div style={{ fontSize:11, color:'#888', marginBottom:4 }}>현재 이름</div>
        <div style={{ fontSize:14, fontWeight:700, color:'#6C5CE7', background:'rgba(108,92,231,0.08)', borderRadius:8, padding:'8px 12px', marginBottom:12 }}>{profile.nm}</div>
        <div style={{ fontSize:11, color:'#888', marginBottom:4 }}>새 이름</div>
        <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key==='Enter' && handleSave()}
          placeholder="새 이름 입력" style={{ ...inp, marginBottom:16 }} autoFocus />
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onClose} style={{ flex:1, padding:'11px 0', borderRadius:10, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', fontSize:13, cursor:'pointer' }}>취소</button>
          <button onClick={handleSave} disabled={saving || !newName.trim() || newName.trim()===profile.nm}
            style={{ flex:2, padding:'11px 0', borderRadius:10, border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:saving?'not-allowed':'pointer',
              background: saving||!newName.trim()||newName.trim()===profile.nm ? '#ddd' : 'linear-gradient(135deg,#6C5CE7,#E84393)' }}>
            {saving ? '변경 중...' : '변경 저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── PIN 확인 모달 ───
function PinViewModal({ members, onClose }: { members: any[]; onClose: () => void }) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'80vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>🔐 직원 PIN 확인</div>
            <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>대표만 확인 가능합니다</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>
        {members.map(m => {
          const p = m.profiles
          if (!p) return null
          const isRevealed = revealed[p.id]
          return (
            <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', borderRadius:12, background:'#F8F9FB', border:'1px solid #E8ECF0', marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#FF6B35,#E84393)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, color:'#fff' }}>
                  {p.nm?.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{p.nm}</div>
                  <div style={{ fontSize:10, color:ROLE_COLORS[p.role]||'#888' }}>{ROLES[p.role]||p.role}</div>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ fontSize:16, fontWeight:800, color:'#1a1a2e', letterSpacing:4, minWidth:60, textAlign:'center', background:isRevealed?'rgba(108,92,231,0.08)':'#EFEFEF', borderRadius:8, padding:'4px 10px' }}>
                  {isRevealed ? (p.pin || '----') : '••••'}
                </div>
                <button onClick={() => setRevealed(prev => ({ ...prev, [p.id]: !isRevealed }))}
                  style={{ padding:'5px 10px', borderRadius:8, background:isRevealed?'rgba(108,92,231,0.1)':'#F4F6F9', border:isRevealed?'1px solid rgba(108,92,231,0.3)':'1px solid #E8ECF0', color:isRevealed?'#6C5CE7':'#888', fontSize:11, cursor:'pointer', fontWeight:600 }}>
                  {isRevealed ? '숨기기' : '보기'}
                </button>
              </div>
            </div>
          )
        })}
        <button onClick={() => setRevealed({})} style={{ width:'100%', marginTop:8, padding:'10px 0', borderRadius:10, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#aaa', fontSize:12, cursor:'pointer' }}>
          전체 숨기기
        </button>
      </div>
    </div>
  )
}

// ─── 퇴사 처리 모달 ───
function ResignModal({ profile, storeId, onClose, onSaved }: {
  profile: any; storeId: string; onClose: () => void; onSaved: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [saving, setSaving] = useState(false)
  const [reason, setReason] = useState('')
  const [resignDate, setResignDate] = useState(new Date().toISOString().split('T')[0])

  async function handleResign() {
    if (!confirm(`"${profile.nm}"을 퇴사 처리할까요?\n\n로그인이 불가능해지지만 모든 기록은 보존됩니다.`)) return
    setSaving(true)
    try {
      await supabase.from('store_members')
        .update({ active: false, resigned: true, resigned_at: resignDate ? new Date(resignDate).toISOString() : new Date().toISOString(), resigned_at_date: resignDate || null, resign_reason: reason || null })
        .eq('store_id', storeId).eq('profile_id', profile.id)
      await supabase.from('profiles').update({ resigned: true }).eq('id', profile.id)
      alert(`✅ "${profile.nm}" 퇴사 처리 완료\n모든 기록은 보존됩니다.`)
      onSaved(); onClose()
    } catch (e: any) {
      alert('처리 실패: ' + e?.message)
    } finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, padding:24, width:'100%', maxWidth:320 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:15, fontWeight:700, color:'#E84393', marginBottom:4 }}>🚪 퇴사 처리</div>
        <div style={{ fontSize:11, color:'#aaa', marginBottom:16 }}>퇴사 처리 시 로그인이 불가능해집니다. 모든 기록(스케줄, 마감일지 등)은 보존됩니다.</div>
        <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', background:'rgba(232,67,147,0.06)', borderRadius:10, padding:'10px 14px', marginBottom:14 }}>
          {profile.nm} · <span style={{ color:ROLE_COLORS[profile.role]||'#888', fontSize:11 }}>{ROLES[profile.role]||profile.role}</span>
        </div>
        <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>퇴사일</div>
        <input type="date" value={resignDate} onChange={e => setResignDate(e.target.value)} style={{ ...inp, marginBottom:10 }} />
        <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>퇴사 사유 (선택)</div>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="예: 개인 사정, 계약 만료 등" style={{ ...inp, marginBottom:16 }} />
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onClose} style={{ flex:1, padding:'11px 0', borderRadius:10, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', fontSize:13, cursor:'pointer' }}>취소</button>
          <button onClick={handleResign} disabled={saving}
            style={{ flex:2, padding:'11px 0', borderRadius:10, border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:saving?'not-allowed':'pointer', background:saving?'#ddd':'linear-gradient(135deg,#E84393,#FF6B35)' }}>
            {saving ? '처리 중...' : '퇴사 처리'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════
// 메인
// ═══════════════════════════════════════
export default function StaffPage() {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState('')
  const [myRole, setMyRole] = useState('')
  const [members, setMembers] = useState<any[]>([])
  const [resignedMembers, setResignedMembers] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [showResigned, setShowResigned] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [editingProfile, setEditingProfile] = useState<any>(null)
  const [resigningProfile, setResigningProfile] = useState<any>(null)
  const [nm, setNm] = useState('')
  const [role, setRole] = useState('staff')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [joinedAt, setJoinedAt] = useState('')
  const isOwner = myRole === 'owner'

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id)
    setMyRole(user.role)
    loadMembers(store.id)
  }, [])

  async function loadMembers(sid: string) {
    const { data } = await supabase.from('store_members')
      .select('*, profiles(id, nm, role, phone, pin, resigned, joined_at)')
      .eq('store_id', sid).eq('active', true)
      .order('created_at')
    const active = (data || []).filter(m => !m.profiles?.resigned)
    setMembers(active)

    const { data: res } = await supabase.from('store_members')
      .select('*, profiles(id, nm, role, phone, resigned), resigned_at, resign_reason')
      .eq('store_id', sid).eq('resigned', true)
      .order('resigned_at', { ascending: false })
    setResignedMembers(res || [])
  }

  async function addStaff() {
    if (!nm.trim() || !storeId) return
    setSaving(true)
    const { data: existing } = await supabase.from('profiles').select('*').eq('nm', nm.trim()).eq('phone', phone.trim()).limit(1)
    let profile = existing?.[0]
    if (!profile) {
      const { data: newProfile } = await supabase.from('profiles').insert({ nm: nm.trim(), role, phone: phone.trim(), pin: '1234', joined_at: joinedAt || null }).select().single()
      profile = newProfile
    }
    if (profile) {
      const { data: already } = await supabase.from('store_members').select('*').eq('store_id', storeId).eq('profile_id', profile.id).limit(1)
      if (!already?.length) {
        await supabase.from('store_members').insert({ store_id: storeId, profile_id: profile.id, role, active: true, joined_at: joinedAt || null })
      }
      await loadMembers(storeId)
    }
    setNm(''); setRole('staff'); setPhone(''); setJoinedAt(''); setShowForm(false); setSaving(false)
  }

  async function deactivate(profileId: string) {
    if (!confirm('직원을 비활성화할까요?\n(퇴사와 다르게 임시로 숨깁니다)')) return
    await supabase.from('store_members').update({ active: false }).eq('store_id', storeId).eq('profile_id', profileId)
    setMembers(p => p.filter(m => m.profiles?.id !== profileId))
  }

  async function resetPin(profileId: string) {
    if (!confirm('PIN을 1234로 초기화할까요?')) return
    await supabase.from('profiles').update({ pin: '1234' }).eq('id', profileId)
    alert('PIN이 1234로 초기화되었습니다')
  }

  async function reactivate(profileId: string) {
    if (!confirm('이 직원을 복직 처리할까요?')) return
    await supabase.from('store_members').update({ active: true, resigned: false, resigned_at: null, resign_reason: null }).eq('store_id', storeId).eq('profile_id', profileId)
    await supabase.from('profiles').update({ resigned: false }).eq('id', profileId)
    await loadMembers(storeId)
    alert('복직 처리되었습니다!')
  }

  return (
    <div>
      {editingProfile && <EditNameModal profile={editingProfile} storeId={storeId} onClose={() => setEditingProfile(null)} onSaved={() => loadMembers(storeId)} />}
      {resigningProfile && <ResignModal profile={resigningProfile} storeId={storeId} onClose={() => setResigningProfile(null)} onSaved={() => loadMembers(storeId)} />}
      {showPinModal && <PinViewModal members={members} onClose={() => setShowPinModal(false)} />}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <span style={{ fontSize:17, fontWeight:700, color:'#1a1a2e' }}>👥 직원관리</span>
        <div style={{ display:'flex', gap:8 }}>
          {isOwner && (
            <button onClick={() => setShowPinModal(true)}
              style={{ padding:'6px 12px', borderRadius:8, background:'rgba(108,92,231,0.1)', border:'1px solid rgba(108,92,231,0.3)', color:'#6C5CE7', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              🔐 PIN
            </button>
          )}
          {isOwner && (
            <button onClick={() => setShowForm(p => !p)}
              style={{ padding:'6px 14px', borderRadius:8, background:'rgba(255,107,53,0.1)', border:'1px solid rgba(255,107,53,0.3)', color:'#FF6B35', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              + 추가
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div style={{ ...bx, border:'1px solid rgba(255,107,53,0.3)', marginBottom:16 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:12 }}>새 직원 등록</div>
          <input value={nm} onChange={e => setNm(e.target.value)} placeholder="이름" style={{ ...inp, marginBottom:8 }} />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="전화번호 (선택)" style={{ ...inp, marginBottom:8 }} />
          <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inp, marginBottom:12, appearance:'auto' }}>
            <option value="staff">사원</option>
            <option value="pt">PT (파트타임)</option>
            <option value="manager">관리자</option>
            <option value="owner">대표</option>
          </select>
          <input type="date" value={joinedAt} onChange={e => setJoinedAt(e.target.value)} style={{ ...inp, marginBottom:8, color: joinedAt?'#1a1a2e':'#aaa' }} />
          <div style={{ fontSize:11, color:'#999', marginBottom:4 }}>입사일 (선택)</div>
          <div style={{ fontSize:11, color:'#999', marginBottom:12 }}>초기 PIN: 1234 (직원이 직접 변경 가능)</div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={addStaff} disabled={saving}
              style={{ flex:1, padding:'10px 0', borderRadius:8, background:saving?'#ccc':'linear-gradient(135deg,#FF6B35,#E84393)', border:'none', color:'#fff', fontWeight:700, cursor:'pointer' }}>
              {saving ? '등록 중...' : '등록'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding:'10px 16px', borderRadius:8, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', cursor:'pointer' }}>취소</button>
          </div>
        </div>
      )}

      <div style={{ fontSize:12, color:'#999', marginBottom:8 }}>재직 중 {members.length}명</div>

      {members.map(m => {
        const p = m.profiles
        if (!p) return null
        return (
          <div key={p.id} style={bx}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:'linear-gradient(135deg,#FF6B35,#E84393)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:'#fff', flexShrink:0 }}>
                {p.nm?.charAt(0)}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                  <span style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>{p.nm}</span>
                  <span style={{ fontSize:10, padding:'2px 7px', borderRadius:6, fontWeight:700, background:`${ROLE_COLORS[p.role]}20`, color:ROLE_COLORS[p.role]||'#888' }}>
                    {ROLES[p.role]||p.role}
                  </span>
                </div>
                {p.phone && <div style={{ fontSize:12, color:'#999' }}>{p.phone}</div>}
                {p.joined_at && <div style={{ fontSize:11, color:'#bbb' }}>입사일: {new Date(p.joined_at).toLocaleDateString('ko', {year:'numeric',month:'long',day:'numeric'})}</div>}
              </div>
              {isOwner && (
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  <button onClick={() => setEditingProfile(p)}
                    style={{ padding:'4px 10px', borderRadius:6, background:'rgba(108,92,231,0.08)', border:'1px solid rgba(108,92,231,0.2)', color:'#6C5CE7', fontSize:10, cursor:'pointer', fontWeight:600 }}>
                    ✏️ 이름수정
                  </button>
                  <button onClick={() => resetPin(p.id)}
                    style={{ padding:'4px 10px', borderRadius:6, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', fontSize:10, cursor:'pointer' }}>
                    PIN 초기화
                  </button>
                  <button onClick={() => setResigningProfile(p)}
                    style={{ padding:'4px 10px', borderRadius:6, background:'rgba(255,107,53,0.08)', border:'1px solid rgba(255,107,53,0.2)', color:'#FF6B35', fontSize:10, cursor:'pointer', fontWeight:600 }}>
                    🚪 퇴사
                  </button>
                  <button onClick={() => deactivate(p.id)}
                    style={{ padding:'4px 10px', borderRadius:6, background:'rgba(232,67,147,0.08)', border:'1px solid rgba(232,67,147,0.2)', color:'#E84393', fontSize:10, cursor:'pointer' }}>
                    비활성화
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {members.length === 0 && (
        <div style={{ ...bx, textAlign:'center', padding:32 }}>
          <div style={{ fontSize:24, marginBottom:8 }}>👥</div>
          <div style={{ fontSize:13, color:'#bbb' }}>등록된 직원이 없습니다</div>
        </div>
      )}

      {/* 퇴사자 목록 */}
      {isOwner && (
        <div style={{ marginTop:8 }}>
          <button onClick={() => setShowResigned(p => !p)}
            style={{ width:'100%', padding:'12px 0', borderRadius:12, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#aaa', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            🚪 퇴사자 목록 {resignedMembers.length > 0 ? `(${resignedMembers.length}명)` : ''} {showResigned ? '▲' : '▼'}
          </button>
          {showResigned && (
            <div style={{ marginTop:8 }}>
              {resignedMembers.length === 0 ? (
                <div style={{ ...bx, textAlign:'center', padding:24, color:'#bbb' }}>
                  <div style={{ fontSize:13 }}>퇴사자가 없습니다</div>
                </div>
              ) : resignedMembers.map(m => {
                const p = m.profiles
                if (!p) return null
                return (
                  <div key={p.id} style={{ ...bx, background:'#FAFBFC', border:'1px solid #F0F0F0' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:40, height:40, borderRadius:10, background:'#E0E0E0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'#aaa', flexShrink:0 }}>
                        {p.nm?.charAt(0)}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                          <span style={{ fontSize:14, fontWeight:700, color:'#aaa' }}>{p.nm}</span>
                          <span style={{ fontSize:10, padding:'2px 7px', borderRadius:6, background:'#F0F0F0', color:'#bbb', fontWeight:700 }}>퇴사</span>
                          <span style={{ fontSize:10, padding:'2px 7px', borderRadius:6, fontWeight:700, background:`${ROLE_COLORS[p.role]}15`, color:ROLE_COLORS[p.role]||'#888' }}>
                            {ROLES[p.role]||p.role}
                          </span>
                        </div>
                        {m.resigned_at && (
                          <div style={{ fontSize:11, color:'#bbb' }}>
                            퇴사일: {new Date(m.resigned_at).toLocaleDateString('ko')}
                            {m.resign_reason && ` · ${m.resign_reason}`}
                          </div>
                        )}
                      </div>
                      <button onClick={() => reactivate(p.id)}
                        style={{ padding:'5px 10px', borderRadius:8, background:'rgba(0,184,148,0.1)', border:'1px solid rgba(0,184,148,0.3)', color:'#00B894', fontSize:10, cursor:'pointer', fontWeight:600, flexShrink:0 }}>
                        복직
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}