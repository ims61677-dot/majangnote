'use client'
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
