'use client'
import { useEffect, useState } from 'react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

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

export default function PushSetup() {
  const [permission, setPermission] = useState<string>('default')

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission)
    }
  }, [])

  useEffect(() => {
    // 이미 허용된 경우 자동 구독
    if (permission === 'granted') {
      subscribePush()
    }
  }, [permission])

  async function subscribePush() {
    try {
      const reg = await navigator.serviceWorker.ready
      
      // 기존 구독 확인
      let subscription = await reg.pushManager.getSubscription()
      
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
      }

      // 유저 정보 가져오기
      const userStr = localStorage.getItem('mj_user')
      const user = userStr ? JSON.parse(userStr) : null

      // 서버에 구독 정보 저장
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userId: user?.id || null,
        }),
      })
    } catch (err) {
      console.log('Push subscription failed:', err)
    }
  }

  async function requestPermission() {
    const result = await Notification.requestPermission()
    setPermission(result)
  }

  // 아직 허용 안 한 경우에만 버튼 표시
  if (permission !== 'default') return null

  return (
    <div
      onClick={requestPermission}
      style={{
        position: 'fixed',
        bottom: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'linear-gradient(135deg, #FF6B35, #E84393)',
        color: '#fff',
        padding: '12px 24px',
        borderRadius: 12,
        fontSize: 14,
        fontWeight: 700,
        cursor: 'pointer',
        boxShadow: '0 4px 14px rgba(255,107,53,0.4)',
        zIndex: 9999,
        whiteSpace: 'nowrap',
      }}
    >
      🔔 알림 허용하기
    </div>
  )
}