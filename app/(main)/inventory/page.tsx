'use client'
import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import OrderTab from '@/components/OrderTab'
import AdminOrderTab from '@/components/AdminOrderTab'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

function getStatus(tot: number, minQty: number, warnQty: number) {
  if (tot <= minQty) return 'low'
  if (tot <= warnQty) return 'warn'
  return 'ok'
}

// ─── 장소 그룹 섹션 ───
function PlaceGroupSection({ grp, gPlaces, editingId, editName, editGroup, setEditName, setEditGroup, setEditingId, handleUpdate, handleDelete, handleDrop, PRESET_GROUPS }: {
  grp: string; gPlaces: any[]
  editingId: string | null; editName: string; editGroup: string
  setEditName: (v: string) => void; setEditGroup: (v: string) => void; setEditingId: (v: string | null) => void
  handleUpdate: (id: string) => void; handleDelete: (id: string, name: string) => void
  handleDrop: (places: any[]) => void; PRESET_GROUPS: string[]
}) {
  const [localPlaces, setLocalPlaces] = useState<any[]>(gPlaces)
  const dragItem = useRef<number | null>(null)
  const dragOver = useRef<number | null>(null)

  useEffect(() => { setLocalPlaces(gPlaces) }, [JSON.stringify(gPlaces)])

  function onDragStart(e: React.DragEvent, idx: number) {
    dragItem.current = idx
    e.dataTransfer.effectAllowed = 'move'
  }
  function onDragEnter(idx: number) { dragOver.current = idx }
  function onDragEnd() {
    if (dragItem.current === null || dragOver.current === null) return
    const newList = [...localPlaces]
    const dragged = newList.splice(dragItem.current, 1)[0]
    newList.splice(dragOver.current, 0, dragged)
    dragItem.current = null; dragOver.current = null
    setLocalPlaces(newList)
    handleDrop(newList)
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 6, paddingLeft: 2 }}>{grp}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {localPlaces.map((place: any, idx: number) => (
          editingId === place.id ? (
            <div key={place.id} style={{ background: 'rgba(255,107,53,0.06)', borderRadius: 12, padding: 10, border: '1px solid rgba(255,107,53,0.2)' }}>
              <select value={editGroup} onChange={e => setEditGroup(e.target.value)} style={{ ...inp, marginBottom: 6, appearance: 'auto' as any }}>
                {PRESET_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <input value={editName} onChange={e => setEditName(e.target.value)} style={{ ...inp, marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => handleUpdate(place.id)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>저장</button>
                <button onClick={() => setEditingId(null)} style={{ padding: '8px 14px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer', fontSize: 12 }}>취소</button>
              </div>
            </div>
          ) : (
            <div key={place.id}
              draggable
              onDragStart={e => onDragStart(e, idx)}
              onDragEnter={() => onDragEnter(idx)}
              onDragEnd={onDragEnd}
              onDragOver={e => e.preventDefault()}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8F9FB', borderRadius: 10, padding: '8px 12px', cursor: 'grab', userSelect: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, color: '#ccc' }}>☰</span>
                <span style={{ fontSize: 13, color: '#1a1a2e' }}>{place.name}</span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setEditingId(place.id); setEditName(place.name); setEditGroup(place.group_name) }} style={{ background: 'none', border: 'none', fontSize: 11, color: '#aaa', cursor: 'pointer' }}>수정</button>
                <button onClick={() => handleDelete(place.id, place.name)} style={{ background: 'none', border: 'none', fontSize: 11, color: '#E84393', cursor: 'pointer' }}>삭제</button>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  )
}

// ─── PlaceManager ───
function PlaceManager({ storeId, onClose, onSaved, groupOrder, onGroupReorder }: {
  storeId: string; onClose: () => void; onSaved: () => void
  groupOrder: string[]; onGroupReorder: (newOrder: string[]) => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [places, setPlaces] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editGroup, setEditGroup] = useState('')
  const [newName, setNewName] = useState('')
  const [newGroup, setNewGroup] = useState('홀')
  const [customGroup, setCustomGroup] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [activeTab, setActiveTab] = useState<'places' | 'groups'>('places')
  const [localGroupOrder, setLocalGroupOrder] = useState<string[]>(groupOrder)
  const groupDragItem = useRef<number | null>(null)
  const groupDragOver = useRef<number | null>(null)
  const PRESET_GROUPS = ['홀', '주방', '창고']

  useEffect(() => { loadPlaces() }, [])
  useEffect(() => { setLocalGroupOrder(groupOrder) }, [JSON.stringify(groupOrder)])

  async function loadPlaces() {
    const { data } = await supabase.from('inventory_places').select('*').eq('store_id', storeId).order('sort_order').order('group_name')
    setPlaces(data || [])
  }

  async function handleAdd() {
    const groupVal = newGroup === '__custom__' ? customGroup.trim() : newGroup
    if (!newName.trim() || !groupVal) return
    const maxOrder = places.filter(p => p.group_name === groupVal).reduce((max, p) => Math.max(max, p.sort_order ?? 0), 0)
    await supabase.from('inventory_places').insert({ store_id: storeId, name: newName.trim(), group_name: groupVal, sort_order: maxOrder + 1 })
    setNewName(''); setIsAdding(false); setCustomGroup('')
    loadPlaces(); onSaved()
  }

  async function handleUpdate(id: string) {
    if (!editName.trim() || !editGroup.trim()) return
    await supabase.from('inventory_places').update({ name: editName, group_name: editGroup }).eq('id', id)
    setEditingId(null); loadPlaces(); onSaved()
  }

  async function handleDelete(id: string, name: string) {
    const { count } = await supabase.from('inventory_stock').select('*', { count: 'exact', head: true }).eq('place', name).gt('quantity', 0)
    if (count && count > 0) { alert('재고가 있는 장소는 삭제할 수 없습니다.\n재고를 먼저 0으로 초기화해주세요.'); return }
    if (!confirm(`"${name}" 장소를 삭제할까요?`)) return
    await supabase.from('inventory_places').delete().eq('id', id)
    loadPlaces(); onSaved()
  }

  async function handleDrop(groupPlaces: any[]) {
    await Promise.all(groupPlaces.map((p, i) => supabase.from('inventory_places').update({ sort_order: i + 1 }).eq('id', p.id)))
    loadPlaces(); onSaved()
  }

  function onGroupDragStart(e: React.DragEvent, idx: number) {
    groupDragItem.current = idx
    e.dataTransfer.effectAllowed = 'move'
  }
  function onGroupDragEnter(idx: number) { groupDragOver.current = idx }
  function onGroupDragEnd() {
    if (groupDragItem.current === null || groupDragOver.current === null) return
    const newList = [...localGroupOrder]
    const dragged = newList.splice(groupDragItem.current, 1)[0]
    newList.splice(groupDragOver.current, 0, dragged)
    groupDragItem.current = null; groupDragOver.current = null
    setLocalGroupOrder(newList)
    onGroupReorder(newList)
  }

  const grouped = places.reduce((acc: Record<string, any[]>, p) => {
    const k = p.group_name || '기타'
    if (!acc[k]) acc[k] = []
    acc[k].push(p)
    return acc
  }, {})

  const orderedGroups = [...localGroupOrder.filter(g => grouped[g]), ...Object.keys(grouped).filter(g => !localGroupOrder.includes(g))]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>📍 장소 관리</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', background: '#F4F6F9', borderRadius: 10, padding: 3, marginBottom: 16 }}>
          <button onClick={() => setActiveTab('places')} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: activeTab === 'places' ? 700 : 400, background: activeTab === 'places' ? '#fff' : 'transparent', color: activeTab === 'places' ? '#1a1a2e' : '#aaa', boxShadow: activeTab === 'places' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>장소 관리</button>
          <button onClick={() => setActiveTab('groups')} style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: activeTab === 'groups' ? 700 : 400, background: activeTab === 'groups' ? '#fff' : 'transparent', color: activeTab === 'groups' ? '#FF6B35' : '#aaa', boxShadow: activeTab === 'groups' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>카테고리 순서</button>
        </div>

        {activeTab === 'groups' && (
          <div>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 12, paddingLeft: 2 }}>☰ 드래그로 큰 카테고리(홀/주방/창고) 순서를 변경하세요</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {localGroupOrder.map((grp, idx) => (
                <div key={grp}
                  draggable
                  onDragStart={e => onGroupDragStart(e, idx)}
                  onDragEnter={() => onGroupDragEnter(idx)}
                  onDragEnd={onGroupDragEnd}
                  onDragOver={e => e.preventDefault()}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: '#F8F9FB', border: '1px solid #E8ECF0', cursor: 'grab', userSelect: 'none' }}>
                  <span style={{ fontSize: 16, color: '#ccc' }}>☰</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{grp}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#bbb' }}>{idx + 1}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: '#aaa', padding: '8px 12px', borderRadius: 8, background: 'rgba(108,92,231,0.05)', border: '1px solid rgba(108,92,231,0.1)' }}>
              ✅ 순서는 자동 저장됩니다
            </div>
          </div>
        )}

        {activeTab === 'places' && (
          <>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 12, paddingLeft: 2 }}>☰ 드래그로 장소 순서를 변경할 수 있어요</div>
            {orderedGroups.map(grp => (
              <PlaceGroupSection
                key={grp}
                grp={grp}
                gPlaces={grouped[grp] || []}
                editingId={editingId}
                editName={editName}
                editGroup={editGroup}
                setEditName={setEditName}
                setEditGroup={setEditGroup}
                setEditingId={setEditingId}
                handleUpdate={handleUpdate}
                handleDelete={handleDelete}
                handleDrop={handleDrop}
                PRESET_GROUPS={PRESET_GROUPS}
              />
            ))}

            {isAdding ? (
              <div style={{ border: '2px dashed rgba(255,107,53,0.3)', borderRadius: 14, padding: 14, marginTop: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#FF6B35', marginBottom: 10 }}>새 장소 추가</div>
                <select value={newGroup} onChange={e => setNewGroup(e.target.value)} style={{ ...inp, appearance: 'auto' as any, marginBottom: 8 }}>
                  {PRESET_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                  <option value="__custom__">직접입력</option>
                </select>
                {newGroup === '__custom__' && <input value={customGroup} onChange={e => setCustomGroup(e.target.value)} placeholder="카테고리명 입력" style={{ ...inp, marginBottom: 8 }} />}
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="예: 주방 냉동고" style={{ ...inp, marginBottom: 10 }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={handleAdd} style={{ flex: 1, padding: '9px 0', borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>추가</button>
                  <button onClick={() => setIsAdding(false)} style={{ padding: '9px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setIsAdding(true)} style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: '2px dashed #E8ECF0', background: 'transparent', color: '#bbb', fontSize: 13, cursor: 'pointer', marginTop: 8 }}>
                + 장소 추가
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── 전역 검색 패널 ───
// [수정] onNavigate에 itemId 파라미터 추가
function GlobalSearchPanel({ query, items, places, stock, onClose, onNavigate }: {
  query: string; items: any[]; places: any[]; stock: Record<string, any>
  onClose: () => void
  onNavigate: (group: string, placeName: string, itemId?: string) => void
}) {
  const getQty = (itemId: string, placeName: string) => stock[itemId + '-' + placeName]?.quantity ?? -1
  const hasStockFn = (itemId: string, placeName: string) => (itemId + '-' + placeName) in stock
  const totalQtyFn = (itemId: string) => places.reduce((s, pl) => { const q = getQty(itemId, pl.name); return s + (q >= 0 ? q : 0) }, 0)

  const results = useMemo(() => {
    if (!query.trim()) return []
    return items.filter(item => item.name.includes(query.trim())).map(item => {
      const locs = places.filter(pl => hasStockFn(item.id, pl.name)).map(pl => ({ name: pl.name, group: pl.group_name, qty: getQty(item.id, pl.name) }))
      return { ...item, total: totalQtyFn(item.id), locations: locs }
    })
  }, [query, items, places, stock])

  if (!query.trim()) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 150, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 540, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '75vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>🔍 "{query}" 검색 결과</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ fontSize: 11, color: '#aaa', marginBottom: 14 }}>위치 태그를 누르면 해당 장소로 이동해요</div>
        {results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#bbb', fontSize: 13 }}>검색 결과가 없습니다</div>
        ) : results.map(item => {
          const s = getStatus(item.total, item.min_qty, item.warn_qty ?? 3)
          const color = s === 'low' ? '#E84393' : s === 'warn' ? '#B8860B' : '#1a1a2e'
          return (
            <div key={item.id} style={{ ...bx, border: s === 'low' ? '1px solid rgba(232,67,147,0.35)' : s === 'warn' ? '1px solid rgba(253,196,0,0.5)' : '1px solid #E8ECF0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 }}>
                {/* [수정] 이름+뱃지 레이아웃 개선 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                  {s === 'low' && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(232,67,147,0.12)', color: '#E84393', fontWeight: 700, flexShrink: 0 }}>🔴 부족</span>}
                  {s === 'warn' && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(253,196,0,0.15)', color: '#B8860B', fontWeight: 700, flexShrink: 0 }}>🟡 주의</span>}
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', wordBreak: 'break-word' }}>{item.name}</span>
                </div>
                <span style={{ fontSize: 16, fontWeight: 800, color, flexShrink: 0 }}>{item.total}{item.unit}</span>
              </div>
              {item.locations.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {item.locations.map((loc: any) => (
                    <button
                      key={loc.name}
                      // [수정] item.id를 함께 전달
                      onClick={() => { onNavigate(loc.group, loc.name, item.id); onClose() }}
                      style={{
                        fontSize: 10, padding: '3px 10px', borderRadius: 20,
                        background: 'rgba(108,92,231,0.08)', color: '#6C5CE7',
                        border: '1px solid rgba(108,92,231,0.2)',
                        cursor: 'pointer', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 4
                      }}>
                      📍 {loc.group && `${loc.group} › `}{loc.name} <strong>{loc.qty}{item.unit}</strong>
                      <span style={{ fontSize: 9, opacity: 0.7 }}>→ 이동</span>
                    </button>
                  ))}
                </div>
              ) : <div style={{ fontSize: 11, color: '#E84393' }}>재고 없음</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── 변경이력 ───
function LogTab({ storeId, items }: { storeId: string; items: any[] }) {
  const supabase = createSupabaseBrowserClient()
  const [logs, setLogs] = useState<any[]>([])
  useEffect(() => {
    if (!items.length) return
    supabase.from('inventory_logs').select('*, inventory_items(name,unit)').in('item_id', items.map(x => x.id))
      .order('created_at', { ascending: false }).limit(50).then(({ data }) => setLogs(data || []))
  }, [items])
  return (
    <div>
      {logs.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: '#bbb', fontSize: 12 }}>변경 이력이 없습니다</div>}
      {logs.map(log => (
        <div key={log.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8ECF0', padding: '10px 14px', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{log.inventory_items?.name}</span>
            <span style={{ fontSize: 10, color: '#999' }}>{log.place}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: '#666' }}>
              {log.before_qty} → <span style={{ color: log.after_qty > log.before_qty ? '#00B894' : '#E84393', fontWeight: 700 }}>{log.after_qty}</span> {log.inventory_items?.unit}
            </span>
            <span style={{ fontSize: 10, color: '#bbb' }}>{log.changed_by} · {new Date(log.created_at).toLocaleDateString('ko')}</span>
          </div>
        </div>
      ))}
    </div>
  )
}


// ═══════════════════════════════════════
// 메인
// ═══════════════════════════════════════
// ─── 재고탭 빠른 발주요청 모달 ───
function QuickOrderRequestModal({ item, storeId, userName, suppliers, onClose, onSaved }: {
  item: any; storeId: string; userName: string; suppliers: any[]; onClose: () => void; onSaved: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [qty, setQty] = useState(1)
  const [unit, setUnit] = useState(item?.unit || 'ea')
  const [supplierId, setSupplierId] = useState('')
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  if (!item) return null

  async function handleSubmit() {
    if (!qty || qty <= 0) return
    setSaving(true)
    const supplier = suppliers.find(s => s.id === supplierId)
    await supabase.from('orders').insert({
      store_id: storeId,
      item_name: item.name,
      quantity: qty,
      unit,
      status: 'requested',
      ordered_by: userName,
      ordered_at: new Date().toISOString(),
      supplier_id: supplierId || null,
      supplier_name: supplier?.name || null,
      memo: memo.trim() || null,
      inventory_item_id: item.id,
    })
    setSaving(false)
    onSaved(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 210, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>📋 발주 요청</div>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>{item.name} · 현재 재고 부족</div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 2 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>수량</div>
            <input type="number" value={qty} onChange={e => setQty(Math.max(1, Number(e.target.value)))}
              style={{ ...inp }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>단위</div>
            <div style={{ ...inp, background: '#F4F6F9', color: '#6C5CE7', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              🔒 {unit}
            </div>
          </div>
        </div>

        {suppliers.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>발주처 (선택)</div>
            <select value={supplierId} onChange={e => setSupplierId(e.target.value)} style={{ ...inp, appearance: 'auto' as any }}>
              <option value="">선택 안함</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>메모 (선택)</div>
          <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="특이사항" style={inp} />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSubmit} disabled={saving || !qty}
            style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? '요청 중...' : '📋 발주 요청'}
          </button>
          <button onClick={onClose} style={{ padding: '12px 16px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
        </div>
      </div>
    </div>
  )
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#bbb' }}>불러오는 중...</div>}>
      <InventoryPageInner />
    </Suspense>
  )
}

function InventoryPageInner() {
  const supabase = createSupabaseBrowserClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const mainTab = (['order', 'admin'].includes(searchParams.get('tab') || '') ? searchParams.get('tab') : 'stock') as 'stock' | 'order' | 'admin'
  function setMainTab(tab: 'stock' | 'order' | 'admin') {
    router.replace(`?tab=${tab}`, { scroll: false })
  }
  const [storeId, setStoreId] = useState('')
  const [userName, setUserName] = useState('')
  const [isEdit, setIsEdit] = useState(false)
  const [userRole, setUserRole] = useState('')
  const [items, setItems] = useState<any[]>([])
  const [places, setPlaces] = useState<any[]>([])
  const [stock, setStock] = useState<Record<string, any>>({})
  const [group, setGroup] = useState<string>('')
  const [subTab, setSubTab] = useState<string>('')
  const [stockTab, setStockTab] = useState<'warn' | 'all' | 'place'>('place')
  const [stockSearchQ, setStockSearchQ] = useState('')
  const [highlightStockId, setHighlightStockId] = useState<string | null>(null)
  const [showQuickOrder, setShowQuickOrder] = useState<any | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [showMoveItem, setShowMoveItem] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<any | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const [showSearchPanel, setShowSearchPanel] = useState(false)
  const [nm, setNm] = useState('')
  const [unit, setUnit] = useState('ea')
  const [minQty, setMinQty] = useState(1)
  const [warnQty, setWarnQty] = useState(3)
  const [alertOpen, setAlertOpen] = useState(false)
  const [showPlaceMgr, setShowPlaceMgr] = useState(false)
  const [itemOrders, setItemOrders] = useState<Record<string, Record<string, number>>>({})
  const [groupOrder, setGroupOrder] = useState<string[]>([])
  const [isPC, setIsPC] = useState(false)
  const [suppliers, setSuppliers] = useState<any[]>([])
  // [추가] 검색으로 이동 시 하이라이트 할 품목 ID
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null)
  const dragItem = useRef<string | null>(null)
  const dragOver = useRef<string | null>(null)
  const initializedRef = useRef(false)
  // [추가] 검색 이동 시 group useEffect가 subTab 초기화하는 버그 방지용 ref
  const navigatingRef = useRef(false)

  useEffect(() => {
    const check = () => setIsPC(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const groups = useMemo(() => {
    const all = [...new Set(places.map(p => p.group_name).filter(Boolean))]
    if (groupOrder.length === 0) return all
    return [...groupOrder.filter(g => all.includes(g)), ...all.filter(g => !groupOrder.includes(g))]
  }, [places, groupOrder])

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id)
    setUserName(user.nm)
    setUserRole(user.role || '')
    setIsEdit(user.role === 'owner' || user.role === 'manager')
    loadAll(store.id)
  }, [])

  // [수정] navigatingRef 체크 추가 — 검색으로 이동 시 subTab 초기화 방지
  useEffect(() => {
    if (!initializedRef.current) return
    if (navigatingRef.current) {
      navigatingRef.current = false
      return
    }
    if (!group || places.length === 0) return
    const subs = places.filter(p => p.group_name === group)
    setSubTab(subs[0]?.name || '')
    setStockTab('place'); setSearchQ('')
  }, [group])

  async function loadAll(sid: string) {
    const { data: pl } = await supabase.from('inventory_places').select('*').eq('store_id', sid).order('sort_order').order('group_name')
    const placeList = pl || []
    setPlaces(placeList)

    if (!initializedRef.current && placeList.length > 0) {
      const firstGroup = placeList[0].group_name || ''
      const firstSub = placeList.find(p => p.group_name === firstGroup)?.name || ''
      setGroup(firstGroup); setSubTab(firstSub)
      initializedRef.current = true
    }

    const { data: it } = await supabase.from('inventory_items').select('*').eq('store_id', sid).order('name')
    const itemList = it || []
    setItems(itemList)

    if (itemList.length > 0) {
      const { data: st } = await supabase.from('inventory_stock').select('*').in('item_id', itemList.map((x: any) => x.id))
      const map: Record<string, any> = {}
      if (st) st.forEach((s: any) => { map[s.item_id + '-' + s.place] = s })
      setStock(map)
    }

    const { data: orders } = await supabase.from('inventory_place_item_order').select('*').eq('store_id', sid)
    const om: Record<string, Record<string, number>> = {}
    if (orders) orders.forEach((o: any) => {
      if (!om[o.place_name]) om[o.place_name] = {}
      om[o.place_name][o.item_id as string] = o.sort_order
    })
    setItemOrders(om)

    const { data: sup } = await supabase.from('order_suppliers').select('*').eq('store_id', sid).order('name')
    setSuppliers(sup || [])

    const { data: setting } = await supabase.from('store_settings').select('value').eq('store_id', sid).eq('key', 'group_order').maybeSingle()
    if (setting?.value) {
      try { setGroupOrder(JSON.parse(setting.value)) } catch {}
    } else {
      // DB에 없으면 localStorage에서 복원 (마이그레이션 전 데이터 대비)
      const local = localStorage.getItem(`inv_group_order_${sid}`)
      if (local) {
        try {
          const parsed = JSON.parse(local)
          setGroupOrder(parsed)
          // DB에도 올려줌
          supabase.from('store_settings').upsert(
            { store_id: sid, key: 'group_order', value: local, updated_at: new Date().toISOString() },
            { onConflict: 'store_id,key' }
          )
        } catch {}
      }
    }
  }

  async function handleGroupReorder(newOrder: string[]) {
    setGroupOrder(newOrder)
    // localStorage에도 백업 저장 (오프라인/에러 대비)
    if (storeId) localStorage.setItem(`inv_group_order_${storeId}`, JSON.stringify(newOrder))
    if (storeId) {
      const { error } = await supabase.from('store_settings').upsert(
        { store_id: storeId, key: 'group_order', value: JSON.stringify(newOrder), updated_at: new Date().toISOString() },
        { onConflict: 'store_id,key' }
      )
      if (error) console.error('카테고리 순서 저장 실패:', error)
    }
    if (newOrder.length > 0 && !newOrder.includes(group)) {
      setGroup(newOrder[0])
    }
  }

  // [수정] navigatingRef 플래그 세팅 + 하이라이트 적용
  function handleNavigate(targetGroup: string, targetPlace: string, targetItemId?: string) {
    navigatingRef.current = true
    setGroup(targetGroup)
    setSubTab(targetPlace)
    setStockTab('place')
    setSearchQ('')
    setShowSearchPanel(false)
    if (targetItemId) {
      setHighlightedItemId(targetItemId)
      setTimeout(() => setHighlightedItemId(null), 3000)
    }
  }

  function goToStockItem(itemId: string, tab: 'warn' | 'all') {
    setStockTab(tab)
    setStockSearchQ('')
    setHighlightStockId(itemId)
    setTimeout(() => {
      const el = document.querySelector(`[data-stock-id="${itemId}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
    setTimeout(() => setHighlightStockId(null), 3000)
  }

  const getQty = useCallback((itemId: string, place: string) => stock[itemId + '-' + place]?.quantity ?? -1, [stock])
  const placeNames = useMemo(() => places.map(p => p.name), [places])
  const totalQty = useCallback((itemId: string) => placeNames.reduce((s, pl) => { const q = getQty(itemId, pl); return s + (q >= 0 ? q : 0) }, 0), [placeNames, getQty])
  const hasStock = useCallback((itemId: string, place: string) => (itemId + '-' + place) in stock, [stock])

  function sortItemsByPlace(itemList: any[], placeName: string) {
    const orders = itemOrders[placeName] || {}
    return [...itemList].sort((a, b) => (orders[a.id as string] ?? 9999) - (orders[b.id as string] ?? 9999))
  }

  function onItemDragStart(e: React.DragEvent, itemId: string) {
    dragItem.current = itemId
    e.dataTransfer.effectAllowed = 'move'
  }
  function onItemDragEnter(itemId: string) { dragOver.current = itemId }

  async function onItemDragEnd(currentItems: any[], placeName: string) {
    if (!dragItem.current || !dragOver.current || dragItem.current === dragOver.current) return
    const fromIdx = currentItems.findIndex(i => i.id === dragItem.current)
    const toIdx = currentItems.findIndex(i => i.id === dragOver.current)
    const newList = [...currentItems]
    const dragged = newList.splice(fromIdx, 1)[0]
    newList.splice(toIdx, 0, dragged)
    dragItem.current = null; dragOver.current = null

    const newOrders: Record<string, Record<string, number>> = { ...itemOrders, [placeName]: {} }
    newList.forEach((item, i) => { newOrders[placeName][item.id as string] = i + 1 })
    setItemOrders(newOrders)

    await supabase.from('inventory_place_item_order').upsert(
      newList.map((item, i) => ({ store_id: storeId, place_name: placeName, item_id: item.id, sort_order: i + 1 })),
      { onConflict: 'store_id,place_name,item_id' }
    )
  }

  async function updateQty(itemId: string, place: string, newVal: number) {
    const old = getQty(itemId, place)
    const val = Math.max(0, newVal)
    const now = new Date().toISOString()
    const newStockEntry = { item_id: itemId, place, quantity: val, updated_by: userName, updated_at: now, before_qty: old >= 0 ? old : val, after_qty: val }
    setStock(p => ({ ...p, [itemId + '-' + place]: newStockEntry }))
    await supabase.from('inventory_stock').upsert(
      { item_id: itemId, place, quantity: val, updated_by: userName, updated_at: now, before_qty: old >= 0 ? old : val, after_qty: val },
      { onConflict: 'item_id,place' }
    )
    if (old >= 0 && old !== val) {
      await supabase.from('inventory_logs').insert({ item_id: itemId, place, before_qty: old, after_qty: val, changed_by: userName })
    }
  }

  // 수량 변경 없이 "확인" 처리 — 날짜/담당자만 업데이트
  async function checkQty(itemId: string, place: string) {
    const cur = getQty(itemId, place)
    const now = new Date().toISOString()
    setStock(p => ({ ...p, [itemId + '-' + place]: { ...(p[itemId + '-' + place] || {}), updated_by: userName, updated_at: now, before_qty: cur, after_qty: cur } }))
    await supabase.from('inventory_stock').upsert(
      { item_id: itemId, place, quantity: cur >= 0 ? cur : 0, updated_by: userName, updated_at: now, before_qty: cur >= 0 ? cur : 0, after_qty: cur >= 0 ? cur : 0 },
      { onConflict: 'item_id,place' }
    )
  }

  async function addItem() {
    if (!nm.trim() || !storeId) return
    const { data } = await supabase.from('inventory_items').insert({ store_id: storeId, name: nm.trim(), unit, min_qty: minQty, warn_qty: warnQty }).select().single()
    if (data) setItems(p => [...p, data])
    setNm(''); setUnit('ea'); setMinQty(1); setWarnQty(3); setShowAdd(false)
  }

  async function deleteItem(itemId: string, itemName: string) {
    if (!confirm(itemName + ' 삭제할까요?')) return
    await supabase.from('inventory_items').delete().eq('id', itemId)
    await supabase.from('inventory_stock').delete().eq('item_id', itemId)
    setItems(p => p.filter(x => x.id !== itemId))
    setStock(p => { const n = { ...p }; placeNames.forEach(pl => delete n[itemId + '-' + pl]); return n })
  }

  async function saveEditItem() {
    if (!editItem) return
    const original = items.find(x => x.id === editItem.id)
    await supabase.from('inventory_items').update({ name: editItem.name, unit: editItem.unit, min_qty: editItem.min_qty, warn_qty: editItem.warn_qty }).eq('id', editItem.id)
    // 이름이 바뀌었으면 연동된 발주 건도 같이 업데이트
    if (original && original.name !== editItem.name) {
      await supabase.from('orders').update({ item_name: editItem.name }).eq('inventory_item_id', editItem.id)
    }
    setItems(p => p.map(x => x.id === editItem.id ? { ...x, ...editItem } : x))
    setEditItem(null)
  }

  async function addToPlace(itemId: string, place: string) {
    if (hasStock(itemId, place)) return
    setStock(p => ({ ...p, [itemId + '-' + place]: { item_id: itemId, place, quantity: 0 } }))
    await supabase.from('inventory_stock').upsert({ item_id: itemId, place, quantity: 0 }, { onConflict: 'item_id,place' })
  }

  async function removeFromPlace(itemId: string, place: string) {
    setStock(p => { const n = { ...p }; delete n[itemId + '-' + place]; return n })
    await supabase.from('inventory_stock').delete().eq('item_id', itemId).eq('place', place)
  }

  const lowItems = useMemo(() => items.filter(item => { const tot = totalQty(item.id); return tot >= 0 && tot <= item.min_qty }), [items, totalQty])
  const warnItems = useMemo(() => items.filter(item => { const tot = totalQty(item.id); const wq = item.warn_qty ?? 3; return tot > item.min_qty && tot <= wq }), [items, totalQty])
  const subPlaces = places.filter(p => p.group_name === group)
  const filteredBySearch = useCallback((list: any[]) => searchQ.trim() ? list.filter(item => item.name.includes(searchQ.trim())) : list, [searchQ])
  const sortByStatus = useCallback((list: any[]) => [...list].sort((a, b) => {
    const order: Record<string, number> = { low: 0, warn: 1, ok: 2 }
    return order[getStatus(totalQty(a.id), a.min_qty, a.warn_qty ?? 3)] - order[getStatus(totalQty(b.id), b.min_qty, b.warn_qty ?? 3)]
  }), [totalQty])

  const allItems = sortByStatus(filteredBySearch(items))
  const currentItems = sortItemsByPlace(filteredBySearch(items.filter(item => hasStock(item.id, subTab))), subTab)

  const statusBadge = (tot: number, minQ: number, warnQ: number) => {
    const s = getStatus(tot, minQ, warnQ)
    if (s === 'low') return <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(232,67,147,0.12)', color: '#E84393', fontWeight: 700, flexShrink: 0 }}>🔴 부족</span>
    if (s === 'warn') return <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(253,196,0,0.15)', color: '#B8860B', fontWeight: 700, flexShrink: 0 }}>🟡 주의</span>
    return null
  }

  const borderColor = (tot: number, minQ: number, warnQ: number) => {
    const s = getStatus(tot, minQ, warnQ)
    if (s === 'low') return '1px solid rgba(232,67,147,0.35)'
    if (s === 'warn') return '1px solid rgba(253,196,0,0.5)'
    return '1px solid #E8ECF0'
  }

  // [수정] 하이라이트 품목 카드 스타일
  const getCardStyle = (itemId: string, tot: number, minQ: number, warnQ: number, extraStyle?: any) => {
    const isHighlighted = highlightedItemId === itemId
    return {
      ...bx,
      border: isHighlighted ? '2px solid #6C5CE7' : borderColor(tot, minQ, warnQ),
      background: isHighlighted ? 'rgba(108,92,231,0.04)' : '#fff',
      transition: 'border 0.4s, background 0.4s',
      ...extraStyle,
    }
  }

  const groupEmoji: Record<string, string> = { '홀': '🍽', '주방': '👨‍🍳', '창고': '📦' }

  // ── 발주 탭 early return ──
  const MainTabBar = () => (
    <div style={{ display: 'flex', background: '#F4F6F9', borderRadius: 12, padding: 4, marginBottom: 16, gap: 4 }}>
      {(['stock', 'order'] as const).map(k => (
        <button key={k} onClick={() => setMainTab(k)} style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: mainTab === k ? 700 : 400, background: mainTab === k ? 'linear-gradient(135deg,#FF6B35,#E84393)' : 'transparent', color: mainTab === k ? '#fff' : '#aaa', boxShadow: mainTab === k ? '0 2px 8px rgba(255,107,53,0.3)' : 'none' }}>
          {k === 'stock' ? '📦 재고' : '📋 발주'}
        </button>
      ))}
      {userRole === 'owner' && (
        <button onClick={() => setMainTab('admin')} style={{ flex: 1, padding: '10px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: mainTab === 'admin' ? 700 : 400, background: mainTab === 'admin' ? 'linear-gradient(135deg,#6C5CE7,#a29bfe)' : 'transparent', color: mainTab === 'admin' ? '#fff' : '#aaa', boxShadow: mainTab === 'admin' ? '0 2px 8px rgba(108,92,231,0.3)' : 'none' }}>
          👑 관리자
        </button>
      )}
    </div>
  )

  if (mainTab === 'admin') return (
    <div style={{ padding: isPC ? '20px 28px' : '0' }}>
      <MainTabBar />
      <AdminOrderTab userName={userName} places={places} />
    </div>
  )

  if (mainTab === 'order') return (
    <div style={{ padding: isPC ? '20px 28px' : '0' }}>
      <MainTabBar />
      <OrderTab storeId={storeId} userName={userName} isEdit={isEdit} userRole={userRole} inventoryItems={items} places={places} />
    </div>
  )

  if (showLog) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <button onClick={() => setShowLog(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}>←</button>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>변경이력</span>
      </div>
      <LogTab storeId={storeId} items={items} />
    </div>
  )

  // ── PC 레이아웃 ──
  if (isPC) {
    return (
      <div style={{ padding: '20px 28px' }}>
        <MainTabBar />
        {showPlaceMgr && (
          <PlaceManager
            storeId={storeId}
            onClose={() => setShowPlaceMgr(false)}
            onSaved={() => { initializedRef.current = false; loadAll(storeId) }}
            groupOrder={groups}
            onGroupReorder={handleGroupReorder}
          />
        )}
        {showSearchPanel && (
          <GlobalSearchPanel
            query={searchQ}
            items={items}
            places={places}
            stock={stock}
            onClose={() => setShowSearchPanel(false)}
            onNavigate={handleNavigate}
          />
        )}
        {editItem && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 340 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 14 }}>품목 수정</div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>품목명</div>
              <input value={editItem.name} onChange={e => setEditItem({ ...editItem, name: e.target.value })} style={{ ...inp, marginBottom: 10 }} />
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>단위</div>
              <select value={editItem.unit} onChange={e => setEditItem({ ...editItem, unit: e.target.value })} style={{ ...inp, appearance: 'auto' as any, marginBottom: 10 }}>
                <option value="ea">ea</option><option value="box">box</option><option value="kg">kg</option><option value="L">L</option><option value="병">병</option>
              </select>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: '#E84393', marginBottom: 4 }}>🔴 최소수량</div><input type="number" value={editItem.min_qty} onChange={e => setEditItem({ ...editItem, min_qty: Math.max(0, Number(e.target.value)) })} style={inp} /></div>
                <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: '#B8860B', marginBottom: 4 }}>🟡 주의수량</div><input type="number" value={editItem.warn_qty ?? 3} onChange={e => setEditItem({ ...editItem, warn_qty: Math.max(0, Number(e.target.value)) })} style={inp} /></div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={saveEditItem} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>저장</button>
                <button onClick={() => setEditItem(null)} style={{ padding: '10px 16px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
              </div>
            </div>
          </div>
        )}

        {showQuickOrder && (
          <QuickOrderRequestModal
            item={showQuickOrder} storeId={storeId} userName={userName} suppliers={suppliers}
            onClose={() => setShowQuickOrder(null)} onSaved={() => setShowQuickOrder(null)}
          />
        )}

        {/* PC 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e' }}>📦 재고관리</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowLog(true)} style={{ padding: '7px 14px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 12, cursor: 'pointer' }}>변경이력</button>
            {isEdit && <>
              <button onClick={() => setShowPlaceMgr(true)} style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(45,198,214,0.1)', border: '1px solid rgba(45,198,214,0.3)', color: '#2DC6D6', fontSize: 12, cursor: 'pointer' }}>📍 장소관리</button>
              <button onClick={() => setShowAdd(p => !p)} style={{ padding: '7px 14px', borderRadius: 8, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', color: '#FF6B35', fontSize: 12, cursor: 'pointer' }}>+ 품목추가</button>
            </>}
          </div>
        </div>

        {showAdd && (
          <div style={{ ...bx, border: '1px solid rgba(255,107,53,0.3)', marginBottom: 16, maxWidth: 480 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input value={nm} onChange={e => setNm(e.target.value)} placeholder="품목명" style={{ ...inp, flex: 2, minWidth: 120 }} />
              <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inp, flex: 1, appearance: 'auto' as any, minWidth: 70 }}>
                <option value="ea">ea</option><option value="box">box</option><option value="kg">kg</option><option value="L">L</option><option value="병">병</option>
              </select>
              <input type="number" value={minQty} onChange={e => setMinQty(Number(e.target.value))} placeholder="최소" style={{ ...inp, flex: 1, minWidth: 60 }} />
              <input type="number" value={warnQty} onChange={e => setWarnQty(Number(e.target.value))} placeholder="주의" style={{ ...inp, flex: 1, minWidth: 60 }} />
              <button onClick={addItem} style={{ padding: '8px 16px', borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>등록</button>
              <button onClick={() => setShowAdd(false)} style={{ padding: '8px 12px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer', fontSize: 12 }}>취소</button>
            </div>
          </div>
        )}

        {/* PC 3탭 */}
        <div style={{ display: 'flex', background: '#F4F6F9', borderRadius: 12, padding: 4, marginBottom: 16, gap: 4, maxWidth: 400 }}>
          {([
            { key: 'warn',  label: `⚠️ 주의`, badge: lowItems.length + warnItems.length },
            { key: 'all',   label: '📦 전체', badge: 0 },
            { key: 'place', label: '📍 장소별', badge: 0 },
          ] as const).map(({ key, label, badge }) => (
            <button key={key} onClick={() => { setStockTab(key); setStockSearchQ('') }}
              style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13,
                fontWeight: stockTab === key ? 700 : 400,
                background: stockTab === key ? '#fff' : 'transparent',
                color: stockTab === key ? '#1a1a2e' : '#aaa',
                boxShadow: stockTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                position: 'relative' as const,
              }}>
              {label}
              {badge > 0 && <span style={{ marginLeft: 4, fontSize: 9, padding: '1px 5px', borderRadius: 8, background: '#E84393', color: '#fff', fontWeight: 700 }}>{badge}</span>}
            </button>
          ))}
        </div>

        {/* PC 2컬럼 레이아웃 (장소별 탭만) / 전체폭 (주의·전체 탭) */}
        {stockTab === 'place' ? (
          <div style={{ display: 'flex', gap: 20 }}>
            {/* 좌측 사이드바 */}
            <div style={{ width: 220, flexShrink: 0 }}>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#bbb' }}>🔍</span>
                <input value={searchQ} onChange={e => { setSearchQ(e.target.value); if (e.target.value.trim()) setShowSearchPanel(true) }}
                  onFocus={() => { if (searchQ.trim()) setShowSearchPanel(true) }}
                  placeholder="품목 검색..."
                  style={{ ...inp, paddingLeft: 30, paddingRight: searchQ ? 30 : 10 }} />
                {searchQ && <button onClick={() => { setSearchQ(''); setShowSearchPanel(false) }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 14 }}>✕</button>}
              </div>
              {groups.map(g => (
                <div key={g}>
                  <button onClick={() => setGroup(g)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: group === g ? '1px solid rgba(255,107,53,0.4)' : '1px solid transparent', background: group === g ? 'rgba(255,107,53,0.08)' : 'transparent', color: group === g ? '#FF6B35' : '#888', fontSize: 13, fontWeight: group === g ? 700 : 400, cursor: 'pointer', textAlign: 'left', marginBottom: 2 }}>
                    {groupEmoji[g] || '📍'} {g}
                  </button>
                  {group === g && subPlaces.map(pl => (
                    <button key={pl.name} onClick={() => setSubTab(pl.name)}
                      style={{ width: '100%', padding: '7px 12px 7px 28px', borderRadius: 8, border: subTab === pl.name ? '1px solid rgba(255,107,53,0.3)' : '1px solid transparent', background: subTab === pl.name ? 'rgba(255,107,53,0.06)' : 'transparent', color: subTab === pl.name ? '#FF6B35' : '#aaa', fontSize: 12, fontWeight: subTab === pl.name ? 700 : 400, cursor: 'pointer', textAlign: 'left', marginBottom: 1 }}>
                      {pl.name.replace(g + ' ', '').replace(g, '') || pl.name}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            {/* 우측 장소별 그리드 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                {currentItems.length === 0 ? (
                  <div style={{ ...bx, textAlign: 'center', padding: 32, gridColumn: '1/-1' }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>📦</div>
                    <div style={{ fontSize: 13, color: '#bbb' }}>이 장소에 배치된 품목이 없습니다</div>
                  </div>
                ) : currentItems.map(item => {
                  const q = getQty(item.id, subTab)
                  const tot = totalQty(item.id)
                  const wq = item.warn_qty ?? 3
                  const logEntry = stock[item.id + '-' + subTab]
                  return (
                    <div key={item.id}
                      draggable={isEdit}
                      onDragStart={e => isEdit && onItemDragStart(e, item.id)}
                      onDragEnter={() => isEdit && onItemDragEnter(item.id)}
                      onDragEnd={() => isEdit && onItemDragEnd(currentItems, subTab)}
                      onDragOver={e => e.preventDefault()}
                      style={getCardStyle(item.id, tot, item.min_qty, wq, { cursor: isEdit ? 'grab' : 'default', margin: 0 })}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                          {isEdit && <span style={{ fontSize: 14, color: '#ddd', flexShrink: 0 }}>☰</span>}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', wordBreak: 'break-word' }}>{item.name}</span>
                              {statusBadge(tot, item.min_qty, wq)}
                            </div>
                            <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>전체 {tot}{item.unit}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <button onClick={() => updateQty(item.id, subTab, q - 1)} style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(232,67,147,0.1)', border: '1px solid rgba(232,67,147,0.2)', color: '#E84393', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                          <input type="number" step="0.1" value={q < 0 ? 0 : q} onChange={e => updateQty(item.id, subTab, Number(e.target.value))}
                            style={{ width: 52, textAlign: 'center', fontSize: 16, fontWeight: 700, color: tot <= item.min_qty ? '#E84393' : tot <= wq ? '#B8860B' : '#1a1a2e', border: '1px solid #E8ECF0', borderRadius: 7, padding: '4px 2px', background: '#fff', outline: 'none' }}
                            onFocus={e => e.target.select()} />
                          <button onClick={() => updateQty(item.id, subTab, q + 1)} style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(0,184,148,0.1)', border: '1px solid rgba(0,184,148,0.2)', color: '#00B894', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                      </div>
                      {logEntry?.updated_by ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                          <div style={{ fontSize: 9, color: '#bbb' }}>
                            ✓ {logEntry.updated_by} · {new Date(logEntry.updated_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} {new Date(logEntry.updated_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}
                            {logEntry.before_qty !== undefined && logEntry.after_qty !== undefined && logEntry.before_qty !== logEntry.after_qty && (
                              <span style={{ marginLeft: 4, color: logEntry.after_qty > logEntry.before_qty ? '#00B894' : '#E84393', fontWeight: 700 }}>· {logEntry.before_qty}→{logEntry.after_qty}</span>
                            )}
                          </div>
                          <button onClick={() => checkQty(item.id, subTab)}
                            style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(0,184,148,0.08)', border: '1px solid rgba(0,184,148,0.2)', color: '#00B894', fontSize: 9, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                            ✓ 오늘 확인
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                          <button onClick={() => checkQty(item.id, subTab)}
                            style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(0,184,148,0.08)', border: '1px solid rgba(0,184,148,0.2)', color: '#00B894', fontSize: 9, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                            ✓ 오늘 확인
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          /* 주의 / 전체 탭 — 전체폭 */
          <div>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#bbb' }}>🔍</span>
              <input value={stockSearchQ} onChange={e => setStockSearchQ(e.target.value)}
                placeholder="품목명 검색..."
                style={{ ...inp, paddingLeft: 30, paddingRight: stockSearchQ ? 30 : 10, maxWidth: 360 }} />
              {stockSearchQ && <button onClick={() => setStockSearchQ('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 14 }}>✕</button>}
            </div>

            {stockTab === 'warn' && (() => {
              const filtered = [...lowItems, ...warnItems].filter(item =>
                !stockSearchQ.trim() || item.name.includes(stockSearchQ.trim())
              )
              if (filtered.length === 0) return (
                <div style={{ textAlign: 'center', padding: 64, color: '#bbb', fontSize: 13 }}>
                  {stockSearchQ ? '검색 결과가 없어요' : '🎉 재고 부족 항목이 없어요!'}
                </div>
              )
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
                  {filtered.map(item => {
                    const tot = totalQty(item.id)
                    const wq = item.warn_qty ?? 3
                    const isLow = tot <= item.min_qty
                    const isHL = highlightStockId === item.id
                    return (
                      <div key={item.id} data-stock-id={item.id} style={{
                        ...bx, margin: 0,
                        border: isHL ? '2px solid #6C5CE7' : isLow ? '1px solid rgba(232,67,147,0.35)' : '1px solid rgba(253,196,0,0.5)',
                        background: isHL ? 'rgba(108,92,231,0.04)' : isLow ? '#FFF8FA' : '#FFFBEA',
                        transition: 'border 0.3s, background 0.3s',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{item.name}</span>
                              {statusBadge(tot, item.min_qty, wq)}
                            </div>
                            <div style={{ fontSize: 11, color: '#aaa' }}>
                              현재 <span style={{ fontWeight: 700, color: isLow ? '#E84393' : '#B8860B' }}>{tot}{item.unit}</span>
                              {isLow ? ` · 최소 ${item.min_qty}${item.unit}` : ` · 주의 ${wq}${item.unit}`}
                            </div>
                          </div>
                          <button onClick={() => setShowQuickOrder(item)}
                            style={{ padding: '7px 12px', borderRadius: 9, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                            📋 발주요청
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {stockTab === 'all' && (() => {
              const filtered = sortByStatus(
                stockSearchQ.trim() ? items.filter(i => i.name.includes(stockSearchQ.trim())) : items
              )
              if (filtered.length === 0) return (
                <div style={{ textAlign: 'center', padding: 64, color: '#bbb', fontSize: 13 }}>검색 결과가 없어요</div>
              )
              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                  {filtered.map(item => {
                    const tot = totalQty(item.id)
                    const wq = item.warn_qty ?? 3
                    const assignedPlaces = placeNames.filter(pl => hasStock(item.id, pl))
                    const isHL = highlightStockId === item.id
                    return (
                      <div key={item.id} data-stock-id={item.id} style={getCardStyle(item.id, tot, item.min_qty, wq, { margin: 0, ...(isHL ? { border: '2px solid #6C5CE7', background: 'rgba(108,92,231,0.04)' } : {}) })}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', wordBreak: 'break-word' }}>{item.name}</span>
                            {statusBadge(tot, item.min_qty, wq)}
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: tot <= item.min_qty ? '#E84393' : tot <= wq ? '#B8860B' : '#1a1a2e' }}>{tot}</div>
                            <div style={{ fontSize: 9, color: '#bbb' }}>최소{item.min_qty} / 주의{wq}{item.unit}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 10, color: '#999', marginBottom: 8 }}>{assignedPlaces.map(pl => `${pl} ${getQty(item.id, pl)}`).join(' · ')} {item.unit}</div>
                        {isEdit && (
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button onClick={() => setEditItem({ ...item, warn_qty: item.warn_qty ?? 3 })} style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.2)', color: '#FF6B35', fontSize: 10, cursor: 'pointer' }}>수정</button>
                            <button onClick={() => setShowMoveItem(showMoveItem === item.id ? null : item.id)} style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(45,198,214,0.1)', border: '1px solid rgba(45,198,214,0.2)', color: '#2DC6D6', fontSize: 10, cursor: 'pointer' }}>장소배치</button>
                            <button onClick={() => deleteItem(item.id, item.name)} style={{ padding: '3px 8px', borderRadius: 6, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#bbb', fontSize: 10, cursor: 'pointer' }}>삭제</button>
                          </div>
                        )}
                        {showMoveItem === item.id && (
                          <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(45,198,214,0.05)', border: '1px solid rgba(45,198,214,0.15)' }}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {placeNames.map(pl => {
                                const has = hasStock(item.id, pl)
                                return (
                                  <button key={pl} onClick={() => has ? removeFromPlace(item.id, pl) : addToPlace(item.id, pl)}
                                    style={{ padding: '3px 8px', borderRadius: 6, background: has ? 'rgba(255,107,53,0.1)' : '#F4F6F9', border: has ? '1px solid rgba(255,107,53,0.3)' : '1px solid #E8ECF0', color: has ? '#FF6B35' : '#888', fontSize: 10, cursor: 'pointer' }}>
                                    {has ? '✓ ' : ''}{pl}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}
      </div>
    )
  }

  // ── 모바일 레이아웃 ──
  return (
    <div>
      <MainTabBar />
      {showPlaceMgr && (
        <PlaceManager
          storeId={storeId}
          onClose={() => setShowPlaceMgr(false)}
          onSaved={() => { initializedRef.current = false; loadAll(storeId) }}
          groupOrder={groups}
          onGroupReorder={handleGroupReorder}
        />
      )}
      {showSearchPanel && (
        <GlobalSearchPanel
          query={searchQ}
          items={items}
          places={places}
          stock={stock}
          onClose={() => setShowSearchPanel(false)}
          onNavigate={handleNavigate}
        />
      )}

      {editItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 340 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 14 }}>품목 수정</div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>품목명</div>
            <input value={editItem.name} onChange={e => setEditItem({ ...editItem, name: e.target.value })} style={{ ...inp, marginBottom: 10 }} />
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>단위</div>
            <select value={editItem.unit} onChange={e => setEditItem({ ...editItem, unit: e.target.value })} style={{ ...inp, appearance: 'auto' as any, marginBottom: 10 }}>
              <option value="ea">ea</option><option value="box">box</option><option value="kg">kg</option><option value="L">L</option><option value="병">병</option>
            </select>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: '#E84393', marginBottom: 4 }}>🔴 최소수량</div><input type="number" value={editItem.min_qty} onChange={e => setEditItem({ ...editItem, min_qty: Math.max(0, Number(e.target.value)) })} style={inp} /></div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: '#B8860B', marginBottom: 4 }}>🟡 주의수량</div><input type="number" value={editItem.warn_qty ?? 3} onChange={e => setEditItem({ ...editItem, warn_qty: Math.max(0, Number(e.target.value)) })} style={inp} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveEditItem} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>저장</button>
              <button onClick={() => setEditItem(null)} style={{ padding: '10px 16px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>📦 재고관리</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isEdit ? '1fr 1fr 1fr' : '1fr', gap: 6 }}>
          <button onClick={() => setShowLog(true)} style={{ padding: '8px 0', borderRadius: 9, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 11, cursor: 'pointer', textAlign: 'center' as const, whiteSpace: 'nowrap' as const }}>📋 변경이력</button>
          {isEdit && (
            <>
              <button onClick={() => setShowPlaceMgr(true)} style={{ padding: '8px 0', borderRadius: 9, background: 'rgba(45,198,214,0.1)', border: '1px solid rgba(45,198,214,0.3)', color: '#2DC6D6', fontSize: 11, cursor: 'pointer', textAlign: 'center' as const, whiteSpace: 'nowrap' as const }}>📍 장소관리</button>
              <button onClick={() => setShowAdd(p => !p)} style={{ padding: '8px 0', borderRadius: 9, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', color: '#FF6B35', fontSize: 11, cursor: 'pointer', textAlign: 'center' as const, whiteSpace: 'nowrap' as const }}>+ 품목추가</button>
            </>
          )}
        </div>
      </div>

      {showAdd && (
        <div style={{ ...bx, border: '1px solid rgba(255,107,53,0.3)', marginBottom: 12 }}>
          <input value={nm} onChange={e => setNm(e.target.value)} placeholder="품목명" style={{ ...inp, marginBottom: 8 }} />
          <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inp, appearance: 'auto' as any, marginBottom: 8 }}>
            <option value="ea">ea</option><option value="box">box</option><option value="kg">kg</option><option value="L">L</option><option value="병">병</option>
          </select>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: '#E84393', marginBottom: 3 }}>🔴 최소수량</div><input type="number" value={minQty} onChange={e => setMinQty(Number(e.target.value))} style={inp} /></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 10, color: '#B8860B', marginBottom: 3 }}>🟡 주의수량</div><input type="number" value={warnQty} onChange={e => setWarnQty(Number(e.target.value))} style={inp} /></div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addItem} style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>등록</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '8px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
          </div>
        </div>
      )}

      {(lowItems.length > 0 || warnItems.length > 0) && stockTab !== 'warn' && (
        <button onClick={() => setStockTab('warn')}
          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', background: '#FFF0F5', border: '1px solid rgba(232,67,147,0.25)', borderRadius: 10, cursor: 'pointer', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#E84393' }}>🔴 재고 부족 {lowItems.length}건</span>
            {warnItems.length > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: '#B8860B' }}>⚠️ 주의 {warnItems.length}건</span>}
          </div>
          <span style={{ fontSize: 11, color: '#E84393', fontWeight: 600 }}>확인 →</span>
        </button>
      )}

      {showQuickOrder && (
        <QuickOrderRequestModal
          item={showQuickOrder} storeId={storeId} userName={userName} suppliers={suppliers}
          onClose={() => setShowQuickOrder(null)}
          onSaved={() => setShowQuickOrder(null)}
        />
      )}

      {/* 재고 3탭 */}
      <div style={{ display: 'flex', background: '#F4F6F9', borderRadius: 12, padding: 4, marginBottom: 14, gap: 4 }}>
        {([
          { key: 'warn', label: `⚠️ 주의`, badge: lowItems.length + warnItems.length },
          { key: 'all',  label: '📦 전체', badge: 0 },
          { key: 'place',label: '📍 장소별', badge: 0 },
        ] as const).map(({ key, label, badge }) => (
          <button key={key} onClick={() => { setStockTab(key); setStockSearchQ('') }}
            style={{ flex: 1, padding: '9px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12,
              fontWeight: stockTab === key ? 700 : 400,
              background: stockTab === key ? '#fff' : 'transparent',
              color: stockTab === key ? '#1a1a2e' : '#aaa',
              boxShadow: stockTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              position: 'relative' as const,
            }}>
            {label}
            {badge > 0 && (
              <span style={{ marginLeft: 4, fontSize: 9, padding: '1px 5px', borderRadius: 8,
                background: '#E84393', color: '#fff', fontWeight: 700 }}>{badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* 주의/전체 탭 인라인 검색 */}
      {(stockTab === 'warn' || stockTab === 'all') && (
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#bbb' }}>🔍</span>
          <input value={stockSearchQ} onChange={e => setStockSearchQ(e.target.value)}
            placeholder="품목명 검색..."
            style={{ ...inp, paddingLeft: 30, paddingRight: stockSearchQ ? 30 : 10 }} />
          {stockSearchQ && <button onClick={() => setStockSearchQ('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 14 }}>✕</button>}
        </div>
      )}

      {/* 장소별 탭 — 검색 (GlobalSearchPanel) */}
      {stockTab === 'place' && (
        <>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#bbb' }}>🔍</span>
            <input value={searchQ} onChange={e => { setSearchQ(e.target.value); if (e.target.value.trim()) setShowSearchPanel(true) }}
              onFocus={() => { if (searchQ.trim()) setShowSearchPanel(true) }}
              placeholder="품목 검색... (전체 위치 표시)"
              style={{ ...inp, paddingLeft: 30, paddingRight: searchQ ? 30 : 10 }} />
            {searchQ && <button onClick={() => { setSearchQ(''); setShowSearchPanel(false) }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 14 }}>✕</button>}
          </div>
          {/* 그룹 탭 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {groups.map(g => (
              <button key={g} onClick={() => setGroup(g)}
                style={{ flex: 1, minWidth: 60, padding: '8px 0', borderRadius: 10, border: group === g ? '1px solid rgba(255,107,53,0.4)' : '1px solid #E8ECF0', background: group === g ? 'rgba(255,107,53,0.1)' : '#F4F6F9', color: group === g ? '#FF6B35' : '#888', fontSize: 13, fontWeight: group === g ? 700 : 400, cursor: 'pointer' }}>
                {groupEmoji[g] || '📍'} {g}
              </button>
            ))}
          </div>
          {/* 장소 서브탭 */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
            {subPlaces.map(pl => (
              <button key={pl.name} onClick={() => setSubTab(pl.name)}
                style={{ padding: '5px 10px', borderRadius: 8, border: subTab === pl.name ? '1px solid rgba(255,107,53,0.4)' : '1px solid #E8ECF0', background: subTab === pl.name ? 'rgba(255,107,53,0.1)' : '#F4F6F9', color: subTab === pl.name ? '#FF6B35' : '#888', fontSize: 11, fontWeight: subTab === pl.name ? 700 : 400, cursor: 'pointer' }}>
                {pl.name.replace(group + ' ', '').replace(group, '') || pl.name}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ─── ⚠️ 주의 탭 ─── */}
      {stockTab === 'warn' && (() => {
        const filtered = [...lowItems, ...warnItems].filter(item =>
          !stockSearchQ.trim() || item.name.includes(stockSearchQ.trim())
        )
        if (filtered.length === 0) return (
          <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>
            {stockSearchQ ? '검색 결과가 없어요' : '🎉 재고 부족 항목이 없어요!'}
          </div>
        )
        return (
          <div>
            {filtered.map(item => {
              const tot = totalQty(item.id)
              const wq = item.warn_qty ?? 3
              const isLow = tot <= item.min_qty
              const isHL = highlightStockId === item.id
              return (
                <div key={item.id} data-stock-id={item.id} style={{
                  ...bx,
                  border: isHL ? '2px solid #6C5CE7' : isLow ? '1px solid rgba(232,67,147,0.35)' : '1px solid rgba(253,196,0,0.5)',
                  background: isHL ? 'rgba(108,92,231,0.04)' : isLow ? '#FFF8FA' : '#FFFBEA',
                  transition: 'border 0.3s, background 0.3s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{item.name}</span>
                        {statusBadge(tot, item.min_qty, wq)}
                      </div>
                      <div style={{ fontSize: 11, color: '#aaa' }}>
                        현재 <span style={{ fontWeight: 700, color: isLow ? '#E84393' : '#B8860B' }}>{tot}{item.unit}</span>
                        {isLow ? ` · 최소 ${item.min_qty}${item.unit}` : ` · 주의 ${wq}${item.unit}`}
                      </div>
                    </div>
                    <button onClick={() => setShowQuickOrder(item)}
                      style={{ padding: '7px 12px', borderRadius: 9, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' as const }}>
                      📋 발주요청
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* ─── 📦 전체 탭 ─── */}
      {stockTab === 'all' && (() => {
        const filtered = sortByStatus(
          stockSearchQ.trim() ? items.filter(i => i.name.includes(stockSearchQ.trim())) : items
        )
        if (filtered.length === 0) return (
          <div style={{ textAlign: 'center', padding: 48, color: '#bbb', fontSize: 13 }}>검색 결과가 없어요</div>
        )
        return filtered.map(item => {
          const tot = totalQty(item.id)
          const wq = item.warn_qty ?? 3
          const assignedPlaces = placeNames.filter(pl => hasStock(item.id, pl))
          const isHL = highlightStockId === item.id
          return (
            <div key={item.id} data-stock-id={item.id} style={getCardStyle(item.id, tot, item.min_qty, wq, isHL ? { border: '2px solid #6C5CE7', background: 'rgba(108,92,231,0.04)' } : {})}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', wordBreak: 'break-word' }}>{item.name}</span>
                  {statusBadge(tot, item.min_qty, wq)}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: tot <= item.min_qty ? '#E84393' : tot <= wq ? '#B8860B' : '#1a1a2e' }}>{tot}</div>
                  <div style={{ fontSize: 9, color: '#bbb' }}>최소{item.min_qty} / 주의{wq}{item.unit}</div>
                </div>
              </div>
              <div style={{ fontSize: 10, color: '#999', marginBottom: 8 }}>{assignedPlaces.map(pl => `${pl} ${getQty(item.id, pl)}`).join(' · ')} {item.unit}</div>
              {isEdit && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <button onClick={() => setEditItem({ ...item, warn_qty: item.warn_qty ?? 3 })} style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.2)', color: '#FF6B35', fontSize: 10, cursor: 'pointer' }}>수정</button>
                  <button onClick={() => setShowMoveItem(showMoveItem === item.id ? null : item.id)} style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(45,198,214,0.1)', border: '1px solid rgba(45,198,214,0.2)', color: '#2DC6D6', fontSize: 10, cursor: 'pointer' }}>장소배치</button>
                  <button onClick={() => deleteItem(item.id, item.name)} style={{ padding: '3px 8px', borderRadius: 6, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#bbb', fontSize: 10, cursor: 'pointer' }}>삭제</button>
                </div>
              )}
              {showMoveItem === item.id && (
                <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'rgba(45,198,214,0.05)', border: '1px solid rgba(45,198,214,0.15)' }}>
                  <div style={{ fontSize: 10, color: '#2DC6D6', marginBottom: 6 }}>장소 배치</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {placeNames.map(pl => {
                      const has = hasStock(item.id, pl)
                      return (
                        <button key={pl} onClick={() => has ? removeFromPlace(item.id, pl) : addToPlace(item.id, pl)}
                          style={{ padding: '3px 8px', borderRadius: 6, background: has ? 'rgba(255,107,53,0.1)' : '#F4F6F9', border: has ? '1px solid rgba(255,107,53,0.3)' : '1px solid #E8ECF0', color: has ? '#FF6B35' : '#888', fontSize: 10, cursor: 'pointer' }}>
                          {has ? '✓ ' : ''}{pl}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })
      })()}

      {/* ─── 📍 장소별 탭 ─── */}
      {stockTab === 'place' && (
        <>
          {isEdit && currentItems.length > 1 && (
            <div style={{ fontSize: 10, color: '#aaa', textAlign: 'center', marginBottom: 8 }}>☰ 드래그로 품목 순서를 변경할 수 있어요</div>
          )}
          {currentItems.length === 0 ? (
            <div style={{ ...bx, textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📦</div>
              <div style={{ fontSize: 13, color: '#bbb' }}>이 장소에 배치된 품목이 없습니다</div>
            </div>
          ) : currentItems.map(item => {
            const q = getQty(item.id, subTab)
            const tot = totalQty(item.id)
            const wq = item.warn_qty ?? 3
            const logEntry = stock[item.id + '-' + subTab]
            return (
              <div key={item.id}
                draggable={isEdit}
                onDragStart={e => isEdit && onItemDragStart(e, item.id)}
                onDragEnter={() => isEdit && onItemDragEnter(item.id)}
                onDragEnd={() => isEdit && onItemDragEnd(currentItems, subTab)}
                onDragOver={e => e.preventDefault()}
                style={getCardStyle(item.id, tot, item.min_qty, wq, { cursor: isEdit ? 'grab' : 'default' })}>
                {/* [수정] 레이아웃 개선 - 이름이 길어도 버튼이 밀리지 않음 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    {isEdit && <span style={{ fontSize: 14, color: '#ddd', flexShrink: 0 }}>☰</span>}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', wordBreak: 'break-word' }}>{item.name}</span>
                        {statusBadge(tot, item.min_qty, wq)}
                      </div>
                      <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>전체 {tot}{item.unit}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => updateQty(item.id, subTab, q - 1)}
                      style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(232,67,147,0.1)', border: '1px solid rgba(232,67,147,0.2)', color: '#E84393', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    <input
                      type="number"
                      step="0.1"
                      value={q < 0 ? 0 : q}
                      onChange={e => updateQty(item.id, subTab, Number(e.target.value))}
                      style={{ width: 52, textAlign: 'center', fontSize: 16, fontWeight: 700,
                        color: tot <= item.min_qty ? '#E84393' : tot <= wq ? '#B8860B' : '#1a1a2e',
                        border: '1px solid #E8ECF0', borderRadius: 7, padding: '4px 2px',
                        background: '#fff', outline: 'none' }}
                      onFocus={e => e.target.select()}
                    />
                    <button onClick={() => updateQty(item.id, subTab, q + 1)}
                      style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(0,184,148,0.1)', border: '1px solid rgba(0,184,148,0.2)', color: '#00B894', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  </div>
                </div>
                {logEntry?.updated_by ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                    <div style={{ fontSize: 9, color: '#bbb' }}>
                      ✓ {logEntry.updated_by} · {new Date(logEntry.updated_at).toLocaleDateString('ko', { month: 'numeric', day: 'numeric' })} {new Date(logEntry.updated_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      {logEntry.before_qty !== undefined && logEntry.after_qty !== undefined && logEntry.before_qty !== logEntry.after_qty && (
                        <span style={{ marginLeft: 4, color: logEntry.after_qty > logEntry.before_qty ? '#00B894' : '#E84393', fontWeight: 700 }}>
                          · {logEntry.before_qty}→{logEntry.after_qty}
                        </span>
                      )}
                    </div>
                    <button onClick={() => checkQty(item.id, subTab)}
                      style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(0,184,148,0.08)', border: '1px solid rgba(0,184,148,0.2)', color: '#00B894', fontSize: 9, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                      ✓ 오늘 확인
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                    <button onClick={() => checkQty(item.id, subTab)}
                      style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(0,184,148,0.08)', border: '1px solid rgba(0,184,148,0.2)', color: '#00B894', fontSize: 9, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                      ✓ 오늘 확인
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}