'use client'
import { useEffect, useState, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

const STORES = [
  { id: '00000000-0000-0000-0000-000000000001', name: '고덕점', color: '#FF6B35', bg: 'rgba(255,107,53,0.12)' },
  { id: '799f3381-c122-4327-8b57-f17ddd632cd6', name: '비전점', color: '#6C5CE7', bg: 'rgba(108,92,231,0.12)' },
  { id: 'ec48ac26-baa1-407e-89df-1331dffd2b31', name: '스타필드', color: '#00B894', bg: 'rgba(0,184,148,0.12)' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; headerBg: string }> = {
  requested: { label: '📋 주문요청', color: '#FF6B35', headerBg: 'linear-gradient(135deg,#FF6B35,#ff9a6c)' },
  ordered:   { label: '✅ 주문완료', color: '#6C5CE7', headerBg: 'linear-gradient(135deg,#6C5CE7,#a29bfe)' },
  received:  { label: '📦 수령완료', color: '#00B894', headerBg: 'linear-gradient(135deg,#00B894,#2DC6D6)' },
  issue:     { label: '⚠️ 이슈',    color: '#E84393', headerBg: 'linear-gradient(135deg,#E84393,#fd79a8)' },
  returned:  { label: '↩️ 반품',    color: '#999',    headerBg: 'linear-gradient(135deg,#bbb,#ddd)' },
}

function StoreBadge({ storeId }: { storeId: string }) {
  const s = STORES.find(x => x.id === storeId)
  if (!s) return null
  return (
    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(255,255,255,0.25)', color: '#fff', fontWeight: 700, flexShrink: 0, border: '1px solid rgba(255,255,255,0.4)' }}>
      {s.name}
    </span>
  )
}

function ConfirmOrderModal({ order, userName, onDone, onClose }: { order: any; userName: string; onDone: () => void; onClose: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [confirmedBy, setConfirmedBy] = useState(userName)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('order_suppliers').select('*').eq('store_id', order.store_id).order('created_at').then(({ data }) => setSuppliers(data || []))
  }, [])

  async function handleConfirm() {
    setSaving(true)
    await supabase.from('orders').update({ status: 'ordered', supplier_id: supplierId || null, confirmed_by: confirmedBy.trim() || userName, confirmed_at: new Date().toISOString() }).eq('id', order.id)
    await supabase.from('order_receipt_logs').insert({ order_id: order.id, changed_by: userName, field_name: '주문확인', before_value: '요청됨', after_value: `주문완료 (${confirmedBy.trim() || userName})`, memo: null })
    setSaving(false); onDone()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>📋 주문 확인</div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>{order.item_name} · {order.quantity}{order.unit}</div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>발주처 (선택)</div>
        <select value={supplierId} onChange={e => setSupplierId(e.target.value)} style={{ ...inp, marginBottom: 12 }}>
          <option value="">미지정</option>
          {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>주문자</div>
        <input value={confirmedBy} onChange={e => setConfirmedBy(e.target.value)} style={{ ...inp, marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleConfirm} disabled={saving} style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: 'linear-gradient(135deg,#6C5CE7,#a29bfe)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? '처리 중...' : '✅ 주문확인'}
          </button>
          <button onClick={onClose} style={{ padding: '12px 18px', borderRadius: 12, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  )
}

function ReceiveModal({ order, userName, places, onDone, onClose }: { order: any; userName: string; places: any[]; onDone: () => void; onClose: () => void }) {
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

  // 재고 연동 품목이면 배치된 장소만, 아니면 전체
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
      onDone(); onClose(); return
    }
    if (hasInventoryLink) { setStep('place') } else { await doSave(null) }
  }

  async function doSave(place: string | null) {
    setSaving(true)
    const { data: receipt } = await supabase.from('order_receipts').insert({
      order_id: order.id, received_quantity: Number(recvQty), received_by: userName,
      inventory_applied: !!place, inventory_applied_at: place ? new Date().toISOString() : null,
      inventory_applied_by: place ? userName : null, inventory_place: place || null,
      memo: memo.trim() || null,
    }).select().single()
    if (receipt) {
      await supabase.from('order_receipt_logs').insert({
        receipt_id: receipt.id, order_id: order.id, changed_by: userName, field_name: '최초수령',
        before_value: null, after_value: place ? `${recvQty}${order.unit} → ${place}` : `${recvQty}${order.unit}`,
        memo: memo.trim() || null,
      })
    }
    if (place && order.inventory_item_id) {
      const { data: existing } = await supabase.from('inventory_stock')
        .select('quantity').eq('item_id', order.inventory_item_id).eq('place', place).single()
      await supabase.from('inventory_stock').upsert({
        item_id: order.inventory_item_id, place, quantity: (existing?.quantity ?? 0) + Number(recvQty),
        updated_by: userName, updated_at: new Date().toISOString(),
      }, { onConflict: 'item_id,place' })
    }
    await supabase.from('orders').update({ status: 'received', received_by: userName, received_at: receivedAt ? new Date(receivedAt + 'T12:00:00').toISOString() : new Date().toISOString() }).eq('id', order.id)
    setSaving(false); onDone(); onClose()
  }

  const placeGroups = filteredPlaces.reduce((acc: Record<string, any[]>, p) => {
    const g = p.group_name || '기타'; if (!acc[g]) acc[g] = []; acc[g].push(p); return acc
  }, {})

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
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
                  {(gPlaces as any[]).map((p: any) => (
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
                {hasInventoryLink ? '재고에 배치된 장소가 없어요\n재고탭 → 장소별에서 먼저 배치해주세요' : '등록된 장소가 없어요'}
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

// ─── 발주처 관리 모달 (관리자용 — 전 지점 통합) ───
function SupplierModal({ storeIds, onClose }: { storeIds: string[]; onClose: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [selectedStore, setSelectedStore] = useState(storeIds[0] || '')
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [newName, setNewName] = useState('')
  const [newMemo, setNewMemo] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editMemo, setEditMemo] = useState('')
  const inp2 = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

  useEffect(() => { if (selectedStore) load() }, [selectedStore])

  async function load() {
    const { data } = await supabase.from('order_suppliers').select('*').eq('store_id', selectedStore).order('created_at')
    setSuppliers(data || [])
  }
  async function handleAdd() {
    if (!newName.trim()) return
    await supabase.from('order_suppliers').insert({ store_id: selectedStore, name: newName.trim(), memo: newMemo.trim() || null })
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
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>🏪 발주처 관리</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>

        {/* 지점 선택 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>지점 선택</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {STORES.map(s => (
              <button key={s.id} onClick={() => setSelectedStore(s.id)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: selectedStore === s.id ? `2px solid ${s.color}` : '1px solid #E8ECF0', background: selectedStore === s.id ? s.bg : '#F8F9FB', color: selectedStore === s.id ? s.color : '#888', fontSize: 12, fontWeight: selectedStore === s.id ? 700 : 400, cursor: 'pointer' }}>
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* 추가 폼 */}
        <div style={{ border: '2px dashed rgba(255,107,53,0.3)', borderRadius: 14, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#FF6B35', marginBottom: 10 }}>새 발주처 추가</div>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="발주처 이름 (예: 해산물 업체)" style={{ ...inp2, marginBottom: 8 }} />
          <input value={newMemo} onChange={e => setNewMemo(e.target.value)} placeholder="메모 (선택)" style={{ ...inp2, marginBottom: 10 }} />
          <button onClick={handleAdd} style={{ width: '100%', padding: '9px 0', borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>추가</button>
        </div>

        {/* 목록 */}
        {suppliers.map(s => (
          editId === s.id ? (
            <div key={s.id} style={{ background: 'rgba(255,107,53,0.05)', borderRadius: 12, padding: 12, marginBottom: 8, border: '1px solid rgba(255,107,53,0.2)' }}>
              <input value={editName} onChange={e => setEditName(e.target.value)} style={{ ...inp2, marginBottom: 8 }} />
              <input value={editMemo} onChange={e => setEditMemo(e.target.value)} placeholder="메모" style={{ ...inp2, marginBottom: 10 }} />
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
        {suppliers.length === 0 && <div style={{ textAlign: 'center', padding: 24, color: '#bbb', fontSize: 13 }}>이 지점에 등록된 발주처가 없어요</div>}
      </div>
    </div>
  )
}

// ─── 이슈 신고 모달 (관리자용) ───
const ISSUE_TYPES: Record<string, string> = {
  wrong_quantity: '수량 불일치',
  wrong_item: '잘못된 품목',
  damaged: '파손/불량',
  delayed: '배송 지연',
  other: '기타',
}


// ─── 이슈 해결 모달 ───
function ResolveIssueModal({ order, userName, onClose, onSaved }: { order: any; userName: string; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [resolveType, setResolveType] = useState<'return' | 'exchange' | 'both' | 'additional' | 'other'>('exchange')
  const [resolvedBy, setResolvedBy] = useState(userName)
  const [recvQty, setRecvQty] = useState<number | ''>(order.quantity)
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  const options = [
    { key: 'exchange',   label: '🔄 교환 수령',   desc: '새 물건 받음 → 수령완료 처리', color: '#6C5CE7' },
    { key: 'return',     label: '↩️ 반품만',       desc: '물건 돌려보냄 → 반품완료 처리', color: '#E84393' },
    { key: 'both',       label: '↩️🔄 반품+교환',  desc: '반품하고 새 물건도 받음', color: '#FF6B35' },
    { key: 'additional', label: '📦 추가 수령',    desc: '부족분 추가로 받음 → 수령완료 처리', color: '#00B894' },
    { key: 'other',      label: '📝 기타',          desc: '타지점 전달 등 기타 처리 → 수령완료', color: '#888' },
  ] as const

  async function handleSubmit() {
    if (!resolvedBy.trim()) return
    setSaving(true)
    const now = new Date().toISOString()
    if (resolveType === 'return') {
      await supabase.from('orders').update({ status: 'returned' }).eq('id', order.id)
      await supabase.from('order_receipt_logs').insert({ order_id: order.id, changed_by: resolvedBy.trim(), field_name: '반품 완료', before_value: '이슈있음', after_value: '반품완료', memo: memo.trim() || null })
    } else if (resolveType === 'exchange') {
      await supabase.from('order_receipts').insert({ order_id: order.id, received_quantity: Number(recvQty) || order.quantity, received_by: resolvedBy.trim(), received_at: now, inventory_applied: false, memo: memo.trim() || null })
      await supabase.from('orders').update({ status: 'received', received_by: resolvedBy.trim(), received_at: now }).eq('id', order.id)
      await supabase.from('order_receipt_logs').insert({ order_id: order.id, changed_by: resolvedBy.trim(), field_name: '교환 수령', before_value: '이슈있음', after_value: `교환품 ${recvQty}${order.unit} 수령완료`, memo: memo.trim() || null })
    } else if (resolveType === 'both') {
      await supabase.from('order_receipts').insert({ order_id: order.id, received_quantity: Number(recvQty) || order.quantity, received_by: resolvedBy.trim(), received_at: now, inventory_applied: false, return_type: 'exchange', return_by: resolvedBy.trim(), return_at: now, return_memo: memo.trim() || null, memo: memo.trim() || null })
      await supabase.from('orders').update({ status: 'received', received_by: resolvedBy.trim(), received_at: now }).eq('id', order.id)
      await supabase.from('order_receipt_logs').insert([
        { order_id: order.id, changed_by: resolvedBy.trim(), field_name: '반품 처리', before_value: '이슈있음', after_value: '반품완료', memo: memo.trim() || null },
        { order_id: order.id, changed_by: resolvedBy.trim(), field_name: '교환 수령', before_value: '반품완료', after_value: `교환품 ${recvQty}${order.unit} 수령완료`, memo: memo.trim() || null },
      ])
    } else if (resolveType === 'additional') {
      await supabase.from('order_receipts').insert({ order_id: order.id, received_quantity: Number(recvQty) || order.quantity, received_by: resolvedBy.trim(), received_at: now, inventory_applied: false, memo: memo.trim() || null })
      await supabase.from('orders').update({ status: 'received', received_by: resolvedBy.trim(), received_at: now }).eq('id', order.id)
      await supabase.from('order_receipt_logs').insert({ order_id: order.id, changed_by: resolvedBy.trim(), field_name: '추가 수령', before_value: '이슈있음', after_value: `추가 ${recvQty}${order.unit} 수령완료`, memo: memo.trim() || null })
    } else {
      await supabase.from('orders').update({ status: 'received', received_by: resolvedBy.trim(), received_at: now }).eq('id', order.id)
      await supabase.from('order_receipt_logs').insert({ order_id: order.id, changed_by: resolvedBy.trim(), field_name: '기타 처리', before_value: '이슈있음', after_value: memo.trim() || '기타 처리 완료', memo: memo.trim() || null })
    }
    setSaving(false)
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 360, maxHeight: '90vh', overflowY: 'auto' }}>
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
              <button key={o.key} onClick={() => setResolveType(o.key as any)}
                style={{ padding: '10px 14px', borderRadius: 10, border: resolveType === o.key ? `2px solid ${o.color}` : '1px solid #E8ECF0', background: resolveType === o.key ? `${o.color}15` : '#F8F9FB', cursor: 'pointer', textAlign: 'left' as const }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: resolveType === o.key ? o.color : '#555' }}>{o.label}</div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{o.desc}</div>
              </button>
            ))}
          </div>
        </div>
        {(resolveType === 'exchange' || resolveType === 'both' || resolveType === 'additional') && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>수령 수량</div>
            <input type="number" step="0.1" value={recvQty} onChange={e => setRecvQty(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #E8ECF0', fontSize: 14, boxSizing: 'border-box' as const }} />
          </div>
        )}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>처리자 <span style={{ color: '#E84393' }}>*</span></div>
          <input value={resolvedBy} onChange={e => setResolvedBy(e.target.value)} placeholder="처리한 사람 이름" style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #E8ECF0', fontSize: 14, boxSizing: 'border-box' as const }} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>메모 (선택)</div>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="처리 내용, 사유 등" style={{ width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid #E8ECF0', fontSize: 14, boxSizing: 'border-box' as const }} />
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

function AdminIssueModal({ order, userName, onClose, onSaved }: { order: any; userName: string; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [issueType, setIssueType] = useState('wrong_quantity')
  const [memo, setMemo] = useState('')
  async function handleSubmit() {
    await supabase.from('order_issues').insert({ order_id: order.id, store_id: order.store_id, issue_type: issueType, memo: memo.trim() || null, reported_by: userName })
    await supabase.from('orders').update({ status: 'issue' }).eq('id', order.id)
    onSaved(); onClose()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 340 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 16 }}>🚨 이슈 신고</div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>이슈 유형</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {Object.entries(ISSUE_TYPES).map(([k, v]) => (
            <button key={k} onClick={() => setIssueType(k)}
              style={{ padding: '10px 0', borderRadius: 10, border: issueType === k ? '2px solid #E84393' : '1px solid #E8ECF0', background: issueType === k ? 'rgba(232,67,147,0.08)' : '#F8F9FB', color: issueType === k ? '#E84393' : '#888', fontSize: 12, fontWeight: issueType === k ? 700 : 400, cursor: 'pointer' }}>{v}</button>
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

function AdminEditReceiptModal({ receipt, order, userName, onClose, onSaved }: { receipt: any; order: any; userName: string; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [newQty, setNewQty] = useState<number | ''>(receipt.received_quantity)
  const [memo, setMemo] = useState('')
  async function handleSubmit() {
    if (!newQty) return
    await supabase.from('order_receipts').update({ received_quantity: Number(newQty) }).eq('id', receipt.id)
    await supabase.from('order_receipt_logs').insert({ receipt_id: receipt.id, order_id: order.id, changed_by: userName, field_name: '수령수량수정', before_value: `${receipt.received_quantity}${order.unit}`, after_value: `${newQty}${order.unit}`, memo: memo || null })
    onSaved(); onClose()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 340 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>✏️ 수령 수정</div>
        <div style={{ fontSize: 11, color: '#aaa', marginBottom: 16 }}>기존 수령 수량: {receipt.received_quantity}{order.unit}</div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>수정 수량</div>
          <input type="number" step="0.1" value={newQty} onChange={e => setNewQty(e.target.value === '' ? '' : Number(e.target.value))} style={inp} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>수정 사유</div>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="예: 파손 2개" style={inp} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSubmit} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>수정 저장</button>
          <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  )
}

function AdminEditOrderModal({ order, userName, onClose, onSaved }: { order: any; userName: string; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [itemName, setItemName] = useState(order.item_name)
  const [quantity, setQuantity] = useState<number | ''>(order.quantity)
  const [unit, setUnit] = useState(order.unit || 'ea')
  const [memo, setMemo] = useState(order.memo || '')
  const [saving, setSaving] = useState(false)
  async function handleSubmit() {
    if (!itemName.trim() || !quantity) return
    setSaving(true)
    const changes: { field: string; before: string; after: string }[] = []
    if (itemName.trim() !== order.item_name) changes.push({ field: '품목명', before: order.item_name, after: itemName.trim() })
    if (Number(quantity) !== order.quantity) changes.push({ field: '수량', before: `${order.quantity}${order.unit}`, after: `${quantity}${unit}` })
    else if (unit !== order.unit) changes.push({ field: '단위', before: order.unit, after: unit })
    if ((memo.trim() || null) !== (order.memo || null)) changes.push({ field: '메모', before: order.memo || '없음', after: memo.trim() || '없음' })
    await supabase.from('orders').update({ item_name: itemName.trim(), quantity: Number(quantity), unit, memo: memo.trim() || null }).eq('id', order.id)
    if (changes.length > 0) {
      await Promise.all(changes.map(c => supabase.from('order_receipt_logs').insert({ order_id: order.id, changed_by: userName, field_name: `${c.field} 수정`, before_value: c.before, after_value: c.after, memo: null })))
    }
    setSaving(false); onSaved(); onClose()
  }
  async function handleDelete() {
    if (!confirm(`"${order.item_name}" 발주를 삭제할까요?`)) return
    await supabase.from('order_receipt_logs').insert({ order_id: order.id, changed_by: userName, field_name: '발주 삭제', before_value: `${order.item_name} ${order.quantity}${order.unit}`, after_value: '삭제됨', memo: null })
    await supabase.from('orders').delete().eq('id', order.id)
    onSaved(); onClose()
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 360 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>✏️ 발주 수정</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>품목명</div>
          <input value={itemName} onChange={e => setItemName(e.target.value)} style={inp} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 2 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>수량</div>
            <input type="number" step="0.1" value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))} style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>단위</div>
            <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inp, appearance: 'auto' as any }}>
              <option>ea</option><option>box</option><option>kg</option><option>L</option><option>병</option>
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>메모</div>
          <input value={memo} onChange={e => setMemo(e.target.value)} style={inp} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSubmit} disabled={saving} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saving ? '저장 중...' : '수정 저장'}</button>
          <button onClick={handleDelete} style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(232,67,147,0.08)', border: '1px solid rgba(232,67,147,0.2)', color: '#E84393', fontSize: 13, cursor: 'pointer' }}>삭제</button>
          <button onClick={onClose} style={{ padding: '10px 14px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  )
}





// ─── 관리자 발주 추가 모달 (지점 선택 포함) ───
function AdminAddOrderModal({ userName, onClose, onSaved }: { userName: string; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState(STORES[0].id)
  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState<number | ''>('')
  const [unit, setUnit] = useState('ea')
  const [memo, setMemo] = useState('')
  const [linkedItemId, setLinkedItemId] = useState('')
  const [linkedUnit, setLinkedUnit] = useState('ea')
  const [unlinkUnit, setUnlinkUnit] = useState(false)
  const [inventoryItems, setInventoryItems] = useState<any[]>([])
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('inventory_items').select('id, name, unit').eq('store_id', storeId)
      .then(({ data }) => setInventoryItems(data || []))
    setLinkedItemId(''); setItemName(''); setSuggestions([])
  }, [storeId])

  function handleItemNameChange(val: string) {
    setItemName(val)
    if (val.trim()) setSuggestions(inventoryItems.filter(i => i.name.includes(val.trim())).slice(0, 5))
    else { setSuggestions([]); setLinkedItemId(''); setUnlinkUnit(false) }
  }

  function selectInventoryItem(item: any) {
    setItemName(item.name)
    setUnit(item.unit || 'ea')
    setLinkedUnit(item.unit || 'ea')
    setLinkedItemId(item.id)
    setUnlinkUnit(false)
    setSuggestions([])
  }

  async function handleSubmit() {
    if (!itemName.trim() || !quantity) return
    setSaving(true)
    await supabase.from('orders').insert({
      store_id: storeId,
      item_name: itemName.trim(),
      quantity: Number(quantity),
      unit,
      inventory_item_id: (linkedItemId && !unlinkUnit) ? linkedItemId : null,
      memo: memo.trim() || null,
      ordered_by: userName,
      status: 'requested',
    })
    setSaving(false)
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 330, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>📋 발주 추가 (관리자)</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>

        {/* 지점 선택 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>지점 선택 <span style={{ color: '#E84393' }}>*</span></div>
          <div style={{ display: 'flex', gap: 6 }}>
            {STORES.map(s => (
              <button key={s.id} onClick={() => setStoreId(s.id)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: storeId === s.id ? `2px solid ${s.color}` : '1px solid #E8ECF0', background: storeId === s.id ? s.bg : '#F8F9FB', color: storeId === s.id ? s.color : '#888', fontSize: 12, fontWeight: storeId === s.id ? 700 : 400, cursor: 'pointer' }}>
                {s.name}
              </button>
            ))}
          </div>
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
        {linkedItemId && !unlinkUnit && <div style={{ fontSize: 10, color: '#6C5CE7', marginBottom: 10, marginTop: -6 }}>✓ 재고 품목과 연동됨 — 수령 시 재고 자동 반영 가능</div>}
        {linkedItemId && unlinkUnit && <div style={{ fontSize: 10, color: '#B8860B', marginBottom: 10, marginTop: -6 }}>⚠️ 연동 해제됨 — 수령해도 재고에 자동 반영되지 않아요</div>}

        {/* 수량 / 단위 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: linkedItemId ? 6 : 10 }}>
          <div style={{ flex: 2 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>수량 <span style={{ color: '#E84393' }}>*</span></div>
            <input type="number" step="0.1" value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>단위</div>
            {linkedItemId && !unlinkUnit ? (
              <div style={{ ...inp, background: '#F4F6F9', color: '#6C5CE7', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>🔒 {unit}</div>
            ) : (
              <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inp, appearance: 'auto' as any }}>
                <option value="ea">ea</option><option value="box">box</option><option value="kg">kg</option>
                <option value="L">L</option><option value="병">병</option><option value="개">개</option>
              </select>
            )}
          </div>
        </div>

        {linkedItemId && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={unlinkUnit} onChange={e => { setUnlinkUnit(e.target.checked); if (!e.target.checked) setUnit(linkedUnit) }} style={{ width: 14, height: 14, accentColor: '#B8860B' }} />
            <span style={{ fontSize: 11, color: unlinkUnit ? '#B8860B' : '#aaa', fontWeight: unlinkUnit ? 700 : 400 }}>연동이 풀려요 (다른 단위로 발주)</span>
          </label>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>메모</div>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="비고 메모" style={inp} />
        </div>
        <div style={{ fontSize: 11, color: '#aaa', marginBottom: 12 }}>작성자: <strong style={{ color: '#1a1a2e' }}>{userName}</strong></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSubmit} disabled={saving || !itemName.trim() || !quantity}
            style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? '등록 중...' : '발주 등록'}
          </button>
          <button onClick={onClose} style={{ padding: '12px 16px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  )
}

// ─── 이슈 직접 등록 모달 (관리자용 - 지점 선택 포함) ───
function DirectIssueModal({ userName, onClose, onSaved }: { userName: string; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState(STORES[0].id)
  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState<number | ''>(1)
  const [unit, setUnit] = useState('ea')
  const [issueType, setIssueType] = useState('wrong_delivery')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  const issueOptions = [
    { key: 'wrong_delivery', label: '📦 잘못 온 물품', desc: '주문 안 했는데 도착' },
    { key: 'wrong_store',    label: '🏪 지점 오배송',  desc: '다른 지점 것이 옴' },
    { key: 'damaged',        label: '💥 파손 도착',    desc: '파손 상태로 배송됨' },
    { key: 'other',          label: '📝 기타',          desc: '기타 이슈' },
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
        order_id: order.id,
        store_id: storeId,
        issue_type: issueType,
        memo: memo.trim() || null,
        reported_by: userName,
      })
      await supabase.from('order_receipt_logs').insert({
        order_id: order.id,
        changed_by: userName,
        field_name: '이슈 직접 등록',
        before_value: null,
        after_value: `${issueType}: ${itemName.trim()} ${quantity}${unit}`,
        memo: memo.trim() || null,
      })
    }
    setSaving(false)
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 380, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>🚨 이슈 직접 등록</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>

        {/* 지점 선택 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>지점 선택 <span style={{ color: '#E84393' }}>*</span></div>
          <div style={{ display: 'flex', gap: 6 }}>
            {STORES.map(s => (
              <button key={s.id} onClick={() => setStoreId(s.id)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: storeId === s.id ? `2px solid ${s.color}` : '1px solid #E8ECF0', background: storeId === s.id ? s.bg : '#F8F9FB', color: storeId === s.id ? s.color : '#888', fontSize: 12, fontWeight: storeId === s.id ? 700 : 400, cursor: 'pointer' }}>
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* 이슈 유형 */}
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

        {/* 품목명 */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>품목명 <span style={{ color: '#E84393' }}>*</span></div>
          <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="예: 루꼴라 1kg" style={inp} />
        </div>

        {/* 수량 + 단위 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 2 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>수량</div>
            <input type="number" step="0.1" value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))} style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>단위</div>
            <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inp, appearance: 'auto' as any }}>
              <option>ea</option><option>box</option><option>kg</option><option>L</option><option>병</option><option>개</option>
            </select>
          </div>
        </div>

        {/* 메모 */}
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

function AdminOrderCard({ order, userName, places, highlighted, onRefresh }: { order: any; userName: string; places: any[]; highlighted?: boolean; onRefresh: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [expanded, setExpanded] = useState(order.status === 'issue')
  const [showConfirm, setShowConfirm] = useState(false)
  const [showReceive, setShowReceive] = useState(false)
  const [showIssue, setShowIssue] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showEditReceipt, setShowEditReceipt] = useState(false)
  const [showResolve, setShowResolve] = useState(false)
  const [receipt, setReceipt] = useState<any>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [issueData, setIssueData] = useState<any>(null)
  const now = new Date()
  const diffDays = (now.getTime() - new Date(order.ordered_at).getTime()) / 86400000
  const isOverdue = (order.status === 'requested' || order.status === 'ordered') && diffDays > 2
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.requested
  const d = new Date(order.ordered_at)

  useEffect(() => { if (expanded) loadDetail() }, [expanded])

  // 수령완료 상태면 마운트 시 바로 receipt 로드 (헤더 표시용)
  useEffect(() => {
    if (order.status === 'received' && !receipt) loadReceipt()
  }, [])

  // 이슈 상태면 마운트 시 바로 issueData 로드
  useEffect(() => {
    if (order.status === 'issue') loadIssueData()
  }, [])

  async function loadIssueData() {
    const { data: iss } = await supabase.from('order_issues').select('*').eq('order_id', order.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
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
    const { data: iss } = await supabase.from('order_issues').select('*').eq('order_id', order.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    setIssueData(iss || null)
  }

  async function handleCancelReceipt() {
    if (!confirm("수령을 취소할까요?\n재고에 합산된 수량도 자동으로 차감돼요.")) return
    if (order.inventory_item_id) {
      const { data: receipts } = await supabase
        .from("order_receipts")
        .select("received_quantity, inventory_place")
        .eq("order_id", order.id)
      if (receipts) {
        for (const r of receipts) {
          if (r.inventory_place && r.received_quantity) {
            const { data: existing } = await supabase
              .from("inventory_stock")
              .select("quantity")
              .eq("item_id", order.inventory_item_id)
              .eq("place", r.inventory_place)
              .maybeSingle()
            const currentQty = existing?.quantity ?? 0
            await supabase.from("inventory_stock").upsert({
              item_id: order.inventory_item_id,
              place: r.inventory_place,
              quantity: Math.max(0, currentQty - Number(r.received_quantity)),
              updated_by: userName,
              updated_at: new Date().toISOString(),
            }, { onConflict: "item_id,place" })
          }
        }
      }
    }
    await supabase.from("order_receipts").delete().eq("order_id", order.id)
    await supabase.from("orders").update({ status: "ordered", received_by: null, received_at: null }).eq("id", order.id)
    await supabase.from("order_receipt_logs").insert({ order_id: order.id, changed_by: userName, field_name: "수령취소", before_value: "수령완료", after_value: "주문완료(수령취소)", memo: null })
    onRefresh()
  }

  return (
    <>
      {showConfirm && <ConfirmOrderModal order={order} userName={userName} onDone={() => { setShowConfirm(false); onRefresh() }} onClose={() => setShowConfirm(false)} />}
      {showReceive && <ReceiveModal order={order} userName={userName} places={places} onDone={() => { setShowReceive(false); onRefresh() }} onClose={() => setShowReceive(false)} />}
      {showIssue && <AdminIssueModal order={order} userName={userName} onClose={() => setShowIssue(false)} onSaved={onRefresh} />}
      {showEdit && <AdminEditOrderModal order={order} userName={userName} onClose={() => setShowEdit(false)} onSaved={onRefresh} />}
      {showEditReceipt && receipt && <AdminEditReceiptModal receipt={receipt} order={order} userName={userName} onClose={() => setShowEditReceipt(false)} onSaved={() => loadDetail()} />}
      {showResolve && <ResolveIssueModal order={order} userName={userName} onClose={() => setShowResolve(false)} onSaved={() => { setShowResolve(false); onRefresh() }} />}
      <div data-admin-order-id={order.id} style={{ background: '#fff', borderRadius: 14, border: `1px solid ${cfg.color}33`, overflow: 'hidden', boxShadow: highlighted ? `0 0 0 3px ${cfg.color}, 0 2px 12px ${cfg.color}44` : '0 1px 6px rgba(0,0,0,0.06)', transition: 'box-shadow 0.3s' }}>
        <div style={{ background: cfg.headerBg, padding: '7px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{cfg.label}</span>
            {isOverdue && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(0,0,0,0.2)', color: '#fff', fontWeight: 700 }}>⏰ 지연</span>}
            {order.status === 'received' && order.received_by && (
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.9)' }}>· {order.received_by}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <StoreBadge storeId={order.store_id} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>{d.getMonth() + 1}/{d.getDate()}</span>
          </div>
        </div>
        <div style={{ padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>{order.item_name}</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e' }}>{order.quantity}</span>
              <span style={{ fontSize: 11, color: '#aaa' }}>{order.unit}</span>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span>👤 {order.ordered_by}</span>
            {order.supplier_name && <span>🏪 {order.supplier_name}</span>}
            {order.memo && <span>💬 {order.memo}</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {order.status === 'requested' && (
              <button onClick={() => setShowConfirm(true)} style={{ padding: '5px 12px', borderRadius: 8, background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.3)', color: '#6C5CE7', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✅ 주문확인</button>
            )}
            {order.status === 'ordered' && (
              <button onClick={() => setShowReceive(true)} style={{ padding: '5px 12px', borderRadius: 8, background: 'rgba(0,184,148,0.1)', border: '1px solid rgba(0,184,148,0.3)', color: '#00B894', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>📦 수령</button>
            )}
            {order.status === 'received' && (
              <button onClick={handleCancelReceipt} style={{ padding: '5px 12px', borderRadius: 8, background: 'rgba(232,67,147,0.08)', border: '1px solid rgba(232,67,147,0.25)', color: '#E84393', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>↩️ 수령취소</button>
            )}
            {order.status === 'issue' && (
              <button onClick={() => setShowResolve(true)} style={{ padding: '5px 12px', borderRadius: 8, background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.3)', color: '#6C5CE7', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✅ 이슈 해결</button>
            )}
            {order.status === 'issue' && (
              <button onClick={async () => { if (!confirm('이슈를 취소하고 수령전 상태로 되돌릴까요?')) return; await supabase.from('orders').update({ status: 'ordered' }).eq('id', order.id); await supabase.from('order_receipt_logs').insert({ order_id: order.id, changed_by: userName, field_name: '이슈 취소', before_value: '이슈있음', after_value: '주문완료로 되돌림', memo: null }); onRefresh() }} style={{ padding: '5px 12px', borderRadius: 8, background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.25)', color: '#FF6B35', fontSize: 11, cursor: 'pointer' }}>↩️ 이슈취소</button>
            )}
            {!['received', 'returned', 'issue'].includes(order.status) && (
              <button onClick={() => setShowIssue(true)} style={{ padding: '5px 10px', borderRadius: 8, background: 'rgba(232,67,147,0.06)', border: '1px solid rgba(232,67,147,0.2)', color: '#E84393', fontSize: 11, cursor: 'pointer' }}>🚨 이슈</button>
            )}
            <button onClick={() => setShowEdit(true)} style={{ padding: '5px 10px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 11, cursor: 'pointer' }}>✏️ 수정</button>
            <button onClick={() => setExpanded(p => !p)} style={{ padding: '5px 10px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 11, cursor: 'pointer' }}>
              {expanded ? '▲' : '▼ 상세'}
            </button>
          </div>

          {expanded && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #E8ECF0' }}>
              {/* 타임라인 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: '#aaa' }}>
                  📅 요청: {order.ordered_by} · {new Date(order.ordered_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} {new Date(order.ordered_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </div>
                {order.confirmed_by && (
                  <div style={{ fontSize: 10, color: '#6C5CE7' }}>
                    ✅ 주문확인: {order.confirmed_by} · {order.confirmed_at ? `${new Date(order.confirmed_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} ${new Date(order.confirmed_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}` : ''}
                  </div>
                )}
                {order.status === 'issue' && (
                  <div style={{ fontSize: 10, color: '#E84393', background: 'rgba(232,67,147,0.05)', borderRadius: 8, padding: '6px 10px', border: '1px solid rgba(232,67,147,0.15)' }}>
                    🚨 이슈: {issueData ? (
                      <>
                        {issueData.issue_type === 'quantity_mismatch' ? '수량 불일치' :
                         issueData.issue_type === 'wrong_delivery' ? '잘못 온 물품' :
                         issueData.issue_type === 'wrong_store' ? '지점 오배송' :
                         issueData.issue_type === 'damaged' ? '파손 도착' :
                         issueData.issue_type === 'wrong_quantity' ? '수량 오류' :
                         issueData.issue_type === 'wrong_item' ? '품목 오류' :
                         issueData.issue_type === 'other_branch' ? '타지점 물품' : '기타'}
                        {issueData.reported_by && <span style={{ color: '#aaa' }}> · {issueData.reported_by}</span>}
                        {issueData.created_at && <span style={{ color: '#aaa' }}> · {new Date(issueData.created_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} {new Date(issueData.created_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>}
                        {issueData.memo && <div style={{ marginTop: 3, color: '#E84393', fontWeight: 600 }}>📝 {issueData.memo}</div>}
                      </>
                    ) : '이슈 처리 대기 중'}
                  </div>
                )}
                {(order.status === 'received' || receipt) && (order.received_by || receipt) && (
                  <div style={{ fontSize: 10, color: '#00B894' }}>
                    📦 수령: {order.received_by || receipt?.received_by} · {order.received_at ? `${new Date(order.received_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} ${new Date(order.received_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}` : ''}{receipt?.received_quantity ? ` · ${receipt.received_quantity}${order.unit}` : ''}
                    {receipt?.inventory_applied && <span style={{ marginLeft: 4, color: '#2DC6D6' }}>✓ {receipt.inventory_place} 재고반영</span>}
                  </div>
                )}
              </div>

              {/* 수령 수정 버튼 */}
              {receipt && (
                <div style={{ marginBottom: 10 }}>
                  <button onClick={() => setShowEditReceipt(true)} style={{ padding: '4px 10px', borderRadius: 7, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.2)', color: '#FF6B35', fontSize: 10, cursor: 'pointer' }}>✏️ 수령 수정</button>
                </div>
              )}

              {/* 수정이력 */}
              {logs.length > 0 && (
                <div style={{ borderTop: '1px solid #F4F6F9', paddingTop: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', marginBottom: 6 }}>🔍 수정 이력</div>
                  {logs.map((log, i) => (
                    <div key={i} style={{ fontSize: 10, color: '#888', padding: '3px 0', borderBottom: '1px solid #F8F9FB', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
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
      </div>
    </>
  )
}

function AdminStats({ orders, selYear, selMonth }: { orders: any[]; selYear: number; selMonth: number }) {
  const monthly = useMemo(() => orders.filter(o => {
    const d = new Date(o.ordered_at)
    return d.getFullYear() === selYear && d.getMonth() + 1 === selMonth
  }), [orders, selYear, selMonth])
  const totalPending = orders.filter(o => ['requested', 'ordered', 'issue'].includes(o.status)).length

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E8ECF0', padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>{selMonth}월 전체</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#1a1a2e' }}>{monthly.length}</div>
          <div style={{ fontSize: 10, color: '#bbb' }}>건</div>
        </div>
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid rgba(232,67,147,0.3)', padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#E84393', marginBottom: 4 }}>현재 미완료</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#E84393' }}>{totalPending}</div>
          <div style={{ fontSize: 10, color: '#bbb' }}>건</div>
        </div>
      </div>
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E8ECF0', padding: 16, marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 14 }}>🏪 {selMonth}월 지점별 현황</div>
        {STORES.map(s => {
          const st = monthly.filter(o => o.store_id === s.id)
          const received = st.filter(o => o.status === 'received').length
          const issue = st.filter(o => o.status === 'issue').length
          const rate = st.length > 0 ? Math.round((received / st.length) * 100) : 0
          return (
            <div key={s.id} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.name}</span>
                <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#888' }}>
                  <span>총 {st.length}건</span>
                  <span style={{ color: '#00B894' }}>수령 {received}</span>
                  {issue > 0 && <span style={{ color: '#E84393' }}>이슈 {issue}</span>}
                </div>
              </div>
              <div style={{ height: 7, borderRadius: 4, background: '#F4F6F9' }}>
                <div style={{ height: 7, borderRadius: 4, background: `linear-gradient(90deg,${s.color},${s.color}88)`, width: `${rate}%`, transition: 'width 0.4s' }} />
              </div>
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 2, textAlign: 'right' }}>{rate}% 수령완료</div>
            </div>
          )
        })}
      </div>
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E8ECF0', padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>⏳ 현재 미완료 (전체 기간)</div>
        {STORES.map(s => {
          const cnt = orders.filter(o => o.store_id === s.id && ['requested', 'ordered', 'issue'].includes(o.status)).length
          return (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F4F6F9' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: s.color }}>{s.name}</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: cnt > 0 ? '#E84393' : '#00B894' }}>{cnt}건</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type SubTab = 'pending' | 'requested' | 'all' | 'issues' | 'stats'

export default function AdminOrderTab({ userName, places }: { userName: string; places: any[] }) {
  const supabase = createSupabaseBrowserClient()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [storeFilter, setStoreFilter] = useState<string>('all')
  const [subTab, setSubTab] = useState<SubTab>('pending')
  const now = new Date()
  const [selYear, setSelYear] = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(now.getFullYear())

  const [searchQ, setSearchQ] = useState('')
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [showDirectIssue, setShowDirectIssue] = useState(false)
  const [showAddOrder, setShowAddOrder] = useState(false)
  const [showSupplierMgr, setShowSupplierMgr] = useState(false)

  const searchResults = useMemo(() => {
    const q = searchQ.trim()
    if (!q) return []
    return orders.filter(o =>
      o.item_name?.includes(q) || o.ordered_by?.includes(q) || o.memo?.includes(q) || o.supplier_name?.includes(q)
    ).slice(0, 20)
  }, [searchQ, orders])

  function goToOrder(orderId: string) {
    const target = orders.find(o => o.id === orderId)
    if (target) {
      const d = new Date(target.ordered_at)
      setSelYear(d.getFullYear())
      setSelMonth(d.getMonth() + 1)
    }
    setSubTab('all')
    setSearchQ('')
    setHighlightId(orderId)
    setTimeout(() => {
      const el = document.querySelector(`[data-admin-order-id="${orderId}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 300)
    setTimeout(() => setHighlightId(null), 3000)
  }

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    setLoading(true)
    const storeIds = STORES.map(s => s.id)
    const [ordersRes, suppliersRes] = await Promise.all([
      supabase.from('orders').select('*').in('store_id', storeIds).order('ordered_at', { ascending: false }).order('created_at', { ascending: true }),
      supabase.from('order_suppliers').select('*').in('store_id', storeIds),
    ])
    const supplierMap: Record<string, string> = {}
    suppliersRes.data?.forEach((s: any) => { supplierMap[s.id] = s.name })
    setOrders((ordersRes.data || []).map((o: any) => ({ ...o, supplier_name: o.supplier_id ? (supplierMap[o.supplier_id] || null) : null })))
    setLoading(false)
  }

  const visibleOrders   = useMemo(() => storeFilter === 'all' ? orders : orders.filter(o => o.store_id === storeFilter), [orders, storeFilter])
  const pendingOrders   = useMemo(() => visibleOrders.filter(o => ['requested', 'ordered', 'issue'].includes(o.status)), [visibleOrders])
  const requestedOrders = useMemo(() => visibleOrders.filter(o => o.status === 'requested'), [visibleOrders])
  const issueOrders     = useMemo(() => visibleOrders.filter(o => o.status === 'issue'), [visibleOrders])
  const overdueOrders   = useMemo(() => pendingOrders.filter(o => (now.getTime() - new Date(o.ordered_at).getTime()) / 86400000 > 2), [pendingOrders])
  const monthlyOrders   = useMemo(() => visibleOrders.filter(o => {
    const d = new Date(o.ordered_at)
    return d.getFullYear() === selYear && d.getMonth() + 1 === selMonth
  }), [visibleOrders, selYear, selMonth])

  function groupByDate(list: any[]) {
    const map: Record<string, any[]> = {}
    list.forEach(o => {
      const d = new Date(o.ordered_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!map[key]) map[key] = []
      map[key].push(o)
    })
    const so: Record<string, number> = { requested: 0, ordered: 1, issue: 2, received: 3, returned: 4 }
    Object.values(map).forEach(items => items.sort((a, b) => {
      const sa = so[a.status] ?? 5, sb = so[b.status] ?? 5
      return sa !== sb ? sa - sb : new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
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
          return (
            <div key={dateKey} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 8, paddingLeft: 2 }}>
                📅 {d.getMonth() + 1}월 {d.getDate()}일 · {items.length}건
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                {items.map((o: any) => (
                  <AdminOrderCard key={o.id} order={o} userName={userName} places={places} highlighted={highlightId === o.id} onRefresh={loadOrders} />
                ))}
              </div>
            </div>
          )
        })}
      </>
    )
  }

  const tabBtn = (key: SubTab, label: string, badge?: number) => (
    <button key={key} onClick={() => setSubTab(key)} style={{
      flex: 1, padding: '8px 2px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11,
      fontWeight: subTab === key ? 700 : 400,
      background: subTab === key ? '#fff' : 'transparent',
      color: subTab === key ? '#1a1a2e' : '#aaa',
      boxShadow: subTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
      whiteSpace: 'nowrap' as const,
    }}>
      {label}{badge != null && badge > 0 ? <span style={{ marginLeft: 3, background: '#E84393', color: '#fff', borderRadius: 10, fontSize: 9, padding: '1px 4px', fontWeight: 700 }}>{badge}</span> : null}
    </button>
  )

  const needsPicker = subTab === 'all' || subTab === 'stats'

  return (
    <div>
      {showAddOrder && <AdminAddOrderModal userName={userName} onClose={() => setShowAddOrder(false)} onSaved={() => { loadOrders(); setSubTab('pending') }} />
      }{showDirectIssue && <DirectIssueModal userName={userName} onClose={() => setShowDirectIssue(false)} onSaved={() => { loadOrders(); setSubTab('issues') }} />
      }{showSupplierMgr && <SupplierModal storeIds={STORES.map(s => s.id)} onClose={() => setShowSupplierMgr(false)} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>👑 관리자 발주 현황</span>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>전지점 통합 뷰</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowSupplierMgr(true)} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(45,198,214,0.1)', border: '1px solid rgba(45,198,214,0.3)', color: '#2DC6D6', fontSize: 11, cursor: 'pointer' }}>🏪 발주처</button>
          <button onClick={() => setShowAddOrder(true)} style={{ padding: '6px 12px', borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ 발주 추가</button>
          <button onClick={() => setShowDirectIssue(true)} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(232,67,147,0.1)', border: '1px solid rgba(232,67,147,0.3)', color: '#E84393', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🚨 이슈등록</button>
          <button onClick={loadOrders} style={{ padding: '6px 12px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 11, cursor: 'pointer' }}>🔄 새로고침</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {[{ id: 'all', name: '전체', color: '#1a1a2e', bg: 'rgba(26,26,46,0.08)' }, ...STORES].map(s => {
          const active = storeFilter === s.id
          return (
            <button key={s.id} onClick={() => setStoreFilter(s.id)} style={{
              padding: '7px 14px', borderRadius: 10,
              border: active ? `1.5px solid ${s.color}` : '1px solid #E8ECF0',
              background: active ? (s.id === 'all' ? '#1a1a2e' : s.bg) : '#F4F6F9',
              color: active ? (s.id === 'all' ? '#fff' : s.color) : '#888',
              fontSize: 12, fontWeight: active ? 700 : 400, cursor: 'pointer'
            }}>{s.name}</button>
          )
        })}
      </div>

      <div style={{ display: 'flex', background: '#F4F6F9', borderRadius: 10, padding: 3, marginBottom: 10, gap: 1 }}>
        {tabBtn('pending',   '미완료',   pendingOrders.length)}
        {tabBtn('requested', '주문요청', requestedOrders.length)}
        {tabBtn('all',       '전체내역')}
        {tabBtn('issues',    '이슈',     issueOrders.length)}
        {tabBtn('stats',     '📊 통계')}
      </div>

      {needsPicker && (
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => { setPickerYear(selYear); setShowPicker(true) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #E0E4E8', background: '#F8F9FB', color: '#1a1a2e', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
            📅 {selYear}년 {selMonth}월 ▾
          </button>
          {showPicker && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowPicker(false)}>
              <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 340 }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <button onClick={() => setPickerYear(y => y - 1)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E8ECF0', background: '#F4F6F9', cursor: 'pointer', fontSize: 16, color: '#888' }}>‹</button>
                  <span style={{ fontSize: 17, fontWeight: 700 }}>{pickerYear}년</span>
                  <button onClick={() => setPickerYear(y => y + 1)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E8ECF0', background: '#F4F6F9', cursor: 'pointer', fontSize: 16, color: '#888' }}>›</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                    const isSel = pickerYear === selYear && m === selMonth
                    return (
                      <button key={m} onClick={() => { setSelYear(pickerYear); setSelMonth(m); setShowPicker(false) }}
                        style={{ padding: '12px 0', borderRadius: 12, border: isSel ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: isSel ? 'linear-gradient(135deg,#6C5CE7,#a29bfe)' : '#F8F9FB', color: isSel ? '#fff' : '#1a1a2e', fontSize: 14, fontWeight: isSel ? 700 : 400, cursor: 'pointer' }}>
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
        <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>불러오는 중...</div>
      ) : (
        <>
          {subTab === 'pending' && (
            <>
              {overdueOrders.length > 0 && (
                <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(232,67,147,0.08)', border: '1px solid rgba(232,67,147,0.2)', marginBottom: 10, fontSize: 11, color: '#E84393', fontWeight: 600 }}>
                  🔴 2일 이상 미수령 {overdueOrders.length}건 있어요!
                </div>
              )}
              {pendingOrders.length === 0
                ? <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>🎉 전지점 미완료 발주가 없어요!</div>
                : <DateGroupedList list={pendingOrders} />}
            </>
          )}
          {subTab === 'requested' && (
            requestedOrders.length === 0
              ? <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>📋 주문요청 대기 중인 발주가 없어요</div>
              : <DateGroupedList list={requestedOrders} />
          )}
          {subTab === 'all' && (
            <>
              {/* 검색창 */}
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#aaa' }}>🔍</span>
                <input
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  placeholder="품목명, 발주자, 메모 검색 (전체 기간)..."
                  style={{ width: '100%', padding: '9px 32px 9px 32px', borderRadius: 10, border: '1px solid #E0E4E8', background: '#F8F9FB', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, color: '#1a1a2e' }}
                />
                {searchQ && (
                  <button onClick={() => setSearchQ('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 14 }}>✕</button>
                )}
                {searchQ.trim() && searchResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', borderRadius: 12, border: '1px solid #E0E4E8', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', marginTop: 4, maxHeight: 320, overflowY: 'auto' }}>
                    {searchResults.map(o => {
                      const cfg = STATUS_CONFIG[o.status]
                      const store = STORES.find(s => s.id === o.store_id)
                      const d = new Date(o.ordered_at)
                      return (
                        <div key={o.id} onClick={() => goToOrder(o.id)}
                          style={{ padding: '10px 14px', borderBottom: '1px solid #F4F6F9', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#F8F9FB')}
                          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                        >
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg?.color || '#aaa', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 2 }}>{o.item_name}</div>
                            <div style={{ fontSize: 11, color: '#aaa' }}>
                              {d.getFullYear()}년 {d.getMonth()+1}월 {d.getDate()}일 · {o.ordered_by} · {o.quantity}{o.unit}
                              {store && <span style={{ marginLeft: 6, color: store.color }}>{store.name}</span>}
                            </div>
                          </div>
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: (cfg?.color || '#aaa') + '18', color: cfg?.color || '#888', fontWeight: 700, flexShrink: 0 }}>
                            {cfg?.label || o.status}
                          </span>
                        </div>
                      )
                    })}
                    {searchResults.length === 20 && (
                      <div style={{ padding: '8px 14px', fontSize: 11, color: '#bbb', textAlign: 'center' }}>상위 20건만 표시됩니다</div>
                    )}
                  </div>
                )}
                {searchQ.trim() && searchResults.length === 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#fff', borderRadius: 12, border: '1px solid #E0E4E8', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', marginTop: 4, padding: '16px', textAlign: 'center', fontSize: 13, color: '#bbb' }}>
                    검색 결과가 없어요
                  </div>
                )}
              </div>
              {monthlyOrders.length === 0
                ? <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>{selYear}년 {selMonth}월 발주 내역이 없어요</div>
                : <DateGroupedList list={monthlyOrders} />}
            </>
          )}
          {subTab === 'issues' && (
            issueOrders.length === 0
              ? <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>✅ 전지점 이슈가 없어요!</div>
              : <DateGroupedList list={issueOrders} />
          )}
          {subTab === 'stats' && <AdminStats orders={visibleOrders} selYear={selYear} selMonth={selMonth} />}
        </>
      )}
    </div>
  )
}