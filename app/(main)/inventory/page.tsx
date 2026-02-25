'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function InventoryPage() {
  const [store, setStore] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [stocks, setStocks] = useState<any[]>([])
  const [places, setPlaces] = useState<any[]>([])
  const [tab, setTab] = useState<'현황'|'이력'>('현황')
  const [logs, setLogs] = useState<any[]>([])

  useEffect(()=>{
    const s=localStorage.getItem('mj_store');const u=localStorage.getItem('mj_user')
    if(s&&u){const st=JSON.parse(s);const us=JSON.parse(u);setStore(st);setUser(us);loadAll(st.id)}
  },[])

  async function loadAll(storeId:string){
    const [{data:it},{data:st},{data:pl}]=await Promise.all([
      supabase.from('inventory_items').select('*').eq('store_id',storeId).order('name'),
      supabase.from('inventory_stock').select('*'),
      supabase.from('inventory_places').select('*').eq('store_id',storeId).order('sort_order'),
    ])
    if(it)setItems(it);if(st)setStocks(st);if(pl)setPlaces(pl)
  }

  async function loadLogs(storeId:string){
    const{data}=await supabase.from('inventory_logs').select('*,inventory_items(name,unit)').order('created_at',{ascending:false}).limit(50)
    if(data)setLogs(data)
  }

  function getStock(itemId:string,place:string){
    return stocks.find(s=>s.item_id===itemId&&s.place===place)?.quantity||0
  }

  function getTotalStock(itemId:string){
    return places.reduce((s,p)=>s+getStock(itemId,p.name),0)
  }

  async function changeStock(itemId:string,place:string,delta:number){
    if(!user)return
    const cur=getStock(itemId,place)
    const next=Math.max(0,cur+delta)
    await supabase.from('inventory_stock').upsert({item_id:itemId,place,quantity:next,updated_by:user.nm},{onConflict:'item_id,place'})
    await supabase.from('inventory_logs').insert({item_id:itemId,place,before_qty:cur,after_qty:next,changed_by:user.nm})
    if(store)loadAll(store.id)
  }

  return (
    <div>
      <h2 style={{marginBottom:16}}>📦 재고관리</h2>
      <div style={{display:'flex',gap:8,marginBottom:16}}>
        {(['현황','이력'] as const).map(t=>(
          <button key={t} onClick={()=>{setTab(t);if(t==='이력'&&store)loadLogs(store.id)}}
            style={{padding:'8px 20px',borderRadius:8,border:'none',background:tab===t?'#FF6B35':'rgba(255,255,255,0.1)',color:'white',cursor:'pointer'}}>
            {t}
          </button>
        ))}
      </div>
      {tab==='현황'?(
        <div>
          {items.map(item=>{
            const total=getTotalStock(item.id)
            const isLow=total<=item.min_qty
            return(
              <div key={item.id} style={{background:'rgba(255,255,255,0.05)',borderRadius:12,padding:16,marginBottom:12,border:isLow?'1px solid #ff6b6b':'none'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                  <span style={{fontWeight:'bold'}}>{item.name}</span>
                  <span style={{color:isLow?'#ff6b6b':'#2DC6D6'}}>{total}{item.unit} {isLow&&'⚠️'}</span>
                </div>
                {places.map(p=>(
                  <div key={p.name} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                    <span style={{color:'rgba(255,255,255,0.5)',fontSize:13}}>{p.name}</span>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <button onClick={()=>changeStock(item.id,p.name,-1)} style={{width:28,height:28,borderRadius:6,border:'1px solid rgba(255,255,255,0.2)',background:'none',color:'white',cursor:'pointer',fontSize:16}}>-</button>
                      <span style={{minWidth:30,textAlign:'center'}}>{getStock(item.id,p.name)}</span>
                      <button onClick={()=>changeStock(item.id,p.name,1)} style={{width:28,height:28,borderRadius:6,border:'1px solid rgba(255,255,255,0.2)',background:'none',color:'white',cursor:'pointer',fontSize:16}}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
          {items.length===0&&<p style={{color:'rgba(255,255,255,0.4)',textAlign:'center'}}>재고 항목이 없습니다</p>}
        </div>
      ):(
        <div>
          {logs.map(log=>(
            <div key={log.id} style={{background:'rgba(255,255,255,0.05)',borderRadius:8,padding:12,marginBottom:8}}>
              <div style={{display:'flex',justifyContent:'space-between'}}>
                <span style={{fontWeight:'bold'}}>{log.inventory_items?.name}</span>
                <span style={{color:'rgba(255,255,255,0.5)',fontSize:12}}>{log.place}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
                <span style={{color:'rgba(255,255,255,0.5)',fontSize:12}}>{log.changed_by} · {new Date(log.created_at).toLocaleString('ko-KR')}</span>
                <span style={{color:log.after_qty>log.before_qty?'#2DC6D6':'#ff6b6b'}}>{log.before_qty}→{log.after_qty}{log.inventory_items?.unit}</span>
              </div>
            </div>
          ))}
          {logs.length===0&&<p style={{color:'rgba(255,255,255,0.4)',textAlign:'center'}}>변경 이력이 없습니다</p>}
        </div>
      )}
    </div>
  )
}
