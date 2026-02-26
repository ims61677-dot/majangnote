'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
const ROLES: Record<string,string> = { owner:'대표', manager:'관리자', staff:'사원', pt:'PT' }
const ROLE_COLORS: Record<string,string> = { owner:'#FF6B35', manager:'#6C5CE7', staff:'#2DC6D6', pt:'#00B894' }

export default function StaffPage() {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState('')
  const [myRole, setMyRole] = useState('')
  const [members, setMembers] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [nm, setNm] = useState('')
  const [role, setRole] = useState('staff')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)

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
      .select('*, profiles(id, nm, role, phone, pin)')
      .eq('store_id', sid).eq('active', true)
      .order('created_at')
    setMembers(data || [])
  }

 async function addStaff() {
    if (!nm.trim() || !storeId) return
    setSaving(true)

// 이름 + 전화번호로 기존 프로필 검색
    const { data: existing } = await supabase.from('profiles')
      .select('*').eq('nm', nm.trim()).eq('phone', phone.trim()).limit(1)

    let profile = existing?.[0]

    if (!profile) {
      // 없으면 새로 생성
      const { data: newProfile } = await supabase.from('profiles')
        .insert({ nm: nm.trim(), role, phone: phone.trim(), pin: '1234' })
        .select().single()
      profile = newProfile
    }
    if (profile) {
      // 이미 이 매장에 등록됐는지 확인
      const { data: already } = await supabase.from('store_members')
        .select('*').eq('store_id', storeId).eq('profile_id', profile.id).limit(1)

      if (!already?.length) {
        await supabase.from('store_members').insert({ store_id: storeId, profile_id: profile.id, role, active: true })
      }
      await loadMembers(storeId)
    }
    setNm(''); setRole('staff'); setPhone(''); setShowForm(false); setSaving(false)
  }

  async function deactivate(profileId: string) {
    if (!confirm('직원을 비활성화할까요?')) return
    await supabase.from('store_members').update({ active: false }).eq('store_id', storeId).eq('profile_id', profileId)
    setMembers(p => p.filter(m => m.profiles?.id !== profileId))
  }

  async function resetPin(profileId: string) {
    if (!confirm('PIN을 1234로 초기화할까요?')) return
    await supabase.from('profiles').update({ pin: '1234' }).eq('id', profileId)
    alert('PIN이 1234로 초기화되었습니다')
  }

  const isOwner = myRole === 'owner'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>👥 직원관리</span>
        {isOwner && (
          <button onClick={() => setShowForm(p => !p)}
            style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', color: '#FF6B35', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            + 직원 추가
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ ...bx, border: '1px solid rgba(255,107,53,0.3)', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>새 직원 등록</div>
          <input value={nm} onChange={e => setNm(e.target.value)} placeholder="이름" style={{ ...inp, marginBottom: 8 }} />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="전화번호 (선택)" style={{ ...inp, marginBottom: 8 }} />
          <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inp, marginBottom: 12, appearance: 'auto' }}>
            <option value="staff">사원</option>
            <option value="pt">PT (파트타임)</option>
            <option value="manager">관리자</option>
            <option value="owner">대표</option>
          </select>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 12 }}>초기 PIN: 1234 (직원이 직접 변경 가능)</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addStaff} disabled={saving}
              style={{ flex: 1, padding: '10px 0', borderRadius: 8, background: saving ? '#ccc' : 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              {saving ? '등록 중...' : '등록'}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '10px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>총 {members.length}명</div>

      {members.map(m => {
        const p = m.profiles
        if (!p) return null
        return (
          <div key={p.id} style={bx}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#FF6B35,#E84393)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {p.nm?.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>{p.nm}</span>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, fontWeight: 700,
                    background: `${ROLE_COLORS[p.role]}20`, color: ROLE_COLORS[p.role] || '#888' }}>
                    {ROLES[p.role] || p.role}
                  </span>
                </div>
                {p.phone && <div style={{ fontSize: 12, color: '#999' }}>{p.phone}</div>}
              </div>
              {isOwner && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button onClick={() => resetPin(p.id)}
                    style={{ padding: '4px 10px', borderRadius: 6, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 10, cursor: 'pointer' }}>
                    PIN 초기화
                  </button>
                  <button onClick={() => deactivate(p.id)}
                    style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(232,67,147,0.08)', border: '1px solid rgba(232,67,147,0.2)', color: '#E84393', fontSize: 10, cursor: 'pointer' }}>
                    비활성화
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {members.length === 0 && (
        <div style={{ ...bx, textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>👥</div>
          <div style={{ fontSize: 13, color: '#bbb' }}>등록된 직원이 없습니다</div>
        </div>
      )}
    </div>
  )
}