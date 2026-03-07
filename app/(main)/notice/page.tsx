'use client'
import { useEffect, useState, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import YearMonthPicker from '@/components/YearMonthPicker'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ── 직급별 보기 옵션 ──
const VISIBILITY_OPTIONS = [
  { value: 'all',     label: '👥 전체 보이기',    color: '#6C5CE7', desc: '모든 직원 열람 가능' },
  { value: 'manager', label: '👔 관리자만 보이기', color: '#FF6B35', desc: '관리자·대표만 열람' },
  { value: 'owner',   label: '👑 대표자만 보이기', color: '#E84393', desc: '대표만 열람' },
]
function canViewByVisibility(v: string | undefined, role: string) {
  if (!v || v === 'all') return true
  if (v === 'manager') return role === 'manager' || role === 'owner'
  if (v === 'owner') return role === 'owner'
  return true
}
function VisibilityBadge({ value }: { value?: string }) {
  if (!value || value === 'all') return null
  const opt = VISIBILITY_OPTIONS.find(o => o.value === value)
  if (!opt) return null
  return <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: `${opt.color}18`, color: opt.color, fontWeight: 700 }}>{opt.label}</span>
}

// ── 첨부파일 미리보기 ──
function AttachmentView({ url, type }: { url?: string; type?: string }) {
  if (!url) return null
  if (type === 'image') return (
    <div style={{ marginTop: 8 }}>
      <img src={url} alt="첨부 이미지"
        style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 10, objectFit: 'cover', cursor: 'pointer', border: '1px solid #E8ECF0' }}
        onClick={() => window.open(url, '_blank')} />
    </div>
  )
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '7px 14px', borderRadius: 9, background: 'rgba(108,92,231,0.07)', border: '1px solid rgba(108,92,231,0.2)', color: '#6C5CE7', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>
      🔗 링크 열기
    </a>
  )
}

// ── 첨부파일 입력 폼 ──
function AttachmentForm({ attachType, setAttachType, attachUrl, setAttachUrl, isUploading, onFileChange }: {
  attachType: 'none' | 'link' | 'image'
  setAttachType: (v: 'none' | 'link' | 'image') => void
  attachUrl: string
  setAttachUrl: (v: string) => void
  isUploading: boolean
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>첨부파일 (선택)</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {(['none', 'link', 'image'] as const).map(t => (
          <button key={t} onClick={() => setAttachType(t)}
            style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: attachType === t ? '1.5px solid #6C5CE7' : '1px solid #E8ECF0', background: attachType === t ? 'rgba(108,92,231,0.1)' : '#F4F6F9', color: attachType === t ? '#6C5CE7' : '#aaa', fontSize: 11, fontWeight: attachType === t ? 700 : 400, cursor: 'pointer' }}>
            {t === 'none' ? '없음' : t === 'link' ? '🔗 링크' : '🖼 이미지'}
          </button>
        ))}
      </div>
      {attachType === 'link' && (
        <input value={attachUrl} onChange={e => setAttachUrl(e.target.value)} placeholder="https://..." style={{ ...inp }} />
      )}
      {attachType === 'image' && (
        <div>
          <input type="file" accept="image/*" onChange={onFileChange} disabled={isUploading}
            style={{ ...inp, padding: '6px 10px', cursor: 'pointer' }} />
          {isUploading && <div style={{ fontSize: 11, color: '#6C5CE7', marginTop: 4 }}>⏳ 업로드 중...</div>}
          {attachUrl && <div style={{ fontSize: 11, color: '#00B894', marginTop: 4 }}>✅ 업로드 완료</div>}
        </div>
      )}
    </div>
  )
}

// ── 미니 캘린더 ──
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
      <div style={{ marginBottom: 10 }}>
        <YearMonthPicker year={year} month={month} onChange={onChangeMonth} color="#6C5CE7" />
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

// ── 할일 아이템 ──
function TodoItem({ todo, checks, onToggle, canCheck, myName, userRole }: {
  todo: any; checks: any[]; onToggle: () => void; canCheck: boolean; myName: string; userRole: string
}) {
  const myChecked = checks.find((c: any) => c.checked_by === myName)
  if (!canViewByVisibility(todo.visibility, userRole)) return null
  return (
    <div style={{ borderRadius:10, border:myChecked?'1px solid rgba(0,184,148,0.3)':'1px solid #E8ECF0', background:myChecked?'rgba(0,184,148,0.04)':'#F8F9FB', marginBottom:6, overflow:'hidden' }}>
      <button onClick={onToggle} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'none', border:'none', cursor:canCheck?'pointer':'not-allowed', textAlign:'left' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:17, color:myChecked?'#00B894':'#ddd', lineHeight:1, flexShrink:0 }}>{myChecked?'✓':'○'}</span>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              <div style={{ fontSize:13, color:myChecked?'#00B894':canCheck?'#444':'#bbb', textDecoration:myChecked?'line-through':'none' }}>{todo.content}</div>
              <VisibilityBadge value={todo.visibility} />
            </div>
            {todo.created_by && <div style={{ fontSize:10, color:'#bbb', marginTop:1 }}>작성: {todo.created_by}</div>}
          </div>
        </div>
        {!canCheck && <span style={{ fontSize:9, color:'#bbb', flexShrink:0 }}>당일만</span>}
      </button>
      {todo.attachment_url && (
        <div style={{ padding:'0 14px 10px' }}>
          <AttachmentView url={todo.attachment_url} type={todo.attachment_type} />
        </div>
      )}
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

