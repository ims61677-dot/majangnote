'use client'
import { useEffect, useState, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

type Cat = { id: string; name: string; parent_id: string | null; order_index: number }

export default function RecipePage() {
  const supabase = createSupabaseBrowserClient()

  // ── 기본 ──────────────────────────────────────
  const [storeId, setStoreId]     = useState('')
  const [userId, setUserId]       = useState('')
  const [isOwner, setIsOwner]     = useState(false)
  const [isEdit, setIsEdit]       = useState(false)
  const [activeTab, setActiveTab] = useState<'mine' | 'admin'>('mine')
  const [isPC, setIsPC]           = useState(false)

  // ── 카테고리 ──────────────────────────────────
  const [cats, setCats]                 = useState<Cat[]>([])
  const [showCatMgr, setShowCatMgr]     = useState(false)
  const [newCatName, setNewCatName]     = useState('')
  const [newSubName, setNewSubName]     = useState('')
  const [newSubParent, setNewSubParent] = useState('')
  const [dragCatId, setDragCatId]       = useState<string | null>(null)
  const [dragOverCatId, setDragOverCatId] = useState<string | null>(null)

  // ── 내 지점 레시피 ────────────────────────────
  const [recipes, setRecipes]       = useState<any[]>([])
  const [filterCat, setFilterCat]   = useState('전체')
  const [expand, setExpand]         = useState<string | null>(null)
  const [highlight, setHighlight]   = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [showForm, setShowForm]     = useState(false)
  const [editRec, setEditRec]       = useState<any>(null)
  const [nm, setNm]                 = useState('')
  const [parentCat, setParentCat]   = useState('')
  const [subCat, setSubCat]         = useState('')
  const [ic, setIc]                 = useState('🍳')
  const [ingr, setIngr]             = useState('')
  const [steps, setSteps]           = useState('')
  const [note, setNote]             = useState('')
  const itemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  // ── 레시피 드래그 순서 ────────────────────────
  const [dragRecId, setDragRecId]     = useState<string | null>(null)
  const [dragOverRecId, setDragOverRecId] = useState<string | null>(null)

  // ── 관리자 탭 ─────────────────────────────────
  const [allStores, setAllStores]         = useState<any[]>([])
  const [adminLoading, setAdminLoading]   = useState(false)
  const [expandedStore, setExpandedStore] = useState<string | null>(null)

  // ── 모달: 관리자 신규 등록 ────────────────────
  const [adminAddModal, setAdminAddModal] = useState<{ storeId: string; storeName: string; cats: Cat[] } | null>(null)
  const [adNm, setAdNm]       = useState('')
  const [adParent, setAdParent] = useState('')
  const [adSub, setAdSub]     = useState('')
  const [adIc, setAdIc]       = useState('🍳')
  const [adIngr, setAdIngr]   = useState('')
  const [adSteps, setAdSteps] = useState('')
  const [adNote, setAdNote]   = useState('')

  // ── 모달: 관리자 수정 ─────────────────────────
  const [adminEdit, setAdminEdit] = useState<{ recipe: any; storeId: string } | null>(null)
  const [aNm, setANm]       = useState('')
  const [aParent, setAParent] = useState('')
  const [aSub, setASub]     = useState('')
  const [aIc, setAIc]       = useState('🍳')
  const [aIngr, setAIngr]   = useState('')
  const [aSteps, setASteps] = useState('')
  const [aNote, setANote]   = useState('')

  // ── 모달: 레시피 1개 복사 ─────────────────────
  const [copyModal, setCopyModal]   = useState<{ recipe: any; sourceStoreId: string } | null>(null)
  const [copyTarget, setCopyTarget] = useState('')

  // ── 모달: 지점 전체 복사 ─────────────────────
  const [copyAllModal, setCopyAllModal]         = useState<{ sourceStoreId: string; sourceName: string } | null>(null)
  const [copyAllTarget, setCopyAllTarget]       = useState('')
  const [copyAllStep, setCopyAllStep]           = useState<'select' | 'noConflict' | 'conflicts'>('select')
  const [copyAllConflicts, setCopyAllConflicts] = useState<any[]>([])
  const [conflictRes, setConflictRes]           = useState<{ [id: string]: 'skip' | 'overwrite' }>({})

  // ── 모달: 전 지점 공통 등록 ──────────────────
  const [showCommonForm, setShowCommonForm] = useState(false)
  const [commonStep, setCommonStep]         = useState<'form' | 'check'>('form')
  const [cNm, setCNm]     = useState('')
  const [cParent, setCParent] = useState('')
  const [cSub, setCSub]   = useState('')
  const [cIc, setCIc]     = useState('🍳')
  const [cIngr, setCIngr] = useState('')
  const [cSteps, setCSteps] = useState('')
  const [cNote, setCNote] = useState('')
  const [dupCheck, setDupCheck] = useState<{ storeId: string; storeName: string; hasDup: boolean }[]>([])

  // ── 초기 로드 ─────────────────────────────────
  useEffect(() => {
    function checkPC() { setIsPC(window.innerWidth >= 1024) }
    checkPC()
    window.addEventListener('resize', checkPC)
    return () => window.removeEventListener('resize', checkPC)
  }, [])

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user  = JSON.parse(localStorage.getItem('mj_user')  || '{}')
    if (!store.id) return
    setStoreId(store.id)
    setUserId(user.id || '')
    const owner = user.role === 'owner'
    setIsOwner(owner)
    setIsEdit(owner || user.role === 'manager')
    Promise.all([
      supabase.from('categories').select('*').eq('store_id', store.id).order('order_index'),
      supabase.from('recipes').select('*').eq('store_id', store.id).order('order_index'),
    ]).then(([{ data: catData }, { data: recData }]) => {
      setCats(catData || [])
      setRecipes(recData || [])
    })
  }, [])

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
        const [{ data: recData }, { data: catData }] = await Promise.all([
          supabase.from('recipes').select('*').eq('store_id', s.id).order('order_index'),
          supabase.from('categories').select('*').eq('store_id', s.id).order('order_index'),
        ])
        return { store: s, recipes: recData || [], cats: catData || [] }
      })
    )
    setAllStores(result)
    setAdminLoading(false)
  }

  // ── 카테고리 헬퍼 ─────────────────────────────
  const topCats = cats.filter(c => c.parent_id === null).sort((a, b) => a.order_index - b.order_index)
  const getChildren = (pid: string, catList?: Cat[]) =>
    (catList || cats).filter(c => c.parent_id === pid).sort((a, b) => a.order_index - b.order_index)

  async function addTopCat() {
    if (!newCatName.trim() || !storeId) return
    const maxOrd = topCats.length > 0 ? Math.max(...topCats.map(c => c.order_index)) + 1 : 0
    const { data } = await supabase.from('categories')
      .insert({ store_id: storeId, name: newCatName.trim(), parent_id: null, order_index: maxOrd })
      .select().single()
    if (data) setCats(p => [...p, data])
    setNewCatName('')
  }

  async function addSubCat(parentId: string) {
    if (!newSubName.trim() || !storeId) return
    const siblings = getChildren(parentId)
    const maxOrd   = siblings.length > 0 ? Math.max(...siblings.map(c => c.order_index)) + 1 : 0
    const { data } = await supabase.from('categories')
      .insert({ store_id: storeId, name: newSubName.trim(), parent_id: parentId, order_index: maxOrd })
      .select().single()
    if (data) setCats(p => [...p, data])
    setNewSubName(''); setNewSubParent('')
  }

  async function deleteCat(id: string) {
    const cat     = cats.find(c => c.id === id)
    const hasRec  = recipes.some(r => r.category === cat?.name || r.sub_category === cat?.name)
    const hasChild = cats.some(c => c.parent_id === id)
    const msg = (hasRec || hasChild)
      ? '이 카테고리에 연결된 레시피 또는 소분류가 있어요.\n삭제해도 레시피는 유지되지만 카테고리 정보는 초기화됩니다.\n계속하시겠습니까?'
      : '삭제하시겠습니까?'
    if (!confirm(msg)) return
    await supabase.from('categories').delete().eq('id', id)
    setCats(p => p.filter(c => c.id !== id && c.parent_id !== id))
  }

  async function handleDropTopCat(dragId: string, dropId: string) {
    if (dragId === dropId) return
    const sorted  = [...topCats]
    const fromIdx = sorted.findIndex(c => c.id === dragId)
    const toIdx   = sorted.findIndex(c => c.id === dropId)
    const [moved] = sorted.splice(fromIdx, 1)
    sorted.splice(toIdx, 0, moved)
    const updated = sorted.map((c, i) => ({ ...c, order_index: i }))
    setCats(prev => prev.map(c => updated.find(u => u.id === c.id) || c))
    await Promise.all(updated.map(c =>
      supabase.from('categories').update({ order_index: c.order_index }).eq('id', c.id)
    ))
  }

  // ── 레시피 순서 드래그 ────────────────────────
  async function handleDropRec(dragId: string, dropId: string, groupRecs: any[]) {
    if (dragId === dropId) return
    const sorted  = [...groupRecs]
    const fromIdx = sorted.findIndex(r => r.id === dragId)
    const toIdx   = sorted.findIndex(r => r.id === dropId)
    const [moved] = sorted.splice(fromIdx, 1)
    sorted.splice(toIdx, 0, moved)
    const updated = sorted.map((r, i) => ({ ...r, order_index: i }))
    setRecipes(prev => prev.map(r => updated.find(u => u.id === r.id) || r))
    await Promise.all(updated.map(r =>
      supabase.from('recipes').update({ order_index: r.order_index }).eq('id', r.id)
    ))
  }

  // ── 검색 ──────────────────────────────────────
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
      setFilterCat('전체'); setExpand(found.id); setHighlight(found.id)
      setTimeout(() => {
        itemRefs.current[found.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 150)
    } else {
      alert(`"${q}"에 해당하는 레시피가 없어요.`)
    }
  }

  // ── 내 지점 레시피 CRUD ───────────────────────
  function openEdit(r: any) {
    setEditRec(r); setNm(r.name); setParentCat(r.category || ''); setSubCat(r.sub_category || '')
    setIc(r.icon); setIngr(r.ingredients.join('\n')); setSteps(r.steps.join('\n')); setNote(r.note || '')
    setShowForm(true)
  }
  function resetForm() {
    setEditRec(null); setNm(''); setParentCat(''); setSubCat(''); setIc('🍳')
    setIngr(''); setSteps(''); setNote(''); setShowForm(false)
  }
  async function saveRecipe() {
    if (!nm.trim() || !storeId || !parentCat) return
    const allRecs = recipes.filter(r => r.category === parentCat && r.sub_category === (subCat || null))
    const maxOrd  = allRecs.length > 0 ? Math.max(...allRecs.map(r => r.order_index ?? 0)) + 1 : 0
    const payload = {
      store_id: storeId, name: nm.trim(), category: parentCat,
      sub_category: subCat || null, icon: ic,
      ingredients: ingr.split('\n').filter(Boolean),
      steps: steps.split('\n').filter(Boolean),
      note, order_index: editRec ? editRec.order_index : maxOrd,
      updated_at: new Date().toISOString(),
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

  // ── 그룹핑 ────────────────────────────────────
  type Group = { parentName: string; subs: { subName: string | null; recs: any[] }[] }
  function buildGroups(): Group[] {
    const parentNames = Array.from(new Set(recipes.map(r => r.category))).sort((a, b) => {
      const ai = topCats.findIndex(c => c.name === a)
      const bi = topCats.findIndex(c => c.name === b)
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi)
    })
    const filtered = filterCat === '전체' ? recipes : recipes.filter(r => r.category === filterCat)
    const fp = Array.from(new Set(filtered.map(r => r.category))).sort((a, b) => {
      const ai = topCats.findIndex(c => c.name === a)
      const bi = topCats.findIndex(c => c.name === b)
      return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi)
    })
    return fp.map(pName => {
      const pRecs   = filtered.filter(r => r.category === pName)
      const pCatObj = topCats.find(c => c.name === pName)
      const children = pCatObj ? getChildren(pCatObj.id) : []
      const subs: { subName: string | null; recs: any[] }[] = []
      if (children.length > 0) {
        const noSub = pRecs.filter(r => !r.sub_category).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        if (noSub.length > 0) subs.push({ subName: null, recs: noSub })
        children.forEach(ch => {
          const sr = pRecs.filter(r => r.sub_category === ch.name).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
          if (sr.length > 0) subs.push({ subName: ch.name, recs: sr })
        })
        const other = pRecs.filter(r => r.sub_category && !children.find(c => c.name === r.sub_category))
          .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        if (other.length > 0) subs.push({ subName: '기타', recs: other })
      } else {
        subs.push({ subName: null, recs: pRecs.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)) })
      }
      return { parentName: pName, subs }
    })
  }
  const groups = buildGroups()

  // ── 관리자 탭 CRUD ────────────────────────────
  async function deleteAdminRecipe(recipeId: string, sid: string) {
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('recipes').delete().eq('id', recipeId)
    setAllStores(prev => prev.map(s =>
      s.store.id === sid ? { ...s, recipes: s.recipes.filter((r: any) => r.id !== recipeId) } : s
    ))
  }
  function openAdminEdit(recipe: any, sid: string) {
    setAdminEdit({ recipe, storeId: sid })
    setANm(recipe.name); setAParent(recipe.category || ''); setASub(recipe.sub_category || '')
    setAIc(recipe.icon); setAIngr(recipe.ingredients.join('\n')); setASteps(recipe.steps.join('\n')); setANote(recipe.note || '')
  }
  async function saveAdminEdit() {
    if (!adminEdit) return
    const payload = {
      name: aNm.trim(), category: aParent, sub_category: aSub || null, icon: aIc,
      ingredients: aIngr.split('\n').filter(Boolean),
      steps: aSteps.split('\n').filter(Boolean),
      note: aNote, updated_at: new Date().toISOString(),
    }
    const { data } = await supabase.from('recipes').update(payload).eq('id', adminEdit.recipe.id).select().single()
    if (data) {
      setAllStores(prev => prev.map(s =>
        s.store.id === adminEdit.storeId
          ? { ...s, recipes: s.recipes.map((r: any) => r.id === adminEdit.recipe.id ? data : r) } : s
      ))
    }
    setAdminEdit(null)
  }

  // 관리자 신규 등록
  function openAdminAdd(sid: string, sName: string, sCats: Cat[]) {
    setAdminAddModal({ storeId: sid, storeName: sName, cats: sCats })
    setAdNm(''); setAdParent(''); setAdSub(''); setAdIc('🍳'); setAdIngr(''); setAdSteps(''); setAdNote('')
  }
  async function saveAdminAdd() {
    if (!adminAddModal || !adNm.trim() || !adParent) return
    const sid = adminAddModal.storeId
    const payload = {
      store_id: sid, name: adNm.trim(), category: adParent,
      sub_category: adSub || null, icon: adIc,
      ingredients: adIngr.split('\n').filter(Boolean),
      steps: adSteps.split('\n').filter(Boolean),
      note: adNote, order_index: 0, updated_at: new Date().toISOString(),
    }
    const { data } = await supabase.from('recipes').insert(payload).select().single()
    if (data) {
      setAllStores(prev => prev.map(s =>
        s.store.id === sid ? { ...s, recipes: [...s.recipes, data] } : s
      ))
    }
    setAdminAddModal(null)
  }

  // 복사
  async function confirmCopy() {
    if (!copyModal || !copyTarget) return
    const r = copyModal.recipe
    const { data } = await supabase.from('recipes').insert({
      store_id: copyTarget, name: r.name, category: r.category,
      sub_category: r.sub_category || null, icon: r.icon,
      ingredients: r.ingredients, steps: r.steps, note: r.note,
      order_index: 0, updated_at: new Date().toISOString(),
    }).select().single()
    if (data) setAllStores(prev => prev.map(s =>
      s.store.id === copyTarget ? { ...s, recipes: [...s.recipes, data] } : s
    ))
    setCopyModal(null); setCopyTarget(''); alert('복사 완료!')
  }

  function startCopyAll() {
    if (!copyAllModal || !copyAllTarget) return
    const source = allStores.find(s => s.store.id === copyAllModal.sourceStoreId)
    const target = allStores.find(s => s.store.id === copyAllTarget)
    if (!source || !target) return
    const conflicts = source.recipes.filter((r: any) => target.recipes.some((tr: any) => tr.name === r.name))
    if (conflicts.length > 0) {
      setCopyAllConflicts(conflicts)
      const res: { [id: string]: 'skip' | 'overwrite' } = {}
      conflicts.forEach((r: any) => { res[r.id] = 'skip' })
      setConflictRes(res); setCopyAllStep('conflicts')
    } else {
      setCopyAllStep('noConflict')
    }
  }

  async function executeCopyAll() {
    if (!copyAllModal || !copyAllTarget) return
    const source = allStores.find(s => s.store.id === copyAllModal.sourceStoreId)
    const target = allStores.find(s => s.store.id === copyAllTarget)
    if (!source || !target) return

    // 카테고리 복사
    const targetCatNames = new Set((target.cats || []).map((c: Cat) => c.name))
    const srcTopCats = (source.cats || []).filter((c: Cat) => c.parent_id === null)
    for (const tc of srcTopCats) {
      if (!targetCatNames.has(tc.name)) {
        const { data: newCat } = await supabase.from('categories')
          .insert({ store_id: copyAllTarget, name: tc.name, parent_id: null, order_index: tc.order_index })
          .select().single()
        if (newCat) {
          const children = (source.cats || []).filter((c: Cat) => c.parent_id === tc.id)
          for (const ch of children) {
            await supabase.from('categories').insert({
              store_id: copyAllTarget, name: ch.name, parent_id: newCat.id, order_index: ch.order_index
            })
          }
        }
      }
    }

    const conflictNames = new Set(copyAllConflicts.map((r: any) => r.name))
    const toInsert: any[] = []
    const toUpdate: { id: string; [k: string]: any }[] = []
    source.recipes.forEach((r: any) => {
      const payload = {
        store_id: copyAllTarget, name: r.name, category: r.category,
        sub_category: r.sub_category || null, icon: r.icon,
        ingredients: r.ingredients, steps: r.steps, note: r.note,
        order_index: r.order_index ?? 0, updated_at: new Date().toISOString(),
      }
      if (conflictNames.has(r.name)) {
        if (conflictRes[r.id] === 'overwrite') {
          const ex = target.recipes.find((tr: any) => tr.name === r.name)
          if (ex) toUpdate.push({ ...payload, id: ex.id })
        }
      } else {
        toInsert.push(payload)
      }
    })
    if (toInsert.length > 0) await supabase.from('recipes').insert(toInsert)
    for (const { id, ...rest } of toUpdate) await supabase.from('recipes').update(rest).eq('id', id)

    const [{ data: recData }, { data: catData }] = await Promise.all([
      supabase.from('recipes').select('*').eq('store_id', copyAllTarget).order('order_index'),
      supabase.from('categories').select('*').eq('store_id', copyAllTarget).order('order_index'),
    ])
    setAllStores(prev => prev.map(s =>
      s.store.id === copyAllTarget ? { ...s, recipes: recData || [], cats: catData || [] } : s
    ))
    setCopyAllModal(null); setCopyAllTarget(''); setCopyAllConflicts([])
    setCopyAllStep('select'); setConflictRes({})
    alert('복사 완료! 카테고리도 함께 복사됐어요 😊')
  }

  function checkCommonDup() {
    if (!cNm.trim()) return
    setDupCheck(allStores.map(s => ({
      storeId: s.store.id, storeName: s.store.name,
      hasDup: s.recipes.some((r: any) => r.name === cNm.trim()),
    })))
    setCommonStep('check')
  }
  async function saveCommonRecipe() {
    const targets = dupCheck.filter(c => !c.hasDup)
    if (targets.length === 0) return
    await supabase.from('recipes').insert(targets.map(t => ({
      store_id: t.storeId, name: cNm.trim(), category: cParent,
      sub_category: cSub || null, icon: cIc,
      ingredients: cIngr.split('\n').filter(Boolean),
      steps: cSteps.split('\n').filter(Boolean),
      note: cNote, order_index: 0, updated_at: new Date().toISOString(),
    })))
    await loadAdminData()
    setShowCommonForm(false); setCommonStep('form')
    setCNm(''); setCParent(''); setCSub(''); setCIc('🍳'); setCIngr(''); setCSteps(''); setCNote('')
    alert(`${targets.length}개 지점에 등록 완료!`)
  }

  // ── 공통 스타일 ───────────────────────────────
  const overlay = {
    position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)',
    backdropFilter: 'blur(4px)', zIndex: 200,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  }
  const mBox = {
    background: '#fff', borderRadius: 20, padding: 20,
    width: '100%', maxWidth: 440,
    maxHeight: '88vh', overflowY: 'auto' as const,
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  }

  // ── 카테고리 셀렉트 ───────────────────────────
  function CatSelects({ pVal, pSet, sVal, sSet, storeCats }: {
    pVal: string; pSet: (v: string) => void
    sVal: string; sSet: (v: string) => void
    storeCats?: Cat[]
  }) {
    const tc       = (storeCats || cats).filter(c => c.parent_id === null).sort((a, b) => a.order_index - b.order_index)
    const selected = tc.find(c => c.name === pVal)
    const children = selected ? (storeCats || cats).filter(c => c.parent_id === selected.id) : []
    return (
      <>
        <select value={pVal} onChange={e => { pSet(e.target.value); sSet('') }}
          style={{ ...inp, marginBottom: 8, appearance: 'auto' }}>
          <option value=''>대분류 선택</option>
          {tc.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        {children.length > 0 && (
          <select value={sVal} onChange={e => sSet(e.target.value)}
            style={{ ...inp, marginBottom: 8, appearance: 'auto' }}>
            <option value=''>소분류 선택 (선택사항)</option>
            {children.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        )}
      </>
    )
  }

  // ── 레시피 카드 (개선된 UI + 드래그) ─────────
  function RecipeCard({ r, groupRecs, onEdit, onDelete }: {
    r: any; groupRecs: any[]
    onEdit?: () => void; onDelete?: () => void
  }) {
    const isHl   = highlight === r.id
    const isDrag = dragRecId === r.id
    const isOver = dragOverRecId === r.id
    return (
      <div
        ref={el => { itemRefs.current[r.id] = el }}
        draggable={!!onEdit}
        onDragStart={() => { setDragRecId(r.id); setDragOverRecId(null) }}
        onDragOver={e => { e.preventDefault(); setDragOverRecId(r.id) }}
        onDrop={() => { if (dragRecId) handleDropRec(dragRecId, r.id, groupRecs); setDragRecId(null); setDragOverRecId(null) }}
        onDragEnd={() => { setDragRecId(null); setDragOverRecId(null) }}
        style={{
          background: isHl ? '#FFF8F5' : '#ffffff',
          borderRadius: 14,
          border: isHl ? '2px solid #FF6B35' : isOver ? '2px dashed #FF6B35' : '1px solid #E8ECF0',
          padding: '14px 16px',
          marginBottom: 8,
          boxShadow: isDrag ? '0 8px 24px rgba(0,0,0,0.12)' : '0 1px 4px rgba(0,0,0,0.04)',
          opacity: isDrag ? 0.5 : 1,
          transition: 'border 0.2s, background 0.2s',
          cursor: onEdit ? 'grab' : 'default',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
          onClick={() => setExpand(expand === r.id ? null : r.id)}>
          {/* 드래그 핸들 */}
          {onEdit && (
            <span style={{ color: '#ddd', fontSize: 14, flexShrink: 0, userSelect: 'none' }}>⠿</span>
          )}
          {/* 이모지 배경 */}
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(255,107,53,0.08), rgba(232,67,147,0.08))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>{r.icon}</div>
          {/* 텍스트 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.name}
            </div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
              재료 {r.ingredients.length}가지 · {r.steps.length}단계
            </div>
          </div>
          {/* 버튼 */}
          {(onEdit || onDelete) && (
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
              {onEdit   && <button onClick={onEdit}   style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 13, padding: '2px 4px' }}>✏️</button>}
              {onDelete && <button onClick={onDelete} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}>✕</button>}
            </div>
          )}
          <span style={{ fontSize: 11, color: '#ccc', flexShrink: 0 }}>{expand === r.id ? '▲' : '▼'}</span>
        </div>

        {/* 펼쳐지는 상세 */}
        {expand === r.id && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F4F6F9' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#FF6B35', marginBottom: 8 }}>재료</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
              {r.ingredients.map((ing: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: '#555', minWidth: 120 }}>• {ing}</div>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#2DC6D6', marginTop: 14, marginBottom: 8 }}>조리 단계</div>
            {r.steps.map((st: string, i: number) => (
              <div key={i} style={{ fontSize: 12, padding: '5px 0', color: '#555', borderBottom: '1px solid #F8F9FB', display: 'flex', gap: 8 }}>
                <span style={{ color: '#2DC6D6', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                <span>{st}</span>
              </div>
            ))}
            {r.note && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: '#FFFBF0', borderRadius: 8, fontSize: 11, color: '#888', border: '1px solid #FEF3C7' }}>
                📝 {r.note}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════
  return (
    <div>

      {/* 탭 전환 (대표자만) */}
      {isOwner && (
        <div style={{ display: 'flex', marginBottom: 16, borderRadius: 12, overflow: 'hidden', border: '1px solid #E8ECF0' }}>
          {[{ key: 'mine', label: '📍 내 지점' }, { key: 'admin', label: '🏢 전체 관리' }].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as any)}
              style={{ flex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: activeTab === t.key ? 'linear-gradient(135deg,#FF6B35,#E84393)' : '#F4F6F9',
                color: activeTab === t.key ? '#fff' : '#888' }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ══ 내 지점 탭 ══════════════════════════ */}
      {activeTab === 'mine' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>🍳 레시피</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {isEdit && (
                <button onClick={() => setShowCatMgr(true)}
                  style={{ padding: '6px 10px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 11, cursor: 'pointer' }}>
                  ⚙️ 카테고리
                </button>
              )}
              {isEdit && (
                <button onClick={() => { resetForm(); setShowForm(true) }}
                  style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', color: '#FF6B35', fontSize: 11, cursor: 'pointer' }}>
                  + 레시피 추가
                </button>
              )}
            </div>
          </div>

          {/* 검색 */}
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
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            <button onClick={() => { setFilterCat('전체'); setHighlight(null) }}
              style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                background: filterCat === '전체' ? 'rgba(255,107,53,0.1)' : '#F4F6F9',
                border: `1px solid ${filterCat === '전체' ? 'rgba(255,107,53,0.3)' : '#E8ECF0'}`,
                color: filterCat === '전체' ? '#FF6B35' : '#888', fontWeight: filterCat === '전체' ? 700 : 400 }}>전체</button>
            {topCats.map(c => (
              <button key={c.id} onClick={() => { setFilterCat(c.name); setHighlight(null) }}
                style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                  background: filterCat === c.name ? 'rgba(255,107,53,0.1)' : '#F4F6F9',
                  border: `1px solid ${filterCat === c.name ? 'rgba(255,107,53,0.3)' : '#E8ECF0'}`,
                  color: filterCat === c.name ? '#FF6B35' : '#888', fontWeight: filterCat === c.name ? 700 : 400 }}>
                {c.name}
              </button>
            ))}
          </div>

          {/* 등록/수정 폼 */}
          {showForm && (
            <div style={{ ...bx, border: '1px solid rgba(255,107,53,0.3)', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>
                {editRec ? '레시피 수정' : '레시피 추가'}
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input value={ic} onChange={e => setIc(e.target.value)} placeholder="이모지" style={{ ...inp, width: 48, flexShrink: 0 }} />
                <input value={nm} onChange={e => setNm(e.target.value)} placeholder="레시피 이름" style={inp} />
              </div>
              <CatSelects pVal={parentCat} pSet={setParentCat} sVal={subCat} sSet={setSubCat} />
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
                  style={{ padding: '10px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
              </div>
            </div>
          )}

          {/* 레시피 목록 */}
          {groups.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb', fontSize: 13 }}>등록된 레시피가 없어요</div>
          )}
          {groups.map(group => (
            <div key={group.parentName} style={{ marginBottom: 28 }}>
              {/* 대분류 헤더 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1, height: 1, background: '#F0F0F0' }} />
                <div style={{ fontSize: 13, fontWeight: 800, color: '#FF6B35', padding: '4px 14px', background: 'rgba(255,107,53,0.07)', borderRadius: 20, border: '1px solid rgba(255,107,53,0.15)', whiteSpace: 'nowrap' }}>
                  {group.parentName}
                </div>
                <div style={{ flex: 1, height: 1, background: '#F0F0F0' }} />
              </div>

              {group.subs.map(sub => (
                <div key={sub.subName || '_'} style={{ marginBottom: 12 }}>
                  {/* 소분류 헤더 */}
                  {sub.subName && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#2DC6D6', marginBottom: 8, marginLeft: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 3, height: 12, background: '#2DC6D6', borderRadius: 2 }} />
                      {sub.subName}
                      <span style={{ color: '#ddd', fontWeight: 400 }}>({sub.recs.length})</span>
                    </div>
                  )}
                  {/* PC: 2열 그리드 / 모바일: 1열 */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isPC ? 'repeat(2, 1fr)' : '1fr',
                    gap: 0,
                  }}>
                    {sub.recs.map(r => (
                      <RecipeCard key={r.id} r={r} groupRecs={sub.recs}
                        onEdit={isEdit ? () => openEdit(r) : undefined}
                        onDelete={isEdit ? () => deleteRecipe(r.id) : undefined} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      )}

      {/* ══ 전체 관리 탭 ═════════════════════════ */}
      {activeTab === 'admin' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>🏢 전체 레시피 관리</span>
            <button onClick={() => { setShowCommonForm(true); setCommonStep('form') }}
              style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', color: '#FF6B35', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              📌 전 지점 공통 등록
            </button>
          </div>

          {/* 현황 뱃지 */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {allStores.map(({ store, recipes: sr }) => (
              <div key={store.id} style={{ padding: '6px 12px', borderRadius: 20, background: '#F4F6F9', border: '1px solid #E8ECF0', fontSize: 11, color: '#555' }}>
                <span style={{ fontWeight: 700 }}>{store.name}</span>
                <span style={{ color: '#FF6B35', fontWeight: 700, marginLeft: 4 }}>{sr.length}</span>개
              </div>
            ))}
          </div>

          {adminLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#aaa', fontSize: 14 }}>불러오는 중...</div>
          ) : (
            allStores.map(({ store, recipes: sr, cats: sCats }) => (
              <div key={store.id} style={{ ...bx, padding: 0, overflow: 'hidden' }}>
                <div onClick={() => setExpandedStore(expandedStore === store.id ? null : store.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 16, cursor: 'pointer', background: expandedStore === store.id ? '#FFF8F5' : '#fff' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#FF6B35,#E84393)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                    {store.name?.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{store.name}</div>
                    <div style={{ fontSize: 11, color: '#aaa' }}>레시피 {sr.length}개</div>
                  </div>
                  {/* 신규 추가 버튼 */}
                  <button onClick={e => { e.stopPropagation(); openAdminAdd(store.id, store.name, sCats || []) }}
                    style={{ padding: '5px 10px', borderRadius: 8, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', color: '#FF6B35', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    + 추가
                  </button>
                  <button onClick={e => { e.stopPropagation(); setCopyAllModal({ sourceStoreId: store.id, sourceName: store.name }); setCopyAllStep('select'); setCopyAllTarget('') }}
                    style={{ padding: '5px 10px', borderRadius: 8, background: 'rgba(45,198,214,0.1)', border: '1px solid rgba(45,198,214,0.3)', color: '#2DC6D6', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    전체 복사
                  </button>
                  <span style={{ fontSize: 12, color: '#bbb', flexShrink: 0, marginLeft: 4 }}>{expandedStore === store.id ? '▲' : '▼'}</span>
                </div>

                {expandedStore === store.id && (
                  <div style={{ borderTop: '1px solid #F4F6F9', padding: '8px 16px 16px' }}>
                    {sr.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: '#bbb', fontSize: 12 }}>등록된 레시피가 없어요</div>
                    ) : (
                      sr.map((r: any) => (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid #F8F9FB' }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,107,53,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{r.icon}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                            <div style={{ fontSize: 10, color: '#bbb' }}>{r.category}{r.sub_category ? ` › ${r.sub_category}` : ''} · 재료 {r.ingredients.length}가지</div>
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <button onClick={() => { setCopyModal({ recipe: r, sourceStoreId: store.id }); setCopyTarget('') }}
                              style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(45,198,214,0.1)', border: '1px solid rgba(45,198,214,0.3)', color: '#2DC6D6', fontSize: 10, cursor: 'pointer' }}>복사</button>
                            <button onClick={() => openAdminEdit(r, store.id)}
                              style={{ padding: '4px 8px', borderRadius: 6, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 10, cursor: 'pointer' }}>수정</button>
                            <button onClick={() => deleteAdminRecipe(r.id, store.id)}
                              style={{ padding: '4px 8px', borderRadius: 6, background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', color: '#FF5050', fontSize: 10, cursor: 'pointer' }}>삭제</button>
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

      {/* ══ 모달: 카테고리 관리 ═══════════════════ */}
      {showCatMgr && (
        <div style={overlay} onClick={() => setShowCatMgr(false)}>
          <div style={{ ...mBox, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 2 }}>⚙️ 카테고리 관리</div>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 14 }}>⠿ 아이콘을 드래그해서 순서를 바꿀 수 있어요</div>
            {topCats.length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px 0', color: '#bbb', fontSize: 12 }}>카테고리가 없어요. 아래에서 추가해주세요.</div>
            )}
            {topCats.map(cat => (
              <div key={cat.id}
                draggable
                onDragStart={() => { setDragCatId(cat.id); setDragOverCatId(null) }}
                onDragOver={e => { e.preventDefault(); setDragOverCatId(cat.id) }}
                onDrop={() => { if (dragCatId) handleDropTopCat(dragCatId, cat.id); setDragCatId(null); setDragOverCatId(null) }}
                onDragEnd={() => { setDragCatId(null); setDragOverCatId(null) }}
                style={{ marginBottom: 8, opacity: dragCatId === cat.id ? 0.5 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10,
                  background: dragOverCatId === cat.id ? '#FFF0EB' : '#F8F9FB',
                  border: `1px solid ${dragOverCatId === cat.id ? '#FF6B35' : '#E8ECF0'}`,
                  transition: 'background 0.15s, border 0.15s' }}>
                  <span style={{ color: '#ccc', fontSize: 16, cursor: 'grab', userSelect: 'none' }}>⠿</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{cat.name}</span>
                  <span style={{ fontSize: 10, color: '#bbb' }}>{recipes.filter(r => r.category === cat.name).length}개</span>
                  <button onClick={() => { setNewSubParent(newSubParent === cat.id ? '' : cat.id); setNewSubName('') }}
                    style={{ padding: '3px 8px', borderRadius: 6, background: 'rgba(45,198,214,0.1)', border: '1px solid rgba(45,198,214,0.3)', color: '#2DC6D6', fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ 소분류</button>
                  <button onClick={() => deleteCat(cat.id)}
                    style={{ padding: '3px 7px', borderRadius: 6, background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', color: '#FF5050', fontSize: 10, cursor: 'pointer' }}>✕</button>
                </div>
                {getChildren(cat.id).map(child => (
                  <div key={child.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px 7px 32px', borderRadius: 8, background: '#fff', border: '1px solid #F4F6F9', marginTop: 4, marginLeft: 16 }}>
                    <span style={{ color: '#ddd', fontSize: 11, flexShrink: 0 }}>└</span>
                    <span style={{ flex: 1, fontSize: 12, color: '#555' }}>{child.name}</span>
                    <span style={{ fontSize: 10, color: '#bbb' }}>{recipes.filter(r => r.sub_category === child.name).length}개</span>
                    <button onClick={() => deleteCat(child.id)}
                      style={{ padding: '2px 6px', borderRadius: 6, background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', color: '#FF5050', fontSize: 10, cursor: 'pointer' }}>✕</button>
                  </div>
                ))}
                {newSubParent === cat.id && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, marginLeft: 16 }}>
                    <input value={newSubName} onChange={e => setNewSubName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addSubCat(cat.id)}
                      placeholder="소분류 이름 입력" style={{ ...inp, flex: 1, fontSize: 12 }} autoFocus />
                    <button onClick={() => addSubCat(cat.id)}
                      style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(45,198,214,0.1)', border: '1px solid rgba(45,198,214,0.3)', color: '#2DC6D6', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap' }}>추가</button>
                    <button onClick={() => setNewSubParent('')}
                      style={{ padding: '6px 8px', borderRadius: 6, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#aaa', fontSize: 11, cursor: 'pointer' }}>✕</button>
                  </div>
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 12 }}>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTopCat()}
                placeholder="새 대분류 이름 (예: 파스타, 피자...)" style={{ ...inp, flex: 1 }} />
              <button onClick={addTopCat}
                style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', color: '#FF6B35', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ 추가</button>
            </div>
            <button onClick={() => setShowCatMgr(false)}
              style={{ width: '100%', padding: 10, borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer', fontSize: 13 }}>닫기</button>
          </div>
        </div>
      )}

      {/* ══ 모달: 관리자 신규 등록 ══════════════ */}
      {adminAddModal && (
        <div style={overlay} onClick={() => setAdminAddModal(null)}>
          <div style={mBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>레시피 추가</div>
            <div style={{ fontSize: 11, color: '#FF6B35', marginBottom: 12, padding: '4px 10px', background: 'rgba(255,107,53,0.07)', borderRadius: 8, display: 'inline-block' }}>
              📍 {adminAddModal.storeName}
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input value={adIc} onChange={e => setAdIc(e.target.value)} placeholder="이모지" style={{ ...inp, width: 48, flexShrink: 0 }} />
              <input value={adNm} onChange={e => setAdNm(e.target.value)} placeholder="레시피 이름" style={inp} />
            </div>
            <CatSelects pVal={adParent} pSet={setAdParent} sVal={adSub} sSet={setAdSub} storeCats={adminAddModal.cats} />
            <textarea value={adIngr} onChange={e => setAdIngr(e.target.value)} rows={4}
              placeholder={"재료 (한 줄에 하나씩)\n예: 토마토홀 6캔"}
              style={{ ...inp, resize: 'vertical', marginBottom: 8 }} />
            <textarea value={adSteps} onChange={e => setAdSteps(e.target.value)} rows={4}
              placeholder={"조리 단계 (한 줄에 하나씩)"}
              style={{ ...inp, resize: 'vertical', marginBottom: 8 }} />
            <textarea value={adNote} onChange={e => setAdNote(e.target.value)} rows={2}
              placeholder="메모 (선택)" style={{ ...inp, resize: 'vertical', marginBottom: 10 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveAdminAdd}
                style={{ flex: 1, padding: 10, borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>등록</button>
              <button onClick={() => setAdminAddModal(null)}
                style={{ padding: '10px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ 모달: 레시피 1개 복사 ════════════════ */}
      {copyModal && (
        <div style={overlay} onClick={() => { setCopyModal(null); setCopyTarget('') }}>
          <div style={mBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>레시피 복사</div>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>"{copyModal.recipe.name}"을 어느 지점으로 복사할까요?</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {allStores.filter(s => s.store.id !== copyModal.sourceStoreId).map(s => (
                <div key={s.store.id} onClick={() => setCopyTarget(s.store.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                    border: `1px solid ${copyTarget === s.store.id ? '#FF6B35' : '#E8ECF0'}`,
                    background: copyTarget === s.store.id ? '#FFF8F5' : '#F8F9FB' }}>
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
                style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: copyTarget ? 'pointer' : 'default', background: copyTarget ? 'linear-gradient(135deg,#FF6B35,#E84393)' : '#E8ECF0', color: copyTarget ? '#fff' : '#bbb' }}>복사하기</button>
              <button onClick={() => { setCopyModal(null); setCopyTarget('') }}
                style={{ padding: '10px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ 모달: 전체 복사 ══════════════════════ */}
      {copyAllModal && (
        <div style={overlay} onClick={() => { setCopyAllModal(null); setCopyAllStep('select') }}>
          <div style={mBox} onClick={e => e.stopPropagation()}>
            {copyAllStep === 'select' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>전체 복사</div>
                <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>"{copyAllModal.sourceName}" 레시피+카테고리 전체를 어느 지점으로 복사할까요?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {allStores.filter(s => s.store.id !== copyAllModal.sourceStoreId).map(s => (
                    <div key={s.store.id} onClick={() => setCopyAllTarget(s.store.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                        border: `1px solid ${copyAllTarget === s.store.id ? '#FF6B35' : '#E8ECF0'}`,
                        background: copyAllTarget === s.store.id ? '#FFF8F5' : '#F8F9FB' }}>
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
                    style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: copyAllTarget ? 'pointer' : 'default', background: copyAllTarget ? 'linear-gradient(135deg,#FF6B35,#E84393)' : '#E8ECF0', color: copyAllTarget ? '#fff' : '#bbb' }}>다음</button>
                  <button onClick={() => { setCopyAllModal(null); setCopyAllStep('select') }}
                    style={{ padding: '10px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
                </div>
              </>
            )}
            {copyAllStep === 'noConflict' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>복사 확인</div>
                <div style={{ padding: 14, borderRadius: 12, background: '#F0FFF4', border: '1px solid #BBF7D0', marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: '#22C55E', fontWeight: 700, marginBottom: 4 }}>✅ 중복 없음</div>
                  <div style={{ fontSize: 12, color: '#555' }}>{allStores.find(s => s.store.id === copyAllModal.sourceStoreId)?.recipes.length || 0}개 레시피를 모두 복사할게요.</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={executeCopyAll}
                    style={{ flex: 1, padding: 10, borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>복사하기</button>
                  <button onClick={() => { setCopyAllModal(null); setCopyAllStep('select') }}
                    style={{ padding: '10px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
                </div>
              </>
            )}
            {copyAllStep === 'conflicts' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>중복 레시피 처리</div>
                <div style={{ fontSize: 12, color: '#aaa', marginBottom: 12 }}>항목마다 건너뛸지 덮어쓸지 선택해주세요.</div>
                <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 16 }}>
                  {copyAllConflicts.map((r: any) => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #F4F6F9' }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{r.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {(['skip', 'overwrite'] as const).map(action => (
                          <button key={action} onClick={() => setConflictRes(p => ({ ...p, [r.id]: action }))}
                            style={{ padding: '4px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer', fontWeight: conflictRes[r.id] === action ? 700 : 400,
                              border: `1px solid ${conflictRes[r.id] === action ? (action === 'overwrite' ? '#FF6B35' : '#888') : '#E8ECF0'}`,
                              background: conflictRes[r.id] === action ? (action === 'overwrite' ? 'rgba(255,107,53,0.1)' : '#555') : '#F4F6F9',
                              color: conflictRes[r.id] === action ? (action === 'overwrite' ? '#FF6B35' : '#fff') : '#888' }}>
                            {action === 'skip' ? '건너뛰기' : '덮어쓰기'}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={executeCopyAll}
                    style={{ flex: 1, padding: 10, borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>복사 실행</button>
                  <button onClick={() => { setCopyAllModal(null); setCopyAllStep('select') }}
                    style={{ padding: '10px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ 모달: 전 지점 공통 등록 ══════════════ */}
      {showCommonForm && (
        <div style={overlay} onClick={() => { setShowCommonForm(false); setCommonStep('form') }}>
          <div style={mBox} onClick={e => e.stopPropagation()}>
            {commonStep === 'form' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>📌 전 지점 공통 레시피 등록</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input value={cIc} onChange={e => setCIc(e.target.value)} placeholder="이모지" style={{ ...inp, width: 48, flexShrink: 0 }} />
                  <input value={cNm} onChange={e => setCNm(e.target.value)} placeholder="레시피 이름" style={inp} />
                </div>
                <input value={cParent} onChange={e => { setCParent(e.target.value); setCSub('') }} placeholder="대분류 이름 직접 입력" style={{ ...inp, marginBottom: 8 }} />
                <input value={cSub} onChange={e => setCSub(e.target.value)} placeholder="소분류 이름 (선택)" style={{ ...inp, marginBottom: 8 }} />
                <textarea value={cIngr} onChange={e => setCIngr(e.target.value)} rows={3} placeholder={"재료 (한 줄에 하나씩)"} style={{ ...inp, resize: 'vertical', marginBottom: 8 }} />
                <textarea value={cSteps} onChange={e => setCSteps(e.target.value)} rows={3} placeholder={"조리 단계 (한 줄에 하나씩)"} style={{ ...inp, resize: 'vertical', marginBottom: 8 }} />
                <textarea value={cNote} onChange={e => setCNote(e.target.value)} rows={2} placeholder="메모 (선택)" style={{ ...inp, resize: 'vertical', marginBottom: 12 }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={checkCommonDup} disabled={!cNm.trim() || !cParent.trim()}
                    style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700,
                      cursor: (cNm.trim() && cParent.trim()) ? 'pointer' : 'default',
                      background: (cNm.trim() && cParent.trim()) ? 'linear-gradient(135deg,#FF6B35,#E84393)' : '#E8ECF0',
                      color: (cNm.trim() && cParent.trim()) ? '#fff' : '#bbb' }}>중복 확인 →</button>
                  <button onClick={() => { setShowCommonForm(false); setCommonStep('form') }}
                    style={{ padding: '10px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
                </div>
              </>
            )}
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
                    style={{ flex: 1, padding: 10, borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700,
                      cursor: dupCheck.every(c => c.hasDup) ? 'default' : 'pointer',
                      background: dupCheck.every(c => c.hasDup) ? '#E8ECF0' : 'linear-gradient(135deg,#FF6B35,#E84393)',
                      color: dupCheck.every(c => c.hasDup) ? '#bbb' : '#fff' }}>등록하기</button>
                  <button onClick={() => setCommonStep('form')}
                    style={{ padding: '10px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>뒤로</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ 모달: 관리자 수정 ════════════════════ */}
      {adminEdit && (
        <div style={overlay} onClick={() => setAdminEdit(null)}>
          <div style={mBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>레시피 수정</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input value={aIc} onChange={e => setAIc(e.target.value)} placeholder="이모지" style={{ ...inp, width: 48, flexShrink: 0 }} />
              <input value={aNm} onChange={e => setANm(e.target.value)} placeholder="레시피 이름" style={inp} />
            </div>
            <input value={aParent} onChange={e => { setAParent(e.target.value); setASub('') }} placeholder="대분류" style={{ ...inp, marginBottom: 8 }} />
            <input value={aSub} onChange={e => setASub(e.target.value)} placeholder="소분류 (선택)" style={{ ...inp, marginBottom: 8 }} />
            <textarea value={aIngr} onChange={e => setAIngr(e.target.value)} rows={3} placeholder="재료 (한 줄에 하나씩)" style={{ ...inp, resize: 'vertical', marginBottom: 8 }} />
            <textarea value={aSteps} onChange={e => setASteps(e.target.value)} rows={3} placeholder="조리 단계 (한 줄에 하나씩)" style={{ ...inp, resize: 'vertical', marginBottom: 8 }} />
            <textarea value={aNote} onChange={e => setANote(e.target.value)} rows={2} placeholder="메모 (선택)" style={{ ...inp, resize: 'vertical', marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveAdminEdit}
                style={{ flex: 1, padding: 10, borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>수정 완료</button>
              <button onClick={() => setAdminEdit(null)}
                style={{ padding: '10px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}