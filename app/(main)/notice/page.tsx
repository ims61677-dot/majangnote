'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ─── 캘린더 ───
function MiniCalendar({ year, month, todoDates, selectedDate, onSelectDate, onChangeMonth }: {
  year: number; month: number; todoDates: Set<string>
  selectedDate: string; onSelectDate: (d: string) => void; onChangeMonth: (y: number, m: number) => void
}) {
  const today = toDateStr(new Date())
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const weeks: (number | null)[][] = []
  let week: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d)
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week) }
  const monthStr = `${year}-${String(month+1).padStart(2,'0')}`

  return (
    <div style={{ ...bx, padding: '14px 12px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <button onClick={() => month===0 ? onChangeMonth(year-1,11) : onChangeMonth(year,month-1)}
          style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer', padding:'0 6px' }}>‹</button>
        <div style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>{year}년 {month+1}월</div>
        <button onClick={() => month===11 ? onChangeMonth(year+1,0) : onChangeMonth(year,month+1)}
          style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer', padding:'0 6px' }}>›</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:4 }}>
        {['일','월','화','수','목','금','토'].map((d,i) => (
          <div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:600, color: i===0?'#E84393':i===6?'#2DC6D6':'#aaa', padding:'2px 0' }}>{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:2 }}>
          {week.map((day, di) => {
            if (!day) return <div key={di} />
            const dateStr = `${monthStr}-${String(day).padStart(2,'0')}`
            const hasTodo = todoDates.has(dateStr)
            const isSelected = dateStr === selectedDate
            const isToday = dateStr === today
            return (
              <button key={di} onClick={() => onSelectDate(dateStr)} style={{
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                padding:'4px 2px', borderRadius:8, cursor:'pointer', minHeight:40,
                border: isSelected?'2px solid #6C5CE7':isToday?'1px solid rgba(108,92,231,0.3)':'1px solid transparent',
                background: isSelected?'rgba(108,92,231,0.1)':hasTodo?'rgba(108,92,231,0.04)':'transparent',
              }}>
                <span style={{ fontSize:12, fontWeight:isSelected||isToday?700:400, color:isSelected?'#6C5CE7':di===0?'#E84393':di===6?'#2DC6D6':'#1a1a2e' }}>{day}</span>
                {hasTodo && <span style={{ width:4, height:4, borderRadius:'50%', background:'#6C5CE7', marginTop:2 }} />}
              </button>
            )
          })}
        </div>
      ))}
      <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:8, paddingTop:8, borderTop:'1px solid #F0F0F0' }}>
        <span style={{ width:6, height:6, borderRadius:'50%', background:'#6C5CE7', display:'inline-block' }} />
        <span style={{ fontSize:9, color:'#aaa' }}>할일 있는 날</span>
      </div>
    </div>
  )
}

