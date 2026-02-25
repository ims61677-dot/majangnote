'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const CATS = ['전체','고기류','소스','사이드','도우','스프','오븐','마리네이드','치즈']
const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

export default function RecipePage() {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState('')
  const [isEdit, setIsEdit] = useState(false)
  const [recipes, setRecipes] = useState<any[]>([])
  const [cat, setCat] = useState('전체')
  const [expand, setExpand] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editRec, setEditRec] = useState<any>(null)
  const [nm, setNm] = useState(''); const [rc, setRc] = useState('소스')
  const [ic, setIc] = useState('🍳'); const [ingr, setIngr] = useState(''); const [steps, setSteps] = useState(''); const [note, setNote] = useState('')

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id)
    setIsEdit(user.role === 'owner' || user.role === 'manager')
    supabase.from('recipes').select('*').eq('store_id', store.id).order('created_at').then(({ data }) => setRecipes(data || []))
  }, [])

  function openEdit(r: any) {
    setEditRec(r); setNm(r.name); setRc(r.category); setIc(r.icon)
    setIngr(r.ingredients.join('\n')); setSteps(r.steps.join('\n')); setNote(r.note || '')
    setShowForm(true)
  }

  function resetForm() { setEditRec(null); setNm(''); setRc('소스'); setIc('🍳'); setIngr(''); setSteps(''); setNote(''); setShowForm(false) }

  async function saveRecipe() {
    if (!nm.trim() || !storeId) return
    const payload = { store_id: storeId, name: nm.trim(), category: rc, icon: ic,
      ingredients: ingr.split('\n').filter(Boolean), steps: steps.split('\n').filter(Boolean), note, updated_at: new Date().toISOString() }
    if (editRec) {
      const { data } = await supabase.from('recipes').update(payload).eq('id', editRec.id).select().single()
      if (data) setRecipes(p => p.map(x => x.id === editRec.id ? data : x))
    } else {
      const { data } = await supabase.from('recipes').insert(payload).select().single()
      if (data) setRecipes(p => [...p, data])
    }
    resetForm()
  }

  async function deleteRecipe(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('recipes').delete().eq('id', id)
    setRecipes(p => p.filter(x => x.id !== id))
    if (expand === id) setExpand(null)
  }

  const filtered = cat === '전체' ? recipes : recipes.filter(r => r.category === cat)
  const grouped: [string, any[]][] = []
  const seen = new Set<string>()
  filtered.forEach(r => { if (!seen.has(r.category)) { seen.add(r.category); grouped.push([r.category, filtered.filter(x => x.category === r.category)]) } })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>🍳 레시피</span>
        {isEdit && (
          <button onClick={() => { resetForm(); setShowForm(true) }}
            style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', color: '#FF6B35', fontSize: 11, cursor: 'pointer' }}>
            + 레시피 추가
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {CATS.map(c => (
          <button key={c} onClick={() => setCat(c)}
            style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
              background: cat===c ? 'rgba(255,107,53,0.1)' : '#F4F6F9',
              border: `1px solid ${cat===c ? 'rgba(255,107,53,0.3)' : '#E8ECF0'}`,
              color: cat===c ? '#FF6B35' : '#888' }}>
            {c}
          </button>
        ))}
      </div>

      {showForm && (
        <div style={{ ...bx, border: '1px solid rgba(255,107,53,0.3)', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>{editRec ? '레시피 수정' : '레시피 추가'}</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input value={ic} onChange={e => setIc(e.target.value)} placeholder="이모지" style={{ ...inp, width: 48 }} />
            <input value={nm} onChange={e => setNm(e.target.value)} placeholder="레시피 이름" style={inp} />
          </div>
          <select value={rc} onChange={e => setRc(e.target.value)} style={{ ...inp, marginBottom: 8, appearance: 'auto' }}>
            {CATS.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <textarea value={ingr} onChange={e => setIngr(e.target.value)} rows={4}
            placeholder={"재료 (한 줄에 하나씩)\n예: 토마토홀 6캔"} style={{ ...inp, resize: 'vertical', marginBottom: 8 }} />
          <textarea value={steps} onChange={e => setSteps(e.target.value)} rows={4}
            placeholder={"조리 단계 (한 줄에 하나씩)"} style={{ ...inp, resize: 'vertical', marginBottom: 8 }} />
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="메모 (선택)" style={{ ...inp, resize: 'vertical', marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveRecipe}
              style={{ flex: 1, padding: 10, borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {editRec ? '수정' : '등록'}
            </button>
            <button onClick={resetForm}
              style={{ padding: '10px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
          </div>
        </div>
      )}

      {grouped.map(([category, recs]) => (
        <div key={category} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#999', marginBottom: 8, textTransform: 'uppercase' }}>{category}</div>
          {recs.map(r => (
            <div key={r.id} style={bx}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                onClick={() => setExpand(expand === r.id ? null : r.id)}>
                <span style={{ fontSize: 22 }}>{r.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{r.name}</div>
                  <div style={{ fontSize: 10, color: '#999' }}>{r.ingredients.length}가지 재료 · {r.steps.length}단계</div>
                </div>
                {isEdit && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={e => { e.stopPropagation(); openEdit(r) }} style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 12 }}>✏️</button>
                    <button onClick={e => { e.stopPropagation(); deleteRecipe(r.id) }} style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 11 }}>✕</button>
                  </div>
                )}
                <span style={{ fontSize: 12, color: '#bbb' }}>{expand === r.id ? '▲' : '▼'}</span>
              </div>
              {expand === r.id && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #F4F6F9' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#FF6B35', marginBottom: 6 }}>재료</div>
                  {r.ingredients.map((ing: string, i: number) => (
                    <div key={i} style={{ fontSize: 12, padding: '3px 0', color: '#555' }}>• {ing}</div>
                  ))}
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#2DC6D6', marginTop: 10, marginBottom: 6 }}>조리 단계</div>
                  {r.steps.map((st: string, i: number) => (
                    <div key={i} style={{ fontSize: 12, padding: '4px 0', color: '#555' }}>
                      <span style={{ color: '#2DC6D6', fontWeight: 700 }}>{i+1}. </span>{st}
                    </div>
                  ))}
                  {r.note && <div style={{ marginTop: 8, padding: 8, background: '#F8F9FB', borderRadius: 8, fontSize: 11, color: '#888' }}>📝 {r.note}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}