'use client'
import { useEffect, useState, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

const STATUS_CONFIG: Record<string, { label: string; color: string; headerBg: string }> = {
  requested: { label: '📋 주문요청', color: '#FF6B35', headerBg: 'linear-gradient(135deg,#FF6B35,#ff9a6c)' },
  ordered:   { label: '✅ 주문완료', color: '#6C5CE7', headerBg: 'linear-gradient(135deg,#6C5CE7,#a29bfe)' },
  received:  { label: '📦 수령완료', color: '#00B894', headerBg: 'linear-gradient(135deg,#00B894,#2DC6D6)' },
  issue:     { label: '⚠️ 이슈있음', color: '#E84393', headerBg: 'linear-gradient(135deg,#E84393,#fd79a8)' },
  returned:  { label: '↩️ 반품완료', color: '#999',    headerBg: 'linear-gradient(135deg,#bbb,#ddd)' },
  pending:   { label: '⏳ 미수령',   color: '#B8860B', headerBg: 'linear-gradient(135deg,#B8860B,#e0a030)' },
}
const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }

const ISSUE_TYPES: Record<string, string> = {
  wrong_quantity: '수량 오류',
  wrong_item: '품목 오류',
  other_branch: '타지점 물품',
  other: '기타',
}

// ─── 기본 단위 (삭제 불가) ───
const DEFAULT_UNITS = ['ea', 'box', 'kg', 'L', '병']

// ─── 결제방법 ───
const DEFAULT_PAYMENT_METHODS = ['카드', '계좌이체', '현금', '어음', '기타']
const PAYMENT_COLORS: Record<string, string> = { '카드': '#6C5CE7', '현금': '#00B894', '계좌이체': '#2DC6D6', '어음': '#FF6B35', '기타': '#aaa' }

