'use client'
import { useEffect, useRef, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
const ROLES: Record<string,string> = { owner:'대표', manager:'관리자', staff:'사원', pt:'PT' }
const ROLE_COLORS: Record<string,string> = { owner:'#FF6B35', manager:'#6C5CE7', staff:'#2DC6D6', pt:'#00B894' }

const NOTIF_ITEMS = [
  { key: 'attendance', label: '출퇴근 알림',     desc: '직원 출근·퇴근·지각·결근 시',    roles: ['owner','manager'] },
  { key: 'late',       label: '지각 알림',        desc: '출근 예정 시간 초과 시 별도 알림', roles: ['owner','manager'] },
  { key: 'absent',     label: '결근 처리 알림',   desc: '자정 자동 결근 처리 시',          roles: ['owner','manager'] },
  { key: 'request',    label: '수정 요청 알림',   desc: '직원 출퇴근 수정 요청 시',        roles: ['owner'] },
  { key: 'notice',     label: '공지 알림',         desc: '새 공지 등록 시',                 roles: ['owner','manager','staff'] },
  { key: 'closing',    label: '마감일지 알림',     desc: '마감일지 저장 완료 시',           roles: ['owner','manager'] },
  { key: 'inventory',  label: '재고 부족 알림',    desc: '설정 수량 이하일 때',             roles: ['owner','manager'] },
  { key: 'schedule',   label: '스케줄 변경 알림',  desc: '내 스케줄이 변경되면',            roles: ['owner','manager','staff'] },
]

const DEFAULT_SETTINGS: Record<string, boolean> = {
  attendance: true, late: true, absent: true, request: true,
  notice: true, closing: false, inventory: true, schedule: true,
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!on)}
      style={{ width:44, height:24, borderRadius:12, position:'relative', cursor:'pointer',
        background: on ? 'linear-gradient(135deg,#FF6B35,#E84393)' : '#E8ECF0',
        transition:'background 0.2s', flexShrink:0 }}>
      <div style={{ position:'absolute', top:2, width:20, height:20, borderRadius:'50%',
        background:'#fff', boxShadow:'0 1px 4px rgba(0,0,0,0.15)',
        transition:'left 0.2s', left: on ? 22 : 2 }} />
    </div>
  )
}

declare global {
  interface Window { daum: any }
}

