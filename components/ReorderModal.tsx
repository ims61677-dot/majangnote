'use client'
import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import { sendPush } from '@/lib/pushNotify'

const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

// 수령완료된 발주를 기반으로 새 발주 요청을 만드는 팝업 (직원/관리자 공용)
// 품목명·단위·발주처·재고연동은 그대로 가져오고, 가격·결산·이슈·수령 정보는 가져오지 않아요.
export default function ReorderModal({ order, userName, onClose, onSaved }: {
  order: any; userName: string; onClose: () => void; onSaved: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [qty, setQty] = useState<number | ''>(order.quantity ?? 1)
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (saving || !qty || Number(qty) <= 0) return
    setSaving(true)
    const { error } = await supabase.from('orders').insert({
      store_id: order.store_id,
      item_name: order.item_name,
      quantity: Number(qty),
      unit: order.unit,
      inventory_item_id: order.inventory_item_id || null,
      supplier_id: order.supplier_id || null,
      supplier_name: order.supplier_name || null,
      memo: memo.trim() || null,
      ordered_by: userName,
      ordered_at: new Date().toISOString(),
      status: 'requested',
    })
    setSaving(false)
    if (error) { alert('재주문 요청에 실패했어요: ' + error.message); return }
    sendPush('order', order.store_id, '📋 새 발주 요청', `${userName}님이 ${order.item_name} ${qty}${order.unit} 재주문을 요청했어요`, '/inventory?tab=order', undefined, ['owner', 'manager'])
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 380 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>🔁 재주문 요청</div>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>{order.item_name} · 이전 {order.quantity}{order.unit}{order.supplier_name ? ` · ${order.supplier_name}` : ''}</div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 2 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>수량</div>
            <input type="number" value={qty} onChange={e => setQty(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>단위</div>
            <div style={{ ...inp, background: '#F4F6F9', color: '#6C5CE7', fontWeight: 700 }}>{order.unit}</div>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>메모 (선택)</div>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="예: 급하게 필요해요" style={inp} />
        </div>

        <div style={{ fontSize: 10, color: '#aaa', marginBottom: 14 }}>※ 금액·결산·수령 정보는 가져오지 않고, 새 "요청됨" 발주로 등록돼요</div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSubmit} disabled={saving || !qty}
            style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: !qty ? '#E8ECF0' : 'linear-gradient(135deg,#FF6B35,#E84393)', color: !qty ? '#aaa' : '#fff', fontSize: 13, fontWeight: 700, cursor: saving || !qty ? 'default' : 'pointer' }}>
            {saving ? '요청 중...' : '재주문 요청'}
          </button>
          <button onClick={onClose} style={{ padding: '12px 16px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  )
}
