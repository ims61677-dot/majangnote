const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ 생성:', filePath);
}

// lib/supabase.ts
write('lib/supabase.ts', `import { createClient } from '@supabase/supabase-js'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
`);

// app/layout.tsx
write('app/layout.tsx', `import type { Metadata } from 'next'
export const metadata: Metadata = { title: '매장노트', description: '매장 관리 시스템' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{margin:0, fontFamily:'sans-serif', background:'#1a1a2e', color:'white'}}>
        {children}
      </body>
    </html>
  )
}
`);

// app/login/page.tsx
write('app/login/page.tsx', `'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [users, setUsers] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('profiles').select('*').order('nm').then(({ data }) => {
      if (data) setUsers(data)
    })
  }, [])

  async function handleLogin() {
    setLoading(true)
    setError('')
    const user = users.find(u => u.id === selectedId)
    if (!user) { setError('직원을 선택하세요'); setLoading(false); return }
    if (user.pin !== pin) { setError('PIN이 틀렸습니다'); setLoading(false); return }
    const { data: member } = await supabase
      .from('store_members')
      .select('*, stores(*)')
      .eq('profile_id', user.id)
      .eq('active', true)
      .single()
    if (!member) { setError('매장 정보를 찾을 수 없습니다'); setLoading(false); return }
    localStorage.setItem('mj_user', JSON.stringify({...user, role: member.role}))
    localStorage.setItem('mj_store', JSON.stringify(member.stores))
    router.push('/dash')
    setLoading(false)
  }

  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'linear-gradient(135deg,#1a1a2e,#16213e)'}}>
      <div style={{background:'rgba(255,255,255,0.05)',borderRadius:16,padding:40,width:300,border:'1px solid rgba(255,255,255,0.1)'}}>
        <h1 style={{textAlign:'center',marginBottom:32,fontSize:24}}>🏪 매장노트</h1>
        <select value={selectedId} onChange={e=>setSelectedId(e.target.value)}
          style={{width:'100%',padding:12,borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.05)',color:'white',marginBottom:16,fontSize:16}}>
          <option value="">직원 선택</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.nm} ({u.role})</option>)}
        </select>
        <input type="password" placeholder="PIN 4자리" maxLength={4} value={pin} onChange={e=>setPin(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&handleLogin()}
          style={{width:'100%',padding:12,borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.05)',color:'white',marginBottom:16,fontSize:16,boxSizing:'border-box'}} />
        {error && <p style={{color:'#ff6b6b',textAlign:'center',marginBottom:12}}>{error}</p>}
        <button onClick={handleLogin} disabled={loading}
          style={{width:'100%',padding:14,borderRadius:8,background:'#FF6B35',border:'none',color:'white',fontSize:16,cursor:'pointer',fontWeight:'bold'}}>
          {loading ? '로그인 중...' : '로그인'}
        </button>
      </div>
    </div>
  )
}
`);

// app/(main)/layout.tsx
write('app/(main)/layout.tsx', `'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [store, setStore] = useState<any>(null)

  useEffect(() => {
    const u = localStorage.getItem('mj_user')
    const s = localStorage.getItem('mj_store')
    if (!u || !s) { router.push('/login'); return }
    setUser(JSON.parse(u))
    setStore(JSON.parse(s))
  }, [])

  const nav = [
    { href: '/dash', label: '대시', icon: '📊' },
    { href: '/schedule', label: '스케줄', icon: '📅' },
    { href: '/closing', label: '마감', icon: '💰' },
    { href: '/inventory', label: '재고', icon: '📦' },
    { href: '/recipe', label: '레시피', icon: '🍳' },
  ]

  return (
    <div style={{maxWidth:480,margin:'0 auto',minHeight:'100vh',display:'flex',flexDirection:'column'}}>
      <header style={{background:'rgba(255,255,255,0.05)',padding:'12px 16px',display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
        <span style={{fontWeight:'bold'}}>{store?.name || '매장노트'}</span>
        <button onClick={()=>{localStorage.clear();router.push('/login')}}
          style={{background:'none',border:'1px solid rgba(255,255,255,0.3)',color:'white',padding:'4px 12px',borderRadius:6,cursor:'pointer'}}>
          로그아웃
        </button>
      </header>
      <main style={{flex:1,padding:16,paddingBottom:80}}>
        {children}
      </main>
      <nav style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:480,background:'#16213e',borderTop:'1px solid rgba(255,255,255,0.1)',display:'flex',justifyContent:'space-around',padding:'8px 0'}}>
        {nav.map(n => (
          <Link key={n.href} href={n.href} style={{display:'flex',flexDirection:'column',alignItems:'center',textDecoration:'none',color:pathname.startsWith(n.href)?'#FF6B35':'rgba(255,255,255,0.5)',fontSize:12,padding:'4px 8px'}}>
            <span style={{fontSize:20}}>{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
`);

