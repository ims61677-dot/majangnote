'use client'
import { useEffect, useState, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }

const STORES = [
  { id: '00000000-0000-0000-0000-000000000001', name: '고덕점', color: '#6C5CE7' },
  { id: '799f3381-c122-4327-8b57-f17ddd632cd6', name: '비전점', color: '#00B894' },
  { id: 'ec48ac26-baa1-407e-89df-1331dffd2b31', name: '스타필드', color: '#FF6B35' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; headerBg: string }> = {
  requested: { label: '📋 주문요청', color: '#FF6B35', headerBg: 'linear-gradient(135deg,#FF6B35,#ff9a6c)' },
  ordered:   { label: '✅ 주문완료', color: '#6C5CE7', headerBg: 'linear-gradient(135deg,#6C5CE7,#a29bfe)' },
  received:  { label: '📦 수령완료', color: '#00B894', headerBg: 'linear-gradient(135deg,#00B894,#2DC6D6)' },
  issue:     { label: '⚠️ 이슈있음', color: '#E84393', headerBg: 'linear-gradient(135deg,#E84393,#fd79a8)' },
  returned:  { label: '↩️ 반품완료', color: '#999',    headerBg: 'linear-gradient(135deg,#bbb,#ddd)' },
  pending:   { label: '⏳ 미수령',   color: '#B8860B', headerBg: 'linear-gradient(135deg,#B8860B,#e0a030)' },
}

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

// ─── 관리자 발주 추가 모달 ───
function AdminAddOrderModal({ suppliers, units, onUnitsUpdate, onClose, onSaved }: {
  suppliers: any[]
  units: string[]; onUnitsUpdate: (u: string[]) => void
  onClose: () => void; onSaved: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState(STORES[0].id)
  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState<number | ''>('')
  const [unit, setUnit] = useState(units[0] || 'ea')
  const [memo, setMemo] = useState('')
  const [requestedAt, setRequestedAt] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [status, setStatus] = useState('requested')
  const [showUnitMgr, setShowUnitMgr] = useState(false)

  async function handleSubmit() {
    if (!itemName.trim() || !quantity || !storeId) return
    const selSupplier = suppliers.find(s => s.id === supplierId)
    const finalSupplierName = selSupplier?.name || supplierName.trim() || null
    await supabase.from('orders').insert({
      store_id: storeId,
      item_name: itemName.trim(),
      quantity: Number(quantity),
      unit,
      supplier_id: supplierId || null,
      supplier_name: finalSupplierName,
      memo: memo.trim() || null,
      requested_at: requestedAt ? new Date(requestedAt).toISOString() : null,
      ordered_by: '관리자',
      status,
    })
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      {showUnitMgr && (
        <UnitManagerModal
          storeId={STORES[0].id}
          units={units}
          onClose={() => setShowUnitMgr(false)}
          onUpdate={onUnitsUpdate}
        />
      )}
      <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>📋 발주 추가 (관리자)</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>

        {/* 지점 선택 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>지점 <span style={{ color: '#E84393' }}>*</span></div>
          <div style={{ display: 'flex', gap: 8 }}>
            {STORES.map(s => (
              <button key={s.id} onClick={() => setStoreId(s.id)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: storeId === s.id ? `2px solid ${s.color}` : '1px solid #E8ECF0', background: storeId === s.id ? `rgba(${s.color === '#6C5CE7' ? '108,92,231' : s.color === '#00B894' ? '0,184,148' : '255,107,53'},0.1)` : '#F8F9FB', color: storeId === s.id ? s.color : '#888', fontSize: 13, fontWeight: storeId === s.id ? 700 : 400, cursor: 'pointer' }}>
                {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* 품목명 */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>품목명 <span style={{ color: '#E84393' }}>*</span></div>
          <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="품목명 입력" style={inp} />
        </div>

        {/* 수량 / 단위 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 2 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>수량 <span style={{ color: '#E84393' }}>*</span></div>
            <input type="number" value={quantity} onChange={e => setQuantity(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" style={inp} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 11, color: '#888' }}>단위</div>
              <button onClick={() => setShowUnitMgr(true)} style={{ fontSize: 10, color: '#6C5CE7', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>⚙️ 관리</button>
            </div>
            <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inp, appearance: 'auto' as any }}>
              {units.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        {/* 발주처 */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>발주처</div>
          {suppliers.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              <button onClick={() => { setSupplierId(''); setSupplierName('') }}
                style={{ padding: '4px 10px', borderRadius: 16, border: !supplierId ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: !supplierId ? 'rgba(108,92,231,0.1)' : '#F8F9FB', color: !supplierId ? '#6C5CE7' : '#888', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>미지정</button>
              {suppliers.map(s => (
                <button key={s.id} onClick={() => { setSupplierId(s.id); setSupplierName('') }}
                  style={{ padding: '4px 10px', borderRadius: 16, border: supplierId === s.id ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: supplierId === s.id ? 'rgba(108,92,231,0.1)' : '#F8F9FB', color: supplierId === s.id ? '#6C5CE7' : '#888', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{s.name}</button>
              ))}
            </div>
          )}
          <input value={supplierId ? '' : supplierName} onChange={e => { setSupplierName(e.target.value); setSupplierId('') }} placeholder="직접 입력" style={{ ...inp, fontSize: 12 }} disabled={!!supplierId} />
        </div>

        {/* 상태 */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>상태</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['requested', 'ordered', 'received'] as const).map(s => (
              <button key={s} onClick={() => setStatus(s)}
                style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: status === s ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: status === s ? 'rgba(108,92,231,0.1)' : '#F8F9FB', color: status === s ? '#6C5CE7' : '#888', fontSize: 11, fontWeight: status === s ? 700 : 400, cursor: 'pointer' }}>
                {s === 'requested' ? '요청' : s === 'ordered' ? '주문완료' : '수령완료'}
              </button>
            ))}
          </div>
        </div>

        {/* 날짜 / 메모 */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>발주 요청 날짜 (선택)</div>
          <input type="date" value={requestedAt} onChange={e => setRequestedAt(e.target.value)} style={inp} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>메모</div>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="비고 메모" style={inp} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSubmit} style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>발주 등록</button>
          <button onClick={onClose} style={{ padding: '12px 16px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  )
}

// ─── 관리자 발주 수정 모달 ───
function AdminEditOrderModal({ order, suppliers, units, onClose, onSaved }: { order: any; suppliers: any[]; units: string[]; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [itemName, setItemName] = useState(order.item_name)
  const [quantity, setQuantity] = useState<number | ''>(order.quantity)
  const [unit, setUnit] = useState(order.unit || units[0] || 'ea')
  const [memo, setMemo] = useState(order.memo || '')
  const [supplierId, setSupplierId] = useState(order.supplier_id || '')
  const [supplierName, setSupplierName] = useState(order.supplier_name || '')
  const [status, setStatus] = useState(order.status)

  async function handleSubmit() {
    if (!itemName.trim() || !quantity) return
    const selSupplier = suppliers.find(s => s.id === supplierId)
    const finalSupplierName = selSupplier?.name || supplierName.trim() || null
    await supabase.from('orders').update({
      item_name: itemName.trim(), quantity: Number(quantity), unit,
      memo: memo.trim() || null, status,
      supplier_id: supplierId || null, supplier_name: finalSupplierName,
    }).eq('id', order.id)
    onSaved(); onClose()
  }

  async function handleDelete() {
    if (!confirm(`"${order.item_name}" 발주를 삭제할까요?`)) return
    await supabase.from('orders').delete().eq('id', order.id)
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>✏️ 발주 수정 (관리자)</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>품목명</div>
          <input value={itemName} onChange={e => setItemName(e.target.value)} style={inp} />
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
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>발주처</div>
          {suppliers.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              <button onClick={() => { setSupplierId(''); setSupplierName('') }}
                style={{ padding: '4px 10px', borderRadius: 16, border: !supplierId ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: !supplierId ? 'rgba(108,92,231,0.1)' : '#F8F9FB', color: !supplierId ? '#6C5CE7' : '#888', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>미지정</button>
              {suppliers.map(s => (
                <button key={s.id} onClick={() => { setSupplierId(s.id); setSupplierName('') }}
                  style={{ padding: '4px 10px', borderRadius: 16, border: supplierId === s.id ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: supplierId === s.id ? 'rgba(108,92,231,0.1)' : '#F8F9FB', color: supplierId === s.id ? '#6C5CE7' : '#888', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{s.name}</button>
              ))}
            </div>
          )}
          <input value={supplierId ? '' : supplierName} onChange={e => { setSupplierName(e.target.value); setSupplierId('') }} placeholder="직접 입력" style={{ ...inp, fontSize: 12 }} disabled={!!supplierId} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>상태</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['requested', 'ordered', 'received', 'issue', 'returned'] as const).map(s => (
              <button key={s} onClick={() => setStatus(s)}
                style={{ padding: '6px 10px', borderRadius: 8, border: status === s ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: status === s ? 'rgba(108,92,231,0.1)' : '#F8F9FB', color: status === s ? '#6C5CE7' : '#888', fontSize: 11, fontWeight: status === s ? 700 : 400, cursor: 'pointer' }}>
                {STATUS_CONFIG[s]?.label || s}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>메모</div>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="비고 메모" style={inp} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleDelete} style={{ padding: '11px 14px', borderRadius: 10, background: 'rgba(232,67,147,0.08)', border: '1px solid rgba(232,67,147,0.2)', color: '#E84393', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>🗑 삭제</button>
          <button onClick={handleSubmit} style={{ flex: 1, padding: '11px 0', borderRadius: 10, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>수정 완료</button>
          <button onClick={onClose} style={{ padding: '11px 14px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  )
}

// ─── 이슈 직접 등록 모달 (관리자) ───
function DirectIssueModal({ storeId, units, onClose, onSaved }: { storeId: string; units: string[]; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [selStoreId, setSelStoreId] = useState(storeId)
  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState<number | ''>(1)
  const [unit, setUnit] = useState(units[0] || 'ea')
  const [issueType, setIssueType] = useState('wrong_delivery')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  const issueOptions = [
    { key: 'wrong_delivery', label: '📦 잘못 온 물품' },
    { key: 'wrong_store',    label: '🏪 지점 오배송' },
    { key: 'damaged',        label: '💥 파손 도착' },
    { key: 'other',          label: '📝 기타' },
  ]

  async function handleSubmit() {
    if (!itemName.trim() || !quantity) return
    setSaving(true)
    const { data: order } = await supabase.from('orders').insert({
      store_id: selStoreId,
      item_name: itemName.trim(),
      quantity: Number(quantity),
      unit,
      ordered_by: '관리자',
      ordered_at: new Date().toISOString(),
      status: 'issue',
      memo: memo.trim() || null,
    }).select().single()

    if (order) {
      await supabase.from('order_issues').insert({
        order_id: order.id, store_id: selStoreId, issue_type: issueType,
        memo: memo.trim() || null, reported_by: '관리자',
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
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>지점</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {STORES.map(s => (
              <button key={s.id} onClick={() => setSelStoreId(s.id)}
                style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: selStoreId === s.id ? `2px solid ${s.color}` : '1px solid #E8ECF0', background: selStoreId === s.id ? `rgba(${s.color === '#6C5CE7' ? '108,92,231' : s.color === '#00B894' ? '0,184,148' : '255,107,53'},0.1)` : '#F8F9FB', color: selStoreId === s.id ? s.color : '#888', fontSize: 11, fontWeight: selStoreId === s.id ? 700 : 400, cursor: 'pointer' }}>
                {s.name}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>이슈 유형</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {issueOptions.map(o => (
              <button key={o.key} onClick={() => setIssueType(o.key)}
                style={{ padding: '10px 8px', borderRadius: 10, border: issueType === o.key ? '2px solid #E84393' : '1px solid #E8ECF0', background: issueType === o.key ? 'rgba(232,67,147,0.08)' : '#F8F9FB', color: issueType === o.key ? '#E84393' : '#555', fontSize: 12, fontWeight: issueType === o.key ? 700 : 400, cursor: 'pointer' }}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>품목명 *</div>
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

// ─── 관리자 주문 확인 모달 ───
function AdminConfirmOrderModal({ order, suppliers, units, onClose, onSaved }: {
  order: any; suppliers: any[]; units: string[]; onClose: () => void; onSaved: () => void
}) {
  const supabase = createSupabaseBrowserClient()
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
      confirmed_by: '관리자',
      confirmed_at: new Date().toISOString(),
      supplier_id: supplierId || null,
      supplier_name: finalSupplierName,
      memo: memo.trim() ? (order.memo ? order.memo + ' / ' + memo.trim() : memo.trim()) : order.memo,
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
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>✅ 주문 확인 (관리자)</div>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>{order.item_name} · {order.quantity}{order.unit}</div>
        <div style={{ background: '#F8F9FB', borderRadius: 10, padding: '10px 12px', marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>📋 요청 정보</div>
          <div style={{ fontSize: 12, color: '#1a1a2e' }}>{order.ordered_by} · {new Date(order.ordered_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} {new Date(order.ordered_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
        </div>

        {/* 발주처 */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>발주처</div>
          {suppliers.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              <button onClick={() => { setSupplierId(''); setSupplierName('') }}
                style={{ padding: '4px 10px', borderRadius: 16, border: !supplierId && !supplierName ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: !supplierId && !supplierName ? 'rgba(108,92,231,0.1)' : '#F8F9FB', color: !supplierId && !supplierName ? '#6C5CE7' : '#888', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>미지정</button>
              {suppliers.map(s => (
                <button key={s.id} onClick={() => { setSupplierId(s.id); setSupplierName('') }}
                  style={{ padding: '4px 10px', borderRadius: 16, border: supplierId === s.id ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: supplierId === s.id ? 'rgba(108,92,231,0.1)' : '#F8F9FB', color: supplierId === s.id ? '#6C5CE7' : '#888', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{s.name}</button>
              ))}
            </div>
          )}
          <input value={supplierId ? '' : supplierName} onChange={e => { setSupplierName(e.target.value); setSupplierId('') }} placeholder="직접 입력" style={{ ...inp, fontSize: 12 }} disabled={!!supplierId} />
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

// ─── 관리자 발주 카드 ───
function AdminOrderCard({ order, suppliers, units, onRefresh }: { order: any; suppliers: any[]; units: string[]; onRefresh: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [expanded, setExpanded] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const store = STORES.find(s => s.id === order.store_id)
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending

  async function handleStatusChange(newStatus: string) {
    await supabase.from('orders').update({
      status: newStatus,
      ...(newStatus === 'received' ? { received_at: new Date().toISOString(), received_by: '관리자' } : {}),
    }).eq('id', order.id)
    onRefresh()
  }

  return (
    <>
      {showEdit && <AdminEditOrderModal order={order} suppliers={suppliers} units={units} onClose={() => setShowEdit(false)} onSaved={onRefresh} />}
      {showConfirm && <AdminConfirmOrderModal order={order} suppliers={suppliers} units={units} onClose={() => setShowConfirm(false)} onSaved={onRefresh} />}
      <div style={{ background: '#fff', borderRadius: 14, marginBottom: 8, border: `1px solid ${cfg.color}33`, overflow: 'hidden', boxShadow: '0 1px 5px rgba(0,0,0,0.05)' }}>
        <div style={{ background: cfg.headerBg, padding: '6px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.3)', color: '#fff' }}>{store?.name || '?'}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{cfg.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={e => { e.stopPropagation(); setShowEdit(true) }} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.2)', color: '#fff', cursor: 'pointer' }}>✏️</button>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.85)' }}>{new Date(order.ordered_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })}</span>
          </div>
        </div>

        <div onClick={() => setExpanded(v => !v)} style={{ cursor: 'pointer', padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>{order.item_name}</span>
            <span style={{ fontSize: 11, color: '#ccc' }}>{expanded ? '▲' : '▼'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#1a1a2e', background: '#F0F2F8', padding: '2px 10px', borderRadius: 6 }}>{order.quantity}<span style={{ fontSize: 12, fontWeight: 600, color: '#888', marginLeft: 2 }}>{order.unit}</span></span>
            {order.supplier_name && <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: 'rgba(45,198,214,0.1)', color: '#2DC6D6' }}>🏪 {order.supplier_name}</span>}
          </div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
            {order.ordered_by} · {new Date(order.ordered_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}
            {order.memo && <span style={{ color: '#bbb' }}> · 📝 {order.memo}</span>}
          </div>
        </div>

        {order.status === 'requested' && (
          <div style={{ display: 'flex', borderTop: '1px solid #F0F2F5' }}>
            <button onClick={() => setShowConfirm(true)} style={{ flex: 1, padding: '9px 0', background: 'linear-gradient(135deg,#6C5CE7,#a29bfe)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', borderBottomLeftRadius: 10 }}>✅ 주문완료</button>
            <button onClick={() => handleStatusChange('received')} style={{ flex: 1, padding: '9px 0', background: 'linear-gradient(135deg,#00B894,#2DC6D6)', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', borderBottomRightRadius: 10 }}>📦 수령완료</button>
          </div>
        )}
        {order.status === 'ordered' && (
          <div style={{ display: 'flex', borderTop: '1px solid #F0F2F5' }}>
            <button onClick={() => handleStatusChange('received')} style={{ flex: 1, padding: '9px 0', background: 'linear-gradient(135deg,#00B894,#2DC6D6)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>📦 수령완료 처리</button>
          </div>
        )}
      </div>
    </>
  )
}

// ─── 관리자 통계 ───
function AdminStats({ orders }: { orders: any[] }) {
  const byStore: Record<string, { total: number; received: number; issue: number }> = {}
  STORES.forEach(s => { byStore[s.id] = { total: 0, received: 0, issue: 0 } })
  orders.forEach(o => {
    if (!byStore[o.store_id]) return
    byStore[o.store_id].total++
    if (o.status === 'received') byStore[o.store_id].received++
    if (o.status === 'issue') byStore[o.store_id].issue++
  })

  const byStatus: Record<string, number> = {}
  orders.forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + 1 })

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>지점별 현황</div>
      {STORES.map(s => {
        const stat = byStore[s.id]
        const pct = stat.total > 0 ? Math.round(stat.received / stat.total * 100) : 0
        return (
          <div key={s.id} style={{ ...bx }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.name}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(0,184,148,0.1)', color: '#00B894', fontWeight: 700 }}>수령 {stat.received}</span>
                {stat.issue > 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(232,67,147,0.1)', color: '#E84393', fontWeight: 700 }}>이슈 {stat.issue}</span>}
                <span style={{ fontSize: 11, color: '#aaa' }}>총 {stat.total}</span>
              </div>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: '#F0F2F8', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, background: s.color, width: `${pct}%`, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontSize: 10, color: '#aaa', marginTop: 4, textAlign: 'right' }}>수령률 {pct}%</div>
          </div>
        )
      })}
      <div style={{ ...bx }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>상태별 현황</div>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
          const cnt = byStatus[key] || 0
          if (cnt === 0) return null
          return (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #F4F6F9' }}>
              <span style={{ fontSize: 12, color: '#555' }}>{cfg.label}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{cnt}건</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ═══════════════════════════════════════
// 메인 AdminOrderTab
// ═══════════════════════════════════════
export default function AdminOrderTab({ userName, places }: { userName?: string; places?: any[] } = {}) {
  const supabase = createSupabaseBrowserClient()
  const [allOrders, setAllOrders] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [units, setUnits] = useState<string[]>(DEFAULT_UNITS)
  const [selStore, setSelStore] = useState<string | 'all'>('all')
  const [subTab, setSubTab] = useState<'pending' | 'requested' | 'all' | 'issues' | 'stats'>('pending')
  const [showAddOrder, setShowAddOrder] = useState(false)
  const [showDirectIssue, setShowDirectIssue] = useState(false)
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const [selYear, setSelYear] = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(now.getFullYear())

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [ordersRes, suppliersRes] = await Promise.all([
      supabase.from('orders').select('*').order('ordered_at', { ascending: false }),
      supabase.from('order_suppliers').select('*').order('created_at'),
    ])
    setAllOrders(ordersRes.data || [])
    setSuppliers(suppliersRes.data || [])
    loadUnits()
    setLoading(false)
  }

  async function loadUnits() {
    const { data } = await supabase.from('store_settings').select('value').eq('store_id', STORES[0].id).eq('key', 'custom_units').maybeSingle()
    if (data?.value) {
      try { setUnits(JSON.parse(data.value)) } catch {}
    }
  }

  const filteredOrders = useMemo(() => {
    let list = allOrders
    if (selStore !== 'all') list = list.filter(o => o.store_id === selStore)
    if (subTab === 'all') {
      list = list.filter(o => {
        const d = new Date(o.ordered_at)
        return d.getFullYear() === selYear && d.getMonth() + 1 === selMonth
      })
    }
    return list
  }, [allOrders, selStore, subTab, selYear, selMonth])

  const pendingOrders = useMemo(() => filteredOrders.filter(o => ['requested', 'ordered', 'pending', 'issue'].includes(o.status)), [filteredOrders])
  const requestedOrders = useMemo(() => allOrders.filter(o => o.status === 'requested' && (selStore === 'all' || o.store_id === selStore)), [allOrders, selStore])
  const issueOrders = useMemo(() => allOrders.filter(o => o.status === 'issue' && (selStore === 'all' || o.store_id === selStore)), [allOrders, selStore])

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
          return (
            <div key={dateKey} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6C5CE7', background: 'rgba(108,92,231,0.1)', padding: '3px 10px', borderRadius: 20 }}>📅 {label}</div>
                <div style={{ flex: 1, height: 1, background: '#E8ECF0' }} />
                <span style={{ fontSize: 10, color: '#aaa' }}>{items.length}건</span>
              </div>
              {items.map(o => <AdminOrderCard key={o.id} order={o} suppliers={suppliers} units={units} onRefresh={loadAll} />)}
            </div>
          )
        })}
      </>
    )
  }

  const tabBtn = (key: typeof subTab, label: string, badge?: number) => (
    <button onClick={() => setSubTab(key)} style={{
      flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11,
      fontWeight: subTab === key ? 700 : 400, background: subTab === key ? '#fff' : 'transparent',
      color: subTab === key ? '#1a1a2e' : '#aaa', boxShadow: subTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
    }}>
      {label}
      {badge !== undefined && badge > 0 && <span style={{ marginLeft: 4, fontSize: 9, padding: '1px 5px', borderRadius: 8, background: '#E84393', color: '#fff', fontWeight: 700 }}>{badge}</span>}
    </button>
  )

  return (
    <div>
      {showAddOrder && <AdminAddOrderModal suppliers={suppliers} units={units} onUnitsUpdate={setUnits} onClose={() => setShowAddOrder(false)} onSaved={loadAll} />}
      {showDirectIssue && <DirectIssueModal storeId={STORES[0].id} units={units} onClose={() => setShowDirectIssue(false)} onSaved={loadAll} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>📋 전지점 발주 관리</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowDirectIssue(true)} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(232,67,147,0.1)', border: '1px solid rgba(232,67,147,0.3)', color: '#E84393', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🚨 이슈</button>
          <button onClick={() => setShowAddOrder(true)} style={{ padding: '6px 12px', borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ 발주 추가</button>
        </div>
      </div>

      {/* 지점 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', paddingBottom: 4 }}>
        <button onClick={() => setSelStore('all')}
          style={{ padding: '7px 14px', borderRadius: 20, border: selStore === 'all' ? '2px solid #1a1a2e' : '1px solid #E8ECF0', background: selStore === 'all' ? '#1a1a2e' : '#F8F9FB', color: selStore === 'all' ? '#fff' : '#888', fontSize: 12, fontWeight: selStore === 'all' ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          전체
        </button>
        {STORES.map(s => (
          <button key={s.id} onClick={() => setSelStore(s.id)}
            style={{ padding: '7px 14px', borderRadius: 20, border: selStore === s.id ? `2px solid ${s.color}` : '1px solid #E8ECF0', background: selStore === s.id ? s.color : '#F8F9FB', color: selStore === s.id ? '#fff' : '#888', fontSize: 12, fontWeight: selStore === s.id ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {s.name}
            <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.8 }}>
              {allOrders.filter(o => o.store_id === s.id && ['requested', 'ordered', 'pending'].includes(o.status)).length || ''}
            </span>
          </button>
        ))}
      </div>

      {/* 서브 탭 */}
      <div style={{ display: 'flex', background: '#F4F6F9', borderRadius: 10, padding: 3, marginBottom: 10, gap: 1 }}>
        {tabBtn('pending', `미완료`, pendingOrders.length)}
        {tabBtn('requested', '주문요청', requestedOrders.length)}
        {tabBtn('all', '전체내역')}
        {tabBtn('issues', '이슈', issueOrders.length)}
        {tabBtn('stats', '📊 통계')}
      </div>

      {subTab === 'all' && (
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
                  <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>{pickerYear}년</span>
                  <button onClick={() => setPickerYear(y => y + 1)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #E8ECF0', background: '#F4F6F9', cursor: 'pointer', fontSize: 16, color: '#888' }}>›</button>
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
          {subTab === 'pending' && (pendingOrders.length === 0 ? <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>🎉 미완료 발주가 없어요!</div> : <DateGroupedList list={pendingOrders} />)}
          {subTab === 'requested' && (requestedOrders.length === 0 ? <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>📋 주문요청 대기 중인 발주가 없어요</div> : <DateGroupedList list={requestedOrders} />)}
          {subTab === 'all' && (filteredOrders.length === 0 ? <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>{selYear}년 {selMonth}월 발주 내역이 없어요</div> : <DateGroupedList list={filteredOrders} />)}
          {subTab === 'issues' && (issueOrders.length === 0 ? <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>✅ 이슈가 없어요</div> : <DateGroupedList list={issueOrders} />)}
          {subTab === 'stats' && <AdminStats orders={selStore === 'all' ? allOrders : allOrders.filter(o => o.store_id === selStore)} />}
        </>
      )}
    </div>
  )
}