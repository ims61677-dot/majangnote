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
function AdminAddOrderModal({ units, onUnitsUpdate, onClose, onSaved }: {
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
  const [status, setStatus] = useState('requested')
  const [showUnitMgr, setShowUnitMgr] = useState(false)

  async function handleSubmit() {
    if (!itemName.trim() || !quantity || !storeId) return
    await supabase.from('orders').insert({
      store_id: storeId,
      item_name: itemName.trim(),
      quantity: Number(quantity),
      unit,
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
  // ─── 결산 연동 필드 ───
  const [amount, setAmount] = useState<number | ''>(order.settlement_amount || '')
  const [unitPrice, setUnitPrice] = useState<number | ''>(order.settlement_unit_price || '')
  const [priceUnit, setPriceUnit] = useState(order.price_unit || units[0] || 'ea')
  const [hasDelivery, setHasDelivery] = useState(!!(order.delivery_fee && order.delivery_fee > 0))
  const [deliveryFee, setDeliveryFee] = useState<number | ''>(order.delivery_fee || '')
  const [paymentMethod, setPaymentMethod] = useState(order.payment_method || '')
  const [showSettlement, setShowSettlement] = useState(!!(order.settlement_amount || order.payment_method))

  async function handleSubmit() {
    if (!itemName.trim() || !quantity) return
    const selSupplier = suppliers.find(s => s.id === supplierId)
    const finalSupplierName = selSupplier?.name || supplierName.trim() || null

    // 변경 내역 로그 생성
    const logEntries: any[] = []
    const now = new Date().toISOString()
    if (itemName.trim() !== order.item_name) logEntries.push({ order_id: order.id, changed_by: '관리자', field_name: '품목명 수정', before_value: order.item_name, after_value: itemName.trim(), changed_at: now })
    if (Number(quantity) !== order.quantity) logEntries.push({ order_id: order.id, changed_by: '관리자', field_name: '수량 수정', before_value: String(order.quantity), after_value: String(quantity), changed_at: now })
    if (unit !== order.unit) logEntries.push({ order_id: order.id, changed_by: '관리자', field_name: '단위 수정', before_value: order.unit, after_value: unit, changed_at: now })
    if (status !== order.status) logEntries.push({ order_id: order.id, changed_by: '관리자', field_name: '상태 변경', before_value: STATUS_CONFIG[order.status]?.label || order.status, after_value: STATUS_CONFIG[status]?.label || status, changed_at: now })
    if (finalSupplierName !== (order.supplier_name || null)) logEntries.push({ order_id: order.id, changed_by: '관리자', field_name: '발주처 수정', before_value: order.supplier_name || '미지정', after_value: finalSupplierName || '미지정', changed_at: now })
    if (memo.trim() !== (order.memo || '')) logEntries.push({ order_id: order.id, changed_by: '관리자', field_name: '메모 수정', before_value: order.memo || '', after_value: memo.trim(), changed_at: now })

    await supabase.from('orders').update({
      item_name: itemName.trim(), quantity: Number(quantity), unit,
      memo: memo.trim() || null, status,
      supplier_id: supplierId || null, supplier_name: finalSupplierName,
      settlement_amount: amount !== '' ? Number(amount) : null,
      settlement_unit_price: unitPrice !== '' ? Number(unitPrice) : null,
      price_unit: unitPrice !== '' ? priceUnit : null,
      delivery_fee: hasDelivery && deliveryFee !== '' ? Number(deliveryFee) : null,
      payment_method: paymentMethod || null,
    }).eq('id', order.id)
    if (logEntries.length > 0) await supabase.from('order_receipt_logs').insert(logEntries)
    onSaved(); onClose()
  }

  async function handleDelete() {
    if (!confirm(`"${order.item_name}" 발주를 삭제할까요?`)) return
    await supabase.from('order_receipt_logs').insert({ order_id: order.id, changed_by: '관리자', field_name: '발주 삭제', before_value: `${order.item_name} ${order.quantity}${order.unit}`, after_value: null, changed_at: new Date().toISOString() })
    await supabase.from('orders').delete().eq('id', order.id)
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 380, maxHeight: '90vh', overflowY: 'auto' }}>
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
function AdminConfirmOrderModal({ order, units, onClose, onSaved }: {
  order: any; units: string[]; onClose: () => void; onSaved: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [storeSuppliers, setStoreSuppliers] = useState<any[]>([])
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

  // 해당 지점 발주처만 로드
  useEffect(() => {
    supabase.from('order_suppliers').select('*').eq('store_id', order.store_id).order('created_at')
      .then(({ data }) => setStoreSuppliers(data || []))
  }, [order.store_id])

  async function handleSubmit() {
    const selSupplier = storeSuppliers.find(s => s.id === supplierId)
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
          {storeSuppliers.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              <button onClick={() => { setSupplierId(''); setSupplierName('') }}
                style={{ padding: '4px 10px', borderRadius: 16, border: !supplierId && !supplierName ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: !supplierId && !supplierName ? 'rgba(108,92,231,0.1)' : '#F8F9FB', color: !supplierId && !supplierName ? '#6C5CE7' : '#888', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>미지정</button>
              {storeSuppliers.map(s => (
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

// ─── 관리자 수령 처리 모달 ───
function AdminReceiveModal({ order, onClose, onSaved }: { order: any; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [recvQty, setRecvQty] = useState<number | ''>(order.quantity)
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().split('T')[0])
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    if (!recvQty) return
    setSaving(true)
    await supabase.from('order_receipts').insert({
      order_id: order.id,
      received_quantity: Number(recvQty),
      received_by: '관리자',
      inventory_applied: false,
      memo: memo.trim() || null,
    })
    await supabase.from('orders').update({
      status: 'received',
      received_by: '관리자',
      received_at: receivedAt ? new Date(receivedAt + 'T12:00:00').toISOString() : new Date().toISOString(),
    }).eq('id', order.id)
    setSaving(false)
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 340 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>📦 수령 처리</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>{order.item_name} · 발주수량 {order.quantity}{order.unit}</div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>실제 수령 수량</div>
          <input type="number" step="0.1" value={recvQty} onChange={e => setRecvQty(e.target.value === '' ? '' : Number(e.target.value))} style={inp} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>수령 날짜</div>
          <input type="date" value={receivedAt} onChange={e => setReceivedAt(e.target.value)} style={inp} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>메모 (선택)</div>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="특이사항 메모" style={inp} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSubmit} disabled={saving || !recvQty}
            style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: recvQty ? 'linear-gradient(135deg,#00B894,#2DC6D6)' : '#E8ECF0', border: 'none', color: recvQty ? '#fff' : '#bbb', fontSize: 13, fontWeight: 700, cursor: recvQty ? 'pointer' : 'default' }}>
            {saving ? '처리 중...' : '✅ 수령 완료'}
          </button>
          <button onClick={onClose} style={{ padding: '12px 16px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  )
}

// ─── 관리자 이슈 신고 모달 ───
function AdminIssueModal({ order, onClose, onSaved }: { order: any; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [issueType, setIssueType] = useState('wrong_quantity')
  const [memo, setMemo] = useState('')

  async function handleSubmit() {
    await supabase.from('order_issues').insert({
      order_id: order.id,
      store_id: order.store_id,
      issue_type: issueType,
      memo: memo.trim() || null,
      reported_by: '관리자',
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

// ─── 관리자 이슈 해결 모달 ───
function AdminResolveIssueModal({ order, onClose, onSaved }: { order: any; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [resolveType, setResolveType] = useState<'return' | 'exchange' | 'both' | 'additional' | 'other'>('exchange')
  const [resolvedBy, setResolvedBy] = useState('관리자')
  const [recvQty, setRecvQty] = useState<number | ''>(order.quantity)
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  const options: { key: 'return' | 'exchange' | 'both' | 'additional' | 'other'; label: string; desc: string; color: string }[] = [
    { key: 'exchange',   label: '🔄 교환 수령',   desc: '새 물건 받음 → 수령완료 처리',           color: '#6C5CE7' },
    { key: 'return',     label: '↩️ 반품만',       desc: '물건 돌려보냄 → 반품완료 처리',          color: '#E84393' },
    { key: 'both',       label: '↩️🔄 반품+교환',  desc: '반품하고 새 물건도 받음',                color: '#FF6B35' },
    { key: 'additional', label: '📦 추가 수령',    desc: '부족분 추가로 받음 → 수령완료 처리',     color: '#00B894' },
    { key: 'other',      label: '📝 기타',          desc: '타지점 전달 등 기타 처리 → 수령완료',   color: '#888' },
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
      await supabase.from('order_receipts').insert({
        order_id: order.id, received_quantity: Number(recvQty) || order.quantity,
        received_by: resolvedBy.trim(), received_at: now, inventory_applied: false, memo: memo.trim() || null,
      })
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
              <button key={o.key} onClick={() => setResolveType(o.key)}
                style={{ padding: '10px 14px', borderRadius: 10, border: resolveType === o.key ? `2px solid ${o.color}` : '1px solid #E8ECF0', background: resolveType === o.key ? `rgba(${o.color === '#6C5CE7' ? '108,92,231' : o.color === '#E84393' ? '232,67,147' : o.color === '#FF6B35' ? '255,107,53' : o.color === '#00B894' ? '0,184,148' : '136,136,136'},0.08)` : '#F8F9FB', cursor: 'pointer', textAlign: 'left' as const }}>
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

// ─── 관리자 발주 카드 ───
function AdminOrderCard({ order, suppliers, units, onRefresh }: { order: any; suppliers: any[]; units: string[]; onRefresh: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [expanded, setExpanded] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showReceive, setShowReceive] = useState(false)
  const [showIssue, setShowIssue] = useState(false)
  const [showResolve, setShowResolve] = useState(false)
  const [logs, setLogs] = useState<any[]>([])
  const [receipt, setReceipt] = useState<any>(null)
  const [issueData, setIssueData] = useState<any>(null)
  const store = STORES.find(s => s.id === order.store_id)
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending

  async function loadDetail() {
    const { data: r } = await supabase.from('order_receipts').select('*').eq('order_id', order.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    setReceipt(r || null)
    const { data: l } = await supabase.from('order_receipt_logs').select('*').eq('order_id', order.id).order('changed_at', { ascending: false })
    setLogs(l || [])
    const { data: iss } = await supabase.from('order_issues').select('*').eq('order_id', order.id).order('reported_at', { ascending: false }).limit(1).maybeSingle()
    setIssueData(iss || null)
  }

  function handleExpand() {
    if (!expanded) loadDetail()
    setExpanded(v => !v)
  }

  return (
    <>
      {showEdit && !['issue'].includes(order.status) && <AdminEditOrderModal order={order} suppliers={suppliers} units={units} onClose={() => setShowEdit(false)} onSaved={onRefresh} />}
      {showEdit && order.status === 'issue' && <AdminResolveIssueModal order={order} onClose={() => setShowEdit(false)} onSaved={onRefresh} />}
      {showConfirm && <AdminConfirmOrderModal order={order} units={units} onClose={() => setShowConfirm(false)} onSaved={onRefresh} />}
      {showReceive && <AdminReceiveModal order={order} onClose={() => setShowReceive(false)} onSaved={onRefresh} />}
      {showIssue && <AdminIssueModal order={order} onClose={() => setShowIssue(false)} onSaved={onRefresh} />}
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

        <div onClick={handleExpand} style={{ cursor: 'pointer', padding: '10px 14px' }}>
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

        {/* 펼침 - 처리 흐름 + 수정이력 */}
        {expanded && (
          <div style={{ margin: '0 14px 14px 14px', paddingTop: 12, borderTop: '1px solid #F4F6F9' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', marginBottom: 10 }}>📋 처리 흐름</div>
            <div style={{ position: 'relative', paddingLeft: 20 }}>
              <div style={{ position: 'absolute', left: 6, top: 6, bottom: 6, width: 2, background: '#E8ECF0', borderRadius: 2 }} />
              {/* 발주 요청 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#FF6B35', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e' }}>📋 발주 요청</div>
                  <div style={{ fontSize: 10, color: '#aaa' }}>{order.ordered_by} · {new Date(order.ordered_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} {new Date(order.ordered_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                  {store && <div style={{ fontSize: 10, color: store.color, fontWeight: 600 }}>{store.name}</div>}
                </div>
              </div>
              {/* 주문 확인 */}
              {order.confirmed_by && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#6C5CE7', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e' }}>✅ 주문 확인{order.supplier_name ? ` · ${order.supplier_name}` : ''}</div>
                    <div style={{ fontSize: 10, color: '#aaa' }}>{order.confirmed_by} · {order.confirmed_at && new Date(order.confirmed_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} {order.confirmed_at && new Date(order.confirmed_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>
                  </div>
                </div>
              )}
              {/* 이슈 */}
              {order.status === 'issue' && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#E84393', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#E84393' }}>🚨 이슈 신고{issueData?.issue_type ? ` · ${ISSUE_TYPES[issueData.issue_type] || issueData.issue_type}` : ''}</div>
                    {issueData && <div style={{ fontSize: 10, color: '#aaa' }}>{issueData.reported_by} · {new Date(issueData.reported_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })}</div>}
                    {issueData?.memo && <div style={{ fontSize: 10, color: '#bbb' }}>📝 {issueData.memo}</div>}
                  </div>
                </div>
              )}
              {/* 수령 */}
              {(receipt || order.received_by) && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#00B894', flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e' }}>📦 수령 완료{receipt ? ` · ${receipt.received_quantity}${order.unit}` : ''}</div>
                    <div style={{ fontSize: 10, color: '#aaa' }}>{receipt?.received_by || order.received_by} · {(receipt?.received_at || order.received_at) && new Date(receipt?.received_at || order.received_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })}</div>
                  </div>
                </div>
              )}
            </div>

            {/* 수정 이력 */}
            {logs.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', marginBottom: 6 }}>🔍 수정 이력</div>
                {logs.map((log, i) => (
                  <div key={log.id || i} style={{ fontSize: 10, color: '#888', padding: '4px 0', borderBottom: '1px solid #F4F6F9', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>
                      <strong style={{ color: log.field_name?.includes('수정') ? '#FF6B35' : log.field_name?.includes('삭제') || log.field_name?.includes('취소') ? '#E84393' : '#6C5CE7' }}>{log.changed_by}</strong>
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
            {logs.length === 0 && <div style={{ fontSize: 10, color: '#ccc', marginTop: 8 }}>수정 이력 없음</div>}
          </div>
        )}

        {/* 주문요청 → 주문완료 + 이슈 */}
        {order.status === 'requested' && (
          <div style={{ display: 'flex', borderTop: '1px solid #F0F2F5' }}>
            <button onClick={() => setShowConfirm(true)} style={{ flex: 1, padding: '9px 0', background: 'linear-gradient(135deg,#6C5CE7,#a29bfe)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', borderBottomLeftRadius: 10 }}>✅ 주문완료</button>
            <button onClick={() => setShowIssue(true)} style={{ width: 80, padding: '9px 0', background: 'rgba(232,67,147,0.08)', border: 'none', borderLeft: '1px solid #F0F2F5', color: '#E84393', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderBottomRightRadius: 10 }}>🚨 이슈</button>
          </div>
        )}

        {/* 주문완료 → 수령처리(모달) + 이슈 */}
        {(order.status === 'ordered' || order.status === 'pending') && (
          <div style={{ display: 'flex', borderTop: '1px solid #F0F2F5' }}>
            <button onClick={() => setShowReceive(true)} style={{ flex: 1, padding: '9px 0', background: 'linear-gradient(135deg,#00B894,#2DC6D6)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', borderBottomLeftRadius: 10 }}>📦 수령처리</button>
            <button onClick={() => setShowIssue(true)} style={{ width: 80, padding: '9px 0', background: 'rgba(232,67,147,0.08)', border: 'none', borderLeft: '1px solid #F0F2F5', color: '#E84393', fontSize: 12, fontWeight: 600, cursor: 'pointer', borderBottomRightRadius: 10 }}>🚨 이슈</button>
          </div>
        )}

        {/* 이슈 상태 → 이슈 해결 + 이슈 취소 */}
        {order.status === 'issue' && (
          <div style={{ display: 'flex', borderTop: '1px solid #F0F2F5' }}>
            <button onClick={() => setShowEdit(true)} style={{ flex: 1, padding: '9px 0', background: 'linear-gradient(135deg,#6C5CE7,#a29bfe)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', borderBottomLeftRadius: 10 }}>✅ 이슈 해결</button>
            <button onClick={async () => {
              if (!confirm('이슈를 취소하고 주문완료 상태로 되돌릴까요?')) return
              await supabase.from('orders').update({ status: 'ordered' }).eq('id', order.id)
              onRefresh()
            }} style={{ width: 80, padding: '9px 0', background: 'rgba(108,92,231,0.06)', border: 'none', borderLeft: '1px solid #F0F2F5', color: '#6C5CE7', fontSize: 11, fontWeight: 600, cursor: 'pointer', borderBottomRightRadius: 10 }}>🔄 이슈취소</button>
          </div>
        )}
      </div>
    </>
  )
}

// ─── 관리자 통계 ───
function AdminStats({ allOrders: allOrdersProp, selYear, selMonth, onYearMonthChange }: {
  allOrders: any[]; selYear: number; selMonth: number; onYearMonthChange: (y: number, m: number) => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [allTimeOrders, setAllTimeOrders] = useState<any[]>([])
  const [exporting, setExporting] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(selYear)

  useEffect(() => { loadAllTime() }, [])

  async function loadAllTime() {
    const { data } = await supabase.from('orders').select('id,item_name,quantity,unit,ordered_at,settlement_amount,store_id')
    setAllTimeOrders(data || [])
  }

  const pad = (n: number) => String(n).padStart(2, '0')

  // 월별 orders (prop으로 받은 것)
  const monthOrders = allOrdersProp

  // 지점별로 통계 계산하는 함수
  function calcStoreStats(storeId: string) {
    const mOrders = monthOrders.filter(o => o.store_id === storeId)
    const aOrders = allTimeOrders.filter(o => o.store_id === storeId)

    const monthMap: Record<string, { count: number; totalQty: number; unit: string; totalSpend: number }> = {}
    mOrders.forEach(o => {
      if (!monthMap[o.item_name]) monthMap[o.item_name] = { count: 0, totalQty: 0, unit: o.unit || '', totalSpend: 0 }
      monthMap[o.item_name].count++
      monthMap[o.item_name].totalQty += Number(o.quantity) || 0
      monthMap[o.item_name].totalSpend += Number(o.settlement_amount) || 0
    })
    const monthStats = Object.entries(monthMap).map(([name, s]) => ({ name, ...s })).sort((a, b) => b.count - a.count)

    const allMap: Record<string, { count: number; totalQty: number; unit: string; totalSpend: number; dates: string[] }> = {}
    aOrders.forEach(o => {
      if (!allMap[o.item_name]) allMap[o.item_name] = { count: 0, totalQty: 0, unit: o.unit || '', totalSpend: 0, dates: [] }
      allMap[o.item_name].count++
      allMap[o.item_name].totalQty += Number(o.quantity) || 0
      allMap[o.item_name].totalSpend += Number(o.settlement_amount) || 0
      allMap[o.item_name].dates.push(o.ordered_at)
    })
    const allStats = Object.entries(allMap).map(([name, s]) => {
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

    return { mOrders, monthStats, allStats, totalSpend: mOrders.reduce((s, o) => s + (Number(o.settlement_amount) || 0), 0) }
  }

  // 엑셀 내보내기 (지점별 시트)
  async function exportExcel() {
    if (exporting) return
    setExporting(true)
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      const thin = () => ({ style: 'thin' as const, color: { argb: 'FFE0E4E8' } })
      const med = () => ({ style: 'medium' as const, color: { argb: 'FFaaaaaa' } })
      const STORE_COLORS = ['FF6C5CE7', 'FF00B894', 'FFFF6B35']

      // 전체 요약 시트
      const wsSummary = wb.addWorksheet(`📊 전지점 요약`)
      const tRow = wsSummary.addRow([`📦 ${selYear}년 ${selMonth}월 전지점 발주 통계 요약`])
      wsSummary.mergeCells(1, 1, 1, 5)
      tRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1A2E' } }
      tRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 }
      tRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
      tRow.height = 28

      const hRow = wsSummary.addRow(['지점', '총 발주', '수령완료', '이슈', '결산금액'])
      hRow.eachCell((cell, ci) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } }
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        cell.border = { bottom: med(), right: thin() }
      }); wsSummary.getRow(2).height = 20

      STORES.forEach((store, si) => {
        const { mOrders, totalSpend } = calcStoreStats(store.id)
        const row = wsSummary.addRow([store.name, mOrders.length, mOrders.filter(o => o.status === 'received').length, mOrders.filter(o => o.status === 'issue').length, totalSpend > 0 ? `${totalSpend.toLocaleString()}원` : '-'])
        row.height = 18
        row.eachCell((cell, ci) => {
          cell.alignment = { horizontal: ci === 1 ? 'left' : 'center', vertical: 'middle' }
          cell.border = { top: thin(), bottom: thin(), left: thin(), right: thin() }
          if (ci === 1) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `${STORE_COLORS[si]}18` } }; cell.font = { bold: true, color: { argb: STORE_COLORS[si] } } }
        })
      })
      ;[1, 2, 3, 4, 5].forEach((i, idx) => { wsSummary.getColumn(i).width = [18, 12, 12, 10, 16][idx] })

      // 지점별 시트
      STORES.forEach((store, si) => {
        const { mOrders, monthStats, allStats, totalSpend } = calcStoreStats(store.id)
        const ws = wb.addWorksheet(`${store.name}`)
        const storeColor = STORE_COLORS[si]

        const t1 = ws.addRow([`${store.name} · ${selYear}년 ${selMonth}월 발주 통계`])
        ws.mergeCells(1, 1, 1, 7)
        t1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: storeColor } }
        t1.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 13 }
        t1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
        t1.height = 28

        const h1 = ws.addRow(['품목명', '이번달 횟수', '이번달 수량', '이번달 지출', '전체 횟수', '평균 주기(일)', '마지막 발주'])
        h1.eachCell((cell, ci) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ci === 1 ? 'FF2C3E50' : storeColor } }
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
          cell.border = { bottom: med(), right: thin() }
        }); ws.getRow(2).height = 20

        const monthMap: Record<string, any> = {}
        monthStats.forEach(s => { monthMap[s.name] = s })
        const allNames = new Set([...monthStats.map(s => s.name), ...allStats.map(s => s.name)])
        ;[...allNames].forEach(name => {
          const ms = monthMap[name]; const as_ = allStats.find(s => s.name === name)
          const row = ws.addRow([name, ms?.count || 0, ms ? `${ms.totalQty}${ms.unit}` : '-', ms?.totalSpend ? `${ms.totalSpend.toLocaleString()}원` : '-', as_?.count || 0, as_?.avgCycle ? `${as_.avgCycle}일` : '-', as_?.lastDate ? new Date(as_.lastDate).toLocaleDateString('ko') : '-'])
          row.height = 18
          row.eachCell((cell, ci) => {
            cell.alignment = { horizontal: ci === 1 ? 'left' : 'center', vertical: 'middle' }
            cell.border = { top: thin(), bottom: thin(), left: thin(), right: thin() }
            if (ci === 4 && (ms?.totalSpend || 0) > 0) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEEE6' } }; cell.font = { bold: true, color: { argb: 'FFFF6B35' } } }
          })
        })
        const sumRow = ws.addRow(['합계', mOrders.length, '-', totalSpend > 0 ? `${totalSpend.toLocaleString()}원` : '-', '-', '-', '-'])
        sumRow.height = 22
        sumRow.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE8CC' } }; cell.font = { bold: true, size: 10 }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = { top: med(), bottom: thin(), left: thin(), right: thin() } })
        ws.getColumn(1).width = 22; [2, 3, 4, 5, 6, 7].forEach(i => { ws.getColumn(i).width = 14 })
        ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }]
      })

      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `발주통계_전지점_${selYear}년${selMonth}월.xlsx`; a.click(); URL.revokeObjectURL(url)
    } catch (e: any) { alert('내보내기 실패: ' + (e?.message || '')) }
    finally { setExporting(false) }
  }

  const card = { background: '#fff', borderRadius: 14, border: '1px solid #E8ECF0', padding: 14, marginBottom: 10 }

  // 지점별 섹션 컴포넌트
  function StoreStatSection({ store, color }: { store: typeof STORES[0]; color: string }) {
    const { mOrders, monthStats, allStats, totalSpend } = calcStoreStats(store.id)
    const filteredMonth = searchQ ? monthStats.filter(s => s.name.includes(searchQ)) : monthStats
    const filteredAll = searchQ ? allStats.filter(s => s.name.includes(searchQ)) : allStats.slice(0, 8)
    const received = mOrders.filter(o => o.status === 'received').length
    const issues = mOrders.filter(o => o.status === 'issue').length
    const pct = mOrders.length > 0 ? Math.round(received / mOrders.length * 100) : 0

    return (
      <div style={{ marginBottom: 20 }}>
        {/* 지점 헤더 */}
        <div style={{ padding: '10px 14px', borderRadius: 12, background: `rgba(${color === '#6C5CE7' ? '108,92,231' : color === '#00B894' ? '0,184,148' : '255,107,53'},0.08)`, border: `1.5px solid ${color}40`, marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color }}>{store.name}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(0,184,148,0.1)', color: '#00B894', fontWeight: 700 }}>수령 {received}</span>
              {issues > 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'rgba(232,67,147,0.1)', color: '#E84393', fontWeight: 700 }}>이슈 {issues}</span>}
              <span style={{ fontSize: 11, color: '#aaa' }}>총 {mOrders.length}</span>
            </div>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: '#F0F2F8', overflow: 'hidden', marginBottom: 4 }}>
            <div style={{ height: '100%', borderRadius: 3, background: color, width: `${pct}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: '#aaa' }}>수령률 {pct}%</span>
            {totalSpend > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: '#FF6B35' }}>💰 {totalSpend.toLocaleString()}원</span>}
          </div>
        </div>

        {mOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 16, color: '#bbb', fontSize: 12 }}>이번 달 발주 없음</div>
        ) : (
          <>
            {/* 이번 달 품목별 */}
            {filteredMonth.length > 0 && (
              <div style={{ ...card, marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>📦 {selMonth}월 품목별</div>
                {filteredMonth.map((s, i) => (
                  <div key={s.name} style={{ padding: '8px 0', borderBottom: '1px solid #F4F6F9' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: i < 3 ? color : '#ccc', minWidth: 18 }}>#{i + 1}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{s.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#6C5CE7', fontWeight: 700 }}>{s.count}회</span>
                        <span style={{ fontSize: 10, color: '#888' }}>{s.totalQty}{s.unit}</span>
                        {s.totalSpend > 0 && <span style={{ fontSize: 10, color: '#FF6B35', fontWeight: 700 }}>{s.totalSpend.toLocaleString()}원</span>}
                      </div>
                    </div>
                    {(() => {
                      const as_ = allStats.find(a => a.name === s.name)
                      if (!as_ || as_.avgCycle === 0) return null
                      const isSoon = as_.daysSinceLast !== null && as_.daysSinceLast >= as_.avgCycle * 0.8
                      return (
                        <div style={{ display: 'flex', gap: 6, paddingLeft: 24 }}>
                          <span style={{ fontSize: 9, color: '#aaa' }}>🔄 {as_.avgCycle}일 주기</span>
                          {as_.daysSinceLast !== null && <span style={{ fontSize: 9, color: isSoon ? '#E84393' : '#00B894', fontWeight: isSoon ? 700 : 400 }}>{isSoon ? `⚠️ ${as_.daysSinceLast}일 경과` : `${as_.daysSinceLast}일 전`}</span>}
                        </div>
                      )
                    })()}
                  </div>
                ))}
              </div>
            )}

            {/* TOP 품목 */}
            {!searchQ && filteredAll.length > 0 && (
              <div style={{ ...card, marginBottom: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>🏆 자주 발주 TOP 8 (전체 기간)</div>
                {filteredAll.map((s, i) => (
                  <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F4F6F9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: i < 3 ? color : '#ccc', minWidth: 18 }}>#{i + 1}</span>
                      <span style={{ fontSize: 12, color: '#1a1a2e' }}>{s.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{ fontSize: 11, color: '#6C5CE7', fontWeight: 700 }}>{s.count}회</span>
                      {s.avgCycle > 0 && <span style={{ fontSize: 9, color: '#00B894', padding: '1px 5px', borderRadius: 6, background: 'rgba(0,184,148,0.1)' }}>🔄 {s.avgCycle}일</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* 월 선택 피커 */}
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
                  const isSel = pickerYear === selYear && m === selMonth
                  return (
                    <button key={m} onClick={() => { onYearMonthChange(pickerYear, m); setShowPicker(false) }}
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

      {/* 엑셀 다운로드 */}
      <button onClick={exportExcel} disabled={exporting}
        style={{ width: '100%', padding: '11px 0', borderRadius: 12, background: exporting ? '#E8ECF0' : 'linear-gradient(135deg,#00B894,#2DC6D6)', border: 'none', color: exporting ? '#bbb' : '#fff', fontSize: 13, fontWeight: 700, cursor: exporting ? 'default' : 'pointer', marginBottom: 14 }}>
        {exporting ? '⏳ 생성 중...' : '📥 전지점 발주 통계 엑셀 (지점별 시트)'}
      </button>

      {/* 검색 */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#aaa' }}>🔍</span>
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="품목명 검색..."
          style={{ width: '100%', padding: '9px 32px 9px 32px', borderRadius: 10, border: '1px solid #E0E4E8', background: '#F8F9FB', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, color: '#1a1a2e' }} />
        {searchQ && <button onClick={() => setSearchQ('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 14 }}>✕</button>}
      </div>

      {/* 지점별 섹션 */}
      {STORES.map((store, i) => (
        <StoreStatSection key={store.id} store={store} color={store.color} />
      ))}

      {monthOrders.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 13 }}>{selYear}년 {selMonth}월 발주 내역이 없어요</div>}
    </div>
  )
}


// ─── 발주처 관리 모달 (관리자) ───
function AdminSupplierModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [selStoreId, setSelStoreId] = useState(STORES[0].id)
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [newName, setNewName] = useState('')
  const [newMemo, setNewMemo] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editMemo, setEditMemo] = useState('')

  useEffect(() => { load() }, [selStoreId])

  async function load() {
    const { data } = await supabase.from('order_suppliers').select('*').eq('store_id', selStoreId).order('created_at')
    setSuppliers(data || [])
  }
  async function handleAdd() {
    if (!newName.trim()) return
    await supabase.from('order_suppliers').insert({ store_id: selStoreId, name: newName.trim(), memo: newMemo.trim() || null })
    setNewName(''); setNewMemo(''); load(); onSaved()
  }
  async function handleUpdate(id: string) {
    await supabase.from('order_suppliers').update({ name: editName, memo: editMemo || null }).eq('id', id)
    setEditId(null); load(); onSaved()
  }
  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" 발주처를 삭제할까요?`)) return
    await supabase.from('order_suppliers').delete().eq('id', id)
    load(); onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>🏪 발주처 관리</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>
        {/* 지점 선택 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {STORES.map(s => (
            <button key={s.id} onClick={() => setSelStoreId(s.id)}
              style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: selStoreId === s.id ? `2px solid ${s.color}` : '1px solid #E8ECF0', background: selStoreId === s.id ? `rgba(${s.color === '#6C5CE7' ? '108,92,231' : s.color === '#00B894' ? '0,184,148' : '255,107,53'},0.1)` : '#F8F9FB', color: selStoreId === s.id ? s.color : '#888', fontSize: 12, fontWeight: selStoreId === s.id ? 700 : 400, cursor: 'pointer' }}>
              {s.name}
            </button>
          ))}
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

// ─── 관리자 빠른 발주 모달 ───
function AdminQuickOrderModal({ suppliers, units, onClose, onSaved }: { suppliers: any[]; units: string[]; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  type QuickItem = { id: number; name: string; qty: number | ''; unit: string }
  const newRow = (id: number): QuickItem => ({ id, name: '', qty: '', unit: units[0] || 'ea' })
  const [rows, setRows] = useState<QuickItem[]>([newRow(1), newRow(2), newRow(3)])
  const [selStoreId, setSelStoreId] = useState(STORES[0].id)
  const [saving, setSaving] = useState(false)
  let nextId = rows.length + 1

  function updateRow(id: number, field: string, value: any) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }
  function addRow() { setRows(prev => [...prev, newRow(++nextId)]) }
  function removeRow(id: number) { if (rows.length <= 1) return; setRows(prev => prev.filter(r => r.id !== id)) }

  async function handleSubmit() {
    const validRows = rows.filter(r => r.name.trim() && r.qty !== '' && Number(r.qty) > 0)
    if (validRows.length === 0) return
    setSaving(true)
    const now = new Date().toISOString()
    await Promise.all(validRows.map(r =>
      supabase.from('orders').insert({
        store_id: selStoreId, item_name: r.name.trim(), quantity: Number(r.qty), unit: r.unit,
        ordered_by: '관리자', ordered_at: now, status: 'requested',
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
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>⚡ 빠른 발주 (관리자)</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 14 }}>품목과 수량만 입력하고 한번에 등록해요</div>

        {/* 지점 선택 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {STORES.map(s => (
            <button key={s.id} onClick={() => setSelStoreId(s.id)}
              style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: selStoreId === s.id ? `2px solid ${s.color}` : '1px solid #E8ECF0', background: selStoreId === s.id ? `rgba(${s.color === '#6C5CE7' ? '108,92,231' : s.color === '#00B894' ? '0,184,148' : '255,107,53'},0.1)` : '#F8F9FB', color: selStoreId === s.id ? s.color : '#888', fontSize: 12, fontWeight: selStoreId === s.id ? 700 : 400, cursor: 'pointer' }}>
              {s.name}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 55px 28px', gap: 6, marginBottom: 6, padding: '0 2px' }}>
            <span style={{ fontSize: 10, color: '#aaa' }}>품목명</span>
            <span style={{ fontSize: 10, color: '#aaa' }}>수량</span>
            <span style={{ fontSize: 10, color: '#aaa' }}>단위</span>
            <span />
          </div>
          {rows.map((row, idx) => (
            <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 55px 28px', gap: 6, marginBottom: 6 }}>
              <input value={row.name} onChange={e => updateRow(row.id, 'name', e.target.value)} placeholder={`품목 ${idx + 1}`} style={{ ...inp, padding: '8px 10px' }} />
              <input type="number" value={row.qty} onChange={e => updateRow(row.id, 'qty', e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" style={{ ...inp, padding: '8px 8px', textAlign: 'center' }} />
              <select value={row.unit} onChange={e => updateRow(row.id, 'unit', e.target.value)} style={{ ...inp, padding: '8px 4px', appearance: 'auto' as any }}>
                {units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <button onClick={() => removeRow(row.id)} style={{ width: 28, height: 36, borderRadius: 7, border: '1px solid #E8ECF0', background: '#F8F9FB', color: '#ccc', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
          ))}
        </div>

        <button onClick={addRow} style={{ width: '100%', padding: '9px 0', borderRadius: 10, border: '2px dashed #E0E4E8', background: '#F8F9FB', color: '#aaa', fontSize: 13, cursor: 'pointer', marginBottom: 16 }}>+ 품목 추가</button>

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


export default function AdminOrderTab({ userName, places }: { userName?: string; places?: any[] } = {}) {
  const supabase = createSupabaseBrowserClient()
  const [allOrders, setAllOrders] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [units, setUnits] = useState<string[]>(DEFAULT_UNITS)
  const [selStore, setSelStore] = useState<string | 'all'>('all')
  const [subTab, setSubTab] = useState<'pending' | 'requested' | 'all' | 'issues' | 'stats'>('pending')
  const [showAddOrder, setShowAddOrder] = useState(false)
  const [showDirectIssue, setShowDirectIssue] = useState(false)
  const [showSupplierMgr, setShowSupplierMgr] = useState(false)
  const [showQuickOrder, setShowQuickOrder] = useState(false)
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const [selYear, setSelYear] = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(now.getFullYear())
  const [allSearchQ, setAllSearchQ] = useState('')

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
      if (allSearchQ.trim()) list = list.filter(o => o.item_name?.includes(allSearchQ.trim()) || o.supplier_name?.includes(allSearchQ.trim()) || o.memo?.includes(allSearchQ.trim()))
    }
    return list
  }, [allOrders, selStore, subTab, selYear, selMonth, allSearchQ])

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
          const statusCounts = items.reduce((acc: any, o: any) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc }, {})
          return (
            <div key={dateKey} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6C5CE7', background: 'rgba(108,92,231,0.1)', padding: '4px 10px', borderRadius: 20, flexShrink: 0 }}>📅 {label}</div>
                <div style={{ flex: 1, height: 1, background: '#E8ECF0' }} />
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {(statusCounts.requested||0) > 0 && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(255,107,53,0.12)', color: '#FF6B35', fontWeight: 700 }}>요청 {statusCounts.requested}</span>}
                  {(statusCounts.ordered||0) > 0 && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(108,92,231,0.12)', color: '#6C5CE7', fontWeight: 700 }}>주문 {statusCounts.ordered}</span>}
                  {(statusCounts.received||0) > 0 && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(0,184,148,0.1)', color: '#00B894', fontWeight: 700 }}>수령 {statusCounts.received}</span>}
                  {(statusCounts.issue||0) > 0 && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(232,67,147,0.1)', color: '#E84393', fontWeight: 700 }}>이슈 {statusCounts.issue}</span>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
                {items.map((o: any) => <AdminOrderCard key={o.id} order={o} suppliers={suppliers} units={units} onRefresh={loadAll} />)}
              </div>
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
      {showAddOrder && <AdminAddOrderModal units={units} onUnitsUpdate={setUnits} onClose={() => setShowAddOrder(false)} onSaved={loadAll} />}
      {showDirectIssue && <DirectIssueModal storeId={STORES[0].id} units={units} onClose={() => setShowDirectIssue(false)} onSaved={loadAll} />}
      {showSupplierMgr && <AdminSupplierModal onClose={() => setShowSupplierMgr(false)} onSaved={loadAll} />}
      {showQuickOrder && <AdminQuickOrderModal suppliers={suppliers} units={units} onClose={() => setShowQuickOrder(false)} onSaved={loadAll} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>📋 전지점 발주 관리</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowSupplierMgr(true)} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(45,198,214,0.1)', border: '1px solid rgba(45,198,214,0.3)', color: '#2DC6D6', fontSize: 11, cursor: 'pointer' }}>🏪 발주처</button>
          <button onClick={() => setShowDirectIssue(true)} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(232,67,147,0.1)', border: '1px solid rgba(232,67,147,0.3)', color: '#E84393', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🚨 이슈등록</button>
          <button onClick={() => setShowQuickOrder(true)} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.3)', color: '#6C5CE7', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>⚡ 빠른발주</button>
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
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid #E0E4E8', background: '#F8F9FB', color: '#1a1a2e', fontSize: 14, fontWeight: 700, cursor: 'pointer', width: '100%', justifyContent: 'center', marginBottom: 8 }}>
            📅 {selYear}년 {selMonth}월 ▾
          </button>
          {/* 검색창 */}
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#aaa' }}>🔍</span>
            <input value={allSearchQ} onChange={e => setAllSearchQ(e.target.value)} placeholder="품목명, 발주처, 메모 검색..."
              style={{ width: '100%', padding: '9px 32px 9px 32px', borderRadius: 10, border: '1px solid #E0E4E8', background: '#F8F9FB', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, color: '#1a1a2e' }} />
            {allSearchQ && <button onClick={() => setAllSearchQ('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 14 }}>✕</button>}
          </div>
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
          {subTab === 'stats' && <AdminStats allOrders={allOrders} selYear={selYear} selMonth={selMonth} onYearMonthChange={(y, m) => { setSelYear(y); setSelMonth(m) }} />}
        </>
      )}
    </div>
  )
}