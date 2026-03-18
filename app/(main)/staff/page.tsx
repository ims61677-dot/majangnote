'use client'
import { useEffect, useRef, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
const ROLES: Record<string,string> = { owner:'대표', manager:'관리자', staff:'사원', pt:'PT' }
const ROLE_COLORS: Record<string,string> = { owner:'#FF6B35', manager:'#6C5CE7', staff:'#2DC6D6', pt:'#00B894' }

// inactive_from: 비활성/퇴사 처리된 달의 말일 다음날 = 다음달 1일
function nextMonthFirst(dateStr?: string) {
  const base = dateStr ? new Date(dateStr) : new Date()
  return `${base.getFullYear()}-${String(base.getMonth() + 2).padStart(2,'0')}-01`
}

function EditInfoModal({ profile, member, storeId, onClose, onSaved }: {
  profile: any; member: any; storeId: string; onClose: () => void; onSaved: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [newName, setNewName] = useState(profile.nm)
  const [newRole, setNewRole] = useState(profile.role || 'staff')
  const [newPhone, setNewPhone] = useState(profile.phone || '')
  const [newJoinedAt, setNewJoinedAt] = useState(profile.joined_at || member?.joined_at || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!newName.trim()) { alert('이름을 입력해주세요'); return }
    setSaving(true)
    const oldName = profile.nm
    const trimmed = newName.trim()
    try {
      await supabase.from('profiles').update({ nm: trimmed, role: newRole, phone: newPhone || null, joined_at: newJoinedAt || null }).eq('id', profile.id)
      await supabase.from('store_members').update({ role: newRole, joined_at: newJoinedAt || null }).eq('store_id', storeId).eq('profile_id', profile.id)
      if (trimmed !== oldName) {
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
      }
      alert('✅ 정보가 수정되었습니다!')
      onSaved(); onClose()
    } catch (e: any) { alert('수정 실패: ' + e?.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, padding:24, width:'100%', maxWidth:340 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:15, fontWeight:700, color:'#1a1a2e', marginBottom:4 }}>✏️ 직원 정보 수정</div>
        <div style={{ fontSize:11, color:'#aaa', marginBottom:16 }}>이름 변경 시 모든 기록에 자동 반영됩니다</div>
        <div style={{ fontSize:11, color:'#888', marginBottom:4 }}>이름</div>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="이름" style={{ ...inp, marginBottom:12 }} />
        <div style={{ fontSize:11, color:'#888', marginBottom:4 }}>직급</div>
        <select value={newRole} onChange={e => setNewRole(e.target.value)} style={{ ...inp, marginBottom:12, appearance:'auto' as const }}>
          <option value="staff">사원</option>
          <option value="pt">PT (파트타임)</option>
          <option value="manager">관리자</option>
          <option value="owner">대표</option>
        </select>
        <div style={{ fontSize:11, color:'#888', marginBottom:4 }}>전화번호</div>
        <input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="전화번호" style={{ ...inp, marginBottom:12 }} />
        <div style={{ fontSize:11, color:'#888', marginBottom:4 }}>입사일</div>
        <input type="date" value={newJoinedAt} onChange={e => setNewJoinedAt(e.target.value)} style={{ ...inp, marginBottom:20, color: newJoinedAt?'#1a1a2e':'#aaa' }} />
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onClose} style={{ flex:1, padding:'11px 0', borderRadius:10, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', fontSize:13, cursor:'pointer' }}>취소</button>
          <button onClick={handleSave} disabled={saving || !newName.trim()}
            style={{ flex:2, padding:'11px 0', borderRadius:10, border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:saving?'not-allowed':'pointer',
              background: saving||!newName.trim() ? '#ddd' : 'linear-gradient(135deg,#6C5CE7,#E84393)' }}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

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
      // ★ inactive_from: 퇴사일 기준 다음달 1일 (당월까지는 출퇴근에서 보임)
      const inactiveFrom = nextMonthFirst(resignDate)
      await supabase.from('store_members')
        .update({
          active: false,
          resigned: true,
          resigned_at: resignDate ? new Date(resignDate).toISOString() : new Date().toISOString(),
          resigned_at_date: resignDate || null,
          resign_reason: reason || null,
          inactive_from: inactiveFrom,
        })
        .eq('store_id', storeId).eq('profile_id', profile.id)
      await supabase.from('profiles').update({ resigned: true }).eq('id', profile.id)
      alert(`✅ "${profile.nm}" 퇴사 처리 완료\n${inactiveFrom} 부터 출퇴근 목록에서 제외됩니다.`)
      onSaved(); onClose()
    } catch (e: any) { alert('처리 실패: ' + e?.message) }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, padding:24, width:'100%', maxWidth:320 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize:15, fontWeight:700, color:'#E84393', marginBottom:4 }}>🚪 퇴사 처리</div>
        <div style={{ fontSize:11, color:'#aaa', marginBottom:16 }}>퇴사 처리 시 로그인이 불가능해집니다. 모든 기록(스케줄, 마감일지 등)은 보존됩니다.</div>
        <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', background:'rgba(232,67,147,0.06)', borderRadius:10, padding:'10px 14px', marginBottom:14 }}>
          {profile.nm} · <span style={{ color:ROLE_COLORS[profile.role]||'#888', fontSize:11 }}>{ROLES[profile.role]||profile.role}</span>
        </div>
        {/* ★ 안내 문구 추가 */}
        <div style={{ fontSize:11, color:'#FF6B35', background:'rgba(255,107,53,0.06)', borderRadius:8, padding:'8px 12px', marginBottom:12, lineHeight:1.6 }}>
          📅 퇴사일 기준 <b>당월까지</b>는 출퇴근 기록에서 확인 가능하며,<br/>
          <b>다음달 1일부터</b> 목록에서 제외됩니다.
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

function PersonalInfoModal({ profile, onClose }: { profile: any; onClose: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [info, setInfo] = useState<any>(null)
  const [idCardUrl, setIdCardUrl] = useState('')
  const [bankbookUrl, setBankbookUrl] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('profiles')
        .select('bank_name, bank_account, bank_holder, payslip_email, id_card_path, bankbook_path, id_name, id_number, id_address')
        .eq('id', profile.id).maybeSingle()
      setInfo(data)
      if (data?.id_card_path) {
        const { data: s } = await supabase.storage.from('staff-documents').createSignedUrl(data.id_card_path, 3600)
        if (s?.signedUrl) setIdCardUrl(s.signedUrl)
      }
      if (data?.bankbook_path) {
        const { data: s } = await supabase.storage.from('staff-documents').createSignedUrl(data.bankbook_path, 3600)
        if (s?.signedUrl) setBankbookUrl(s.signedUrl)
      }
      setLoading(false)
    }
    load()
  }, [profile.id])

  const hasInfo = info?.bank_account || info?.payslip_email || info?.id_card_path || info?.bankbook_path || info?.id_name || info?.id_number

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'85vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>💼 {profile.nm}님 급여 정보</div>
            <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>대표만 열람 가능 · 외부 유출 금지</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>
        {loading ? (
          <div style={{ textAlign:'center', padding:40, color:'#bbb', fontSize:13 }}>불러오는 중...</div>
        ) : !hasInfo ? (
          <div style={{ textAlign:'center', padding:32, color:'#bbb' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>📭</div>
            <div style={{ fontSize:13 }}>아직 등록된 정보가 없습니다</div>
            <div style={{ fontSize:11, color:'#ddd', marginTop:4 }}>직원에게 마이페이지에서 입력 요청하세요</div>
          </div>
        ) : (
          <div style={{ marginTop:16 }}>
            {(info.id_name || info.id_number || info.id_address) && (
              <div style={{ background:'#F8F9FB', borderRadius:12, padding:'12px 14px', marginBottom:12, border:'1px solid #E8ECF0' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#888', marginBottom:8 }}>🪪 신분증 정보</div>
                {info.id_name && <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}><span style={{ fontSize:12, color:'#aaa' }}>이름</span><span style={{ fontSize:13, fontWeight:600, color:'#1a1a2e' }}>{info.id_name}</span></div>}
                {info.id_number && <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}><span style={{ fontSize:12, color:'#aaa' }}>주민등록번호</span><span style={{ fontSize:13, fontWeight:600, color:'#1a1a2e' }}>{info.id_number}</span></div>}
                {info.id_address && <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ fontSize:12, color:'#aaa' }}>주소</span><span style={{ fontSize:13, fontWeight:600, color:'#1a1a2e', textAlign:'right', maxWidth:'60%' }}>{info.id_address}</span></div>}
              </div>
            )}
            {(info.bank_name || info.bank_account || info.bank_holder) && (
              <div style={{ background:'#F8F9FB', borderRadius:12, padding:'12px 14px', marginBottom:12, border:'1px solid #E8ECF0' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#888', marginBottom:8 }}>🏦 계좌 정보</div>
                {info.bank_name && <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}><span style={{ fontSize:12, color:'#aaa' }}>은행</span><span style={{ fontSize:13, fontWeight:600, color:'#1a1a2e' }}>{info.bank_name}</span></div>}
                {info.bank_holder && <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}><span style={{ fontSize:12, color:'#aaa' }}>예금주</span><span style={{ fontSize:13, fontWeight:600, color:'#1a1a2e' }}>{info.bank_holder}</span></div>}
                {info.bank_account && (
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:12, color:'#aaa' }}>계좌번호</span>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:14, fontWeight:700, color:'#1a1a2e', letterSpacing:1 }}>{info.bank_account}</span>
                      <button onClick={() => { navigator.clipboard.writeText(info.bank_account); alert('복사됨!') }}
                        style={{ padding:'2px 8px', borderRadius:6, background:'rgba(108,92,231,0.08)', border:'1px solid rgba(108,92,231,0.2)', color:'#6C5CE7', fontSize:10, cursor:'pointer' }}>복사</button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {info.payslip_email && (
              <div style={{ background:'#F8F9FB', borderRadius:12, padding:'12px 14px', marginBottom:12, border:'1px solid #E8ECF0' }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#888', marginBottom:6 }}>📧 급여명세서 이메일</div>
                <div style={{ fontSize:13, fontWeight:600, color:'#1a1a2e' }}>{info.payslip_email}</div>
              </div>
            )}
            {idCardUrl && <div style={{ marginBottom:12 }}><div style={{ fontSize:11, fontWeight:700, color:'#888', marginBottom:6 }}>🪪 신분증 사본</div><img src={idCardUrl} alt="신분증" style={{ width:'100%', borderRadius:10, border:'1px solid #E8ECF0' }} /></div>}
            {bankbookUrl && <div style={{ marginBottom:12 }}><div style={{ fontSize:11, fontWeight:700, color:'#888', marginBottom:6 }}>📄 통장 사본</div><img src={bankbookUrl} alt="통장사본" style={{ width:'100%', borderRadius:10, border:'1px solid #E8ECF0' }} /></div>}
          </div>
        )}
      </div>
    </div>
  )
}