export default function MyPage() {
  const supabase = createSupabaseBrowserClient()
  const [user, setUser] = useState<any>(null)
  const [storeId, setStoreId] = useState('')
  const [contracts, setContracts] = useState<any[]>([])
  const [files, setFiles] = useState<Record<string, any[]>>({})
  const [view, setView] = useState<string | null>(null)
  const [showPw, setShowPw] = useState(false)
  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadTarget, setUploadTarget] = useState<string | null>(null)
  const [notifSettings, setNotifSettings] = useState<Record<string, boolean>>(DEFAULT_SETTINGS)
  const [notifSaving, setNotifSaving] = useState(false)
  const [notifSaved, setNotifSaved] = useState(false)

  // 매장 위치 상태
  const [storeAddress, setStoreAddress] = useState('')
  const [storeLat, setStoreLat] = useState<number | null>(null)
  const [storeLng, setStoreLng] = useState<number | null>(null)
  const [locationSaving, setLocationSaving] = useState(false)
  const [locationSaved, setLocationSaved] = useState(false)
  const [showLocationSection, setShowLocationSection] = useState(false)

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('mj_user') || '{}')
    const s = JSON.parse(localStorage.getItem('mj_store') || '{}')
    if (!u.id) return
    setUser(u); setStoreId(s.id)
    loadContracts(u.id, s.id)
    loadNotifSettings(u.id, s.id)
    if (u.role === 'owner') loadStoreLocation(s.id)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.daum?.Postcode) return
    const script = document.createElement('script')
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    document.head.appendChild(script)
  }, [])

  async function loadStoreLocation(sid: string) {
    const { data } = await supabase.from('stores').select('address, lat, lng').eq('id', sid).maybeSingle()
    if (data) {
      setStoreAddress(data.address || '')
      setStoreLat(data.lat || null)
      setStoreLng(data.lng || null)
    }
  }

  function openAddressSearch() {
    if (!window.daum?.Postcode) {
      alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }
    new window.daum.Postcode({
      oncomplete: async (data: any) => {
        const fullAddress = data.roadAddress || data.jibunAddress
        try {
          const res = await fetch(
            `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(fullAddress)}`,
            { headers: { Authorization: `KakaoAK ${process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY}` } }
          )
          const json = await res.json()
          if (json.documents && json.documents.length > 0) {
            const doc = json.documents[0]
            const x = doc.address?.x || doc.road_address?.x
            const y = doc.address?.y || doc.road_address?.y
            if (x && y) { setStoreLat(parseFloat(y)); setStoreLng(parseFloat(x)) }
          }
        } catch (e) { console.error('좌표 변환 실패:', e) }
        setStoreAddress(fullAddress)
      }
    }).open()
  }

  async function saveStoreLocation() {
    if (!storeId || !storeAddress || !storeLat || !storeLng) {
      alert('주소 검색을 통해 위치를 입력해주세요.')
      return
    }
    setLocationSaving(true)
    await supabase.from('stores').update({ address: storeAddress, lat: storeLat, lng: storeLng }).eq('id', storeId)
    setLocationSaving(false)
    setLocationSaved(true)
    setTimeout(() => setLocationSaved(false), 2500)
  }

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

  async function loadNotifSettings(uid: string, sid: string) {
    const { data } = await supabase.from('push_subscriptions')
      .select('settings').eq('profile_id', uid).eq('store_id', sid).maybeSingle()
    if (data?.settings) setNotifSettings({ ...DEFAULT_SETTINGS, ...data.settings })
  }

  async function saveNotifSettings(newSettings: Record<string, boolean>) {
    if (!user?.id || !storeId) return
    setNotifSaving(true)
    await supabase.from('push_subscriptions')
      .upsert({ profile_id: user.id, store_id: storeId, settings: newSettings, subscription: {} }, { onConflict: 'profile_id,store_id' })
    setNotifSaving(false)
    setNotifSaved(true)
    setTimeout(() => setNotifSaved(false), 2000)
  }

  function toggleNotif(key: string) {
    const next = { ...notifSettings, [key]: !notifSettings[key] }
    setNotifSettings(next)
    saveNotifSettings(next)
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
    if (newPw.length !== 4)  { setPwMsg('PIN은 4자리여야 합니다'); return }
    if (newPw !== newPw2)    { setPwMsg('새 PIN이 일치하지 않습니다'); return }
    await supabase.from('profiles').update({ pin: newPw }).eq('id', user.id)
    const updated = { ...user, pin: newPw }
    localStorage.setItem('mj_user', JSON.stringify(updated))
    setUser(updated)
    setPwMsg('PIN이 변경되었습니다 ✓')
    setCurPw(''); setNewPw(''); setNewPw2('')
    setTimeout(() => setPwMsg(''), 3000)
  }

  const pending = contracts.filter(c => c.status === 'pending' && c.to_profile === user?.id)
  const visibleNotifItems = NOTIF_ITEMS.filter(item => item.roles.includes(user?.role || 'staff'))
  const isOwner = user?.role === 'owner'

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

      {/* 매장 위치 설정 - owner 전용 */}
      {isOwner && (
        <div style={bx}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setShowLocationSection(p => !p)}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>🏪 매장 위치 설정</span>
              {storeLat && !showLocationSection && (
                <div style={{ fontSize: 11, color: '#00B894', marginTop: 3 }}>✓ 위치 등록됨 · 날씨 자동 수집 중</div>
              )}
              {!storeLat && !showLocationSection && (
                <div style={{ fontSize: 11, color: '#FF6B35', marginTop: 3 }}>⚠ 위치 미설정 · 날씨 자동 수집 안됨</div>
              )}
            </div>
            <span style={{ fontSize: 14, color: '#bbb' }}>{showLocationSection ? '▲' : '▼'}</span>
          </div>

          {showLocationSection && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 12, lineHeight: 1.6 }}>
                매장 주소를 등록하면 마감일지 저장 시 날씨가 자동으로 기록돼요.<br />
                각 지점마다 별도 설정되며, 대표만 변경할 수 있어요.
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input value={storeAddress} readOnly placeholder="아래 버튼으로 주소를 검색하세요"
                  style={{ ...inp, flex: 1, background: '#F4F6F9', cursor: 'default', color: storeAddress ? '#1a1a2e' : '#bbb' }} />
                <button onClick={openAddressSearch}
                  style={{ padding: '8px 14px', borderRadius: 8, background: 'linear-gradient(135deg,#6C5CE7,#2DC6D6)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  🔍 검색
                </button>
              </div>
              {storeLat && storeLng && (
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(0,184,148,0.06)', border: '1px solid rgba(0,184,148,0.2)', marginBottom: 10 }}>
                  <div style={{ fontSize: 10, color: '#00B894', fontWeight: 700, marginBottom: 2 }}>📍 좌표 확인됨</div>
                  <div style={{ fontSize: 11, color: '#555' }}>위도 {storeLat.toFixed(6)} · 경도 {storeLng.toFixed(6)}</div>
                </div>
              )}
              <button onClick={saveStoreLocation} disabled={locationSaving || !storeAddress}
                style={{ width: '100%', padding: '11px 0', borderRadius: 10,
                  background: locationSaving || !storeAddress ? '#E8ECF0' : 'linear-gradient(135deg,#FF6B35,#E84393)',
                  border: 'none', color: locationSaving || !storeAddress ? '#aaa' : '#fff',
                  fontSize: 13, fontWeight: 700, cursor: locationSaving || !storeAddress ? 'not-allowed' : 'pointer' }}>
                {locationSaving ? '저장 중...' : locationSaved ? '✓ 저장되었습니다!' : '📍 위치 저장'}
              </button>
            </div>
          )}
        </div>
      )}

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

      {/* 알림 설정 */}
      <div style={bx}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
          <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>🔔 알림 설정</span>
          {notifSaved && <span style={{ fontSize:11, color:'#00B894', fontWeight:600 }}>✓ 저장됨</span>}
        </div>
        <div style={{ fontSize:11, color:'#aaa', marginBottom:16 }}>받고 싶은 알림만 켜두세요</div>
        {visibleNotifItems.map((item, i) => (
          <div key={item.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 0', borderBottom: i < visibleNotifItems.length - 1 ? '1px solid #F8F9FB' : 'none' }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'#1a1a2e' }}>{item.label}</div>
              <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>{item.desc}</div>
            </div>
            <Toggle on={notifSettings[item.key] ?? DEFAULT_SETTINGS[item.key]} onChange={() => toggleNotif(item.key)} />
          </div>
        ))}
      </div>

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