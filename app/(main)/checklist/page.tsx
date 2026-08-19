'use client'
import { useEffect, useState, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const REPEAT_LABEL: Record<string, string> = {
  none: '하루만', daily: '매일', weekly: '매주', monthly: '매달',
}
const DOW = ['일', '월', '화', '수', '목', '금', '토']

function pad(n: number) { return String(n).padStart(2, '0') }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function todayStr() { return toDateStr(new Date()) }

// 항목이 특정 날짜에 적용되는지 (반복주기 기반) — 오픈·마감 구조화 항목(항상 매일)과
// 기타 할일(하루만/매일/매주/매달) 모두 이 함수 하나로 판단합니다.
function appliesOnDate(item: any, dateStr: string) {
  if (item.origin_date > dateStr) return false
  if (!item.repeat_type || item.repeat_type === 'none') return item.origin_date === dateStr
  const od = new Date(item.origin_date + 'T00:00:00')
  const d = new Date(dateStr + 'T00:00:00')
  if (item.repeat_type === 'daily') return true
  if (item.repeat_type === 'weekly') return od.getDay() === d.getDay()
  if (item.repeat_type === 'monthly') return od.getDate() === d.getDate()
  return false
}

function daysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate() }

const PERIOD_LABEL: Record<string, string> = { open: '오픈', mid: '중간점검', close: '마감', etc: '기타' }
const PERIOD_EMOJI: Record<string, string> = { open: '🌅', mid: '☀️', close: '🌙', etc: '🗂' }
const AREA_CONFIG: Record<string, { label: string; emoji: string }> = {
  hall: { label: '홀', emoji: '🍽' },
  kitchen: { label: '주방', emoji: '👨‍🍳' },
  storage: { label: '창고', emoji: '📦' },
  admin: { label: '관리자 확인', emoji: '👑' },
  etc: { label: '기타 할일', emoji: '🗂' },
}
function defaultPeriod(): 'open' | 'mid' | 'close' {
  const h = new Date().getHours()
  if (h < 11) return 'open'
  if (h < 17) return 'mid'
  return 'close'
}

export default function ChecklistPage() {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState('')
  const [myName, setMyName] = useState('')
  const [role, setRole] = useState('')
  const isAdmin = role === 'owner' || role === 'manager'

  // ── 마감 전달사항 (어제 마감자가 남긴 다음날 할 일) ──
  const [closingTodos, setClosingTodos] = useState<any[]>([])
  const [closingChecks, setClosingChecks] = useState<Record<string, any[]>>({})
  const [closingDateLabel, setClosingDateLabel] = useState('')

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    setStoreId(store.id || ''); setMyName(user.nm || ''); setRole(user.role || '')
    if (store.id) loadClosingTodos(store.id)
  }, [])

  async function loadClosingTodos(sid: string) {
    const prev = new Date(); prev.setDate(prev.getDate() - 1)
    const prevStr = toDateStr(prev)
    setClosingDateLabel(prevStr.replace(/-/g, '.'))
    const { data: closing } = await supabase.from('closings').select('id').eq('store_id', sid).eq('closing_date', prevStr).maybeSingle()
    if (!closing) { setClosingTodos([]); setClosingChecks({}); return }
    const { data: todos } = await supabase.from('closing_next_todos').select('*').eq('closing_id', closing.id).order('created_at')
    setClosingTodos(todos || [])
    if (todos && todos.length > 0) {
      const { data: chks } = await supabase.from('closing_next_todo_checks').select('*').in('todo_id', todos.map((t: any) => t.id))
      const tm: Record<string, any[]> = {}
      ;(chks || []).forEach((c: any) => { if (!tm[c.todo_id]) tm[c.todo_id] = []; tm[c.todo_id].push(c) })
      setClosingChecks(tm)
    } else setClosingChecks({})
  }

  async function toggleClosingCheck(todoId: string) {
    const myCheck = (closingChecks[todoId] || []).find((c: any) => c.checked_by === myName)
    if (myCheck) {
      await supabase.from('closing_next_todo_checks').delete().eq('id', myCheck.id)
    } else {
      await supabase.from('closing_next_todo_checks').insert({ todo_id: todoId, checked_by: myName, checked_at: new Date().toISOString() })
    }
    loadClosingTodos(storeId)
  }

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, color: '#1a1a2e' }}>✅ 체크리스트</div>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>오픈·중간점검·마감 + 반복 할일을 한 화면에서 관리해요</div>

      {closingTodos.length > 0 && (
        <ClosingBanner closingTodos={closingTodos} closingChecks={closingChecks} closingDateLabel={closingDateLabel} onToggleClosing={toggleClosingCheck} />
      )}

      {storeId ? (
        <ChecklistMain storeId={storeId} myName={myName} isAdmin={isAdmin} supabase={supabase} />
      ) : (
        <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 13 }}>⏳ 불러오는 중...</div>
      )}
    </div>
  )
}