// ─── 단위 관리 모달 ───
function UnitManagerModal({ storeId, units, onClose, onUpdate }: {
  storeId: string; units: string[]; onClose: () => void; onUpdate: (u: string[]) => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [list, setList] = useState([...units])
  const [newUnit, setNewUnit] = useState('')

  async function save(newList: string[]) {
    setList(newList)
    onUpdate(newList)
    await supabase.from('store_settings').upsert(
      { store_id: storeId, key: 'custom_units', value: JSON.stringify(newList), updated_at: new Date().toISOString() },
      { onConflict: 'store_id,key' }
    )
  }

  function handleAdd() {
    const v = newUnit.trim()
    if (!v || list.includes(v)) return
    save([...list, v])
    setNewUnit('')
  }

  function handleDelete(u: string) {
    if (DEFAULT_UNITS.includes(u)) return
    save(list.filter(x => x !== u))
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 340 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>⚙️ 단위 관리</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>등록된 단위</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {list.map(u => (
            <div key={u} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 20, background: DEFAULT_UNITS.includes(u) ? 'rgba(108,92,231,0.08)' : 'rgba(255,107,53,0.08)', border: DEFAULT_UNITS.includes(u) ? '1px solid rgba(108,92,231,0.2)' : '1px solid rgba(255,107,53,0.2)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: DEFAULT_UNITS.includes(u) ? '#6C5CE7' : '#FF6B35' }}>{u}</span>
              {!DEFAULT_UNITS.includes(u) && (
                <button onClick={() => handleDelete(u)} style={{ background: 'none', border: 'none', color: '#E84393', cursor: 'pointer', fontSize: 11, padding: 0, lineHeight: 1, marginLeft: 2 }}>✕</button>
              )}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: '#bbb', marginBottom: 12 }}>💡 기본 단위(ea, box, kg, L, 병)는 삭제할 수 없어요</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input value={newUnit} onChange={e => setNewUnit(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            placeholder="새 단위 입력 (예: 봉, 팩, 개)"
            style={{ ...inp, flex: 1 }} />
          <button onClick={handleAdd} style={{ padding: '8px 14px', borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>추가</button>
        </div>
        <button onClick={onClose} style={{ width: '100%', padding: '10px 0', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 13, cursor: 'pointer' }}>완료</button>
      </div>
    </div>
  )
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
        <div style={{ border: '2px dashed rgba(255,107,53,0.3)', borderRadius: 14, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#FF6B35', marginBottom: 10 }}>새 발주처 추가</div>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="발주처 이름 (예: 해산물 업체)" style={{ ...inp, marginBottom: 8 }} />
          <input value={newMemo} onChange={e => setNewMemo(e.target.value)} placeholder="메모 (선택)" style={{ ...inp, marginBottom: 10 }} />
          <button onClick={handleAdd} style={{ width: '100%', padding: '9px 0', borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>추가</button>
        </div>
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
function AddOrderModal({ storeId, userName, suppliers, inventoryItems, units, onUnitsUpdate, onClose, onSaved }: {
  storeId: string; userName: string; suppliers: any[]; inventoryItems: any[]
  units: string[]; onUnitsUpdate: (u: string[]) => void
  onClose: () => void; onSaved: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState<number | ''>('')
  const [unit, setUnit] = useState(units[0] || 'ea')
  const [memo, setMemo] = useState('')
  const [linkedItemId, setLinkedItemId] = useState('')
  const [linkedUnit, setLinkedUnit] = useState(units[0] || 'ea')
  const [unlinkUnit, setUnlinkUnit] = useState(false)
  const [requestedAt, setRequestedAt] = useState('')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [showUnitMgr, setShowUnitMgr] = useState(false)

  function handleItemNameChange(val: string) {
    setItemName(val)
    if (val.trim()) {
      const matched = inventoryItems.filter(i => i.name.includes(val.trim())).slice(0, 5)
      setSuggestions(matched)
    } else {
      setSuggestions([]); setLinkedItemId(''); setUnlinkUnit(false)
    }
  }

  function selectInventoryItem(item: any) {
    setItemName(item.name)
    setUnit(item.unit || units[0] || 'ea')
    setLinkedUnit(item.unit || units[0] || 'ea')
    setLinkedItemId(item.id)
    setUnlinkUnit(false)
    setSuggestions([])
  }

  async function handleSubmit() {
    if (!itemName.trim() || !quantity) return
    await supabase.from('orders').insert({
      store_id: storeId,
      item_name: itemName.trim(),
      quantity: Number(quantity),
      unit,
      inventory_item_id: (linkedItemId && !unlinkUnit) ? linkedItemId : null,
      memo: memo.trim() || null,
      requested_at: requestedAt ? new Date(requestedAt).toISOString() : null,
      ordered_by: userName,
      status: 'requested',
    })
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      {showUnitMgr && (
        <UnitManagerModal
          storeId={storeId}
          units={units}
          onClose={() => setShowUnitMgr(false)}
          onUpdate={onUnitsUpdate}
        />
      )}
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
        {linkedItemId && !unlinkUnit && (
          <div style={{ fontSize: 10, color: '#6C5CE7', marginBottom: 10, marginTop: -6 }}>✓ 재고 품목과 연동됨 — 수령 시 재고 자동 반영 가능</div>
        )}
        {linkedItemId && unlinkUnit && (
          <div style={{ fontSize: 10, color: '#B8860B', marginBottom: 10, marginTop: -6 }}>⚠️ 연동 해제됨 — 수령해도 재고에 자동 반영되지 않아요</div>
        )}

        {/* 수량 / 단위 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <div style={{ flex: 2 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>수량 <span style={{ color: '#E84393' }}>*</span></div>
            <input type="number" value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 11, color: '#888' }}>단위</div>
              <button onClick={() => setShowUnitMgr(true)} style={{ fontSize: 10, color: '#6C5CE7', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>⚙️ 관리</button>
            </div>
            {linkedItemId && !unlinkUnit ? (
              <div style={{ ...inp, background: '#F4F6F9', color: '#6C5CE7', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                🔒 {unit}
              </div>
            ) : (
              <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inp, appearance: 'auto' as any }}>
                {units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* 연동 해제 체크박스 */}
        {linkedItemId && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={unlinkUnit} onChange={e => {
              setUnlinkUnit(e.target.checked)
              if (!e.target.checked) setUnit(linkedUnit)
            }} style={{ width: 14, height: 14, cursor: 'pointer', accentColor: '#B8860B' }} />
            <span style={{ fontSize: 11, color: unlinkUnit ? '#B8860B' : '#aaa', fontWeight: unlinkUnit ? 700 : 400 }}>
              연동이 풀려요 (다른 단위로 발주)
            </span>
          </label>
        )}

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
function ReceiveModal({ order, userName, places, onClose, onSaved }: { order: any; userName: string; places: any[]; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [step, setStep] = useState<'qty' | 'place'>('qty')
  const [recvQty, setRecvQty] = useState<number | ''>(order.quantity)
  const [selectedPlace, setSelectedPlace] = useState('')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().split('T')[0])
  const [assignedPlaces, setAssignedPlaces] = useState<string[]>([])

  const hasInventoryLink = !!order.inventory_item_id

  useEffect(() => {
    if (hasInventoryLink) {
      supabase.from('inventory_stock').select('place').eq('item_id', order.inventory_item_id)
        .then(({ data }) => setAssignedPlaces((data || []).map((r: any) => r.place)))
    }
  }, [])

  const filteredPlaces = hasInventoryLink && assignedPlaces.length > 0
    ? places.filter(p => assignedPlaces.includes(p.name))
    : places

  async function handleQtyNext() {
    if (!recvQty) return
    const qtyMismatch = Number(recvQty) !== Number(order.quantity)
    if (qtyMismatch) {
      const confirmMsg = `주문 수량(${order.quantity}${order.unit})과 실제 수령 수량(${recvQty}${order.unit})이 달라요.\n자동으로 이슈가 등록됩니다. 계속 진행할까요?`
      if (!confirm(confirmMsg)) return
      const sb = createSupabaseBrowserClient()
      await sb.from('order_issues').insert({
        order_id: order.id,
        store_id: order.store_id,
        issue_type: 'quantity_mismatch',
        memo: `수령 수량 불일치: 주문 ${order.quantity}${order.unit} → 실제 ${recvQty}${order.unit}`,
        reported_by: userName,
      })
      await sb.from('orders').update({ status: 'issue' }).eq('id', order.id)
      onSaved(); onClose(); return
    }
    if (hasInventoryLink) {
      setStep('place')
    } else {
      await doSave(null)
    }
  }

  async function doSave(place: string | null) {
    setSaving(true)
    const { data: receipt } = await supabase.from('order_receipts').insert({
      order_id: order.id,
      received_quantity: Number(recvQty),
      received_by: userName,
      inventory_applied: !!place,
      inventory_applied_at: place ? new Date().toISOString() : null,
      inventory_applied_by: place ? userName : null,
      inventory_place: place || null,
      memo: memo.trim() || null,
    }).select().single()

    if (receipt) {
      await supabase.from('order_receipt_logs').insert({
        receipt_id: receipt.id,
        order_id: order.id,
        changed_by: userName,
        field_name: '최초수령',
        before_value: null,
        after_value: place ? `${recvQty}${order.unit} → ${place}` : `${recvQty}${order.unit}`,
        memo: memo.trim() || null,
      })
    }

    if (place && order.inventory_item_id) {
      const { data: existing } = await supabase.from('inventory_stock')
        .select('quantity').eq('item_id', order.inventory_item_id).eq('place', place).single()
      const currentQty = existing?.quantity ?? 0
      await supabase.from('inventory_stock').upsert({
        item_id: order.inventory_item_id,
        place,
        quantity: currentQty + Number(recvQty),
        updated_by: userName,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'item_id,place' })
    }

    await supabase.from('orders').update({ status: 'received', received_by: userName, received_at: receivedAt ? new Date(receivedAt + 'T12:00:00').toISOString() : new Date().toISOString() }).eq('id', order.id)
    setSaving(false)
    onSaved(); onClose()
  }

  const placeGroups = filteredPlaces.reduce((acc: Record<string, any[]>, p) => {
    const g = p.group_name || '기타'
    if (!acc[g]) acc[g] = []
    acc[g].push(p)
    return acc
  }, {})

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 210, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '85vh', overflowY: 'auto' }}>

        {step === 'qty' && (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>📦 수령 처리</div>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>{order.item_name} · 발주수량 {order.quantity}{order.unit}</div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>실제 수령 수량</div>
              <input type="number" step="0.1" value={recvQty} onChange={e => setRecvQty(e.target.value === '' ? '' : Number(e.target.value))} style={inp} />
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>📅 수령 날짜 <span style={{ color: '#aaa', fontWeight: 400 }}>(까먹었을 때 수정 가능)</span></div>
              <input type="date" value={receivedAt} onChange={e => setReceivedAt(e.target.value)} style={inp} />
            </div>

            {hasInventoryLink && (
              <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(108,92,231,0.06)', border: '1px solid rgba(108,92,231,0.2)', marginBottom: 10, fontSize: 12, color: '#6C5CE7' }}>
                📦 재고 연동된 품목이에요 — 다음 단계에서 배치 장소를 선택해요
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>메모 (선택)</div>
              <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="특이사항 메모" style={inp} />
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleQtyNext} disabled={!recvQty}
                style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: recvQty ? 'linear-gradient(135deg,#00B894,#2DC6D6)' : '#E8ECF0', border: 'none', color: recvQty ? '#fff' : '#bbb', fontSize: 14, fontWeight: 700, cursor: recvQty ? 'pointer' : 'default' }}>
                {hasInventoryLink ? '다음 →' : '수령 완료'}
              </button>
              <button onClick={onClose} style={{ padding: '12px 16px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
            </div>
          </>
        )}

        {step === 'place' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <button onClick={() => setStep('qty')} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: 18, cursor: 'pointer', padding: 0 }}>←</button>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>📍 배치 장소 선택</span>
            </div>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>{order.item_name} {recvQty}{order.unit} — 어디에 넣을까요?</div>

            {Object.entries(placeGroups).map(([group, gPlaces]) => (
              <div key={group} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', marginBottom: 6 }}>{group}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 6 }}>
                  {gPlaces.map((p: any) => (
                    <button key={p.id} onClick={() => setSelectedPlace(p.name)}
                      style={{ padding: '10px 8px', borderRadius: 10, border: selectedPlace === p.name ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: selectedPlace === p.name ? 'rgba(108,92,231,0.1)' : '#F8F9FB', color: selectedPlace === p.name ? '#6C5CE7' : '#555', fontSize: 12, fontWeight: selectedPlace === p.name ? 700 : 400, cursor: 'pointer' }}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {filteredPlaces.length === 0 && (
              <div style={{ textAlign: 'center', padding: 24, color: '#bbb', fontSize: 12 }}>
                {hasInventoryLink ? <>재고에 배치된 장소가 없어요<br /><span style={{ fontSize: 11 }}>재고탭 → 장소별에서 먼저 배치해주세요</span></> : <>등록된 장소가 없어요<br /><span style={{ fontSize: 11 }}>재고 탭 → 장소 관리에서 추가해주세요</span></>}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => doSave(selectedPlace)} disabled={saving || !selectedPlace}
                style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: selectedPlace ? 'linear-gradient(135deg,#00B894,#2DC6D6)' : '#E8ECF0', border: 'none', color: selectedPlace ? '#fff' : '#bbb', fontSize: 14, fontWeight: 700, cursor: selectedPlace ? 'pointer' : 'default' }}>
                {saving ? '처리 중...' : `✅ ${selectedPlace || '장소 선택'} 배치 완료`}
              </button>
            </div>
          </>
        )}
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
    await supabase.from('order_receipts').update({ received_quantity: Number(newQty) }).eq('id', receipt.id)
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
  const [resolveType, setResolveType] = useState<'return' | 'exchange' | 'both' | 'additional' | 'other'>('exchange')
  const [resolvedBy, setResolvedBy] = useState(userName)
  const [recvQty, setRecvQty] = useState<number | ''>(order.quantity)
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  const options: { key: 'return' | 'exchange' | 'both' | 'additional' | 'other'; label: string; desc: string; color: string }[] = [
    { key: 'exchange',   label: '🔄 교환 수령',   desc: '새 물건 받음 → 수령완료 처리', color: '#6C5CE7' },
    { key: 'return',     label: '↩️ 반품만',       desc: '물건 돌려보냄 → 반품완료 처리', color: '#E84393' },
    { key: 'both',       label: '↩️🔄 반품+교환',  desc: '반품하고 새 물건도 받음', color: '#FF6B35' },
    { key: 'additional', label: '📦 추가 수령',    desc: '부족분 추가로 받음 → 수령완료 처리', color: '#00B894' },
    { key: 'other',      label: '📝 기타',          desc: '타지점 전달 등 기타 처리 → 수령완료', color: '#888' },
  ]

  async function handleSubmit() {
    if (!resolvedBy.trim()) return
    setSaving(true)
    const now = new Date().toISOString()

    if (resolveType === 'return') {
      await supabase.from('orders').update({ status: 'returned' }).eq('id', order.id)
      await supabase.from('order_receipt_logs').insert({
        order_id: order.id, changed_by: resolvedBy.trim(), field_name: '반품 완료', before_value: '이슈있음', after_value: '반품완료', memo: memo.trim() || null
      })
    } else if (resolveType === 'exchange') {
      const { data: receipt } = await supabase.from('order_receipts').insert({
        order_id: order.id, received_quantity: Number(recvQty) || order.quantity,
        received_by: resolvedBy.trim(), received_at: now, inventory_applied: false, memo: memo.trim() || null,
      }).select().single()
      await supabase.from('orders').update({ status: 'received', received_by: resolvedBy.trim(), received_at: now }).eq('id', order.id)
      await supabase.from('order_receipt_logs').insert({
        order_id: order.id, changed_by: resolvedBy.trim(), field_name: '교환 수령', before_value: '이슈있음', after_value: `교환품 ${recvQty}${order.unit} 수령완료`, memo: memo.trim() || null
      })
    } else if (resolveType === 'both') {
      await supabase.from('order_receipts').insert({
        order_id: order.id, received_quantity: Number(recvQty) || order.quantity,
        received_by: resolvedBy.trim(), received_at: now, inventory_applied: false,
        return_type: 'exchange', return_by: resolvedBy.trim(), return_at: now,
        return_memo: memo.trim() || null, memo: memo.trim() || null,
      })
      await supabase.from('orders').update({ status: 'received', received_by: resolvedBy.trim(), received_at: now }).eq('id', order.id)
      await supabase.from('order_receipt_logs').insert([
        { order_id: order.id, changed_by: resolvedBy.trim(), field_name: '반품 처리', before_value: '이슈있음', after_value: '반품완료', memo: memo.trim() || null },
        { order_id: order.id, changed_by: resolvedBy.trim(), field_name: '교환 수령', before_value: '반품완료', after_value: `교환품 ${recvQty}${order.unit} 수령완료`, memo: memo.trim() || null },
      ])
    } else if (resolveType === 'additional') {
      await supabase.from('order_receipts').insert({
        order_id: order.id, received_quantity: Number(recvQty) || order.quantity,
        received_by: resolvedBy.trim(), received_at: now, inventory_applied: false, memo: memo.trim() || null,
      })
      await supabase.from('orders').update({ status: 'received', received_by: resolvedBy.trim(), received_at: now }).eq('id', order.id)
      await supabase.from('order_receipt_logs').insert({
        order_id: order.id, changed_by: resolvedBy.trim(), field_name: '추가 수령',
        before_value: '이슈있음', after_value: `추가 ${recvQty}${order.unit} 수령완료`, memo: memo.trim() || null,
      })
    } else {
      await supabase.from('orders').update({ status: 'received', received_by: resolvedBy.trim(), received_at: now }).eq('id', order.id)
      await supabase.from('order_receipt_logs').insert({
        order_id: order.id, changed_by: resolvedBy.trim(), field_name: '기타 처리',
        before_value: '이슈있음', after_value: memo.trim() || '기타 처리 완료', memo: memo.trim() || null,
      })
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
        {(resolveType === 'exchange' || resolveType === 'both' || resolveType === 'additional') && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>교환 수령 수량</div>
            <input type="number" step="0.1" value={recvQty} onChange={e => setRecvQty(e.target.value === '' ? '' : Number(e.target.value))} style={inp} />
          </div>
        )}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>처리자 <span style={{ color: '#E84393' }}>*</span></div>
          <input value={resolvedBy} onChange={e => setResolvedBy(e.target.value)} placeholder="처리한 사람 이름" style={inp} />
        </div>
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

// ─── 직접 이슈 등록 모달 ───
function DirectIssueModal({ storeId, userName, units, onClose, onSaved }: { storeId: string; userName: string; units: string[]; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState<number | ''>(1)
  const [unit, setUnit] = useState(units[0] || 'ea')
  const [issueType, setIssueType] = useState('wrong_delivery')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  const issueOptions = [
    { key: 'wrong_delivery', label: '📦 잘못 온 물품', desc: '주문 안 했는데 도착' },
    { key: 'wrong_store',    label: '🏪 지점 오배송', desc: '다른 지점 것이 옴' },
    { key: 'damaged',        label: '💥 파손 도착',   desc: '파손 상태로 배송됨' },
    { key: 'other',          label: '📝 기타',         desc: '기타 이슈' },
  ]

  async function handleSubmit() {
    if (!itemName.trim() || !quantity) return
    setSaving(true)
    const { data: order } = await supabase.from('orders').insert({
      store_id: storeId,
      item_name: itemName.trim(),
      quantity: Number(quantity),
      unit,
      ordered_by: userName,
      ordered_at: new Date().toISOString(),
      status: 'issue',
      memo: memo.trim() || null,
    }).select().single()

    if (order) {
      await supabase.from('order_issues').insert({
        order_id: order.id, store_id: storeId, issue_type: issueType,
        memo: memo.trim() || null, reported_by: userName,
      })
      await supabase.from('order_receipt_logs').insert({
        order_id: order.id, changed_by: userName, field_name: '이슈 직접 등록',
        before_value: null, after_value: `${issueType}: ${itemName.trim()} ${quantity}${unit}`, memo: memo.trim() || null,
      })
    }
    setSaving(false)
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>🚨 이슈 직접 등록</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>이슈 유형</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {issueOptions.map(o => (
              <button key={o.key} onClick={() => setIssueType(o.key)}
                style={{ padding: '10px 8px', borderRadius: 10, border: issueType === o.key ? '2px solid #E84393' : '1px solid #E8ECF0', background: issueType === o.key ? 'rgba(232,67,147,0.08)' : '#F8F9FB', cursor: 'pointer', textAlign: 'left' as const }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: issueType === o.key ? '#E84393' : '#555' }}>{o.label}</div>
                <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{o.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>품목명 <span style={{ color: '#E84393' }}>*</span></div>
          <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="예: 루꼴라 1kg" style={inp} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 2 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>수량</div>
            <input type="number" step="0.1" value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))} style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>단위</div>
            <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inp, appearance: 'auto' as any }}>
              {units.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>메모 (선택)</div>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="예: 스타필드 물건인 듯" style={inp} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSubmit} disabled={saving || !itemName.trim() || !quantity}
            style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: itemName.trim() ? 'linear-gradient(135deg,#E84393,#FF6B35)' : '#E8ECF0', border: 'none', color: itemName.trim() ? '#fff' : '#bbb', fontSize: 13, fontWeight: 700, cursor: itemName.trim() ? 'pointer' : 'default' }}>
            {saving ? '등록 중...' : '🚨 이슈 등록'}
          </button>
          <button onClick={onClose} style={{ padding: '12px 16px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  )
}

// ─── 주문 확인 모달 ───
function ConfirmOrderModal({ order, userName, suppliers, units, onClose, onSaved }: { order: any; userName: string; suppliers: any[]; units: string[]; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [confirmedBy, setConfirmedBy] = useState(userName)
  const [supplierId, setSupplierId] = useState(order.supplier_id || '')
  const [supplierName, setSupplierName] = useState(order.supplier_name || '')
  const [memo, setMemo] = useState('')
  // ─── 결산 연동 필드 (선택) ───
  const [amount, setAmount] = useState<number | ''>('')
  const [unitPrice, setUnitPrice] = useState<number | ''>('')
  const [priceUnit, setPriceUnit] = useState(units[0] || 'ea')
  const [hasDelivery, setHasDelivery] = useState(false)
  const [deliveryFee, setDeliveryFee] = useState<number | ''>('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [showSettlement, setShowSettlement] = useState(false)

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
      // 결산 연동 (입력된 것만 저장)
      ...(amount !== '' ? { settlement_amount: Number(amount) } : {}),
      ...(unitPrice !== '' ? { settlement_unit_price: Number(unitPrice), price_unit: priceUnit } : {}),
      ...(hasDelivery && deliveryFee !== '' ? { delivery_fee: Number(deliveryFee) } : {}),
      ...(paymentMethod ? { payment_method: paymentMethod } : {}),
    }).eq('id', order.id)
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 380, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>✅ 주문 확인</div>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>{order.item_name} · {order.quantity}{order.unit}</div>
        <div style={{ background: '#F8F9FB', borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>📋 요청 정보</div>
          <div style={{ fontSize: 12, color: '#1a1a2e' }}>{order.ordered_by} · {new Date(order.ordered_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} {new Date(order.ordered_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
        </div>

        {/* 주문자 */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>주문자 <span style={{ color: '#aaa', fontWeight: 400 }}>(직접 주문한 사람)</span></div>
          <input value={confirmedBy} onChange={e => setConfirmedBy(e.target.value)} placeholder="주문자 이름" style={inp} />
        </div>

        {/* 발주처 */}
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

        {/* 메모 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>메모 (선택)</div>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="예: 배송 3-4일 예정" style={inp} />
        </div>

        {/* 결산 연동 토글 */}
        <button onClick={() => setShowSettlement(v => !v)}
          style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: `1px dashed ${showSettlement ? 'rgba(0,184,148,0.4)' : '#E0E4E8'}`, background: showSettlement ? 'rgba(0,184,148,0.04)' : 'transparent', color: showSettlement ? '#00B894' : '#aaa', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: showSettlement ? 12 : 16 }}>
          {showSettlement ? '▲ 결산 정보 닫기' : '💹 결산 정보 입력하기 (선택)'}
        </button>

        {/* 결산 연동 필드 */}
        {showSettlement && (
          <div style={{ background: 'rgba(0,184,148,0.04)', borderRadius: 14, border: '1px solid rgba(0,184,148,0.2)', padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#00B894', marginBottom: 12 }}>💹 결산 연동 정보 <span style={{ fontWeight: 400, color: '#aaa' }}>(미입력 시 결산에서 직접 입력)</span></div>

            {/* 구매 금액 */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>구매 금액</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="실제 결제 금액" style={inp} />
                <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>원</span>
              </div>
              {amount !== '' && Number(amount) > 0 && <div style={{ fontSize: 11, color: '#00B894', marginTop: 3, fontWeight: 600 }}>{Number(amount).toLocaleString()}원</div>}
            </div>

            {/* 단가 + 단위 */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>단가 (통계용)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
                <input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value === '' ? '' : Number(e.target.value))} placeholder="개당 가격" style={inp} />
                <select value={priceUnit} onChange={e => setPriceUnit(e.target.value)} style={{ ...inp, width: 'auto', minWidth: 70 }}>
                  {units.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            {/* 배송비 */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>배송비</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: hasDelivery ? 8 : 0 }}>
                <button onClick={() => setHasDelivery(false)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: !hasDelivery ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: !hasDelivery ? 'rgba(108,92,231,0.1)' : '#F8F9FB', color: !hasDelivery ? '#6C5CE7' : '#888', fontSize: 12, fontWeight: !hasDelivery ? 700 : 400, cursor: 'pointer' }}>없음</button>
                <button onClick={() => setHasDelivery(true)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: hasDelivery ? '2px solid #FF6B35' : '1px solid #E8ECF0', background: hasDelivery ? 'rgba(255,107,53,0.1)' : '#F8F9FB', color: hasDelivery ? '#FF6B35' : '#888', fontSize: 12, fontWeight: hasDelivery ? 700 : 400, cursor: 'pointer' }}>있음</button>
              </div>
              {hasDelivery && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value === '' ? '' : Number(e.target.value))} placeholder="배송비 금액" style={inp} />
                  <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>원</span>
                </div>
              )}
            </div>

            {/* 결제방법 */}
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>결제방법</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {DEFAULT_PAYMENT_METHODS.map(m => (
                  <button key={m} onClick={() => setPaymentMethod(paymentMethod === m ? '' : m)}
                    style={{ padding: '6px 12px', borderRadius: 8, border: paymentMethod === m ? `2px solid ${PAYMENT_COLORS[m] || '#6C5CE7'}` : '1px solid #E8ECF0', background: paymentMethod === m ? `${PAYMENT_COLORS[m] || '#6C5CE7'}18` : '#F8F9FB', color: paymentMethod === m ? PAYMENT_COLORS[m] || '#6C5CE7' : '#888', fontSize: 12, fontWeight: paymentMethod === m ? 700 : 400, cursor: 'pointer' }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

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
      return_type: returnType, return_memo: memo.trim() || null,
      return_by: userName, return_at: new Date().toISOString(),
    }).eq('id', receipt.id)
    await supabase.from('order_receipt_logs').insert({
      receipt_id: receipt.id, order_id: order.id, changed_by: userName,
      field_name: returnType === 'return' ? '반품처리' : '교환처리',
      before_value: null, after_value: memo || (returnType === 'return' ? '반품' : '교환'), memo: memo || null,
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
function QuickOrderModal({ storeId, userName, suppliers, inventoryItems, units, onClose, onSaved }: {
  storeId: string; userName: string; suppliers: any[]; inventoryItems: any[]
  units: string[]; onClose: () => void; onSaved: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  type QuickItem = { id: number; name: string; qty: number | ''; unit: string; suggestion: any[]; linkedItemId?: string; linkedUnit?: string; unlinkUnit?: boolean }
  const newRow = (id: number): QuickItem => ({ id, name: '', qty: '', unit: units[0] || 'ea', suggestion: [] })
  const [rows, setRows] = useState<QuickItem[]>([newRow(1), newRow(2), newRow(3)])
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
    setRows(prev => prev.map(r => r.id === id ? { ...r, name: item.name, unit: item.unit || units[0] || 'ea', linkedItemId: item.id, linkedUnit: item.unit || units[0] || 'ea', unlinkUnit: false, suggestion: [] } : r))
  }
  function addRow() { setRows(prev => [...prev, newRow(++nextId)]) }
  function removeRow(id: number) {
    if (rows.length <= 1) return
    setRows(prev => prev.filter(r => r.id !== id))
  }

  async function handleSubmit() {
    const validRows = rows.filter(r => r.name.trim() && r.qty !== '' && Number(r.qty) > 0)
    if (validRows.length === 0) return
    setSaving(true)
    const now = new Date().toISOString()
    await Promise.all(validRows.map(r =>
      supabase.from('orders').insert({
        store_id: storeId, item_name: r.name.trim(), quantity: Number(r.qty), unit: r.unit,
        ordered_by: userName, ordered_at: now, status: 'requested',
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
                <input value={row.name} onChange={e => updateRow(row.id, 'name', e.target.value)} placeholder={`품목 ${idx + 1}`} style={{ ...inp, padding: '8px 10px' }} />
                <input type="number" value={row.qty} onChange={e => updateRow(row.id, 'qty', e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" style={{ ...inp, padding: '8px 8px', textAlign: 'center' }} />
                {row.linkedItemId && !row.unlinkUnit ? (
                  <div style={{ ...inp, padding: '8px 4px', background: '#F4F6F9', color: '#6C5CE7', fontWeight: 700, fontSize: 11, textAlign: 'center' as const }}>
                    🔒{row.unit}
                  </div>
                ) : (
                  <select value={row.unit} onChange={e => updateRow(row.id, 'unit', e.target.value)} style={{ ...inp, padding: '8px 4px', appearance: 'auto' as any }}>
                    {units.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                )}
                <button onClick={() => removeRow(row.id)} style={{ width: 28, height: 36, borderRadius: 7, border: '1px solid #E8ECF0', background: '#F8F9FB', color: '#ccc', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
              {row.linkedItemId && (
                <div style={{ marginTop: 2, marginBottom: 2 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!row.unlinkUnit} onChange={e => {
                      const unlink = e.target.checked
                      setRows(prev => prev.map(r => r.id === row.id ? { ...r, unlinkUnit: unlink, unit: unlink ? r.unit : (r.linkedUnit || units[0] || 'ea') } : r))
                    }} style={{ width: 12, height: 12, cursor: 'pointer', accentColor: '#B8860B' }} />
                    <span style={{ fontSize: 10, color: row.unlinkUnit ? '#B8860B' : '#bbb', fontWeight: row.unlinkUnit ? 700 : 400 }}>연동이 풀려요 (다른 단위로 발주)</span>
                  </label>
                </div>
              )}
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

        <button onClick={addRow} style={{ width: '100%', padding: '9px 0', borderRadius: 10, border: '2px dashed #E0E4E8', background: '#F8F9FB', color: '#aaa', fontSize: 13, cursor: 'pointer', marginBottom: 16 }}>
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
function EditOrderModal({ order, userName, inventoryItems, units, onClose, onSaved }: { order: any; userName: string; inventoryItems: any[]; units: string[]; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [itemName, setItemName] = useState(order.item_name)
  const [quantity, setQuantity] = useState<number | ''>(order.quantity)
  const [unit, setUnit] = useState(order.unit || units[0] || 'ea')
  const [memo, setMemo] = useState(order.memo || '')
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  // ─── 결산 연동 필드 ───
  const [amount, setAmount] = useState<number | ''>(order.settlement_amount || '')
  const [unitPrice, setUnitPrice] = useState<number | ''>(order.settlement_unit_price || '')
  const [priceUnit, setPriceUnit] = useState(order.price_unit || units[0] || 'ea')
  const [hasDelivery, setHasDelivery] = useState(!!(order.delivery_fee && order.delivery_fee > 0))
  const [deliveryFee, setDeliveryFee] = useState<number | ''>(order.delivery_fee || '')
  const [paymentMethod, setPaymentMethod] = useState(order.payment_method || '')
  const [showSettlement, setShowSettlement] = useState(!!(order.settlement_amount || order.payment_method))

  function handleItemNameChange(val: string) {
    setItemName(val)
    setSuggestions(val.trim() ? inventoryItems.filter(i => i.name.includes(val.trim())).slice(0, 4) : [])
  }

  async function handleSubmit() {
    if (!itemName.trim() || !quantity) return
    setSaving(true)
    const changes: { field: string; before: string; after: string }[] = []
    if (itemName.trim() !== order.item_name) changes.push({ field: '품목명', before: order.item_name, after: itemName.trim() })
    if (Number(quantity) !== order.quantity) changes.push({ field: '수량', before: `${order.quantity}${order.unit}`, after: `${quantity}${unit}` })
    else if (unit !== order.unit) changes.push({ field: '단위', before: order.unit, after: unit })
    if ((memo.trim() || null) !== (order.memo || null)) changes.push({ field: '메모', before: order.memo || '없음', after: memo.trim() || '없음' })
    if (amount !== '' && Number(amount) !== (order.settlement_amount || 0)) changes.push({ field: '결산금액', before: order.settlement_amount ? `${order.settlement_amount}원` : '미입력', after: `${amount}원` })

    await supabase.from('orders').update({
      item_name: itemName.trim(), quantity: Number(quantity), unit, memo: memo.trim() || null,
      settlement_amount: amount !== '' ? Number(amount) : null,
      settlement_unit_price: unitPrice !== '' ? Number(unitPrice) : null,
      price_unit: unitPrice !== '' ? priceUnit : null,
      delivery_fee: hasDelivery && deliveryFee !== '' ? Number(deliveryFee) : null,
      payment_method: paymentMethod || null,
    }).eq('id', order.id)
    if (changes.length > 0) {
      await Promise.all(changes.map(c =>
        supabase.from('order_receipt_logs').insert({ order_id: order.id, changed_by: userName, field_name: `${c.field} 수정`, before_value: c.before, after_value: c.after, memo: null })
      ))
    }
    setSaving(false)
    onSaved(); onClose()
  }

  async function handleDelete() {
    if (!confirm(`"${order.item_name}" 발주를 삭제할까요?`)) return
    await supabase.from('order_receipt_logs').insert({ order_id: order.id, changed_by: userName, field_name: '발주 삭제', before_value: `${order.item_name} ${order.quantity}${order.unit}`, after_value: '삭제됨', memo: null })
    await supabase.from('orders').delete().eq('id', order.id)
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 360, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>✏️ 발주 수정</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ marginBottom: 10, position: 'relative' }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>품목명</div>
          <input value={itemName} onChange={e => handleItemNameChange(e.target.value)} style={inp} />
          {suggestions.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #E8ECF0', borderRadius: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, overflow: 'hidden' }}>
              {suggestions.map(s => (
                <div key={s.id} onClick={() => { setItemName(s.name); setUnit(s.unit || units[0] || 'ea'); setSuggestions([]) }}
                  style={{ padding: '9px 14px', cursor: 'pointer', fontSize: 13, color: '#1a1a2e', borderBottom: '1px solid #F4F6F9' }}>
                  {s.name}
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 2 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>수량</div>
            <input type="number" value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))} style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>단위</div>
            <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inp, appearance: 'auto' as any }}>
              {units.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>메모</div>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="비고 메모" style={inp} />
        </div>

        {/* 결산 정보 */}
        <button onClick={() => setShowSettlement(v => !v)}
          style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: `1px dashed ${showSettlement ? 'rgba(0,184,148,0.4)' : '#E0E4E8'}`, background: showSettlement ? 'rgba(0,184,148,0.04)' : 'transparent', color: showSettlement ? '#00B894' : '#aaa', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: showSettlement ? 12 : 16 }}>
          {showSettlement ? '▲ 결산 정보 닫기' : '💹 결산 정보 수정하기'}
        </button>
        {showSettlement && (
          <div style={{ background: 'rgba(0,184,148,0.04)', borderRadius: 14, border: '1px solid rgba(0,184,148,0.2)', padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#00B894', marginBottom: 12 }}>💹 결산 연동 정보</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>구매 금액</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="실제 결제 금액" style={inp} />
                <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>원</span>
              </div>
              {amount !== '' && Number(amount) > 0 && <div style={{ fontSize: 11, color: '#00B894', marginTop: 3, fontWeight: 600 }}>{Number(amount).toLocaleString()}원</div>}
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>단가 (통계용)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
                <input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value === '' ? '' : Number(e.target.value))} placeholder="개당 가격" style={inp} />
                <select value={priceUnit} onChange={e => setPriceUnit(e.target.value)} style={{ ...inp, width: 'auto', minWidth: 70 }}>
                  {units.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>배송비</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: hasDelivery ? 8 : 0 }}>
                <button onClick={() => setHasDelivery(false)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: !hasDelivery ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: !hasDelivery ? 'rgba(108,92,231,0.1)' : '#F8F9FB', color: !hasDelivery ? '#6C5CE7' : '#888', fontSize: 12, fontWeight: !hasDelivery ? 700 : 400, cursor: 'pointer' }}>없음</button>
                <button onClick={() => setHasDelivery(true)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: hasDelivery ? '2px solid #FF6B35' : '1px solid #E8ECF0', background: hasDelivery ? 'rgba(255,107,53,0.1)' : '#F8F9FB', color: hasDelivery ? '#FF6B35' : '#888', fontSize: 12, fontWeight: hasDelivery ? 700 : 400, cursor: 'pointer' }}>있음</button>
              </div>
              {hasDelivery && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value === '' ? '' : Number(e.target.value))} placeholder="배송비 금액" style={inp} />
                  <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>원</span>
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>결제방법</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {DEFAULT_PAYMENT_METHODS.map(m => (
                  <button key={m} onClick={() => setPaymentMethod(paymentMethod === m ? '' : m)}
                    style={{ padding: '6px 12px', borderRadius: 8, border: paymentMethod === m ? `2px solid ${PAYMENT_COLORS[m] || '#6C5CE7'}` : '1px solid #E8ECF0', background: paymentMethod === m ? `${PAYMENT_COLORS[m] || '#6C5CE7'}18` : '#F8F9FB', color: paymentMethod === m ? PAYMENT_COLORS[m] || '#6C5CE7' : '#888', fontSize: 12, fontWeight: paymentMethod === m ? 700 : 400, cursor: 'pointer' }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {order.status === 'ordered' && (
          <div style={{ marginBottom: 12 }}>
            <button onClick={async () => {
              if (!confirm('주문 확인을 취소하고 요청됨 상태로 되돌릴까요?')) return
              await supabase.from('orders').update({ status: 'requested', confirmed_by: null, confirmed_at: null }).eq('id', order.id)
              await supabase.from('order_receipt_logs').insert({ order_id: order.id, changed_by: userName, field_name: '주문 취소', before_value: `주문완료 (${order.confirmed_by})`, after_value: '요청됨으로 되돌림', memo: null })
              onSaved(); onClose()
            }} style={{ width: '100%', padding: '10px 0', borderRadius: 10, background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.25)', color: '#FF6B35', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ↩️ 주문 확인 취소 (요청됨으로 되돌리기)
            </button>
          </div>
        )}
        {order.status === 'received' && (
          <div style={{ marginBottom: 12 }}>
            <button onClick={async () => {
              if (!confirm("수령 완료를 취소하고 주문완료 상태로 되돌릴까요?\n(수령 정보가 삭제됩니다)")) return
              const { data: r } = await supabase.from("order_receipts").select("*").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1).maybeSingle()
              if (r?.inventory_place && order.inventory_item_id) {
                const { data: existing } = await supabase.from('inventory_stock').select('quantity').eq('item_id', order.inventory_item_id).eq('place', r.inventory_place).maybeSingle()
                const currentQty = existing?.quantity ?? 0
                const newQty = Math.max(0, currentQty - Number(r.received_quantity))
                await supabase.from('inventory_stock').update({ quantity: newQty, updated_by: userName, updated_at: new Date().toISOString() }).eq('item_id', order.inventory_item_id).eq('place', r.inventory_place)
              }
              await supabase.from("order_receipts").delete().eq("order_id", order.id)
              await supabase.from("orders").update({ status: "ordered", received_by: null, received_at: null }).eq("id", order.id)
              await supabase.from("order_receipt_logs").insert({ order_id: order.id, changed_by: userName, field_name: "수령 취소", before_value: r?.inventory_place ? `수령완료 (${r.inventory_place} 재고 반영됨)` : "수령완료", after_value: r?.inventory_place ? `주문완료로 되돌림 + ${r.inventory_place} 재고 차감` : "주문완료로 되돌림", memo: null })
              onSaved(); onClose()
            }} style={{ width: '100%', padding: '10px 0', borderRadius: 10, background: 'rgba(0,184,148,0.08)', border: '1px solid rgba(0,184,148,0.25)', color: '#00B894', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ↩️ 수령 취소 (주문완료로 되돌리기)
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleDelete} style={{ padding: '11px 14px', borderRadius: 10, background: 'rgba(232,67,147,0.08)', border: '1px solid rgba(232,67,147,0.2)', color: '#E84393', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>🗑 삭제</button>
          <button onClick={handleSubmit} disabled={saving} style={{ flex: 1, padding: '11px 0', borderRadius: 10, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saving ? '저장 중...' : '수정 완료'}</button>
          <button onClick={onClose} style={{ padding: '11px 14px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  )
}

// ─── 타임라인 아이템 ───
function TimelineItem({ color, icon, title, who, when, note }: {
  color: string; icon: string; title: string; who: string | null; when: string | null; note?: string
}) {
  return (
    <div style={{ position: 'relative', paddingLeft: 16, paddingBottom: 14 }}>
      <div style={{ position: 'absolute', left: -8, top: 2, width: 14, height: 14, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, zIndex: 1 }}>{icon}</div>
      <div style={{ background: '#F8F9FB', borderRadius: 8, padding: '8px 10px', border: `1px solid ${color}22` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>{title}</div>
        {(who || when) && (
          <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>
            {who && <span style={{ color: '#555', fontWeight: 600 }}>{who}</span>}
            {who && when && <span> · </span>}
            {when && <span>{new Date(when).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} {new Date(when).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>}
          </div>
        )}
        {note && <div style={{ fontSize: 10, color, marginTop: 3, fontWeight: 600 }}>{note}</div>}
      </div>
    </div>
  )
}

// ─── 발주 카드 상세 ───
function OrderCard({ order, userName, isEdit, suppliers, inventoryItems, units, places, highlighted, onRefresh }: { order: any; userName: string; isEdit: boolean; suppliers: any[]; inventoryItems: any[]; units: string[]; places: any[]; highlighted?: boolean; onRefresh: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [expanded, setExpanded] = useState(false)
  const [receipt, setReceipt] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [issueData, setIssueData] = useState<any>(null)
  const [showReceive, setShowReceive] = useState(false)
  const [showEditReceipt, setShowEditReceipt] = useState(false)
  const [showIssue, setShowIssue] = useState(false)
  const [showReturn, setShowReturn] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showResolve, setShowResolve] = useState(false)

  useEffect(() => { if (expanded) loadDetail() }, [expanded])
  useEffect(() => { if (order.status === 'received' && !receipt) loadReceipt() }, [])
  useEffect(() => { if (order.status === 'issue') loadIssueData() }, [])

  async function loadIssueData() {
    const { data: iss } = await supabase.from('order_issues').select('*').eq('order_id', order.id).order('reported_at', { ascending: false }).limit(1).maybeSingle()
    setIssueData(iss || null)
  }
  async function loadReceipt() {
    const { data: r } = await supabase.from('order_receipts').select('*').eq('order_id', order.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    setReceipt(r || null)
  }
  async function loadDetail() {
    const { data: r } = await supabase.from('order_receipts').select('*').eq('order_id', order.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    setReceipt(r || null)
    const { data: l } = await supabase.from('order_receipt_logs').select('*').eq('order_id', order.id).order('changed_at', { ascending: false })
    setLogs(l || [])
    const { data: iss } = await supabase.from('order_issues').select('*').eq('order_id', order.id).order('reported_at', { ascending: false }).limit(1).maybeSingle()
    setIssueData(iss || null)
  }

  const now = new Date()
  const orderedAt = new Date(order.ordered_at)
  const diffDays = (now.getTime() - orderedAt.getTime()) / (1000 * 60 * 60 * 24)
  const isOverdue = (order.status === 'requested' || order.status === 'ordered') && diffDays > 2
  const statusColor: Record<string, string> = { requested: '#FF6B35', ordered: '#6C5CE7', received: '#00B894', issue: '#E84393', returned: '#888', pending: '#B8860B' }
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending

  return (
    <>
      {showReceive && <ReceiveModal order={order} userName={userName} places={places} onClose={() => setShowReceive(false)} onSaved={() => { onRefresh(); loadDetail() }} />}
      {showEditReceipt && receipt && <EditReceiptModal receipt={receipt} order={order} userName={userName} onClose={() => setShowEditReceipt(false)} onSaved={() => { loadDetail() }} />}
      {showIssue && <IssueModal order={order} userName={userName} onClose={() => setShowIssue(false)} onSaved={onRefresh} />}
      {showReturn && receipt && <ReturnModal receipt={receipt} order={order} userName={userName} onClose={() => setShowReturn(false)} onSaved={() => { loadDetail() }} />}
      {showConfirm && <ConfirmOrderModal order={order} userName={userName} suppliers={suppliers} units={units} onClose={() => setShowConfirm(false)} onSaved={onRefresh} />}
      {showEdit && <EditOrderModal order={order} userName={userName} inventoryItems={inventoryItems} units={units} onClose={() => setShowEdit(false)} onSaved={onRefresh} />}
      {showResolve && <ResolveIssueModal order={order} userName={userName} onClose={() => setShowResolve(false)} onSaved={onRefresh} />}

      <div data-order-id={order.id} style={{ background: '#fff', borderRadius: 14, marginBottom: 8, border: `1px solid ${isOverdue ? 'rgba(232,67,147,0.35)' : statusColor[order.status] + '33' || '#E8ECF0'}`, overflow: 'hidden', boxShadow: highlighted ? '0 0 0 3px #6C5CE7, 0 2px 12px rgba(108,92,231,0.25)' : '0 1px 5px rgba(0,0,0,0.05)', transition: 'box-shadow 0.3s' }}>
        <div style={{ background: cfg.headerBg, padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{cfg.label}</span>
            {isOverdue && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(0,0,0,0.2)', color: '#fff', fontWeight: 700 }}>⏰ {Math.floor(diffDays)}일 지연</span>}
            {order.status === 'received' && order.received_by && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.9)' }}>· {order.received_by}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {(order.status === 'requested' || order.status === 'ordered' || order.status === 'received') && (
              <button onClick={e => { e.stopPropagation(); setShowEdit(true) }} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer' }}>✏️</button>
            )}
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>{new Date(order.ordered_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })}</span>
          </div>
        </div>

        <div onClick={() => setExpanded(v => !v)} style={{ cursor: 'pointer', padding: '10px 14px 10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', wordBreak: 'break-word' }}>{order.item_name}</span>
            </div>
            <span style={{ fontSize: 11, color: '#ccc', marginLeft: 8 }}>{expanded ? '▲' : '▼'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#1a1a2e', background: '#F0F2F8', padding: '2px 10px', borderRadius: 6, letterSpacing: '-0.3px' }}>{order.quantity}<span style={{ fontSize: 12, fontWeight: 600, color: '#888', marginLeft: 2 }}>{order.unit}</span></span>
            {order.supplier_name && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: 'rgba(45,198,214,0.1)', color: '#2DC6D6' }}>🏪 {order.supplier_name}</span>}
            {order.inventory_item_id && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 5, background: 'rgba(108,92,231,0.1)', color: '#6C5CE7' }}>재고연동</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: '#aaa' }}>요청: {order.ordered_by}</span>
            <span style={{ fontSize: 10, color: '#ddd' }}>·</span>
            <span style={{ fontSize: 11, color: '#aaa' }}>{new Date(order.ordered_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} {new Date(order.ordered_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
            {(order.status === 'ordered' || order.status === 'received') && order.confirmed_by && <span style={{ fontSize: 11, color: '#6C5CE7', marginLeft: 4 }}>· 주문: {order.confirmed_by}</span>}
            {order.confirmed_at && (order.status === 'ordered' || order.status === 'received') && <span style={{ fontSize: 10, color: '#a29bfe' }}>{new Date(order.confirmed_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} {new Date(order.confirmed_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>}
            {order.memo && <span style={{ fontSize: 10, color: '#bbb', marginLeft: 4 }}>📝 {order.memo}</span>}
          </div>
        </div>

        {(order.status === 'requested') && (
          <div style={{ display: 'flex', borderTop: '1px solid #F0F2F5' }}>
            <button onClick={() => setShowConfirm(true)} style={{ flex: 1, padding: '10px 0', background: 'linear-gradient(135deg,#6C5CE7,#a29bfe)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderBottomLeftRadius: 10 }}>✅ 주문 확인</button>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.3)' }} />
            <button onClick={() => setShowIssue(true)} style={{ width: 80, padding: '10px 0', background: 'rgba(232,67,147,0.08)', border: 'none', color: '#E84393', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderBottomRightRadius: 10 }}>🚨 이슈</button>
          </div>
        )}
        {(order.status === 'ordered' || order.status === 'pending') && (
          <div style={{ display: 'flex', borderTop: '1px solid #F0F2F5' }}>
            <button onClick={() => setShowReceive(true)} style={{ flex: 1, padding: '10px 0', background: 'linear-gradient(135deg,#00B894,#2DC6D6)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderBottomLeftRadius: 10 }}>📦 수령처리</button>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.3)' }} />
            <button onClick={() => setShowIssue(true)} style={{ width: 80, padding: '10px 0', background: 'rgba(232,67,147,0.08)', border: 'none', color: '#E84393', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderBottomRightRadius: 10 }}>🚨 이슈</button>
          </div>
        )}
        {order.status === 'issue' && (
          <div style={{ display: 'flex', borderTop: '1px solid #F0F2F5' }}>
            <button onClick={() => setShowResolve(true)} style={{ flex: 1, padding: '10px 0', background: 'linear-gradient(135deg,#6C5CE7,#a29bfe)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', borderBottomLeftRadius: 10 }}>✅ 이슈 해결</button>
            <button onClick={async () => {
              if (!confirm('이슈를 취소하고 주문완료 상태로 되돌릴까요?')) return
              const sb = createSupabaseBrowserClient()
              await sb.from('orders').update({ status: 'ordered' }).eq('id', order.id)
              await sb.from('order_receipt_logs').insert({ order_id: order.id, changed_by: userName, field_name: '이슈 취소', before_value: '이슈있음', after_value: '주문완료로 되돌림', memo: null })
              onRefresh()
            }} style={{ padding: '10px 14px', background: 'rgba(232,67,147,0.08)', border: 'none', borderLeft: '1px solid #F0F2F5', color: '#E84393', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderBottomRightRadius: 10 }}>↩️ 이슈취소</button>
          </div>
        )}

        {order.status === 'issue' && issueData?.memo && (
          <div style={{ margin: '0 14px 8px 14px', padding: '8px 12px', borderRadius: 10, background: 'rgba(232,67,147,0.07)', border: '1px solid rgba(232,67,147,0.2)' }}>
            <div style={{ fontSize: 10, color: '#E84393', fontWeight: 700, marginBottom: 2 }}>
              🚨 {issueData.issue_type === 'quantity_mismatch' ? '수량 불일치' : issueData.issue_type === 'wrong_delivery' ? '잘못 온 물품' : issueData.issue_type === 'wrong_store' ? '지점 오배송' : issueData.issue_type === 'damaged' ? '파손 도착' : issueData.issue_type === 'wrong_quantity' ? '수량 오류' : issueData.issue_type === 'wrong_item' ? '품목 오류' : issueData.issue_type === 'other_branch' ? '타지점 물품' : '기타'}
              {issueData.reported_by && <span style={{ color: '#aaa', fontWeight: 400 }}> · {issueData.reported_by}</span>}
            </div>
            <div style={{ fontSize: 12, color: '#1a1a2e', fontWeight: 600 }}>📝 {issueData.memo}</div>
          </div>
        )}

        {expanded && (
          <div style={{ margin: '0 14px 14px 14px', paddingTop: 12, borderTop: '1px solid #F4F6F9' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', marginBottom: 10 }}>📋 처리 흐름</div>
            <div style={{ position: 'relative', paddingLeft: 20 }}>
              <div style={{ position: 'absolute', left: 6, top: 6, bottom: 6, width: 2, background: '#E8ECF0', borderRadius: 2 }} />
              <TimelineItem color="#FF6B35" icon="📋" title="발주 요청" who={order.ordered_by} when={order.ordered_at} />
              {order.confirmed_by && <TimelineItem color="#6C5CE7" icon="✅" title={`주문 확인${order.supplier_name ? ` · ${order.supplier_name}` : ''}`} who={order.confirmed_by} when={order.confirmed_at} />}
              {order.status === 'issue' && (
                <TimelineItem color="#E84393" icon="🚨"
                  title={`이슈 신고${issueData?.issue_type ? ` · ${issueData.issue_type === 'quantity_mismatch' ? '수량 불일치' : issueData.issue_type === 'wrong_delivery' ? '잘못 온 물품' : issueData.issue_type === 'wrong_store' ? '지점 오배송' : issueData.issue_type === 'damaged' ? '파손 도착' : issueData.issue_type === 'wrong_quantity' ? '수량 오류' : issueData.issue_type === 'wrong_item' ? '품목 오류' : issueData.issue_type === 'other_branch' ? '타지점 물품' : '기타'}` : ''}`}
                  who={issueData?.reported_by || null} when={issueData?.reported_at || null} note={issueData?.memo || '이슈 처리 대기 중'} />
              )}
              {(receipt || order.received_by) && (
                <TimelineItem color="#00B894" icon="📦" title={`수령 완료${receipt ? ` · ${receipt.received_quantity}${order.unit}` : ''}`} who={receipt?.received_by || order.received_by} when={receipt?.received_at || order.received_at} note={receipt?.inventory_applied ? `✓ ${receipt.inventory_place || '재고'} 반영 (${receipt.inventory_applied_by})` : undefined} />
              )}
              {receipt?.return_type && (
                <TimelineItem color={receipt.return_type === 'return' ? '#E84393' : '#6C5CE7'} icon={receipt.return_type === 'return' ? '↩️' : '🔄'} title={receipt.return_type === 'return' ? '반품 처리' : '교환 처리'} who={receipt.return_by} when={receipt.return_at} note={receipt.return_memo || undefined} />
              )}
            </div>

            {receipt && (
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                <button onClick={() => setShowEditReceipt(true)} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.2)', color: '#FF6B35', fontSize: 10, cursor: 'pointer' }}>✏️ 수령 수정</button>
                {!receipt.return_type && <button onClick={() => setShowReturn(true)} style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.2)', color: '#6C5CE7', fontSize: 10, cursor: 'pointer' }}>↩️ 반품/교환</button>}
              </div>
            )}

            {logs.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', marginBottom: 6 }}>🔍 수정 이력</div>
                {logs.map(log => (
                  <div key={log.id} style={{ fontSize: 10, color: '#888', padding: '4px 0', borderBottom: '1px solid #F4F6F9', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>
                      <strong style={{ color: log.field_name.includes('수정') ? '#FF6B35' : log.field_name.includes('삭제') || log.field_name.includes('취소') ? '#E84393' : '#6C5CE7' }}>{log.changed_by}</strong>
                      {' · '}{log.field_name}
                      {log.before_value && <span style={{ color: '#ccc' }}> <span style={{ textDecoration: 'line-through' }}>{log.before_value}</span> → <span style={{ color: '#1a1a2e' }}>{log.after_value}</span></span>}
                      {!log.before_value && log.after_value && <span> {log.after_value}</span>}
                      {log.memo && <span style={{ color: '#bbb' }}> "{log.memo}"</span>}
                    </span>
                    <span style={{ flexShrink: 0 }}>{new Date(log.changed_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} {new Date(log.changed_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
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
    const { data: monthOrders } = await supabase.from('orders').select('id, item_name').eq('store_id', storeId).gte('ordered_at', from).lt('ordered_at', to)
    if (!monthOrders || monthOrders.length === 0) { setLogs([]); setLoading(false); return }
    const orderIds = monthOrders.map(o => o.id)
    const orderMap = Object.fromEntries(monthOrders.map(o => [o.id, o.item_name]))
    const { data } = await supabase.from('order_receipt_logs').select('*').in('order_id', orderIds).order('changed_at', { ascending: false })
    setLogs((data || []).map(l => ({ ...l, item_name: orderMap[l.order_id] || '(삭제된 품목)' })))
    setLoading(false)
  }

  const fieldColor: Record<string, string> = {
    '품목명 수정': '#FF6B35', '수량 수정': '#FF6B35', '단위 수정': '#FF6B35', '메모 수정': '#FF6B35',
    '발주 삭제': '#E84393', '주문 취소': '#6C5CE7', '최초수령': '#00B894',
    '수령수량수정': '#FF6B35', '반품처리': '#E84393', '교환처리': '#6C5CE7',
    '반품 완료': '#E84393', '교환 수령': '#6C5CE7',
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
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>{log.item_name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: `rgba(${color === '#FF6B35' ? '255,107,53' : color === '#E84393' ? '232,67,147' : color === '#6C5CE7' ? '108,92,231' : '0,184,148'},0.1)`, color, fontWeight: 700 }}>{log.field_name}</span>
                  {log.before_value && (
                    <span style={{ fontSize: 11, color: '#aaa' }}>
                      <span style={{ textDecoration: 'line-through' }}>{log.before_value}</span>
                      <span style={{ margin: '0 4px', color: '#ddd' }}>→</span>
                      <span style={{ color: '#1a1a2e', fontWeight: 600 }}>{log.after_value}</span>
                    </span>
                  )}
                  {!log.before_value && log.after_value && <span style={{ fontSize: 11, color: '#555' }}>{log.after_value}</span>}
                </div>
                {log.memo && <div style={{ fontSize: 10, color: '#bbb', marginTop: 4 }}>📝 {log.memo}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>{log.changed_by}</div>
                <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{new Date(log.changed_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} {new Date(log.changed_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── 통계 ───
function OrderStats({ storeId, year, month, userRole }: { storeId: string; year: number; month: number; userRole?: string }) {
  const supabase = createSupabaseBrowserClient()
  const [monthOrders, setMonthOrders] = useState<any[]>([])
  const [allOrders, setAllOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const isOwner = userRole === 'owner'

  useEffect(() => { load() }, [year, month])

  async function load() {
    setLoading(true)
    const pad = (n: number) => String(n).padStart(2, '0')
    const from = `${year}-${pad(month)}-01`
    const to = new Date(year, month, 1).toISOString().split('T')[0]
    const [{ data: mData }, { data: aData }] = await Promise.all([
      supabase.from('orders').select('*').eq('store_id', storeId).gte('ordered_at', from).lt('ordered_at', to).order('ordered_at', { ascending: true }),
      supabase.from('orders').select('id,item_name,quantity,unit,ordered_at,settlement_amount').eq('store_id', storeId).order('ordered_at', { ascending: true }),
    ])
    setMonthOrders(mData || [])
    setAllOrders(aData || [])
    setLoading(false)
  }

  // ── 품목별 통계 계산 ──
  const itemStats = useMemo(() => {
    const map: Record<string, { count: number; totalQty: number; unit: string; totalSpend: number; dates: string[] }> = {}
    allOrders.forEach(o => {
      const key = o.item_name
      if (!map[key]) map[key] = { count: 0, totalQty: 0, unit: o.unit || '', totalSpend: 0, dates: [] }
      map[key].count++
      map[key].totalQty += Number(o.quantity) || 0
      map[key].totalSpend += Number(o.settlement_amount) || 0
      map[key].dates.push(o.ordered_at)
    })
    return Object.entries(map).map(([name, s]) => {
      // 발주 주기 계산 (날짜 간격 평균)
      const sorted = s.dates.map(d => new Date(d).getTime()).sort((a, b) => a - b)
      let avgCycle = 0
      if (sorted.length >= 2) {
        const gaps = sorted.slice(1).map((d, i) => (d - sorted[i]) / (1000 * 60 * 60 * 24))
        avgCycle = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
      }
      const lastDate = sorted.length > 0 ? new Date(sorted[sorted.length - 1]) : null
      const daysSinceLast = lastDate ? Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24)) : null
      return { name, ...s, avgCycle, lastDate, daysSinceLast }
    }).sort((a, b) => b.count - a.count)
  }, [allOrders])

  // 이번 달 품목별
  const monthItemStats = useMemo(() => {
    const map: Record<string, { count: number; totalQty: number; unit: string; totalSpend: number }> = {}
    monthOrders.forEach(o => {
      const key = o.item_name
      if (!map[key]) map[key] = { count: 0, totalQty: 0, unit: o.unit || '', totalSpend: 0 }
      map[key].count++
      map[key].totalQty += Number(o.quantity) || 0
      map[key].totalSpend += Number(o.settlement_amount) || 0
    })
    return Object.entries(map).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.count - a.count)
  }, [monthOrders])

  const totalSpend = monthOrders.reduce((s, o) => s + (Number(o.settlement_amount) || 0), 0)
  const received = monthOrders.filter(o => o.status === 'received').length
  const issues = monthOrders.filter(o => o.status === 'issue').length
  const card = { background: '#fff', borderRadius: 14, border: '1px solid #E8ECF0', padding: 14, marginBottom: 10 }

  const filteredMonthStats = useMemo(() => {
    if (!searchQ.trim()) return monthItemStats
    return monthItemStats.filter(s => s.name.includes(searchQ.trim()))
  }, [monthItemStats, searchQ])

  const filteredItemStats = useMemo(() => {
    if (!searchQ.trim()) return itemStats
    return itemStats.filter(s => s.name.includes(searchQ.trim()))
  }, [itemStats, searchQ])

  // ── 엑셀 내보내기 ──
  async function exportExcel() {
    if (exporting) return
    setExporting(true)
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      const pad = (n: number) => String(n).padStart(2, '0')
      const thin = () => ({ style: 'thin' as const, color: { argb: 'FFE0E4E8' } })
      const med = () => ({ style: 'medium' as const, color: { argb: 'FFaaaaaa' } })

      // ── 시트1: 품목별 통계 ──
      const ws1 = wb.addWorksheet(`📊 품목별통계`)
      const titleRow1 = ws1.addRow([`📦 ${year}년 ${month}월 발주 품목별 통계`])
      ws1.mergeCells(1, 1, 1, 7)
      const tc1 = titleRow1.getCell(1)
      tc1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } }
      tc1.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 }
      tc1.alignment = { horizontal: 'center', vertical: 'middle' }
      titleRow1.height = 28

      const h1 = ws1.addRow(['품목명', '이번달 횟수', '이번달 수량', '이번달 지출', '전체 횟수', '평균 주기(일)', '마지막 발주'])
      h1.eachCell((cell, ci) => {
        const colors = ['FF2C3E50', 'FF6C5CE7', 'FF6C5CE7', 'FFFF6B35', 'FF2DC6D6', 'FF00B894', 'FFE84393']
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors[ci - 1] || 'FF2C3E50' } }
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = { bottom: med(), right: thin() }
      })
      ws1.getRow(2).height = 20

      const monthMap: Record<string, typeof monthItemStats[0]> = {}
      monthItemStats.forEach(s => { monthMap[s.name] = s })
      const allNames = new Set([...monthItemStats.map(s => s.name), ...itemStats.map(s => s.name)])

      ;[...allNames].forEach(name => {
        const ms = monthMap[name]
        const as_ = itemStats.find(s => s.name === name)
        const lastDateStr = as_?.lastDate ? new Date(as_.lastDate).toLocaleDateString('ko', { year: 'numeric', month: 'numeric', day: 'numeric' }) : '-'
        const row = ws1.addRow([
          name,
          ms?.count || 0,
          ms ? `${ms.totalQty}${ms.unit}` : '-',
          ms?.totalSpend ? `${ms.totalSpend.toLocaleString()}원` : '-',
          as_?.count || 0,
          as_?.avgCycle ? `${as_.avgCycle}일` : '-',
          lastDateStr
        ])
        row.height = 18
        row.eachCell((cell, ci) => {
          cell.alignment = { horizontal: ci === 1 ? 'left' : 'center', vertical: 'middle' }
          cell.border = { top: thin(), bottom: thin(), left: thin(), right: thin() }
          if (ci === 2 && (ms?.count || 0) >= 3) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E4FF' } }
          if (ci === 4 && (ms?.totalSpend || 0) > 0) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEEE6' } }; cell.font = { bold: true, color: { argb: 'FFFF6B35' } } }
        })
      })

      const sumRow1 = ws1.addRow(['합계', monthOrders.length, '-', totalSpend > 0 ? `${totalSpend.toLocaleString()}원` : '-', allOrders.length, '-', '-'])
      sumRow1.height = 22
      sumRow1.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE8CC' } }
        cell.font = { bold: true, size: 10, color: { argb: 'FF1A1A2E' } }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = { top: med(), bottom: thin(), left: thin(), right: thin() }
      })
      ws1.getColumn(1).width = 22
      ;[2, 3, 4, 5, 6, 7].forEach(i => { ws1.getColumn(i).width = 14 })
      ws1.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }]

      // ── 시트2: 이번달 발주 원본 ──
      const ws2 = wb.addWorksheet(`📋 ${month}월 발주목록`)
      const titleRow2 = ws2.addRow([`📋 ${year}년 ${month}월 발주 전체 목록`])
      ws2.mergeCells(1, 1, 1, 8)
      const tc2 = titleRow2.getCell(1)
      tc2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } }
      tc2.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 }
      tc2.alignment = { horizontal: 'center', vertical: 'middle' }
      titleRow2.height = 28

      const h2 = ws2.addRow(['날짜', '품목명', '수량', '상태', '발주자', '발주처', '결제금액', '결제방법'])
      h2.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A148C' } }
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = { bottom: med(), right: thin() }
      })
      ws2.getRow(2).height = 20

      const STATUS_KR: Record<string, string> = { requested: '주문요청', ordered: '주문완료', received: '수령완료', issue: '이슈', returned: '반품완료' }
      const STATUS_BG: Record<string, string> = { requested: 'FFFFEEE6', ordered: 'FFE8E4FF', received: 'FFE0FAF4', issue: 'FFFCE4F0', returned: 'FFF5F5F5' }

      monthOrders.forEach(o => {
        const d = new Date(o.ordered_at)
        const row = ws2.addRow([
          `${d.getMonth() + 1}/${d.getDate()}`,
          o.item_name,
          `${o.quantity}${o.unit}`,
          STATUS_KR[o.status] || o.status,
          o.ordered_by || '-',
          o.supplier_name || '-',
          o.settlement_amount ? `${Number(o.settlement_amount).toLocaleString()}원` : '-',
          o.payment_method || '-'
        ])
        row.height = 18
        row.eachCell((cell, ci) => {
          cell.alignment = { horizontal: ci <= 2 || ci === 5 || ci === 6 ? 'left' : 'center', vertical: 'middle' }
          cell.border = { top: thin(), bottom: thin(), left: thin(), right: thin() }
        })
        const statusCell = row.getCell(4)
        if (STATUS_BG[o.status]) statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_BG[o.status] } }
        if (o.settlement_amount) {
          row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEEE6' } }
          row.getCell(7).font = { bold: true, color: { argb: 'FFFF6B35' } }
        }
      })

      ;[1, 3, 4, 5, 6, 7, 8].forEach(i => { ws2.getColumn(i).width = 12 })
      ws2.getColumn(2).width = 24
      ws2.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }]

      // ── 시트3: 주기 분석 ──
      const ws3 = wb.addWorksheet(`🔄 발주주기분석`)
      const titleRow3 = ws3.addRow([`🔄 품목별 발주 주기 분석 (전체 기간)`])
      ws3.mergeCells(1, 1, 1, 5)
      const tc3 = titleRow3.getCell(1)
      tc3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF00B894' } }
      tc3.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 }
      tc3.alignment = { horizontal: 'center', vertical: 'middle' }
      titleRow3.height = 28

      const h3 = ws3.addRow(['품목명', '총 발주 횟수', '평균 주기(일)', '마지막 발주일', '경과일수'])
      h3.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B5E20' } }
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = { bottom: med(), right: thin() }
      })
      ws3.getRow(2).height = 20

      itemStats.filter(s => s.count >= 2).forEach(s => {
        const lastDateStr = s.lastDate ? new Date(s.lastDate).toLocaleDateString('ko') : '-'
        const isSoonDue = s.avgCycle > 0 && s.daysSinceLast !== null && s.daysSinceLast >= s.avgCycle * 0.8
        const row = ws3.addRow([s.name, s.count, s.avgCycle ? `${s.avgCycle}일` : '-', lastDateStr, s.daysSinceLast !== null ? `${s.daysSinceLast}일` : '-'])
        row.height = 18
        row.eachCell((cell, ci) => {
          cell.alignment = { horizontal: ci === 1 ? 'left' : 'center', vertical: 'middle' }
          cell.border = { top: thin(), bottom: thin(), left: thin(), right: thin() }
        })
        if (isSoonDue) {
          row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4F0' } }
          row.getCell(5).font = { bold: true, color: { argb: 'FFE84393' } }
        }
      })
      ws3.getColumn(1).width = 22; ws3.getColumn(2).width = 14; ws3.getColumn(3).width = 14; ws3.getColumn(4).width = 16; ws3.getColumn(5).width = 12
      ws3.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }]

      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `발주통계_${year}년${month}월.xlsx`; a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) { alert('내보내기 실패: ' + (e?.message || '')) }
    finally { setExporting(false) }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 13 }}>불러오는 중...</div>

  return (
    <div>
      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[['총 발주', monthOrders.length, '#1a1a2e'], ['수령완료', received, '#00B894'], ['이슈', issues, '#E84393']].map(([l, v, c]) => (
          <div key={String(l)} style={{ ...card, marginBottom: 0, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#aaa', marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: String(c) }}>{v}</div>
          </div>
        ))}
      </div>
      {totalSpend > 0 && (
        <div style={{ ...card, background: 'rgba(255,107,53,0.04)', border: '1px solid rgba(255,107,53,0.2)', textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>💰 이번 달 결산 집계 금액</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#FF6B35' }}>{totalSpend.toLocaleString()}원</div>
          <div style={{ fontSize: 10, color: '#bbb', marginTop: 4 }}>결산 금액 입력된 항목 기준</div>
        </div>
      )}

      {/* 엑셀 다운로드 (대표만) */}
      {isOwner && (
        <button onClick={exportExcel} disabled={exporting}
          style={{ width: '100%', padding: '11px 0', borderRadius: 12, background: exporting ? '#E8ECF0' : 'linear-gradient(135deg,#00B894,#2DC6D6)', border: 'none', color: exporting ? '#bbb' : '#fff', fontSize: 13, fontWeight: 700, cursor: exporting ? 'default' : 'pointer', marginBottom: 14 }}>
          {exporting ? '⏳ 생성 중...' : '📥 발주 통계 엑셀 다운로드'}
        </button>
      )}

      {/* 검색 */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#aaa' }}>🔍</span>
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="품목명 검색..."
          style={{ width: '100%', padding: '9px 32px 9px 32px', borderRadius: 10, border: '1px solid #E0E4E8', background: '#F8F9FB', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, color: '#1a1a2e' }} />
        {searchQ && <button onClick={() => setSearchQ('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 14 }}>✕</button>}
      </div>

      {/* 이번 달 품목별 */}
      {filteredMonthStats.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>📦 {month}월 품목별 발주 현황</div>
          {filteredMonthStats.map((s, i) => (
            <div key={s.name} style={{ padding: '10px 0', borderBottom: '1px solid #F4F6F9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: i < 3 ? '#FF6B35' : '#aaa', minWidth: 20 }}>#{i + 1}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{s.name}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#6C5CE7', fontWeight: 700 }}>{s.count}회</span>
                  <span style={{ fontSize: 11, color: '#888' }}>{s.totalQty}{s.unit}</span>
                  {s.totalSpend > 0 && <span style={{ fontSize: 11, color: '#FF6B35', fontWeight: 700 }}>{s.totalSpend.toLocaleString()}원</span>}
                </div>
              </div>
              {(() => {
                const allStat = itemStats.find(a => a.name === s.name)
                if (!allStat || allStat.avgCycle === 0) return null
                const isSoonDue = allStat.daysSinceLast !== null && allStat.daysSinceLast >= allStat.avgCycle * 0.8
                return (
                  <div style={{ display: 'flex', gap: 8, paddingLeft: 28 }}>
                    <span style={{ fontSize: 10, color: '#aaa' }}>🔄 평균 {allStat.avgCycle}일 주기</span>
                    {allStat.daysSinceLast !== null && (
                      <span style={{ fontSize: 10, color: isSoonDue ? '#E84393' : '#00B894', fontWeight: isSoonDue ? 700 : 400 }}>
                        {isSoonDue ? `⚠️ 마지막 발주 ${allStat.daysSinceLast}일 경과 (곧 발주 필요)` : `마지막 ${allStat.daysSinceLast}일 전`}
                      </span>
                    )}
                  </div>
                )
              })()}
            </div>
          ))}
          {filteredMonthStats.length === 0 && searchQ && <div style={{ textAlign: 'center', padding: 16, color: '#bbb', fontSize: 13 }}>검색 결과가 없어요</div>}
        </div>
      )}

      {/* 전체 기간 자주 시키는 것 TOP 10 */}
      {filteredItemStats.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>🏆 전체 기간 자주 발주한 품목 {searchQ ? `"${searchQ}" 검색결과` : 'TOP 10'}</div>
          <div style={{ fontSize: 10, color: '#aaa', marginBottom: 12 }}>전체 기간 기준</div>
          {(searchQ ? filteredItemStats : filteredItemStats.slice(0, 10)).map((s, i) => (
            <div key={s.name} style={{ padding: '8px 0', borderBottom: '1px solid #F4F6F9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: i < 3 && !searchQ ? '#FF6B35' : '#ccc', minWidth: 20 }}>#{i + 1}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{s.name}</span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#6C5CE7', fontWeight: 700 }}>{s.count}회</span>
                  {s.avgCycle > 0 && <span style={{ fontSize: 10, color: '#00B894', padding: '1px 6px', borderRadius: 8, background: 'rgba(0,184,148,0.1)' }}>🔄 {s.avgCycle}일</span>}
                </div>
              </div>
              {s.avgCycle > 0 && (
                <div style={{ paddingLeft: 28 }}>
                  <div style={{ height: 4, borderRadius: 2, background: '#F0F2F5', overflow: 'hidden', marginBottom: 2 }}>
                    <div style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg,#FF6B35,#E84393)', width: `${Math.min((s.count / itemStats[0].count) * 100, 100)}%` }} />
                  </div>
                  {s.totalSpend > 0 && <span style={{ fontSize: 10, color: '#FF6B35' }}>총 {s.totalSpend.toLocaleString()}원</span>}
                </div>
              )}
            </div>
          ))}
          {filteredItemStats.length === 0 && searchQ && <div style={{ textAlign: 'center', padding: 16, color: '#bbb', fontSize: 13 }}>검색 결과가 없어요</div>}
        </div>
      )}

      {monthOrders.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 13 }}>{year}년 {month}월 발주 내역이 없어요</div>}
    </div>
  )
}


// ═══════════════════════════════════════
// 메인 OrderTab
// ═══════════════════════════════════════
export default function OrderTab({ storeId, userName, isEdit, userRole, inventoryItems, places }: {
  storeId: string; userName: string; isEdit: boolean; userRole?: string; inventoryItems: any[]; places: any[]
}) {
  const supabase = createSupabaseBrowserClient()
  const [orders, setOrders] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [units, setUnits] = useState<string[]>(DEFAULT_UNITS)
  const [subTab, setSubTab] = useState<'pending' | 'requested' | 'all' | 'issues' | 'history' | 'stats'>('pending')
  const [showAddOrder, setShowAddOrder] = useState(false)
  const [showQuickOrder, setShowQuickOrder] = useState(false)
  const [showDirectIssue, setShowDirectIssue] = useState(false)
  const [showSupplierMgr, setShowSupplierMgr] = useState(false)
  const [loading, setLoading] = useState(true)
  const now = new Date()
  const [selYear, setSelYear] = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)

  useEffect(() => { if (storeId) { loadOrders(); loadSuppliers(); loadUnits() } }, [storeId])

  async function loadUnits() {
    const { data } = await supabase.from('store_settings').select('value').eq('store_id', storeId).eq('key', 'custom_units').maybeSingle()
    if (data?.value) {
      try { setUnits(JSON.parse(data.value)) } catch {}
    }
  }

  async function loadOrders() {
    setLoading(true)
    const { data } = await supabase.from('orders').select('*').eq('store_id', storeId).order('ordered_at', { ascending: false }).order('created_at', { ascending: true })
    setOrders(data || [])
    setLoading(false)
  }
  async function loadSuppliers() {
    const { data } = await supabase.from('order_suppliers').select('*').eq('store_id', storeId).order('created_at')
    setSuppliers(data || [])
  }

  const [showPicker, setShowPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(now.getFullYear())

  const filteredOrders = useMemo(() => orders.filter(o => {
    const d = new Date(o.ordered_at)
    return d.getFullYear() === selYear && d.getMonth() + 1 === selMonth
  }), [orders, selYear, selMonth])

  const pendingOrders = useMemo(() => orders.filter(o => o.status === 'pending' || o.status === 'requested' || o.status === 'ordered' || o.status === 'issue'), [orders])
  const requestedOrders = useMemo(() => orders.filter(o => o.status === 'requested'), [orders])
  const overdueOrders = useMemo(() => pendingOrders.filter(o => {
    const diff = (now.getTime() - new Date(o.ordered_at).getTime()) / (1000 * 60 * 60 * 24)
    return diff > 2
  }), [pendingOrders])
  const issueOrders = useMemo(() => orders.filter(o => o.status === 'issue'), [orders])

  const [searchQ, setSearchQ] = useState('')
  const [highlightId, setHighlightId] = useState<string | null>(null)

  const searchResults = useMemo(() => {
    const q = searchQ.trim()
    if (!q) return []
    return orders.filter(o => o.item_name?.includes(q) || o.ordered_by?.includes(q) || o.memo?.includes(q) || o.supplier_name?.includes(q)).slice(0, 20)
  }, [searchQ, orders])

  function goToOrder(orderId: string) {
    const target = orders.find(o => o.id === orderId)
    if (target) { const d = new Date(target.ordered_at); setSelYear(d.getFullYear()); setSelMonth(d.getMonth() + 1) }
    setSubTab('all'); setSearchQ(''); setHighlightId(orderId)
    setTimeout(() => { const el = document.querySelector(`[data-order-id="${orderId}"]`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, 300)
    setTimeout(() => setHighlightId(null), 3000)
  }

  function groupByDate(list: any[]) {
    const map: Record<string, any[]> = {}
    list.forEach(o => {
      const d = new Date(o.ordered_at)
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      if (!map[key]) map[key] = []
      map[key].push(o)
    })
    const statusOrder: Record<string, number> = { requested: 0, ordered: 1, issue: 2, received: 3, returned: 4 }
    Object.values(map).forEach(items => items.sort((a, b) => {
      const sa = statusOrder[a.status] ?? 5; const sb = statusOrder[b.status] ?? 5
      if (sa !== sb) return sa - sb
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    }))
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
          const statusCounts = items.reduce((acc: any, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc }, {})
          return (
            <div key={dateKey} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6C5CE7', background: 'rgba(108,92,231,0.1)', padding: '4px 10px', borderRadius: 20, flexShrink: 0 }}>📅 {label}</div>
                <div style={{ flex: 1, height: 1, background: '#E8ECF0' }} />
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {statusCounts.requested > 0 && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(255,107,53,0.12)', color: '#FF6B35', fontWeight: 700 }}>요청 {statusCounts.requested}</span>}
                  {statusCounts.ordered > 0 && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(108,92,231,0.12)', color: '#6C5CE7', fontWeight: 700 }}>주문 {statusCounts.ordered}</span>}
                  {(statusCounts.pending||0) > 0 && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(184,134,11,0.12)', color: '#B8860B', fontWeight: 700 }}>미수령 {statusCounts.pending}</span>}
                  {statusCounts.received > 0 && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(0,184,148,0.1)', color: '#00B894', fontWeight: 700 }}>수령 {statusCounts.received}</span>}
                  {statusCounts.issue > 0 && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(232,67,147,0.1)', color: '#E84393', fontWeight: 700 }}>이슈 {statusCounts.issue}</span>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 0 }}>
                {items.map(o => <OrderCard key={o.id} order={o} userName={userName} isEdit={isEdit} suppliers={suppliers} inventoryItems={inventoryItems} units={units} places={places} highlighted={highlightId === o.id} onRefresh={loadOrders} />)}
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
      fontWeight: subTab === key ? 700 : 400, background: subTab === key ? '#fff' : 'transparent',
      color: subTab === key ? '#1a1a2e' : '#aaa', boxShadow: subTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', position: 'relative' as const,
    }}>
      {label}
      {badgeCnt !== undefined && badgeCnt > 0 && <span style={{ marginLeft: 4, fontSize: 9, padding: '1px 5px', borderRadius: 8, background: '#E84393', color: '#fff', fontWeight: 700 }}>{badgeCnt}</span>}
    </button>
  )

  return (
    <div>
      {showAddOrder && <AddOrderModal storeId={storeId} userName={userName} suppliers={suppliers} inventoryItems={inventoryItems} units={units} onUnitsUpdate={setUnits} onClose={() => setShowAddOrder(false)} onSaved={loadOrders} />}
      {showSupplierMgr && <SupplierModal storeId={storeId} onClose={() => { setShowSupplierMgr(false); loadSuppliers() }} />}
      {showQuickOrder && <QuickOrderModal storeId={storeId} userName={userName} suppliers={suppliers} inventoryItems={inventoryItems} units={units} onClose={() => setShowQuickOrder(false)} onSaved={loadOrders} />}
      {showDirectIssue && <DirectIssueModal storeId={storeId} userName={userName} units={units} onClose={() => setShowDirectIssue(false)} onSaved={() => { loadOrders(); setSubTab('issues') }} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>📋 발주 관리</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {isEdit && <button onClick={() => setShowSupplierMgr(true)} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(45,198,214,0.1)', border: '1px solid rgba(45,198,214,0.3)', color: '#2DC6D6', fontSize: 11, cursor: 'pointer' }}>🏪 발주처</button>}
          <button onClick={() => setShowDirectIssue(true)} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(232,67,147,0.1)', border: '1px solid rgba(232,67,147,0.3)', color: '#E84393', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🚨 이슈등록</button>
          <button onClick={() => setShowQuickOrder(true)} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.3)', color: '#6C5CE7', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>⚡ 빠른발주</button>
          <button onClick={() => setShowAddOrder(true)} style={{ padding: '6px 12px', borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ 발주 추가</button>
        </div>
      </div>

      <div style={{ display: 'flex', background: '#F4F6F9', borderRadius: 10, padding: 3, marginBottom: 10, gap: 1 }}>
        {tabBtn('pending', `미완료`, pendingOrders.length)}
        {tabBtn('requested', '주문요청', requestedOrders.length)}
        {tabBtn('all', '전체내역')}
        {tabBtn('issues', '이슈', issueOrders.length)}
        {tabBtn('history', '수정이력')}
        {tabBtn('stats', '📊 통계')}
      </div>

      {subTab !== 'pending' && subTab !== 'requested' && subTab !== 'issues' && (
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => { setPickerYear(selYear); setShowPicker(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #E0E4E8', background: '#F8F9FB', color: '#1a1a2e', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
            📅 {selYear}년 {selMonth}월 ▾
          </button>
          {showPicker && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowPicker(false)}>
              <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <button onClick={() => setPickerYear(y => y - 1)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E8ECF0', background: '#F4F6F9', cursor: 'pointer', fontSize: 16, color: '#888' }}>‹</button>
                  <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>{pickerYear}년</span>
                  <button onClick={() => setPickerYear(y => y + 1)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E8ECF0', background: '#F4F6F9', cursor: 'pointer', fontSize: 16, color: '#888' }}>›</button>
                </div>
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, justifyContent: 'center' }}>
                  {[pickerYear - 2, pickerYear - 1, pickerYear, pickerYear + 1, pickerYear + 2].map(y => (
                    <button key={y} onClick={() => setPickerYear(y)} style={{ padding: '5px 8px', borderRadius: 8, border: y === pickerYear ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: y === pickerYear ? 'rgba(108,92,231,0.1)' : '#F4F6F9', color: y === pickerYear ? '#6C5CE7' : '#888', fontSize: 11, fontWeight: y === pickerYear ? 700 : 400, cursor: 'pointer' }}>{y}</button>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                    const isSelected = pickerYear === selYear && m === selMonth
                    return (
                      <button key={m} onClick={() => { setSelYear(pickerYear); setSelMonth(m); setShowPicker(false) }}
                        style={{ padding: '12px 0', borderRadius: 12, border: isSelected ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: isSelected ? 'linear-gradient(135deg,#6C5CE7,#a29bfe)' : '#F8F9FB', color: isSelected ? '#fff' : '#1a1a2e', fontSize: 14, fontWeight: isSelected ? 700 : 400, cursor: 'pointer' }}>
                        {m}월
                      </button>
                    )
                  })}
                </div>
                <button onClick={() => setShowPicker(false)} style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: '1px solid #E8ECF0', background: '#F4F6F9', color: '#888', fontSize: 13, cursor: 'pointer' }}>닫기</button>
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
              {overdueOrders.length > 0 && <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(232,67,147,0.08)', border: '1px solid rgba(232,67,147,0.2)', marginBottom: 8, fontSize: 11, color: '#E84393', fontWeight: 600 }}>🔴 2일 이상 미수령 {overdueOrders.length}건 있어요!</div>}
              {issueOrders.length > 0 && <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(232,67,147,0.06)', border: '1px solid rgba(232,67,147,0.15)', marginBottom: 12, fontSize: 11, color: '#E84393', fontWeight: 600 }}>⚠️ 이슈 발주 {issueOrders.length}건 포함</div>}
              {pendingOrders.length === 0 ? <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>🎉 미완료 발주가 없어요!</div> : <DateGroupedList list={pendingOrders} />}
            </>
          )}
          {subTab === 'requested' && (requestedOrders.length === 0 ? <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>📋 주문요청 대기 중인 발주가 없어요</div> : <DateGroupedList list={requestedOrders} />)}
          {subTab === 'all' && (
            <>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#aaa' }}>🔍</span>
                <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="품목명, 발주자, 메모 검색..."
                  style={{ width: '100%', padding: '9px 32px 9px 32px', borderRadius: 10, border: '1px solid #E0E4E8', background: '#F8F9FB', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, color: '#1a1a2e' }} />
                {searchQ && <button onClick={() => setSearchQ('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 14 }}>✕</button>}
                {searchQ.trim() && searchResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', borderRadius: 12, border: '1px solid #E0E4E8', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', marginTop: 4, maxHeight: 320, overflowY: 'auto' }}>
                    {searchResults.map(o => {
                      const cfg = STATUS_CONFIG[o.status]; const d = new Date(o.ordered_at)
                      return (
                        <div key={o.id} onClick={() => goToOrder(o.id)}
                          style={{ padding: '10px 14px', borderBottom: '1px solid #F4F6F9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F8F9FB')} onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg?.color || '#aaa', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 2 }}>{o.item_name}</div>
                            <div style={{ fontSize: 11, color: '#aaa' }}>{d.getFullYear()}년 {d.getMonth()+1}월 {d.getDate()}일 · {o.ordered_by} · {o.quantity}{o.unit}</div>
                          </div>
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: cfg?.color + '18' || '#F4F6F9', color: cfg?.color || '#888', fontWeight: 700, flexShrink: 0 }}>{cfg?.label || o.status}</span>
                        </div>
                      )
                    })}
                    {searchResults.length === 20 && <div style={{ padding: '8px 14px', fontSize: 11, color: '#bbb', textAlign: 'center' }}>상위 20건만 표시됩니다</div>}
                  </div>
                )}
                {searchQ.trim() && searchResults.length === 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', borderRadius: 12, border: '1px solid #E0E4E8', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', marginTop: 4, padding: '16px', textAlign: 'center', fontSize: 13, color: '#bbb' }}>검색 결과가 없어요</div>
                )}
              </div>
              {filteredOrders.length === 0 ? <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>{selYear}년 {selMonth}월 발주 내역이 없어요</div> : <DateGroupedList list={filteredOrders} />}
            </>
          )}
          {subTab === 'issues' && (issueOrders.length === 0 ? <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>✅ 이슈 내역이 없어요</div> : <DateGroupedList list={issueOrders} />)}
          {subTab === 'history' && <OrderHistoryTab storeId={storeId} year={selYear} month={selMonth} />}
          {subTab === 'stats' && <OrderStats storeId={storeId} year={selYear} month={selMonth} userRole={userRole} />}
        </>
      )}
    </div>
  )
}