// ─── 할일 아이템 ───
function TodoItem({ todo, checks, onToggle, canCheck, myName }: {
  todo: any; checks: any[]; onToggle: () => void; canCheck: boolean; myName: string
}) {
  const myChecked = checks.find((c: any) => c.checked_by === myName)
  return (
    <div style={{ borderRadius:10, border:myChecked?'1px solid rgba(0,184,148,0.3)':'1px solid #E8ECF0', background:myChecked?'rgba(0,184,148,0.04)':'#F8F9FB', marginBottom:6, overflow:'hidden' }}>
      <button onClick={onToggle}
        style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'none', border:'none', cursor:canCheck?'pointer':'not-allowed', textAlign:'left' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:17, color:myChecked?'#00B894':'#ddd', lineHeight:1, flexShrink:0 }}>{myChecked?'✓':'○'}</span>
          <div>
            <div style={{ fontSize:13, color:myChecked?'#00B894':canCheck?'#444':'#bbb', textDecoration:myChecked?'line-through':'none' }}>{todo.content}</div>
            {todo.created_by && <div style={{ fontSize:10, color:'#bbb', marginTop:1 }}>작성: {todo.created_by}</div>}
          </div>
        </div>
        {!canCheck && <span style={{ fontSize:9, color:'#bbb', flexShrink:0 }}>당일만</span>}
      </button>
      {checks.length > 0 && (
        <div style={{ padding:'6px 14px 10px', borderTop:'1px solid rgba(0,184,148,0.1)', background:'rgba(0,184,148,0.02)' }}>
          <div style={{ fontSize:9, color:'#00B894', fontWeight:700, marginBottom:3 }}>✓ 완료한 사람</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {checks.map((c: any) => (
              <span key={c.id} style={{ fontSize:10, color:'#00B894', background:'rgba(0,184,148,0.1)', padding:'1px 7px', borderRadius:10 }}>
                {c.checked_by} · {new Date(c.checked_at).toLocaleTimeString('ko',{hour:'2-digit',minute:'2-digit',hour12:false})}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 공지 카드 (읽음 확인 포함) ───
function NoticeCard({ notice, reads, myName, isManager, onRead, onEdit, onDelete }: {
  notice: any; reads: any[]; myName: string; isManager: boolean
  onRead: (id: string) => void; onEdit: (n: any) => void; onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const myRead = reads.find((r: any) => r.read_by === myName)

  function handleExpand() {
    setExpanded(p => !p)
    // 펼칠 때 자동 읽음 처리
    if (!myRead) onRead(notice.id)
  }

  return (
    <div style={{ ...bx, border: notice.is_pinned?'1px solid rgba(108,92,231,0.25)':'1px solid #E8ECF0', background: notice.is_pinned?'rgba(108,92,231,0.02)':'#fff' }}>
      {/* 헤더 - 항상 표시 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <button onClick={handleExpand} style={{ flex:1, background:'none', border:'none', cursor:'pointer', textAlign:'left', padding:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
            {notice.is_pinned && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'rgba(108,92,231,0.12)', color:'#6C5CE7', fontWeight:700 }}>📌 고정</span>}
            {!myRead && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'rgba(255,107,53,0.12)', color:'#FF6B35', fontWeight:700 }}>NEW</span>}
            <span style={{ fontSize:14, fontWeight:700, color:'#1a1a2e' }}>{notice.title}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:10, color:'#bbb' }}>{notice.created_by} · {new Date(notice.created_at).toLocaleDateString('ko')}</span>
            {/* 읽음 수 */}
            <span style={{ fontSize:10, color: reads.length>0?'#00B894':'#bbb' }}>
              👁 {reads.length}명 확인
            </span>
            <span style={{ fontSize:10, color:'#bbb', marginLeft:'auto' }}>{expanded ? '▲' : '▼'}</span>
          </div>
        </button>
        {isManager && (
          <div style={{ display:'flex', gap:6, marginLeft:10, flexShrink:0 }}>
            <button onClick={() => onEdit(notice)} style={{ fontSize:11, color:'#aaa', background:'none', border:'none', cursor:'pointer' }}>수정</button>
            <button onClick={() => onDelete(notice.id)} style={{ fontSize:11, color:'#E84393', background:'none', border:'none', cursor:'pointer' }}>삭제</button>
          </div>
        )}
      </div>

      {/* 펼쳐진 내용 */}
      {expanded && (
        <div style={{ marginTop:12 }}>
          {notice.content && (
            <div style={{ fontSize:13, color:'#444', lineHeight:1.7, background:'#F8F9FB', borderRadius:10, padding:'10px 12px', marginBottom:12 }}>
              {notice.content}
            </div>
          )}

          {/* 읽음 확인 목록 */}
          <div style={{ background: reads.length>0?'rgba(0,184,148,0.04)':'#F8F9FB', borderRadius:10, padding:'10px 12px', border: reads.length>0?'1px solid rgba(0,184,148,0.2)':'1px solid #E8ECF0' }}>
            <div style={{ fontSize:11, fontWeight:700, color: reads.length>0?'#00B894':'#aaa', marginBottom: reads.length>0?8:0 }}>
              👁 읽음 확인 {reads.length}명
            </div>
            {reads.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {reads.map((r: any) => (
                  <span key={r.id} style={{ fontSize:10, color:'#00B894', background:'rgba(0,184,148,0.1)', padding:'2px 8px', borderRadius:10 }}>
                    ✓ {r.read_by} · {new Date(r.read_at).toLocaleTimeString('ko',{hour:'2-digit',minute:'2-digit',hour12:false})}
                  </span>
                ))}
              </div>
            )}
            {reads.length === 0 && (
              <div style={{ fontSize:11, color:'#bbb' }}>아직 아무도 읽지 않았어요</div>
            )}
          </div>

          {/* 내가 아직 안 읽었으면 확인 버튼 */}
          {!myRead && (
            <button onClick={() => onRead(notice.id)}
              style={{ width:'100%', marginTop:10, padding:'10px 0', borderRadius:10, background:'rgba(0,184,148,0.1)', border:'1px solid rgba(0,184,148,0.3)', color:'#00B894', fontSize:13, fontWeight:700, cursor:'pointer' }}>
              ✓ 확인했습니다
            </button>
          )}
          {myRead && (
            <div style={{ textAlign:'center', marginTop:8, fontSize:11, color:'#00B894' }}>
              ✓ {new Date(myRead.read_at).toLocaleString('ko',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})}에 확인했어요
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════
// 메인
// ═══════════════════════════════════════
export default function NoticePage() {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState('')
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const today = toDateStr(new Date())
  const [subTab, setSubTab] = useState<'notice' | 'todo'>('notice')

  // ── 공지 ──
  const [notices, setNotices] = useState<any[]>([])
  const [noticeReads, setNoticeReads] = useState<Record<string, any[]>>({})
  const [showNoticeForm, setShowNoticeForm] = useState(false)
  const [editingNotice, setEditingNotice] = useState<any>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formPinned, setFormPinned] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // ── 할일 ──
  const nowD = new Date()
  const [calYear, setCalYear] = useState(nowD.getFullYear())
  const [calMonth, setCalMonth] = useState(nowD.getMonth())
  const [selectedDate, setSelectedDate] = useState(today)
  const [todoDates, setTodoDates] = useState<Set<string>>(new Set())
  const [dayNotices, setDayNotices] = useState<any[]>([])
  const [noticeTodoChecks, setNoticeTodoChecks] = useState<Record<string, any[]>>({})
  const [showTodoForm, setShowTodoForm] = useState(false)
  const [formTodoTitle, setFormTodoTitle] = useState('')
  const [formTodos, setFormTodos] = useState<string[]>([''])
  const [isSavingTodo, setIsSavingTodo] = useState(false)

  // ── 전달사항 ──
  const [closingTodos, setClosingTodos] = useState<any[]>([])
  const [closingChecks, setClosingChecks] = useState<Record<string, any[]>>({})
  const [closingDateLabel, setClosingDateLabel] = useState('')

  const isManager = userRole === 'owner' || userRole === 'manager'
  const isOwner = userRole === 'owner'

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id)
    setUserName(user.nm || '')
    setUserRole(user.role || '')
    loadNotices(store.id)
    loadTodoDates(store.id)
  }, [])

  useEffect(() => {
    if (!storeId) return
    loadDayTodos(storeId, selectedDate)
    loadClosingTodos(storeId, selectedDate)
  }, [selectedDate, storeId])

  async function loadNotices(sid: string) {
    const { data } = await supabase
      .from('notices').select('*')
      .eq('store_id', sid).eq('is_from_closing', false)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
    setNotices(data || [])

    // 읽음 데이터 로드
    if (data && data.length > 0) {
      const { data: reads } = await supabase
        .from('notice_reads').select('*')
        .in('notice_id', data.map((n: any) => n.id))
      const rm: Record<string, any[]> = {}
      if (reads) reads.forEach((r: any) => { if (!rm[r.notice_id]) rm[r.notice_id] = []; rm[r.notice_id].push(r) })
      setNoticeReads(rm)
    }
  }

  async function loadTodoDates(sid: string) {
    const { data } = await supabase
      .from('notices').select('id, notice_date, notice_todos(id)')
      .eq('store_id', sid).eq('is_from_closing', false)
    const dates = new Set<string>()
    ;(data || []).forEach((n: any) => { if (n.notice_todos?.length > 0) dates.add(n.notice_date) })
    setTodoDates(dates)
  }

  async function loadDayTodos(sid: string, date: string) {
    const { data } = await supabase
      .from('notices').select('*, notice_todos(*)')
      .eq('store_id', sid).eq('notice_date', date).eq('is_from_closing', false)
      .order('created_at')
    setDayNotices(data || [])
    const allIds = (data || []).flatMap((n: any) => (n.notice_todos||[]).map((t: any) => t.id))
    if (allIds.length > 0) {
      const { data: chks } = await supabase.from('notice_todo_checks').select('*').in('todo_id', allIds)
      const tm: Record<string, any[]> = {}
      if (chks) chks.forEach((c: any) => { if (!tm[c.todo_id]) tm[c.todo_id] = []; tm[c.todo_id].push(c) })
      setNoticeTodoChecks(tm)
    } else { setNoticeTodoChecks({}) }
  }

  async function loadClosingTodos(sid: string, date: string) {
    const prev = new Date(date); prev.setDate(prev.getDate() - 1)
    const prevStr = toDateStr(prev)
    setClosingDateLabel(prevStr.replace(/-/g,'.'))
    const { data: closing } = await supabase.from('closings').select('id').eq('store_id', sid).eq('closing_date', prevStr).maybeSingle()
    if (!closing) { setClosingTodos([]); setClosingChecks({}); return }
    const { data: todos } = await supabase.from('closing_next_todos').select('*').eq('closing_id', closing.id).order('created_at')
    setClosingTodos(todos || [])
    if (todos && todos.length > 0) {
      const { data: chks } = await supabase.from('closing_next_todo_checks').select('*').in('todo_id', todos.map((t: any) => t.id))
      const tm: Record<string, any[]> = {}
      if (chks) chks.forEach((c: any) => { if (!tm[c.todo_id]) tm[c.todo_id] = []; tm[c.todo_id].push(c) })
      setClosingChecks(tm)
    } else { setClosingChecks({}) }
  }

  // ── 읽음 처리 ──
  async function markRead(noticeId: string) {
    const already = (noticeReads[noticeId]||[]).find((r: any) => r.read_by === userName)
    if (already) return
    const { data } = await supabase.from('notice_reads')
      .upsert({ notice_id: noticeId, read_by: userName, read_at: new Date().toISOString() }, { onConflict: 'notice_id,read_by' })
      .select().single()
    if (data) setNoticeReads(p => ({ ...p, [noticeId]: [...(p[noticeId]||[]), data] }))
  }

  function canCheckDate(date: string) {
    if (isOwner) return true
    return date === today
  }

  async function saveNotice() {
    if (!formTitle.trim()) { alert('제목을 입력해주세요'); return }
    setIsSaving(true)
    try {
      if (editingNotice) {
        await supabase.from('notices').update({ title: formTitle, content: formContent || null, is_pinned: formPinned }).eq('id', editingNotice.id)
      } else {
        await supabase.from('notices').insert({
          store_id: storeId, title: formTitle, content: formContent || null,
          notice_date: today, created_by: userName, is_from_closing: false, is_pinned: formPinned
        })
      }
      setShowNoticeForm(false); setFormTitle(''); setFormContent(''); setFormPinned(false); setEditingNotice(null)
      loadNotices(storeId)
    } catch (e: any) { alert('저장 실패: ' + e?.message) }
    finally { setIsSaving(false) }
  }

  async function deleteNotice(id: string) {
    if (!confirm('공지를 삭제할까요?')) return
    await supabase.from('notices').delete().eq('id', id)
    loadNotices(storeId)
  }

  async function saveTodo() {
    if (!formTodoTitle.trim()) { alert('제목을 입력해주세요'); return }
    const validTodos = formTodos.filter(t => t.trim())
    if (validTodos.length === 0) { alert('할일을 1개 이상 입력해주세요'); return }
    setIsSavingTodo(true)
    try {
      const { data, error } = await supabase.from('notices').insert({
        store_id: storeId, title: formTodoTitle, content: null,
        notice_date: selectedDate, created_by: userName, is_from_closing: false, is_pinned: false
      }).select().single()
      if (error) throw error
      await supabase.from('notice_todos').insert(validTodos.map(content => ({ notice_id: data.id, content, created_by: userName })))
      setShowTodoForm(false); setFormTodoTitle(''); setFormTodos([''])
      loadDayTodos(storeId, selectedDate); loadTodoDates(storeId)
    } catch (e: any) { alert('저장 실패: ' + e?.message) }
    finally { setIsSavingTodo(false) }
  }

  async function deleteTodoNotice(id: string) {
    if (!confirm('할일을 삭제할까요?')) return
    await supabase.from('notices').delete().eq('id', id)
    loadDayTodos(storeId, selectedDate); loadTodoDates(storeId)
  }

  async function toggleNoticeTodo(todoId: string, noticeDate: string) {
    if (!canCheckDate(noticeDate)) { alert('당일 할일만 체크할 수 있습니다.'); return }
    const myCheck = (noticeTodoChecks[todoId]||[]).find((c: any) => c.checked_by === userName)
    if (myCheck) {
      await supabase.from('notice_todo_checks').delete().eq('id', myCheck.id)
      setNoticeTodoChecks(p => ({ ...p, [todoId]: (p[todoId]||[]).filter((c: any) => c.id !== myCheck.id) }))
    } else {
      const { data } = await supabase.from('notice_todo_checks').insert({ todo_id: todoId, checked_by: userName, checked_at: new Date().toISOString() }).select().single()
      setNoticeTodoChecks(p => ({ ...p, [todoId]: [...(p[todoId]||[]), data] }))
    }
  }

  async function toggleClosingTodo(todoId: string) {
    if (!canCheckDate(selectedDate)) { alert('당일 전달사항만 체크할 수 있습니다.'); return }
    const myCheck = (closingChecks[todoId]||[]).find((c: any) => c.checked_by === userName)
    if (myCheck) {
      await supabase.from('closing_next_todo_checks').delete().eq('id', myCheck.id)
      setClosingChecks(p => ({ ...p, [todoId]: (p[todoId]||[]).filter((c: any) => c.id !== myCheck.id) }))
    } else {
      const { data } = await supabase.from('closing_next_todo_checks').insert({ todo_id: todoId, checked_by: userName, checked_at: new Date().toISOString() }).select().single()
      setClosingChecks(p => ({ ...p, [todoId]: [...(p[todoId]||[]), data] }))
    }
  }

  const tabBtn = (active: boolean) => ({
    flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer' as const,
    fontSize: 13, fontWeight: active ? 700 : 400,
    background: active ? '#fff' : 'transparent',
    color: active ? '#1a1a2e' : '#aaa',
    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
  })

  // 안 읽은 공지 수
  const unreadCount = notices.filter(n => !(noticeReads[n.id]||[]).find((r: any) => r.read_by === userName)).length

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:17, fontWeight:700, color:'#1a1a2e' }}>📢 공지</span>
          {unreadCount > 0 && subTab === 'notice' && (
            <span style={{ fontSize:10, padding:'2px 7px', borderRadius:10, background:'#FF6B35', color:'#fff', fontWeight:700 }}>
              {unreadCount} 안읽음
            </span>
          )}
        </div>
        {isManager && subTab === 'notice' && (
          <button onClick={() => { setShowNoticeForm(p=>!p); setEditingNotice(null); setFormTitle(''); setFormContent(''); setFormPinned(false) }}
            style={{ padding:'6px 14px', borderRadius:9, background:'rgba(108,92,231,0.1)', border:'1px solid rgba(108,92,231,0.3)', color:'#6C5CE7', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            {showNoticeForm ? '✕ 취소' : '+ 공지 작성'}
          </button>
        )}
        {isManager && subTab === 'todo' && (
          <button onClick={() => { setShowTodoForm(p=>!p); setFormTodoTitle(''); setFormTodos(['']) }}
            style={{ padding:'6px 14px', borderRadius:9, background:'rgba(108,92,231,0.1)', border:'1px solid rgba(108,92,231,0.3)', color:'#6C5CE7', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            {showTodoForm ? '✕ 취소' : '+ 할일 추가'}
          </button>
        )}
      </div>

      {/* 서브탭 */}
      <div style={{ display:'flex', background:'#F4F6F9', borderRadius:12, padding:4, marginBottom:14 }}>
        <button style={tabBtn(subTab==='notice')} onClick={() => setSubTab('notice')}>
          📢 공지 {unreadCount > 0 ? `(${unreadCount})` : ''}
        </button>
        <button style={tabBtn(subTab==='todo')} onClick={() => setSubTab('todo')}>✅ 할일</button>
      </div>

      {/* ══════ 공지 탭 ══════ */}
      {subTab === 'notice' && (
        <>
          {/* 공지 작성 폼 */}
          {showNoticeForm && (
            <div style={{ ...bx, border:'1px solid rgba(108,92,231,0.3)', background:'rgba(108,92,231,0.02)', marginBottom:12 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#6C5CE7', marginBottom:12 }}>
                {editingNotice ? '✏️ 공지 수정' : '✏️ 공지 작성'}
              </div>
              <button onClick={() => setFormPinned(p=>!p)}
                style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10, padding:'7px 12px', borderRadius:8, border:formPinned?'1px solid rgba(108,92,231,0.4)':'1px solid #E8ECF0', background:formPinned?'rgba(108,92,231,0.1)':'#F8F9FB', cursor:'pointer', width:'100%' }}>
                <span style={{ fontSize:13 }}>{formPinned ? '📌' : '📋'}</span>
                <span style={{ fontSize:12, color:formPinned?'#6C5CE7':'#888', fontWeight:formPinned?700:400 }}>
                  {formPinned ? '고정 공지 — 항상 최상단 표시' : '일반 공지 — 날짜순 표시'}
                </span>
              </button>
              <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="공지 제목" style={{ ...inp, marginBottom:8 }} />
              <textarea value={formContent} onChange={e => setFormContent(e.target.value)} placeholder="공지 내용 (선택사항)" rows={4}
                style={{ ...inp, resize:'none' as const, lineHeight:1.7, marginBottom:10 }} />
              <button onClick={saveNotice} disabled={isSaving}
                style={{ width:'100%', padding:'12px 0', borderRadius:12, background:isSaving?'#ddd':'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:14, fontWeight:700, cursor:isSaving?'not-allowed':'pointer' }}>
                {isSaving ? '저장 중...' : editingNotice ? '수정 저장' : '공지 등록'}
              </button>
            </div>
          )}

          {notices.length === 0 ? (
            <div style={{ ...bx, textAlign:'center', padding:32, color:'#bbb' }}>
              <div style={{ fontSize:24, marginBottom:8 }}>📭</div>
              <div style={{ fontSize:13 }}>등록된 공지가 없습니다</div>
              {isManager && <div style={{ fontSize:11, marginTop:4, color:'#aaa' }}>상단 "+ 공지 작성"으로 추가하세요</div>}
            </div>
          ) : (
            <>
              {notices.filter(n => n.is_pinned).length > 0 && (
                <div style={{ marginBottom:4 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#6C5CE7', marginBottom:6, paddingLeft:2 }}>📌 고정</div>
                  {notices.filter(n => n.is_pinned).map(notice => (
                    <NoticeCard key={notice.id} notice={notice} reads={noticeReads[notice.id]||[]}
                      myName={userName} isManager={isManager} onRead={markRead}
                      onEdit={n => { setEditingNotice(n); setFormTitle(n.title); setFormContent(n.content||''); setFormPinned(n.is_pinned); setShowNoticeForm(true) }}
                      onDelete={deleteNotice} />
                  ))}
                </div>
              )}
              {notices.filter(n => !n.is_pinned).length > 0 && (
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:'#aaa', marginBottom:6, paddingLeft:2 }}>📋 전체 공지</div>
                  {notices.filter(n => !n.is_pinned).map(notice => (
                    <NoticeCard key={notice.id} notice={notice} reads={noticeReads[notice.id]||[]}
                      myName={userName} isManager={isManager} onRead={markRead}
                      onEdit={n => { setEditingNotice(n); setFormTitle(n.title); setFormContent(n.content||''); setFormPinned(n.is_pinned); setShowNoticeForm(true) }}
                      onDelete={deleteNotice} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ══════ 할일 탭 ══════ */}
      {subTab === 'todo' && (
        <>
          {/* 전날 마감 전달사항 */}
          <div style={{ ...bx, border:closingTodos.length>0?'1px solid rgba(255,107,53,0.35)':'1px solid #E8ECF0', background:closingTodos.length>0?'rgba(255,107,53,0.02)':'#fff' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:closingTodos.length>0?12:0 }}>
              <span style={{ fontSize:13, fontWeight:700, color:'#FF6B35' }}>📢 마감 전달사항</span>
              <span style={{ fontSize:10, color:'#bbb' }}>{closingDateLabel} 마감</span>
              {closingTodos.length === 0 && <span style={{ fontSize:11, color:'#bbb', marginLeft:'auto' }}>전달사항 없음 ✓</span>}
            </div>
            {closingTodos.map((todo: any) => (
              <TodoItem key={todo.id} todo={todo} checks={closingChecks[todo.id]||[]}
                onToggle={() => toggleClosingTodo(todo.id)}
                canCheck={canCheckDate(selectedDate)} myName={userName} />
            ))}
          </div>

          {/* 할일 작성 폼 */}
          {showTodoForm && isManager && (
            <div style={{ ...bx, border:'1px solid rgba(108,92,231,0.3)', background:'rgba(108,92,231,0.02)' }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#6C5CE7', marginBottom:10 }}>✅ {selectedDate.replace(/-/g,'.')} 할일 추가</div>
              <input value={formTodoTitle} onChange={e => setFormTodoTitle(e.target.value)} placeholder="그룹명 (예: 오픈 준비)" style={{ ...inp, marginBottom:10 }} />
              <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>할일 항목</div>
              {formTodos.map((todo, i) => (
                <div key={i} style={{ display:'flex', gap:6, marginBottom:6 }}>
                  <input value={todo} onChange={e => { const n=[...formTodos]; n[i]=e.target.value; setFormTodos(n) }}
                    onKeyDown={e => e.key==='Enter' && setFormTodos([...formTodos,''])}
                    placeholder={`항목 ${i+1}`} style={{ ...inp, flex:1 }} />
                  {formTodos.length > 1 && (
                    <button onClick={() => setFormTodos(formTodos.filter((_,j)=>j!==i))}
                      style={{ padding:'8px 10px', borderRadius:8, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#bbb', cursor:'pointer', fontSize:13 }}>✕</button>
                  )}
                </div>
              ))}
              <button onClick={() => setFormTodos([...formTodos,''])}
                style={{ width:'100%', padding:'7px 0', borderRadius:8, border:'1px dashed #E8ECF0', background:'transparent', color:'#bbb', fontSize:12, cursor:'pointer', marginBottom:10 }}>
                + 항목 추가
              </button>
              <button onClick={saveTodo} disabled={isSavingTodo}
                style={{ width:'100%', padding:'11px 0', borderRadius:12, background:isSavingTodo?'#ddd':'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:isSavingTodo?'not-allowed':'pointer' }}>
                {isSavingTodo ? '저장 중...' : '할일 등록'}
              </button>
            </div>
          )}

          {/* 캘린더 */}
          <MiniCalendar year={calYear} month={calMonth} todoDates={todoDates} selectedDate={selectedDate}
            onSelectDate={d => { setSelectedDate(d); const [y,m]=d.split('-').map(Number); setCalYear(y); setCalMonth(m-1) }}
            onChangeMonth={(y,m) => { setCalYear(y); setCalMonth(m) }} />

          {/* 날짜별 할일 */}
          <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:10, paddingLeft:2 }}>
            {selectedDate.replace(/-/g,'.')} 할일
            {selectedDate === today && <span style={{ fontSize:10, color:'#FF6B35', background:'rgba(255,107,53,0.1)', padding:'1px 7px', borderRadius:6, marginLeft:6 }}>오늘</span>}
            {!canCheckDate(selectedDate) && <span style={{ fontSize:10, color:'#bbb', marginLeft:6 }}>당일만 체크 가능</span>}
          </div>

          {dayNotices.length === 0 ? (
            <div style={{ ...bx, textAlign:'center', padding:24, color:'#bbb' }}>
              <div style={{ fontSize:18, marginBottom:6 }}>✅</div>
              <div style={{ fontSize:13 }}>이 날짜에 등록된 할일이 없습니다</div>
              {isManager && <div style={{ fontSize:11, marginTop:4, color:'#aaa' }}>상단 "+ 할일 추가"로 등록하세요</div>}
            </div>
          ) : (
            dayNotices.map(notice => (
              <div key={notice.id} style={bx}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{notice.title}</div>
                    <div style={{ fontSize:10, color:'#bbb', marginTop:2 }}>{notice.created_by}</div>
                  </div>
                  {isManager && (
                    <button onClick={() => deleteTodoNotice(notice.id)}
                      style={{ fontSize:11, color:'#E84393', background:'none', border:'none', cursor:'pointer' }}>삭제</button>
                  )}
                </div>
                {(notice.notice_todos||[]).map((todo: any) => (
                  <TodoItem key={todo.id} todo={todo} checks={noticeTodoChecks[todo.id]||[]}
                    onToggle={() => toggleNoticeTodo(todo.id, notice.notice_date)}
                    canCheck={canCheckDate(notice.notice_date)} myName={userName} />
                ))}
              </div>
            ))
          )}
        </>
      )}
    </div>
  )
}