// ── 마감 전달사항 배너 ──
function ClosingBanner({ closingTodos, closingChecks, closingDateLabel, onToggleClosing }: {
  closingTodos: any[]; closingChecks: Record<string, any[]>; closingDateLabel: string; onToggleClosing: (todoId: string) => void
}) {
  return (
    <div style={{ borderRadius: 12, padding: '12px 14px', marginBottom: 14, border: '1px solid rgba(255,107,53,0.35)', background: 'rgba(255,107,53,0.03)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#FF6B35' }}>📢 마감 전달사항</span>
        <span style={{ fontSize: 10, color: '#bbb' }}>{closingDateLabel} 마감</span>
      </div>
      {closingTodos.map((todo: any) => {
        const checks = closingChecks[todo.id] || []
        const done = checks.length > 0
        return (
          <div key={todo.id} onClick={() => onToggleClosing(todo.id)} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,0.04)', cursor: 'pointer',
          }}>
            <span style={{ fontSize: 15, color: done ? '#00B894' : '#ddd', flexShrink: 0 }}>{done ? '✅' : '⬜'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: done ? '#888' : '#1a1a2e', textDecoration: done ? 'line-through' : 'none' }}>{todo.content}</div>
              {done && <div style={{ fontSize: 10, color: '#00B894', marginTop: 2 }}>{checks.map((c: any) => c.checked_by).join(', ')}님이 {new Date(checks[0].checked_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit' })}에 완료</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── 오픈·중간점검·마감 + 기타 할일 통합 체크리스트 ──
function ChecklistMain({ storeId, myName, isAdmin, supabase }: { storeId: string; myName: string; isAdmin: boolean; supabase: any }) {
  const [mode, setMode] = useState<'today' | 'stats'>('today')
  const [period, setPeriod] = useState<'open' | 'mid' | 'close'>(defaultPeriod())
  const [items, setItems] = useState<any[]>([])
  const [checks, setChecks] = useState<Record<string, any[]>>({})
  const [everChecked, setEverChecked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editMode, setEditMode] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [addingArea, setAddingArea] = useState<string | null>(null)
  const [newContent, setNewContent] = useState('')
  const [newRepeat, setNewRepeat] = useState('daily')
  const [newOriginDate, setNewOriginDate] = useState(todayStr())
  const [newCategory, setNewCategory] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editRepeat, setEditRepeat] = useState('daily')
  const [editOriginDate, setEditOriginDate] = useState(todayStr())
  const [editCategory, setEditCategory] = useState('')

  const today = todayStr()

  useEffect(() => { if (storeId) load() }, [storeId])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('checklist_items').select('*')
      .eq('store_id', storeId)
      .order('time_slot').order('area').order('sort_order')
    setItems(data || [])
    const ids = (data || []).map((i: any) => i.id)
    if (ids.length > 0) {
      const { data: chks } = await supabase.from('checklist_item_checks').select('*').in('item_id', ids).eq('work_date', today)
      const map: Record<string, any[]> = {}
      ;(chks || []).forEach((c: any) => { if (!map[c.item_id]) map[c.item_id] = []; map[c.item_id].push(c) })
      setChecks(map)
      const { data: everRows } = await supabase.from('checklist_item_checks').select('item_id').in('item_id', ids)
      setEverChecked(new Set((everRows || []).map((r: any) => r.item_id)))
    } else { setChecks({}); setEverChecked(new Set()) }
    setLoading(false)
  }

  async function toggle(item: any) {
    const mine = checks[item.id] || []
    if (mine.length > 0) {
      const target = mine.find((c: any) => c.checked_by === myName) || mine[0]
      await supabase.from('checklist_item_checks').delete().eq('id', target.id)
    } else {
      await supabase.from('checklist_item_checks').insert({ item_id: item.id, work_date: today, checked_by: myName })
    }
    load()
  }

  const activeItems = useMemo(() => items.filter(i => i.is_active !== false), [items])

  const periodItems = useMemo(
    () => activeItems.filter(i => i.time_slot === period && appliesOnDate(i, today)),
    [activeItems, period, today]
  )
  const etcItemsToday = useMemo(
    () => activeItems.filter(i => i.area === 'etc' && appliesOnDate(i, today)),
    [activeItems, today]
  )

  const areasForPeriod = period === 'close' && isAdmin ? ['hall', 'kitchen', 'storage', 'admin'] : ['hall', 'kitchen', 'storage']

  const structuredSections = areasForPeriod.map(area => {
    const list = periodItems.filter(i => i.area === area)
    const doneCount = list.filter(i => (checks[i.id] || []).length > 0).length
    return { area, list, doneCount, total: list.length }
  })
  const etcSection = {
    area: 'etc', list: etcItemsToday,
    doneCount: etcItemsToday.filter(i => (checks[i.id] || []).length > 0).length,
    total: etcItemsToday.length,
  }
  const sectionData = [etcSection, ...structuredSections].filter(s => s.total > 0 || isAdmin)

  const periodTotal = structuredSections.reduce((s, x) => s + x.total, 0)
  const periodDone = structuredSections.reduce((s, x) => s + x.doneCount, 0)

  // 편집 모드에서만 필요 — 비활성 항목까지 보여줄지 여부
  const visibleItemsFor = (area: string, todayList: any[]) => {
    if (!editMode || !showInactive) return todayList
    const inactive = items.filter(i => i.area === area && i.is_active === false && (area === 'etc' ? true : i.time_slot === period))
    return [...todayList, ...inactive]
  }

  function toggleExpand(area: string) {
    setExpanded(prev => {
      const next = new Set(prev); const key = `${period}-${area}`
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  async function addItem(area: string) {
    if (!newContent.trim()) return
    const isEtc = area === 'etc'
    const list = items.filter(i => i.area === area && (isEtc || i.time_slot === period))
    const maxOrder = list.reduce((m, i) => Math.max(m, i.sort_order || 0), 0)
    await supabase.from('checklist_items').insert({
      store_id: storeId,
      time_slot: isEtc ? 'etc' : period,
      area,
      content: newContent.trim(),
      sort_order: maxOrder + 1,
      repeat_type: isEtc ? newRepeat : 'daily',
      origin_date: isEtc ? newOriginDate : todayStr(),
      category: isEtc ? (newCategory.trim() || null) : null,
    })
    setNewContent(''); setNewCategory(''); setNewRepeat('daily'); setNewOriginDate(todayStr()); setAddingArea(null)
    load()
  }

  function startEdit(item: any) {
    setEditingId(item.id); setEditContent(item.content)
    setEditRepeat(item.repeat_type || 'daily'); setEditOriginDate(item.origin_date || todayStr()); setEditCategory(item.category || '')
  }

  async function saveEdit(item: any) {
    const patch: any = { content: editContent.trim() }
    if (item.area === 'etc') { patch.repeat_type = editRepeat; patch.origin_date = editOriginDate; patch.category = editCategory.trim() || null }
    await supabase.from('checklist_items').update(patch).eq('id', item.id)
    setEditingId(null); load()
  }

  async function deactivate(id: string) {
    if (!confirm('이 항목을 목록에서 뺄까요? (기록은 남아있고, "꺼진 항목 보기"에서 복원할 수 있어요)')) return
    await supabase.from('checklist_items').update({ is_active: false }).eq('id', id)
    load()
  }
  async function restore(id: string) {
    await supabase.from('checklist_items').update({ is_active: true }).eq('id', id)
    load()
  }
  async function hardDelete(id: string) {
    if (!confirm('이 항목을 완전히 삭제할까요? 되돌릴 수 없어요. (체크 기록이 없는 항목만 삭제할 수 있어요)')) return
    const { error } = await supabase.from('checklist_items').delete().eq('id', id)
    if (error) { alert('삭제하지 못했어요. 체크 기록이 있는 항목은 "끄기"만 가능해요.'); return }
    load()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 13 }}>⏳ 불러오는 중...</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <button onClick={() => setMode('today')} style={{
          padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
          background: mode === 'today' ? '#1a1a2e' : '#F4F6F9', color: mode === 'today' ? '#fff' : '#888',
        }}>✅ 오늘 체크</button>
        <button onClick={() => setMode('stats')} style={{
          padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
          background: mode === 'stats' ? '#1a1a2e' : '#F4F6F9', color: mode === 'stats' ? '#fff' : '#888',
        }}>📊 월별 통계</button>
      </div>

      {mode === 'stats' ? (
        <OpsStatsSection items={activeItems} storeId={storeId} supabase={supabase} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {(['open', 'mid', 'close'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: period === p ? 'linear-gradient(135deg,#FF6B35,#E84393)' : '#F4F6F9',
                color: period === p ? '#fff' : '#888',
              }}>{PERIOD_EMOJI[p]} {PERIOD_LABEL[p]}</button>
            ))}
          </div>

          <div style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>{PERIOD_LABEL[period]} 체크리스트</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: periodTotal > 0 && periodDone === periodTotal ? '#00B894' : '#888' }}>{periodDone} / {periodTotal}</span>
            </div>
            <div style={{ height: 7, borderRadius: 4, background: '#F0F2F5', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: periodTotal > 0 ? `${Math.round(periodDone / periodTotal * 100)}%` : '0%', background: periodTotal > 0 && periodDone === periodTotal ? '#00B894' : 'linear-gradient(90deg,#FF6B35,#E84393)' }} />
            </div>
          </div>

          {isAdmin && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              <button onClick={() => setEditMode(v => !v)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E8ECF0', background: editMode ? 'rgba(108,92,231,0.08)' : '#fff', color: editMode ? '#6C5CE7' : '#888', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {editMode ? '✓ 편집 완료' : '✏️ 항목 관리'}
              </button>
              {editMode && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#888', cursor: 'pointer' }}>
                  <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
                  꺼진 항목 보기
                </label>
              )}
            </div>
          )}

          {sectionData.length === 0 && !isAdmin && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb', fontSize: 13 }}>등록된 체크리스트 항목이 없어요</div>
          )}

          {sectionData.map(({ area, list, doneCount, total }) => {
            const cfg = AREA_CONFIG[area]
            const key = `${period}-${area}`
            const isOpen = expanded.has(key)
            const displayList = visibleItemsFor(area, list)
            const isEtc = area === 'etc'
            return (
              <div key={area} style={{ marginBottom: 10 }}>
                <button onClick={() => toggleExpand(area)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', borderRadius: 12, border: '1px solid #E8ECF0',
                  background: total > 0 && doneCount === total ? 'rgba(0,184,148,0.06)' : '#fff', cursor: 'pointer',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{cfg.emoji} {cfg.label}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: total > 0 && doneCount === total ? '#00B894' : '#888' }}>{doneCount}/{total}</span>
                    <span style={{ fontSize: 11, color: '#bbb' }}>{isOpen ? '▲' : '▼'}</span>
                  </span>
                </button>
                {isOpen && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {displayList.map(item => {
                      const doneToday = checks[item.id] || []
                      const isDone = doneToday.length > 0
                      const isInactive = item.is_active === false
                      return (
                        <div key={item.id} style={{
                          background: isInactive ? '#F8F9FB' : '#fff',
                          border: isInactive ? '1px dashed #ddd' : isDone ? '1px solid rgba(0,184,148,0.25)' : '1px solid #E8ECF0',
                          borderRadius: 10, padding: '10px 12px', opacity: isInactive ? 0.7 : 1,
                        }}>
                          {editingId === item.id ? (
                            <div>
                              <input value={editContent} onChange={e => setEditContent(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #E0E4E8', fontSize: 13, marginBottom: 6, boxSizing: 'border-box' }} />
                              {isEtc && (
                                <>
                                  <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                                    {(['none', 'daily', 'weekly', 'monthly'] as const).map(rt => (
                                      <button key={rt} onClick={() => setEditRepeat(rt)} style={{
                                        padding: '6px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                        border: editRepeat === rt ? '1.5px solid #6C5CE7' : '1px solid #E8ECF0',
                                        background: editRepeat === rt ? 'rgba(108,92,231,0.08)' : '#fff',
                                        color: editRepeat === rt ? '#6C5CE7' : '#888',
                                      }}>{REPEAT_LABEL[rt]}</button>
                                    ))}
                                  </div>
                                  <input type="date" value={editOriginDate} onChange={e => setEditOriginDate(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #E0E4E8', fontSize: 13, marginBottom: 6, boxSizing: 'border-box' }} />
                                  <input value={editCategory} onChange={e => setEditCategory(e.target.value)} placeholder="카테고리 (선택)" style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #E0E4E8', fontSize: 13, marginBottom: 6, boxSizing: 'border-box' }} />
                                </>
                              )}
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => saveEdit(item)} style={{ flex: 1, padding: 8, borderRadius: 7, border: 'none', background: '#6C5CE7', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>저장</button>
                                <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: 8, borderRadius: 7, border: '1px solid #E8ECF0', background: '#fff', color: '#888', fontSize: 12, cursor: 'pointer' }}>취소</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {!isInactive && <span onClick={() => toggle(item)} style={{ fontSize: 19, color: isDone ? '#00B894' : '#ddd', cursor: 'pointer', flexShrink: 0 }}>{isDone ? '✅' : '⬜'}</span>}
                              <div onClick={() => !editMode && !isInactive && toggle(item)} style={{ flex: 1, minWidth: 0, cursor: editMode || isInactive ? 'default' : 'pointer' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: isDone ? '#888' : '#1a1a2e', textDecoration: isDone ? 'line-through' : 'none' }}>{item.content}</div>
                                <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                                  {isInactive && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(232,67,147,0.1)', color: '#E84393', fontWeight: 700 }}>꺼짐</span>}
                                  {isEtc && item.repeat_type && item.repeat_type !== 'daily' && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(108,92,231,0.1)', color: '#6C5CE7' }}>{REPEAT_LABEL[item.repeat_type]}</span>}
                                  {isEtc && item.category && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#F4F6F9', color: '#888' }}>{item.category}</span>}
                                  {isDone && !isInactive && <span style={{ fontSize: 10, color: '#00B894' }}>{doneToday.map((c: any) => c.checked_by).join(', ')}님이 {new Date(doneToday[0].checked_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit' })}에 완료</span>}
                                </div>
                              </div>
                              {editMode && (
                                <div style={{ display: 'flex', gap: 4, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                  {isInactive ? (
                                    <button onClick={() => restore(item.id)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(0,184,148,0.3)', background: 'rgba(0,184,148,0.06)', color: '#00B894', fontSize: 11, cursor: 'pointer' }}>복원</button>
                                  ) : (
                                    <button onClick={() => startEdit(item)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #E8ECF0', background: '#fff', color: '#888', fontSize: 11, cursor: 'pointer' }}>수정</button>
                                  )}
                                  {!isInactive && <button onClick={() => deactivate(item.id)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(232,67,147,0.3)', background: 'rgba(232,67,147,0.06)', color: '#E84393', fontSize: 11, cursor: 'pointer' }}>끄기</button>}
                                  {!everChecked.has(item.id) && (
                                    <button onClick={() => hardDelete(item.id)} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid rgba(232,67,147,0.3)', background: '#fff', color: '#E84393', fontSize: 11, cursor: 'pointer' }}>삭제</button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {editMode && (
                      addingArea === area ? (
                        <div style={{ background: '#F8F9FB', borderRadius: 10, padding: 10, border: '1px dashed #C8CCD4' }}>
                          <input value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="새 항목 입력"
                            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E0E4E8', fontSize: 13, marginBottom: isEtc ? 8 : 0, boxSizing: 'border-box' }} />
                          {isEtc && (
                            <>
                              <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>반복주기</div>
                              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                                {(['none', 'daily', 'weekly', 'monthly'] as const).map(rt => (
                                  <button key={rt} onClick={() => setNewRepeat(rt)} style={{
                                    padding: '6px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                    border: newRepeat === rt ? '1.5px solid #6C5CE7' : '1px solid #E8ECF0',
                                    background: newRepeat === rt ? 'rgba(108,92,231,0.08)' : '#fff',
                                    color: newRepeat === rt ? '#6C5CE7' : '#888',
                                  }}>{REPEAT_LABEL[rt]}</button>
                                ))}
                              </div>
                              <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>{newRepeat === 'none' ? '날짜' : '시작일'}</div>
                              <input type="date" value={newOriginDate} onChange={e => setNewOriginDate(e.target.value)}
                                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E0E4E8', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }} />
                              <input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="카테고리 (선택, 예: 위생)"
                                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E0E4E8', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }} />
                            </>
                          )}
                          <div style={{ display: 'flex', gap: 6, marginTop: isEtc ? 0 : 8 }}>
                            <button onClick={() => addItem(area)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: '#6C5CE7', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>추가</button>
                            <button onClick={() => { setAddingArea(null); setNewContent(''); setNewCategory(''); setNewRepeat('daily'); setNewOriginDate(todayStr()) }} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #E8ECF0', background: '#fff', color: '#888', fontSize: 12, cursor: 'pointer' }}>취소</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => setAddingArea(area)} style={{ padding: '9px 0', borderRadius: 8, border: '1px dashed #C8CCD4', background: '#F8F9FB', color: '#888', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ 항목 추가</button>
                      )
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

// ── 월별 통계 (전체 공개 — 직원도 볼 수 있어요) ──
function OpsStatsSection({ items, storeId, supabase }: { items: any[]; storeId: string; supabase: any }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [checksByDate, setChecksByDate] = useState<Record<string, Set<string>>>({})
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const monthStart = `${year}-${pad(month)}-01`
  const dim = daysInMonth(year, month)
  const monthEnd = `${year}-${pad(month)}-${pad(dim)}`
  const today = todayStr()
  const effectiveEnd = monthEnd < today ? monthEnd : today

  useEffect(() => { if (storeId && items.length > 0) load() }, [storeId, items.length, year, month])

  async function load() {
    setLoading(true)
    setSelectedDate(null)
    const ids = items.map(i => i.id)
    const { data } = await supabase.from('checklist_item_checks').select('item_id, work_date')
      .in('item_id', ids).gte('work_date', monthStart).lte('work_date', monthEnd)
    const map: Record<string, Set<string>> = {}
    ;(data || []).forEach((c: any) => { if (!map[c.work_date]) map[c.work_date] = new Set(); map[c.work_date].add(c.item_id) })
    setChecksByDate(map)
    setLoading(false)
  }

  function dayStats(dateStr: string) {
    const doneSet = checksByDate[dateStr] || new Set<string>()
    const applicable = items.filter(i => appliesOnDate(i, dateStr))
    const doneCount = applicable.filter(i => doneSet.has(i.id)).length
    const total = applicable.length
    const pct = total > 0 ? Math.round(doneCount / total * 100) : 100
    const buckets: Record<string, { done: number; total: number }> = {}
    ;(['open', 'mid', 'close', 'etc'] as const).forEach(p => {
      const list = applicable.filter(i => i.time_slot === p)
      buckets[p] = { done: list.filter(i => doneSet.has(i.id)).length, total: list.length }
    })
    return { doneCount, total, pct, buckets, doneSet, applicable }
  }

  let sumPct = 0, countedDays = 0, fullDays = 0, zeroDays = 0
  if (effectiveEnd >= monthStart) {
    for (let d = new Date(monthStart + 'T00:00:00'); toDateStr(d) <= effectiveEnd; d.setDate(d.getDate() + 1)) {
      const { pct, total } = dayStats(toDateStr(d))
      if (total === 0) continue
      sumPct += pct; countedDays++
      if (pct === 100) fullDays++
      if (pct === 0) zeroDays++
    }
  }
  const avgPct = countedDays > 0 ? Math.round(sumPct / countedDays) : 0

  const firstDow = new Date(monthStart + 'T00:00:00').getDay()
  const cells: (string | null)[] = Array(firstDow).fill(null)
  for (let day = 1; day <= dim; day++) cells.push(`${year}-${pad(month)}-${pad(day)}`)

  function cellColor(pct: number) {
    if (pct === 100) return '#00B894'
    if (pct >= 50) return '#FDC400'
    if (pct > 0) return '#FF6B35'
    return '#E84393'
  }

  const sel = selectedDate ? dayStats(selectedDate) : null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <button onClick={() => { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #E8ECF0', background: '#fff', cursor: 'pointer' }}>◀</button>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{year}년 {month}월</span>
        <button onClick={() => { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #E8ECF0', background: '#fff', cursor: 'pointer' }}>▶</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: avgPct >= 90 ? '#00B894' : avgPct >= 60 ? '#FDC400' : '#E84393' }}>{avgPct}%</div>
          <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>평균 완료율</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#00B894' }}>{fullDays}일</div>
          <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>100% 완료일</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: zeroDays > 0 ? '#E84393' : '#888' }}>{zeroDays}일</div>
          <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>미실행일</div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 30, color: '#bbb', fontSize: 12 }}>⏳ 불러오는 중...</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 16 }}>
            {DOW.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, color: '#aaa', fontWeight: 700 }}>{d}</div>)}
            {cells.map((ds, idx) => {
              if (!ds) return <div key={idx} />
              const isFuture = ds > today
              if (isFuture) return <div key={ds} style={{ aspectRatio: '1', borderRadius: 8, background: '#F8F9FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#ddd' }}>{Number(ds.slice(8, 10))}</div>
              const { pct, total } = dayStats(ds)
              const dayNum = Number(ds.slice(8, 10))
              return (
                <button key={ds} onClick={() => setSelectedDate(ds)} style={{
                  aspectRatio: '1', borderRadius: 8, border: selectedDate === ds ? '2px solid #1a1a2e' : 'none',
                  background: total === 0 ? '#F0F2F5' : cellColor(pct), color: total === 0 ? '#bbb' : '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 2, gap: 1,
                }}>
                  <span>{dayNum}</span>
                  {total > 0 && <span style={{ fontSize: 9, fontWeight: 400 }}>{pct}%</span>}
                </button>
              )
            })}
          </div>

          {sel && selectedDate && (
            <div style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#1a1a2e' }}>{selectedDate} 상세 ({sel.doneCount}/{sel.total} · {sel.pct}%)</div>
              {(['open', 'mid', 'close', 'etc'] as const).map(p => {
                const { done, total } = sel.buckets[p]
                if (total === 0) return null
                const missingItems = sel.applicable.filter(i => i.time_slot === p && !sel.doneSet.has(i.id))
                return (
                  <div key={p} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: p !== 'etc' ? '1px solid #F4F6F9' : 'none' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: total > 0 && done === total ? '#00B894' : '#888', marginBottom: 4 }}>{PERIOD_EMOJI[p]} {PERIOD_LABEL[p]} {done}/{total}</div>
                    {missingItems.length > 0 && (
                      <div style={{ fontSize: 11, color: '#E84393', lineHeight: 1.6 }}>미완료: {missingItems.map(i => i.content).join(', ')}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
