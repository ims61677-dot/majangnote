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

// ── 업종별 기본 세트 (새 매장이 빈 체크리스트로 시작할 때 제안) ──
type PresetItem = { time_slot: 'open' | 'close'; area: 'hall' | 'kitchen' | 'storage'; content: string }
const PRESETS: Record<string, { label: string; emoji: string; areaLabels?: Record<string, string>; items: PresetItem[] }> = {
  restaurant: {
    label: '요식업 (식당·레스토랑)', emoji: '🍽',
    items: [
      { time_slot: 'open', area: 'hall', content: '출입문·바닥 청소 및 정리' },
      { time_slot: 'open', area: 'hall', content: '테이블·의자 청소' },
      { time_slot: 'open', area: 'hall', content: '조명·음악·냉난방 켜기' },
      { time_slot: 'open', area: 'hall', content: '셀프바·기본 비품 채우기' },
      { time_slot: 'open', area: 'hall', content: '예약 현황 확인' },
      { time_slot: 'open', area: 'hall', content: 'POS·카드단말기 작동 확인' },
      { time_slot: 'open', area: 'kitchen', content: '위생 점검 및 손 소독' },
      { time_slot: 'open', area: 'kitchen', content: '냉장고·냉동고 온도 확인' },
      { time_slot: 'open', area: 'kitchen', content: '재료 신선도·유통기한 확인' },
      { time_slot: 'open', area: 'kitchen', content: '당일 재료 손질·준비' },
      { time_slot: 'open', area: 'storage', content: '입고 확인' },
      { time_slot: 'open', area: 'storage', content: '재고 수량 확인' },
      { time_slot: 'close', area: 'hall', content: '테이블·바닥 마감 청소' },
      { time_slot: 'close', area: 'hall', content: '매출 정산' },
      { time_slot: 'close', area: 'hall', content: '다음날 예약 확인' },
      { time_slot: 'close', area: 'kitchen', content: '남은 재료 정리·폐기 기록' },
      { time_slot: 'close', area: 'kitchen', content: '조리기구 세척' },
      { time_slot: 'close', area: 'kitchen', content: '가스밸브 잠금 확인' },
      { time_slot: 'close', area: 'storage', content: '재고 최종 확인' },
      { time_slot: 'close', area: 'storage', content: '부족 품목 발주 기록' },
    ],
  },
  cafe: {
    label: '카페', emoji: '☕',
    areaLabels: { hall: '매장', kitchen: '바(주방)', storage: '재고' },
    items: [
      { time_slot: 'open', area: 'hall', content: '테이블·의자 정리' },
      { time_slot: 'open', area: 'hall', content: '조명·음악 켜기' },
      { time_slot: 'open', area: 'hall', content: '매장 청소 상태 확인' },
      { time_slot: 'open', area: 'hall', content: 'POS 작동 확인' },
      { time_slot: 'open', area: 'kitchen', content: '원두·시럽 재고 확인' },
      { time_slot: 'open', area: 'kitchen', content: '머신 예열·청소' },
      { time_slot: 'open', area: 'kitchen', content: '우유·유제품 유통기한 확인' },
      { time_slot: 'open', area: 'storage', content: '재고 수량 확인' },
      { time_slot: 'open', area: 'storage', content: '유통기한 임박 품목 확인' },
      { time_slot: 'close', area: 'hall', content: '마감 청소' },
      { time_slot: 'close', area: 'hall', content: '매출 정산' },
      { time_slot: 'close', area: 'hall', content: '쓰레기 정리' },
      { time_slot: 'close', area: 'kitchen', content: '머신 세척' },
      { time_slot: 'close', area: 'kitchen', content: '냉장고 정리' },
      { time_slot: 'close', area: 'kitchen', content: '원두통 밀봉' },
      { time_slot: 'close', area: 'storage', content: '재고 최종 확인' },
      { time_slot: 'close', area: 'storage', content: '부족 품목 발주 기록' },
    ],
  },
  service: {
    label: '판매·서비스업 (미용실·소매점 등)', emoji: '💇',
    areaLabels: { hall: '매장', kitchen: '작업공간', storage: '재고' },
    items: [
      { time_slot: 'open', area: 'hall', content: '매장 청소' },
      { time_slot: 'open', area: 'hall', content: '조명·음악 켜기' },
      { time_slot: 'open', area: 'hall', content: '진열·디스플레이 정리' },
      { time_slot: 'open', area: 'hall', content: 'POS 작동 확인' },
      { time_slot: 'open', area: 'kitchen', content: '도구·기기 위생 점검' },
      { time_slot: 'open', area: 'kitchen', content: '소모품 확인' },
      { time_slot: 'open', area: 'storage', content: '재고 수량 확인' },
      { time_slot: 'open', area: 'storage', content: '유통기한·소진 품목 확인' },
      { time_slot: 'close', area: 'hall', content: '마감 청소' },
      { time_slot: 'close', area: 'hall', content: '매출 정산' },
      { time_slot: 'close', area: 'hall', content: '다음날 예약 확인' },
      { time_slot: 'close', area: 'kitchen', content: '도구 소독·정리' },
      { time_slot: 'close', area: 'storage', content: '재고 최종 확인' },
      { time_slot: 'close', area: 'storage', content: '부족 품목 발주 기록' },
    ],
  },
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
  const [repeatFilter, setRepeatFilter] = useState<'all' | 'none' | 'daily' | 'weekly' | 'monthly'>('all')
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
  const [bulkMode, setBulkMode] = useState(false)
  const [labels, setLabels] = useState<{ areas: Record<string, string>; periods: Record<string, string> }>({ areas: {}, periods: {} })
  const [showLabelSettings, setShowLabelSettings] = useState(false)
  const [labelDraft, setLabelDraft] = useState<{ areas: Record<string, string>; periods: Record<string, string> }>({ areas: {}, periods: {} })
  const [showPresetPicker, setShowPresetPicker] = useState(false)
  const [applyingPreset, setApplyingPreset] = useState(false)

  const today = todayStr()

  const areaLabel = (area: string) => labels.areas[area] || AREA_CONFIG[area]?.label || area
  const periodLabel = (p: string) => labels.periods[p] || PERIOD_LABEL[p] || p

  useEffect(() => { if (storeId) { load(); loadLabels() } }, [storeId])

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

  async function loadLabels() {
    const { data } = await supabase.from('store_settings').select('value').eq('store_id', storeId).eq('key', 'checklist_labels').maybeSingle()
    if (data?.value) {
      try {
        const parsed = JSON.parse(data.value)
        setLabels({ areas: parsed.areas || {}, periods: parsed.periods || {} })
      } catch {}
    }
  }

  async function saveLabels(next: { areas: Record<string, string>; periods: Record<string, string> }) {
    await supabase.from('store_settings').upsert(
      { store_id: storeId, key: 'checklist_labels', value: JSON.stringify(next), updated_at: new Date().toISOString() },
      { onConflict: 'store_id,key' }
    )
    setLabels(next)
  }

  function openLabelSettings() {
    setLabelDraft({
      areas: { hall: areaLabel('hall'), kitchen: areaLabel('kitchen'), storage: areaLabel('storage') },
      periods: { open: periodLabel('open'), mid: periodLabel('mid'), close: periodLabel('close') },
    })
    setShowLabelSettings(true)
  }

  async function applyPreset(key: string) {
    const preset = PRESETS[key]
    if (!preset) return
    setApplyingPreset(true)
    const rows = preset.items.map((it, idx) => ({
      store_id: storeId, time_slot: it.time_slot, area: it.area, content: it.content,
      sort_order: idx, repeat_type: 'daily', origin_date: todayStr(), category: null,
    }))
    await supabase.from('checklist_items').insert(rows)
    if (preset.areaLabels) await saveLabels({ areas: { ...labels.areas, ...preset.areaLabels }, periods: labels.periods })
    setApplyingPreset(false)
    setShowPresetPicker(false)
    load()
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
  // 주간·월간 항목은 "오늘 해당하는 것만" 보면 편집모드에서 관리가 안 돼요.
  // 편집모드에서는 오늘 여부와 상관없이 전체를 반복주기별로 필터링해서 볼 수 있게 해요. (기타뿐 아니라 홀/주방/창고/관리도 동일)
  function areaAllActive(area: string) {
    return activeItems.filter(i => i.area === area && (area === 'etc' || i.time_slot === period))
  }
  function areaFiltered(area: string) {
    const all = areaAllActive(area)
    return repeatFilter === 'all' ? all : all.filter(i => (i.repeat_type || 'daily') === repeatFilter)
  }
  const etcAllActive = useMemo(() => areaAllActive('etc'), [activeItems])
  const etcFiltered = useMemo(() => areaFiltered('etc'), [activeItems, repeatFilter])

  const areasForPeriod = period === 'close' && isAdmin ? ['hall', 'kitchen', 'storage', 'admin'] : ['hall', 'kitchen', 'storage']

  const structuredSections = areasForPeriod.map(area => {
    const todayList = periodItems.filter(i => i.area === area)
    const inactiveList = editMode && showInactive ? items.filter(i => i.area === area && i.time_slot === period && i.is_active === false && (repeatFilter === 'all' || (i.repeat_type || 'daily') === repeatFilter)) : []
    const doneCount = todayList.filter(i => (checks[i.id] || []).length > 0).length
    const list = editMode ? [...areaFiltered(area), ...inactiveList] : todayList
    return { area, list, doneCount, total: todayList.length }
  })
  const etcInactiveList = editMode && showInactive ? items.filter(i => i.area === 'etc' && i.is_active === false && (repeatFilter === 'all' || (i.repeat_type || 'daily') === repeatFilter)) : []
  const etcSection = {
    area: 'etc',
    list: editMode ? [...etcFiltered, ...etcInactiveList] : etcItemsToday,
    doneCount: etcItemsToday.filter(i => (checks[i.id] || []).length > 0).length,
    total: etcItemsToday.length,
  }
  const sectionData = [etcSection, ...structuredSections].filter(s => s.total > 0 || isAdmin)

  const periodTotal = structuredSections.reduce((s, x) => s + x.total, 0)
  const periodDone = structuredSections.reduce((s, x) => s + x.doneCount, 0)

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
    let maxOrder = list.reduce((m, i) => Math.max(m, i.sort_order || 0), 0)
    const contents = bulkMode
      ? newContent.split('\n').map(s => s.trim()).filter(Boolean)
      : [newContent.trim()]
    if (contents.length === 0) return
    const rows = contents.map(c => {
      maxOrder += 1
      return {
        store_id: storeId,
        time_slot: isEtc ? 'etc' : period,
        area,
        content: c,
        sort_order: maxOrder,
        repeat_type: newRepeat,
        origin_date: newOriginDate,
        category: isEtc ? (newCategory.trim() || null) : null,
      }
    })
    await supabase.from('checklist_items').insert(rows)
    setNewContent(''); setNewCategory(''); setNewRepeat('daily'); setNewOriginDate(todayStr()); setAddingArea(null); setBulkMode(false)
    load()
  }

  function startEdit(item: any) {
    setEditingId(item.id); setEditContent(item.content)
    setEditRepeat(item.repeat_type || 'daily'); setEditOriginDate(item.origin_date || todayStr()); setEditCategory(item.category || '')
  }

  async function saveEdit(item: any) {
    const patch: any = { content: editContent.trim(), repeat_type: editRepeat, origin_date: editOriginDate }
    if (item.area === 'etc') { patch.category = editCategory.trim() || null }
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
        <OpsStatsSection items={activeItems} storeId={storeId} supabase={supabase} periodLabels={labels.periods} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {(['open', 'mid', 'close'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
                background: period === p ? 'linear-gradient(135deg,#FF6B35,#E84393)' : '#F4F6F9',
                color: period === p ? '#fff' : '#888',
              }}>{PERIOD_EMOJI[p]} {periodLabel(p)}</button>
            ))}
          </div>

          <div style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>{periodLabel(period)} 체크리스트</span>
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
                <>
                  <button onClick={openLabelSettings} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E8ECF0', background: '#fff', color: '#888', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>⚙️ 화면 이름 설정</button>
                  <button onClick={() => setShowPresetPicker(true)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #E8ECF0', background: '#fff', color: '#888', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🎁 기본 세트 추가</button>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#888', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />
                    꺼진 항목 보기
                  </label>
                </>
              )}
            </div>
          )}

          {showLabelSettings && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <div style={{ background: '#fff', width: '100%', maxWidth: 420, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '85vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>⚙️ 화면 이름 설정</span>
                  <button onClick={() => setShowLabelSettings(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ fontSize: 11, color: '#aaa', marginBottom: 14 }}>업종에 안 맞으면 이름을 바꿔주세요 (예: 홀→매장, 주방→작업공간)</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6 }}>구역 이름</div>
                {(['hall', 'kitchen', 'storage'] as const).map(a => (
                  <input key={a} value={labelDraft.areas[a] ?? ''} onChange={e => setLabelDraft(d => ({ ...d, areas: { ...d.areas, [a]: e.target.value } }))}
                    placeholder={AREA_CONFIG[a].label}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E0E4E8', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }} />
                ))}
                <div style={{ fontSize: 11, fontWeight: 700, color: '#888', margin: '10px 0 6px' }}>시간대 이름</div>
                {(['open', 'mid', 'close'] as const).map(p => (
                  <input key={p} value={labelDraft.periods[p] ?? ''} onChange={e => setLabelDraft(d => ({ ...d, periods: { ...d.periods, [p]: e.target.value } }))}
                    placeholder={PERIOD_LABEL[p]}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E0E4E8', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }} />
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={async () => { await saveLabels(labelDraft); setShowLabelSettings(false) }} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#FF6B35,#E84393)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>저장</button>
                  <button onClick={async () => { await saveLabels({ areas: {}, periods: {} }); setShowLabelSettings(false) }} style={{ padding: '11px 14px', borderRadius: 10, border: '1px solid #E8ECF0', background: '#fff', color: '#888', fontSize: 13, cursor: 'pointer' }}>기본값으로</button>
                </div>
              </div>
            </div>
          )}

          {showPresetPicker && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <div style={{ background: '#fff', width: '100%', maxWidth: 420, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '85vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>🎁 기본 세트 추가</span>
                  <button onClick={() => setShowPresetPicker(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ fontSize: 11, color: '#aaa', marginBottom: 14 }}>업종에 맞는 기본 항목을 한 번에 추가해요 (구역 이름도 자동으로 맞춰져요)</div>
                {Object.entries(PRESETS).map(([key, preset]) => (
                  <button key={key} disabled={applyingPreset} onClick={() => applyPreset(key)} style={{
                    width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12,
                    border: '1px solid #E8ECF0', background: '#F8F9FB', marginBottom: 8, cursor: applyingPreset ? 'wait' : 'pointer',
                  }}>
                    <span style={{ fontSize: 20 }}>{preset.emoji}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{preset.label}</div>
                      <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>기본 항목 {preset.items.length}개 추가</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {sectionData.length === 0 && !isAdmin && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb', fontSize: 13 }}>등록된 체크리스트 항목이 없어요</div>
          )}

          {isAdmin && !editMode && items.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 16px', border: '1px dashed #C8CCD4', borderRadius: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>아직 체크리스트 항목이 없어요. 업종에 맞는 기본 세트로 빠르게 시작해보세요.</div>
              <button onClick={() => setShowPresetPicker(true)} style={{ padding: '10px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#FF6B35,#E84393)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🎁 기본 세트 고르기</button>
            </div>
          )}

          {sectionData.map(({ area, list, doneCount, total }) => {
            const cfg = AREA_CONFIG[area]
            const key = `${period}-${area}`
            const isOpen = expanded.has(key)
            const displayList = list
            const isEtc = area === 'etc'
            return (
              <div key={area} style={{ marginBottom: 10 }}>
                <button onClick={() => toggleExpand(area)} style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', borderRadius: 12, border: '1px solid #E8ECF0',
                  background: total > 0 && doneCount === total ? 'rgba(0,184,148,0.06)' : '#fff', cursor: 'pointer',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{cfg.emoji} {areaLabel(area)}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: total > 0 && doneCount === total ? '#00B894' : '#888' }}>{doneCount}/{total}</span>
                    <span style={{ fontSize: 11, color: '#bbb' }}>{isOpen ? '▲' : '▼'}</span>
                  </span>
                </button>
                {isOpen && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {editMode && (
                      <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        {(['all', 'none', 'daily', 'weekly', 'monthly'] as const).map(rt => (
                          <button key={rt} onClick={() => setRepeatFilter(rt)} style={{
                            padding: '5px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            border: repeatFilter === rt ? '1.5px solid #6C5CE7' : '1px solid #E8ECF0',
                            background: repeatFilter === rt ? 'rgba(108,92,231,0.08)' : '#fff',
                            color: repeatFilter === rt ? '#6C5CE7' : '#888',
                          }}>{rt === 'all' ? '전체' : REPEAT_LABEL[rt]}</button>
                        ))}
                      </div>
                    )}
                    {editMode && displayList.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 16, color: '#bbb', fontSize: 12 }}>해당하는 항목이 없어요</div>
                    )}
                    {displayList.map(item => {
                      const doneToday = checks[item.id] || []
                      const isDone = doneToday.length > 0
                      const isInactive = item.is_active === false
                      const isDueToday = appliesOnDate(item, today)
                      return (
                        <div key={item.id} style={{
                          background: isInactive ? '#F8F9FB' : '#fff',
                          border: isInactive ? '1px dashed #ddd' : isDone ? '1px solid rgba(0,184,148,0.25)' : '1px solid #E8ECF0',
                          borderRadius: 10, padding: '10px 12px', opacity: isInactive ? 0.7 : 1,
                        }}>
                          {editingId === item.id ? (
                            <div>
                              <input value={editContent} onChange={e => setEditContent(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #E0E4E8', fontSize: 13, marginBottom: 6, boxSizing: 'border-box' }} />
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
                              {isEtc && (
                                <input value={editCategory} onChange={e => setEditCategory(e.target.value)} placeholder="카테고리 (선택)" style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #E0E4E8', fontSize: 13, marginBottom: 6, boxSizing: 'border-box' }} />
                              )}
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={() => saveEdit(item)} style={{ flex: 1, padding: 8, borderRadius: 7, border: 'none', background: '#6C5CE7', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>저장</button>
                                <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: 8, borderRadius: 7, border: '1px solid #E8ECF0', background: '#fff', color: '#888', fontSize: 12, cursor: 'pointer' }}>취소</button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {!isInactive && isDueToday && <span onClick={() => toggle(item)} style={{ fontSize: 19, color: isDone ? '#00B894' : '#ddd', cursor: 'pointer', flexShrink: 0 }}>{isDone ? '✅' : '⬜'}</span>}
                              {!isInactive && !isDueToday && <span style={{ fontSize: 19, color: '#eee', flexShrink: 0 }}>⬜</span>}
                              <div onClick={() => !editMode && !isInactive && isDueToday && toggle(item)} style={{ flex: 1, minWidth: 0, cursor: editMode || isInactive || !isDueToday ? 'default' : 'pointer' }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: isDone ? '#888' : !isDueToday ? '#bbb' : '#1a1a2e', textDecoration: isDone ? 'line-through' : 'none' }}>{item.content}</div>
                                <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                                  {isInactive && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(232,67,147,0.1)', color: '#E84393', fontWeight: 700 }}>꺼짐</span>}
                                  {!isDueToday && !isInactive && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#F4F6F9', color: '#aaa' }}>오늘 해당 없음</span>}
                                  {item.repeat_type && item.repeat_type !== 'daily' && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(108,92,231,0.1)', color: '#6C5CE7', fontWeight: 700 }}>{REPEAT_LABEL[item.repeat_type]}</span>}
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
                          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#888', cursor: 'pointer', marginBottom: 6 }}>
                            <input type="checkbox" checked={bulkMode} onChange={e => setBulkMode(e.target.checked)} />
                            여러 줄로 한번에 추가 (한 줄에 항목 하나씩)
                          </label>
                          {bulkMode ? (
                            <textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder={'예)\n손 씻기\n조리대 청소\n재고 확인'} rows={5}
                              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E0E4E8', fontSize: 13, marginBottom: 8, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                          ) : (
                            <input value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="새 항목 입력"
                              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E0E4E8', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }} />
                          )}
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
                          {isEtc && (
                            <input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="카테고리 (선택, 예: 위생)"
                              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #E0E4E8', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }} />
                          )}
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => addItem(area)} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: '#6C5CE7', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>추가</button>
                            <button onClick={() => { setAddingArea(null); setNewContent(''); setNewCategory(''); setNewRepeat('daily'); setNewOriginDate(todayStr()); setBulkMode(false) }} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #E8ECF0', background: '#fff', color: '#888', fontSize: 12, cursor: 'pointer' }}>취소</button>
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
function OpsStatsSection({ items, storeId, supabase, periodLabels }: { items: any[]; storeId: string; supabase: any; periodLabels: Record<string, string> }) {
  const periodLabel = (p: string) => periodLabels[p] || PERIOD_LABEL[p] || p
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [checksByDate, setChecksByDate] = useState<Record<string, Set<string>>>({})
  const [staffCounts, setStaffCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showAllMiss, setShowAllMiss] = useState(false)

  const monthStart = `${year}-${pad(month)}-01`
  const dim = daysInMonth(year, month)
  const monthEnd = `${year}-${pad(month)}-${pad(dim)}`
  const today = todayStr()
  const effectiveEnd = monthEnd < today ? monthEnd : today

  useEffect(() => { if (storeId && items.length > 0) load() }, [storeId, items.length, year, month])

  async function load() {
    setLoading(true)
    setSelectedDate(null)
    setShowAllMiss(false)
    const ids = items.map(i => i.id)
    const { data } = await supabase.from('checklist_item_checks').select('item_id, work_date, checked_by')
      .in('item_id', ids).gte('work_date', monthStart).lte('work_date', monthEnd)
    const map: Record<string, Set<string>> = {}
    const staffMap: Record<string, number> = {}
    ;(data || []).forEach((c: any) => {
      if (!map[c.work_date]) map[c.work_date] = new Set(); map[c.work_date].add(c.item_id)
      if (c.checked_by) staffMap[c.checked_by] = (staffMap[c.checked_by] || 0) + 1
    })
    setChecksByDate(map)
    setStaffCounts(staffMap)
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
  const missCounts: Record<string, number> = {}
  if (effectiveEnd >= monthStart) {
    for (let d = new Date(monthStart + 'T00:00:00'); toDateStr(d) <= effectiveEnd; d.setDate(d.getDate() + 1)) {
      const { pct, total, applicable, doneSet } = dayStats(toDateStr(d))
      if (total === 0) continue
      sumPct += pct; countedDays++
      if (pct === 100) fullDays++
      if (pct === 0) zeroDays++
      applicable.forEach(i => { if (!doneSet.has(i.id)) missCounts[i.id] = (missCounts[i.id] || 0) + 1 })
    }
  }
  const avgPct = countedDays > 0 ? Math.round(sumPct / countedDays) : 0
  const missRanking = Object.entries(missCounts)
    .map(([id, count]) => ({ item: items.find(i => i.id === id), count }))
    .filter((x): x is { item: any; count: number } => !!x.item)
    .sort((a, b) => b.count - a.count)

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

          {countedDays > 0 && (
            <div style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#1a1a2e' }}>⚠️ 이번 달 자주 놓친 항목</div>
              {missRanking.length === 0 ? (
                <div style={{ fontSize: 12, color: '#00B894', fontWeight: 600 }}>🎉 이번 달 놓친 항목이 없어요!</div>
              ) : (
                <>
                  {(showAllMiss ? missRanking : missRanking.slice(0, 6)).map(({ item, count }) => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #F8F9FB' }}>
                      <span style={{ fontSize: 13, flexShrink: 0 }}>{AREA_CONFIG[item.area]?.emoji || '📌'}</span>
                      <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.content}
                        <span style={{ color: '#ccc', marginLeft: 6 }}>{periodLabel(item.time_slot)}</span>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#E84393', flexShrink: 0 }}>{count}회 미완료</span>
                    </div>
                  ))}
                  {missRanking.length > 6 && (
                    <button onClick={() => setShowAllMiss(v => !v)}
                      style={{ width: '100%', marginTop: 8, padding: 8, borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 11, cursor: 'pointer' }}>
                      {showAllMiss ? '접기' : `전체 ${missRanking.length}개 보기`}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {Object.keys(staffCounts).length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: '#1a1a2e' }}>🏆 이번 달 체크 횟수</div>
              <div style={{ fontSize: 10, color: '#bbb', marginBottom: 10 }}>담당자 지정은 없어서, 얼마나 많이 체크했는지만 볼 수 있어요</div>
              {Object.entries(staffCounts).sort((a, b) => b[1] - a[1]).map(([name, count], idx) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #F8F9FB' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: idx === 0 ? '#FDC400' : idx === 1 ? '#aaa' : idx === 2 ? '#E8A87C' : '#ccc', width: 18, flexShrink: 0 }}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#6C5CE7', flexShrink: 0 }}>{count}회</span>
                </div>
              ))}
            </div>
          )}

          {sel && selectedDate && (
            <div style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#1a1a2e' }}>{selectedDate} 상세 ({sel.doneCount}/{sel.total} · {sel.pct}%)</div>
              {(['open', 'mid', 'close', 'etc'] as const).map(p => {
                const { done, total } = sel.buckets[p]
                if (total === 0) return null
                const missingItems = sel.applicable.filter(i => i.time_slot === p && !sel.doneSet.has(i.id))
                return (
                  <div key={p} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: p !== 'etc' ? '1px solid #F4F6F9' : 'none' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: total > 0 && done === total ? '#00B894' : '#888', marginBottom: 4 }}>{PERIOD_EMOJI[p]} {periodLabel(p)} {done}/{total}</div>
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
