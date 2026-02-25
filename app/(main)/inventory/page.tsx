'use client'
import { useEffect, useState, useCallback } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
const btnSm = { background: '#F4F6F9', border: '1px solid #E8ECF0', borderRadius: 8, padding: '4px 12px', color: '#555', cursor: 'pointer', fontSize: 13 }

export default function InventoryPage() {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState('')
  const [userName, setUserName] = useState('')
  const [isEdit, setIsEdit] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [places, setPlaces] = useState<string[]>([])
  const [stock, setStock] = useState<Record<string, any>>({})
  const [tab, setTab] = useState<'dash'|'log'>('dash')
  const [showAdd, setShowAdd] = useState(false)
  const [nm, setNm] = useState(''); const [unit, setUnit] = useState('ea'); const [minQty, setMinQty] = useState(2)

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id); setUserName(user.nm)
    setIsEdit(user.role === 'owner' || user.role === 'manager')
    loadAll(store.id)
  }, [])

  async function loadAll(sid: string) {
    const { data: pl } = await supabase.from('inventory_places').select('name').eq('store_id', sid).order('sort_order')
    const plNames = pl && pl.length > 0 ? pl.map((p: any) => p.name) : ['홀','창고','주방','배달용품']
    if (!pl || pl.length === 0) {
      await supabase.from('inventory_places').insert(plNames.map((n,i) => ({ store_id: sid, name: n, sort_order: i })))
    }
    setPlaces(plNames)
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

  async function updateQty(itemId: string, place: string, newVal: number) {
    const old = getQty(itemId, place)
    setStock(p => ({ ...p, [itemId + '-' + place]: { ...(p[itemId+'-'+place]||{}), item_id: itemId, place, quantity: Math.max(0, newVal), updated_by: userName, updated_at: new Date().toISOString() }}))
    await supabase.from('inventory_stock').upsert({ item_id: itemId, place, quantity: Math.max(0, newVal), updated_by: userName, updated_at: new Date().toISOString() }, { onConflict: 'item_id,place' })
    if (old >= 0 && old !== newVal) {
      await supabase.from('inventory_logs').insert({ item_id: itemId, place, before_qty: old, after_qty: Math.max(0, newVal), changed_by: userName })
    }
  }

  async function addItem() {
    if (!nm.trim() || !storeId) return
    const { data } = await supabase.from('inventory_items').insert({ store_id: storeId, name: nm.trim(), unit, min_qty: minQty }).select().single()
    if (data) setItems(p => [...p, data])
    setNm(''); setUnit('ea'); setMinQty(2); setShowAdd(false)
  }

  const lowItems = items.filter(item => { const tot = totalQty(item.id); return tot >= 0 && tot <= item.min_qty })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>📦 재고관리</span>
        {isEdit && (
          <button onClick={() => setShowAdd(p => !p)}
            style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', color: '#FF6B35', fontSize: 11, cursor: 'pointer' }}>
            + 품목추가
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[{id:'dash',l:'현황'},{id:'log',l:'변경이력'}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
              background: tab === t.id ? 'rgba(255,107,53,0.1)' : '#F4F6F9',
              border: `1px solid ${tab===t.id ? 'rgba(255,107,53,0.3)' : '#E8ECF0'}`,
              color: tab === t.id ? '#FF6B35' : '#888', fontWeight: tab === t.id ? 700 : 400 }}>
            {t.l}
          </button>
        ))}
      </div>

      {showAdd && (
        <div style={{ ...bx, border: '1px solid rgba(255,107,53,0.3)' }}>
          <input value={nm} onChange={e => setNm(e.target.value)} placeholder="품목명" style={{ ...inp, marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="단위 (ea/box/kg)" style={inp} />
            <input type="number" value={minQty} onChange={e => setMinQty(Number(e.target.value))} placeholder="최소" style={{ ...inp, width: 80 }} />
          </div>
          <button onClick={addItem} style={{ padding: '8px 20px', borderRadius: 8, background: '#FF6B35', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>추가</button>
        </div>
      )}

      {lowItems.length > 0 && (
        <div style={{ background: '#FFF0F5', border: '1px solid rgba(232,67,147,0.3)', borderRadius: 12, padding: '10px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#E84393', marginBottom: 6 }}>⚠️ 재고 부족</div>
          {lowItems.map(item => (
            <div key={item.id} style={{ fontSize: 11, color: '#E84393', padding: '2px 0' }}>
              {item.name} ({totalQty(item.id)}{item.unit} / 최소 {item.min_qty}{item.unit})
            </div>
          ))}
        </div>
      )}

      {tab === 'dash' && items.map(item => (
        <div key={item.id} style={bx}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{item.name}</span>
              <span style={{ fontSize: 10, color: '#999', marginLeft: 6 }}>{item.unit}</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: totalQty(item.id) <= item.min_qty ? '#E84393' : '#00B894' }}>
              총 {totalQty(item.id)}{item.unit}{totalQty(item.id) <= item.min_qty && ' ⚠️'}
            </div>
          </div>
          {places.map(pl => {
            const q = getQty(item.id, pl)
            if (q < 0) return null
            const logEntry = stock[item.id + '-' + pl]
            return (
              <div key={pl} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #F4F6F9' }}>
                <span style={{ width: 60, fontSize: 11, color: '#888' }}>{pl}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isEdit && <button onClick={() => updateQty(item.id, pl, q - 1)} style={{ ...btnSm, padding: '2px 10px', fontSize: 14 }}>−</button>}
                  <span style={{ width: 32, textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{q}</span>
                  {isEdit && <button onClick={() => updateQty(item.id, pl, q + 1)} style={{ ...btnSm, padding: '2px 10px', fontSize: 14 }}>+</button>}
                </div>
                {logEntry?.updated_by && <span style={{ fontSize: 9, color: '#bbb' }}>{logEntry.updated_by}</span>}
              </div>
            )
          })}
        </div>
      ))}

      {tab === 'log' && <LogTab storeId={storeId} items={items} />}
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