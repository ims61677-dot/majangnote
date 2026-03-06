'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const SESSION_KEY = 'mj_user'
const SESSION_EXPIRE_KEY = 'mj_user_expire'
const KEEP_DAYS = 30

export default function LoginPage() {
  const supabase = createSupabaseBrowserClient()
  const router = useRouter()
  const [nm, setNm] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [keepLogin, setKeepLogin] = useState(true)
  const [checking, setChecking] = useState(true)

  // 앱 열릴 때 저장된 세션 확인
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_KEY)
      const expire = localStorage.getItem(SESSION_EXPIRE_KEY)
      if (saved && expire && Date.now() < Number(expire)) {
        router.push('/select-store')
        return
      }
      // 만료됐으면 삭제
      localStorage.removeItem(SESSION_KEY)
      localStorage.removeItem(SESSION_EXPIRE_KEY)
    } catch (e) {}
    setChecking(false)
  }, [router])

  async function handleLogin() {
    if (!nm.trim()) { setError('이름을 입력하세요'); return }
    if (!pin) { setError('PIN을 입력하세요'); return }
    setLoading(true); setError('')

    const { data: users } = await supabase
      .from('profiles').select('*').eq('nm', nm.trim()).limit(1)
    const user = users?.[0]

    if (!user) { setError('등록되지 않은 이름입니다'); setLoading(false); return }
    if (user.pin !== pin) { setError('PIN이 틀렸습니다'); setLoading(false); return }

    localStorage.setItem(SESSION_KEY, JSON.stringify(user))

    if (keepLogin) {
      const expire = Date.now() + KEEP_DAYS * 24 * 60 * 60 * 1000
      localStorage.setItem(SESSION_EXPIRE_KEY, String(expire))
    } else {
      const expire = Date.now() + 24 * 60 * 60 * 1000
      localStorage.setItem(SESSION_EXPIRE_KEY, String(expire))
    }

    router.push('/select-store')
    setLoading(false)
  }

  // 세션 체크 중일 때 빈 화면
  if (checking) return <div style={{ minHeight: '100vh', background: '#F4F6F9' }} />

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

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 }}>PIN</div>
            <input type="password" placeholder="4자리" maxLength={4}
              value={pin} onChange={e => { setPin(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ ...inp, textAlign: 'center', letterSpacing: 12, fontSize: 22 }} />
          </div>

          <div
            onClick={() => setKeepLogin(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer', userSelect: 'none' }}>
            <div style={{
              width: 18, height: 18, borderRadius: 5,
              border: `2px solid ${keepLogin ? '#FF6B35' : '#D0D5DD'}`,
              background: keepLogin ? '#FF6B35' : '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'all 0.15s'
            }}>
              {keepLogin && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>✓</span>}
            </div>
            <span style={{ fontSize: 13, color: '#666', fontWeight: 500 }}>
              로그인 유지 ({KEEP_DAYS}일)
            </span>
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