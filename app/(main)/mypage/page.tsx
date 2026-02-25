'use client'
import { useEffect, useRef, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
const ROLES: Record<string,string> = { owner:'대표', manager:'관리자', staff:'사원', pt:'PT' }
const ROLE_COLORS: Record<string,string> = { owner:'#FF6B35', manager:'#6C5CE7', staff:'#2DC6D6', pt:'#00B894' }

export default function MyPage() {
  const supabase = createSupabaseBrowserClient()
  const [user, setUser] = useState<any>(null)
  const [storeId, setStoreId] = useState('')
  const [contracts, setContracts] = useState<any[]>([])
  const [files, setFiles] = useState<Record<string, any[]>>({})
  const [view, setView] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)
  const [curPw, setCurPw] = useState(''); const [newPw, setNewPw] = useState(''); const [newPw2, setNewPw2] = useState(''); const [pwMsg, setPwMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadTarget, setUploadTarget] = useState<string | null>(null)

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('mj_user') || '{}')
    const s = JSON.parse(localStorage.getItem('mj_store') || '{}')
    if (!u.id) return
    setUser(u); setStoreId(s.id)
    loadContracts(u.id, s.id)
  }, [])

  async function loadContracts(uid: string, sid: string) {
    const { data } = await supabase.from('contracts')
      .select('*, contract_files(*)')
      .eq('store_id', sid)
      .or(`to_profile.eq.${uid},from_nm.eq.${JSON.parse(localStorage.getItem('mj_user')||'{}').nm}`)
      .order('created_at', { ascending: false })
    if (data) {
      setContracts(data)
      const fm: Record<string, any[]> = {}
      data.forEach((c: any) => { if (c.contract_files) fm[c.id] = c.contract_files })
      setFiles(fm)
    }
  }

  async function signContract(id: string) {
    await supabase.from('contracts').update({ status: 'signed', signed_at: new Date().toISOString().split('T')[0] }).eq('id', id)
    setContracts(p => p.map(c => c.id === id ? { ...c, status: 'signed', signed_at: new Date().toISOString().split('T')[0] } : c))
  }

  async function uploadFile(contractId: string, file: File) {
    const path = `${storeId}/${contractId}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('contract-files').upload(path, file)
    if (error) { alert('업로드 실패: ' + error.message); return }
    const nm = JSON.parse(localStorage.getItem('mj_user') || '{}').nm
    const { data: rec } = await supabase.from('contract_files').insert({
      contract_id: contractId, profile_id: user?.id,
      file_name: file.name, file_size: file.size, storage_path: path, uploaded_by: nm
    }).select().single()
    if (rec) setFiles(p => ({ ...p, [contractId]: [...(p[contractId] || []), rec] }))
  }

  async function downloadFile(storagePath: string, fileName: string) {
    const { data } = await supabase.storage.from('contract-files').download(storagePath)
    if (!data) return
    const url = URL.createObjectURL(data)
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.click()
    URL.revokeObjectURL(url)
  }

  async function changePw() {
    if (!user) return
    if (curPw !== user.pin) { setPwMsg('현재 PIN이 맞지 않습니다'); return }
    if (newPw.length !== 4) { setPwMsg('PIN은 4자리여야 합니다'); return }
    if (newPw !== newPw2) { setPwMsg('새 PIN이 일치하지 않습니다'); return }
    await supabase.from('profiles').update({ pin: newPw }).eq('id', user.id)
    const updated = { ...user, pin: newPw }
    localStorage.setItem('mj_user', JSON.stringify(updated))
    setUser(updated)
    setPwMsg('PIN이 변경되었습니다 ✓')
    setCurPw(''); setNewPw(''); setNewPw2('')
    setTimeout(() => setPwMsg(''), 3000)
  }

  const pending = contracts.filter(c => c.status === 'pending' && c.to_profile === user?.id)

  return (
    <div>
      <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e', marginBottom: 16 }}>👤 마이페이지</div>

      {/* 내 정보 */}
      <div style={bx}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#FF6B35,#E84393)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff' }}>
            {user?.nm?.charAt(0)}
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>{user?.nm}</div>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, fontWeight: 700, background: `${ROLE_COLORS[user?.role] || '#888'}20`, color: ROLE_COLORS[user?.role] || '#888' }}>
              {ROLES[user?.role] || user?.role}
            </span>
            {user?.phone && <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{user.phone}</div>}
          </div>
        </div>
      </div>

      {/* 서명 대기 */}
      {pending.length > 0 && (
        <div style={{ background: '#FFF5F0', border: '1px solid rgba(255,107,53,0.3)', borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#FF6B35', marginBottom: 10 }}>📄 서명 대기 {pending.length}건</div>
          {pending.map((c: any) => (
            <div key={c.id} style={{ padding: '8px 0', borderBottom: '1px solid #F4F6F9' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{c.type}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{c.period} · {c.wage}</div>
              <button onClick={() => signContract(c.id)}
                style={{ marginTop: 8, padding: '7px 18px', borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                ✍️ 서명
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 계약서 목록 */}
      {contracts.length > 0 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>📄 계약서</div>
          {contracts.map((c: any) => (
            <div key={c.id} style={bx}>
              <div style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setView(view === c.id ? null : c.id)}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{c.type}</span>
                  <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 7px', borderRadius: 5, background: c.status==='signed' ? 'rgba(0,184,148,0.1)' : 'rgba(255,107,53,0.1)', color: c.status==='signed' ? '#00B894' : '#FF6B35', fontWeight: 700 }}>
                    {c.status === 'signed' ? '서명완료' : '대기'}
                  </span>
                </div>
                <span style={{ fontSize: 10, color: '#bbb' }}>{c.created_at?.split('T')[0]}</span>
              </div>
              {view === c.id && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F4F6F9' }}>
                  {c.period && <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>📅 {c.period}</div>}
                  {c.wage && <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>💰 {c.wage}</div>}
                  {c.hours && <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>⏰ {c.hours}</div>}
                  {c.clauses && c.clauses.map((cl: string, i: number) => (
                    <div key={i} style={{ fontSize: 11, color: '#888', padding: '2px 0' }}>• {cl}</div>
                  ))}
                  <div style={{ marginTop: 10 }}>
                    {(files[c.id] || []).map((f: any) => (
                      <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F4F6F9' }}>
                        <span style={{ fontSize: 11, color: '#555' }}>📎 {f.file_name}</span>
                        <button onClick={() => downloadFile(f.storage_path, f.file_name)}
                          style={{ background: 'none', border: 'none', color: '#2DC6D6', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>⬇️ 다운</button>
                      </div>
                    ))}
                    <button onClick={() => { setUploadTarget(c.id); fileRef.current?.click() }}
                      style={{ marginTop: 8, padding: '6px 14px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 11, cursor: 'pointer' }}>
                      📎 파일 첨부
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      <input ref={fileRef} type="file" style={{ display: 'none' }}
        onChange={async e => {
          const file = e.target.files?.[0]
          if (file && uploadTarget) { await uploadFile(uploadTarget, file); e.target.value = '' }
        }} />

      {/* PIN 변경 */}
      <div style={bx}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowPw(p => !p)}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>🔒 PIN 변경</span>
          <span style={{ fontSize: 14, color: '#bbb' }}>{showPw ? '▲' : '▼'}</span>
        </div>
        {showPw && (
          <div style={{ marginTop: 14 }}>
            <input type="password" maxLength={4} value={curPw} onChange={e => setCurPw(e.target.value)}
              placeholder="현재 PIN" style={{ ...inp, marginBottom: 8, textAlign: 'center', letterSpacing: 8, fontSize: 18 }} />
            <input type="password" maxLength={4} value={newPw} onChange={e => setNewPw(e.target.value)}
              placeholder="새 PIN" style={{ ...inp, marginBottom: 8, textAlign: 'center', letterSpacing: 8, fontSize: 18 }} />
            <input type="password" maxLength={4} value={newPw2} onChange={e => setNewPw2(e.target.value)}
              placeholder="새 PIN 확인" style={{ ...inp, marginBottom: 10, textAlign: 'center', letterSpacing: 8, fontSize: 18 }} />
            {pwMsg && <div style={{ fontSize: 12, textAlign: 'center', marginBottom: 10, color: pwMsg.includes('✓') ? '#00B894' : '#E84393', fontWeight: 600 }}>{pwMsg}</div>}
            <button onClick={changePw}
              style={{ width: '100%', padding: 12, borderRadius: 10, background: 'linear-gradient(135deg,#6C5CE7,#2DC6D6)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              PIN 변경
            </button>
          </div>
        )}
      </div>
    </div>
  )
}