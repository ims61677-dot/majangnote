'use client'
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
