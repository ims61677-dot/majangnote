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
    if (permission === 'granted') {
      subscribePush()
    }
  }, [permission])

  async function subscribePush() {
    try {
      const reg = await navigator.serviceWorker.ready
      let subscription = await reg.pushManager.getSubscription()

      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
      }

      const userStr = localStorage.getItem('mj_user')
      const storeStr = localStorage.getItem('mj_store')
      const user = userStr ? JSON.parse(userStr) : null
      const store = storeStr ? JSON.parse(storeStr) : null

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userId: user?.id || null,
          storeId: store?.id || null,
          // ✅ 추가된 부분
          role: user?.role || 'employee',
          userName: user?.name || user?.email || null,
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