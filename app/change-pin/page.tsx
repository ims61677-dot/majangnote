'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase'

// ─── 취약 PIN 검증 ────────────────────────────────────────
function validatePin(pin: string): string | null {
  if (!/^\d{4}$/.test(pin)) return '숫자 4자리를 입력해주세요'

  // 반복숫자 차단 (1111, 2222, 3333...)
  if (/^(\d)\1{3}$/.test(pin)) return '같은 숫자 반복은 사용할 수 없어요 (예: 1111)'

  // 연속숫자 차단 (1234, 2345, 3456... / 9876, 8765...)
  const digits = pin.split('').map(Number)
  const isAscending = digits.every((d, i) => i === 0 || d === digits[i - 1] + 1)
  const isDescending = digits.every((d, i) => i === 0 || d === digits[i - 1] - 1)
  if (isAscending) return '연속된 숫자는 사용할 수 없어요 (예: 1234)'
  if (isDescending) return '연속된 숫자는 사용할 수 없어요 (예: 9876)'

  return null // 통과
}

// ─── 강도 표시 ────────────────────────────────────────────
function PinStrength({ pin }: { pin: string }) {
  if (pin.length < 4) return null
  const error = validatePin(pin)
  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 3 }}>
        {[1,2,3].map(i => <div key={i} style={{ width: 28, height: 4, borderRadius: 2, background: '#E84393' }} />)}
      </div>
      <span style={{ fontSize: 11, color: '#E84393', fontWeight: 600 }}>취약</span>
    </div>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 3 }}>
        {[1,2,3].map(i => <div key={i} style={{ width: 28, height: 4, borderRadius: 2, background: '#00B894' }} />)}
      </div>
      <span style={{ fontSize: 11, color: '#00B894', fontWeight: 600 }}>안전</span>
    </div>
  )
}

export default function ChangePinPage() {
  const supabase = createSupabaseBrowserClient()
  const router = useRouter()

  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleChange() {
    setError('')

    // 유효성 검사
    const validErr = validatePin(newPin)
    if (validErr) { setError(validErr); return }
    if (newPin !== confirmPin) { setError('PIN이 일치하지 않아요'); return }

    // 현재 유저 정보
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!user.id) { router.push('/login'); return }

    // 기존 PIN이랑 같으면 차단
    if (user.pin === newPin) { setError('기존 PIN과 다른 번호로 설정해주세요'); return }

    setLoading(true)
    try {
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ pin: newPin })
        .eq('id', user.id)

      if (dbErr) throw dbErr

      // 로컬 유저 정보 업데이트
      const updatedUser = { ...user, pin: newPin }
      localStorage.setItem('mj_user', JSON.stringify(updatedUser))

      router.push('/select-store')
    } catch (e: any) {
      setError('저장 실패: ' + e?.message)
    } finally {
      setLoading(false)
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '14px', borderRadius: 12,
    border: '1px solid #E0E4E8', background: '#F8F9FB',
    color: '#1a1a2e', fontSize: 24, outline: 'none',
    textAlign: 'center', letterSpacing: 16,
    boxSizing: 'border-box', fontFamily: 'inherit'
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#F4F6F9'
    }}>
      <div style={{ width: '100%', maxWidth: 360, padding: '0 24px' }}>

        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 68, height: 68, borderRadius: 20, margin: '0 auto',
            background: 'linear-gradient(135deg,#FF6B35,#E84393)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 30, boxShadow: '0 8px 24px rgba(255,107,53,0.3)'
          }}>🔒</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e', marginTop: 14 }}>
            PIN 변경 필수
          </div>
          <div style={{ fontSize: 13, color: '#aaa', marginTop: 6, lineHeight: 1.6 }}>
            초기 PIN은 보안에 취약해요.<br />
            나만의 PIN으로 변경해주세요.
          </div>
        </div>

        {/* 폼 */}
        <div style={{
          background: '#fff', borderRadius: 20, padding: 28,
          border: '1px solid #E8ECF0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
        }}>

          {/* 조건 안내 */}
          <div style={{
            background: 'rgba(255,107,53,0.05)', border: '1px solid rgba(255,107,53,0.15)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 20
          }}>
            <div style={{ fontSize: 11, color: '#FF6B35', fontWeight: 700, marginBottom: 4 }}>PIN 설정 조건</div>
            <div style={{ fontSize: 11, color: '#888', lineHeight: 1.8 }}>
              ✓ 숫자 4자리<br />
              ✗ 연속숫자 불가 (1234, 9876 등)<br />
              ✗ 반복숫자 불가 (1111, 2222 등)<br />
              ✗ 기존 PIN과 동일 불가
            </div>
          </div>

          {/* 새 PIN */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 }}>새 PIN</div>
            <input
              type="password"
              placeholder="••••"
              maxLength={4}
              value={newPin}
              onChange={e => { setNewPin(e.target.value.replace(/\D/g, '')); setError('') }}
              style={inp}
            />
            <PinStrength pin={newPin} />
          </div>

          {/* PIN 확인 */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 }}>PIN 확인</div>
            <input
              type="password"
              placeholder="••••"
              maxLength={4}
              value={confirmPin}
              onChange={e => { setConfirmPin(e.target.value.replace(/\D/g, '')); setError('') }}
              onKeyDown={e => e.key === 'Enter' && handleChange()}
              style={{
                ...inp,
                borderColor: confirmPin.length === 4
                  ? confirmPin === newPin ? 'rgba(0,184,148,0.5)' : 'rgba(232,67,147,0.5)'
                  : '#E0E4E8'
              }}
            />
            {confirmPin.length === 4 && (
              <div style={{ fontSize: 11, marginTop: 6, color: confirmPin === newPin ? '#00B894' : '#E84393', fontWeight: 600 }}>
                {confirmPin === newPin ? '✓ 일치해요' : '✗ PIN이 일치하지 않아요'}
              </div>
            )}
          </div>

          {/* 에러 */}
          {error && (
            <div style={{
              background: '#FFF0F0', border: '1px solid rgba(232,67,147,0.2)',
              borderRadius: 8, padding: '8px 12px', marginBottom: 16,
              fontSize: 12, color: '#E84393', textAlign: 'center', fontWeight: 600
            }}>{error}</div>
          )}

          {/* 버튼 */}
          <button
            onClick={handleChange}
            disabled={loading || newPin.length < 4 || confirmPin.length < 4}
            style={{
              width: '100%', padding: 14, borderRadius: 12,
              background: (loading || newPin.length < 4 || confirmPin.length < 4)
                ? '#ddd'
                : 'linear-gradient(135deg,#FF6B35,#E84393)',
              border: 'none', color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: (loading || newPin.length < 4 || confirmPin.length < 4) ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 14px rgba(255,107,53,0.3)'
            }}
          >
            {loading ? '저장 중...' : 'PIN 변경하기'}
          </button>
        </div>
      </div>
    </div>
  )
}