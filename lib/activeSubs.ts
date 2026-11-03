// 퇴사/비활성 처리된 직원에게는 푸시가 가지 않도록, 지금 재직 중인(active) 사람의 구독만 남겨요.
// storeId가 있으면 그 매장 기준, 없으면 어느 매장이든 재직 중인지 기준으로 걸러요.
export async function filterActiveSubs(supabase: any, subs: any[], storeId?: string): Promise<any[]> {
  if (!subs || subs.length === 0) return subs || []
  try {
    let q = supabase.from('store_members').select('profile_id').eq('active', true)
    if (storeId) q = q.eq('store_id', storeId)
    const { data, error } = await q
    if (error || !data) return subs // 조회 실패 시 기존처럼 발송 (알림 누락 방지)
    const active = new Set(data.map((m: any) => m.profile_id))
    return subs.filter((s: any) => !s.profile_id || active.has(s.profile_id))
  } catch {
    return subs
  }
}
