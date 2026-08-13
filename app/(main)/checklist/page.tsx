'use client'
import { useEffect, useState, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

// 체크리스트 항목은 notices(컨테이너, title='__CHECKLIST__') + notice_todos(항목) + notice_todo_checks(완료기록)
// 테이블을 그대로 재사용합니다. 기존 공지 기능과는 title 마커로 구분되어 서로 섞이지 않아요.
const CONTAINER_TITLE = '__CHECKLIST__'

const REPEAT_LABEL: Record<string, string> = {
  none: '하루만', daily: '매일', weekly: '매주', monthly: '매달',
}
const DOW = ['일', '월', '화', '수', '목', '금', '토']

function pad(n: number) { return String(n).padStart(2, '0') }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
function todayStr() { return toDateStr(new Date()) }

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

export default function ChecklistPage() {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState('')
  const [myName, setMyName] = useState('')
  const [role, setRole] = useState('')
  const isAdmin = role === 'owner' || role === 'manager'
  const [tab, setTab] = useState<'today' | 'manage' | 'stats'>('today')
  const [items, setItems] = useState<any[]>([])
  const [checksByTodo, setChecksByTodo] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    setStoreId(store.id || ''); setMyName(user.nm || ''); setRole(user.role || '')
    if (store.id) loadAll(store.id)
  }, [])

  async function loadAll(sid: string) {
    setLoading(true)
    const { data: notices } = await supabase
      .from('notices')
      .select('id, notice_date, notice_todos(*)')
      .eq('store_id', sid)
      .eq('title', CONTAINER_TITLE)
    const allItems: any[] = []
    ;(notices || []).forEach((n: any) => {
      ;(n.notice_todos || []).forEach((t: any) => allItems.push({ ...t, origin_date: n.notice_date, notice_id: n.id }))
    })
    setItems(allItems)
    const ids = allItems.map(t => t.id)
    if (ids.length > 0) {
      const { data: chks } = await supabase.from('notice_todo_checks').select('*').in('todo_id', ids)
      const map: Record<string, any[]> = {}
      ;(chks || []).forEach((c: any) => { if (!map[c.todo_id]) map[c.todo_id] = []; map[c.todo_id].push(c) })
      setChecksByTodo(map)
    } else setChecksByTodo({})
    setLoading(false)
  }

  const activeItems = useMemo(() => items.filter(t => t.is_active !== false), [items])

  const todayList = useMemo(() => {
    const today = todayStr()
    return activeItems
      .filter(t => appliesOnDate(t, today))
      .map(t => {
        const checks = checksByTodo[t.id] || []
        const doneToday = checks.filter((c: any) => (c.checked_at || '').slice(0, 10) === today)
        return { ...t, doneToday, isDone: doneToday.length > 0 }
      })
      .sort((a, b) => Number(a.isDone) - Number(b.isDone))
  }, [activeItems, checksByTodo])

  async function toggleCheck(item: any) {
    const today = todayStr()
    if (item.isDone) {
      const mine = item.doneToday.find((c: any) => c.checked_by === myName)
      const target = mine || item.doneToday[0]
      if (!target) return
      await supabase.from('notice_todo_checks').delete().eq('id', target.id)
    } else {
      await supabase.from('notice_todo_checks').insert({ todo_id: item.id, checked_by: myName, checked_at: new Date().toISOString() })
    }
    loadAll(storeId)
  }

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, color: '#1a1a2e' }}>✅ 체크리스트</div>
      <div style={{ fontSize: 12, color: '#aaa', marginBottom: 16 }}>매일 해야 할 일을 등록해두면 자동으로 배치돼요</div>

      <div style={{ display: 'flex', gap: 6, background: '#F4F6F9', borderRadius: 12, padding: 4, marginBottom: 16, width: 'fit-content' }}>
        <button onClick={() => setTab('today')} style={tabBtn(tab === 'today')}>📋 오늘 할 일</button>
        {isAdmin && <button onClick={() => setTab('manage')} style={tabBtn(tab === 'manage')}>⚙️ 관리</button>}
        {isAdmin && <button onClick={() => setTab('stats')} style={tabBtn(tab === 'stats')}>📊 통계</button>}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 13 }}>⏳ 불러오는 중...</div>
      ) : (
        <>
          {tab === 'today' && <TodayTab list={todayList} myName={myName} onToggle={toggleCheck} />}
          {tab === 'manage' && isAdmin && <ManageTab items={activeItems} storeId={storeId} myName={myName} onSaved={() => loadAll(storeId)} supabase={supabase} />}
          {tab === 'stats' && isAdmin && <StatsTab items={activeItems} checksByTodo={checksByTodo} />}
        </>
      )}
    </div>
  )
}

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
    background: active ? '#fff' : 'transparent', color: active ? '#6C5CE7' : '#888',
    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
  }
}

