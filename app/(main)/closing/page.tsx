'use client'
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
              if(/^\d*$/.test(raw)) setAmounts(p=>({...p,[ch.key]:Number(raw).toLocaleString()||''}))
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
