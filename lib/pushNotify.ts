export async function sendPush(
  type: string,
  storeId: string,
  title: string,
  body: string,
  url?: string,
  excludeUserId?: string,
  targetRoles?: string | string[],
  targetUserName?: string
) {
  try {
    const roles = targetRoles ? (Array.isArray(targetRoles) ? targetRoles : [targetRoles]) : undefined
    await fetch('/api/push/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, storeId, title, body, url: url || '/login', excludeUserId, targetRoles: roles, targetUserName }),
    })
  } catch (e) {
    console.log('Push failed:', e)
  }
}
