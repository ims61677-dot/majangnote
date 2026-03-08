export async function sendPush(type: string, storeId: string, title: string, body: string, url?: string, excludeUserId?: string) {
  try {
    await fetch('/api/push/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, storeId, title, body, url: url || '/login', excludeUserId }),
    })
  } catch (e) {
    console.log('Push failed:', e)
  }
}
