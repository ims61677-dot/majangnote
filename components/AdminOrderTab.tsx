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
  const hasInventoryLink = !!order.inventory_item_id

  async function handleQtyNext() {
    if (!recvQty) return
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
    await supabase.from('orders').update({ status: 'received' }).eq('id', order.id)
    setSaving(false); onDone(); onClose()
  }

  const placeGroups = places.reduce((acc: Record<string, any[]>, p) => {
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
            {places.length === 0 && <div style={{ textAlign: 'center', padding: 24, color: '#bbb', fontSize: 12 }}>등록된 장소가 없어요</div>}
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

function AdminOrderCard({ order, userName, places, highlighted, onRefresh }: { order: any; userName: string; places: any[]; highlighted?: boolean; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showReceive, setShowReceive] = useState(false)
  const now = new Date()
  const diffDays = (now.getTime() - new Date(order.ordered_at).getTime()) / 86400000
  const isOverdue = (order.status === 'requested' || order.status === 'ordered') && diffDays > 2
  const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.requested
  const d = new Date(order.ordered_at)

  return (
    <>
      {showConfirm && <ConfirmOrderModal order={order} userName={userName} onDone={() => { setShowConfirm(false); onRefresh() }} onClose={() => setShowConfirm(false)} />}
      {showReceive && <ReceiveModal order={order} userName={userName} places={places} onDone={() => { setShowReceive(false); onRefresh() }} onClose={() => setShowReceive(false)} />}
      <div data-admin-order-id={order.id} style={{ background: '#fff', borderRadius: 14, border: `1px solid ${cfg.color}33`, overflow: 'hidden', boxShadow: highlighted ? `0 0 0 3px ${cfg.color}, 0 2px 12px ${cfg.color}44` : '0 1px 6px rgba(0,0,0,0.06)', transition: 'box-shadow 0.3s' }}>
        <div style={{ background: cfg.headerBg, padding: '7px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{cfg.label}</span>
            {isOverdue && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(0,0,0,0.2)', color: '#fff', fontWeight: 700 }}>⏰ 지연</span>}
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
          <div style={{ display: 'flex', gap: 6 }}>
            {order.status === 'requested' && (
              <button onClick={() => setShowConfirm(true)} style={{ padding: '5px 12px', borderRadius: 8, background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.3)', color: '#6C5CE7', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✅ 주문확인</button>
            )}
            {order.status === 'ordered' && (
              <button onClick={() => setShowReceive(true)} style={{ padding: '5px 12px', borderRadius: 8, background: 'rgba(0,184,148,0.1)', border: '1px solid rgba(0,184,148,0.3)', color: '#00B894', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>📦 수령</button>
            )}
            {order.status === 'received' && (
              <button onClick={async () => {
                if (!confirm('수령을 취소할까요?\n재고에 합산된 수량도 자동으로 차감돼요.')) return
                // 재고 차감 (연동된 경우)
                if (order.inventory_item_id) {
                  const { data: receipts } = await supabase.from('order_receipts')
                    .select('received_quantity, inventory_place, inventory_applied')
                    .eq('order_id', order.id)
                    .eq('inventory_applied', true)
                  if (receipts && receipts.length > 0) {
                    for (const r of receipts) {
                      if (r.inventory_place) {
                        const { data: existing } = await supabase.from('inventory_stock')
                          .select('quantity').eq('item_id', order.inventory_item_id).eq('place', r.inventory_place).single()
                        const newQty = Math.max(0, (existing?.quantity ?? 0) - Number(r.received_quantity))
                        await supabase.from('inventory_stock').upsert({
                          item_id: order.inventory_item_id, place: r.inventory_place,
                          quantity: newQty, updated_by: userName, updated_at: new Date().toISOString(),
                        }, { onConflict: 'item_id,place' })
                      }
                    }
                  }
                }
                await supabase.from('orders').update({ status: 'ordered' }).eq('id', order.id)
                await supabase.from('order_receipt_logs').insert({
                  order_id: order.id, changed_by: userName, field_name: '수령취소',
                  before_value: '수령완료', after_value: '주문완료(수령취소)', memo: null,
                })
                onRefresh()
              }} style={{ padding: '5px 12px', borderRadius: 8, background: 'rgba(232,67,147,0.08)', border: '1px solid rgba(232,67,147,0.25)', color: '#E84393', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>↩️ 수령취소</button>
            )}
            <button onClick={() => setExpanded(p => !p)} style={{ padding: '5px 10px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 11, cursor: 'pointer' }}>
              {expanded ? '▲' : '▼ 상세'}
            </button>
          </div>
          {expanded && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #E8ECF0', fontSize: 11, color: '#aaa', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span>📅 {new Date(order.ordered_at).toLocaleDateString('ko', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              {order.status === 'ordered' && order.confirmed_by && <span style={{ color: '#6C5CE7' }}>✅ 주문확인: {order.confirmed_by}</span>}
              {order.status === 'received' && <span style={{ color: '#00B894' }}>📦 수령: {order.received_quantity ?? order.quantity}{order.unit} · {order.received_by}</span>}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>👑 관리자 발주 현황</span>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>전지점 통합 뷰</div>
        </div>
        <button onClick={loadOrders} style={{ padding: '6px 12px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 11, cursor: 'pointer' }}>🔄 새로고침</button>
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