// app/(main)/dash/page.tsx
write('app/(main)/dash/page.tsx', `'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function DashPage() {
  const [closings, setClosings] = useState<any[]>([])
  const [store, setStore] = useState<any>(null)
  const [month, setMonth] = useState(new Date())

  useEffect(() => {
    const s = localStorage.getItem('mj_store')
    if (s) {
      const st = JSON.parse(s)
      setStore(st)
      loadData(st.id, month)
    }
  }, [])

  async function loadData(storeId: string, m: Date) {
    const yr = m.getFullYear()
    const mo = String(m.getMonth()+1).padStart(2,'0')
    const from = yr+'-'+mo+'-01'
    const lastDay = new Date(yr, m.getMonth()+1, 0).getDate()
    const to = yr+'-'+mo+'-'+String(lastDay).padStart(2,'0')
    const { data } = await supabase.from('closings')
      .select('*').eq('store_id', storeId)
      .gte('date', from).lte('date', to).order('date')
    if (data) setClosings(data)
  }

  const total = closings.reduce((s,c) => s + Object.values(c.channel_data||{}).reduce((a:any,b:any)=>a+b,0), 0)
  const avg = closings.length ? Math.round(Number(total)/closings.length) : 0

  function prevMonth() { const m = new Date(month); m.setMonth(m.getMonth()-1); setMonth(m); if(store) loadData(store.id, m) }
  function nextMonth() { const m = new Date(month); m.setMonth(m.getMonth()+1); setMonth(m); if(store) loadData(store.id, m) }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <button onClick={prevMonth} style={{background:'none',border:'none',color:'white',fontSize:20,cursor:'pointer'}}>‹</button>
        <h2 style={{margin:0}}>{month.getFullYear()}년 {month.getMonth()+1}월</h2>
        <button onClick={nextMonth} style={{background:'none',border:'none',color:'white',fontSize:20,cursor:'pointer'}}>›</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:20}}>
        {[
          {label:'총 매출', value: Number(total).toLocaleString()+'원'},
          {label:'일 평균', value: avg.toLocaleString()+'원'},
          {label:'영업일', value: closings.length+'일'},
          {label:'최고 매출', value: (closings.length ? Math.max(...closings.map((c:any)=>Object.values(c.channel_data||{}).reduce((a:any,b:any)=>a+b,0))) : 0).toLocaleString()+'원'},
        ].map(item => (
          <div key={item.label} style={{background:'rgba(255,255,255,0.05)',borderRadius:12,padding:16}}>
            <div style={{color:'rgba(255,255,255,0.5)',fontSize:12,marginBottom:4}}>{item.label}</div>
            <div style={{fontWeight:'bold',fontSize:16}}>{item.value}</div>
          </div>
        ))}
      </div>
      <div style={{background:'rgba(255,255,255,0.05)',borderRadius:12,padding:16}}>
        <h3 style={{margin:'0 0 12px'}}>마감 일지</h3>
        {closings.length === 0 ? <p style={{color:'rgba(255,255,255,0.4)',textAlign:'center'}}>이번 달 마감 데이터가 없습니다</p> :
          closings.map(c => {
            const dayTotal = Object.values(c.channel_data||{}).reduce((a:any,b:any)=>a+b,0)
            return (
              <div key={c.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
                <span>{c.date}</span>
                <span style={{color:'#FF6B35',fontWeight:'bold'}}>{Number(dayTotal).toLocaleString()}원</span>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}
`);

