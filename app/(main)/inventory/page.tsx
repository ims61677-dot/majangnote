'use client'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

function getStatus(tot: number, minQty: number, warnQty: number) {
  if (tot <= minQty) return 'low'
  if (tot <= warnQty) return 'warn'
  return 'ok'
}

// ─────────────────────────────────────────────
// PlaceManager 모달
// ─────────────────────────────────────────────
function PlaceManager({ storeId, onClose, onSaved }: { storeId: string; onClose: () => void; onSaved: () => void }) {
  const supabase = createSupabaseBrowserClient()
  const [places, setPlaces] = useState<any[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editGroup, setEditGroup] = useState('')
  const [newName, setNewName] = useState('')
  const [newGroup, setNewGroup] = useState('홀')
  const [customGroup, setCustomGroup] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const PRESET_GROUPS = ['홀', '주방', '창고']

  useEffect(() => { loadPlaces() }, [])

  async function loadPlaces() {
    const { data } = await supabase.from('inventory_places').select('*').eq('store_id', storeId).order('group_name').order('sort_order')
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

  const grouped = places.reduce((acc, p) => {
    const k = p.group_name || '기타'
    if (!acc[k]) acc[k] = []
    acc[k].push(p)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>📍 장소 관리</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>

        {Object.entries(grouped).map(([grp, gPlaces]) => (
          <div key={grp} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#aaa', marginBottom: 6, paddingLeft: 2 }}>{grp}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(gPlaces as any[]).map((place: any) => (
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
                  <div key={place.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8F9FB', borderRadius: 10, padding: '8px 12px' }}>
                    <span style={{ fontSize: 13, color: '#1a1a2e' }}>{place.name}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => { setEditingId(place.id); setEditName(place.name); setEditGroup(place.group_name) }} style={{ background: 'none', border: 'none', fontSize: 11, color: '#aaa', cursor: 'pointer' }}>수정</button>
                      <button onClick={() => handleDelete(place.id, place.name)} style={{ background: 'none', border: 'none', fontSize: 11, color: '#E84393', cursor: 'pointer' }}>삭제</button>
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>
        ))}

        {isAdding ? (
          <div style={{ border: '2px dashed rgba(255,107,53,0.3)', borderRadius: 14, padding: 14, marginTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#FF6B35', marginBottom: 10 }}>새 장소 추가</div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>카테고리</div>
            <select value={newGroup} onChange={e => setNewGroup(e.target.value)} style={{ ...inp, appearance: 'auto' as any, marginBottom: 8 }}>
              {PRESET_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
              <option value="__custom__">직접입력</option>
            </select>
            {newGroup === '__custom__' && (
              <input value={customGroup} onChange={e => setCustomGroup(e.target.value)} placeholder="카테고리명 입력" style={{ ...inp, marginBottom: 8 }} />
            )}
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>장소명</div>
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
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 전역 검색 결과 패널
// ─────────────────────────────────────────────
function GlobalSearchPanel({ query, items, places, stock, onClose }: {
  query: string; items: any[]; places: any[]; stock: Record<string, any>; onClose: () => void
}) {
  const getQty = (itemId: string, placeName: string) => stock[itemId + '-' + placeName]?.quantity ?? -1
  const hasStockFn = (itemId: string, placeName: string) => (itemId + '-' + placeName) in stock
  const totalQtyFn = (itemId: string) => places.reduce((s, pl) => { const q = getQty(itemId, pl.name); return s + (q >= 0 ? q : 0) }, 0)

  const results = useMemo(() => {
    if (!query.trim()) return []
    return items.filter(item => item.name.includes(query.trim())).map(item => {
      const locs = places.filter(pl => hasStockFn(item.id, pl.name)).map(pl => ({ name: pl.name, group: pl.group_name, qty: getQty(item.id, pl.name) }))
      const tot = totalQtyFn(item.id)
      return { ...item, total: tot, locations: locs }
    })
  }, [query, items, places, stock])

  if (!query.trim()) return null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 150, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '75vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>🔍 "{query}" 검색 결과</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>
        {results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: '#bbb', fontSize: 13 }}>검색 결과가 없습니다</div>
        ) : (
          results.map(item => {
            const s = getStatus(item.total, item.min_qty, item.warn_qty ?? 3)
            const color = s === 'low' ? '#E84393' : s === 'warn' ? '#B8860B' : '#1a1a2e'
            return (
              <div key={item.id} style={{ ...bx, border: s === 'low' ? '1px solid rgba(232,67,147,0.35)' : s === 'warn' ? '1px solid rgba(253,196,0,0.5)' : '1px solid #E8ECF0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {s === 'low' && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(232,67,147,0.12)', color: '#E84393', fontWeight: 700 }}>🔴 부족</span>}
                    {s === 'warn' && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(253,196,0,0.15)', color: '#B8860B', fontWeight: 700 }}>🟡 주의</span>}
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{item.name}</span>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 800, color }}>{item.total}{item.unit}</span>
                </div>
                {item.locations.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {item.locations.map((loc: any) => (
                      <span key={loc.name} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: '#F4F6F9', color: '#666', border: '1px solid #E8ECF0' }}>
                        {loc.group && `${loc.group} › `}{loc.name.replace(loc.group + ' ', '')} <strong>{loc.qty}{item.unit}</strong>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: '#E84393' }}>재고 없음 (배치된 장소 없음)</div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────
export default function InventoryPage() {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState('')
  const [userName, setUserName] = useState('')
  const [isEdit, setIsEdit] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [places, setPlaces] = useState<any[]>([])
  const [stock, setStock] = useState<Record<string, any>>({})
  const [group, setGroup] = useState<string>('')
  const [subTab, setSubTab] = useState<string>('')
  const [showAll, setShowAll] = useState(false)
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

  // ✅ 핵심: 초기 로드 완료 여부 ref (group/subTab 자동설정 중복 방지)
  const initializedRef = useRef(false)

  const groups = useMemo(() => [...new Set(places.map(p => p.group_name).filter(Boolean))], [places])

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id)
    setUserName(user.nm)
    setIsEdit(user.role === 'owner' || user.role === 'manager')
    loadAll(store.id)
  }, [])

  // group 탭 클릭 시 subTab 변경 (초기 로드 이후에만)
  useEffect(() => {
    if (!initializedRef.current) return
    if (!group || places.length === 0) return
    const subs = places.filter(p => p.group_name === group)
    setSubTab(subs[0]?.name || '')
    setShowAll(false)
    setSearchQ('')
  }, [group])

  async function loadAll(sid: string) {
    const { data: pl } = await supabase
      .from('inventory_places')
      .select('*')
      .eq('store_id', sid)
      .order('group_name')
      .order('sort_order')

    const placeList = pl || []
    setPlaces(placeList)

    // ✅ group/subTab을 loadAll 안에서 직접 초기화 (useEffect 타이밍 문제 방지)
    if (!initializedRef.current && placeList.length > 0) {
      const firstGroup = placeList[0].group_name || ''
      const firstSub = placeList.find(p => p.group_name === firstGroup)?.name || ''
      setGroup(firstGroup)
      setSubTab(firstSub)
      initializedRef.current = true
    }

    const { data: it } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('store_id', sid)
      .order('name')

    const itemList = it || []
    setItems(itemList)

    if (itemList.length > 0) {
      const { data: st } = await supabase
        .from('inventory_stock')
        .select('*')
        .in('item_id', itemList.map((x: any) => x.id))
      const map: Record<string, any> = {}
      if (st) st.forEach((s: any) => { map[s.item_id + '-' + s.place] = s })
      setStock(map)
    }
  }

  const getQty = useCallback((itemId: string, place: string) => stock[itemId + '-' + place]?.quantity ?? -1, [stock])
  const placeNames = useMemo(() => places.map(p => p.name), [places])
  const totalQty = useCallback((itemId: string) => placeNames.reduce((s, pl) => { const q = getQty(itemId, pl); return s + (q >= 0 ? q : 0) }, 0), [placeNames, getQty])
  const hasStock = useCallback((itemId: string, place: string) => (itemId + '-' + place) in stock, [stock])

  async function updateQty(itemId: string, place: string, newVal: number) {
    const old = getQty(itemId, place)
    const val = Math.max(0, newVal)
    setStock(p => ({ ...p, [itemId + '-' + place]: { ...(p[itemId + '-' + place] || {}), item_id: itemId, place, quantity: val, updated_by: userName, updated_at: new Date().toISOString() } }))
    await supabase.from('inventory_stock').upsert({ item_id: itemId, place, quantity: val, updated_by: userName, updated_at: new Date().toISOString() }, { onConflict: 'item_id,place' })
    if (old >= 0 && old !== val) {
      await supabase.from('inventory_logs').insert({ item_id: itemId, place, before_qty: old, after_qty: val, changed_by: userName })
    }
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
    await supabase.from('inventory_items').update({ name: editItem.name, unit: editItem.unit, min_qty: editItem.min_qty, warn_qty: editItem.warn_qty }).eq('id', editItem.id)
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

  const sortByStatus = useCallback((list: any[]) => {
    return [...list].sort((a, b) => {
      const order = { low: 0, warn: 1, ok: 2 }
      return order[getStatus(totalQty(a.id), a.min_qty, a.warn_qty ?? 3)] - order[getStatus(totalQty(b.id), b.min_qty, b.warn_qty ?? 3)]
    })
  }, [totalQty])

  const allGroupItems = sortByStatus(filteredBySearch(items.filter(item => places.filter(p => p.group_name === group).some(pl => hasStock(item.id, pl.name)))))
  const currentItems = sortByStatus(filteredBySearch(items.filter(item => hasStock(item.id, subTab))))

  const statusBadge = (tot: number, minQ: number, warnQ: number) => {
    const s = getStatus(tot, minQ, warnQ)
    if (s === 'low') return <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(232,67,147,0.12)', color: '#E84393', fontWeight: 700 }}>🔴 부족</span>
    if (s === 'warn') return <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(253,196,0,0.15)', color: '#B8860B', fontWeight: 700 }}>🟡 주의</span>
    return null
  }

  const borderColor = (tot: number, minQ: number, warnQ: number) => {
    const s = getStatus(tot, minQ, warnQ)
    if (s === 'low') return '1px solid rgba(232,67,147,0.35)'
    if (s === 'warn') return '1px solid rgba(253,196,0,0.5)'
    return '1px solid #E8ECF0'
  }

  const groupEmoji: Record<string, string> = { '홀': '🍽', '주방': '👨‍🍳', '창고': '📦' }

  if (showLog) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <button onClick={() => setShowLog(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}>←</button>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>변경이력</span>
      </div>
      <LogTab storeId={storeId} items={items} />
    </div>
  )

  return (
    <div>
      {showPlaceMgr && (
        <PlaceManager
          storeId={storeId}
          onClose={() => setShowPlaceMgr(false)}
          onSaved={() => { initializedRef.current = false; loadAll(storeId) }}
        />
      )}

      {showSearchPanel && (
        <GlobalSearchPanel query={searchQ} items={items} places={places} stock={stock} onClose={() => setShowSearchPanel(false)} />
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
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#E84393', marginBottom: 4 }}>🔴 최소수량 (부족 기준)</div>
                <input type="number" value={editItem.min_qty} onChange={e => setEditItem({ ...editItem, min_qty: Math.max(0, Number(e.target.value)) })} style={inp} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#B8860B', marginBottom: 4 }}>🟡 주의수량</div>
                <input type="number" value={editItem.warn_qty ?? 3} onChange={e => setEditItem({ ...editItem, warn_qty: Math.max(0, Number(e.target.value)) })} style={inp} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveEditItem} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>저장</button>
              <button onClick={() => setEditItem(null)} style={{ padding: '10px 16px', borderRadius: 10, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>📦 재고관리</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowLog(true)} style={{ padding: '6px 12px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 11, cursor: 'pointer' }}>변경이력</button>
          {isEdit && (
            <>
              <button onClick={() => setShowPlaceMgr(true)} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(45,198,214,0.1)', border: '1px solid rgba(45,198,214,0.3)', color: '#2DC6D6', fontSize: 11, cursor: 'pointer' }}>📍 장소관리</button>
              <button onClick={() => setShowAdd(p => !p)} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', color: '#FF6B35', fontSize: 11, cursor: 'pointer' }}>+ 품목추가</button>
            </>
          )}
        </div>
      </div>

      {/* 품목 추가 폼 */}
      {showAdd && (
        <div style={{ ...bx, border: '1px solid rgba(255,107,53,0.3)', marginBottom: 12 }}>
          <input value={nm} onChange={e => setNm(e.target.value)} placeholder="품목명" style={{ ...inp, marginBottom: 8 }} />
          <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inp, appearance: 'auto' as any, marginBottom: 8 }}>
            <option value="ea">ea</option><option value="box">box</option><option value="kg">kg</option><option value="L">L</option><option value="병">병</option>
          </select>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#E84393', marginBottom: 3 }}>🔴 최소수량</div>
              <input type="number" value={minQty} onChange={e => setMinQty(Number(e.target.value))} style={inp} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: '#B8860B', marginBottom: 3 }}>🟡 주의수량</div>
              <input type="number" value={warnQty} onChange={e => setWarnQty(Number(e.target.value))} style={inp} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addItem} style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>등록</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '8px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
          </div>
        </div>
      )}

      {/* 재고부족/주의 알림 (접기/펼치기) */}
      {(lowItems.length > 0 || warnItems.length > 0) && (
        <div style={{ borderRadius: 12, marginBottom: 12, overflow: 'hidden', border: '1px solid rgba(232,67,147,0.25)' }}>
          <button
            onClick={() => setAlertOpen(p => !p)}
            style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#FFF0F5', border: 'none', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#E84393' }}>🔴 재고 부족 {lowItems.length}건</span>
              {warnItems.length > 0 && <span style={{ fontSize: 11, fontWeight: 600, color: '#B8860B' }}>⚠️ 주의 {warnItems.length}건</span>}
            </div>
            <span style={{ fontSize: 11, color: '#aaa' }}>{alertOpen ? '▲ 접기' : '▼ 펼치기'}</span>
          </button>
          {alertOpen && (
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {lowItems.length > 0 && (
                <div style={{ background: '#FFF0F5', padding: '4px 14px 10px' }}>
                  {lowItems.map(item => (
                    <div key={item.id} style={{ fontSize: 11, color: '#E84393', padding: '2px 0' }}>
                      {item.name} ({totalQty(item.id)}{item.unit} / 최소 {item.min_qty}{item.unit})
                    </div>
                  ))}
                </div>
              )}
              {warnItems.length > 0 && (
                <div style={{ background: '#FFFBEA', padding: '10px 14px', borderTop: '1px solid rgba(253,196,0,0.3)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#B8860B', marginBottom: 4 }}>🟡 주의 {warnItems.length}건</div>
                  {warnItems.map(item => (
                    <div key={item.id} style={{ fontSize: 11, color: '#B8860B', padding: '2px 0' }}>
                      {item.name} ({totalQty(item.id)}{item.unit} / 주의 {item.warn_qty ?? 3}{item.unit})
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 1단계 그룹 탭 (DB 기반 동적) */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {groups.map(g => (
          <button key={g} onClick={() => setGroup(g)}
            style={{ flex: 1, minWidth: 60, padding: '8px 0', borderRadius: 10, border: group === g ? '1px solid rgba(255,107,53,0.4)' : '1px solid #E8ECF0', background: group === g ? 'rgba(255,107,53,0.1)' : '#F4F6F9', color: group === g ? '#FF6B35' : '#888', fontSize: 13, fontWeight: group === g ? 700 : 400, cursor: 'pointer' }}>
            {groupEmoji[g] || '📍'} {g}
          </button>
        ))}
      </div>

      {/* 전체 보기 토글 */}
      <button onClick={() => { setShowAll(p => !p); setSearchQ('') }}
        style={{ width: '100%', padding: '6px 0', borderRadius: 8, border: showAll ? '1px solid rgba(108,92,231,0.4)' : '1px solid #E8ECF0', background: showAll ? 'rgba(108,92,231,0.08)' : '#F4F6F9', color: showAll ? '#6C5CE7' : '#888', fontSize: 11, fontWeight: showAll ? 700 : 400, cursor: 'pointer', marginBottom: 10 }}>
        {showAll ? '▲ 전체 목록 닫기' : '▼ 전체 목록 보기 (합산 · 품목수정 · 장소배치)'}
      </button>

      {/* 검색창 */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#bbb' }}>🔍</span>
        <input
          value={searchQ}
          onChange={e => { setSearchQ(e.target.value); if (e.target.value.trim()) setShowSearchPanel(true) }}
          onFocus={() => { if (searchQ.trim()) setShowSearchPanel(true) }}
          placeholder="품목 검색... (전체 위치 표시)"
          style={{ ...inp, paddingLeft: 30, paddingRight: searchQ ? 30 : 10 }}
        />
        {searchQ && (
          <button onClick={() => { setSearchQ(''); setShowSearchPanel(false) }} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 14 }}>✕</button>
        )}
      </div>

      {/* 2단계 서브 탭 */}
      {!showAll && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
          {subPlaces.map(pl => (
            <button key={pl.name} onClick={() => setSubTab(pl.name)}
              style={{ padding: '5px 10px', borderRadius: 8, border: subTab === pl.name ? '1px solid rgba(255,107,53,0.4)' : '1px solid #E8ECF0', background: subTab === pl.name ? 'rgba(255,107,53,0.1)' : '#F4F6F9', color: subTab === pl.name ? '#FF6B35' : '#888', fontSize: 11, fontWeight: subTab === pl.name ? 700 : 400, cursor: 'pointer' }}>
              {pl.name.replace(group + ' ', '').replace(group, '')}
            </button>
          ))}
        </div>
      )}

      {/* 전체 탭 내용 */}
      {showAll && allGroupItems.map(item => {
        const tot = totalQty(item.id)
        const wq = item.warn_qty ?? 3
        const assignedPlaces = placeNames.filter(pl => hasStock(item.id, pl))
        return (
          <div key={item.id} style={{ ...bx, border: borderColor(tot, item.min_qty, wq) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{item.name}</span>
                {statusBadge(tot, item.min_qty, wq)}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: tot <= item.min_qty ? '#E84393' : tot <= wq ? '#B8860B' : '#1a1a2e' }}>{tot}</div>
                <div style={{ fontSize: 9, color: '#bbb' }}>최소{item.min_qty} / 주의{wq}{item.unit}</div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#999', marginBottom: 8 }}>
              {assignedPlaces.map(pl => `${pl} ${getQty(item.id, pl)}`).join(' · ')} {item.unit}
            </div>
            {isEdit && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button onClick={() => setEditItem({ ...item, warn_qty: item.warn_qty ?? 3 })}
                  style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.2)', color: '#FF6B35', fontSize: 10, cursor: 'pointer' }}>수정</button>
                <button onClick={() => setShowMoveItem(showMoveItem === item.id ? null : item.id)}
                  style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(45,198,214,0.1)', border: '1px solid rgba(45,198,214,0.2)', color: '#2DC6D6', fontSize: 10, cursor: 'pointer' }}>장소배치</button>
                <button onClick={() => deleteItem(item.id, item.name)}
                  style={{ padding: '3px 8px', borderRadius: 6, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#bbb', fontSize: 10, cursor: 'pointer' }}>삭제</button>
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
      })}

      {/* 장소별 품목 목록 */}
      {!showAll && (
        <>
          {currentItems.length === 0 ? (
            <div style={{ ...bx, textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📦</div>
              <div style={{ fontSize: 13, color: '#bbb' }}>이 장소에 배치된 품목이 없습니다</div>
            </div>
          ) : (
            currentItems.map(item => {
              const q = getQty(item.id, subTab)
              const tot = totalQty(item.id)
              const wq = item.warn_qty ?? 3
              const logEntry = stock[item.id + '-' + subTab]
              return (
                <div key={item.id} style={{ ...bx, border: borderColor(tot, item.min_qty, wq) }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{item.name}</span>
                        {statusBadge(tot, item.min_qty, wq)}
                      </div>
                      <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>전체 {tot}{item.unit}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button onClick={() => updateQty(item.id, subTab, q - 1)}
                        style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(232,67,147,0.1)', border: '1px solid rgba(232,67,147,0.2)', color: '#E84393', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <div style={{ minWidth: 36, textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: tot <= item.min_qty ? '#E84393' : tot <= wq ? '#B8860B' : '#1a1a2e' }}>{q < 0 ? 0 : q}</div>
                        <div style={{ fontSize: 9, color: '#bbb' }}>{item.unit}</div>
                      </div>
                      <button onClick={() => updateQty(item.id, subTab, q + 1)}
                        style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(0,184,148,0.1)', border: '1px solid rgba(0,184,148,0.2)', color: '#00B894', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                  </div>
                  {logEntry?.updated_by && (
                    <div style={{ fontSize: 9, color: '#bbb', marginTop: 4, textAlign: 'right' }}>
                      ✓ {logEntry.updated_by} · {new Date(logEntry.updated_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// 변경이력 탭
// ─────────────────────────────────────────────
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