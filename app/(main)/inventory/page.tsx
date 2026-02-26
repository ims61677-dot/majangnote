'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

const GROUPS: Record<string, string[]> = {
  '홀': ['홀 카운터 냉동고', '홀 카운터 음료냉장고', '홀 와인 셀러', '홀냉장고'],
  '주방': ['주방 플레이팅 냉장고', '주방 반찬 냉장고', '주방 피자 냉장고', '주방 피자 작업대', '주방 냉장고', '주방 냉동고', '주방 냉장고 선반'],
  '창고': ['창고 음료수 룸', '창고 1번 냉장고', '창고 1번 냉동고', '창고 2번 냉장고', '창고 2번 냉동고', '창고 1번 랙', '창고 2번 랙', '창고 3번 랙', '창고 4번 랙', '창고 5번 랙'],
}

export default function InventoryPage() {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState('')
  const [userName, setUserName] = useState('')
  const [isEdit, setIsEdit] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [places, setPlaces] = useState<string[]>([])
  const [stock, setStock] = useState<Record<string, any>>({})
  const [group, setGroup] = useState<string>('홀')
  const [subTab, setSubTab] = useState<string>('')
  const [showAll, setShowAll] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [showMoveItem, setShowMoveItem] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<any | null>(null)
  const [searchQ, setSearchQ] = useState('')
  const [nm, setNm] = useState('')
  const [unit, setUnit] = useState('ea')
  const [minQty, setMinQty] = useState(2)

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id)
    setUserName(user.nm)
    setIsEdit(user.role === 'owner' || user.role === 'manager')
    loadAll(store.id)
  }, [])

  useEffect(() => {
    const subs = GROUPS[group] || []
    setSubTab(subs[0] || '')
    setShowAll(false)
    setSearchQ('')
  }, [group])

  async function loadAll(sid: string) {
    const { data: pl } = await supabase.from('inventory_places').select('name').eq('store_id', sid).order('sort_order')
    setPlaces(pl?.map((p: any) => p.name) || [])
    const { data: it } = await supabase.from('inventory_items').select('*').eq('store_id', sid)
    setItems(it || [])
    if (it && it.length > 0) {
      const { data: st } = await supabase.from('inventory_stock').select('*').in('item_id', it.map((x: any) => x.id))
      const map: Record<string, any> = {}
      if (st) st.forEach((s: any) => { map[s.item_id + '-' + s.place] = s })
      setStock(map)
    }
  }

  const getQty = useCallback((itemId: string, place: string) => stock[itemId + '-' + place]?.quantity ?? -1, [stock])
  const totalQty = useCallback((itemId: string) => places.reduce((s, pl) => { const q = getQty(itemId, pl); return s + (q >= 0 ? q : 0) }, 0), [places, getQty])
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
    const { data } = await supabase.from('inventory_items').insert({ store_id: storeId, name: nm.trim(), unit, min_qty: minQty }).select().single()
    if (data) setItems(p => [...p, data])
    setNm(''); setUnit('ea'); setMinQty(2); setShowAdd(false)
  }

  async function deleteItem(itemId: string, itemName: string) {
    if (!confirm(itemName + ' 삭제할까요?')) return
    await supabase.from('inventory_items').delete().eq('id', itemId)
    await supabase.from('inventory_stock').delete().eq('item_id', itemId)
    setItems(p => p.filter(x => x.id !== itemId))
    setStock(p => { const n = { ...p }; places.forEach(pl => delete n[itemId + '-' + pl]); return n })
  }

  async function updateMinQty(itemId: string, val: number) {
    await supabase.from('inventory_items').update({ min_qty: val }).eq('id', itemId)
    setItems(p => p.map(x => x.id === itemId ? { ...x, min_qty: val } : x))
  }

  async function saveEditItem() {
    if (!editItem) return
    await supabase.from('inventory_items').update({ name: editItem.name, unit: editItem.unit, min_qty: editItem.min_qty }).eq('id', editItem.id)
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
  const subPlaces = GROUPS[group] || []
  const filteredBySearch = useCallback((list: any[]) => searchQ.trim() ? list.filter(item => item.name.includes(searchQ.trim())) : list, [searchQ])
  const allGroupItems = filteredBySearch(items.filter(item => (GROUPS[group] || []).some(pl => hasStock(item.id, pl))))
  const currentItems = filteredBySearch(items.filter(item => hasStock(item.id, subTab)))

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
      {/* 품목 수정 모달 */}
      {editItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 20, width: '100%', maxWidth: 340 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 14 }}>품목 수정</div>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>품목명</div>
            <input value={editItem.name} onChange={e => setEditItem({ ...editItem, name: e.target.value })} style={{ ...inp, marginBottom: 10 }} />
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>단위</div>
            <select value={editItem.unit} onChange={e => setEditItem({ ...editItem, unit: e.target.value })} style={{ ...inp, appearance: 'auto', marginBottom: 10 }}>
              <option value="ea">ea</option><option value="box">box</option><option value="kg">kg</option><option value="L">L</option><option value="병">병</option>
            </select>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>최소수량 (재고부족 기준)</div>
            <input type="number" value={editItem.min_qty} onChange={e => setEditItem({ ...editItem, min_qty: Math.max(0, Number(e.target.value)) })} style={{ ...inp, marginBottom: 14 }} />
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
            <button onClick={() => setShowAdd(p => !p)} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', color: '#FF6B35', fontSize: 11, cursor: 'pointer' }}>+ 품목추가</button>
          )}
        </div>
      </div>

      {/* 품목 추가 폼 */}
      {showAdd && (
        <div style={{ ...bx, border: '1px solid rgba(255,107,53,0.3)', marginBottom: 12 }}>
          <input value={nm} onChange={e => setNm(e.target.value)} placeholder="품목명" style={{ ...inp, marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <select value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inp, appearance: 'auto' }}>
              <option value="ea">ea</option><option value="box">box</option><option value="kg">kg</option><option value="L">L</option><option value="병">병</option>
            </select>
            <input type="number" value={minQty} onChange={e => setMinQty(Number(e.target.value))} placeholder="최소수량" style={{ ...inp, width: 80 }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addItem} style={{ flex: 1, padding: '8px 0', borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>등록</button>
            <button onClick={() => setShowAdd(false)} style={{ padding: '8px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
          </div>
        </div>
      )}

      {/* 부족 알림 */}
      {lowItems.length > 0 && (
        <div style={{ background: '#FFF0F5', border: '1px solid rgba(232,67,147,0.3)', borderRadius: 12, padding: '10px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#E84393', marginBottom: 4 }}>⚠️ 재고 부족 {lowItems.length}건</div>
          {lowItems.slice(0, 3).map(item => (
            <div key={item.id} style={{ fontSize: 11, color: '#E84393', padding: '1px 0' }}>
              {item.name} ({totalQty(item.id)}{item.unit} / 최소 {item.min_qty}{item.unit})
            </div>
          ))}
          {lowItems.length > 3 && <div style={{ fontSize: 11, color: '#E84393' }}>외 {lowItems.length - 3}건...</div>}
        </div>
      )}

      {/* 1단계 그룹 탭 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {Object.keys(GROUPS).map(g => (
          <button key={g} onClick={() => setGroup(g)}
            style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: group === g ? '1px solid rgba(255,107,53,0.4)' : '1px solid #E8ECF0', background: group === g ? 'rgba(255,107,53,0.1)' : '#F4F6F9', color: group === g ? '#FF6B35' : '#888', fontSize: 13, fontWeight: group === g ? 700 : 400, cursor: 'pointer' }}>
            {g === '홀' ? '🍽 홀' : g === '주방' ? '👨‍🍳 주방' : '📦 창고'}
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
        <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="품목 검색..."
          style={{ ...inp, paddingLeft: 30 }} />
        {searchQ && (
          <button onClick={() => setSearchQ('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 14 }}>✕</button>
        )}
      </div>

      {/* 2단계 서브 탭 */}
      {!showAll && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
          {subPlaces.map(pl => (
            <button key={pl} onClick={() => setSubTab(pl)}
              style={{ padding: '5px 10px', borderRadius: 8, border: subTab === pl ? '1px solid rgba(255,107,53,0.4)' : '1px solid #E8ECF0', background: subTab === pl ? 'rgba(255,107,53,0.1)' : '#F4F6F9', color: subTab === pl ? '#FF6B35' : '#888', fontSize: 11, fontWeight: subTab === pl ? 700 : 400, cursor: 'pointer' }}>
              {pl.replace(group + ' ', '').replace(group, '')}
            </button>
          ))}
        </div>
      )}

      {/* 검색 결과 없음 */}
      {searchQ && allGroupItems.length === 0 && currentItems.length === 0 && (
        <div style={{ ...bx, textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 20, marginBottom: 6 }}>🔍</div>
          <div style={{ fontSize: 13, color: '#bbb' }}>"{searchQ}" 검색 결과가 없습니다</div>
        </div>
      )}

      {/* 전체 탭 내용 */}
      {showAll && allGroupItems.map(item => {
        const tot = totalQty(item.id)
        const lo = tot >= 0 && tot <= item.min_qty
        const assignedPlaces = places.filter(pl => hasStock(item.id, pl))
        return (
          <div key={item.id} style={{ ...bx, border: lo ? '1px solid rgba(232,67,147,0.3)' : '1px solid #E8ECF0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{item.name}</span>
                {lo && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(232,67,147,0.1)', color: '#E84393', fontWeight: 700 }}>부족</span>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: lo ? '#E84393' : '#1a1a2e' }}>{tot}</div>
                <div style={{ fontSize: 9, color: '#bbb' }}>최소 {item.min_qty}{item.unit}</div>
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#999', marginBottom: 8 }}>
              {assignedPlaces.map(pl => `${pl} ${getQty(item.id, pl)}`).join(' · ')} {item.unit}
            </div>
            {isEdit && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                  <span style={{ fontSize: 9, color: '#bbb', whiteSpace: 'nowrap' }}>최소</span>
                  <input type="number" value={item.min_qty} onChange={e => updateMinQty(item.id, Math.max(0, Number(e.target.value)))}
                    style={{ ...inp, width: 50, padding: '3px 6px', fontSize: 11, textAlign: 'center' }} />
                </div>
                <button onClick={() => setEditItem({ ...item })}
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
                  {places.map(pl => {
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
          {currentItems.length === 0 && !searchQ ? (
            <div style={{ ...bx, textAlign: 'center', padding: 32 }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>📦</div>
              <div style={{ fontSize: 13, color: '#bbb' }}>이 장소에 배치된 품목이 없습니다</div>
            </div>
          ) : (
            currentItems.map(item => {
              const q = getQty(item.id, subTab)
              const tot = totalQty(item.id)
              const lo = tot >= 0 && tot <= item.min_qty
              const logEntry = stock[item.id + '-' + subTab]
              return (
                <div key={item.id} style={{ ...bx, border: lo ? '1px solid rgba(232,67,147,0.3)' : '1px solid #E8ECF0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{item.name}</span>
                        {lo && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(232,67,147,0.1)', color: '#E84393', fontWeight: 700 }}>부족</span>}
                      </div>
                      <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>전체 {tot}{item.unit}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button onClick={() => updateQty(item.id, subTab, q - 1)}
                        style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(232,67,147,0.1)', border: '1px solid rgba(232,67,147,0.2)', color: '#E84393', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <div style={{ minWidth: 36, textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>{q < 0 ? 0 : q}</div>
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