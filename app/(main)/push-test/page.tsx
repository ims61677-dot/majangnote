'use client'
import { useState } from 'react'

export default function PushTestPage() {
  const [title, setTitle] = useState('매장노트')
  const [body, setBody] = useState('테스트 알림입니다!')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

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

        <div style={{ background: '#fff', borderRadius: 16, padding: 24,
          border: '1px solid #E8ECF0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>

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
              maxHeight: 300, overflow: 'auto',
            }}>
              {result}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}