function ContractModal({ profile, storeId, onClose }: { profile: any; storeId: string; onClose: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [contracts, setContracts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const ownerNm = JSON.parse(localStorage.getItem('mj_user') || '{}').nm

  useEffect(() => { loadContracts() }, [])

  async function loadContracts() {
    const { data } = await supabase.from('staff_contracts').select('*').eq('profile_id', profile.id).eq('store_id', storeId).order('created_at', { ascending: false })
    setContracts(data || [])
    setLoading(false)
  }

  async function uploadFiles(files: FileList) {
    setUploading(true)
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const safeName = `${Date.now()}_${i}.pdf`
      const path = `${storeId}/${profile.id}/${safeName}`
      const { error } = await supabase.storage.from('staff-contracts').upload(path, file)
      if (error) { alert('업로드 실패: ' + error.message); continue }
      await supabase.from('staff_contracts').insert({ store_id: storeId, profile_id: profile.id, file_name: file.name, file_path: path, uploaded_by: ownerNm })
    }
    await loadContracts()
    setUploading(false)
  }

  async function deleteContract(id: string, filePath: string) {
    if (!confirm('이 계약서를 삭제할까요?')) return
    await supabase.storage.from('staff-contracts').remove([filePath])
    await supabase.from('staff_contracts').delete().eq('id', id)
    setContracts(p => p.filter(c => c.id !== id))
  }

  async function downloadContract(filePath: string, fileName: string) {
    const { data } = await supabase.storage.from('staff-contracts').download(filePath)
    if (!data) return
    const url = URL.createObjectURL(data)
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'85vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>📄 {profile.nm}님 근로계약서</div>
            <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>PDF 파일 여러 개 업로드 가능</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>
        <div onClick={() => fileRef.current?.click()}
          style={{ padding:'16px 0', borderRadius:12, border:'2px dashed #E0E4E8', textAlign:'center', cursor:'pointer', background:'#F8F9FB', marginBottom:16 }}>
          <div style={{ fontSize:24, marginBottom:4 }}>📎</div>
          <div style={{ fontSize:13, color:'#aaa', fontWeight:600 }}>{uploading ? '업로드 중...' : 'PDF 파일 선택 (여러 개 가능)'}</div>
        </div>
        <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display:'none' }}
          onChange={async e => { if (e.target.files && e.target.files.length > 0) { await uploadFiles(e.target.files); e.target.value = '' } }} />
        {loading ? <div style={{ textAlign:'center', padding:24, color:'#bbb', fontSize:13 }}>불러오는 중...</div>
        : contracts.length === 0 ? <div style={{ textAlign:'center', padding:24, color:'#bbb' }}><div style={{ fontSize:13 }}>업로드된 계약서가 없습니다</div></div>
        : contracts.map((c: any) => (
          <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', borderRadius:10, background:'#F8F9FB', border:'1px solid #E8ECF0', marginBottom:8 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#1a1a2e', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>📎 {c.file_name}</div>
              <div style={{ fontSize:11, color:'#bbb', marginTop:2 }}>{new Date(c.created_at).toLocaleDateString('ko')} · {c.uploaded_by}</div>
            </div>
            <div style={{ display:'flex', gap:6, flexShrink:0, marginLeft:8 }}>
              <button onClick={() => downloadContract(c.file_path, c.file_name)} style={{ padding:'5px 10px', borderRadius:8, background:'linear-gradient(135deg,#6C5CE7,#2DC6D6)', border:'none', color:'#fff', fontSize:11, fontWeight:700, cursor:'pointer' }}>⬇️</button>
              <button onClick={() => deleteContract(c.id, c.file_path)} style={{ padding:'5px 10px', borderRadius:8, background:'rgba(232,67,147,0.08)', border:'1px solid rgba(232,67,147,0.2)', color:'#E84393', fontSize:11, cursor:'pointer', fontWeight:600 }}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StaffPage() {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState('')
  const [myRole, setMyRole] = useState('')
  const [members, setMembers] = useState<any[]>([])
  const [resignedMembers, setResignedMembers] = useState<any[]>([])
  const [inactiveMembers, setInactiveMembers] = useState<any[]>([])   // ★ 비활성화 목록
  const [showForm, setShowForm] = useState(false)
  const [showResigned, setShowResigned] = useState(false)
  const [showInactive, setShowInactive] = useState(false)             // ★ 비활성화 펼치기
  const [showPinModal, setShowPinModal] = useState(false)
  const [editingProfile, setEditingProfile] = useState<any>(null)
  const [resigningProfile, setResigningProfile] = useState<any>(null)
  const [personalProfile, setPersonalProfile] = useState<any>(null)
  const [contractProfile, setContractProfile] = useState<any>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)         // ★ 삭제 모달용
  const [nm, setNm] = useState('')
  const [role, setRole] = useState('staff')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [joinedAt, setJoinedAt] = useState('')
  const [allStores, setAllStores] = useState<any[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [selectedStoreName, setSelectedStoreName] = useState('')
  const isOwner = myRole === 'owner'

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id); setSelectedStoreId(store.id); setSelectedStoreName(store.name || ''); setMyRole(user.role)
    loadMembers(store.id)
    if (user.role === 'owner') loadAllStores(user.id)
  }, [])

  async function loadAllStores(uid: string) {
    const { data } = await supabase.from('store_members').select('*, stores(*)').eq('profile_id', uid).eq('role', 'owner').eq('active', true)
    if (data && data.length > 1) setAllStores(data)
  }

  async function switchViewStore(sid: string, sname: string) {
    setSelectedStoreId(sid); setSelectedStoreName(sname); await loadMembers(sid)
  }

  async function loadMembers(sid: string) {
    // 재직 중 (active=true, resigned=false)
    const { data } = await supabase.from('store_members')
      .select('*, profiles(id, nm, role, phone, pin, resigned, joined_at)')
      .eq('store_id', sid).eq('active', true).order('created_at')
    const active = (data || []).filter(m => !m.profiles?.resigned)
    setMembers(active)

    // ★ 비활성화 (active=false, resigned=false)
    const { data: inact } = await supabase.from('store_members')
      .select('*, profiles(id, nm, role, phone, resigned), inactive_from')
      .eq('store_id', sid).eq('active', false).eq('resigned', false)
      .order('created_at', { ascending: false })
    setInactiveMembers(inact || [])

    // 퇴사 (resigned=true)
    const { data: res } = await supabase.from('store_members')
      .select('*, profiles(id, nm, role, phone, resigned), resigned_at, resign_reason, inactive_from')
      .eq('store_id', sid).eq('resigned', true).order('resigned_at', { ascending: false })
    setResignedMembers(res || [])
  }

  async function addStaff() {
    if (!nm.trim() || !selectedStoreId) return
    setSaving(true)
    const { data: existing } = await supabase.from('profiles').select('*').eq('nm', nm.trim()).eq('phone', phone.trim()).limit(1)
    let profile = existing?.[0]
    if (!profile) {
      const { data: newProfile } = await supabase.from('profiles').insert({ nm: nm.trim(), role, phone: phone.trim(), pin: '1234', joined_at: joinedAt || null }).select().single()
      profile = newProfile
    }
    if (profile) {
      const { data: already } = await supabase.from('store_members').select('*').eq('store_id', selectedStoreId).eq('profile_id', profile.id).limit(1)
      if (!already?.length) await supabase.from('store_members').insert({ store_id: selectedStoreId, profile_id: profile.id, role, active: true, joined_at: joinedAt || null })
      await loadMembers(selectedStoreId)
    }
    setNm(''); setRole('staff'); setPhone(''); setJoinedAt(''); setShowForm(false); setSaving(false)
  }

  // ★ 비활성화: inactive_from = 다음달 1일
  async function deactivate(profileId: string) {
    if (!confirm('직원을 비활성화할까요?\n(퇴사와 다르게 임시로 숨깁니다)\n\n당월까지는 출퇴근 기록에서 확인 가능합니다.')) return
    const inactiveFrom = nextMonthFirst()
    await supabase.from('store_members')
      .update({ active: false, inactive_from: inactiveFrom })
      .eq('store_id', selectedStoreId).eq('profile_id', profileId)
    setMembers(p => p.filter(m => m.profiles?.id !== profileId))
  }

  async function resetPin(profileId: string) {
    if (!confirm('PIN을 1234로 초기화할까요?')) return
    await supabase.from('profiles').update({ pin: '1234' }).eq('id', profileId)
    alert('PIN이 1234로 초기화되었습니다')
  }

  async function reactivate(profileId: string) {
    if (!confirm('이 직원을 복직 처리할까요?')) return
    await supabase.from('store_members')
      .update({ active: true, resigned: false, resigned_at: null, resign_reason: null, inactive_from: null })
      .eq('store_id', selectedStoreId).eq('profile_id', profileId)
    await supabase.from('profiles').update({ resigned: false }).eq('id', profileId)
    await loadMembers(selectedStoreId)
    alert('복직 처리되었습니다!')
  }

  // ★ 비활성화 → 퇴사로 전환
  async function deactivatedToResign(profileId: string, profileNm: string) {
    if (!confirm(`"${profileNm}"을 퇴사 처리로 변경할까요?`)) return
    const inactiveFrom = nextMonthFirst()
    await supabase.from('store_members')
      .update({ resigned: true, resigned_at: new Date().toISOString(), inactive_from: inactiveFrom })
      .eq('store_id', selectedStoreId).eq('profile_id', profileId)
    await supabase.from('profiles').update({ resigned: true }).eq('id', profileId)
    await loadMembers(selectedStoreId)
    alert('퇴사 처리되었습니다!')
  }

  // ★ 완전 삭제 (deleteTarget에서 mode 선택)
  async function deleteStaff(profileId: string, mode: 'soft' | 'hard') {
    if (mode === 'soft') {
      // store_members만 삭제 (기록 보존)
      await supabase.from('store_members').delete().eq('store_id', selectedStoreId).eq('profile_id', profileId)
      // 다른 지점에도 없으면 profiles도 삭제
      const { data: otherStores } = await supabase.from('store_members').select('id').eq('profile_id', profileId)
      if (!otherStores || otherStores.length === 0) {
        await supabase.from('profiles').delete().eq('id', profileId)
      }
    } else {
      // 모든 기록 완전 삭제
      await supabase.from('attendance').delete().eq('profile_id', profileId).eq('store_id', selectedStoreId)
      await supabase.from('schedules').delete().eq('store_id', selectedStoreId)  // staff_name 기준이라 별도처리
      await supabase.from('attendance_requests').delete().eq('profile_id', profileId).eq('store_id', selectedStoreId)
      await supabase.from('store_members').delete().eq('store_id', selectedStoreId).eq('profile_id', profileId)
      const { data: otherStores } = await supabase.from('store_members').select('id').eq('profile_id', profileId)
      if (!otherStores || otherStores.length === 0) {
        await supabase.from('profiles').delete().eq('id', profileId)
      }
    }
    setDeleteTarget(null)
    await loadMembers(selectedStoreId)
    alert('삭제 완료되었습니다.')
  }

  return (
    <div>
      {editingProfile && <EditInfoModal profile={editingProfile} member={members.find(m => m.profiles?.id === editingProfile?.id)} storeId={selectedStoreId} onClose={() => setEditingProfile(null)} onSaved={() => loadMembers(selectedStoreId)} />}
      {resigningProfile && <ResignModal profile={resigningProfile} storeId={selectedStoreId} onClose={() => setResigningProfile(null)} onSaved={() => loadMembers(selectedStoreId)} />}
      {showPinModal && <PinViewModal members={members} onClose={() => setShowPinModal(false)} />}
      {personalProfile && <PersonalInfoModal profile={personalProfile} onClose={() => setPersonalProfile(null)} />}
      {contractProfile && <ContractModal profile={contractProfile} storeId={selectedStoreId} onClose={() => setContractProfile(null)} />}

      {/* ★ 삭제 모달 */}
      {deleteTarget && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
          onClick={() => setDeleteTarget(null)}>
          <div style={{ background:'#fff', borderRadius:20, padding:24, width:'100%', maxWidth:320 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:15, fontWeight:700, color:'#E84393', marginBottom:4 }}>🗑️ 직원 삭제</div>
            <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', background:'rgba(232,67,147,0.06)', borderRadius:10, padding:'10px 14px', marginBottom:16 }}>
              {deleteTarget.nm}
            </div>
            <div style={{ fontSize:11, color:'#888', marginBottom:14, lineHeight:1.7 }}>
              삭제 방식을 선택해주세요.<br/>삭제 후 로그인이 불가능합니다.
            </div>
            {/* 기록 보존 삭제 */}
            <button onClick={() => { if(confirm(`"${deleteTarget.nm}"을 삭제할까요?\n출퇴근·스케줄 기록은 보존됩니다.`)) deleteStaff(deleteTarget.id, 'soft') }}
              style={{ width:'100%', padding:'12px 0', borderRadius:10, border:'1px solid rgba(232,67,147,0.3)', background:'rgba(232,67,147,0.06)', color:'#E84393', fontSize:13, fontWeight:700, cursor:'pointer', marginBottom:8 }}>
              📋 삭제 (기록 보존)
              <div style={{ fontSize:10, color:'#E84393', opacity:0.7, fontWeight:400, marginTop:2 }}>출퇴근·스케줄 기록은 남김</div>
            </button>
            {/* 완전 삭제 */}
            <button onClick={() => { if(confirm(`"${deleteTarget.nm}"을 완전 삭제할까요?\n⚠️ 출퇴근·스케줄 기록도 모두 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`)) deleteStaff(deleteTarget.id, 'hard') }}
              style={{ width:'100%', padding:'12px 0', borderRadius:10, border:'none', background:'linear-gradient(135deg,#E84393,#FF6B35)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', marginBottom:12 }}>
              ⚠️ 완전 삭제 (모든 기록 삭제)
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.8)', fontWeight:400, marginTop:2 }}>출퇴근·스케줄 기록도 모두 삭제</div>
            </button>
            <button onClick={() => setDeleteTarget(null)}
              style={{ width:'100%', padding:'10px 0', borderRadius:10, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', fontSize:13, cursor:'pointer' }}>
              취소
            </button>
          </div>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <span style={{ fontSize:17, fontWeight:700, color:'#1a1a2e' }}>👥 직원관리</span>
        <div style={{ display:'flex', gap:8 }}>
          {isOwner && <button onClick={() => setShowPinModal(true)} style={{ padding:'6px 12px', borderRadius:8, background:'rgba(108,92,231,0.1)', border:'1px solid rgba(108,92,231,0.3)', color:'#6C5CE7', fontSize:12, fontWeight:700, cursor:'pointer' }}>🔐 PIN</button>}
          {isOwner && <button onClick={() => setShowForm(p => !p)} style={{ padding:'6px 14px', borderRadius:8, background:'rgba(255,107,53,0.1)', border:'1px solid rgba(255,107,53,0.3)', color:'#FF6B35', fontSize:12, fontWeight:700, cursor:'pointer' }}>+ 추가</button>}
        </div>
      </div>

      {isOwner && allStores.length > 1 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, color:'#888', marginBottom:6, fontWeight:600 }}>🏪 지점 선택 (대표 전용)</div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {allStores.map(m => {
              const isSel = m.stores?.id === selectedStoreId
              return (
                <button key={m.id} onClick={() => switchViewStore(m.stores?.id, m.stores?.name)}
                  style={{ padding:'6px 14px', borderRadius:8, border:`1px solid ${isSel ? '#FF6B35' : '#E8ECF0'}`, background: isSel ? 'rgba(255,107,53,0.1)' : '#F8F9FB', color: isSel ? '#FF6B35' : '#888', fontSize:12, fontWeight: isSel ? 700 : 500, cursor:'pointer' }}>
                  {isSel ? '✓ ' : ''}{m.stores?.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

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
            <button onClick={addStaff} disabled={saving} style={{ flex:1, padding:'10px 0', borderRadius:8, background:saving?'#ccc':'linear-gradient(135deg,#FF6B35,#E84393)', border:'none', color:'#fff', fontWeight:700, cursor:'pointer' }}>{saving ? '등록 중...' : '등록'}</button>
            <button onClick={() => setShowForm(false)} style={{ padding:'10px 16px', borderRadius:8, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', cursor:'pointer' }}>취소</button>
          </div>
        </div>
      )}

      <div style={{ fontSize:12, color:'#999', marginBottom:8 }}>
        {allStores.length > 1 && isOwner ? `📍 ${selectedStoreName} · ` : ''}재직 중 {members.length}명
      </div>

      {members.map(m => {
        const p = m.profiles
        if (!p) return null
        return (
          <div key={p.id} style={bx}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:12, background:'linear-gradient(135deg,#FF6B35,#E84393)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:700, color:'#fff', flexShrink:0 }}>{p.nm?.charAt(0)}</div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                  <span style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>{p.nm}</span>
                  <span style={{ fontSize:10, padding:'2px 7px', borderRadius:6, fontWeight:700, background:`${ROLE_COLORS[p.role]}20`, color:ROLE_COLORS[p.role]||'#888' }}>{ROLES[p.role]||p.role}</span>
                </div>
                {p.phone && <div style={{ fontSize:12, color:'#999' }}>{p.phone}</div>}
                {(p.joined_at || m.joined_at) && <div style={{ fontSize:11, color:'#bbb' }}>입사일: {new Date(p.joined_at || m.joined_at).toLocaleDateString('ko', {year:'numeric',month:'long',day:'numeric'})}</div>}
              </div>
              {isOwner && (
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  <button onClick={() => setEditingProfile(p)} style={{ padding:'4px 10px', borderRadius:6, background:'rgba(108,92,231,0.08)', border:'1px solid rgba(108,92,231,0.2)', color:'#6C5CE7', fontSize:10, cursor:'pointer', fontWeight:600 }}>✏️ 정보수정</button>
                  <button onClick={() => setPersonalProfile(p)} style={{ padding:'4px 10px', borderRadius:6, background:'rgba(0,184,148,0.08)', border:'1px solid rgba(0,184,148,0.2)', color:'#00B894', fontSize:10, cursor:'pointer', fontWeight:600 }}>💼 급여정보</button>
                  <button onClick={() => setContractProfile(p)} style={{ padding:'4px 10px', borderRadius:6, background:'rgba(45,198,214,0.08)', border:'1px solid rgba(45,198,214,0.2)', color:'#2DC6D6', fontSize:10, cursor:'pointer', fontWeight:600 }}>📄 계약서</button>
                  <button onClick={() => resetPin(p.id)} style={{ padding:'4px 10px', borderRadius:6, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', fontSize:10, cursor:'pointer' }}>PIN 초기화</button>
                  <button onClick={() => setResigningProfile(p)} style={{ padding:'4px 10px', borderRadius:6, background:'rgba(255,107,53,0.08)', border:'1px solid rgba(255,107,53,0.2)', color:'#FF6B35', fontSize:10, cursor:'pointer', fontWeight:600 }}>🚪 퇴사</button>
                  <button onClick={() => deactivate(p.id)} style={{ padding:'4px 10px', borderRadius:6, background:'rgba(232,67,147,0.08)', border:'1px solid rgba(232,67,147,0.2)', color:'#E84393', fontSize:10, cursor:'pointer' }}>비활성화</button>
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

      {isOwner && (
        <div style={{ marginTop:8 }}>

          {/* ★ 비활성화 목록 */}
          <button onClick={() => setShowInactive(p => !p)}
            style={{ width:'100%', padding:'12px 0', borderRadius:12, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#aaa', fontSize:13, fontWeight:600, cursor:'pointer', marginBottom:8 }}>
            ⏸️ 비활성화 목록 {inactiveMembers.length > 0 ? `(${inactiveMembers.length}명)` : ''} {showInactive ? '▲' : '▼'}
          </button>
          {showInactive && (
            <div style={{ marginBottom:8 }}>
              {/* 안내 문구 */}
              <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(255,107,53,0.06)', border:'1px solid rgba(255,107,53,0.15)', marginBottom:10, fontSize:11, color:'#FF6B35', lineHeight:1.6 }}>
                ⚠️ 비활성화는 로그인이 <b>차단되지 않습니다.</b><br/>
                완전 차단이 필요하면 퇴사 처리로 변경해주세요.
              </div>
              {inactiveMembers.length === 0 ? (
                <div style={{ ...bx, textAlign:'center', padding:24, color:'#bbb' }}><div style={{ fontSize:13 }}>비활성화된 직원이 없습니다</div></div>
              ) : inactiveMembers.map(m => {
                const p = m.profiles
                if (!p) return null
                return (
                  <div key={p.id} style={{ ...bx, background:'#FAFBFC', border:'1px solid #F0F0F0' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:40, height:40, borderRadius:10, background:'#E8ECF0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'#aaa', flexShrink:0 }}>{p.nm?.charAt(0)}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                          <span style={{ fontSize:14, fontWeight:700, color:'#888' }}>{p.nm}</span>
                          <span style={{ fontSize:10, padding:'2px 7px', borderRadius:6, background:'rgba(255,107,53,0.1)', color:'#FF6B35', fontWeight:700 }}>⏸️ 비활성</span>
                          <span style={{ fontSize:10, padding:'2px 7px', borderRadius:6, fontWeight:700, background:`${ROLE_COLORS[p.role]}15`, color:ROLE_COLORS[p.role]||'#888' }}>{ROLES[p.role]||p.role}</span>
                        </div>
                        <div style={{ fontSize:11, color:'#FF6B35', fontWeight:600 }}>⚠️ 로그인 가능 상태</div>
                        {m.inactive_from && <div style={{ fontSize:11, color:'#bbb', marginTop:1 }}>📅 {m.inactive_from} 부터 출퇴근 제외</div>}
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:4, flexShrink:0 }}>
                        <button onClick={() => reactivate(p.id)}
                          style={{ padding:'4px 8px', borderRadius:7, background:'rgba(0,184,148,0.1)', border:'1px solid rgba(0,184,148,0.3)', color:'#00B894', fontSize:10, cursor:'pointer', fontWeight:600 }}>복직</button>
                        <button onClick={() => deactivatedToResign(p.id, p.nm)}
                          style={{ padding:'4px 8px', borderRadius:7, background:'rgba(255,107,53,0.08)', border:'1px solid rgba(255,107,53,0.2)', color:'#FF6B35', fontSize:10, cursor:'pointer', fontWeight:600 }}>🚪 퇴사전환</button>
                        <button onClick={() => setDeleteTarget(p)}
                          style={{ padding:'4px 8px', borderRadius:7, background:'rgba(232,67,147,0.08)', border:'1px solid rgba(232,67,147,0.2)', color:'#E84393', fontSize:10, cursor:'pointer', fontWeight:600 }}>🗑️ 삭제</button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 퇴사자 목록 */}
          <button onClick={() => setShowResigned(p => !p)}
            style={{ width:'100%', padding:'12px 0', borderRadius:12, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#aaa', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            🚪 퇴사자 목록 {resignedMembers.length > 0 ? `(${resignedMembers.length}명)` : ''} {showResigned ? '▲' : '▼'}
          </button>
          {showResigned && (
            <div style={{ marginTop:8 }}>
              {resignedMembers.length === 0 ? (
                <div style={{ ...bx, textAlign:'center', padding:24, color:'#bbb' }}><div style={{ fontSize:13 }}>퇴사자가 없습니다</div></div>
              ) : resignedMembers.map(m => {
                const p = m.profiles
                if (!p) return null
                return (
                  <div key={p.id} style={{ ...bx, background:'#FAFBFC', border:'1px solid #F0F0F0' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                      <div style={{ width:40, height:40, borderRadius:10, background:'#E0E0E0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'#aaa', flexShrink:0 }}>{p.nm?.charAt(0)}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:2 }}>
                          <span style={{ fontSize:14, fontWeight:700, color:'#aaa' }}>{p.nm}</span>
                          <span style={{ fontSize:10, padding:'2px 7px', borderRadius:6, background:'#F0F0F0', color:'#bbb', fontWeight:700 }}>퇴사</span>
                          <span style={{ fontSize:10, padding:'2px 7px', borderRadius:6, fontWeight:700, background:`${ROLE_COLORS[p.role]}15`, color:ROLE_COLORS[p.role]||'#888' }}>{ROLES[p.role]||p.role}</span>
                        </div>
                        {m.resigned_at && (
                          <div style={{ fontSize:11, color:'#bbb' }}>
                            퇴사일: {new Date(m.resigned_at).toLocaleDateString('ko')}
                            {m.resign_reason && ` · ${m.resign_reason}`}
                          </div>
                        )}
                        {m.inactive_from && <div style={{ fontSize:11, color:'#FF6B35', marginTop:2 }}>📅 {m.inactive_from} 부터 출퇴근 제외</div>}
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:4, flexShrink:0 }}>
                        <button onClick={() => setPersonalProfile(p)} style={{ padding:'4px 8px', borderRadius:7, background:'rgba(0,184,148,0.08)', border:'1px solid rgba(0,184,148,0.2)', color:'#00B894', fontSize:10, cursor:'pointer', fontWeight:600 }}>💼 급여</button>
                        <button onClick={() => setContractProfile(p)} style={{ padding:'4px 8px', borderRadius:7, background:'rgba(45,198,214,0.08)', border:'1px solid rgba(45,198,214,0.2)', color:'#2DC6D6', fontSize:10, cursor:'pointer', fontWeight:600 }}>📄 계약서</button>
                        <button onClick={() => reactivate(p.id)} style={{ padding:'5px 10px', borderRadius:8, background:'rgba(0,184,148,0.1)', border:'1px solid rgba(0,184,148,0.3)', color:'#00B894', fontSize:10, cursor:'pointer', fontWeight:600 }}>복직</button>
                        <button onClick={() => setDeleteTarget(p)} style={{ padding:'5px 10px', borderRadius:8, background:'rgba(232,67,147,0.08)', border:'1px solid rgba(232,67,147,0.2)', color:'#E84393', fontSize:10, cursor:'pointer', fontWeight:600 }}>🗑️ 삭제</button>
                      </div>
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