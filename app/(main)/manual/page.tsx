'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
const overlay = {
  position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)',
  backdropFilter: 'blur(4px)', zIndex: 200,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
}
const mBox = {
  background: '#fff', borderRadius: 20, padding: 20,
  width: '100%', maxWidth: 460,
  maxHeight: '88vh', overflowY: 'auto' as const,
  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
}

type Cat = { id: string; store_id: string; name: string; order_index: number }
type Doc = {
  id: string; store_id: string; category_id: string | null
  title: string; content: string; image_urls: string[]
  visibility: 'all' | 'admin'; order_index: number
  created_by: string | null; updated_at: string
}

export default function ManualPage() {
  const supabase = createSupabaseBrowserClient()

  const [storeId, setStoreId] = useState('')
  const [myName, setMyName] = useState('')
  const [isOwner, setIsOwner] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const [cats, setCats] = useState<Cat[]>([])
  const [docs, setDocs] = useState<Doc[]>([])
  const [selectedCat, setSelectedCat] = useState<string>('전체')
  const [search, setSearch] = useState('')
  const [expandSet, setExpandSet] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  // 카테고리 관리
  const [showCatMgr, setShowCatMgr] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [catEditId, setCatEditId] = useState<string | null>(null)
  const [catEditName, setCatEditName] = useState('')

  // 문서 폼
  const [showDocForm, setShowDocForm] = useState(false)
  const [editDoc, setEditDoc] = useState<Doc | null>(null)
  const [fTitle, setFTitle] = useState('')
  const [fCategoryId, setFCategoryId] = useState('')
  const [fContent, setFContent] = useState('')
  const [fVisibility, setFVisibility] = useState<'all' | 'admin'>('all')
  const [fImages, setFImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) { setLoading(false); return }
    setStoreId(store.id)
    setMyName(user.nm || '')
    setIsOwner(user.role === 'owner')
    setIsAdmin(user.role === 'owner' || user.role === 'manager')
    loadAll(store.id)
  }, [])

  async function loadAll(sid: string) {
    setLoading(true)
    const [{ data: catData }, { data: docData }] = await Promise.all([
      supabase.from('manual_categories').select('*').eq('store_id', sid).order('order_index'),
      supabase.from('manual_documents').select('*').eq('store_id', sid).order('order_index'),
    ])
    setCats(catData || [])
    setDocs(docData || [])
    setLoading(false)
  }

  // ── 카테고리 CRUD ──────────────────────────────
  async function addCategory() {
    if (!newCatName.trim() || !storeId) return
    const maxOrd = cats.length > 0 ? Math.max(...cats.map(c => c.order_index)) + 1 : 0
    const { data } = await supabase.from('manual_categories')
      .insert({ store_id: storeId, name: newCatName.trim(), order_index: maxOrd })
      .select().single()
    if (data) setCats(p => [...p, data])
    setNewCatName('')
  }
  function startCatEdit(c: Cat) { setCatEditId(c.id); setCatEditName(c.name) }
  async function saveCatEdit() {
    if (!catEditId || !catEditName.trim()) return
    const { data } = await supabase.from('manual_categories')
      .update({ name: catEditName.trim() }).eq('id', catEditId).select().single()
    if (data) setCats(p => p.map(c => c.id === catEditId ? data : c))
    setCatEditId(null); setCatEditName('')
  }
  async function deleteCategory(id: string) {
    const inUse = docs.some(d => d.category_id === id)
    const msg = inUse
      ? '이 카테고리에 속한 문서가 있어요.\n삭제해도 문서는 남지만 "미분류"로 이동합니다.\n계속하시겠습니까?'
      : '삭제하시겠습니까?'
    if (!confirm(msg)) return
    await supabase.from('manual_categories').delete().eq('id', id)
    setCats(p => p.filter(c => c.id !== id))
    setDocs(p => p.map(d => d.category_id === id ? { ...d, category_id: null } : d))
  }
  async function moveCategory(id: string, dir: -1 | 1) {
    const sorted = [...cats].sort((a, b) => a.order_index - b.order_index)
    const idx = sorted.findIndex(c => c.id === id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const a = sorted[idx], b = sorted[swapIdx]
    const updated = [
      { ...a, order_index: b.order_index },
      { ...b, order_index: a.order_index },
    ]
    setCats(prev => prev.map(c => updated.find(u => u.id === c.id) || c))
    await Promise.all(updated.map(c => supabase.from('manual_categories').update({ order_index: c.order_index }).eq('id', c.id)))
  }

  // ── 문서 CRUD ──────────────────────────────────
  function openDocForm(doc?: Doc) {
    if (doc) {
      setEditDoc(doc); setFTitle(doc.title); setFCategoryId(doc.category_id || '')
      setFContent(doc.content); setFVisibility(doc.visibility); setFImages(doc.image_urls || [])
    } else {
      setEditDoc(null); setFTitle(''); setFCategoryId(selectedCat !== '전체' ? (cats.find(c => c.name === selectedCat)?.id || '') : '')
      setFContent(''); setFVisibility('all'); setFImages([])
    }
    setShowDocForm(true)
  }
  function closeDocForm() { setShowDocForm(false); setEditDoc(null) }

  async function uploadImage(file: File): Promise<string> {
    const ext = file.name.split('.').pop()
    const path = `manual/${storeId}/${Date.now()}.${ext}`
    const fileBuffer = await file.arrayBuffer()
    const { data, error } = await supabase.storage.from('notice-attachments').upload(path, fileBuffer, { upsert: true, contentType: file.type || 'image/jpeg' })
    if (error) throw error
    const { data: urlData } = supabase.storage.from('notice-attachments').getPublicUrl(data.path)
    return urlData.publicUrl
  }
  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploading(true)
    try {
      const urls = await Promise.all(files.map(f => uploadImage(f)))
      setFImages(p => [...p, ...urls])
    } catch (err: any) {
      alert('이미지 업로드 실패\n원인: ' + (err?.message || err))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }
  function removeImage(idx: number) { setFImages(p => p.filter((_, i) => i !== idx)) }

  async function saveDoc() {
    if (!fTitle.trim()) { alert('제목을 입력해주세요.'); return }
    if (!storeId) return
    const catDocs = docs.filter(d => d.category_id === (fCategoryId || null))
    const maxOrd = catDocs.length > 0 ? Math.max(...catDocs.map(d => d.order_index ?? 0)) + 1 : 0
    const payload = {
      store_id: storeId, category_id: fCategoryId || null,
      title: fTitle.trim(), content: fContent, image_urls: fImages,
      visibility: fVisibility, order_index: editDoc ? editDoc.order_index : maxOrd,
      created_by: editDoc ? editDoc.created_by : myName,
      updated_at: new Date().toISOString(),
    }
    if (editDoc) {
      const { data } = await supabase.from('manual_documents').update(payload).eq('id', editDoc.id).select().single()
      if (data) setDocs(p => p.map(d => d.id === editDoc.id ? data : d))
    } else {
      const { data } = await supabase.from('manual_documents').insert(payload).select().single()
      if (data) setDocs(p => [...p, data])
    }
    closeDocForm()
  }
  async function deleteDoc(id: string) {
    if (!confirm('이 문서를 삭제하시겠습니까?')) return
    await supabase.from('manual_documents').delete().eq('id', id)
    setDocs(p => p.filter(d => d.id !== id))
    setExpandSet(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  // ── 필터/그룹핑 ────────────────────────────────
  const visibleDocs = docs.filter(d => isAdmin || d.visibility === 'all')
  const q = search.trim()
  const searched = q
    ? visibleDocs.filter(d => d.title.includes(q) || d.content.includes(q))
    : visibleDocs
  const catFiltered = selectedCat === '전체'
    ? searched
    : searched.filter(d => (cats.find(c => c.id === d.category_id)?.name || '미분류') === selectedCat)

  type Group = { catName: string; catId: string | null; docs: Doc[] }
  function buildGroups(): Group[] {
    const sortedCats = [...cats].sort((a, b) => a.order_index - b.order_index)
    const groups: Group[] = []
    sortedCats.forEach(c => {
      const gd = catFiltered.filter(d => d.category_id === c.id).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
      if (gd.length > 0) groups.push({ catName: c.name, catId: c.id, docs: gd })
    })
    const uncategorized = catFiltered.filter(d => !d.category_id || !sortedCats.some(c => c.id === d.category_id))
      .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    if (uncategorized.length > 0) groups.push({ catName: '미분류', catId: null, docs: uncategorized })
    return groups
  }
  const groups = buildGroups()

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#aaa', fontSize: 14 }}>불러오는 중...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>📘 매뉴얼</span>
        {isOwner && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setShowCatMgr(true)}
              style={{ padding: '6px 10px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 11, cursor: 'pointer' }}>
              ⚙️ 카테고리
            </button>
            <button onClick={() => openDocForm()}
              style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', color: '#FF6B35', fontSize: 11, cursor: 'pointer' }}>
              + 문서 추가
            </button>
          </div>
        )}
      </div>

      {/* 검색 */}
      <div style={{ marginBottom: 14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 문서 제목 또는 내용 검색"
          style={inp} />
      </div>

      {/* 카테고리 필터 */}
      {cats.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={() => setSelectedCat('전체')}
            style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
              background: selectedCat === '전체' ? 'rgba(255,107,53,0.1)' : '#F4F6F9',
              border: `1px solid ${selectedCat === '전체' ? 'rgba(255,107,53,0.3)' : '#E8ECF0'}`,
              color: selectedCat === '전체' ? '#FF6B35' : '#888', fontWeight: selectedCat === '전체' ? 700 : 400 }}>전체</button>
          {[...cats].sort((a, b) => a.order_index - b.order_index).map(c => (
            <button key={c.id} onClick={() => setSelectedCat(c.name)}
              style={{ padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                background: selectedCat === c.name ? 'rgba(255,107,53,0.1)' : '#F4F6F9',
                border: `1px solid ${selectedCat === c.name ? 'rgba(255,107,53,0.3)' : '#E8ECF0'}`,
                color: selectedCat === c.name ? '#FF6B35' : '#888', fontWeight: selectedCat === c.name ? 700 : 400 }}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* 문서 없음 */}
      {docs.length === 0 && !isOwner && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb', fontSize: 13 }}>등록된 매뉴얼이 없어요</div>
      )}
      {docs.length === 0 && isOwner && (
        <div style={{ ...bx, textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📘</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>아직 등록된 매뉴얼이 없어요</div>
          <div style={{ fontSize: 12, color: '#999', lineHeight: 1.6, marginBottom: 14 }}>
            카테고리를 만들고 문서를 추가해보세요.<br />기존 노션 문서 링크를 채팅으로 주시면 내용을 옮겨드릴게요.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => setShowCatMgr(true)}
              style={{ padding: '8px 14px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 12, cursor: 'pointer' }}>
              카테고리 만들기
            </button>
            <button onClick={() => openDocForm()}
              style={{ padding: '8px 14px', borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              문서 추가
            </button>
          </div>
        </div>
      )}
      {docs.length > 0 && groups.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb', fontSize: 13 }}>검색 결과가 없어요</div>
      )}

      {/* 문서 목록 */}
      {groups.map(group => (
        <div key={group.catId || '_none'} style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1, height: 1, background: '#F0F0F0' }} />
            <div style={{ fontSize: 12, fontWeight: 800, color: '#FF6B35', padding: '4px 14px', background: 'rgba(255,107,53,0.07)', borderRadius: 20, border: '1px solid rgba(255,107,53,0.15)', whiteSpace: 'nowrap' }}>
              {group.catName}
            </div>
            <div style={{ flex: 1, height: 1, background: '#F0F0F0' }} />
          </div>

          {group.docs.map(d => {
            const isExp = expandSet.has(d.id)
            return (
              <div key={d.id} style={{ ...bx, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  onClick={() => setExpandSet(prev => { const s = new Set(prev); s.has(d.id) ? s.delete(d.id) : s.add(d.id); return s })}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</span>
                      {d.visibility === 'admin' && (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#E84393', background: 'rgba(232,67,147,0.1)', border: '1px solid rgba(232,67,147,0.25)', borderRadius: 10, padding: '1px 7px', flexShrink: 0 }}>🔒 관리자전용</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                      {d.image_urls?.length > 0 ? `이미지 ${d.image_urls.length}장 · ` : ''}
                      {new Date(d.updated_at).toLocaleDateString('ko-KR')} 수정
                    </div>
                  </div>
                  {isOwner && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => openDocForm(d)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 13, padding: '2px 4px' }}>✏️</button>
                      <button onClick={() => deleteDoc(d.id)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}>✕</button>
                    </div>
                  )}
                  <span style={{ fontSize: 11, color: '#ccc', flexShrink: 0 }}>{isExp ? '▲' : '▼'}</span>
                </div>

                {isExp && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F4F6F9' }}>
                    {d.content && (
                      <div style={{ fontSize: 13, color: '#444', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{d.content}</div>
                    )}
                    {d.image_urls?.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: d.content ? 14 : 0 }}>
                        {d.image_urls.map((url, i) => (
                          <img key={i} src={url} alt="" style={{ width: '100%', borderRadius: 10, border: '1px solid #E8ECF0', display: 'block' }} />
                        ))}
                      </div>
                    )}
                    {!d.content && (!d.image_urls || d.image_urls.length === 0) && (
                      <div style={{ fontSize: 12, color: '#ccc' }}>내용이 비어있어요</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}

      {/* 카테고리 관리 모달 */}
      {showCatMgr && (
        <div style={overlay} onClick={() => setShowCatMgr(false)}>
          <div style={mBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 14 }}>카테고리 관리</div>
            {cats.length === 0 && <div style={{ fontSize: 12, color: '#bbb', marginBottom: 12 }}>아직 카테고리가 없어요</div>}
            {[...cats].sort((a, b) => a.order_index - b.order_index).map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button onClick={() => moveCategory(c.id, -1)} disabled={i === 0}
                    style={{ background: 'none', border: 'none', color: i === 0 ? '#eee' : '#ccc', cursor: i === 0 ? 'default' : 'pointer', fontSize: 10, padding: 0, lineHeight: 1 }}>▲</button>
                  <button onClick={() => moveCategory(c.id, 1)} disabled={i === cats.length - 1}
                    style={{ background: 'none', border: 'none', color: i === cats.length - 1 ? '#eee' : '#ccc', cursor: i === cats.length - 1 ? 'default' : 'pointer', fontSize: 10, padding: 0, lineHeight: 1 }}>▼</button>
                </div>
                {catEditId === c.id ? (
                  <input value={catEditName} onChange={e => setCatEditName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveCatEdit()}
                    autoFocus style={{ ...inp, flex: 1 }} />
                ) : (
                  <div style={{ flex: 1, fontSize: 13, color: '#1a1a2e' }}>{c.name}</div>
                )}
                {catEditId === c.id ? (
                  <button onClick={saveCatEdit} style={{ background: 'none', border: 'none', color: '#FF6B35', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>저장</button>
                ) : (
                  <button onClick={() => startCatEdit(c)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 12 }}>✏️</button>
                )}
                <button onClick={() => deleteCategory(c.id)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 12 }}>✕</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCategory()}
                placeholder="새 카테고리 이름" style={{ ...inp, flex: 1 }} />
              <button onClick={addCategory}
                style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(255,107,53,0.1)', border: '1px solid rgba(255,107,53,0.3)', color: '#FF6B35', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>추가</button>
            </div>
            <button onClick={() => setShowCatMgr(false)}
              style={{ width: '100%', marginTop: 16, padding: 10, borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 13, cursor: 'pointer' }}>닫기</button>
          </div>
        </div>
      )}

      {/* 문서 작성/수정 모달 */}
      {showDocForm && (
        <div style={overlay} onClick={closeDocForm}>
          <div style={mBox} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 14 }}>{editDoc ? '문서 수정' : '문서 추가'}</div>

            <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="문서 제목"
              style={{ ...inp, marginBottom: 8, fontWeight: 700 }} />

            <select value={fCategoryId} onChange={e => setFCategoryId(e.target.value)}
              style={{ ...inp, marginBottom: 8, appearance: 'auto' }}>
              <option value="">카테고리 없음</option>
              {[...cats].sort((a, b) => a.order_index - b.order_index).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {[{ v: 'all', l: '전체공개' }, { v: 'admin', l: '🔒 관리자전용' }].map(opt => (
                <button key={opt.v} onClick={() => setFVisibility(opt.v as any)}
                  style={{ flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: fVisibility === opt.v ? 'rgba(255,107,53,0.1)' : '#F4F6F9',
                    border: `1px solid ${fVisibility === opt.v ? 'rgba(255,107,53,0.3)' : '#E8ECF0'}`,
                    color: fVisibility === opt.v ? '#FF6B35' : '#888' }}>
                  {opt.l}
                </button>
              ))}
            </div>

            <textarea value={fContent} onChange={e => setFContent(e.target.value)} rows={8}
              placeholder="내용을 입력하세요"
              style={{ ...inp, resize: 'vertical', marginBottom: 10, lineHeight: 1.6 }} />

            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6 }}>이미지 첨부</div>
            {fImages.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 8 }}>
                {fImages.map((url, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={url} alt="" style={{ width: '100%', height: 70, objectFit: 'cover', borderRadius: 8, border: '1px solid #E8ECF0', display: 'block' }} />
                    <button onClick={() => removeImage(i)}
                      style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, background: '#fff', border: '1px solid #E8ECF0', color: '#999', fontSize: 11, cursor: 'pointer', lineHeight: 1 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <label style={{ display: 'inline-block', padding: '7px 12px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 11, cursor: 'pointer', marginBottom: 14 }}>
              {uploading ? '업로드 중...' : '+ 이미지 선택'}
              <input type="file" accept="image/*" multiple onChange={handleImageSelect} disabled={uploading} style={{ display: 'none' }} />
            </label>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveDoc}
                style={{ flex: 1, padding: 10, borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {editDoc ? '수정' : '등록'}
              </button>
              <button onClick={closeDocForm}
                style={{ padding: '10px 16px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