// ── 오늘 할 일 탭 ──
function TodayTab({ list, myName, onToggle }: { list: any[]; myName: string; onToggle: (item: any) => void }) {
  if (list.length === 0) {
    return <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb' }}>
      <div style={{ fontSize: 32, marginBottom: 10 }}>🎉</div>
      <div style={{ fontSize: 13 }}>오늘 등록된 체크리스트 항목이 없어요</div>
    </div>
  }
  const doneCount = list.filter(t => t.isDone).length
  return (
    <div>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 10, fontWeight: 600 }}>{doneCount} / {list.length}개 완료</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map(item => (
          <div key={item.id} onClick={() => onToggle(item)} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
            background: item.isDone ? 'rgba(0,184,148,0.06)' : '#fff',
            border: item.isDone ? '1px solid rgba(0,184,148,0.25)' : '1px solid #E8ECF0',
          }}>
            <span style={{ fontSize: 20, color: item.isDone ? '#00B894' : '#ddd', flexShrink: 0 }}>{item.isDone ? '✅' : '⬜'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: item.isDone ? '#888' : '#1a1a2e', textDecoration: item.isDone ? 'line-through' : 'none' }}>{item.content}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center' }}>
                {item.category && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(108,92,231,0.1)', color: '#6C5CE7', fontWeight: 600 }}>{item.category}</span>}
                <span style={{ fontSize: 10, color: '#bbb' }}>{REPEAT_LABEL[item.repeat_type] || '하루만'}</span>
                {item.isDone && item.doneToday[0] && (
                  <span style={{ fontSize: 10, color: '#00B894' }}>
                    {item.doneToday.map((c: any) => c.checked_by).join(', ')}님이 {new Date(item.doneToday[0].checked_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit' })}에 완료
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 관리 탭 ──
function ManageTab({ items, storeId, myName, onSaved, supabase }: { items: any[]; storeId: string; myName: string; onSaved: () => void; supabase: any }) {
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')
  const [repeatType, setRepeatType] = useState('daily')
  const [originDate, setOriginDate] = useState(todayStr())
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editCategory, setEditCategory] = useState('')

  async function addItem() {
    if (!content.trim() || !storeId) return
    setSaving(true)
    try {
      const { data: existingContainer } = await supabase
        .from('notices').select('id').eq('store_id', storeId).eq('notice_date', originDate).eq('title', CONTAINER_TITLE).maybeSingle()
      let noticeId = existingContainer?.id
      if (!noticeId) {
        const { data: newNotice, error } = await supabase.from('notices').insert({
          store_id: storeId, title: CONTAINER_TITLE, content: null, notice_date: originDate,
          created_by: myName, is_from_closing: false, is_pinned: false,
        }).select().single()
        if (error) throw error
        noticeId = newNotice.id
      }
      const { error: todoErr } = await supabase.from('notice_todos').insert({
        notice_id: noticeId, content: content.trim(), created_by: myName,
        visibility: 'all', repeat_type: repeatType, is_mission: false,
        category: category.trim() || null,
      })
      if (todoErr) throw todoErr
      setContent(''); setCategory('')
      onSaved()
    } catch (e) {
      alert('추가 실패, 다시 시도해주세요')
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit(id: string) {
    await supabase.from('notice_todos').update({ content: editContent.trim(), category: editCategory.trim() || null }).eq('id', id)
    setEditingId(null)
    onSaved()
  }

  async function toggleActive(item: any) {
    await supabase.from('notice_todos').update({ is_active: item.is_active === false ? true : false }).eq('id', item.id)
    onSaved()
  }

  const originDow = DOW[new Date(originDate + 'T00:00:00').getDay()]

  return (
    <div>
      <div style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>+ 새 항목 등록</div>
        <input value={content} onChange={e => setContent(e.target.value)} placeholder="예: 화장실 청소"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #E0E4E8', background: '#F8F9FB', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }} />
        <input value={category} onChange={e => setCategory(e.target.value)} placeholder="카테고리 (선택, 예: 위생)"
          style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #E0E4E8', background: '#F8F9FB', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }} />

        <div style={{ fontSize: 11, color: '#888', fontWeight: 600, marginBottom: 6 }}>언제 반복할까요?</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {(['daily', 'weekly', 'monthly', 'none'] as const).map(rt => (
            <button key={rt} onClick={() => setRepeatType(rt)} style={{
              padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: repeatType === rt ? '1.5px solid #6C5CE7' : '1px solid #E8ECF0',
              background: repeatType === rt ? 'rgba(108,92,231,0.08)' : '#fff',
              color: repeatType === rt ? '#6C5CE7' : '#888',
            }}>{REPEAT_LABEL[rt]}</button>
          ))}
        </div>

        <div style={{ fontSize: 11, color: '#888', fontWeight: 600, marginBottom: 6 }}>
          {repeatType === 'none' ? '날짜' : repeatType === 'weekly' ? `시작일 (매주 ${originDow}요일에 반복돼요)` : '시작일'}
        </div>
        <input type="date" value={originDate} onChange={e => setOriginDate(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 9, border: '1px solid #E0E4E8', background: '#F8F9FB', fontSize: 13, marginBottom: 12, boxSizing: 'border-box' }} />

        <button onClick={addItem} disabled={saving || !content.trim()} style={{
          width: '100%', padding: 12, borderRadius: 10, border: 'none', color: '#fff', fontWeight: 700, fontSize: 14,
          background: saving ? '#ccc' : 'linear-gradient(135deg,#6C5CE7,#00B894)', cursor: saving ? 'wait' : 'pointer',
        }}>{saving ? '등록 중...' : '+ 항목 등록'}</button>
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>등록된 항목 ({items.length})</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: '#bbb', fontSize: 12 }}>아직 등록된 항목이 없어요</div>}
        {items.map(item => (
          <div key={item.id} style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 10, padding: '10px 12px' }}>
            {editingId === item.id ? (
              <div>
                <input value={editContent} onChange={e => setEditContent(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #E0E4E8', fontSize: 13, marginBottom: 6, boxSizing: 'border-box' }} />
                <input value={editCategory} onChange={e => setEditCategory(e.target.value)} placeholder="카테고리"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #E0E4E8', fontSize: 13, marginBottom: 6, boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => saveEdit(item.id)} style={{ flex: 1, padding: 8, borderRadius: 7, border: 'none', background: '#6C5CE7', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>저장</button>
                  <button onClick={() => setEditingId(null)} style={{ flex: 1, padding: 8, borderRadius: 7, border: '1px solid #E8ECF0', background: '#fff', color: '#888', fontSize: 12, cursor: 'pointer' }}>취소</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{item.content}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                    {item.category && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(108,92,231,0.1)', color: '#6C5CE7' }}>{item.category}</span>}
                    <span style={{ fontSize: 10, color: '#bbb' }}>{REPEAT_LABEL[item.repeat_type] || '하루만'} · {item.origin_date}~</span>
                  </div>
                </div>
                <button onClick={() => { setEditingId(item.id); setEditContent(item.content); setEditCategory(item.category || '') }}
                  style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid #E8ECF0', background: '#fff', color: '#888', fontSize: 11, cursor: 'pointer' }}>수정</button>
                <button onClick={() => toggleActive(item)}
                  style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(232,67,147,0.3)', background: 'rgba(232,67,147,0.06)', color: '#E84393', fontSize: 11, cursor: 'pointer' }}>끄기</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 통계 탭 ──
function StatsTab({ items, checksByTodo }: { items: any[]; checksByTodo: Record<string, any[]> }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const monthStart = `${year}-${pad(month)}-01`
  const dim = daysInMonth(year, month)
  const monthEnd = `${year}-${pad(month)}-${pad(dim)}`
  const today = todayStr()
  const effectiveEnd = monthEnd < today ? monthEnd : today

  const rows = items.map(item => {
    const checks = checksByTodo[item.id] || []
    const checkedDates = new Set(checks.map((c: any) => (c.checked_at || '').slice(0, 10)))
    let applicable = 0, done = 0
    if (effectiveEnd >= monthStart) {
      for (let d = new Date(monthStart + 'T00:00:00'); toDateStr(d) <= effectiveEnd; d.setDate(d.getDate() + 1)) {
        const ds = toDateStr(d)
        if (appliesOnDate(item, ds)) {
          applicable++
          if (checkedDates.has(ds)) done++
        }
      }
    }
    const rate = applicable > 0 ? Math.round((done / applicable) * 100) : 0
    const logs = checks
      .filter((c: any) => (c.checked_at || '').slice(0, 7) === `${year}-${pad(month)}`)
      .sort((a: any, b: any) => b.checked_at.localeCompare(a.checked_at))
    return { item, applicable, done, rate, logs }
  }).sort((a, b) => a.rate - b.rate)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <button onClick={() => { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #E8ECF0', background: '#fff', cursor: 'pointer' }}>◀</button>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{year}년 {month}월</span>
        <button onClick={() => { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #E8ECF0', background: '#fff', cursor: 'pointer' }}>▶</button>
      </div>

      {rows.length === 0 && <div style={{ textAlign: 'center', padding: 30, color: '#bbb', fontSize: 12 }}>등록된 항목이 없어요</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(({ item, applicable, done, rate, logs }) => (
          <div key={item.id} style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 12, padding: 14 }}>
            <div onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{item.content}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: rate >= 90 ? '#00B894' : rate >= 60 ? '#FDC400' : '#E84393' }}>{rate}%</div>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: '#F0F2F5', overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ height: '100%', width: `${rate}%`, background: rate >= 90 ? '#00B894' : rate >= 60 ? '#FDC400' : '#E84393' }} />
              </div>
              <div style={{ fontSize: 11, color: '#aaa' }}>이번달 {applicable}일 중 {done}일 완료 · {logs.length}건 기록 (탭해서 상세보기)</div>
            </div>
            {expandedId === item.id && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F0F2F5' }}>
                {logs.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#bbb' }}>이번달 완료 기록이 없어요</div>
                ) : logs.map((c: any) => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666', padding: '4px 0' }}>
                    <span>{c.checked_at.slice(0, 10)} ({DOW[new Date(c.checked_at).getDay()]})</span>
                    <span style={{ fontWeight: 600 }}>{c.checked_by}</span>
                    <span>{new Date(c.checked_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
