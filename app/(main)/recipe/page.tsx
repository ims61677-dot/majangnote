'use client'
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
      ingredients:form.ingredients.split('\n').filter(Boolean),
      steps:form.steps.split('\n').filter(Boolean),
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
