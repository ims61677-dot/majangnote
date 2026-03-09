'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
const card = { background: '#fff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }

const STORES = [
  { id: '00000000-0000-0000-0000-000000000001', name: '고덕점', color: '#FF6B35', bg: 'rgba(255,107,53,0.1)' },
  { id: '799f3381-c122-4327-8b57-f17ddd632cd6', name: '비전점', color: '#6C5CE7', bg: 'rgba(108,92,231,0.1)' },
  { id: 'ec48ac26-baa1-407e-89df-1331dffd2b31', name: '스타필드', color: '#00B894', bg: 'rgba(0,184,148,0.1)' },
]

function StoreBadge({ storeId }: { storeId: string }) {
  const s = STORES.find(x => x.id === storeId)
  if (!s) return null
  return (
    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 6, background: s.bg, color: s.color, fontWeight: 700, flexShrink: 0 }}>
      {s.name}
    </span>
  )
}

// ─── 주문확인 모달 ───
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
    await supabase.from('orders').update({
      status: 'ordered',
      supplier_id: supplierId || null,
      confirmed_by: confirmedBy.trim() || userName,
      confirmed_at: new Date().toISOString(),
    }).eq('id', order.id)
    await supabase.from('order_receipt_logs').insert({ order_id: order.id, changed_by: userName, field_name: '주문확인', before_value: '요청됨', after_value: `주문완료 (${confirmedBy.trim() || userName})`, memo: null })
    setSaving(false)
    onDone()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>📋 주문 확인</div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>{order.item_name} · {order.quantity}{order.unit}</div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>발주처 (선택)</div>
        <select value={supplierId} onChange={e => setSupplierId(e.target.value)} style={{ ...inp, appearance: 'auto' as any, marginBottom: 12 }}>
          <option value="">미지정</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>주문자</div>
        <input value={confirmedBy} onChange={e => setConfirmedBy(e.target.value)} style={{ ...inp, marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleConfirm} disabled={saving} style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? '처리 중...' : '✅ 주문확인'}
          </button>
          <button onClick={onClose} style={{ padding: '12px 18px', borderRadius: 12, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  )
}

