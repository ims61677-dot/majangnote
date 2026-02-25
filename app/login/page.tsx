'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<'store' | 'login'>('store')
  const [stores, setStores] = useState<any[]>([])
  const [selectedStore, setSelectedStore] = useState<any>(null)
  const [showNewStore, setShowNewStore] = useState(false)
  const [newStoreName, setNewStoreName] = useState('')
  const [nm, setNm] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('stores').select('*').order('created_at').then(({ data }) => {
      setStores(data || [])
    })
  }, [])

  async function createStore() {
    if (!newStoreName.trim()) return
    const { data } = await supabase.from('stores').insert({ name: newStoreName.trim() }).select().single()
    if (data) {
      setStores(p => [...p, data])
      setNewStoreName('')
      setShowNewStore(false)
    }
  }

  function selectStore(store: any) {
    setSelectedStore(store)
    setStep('login')
    setError(''); setNm(''); setPin('')
  }

  async function handleLogin() {
    if (!nm.trim()) { setError('이름을 입력하세요'); return }
    if (!pin) { setError('PIN을 입력하세요'); return }
    setLoading(true); setError('')

    const { data: user } = await supabase
      .from('profiles').select('*').eq('nm', nm.trim()).single()

    if (!user) { setError('등록되지 않은 이름입니다'); setLoading(false); return }
    if (user.pin !== pin) { setError('PIN이 틀렸습니다'); setLoading(false); return }

    const { data: member } = await supabase
      .from('store_members').select('*, stores(*)')
      .eq('profile_id', user.id)
      .eq('store_id', selectedStore.id)
      .eq('active', true).single()

    if (!member) { setError('이 매장에 등록된 직원이 아닙니다'); setLoading(false); return }

    localStorage.setItem('mj_user', JSON.stringify({ ...user, role: member.role }))
    localStorage.setItem('mj_store', JSON.stringify(member.stores))
    router.push('/dash')
    setLoading(false)
  }

  const inp = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1px solid #E0E4E8', background: '#F8F9FB',
    color: '#1a1a2e', fontSize: 15, outline: 'none', boxSizing: 'border-box' as const
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#F4F6F9' }}>
      <div style={{ width: '100%', maxWidth: 380, padding: '0 24px' }}>

        {/* 로고 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 68, height: 68, borderRadius: 20, margin: '0 auto',
            background: 'linear-gradient(135deg,#FF6B35,#E84393)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, fontWeight: 800, color: '#fff',
            boxShadow: '0 8px 24px rgba(255,107,53,0.3)' }}>M</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e', marginTop: 14 }}>매장노트</div>
          <div style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>매장 운영의 모든 것</div>
        </div>

        {/* STEP 1: 매장 선택 */}
        {step === 'store' && (
          <div style={{ background: '#fff', borderRadius: 20, padding: 24,
            border: '1px solid #E8ECF0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 14 }}>📍 매장 선택</div>

            {stores.map(store => (
              <button key={store.id} onClick={() => selectStore(store)}
                style={{ width: '100%', padding: '14px 16px', borderRadius: 12, marginBottom: 8,
                  background: '#F8F9FB', border: '1px solid #E8ECF0',
                  cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg,#FF6B35,#E84393)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, color: '#fff', fontWeight: 800, flexShrink: 0 }}>
                  {store.name.charAt(0)}
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{store.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 16, color: '#ccc' }}>→</span>
              </button>
            ))}

            {!showNewStore ? (
              <button onClick={() => setShowNewStore(true)}
                style={{ width: '100%', padding: '12px 0', borderRadius: 12, marginTop: 4,
                  background: 'rgba(255,107,53,0.06)', border: '1px dashed rgba(255,107,53,0.4)',
                  color: '#FF6B35', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                + 새 매장 추가
              </button>
            ) : (
              <div style={{ marginTop: 8 }}>
                <input value={newStoreName} onChange={e => setNewStoreName(e.target.value)}
                  placeholder="매장 이름 입력" style={{ ...inp, marginBottom: 8 }}
                  onKeyDown={e => e.key === 'Enter' && createStore()} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={createStore}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 10,
                      background: 'linear-gradient(135deg,#FF6B35,#E84393)',
                      border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    추가
                  </button>
                  <button onClick={() => { setShowNewStore(false); setNewStoreName('') }}
                    style={{ padding: '10px 16px', borderRadius: 10,
                      background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
                </div>
              </div>
            )}

            {stores.length === 0 && !showNewStore && (
              <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 12, color: '#bbb' }}>
                등록된 매장이 없습니다
              </div>
            )}
          </div>
        )}

        {/* STEP 2: 로그인 */}
        {step === 'login' && (
          <div style={{ background: '#fff', borderRadius: 20, padding: 24,
            border: '1px solid #E8ECF0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>

            {/* 선택된 매장 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
              padding: '10px 14px', background: '#F8F9FB', borderRadius: 12, border: '1px solid #E8ECF0' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8,
                background: 'linear-gradient(135deg,#FF6B35,#E84393)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color: '#fff', fontWeight: 800 }}>
                {selectedStore?.name?.charAt(0)}
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', flex: 1 }}>{selectedStore?.name}</span>
              <button onClick={() => setStep('store')}
                style={{ background: 'none', border: 'none', color: '#FF6B35', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>변경</button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 }}>이름</div>
              <input value={nm} onChange={e => { setNm(e.target.value); setError('') }}
                placeholder="이름을 입력하세요" style={inp} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 }}>PIN</div>
              <input type="password" placeholder="4자리" maxLength={4}
                value={pin} onChange={e => { setPin(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                style={{ ...inp, textAlign: 'center', letterSpacing: 12, fontSize: 22 }} />
            </div>

            {error && (
              <div style={{ background: '#FFF0F0', border: '1px solid rgba(232,67,147,0.2)',
                borderRadius: 8, padding: '8px 12px', marginBottom: 16,
                fontSize: 12, color: '#E84393', textAlign: 'center', fontWeight: 600 }}>
                {error}
              </div>
            )}

            <button onClick={handleLogin} disabled={loading}
              style={{ width: '100%', padding: 14, borderRadius: 12,
                background: loading ? '#ccc' : 'linear-gradient(135deg,#FF6B35,#E84393)',
                border: 'none', color: '#fff', fontSize: 15, fontWeight: 700,
                cursor: loading ? 'wait' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 14px rgba(255,107,53,0.3)' }}>
              {loading ? '로그인 중...' : '로그인'}
            </button>

            <div style={{ fontSize: 11, color: '#bbb', textAlign: 'center', marginTop: 12 }}>
              초기 PIN: 1234
            </div>
          </div>
        )}
      </div>
    </div>
  )
}