// app/(main)/closing/page.tsx
write('app/(main)/closing/page.tsx', `'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function ClosingPage() {
  const [store, setStore] = useState<any>(null)
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [channels, setChannels] = useState<any[]>([])
  const [amounts, setAmounts] = useState<Record<string,string>>({})
  const [memo, setMemo] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const s = localStorage.getItem('mj_store')
    if (s) {
      const st = JSON.parse(s)
      setStore(st)
      loadChannels(st.id)
    }
  }, [])

  useEffect(() => { if (store) { loadClosing(store.id, date) } }, [date, store])

  async function loadChannels(storeId: string) {
    const { data } = await supabase.from('sales_channels').select('*').eq('store_id', storeId).order('sort_order')
    if (data) setChannels(data)
  }

  async function loadClosing(storeId: string, d: string) {
    const { data } = await supabase.from('closings').select('*').eq('store_id', storeId).eq('date', d).single()
    if (data) {
      const a: Record<string,string> = {}
      channels.forEach(ch => { a[ch.key] = data.channel_data[ch.key]?.toLocaleString() || '' })
      setAmounts(a)
      setMemo(data.memo || '')
    } else {
      setAmounts({})
      setMemo('')
    }
  }

  async function handleSave() {
    if (!store) return
    const channelData: Record<string,number> = {}
    channels.forEach(ch => { channelData[ch.key] = Number(amounts[ch.key]?.replace(/,/g,'') || 0) })
    await supabase.from('closings').upsert({ store_id: store.id, date, channel_data: channelData, memo }, { onConflict: 'store_id,date' })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const total = channels.reduce((s,ch) => s + Number(amounts[ch.key]?.replace(/,/g,'')||0), 0)

  return (
    <div>
      <h2 style={{marginBottom:16}}>💰 마감일지</h2>
      <input type="date" value={date} onChange={e=>setDate(e.target.value)}
        style={{width:'100%',padding:12,borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.05)',color:'white',marginBottom:16,fontSize:16,boxSizing:'border-box'}} />
      {channels.map(ch => (
        <div key={ch.key} style={{marginBottom:12}}>
          <label style={{display:'block',marginBottom:4,color:'rgba(255,255,255,0.7)'}}>{ch.label}</label>
          <input type="text" value={amounts[ch.key]||''} placeholder="0"
            onChange={e=>{
              const raw = e.target.value.replace(/,/g,'')
              if(/^\\d*$/.test(raw)) setAmounts(p=>({...p,[ch.key]:Number(raw).toLocaleString()||''}))
            }}
            style={{width:'100%',padding:12,borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.05)',color:'white',fontSize:16,boxSizing:'border-box',textAlign:'right'}} />
        </div>
      ))}
      <div style={{background:'rgba(255,107,53,0.1)',border:'1px solid #FF6B35',borderRadius:8,padding:16,marginBottom:16,display:'flex',justifyContent:'space-between'}}>
        <span>합계</span>
        <span style={{color:'#FF6B35',fontWeight:'bold',fontSize:18}}>{total.toLocaleString()}원</span>
      </div>
      <textarea value={memo} onChange={e=>setMemo(e.target.value)} placeholder="메모..."
        style={{width:'100%',padding:12,borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.05)',color:'white',fontSize:14,minHeight:80,boxSizing:'border-box',marginBottom:16,resize:'vertical'}} />
      <button onClick={handleSave}
        style={{width:'100%',padding:14,borderRadius:8,background:'#FF6B35',border:'none',color:'white',fontSize:16,cursor:'pointer',fontWeight:'bold'}}>
        {saved ? '✅ 저장됨!' : '저장'}
      </button>
    </div>
  )
}
`);

