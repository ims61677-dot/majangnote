"use client"

export default function OfflinePage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'sans-serif',
      backgroundColor: '#000',
      color: '#fff',
      textAlign: 'center' as const,
      padding: '20px'
    }}>
      <div style={{ fontSize: '64px', marginBottom: '20px' }}>📡</div>
      <h1 style={{ fontSize: '24px', marginBottom: '12px' }}>오프라인 상태입니다</h1>
      <p style={{ fontSize: '16px', color: '#888' }}>
        인터넷 연결을 확인하고 다시 시도해주세요.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: '24px',
          padding: '12px 32px',
          fontSize: '16px',
          backgroundColor: '#333',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer'
        }}
      >
        다시 시도
      </button>
    </div>
  )
}