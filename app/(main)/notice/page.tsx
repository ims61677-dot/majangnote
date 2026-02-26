'use client'
import { useEffect, useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function NoticeCalendar({ year, month, todoDates, selectedDate, onSelectDate, onChangeMonth }: {
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
        <button onClick={() => month===0 ? onChangeMonth(year-1,11) : onChangeMonth(year,month-1)} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer', padding:'0 6px' }}>‹</button>
        <div style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>{year}년 {month+1}월</div>
        <button onClick={() => month===11 ? onChangeMonth(year+1,0) : onChangeMonth(year,month+1)} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer', padding:'0 6px' }}>›</button>
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
                <span style={{ fontSize:12, fontWeight: isSelected||isToday?700:400, color: isSelected?'#6C5CE7':di===0?'#E84393':di===6?'#2DC6D6':'#1a1a2e' }}>{day}</span>
                {hasTodo && <span style={{ width:4, height:4, borderRadius:'50%', background:'#6C5CE7', marginTop:2 }} />}
              </button>
            )
          })}
        </div>
      ))}
      <div style={{ display:'flex', gap:10, marginTop:8, paddingTop:8, borderTop:'1px solid #F0F0F0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:'#6C5CE7', display:'inline-block' }} />
          <span style={{ fontSize:9, color:'#aaa' }}>할일 있는 날</span>
        </div>
      </div>
    </div>
  )
}