// ── 미완료 이월 아이템 ──
function OverdueTodoItem({ todo, checks, onToggle, onMove, onDelete, myName, dayCount, isManager }: {
  todo: any; checks: any[]; onToggle: () => void; onMove: () => void; onDelete: () => void
  myName: string; dayCount: number; isManager: boolean
}) {
  const myChecked = checks.find((c: any) => c.checked_by === myName)
  const urgentColor = dayCount >= 3 ? '#E84393' : dayCount >= 2 ? '#FF6B35' : '#FDC400'
  return (
    <div style={{ borderRadius:10, border:`1px solid ${urgentColor}40`, background:myChecked?'rgba(0,184,148,0.04)':`${urgentColor}08`, marginBottom:6, overflow:'hidden' }}>
      <button onClick={onToggle} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'none', border:'none', cursor:'pointer', textAlign:'left' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
          <span style={{ fontSize:17, color:myChecked?'#00B894':'#ddd', lineHeight:1, flexShrink:0 }}>{myChecked?'✓':'○'}</span>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:13, color:myChecked?'#00B894':'#1a1a2e', textDecoration:myChecked?'line-through':'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{todo.content}</div>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
              <span style={{ fontSize:10, color:'#bbb' }}>원래: {todo.origin_date?.replace(/-/g,'.')}</span>
              <span style={{ fontSize:10, fontWeight:700, color: urgentColor, background:`${urgentColor}15`, padding:'1px 6px', borderRadius:6 }}>{dayCount}일째 미완료</span>
            </div>
          </div>
        </div>
        {isManager && (
          <div style={{ display:'flex', gap:6, flexShrink:0, marginLeft:8 }}>
            {!myChecked && (
              <button onClick={e => { e.stopPropagation(); onMove() }} style={{ fontSize:10, padding:'4px 8px', borderRadius:7, background:'rgba(108,92,231,0.1)', border:'1px solid rgba(108,92,231,0.3)', color:'#6C5CE7', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>이동</button>
            )}
            <button onClick={e => { e.stopPropagation(); onDelete() }} style={{ fontSize:10, padding:'4px 8px', borderRadius:7, background:'rgba(232,67,147,0.08)', border:'1px solid rgba(232,67,147,0.25)', color:'#E84393', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>삭제</button>
          </div>
        )}
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

// ── 공지 카드 ──
function NoticeCard({ notice, reads, myName, isManager, onRead, onEdit, onDelete }: {
  notice: any; reads: any[]; myName: string; isManager: boolean
  onRead: (id: string) => void; onEdit: (n: any) => void; onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const myRead = reads.find((r: any) => r.read_by === myName)
  function handleExpand() { setExpanded(p => !p); if (!myRead) onRead(notice.id) }
  return (
    <div style={{ ...bx, border: notice.is_pinned?'1px solid rgba(108,92,231,0.25)':'1px solid #E8ECF0', background: notice.is_pinned?'rgba(108,92,231,0.02)':'#fff' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <button onClick={handleExpand} style={{ flex:1, background:'none', border:'none', cursor:'pointer', textAlign:'left', padding:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4, flexWrap:'wrap' }}>
            {notice.is_pinned && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'rgba(108,92,231,0.12)', color:'#6C5CE7', fontWeight:700 }}>📌 고정</span>}
            {!myRead && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'rgba(255,107,53,0.12)', color:'#FF6B35', fontWeight:700 }}>NEW</span>}
            {notice.attachment_url && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'rgba(108,92,231,0.08)', color:'#6C5CE7' }}>{notice.attachment_type==='image'?'🖼':'🔗'}</span>}
            <span style={{ fontSize:14, fontWeight:700, color:'#1a1a2e' }}>{notice.title}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:10, color:'#bbb' }}>{notice.created_by} · {new Date(notice.created_at).toLocaleDateString('ko')}</span>
            <span style={{ fontSize:10, color: reads.length>0?'#00B894':'#bbb' }}>👁 {reads.length}명 확인</span>
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
      {expanded && (
        <div style={{ marginTop:12 }}>
          {notice.content && (
            <div style={{ fontSize:13, color:'#444', lineHeight:1.7, background:'#F8F9FB', borderRadius:10, padding:'10px 12px', marginBottom:12 }}>
              {notice.content}
            </div>
          )}
          {notice.attachment_url && (
            <div style={{ marginBottom: 12 }}>
              <AttachmentView url={notice.attachment_url} type={notice.attachment_type} />
            </div>
          )}
          <div style={{ background: reads.length>0?'rgba(0,184,148,0.04)':'#F8F9FB', borderRadius:10, padding:'10px 12px', border: reads.length>0?'1px solid rgba(0,184,148,0.2)':'1px solid #E8ECF0' }}>
            <div style={{ fontSize:11, fontWeight:700, color: reads.length>0?'#00B894':'#aaa', marginBottom: reads.length>0?8:0 }}>👁 읽음 확인 {reads.length}명</div>
            {reads.length > 0 ? (
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {reads.map((r: any) => (
                  <span key={r.id} style={{ fontSize:10, color:'#00B894', background:'rgba(0,184,148,0.1)', padding:'2px 8px', borderRadius:10 }}>
                    ✓ {r.read_by} · {new Date(r.read_at).toLocaleTimeString('ko',{hour:'2-digit',minute:'2-digit',hour12:false})}
                  </span>
                ))}
              </div>
            ) : <div style={{ fontSize:11, color:'#bbb' }}>아직 아무도 읽지 않았어요</div>}
          </div>
          {!myRead && (
            <button onClick={() => onRead(notice.id)} style={{ width:'100%', marginTop:10, padding:'10px 0', borderRadius:10, background:'rgba(0,184,148,0.1)', border:'1px solid rgba(0,184,148,0.3)', color:'#00B894', fontSize:13, fontWeight:700, cursor:'pointer' }}>
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

// ── 관리 탭 (대표 전용) ──
function AdminTab({ storeId, userName }: { storeId: string; userName: string }) {
  const supabase = createSupabaseBrowserClient()
  const [stores, setStores] = useState<any[]>([])
  const [selectedStoreId, setSelectedStoreId] = useState(storeId)
  const [allTodos, setAllTodos] = useState<{store: any; todos: any[]; checks: Record<string, any[]>}[]>([])
  const [loading, setLoading] = useState(true)
  // 개인 메모 (캘린더)
  const nowD = new Date()
  const [memoYear, setMemoYear] = useState(nowD.getFullYear())
  const [memoMonth, setMemoMonth] = useState(nowD.getMonth())
  const [memoSelectedDate, setMemoSelectedDate] = useState(toDateStr(nowD))
  const [personalMemos, setPersonalMemos] = useState<Record<string, string>>({})
  const [memoText, setMemoText] = useState('')
  const [savingMemo, setSavingMemo] = useState(false)
  const [activeSection, setActiveSection] = useState<'todos' | 'memo'>('todos')

  useEffect(() => { loadAdminData() }, [storeId])
  useEffect(() => {
    // 날짜 변경 시 해당 날 메모 로드
    setMemoText(personalMemos[memoSelectedDate] || '')
  }, [memoSelectedDate, personalMemos])

  async function loadAdminData() {
    setLoading(true)
    try {
      // 현재 유저가 소속된 모든 매장 로드 (store_members를 통해 접근)
      const { data: memberData } = await supabase
        .from('store_members')
        .select('store_id, role, stores(id, name)')
        .eq('role', 'owner')
      const storeList = (memberData || [])
        .map((m: any) => m.stores)
        .filter(Boolean)
        .filter((s: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === s.id) === i)

      if (storeList.length === 0) {
        // fallback: 현재 매장만
        const { data: storeData } = await supabase.from('stores').select('id, name').eq('id', storeId).maybeSingle()
        if (storeData) storeList.push(storeData)
      }
      setStores(storeList)

      // 각 매장의 최근 7일 미완료 할일 로드
      const results = []
      const today = toDateStr(new Date())
      for (const store of storeList) {
        const storeResults: any[] = []
        for (let i = 0; i <= 6; i++) {
          const d = new Date(); d.setDate(d.getDate() - i)
          const dateStr = toDateStr(d)
          const { data: notices } = await supabase
            .from('notices')
            .select('*, notice_todos(*)')
            .eq('store_id', store.id)
            .eq('notice_date', dateStr)
            .eq('is_from_closing', false)
          if (!notices) continue
          const allTodoIds = notices.flatMap((n: any) => (n.notice_todos || []).map((t: any) => t.id))
          if (allTodoIds.length === 0) continue
          const { data: chks } = await supabase.from('notice_todo_checks').select('*').in('todo_id', allTodoIds)
          const checkMap: Record<string, any[]> = {}
          if (chks) chks.forEach((c: any) => {
            if (!checkMap[c.todo_id]) checkMap[c.todo_id] = []
            checkMap[c.todo_id].push(c)
          })
          for (const notice of notices) {
            for (const todo of (notice.notice_todos || [])) {
              const todoChecks = checkMap[todo.id] || []
              storeResults.push({ ...todo, origin_date: dateStr, day_count: i, notice_title: notice.title, checks: todoChecks, isToday: dateStr === today, isDone: todoChecks.length > 0 })
            }
          }
        }
        results.push({ store, todos: storeResults, checks: {} })
      }
      setAllTodos(results)

      // 개인 메모 로드 (notices 테이블에서 type='personal_memo'로 저장)
      const { data: memos } = await supabase
        .from('notices')
        .select('notice_date, content')
        .eq('store_id', storeId)
        .eq('is_from_closing', false)
        .eq('title', '__PERSONAL_MEMO__')
      const memoMap: Record<string, string> = {}
      if (memos) memos.forEach((m: any) => { memoMap[m.notice_date] = m.content || '' })
      setPersonalMemos(memoMap)
    } catch (e) {
      console.error('Admin data load error:', e)
    }
    setLoading(false)
  }

  async function saveMemo() {
    if (!memoSelectedDate) return
    setSavingMemo(true)
    try {
      const existing = await supabase.from('notices').select('id').eq('store_id', storeId).eq('notice_date', memoSelectedDate).eq('title', '__PERSONAL_MEMO__').maybeSingle()
      if (existing.data) {
        await supabase.from('notices').update({ content: memoText }).eq('id', existing.data.id)
      } else {
        await supabase.from('notices').insert({ store_id: storeId, title: '__PERSONAL_MEMO__', content: memoText, notice_date: memoSelectedDate, created_by: userName, is_from_closing: false, is_pinned: false })
      }
      setPersonalMemos(p => ({ ...p, [memoSelectedDate]: memoText }))
    } catch (e) { console.error(e) }
    setSavingMemo(false)
  }

  const memoDates = new Set(Object.keys(personalMemos).filter(d => personalMemos[d]))

  const sectionBtn = (key: typeof activeSection, label: string) => ({
    flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer' as const,
    fontSize: 13, fontWeight: activeSection === key ? 700 : 400,
    background: activeSection === key ? '#fff' : 'transparent',
    color: activeSection === key ? '#1a1a2e' : '#aaa',
    boxShadow: activeSection === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
  })

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 48, color: '#bbb' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
      <div style={{ fontSize: 13 }}>전 지점 데이터 불러오는 중...</div>
    </div>
  )

  return (
    <div>
      {/* 섹션 탭 */}
      <div style={{ display: 'flex', background: '#F4F6F9', borderRadius: 12, padding: 4, marginBottom: 16 }}>
        <button style={sectionBtn('todos', '📋 전 지점 할일')} onClick={() => setActiveSection('todos')}>📋 전 지점 할일</button>
        <button style={sectionBtn('memo', '📅 내 스케줄 메모')} onClick={() => setActiveSection('memo')}>📅 내 스케줄 메모</button>
      </div>

      {/* 전 지점 할일 */}
      {activeSection === 'todos' && (
        <>
          {/* 매장 필터 */}
          {stores.length > 1 && (
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              <button onClick={() => setSelectedStoreId('')}
                style={{ padding: '6px 14px', borderRadius: 9, border: !selectedStoreId ? '1px solid rgba(108,92,231,0.4)' : '1px solid #E8ECF0', background: !selectedStoreId ? 'rgba(108,92,231,0.1)' : '#F4F6F9', color: !selectedStoreId ? '#6C5CE7' : '#888', fontSize: 12, fontWeight: !selectedStoreId ? 700 : 400, cursor: 'pointer' }}>
                전체 매장
              </button>
              {stores.map(s => (
                <button key={s.id} onClick={() => setSelectedStoreId(s.id)}
                  style={{ padding: '6px 14px', borderRadius: 9, border: selectedStoreId === s.id ? '1px solid rgba(108,92,231,0.4)' : '1px solid #E8ECF0', background: selectedStoreId === s.id ? 'rgba(108,92,231,0.1)' : '#F4F6F9', color: selectedStoreId === s.id ? '#6C5CE7' : '#888', fontSize: 12, fontWeight: selectedStoreId === s.id ? 700 : 400, cursor: 'pointer' }}>
                  {s.name}
                </button>
              ))}
            </div>
          )}

          {allTodos.filter(sd => !selectedStoreId || sd.store.id === selectedStoreId).map(({ store, todos }) => {
            const incompleteTodos = todos.filter(t => !t.isDone)
            const completedTodos = todos.filter(t => t.isDone)
            return (
              <div key={store.id} style={{ ...bx, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>🏪 {store.name}</span>
                    {incompleteTodos.length > 0 && (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'rgba(232,67,147,0.12)', color: '#E84393', fontWeight: 700 }}>{incompleteTodos.length}개 미완료</span>
                    )}
                    {incompleteTodos.length === 0 && todos.length > 0 && (
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'rgba(0,184,148,0.1)', color: '#00B894', fontWeight: 700 }}>✅ 모두 완료</span>
                    )}
                  </div>
                </div>

                {todos.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px 0', color: '#bbb', fontSize: 12 }}>최근 7일간 등록된 할일 없음</div>
                ) : (
                  <>
                    {incompleteTodos.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#E84393', marginBottom: 6 }}>⚠️ 미완료</div>
                        {incompleteTodos.map(todo => {
                          const urgentColor = todo.day_count >= 3 ? '#E84393' : todo.day_count >= 2 ? '#FF6B35' : todo.isToday ? '#6C5CE7' : '#FDC400'
                          return (
                            <div key={`${todo.id}-${todo.origin_date}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, background: `${urgentColor}06`, border: `1px solid ${urgentColor}25`, marginBottom: 4 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: urgentColor, background: `${urgentColor}15`, padding: '1px 6px', borderRadius: 6, flexShrink: 0 }}>
                                {todo.isToday ? '오늘' : `${todo.day_count}일째`}
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{todo.content}</div>
                                <div style={{ fontSize: 10, color: '#bbb', marginTop: 1 }}>{todo.notice_title} · {todo.origin_date?.replace(/-/g,'.')}</div>
                              </div>
                              <VisibilityBadge value={todo.visibility} />
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {completedTodos.length > 0 && (
                      <details>
                        <summary style={{ fontSize: 11, color: '#00B894', fontWeight: 700, cursor: 'pointer', marginBottom: 6, outline: 'none' }}>✅ 완료 {completedTodos.length}개 보기</summary>
                        {completedTodos.map(todo => (
                          <div key={`${todo.id}-done`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'rgba(0,184,148,0.04)', marginBottom: 3 }}>
                            <span style={{ fontSize: 12, color: '#00B894' }}>✓</span>
                            <span style={{ fontSize: 12, color: '#00B894', textDecoration: 'line-through', flex: 1 }}>{todo.content}</span>
                            <span style={{ fontSize: 10, color: '#bbb' }}>{todo.origin_date?.replace(/-/g,'.')}</span>
                          </div>
                        ))}
                      </details>
                    )}
                  </>
                )}
              </div>
            )
          })}

          {/* 제안사항 */}
          <div style={{ ...bx, background: 'rgba(108,92,231,0.03)', border: '1px dashed rgba(108,92,231,0.2)', marginTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6C5CE7', marginBottom: 8 }}>💡 관리 탭 고도화 제안</div>
            <div style={{ fontSize: 11, color: '#888', lineHeight: 1.8 }}>
              • <strong>매출 비교</strong>: 전 지점 오늘 매출을 한눈에 비교<br/>
              • <strong>공지 발송</strong>: 전 지점에 공지를 일괄 발송<br/>
              • <strong>직원 현황</strong>: 전 지점 오늘 출근 현황 통합 보기<br/>
              • <strong>재고 알림</strong>: 전 지점 부족 재고 통합 알림<br/>
              필요한 기능 추가 요청 주시면 반영해드릴게요! 😊
            </div>
          </div>
        </>
      )}

      {/* 스케줄 메모 */}
      {activeSection === 'memo' && (
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12, padding: '8px 12px', background: 'rgba(108,92,231,0.05)', borderRadius: 10, border: '1px solid rgba(108,92,231,0.1)' }}>
            📅 날짜를 선택하고 개인 스케줄 메모를 남겨보세요. 대표님만 볼 수 있습니다.
          </div>
          <MiniCalendar
            year={memoYear} month={memoMonth}
            todoDates={memoDates}
            selectedDate={memoSelectedDate}
            onSelectDate={d => setMemoSelectedDate(d)}
            onChangeMonth={(y, m) => { setMemoYear(y); setMemoMonth(m) }}
          />
          <div style={{ ...bx }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#6C5CE7', marginBottom: 10 }}>
              📝 {memoSelectedDate.replace(/-/g,'.')} 메모
            </div>
            <textarea
              value={memoText}
              onChange={e => setMemoText(e.target.value)}
              placeholder="이 날의 스케줄, 미팅, 할일 등을 자유롭게 기록하세요..."
              rows={5}
              style={{ ...inp, resize: 'none', lineHeight: 1.7, marginBottom: 10 }}
            />
            <button onClick={saveMemo} disabled={savingMemo}
              style={{ width: '100%', padding: '11px 0', borderRadius: 12, background: savingMemo ? '#ddd' : 'linear-gradient(135deg,#6C5CE7,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: savingMemo ? 'not-allowed' : 'pointer' }}>
              {savingMemo ? '저장 중...' : '💾 메모 저장'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════
// 메인 페이지
// ══════════════════════════════════════════
export default function NoticePage() {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState('')
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [isPC, setIsPC] = useState(false)
  const today = toDateStr(new Date())

  type SubTab = 'notice' | 'todo' | 'admin'
  const [subTab, setSubTab] = useState<SubTab>('notice')

  // ── 공지 상태 ──
  const [notices, setNotices] = useState<any[]>([])
  const [noticeReads, setNoticeReads] = useState<Record<string, any[]>>({})
  const [showNoticeForm, setShowNoticeForm] = useState(false)
  const [editingNotice, setEditingNotice] = useState<any>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formPinned, setFormPinned] = useState(false)
  const [formNoticeAttachType, setFormNoticeAttachType] = useState<'none'|'link'|'image'>('none')
  const [formNoticeAttachUrl, setFormNoticeAttachUrl] = useState('')
  const [isUploadingNoticeAttach, setIsUploadingNoticeAttach] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // ── 할일 상태 ──
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
  const [formTodoVisibility, setFormTodoVisibility] = useState('all')
  const [formTodoAttachType, setFormTodoAttachType] = useState<'none'|'link'|'image'>('none')
  const [formTodoAttachUrl, setFormTodoAttachUrl] = useState('')
  const [isUploadingTodoAttach, setIsUploadingTodoAttach] = useState(false)
  const [isSavingTodo, setIsSavingTodo] = useState(false)

  const [closingTodos, setClosingTodos] = useState<any[]>([])
  const [closingChecks, setClosingChecks] = useState<Record<string, any[]>>({})
  const [closingDateLabel, setClosingDateLabel] = useState('')

  const [overdueTodos, setOverdueTodos] = useState<any[]>([])
  const [overdueChecks, setOverdueChecks] = useState<Record<string, any[]>>({})

  const isManager = userRole === 'owner' || userRole === 'manager'
  const isOwner = userRole === 'owner'

  // ── PC 감지 ──
  useEffect(() => {
    const check = () => setIsPC(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id); setUserName(user.nm || ''); setUserRole(user.role || '')
    loadNotices(store.id); loadTodoDates(store.id); loadOverdueTodos(store.id)
  }, [])

  useEffect(() => {
    if (!storeId) return
    loadDayTodos(storeId, selectedDate)
    loadClosingTodos(storeId, selectedDate)
  }, [selectedDate, storeId])

  // ── 이미지 업로드 ──
  async function uploadImage(file: File, bucket = 'notice-attachments'): Promise<string> {
    const ext = file.name.split('.').pop()
    const path = `${storeId}/${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
    if (error) throw error
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
    return urlData.publicUrl
  }

  async function handleNoticeImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingNoticeAttach(true)
    try {
      const url = await uploadImage(file)
      setFormNoticeAttachUrl(url)
    } catch { alert('이미지 업로드 실패. 스토리지 버킷 설정을 확인해주세요.') }
    setIsUploadingNoticeAttach(false)
  }

  async function handleTodoImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingTodoAttach(true)
    try {
      const url = await uploadImage(file)
      setFormTodoAttachUrl(url)
    } catch { alert('이미지 업로드 실패. 스토리지 버킷 설정을 확인해주세요.') }
    setIsUploadingTodoAttach(false)
  }

  // ── 로드 함수들 ──
  async function loadNotices(sid: string) {
    const { data } = await supabase.from('notices').select('*').eq('store_id', sid).eq('is_from_closing', false)
      .order('is_pinned', { ascending: false }).order('created_at', { ascending: false })
    setNotices(data || [])
    if (data && data.length > 0) {
      const { data: reads } = await supabase.from('notice_reads').select('*').in('notice_id', data.map((n: any) => n.id))
      const rm: Record<string, any[]> = {}
      if (reads) reads.forEach((r: any) => { if (!rm[r.notice_id]) rm[r.notice_id] = []; rm[r.notice_id].push(r) })
      setNoticeReads(rm)
    }
  }

  async function loadTodoDates(sid: string) {
    const { data } = await supabase.from('notices').select('id, notice_date, notice_todos(id)').eq('store_id', sid).eq('is_from_closing', false)
    const dates = new Set<string>()
    ;(data || []).forEach((n: any) => { if (n.notice_todos?.length > 0) dates.add(n.notice_date) })
    setTodoDates(dates)
  }

  async function loadDayTodos(sid: string, date: string) {
    const { data } = await supabase.from('notices').select('*, notice_todos(*)').eq('store_id', sid).eq('notice_date', date).eq('is_from_closing', false).order('created_at')
    setDayNotices(data || [])
    const allIds = (data || []).flatMap((n: any) => (n.notice_todos||[]).map((t: any) => t.id))
    if (allIds.length > 0) {
      const { data: chks } = await supabase.from('notice_todo_checks').select('*').in('todo_id', allIds)
      const tm: Record<string, any[]> = {}
      if (chks) chks.forEach((c: any) => { if (!tm[c.todo_id]) tm[c.todo_id] = []; tm[c.todo_id].push(c) })
      setNoticeTodoChecks(tm)
    } else { setNoticeTodoChecks({}) }
  }

  async function loadOverdueTodos(sid: string) {
    const results: any[] = []
    for (let i = 1; i <= 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const dateStr = toDateStr(d)
      const { data } = await supabase.from('notices').select('*, notice_todos(*)').eq('store_id', sid).eq('notice_date', dateStr).eq('is_from_closing', false)
      if (!data) continue
      const allIds = data.flatMap((n: any) => (n.notice_todos||[]).map((t: any) => t.id))
      if (allIds.length === 0) continue
      const { data: chks } = await supabase.from('notice_todo_checks').select('*').in('todo_id', allIds)
      const checkMap: Record<string, any[]> = {}
      if (chks) chks.forEach((c: any) => { if (!checkMap[c.todo_id]) checkMap[c.todo_id] = []; checkMap[c.todo_id].push(c) })
      for (const notice of data) {
        for (const todo of (notice.notice_todos || [])) {
          if ((checkMap[todo.id]||[]).length === 0) {
            results.push({ ...todo, origin_date: dateStr, day_count: i, notice_title: notice.title })
          }
        }
      }
    }
    results.sort((a, b) => b.day_count - a.day_count)
    setOverdueTodos(results)
    const allIds = results.map(t => t.id)
    if (allIds.length > 0) {
      const { data: todayChks } = await supabase.from('notice_todo_checks').select('*').in('todo_id', allIds)
      const tm: Record<string, any[]> = {}
      if (todayChks) todayChks.forEach((c: any) => { if (!tm[c.todo_id]) tm[c.todo_id] = []; tm[c.todo_id].push(c) })
      setOverdueChecks(tm)
    }
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
      const { data: chks } = await supabase.from('closing_next_todo_checks').select('*').in('todo_id', todos.map((t:any) => t.id))
      const tm: Record<string, any[]> = {}
      if (chks) chks.forEach((c:any) => { if (!tm[c.todo_id]) tm[c.todo_id] = []; tm[c.todo_id].push(c) })
      setClosingChecks(tm)
    } else { setClosingChecks({}) }
  }

  async function markRead(noticeId: string) {
    const already = (noticeReads[noticeId]||[]).find((r: any) => r.read_by === userName)
    if (already) return
    const { data } = await supabase.from('notice_reads').upsert({ notice_id: noticeId, read_by: userName, read_at: new Date().toISOString() }, { onConflict: 'notice_id,read_by' }).select().single()
    if (data) setNoticeReads(p => ({ ...p, [noticeId]: [...(p[noticeId]||[]), data] }))
  }

  function canCheckDate(date: string) {
    if (isOwner) return true
    return date === today
  }

  async function toggleOverdueTodo(todoId: string) {
    const myCheck = (overdueChecks[todoId]||[]).find((c: any) => c.checked_by === userName)
    if (myCheck) {
      await supabase.from('notice_todo_checks').delete().eq('id', myCheck.id)
      setOverdueChecks(p => ({ ...p, [todoId]: (p[todoId]||[]).filter((c: any) => c.id !== myCheck.id) }))
    } else {
      const { data } = await supabase.from('notice_todo_checks').insert({ todo_id: todoId, checked_by: userName, checked_at: new Date().toISOString() }).select().single()
      if (data) setOverdueChecks(p => ({ ...p, [todoId]: [...(p[todoId]||[]), data] }))
    }
  }

  async function deleteOverdueTodo(todo: any) {
    if (!confirm(`"${todo.content}"을 삭제할까요?`)) return
    await supabase.from('notice_todos').delete().eq('id', todo.id)
    loadOverdueTodos(storeId)
  }

  async function moveTodoToToday(todo: any) {
    if (!confirm(`"${todo.content}"을 오늘 날짜로 이동할까요?`)) return
    let noticeId: string
    const { data: existing } = await supabase.from('notices').select('id').eq('store_id', storeId).eq('notice_date', today).eq('title', `[이월] ${todo.notice_title}`).maybeSingle()
    if (existing) {
      noticeId = existing.id
    } else {
      const { data: newNotice } = await supabase.from('notices').insert({ store_id: storeId, title: `[이월] ${todo.notice_title}`, content: null, notice_date: today, created_by: userName, is_from_closing: false, is_pinned: false }).select().single()
      noticeId = newNotice.id
    }
    await supabase.from('notice_todos').insert({ notice_id: noticeId, content: todo.content, created_by: todo.created_by })
    loadDayTodos(storeId, today); loadTodoDates(storeId); loadOverdueTodos(storeId)
    alert('오늘 날짜로 이동됐어요!')
  }

  async function saveNotice() {
    if (!formTitle.trim()) { alert('제목을 입력해주세요'); return }
    setIsSaving(true)
    try {
      const attachUrl = formNoticeAttachType !== 'none' ? formNoticeAttachUrl : null
      const attachType = formNoticeAttachType !== 'none' ? formNoticeAttachType : null
      if (editingNotice) {
        await supabase.from('notices').update({ title: formTitle, content: formContent || null, is_pinned: formPinned, attachment_url: attachUrl, attachment_type: attachType }).eq('id', editingNotice.id)
      } else {
        await supabase.from('notices').insert({ store_id: storeId, title: formTitle, content: formContent || null, notice_date: today, created_by: userName, is_from_closing: false, is_pinned: formPinned, attachment_url: attachUrl, attachment_type: attachType })
      }
      setShowNoticeForm(false); setFormTitle(''); setFormContent(''); setFormPinned(false)
      setFormNoticeAttachType('none'); setFormNoticeAttachUrl(''); setEditingNotice(null)
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
      const attachUrl = formTodoAttachType !== 'none' ? formTodoAttachUrl : null
      const attachType = formTodoAttachType !== 'none' ? formTodoAttachType : null
      await supabase.from('notice_todos').insert(
        validTodos.map(content => ({
          notice_id: data.id, content, created_by: userName,
          visibility: formTodoVisibility,
          attachment_url: attachUrl,
          attachment_type: attachType,
        }))
      )
      setShowTodoForm(false); setFormTodoTitle(''); setFormTodos([''])
      setFormTodoVisibility('all'); setFormTodoAttachType('none'); setFormTodoAttachUrl('')
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
    background: active ? '#fff' : 'transparent', color: active ? '#1a1a2e' : '#aaa',
    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
  })

  const unreadCount = notices.filter(n => !(noticeReads[n.id]||[]).find((r: any) => r.read_by === userName) && n.title !== '__PERSONAL_MEMO__').length
  const overdueCount = overdueTodos.filter(t => (overdueChecks[t.id]||[]).length === 0).length

  // ── 공지 폼 ──
  const noticeForm = showNoticeForm && (
    <div style={{ ...bx, border:'1px solid rgba(108,92,231,0.3)', background:'rgba(108,92,231,0.02)', marginBottom:12 }}>
      <div style={{ fontSize:13, fontWeight:700, color:'#6C5CE7', marginBottom:12 }}>{editingNotice ? '✏️ 공지 수정' : '✏️ 공지 작성'}</div>
      <button onClick={() => setFormPinned(p=>!p)} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10, padding:'7px 12px', borderRadius:8, border:formPinned?'1px solid rgba(108,92,231,0.4)':'1px solid #E8ECF0', background:formPinned?'rgba(108,92,231,0.1)':'#F8F9FB', cursor:'pointer', width:'100%' }}>
        <span style={{ fontSize:13 }}>{formPinned ? '📌' : '📋'}</span>
        <span style={{ fontSize:12, color:formPinned?'#6C5CE7':'#888', fontWeight:formPinned?700:400 }}>{formPinned ? '고정 공지 — 항상 최상단 표시' : '일반 공지 — 날짜순 표시'}</span>
      </button>
      <input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="공지 제목" style={{ ...inp, marginBottom:8 }} />
      <textarea value={formContent} onChange={e => setFormContent(e.target.value)} placeholder="공지 내용 (선택사항)" rows={4} style={{ ...inp, resize:'none' as const, lineHeight:1.7, marginBottom:10 }} />
      <AttachmentForm
        attachType={formNoticeAttachType} setAttachType={setFormNoticeAttachType}
        attachUrl={formNoticeAttachUrl} setAttachUrl={setFormNoticeAttachUrl}
        isUploading={isUploadingNoticeAttach} onFileChange={handleNoticeImageUpload}
      />
      <button onClick={saveNotice} disabled={isSaving} style={{ width:'100%', padding:'12px 0', borderRadius:12, background:isSaving?'#ddd':'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:14, fontWeight:700, cursor:isSaving?'not-allowed':'pointer' }}>
        {isSaving ? '저장 중...' : editingNotice ? '수정 저장' : '공지 등록'}
      </button>
    </div>
  )

  // ── 할일 폼 ──
  const todoForm = showTodoForm && isManager && (
    <div style={{ ...bx, border:'1px solid rgba(108,92,231,0.3)', background:'rgba(108,92,231,0.02)' }}>
      <div style={{ fontSize:13, fontWeight:700, color:'#6C5CE7', marginBottom:10 }}>✅ {selectedDate.replace(/-/g,'.')} 할일 추가</div>
      <input value={formTodoTitle} onChange={e => setFormTodoTitle(e.target.value)} placeholder="그룹명 (예: 오픈 준비)" style={{ ...inp, marginBottom:10 }} />
      {/* 직급별 보기 설정 */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>직급별 공개 범위</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {VISIBILITY_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setFormTodoVisibility(opt.value)}
              style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: formTodoVisibility === opt.value ? `1.5px solid ${opt.color}` : '1px solid #E8ECF0', background: formTodoVisibility === opt.value ? `${opt.color}12` : '#F4F6F9', color: formTodoVisibility === opt.value ? opt.color : '#aaa', fontSize: 10, fontWeight: formTodoVisibility === opt.value ? 700 : 400, cursor: 'pointer', textAlign: 'center' }}>
              {opt.label}
            </button>
          ))}
        </div>
        {formTodoVisibility !== 'all' && (
          <div style={{ fontSize: 10, color: VISIBILITY_OPTIONS.find(o => o.value === formTodoVisibility)?.color, marginTop: 4 }}>
            {VISIBILITY_OPTIONS.find(o => o.value === formTodoVisibility)?.desc}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color:'#888', marginBottom:6 }}>할일 항목</div>
      {formTodos.map((todo, i) => (
        <div key={i} style={{ display:'flex', gap:6, marginBottom:6 }}>
          <input value={todo} onChange={e => { const n=[...formTodos]; n[i]=e.target.value; setFormTodos(n) }} onKeyDown={e => e.key==='Enter' && setFormTodos([...formTodos,''])} placeholder={`항목 ${i+1}`} style={{ ...inp, flex:1 }} />
          {formTodos.length > 1 && <button onClick={() => setFormTodos(formTodos.filter((_,j)=>j!==i))} style={{ padding:'8px 10px', borderRadius:8, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#bbb', cursor:'pointer', fontSize:13 }}>✕</button>}
        </div>
      ))}
      <button onClick={() => setFormTodos([...formTodos,''])} style={{ width:'100%', padding:'7px 0', borderRadius:8, border:'1px dashed #E8ECF0', background:'transparent', color:'#bbb', fontSize:12, cursor:'pointer', marginBottom:10 }}>+ 항목 추가</button>
      {/* 첨부파일 */}
      <AttachmentForm
        attachType={formTodoAttachType} setAttachType={setFormTodoAttachType}
        attachUrl={formTodoAttachUrl} setAttachUrl={setFormTodoAttachUrl}
        isUploading={isUploadingTodoAttach} onFileChange={handleTodoImageUpload}
      />
      <button onClick={saveTodo} disabled={isSavingTodo} style={{ width:'100%', padding:'11px 0', borderRadius:12, background:isSavingTodo?'#ddd':'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:isSavingTodo?'not-allowed':'pointer' }}>
        {isSavingTodo ? '저장 중...' : '할일 등록'}
      </button>
    </div>
  )

  // ── 공지 탭 콘텐츠 ──
  const noticeTabContent = (
    <>
      {overdueCount > 0 && (
        <div style={{ ...bx, border:'1px solid rgba(232,67,147,0.3)', background:'rgba(232,67,147,0.02)', marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:13, fontWeight:700, color:'#E84393' }}>⚠️ 미완료 할일</span>
              <span style={{ fontSize:10, padding:'2px 7px', borderRadius:8, background:'rgba(232,67,147,0.12)', color:'#E84393', fontWeight:700 }}>{overdueCount}개</span>
            </div>
            <button onClick={() => setSubTab('todo')} style={{ fontSize:11, color:'#6C5CE7', background:'rgba(108,92,231,0.08)', border:'1px solid rgba(108,92,231,0.2)', borderRadius:7, padding:'3px 9px', cursor:'pointer', fontWeight:700 }}>
              할일 탭에서 보기 →
            </button>
          </div>
          {overdueTodos.filter(t => (overdueChecks[t.id]||[]).length === 0).slice(0, 5).map(todo => {
            const urgentColor = todo.day_count >= 3 ? '#E84393' : todo.day_count >= 2 ? '#FF6B35' : '#FDC400'
            return (
              <div key={`${todo.id}-${todo.origin_date}`} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom:'1px solid #F4F6F9' }}>
                <span style={{ fontSize:11, fontWeight:700, color: urgentColor, background:`${urgentColor}15`, padding:'1px 6px', borderRadius:6, flexShrink:0 }}>{todo.day_count}일째</span>
                <span style={{ fontSize:13, color:'#1a1a2e', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{todo.content}</span>
                <span style={{ fontSize:10, color:'#bbb', flexShrink:0 }}>{todo.origin_date?.replace(/-/g,'.')}</span>
              </div>
            )
          })}
          {overdueCount > 5 && <div style={{ fontSize:11, color:'#bbb', textAlign:'center', paddingTop:8 }}>외 {overdueCount - 5}개 더...</div>}
        </div>
      )}
      {noticeForm}
      {notices.filter(n => n.title !== '__PERSONAL_MEMO__').length === 0 ? (
        <div style={{ ...bx, textAlign:'center', padding:32, color:'#bbb' }}>
          <div style={{ fontSize:24, marginBottom:8 }}>📭</div>
          <div style={{ fontSize:13 }}>등록된 공지가 없습니다</div>
          {isManager && <div style={{ fontSize:11, marginTop:4, color:'#aaa' }}>상단 "+ 공지 작성"으로 추가하세요</div>}
        </div>
      ) : (
        <>
          {notices.filter(n => n.is_pinned && n.title !== '__PERSONAL_MEMO__').length > 0 && (
            <div style={{ marginBottom:4 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#6C5CE7', marginBottom:6, paddingLeft:2 }}>📌 고정</div>
              {notices.filter(n => n.is_pinned && n.title !== '__PERSONAL_MEMO__').map(notice => (
                <NoticeCard key={notice.id} notice={notice} reads={noticeReads[notice.id]||[]} myName={userName} isManager={isManager} onRead={markRead}
                  onEdit={n => { setEditingNotice(n); setFormTitle(n.title); setFormContent(n.content||''); setFormPinned(n.is_pinned); setFormNoticeAttachType(n.attachment_type||'none'); setFormNoticeAttachUrl(n.attachment_url||''); setShowNoticeForm(true) }}
                  onDelete={deleteNotice} />
              ))}
            </div>
          )}
          {notices.filter(n => !n.is_pinned && n.title !== '__PERSONAL_MEMO__').length > 0 && (
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#aaa', marginBottom:6, paddingLeft:2 }}>📋 전체 공지</div>
              {notices.filter(n => !n.is_pinned && n.title !== '__PERSONAL_MEMO__').map(notice => (
                <NoticeCard key={notice.id} notice={notice} reads={noticeReads[notice.id]||[]} myName={userName} isManager={isManager} onRead={markRead}
                  onEdit={n => { setEditingNotice(n); setFormTitle(n.title); setFormContent(n.content||''); setFormPinned(n.is_pinned); setFormNoticeAttachType(n.attachment_type||'none'); setFormNoticeAttachUrl(n.attachment_url||''); setShowNoticeForm(true) }}
                  onDelete={deleteNotice} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  )

  // ── 할일 탭 콘텐츠 ──
  const todoTabContent = (
    <>
      {overdueTodos.length > 0 && (
        <div style={{ ...bx, border:'1px solid rgba(232,67,147,0.3)', background:'rgba(232,67,147,0.02)', marginBottom:14 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
            <span style={{ fontSize:13, fontWeight:700, color:'#E84393' }}>⚠️ 미완료 이월</span>
            <span style={{ fontSize:10, padding:'2px 7px', borderRadius:8, background:'rgba(232,67,147,0.12)', color:'#E84393', fontWeight:700 }}>{overdueCount}개 미완료</span>
          </div>
          {overdueTodos.map(todo => (
            <OverdueTodoItem
              key={`${todo.id}-${todo.origin_date}`}
              todo={todo} checks={overdueChecks[todo.id]||[]}
              onToggle={() => toggleOverdueTodo(todo.id)}
              onMove={() => moveTodoToToday(todo)}
              onDelete={() => deleteOverdueTodo(todo)}
              myName={userName} dayCount={todo.day_count} isManager={isManager}
            />
          ))}
        </div>
      )}
      <div style={{ ...bx, border: closingTodos.length>0?'1px solid rgba(255,107,53,0.35)':'1px solid #E8ECF0', background: closingTodos.length>0?'rgba(255,107,53,0.02)':'#fff' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:closingTodos.length>0?12:0 }}>
          <span style={{ fontSize:13, fontWeight:700, color:'#FF6B35' }}>📢 마감 전달사항</span>
          <span style={{ fontSize:10, color:'#bbb' }}>{closingDateLabel} 마감</span>
          {closingTodos.length === 0 && <span style={{ fontSize:11, color:'#bbb', marginLeft:'auto' }}>전달사항 없음 ✓</span>}
        </div>
        {closingTodos.map((todo: any) => (
          <TodoItem key={todo.id} todo={todo} checks={closingChecks[todo.id]||[]} onToggle={() => toggleClosingTodo(todo.id)} canCheck={canCheckDate(selectedDate)} myName={userName} userRole={userRole} />
        ))}
      </div>
      {todoForm}
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
      ) : dayNotices.map(notice => (
        <div key={notice.id} style={bx}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{notice.title}</div>
              <div style={{ fontSize:10, color:'#bbb', marginTop:2 }}>{notice.created_by}</div>
            </div>
            {isManager && <button onClick={() => deleteTodoNotice(notice.id)} style={{ fontSize:11, color:'#E84393', background:'none', border:'none', cursor:'pointer' }}>삭제</button>}
          </div>
          {(notice.notice_todos||[])
            .filter((todo: any) => canViewByVisibility(todo.visibility, userRole))
            .map((todo: any) => (
              <TodoItem key={todo.id} todo={todo} checks={noticeTodoChecks[todo.id]||[]} onToggle={() => toggleNoticeTodo(todo.id, notice.notice_date)} canCheck={canCheckDate(notice.notice_date)} myName={userName} userRole={userRole} />
            ))}
        </div>
      ))}
    </>
  )

  // ── 탭 바 ──
  const tabBar = (
    <div style={{ display:'flex', background:'#F4F6F9', borderRadius:12, padding:4, marginBottom:14 }}>
      <button style={tabBtn(subTab==='notice')} onClick={() => setSubTab('notice')}>
        📢 공지 {unreadCount > 0 ? `(${unreadCount})` : ''}
      </button>
      <button style={tabBtn(subTab==='todo')} onClick={() => setSubTab('todo')}>
        ✅ 할일 {overdueCount > 0 ? `(${overdueCount} 미완료)` : ''}
      </button>
      {isOwner && (
        <button style={tabBtn(subTab==='admin')} onClick={() => setSubTab('admin')}>
          👑 관리
        </button>
      )}
    </div>
  )

  // ── 액션 버튼 ──
  const actionButton = (
    <>
      {isManager && subTab === 'notice' && (
        <button onClick={() => { setShowNoticeForm(p=>!p); setEditingNotice(null); setFormTitle(''); setFormContent(''); setFormPinned(false); setFormNoticeAttachType('none'); setFormNoticeAttachUrl('') }}
          style={{ padding:'6px 14px', borderRadius:9, background:'rgba(108,92,231,0.1)', border:'1px solid rgba(108,92,231,0.3)', color:'#6C5CE7', fontSize:12, fontWeight:700, cursor:'pointer' }}>
          {showNoticeForm ? '✕ 취소' : '+ 공지 작성'}
        </button>
      )}
      {isManager && subTab === 'todo' && (
        <button onClick={() => { setShowTodoForm(p=>!p); setFormTodoTitle(''); setFormTodos(['']); setFormTodoVisibility('all'); setFormTodoAttachType('none'); setFormTodoAttachUrl('') }}
          style={{ padding:'6px 14px', borderRadius:9, background:'rgba(108,92,231,0.1)', border:'1px solid rgba(108,92,231,0.3)', color:'#6C5CE7', fontSize:12, fontWeight:700, cursor:'pointer' }}>
          {showTodoForm ? '✕ 취소' : '+ 할일 추가'}
        </button>
      )}
    </>
  )

  // ══ PC 레이아웃 ══
  if (isPC) {
    return (
      <div>
        {/* 헤더 - 1번만 렌더 */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:20, fontWeight:700, color:'#1a1a2e' }}>📢 공지</span>
            {unreadCount > 0 && subTab === 'notice' && (
              <span style={{ fontSize:10, padding:'2px 7px', borderRadius:10, background:'#FF6B35', color:'#fff', fontWeight:700 }}>{unreadCount} 안읽음</span>
            )}
          </div>
          {actionButton}
        </div>

        {tabBar}

        {/* 관리 탭: 풀 스크린 */}
        {subTab === 'admin' && isOwner && (
          <AdminTab storeId={storeId} userName={userName} />
        )}

        {/* 공지 탭: 풀 너비 */}
        {subTab === 'notice' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0 }}>
            {noticeTabContent}
          </div>
        )}

        {/* 할일 탭: 캘린더 + 콘텐츠 2컬럼 */}
        {subTab === 'todo' && (
          <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:20, alignItems:'start' }}>
            {/* 좌: 캘린더 (sticky) */}
            <div style={{ position:'sticky', top:80 }}>
              <MiniCalendar
                year={calYear} month={calMonth}
                todoDates={todoDates} selectedDate={selectedDate}
                onSelectDate={d => { setSelectedDate(d); const [y,m]=d.split('-').map(Number); setCalYear(y); setCalMonth(m-1) }}
                onChangeMonth={(y,m) => { setCalYear(y); setCalMonth(m) }}
              />
            </div>
            {/* 우: 할일 목록 */}
            <div>{todoTabContent}</div>
          </div>
        )}
      </div>
    )
  }

  // ══ 모바일 레이아웃 ══
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:17, fontWeight:700, color:'#1a1a2e' }}>📢 공지</span>
          {unreadCount > 0 && subTab === 'notice' && (
            <span style={{ fontSize:10, padding:'2px 7px', borderRadius:10, background:'#FF6B35', color:'#fff', fontWeight:700 }}>{unreadCount} 안읽음</span>
          )}
        </div>
        {actionButton}
      </div>

      {tabBar}

      {subTab === 'notice' && noticeTabContent}

      {subTab === 'todo' && (
        <>
          {overdueTodos.length > 0 && (
            <div style={{ ...bx, border:'1px solid rgba(232,67,147,0.3)', background:'rgba(232,67,147,0.02)', marginBottom:14 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <span style={{ fontSize:13, fontWeight:700, color:'#E84393' }}>⚠️ 미완료 이월</span>
                <span style={{ fontSize:10, padding:'2px 7px', borderRadius:8, background:'rgba(232,67,147,0.12)', color:'#E84393', fontWeight:700 }}>{overdueCount}개 미완료</span>
              </div>
              {overdueTodos.map(todo => (
                <OverdueTodoItem
                  key={`${todo.id}-${todo.origin_date}`}
                  todo={todo} checks={overdueChecks[todo.id]||[]}
                  onToggle={() => toggleOverdueTodo(todo.id)}
                  onMove={() => moveTodoToToday(todo)}
                  onDelete={() => deleteOverdueTodo(todo)}
                  myName={userName} dayCount={todo.day_count} isManager={isManager}
                />
              ))}
            </div>
          )}
          <div style={{ ...bx, border: closingTodos.length>0?'1px solid rgba(255,107,53,0.35)':'1px solid #E8ECF0', background: closingTodos.length>0?'rgba(255,107,53,0.02)':'#fff' }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:closingTodos.length>0?12:0 }}>
              <span style={{ fontSize:13, fontWeight:700, color:'#FF6B35' }}>📢 마감 전달사항</span>
              <span style={{ fontSize:10, color:'#bbb' }}>{closingDateLabel} 마감</span>
              {closingTodos.length === 0 && <span style={{ fontSize:11, color:'#bbb', marginLeft:'auto' }}>전달사항 없음 ✓</span>}
            </div>
            {closingTodos.map((todo: any) => (
              <TodoItem key={todo.id} todo={todo} checks={closingChecks[todo.id]||[]} onToggle={() => toggleClosingTodo(todo.id)} canCheck={canCheckDate(selectedDate)} myName={userName} userRole={userRole} />
            ))}
          </div>
          {todoForm}
          <MiniCalendar
            year={calYear} month={calMonth}
            todoDates={todoDates} selectedDate={selectedDate}
            onSelectDate={d => { setSelectedDate(d); const [y,m]=d.split('-').map(Number); setCalYear(y); setCalMonth(m-1) }}
            onChangeMonth={(y,m) => { setCalYear(y); setCalMonth(m) }}
          />
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
          ) : dayNotices.map(notice => (
            <div key={notice.id} style={bx}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{notice.title}</div>
                  <div style={{ fontSize:10, color:'#bbb', marginTop:2 }}>{notice.created_by}</div>
                </div>
                {isManager && <button onClick={() => deleteTodoNotice(notice.id)} style={{ fontSize:11, color:'#E84393', background:'none', border:'none', cursor:'pointer' }}>삭제</button>}
              </div>
              {(notice.notice_todos||[])
                .filter((todo: any) => canViewByVisibility(todo.visibility, userRole))
                .map((todo: any) => (
                  <TodoItem key={todo.id} todo={todo} checks={noticeTodoChecks[todo.id]||[]} onToggle={() => toggleNoticeTodo(todo.id, notice.notice_date)} canCheck={canCheckDate(notice.notice_date)} myName={userName} userRole={userRole} />
                ))}
            </div>
          ))}
        </>
      )}

      {subTab === 'admin' && isOwner && (
        <AdminTab storeId={storeId} userName={userName} />
      )}
    </div>
  )
}