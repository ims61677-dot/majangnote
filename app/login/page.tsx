'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase'

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient()
  const router = useRouter()
  const [nm, setNm] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    if (!nm.trim()) { setError('이름을 입력하세요'); return }
    if (!pin) { setError('PIN을 입력하세요'); return }
    setLoading(true); setError('')

    const { data: users } = await supabase
      .from('profiles').select('*').eq('nm', nm.trim()).limit(1)
    const user = users?.[0]

    if (!user) { setError('등록되지 않은 이름입니다'); setLoading(false); return }
    if (user.pin !== pin) { setError('PIN이 틀렸습니다'); setLoading(false); return }

    localStorage.setItem('mj_user', JSON.stringify(user))
    router.push('/select-store')
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
      <div style={{ width: '100%', maxWidth: 360, padding: '0 24px' }}>

        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ width: 68, height: 68, borderRadius: 20, margin: '0 auto',
            background: 'linear-gradient(135deg,#FF6B35,#E84393)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, fontWeight: 800, color: '#fff',
            boxShadow: '0 8px 24px rgba(255,107,53,0.3)' }}>M</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e', marginTop: 14 }}>매장노트</div>
          <div style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>매장 운영의 모든 것</div>
        </div>

        <div style={{ background: '#fff', borderRadius: 20, padding: 28,
          border: '1px solid #E8ECF0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>

          <div style={{ marginBottom: 16 }}>
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

          <div style={{ fontSize: 11, color: '#bbb', textAlign: 'center', marginTop: 14 }}>
            초기 PIN: 1234
          </div>
        </div>
      </div>
    </div>
  )
}