export default function NoticePage() {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState('')
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const today = toDateStr(new Date())
  const [selectedDate, setSelectedDate] = useState(today)
  const nowD = new Date()
  const [calYear, setCalYear] = useState(nowD.getFullYear())
  const [calMonth, setCalMonth] = useState(nowD.getMonth())

  const [pinnedNotices, setPinnedNotices] = useState<any[]>([])
  const [selectedNotices, setSelectedNotices] = useState<any[]>([])
  const [todoDates, setTodoDates] = useState<Set<string>>(new Set())
  const [todoChecks, setTodoChecks] = useState<Record<string, any[]>>({})

  // 마감 전달사항
  const [closingTodos, setClosingTodos] = useState<any[]>([])
  const [closingTodoChecks, setClosingTodoChecks] = useState<Record<string, any[]>>({})
  const [closingDateLabel, setClosingDateLabel] = useState('')

  // 폼
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formTodos, setFormTodos] = useState<string[]>([''])
  const [formPinned, setFormPinned] = useState(false)
  const [editingNotice, setEditingNotice] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)

  const isManager = userRole === 'owner' || userRole === 'manager'
  const isOwner = userRole === 'owner'

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id)
    setUserName(user.nm || '')
    setUserRole(user.role || '')
    loadAll(store.id)
  }, [])

  useEffect(() => {
    if (!storeId) return
    loadSelectedNotices(storeId, selectedDate)
    loadClosingTodos(storeId, selectedDate)
  }, [selectedDate, storeId])

  async function loadAll(sid: string) {
    // 고정 공지
    const { data: pinned } = await supabase
      .from('notices').select('*, notice_todos(*)')
      .eq('store_id', sid).eq('is_pinned', true)
      .order('created_at', { ascending: false })
    setPinnedNotices(pinned || [])

    // 캘린더 점 - 할일 있는 날짜
    const { data: allN } = await supabase
      .from('notices').select('id, notice_date, notice_todos(id)')
      .eq('store_id', sid).eq('is_pinned', false)
    const dates = new Set<string>()
    ;(allN || []).forEach((n: any) => { if (n.notice_todos?.length > 0) dates.add(n.notice_date) })
    setTodoDates(dates)

    // 고정 공지 체크 로드
    const allIds = (pinned || []).flatMap((n: any) => (n.notice_todos||[]).map((t: any) => t.id))
    if (allIds.length > 0) {
      const { data: chks } = await supabase.from('notice_todo_checks').select('*').in('todo_id', allIds)
      const tm: Record<string, any[]> = {}
      if (chks) chks.forEach((c: any) => { if (!tm[c.todo_id]) tm[c.todo_id] = []; tm[c.todo_id].push(c) })
      setTodoChecks(tm)
    }
  }

  async function loadSelectedNotices(sid: string, date: string) {
    const { data } = await supabase
      .from('notices').select('*, notice_todos(*)')
      .eq('store_id', sid).eq('notice_date', date).eq('is_pinned', false)
      .order('created_at')
    setSelectedNotices(data || [])
    const allIds = (data || []).flatMap((n: any) => (n.notice_todos||[]).map((t: any) => t.id))
    if (allIds.length > 0) {
      const { data: chks } = await supabase.from('notice_todo_checks').select('*').in('todo_id', allIds)
      const tm: Record<string, any[]> = {}
      if (chks) chks.forEach((c: any) => { if (!tm[c.todo_id]) tm[c.todo_id] = []; tm[c.todo_id].push(c) })
      setTodoChecks(prev => ({ ...prev, ...tm }))
    }
  }

  // 전날 마감 전달사항 직접 로드
  async function loadClosingTodos(sid: string, date: string) {
    const prev = new Date(date)
    prev.setDate(prev.getDate() - 1)
    const prevStr = toDateStr(prev)
    setClosingDateLabel(prevStr.replace(/-/g,'.'))

    const { data: closing } = await supabase
      .from('closings').select('id')
      .eq('store_id', sid).eq('closing_date', prevStr).maybeSingle()

    if (!closing) { setClosingTodos([]); setClosingTodoChecks({}); return }

    const { data: todos } = await supabase
      .from('closing_next_todos').select('*')
      .eq('closing_id', closing.id).order('created_at')
    setClosingTodos(todos || [])

    if (todos && todos.length > 0) {
      const { data: chks } = await supabase
        .from('closing_next_todo_checks').select('*')
        .in('todo_id', todos.map((t: any) => t.id))
      const tm: Record<string, any[]> = {}
      if (chks) chks.forEach((c: any) => { if (!tm[c.todo_id]) tm[c.todo_id] = []; tm[c.todo_id].push(c) })
      setClosingTodoChecks(tm)
    } else { setClosingTodoChecks({}) }
  }

  function handleSelectDate(d: string) {
    setSelectedDate(d)
    const [y, m] = d.split('-').map(Number)
    setCalYear(y); setCalMonth(m - 1)
    setShowForm(false)
  }

  function canCheck(noticeDate: string) {
    if (isOwner) return true
    return noticeDate === today
  }

  async function toggleTodoCheck(todoId: string, noticeDate: string) {
    if (!canCheck(noticeDate)) { alert('당일 공지만 체크할 수 있습니다.'); return }
    const myCheck = (todoChecks[todoId]||[]).find((c: any) => c.checked_by === userName)
    if (myCheck) {
      await supabase.from('notice_todo_checks').delete().eq('id', myCheck.id)
      setTodoChecks(p => ({ ...p, [todoId]: (p[todoId]||[]).filter((c: any) => c.id !== myCheck.id) }))
    } else {
      const { data } = await supabase.from('notice_todo_checks').insert({ todo_id: todoId, checked_by: userName, checked_at: new Date().toISOString() }).select().single()
      setTodoChecks(p => ({ ...p, [todoId]: [...(p[todoId]||[]), data] }))
    }
  }

  async function toggleClosingTodoCheck(todoId: string) {
    if (!canCheck(selectedDate)) { alert('당일 전달사항만 체크할 수 있습니다.'); return }
    const myCheck = (closingTodoChecks[todoId]||[]).find((c: any) => c.checked_by === userName)
    if (myCheck) {
      await supabase.from('closing_next_todo_checks').delete().eq('id', myCheck.id)
      setClosingTodoChecks(p => ({ ...p, [todoId]: (p[todoId]||[]).filter((c: any) => c.id !== myCheck.id) }))
    } else {
      const { data } = await supabase.from('closing_next_todo_checks').insert({ todo_id: todoId, checked_by: userName, checked_at: new Date().toISOString() }).select().single()
      setClosingTodoChecks(p => ({ ...p, [todoId]: [...(p[todoId]||[]), data] }))
    }
  }

  async function saveNotice() {
    if (!formTitle.trim()) { alert('제목을 입력해주세요'); return }
    setIsSaving(true)
    try {
      let noticeId: string
      if (editingNotice) {
        await supabase.from('notices').update({ title: formTitle, content: formContent, is_pinned: formPinned }).eq('id', editingNotice.id)
        noticeId = editingNotice.id
        await supabase.from('notice_todos').delete().eq('notice_id', noticeId)
      } else {
        const { data, error } = await supabase.from('notices').insert({
          store_id: storeId, title: formTitle, content: formContent,
          notice_date: formPinned ? today : selectedDate,
          created_by: userName, is_from_closing: false, is_pinned: formPinned
        }).select().single()
        if (error) throw error
        noticeId = data.id
      }
      const valid = formTodos.filter(t => t.trim())
      if (valid.length > 0) await supabase.from('notice_todos').insert(valid.map(content => ({ notice_id: noticeId, content, created_by: userName })))
      setShowForm(false); setFormTitle(''); setFormContent(''); setFormTodos(['']); setFormPinned(false); setEditingNotice(null)
      loadAll(storeId); loadSelectedNotices(storeId, selectedDate)
    } catch (e: any) { alert('저장 실패: ' + e?.message) }
    finally { setIsSaving(false) }
  }

  async function deleteNotice(id: string) {
    if (!confirm('공지를 삭제할까요?')) return
    await supabase.from('notices').delete().eq('id', id)
    loadAll(storeId); loadSelectedNotices(storeId, selectedDate)
  }

  function startEdit(notice: any) {
    setEditingNotice(notice); setFormTitle(notice.title); setFormContent(notice.content||'')
    setFormTodos(notice.notice_todos?.map((t: any) => t.content)||['']); setFormPinned(notice.is_pinned||false)
    setShowForm(true)
  }

  function TodoItem({ todo, checks, onToggle, noticeDate }: { todo: any; checks: Record<string, any[]>; onToggle: (id: string) => void; noticeDate: string }) {
    const chks = checks[todo.id] || []
    const myChecked = chks.find((c: any) => c.checked_by === userName)
    const canChk = canCheck(noticeDate)
    return (
      <div style={{ borderRadius:10, border: myChecked?'1px solid rgba(0,184,148,0.3)':'1px solid #E8ECF0', background: myChecked?'rgba(0,184,148,0.04)':'#F8F9FB', marginBottom:6, overflow:'hidden' }}>
        <button onClick={() => onToggle(todo.id)}
          style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'none', border:'none', cursor: canChk?'pointer':'not-allowed', textAlign:'left' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:17, color: myChecked?'#00B894':'#ddd', lineHeight:1, flexShrink:0 }}>{myChecked?'✓':'○'}</span>
            <div>
              <div style={{ fontSize:13, color: myChecked?'#00B894':canChk?'#444':'#bbb', textDecoration: myChecked?'line-through':'none' }}>{todo.content}</div>
              {todo.created_by && todo.created_by !== 'system' && <div style={{ fontSize:10, color:'#bbb', marginTop:1 }}>작성: {todo.created_by}</div>}
            </div>
          </div>
          {!canChk && <span style={{ fontSize:9, color:'#bbb', flexShrink:0 }}>당일만</span>}
        </button>
        {chks.length > 0 && (
          <div style={{ padding:'6px 14px 10px', borderTop:'1px solid rgba(0,184,148,0.1)', background:'rgba(0,184,148,0.02)' }}>
            <div style={{ fontSize:9, color:'#00B894', fontWeight:700, marginBottom:3 }}>✓ 확인한 사람</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {chks.map((c: any) => (
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

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <span style={{ fontSize:17, fontWeight:700, color:'#1a1a2e' }}>📢 공지</span>
        {isManager && (
          <button onClick={() => { setShowForm(p=>!p); setEditingNotice(null); setFormTitle(''); setFormContent(''); setFormTodos(['']); setFormPinned(false) }}
            style={{ padding:'6px 14px', borderRadius:9, background:'rgba(108,92,231,0.1)', border:'1px solid rgba(108,92,231,0.3)', color:'#6C5CE7', fontSize:12, fontWeight:700, cursor:'pointer' }}>
            {showForm ? '✕ 취소' : '+ 공지 작성'}
          </button>
        )}
      </div>

      {/* 공지 작성 폼 */}
      {showForm && isManager && (
        <div style={{ ...bx, border:'1px solid rgba(108,92,231,0.3)', background:'rgba(108,92,231,0.02)', marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#6C5CE7', marginBottom:12 }}>{editingNotice ? '✏️ 공지 수정' : '✏️ 공지 작성'}</div>
          <button onClick={() => setFormPinned(p=>!p)}
            style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10, padding:'6px 12px', borderRadius:8, border: formPinned?'1px solid rgba(108,92,231,0.4)':'1px solid #E8ECF0', background: formPinned?'rgba(108,92,231,0.1)':'#F8F9FB', cursor:'pointer' }}>
            <span style={{ fontSize:12 }}>{formPinned?'📌':'📅'}</span>
            <span style={{ fontSize:12, color: formPinned?'#6C5CE7':'#888', fontWeight: formPinned?700:400 }}>
              {formPinned ? '고정 공지 (항상 상단 표시)' : `날짜별 공지 (${selectedDate.replace(/-/g,'.')})`}
            </span>
          </button>
          <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="공지 제목" style={{ ...inp, marginBottom:8 }} />
          <textarea value={formContent} onChange={e => setFormContent(e.target.value)} placeholder="공지 내용 (선택사항)" rows={3}
            style={{ ...inp, resize:'none' as const, lineHeight:1.6, marginBottom:10 }} />
          <div style={{ fontSize:11, fontWeight:700, color:'#6C5CE7', marginBottom:6 }}>✅ 할일 체크리스트 (선택)</div>
          {formTodos.map((todo, i) => (
            <div key={i} style={{ display:'flex', gap:6, marginBottom:6 }}>
              <input value={todo} onChange={e => { const n=[...formTodos]; n[i]=e.target.value; setFormTodos(n) }} placeholder={`할일 ${i+1}`} style={{ ...inp, flex:1 }} />
              {formTodos.length > 1 && <button onClick={() => setFormTodos(formTodos.filter((_,j)=>j!==i))} style={{ padding:'8px 10px', borderRadius:8, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#bbb', cursor:'pointer', fontSize:13 }}>✕</button>}
            </div>
          ))}
          <button onClick={() => setFormTodos([...formTodos,''])} style={{ width:'100%', padding:'7px 0', borderRadius:8, border:'1px dashed #E8ECF0', background:'transparent', color:'#bbb', fontSize:12, cursor:'pointer', marginBottom:12 }}>+ 할일 추가</button>
          <button onClick={saveNotice} disabled={isSaving}
            style={{ width:'100%', padding:'12px 0', borderRadius:12, background: isSaving?'#ddd':'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:14, fontWeight:700, cursor: isSaving?'not-allowed':'pointer' }}>
            {isSaving ? '저장 중...' : editingNotice ? '수정 저장' : '공지 등록'}
          </button>
        </div>
      )}

      {/* 📌 고정 공지 */}
      {pinnedNotices.length > 0 && (
        <div style={{ marginBottom:4 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#6C5CE7', marginBottom:6, paddingLeft:4 }}>📌 고정 공지</div>
          {pinnedNotices.map(notice => (
            <div key={notice.id} style={{ ...bx, border:'1px solid rgba(108,92,231,0.3)', background:'rgba(108,92,231,0.02)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'#1a1a2e', marginBottom:2 }}>{notice.title}</div>
                  <span style={{ fontSize:10, color:'#bbb' }}>{notice.created_by} · {new Date(notice.created_at).toLocaleDateString('ko')}</span>
                </div>
                {isManager && (
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => startEdit(notice)} style={{ fontSize:11, color:'#aaa', background:'none', border:'none', cursor:'pointer' }}>수정</button>
                    <button onClick={() => deleteNotice(notice.id)} style={{ fontSize:11, color:'#E84393', background:'none', border:'none', cursor:'pointer' }}>삭제</button>
                  </div>
                )}
              </div>
              {notice.content && <div style={{ fontSize:13, color:'#444', lineHeight:1.7, background:'#F8F9FB', borderRadius:10, padding:'10px 12px', marginBottom:notice.notice_todos?.length>0?10:0 }}>{notice.content}</div>}
              {notice.notice_todos?.length > 0 && (
                <div style={{ marginTop:8 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#6C5CE7', marginBottom:6 }}>✅ 할일</div>
                  {notice.notice_todos.map((todo: any) => <TodoItem key={todo.id} todo={todo} checks={todoChecks} onToggle={(id) => toggleTodoCheck(id, today)} noticeDate={today} />)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 캘린더 */}
      <NoticeCalendar year={calYear} month={calMonth} todoDates={todoDates} selectedDate={selectedDate}
        onSelectDate={handleSelectDate} onChangeMonth={(y,m) => { setCalYear(y); setCalMonth(m) }} />

      {/* 선택 날짜 헤더 */}
      <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:10, paddingLeft:4 }}>
        {selectedDate.replace(/-/g,'.')} 공지
        {selectedDate === today && <span style={{ fontSize:10, color:'#FF6B35', background:'rgba(255,107,53,0.1)', padding:'1px 7px', borderRadius:6, marginLeft:6 }}>오늘</span>}
      </div>

      {/* 📢 마감 전달사항 - 전날 마감에서 직접 */}
      {closingTodos.length > 0 && (
        <div style={{ ...bx, border:'1px solid rgba(255,107,53,0.35)', background:'rgba(255,107,53,0.02)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
            <span style={{ fontSize:9, padding:'2px 8px', borderRadius:4, background:'rgba(255,107,53,0.12)', color:'#FF6B35', fontWeight:700 }}>마감 전달사항</span>
            <span style={{ fontSize:12, color:'#888' }}>{closingDateLabel} 마감</span>
          </div>
          {closingTodos.map((todo: any) => (
            <TodoItem key={todo.id} todo={todo} checks={closingTodoChecks} onToggle={toggleClosingTodoCheck} noticeDate={selectedDate} />
          ))}
        </div>
      )}

      {/* 날짜별 공지 */}
      {selectedNotices.length === 0 && closingTodos.length === 0 ? (
        <div style={{ ...bx, textAlign:'center', padding:28, color:'#bbb' }}>
          <div style={{ fontSize:20, marginBottom:8 }}>📭</div>
          <div style={{ fontSize:13 }}>이 날짜에 공지가 없습니다</div>
          {isManager && <div style={{ fontSize:11, marginTop:6, color:'#aaa' }}>상단 "+ 공지 작성" 버튼으로 추가하세요</div>}
        </div>
      ) : (
        selectedNotices.map(notice => (
          <div key={notice.id} style={bx}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:'#1a1a2e', marginBottom:2 }}>{notice.title}</div>
                <span style={{ fontSize:10, color:'#bbb' }}>{notice.created_by} · {new Date(notice.created_at).toLocaleTimeString('ko',{hour:'2-digit',minute:'2-digit',hour12:false})}</span>
              </div>
              {isManager && (
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={() => startEdit(notice)} style={{ fontSize:11, color:'#aaa', background:'none', border:'none', cursor:'pointer' }}>수정</button>
                  <button onClick={() => deleteNotice(notice.id)} style={{ fontSize:11, color:'#E84393', background:'none', border:'none', cursor:'pointer' }}>삭제</button>
                </div>
              )}
            </div>
            {notice.content && <div style={{ fontSize:13, color:'#444', lineHeight:1.7, background:'#F8F9FB', borderRadius:10, padding:'10px 12px', marginBottom: notice.notice_todos?.length>0?10:0 }}>{notice.content}</div>}
            {notice.notice_todos?.length > 0 && (
              <div style={{ marginTop:8 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#6C5CE7', marginBottom:6 }}>✅ 할일</div>
                {notice.notice_todos.map((todo: any) => <TodoItem key={todo.id} todo={todo} checks={todoChecks} onToggle={(id) => toggleTodoCheck(id, notice.notice_date)} noticeDate={notice.notice_date} />)}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}