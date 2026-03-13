'use client'
import { useEffect, useState, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const CATS = ['전체','고기류','소스','사이드','도우','스프','오븐','마리네이드','치즈']
const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

export default function RecipePage() {
  const supabase = createSupabaseBrowserClient()

  // ── 기본 상태 ─────────────────────────────────
  const [storeId, setStoreId] = useState('')
  const [userId, setUserId] = useState('')
  const [isOwner, setIsOwner] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [activeTab, setActiveTab] = useState<'mine' | 'admin'>('mine')

  // ── 내 지점 탭 상태 ───────────────────────────
  const [recipes, setRecipes] = useState<any[]>([])
  const [cat, setCat] = useState('전체')
  const [expand, setExpand] = useState<string | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editRec, setEditRec] = useState<any>(null)
  const [nm, setNm] = useState('')
  const [rc, setRc] = useState('소스')
  const [ic, setIc] = useState('🍳')
  const [ingr, setIngr] = useState('')
  const [steps, setSteps] = useState('')
  const [note, setNote] = useState('')
  const itemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  // ── 관리자 탭 상태 ────────────────────────────
  const [allStores, setAllStores] = useState<any[]>([])
  const [adminLoading, setAdminLoading] = useState(false)
  const [expandedStore, setExpandedStore] = useState<string | null>(null)

  // ── 모달: 레시피 1개 복사 ─────────────────────
  const [copyModal, setCopyModal] = useState<{ recipe: any; sourceStoreId: string } | null>(null)
  const [copyTarget, setCopyTarget] = useState('')

  // ── 모달: 지점 전체 복사 ─────────────────────
  const [copyAllModal, setCopyAllModal] = useState<{ sourceStoreId: string; sourceName: string } | null>(null)
  const [copyAllTarget, setCopyAllTarget] = useState('')
  const [copyAllStep, setCopyAllStep] = useState<'select' | 'noConflict' | 'conflicts'>('select')
  const [copyAllConflicts, setCopyAllConflicts] = useState<any[]>([])
  const [conflictRes, setConflictRes] = useState<{ [id: string]: 'skip' | 'overwrite' }>({})

  // ── 모달: 전 지점 공통 등록 ──────────────────
  const [showCommonForm, setShowCommonForm] = useState(false)
  const [commonStep, setCommonStep] = useState<'form' | 'check'>('form')
  const [cNm, setCNm] = useState('')
  const [cRc, setCRc] = useState('소스')
  const [cIc, setCIc] = useState('🍳')
  const [cIngr, setCIngr] = useState('')
  const [cSteps, setCSteps] = useState('')
  const [cNote, setCNote] = useState('')
  const [dupCheck, setDupCheck] = useState<{ storeId: string; storeName: string; hasDup: boolean }[]>([])

  // ── 모달: 관리자 탭 레시피 수정 ──────────────
  const [adminEdit, setAdminEdit] = useState<{ recipe: any; storeId: string } | null>(null)
  const [aNm, setANm] = useState('')
  const [aRc, setARc] = useState('소스')
  const [aIc, setAIc] = useState('🍳')
  const [aIngr, setAIngr] = useState('')
  const [aSteps, setASteps] = useState('')
  const [aNote, setANote] = useState('')

  // ── 초기 로드 ─────────────────────────────────
  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id)
    setUserId(user.id || '')
    const owner = user.role === 'owner'
    setIsOwner(owner)
    setIsEdit(owner || user.role === 'manager')
    supabase.from('recipes').select('*').eq('store_id', store.id).order('created_at')
      .then(({ data }) => setRecipes(data || []))
  }, [])

  // 관리자 탭 클릭 시 데이터 로드
  useEffect(() => {
    if (activeTab === 'admin' && userId) loadAdminData()
  }, [activeTab, userId])

  async function loadAdminData() {
    setAdminLoading(true)
    const { data: members } = await supabase
      .from('store_members').select('*, stores(*)')
      .eq('profile_id', userId).eq('role', 'owner').eq('active', true)
    if (!members) { setAdminLoading(false); return }
    const result = await Promise.all(
      members.map(async (m: any) => {
        const s = m.stores
        const { data } = await supabase.from('recipes').select('*').eq('store_id', s.id).order('created_at')
        return { store: s, recipes: data || [] }
      })
    )
    setAllStores(result)
    setAdminLoading(false)
  }

  // ── 내 지점 탭 함수들 ─────────────────────────
  function doSearch() {
    const q = search.trim()
    if (!q) { setHighlight(null); return }
    const found = recipes.find(r =>
      r.name?.includes(q) ||
      r.ingredients?.some((i: string) => i.includes(q)) ||
      r.steps?.some((s: string) => s.includes(q)) ||
      r.note?.includes(q)
    )
    if (found) {
      setCat('전체')
      setExpand(found.id)
      setHighlight(found.id)
      setTimeout(() => {
        itemRefs.current[found.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 150)
    } else {
      alert(`"${q}"에 해당하는 레시피가 없어요.`)
    }
  }

  function openEdit(r: any) {
    setEditRec(r); setNm(r.name); setRc(r.category); setIc(r.icon)
    setIngr(r.ingredients.join('\n')); setSteps(r.steps.join('\n')); setNote(r.note || '')
    setShowForm(true)
  }

  function resetForm() {
    setEditRec(null); setNm(''); setRc('소스'); setIc('🍳')
    setIngr(''); setSteps(''); setNote(''); setShowForm(false)
  }

  async function saveRecipe() {
    if (!nm.trim() || !storeId) return
    const payload = {
      store_id: storeId, name: nm.trim(), category: rc, icon: ic,
      ingredients: ingr.split('\n').filter(Boolean),
      steps: steps.split('\n').filter(Boolean),
      note, updated_at: new Date().toISOString()
    }
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
    if (highlight === id) setHighlight(null)
  }

  // ── 관리자 탭 함수들 ─────────────────────────
  async function deleteAdminRecipe(recipeId: string, sid: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('recipes').delete().eq('id', recipeId)
    setAllStores(prev => prev.map(s =>
      s.store.id === sid ? { ...s, recipes: s.recipes.filter((r: any) => r.id !== recipeId) } : s
    ))
  }

  function openAdminEdit(recipe: any, sid: string) {
    setAdminEdit({ recipe, storeId: sid })
    setANm(recipe.name); setARc(recipe.category); setAIc(recipe.icon)
    setAIngr(recipe.ingredients.join('\n'))
    setASteps(recipe.steps.join('\n'))
    setANote(recipe.note || '')
  }

  async function saveAdminEdit() {
    if (!adminEdit) return
    const payload = {
      name: aNm.trim(), category: aRc, icon: aIc,
      ingredients: aIngr.split('\n').filter(Boolean),
      steps: aSteps.split('\n').filter(Boolean),
      note: aNote, updated_at: new Date().toISOString()
    }
    const { data } = await supabase.from('recipes').update(payload).eq('id', adminEdit.recipe.id).select().single()
    if (data) {
      setAllStores(prev => prev.map(s =>
        s.store.id === adminEdit.storeId
          ? { ...s, recipes: s.recipes.map((r: any) => r.id === adminEdit.recipe.id ? data : r) }
          : s
      ))
    }
    setAdminEdit(null)
  }

  // 레시피 1개 복사
  async function confirmCopy() {
    if (!copyModal || !copyTarget) return
    const r = copyModal.recipe
    const payload = {
      store_id: copyTarget, name: r.name, category: r.category, icon: r.icon,
      ingredients: r.ingredients, steps: r.steps, note: r.note,
      updated_at: new Date().toISOString()
    }
    const { data } = await supabase.from('recipes').insert(payload).select().single()
    if (data) {
      setAllStores(prev => prev.map(s =>
        s.store.id === copyTarget ? { ...s, recipes: [...s.recipes, data] } : s
      ))
    }
    setCopyModal(null); setCopyTarget('')
    alert('복사 완료!')
  }

  // 전체 복사 - 대상 선택 후 중복 확인
  function startCopyAll() {
    if (!copyAllModal || !copyAllTarget) return
    const source = allStores.find(s => s.store.id === copyAllModal.sourceStoreId)
    const target = allStores.find(s => s.store.id === copyAllTarget)
    if (!source || !target) return
    const conflicts = source.recipes.filter((r: any) =>
      target.recipes.some((tr: any) => tr.name === r.name)
    )
    if (conflicts.length > 0) {
      setCopyAllConflicts(conflicts)
      const res: { [id: string]: 'skip' | 'overwrite' } = {}
      conflicts.forEach((r: any) => { res[r.id] = 'skip' })
      setConflictRes(res)
      setCopyAllStep('conflicts')
    } else {
      setCopyAllStep('noConflict')
    }
  }

  async function executeCopyAll() {
    if (!copyAllModal || !copyAllTarget) return
    const source = allStores.find(s => s.store.id === copyAllModal.sourceStoreId)
    const target = allStores.find(s => s.store.id === copyAllTarget)
    if (!source || !target) return

    const conflictNames = new Set(copyAllConflicts.map((r: any) => r.name))
    const toInsert: any[] = []
    const toUpdate: { id: string; [key: string]: any }[] = []

    source.recipes.forEach((r: any) => {
      const payload = {
        store_id: copyAllTarget, name: r.name, category: r.category, icon: r.icon,
        ingredients: r.ingredients, steps: r.steps, note: r.note,
        updated_at: new Date().toISOString()
      }
      if (conflictNames.has(r.name)) {
        if (conflictRes[r.id] === 'overwrite') {
          const existing = target.recipes.find((tr: any) => tr.name === r.name)
          if (existing) toUpdate.push({ ...payload, id: existing.id })
        }
      } else {
        toInsert.push(payload)
      }
    })

    if (toInsert.length > 0) await supabase.from('recipes').insert(toInsert)
    for (const { id, ...rest } of toUpdate) {
      await supabase.from('recipes').update(rest).eq('id', id)
    }

    const { data } = await supabase.from('recipes').select('*').eq('store_id', copyAllTarget).order('created_at')
    setAllStores(prev => prev.map(s =>
      s.store.id === copyAllTarget ? { ...s, recipes: data || [] } : s
    ))
    setCopyAllModal(null); setCopyAllTarget(''); setCopyAllConflicts([])
    setCopyAllStep('select'); setConflictRes({})
    alert('복사 완료!')
  }

  // 전 지점 공통 등록 - 중복 확인
  function checkCommonDup() {
    if (!cNm.trim()) return
    setDupCheck(allStores.map(s => ({
      storeId: s.store.id,
      storeName: s.store.name,
      hasDup: s.recipes.some((r: any) => r.name === cNm.trim())
    })))
    setCommonStep('check')
  }

  async function saveCommonRecipe() {
    const targets = dupCheck.filter(c => !c.hasDup)
    if (targets.length === 0) return
    const payloads = targets.map(t => ({
      store_id: t.storeId, name: cNm.trim(), category: cRc, icon: cIc,
      ingredients: cIngr.split('\n').filter(Boolean),
      steps: cSteps.split('\n').filter(Boolean),
      note: cNote, updated_at: new Date().toISOString()
    }))
    await supabase.from('recipes').insert(payloads)
    await loadAdminData()
    setShowCommonForm(false); setCommonStep('form')
    setCNm(''); setCRc('소스'); setCIc('🍳'); setCIngr(''); setCSteps(''); setCNote('')
    alert(`${targets.length}개 지점에 등록 완료!`)
  }

  // ── 렌더 헬퍼 ─────────────────────────────────
  const filtered = cat === '전체' ? recipes : recipes.filter(r => r.category === cat)
  const grouped: [string, any[]][] = []
  const seen = new Set<string>()
  filtered.forEach(r => {
    if (!seen.has(r.category)) {
      seen.add(r.category)
      grouped.push([r.category, filtered.filter(x => x.category === r.category)])
    }
  })

  const overlay = {
    position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(4px)', zIndex: 200,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
  }
  const mBox = {
    background: '#fff', borderRadius: 20, padding: 20,
    width: '100%', maxWidth: 420,
    maxHeight: '85vh', overflowY: 'auto' as const,
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
  }

  // ── JSX ───────────────────────────────────────
  return (
    <div>

      {/* ▶ 탭 전환 (대표자만 표시) */}
      {isOwner && (
        <div style={{ display: 'flex', marginBottom: 16, borderRadius: 12, overflow: 'hidden', border: '1px solid #E8ECF0' }}>
          {[{ key: 'mine', label: '📍 내 지점' }, { key: 'admin', label: '🏢 전체 관리' }].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as any)}
              style={{
                flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
                background: activeTab === t.key ? 'linear-gradient(135deg,#FF6B35,#E84393)' : '#F4F6F9',
                color: activeTab === t.key ? '#fff' : '#888',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════
          📍 내 지점 탭
      ══════════════════════════════════════════ */}
      {activeTab === 'mine' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>🍳 레시피</span>
            {isEdit && (
              <button onClick={() => { resetForm(); setShowForm(true) }}
                style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', color: '#FF6B35', fontSize: 11, cursor: 'pointer' }}>
                + 레시피 추가
              </button>
            )}
          </div>

          {/* 검색창 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input value={search}
              onChange={e => { setSearch(e.target.value); if (!e.target.value.trim()) setHighlight(null) }}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="🔍 레시피 이름 또는 재료 검색"
              style={{ ...inp, flex: 1 }} />
            <button onClick={doSearch}
              style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', color: '#FF6B35', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              찾기
            </button>
          </div>

          {/* 카테고리 필터 */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {CATS.map(c => (
              <button key={c} onClick={() => { setCat(c); setHighlight(null) }}
                style={{ padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
                  background: cat === c ? 'rgba(255,107,53,0.1)' : '#F4F6F9',
                  border: `1px solid ${cat === c ? 'rgba(255,107,53,0.3)' : '#E8ECF0'}`,
                  color: cat === c ? '#FF6B35' : '#888' }}>
                {c}
              </button>
            ))}
          </div>

          {/* 등록 / 수정 폼 */}
          {showForm && (
            <div style={{ ...bx, border: '1px solid rgba(255,107,53,0.3)', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>
                {editRec ? '레시피 수정' : '레시피 추가'}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input value={ic} onChange={e => setIc(e.target.value)} placeholder="이모지" style={{ ...inp, width: 48, flexShrink: 0 }} />
                <input value={nm} onChange={e => setNm(e.target.value)} placeholder="레시피 이름" style={inp} />
              </div>
              <select value={rc} onChange={e => setRc(e.target.value)} style={{ ...inp, marginBottom: 8, appearance: 'auto' }}>
                {CATS.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <textarea value={ingr} onChange={e => setIngr(e.target.value)} rows={4}
                placeholder={"재료 (한 줄에 하나씩)\n예: 토마토홀 6캔"}
                style={{ ...inp, resize: 'vertical', marginBottom: 8 }} />
              <textarea value={steps} onChange={e => setSteps(e.target.value)} rows={4}
                placeholder={"조리 단계 (한 줄에 하나씩)"}
                style={{ ...inp, resize: 'vertical', marginBottom: 8 }} />
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                placeholder="메모 (선택)" style={{ ...inp, resize: 'vertical', marginBottom: 10 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={saveRecipe}
                  style={{ flex: 1, padding: 10, borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  {editRec ? '수정' : '등록'}
                </button>
                <button onClick={resetForm}
                  style={{ padding: '10px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>
                  취소
                </button>
              </div>
            </div>
          )}

          {/* 레시피 목록 */}
          {grouped.map(([category, recs]) => (
            <div key={category} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#999', marginBottom: 8, textTransform: 'uppercase' }}>{category}</div>
              {recs.map(r => {
                const isHl = highlight === r.id
                return (
                  <div key={r.id} ref={el => { itemRefs.current[r.id] = el }}
                    style={{ ...bx, border: isHl ? '2px solid #FF6B35' : '1px solid #E8ECF0', background: isHl ? '#FFF8F5' : '#ffffff', transition: 'border-color 0.3s, background 0.3s' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                      onClick={() => setExpand(expand === r.id ? null : r.id)}>
                      <span style={{ fontSize: 22, flexShrink: 0 }}>{r.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                        <div style={{ fontSize: 10, color: '#999' }}>{r.ingredients.length}가지 재료 · {r.steps.length}단계</div>
                      </div>
                      {isEdit && (
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button onClick={e => { e.stopPropagation(); openEdit(r) }}
                            style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 12 }}>✏️</button>
                          <button onClick={e => { e.stopPropagation(); deleteRecipe(r.id) }}
                            style={{ background: 'none', border: 'none', color: '#bbb', cursor: 'pointer', fontSize: 11 }}>✕</button>
                        </div>
                      )}
                      <span style={{ fontSize: 12, color: '#bbb', flexShrink: 0 }}>{expand === r.id ? '▲' : '▼'}</span>
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
                            <span style={{ color: '#2DC6D6', fontWeight: 700 }}>{i + 1}. </span>{st}
                          </div>
                        ))}
                        {r.note && (
                          <div style={{ marginTop: 8, padding: 8, background: '#F8F9FB', borderRadius: 8, fontSize: 11, color: '#888' }}>
                            📝 {r.note}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </>
      )}

      {/* ══════════════════════════════════════════
          🏢 전체 관리 탭
      ══════════════════════════════════════════ */}
      {activeTab === 'admin' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>🏢 전체 레시피 관리</span>
            <button onClick={() => { setShowCommonForm(true); setCommonStep('form') }}
              style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', color: '#FF6B35', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              📌 전 지점 공통 등록
            </button>
          </div>

          {/* 지점별 현황 요약 */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {allStores.map(({ store, recipes: sr }) => (
              <div key={store.id}
                style={{ padding: '6px 12px', borderRadius: 20, background: '#F4F6F9', border: '1px solid #E8ECF0', fontSize: 11, color: '#555' }}>
                <span style={{ fontWeight: 700 }}>{store.name}</span>
                <span style={{ color: '#FF6B35', fontWeight: 700, marginLeft: 4 }}>{sr.length}</span>개
              </div>
            ))}
          </div>

          {adminLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#aaa', fontSize: 14 }}>불러오는 중...</div>
          ) : (
            allStores.map(({ store, recipes: sr }) => (
              <div key={store.id} style={{ ...bx, padding: 0, overflow: 'hidden' }}>

                {/* 지점 헤더 */}
                <div onClick={() => setExpandedStore(expandedStore === store.id ? null : store.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 16, cursor: 'pointer', background: expandedStore === store.id ? '#FFF8F5' : '#fff' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#FF6B35,#E84393)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {store.name?.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{store.name}</div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>레시피 {sr.length}개</div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setCopyAllModal({ sourceStoreId: store.id, sourceName: store.name }); setCopyAllStep('select'); setCopyAllTarget('') }}
                    style={{ padding: '5px 10px', borderRadius: 8, background: 'rgba(45,198,214,0.1)', border: '1px solid rgba(45,198,214,0.3)', color: '#2DC6D6', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    전체 복사
                  </button>
                  <span style={{ fontSize: 12, color: '#bbb', flexShrink: 0, marginLeft: 4 }}>{expandedStore === store.id ? '▲' : '▼'}</span>
                </div>

                {/* 지점 레시피 목록 */}
                {expandedStore === store.id && (
                  <div style={{ borderTop: '1px solid #F4F6F9', padding: '8px 16px 16px' }}>
                    {sr.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: '#bbb', fontSize: 12 }}>등록된 레시피가 없어요</div>
                    ) : (
                      sr.map((r: any) => (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: '1px solid #F8F9FB' }}>
                          <span style={{ fontSize: 18, flexShrink: 0 }}>{r.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                            <div style={{ fontSize: 10, color: '#bbb' }}>{r.category} · 재료 {r.ingredients.length}가지</div>
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <button onClick={() => { setCopyModal({ recipe: r, sourceStoreId: store.id }); setCopyTarget('') }}
                              style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(45,198,214,0.1)', border: '1px solid rgba(45,198,214,0.3)', color: '#2DC6D6', fontSize: 10, cursor: 'pointer' }}>
                              복사
                            </button>
                            <button onClick={() => openAdminEdit(r, store.id)}
                              style={{ padding: '4px 8px', borderRadius: 6, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 10, cursor: 'pointer' }}>
                              수정
                            </button>
                            <button onClick={() => deleteAdminRecipe(r.id, store.id)}
                              style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', color: '#FF5050', fontSize: 10, cursor: 'pointer' }}>
                              삭제
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}

      {/* ══════════════════════════════════════════
          모달: 레시피 1개 복사
      ══════════════════════════════════════════ */}
      {copyModal && (
        <div style={overlay} onClick={() => { setCopyModal(null); setCopyTarget('') }}>
          <div style={mBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>레시피 복사</div>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>
              "{copyModal.recipe.name}"을 어느 지점으로 복사할까요?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {allStores.filter(s => s.store.id !== copyModal.sourceStoreId).map(s => (
                <div key={s.store.id} onClick={() => setCopyTarget(s.store.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${copyTarget === s.store.id ? '#FF6B35' : '#E8ECF0'}`, background: copyTarget === s.store.id ? '#FFF8F5' : '#F8F9FB' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: copyTarget === s.store.id ? 'linear-gradient(135deg,#FF6B35,#E84393)' : '#E8ECF0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: copyTarget === s.store.id ? '#fff' : '#999', flexShrink: 0 }}>
                    {s.store.name?.charAt(0)}
                  </div>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: copyTarget === s.store.id ? '#FF6B35' : '#1a1a2e' }}>{s.store.name}</span>
                  {copyTarget === s.store.id && <span style={{ color: '#FF6B35' }}>✓</span>}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={confirmCopy} disabled={!copyTarget}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: copyTarget ? 'pointer' : 'default', background: copyTarget ? 'linear-gradient(135deg,#FF6B35,#E84393)' : '#E8ECF0', color: copyTarget ? '#fff' : '#bbb' }}>
                복사하기
              </button>
              <button onClick={() => { setCopyModal(null); setCopyTarget('') }}
                style={{ padding: '10px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          모달: 전체 복사
      ══════════════════════════════════════════ */}
      {copyAllModal && (
        <div style={overlay} onClick={() => { setCopyAllModal(null); setCopyAllStep('select') }}>
          <div style={mBox} onClick={e => e.stopPropagation()}>

            {/* 1단계: 대상 지점 선택 */}
            {copyAllStep === 'select' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>전체 복사</div>
                <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>
                  "{copyAllModal.sourceName}" 레시피 전체를 어느 지점으로 복사할까요?
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {allStores.filter(s => s.store.id !== copyAllModal.sourceStoreId).map(s => (
                    <div key={s.store.id} onClick={() => setCopyAllTarget(s.store.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${copyAllTarget === s.store.id ? '#FF6B35' : '#E8ECF0'}`, background: copyAllTarget === s.store.id ? '#FFF8F5' : '#F8F9FB' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: copyAllTarget === s.store.id ? 'linear-gradient(135deg,#FF6B35,#E84393)' : '#E8ECF0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: copyAllTarget === s.store.id ? '#fff' : '#999', flexShrink: 0 }}>
                        {s.store.name?.charAt(0)}
                      </div>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: copyAllTarget === s.store.id ? '#FF6B35' : '#1a1a2e' }}>{s.store.name}</span>
                      {copyAllTarget === s.store.id && <span style={{ color: '#FF6B35' }}>✓</span>}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={startCopyAll} disabled={!copyAllTarget}
                    style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: copyAllTarget ? 'pointer' : 'default', background: copyAllTarget ? 'linear-gradient(135deg,#FF6B35,#E84393)' : '#E8ECF0', color: copyAllTarget ? '#fff' : '#bbb' }}>
                    다음
                  </button>
                  <button onClick={() => { setCopyAllModal(null); setCopyAllStep('select') }}
                    style={{ padding: '10px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
                </div>
              </>
            )}

            {/* 2단계: 중복 없음 → 바로 확인 */}
            {copyAllStep === 'noConflict' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>복사 확인</div>
                <div style={{ padding: 14, borderRadius: 12, background: '#F0FFF4', border: '1px solid #BBF7D0', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: '#22C55E', fontWeight: 700, marginBottom: 4 }}>✅ 중복 없음</div>
                  <div style={{ fontSize: 12, color: '#555' }}>
                    {allStores.find(s => s.store.id === copyAllModal.sourceStoreId)?.recipes.length || 0}개 레시피를 모두 복사할게요.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={executeCopyAll}
                    style={{ flex: 1, padding: 10, borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    복사하기
                  </button>
                  <button onClick={() => { setCopyAllModal(null); setCopyAllStep('select') }}
                    style={{ padding: '10px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
                </div>
              </>
            )}

            {/* 3단계: 중복 항목 처리 */}
            {copyAllStep === 'conflicts' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>중복 레시피 처리</div>
                <div style={{ fontSize: 12, color: '#aaa', marginBottom: 12 }}>항목마다 건너뛸지 덮어쓸지 선택해주세요.</div>
                <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
                  {copyAllConflicts.map((r: any) => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #F4F6F9' }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{r.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {(['skip', 'overwrite'] as const).map(action => (
                          <button key={action} onClick={() => setConflictRes(p => ({ ...p, [r.id]: action }))}
                            style={{
                              padding: '4px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                              fontWeight: conflictRes[r.id] === action ? 700 : 400,
                              border: `1px solid ${conflictRes[r.id] === action ? (action === 'overwrite' ? '#FF6B35' : '#888') : '#E8ECF0'}`,
                              background: conflictRes[r.id] === action ? (action === 'overwrite' ? 'rgba(255,107,53,0.1)' : '#555') : '#F4F6F9',
                              color: conflictRes[r.id] === action ? (action === 'overwrite' ? '#FF6B35' : '#fff') : '#888',
                            }}>
                            {action === 'skip' ? '건너뛰기' : '덮어쓰기'}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={executeCopyAll}
                    style={{ flex: 1, padding: 10, borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    복사 실행
                  </button>
                  <button onClick={() => { setCopyAllModal(null); setCopyAllStep('select') }}
                    style={{ padding: '10px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          모달: 전 지점 공통 레시피 등록
      ══════════════════════════════════════════ */}
      {showCommonForm && (
        <div style={overlay} onClick={() => { setShowCommonForm(false); setCommonStep('form') }}>
          <div style={mBox} onClick={e => e.stopPropagation()}>

            {/* 1단계: 폼 작성 */}
            {commonStep === 'form' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>📌 전 지점 공통 레시피 등록</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input value={cIc} onChange={e => setCIc(e.target.value)} placeholder="이모지" style={{ ...inp, width: 48, flexShrink: 0 }} />
                  <input value={cNm} onChange={e => setCNm(e.target.value)} placeholder="레시피 이름" style={inp} />
                </div>
                <select value={cRc} onChange={e => setCRc(e.target.value)} style={{ ...inp, marginBottom: 8, appearance: 'auto' }}>
                  {CATS.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <textarea value={cIngr} onChange={e => setCIngr(e.target.value)} rows={3} placeholder={"재료 (한 줄에 하나씩)"} style={{ ...inp, resize: 'vertical', marginBottom: 8 }} />
                <textarea value={cSteps} onChange={e => setCSteps(e.target.value)} rows={3} placeholder={"조리 단계 (한 줄에 하나씩)"} style={{ ...inp, resize: 'vertical', marginBottom: 8 }} />
                <textarea value={cNote} onChange={e => setCNote(e.target.value)} rows={2} placeholder="메모 (선택)" style={{ ...inp, resize: 'vertical', marginBottom: 12 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={checkCommonDup} disabled={!cNm.trim()}
                    style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: cNm.trim() ? 'pointer' : 'default', background: cNm.trim() ? 'linear-gradient(135deg,#FF6B35,#E84393)' : '#E8ECF0', color: cNm.trim() ? '#fff' : '#bbb' }}>
                    중복 확인 →
                  </button>
                  <button onClick={() => { setShowCommonForm(false); setCommonStep('form') }}
                    style={{ padding: '10px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
                </div>
              </>
            )}

            {/* 2단계: 지점별 중복 확인 결과 */}
            {commonStep === 'check' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>지점별 중복 확인</div>
                <div style={{ fontSize: 12, color: '#aaa', marginBottom: 12 }}>중복이 없는 지점에만 등록돼요.</div>
                <div style={{ marginBottom: 12 }}>
                  {dupCheck.map(c => (
                    <div key={c.storeId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F4F6F9' }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, background: c.hasDup ? '#F4F6F9' : 'linear-gradient(135deg,#FF6B35,#E84393)', color: c.hasDup ? '#bbb' : '#fff' }}>
                        {c.storeName.charAt(0)}
                      </div>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: c.hasDup ? '#bbb' : '#1a1a2e' }}>{c.storeName}</span>
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 600, background: c.hasDup ? '#FFF0F0' : '#F0FFF4', color: c.hasDup ? '#FF5050' : '#22C55E' }}>
                        {c.hasDup ? '이미 있음' : '등록 예정'}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
                  총 <span style={{ color: '#FF6B35', fontWeight: 700 }}>{dupCheck.filter(c => !c.hasDup).length}개</span> 지점에 등록됩니다.
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveCommonRecipe} disabled={dupCheck.every(c => c.hasDup)}
                    style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: dupCheck.every(c => c.hasDup) ? 'default' : 'pointer', background: dupCheck.every(c => c.hasDup) ? '#E8ECF0' : 'linear-gradient(135deg,#FF6B35,#E84393)', color: dupCheck.every(c => c.hasDup) ? '#bbb' : '#fff' }}>
                    등록하기
                  </button>
                  <button onClick={() => setCommonStep('form')}
                    style={{ padding: '10px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>뒤로</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          모달: 관리자 탭 레시피 수정
      ══════════════════════════════════════════ */}
      {adminEdit && (
        <div style={overlay} onClick={() => setAdminEdit(null)}>
          <div style={mBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>레시피 수정</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input value={aIc} onChange={e => setAIc(e.target.value)} placeholder="이모지" style={{ ...inp, width: 48, flexShrink: 0 }} />
              <input value={aNm} onChange={e => setANm(e.target.value)} placeholder="레시피 이름" style={inp} />
            </div>
            <select value={aRc} onChange={e => setARc(e.target.value)} style={{ ...inp, marginBottom: 8, appearance: 'auto' }}>
              {CATS.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea value={aIngr} onChange={e => setAIngr(e.target.value)} rows={3} placeholder="재료 (한 줄에 하나씩)" style={{ ...inp, resize: 'vertical', marginBottom: 8 }} />
            <textarea value={aSteps} onChange={e => setASteps(e.target.value)} rows={3} placeholder="조리 단계 (한 줄에 하나씩)" style={{ ...inp, resize: 'vertical', marginBottom: 8 }} />
            <textarea value={aNote} onChange={e => setANote(e.target.value)} rows={2} placeholder="메모 (선택)" style={{ ...inp, resize: 'vertical', marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveAdminEdit}
                style={{ flex: 1, padding: 10, borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                수정 완료
              </button>
              <button onClick={() => setAdminEdit(null)}
                style={{ padding: '10px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}