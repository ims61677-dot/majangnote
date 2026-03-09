'use client'
import { useEffect, useState, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }

const ISSUE_TYPES: Record<string, string> = {
  wrong_quantity: '수량 오류',
  wrong_item: '품목 오류',
  other_branch: '타지점 물품',
  other: '기타',
}

// ─── 발주처 관리 모달 ───
function SupplierModal({ storeId, onClose }: { storeId: string; onClose: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [newName, setNewName] = useState('')
  const [newMemo, setNewMemo] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editMemo, setEditMemo] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('order_suppliers').select('*').eq('store_id', storeId).order('created_at')
    setSuppliers(data || [])
  }
  async function handleAdd() {
    if (!newName.trim()) return
    await supabase.from('order_suppliers').insert({ store_id: storeId, name: newName.trim(), memo: newMemo.trim() || null })
    setNewName(''); setNewMemo(''); load()
  }
  async function handleUpdate(id: string) {
    await supabase.from('order_suppliers').update({ name: editName, memo: editMemo || null }).eq('id', id)
    setEditId(null); load()
  }
  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" 발주처를 삭제할까요?`)) return
    await supabase.from('order_suppliers').delete().eq('id', id)
    load()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>🏪 발주처 관리</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>

        {/* 추가 폼 */}
        <div style={{ border: '2px dashed rgba(255,107,53,0.3)', borderRadius: 14, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#FF6B35', marginBottom: 10 }}>새 발주처 추가</div>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="발주처 이름 (예: 해산물 업체)" style={{ ...inp, marginBottom: 8 }} />
          <input value={newMemo} onChange={e => setNewMemo(e.target.value)} placeholder="메모 (선택)" style={{ ...inp, marginBottom: 10 }} />
          <button onClick={handleAdd} style={{ width: '100%', padding: '9px 0', borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>추가</button>
        </div>

        {/* 목록 */}
        {suppliers.map(s => (
          editId === s.id ? (
            <div key={s.id} style={{ background: 'rgba(255,107,53,0.05)', borderRadius: 12, padding: 12, marginBottom: 8, border: '1px solid rgba(255,107,53,0.2)' }}>
              <input value={editName} onChange={e => setEditName(e.target.value)} style={{ ...inp, marginBottom: 8 }} />
              <input value={editMemo} onChange={e => setEditMemo(e.target.value)} placeholder="메모" style={{ ...inp, marginBottom: 10 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => handleUpdate(s.id)} style={{ flex: 1, padding: '7px 0', borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>저장</button>
                <button onClick={() => setEditId(null)} style={{ padding: '7px 14px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer', fontSize: 12 }}>취소</button>
              </div>
            </div>
          ) : (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8F9FB', borderRadius: 12, padding: '10px 14px', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{s.name}</div>
                {s.memo && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{s.memo}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setEditId(s.id); setEditName(s.name); setEditMemo(s.memo || '') }} style={{ background: 'none', border: 'none', fontSize: 11, color: '#aaa', cursor: 'pointer' }}>수정</button>
                <button onClick={() => handleDelete(s.id, s.name)} style={{ background: 'none', border: 'none', fontSize: 11, color: '#E84393', cursor: 'pointer' }}>삭제</button>
              </div>
            </div>
          )
        ))}
        {suppliers.length === 0 && <div style={{ textAlign: 'center', padding: 24, color: '#bbb', fontSize: 13 }}>등록된 발주처가 없어요</div>}
      </div>
    </div>
  )
}

// ─── 발주 추가 모달 ───
function AddOrderModal({ storeId, userName, suppliers, inventoryItems, onClose, onSaved }: {
  storeId: string; userName: string; suppliers: any[]; inventoryItems: any[]
  onClose: () => void; onSaved: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState<number | ''>('')
  const [unit, setUnit] = useState('ea')
  const [supplierId, setSupplierId] = useState('')
  const [memo, setMemo] = useState('')
  const [linkedItemId, setLinkedItemId] = useState('')
  const [requestedAt, setRequestedAt] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])

  function handleItemNameChange(val: string) {
    setItemName(val)
    if (val.trim()) {
      const matched = inventoryItems.filter(i => i.name.includes(val.trim())).slice(0, 5)
      setSuggestions(matched)
    } else {
      setSuggestions([]); setLinkedItemId('')
    }
  }

  function selectInventoryItem(item: any) {
    setItemName(item.name)
    setUnit(item.unit || 'ea')
    setLinkedItemId(item.id)
    setSuggestions([])
  }

  async function handleSubmit() {
    if (!itemName.trim() || !quantity) return
    const supplier = suppliers.find(s => s.id === supplierId)
    await supabase.from('orders').insert({
      store_id: storeId,
      item_name: itemName.trim(),
      quantity: Number(quantity),
      unit,
      supplier_id: supplierId || null,
      supplier_name: supplier?.name || null,
      inventory_item_id: linkedItemId || null,
      memo: memo.trim() || null,
      requested_at: requestedAt ? new Date(requestedAt).toISOString() : null,
      ordered_by: userName,
      status: 'requested',
    })
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>📋 발주 추가</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>

        {/* 품목명 */}
        <div style={{ marginBottom: 10, position: 'relative' }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>품목명 <span style={{ color: '#E84393' }}>*</span></div>
          <input value={itemName} onChange={e => handleItemNameChange(e.target.value)} placeholder="품목명 입력 또는 재고에서 검색" style={inp} />
          {suggestions.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E8ECF0', borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, overflow: 'hidden' }}>
              {suggestions.map(s => (
                <div key={s.id} onClick={() => selectInventoryItem(s)}
                  style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 13, color: '#1a1a2e', borderBottom: '1px solid #F4F6F9', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(108,92,231,0.1)', color: '#6C5CE7' }}>재고연동</span>
                  {s.name}
                </div>
              ))}
            </div>
          )}
        </div>
        {linkedItemId && <div style={{ fontSize: 10, color: '#6C5CE7', marginBottom: 10, marginTop: -6 }}>✓ 재고 품목과 연동됨 — 수령 시 재고 자동 반영 가능</div>}

        {/* 수량 / 단위 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 2 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>수량 <span style={{ color: '#E84393' }}>*</span></div>
            <input type="number" value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>단위</div>
            <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inp, appearance: 'auto' as any }}>
              <option value="ea">ea</option>
              <option value="box">box</option>
              <option value="kg">kg</option>
              <option value="L">L</option>
              <option value="병">병</option>
            </select>
          </div>
        </div>

        {/* 발주처 */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>발주처</div>
          <select value={supplierId} onChange={e => setSupplierId(e.target.value)} style={{ ...inp, appearance: 'auto' as any }}>
            <option value="">선택 안함</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* 발주 요청 날짜 */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>발주 요청 날짜 (선택)</div>
          <input type="date" value={requestedAt} onChange={e => setRequestedAt(e.target.value)} style={inp} />
        </div>

        {/* 메모 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>메모</div>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="비고 메모" style={inp} />
        </div>

        <div style={{ fontSize: 11, color: '#aaa', marginBottom: 12 }}>작성자: <strong style={{ color: '#1a1a2e' }}>{userName}</strong></div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSubmit} style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>발주 등록</button>
          <button onClick={onClose} style={{ padding: '12px 16px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  )
}

// ─── 수령 처리 모달 ───
function ReceiveModal({ order, userName, onClose, onSaved }: { order: any; userName: string; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [recvQty, setRecvQty] = useState<number | ''>(order.quantity)
  const [applyInventory, setApplyInventory] = useState(!!order.inventory_item_id)
  const [memo, setMemo] = useState('')

  async function handleSubmit() {
    if (!recvQty) return
    // 수령 정보 저장
    const { data: receipt } = await supabase.from('order_receipts').insert({
      order_id: order.id,
      received_quantity: Number(recvQty),
      received_by: userName,
      inventory_applied: false,
    }).select().single()

    // 이력 저장 (최초 수령)
    if (receipt) {
      await supabase.from('order_receipt_logs').insert({
        receipt_id: receipt.id,
        order_id: order.id,
        changed_by: userName,
        field_name: '최초수령',
        before_value: null,
        after_value: `${recvQty}${order.unit}`,
        memo: memo || null,
      })
    }

    // 재고 반영
    if (applyInventory && order.inventory_item_id && receipt) {
      const { data: existing } = await supabase.from('inventory_stock')
        .select('quantity').eq('item_id', order.inventory_item_id).eq('place', '입고대기').single()
      const currentQty = existing?.quantity ?? 0
      await supabase.from('inventory_stock').upsert({
        item_id: order.inventory_item_id,
        place: '입고대기',
        quantity: currentQty + Number(recvQty),
        updated_by: userName,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'item_id,place' })
      await supabase.from('order_receipts').update({ inventory_applied: true, inventory_applied_at: new Date().toISOString(), inventory_applied_by: userName }).eq('id', receipt.id)
    }

    // 발주 상태 수령완료로 변경
    await supabase.from('orders').update({ status: 'received' }).eq('id', order.id)
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 210, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>📦 수령 처리</div>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>{order.item_name} · 발주수량 {order.quantity}{order.unit}</div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>실제 수령 수량</div>
          <input type="number" value={recvQty} onChange={e => setRecvQty(e.target.value === '' ? '' : Number(e.target.value))} style={inp} />
        </div>

        {order.inventory_item_id && (
          <div onClick={() => setApplyInventory(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: applyInventory ? 'rgba(108,92,231,0.08)' : '#F8F9FB', border: `1px solid ${applyInventory ? 'rgba(108,92,231,0.3)' : '#E8ECF0'}`, cursor: 'pointer', marginBottom: 10 }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, background: applyInventory ? '#6C5CE7' : '#E8ECF0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {applyInventory && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>재고에 자동 반영</div>
              <div style={{ fontSize: 10, color: '#aaa' }}>수령 수량이 재고(입고대기)에 합산돼요</div>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>메모 (선택)</div>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="특이사항 메모" style={inp} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSubmit} style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: 'linear-gradient(135deg,#00B894,#2DC6D6)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>수령 완료</button>
          <button onClick={onClose} style={{ padding: '12px 16px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  )
}

// ─── 수령 수정 모달 ───
function EditReceiptModal({ receipt, order, userName, onClose, onSaved }: { receipt: any; order: any; userName: string; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [newQty, setNewQty] = useState<number | ''>(receipt.received_quantity)
  const [memo, setMemo] = useState('')

  async function handleSubmit() {
    if (!newQty) return
    const before = receipt.received_quantity
    // 수령 수량 업데이트
    await supabase.from('order_receipts').update({ received_quantity: Number(newQty) }).eq('id', receipt.id)
    // 이력 기록
    await supabase.from('order_receipt_logs').insert({
      receipt_id: receipt.id,
      order_id: order.id,
      changed_by: userName,
      field_name: '수령수량수정',
      before_value: `${before}${order.unit}`,
      after_value: `${newQty}${order.unit}`,
      memo: memo || null,
    })
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 340 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>✏️ 수령 수정</div>
        <div style={{ fontSize: 11, color: '#aaa', marginBottom: 16 }}>기존 수령 수량: {receipt.received_quantity}{order.unit}</div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>수정 수량</div>
          <input type="number" value={newQty} onChange={e => setNewQty(e.target.value === '' ? '' : Number(e.target.value))} style={inp} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>수정 사유</div>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="예: 알보고니 2개 파손" style={inp} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSubmit} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>수정 저장</button>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  )
}

// ─── 이슈 신고 모달 ───
function IssueModal({ order, userName, onClose, onSaved }: { order: any; userName: string; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [issueType, setIssueType] = useState('wrong_quantity')
  const [memo, setMemo] = useState('')

  async function handleSubmit() {
    await supabase.from('order_issues').insert({
      order_id: order.id,
      store_id: order.store_id,
      issue_type: issueType,
      memo: memo.trim() || null,
      reported_by: userName,
    })
    await supabase.from('orders').update({ status: 'issue' }).eq('id', order.id)
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 340 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 16 }}>🚨 이슈 신고</div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>이슈 유형</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {Object.entries(ISSUE_TYPES).map(([k, v]) => (
            <button key={k} onClick={() => setIssueType(k)}
              style={{ padding: '10px 0', borderRadius: 10, border: issueType === k ? '2px solid #E84393' : '1px solid #E8ECF0', background: issueType === k ? 'rgba(232,67,147,0.08)' : '#F8F9FB', color: issueType === k ? '#E84393' : '#888', fontSize: 12, fontWeight: issueType === k ? 700 : 400, cursor: 'pointer' }}>
              {v}
            </button>
          ))}
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>상세 내용</div>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="상세 내용 입력" style={inp} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSubmit} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'linear-gradient(135deg,#E84393,#FF6B35)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>신고</button>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  )
}

// ─── 주문 확인 모달 ───
function ConfirmOrderModal({ order, userName, onClose, onSaved }: { order: any; userName: string; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [confirmedBy, setConfirmedBy] = useState(userName)
  const [memo, setMemo] = useState('')

  async function handleSubmit() {
    await supabase.from('orders').update({
      status: 'ordered',
      confirmed_by: confirmedBy.trim() || userName,
      confirmed_at: new Date().toISOString(),
      memo: memo.trim() ? (order.memo ? order.memo + ' / ' + memo.trim() : memo.trim()) : order.memo,
    }).eq('id', order.id)
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 340 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>✅ 주문 확인</div>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>{order.item_name} · {order.quantity}{order.unit}</div>
        <div style={{ background: '#F8F9FB', borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>📋 요청 정보</div>
          <div style={{ fontSize: 12, color: '#1a1a2e' }}>{order.ordered_by} · {new Date(order.ordered_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} {new Date(order.ordered_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
          {order.supplier_name && <div style={{ fontSize: 11, color: '#2DC6D6', marginTop: 2 }}>🏪 {order.supplier_name}</div>}
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>주문자 <span style={{ color: '#aaa', fontWeight: 400 }}>(직접 주문한 사람)</span></div>
          <input value={confirmedBy} onChange={e => setConfirmedBy(e.target.value)} placeholder="주문자 이름" style={inp} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>메모 (선택)</div>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="예: 네이버로 주문, 배송 3-4일" style={inp} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSubmit} style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: 'linear-gradient(135deg,#6C5CE7,#a29bfe)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>주문 완료 처리</button>
          <button onClick={onClose} style={{ padding: '12px 16px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  )
}

// ─── 반품/교환 모달 ───
function ReturnModal({ receipt, order, userName, onClose, onSaved }: { receipt: any; order: any; userName: string; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [returnType, setReturnType] = useState<'return' | 'exchange'>('return')
  const [memo, setMemo] = useState('')

  async function handleSubmit() {
    await supabase.from('order_receipts').update({
      return_type: returnType,
      return_memo: memo.trim() || null,
      return_by: userName,
      return_at: new Date().toISOString(),
    }).eq('id', receipt.id)
    await supabase.from('order_receipt_logs').insert({
      receipt_id: receipt.id,
      order_id: order.id,
      changed_by: userName,
      field_name: returnType === 'return' ? '반품처리' : '교환처리',
      before_value: null,
      after_value: memo || (returnType === 'return' ? '반품' : '교환'),
      memo: memo || null,
    })
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 340 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 16 }}>↩️ 반품 / 교환</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <button onClick={() => setReturnType('return')}
            style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: returnType === 'return' ? '2px solid #E84393' : '1px solid #E8ECF0', background: returnType === 'return' ? 'rgba(232,67,147,0.08)' : '#F8F9FB', color: returnType === 'return' ? '#E84393' : '#888', fontSize: 13, fontWeight: returnType === 'return' ? 700 : 400, cursor: 'pointer' }}>반품</button>
          <button onClick={() => setReturnType('exchange')}
            style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: returnType === 'exchange' ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: returnType === 'exchange' ? 'rgba(108,92,231,0.08)' : '#F8F9FB', color: returnType === 'exchange' ? '#6C5CE7' : '#888', fontSize: 13, fontWeight: returnType === 'exchange' ? 700 : 400, cursor: 'pointer' }}>교환</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>사유</div>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="사유 입력" style={inp} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSubmit} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'linear-gradient(135deg,#6C5CE7,#a29bfe)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>처리 완료</button>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  )
}

// ─── 발주 카드 상세 ───
function OrderCard({ order, userName, isEdit, onRefresh }: { order: any; userName: string; isEdit: boolean; onRefresh: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [expanded, setExpanded] = useState(false)
  const [receipt, setReceipt] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [showReceive, setShowReceive] = useState(false)
  const [showEditReceipt, setShowEditReceipt] = useState(false)
  const [showIssue, setShowIssue] = useState(false)
  const [showReturn, setShowReturn] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (expanded) loadDetail()
  }, [expanded])

  async function loadDetail() {
    const { data: r } = await supabase.from('order_receipts').select('*').eq('order_id', order.id).order('created_at').limit(1).single()
    setReceipt(r || null)
    const { data: l } = await supabase.from('order_receipt_logs').select('*').eq('order_id', order.id).order('changed_at', { ascending: false })
    setLogs(l || [])
  }

  const now = new Date()
  const orderedAt = new Date(order.ordered_at)
  const diffDays = (now.getTime() - orderedAt.getTime()) / (1000 * 60 * 60 * 24)
  const isOverdue = (order.status === 'requested' || order.status === 'ordered') && diffDays > 2

  const statusColor: Record<string, string> = {
    requested: '#FF6B35',
    ordered: '#6C5CE7',
    received: '#00B894',
    issue: '#E84393',
    pending: '#B8860B', // 구 데이터 호환
  }
  const statusLabel: Record<string, string> = {
    requested: '요청됨',
    ordered: '주문완료',
    received: '수령완료',
    issue: '이슈있음',
    pending: '미수령',
  }
  const statusBg: Record<string, string> = {
    requested: 'rgba(255,107,53,0.12)',
    ordered: 'rgba(108,92,231,0.12)',
    received: 'rgba(0,184,148,0.1)',
    issue: 'rgba(232,67,147,0.1)',
    pending: 'rgba(184,134,11,0.1)',
  }
  const borderColor = isOverdue ? '#E84393' : statusColor[order.status] || '#E8ECF0'

  return (
    <>
      {showReceive && <ReceiveModal order={order} userName={userName} onClose={() => setShowReceive(false)} onSaved={() => { onRefresh(); loadDetail() }} />}
      {showEditReceipt && receipt && <EditReceiptModal receipt={receipt} order={order} userName={userName} onClose={() => setShowEditReceipt(false)} onSaved={() => { loadDetail() }} />}
      {showIssue && <IssueModal order={order} userName={userName} onClose={() => setShowIssue(false)} onSaved={onRefresh} />}
      {showReturn && receipt && <ReturnModal receipt={receipt} order={order} userName={userName} onClose={() => setShowReturn(false)} onSaved={() => { loadDetail() }} />}
      {showConfirm && <ConfirmOrderModal order={order} userName={userName} onClose={() => setShowConfirm(false)} onSaved={onRefresh} />}

      <div style={{
        background: '#fff', borderRadius: 14, marginBottom: 8,
        border: `1px solid ${isOverdue ? 'rgba(232,67,147,0.4)' : '#E8ECF0'}`,
        overflow: 'hidden',
        borderLeft: `4px solid ${borderColor}`,
      }}>
        {/* 상단 요약 */}
        <div onClick={() => setExpanded(v => !v)} style={{ cursor: 'pointer', padding: '12px 14px 10px 14px' }}>
          {/* 1행: 품목명 + 상태뱃지 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', wordBreak: 'break-word' }}>{order.item_name}</span>
              {isOverdue && <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: '#E84393', color: '#fff', fontWeight: 700, flexShrink: 0, whiteSpace: 'nowrap' }}>🔴 {Math.floor(diffDays)}일</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
              <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: statusBg[order.status] || statusBg.pending, color: statusColor[order.status] || statusColor.pending, fontWeight: 700 }}>{statusLabel[order.status] || '미수령'}</span>
              <span style={{ fontSize: 11, color: '#ccc' }}>{expanded ? '▲' : '▼'}</span>
            </div>
          </div>
          {/* 2행: 수량 · 발주처 · 재고연동 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#555', background: '#F4F6F9', padding: '2px 8px', borderRadius: 5 }}>{order.quantity} {order.unit}</span>
            {order.supplier_name && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: 'rgba(45,198,214,0.1)', color: '#2DC6D6' }}>🏪 {order.supplier_name}</span>}
            {order.inventory_item_id && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 5, background: 'rgba(108,92,231,0.1)', color: '#6C5CE7' }}>재고연동</span>}
          </div>
          {/* 3행: 요청자 · 날짜 · (주문자 정보) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#aaa' }}>요청: {order.ordered_by}</span>
            <span style={{ fontSize: 10, color: '#ddd' }}>·</span>
            <span style={{ fontSize: 11, color: '#aaa' }}>{new Date(order.ordered_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} {new Date(order.ordered_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
            {(order.status === 'ordered' || order.status === 'received') && order.confirmed_by && (
              <span style={{ fontSize: 11, color: '#6C5CE7', marginLeft: 4 }}>· 주문: {order.confirmed_by}</span>
            )}
            {order.memo && <span style={{ fontSize: 10, color: '#bbb', marginLeft: 4 }}>📝 {order.memo}</span>}
          </div>
        </div>

        {/* 액션 버튼 — 3단계 워크플로우 */}
        {(order.status === 'requested') && (
          <div style={{ display: 'flex', borderTop: '1px solid #F0F2F5' }}>
            <button onClick={() => setShowConfirm(true)}
              style={{ flex: 1, padding: '10px 0', background: 'linear-gradient(135deg,#6C5CE7,#a29bfe)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderBottomLeftRadius: 10 }}>
              ✅ 주문 확인
            </button>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.3)' }} />
            <button onClick={() => setShowIssue(true)}
              style={{ width: 80, padding: '10px 0', background: 'rgba(232,67,147,0.08)', border: 'none', color: '#E84393', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderBottomRightRadius: 10 }}>
              🚨 이슈
            </button>
          </div>
        )}
        {(order.status === 'ordered' || order.status === 'pending') && (
          <div style={{ display: 'flex', borderTop: '1px solid #F0F2F5' }}>
            <button onClick={() => setShowReceive(true)}
              style={{ flex: 1, padding: '10px 0', background: 'linear-gradient(135deg,#00B894,#2DC6D6)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderBottomLeftRadius: 10 }}>
              📦 수령처리
            </button>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.3)' }} />
            <button onClick={() => setShowIssue(true)}
              style={{ width: 80, padding: '10px 0', background: 'rgba(232,67,147,0.08)', border: 'none', color: '#E84393', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderBottomRightRadius: 10 }}>
              🚨 이슈
            </button>
          </div>
        )}

        {/* 상세 펼치기 */}
        {expanded && (
          <div style={{ margin: '0 14px 14px 14px', paddingTop: 12, borderTop: '1px solid #F4F6F9' }}>
            {receipt ? (
              <div>
                {/* 수령 정보 */}
                <div style={{ background: 'rgba(0,184,148,0.06)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#00B894', marginBottom: 6 }}>📦 수령 정보</div>
                  <div style={{ fontSize: 12, color: '#1a1a2e' }}>수령 수량: <strong>{receipt.received_quantity}{order.unit}</strong></div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{receipt.received_by} · {new Date(receipt.received_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} {new Date(receipt.received_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                  {receipt.inventory_applied && <div style={{ fontSize: 10, color: '#6C5CE7', marginTop: 4 }}>✓ 재고 반영 완료 ({receipt.inventory_applied_by})</div>}
                  {receipt.return_type && (
                    <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 8, background: receipt.return_type === 'return' ? 'rgba(232,67,147,0.08)' : 'rgba(108,92,231,0.08)', border: `1px solid ${receipt.return_type === 'return' ? 'rgba(232,67,147,0.2)' : 'rgba(108,92,231,0.2)'}` }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: receipt.return_type === 'return' ? '#E84393' : '#6C5CE7' }}>{receipt.return_type === 'return' ? '↩️ 반품' : '🔄 교환'} 처리됨</div>
                      <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{receipt.return_by} · {new Date(receipt.return_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })}</div>
                      {receipt.return_memo && <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{receipt.return_memo}</div>}
                    </div>
                  )}
                  {/* 수령 완료 버튼들 */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <button onClick={() => setShowEditReceipt(true)} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.2)', color: '#FF6B35', fontSize: 10, cursor: 'pointer' }}>✏️ 수령 수정</button>
                    {!receipt.return_type && <button onClick={() => setShowReturn(true)} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.2)', color: '#6C5CE7', fontSize: 10, cursor: 'pointer' }}>↩️ 반품/교환</button>}
                    {!receipt.inventory_applied && order.inventory_item_id && (
                      <button onClick={async () => {
                        const { data: existing } = await supabase.from('inventory_stock').select('quantity').eq('item_id', order.inventory_item_id).eq('place', '입고대기').single()
                        const currentQty = existing?.quantity ?? 0
                        await supabase.from('inventory_stock').upsert({ item_id: order.inventory_item_id, place: '입고대기', quantity: currentQty + receipt.received_quantity, updated_by: userName, updated_at: new Date().toISOString() }, { onConflict: 'item_id,place' })
                        await supabase.from('order_receipts').update({ inventory_applied: true, inventory_applied_at: new Date().toISOString(), inventory_applied_by: userName }).eq('id', receipt.id)
                        loadDetail()
                      }} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.2)', color: '#6C5CE7', fontSize: 10, cursor: 'pointer' }}>📊 재고 반영</button>
                    )}
                  </div>
                </div>

                {/* 수령 이력 */}
                {logs.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', marginBottom: 6 }}>📋 수정 이력</div>
                    {logs.map(log => (
                      <div key={log.id} style={{ fontSize: 10, color: '#888', padding: '4px 0', borderBottom: '1px solid #F4F6F9', display: 'flex', justifyContent: 'space-between' }}>
                        <span><strong style={{ color: '#1a1a2e' }}>{log.changed_by}</strong> · {log.field_name} {log.before_value ? `${log.before_value} → ${log.after_value}` : log.after_value} {log.memo && `"${log.memo}"`}</span>
                        <span style={{ flexShrink: 0, marginLeft: 8 }}>{new Date(log.changed_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} {new Date(log.changed_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 12, color: '#bbb', fontSize: 12 }}>수령 정보 없음</div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── 통계 ───
function OrderStats({ storeId, year, month }: { storeId: string; year: number; month: number }) {
  const supabase = createSupabaseBrowserClient()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [year, month])

  async function load() {
    setLoading(true)
    const from = `${year}-${String(month).padStart(2, '0')}-01`
    const to = new Date(year, month, 1).toISOString().split('T')[0]
    const { data } = await supabase.from('orders').select('*, order_receipts(received_by, received_at)').eq('store_id', storeId).gte('ordered_at', from).lt('ordered_at', to).order('ordered_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  const bySupplier: Record<string, number> = {}
  const byPerson: Record<string, number> = {}
  const byReceiver: Record<string, number> = {}
  orders.forEach(o => {
    bySupplier[o.supplier_name || '미지정'] = (bySupplier[o.supplier_name || '미지정'] || 0) + 1
    byPerson[o.ordered_by] = (byPerson[o.ordered_by] || 0) + 1
    const r = o.order_receipts?.[0]
    if (r?.received_by) byReceiver[r.received_by] = (byReceiver[r.received_by] || 0) + 1
  })
  const received = orders.filter(o => o.status === 'received').length
  const pending = orders.filter(o => o.status === 'pending').length
  const issues = orders.filter(o => o.status === 'issue').length

  const card = { background: '#fff', borderRadius: 14, border: '1px solid #E8ECF0', padding: 14, marginBottom: 10 }

  return (
    <div>
      {loading ? <div style={{ textAlign: 'center', padding: 32, color: '#bbb' }}>불러오는 중...</div> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
            {[['총 발주', orders.length, '#1a1a2e'], ['수령완료', received, '#00B894'], ['미수령', pending, '#B8860B']].map(([l, v, c]) => (
              <div key={String(l)} style={{ ...card, marginBottom: 0, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#aaa', marginBottom: 4 }}>{l}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: String(c) }}>{v}</div>
              </div>
            ))}
          </div>
          {issues > 0 && <div style={{ ...card, background: 'rgba(232,67,147,0.05)', border: '1px solid rgba(232,67,147,0.2)', textAlign: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#E84393', fontWeight: 700 }}>🚨 이슈 {issues}건</div>
          </div>}

          {Object.keys(bySupplier).length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>🏪 발주처별</div>
              {Object.entries(bySupplier).sort((a, b) => b[1] - a[1]).map(([name, cnt]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #F4F6F9' }}>
                  <span style={{ fontSize: 12, color: '#1a1a2e' }}>{name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#2DC6D6' }}>{cnt}건</span>
                </div>
              ))}
            </div>
          )}
          {Object.keys(byPerson).length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>👤 발주자별</div>
              {Object.entries(byPerson).sort((a, b) => b[1] - a[1]).map(([name, cnt]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F4F6F9' }}>
                  <span style={{ fontSize: 12, color: '#1a1a2e' }}>{name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#FF6B35' }}>{cnt}건</span>
                </div>
              ))}
            </div>
          )}
          {Object.keys(byReceiver).length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>📦 수령자별</div>
              {Object.entries(byReceiver).sort((a, b) => b[1] - a[1]).map(([name, cnt]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F4F6F9' }}>
                  <span style={{ fontSize: 12, color: '#1a1a2e' }}>{name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#00B894' }}>{cnt}건</span>
                </div>
              ))}
            </div>
          )}
          {orders.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 13 }}>이 달 발주 내역이 없어요</div>}
        </>
      )}
    </div>
  )
}


// ═══════════════════════════════════════
// 메인 OrderTab
// ═══════════════════════════════════════
export default function OrderTab({ storeId, userName, isEdit, inventoryItems }: {
  storeId: string; userName: string; isEdit: boolean; inventoryItems: any[]
}) {
  const supabase = createSupabaseBrowserClient()
  const [orders, setOrders] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [subTab, setSubTab] = useState<'pending' | 'all' | 'issues' | 'stats'>('pending')
  const [showAddOrder, setShowAddOrder] = useState(false)
  const [showSupplierMgr, setShowSupplierMgr] = useState(false)
  const [loading, setLoading] = useState(true)
  const now = new Date()
  const [selYear, setSelYear] = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)

  useEffect(() => { if (storeId) { loadOrders(); loadSuppliers() } }, [storeId])

  async function loadOrders() {
    setLoading(true)
    const { data } = await supabase.from('orders').select('*').eq('store_id', storeId).order('ordered_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }
  async function loadSuppliers() {
    const { data } = await supabase.from('order_suppliers').select('*').eq('store_id', storeId).order('created_at')
    setSuppliers(data || [])
  }

  // 날짜 피커 팝업 상태
  const [showPicker, setShowPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(now.getFullYear())

  // 선택된 달 기준 필터 (전체/이슈/통계용)
  const filteredOrders = useMemo(() => orders.filter(o => {
    const d = new Date(o.ordered_at)
    return d.getFullYear() === selYear && d.getMonth() + 1 === selMonth
  }), [orders, selYear, selMonth])

  const pendingOrders = useMemo(() => orders.filter(o => o.status === 'pending' || o.status === 'requested' || o.status === 'ordered'), [orders])
  const overdueOrders = useMemo(() => pendingOrders.filter(o => {
    const diff = (now.getTime() - new Date(o.ordered_at).getTime()) / (1000 * 60 * 60 * 24)
    return diff > 2
  }), [pendingOrders])
  const issueOrders = useMemo(() => filteredOrders.filter(o => o.status === 'issue'), [filteredOrders])

  const tabBtn = (key: typeof subTab, label: string, badgeCnt?: number) => (
    <button onClick={() => setSubTab(key)} style={{
      flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11,
      fontWeight: subTab === key ? 700 : 400,
      background: subTab === key ? '#fff' : 'transparent',
      color: subTab === key ? '#1a1a2e' : '#aaa',
      boxShadow: subTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
      position: 'relative' as const,
    }}>
      {label}
      {badgeCnt !== undefined && badgeCnt > 0 && (
        <span style={{ marginLeft: 4, fontSize: 9, padding: '1px 5px', borderRadius: 8, background: '#E84393', color: '#fff', fontWeight: 700 }}>{badgeCnt}</span>
      )}
    </button>
  )

  return (
    <div>
      {showAddOrder && (
        <AddOrderModal
          storeId={storeId} userName={userName} suppliers={suppliers} inventoryItems={inventoryItems}
          onClose={() => setShowAddOrder(false)} onSaved={loadOrders}
        />
      )}
      {showSupplierMgr && <SupplierModal storeId={storeId} onClose={() => { setShowSupplierMgr(false); loadSuppliers() }} />}

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>📋 발주 관리</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {isEdit && <button onClick={() => setShowSupplierMgr(true)} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(45,198,214,0.1)', border: '1px solid rgba(45,198,214,0.3)', color: '#2DC6D6', fontSize: 11, cursor: 'pointer' }}>🏪 발주처</button>}
          <button onClick={() => setShowAddOrder(true)} style={{ padding: '6px 12px', borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ 발주 추가</button>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', background: '#F4F6F9', borderRadius: 10, padding: 3, marginBottom: 10, gap: 2 }}>
        {tabBtn('pending', `미수령 ${pendingOrders.length}`, overdueOrders.length)}
        {tabBtn('all', '전체 내역')}
        {tabBtn('issues', '이슈', issueOrders.length)}
        {tabBtn('stats', '📊 통계')}
      </div>

      {/* 년/월 팝업 피커 — 미수령 탭 제외 */}
      {subTab !== 'pending' && (
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => { setPickerYear(selYear); setShowPicker(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #E0E4E8', background: '#F8F9FB', color: '#1a1a2e', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%', justifyContent: 'center' }}
          >
            📅 {selYear}년 {selMonth}월 ▾
          </button>

          {showPicker && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
              onClick={() => setShowPicker(false)}>
              <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
                onClick={e => e.stopPropagation()}>

                {/* 연도 네비게이션 */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <button onClick={() => setPickerYear(y => y - 1)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E8ECF0', background: '#F4F6F9', cursor: 'pointer', fontSize: 16, color: '#888' }}>‹</button>
                  <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>{pickerYear}년</span>
                  <button onClick={() => setPickerYear(y => y + 1)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E8ECF0', background: '#F4F6F9', cursor: 'pointer', fontSize: 16, color: '#888' }}>›</button>
                </div>

                {/* 연도 빠른 선택 */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, justifyContent: 'center' }}>
                  {[pickerYear - 2, pickerYear - 1, pickerYear, pickerYear + 1, pickerYear + 2].map(y => (
                    <button key={y} onClick={() => setPickerYear(y)}
                      style={{ padding: '5px 8px', borderRadius: 8, border: y === pickerYear ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: y === pickerYear ? 'rgba(108,92,231,0.1)' : '#F4F6F9', color: y === pickerYear ? '#6C5CE7' : '#888', fontSize: 11, fontWeight: y === pickerYear ? 700 : 400, cursor: 'pointer' }}>
                      {y}
                    </button>
                  ))}
                </div>

                {/* 월 그리드 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                    const isSelected = pickerYear === selYear && m === selMonth
                    return (
                      <button key={m}
                        onClick={() => { setSelYear(pickerYear); setSelMonth(m); setShowPicker(false) }}
                        style={{ padding: '12px 0', borderRadius: 12, border: isSelected ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: isSelected ? 'linear-gradient(135deg,#6C5CE7,#a29bfe)' : '#F8F9FB', color: isSelected ? '#fff' : '#1a1a2e', fontSize: 14, fontWeight: isSelected ? 700 : 400, cursor: 'pointer' }}>
                        {m}월
                      </button>
                    )
                  })}
                </div>

                <button onClick={() => setShowPicker(false)}
                  style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: '1px solid #E8ECF0', background: '#F4F6F9', color: '#888', fontSize: 13, cursor: 'pointer' }}>
                  닫기
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 13 }}>불러오는 중...</div>
      ) : (
        <>
          {subTab === 'pending' && (
            <>
              {overdueOrders.length > 0 && (
                <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(232,67,147,0.08)', border: '1px solid rgba(232,67,147,0.2)', marginBottom: 12, fontSize: 11, color: '#E84393', fontWeight: 600 }}>
                  🔴 2일 이상 미수령 {overdueOrders.length}건 있어요!
                </div>
              )}
              {pendingOrders.length === 0
                ? <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>🎉 미수령 발주가 없어요!</div>
                : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 0 }}>
                    {pendingOrders.map(o => <OrderCard key={o.id} order={o} userName={userName} isEdit={isEdit} onRefresh={loadOrders} />)}
                  </div>
              }
            </>
          )}
          {subTab === 'all' && (
            filteredOrders.length === 0
              ? <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>{selYear}년 {selMonth}월 발주 내역이 없어요</div>
              : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 0 }}>
                  {filteredOrders.map(o => <OrderCard key={o.id} order={o} userName={userName} isEdit={isEdit} onRefresh={loadOrders} />)}
                </div>
          )}
          {subTab === 'issues' && (
            issueOrders.length === 0
              ? <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>{selYear}년 {selMonth}월 이슈 내역이 없어요</div>
              : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 0 }}>
                  {issueOrders.map(o => <OrderCard key={o.id} order={o} userName={userName} isEdit={isEdit} onRefresh={loadOrders} />)}
                </div>
          )}
          {subTab === 'stats' && <OrderStats storeId={storeId} year={selYear} month={selMonth} />}
        </>
      )}
    </div>
  )
}