// app/(main)/schedule/page.tsx
write('app/(main)/schedule/page.tsx', `'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SchedulePage() {
  const [store, setStore] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [month, setMonth] = useState(new Date())

  useEffect(() => {
    const s = localStorage.getItem('mj_store')
    const u = localStorage.getItem('mj_user')
    if (s && u) {
      const st = JSON.parse(s)
      const us = JSON.parse(u)
      setStore(st); setUser(us)
      loadMembers(st.id)
      loadSchedules(st.id, month)
    }
  }, [])

  async function loadMembers(storeId: string) {
    const { data } = await supabase.from('store_members').select('*, profiles(*)').eq('store_id', storeId).eq('active', true)
    if (data) setMembers(data)
  }

  async function loadSchedules(storeId: string, m: Date) {
    const yr = m.getFullYear()
    const mo = String(m.getMonth()+1).padStart(2,'0')
    const { data } = await supabase.from('schedules').select('*').eq('store_id', storeId)
      .gte('date', yr+'-'+mo+'-01').lte('date', yr+'-'+mo+'-31')
    if (data) setSchedules(data)
  }

  const daysInMonth = new Date(month.getFullYear(), month.getMonth()+1, 0).getDate()
  const days = Array.from({length: daysInMonth}, (_,i) => i+1)

  function getSch(nm: string, day: number) {
    const d = month.getFullYear()+'-'+String(month.getMonth()+1).padStart(2,'0')+'-'+String(day).padStart(2,'0')
    return schedules.find(s => s.profile_nm === nm && s.date === d)
  }

  async function toggleCell(nm: string, day: number) {
    if (!store || !user) return
    const d = month.getFullYear()+'-'+String(month.getMonth()+1).padStart(2,'0')+'-'+String(day).padStart(2,'0')
    const cur = getSch(nm, day)
    const cycle = [{status:'휴일',position:''},{status:'근무',position:''},{status:'근무',position:'K'},{status:'근무',position:'H'}]
    const idx = cur ? cycle.findIndex(c=>c.status===cur.status&&c.position===cur.position) : 0
    const next = cycle[(idx+1)%cycle.length]
    await supabase.from('schedules').upsert({store_id:store.id,profile_nm:nm,date:d,...next},{onConflict:'store_id,profile_nm,date'})
    loadSchedules(store.id, month)
  }

  function cellColor(sch: any) {
    if (!sch || sch.status==='휴일') return 'transparent'
    if (sch.position==='K') return '#FF6B35'
    if (sch.position==='H') return '#2DC6D6'
    return 'rgba(255,255,255,0.2)'
  }

  function cellText(sch: any) {
    if (!sch || sch.status==='휴일') return ''
    if (sch.position) return sch.position
    return '●'
  }

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <button onClick={()=>{const m=new Date(month);m.setMonth(m.getMonth()-1);setMonth(m);if(store)loadSchedules(store.id,m)}} style={{background:'none',border:'none',color:'white',fontSize:20,cursor:'pointer'}}>‹</button>
        <h2 style={{margin:0}}>{month.getFullYear()}년 {month.getMonth()+1}월</h2>
        <button onClick={()=>{const m=new Date(month);m.setMonth(m.getMonth()+1);setMonth(m);if(store)loadSchedules(store.id,m)}} style={{background:'none',border:'none',color:'white',fontSize:20,cursor:'pointer'}}>›</button>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{borderCollapse:'collapse',fontSize:11}}>
          <thead>
            <tr>
              <th style={{minWidth:60,padding:'4px 8px',textAlign:'left',borderBottom:'1px solid rgba(255,255,255,0.1)',position:'sticky',left:0,background:'#1a1a2e'}}>이름</th>
              {days.map(d=>{
                const dow=['일','월','화','수','목','금','토'][new Date(month.getFullYear(),month.getMonth(),d).getDay()]
                const isWeekend=[0,6].includes(new Date(month.getFullYear(),month.getMonth(),d).getDay())
                return <th key={d} style={{minWidth:28,padding:'2px',textAlign:'center',borderBottom:'1px solid rgba(255,255,255,0.1)',color:isWeekend?'#ff6b6b':'white'}}>
                  <div>{d}</div><div style={{fontSize:9}}>{dow}</div>
                </th>
              })}
            </tr>
          </thead>
          <tbody>
            {members.map(m=>(
              <tr key={m.id}>
                <td style={{padding:'4px 8px',borderBottom:'1px solid rgba(255,255,255,0.05)',position:'sticky',left:0,background:'#1a1a2e',whiteSpace:'nowrap'}}>{m.profiles?.nm}</td>
                {days.map(d=>{
                  const sch=getSch(m.profiles?.nm,d)
                  return <td key={d} onClick={()=>toggleCell(m.profiles?.nm,d)} style={{padding:'2px',textAlign:'center',borderBottom:'1px solid rgba(255,255,255,0.05)',cursor:'pointer'}}>
                    <div style={{width:24,height:24,borderRadius:4,background:cellColor(sch),display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:'bold',color:'white'}}>
                      {cellText(sch)}
                    </div>
                  </td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{marginTop:12,display:'flex',gap:12,fontSize:12}}>
        <span><span style={{display:'inline-block',width:12,height:12,background:'#FF6B35',borderRadius:2,marginRight:4}}></span>K</span>
        <span><span style={{display:'inline-block',width:12,height:12,background:'#2DC6D6',borderRadius:2,marginRight:4}}></span>H</span>
        <span><span style={{display:'inline-block',width:12,height:12,background:'rgba(255,255,255,0.2)',borderRadius:2,marginRight:4}}></span>근무</span>
      </div>
    </div>
  )
}
`);

