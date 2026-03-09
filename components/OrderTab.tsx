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
    await supabase.from('orders').insert({
      store_id: storeId,
      item_name: itemName.trim(),
      quantity: Number(quantity),
      unit,
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

// ─── 이슈 해결 모달 ───
function ResolveIssueModal({ order, userName, onClose, onSaved }: { order: any; userName: string; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [resolveType, setResolveType] = useState<'return' | 'exchange' | 'both'>('exchange')
  const [resolvedBy, setResolvedBy] = useState(userName)
  const [recvQty, setRecvQty] = useState<number | ''>(order.quantity)
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  const options: { key: 'return' | 'exchange' | 'both'; label: string; desc: string; color: string }[] = [
    { key: 'exchange', label: '🔄 교환 수령', desc: '새 물건 받음 → 수령완료 처리', color: '#6C5CE7' },
    { key: 'return',   label: '↩️ 반품만',    desc: '물건 돌려보냄 → 반품완료 처리', color: '#E84393' },
    { key: 'both',     label: '↩️🔄 반품+교환', desc: '반품하고 새 물건도 받음', color: '#FF6B35' },
  ]

  async function handleSubmit() {
    if (!resolvedBy.trim()) return
    setSaving(true)
    const now = new Date().toISOString()

    if (resolveType === 'return') {
      // 반품만 → 상태: returned
      await supabase.from('orders').update({ status: 'returned' }).eq('id', order.id)
      await supabase.from('order_receipt_logs').insert({
        order_id: order.id,
        changed_by: resolvedBy.trim(),
        field_name: '반품 완료',
        before_value: '이슈있음',
        after_value: '반품완료',
        memo: memo.trim() || null,
      })
    } else if (resolveType === 'exchange') {
      // 교환 수령 → receipt 생성 + 상태: received
      const { data: receipt } = await supabase.from('order_receipts').insert({
        order_id: order.id,
        received_quantity: Number(recvQty) || order.quantity,
        received_by: resolvedBy.trim(),
        received_at: now,
        inventory_applied: false,
        memo: memo.trim() || null,
      }).select().single()
      await supabase.from('orders').update({ status: 'received' }).eq('id', order.id)
      await supabase.from('order_receipt_logs').insert({
        order_id: order.id,
        changed_by: resolvedBy.trim(),
        field_name: '교환 수령',
        before_value: '이슈있음',
        after_value: `교환품 ${recvQty}${order.unit} 수령완료`,
        memo: memo.trim() || null,
      })
    } else {
      // 반품+교환 → receipt 생성 + 상태: received + 반품 로그
      const { data: receipt } = await supabase.from('order_receipts').insert({
        order_id: order.id,
        received_quantity: Number(recvQty) || order.quantity,
        received_by: resolvedBy.trim(),
        received_at: now,
        inventory_applied: false,
        return_type: 'exchange',
        return_by: resolvedBy.trim(),
        return_at: now,
        return_memo: memo.trim() || null,
        memo: memo.trim() || null,
      }).select().single()
      await supabase.from('orders').update({ status: 'received' }).eq('id', order.id)
      await supabase.from('order_receipt_logs').insert([
        {
          order_id: order.id,
          changed_by: resolvedBy.trim(),
          field_name: '반품 처리',
          before_value: '이슈있음',
          after_value: '반품완료',
          memo: memo.trim() || null,
        },
        {
          order_id: order.id,
          changed_by: resolvedBy.trim(),
          field_name: '교환 수령',
          before_value: '반품완료',
          after_value: `교환품 ${recvQty}${order.unit} 수령완료`,
          memo: memo.trim() || null,
        },
      ])
    }

    setSaving(false)
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>✅ 이슈 해결</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: '#E84393', fontWeight: 600, marginBottom: 16, background: 'rgba(232,67,147,0.08)', borderRadius: 8, padding: '6px 10px' }}>
          🚨 {order.item_name} · {order.quantity}{order.unit}
        </div>

        {/* 해결 유형 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>해결 방법</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {options.map(o => (
              <button key={o.key} onClick={() => setResolveType(o.key)}
                style={{ padding: '10px 14px', borderRadius: 10, border: resolveType === o.key ? `2px solid ${o.color}` : '1px solid #E8ECF0', background: resolveType === o.key ? `rgba(${o.color === '#6C5CE7' ? '108,92,231' : o.color === '#E84393' ? '232,67,147' : '255,107,53'},0.08)` : '#F8F9FB', cursor: 'pointer', textAlign: 'left' as const }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: resolveType === o.key ? o.color : '#555' }}>{o.label}</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{o.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 교환 수령 수량 */}
        {(resolveType === 'exchange' || resolveType === 'both') && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>교환 수령 수량</div>
            <input type="number" value={recvQty} onChange={e => setRecvQty(e.target.value === '' ? '' : Number(e.target.value))} style={inp} />
          </div>
        )}

        {/* 처리자 */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>처리자 <span style={{ color: '#E84393' }}>*</span></div>
          <input value={resolvedBy} onChange={e => setResolvedBy(e.target.value)} placeholder="처리한 사람 이름" style={inp} />
        </div>

        {/* 메모 */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>메모 (선택)</div>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="처리 내용, 사유 등" style={inp} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSubmit} disabled={saving || !resolvedBy.trim()}
            style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: resolvedBy.trim() ? 'linear-gradient(135deg,#6C5CE7,#a29bfe)' : '#E8ECF0', border: 'none', color: resolvedBy.trim() ? '#fff' : '#bbb', fontSize: 13, fontWeight: 700, cursor: resolvedBy.trim() ? 'pointer' : 'default' }}>
            {saving ? '처리 중...' : '이슈 해결 완료'}
          </button>
          <button onClick={onClose} style={{ padding: '12px 16px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  )
}

// ─── 주문 확인 모달 ───
function ConfirmOrderModal({ order, userName, suppliers, onClose, onSaved }: { order: any; userName: string; suppliers: any[]; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [confirmedBy, setConfirmedBy] = useState(userName)
  const [supplierId, setSupplierId] = useState(order.supplier_id || '')
  const [supplierName, setSupplierName] = useState(order.supplier_name || '')
  const [memo, setMemo] = useState('')

  async function handleSubmit() {
    const selSupplier = suppliers.find(s => s.id === supplierId)
    const finalSupplierName = selSupplier?.name || supplierName.trim() || null
    await supabase.from('orders').update({
      status: 'ordered',
      confirmed_by: confirmedBy.trim() || userName,
      confirmed_at: new Date().toISOString(),
      supplier_id: supplierId || null,
      supplier_name: finalSupplierName,
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
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>주문자 <span style={{ color: '#aaa', fontWeight: 400 }}>(직접 주문한 사람)</span></div>
          <input value={confirmedBy} onChange={e => setConfirmedBy(e.target.value)} placeholder="주문자 이름" style={inp} />
        </div>
        {/* 발주처 - 주문자가 선택 */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>발주처 <span style={{ color: '#aaa', fontWeight: 400 }}>(주문한 곳)</span></div>
          {suppliers.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              <button onClick={() => { setSupplierId(''); setSupplierName('') }}
                style={{ padding: '4px 10px', borderRadius: 16, border: supplierId === '' && !supplierName ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: supplierId === '' && !supplierName ? 'rgba(108,92,231,0.1)' : '#F8F9FB', color: supplierId === '' && !supplierName ? '#6C5CE7' : '#888', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                미지정
              </button>
              {suppliers.map(s => (
                <button key={s.id} onClick={() => { setSupplierId(s.id); setSupplierName('') }}
                  style={{ padding: '4px 10px', borderRadius: 16, border: supplierId === s.id ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: supplierId === s.id ? 'rgba(108,92,231,0.1)' : '#F8F9FB', color: supplierId === s.id ? '#6C5CE7' : '#888', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
          <input value={supplierId ? '' : supplierName} onChange={e => { setSupplierName(e.target.value); setSupplierId('') }}
            placeholder="직접 입력 (예: 네이버, 쿠팡...)" style={{ ...inp, fontSize: 12 }} disabled={!!supplierId} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>메모 (선택)</div>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="예: 배송 3-4일 예정" style={inp} />
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

// ─── 빠른 발주 모달 ───
function QuickOrderModal({ storeId, userName, suppliers, inventoryItems, onClose, onSaved }: {
  storeId: string; userName: string; suppliers: any[]; inventoryItems: any[]
  onClose: () => void; onSaved: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  type QuickItem = { id: number; name: string; qty: number | ''; unit: string; suggestion: any[] }
  const newRow = (id: number): QuickItem => ({ id, name: '', qty: '', unit: 'ea', suggestion: [] })
  const [rows, setRows] = useState<QuickItem[]>([newRow(1), newRow(2), newRow(3)])
  const [supplierId, setSupplierId] = useState('')
  const [saving, setSaving] = useState(false)
  let nextId = rows.length + 1

  function updateRow(id: number, field: string, value: any) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
    if (field === 'name') {
      const matched = value.trim() ? inventoryItems.filter(i => i.name.includes(value.trim())).slice(0, 4) : []
      setRows(prev => prev.map(r => r.id === id ? { ...r, suggestion: matched } : r))
    }
  }
  function pickSuggestion(id: number, item: any) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, name: item.name, unit: item.unit || 'ea', suggestion: [] } : r))
  }
  function addRow() {
    setRows(prev => [...prev, newRow(++nextId)])
  }
  function removeRow(id: number) {
    if (rows.length <= 1) return
    setRows(prev => prev.filter(r => r.id !== id))
  }

  async function handleSubmit() {
    const validRows = rows.filter(r => r.name.trim() && r.qty !== '' && Number(r.qty) > 0)
    if (validRows.length === 0) return
    setSaving(true)
    const supplier = suppliers.find(s => s.id === supplierId)
    const now = new Date().toISOString()
    await Promise.all(validRows.map(r =>
      supabase.from('orders').insert({
        store_id: storeId,
        item_name: r.name.trim(),
        quantity: Number(r.qty),
        unit: r.unit,
        supplier_id: supplierId || null,
        supplier_name: supplier?.name || null,
        ordered_by: userName,
        ordered_at: now,
        status: 'requested',
      })
    ))
    setSaving(false)
    onSaved(); onClose()
  }

  const validCount = rows.filter(r => r.name.trim() && r.qty !== '' && Number(r.qty) > 0).length

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 520, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>⚡ 빠른 발주</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>품목과 수량만 입력하고 한번에 등록해요</div>

        {/* 발주처 선택 */}
        {suppliers.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>발주처 (전체 적용)</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setSupplierId('')}
                style={{ padding: '5px 12px', borderRadius: 20, border: supplierId === '' ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: supplierId === '' ? 'rgba(108,92,231,0.1)' : '#F8F9FB', color: supplierId === '' ? '#6C5CE7' : '#888', fontSize: 12, fontWeight: supplierId === '' ? 700 : 400, cursor: 'pointer' }}>
                미지정
              </button>
              {suppliers.map(s => (
                <button key={s.id} onClick={() => setSupplierId(s.id)}
                  style={{ padding: '5px 12px', borderRadius: 20, border: supplierId === s.id ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: supplierId === s.id ? 'rgba(108,92,231,0.1)' : '#F8F9FB', color: supplierId === s.id ? '#6C5CE7' : '#888', fontSize: 12, fontWeight: supplierId === s.id ? 700 : 400, cursor: 'pointer' }}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 품목 행 */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 55px 28px', gap: 6, marginBottom: 6, padding: '0 2px' }}>
            <span style={{ fontSize: 10, color: '#aaa' }}>품목명</span>
            <span style={{ fontSize: 10, color: '#aaa' }}>수량</span>
            <span style={{ fontSize: 10, color: '#aaa' }}>단위</span>
            <span />
          </div>
          {rows.map((row, idx) => (
            <div key={row.id} style={{ position: 'relative', marginBottom: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 55px 28px', gap: 6 }}>
                <input
                  value={row.name}
                  onChange={e => updateRow(row.id, 'name', e.target.value)}
                  placeholder={`품목 ${idx + 1}`}
                  style={{ ...inp, padding: '8px 10px' }}
                />
                <input
                  type="number"
                  value={row.qty}
                  onChange={e => updateRow(row.id, 'qty', e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  style={{ ...inp, padding: '8px 8px', textAlign: 'center' }}
                />
                <select value={row.unit} onChange={e => updateRow(row.id, 'unit', e.target.value)}
                  style={{ ...inp, padding: '8px 4px', appearance: 'auto' as any }}>
                  <option>ea</option><option>box</option><option>kg</option><option>L</option><option>병</option>
                </select>
                <button onClick={() => removeRow(row.id)}
                  style={{ width: 28, height: 36, borderRadius: 7, border: '1px solid #E8ECF0', background: '#F8F9FB', color: '#ccc', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ✕
                </button>
              </div>
              {row.suggestion.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 30, background: '#fff', border: '1px solid #E8ECF0', borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, overflow: 'hidden' }}>
                  {row.suggestion.map(s => (
                    <div key={s.id} onClick={() => pickSuggestion(row.id, s)}
                      style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: '#1a1a2e', borderBottom: '1px solid #F4F6F9', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(108,92,231,0.1)', color: '#6C5CE7' }}>재고</span>
                      {s.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <button onClick={addRow}
          style={{ width: '100%', padding: '9px 0', borderRadius: 10, border: '2px dashed #E0E4E8', background: '#F8F9FB', color: '#aaa', fontSize: 13, cursor: 'pointer', marginBottom: 16 }}>
          + 품목 추가
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSubmit} disabled={saving || validCount === 0}
            style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: validCount > 0 ? 'linear-gradient(135deg,#6C5CE7,#a29bfe)' : '#E8ECF0', border: 'none', color: validCount > 0 ? '#fff' : '#bbb', fontSize: 14, fontWeight: 700, cursor: validCount > 0 ? 'pointer' : 'default' }}>
            {saving ? '등록 중...' : `📋 ${validCount}건 발주 요청`}
          </button>
          <button onClick={onClose} style={{ padding: '12px 16px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  )
}

// ─── 발주 수정 모달 ───
function EditOrderModal({ order, userName, inventoryItems, onClose, onSaved }: { order: any; userName: string; inventoryItems: any[]; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [itemName, setItemName] = useState(order.item_name)
  const [quantity, setQuantity] = useState<number | ''>(order.quantity)
  const [unit, setUnit] = useState(order.unit || 'ea')
  const [memo, setMemo] = useState(order.memo || '')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  function handleItemNameChange(val: string) {
    setItemName(val)
    setSuggestions(val.trim() ? inventoryItems.filter(i => i.name.includes(val.trim())).slice(0, 4) : [])
  }

  async function handleSubmit() {
    if (!itemName.trim() || !quantity) return
    setSaving(true)

    // 변경된 필드만 로그 기록
    const changes: { field: string; before: string; after: string }[] = []
    if (itemName.trim() !== order.item_name) changes.push({ field: '품목명', before: order.item_name, after: itemName.trim() })
    if (Number(quantity) !== order.quantity) changes.push({ field: '수량', before: `${order.quantity}${order.unit}`, after: `${quantity}${unit}` })
    else if (unit !== order.unit) changes.push({ field: '단위', before: order.unit, after: unit })
    if ((memo.trim() || null) !== (order.memo || null)) changes.push({ field: '메모', before: order.memo || '없음', after: memo.trim() || '없음' })

    await supabase.from('orders').update({
      item_name: itemName.trim(),
      quantity: Number(quantity),
      unit,
      memo: memo.trim() || null,
    }).eq('id', order.id)

    // 로그 저장
    if (changes.length > 0) {
      await Promise.all(changes.map(c =>
        supabase.from('order_receipt_logs').insert({
          order_id: order.id,
          changed_by: userName,
          field_name: `${c.field} 수정`,
          before_value: c.before,
          after_value: c.after,
          memo: null,
        })
      ))
    }

    setSaving(false)
    onSaved(); onClose()
  }

  async function handleDelete() {
    if (!confirm(`"${order.item_name}" 발주를 삭제할까요?`)) return
    // 삭제 전 로그 남기기
    await supabase.from('order_receipt_logs').insert({
      order_id: order.id,
      changed_by: userName,
      field_name: '발주 삭제',
      before_value: `${order.item_name} ${order.quantity}${order.unit}`,
      after_value: '삭제됨',
      memo: null,
    })
    await supabase.from('orders').delete().eq('id', order.id)
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>✏️ 발주 수정</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>

        {/* 품목명 */}
        <div style={{ marginBottom: 10, position: 'relative' }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>품목명</div>
          <input value={itemName} onChange={e => handleItemNameChange(e.target.value)} style={inp} />
          {suggestions.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E8ECF0', borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, overflow: 'hidden' }}>
              {suggestions.map(s => (
                <div key={s.id} onClick={() => { setItemName(s.name); setUnit(s.unit || 'ea'); setSuggestions([]) }}
                  style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 13, color: '#1a1a2e', borderBottom: '1px solid #F4F6F9' }}>
                  {s.name}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 수량 / 단위 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 2 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>수량</div>
            <input type="number" value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))} style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>단위</div>
            <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inp, appearance: 'auto' as any }}>
              <option>ea</option><option>box</option><option>kg</option><option>L</option><option>병</option>
            </select>
          </div>
        </div>

        {/* 메모 */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>메모</div>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="비고 메모" style={inp} />
        </div>

        {/* 주문완료 상태면 요청됨으로 되돌리기 버튼 표시 */}
        {order.status === 'ordered' && (
          <div style={{ marginBottom: 12 }}>
            <button onClick={async () => {
              if (!confirm('주문 확인을 취소하고 요청됨 상태로 되돌릴까요?')) return
              await supabase.from('orders').update({
                status: 'requested',
                confirmed_by: null,
                confirmed_at: null,
              }).eq('id', order.id)
              await supabase.from('order_receipt_logs').insert({
                order_id: order.id,
                changed_by: userName,
                field_name: '주문 취소',
                before_value: `주문완료 (${order.confirmed_by})`,
                after_value: '요청됨으로 되돌림',
                memo: null,
              })
              onSaved(); onClose()
            }} style={{ width: '100%', padding: '10px 0', borderRadius: 10, background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.25)', color: '#FF6B35', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ↩️ 주문 확인 취소 (요청됨으로 되돌리기)
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleDelete}
            style={{ padding: '11px 14px', borderRadius: 10, background: 'rgba(232,67,147,0.08)', border: '1px solid rgba(232,67,147,0.2)', color: '#E84393', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            🗑 삭제
          </button>
          <button onClick={handleSubmit} disabled={saving}
            style={{ flex: 1, padding: '11px 0', borderRadius: 10, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? '저장 중...' : '수정 완료'}
          </button>
          <button onClick={onClose}
            style={{ padding: '11px 14px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── 발주 카드 상세 ───
function OrderCard({ order, userName, isEdit, suppliers, inventoryItems, onRefresh }: { order: any; userName: string; isEdit: boolean; suppliers: any[]; inventoryItems: any[]; onRefresh: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [expanded, setExpanded] = useState(false)
  const [receipt, setReceipt] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [showReceive, setShowReceive] = useState(false)
  const [showEditReceipt, setShowEditReceipt] = useState(false)
  const [showIssue, setShowIssue] = useState(false)
  const [showReturn, setShowReturn] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showResolve, setShowResolve] = useState(false)

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
    returned: '#888',
    pending: '#B8860B',
  }
  const statusLabel: Record<string, string> = {
    requested: '요청됨',
    ordered: '주문완료',
    received: '수령완료',
    issue: '이슈있음',
    returned: '반품완료',
    pending: '미수령',
  }
  const statusBg: Record<string, string> = {
    requested: 'rgba(255,107,53,0.12)',
    ordered: 'rgba(108,92,231,0.12)',
    received: 'rgba(0,184,148,0.1)',
    issue: 'rgba(232,67,147,0.1)',
    returned: 'rgba(136,136,136,0.1)',
    pending: 'rgba(184,134,11,0.1)',
  }
  const borderColor = isOverdue ? '#E84393' : statusColor[order.status] || '#E8ECF0'

  return (
    <>
      {showReceive && <ReceiveModal order={order} userName={userName} onClose={() => setShowReceive(false)} onSaved={() => { onRefresh(); loadDetail() }} />}
      {showEditReceipt && receipt && <EditReceiptModal receipt={receipt} order={order} userName={userName} onClose={() => setShowEditReceipt(false)} onSaved={() => { loadDetail() }} />}
      {showIssue && <IssueModal order={order} userName={userName} onClose={() => setShowIssue(false)} onSaved={onRefresh} />}
      {showReturn && receipt && <ReturnModal receipt={receipt} order={order} userName={userName} onClose={() => setShowReturn(false)} onSaved={() => { loadDetail() }} />}
      {showConfirm && <ConfirmOrderModal order={order} userName={userName} suppliers={suppliers} onClose={() => setShowConfirm(false)} onSaved={onRefresh} />}
      {showEdit && <EditOrderModal order={order} userName={userName} inventoryItems={inventoryItems} onClose={() => setShowEdit(false)} onSaved={onRefresh} />}
      {showResolve && <ResolveIssueModal order={order} userName={userName} onClose={() => setShowResolve(false)} onSaved={onRefresh} />}

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
              {(order.status === 'requested' || order.status === 'ordered') && (
                <button onClick={e => { e.stopPropagation(); setShowEdit(true) }}
                  style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, border: '1px solid #E0E4E8', background: '#F8F9FB', color: '#888', cursor: 'pointer' }}>
                  ✏️
                </button>
              )}
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
            {order.confirmed_at && (order.status === 'ordered' || order.status === 'received') && (
              <span style={{ fontSize: 10, color: '#a29bfe' }}>
                {new Date(order.confirmed_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} {new Date(order.confirmed_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>
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
        {order.status === 'issue' && (
          <div style={{ display: 'flex', borderTop: '1px solid #F0F2F5' }}>
            <button onClick={() => setShowResolve(true)}
              style={{ flex: 1, padding: '10px 0', background: 'linear-gradient(135deg,#6C5CE7,#a29bfe)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
              ✅ 이슈 해결
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
                        <span>
                          <strong style={{ color: log.field_name.includes('수정') ? '#FF6B35' : log.field_name.includes('삭제') ? '#E84393' : '#1a1a2e' }}>{log.changed_by}</strong>
                          {' · '}{log.field_name}
                          {log.before_value ? <span style={{ color: '#ccc' }}> {log.before_value} → <span style={{ color: '#1a1a2e' }}>{log.after_value}</span></span> : <span> {log.after_value}</span>}
                          {log.memo && <span style={{ color: '#bbb' }}> "{log.memo}"</span>}
                        </span>
                        <span style={{ flexShrink: 0, marginLeft: 8 }}>{new Date(log.changed_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} {new Date(log.changed_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 12, color: '#bbb', fontSize: 12 }}>수령 정보 없음</div>
            )}
            {/* 수령 없어도 이력은 표시 */}
            {!receipt && logs.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', marginBottom: 6 }}>📋 수정 이력</div>
                {logs.map(log => (
                  <div key={log.id} style={{ fontSize: 10, color: '#888', padding: '4px 0', borderBottom: '1px solid #F4F6F9', display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      <strong style={{ color: log.field_name.includes('수정') ? '#FF6B35' : log.field_name.includes('삭제') ? '#E84393' : '#1a1a2e' }}>{log.changed_by}</strong>
                      {' · '}{log.field_name}
                      {log.before_value ? <span style={{ color: '#ccc' }}> {log.before_value} → <span style={{ color: '#1a1a2e' }}>{log.after_value}</span></span> : <span> {log.after_value}</span>}
                    </span>
                    <span style={{ flexShrink: 0, marginLeft: 8 }}>{new Date(log.changed_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} {new Date(log.changed_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ─── 수정이력 탭 ───
function OrderHistoryTab({ storeId, year, month }: { storeId: string; year: number; month: number }) {
  const supabase = createSupabaseBrowserClient()
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadLogs() }, [year, month])

  async function loadLogs() {
    setLoading(true)
    const from = new Date(year, month - 1, 1).toISOString()
    const to = new Date(year, month, 1).toISOString()

    // 해당 월의 orders 먼저 가져오기
    const { data: monthOrders } = await supabase
      .from('orders')
      .select('id, item_name')
      .eq('store_id', storeId)
      .gte('ordered_at', from)
      .lt('ordered_at', to)

    if (!monthOrders || monthOrders.length === 0) { setLogs([]); setLoading(false); return }

    const orderIds = monthOrders.map(o => o.id)
    const orderMap = Object.fromEntries(monthOrders.map(o => [o.id, o.item_name]))

    const { data } = await supabase
      .from('order_receipt_logs')
      .select('*')
      .in('order_id', orderIds)
      .order('changed_at', { ascending: false })

    setLogs((data || []).map(l => ({ ...l, item_name: orderMap[l.order_id] || '(삭제된 품목)' })))
    setLoading(false)
  }

  const fieldColor: Record<string, string> = {
    '품목명 수정': '#FF6B35',
    '수량 수정': '#FF6B35',
    '단위 수정': '#FF6B35',
    '메모 수정': '#FF6B35',
    '발주 삭제': '#E84393',
    '주문 취소': '#6C5CE7',
    '최초수령': '#00B894',
    '수령수량수정': '#FF6B35',
    '반품처리': '#E84393',
    '교환처리': '#6C5CE7',
    '반품 완료': '#E84393',
    '교환 수령': '#6C5CE7',
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 13 }}>불러오는 중...</div>
  if (logs.length === 0) return <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>{year}년 {month}월 수정 이력이 없어요</div>

  return (
    <div>
      {logs.map(log => {
        const color = fieldColor[log.field_name] || '#888'
        return (
          <div key={log.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8ECF0', padding: '12px 14px', marginBottom: 8, borderLeft: `4px solid ${color}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* 품목명 */}
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>{log.item_name}</div>
                {/* 변경 내용 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: `rgba(${color === '#FF6B35' ? '255,107,53' : color === '#E84393' ? '232,67,147' : color === '#6C5CE7' ? '108,92,231' : '0,184,148'},0.1)`, color, fontWeight: 700 }}>
                    {log.field_name}
                  </span>
                  {log.before_value && (
                    <span style={{ fontSize: 11, color: '#aaa' }}>
                      <span style={{ textDecoration: 'line-through' }}>{log.before_value}</span>
                      <span style={{ margin: '0 4px', color: '#ddd' }}>→</span>
                      <span style={{ color: '#1a1a2e', fontWeight: 600 }}>{log.after_value}</span>
                    </span>
                  )}
                  {!log.before_value && log.after_value && (
                    <span style={{ fontSize: 11, color: '#555' }}>{log.after_value}</span>
                  )}
                </div>
                {/* 메모 */}
                {log.memo && <div style={{ fontSize: 10, color: '#bbb', marginTop: 4 }}>📝 {log.memo}</div>}
              </div>
              {/* 오른쪽: 처리자 + 시간 */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>{log.changed_by}</div>
                <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>
                  {new Date(log.changed_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} {new Date(log.changed_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
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
  const [subTab, setSubTab] = useState<'pending' | 'all' | 'issues' | 'history' | 'stats'>('pending')
  const [showAddOrder, setShowAddOrder] = useState(false)
  const [showQuickOrder, setShowQuickOrder] = useState(false)
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

  // 날짜별 그룹핑
  function groupByDate(list: any[]) {
    const map: Record<string, any[]> = {}
    list.forEach(o => {
      const d = new Date(o.ordered_at)
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      if (!map[key]) map[key] = []
      map[key].push(o)
    })
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]))
  }

  function DateGroupedList({ list }: { list: any[] }) {
    const groups = groupByDate(list)
    if (groups.length === 0) return null
    return (
      <>
        {groups.map(([dateKey, items]) => {
          const d = new Date(dateKey)
          const label = `${d.getMonth()+1}월 ${d.getDate()}일`
          const statusCounts = items.reduce((acc: any, o) => {
            acc[o.status] = (acc[o.status] || 0) + 1; return acc
          }, {})
          return (
            <div key={dateKey} style={{ marginBottom: 16 }}>
              {/* 날짜 헤더 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6C5CE7', background: 'rgba(108,92,231,0.1)', padding: '4px 10px', borderRadius: 20, flexShrink: 0 }}>
                  📅 {label}
                </div>
                <div style={{ flex: 1, height: 1, background: '#E8ECF0' }} />
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {statusCounts.requested > 0 && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(255,107,53,0.12)', color: '#FF6B35', fontWeight: 700 }}>요청 {statusCounts.requested}</span>}
                  {statusCounts.ordered > 0 && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(108,92,231,0.12)', color: '#6C5CE7', fontWeight: 700 }}>주문 {statusCounts.ordered}</span>}
                  {(statusCounts.pending||0) > 0 && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(184,134,11,0.12)', color: '#B8860B', fontWeight: 700 }}>미수령 {statusCounts.pending}</span>}
                  {statusCounts.received > 0 && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(0,184,148,0.1)', color: '#00B894', fontWeight: 700 }}>수령 {statusCounts.received}</span>}
                  {statusCounts.issue > 0 && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(232,67,147,0.1)', color: '#E84393', fontWeight: 700 }}>이슈 {statusCounts.issue}</span>}
                </div>
              </div>
              {/* 카드 그리드 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 0 }}>
                {items.map(o => <OrderCard key={o.id} order={o} userName={userName} isEdit={isEdit} suppliers={suppliers} inventoryItems={inventoryItems} onRefresh={loadOrders} />)}
              </div>
            </div>
          )
        })}
      </>
    )
  }

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
      {showQuickOrder && <QuickOrderModal storeId={storeId} userName={userName} suppliers={suppliers} inventoryItems={inventoryItems} onClose={() => setShowQuickOrder(false)} onSaved={loadOrders} />}

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>📋 발주 관리</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {isEdit && <button onClick={() => setShowSupplierMgr(true)} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(45,198,214,0.1)', border: '1px solid rgba(45,198,214,0.3)', color: '#2DC6D6', fontSize: 11, cursor: 'pointer' }}>🏪 발주처</button>}
          <button onClick={() => setShowQuickOrder(true)} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.3)', color: '#6C5CE7', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>⚡ 빠른발주</button>
          <button onClick={() => setShowAddOrder(true)} style={{ padding: '6px 12px', borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ 발주 추가</button>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', background: '#F4F6F9', borderRadius: 10, padding: 3, marginBottom: 10, gap: 2 }}>
        {tabBtn('pending', `미수령 ${pendingOrders.length}`, overdueOrders.length)}
        {tabBtn('all', '전체 내역')}
        {tabBtn('issues', '이슈', issueOrders.length)}
        {tabBtn('history', '수정이력')}
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
                : <DateGroupedList list={pendingOrders} />
              }
            </>
          )}
          {subTab === 'all' && (
            filteredOrders.length === 0
              ? <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>{selYear}년 {selMonth}월 발주 내역이 없어요</div>
              : <DateGroupedList list={filteredOrders} />
          )}
          {subTab === 'issues' && (
            issueOrders.length === 0
              ? <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>{selYear}년 {selMonth}월 이슈 내역이 없어요</div>
              : <DateGroupedList list={issueOrders} />
          )}
          {subTab === 'history' && <OrderHistoryTab storeId={storeId} year={selYear} month={selMonth} />}
          {subTab === 'stats' && <OrderStats storeId={storeId} year={selYear} month={selMonth} />}
        </>
      )}
    </div>
  )
}