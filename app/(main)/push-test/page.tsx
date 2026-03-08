'use client'
import { useState, useEffect } from 'react'

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export default function PushTestPage() {
  const [title, setTitle] = useState('매장노트')
  const [body, setBody] = useState('테스트 알림입니다!')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [subStatus, setSubStatus] = useState('확인 중...')

  useEffect(() => {
    checkSubscription()
  }, [])

  async function checkSubscription() {
    try {
      if (!('serviceWorker' in navigator)) {
        setSubStatus('Service Worker 미지원')
        return
      }
      if (!('Notification' in window)) {
        setSubStatus('알림 미지원')
        return
      }
      setSubStatus('알림 권한: ' + Notification.permission)
      
      if (Notification.permission === 'granted') {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          setSubStatus('구독 완료 ✅')
        } else {
          setSubStatus('구독 없음 - 아래 버튼으로 등록하세요')
        }
      }
    } catch (e) {
      setSubStatus('에러: ' + String(e))
    }
  }

  async function handleSubscribe() {
    try {
      setSubStatus('구독 등록 중...')
      
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setSubStatus('알림 거부됨')
        return
      }

      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
        })
      }

      const userStr = localStorage.getItem('mj_user')
      const user = userStr ? JSON.parse(userStr) : null

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          userId: user?.id || null,
        }),
      })
      const data = await res.json()
      setSubStatus('구독 저장 결과: ' + JSON.stringify(data))
    } catch (e) {
      setSubStatus('구독 에러: ' + String(e))
    }
  }

  async function sendTest() {
    setLoading(true)
    setResult('')
    try {
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, url: '/login' }),
      })
      const data = await res.json()
      setResult(JSON.stringify(data, null, 2))
    } catch (err) {
      setResult('전송 실패: ' + String(err))
    }
    setLoading(false)
  }

  const inp = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    border: '1px solid #E0E4E8', background: '#F8F9FB',
    color: '#1a1a2e', fontSize: 15, outline: 'none',
    boxSizing: 'border-box' as const, marginBottom: 12,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F4F6F9', padding: 24 }}>
      <div style={{ maxWidth: 400, margin: '0 auto' }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24, color: '#1a1a2e' }}>
          🔔 푸시 알림 테스트
        </h1>

        <div style={{ background: '#fff', borderRadius: 16, padding: 24, marginBottom: 16,
          border: '1px solid #E8ECF0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>1단계: 알림 구독</div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 12, wordBreak: 'break-all' }}>{subStatus}</div>
          <button onClick={handleSubscribe}
            style={{
              width: '100%', padding: 12, borderRadius: 10,
              background: '#333', border: 'none', color: '#fff',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
            알림 구독 등록
          </button>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, padding: 24,
          border: '1px solid #E8ECF0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>2단계: 알림 보내기</div>

          <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 }}>제목</div>
          <input value={title} onChange={e => setTitle(e.target.value)} style={inp} />

          <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 }}>내용</div>
          <input value={body} onChange={e => setBody(e.target.value)} style={inp} />

          <button onClick={sendTest} disabled={loading}
            style={{
              width: '100%', padding: 14, borderRadius: 12,
              background: loading ? '#ccc' : 'linear-gradient(135deg,#FF6B35,#E84393)',
              border: 'none', color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer', marginTop: 8,
            }}>
            {loading ? '전송 중...' : '테스트 알림 보내기'}
          </button>

          {result && (
            <pre style={{
              marginTop: 16, padding: '10px 14px', borderRadius: 8,
              background: '#f5f5f5', fontSize: 11, color: '#333',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            }}>
              {result}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}