// app/(main)/inventory/page.tsx
write('app/(main)/inventory/page.tsx', `'use client'
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
`);

// app/(main)/recipe/page.tsx
write('app/(main)/recipe/page.tsx', `'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const CATEGORIES = ['전체','고기류','소스','사이드','도우','스프','오븐','마리네이드','치즈']

export default function RecipePage() {
  const [store, setStore] = useState<any>(null)
  const [recipes, setRecipes] = useState<any[]>([])
  const [cat, setCat] = useState('전체')
  const [expanded, setExpanded] = useState<string|null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({name:'',category:'소스',icon:'🍳',ingredients:'',steps:'',note:''})

  useEffect(()=>{
    const s=localStorage.getItem('mj_store')
    if(s){const st=JSON.parse(s);setStore(st);loadRecipes(st.id)}
  },[])

  async function loadRecipes(storeId:string){
    const{data}=await supabase.from('recipes').select('*').eq('store_id',storeId).order('name')
    if(data)setRecipes(data)
  }

  async function handleSave(){
    if(!store||!form.name)return
    await supabase.from('recipes').insert({
      store_id:store.id,...form,
      ingredients:form.ingredients.split('\\n').filter(Boolean),
      steps:form.steps.split('\\n').filter(Boolean),
    })
    setForm({name:'',category:'소스',icon:'🍳',ingredients:'',steps:'',note:''})
    setShowForm(false)
    loadRecipes(store.id)
  }

  const filtered=cat==='전체'?recipes:recipes.filter(r=>r.category===cat)

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <h2 style={{margin:0}}>🍳 레시피</h2>
        <button onClick={()=>setShowForm(!showForm)} style={{background:'#FF6B35',border:'none',color:'white',padding:'8px 16px',borderRadius:8,cursor:'pointer'}}>+ 추가</button>
      </div>
      {showForm&&(
        <div style={{background:'rgba(255,255,255,0.05)',borderRadius:12,padding:16,marginBottom:16}}>
          <input placeholder="이름" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}
            style={{width:'100%',padding:10,borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.05)',color:'white',marginBottom:8,boxSizing:'border-box'}} />
          <div style={{display:'flex',gap:8,marginBottom:8}}>
            <input placeholder="아이콘" value={form.icon} onChange={e=>setForm(p=>({...p,icon:e.target.value}))} style={{width:60,padding:10,borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.05)',color:'white',textAlign:'center'}} />
            <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} style={{flex:1,padding:10,borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',background:'#1a1a2e',color:'white'}}>
              {CATEGORIES.slice(1).map(c=><option key={c}>{c}</option>)}
            </select>
          </div>
          <textarea placeholder="재료 (한 줄에 하나씩)" value={form.ingredients} onChange={e=>setForm(p=>({...p,ingredients:e.target.value}))}
            style={{width:'100%',padding:10,borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.05)',color:'white',minHeight:80,marginBottom:8,boxSizing:'border-box',resize:'vertical'}} />
          <textarea placeholder="조리법 (한 줄에 하나씩)" value={form.steps} onChange={e=>setForm(p=>({...p,steps:e.target.value}))}
            style={{width:'100%',padding:10,borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.05)',color:'white',minHeight:80,marginBottom:8,boxSizing:'border-box',resize:'vertical'}} />
          <textarea placeholder="메모" value={form.note} onChange={e=>setForm(p=>({...p,note:e.target.value}))}
            style={{width:'100%',padding:10,borderRadius:8,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.05)',color:'white',minHeight:60,marginBottom:8,boxSizing:'border-box',resize:'vertical'}} />
          <div style={{display:'flex',gap:8}}>
            <button onClick={handleSave} style={{flex:1,padding:10,background:'#FF6B35',border:'none',color:'white',borderRadius:8,cursor:'pointer'}}>저장</button>
            <button onClick={()=>setShowForm(false)} style={{flex:1,padding:10,background:'rgba(255,255,255,0.1)',border:'none',color:'white',borderRadius:8,cursor:'pointer'}}>취소</button>
          </div>
        </div>
      )}
      <div style={{display:'flex',gap:8,overflowX:'auto',marginBottom:16,paddingBottom:4}}>
        {CATEGORIES.map(c=>(
          <button key={c} onClick={()=>setCat(c)} style={{padding:'6px 14px',borderRadius:20,border:'none',background:cat===c?'#FF6B35':'rgba(255,255,255,0.1)',color:'white',cursor:'pointer',whiteSpace:'nowrap'}}>
            {c}
          </button>
        ))}
      </div>
      {filtered.map(r=>(
        <div key={r.id} style={{background:'rgba(255,255,255,0.05)',borderRadius:12,marginBottom:8,overflow:'hidden'}}>
          <div onClick={()=>setExpanded(expanded===r.id?null:r.id)} style={{padding:16,display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}}>
            <span>{r.icon} {r.name}</span>
            <span style={{color:'rgba(255,255,255,0.4)',fontSize:12}}>{r.category} {expanded===r.id?'▲':'▼'}</span>
          </div>
          {expanded===r.id&&(
            <div style={{padding:'0 16px 16px',borderTop:'1px solid rgba(255,255,255,0.1)'}}>
              {r.ingredients?.length>0&&<div style={{marginTop:12}}><strong>재료</strong><ul style={{margin:'8px 0',paddingLeft:20}}>{r.ingredients.map((i:string,idx:number)=><li key={idx} style={{color:'rgba(255,255,255,0.7)',marginBottom:4}}>{i}</li>)}</ul></div>}
              {r.steps?.length>0&&<div style={{marginTop:12}}><strong>조리법</strong><ol style={{margin:'8px 0',paddingLeft:20}}>{r.steps.map((s:string,idx:number)=><li key={idx} style={{color:'rgba(255,255,255,0.7)',marginBottom:4}}>{s}</li>)}</ol></div>}
              {r.note&&<div style={{marginTop:12,color:'rgba(255,255,255,0.5)',fontSize:13}}>{r.note}</div>}
            </div>
          )}
        </div>
      ))}
      {filtered.length===0&&<p style={{color:'rgba(255,255,255,0.4)',textAlign:'center'}}>레시피가 없습니다</p>}
    </div>
  )
}
`);

// next.config.ts 수정
write('next.config.ts', `import type { NextConfig } from "next";
const nextConfig: NextConfig = {};
export default nextConfig;
`);

console.log('\\n🎉 모든 파일 생성 완료!');