// ─── 수령 모달 (간단 버전 - 재고 미연동) ───
function ReceiveModal({ order, userName, onDone, onClose }: { order: any; userName: string; onDone: () => void; onClose: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [qty, setQty] = useState(order.quantity)
  const [saving, setSaving] = useState(false)

  async function handleReceive() {
    setSaving(true)
    await supabase.from('orders').update({ status: 'received', received_quantity: qty, received_at: new Date().toISOString(), received_by: userName }).eq('id', order.id)
    await supabase.from('order_receipts').insert({ order_id: order.id, received_quantity: qty, received_by: userName, inventory_applied: false })
    await supabase.from('order_receipt_logs').insert({ order_id: order.id, changed_by: userName, field_name: '수령완료', before_value: '주문완료', after_value: `${qty}${order.unit} 수령`, memo: null })
    setSaving(false)
    onDone()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>📦 수령 확인</div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>{order.item_name}</div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>수령 수량</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button onClick={() => setQty((q: number) => Math.max(1, q - 1))} style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(232,67,147,0.1)', border: '1px solid rgba(232,67,147,0.2)', color: '#E84393', cursor: 'pointer', fontSize: 18 }}>−</button>
          <input type="number" value={qty} onChange={e => setQty(Number(e.target.value))} style={{ flex: 1, textAlign: 'center', fontSize: 20, fontWeight: 700, border: '1px solid #E8ECF0', borderRadius: 8, padding: '6px 0', outline: 'none' }} />
          <span style={{ fontSize: 13, color: '#888', minWidth: 24 }}>{order.unit}</span>
          <button onClick={() => setQty((q: number) => q + 1)} style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(0,184,148,0.1)', border: '1px solid rgba(0,184,148,0.2)', color: '#00B894', cursor: 'pointer', fontSize: 18 }}>+</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleReceive} disabled={saving} style={{ flex: 1, padding: '12px 0', borderRadius: 12, background: 'linear-gradient(135deg,#00B894,#2DC6D6)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? '처리 중...' : '📦 수령완료'}
          </button>
          <button onClick={onClose} style={{ padding: '12px 18px', borderRadius: 12, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  )
}

// ─── 발주 카드 ───
function AdminOrderCard({ order, userName, onRefresh }: { order: any; userName: string; onRefresh: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [expanded, setExpanded] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showReceive, setShowReceive] = useState(false)

  const statusColor: Record<string, string> = {
    requested: '#FF6B35', ordered: '#6C5CE7', received: '#00B894',
    issue: '#E84393', returned: '#aaa', pending: '#B8860B',
  }
  const statusLabel: Record<string, string> = {
    requested: '📋 요청됨', ordered: '✅ 주문완료', received: '📦 수령완료',
    issue: '⚠️ 이슈', returned: '↩️ 반품', pending: '⏳ 대기',
  }

  const now = new Date()
  const diffDays = (now.getTime() - new Date(order.ordered_at).getTime()) / (1000 * 60 * 60 * 24)
  const isOverdue = (order.status === 'requested' || order.status === 'ordered') && diffDays > 2

  const borderLeft = order.status === 'received' ? '3px solid #00B894'
    : order.status === 'issue' ? '3px solid #E84393'
    : order.status === 'ordered' ? '3px solid #6C5CE7'
    : isOverdue ? '3px solid #E84393'
    : '3px solid #FF6B35'

  const d = new Date(order.ordered_at)
  const dateStr = `${d.getMonth() + 1}/${d.getDate()}`

  return (
    <>
      {showConfirm && <ConfirmOrderModal order={order} userName={userName} onDone={() => { setShowConfirm(false); onRefresh() }} onClose={() => setShowConfirm(false)} />}
      {showReceive && <ReceiveModal order={order} userName={userName} onDone={() => { setShowReceive(false); onRefresh() }} onClose={() => setShowReceive(false)} />}

      <div style={{ ...card, borderLeft, padding: '12px 14px' }}>
        {/* 1줄: 상태 + 지점 + 날짜 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: statusColor[order.status] || '#888' }}>
              {statusLabel[order.status] || order.status}
            </span>
            <StoreBadge storeId={order.store_id} />
            {isOverdue && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(232,67,147,0.12)', color: '#E84393', fontWeight: 700 }}>지연</span>}
          </div>
          <span style={{ fontSize: 11, color: '#aaa' }}>{dateStr} · {order.ordered_by}</span>
        </div>

        {/* 2줄: 품목명 + 수량 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>{order.item_name}</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#1a1a2e' }}>{order.quantity}</span>
            <span style={{ fontSize: 11, color: '#aaa' }}>{order.unit}</span>
          </div>
        </div>

        {/* 3줄: 발주처 + 메모 */}
        <div style={{ fontSize: 11, color: '#aaa', marginBottom: 8 }}>
          {order.supplier_name && <span>🏪 {order.supplier_name} · </span>}
          {order.memo && <span>💬 {order.memo}</span>}
          {!order.supplier_name && !order.memo && <span>—</span>}
        </div>

        {/* 액션 버튼 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {order.status === 'requested' && (
            <button onClick={() => setShowConfirm(true)} style={{ padding: '5px 12px', borderRadius: 8, background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.25)', color: '#6C5CE7', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              ✅ 주문확인
            </button>
          )}
          {order.status === 'ordered' && (
            <button onClick={() => setShowReceive(true)} style={{ padding: '5px 12px', borderRadius: 8, background: 'rgba(0,184,148,0.1)', border: '1px solid rgba(0,184,148,0.25)', color: '#00B894', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              📦 수령완료
            </button>
          )}
          <button onClick={() => setExpanded(p => !p)} style={{ padding: '5px 10px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 11, cursor: 'pointer' }}>
            {expanded ? '▲ 닫기' : '▼ 상세'}
          </button>
        </div>

        {/* 상세 펼치기 */}
        {expanded && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F4F6F9' }}>
            {order.status === 'received' && (
              <div style={{ fontSize: 11, color: '#00B894', marginBottom: 6 }}>
                📦 수령: {order.received_quantity ?? order.quantity}{order.unit} · {order.received_by} · {order.received_at ? new Date(order.received_at).toLocaleDateString('ko') : ''}
              </div>
            )}
            {order.status === 'ordered' && order.confirmed_by && (
              <div style={{ fontSize: 11, color: '#6C5CE7', marginBottom: 6 }}>
                ✅ 주문확인: {order.confirmed_by} · {order.confirmed_at ? new Date(order.confirmed_at).toLocaleDateString('ko') : ''}
              </div>
            )}
            <div style={{ fontSize: 11, color: '#bbb' }}>
              발주일: {new Date(order.ordered_at).toLocaleDateString('ko', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── 통계 ───
function AdminStats({ orders, selYear, selMonth }: { orders: any[]; selYear: number; selMonth: number }) {
  const monthly = useMemo(() => orders.filter(o => {
    const d = new Date(o.ordered_at)
    return d.getFullYear() === selYear && d.getMonth() + 1 === selMonth
  }), [orders, selYear, selMonth])

  const byStore: Record<string, { total: number; received: number; issue: number }> = {}
  STORES.forEach(s => { byStore[s.id] = { total: 0, received: 0, issue: 0 } })
  monthly.forEach(o => {
    if (!byStore[o.store_id]) byStore[o.store_id] = { total: 0, received: 0, issue: 0 }
    byStore[o.store_id].total++
    if (o.status === 'received') byStore[o.store_id].received++
    if (o.status === 'issue') byStore[o.store_id].issue++
  })

  const totalPending = orders.filter(o => o.status === 'requested' || o.status === 'ordered' || o.status === 'issue').length

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <div style={{ ...card, marginBottom: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>{selMonth}월 전체</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#1a1a2e' }}>{monthly.length}</div>
          <div style={{ fontSize: 10, color: '#bbb' }}>건</div>
        </div>
        <div style={{ ...card, marginBottom: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#E84393', marginBottom: 4 }}>현재 미완료</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#E84393' }}>{totalPending}</div>
          <div style={{ fontSize: 10, color: '#bbb' }}>건</div>
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>🏪 {selMonth}월 지점별 현황</div>
        {STORES.map(s => {
          const st = byStore[s.id] || { total: 0, received: 0, issue: 0 }
          const rate = st.total > 0 ? Math.round((st.received / st.total) * 100) : 0
          return (
            <div key={s.id} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{s.name}</span>
                <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#888' }}>
                  <span>총 {st.total}건</span>
                  <span style={{ color: '#00B894' }}>수령 {st.received}</span>
                  {st.issue > 0 && <span style={{ color: '#E84393' }}>이슈 {st.issue}</span>}
                </div>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: '#F4F6F9' }}>
                <div style={{ height: 6, borderRadius: 3, background: `linear-gradient(90deg,${s.color},${s.color}88)`, width: `${rate}%`, transition: 'width 0.4s' }} />
              </div>
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 2, textAlign: 'right' }}>수령완료 {rate}%</div>
            </div>
          )
        })}
      </div>

      {/* 전체 미완료 지점별 */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>⏳ 현재 미완료 (전체 기간)</div>
        {STORES.map(s => {
          const cnt = orders.filter(o => o.store_id === s.id && (o.status === 'requested' || o.status === 'ordered' || o.status === 'issue')).length
          return (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F4F6F9' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: s.color }}>{s.name}</span>
              <span style={{ fontSize: 15, fontWeight: 800, color: cnt > 0 ? '#E84393' : '#00B894' }}>{cnt}건</span>
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
export default function AdminOrderTab({ userName }: { userName: string }) {
  const supabase = createSupabaseBrowserClient()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [storeFilter, setStoreFilter] = useState<string>('all')
  const [subTab, setSubTab] = useState<'pending' | 'all' | 'stats'>('pending')
  const now = new Date()
  const [selYear, setSelYear] = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState(now.getMonth() + 1)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(now.getFullYear())

  useEffect(() => { loadOrders() }, [])

  async function loadOrders() {
    setLoading(true)
    const storeIds = STORES.map(s => s.id)
    // 각 지점 suppliers도 함께 조회
    const [ordersRes, suppliersRes] = await Promise.all([
      supabase.from('orders').select('*').in('store_id', storeIds).order('ordered_at', { ascending: false }).order('created_at', { ascending: true }),
      supabase.from('order_suppliers').select('*').in('store_id', storeIds),
    ])
    const supplierMap: Record<string, string> = {}
    if (suppliersRes.data) {
      suppliersRes.data.forEach((s: any) => { supplierMap[s.id] = s.name })
    }
    const enriched = (ordersRes.data || []).map((o: any) => ({
      ...o,
      supplier_name: o.supplier_id ? (supplierMap[o.supplier_id] || null) : null,
    }))
    setOrders(enriched)
    setLoading(false)
  }

  const visibleOrders = useMemo(() =>
    storeFilter === 'all' ? orders : orders.filter(o => o.store_id === storeFilter)
  , [orders, storeFilter])

  const pendingOrders = useMemo(() =>
    visibleOrders.filter(o => o.status === 'requested' || o.status === 'ordered' || o.status === 'issue')
  , [visibleOrders])

  const overdueOrders = useMemo(() =>
    pendingOrders.filter(o => {
      const diff = (now.getTime() - new Date(o.ordered_at).getTime()) / (1000 * 60 * 60 * 24)
      return diff > 2
    })
  , [pendingOrders])

  const monthlyOrders = useMemo(() =>
    visibleOrders.filter(o => {
      const d = new Date(o.ordered_at)
      return d.getFullYear() === selYear && d.getMonth() + 1 === selMonth
    })
  , [visibleOrders, selYear, selMonth])

  // 날짜별 그룹
  function groupByDate(list: any[]) {
    const map: Record<string, any[]> = {}
    list.forEach(o => {
      const d = new Date(o.ordered_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (!map[key]) map[key] = []
      map[key].push(o)
    })
    const statusOrder: Record<string, number> = { requested: 0, ordered: 1, issue: 2, received: 3, returned: 4 }
    Object.values(map).forEach(items => items.sort((a, b) => {
      const sa = statusOrder[a.status] ?? 5
      const sb = statusOrder[b.status] ?? 5
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
          const label = `${d.getMonth() + 1}월 ${d.getDate()}일`
          return (
            <div key={dateKey} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 8, paddingLeft: 2 }}>
                📅 {label} · {items.length}건
              </div>
              {items.map(o => (
                <AdminOrderCard key={o.id} order={o} userName={userName} onRefresh={loadOrders} />
              ))}
            </div>
          )
        })}
      </>
    )
  }

  const tabBtn = (key: typeof subTab, label: string, badge?: number) => (
    <button onClick={() => setSubTab(key)} style={{
      flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12,
      fontWeight: subTab === key ? 700 : 400,
      background: subTab === key ? '#fff' : 'transparent',
      color: subTab === key ? '#1a1a2e' : '#aaa',
      boxShadow: subTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
      position: 'relative' as const,
    }}>
      {label}
      {badge != null && badge > 0 && (
        <span style={{ marginLeft: 4, background: '#E84393', color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 5px', fontWeight: 700 }}>{badge}</span>
      )}
    </button>
  )

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>👑 관리자 발주 현황</span>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>전지점 통합 뷰</div>
        </div>
        <button onClick={loadOrders} style={{ padding: '6px 12px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 11, cursor: 'pointer' }}>
          🔄 새로고침
        </button>
      </div>

      {/* 지점 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={() => setStoreFilter('all')} style={{
          padding: '7px 14px', borderRadius: 10, border: storeFilter === 'all' ? '1.5px solid #1a1a2e' : '1px solid #E8ECF0',
          background: storeFilter === 'all' ? '#1a1a2e' : '#F4F6F9',
          color: storeFilter === 'all' ? '#fff' : '#888', fontSize: 12, fontWeight: storeFilter === 'all' ? 700 : 400, cursor: 'pointer'
        }}>전체</button>
        {STORES.map(s => (
          <button key={s.id} onClick={() => setStoreFilter(s.id)} style={{
            padding: '7px 14px', borderRadius: 10,
            border: storeFilter === s.id ? `1.5px solid ${s.color}` : '1px solid #E8ECF0',
            background: storeFilter === s.id ? s.bg : '#F4F6F9',
            color: storeFilter === s.id ? s.color : '#888', fontSize: 12, fontWeight: storeFilter === s.id ? 700 : 400, cursor: 'pointer'
          }}>{s.name}</button>
        ))}
      </div>

      {/* 서브 탭 */}
      <div style={{ display: 'flex', background: '#F4F6F9', borderRadius: 10, padding: 3, marginBottom: 10, gap: 2 }}>
        {tabBtn('pending', `미완료`, pendingOrders.length)}
        {tabBtn('all', '전체 내역')}
        {tabBtn('stats', '📊 통계')}
      </div>

      {/* 년/월 피커 (전체 내역/통계 탭) */}
      {subTab !== 'pending' && (
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
                <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(232,67,147,0.08)', border: '1px solid rgba(232,67,147,0.2)', marginBottom: 12, fontSize: 11, color: '#E84393', fontWeight: 600 }}>
                  🔴 2일 이상 미수령 {overdueOrders.length}건 있어요!
                </div>
              )}
              {pendingOrders.length === 0
                ? <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>🎉 전지점 미완료 발주가 없어요!</div>
                : <DateGroupedList list={pendingOrders} />
              }
            </>
          )}
          {subTab === 'all' && (
            monthlyOrders.length === 0
              ? <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>{selYear}년 {selMonth}월 발주 내역이 없어요</div>
              : <DateGroupedList list={monthlyOrders} />
          )}
          {subTab === 'stats' && <AdminStats orders={visibleOrders} selYear={selYear} selMonth={selMonth} />}
        </>
      )}
    </div>
  )
}