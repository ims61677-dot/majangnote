'use client'
import { useEffect, useState, useRef } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import YearMonthPicker from '@/components/YearMonthPicker'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ── 직급별 보기 옵션 ──
const VISIBILITY_OPTIONS = [
  { value: 'all',     label: '👥 전체',    color: '#6C5CE7', desc: '모든 직원 열람 가능' },
  { value: 'manager', label: '👔 관리자만', color: '#FF6B35', desc: '관리자·대표만 열람' },
  { value: 'owner',   label: '👑 대표만',  color: '#E84393', desc: '대표만 열람' },
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

// ── 반복 옵션 ──
const REPEAT_OPTIONS = [
  { value: 'none',    label: '반복 없음', icon: '' },
  { value: 'daily',   label: '매일',      icon: '📅' },
  { value: 'weekly',  label: '매주',      icon: '📆' },
  { value: 'monthly', label: '매월',      icon: '🗓' },
]
function RepeatBadge({ value }: { value?: string }) {
  if (!value || value === 'none') return null
  const opt = REPEAT_OPTIONS.find(o => o.value === value)
  if (!opt) return null
  return <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(0,184,148,0.12)', color: '#00B894', fontWeight: 700 }}>{opt.icon} {opt.label}</span>
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

// ── 미션 사진 인증 모달 ──
function MissionPhotoModal({ todoContent, onComplete, onCancel, onUpload, isUploading, photoUrl }: {
  todoContent: string
  onComplete: () => void
  onCancel: () => void
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  isUploading: boolean
  photoUrl: string
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>미션 완료 인증</div>
          <div style={{ fontSize: 12, color: '#888', background: '#F8F9FB', borderRadius: 8, padding: '8px 12px' }}>"{todoContent}"</div>
        </div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>완료 사진을 찍어서 올려주세요</div>
        <input type="file" accept="image/*" capture="environment" onChange={onUpload} disabled={isUploading}
          style={{ ...inp, marginBottom: 8, cursor: 'pointer' }} />
        {isUploading && <div style={{ fontSize: 11, color: '#6C5CE7', marginBottom: 8 }}>⏳ 업로드 중...</div>}
        {photoUrl && (
          <div style={{ marginBottom: 12 }}>
            <img src={photoUrl} alt="완료 사진" style={{ width: '100%', borderRadius: 10, maxHeight: 200, objectFit: 'cover' }} />
            <div style={{ fontSize: 11, color: '#00B894', marginTop: 4 }}>✅ 사진 업로드 완료</div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>취소</button>
          <button onClick={onComplete} disabled={!photoUrl || isUploading}
            style={{ flex: 2, padding: '11px 0', borderRadius: 12, background: photoUrl ? 'linear-gradient(135deg,#6C5CE7,#00B894)' : '#ddd', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: photoUrl ? 'pointer' : 'not-allowed' }}>
            {photoUrl ? '✓ 미션 완료!' : '사진을 먼저 올려주세요'}
          </button>
        </div>
        <button onClick={onComplete} style={{ width: '100%', marginTop: 8, padding: '8px 0', borderRadius: 10, background: 'none', border: '1px dashed #ddd', color: '#bbb', fontSize: 11, cursor: 'pointer' }}>
          사진 없이 완료 처리
        </button>
      </div>
    </div>
  )
}

// ── 미니 캘린더 (멀티 닷 지원) ──
function MiniCalendar({ year, month, todoDates, selectedDate, onSelectDate, onChangeMonth, memoDates, storeDotColor }: {
  year: number; month: number; todoDates: Set<string>
  selectedDate: string; onSelectDate: (d: string) => void; onChangeMonth: (y: number, m: number) => void
  memoDates?: Set<string>; storeDotColor?: string
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
            const hasMemo = memoDates?.has(dateStr)
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
                <div style={{ display:'flex', gap:2, marginTop:2 }}>
                  {hasTodo && <span style={{ width:4, height:4, borderRadius:'50%', background: storeDotColor || '#6C5CE7' }} />}
                  {hasMemo && <span style={{ width:4, height:4, borderRadius:'50%', background:'#E84393' }} />}
                </div>
              </button>
            )
          })}
        </div>
      ))}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8, paddingTop:8, borderTop:'1px solid #F0F0F0', flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background: storeDotColor || '#6C5CE7', display:'inline-block' }} />
          <span style={{ fontSize:9, color:'#aaa' }}>지점 할일 있는 날</span>
        </div>
        {memoDates && (
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'#E84393', display:'inline-block' }} />
            <span style={{ fontSize:9, color:'#aaa' }}>내 스케줄 있는 날</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 할일 아이템 ──
function TodoItem({ todo, checks, onToggle, canCheck, myName, userRole, onMissionComplete }: {
  todo: any; checks: any[]; onToggle: () => void; canCheck: boolean; myName: string; userRole: string
  onMissionComplete?: (todoId: string, photoUrl: string) => void
}) {
  const myChecked = checks.find((c: any) => c.checked_by === myName)
  if (!canViewByVisibility(todo.visibility, userRole)) return null

  function handleClick() {
    if (!canCheck) return
    if (todo.is_mission && !myChecked && onMissionComplete) {
      onMissionComplete(todo.id, '')
    } else {
      onToggle()
    }
  }

  return (
    <div style={{ borderRadius:10, border:myChecked?'1px solid rgba(0,184,148,0.3)':'1px solid #E8ECF0', background:myChecked?'rgba(0,184,148,0.04)':'#F8F9FB', marginBottom:6, overflow:'hidden' }}>
      <button onClick={handleClick} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'none', border:'none', cursor:canCheck?'pointer':'not-allowed', textAlign:'left' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:17, color:todo.is_mission&&!myChecked?'#FDC400':myChecked?'#00B894':'#ddd', lineHeight:1, flexShrink:0 }}>
            {todo.is_mission && !myChecked ? '📸' : myChecked ? '✓' : '○'}
          </span>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              <div style={{ fontSize:13, color:myChecked?'#00B894':canCheck?'#444':'#bbb', textDecoration:myChecked?'line-through':'none' }}>{todo.content}</div>
              <VisibilityBadge value={todo.visibility} />
              <RepeatBadge value={todo.repeat_type} />
              {todo.is_mission && <span style={{ fontSize:9, padding:'1px 6px', borderRadius:4, background:'rgba(253,196,0,0.15)', color:'#FDC400', fontWeight:700 }}>📸 미션</span>}
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
      {todo.completion_photo_url && myChecked && (
        <div style={{ padding:'0 14px 10px' }}>
          <div style={{ fontSize:10, color:'#00B894', marginBottom:4, fontWeight:700 }}>📸 완료 인증 사진</div>
          <img src={todo.completion_photo_url} alt="완료 인증"
            style={{ width:'100%', maxHeight:200, borderRadius:8, objectFit:'cover', cursor:'pointer' }}
            onClick={() => window.open(todo.completion_photo_url, '_blank')} />
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
      <div onClick={onToggle} style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', background:'none', cursor:'pointer' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
          <span style={{ fontSize:17, color:myChecked?'#00B894':'#ddd', lineHeight:1, flexShrink:0 }}>{myChecked?'✓':'○'}</span>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:13, color:myChecked?'#00B894':'#1a1a2e', textDecoration:myChecked?'line-through':'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{todo.content}</div>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
              <span style={{ fontSize:10, color:'#bbb' }}>원래: {todo.origin_date?.replace(/-/g,'.')}</span>
              <span style={{ fontSize:10, fontWeight:700, color: urgentColor, background:`${urgentColor}15`, padding:'1px 6px', borderRadius:6 }}>{dayCount}일째 미완료</span>
              <RepeatBadge value={todo.repeat_type} />
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
      </div>
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
            <div style={{ fontSize:13, color:'#444', lineHeight:1.7, background:'#F8F9FB', borderRadius:10, padding:'10px 12px', marginBottom:12, whiteSpace:'pre-wrap' }}>
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

// ── 드래그 가능한 체크리스트 아이템 ──
function SortableChecklistItem({ item, date, movePopup, setMovePopup, toggleChecklistItem, toggleUrgent, deleteChecklistItem, moveItemToDate, setMovePopupNull }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 999 : 'auto' as any,
  }
  const isOpen = movePopup !== null && movePopup.itemId === item.id
  const getRelDate = (days: number) => {
    const d = new Date(movePopup?.fromDate || date); d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 4px', background: item.urgent && !item.done ? 'rgba(255,107,53,0.05)' : 'transparent', borderBottom: isOpen ? 'none' : '1px solid #F4F6F9', borderRadius: item.urgent && !item.done ? 6 : 0 }}>
        {/* 드래그 핸들 */}
        <div {...attributes} {...listeners} style={{ cursor: 'grab', flexShrink: 0, color: '#ccc', fontSize: 13, padding: '0 2px', touchAction: 'none' }}>⠿</div>
        {/* 완료 체크 */}
        <button onClick={() => toggleChecklistItem(date, item.id)}
          style={{ fontSize: 15, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0, color: item.done ? '#00B894' : '#ddd' }}>
          {item.done ? '✅' : '○'}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: item.urgent && !item.done ? 700 : 400, color: item.done ? '#bbb' : item.urgent ? '#FF6B35' : '#1a1a2e', textDecoration: item.done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.urgent && !item.done ? '⚡ ' : ''}{item.text}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' as const }}>
            {item.carriedFrom && <span style={{ fontSize: 9, color: '#FF6B35', background: 'rgba(255,107,53,0.1)', padding: '1px 5px', borderRadius: 4 }}>↩ {item.carriedFrom.slice(5).replace('-','/')} 이월</span>}
            {item.time && <span style={{ fontSize: 9, color: '#6C5CE7', background: 'rgba(108,92,231,0.1)', padding: '1px 5px', borderRadius: 4 }}>🔔 {item.time}</span>}
            {item.repeat === 'daily' && <span style={{ fontSize: 9, color: '#FF6B35', background: 'rgba(255,107,53,0.1)', padding: '1px 5px', borderRadius: 4 }}>🔁 매일</span>}{item.repeat === 'weekly' && <span style={{ fontSize: 9, color: '#00B894', background: 'rgba(0,184,148,0.1)', padding: '1px 5px', borderRadius: 4 }}>📆 매주</span>}{item.repeat === 'monthly' && <span style={{ fontSize: 9, color: '#6C5CE7', background: 'rgba(108,92,231,0.1)', padding: '1px 5px', borderRadius: 4 }}>📅 매월</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:2, flexShrink:0 }}>
          <button onClick={() => toggleUrgent(date, item.id)} title="중요 표시"
            style={{ fontSize: 12, background: item.urgent ? 'rgba(255,107,53,0.15)' : 'none', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '0 3px', color: item.urgent ? '#FF6B35' : '#ddd' }}>⚡</button>
          <button onClick={() => setMovePopup((p: any) => p !== null && p.itemId === item.id ? null : { itemId: item.id, fromDate: date })}
            style={{ fontSize: 10, color: isOpen ? '#6C5CE7' : '#bbb', background: isOpen ? 'rgba(108,92,231,0.1)' : 'none', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '0 3px' }}>📅</button>
          <button onClick={() => deleteChecklistItem(date, item.id)}
            style={{ fontSize: 11, color: '#E84393', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>✕</button>
        </div>
      </div>
      {isOpen && (
        <div style={{ background: 'rgba(108,92,231,0.06)', borderRadius: '0 0 10px 10px', padding: '8px 10px 10px', borderBottom: '1px solid #F4F6F9', marginBottom: 2 }}>
          <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>📅 언제로 이동?</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            {([['내일', 1], ['모레', 2], ['+1주', 7]] as [string, number][]).map(([label, days]) => (
              <button key={label} onClick={() => { moveItemToDate(movePopup.fromDate, movePopup.itemId, getRelDate(days)); setMovePopupNull() }}
                style={{ flex: 1, padding: '5px 0', borderRadius: 7, border: '1px solid rgba(108,92,231,0.3)', background: 'rgba(108,92,231,0.1)', color: '#6C5CE7', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                {label}
              </button>
            ))}
          </div>
          <input type="date" defaultValue={getRelDate(1)}
            onChange={e => { if (e.target.value) { moveItemToDate(movePopup.fromDate, movePopup.itemId, e.target.value); setMovePopupNull() } }}
            style={{ width: '100%', padding: '6px 10px', borderRadius: 7, border: '1px solid #E8ECF0', fontSize: 12, outline: 'none', color: '#1a1a2e', boxSizing: 'border-box' as const }} />
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════
// 관리 탭 (대표 전용) — 완전 개편
// ══════════════════════════════════════════
function AdminTab({ storeId, userName, isPC }: { storeId: string; userName: string; isPC: boolean }) {
  const supabase = createSupabaseBrowserClient()
  const today = toDateStr(new Date())

  // 매장 데이터
  const [stores, setStores] = useState<any[]>([])
  const [allTodosMap, setAllTodosMap] = useState<{store: any; todos: any[]; closingTodos: any[]}[]>([])
  const [loading, setLoading] = useState(true)
  const [adminSubTab, setAdminSubTab] = useState<'main'|'stats'>('main')
  const [statsData, setStatsData] = useState<any>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsYear, setStatsYear] = useState(new Date().getFullYear())
  const [statsMonth, setStatsMonth] = useState(new Date().getMonth() + 1)
  const [expandedTodo, setExpandedTodo] = useState<string|null>(null)
  const [statsStoreFilter, setStatsStoreFilter] = useState<string>('all')

  // 빠른 할일 추가
  const [quickInputs, setQuickInputs] = useState<Record<string, string>>({})
  const [quickVisibility, setQuickVisibility] = useState('all')
  const [quickRepeat, setQuickRepeat] = useState('none')
  const [quickMission, setQuickMission] = useState(false)
  const [savingStore, setSavingStore] = useState<string | null>(null)
  const [addedStore, setAddedStore] = useState<string | null>(null)

  // 통합 캘린더
  const nowD = new Date()
  const [calYear, setCalYear] = useState(nowD.getFullYear())
  const [calMonth, setCalMonth] = useState(nowD.getMonth())
  const [selectedCalDate, setSelectedCalDate] = useState(today)
  const [allTodoDates, setAllTodoDates] = useState<Set<string>>(new Set())

  // dnd-kit sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [checklistTodayOpen, setChecklistTodayOpen] = useState(true)
  const [checklistCarryOpen, setChecklistCarryOpen] = useState(false)
  // 체크리스트 날짜 이동 팝업
  const [movePopup, setMovePopup] = useState<{itemId: string, fromDate: string} | null>(null)
  // 개인 체크리스트 (메모 대체)
  // 구조: { '2026-03-08': [{id, text, done, time?, repeat?}] }
  const [checklistMap, setChecklistMap] = useState<Record<string, any[]>>({})
  const [checklistInput, setChecklistInput] = useState('')
  const [checklistTime, setChecklistTime] = useState('')
  const [checklistRepeat, setChecklistRepeat] = useState<'none'|'daily'|'weekly'|'monthly'>('none')
  const [savingChecklist, setSavingChecklist] = useState(false)
  const memoDates = new Set(Object.keys(checklistMap).filter(d => checklistMap[d]?.length > 0))

  // 보기 섹션
  const [showMemo, setShowMemo] = useState(false)
  const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set())
  const [editingTodo, setEditingTodo] = useState<any>(null)
  const [editTodoContent, setEditTodoContent] = useState('')

  // 공지 관련
  const [adminNotices, setAdminNotices] = useState<any[]>([])
  const [selectedAdminNotice, setSelectedAdminNotice] = useState<any>(null)
  const [showAdminNoticeForm, setShowAdminNoticeForm] = useState(false)
  const [adminNoticeTitle, setAdminNoticeTitle] = useState('')
  const [adminNoticeContent, setAdminNoticeContent] = useState('')
  const [adminNoticePinned, setAdminNoticePinned] = useState(false)
  const [savingAdminNotice, setSavingAdminNotice] = useState(false)
  const [adminNoticeStore, setAdminNoticeStore] = useState('')
  // 공지 첨부
  const [adminNoticeAttachType, setAdminNoticeAttachType] = useState<'none'|'link'|'image'>('none')
  const [adminNoticeAttachUrl, setAdminNoticeAttachUrl] = useState('')
  const [isUploadingAdminAttach, setIsUploadingAdminAttach] = useState(false)
  // 공지 수정
  const [editingAdminNotice, setEditingAdminNotice] = useState<any>(null)
  // 공지 순서 (로컬)
  const [noticeOrder, setNoticeOrder] = useState<string[]>([])
  const NOTICE_ORDER_KEY = `notice_order_${storeId}`

  useEffect(() => { loadAdminData() }, [storeId])
  // 날짜 바뀌면 탭 초기화
  useEffect(() => {
    setChecklistTodayOpen(true)
    setChecklistCarryOpen(false)
  }, [selectedCalDate])
  // 날짜 바뀌어도 input 초기화

  async function loadAdminData() {
    setLoading(true)
    try {
      // 매장 목록
      const { data: memberData } = await supabase
        .from('store_members')
        .select('store_id, role, stores(id, name)')
        .eq('role', 'owner')
      const storeList = (memberData || [])
        .map((m: any) => m.stores).filter(Boolean)
        .filter((s: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === s.id) === i)
      if (storeList.length === 0) {
        const { data: sd } = await supabase.from('stores').select('id, name').eq('id', storeId).maybeSingle()
        if (sd) storeList.push(sd)
      }
      setStores(storeList)
      loadAdminNotices(storeList.map((s: any) => s.id), storeList)

      const sevenDaysAgo = toDateStr(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000))
      const fourteenDaysAhead = toDateStr(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000))
      const yesterday = toDateStr(new Date(Date.now() - 24 * 60 * 60 * 1000))

      // ★ 모든 매장 동시에 병렬 로드
      const [storeResults, memosResult] = await Promise.all([
        Promise.all(storeList.map(async (store: any) => {
          // 과거7일 ~ 미래14일 공지+할일 한번에 조회
          const { data: notices } = await supabase
            .from('notices').select('*, notice_todos(*)')
            .eq('store_id', store.id)
            .gte('notice_date', sevenDaysAgo).lte('notice_date', fourteenDaysAhead)
            .eq('is_from_closing', false).neq('title', '__PERSONAL_CHECKLIST__')

          const allTodoIds = (notices || []).flatMap((n: any) => (n.notice_todos || []).map((t: any) => t.id))

          // 마감 전달사항 (어제)도 병렬로 로드
          const [checksResult, closingResult] = await Promise.all([
            allTodoIds.length > 0
              ? supabase.from('notice_todo_checks').select('*').in('todo_id', allTodoIds)
              : Promise.resolve({ data: [] }),
            supabase.from('closings').select('id').eq('store_id', store.id).eq('closing_date', yesterday).maybeSingle()
          ])

          const checkMap: Record<string, any[]> = {}
          ;(checksResult.data || []).forEach((c: any) => {
            if (!checkMap[c.todo_id]) checkMap[c.todo_id] = []
            checkMap[c.todo_id].push(c)
          })

          const todos: any[] = []
          const allDates = new Set<string>()
          for (const notice of (notices || [])) {
            const noticeDate = notice.notice_date
            const dayCount = Math.round((new Date(today).getTime() - new Date(noticeDate).getTime()) / 86400000)
            allDates.add(noticeDate)
            for (const todo of (notice.notice_todos || [])) {
              const todoChecks = checkMap[todo.id] || []
              todos.push({ ...todo, origin_date: noticeDate, day_count: dayCount, notice_title: notice.title, checks: todoChecks, isToday: noticeDate === today, isFuture: noticeDate > today, isDone: todoChecks.length > 0 })
            }
          }

          // 마감 전달사항 처리
          let closingTodos: any[] = []
          if (closingResult.data?.id) {
            const { data: ctodos } = await supabase.from('closing_next_todos').select('*').eq('closing_id', closingResult.data.id)
            if (ctodos && ctodos.length > 0) {
              const ctodoIds = ctodos.map((t: any) => t.id)
              const { data: cchks } = await supabase.from('closing_next_todo_checks').select('*').in('todo_id', ctodoIds)
              const cchkMap: Record<string, any[]> = {}
              ;(cchks || []).forEach((c: any) => { if (!cchkMap[c.todo_id]) cchkMap[c.todo_id] = []; cchkMap[c.todo_id].push(c) })
              closingTodos = ctodos.map((t: any) => ({ ...t, checks: cchkMap[t.id] || [], isDone: (cchkMap[t.id] || []).length > 0 }))
            }
          }

          return { store, todos, closingTodos, allDates }
        })),
        supabase.from('notices').select('notice_date, content').eq('is_from_closing', false).eq('title', '__PERSONAL_CHECKLIST__').eq('created_by', userName)
      ])

      setAllTodosMap(storeResults.map(({ store, todos, closingTodos }) => ({ store, todos, closingTodos })))
      loadAdminNotices(storeList.map((s: any) => s.id), storeList)

      const allDates = new Set<string>()
      storeResults.forEach(({ allDates: sd }) => sd.forEach((d: string) => allDates.add(d)))
      setAllTodoDates(allDates)

      const clMap: Record<string, any[]> = {}
      if (memosResult.data) {
        memosResult.data.forEach((m: any) => {
          try { clMap[m.notice_date] = JSON.parse(m.content || '[]') } catch { clMap[m.notice_date] = [] }
        })
      }
      setChecklistMap(clMap)

      // 오늘 날짜 자동 이월 (checklistMap 로드 후 바로 실행)
      const todayStr = new Date().toISOString().slice(0, 10)
      const todayItems = clMap[todayStr] || []
      const todayTexts = new Set(todayItems.map((i: any) => i.text))
      const newItems = [...todayItems]
      let changed = false
      for (let d = 1; d <= 14; d++) {
        const prev = new Date(todayStr)
        prev.setDate(prev.getDate() - d)
        const prevDate = prev.toISOString().slice(0, 10)
        const prevItems = clMap[prevDate]
        if (!prevItems || prevItems.length === 0) continue
        const undone = prevItems.filter((i: any) => {
          if (i.done) return false
          if (todayTexts.has(i.text)) return false
          if (i.repeat === 'monthly') return new Date(prevDate).getDate() === new Date(todayStr).getDate()
          return true
        })
        for (const item of undone) {
          newItems.unshift({ ...item, id: Date.now().toString() + Math.random(), done: false, carriedFrom: item.carriedFrom || prevDate })
          todayTexts.add(item.text)
          changed = true
        }
      }
      if (changed) {
        const jsonContent = JSON.stringify(newItems)
        const clTitle = '__PERSONAL_CHECKLIST__'
        const { data: rows } = await supabase.from('notices').select('id').eq('notice_date', todayStr).eq('title', clTitle).eq('created_by', userName)
        if (rows && rows.length > 0) {
          await supabase.from('notices').update({ content: jsonContent }).eq('id', rows[0].id)
        } else {
          await supabase.from('notices').insert({ store_id: storeId, title: clTitle, content: jsonContent, notice_date: todayStr, created_by: userName, is_from_closing: false, is_pinned: false, attachment_url: null, attachment_type: null })
        }
        setChecklistMap(p => ({ ...p, [todayStr]: newItems }))
      }

    } catch (e) { console.error('Admin data load error:', e) }
    setLoading(false)
  }

  // 공지 로드/저장/삭제

  // stats 서브탭 활성화 시 자동 로드
  useEffect(() => {
    if (adminSubTab === 'stats') loadStats(statsYear, statsMonth)
  }, [adminSubTab])

  async function loadStats(year: number, month: number) {
    if (!storeId) return
    setStatsLoading(true)
    try {
      const startDate = `${year}-${String(month).padStart(2,'0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const endDate = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
      const storeIds = stores.map((s: any) => s.id)

      // 이 기간 할일 체크 전체
      const { data: checks } = await supabase
        .from('notice_todo_checks')
        .select('checked_by, checked_at, todo_id')
        .gte('checked_at', startDate + 'T00:00:00')
        .lte('checked_at', endDate + 'T23:59:59')

      // 이 기간 공지+할일 전체 (누가 눌렀는지 확인용)
      const { data: noticeList } = await supabase
        .from('notices')
        .select('id, title, notice_date, store_id, notice_todos(*)')
        .in('store_id', storeIds)
        .gte('notice_date', startDate)
        .lte('notice_date', endDate)
        .eq('is_from_closing', false)
        .not('title', 'like', '__%__')

      // 공지 읽음
      const noticeIds = (noticeList || []).map((n: any) => n.id)
      const { data: reads } = noticeIds.length > 0
        ? await supabase.from('notice_reads').select('notice_id, read_by, read_at').in('notice_id', noticeIds)
        : { data: [] }

      // 체크 맵: todo_id → [{checked_by, checked_at}]
      const checksByTodo: Record<string, {checked_by: string, checked_at: string}[]> = {}
      for (const c of (checks || [])) {
        if (!checksByTodo[c.todo_id]) checksByTodo[c.todo_id] = []
        checksByTodo[c.todo_id].push({ checked_by: c.checked_by, checked_at: c.checked_at })
      }

      // 직원별 집계
      const personMap: Record<string, { checks: number; days: Set<string> }> = {}
      for (const c of (checks || [])) {
        if (!c.checked_by) continue
        if (!personMap[c.checked_by]) personMap[c.checked_by] = { checks: 0, days: new Set() }
        personMap[c.checked_by].checks++
        personMap[c.checked_by].days.add(c.checked_at.slice(0,10))
      }

      // 날짜별 체크 수
      const dateMap: Record<string, number> = {}
      for (const c of (checks || [])) {
        const d = c.checked_at.slice(0,10)
        dateMap[d] = (dateMap[d] || 0) + 1
      }

      // 공지 읽음 맵
      const noticeReadMap: Record<string, string[]> = {}
      for (const r of (reads || [])) {
        if (!noticeReadMap[r.notice_id]) noticeReadMap[r.notice_id] = []
        noticeReadMap[r.notice_id].push(r.read_by)
      }

      // 할일 전체 목록 (누가 눌렀는지 포함)
      const allTodos: any[] = []
      for (const n of (noticeList || [])) {
        for (const t of (n.notice_todos || [])) {
          allTodos.push({
            ...t,
            noticeTitle: n.title,
            noticeDate: n.notice_date,
            store: stores.find((s: any) => s.id === n.store_id),
            checkers: checksByTodo[t.id] || []
          })
        }
      }

      setStatsData({
        year, month, startDate, endDate,
        personMap: Object.fromEntries(Object.entries(personMap).map(([k,v]) => [k, { ...v, days: v.days.size }])),
        dateMap,
        noticeList: noticeList || [],
        noticeReadMap,
        allTodos,
        totalChecks: (checks || []).length,
        totalTodos: allTodos.length,
        totalNotices: (noticeList || []).length,
      })
    } catch(e) { console.error(e) }
    setStatsLoading(false)
  }

  async function loadAdminNotices(storeIdList?: string[], storeListOverride?: any[]) {
    if (!storeId) return
    const ids = (storeIdList && storeIdList.length > 0) ? storeIdList : [storeId]
    // notice_todos 개수 포함해서 조회 (할일 컨테이너 필터링용)
    const { data, error } = await supabase
      .from('notices')
      .select('id, title, content, notice_date, created_by, is_pinned, store_id, notice_todos(id)')
      .in('store_id', ids)
      .eq('is_from_closing', false)
      .neq('title', '__PERSONAL_CHECKLIST__')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) { console.error(error); return }
    // notice_todos가 없는 것 = 순수 공지 (할일 컨테이너 제외)
    const todoTitles = ['전체 할일', '관리자 할일', '반복 할일', '[이월]']
    const noticeOnly = (data || []).filter((n: any) =>
      (!n.notice_todos || n.notice_todos.length === 0) &&
      !todoTitles.some(t => n.title?.startsWith(t))
    )
    // storeListOverride 우선, 없으면 stores state 사용
    const sl = storeListOverride || stores
    const storeMap: Record<string, string> = {}
    sl.forEach((s: any) => { storeMap[s.id] = s.name })
    const withStoreName = noticeOnly.map((n: any) => ({ ...n, storeName: storeMap[n.store_id] || '' }))
    setAdminNotices(withStoreName)
    // localStorage에 저장된 순서가 있으면 그 순서 우선 적용
    const freshIds = withStoreName.map((n: any) => n.id)
    const savedOrder = typeof window !== 'undefined' ? localStorage.getItem(`notice_order_${storeId}`) : null
    if (savedOrder) {
      const parsed: string[] = JSON.parse(savedOrder)
      // 저장된 순서대로 정렬 (새로 추가된 건 뒤에)
      const ordered = [
        ...parsed.filter(id => freshIds.includes(id)),
        ...freshIds.filter(id => !parsed.includes(id))
      ]
      setNoticeOrder(ordered)
    } else {
      setNoticeOrder(freshIds)
    }
  }

  async function saveAdminNotice() {
    if (!adminNoticeTitle.trim()) return
    setSavingAdminNotice(true)
    const sid = adminNoticeStore || storeId
    try {
      const aUrl = adminNoticeAttachType !== 'none' ? adminNoticeAttachUrl || null : null
      const aType = adminNoticeAttachType !== 'none' ? adminNoticeAttachType : null
      await supabase.from('notices').insert({
        store_id: sid, title: adminNoticeTitle.trim(), content: adminNoticeContent || null,
        notice_date: today, created_by: userName, is_from_closing: false, is_pinned: adminNoticePinned,
        attachment_url: aUrl, attachment_type: aType
      })
      setAdminNoticeTitle(''); setAdminNoticeContent(''); setAdminNoticePinned(false)
      setAdminNoticeAttachType('none'); setAdminNoticeAttachUrl('')
      setShowAdminNoticeForm(false)
      loadAdminNotices(stores.map((s: any) => s.id), stores)
    } finally { setSavingAdminNotice(false) }
  }

  async function deleteAdminNotice(id: string) {
    await supabase.from('notices').delete().eq('id', id)
    if (selectedAdminNotice?.id === id) setSelectedAdminNotice(null)
    loadAdminData()
  }

  async function deleteTodoFromAdmin(todoId: string) {
    await supabase.from('notice_todos').delete().eq('id', todoId)
    loadAdminData()
  }

  async function updateTodoFromAdmin(todoId: string, newContent: string) {
    if (!newContent.trim()) return
    await supabase.from('notice_todos').update({ content: newContent.trim() }).eq('id', todoId)
    setEditingTodo(null)
    loadAdminData()
  }

  async function uploadAdminImage(file: File): Promise<string> {
    const ext = file.name.split('.').pop()
    const path = `${storeId}/${Date.now()}.${ext}`
    const { data, error } = await supabase.storage.from('notice-attachments').upload(path, file, { upsert: true })
    if (error) throw error
    const { data: urlData } = supabase.storage.from('notice-attachments').getPublicUrl(data.path)
    return urlData.publicUrl
  }

  async function handleAdminNoticeImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setIsUploadingAdminAttach(true)
    try { const url = await uploadAdminImage(file); setAdminNoticeAttachUrl(url) }
    catch (e: any) { alert('이미지 업로드 실패\n원인: ' + (e?.message || e)) }
    setIsUploadingAdminAttach(false)
  }

  function moveNotice(id: string, dir: 'up' | 'down') {
    setNoticeOrder(prev => {
      const idx = prev.indexOf(id)
      if (idx < 0) return prev
      const next = [...prev]
      const swap = dir === 'up' ? idx - 1 : idx + 1
      if (swap < 0 || swap >= next.length) return prev
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      // 새 순서 localStorage에 저장
      if (typeof window !== 'undefined') {
        localStorage.setItem(`notice_order_${storeId}`, JSON.stringify(next))
      }
      return next
    })
  }

  async function updateAdminNotice(id: string, title: string, content: string, isPinned: boolean, attachUrl: string|null, attachType: string|null) {
    await supabase.from('notices').update({ title, content: content||null, is_pinned: isPinned, attachment_url: attachUrl, attachment_type: attachType }).eq('id', id)
    setEditingAdminNotice(null)
    loadAdminNotices(stores.map((s: any) => s.id), stores)
  }

  async function quickAddTodo(sId: string, sName: string) {
    const content = (quickInputs[sId] || '').trim()
    if (!content) return
    setSavingStore(sId)
    const targetDate = selectedCalDate  // 캘린더에서 선택한 날짜
    try {
      // 선택한 날짜 '전체 할일' 또는 '관리자 할일' 컨테이너 찾기
      const { data: existingRows } = await supabase.from('notices').select('id, title')
        .eq('store_id', sId).eq('notice_date', targetDate).eq('is_from_closing', false)
        .in('title', ['전체 할일', '관리자 할일']).limit(1)
      let noticeId = existingRows?.[0]?.id
      if (noticeId && existingRows?.[0]?.title === '관리자 할일') {
        await supabase.from('notices').update({ title: '전체 할일' }).eq('id', noticeId)
      }
      if (!noticeId) {
        const { data: newNotice } = await supabase.from('notices').insert({
          store_id: sId, title: '전체 할일', content: null,
          notice_date: targetDate, created_by: userName, is_from_closing: false, is_pinned: false
        }).select().single()
        noticeId = newNotice?.id
      }
      await supabase.from('notice_todos').insert({
        notice_id: noticeId, content, created_by: userName,
        visibility: quickVisibility, repeat_type: quickRepeat,
        is_mission: quickMission, attachment_url: null, attachment_type: null
      })
      setQuickInputs(p => ({ ...p, [sId]: '' }))
      setAddedStore(sId)
      setTimeout(() => setAddedStore(null), 1500)
      await loadAdminData()
    } catch (e: any) { alert('추가 실패: ' + e?.message) }
    setSavingStore(null)
  }

  async function saveChecklist(date: string, items: any[]) {
    if (!storeId) { console.error('saveChecklist: storeId 없음'); return }
    // 유저별 고유 타이틀로 지점 무관하게 1개만 유지
    const clTitle = '__PERSONAL_CHECKLIST__'
    const jsonContent = JSON.stringify(items)
    try {
      // store_id + created_by + date 조합으로 검색 (유저 기준)
      const { data: rows } = await supabase.from('notices').select('id')
        .eq('notice_date', date).eq('title', clTitle).eq('created_by', userName)
      if (rows && rows.length > 0) {
        // 중복 있으면 첫 번째만 남기고 나머지 삭제
        if (rows.length > 1) {
          await supabase.from('notices').delete().in('id', rows.slice(1).map((r: any) => r.id))
        }
        const { error: updateErr } = await supabase.from('notices').update({ content: jsonContent }).eq('id', rows[0].id)
        if (updateErr) { console.error('update error:', updateErr); alert('저장 실패: ' + updateErr.message); return }
      } else {
        const { error: insertErr } = await supabase.from('notices').insert({
          store_id: storeId, title: clTitle, content: jsonContent,
          notice_date: date, created_by: userName, is_from_closing: false, is_pinned: false,
          attachment_url: null, attachment_type: null
        })
        if (insertErr) { console.error('insert error:', insertErr); alert('저장 실패: ' + insertErr.message); return }
      }
      setChecklistMap(p => ({ ...p, [date]: items }))
    } catch (e: any) { console.error('saveChecklist error:', e); alert('저장 중 오류: ' + e?.message) }
  }

  function handleChecklistDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const items = [...(checklistMap[selectedCalDate] || [])]
    const oldIdx = items.findIndex((i: any) => i.id === active.id)
    const newIdx = items.findIndex((i: any) => i.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = arrayMove(items, oldIdx, newIdx)
    saveChecklist(selectedCalDate, reordered)
  }

  // 전날 미완료 항목 오늘로 자동 이월
  async function carryOverItems(date: string) {
    if (date > today) return  // 미래 날짜엔 이월 안 함
    // 오늘 이전 최대 14일까지 미완료 항목 전부 오늘로 이월
    const todayItems = [...(checklistMap[date] || [])]
    const todayTexts = new Set(todayItems.map((i: any) => i.text))
    let changed = false

    for (let d = 1; d <= 14; d++) {
      const prev = new Date(date)
      prev.setDate(prev.getDate() - d)
      const prevDate = prev.toISOString().slice(0, 10)
      if (prevDate >= date) continue  // 미래는 skip

      const prevItems = checklistMap[prevDate]
      if (!prevItems || prevItems.length === 0) continue

      const undone = prevItems.filter((i: any) => {
        if (i.done) return false
        if (todayTexts.has(i.text)) return false  // 이미 오늘에 있으면 skip
        // 매월: 같은 날짜(일)일 때만 이월
        if (i.repeat === 'monthly') {
          return new Date(prevDate).getDate() === new Date(date).getDate()
        }
        return true
      })

      for (const item of undone) {
        todayItems.unshift({ ...item, id: Date.now().toString() + Math.random(), done: false, carriedFrom: item.carriedFrom || prevDate })
        todayTexts.add(item.text)
        changed = true
      }
    }

    if (changed) await saveChecklist(date, todayItems)
  }

  // 항목을 다른 날짜로 이동
  async function moveItemToDate(fromDate: string, itemId: string, toDate: string) {
    const fromItems = checklistMap[fromDate] || []
    const item = fromItems.find((i: any) => i.id === itemId)
    if (!item) return
    const newFromItems = fromItems.filter((i: any) => i.id !== itemId)
    const toItems = checklistMap[toDate] || []
    const movedItem = { ...item, id: Date.now().toString(), carriedFrom: fromDate }
    await saveChecklist(fromDate, newFromItems)
    await saveChecklist(toDate, [...toItems, movedItem])
  }

  async function addChecklistItem() {
    const text = checklistInput.trim(); if (!text) return
    setSavingChecklist(true)
    const items = [...(checklistMap[selectedCalDate] || [])]
    const newItem = { id: Date.now().toString(), text, done: false, time: checklistTime || null, repeat: checklistRepeat, urgent: false }
    items.push(newItem)
    await saveChecklist(selectedCalDate, items)
    setChecklistInput(''); setChecklistTime(''); setChecklistRepeat('none')
    setSavingChecklist(false)
    setChecklistTodayOpen(true)
    setChecklistCarryOpen(false)
  }

  async function toggleUrgent(date: string, itemId: string) {
    const items = (checklistMap[date] || []).map((item: any) =>
      item.id === itemId ? { ...item, urgent: !item.urgent } : item
    )
    await saveChecklist(date, items)
  }

  async function moveChecklistItem(date: string, itemId: string, dir: 'up' | 'down') {
    const items = [...(checklistMap[date] || [])]
    const idx = items.findIndex((i: any) => i.id === itemId)
    if (dir === 'up' && idx === 0) return
    if (dir === 'down' && idx === items.length - 1) return
    const swap = dir === 'up' ? idx - 1 : idx + 1
    ;[items[idx], items[swap]] = [items[swap], items[idx]]
    await saveChecklist(date, items)
  }

  async function toggleChecklistItem(date: string, itemId: string) {
    const items = (checklistMap[date] || []).map((item: any) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    )
    await saveChecklist(date, items)
  }

  async function deleteChecklistItem(date: string, itemId: string) {
    const items = (checklistMap[date] || []).filter((item: any) => item.id !== itemId)
    await saveChecklist(date, items)
  }

  async function sendPushToEmployees(message: string) {
    try {
      const res = await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ store_id: storeId, title: '📣 매장 알림', message, url: '/notice', target: 'employees', sent_by: userName })
      })
      const data = await res.json()
      if (data.sent > 0) alert(`✅ ${data.sent}명에게 알림을 보냈습니다!`)
      else alert('⚠️ 알림을 받을 직원이 없습니다. 직원들이 앱 알림을 허용했는지 확인해주세요.')
    } catch (e) { alert('알림 전송 실패. 잠시 후 다시 시도해주세요.') }
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 48, color: '#bbb' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
      <div style={{ fontSize: 13 }}>전 지점 데이터 불러오는 중...</div>
    </div>
  )

  // ── 오늘 현황 그리드 ──
  const statusGrid = (
    <div style={{ ...bx, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>📊 오늘 현황</div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(stores.length, 3)}, 1fr)`, gap: 8 }}>
        {allTodosMap.map(({ store, todos }) => {
          const todayTodos = todos.filter(t => t.isToday)
          const done = todayTodos.filter(t => t.isDone).length
          const total = todayTodos.length
          const allDone = total > 0 && done === total
          const noneYet = total === 0
          return (
            <div key={store.id} style={{ borderRadius: 12, padding: '10px 12px', background: allDone ? 'rgba(0,184,148,0.06)' : noneYet ? '#F8F9FB' : 'rgba(255,107,53,0.05)', border: `1px solid ${allDone ? 'rgba(0,184,148,0.2)' : noneYet ? '#E8ECF0' : 'rgba(255,107,53,0.2)'}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{store.name}</div>
              <div style={{ fontSize: 20, marginBottom: 2 }}>{allDone ? '✅' : noneYet ? '—' : '⚠️'}</div>
              <div style={{ fontSize: 11, color: allDone ? '#00B894' : noneYet ? '#bbb' : '#FF6B35', fontWeight: 600 }}>
                {noneYet ? '할일 없음' : `${done}/${total} 완료`}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  // ── 빠른 할일 추가 ──
  const quickAddSection = (
    <div style={{ ...bx, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>⚡ 빠른 할일 추가 <span style={{ fontSize: 11, fontWeight: 400, color: selectedCalDate === today ? '#6C5CE7' : '#E84393', marginLeft: 4 }}>{selectedCalDate === today ? '(오늘)' : `(${selectedCalDate.replace(/-/g,'.')}) ← 선택날짜`}</span></div>
      {/* 공통 옵션 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {VISIBILITY_OPTIONS.map(opt => (
          <button key={opt.value} onClick={() => setQuickVisibility(opt.value)}
            style={{ padding: '4px 10px', borderRadius: 8, border: quickVisibility === opt.value ? `1.5px solid ${opt.color}` : '1px solid #E8ECF0', background: quickVisibility === opt.value ? `${opt.color}12` : '#F4F6F9', color: quickVisibility === opt.value ? opt.color : '#aaa', fontSize: 10, fontWeight: quickVisibility === opt.value ? 700 : 400, cursor: 'pointer' }}>
            {opt.label}
          </button>
        ))}
        <div style={{ width: '100%', height: 0 }} />
        {REPEAT_OPTIONS.filter(r => r.value !== 'none').map(opt => (
          <button key={opt.value} onClick={() => setQuickRepeat(r => r === opt.value ? 'none' : opt.value)}
            style={{ padding: '4px 10px', borderRadius: 8, border: quickRepeat === opt.value ? '1.5px solid #00B894' : '1px solid #E8ECF0', background: quickRepeat === opt.value ? 'rgba(0,184,148,0.1)' : '#F4F6F9', color: quickRepeat === opt.value ? '#00B894' : '#aaa', fontSize: 10, fontWeight: quickRepeat === opt.value ? 700 : 400, cursor: 'pointer' }}>
            {opt.icon} {opt.label}
          </button>
        ))}
        <button onClick={() => setQuickMission(p => !p)}
          style={{ padding: '4px 10px', borderRadius: 8, border: quickMission ? '1.5px solid #FDC400' : '1px solid #E8ECF0', background: quickMission ? 'rgba(253,196,0,0.12)' : '#F4F6F9', color: quickMission ? '#d4a800' : '#aaa', fontSize: 10, fontWeight: quickMission ? 700 : 400, cursor: 'pointer' }}>
          📸 미션 {quickMission ? 'ON' : 'OFF'}
        </button>
      </div>
      {/* 지점별 입력 */}
      {stores.map(store => (
        <div key={store.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6C5CE7', background: 'rgba(108,92,231,0.08)', borderRadius: 8, padding: '0 8px', height: 36, display: 'flex', alignItems: 'center', minWidth: 0, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {store.name.length > 7 ? store.name.slice(0,7)+'…' : store.name}
          </div>
          <input
            value={quickInputs[store.id] || ''}
            onChange={e => setQuickInputs(p => ({ ...p, [store.id]: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && quickAddTodo(store.id, store.name)}
            placeholder="할일 입력 후 엔터"
            style={{ ...inp, flex: 1, height: 36, padding: '0 10px' }}
          />
          <button
            onClick={() => quickAddTodo(store.id, store.name)}
            disabled={savingStore === store.id || !(quickInputs[store.id] || '').trim()}
            style={{ padding: '0 14px', height: 36, borderRadius: 9, background: addedStore === store.id ? '#00B894' : savingStore === store.id ? '#ddd' : 'rgba(108,92,231,0.1)', border: `1px solid ${addedStore === store.id ? '#00B894' : 'rgba(108,92,231,0.3)'}`, color: addedStore === store.id ? '#fff' : '#6C5CE7', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
            {addedStore === store.id ? '✓ 추가됨' : savingStore === store.id ? '...' : '+ 추가'}
          </button>
        </div>
      ))}
      <div style={{ fontSize: 10, color: '#bbb', marginTop: 4 }}>{selectedCalDate === today ? `오늘(${today.replace(/-/g,'.')})` : `선택 날짜(${selectedCalDate.replace(/-/g,'.')})`}로 각 지점에 바로 등록됩니다</div>
    </div>
  )


  // ── 관리탭 공지 섹션 ──
  // ── 관리탭 공지 섹션 ──
  const orderedNotices = noticeOrder
    .map(id => adminNotices.find((n: any) => n.id === id))
    .filter(Boolean) as any[]

  const adminNoticeSection = (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>📢 공지 센터</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => {
            const msg = prompt('직원들에게 보낼 알림 내용을 입력하세요:')
            if (msg?.trim()) sendPushToEmployees(msg.trim())
          }}
            style={{ padding: '5px 10px', borderRadius: 8, background: 'rgba(0,184,148,0.1)', border: '1px solid rgba(0,184,148,0.3)', color: '#00B894', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            📣 직원 알림
          </button>
          <button onClick={() => { setShowAdminNoticeForm(p => !p); setAdminNoticeTitle(''); setAdminNoticeContent(''); setAdminNoticePinned(false); setAdminNoticeAttachType('none'); setAdminNoticeAttachUrl(''); setEditingAdminNotice(null) }}
            style={{ padding: '5px 12px', borderRadius: 8, background: showAdminNoticeForm ? '#F4F6F9' : 'rgba(108,92,231,0.1)', border: showAdminNoticeForm ? '1px solid #E8ECF0' : '1px solid rgba(108,92,231,0.3)', color: showAdminNoticeForm ? '#888' : '#6C5CE7', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {showAdminNoticeForm ? '✕ 취소' : '+ 공지 작성'}
          </button>
        </div>
      </div>

      {/* 공지 작성/수정 폼 */}
      {showAdminNoticeForm && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E8ECF0', padding: 14, marginBottom: 12 }}>
          {stores.length > 1 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>지점 선택</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {stores.map(s => (
                  <button key={s.id} onClick={() => setAdminNoticeStore(s.id)}
                    style={{ padding: '4px 10px', borderRadius: 8, border: adminNoticeStore===s.id ? '1.5px solid #6C5CE7' : '1px solid #E8ECF0', background: adminNoticeStore===s.id ? 'rgba(108,92,231,0.1)' : '#F4F6F9', color: adminNoticeStore===s.id ? '#6C5CE7' : '#aaa', fontSize: 10, fontWeight: adminNoticeStore===s.id ? 700 : 400, cursor: 'pointer' }}>{s.name}</button>
                ))}
              </div>
            </div>
          )}
          <input value={adminNoticeTitle} onChange={e => setAdminNoticeTitle(e.target.value)} placeholder="공지 제목"
            style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #E8ECF0', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' as const, outline: 'none' }} />
          <textarea value={adminNoticeContent} onChange={e => setAdminNoticeContent(e.target.value)} placeholder="내용 (선택)"
            style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: '1px solid #E8ECF0', fontSize: 12, minHeight: 70, resize: 'vertical' as const, boxSizing: 'border-box' as const, outline: 'none', marginBottom: 8 }} />
          <AttachmentForm
            attachType={adminNoticeAttachType} setAttachType={setAdminNoticeAttachType}
            attachUrl={adminNoticeAttachUrl} setAttachUrl={setAdminNoticeAttachUrl}
            isUploading={isUploadingAdminAttach} onFileChange={handleAdminNoticeImageUpload}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <button onClick={() => setAdminNoticePinned(p => !p)}
              style={{ padding: '5px 12px', borderRadius: 8, border: adminNoticePinned ? '1.5px solid #6C5CE7' : '1px solid #E8ECF0', background: adminNoticePinned ? 'rgba(108,92,231,0.1)' : '#F4F6F9', color: adminNoticePinned ? '#6C5CE7' : '#aaa', fontSize: 11, cursor: 'pointer' }}>
              📌 {adminNoticePinned ? '고정됨' : '고정 안함'}
            </button>
            <button onClick={editingAdminNotice
              ? () => updateAdminNotice(editingAdminNotice.id, adminNoticeTitle, adminNoticeContent, adminNoticePinned, adminNoticeAttachType !== 'none' ? adminNoticeAttachUrl : null, adminNoticeAttachType !== 'none' ? adminNoticeAttachType : null)
              : saveAdminNotice}
              disabled={savingAdminNotice || !adminNoticeTitle.trim()}
              style={{ padding: '7px 18px', borderRadius: 10, background: 'linear-gradient(135deg,#6C5CE7,#00B894)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !adminNoticeTitle.trim() ? 0.5 : 1 }}>
              {savingAdminNotice ? '저장 중...' : editingAdminNotice ? '수정 저장' : '공지 등록'}
            </button>
          </div>
        </div>
      )}

      {/* 공지 목록 - 지점별 3열 그리드 */}
      {adminNotices.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E8ECF0', padding: '20px', textAlign: 'center', color: '#bbb', fontSize: 12 }}>등록된 공지 없음</div>
      ) : (
        <div>
          {/* 칸반: 지점별 컬럼 */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(stores.length, 3)}, minmax(0, 1fr))`, gap: 10, minWidth: 0 }}>
            {stores.map(store => {
              const storeNotices = orderedNotices.filter((n: any) => n.store_id === store.id)
              return (
                <div key={store.id} style={{ background: '#F8F9FB', borderRadius: 14, border: '1px solid #E8ECF0', padding: 10 }}>
                  {/* 지점 헤더 */}
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#6C5CE7', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🏪 {store.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 400, color: '#bbb' }}>{storeNotices.length}개</span>
                  </div>
                  {/* 공지 카드 목록 */}
                  {storeNotices.length === 0
                    ? <div style={{ fontSize: 11, color: '#ccc', textAlign: 'center', padding: '16px 0' }}>공지 없음</div>
                    : storeNotices.map((notice: any) => {
                      const isExpanded = selectedAdminNotice?.id === notice.id
                      return (
                        <div key={notice.id} onClick={() => setSelectedAdminNotice(isExpanded ? null : notice)}
                          style={{ background: '#fff', borderRadius: 10, border: isExpanded ? '2px solid #6C5CE7' : notice.is_pinned ? '1px solid rgba(108,92,231,0.3)' : '1px solid #E8ECF0', padding: '10px 10px 8px', marginBottom: 8, cursor: 'pointer', minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', flex: 1, lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>{notice.is_pinned ? '📌 ' : ''}{notice.title}</div>
                            <div style={{ display: 'flex', gap: 2, flexShrink: 0, marginLeft: 4 }}>
                              <button onClick={e => { e.stopPropagation(); moveNotice(notice.id, 'up') }}
                                style={{ fontSize: 9, padding: '1px 4px', borderRadius: 4, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>▲</button>
                              <button onClick={e => { e.stopPropagation(); moveNotice(notice.id, 'down') }}
                                style={{ fontSize: 9, padding: '1px 4px', borderRadius: 4, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer' }}>▼</button>
                              <button onClick={e => { e.stopPropagation(); setEditingAdminNotice(notice); setAdminNoticeTitle(notice.title); setAdminNoticeContent(notice.content||''); setAdminNoticePinned(notice.is_pinned); setAdminNoticeAttachType(notice.attachment_type||'none'); setAdminNoticeAttachUrl(notice.attachment_url||''); setAdminNoticeStore(notice.store_id); setShowAdminNoticeForm(true) }}
                                style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.3)', color: '#6C5CE7', cursor: 'pointer' }}>✏️</button>
                              <button onClick={e => { e.stopPropagation(); deleteAdminNotice(notice.id) }}
                                style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(232,67,147,0.08)', border: '1px solid rgba(232,67,147,0.25)', color: '#E84393', cursor: 'pointer' }}>✕</button>
                            </div>
                          </div>
                          {notice.content && <div style={{ fontSize: 11, color: '#666', lineHeight: 1.5, marginBottom: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: isExpanded ? 99 : 2, WebkitBoxOrient: 'vertical' as const, whiteSpace: 'pre-wrap' }}>{notice.content}</div>}
                          {notice.attachment_url && <AttachmentView url={notice.attachment_url} type={notice.attachment_type} />}
                          <div style={{ fontSize: 10, color: '#bbb', marginTop: 4 }}>{notice.created_by} · {notice.notice_date?.replace(/-/g,'.')}</div>
                        </div>
                      )
                    })
                  }
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  // ── 전체 할일 목록 ──
  const allTodosList = (
    <div style={{ display: isPC ? 'grid' : 'block', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, minWidth: 0 }}>
      {allTodosMap.map(({ store, todos, closingTodos }) => {
        // 선택 날짜의 할일 + 반복 할일(매주/매일) 자동 포함
        const selDate = new Date(selectedCalDate)
        const selDow = selDate.getDay() // 0=일~6=토
        const selDay = selDate.getDate() // 1~31
        const dateTodos = todos.filter(t => {
          if (t.origin_date === selectedCalDate) return true
          if (!t.repeat_type || t.repeat_type === 'none') return false
          // 미래 날짜에 이미 직접 등록된 항목이 있으면 제외 (중복 방지)
          const alreadyExists = todos.some(t2 => t2.origin_date === selectedCalDate && t2.content === t.content)
          if (alreadyExists) return false
          const originDate = new Date(t.origin_date)
          if (t.repeat_type === 'daily' && t.origin_date <= selectedCalDate) return true
          if (t.repeat_type === 'weekly' && originDate.getDay() === selDow && t.origin_date <= selectedCalDate) return true
          if (t.repeat_type === 'monthly' && originDate.getDate() === selDay && t.origin_date <= selectedCalDate) return true
          return false
        })
        const incompleteTodos = dateTodos.filter(t => !t.isDone)
        const incompleteClosing = closingTodos.filter((t: any) => !t.isDone)
        const totalAlert = incompleteTodos.length + incompleteClosing.length
        const totalCount = dateTodos.length + incompleteClosing.length
        return (
          <div key={store.id} style={{ background:'#fff', borderRadius:14, border: totalAlert>0 ? '1px solid rgba(232,67,147,0.2)' : '1px solid rgba(0,184,148,0.2)', padding:14 }}>
            {/* 지점 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid #F4F6F9' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>🏪 {store.name}</span>
              {totalAlert > 0
                ? <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'rgba(232,67,147,0.12)', color: '#E84393', fontWeight: 700 }}>{totalAlert}개 미완료</span>
                : <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 8, background: 'rgba(0,184,148,0.1)', color: '#00B894', fontWeight: 700 }}>✅ 완료</span>
              }
            </div>
            {/* 내용: maxHeight + scroll */}
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {/* 마감 전달사항 */}
              {closingTodos.length > 0 && (
                <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 10, background: 'rgba(255,107,53,0.03)', border: '1px solid rgba(255,107,53,0.2)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#FF6B35', marginBottom: 6 }}>📢 마감 전달사항</div>
                  {closingTodos.map((todo: any) => (
                    <div key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(255,107,53,0.08)' }}>
                      <span style={{ fontSize: 11, color: todo.isDone ? '#00B894' : '#FF6B35' }}>{todo.isDone ? '✓' : '○'}</span>
                      <span style={{ fontSize: 11, color: todo.isDone ? '#888' : '#444', textDecoration: todo.isDone ? 'line-through' : 'none', flex: 1 }}>{todo.content}</span>
                    </div>
                  ))}
                </div>
              )}
              {dateTodos.length === 0 && closingTodos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: '#bbb', fontSize: 12 }}>최근 7일간 등록된 할일 없음</div>
              ) : dateTodos.length === 0 ? null : (
                dateTodos.map(todo => {
                  const done = todo.isDone
                  const urgentColor = done ? '#00B894' : todo.day_count >= 3 ? '#E84393' : todo.day_count >= 2 ? '#FF6B35' : todo.isToday ? '#6C5CE7' : '#FDC400'
                  const isEditing = editingTodo?.id === todo.id
                  return (
                    <div key={`${todo.id}-${todo.origin_date}`} style={{ padding: '6px 8px', borderRadius: 8, background: done ? 'rgba(0,184,148,0.04)' : `${urgentColor}06`, border: done ? '1px solid rgba(0,184,148,0.2)' : `1px solid ${urgentColor}20`, marginBottom: 4, opacity: done ? 0.75 : 1 }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input value={editTodoContent} onChange={e => setEditTodoContent(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') updateTodoFromAdmin(todo.id, editTodoContent); if (e.key === 'Escape') setEditingTodo(null) }}
                            autoFocus
                            style={{ flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid #6C5CE7', fontSize: 12, outline: 'none' }} />
                          <button onClick={() => updateTodoFromAdmin(todo.id, editTodoContent)}
                            style={{ padding: '4px 8px', borderRadius: 6, background: '#6C5CE7', border: 'none', color: '#fff', fontSize: 11, cursor: 'pointer' }}>저장</button>
                          <button onClick={() => setEditingTodo(null)}
                            style={{ padding: '4px 8px', borderRadius: 6, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 11, cursor: 'pointer' }}>취소</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {/* 완료 여부 아이콘 */}
                          <span style={{ fontSize: 13, flexShrink: 0 }}>{done ? '✅' : '○'}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: urgentColor, background: `${urgentColor}15`, padding: '1px 6px', borderRadius: 6, flexShrink: 0 }}>
                            {todo.isToday ? '오늘' : `${todo.day_count}일째`}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: done ? '#888' : '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: done ? 'line-through' : 'none' }}>{todo.content}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                              {todo.repeat_type && todo.repeat_type !== 'none' && <RepeatBadge value={todo.repeat_type} />}
                              {todo.visibility && todo.visibility !== 'all' && <VisibilityBadge value={todo.visibility} />}
                              <span style={{ fontSize: 10, color: '#bbb' }}>{todo.origin_date?.replace(/-/g,'.')}</span>
                            </div>
                          </div>
                          {!done && <button onClick={() => { setEditingTodo(todo); setEditTodoContent(todo.content) }}
                            style={{ fontSize: 10, padding: '2px 6px', borderRadius: 5, background: 'rgba(108,92,231,0.1)', border: '1px solid rgba(108,92,231,0.3)', color: '#6C5CE7', cursor: 'pointer', flexShrink: 0 }}>수정</button>}
                          <button onClick={() => deleteTodoFromAdmin(todo.id)}
                            style={{ fontSize: 10, padding: '2px 6px', borderRadius: 5, background: 'rgba(232,67,147,0.1)', border: '1px solid rgba(232,67,147,0.3)', color: '#E84393', cursor: 'pointer', flexShrink: 0 }}>삭제</button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )

  // ── 캘린더 + 메모 섹션 ──
  // 오늘 항목 / 이월 항목 분리
  const allChecklistItems = checklistMap[selectedCalDate] || []
  const todayChecklistItems = allChecklistItems.filter((i: any) => !i.carriedFrom)
  const carryChecklistItems = allChecklistItems.filter((i: any) => !!i.carriedFrom)
  const checklistItems = todayChecklistItems  // DndContext용 (오늘 항목만)
  const doneCount = todayChecklistItems.filter((i: any) => i.done).length
  const carryUndone = carryChecklistItems.filter((i: any) => !i.done).length

  const calendarMemoSection = (
    <div>
      <MiniCalendar
        year={calYear} month={calMonth}
        todoDates={allTodoDates}
        memoDates={memoDates}
        selectedDate={selectedCalDate}
        onSelectDate={d => setSelectedCalDate(d)}
        onChangeMonth={(y, m) => { setCalYear(y); setCalMonth(m) }}
      />
      {/* 개인 체크리스트 */}
      <div style={{ ...bx }}>
        {/* ✅ 오늘 아코디언 헤더 */}
        <button onClick={() => setChecklistTodayOpen(o => !o)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 10, background: 'linear-gradient(135deg,rgba(232,67,147,0.08),rgba(108,92,231,0.08))', border: '1px solid rgba(232,67,147,0.2)', cursor: 'pointer', marginBottom: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#E84393' }}>
            ✅ 오늘 할일
            {todayChecklistItems.filter((i:any)=>!i.done).length > 0 && (
              <span style={{ fontSize: 10, background: 'rgba(232,67,147,0.15)', borderRadius: 8, padding: '1px 6px', marginLeft: 4, color: '#E84393' }}>
                {todayChecklistItems.filter((i:any)=>!i.done).length}개
              </span>
            )}
          </span>
          <span style={{ fontSize: 11, color: '#bbb' }}>{checklistTodayOpen ? '▲' : '▼'}</span>
        </button>

        {/* ✅ 오늘 할일 목록 */}
        {checklistTodayOpen && (
          <>
            {checklistItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '12px 0', color: '#ccc', fontSize: 12 }}>오늘 스케줄을 추가해보세요</div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleChecklistDragEnd}>
                <SortableContext items={checklistItems.map((i: any) => i.id)} strategy={verticalListSortingStrategy}>
                  <div style={{ marginBottom: 10 }}>
                    {checklistItems.map((item: any) => (
                      <SortableChecklistItem
                        key={item.id}
                        item={item}
                        date={selectedCalDate}
                        movePopup={movePopup}
                        setMovePopup={setMovePopup}
                        toggleChecklistItem={toggleChecklistItem}
                        toggleUrgent={toggleUrgent}
                        deleteChecklistItem={deleteChecklistItem}
                        moveItemToDate={moveItemToDate}
                        setMovePopupNull={() => setMovePopup(null)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
            {/* 새 항목 추가 */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <input
                value={checklistInput}
                onChange={e => setChecklistInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addChecklistItem()}
                placeholder="스케줄 입력 후 엔터"
                style={{ ...inp, flex: 1, padding: '7px 10px', fontSize: 12 }}
              />
              <button onClick={addChecklistItem} disabled={savingChecklist || !checklistInput.trim()}
                style={{ padding: '0 12px', borderRadius: 8, background: 'rgba(232,67,147,0.1)', border: '1px solid rgba(232,67,147,0.3)', color: '#E84393', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0, opacity: !checklistInput.trim() ? 0.5 : 1 }}>
                +
              </button>
            </div>
            {/* 알람 설정 */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="time"
                value={checklistTime}
                onChange={e => setChecklistTime(e.target.value)}
                style={{ flex: 1, padding: '5px 8px', borderRadius: 8, border: '1px solid #E8ECF0', fontSize: 11, color: '#6C5CE7', background: '#F8F9FB', outline: 'none' }}
              />
              <button onClick={() => setChecklistRepeat(r => r === 'daily' ? 'none' : 'daily')}
                style={{ padding: '5px 8px', borderRadius: 8, border: checklistRepeat === 'daily' ? '1.5px solid #FF6B35' : '1px solid #E8ECF0', background: checklistRepeat === 'daily' ? 'rgba(255,107,53,0.1)' : '#F4F6F9', color: checklistRepeat === 'daily' ? '#FF6B35' : '#aaa', fontSize: 10, fontWeight: checklistRepeat === 'daily' ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                🔁 매일
              </button>
              <button onClick={() => setChecklistRepeat(r => r === 'weekly' ? 'none' : 'weekly')}
                style={{ padding: '5px 8px', borderRadius: 8, border: checklistRepeat === 'weekly' ? '1.5px solid #00B894' : '1px solid #E8ECF0', background: checklistRepeat === 'weekly' ? 'rgba(0,184,148,0.1)' : '#F4F6F9', color: checklistRepeat === 'weekly' ? '#00B894' : '#aaa', fontSize: 10, fontWeight: checklistRepeat === 'weekly' ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                📆 매주
              </button>
              <button onClick={() => setChecklistRepeat(r => r === 'monthly' ? 'none' : 'monthly')}
                style={{ padding: '5px 8px', borderRadius: 8, border: checklistRepeat === 'monthly' ? '1.5px solid #6C5CE7' : '1px solid #E8ECF0', background: checklistRepeat === 'monthly' ? 'rgba(108,92,231,0.1)' : '#F4F6F9', color: checklistRepeat === 'monthly' ? '#6C5CE7' : '#aaa', fontSize: 10, fontWeight: checklistRepeat === 'monthly' ? 700 : 400, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                📅 매월
              </button>
            </div>
            <div style={{ fontSize: 9, color: '#bbb', marginTop: 4 }}>⏰ 시간 설정 시 해당 시간에 알림 (선택사항)</div>
          </>
        )}

        {/* ↩ 이월 섹션 아코디언 */}
        {selectedCalDate <= today && (
          <div style={{ marginTop: 8 }}>
            <button onClick={() => setChecklistCarryOpen(o => !o)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 10, background: carryUndone > 0 ? 'rgba(255,107,53,0.08)' : '#F4F6F9', border: carryUndone > 0 ? '1px solid rgba(255,107,53,0.2)' : '1px solid #E8ECF0', cursor: 'pointer' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: carryUndone > 0 ? '#FF6B35' : '#aaa' }}>
                ↩ 이월 {carryUndone > 0 && <span style={{ fontSize: 10, background: 'rgba(255,107,53,0.15)', borderRadius: 8, padding: '1px 6px', marginLeft: 4 }}>{carryUndone}개</span>}
              </span>
              <span style={{ fontSize: 11, color: '#bbb' }}>{checklistCarryOpen ? '▲' : '▼'}</span>
            </button>
            {checklistCarryOpen && (
              <div style={{ marginTop: 6, padding: '4px 0' }}>
                {carryChecklistItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '12px 0', color: '#ccc', fontSize: 12 }}>🎉 이월된 항목이 없어요</div>
                ) : (
                  carryChecklistItems.map((item: any) => (
                    <SortableChecklistItem
                      key={item.id}
                      item={item}
                      date={selectedCalDate}
                      movePopup={movePopup}
                      setMovePopup={setMovePopup}
                      toggleChecklistItem={toggleChecklistItem}
                      toggleUrgent={toggleUrgent}
                      deleteChecklistItem={deleteChecklistItem}
                      moveItemToDate={moveItemToDate}
                      setMovePopupNull={() => setMovePopup(null)}
                    />
                  ))
                )}
                <button onClick={() => carryOverItems(selectedCalDate)}
                  style={{ width: '100%', marginTop: 8, padding: '7px 0', borderRadius: 10, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  ↩ 미완료 항목 오늘로 가져오기
                </button>
              </div>
            )}
          </div>
        )}
      </div>


    </div>
  )

  // ── PC vs 모바일 레이아웃 ──
  // ── 전 지점 통합 통계 UI ──
  const adminStatsSection = (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, background:'#fff', borderRadius:14, padding:'10px 14px', border:'1px solid #F0F0F0' }}>
        <button onClick={()=>{ const d=new Date(statsYear,statsMonth-2,1); setStatsYear(d.getFullYear()); setStatsMonth(d.getMonth()+1); loadStats(d.getFullYear(),d.getMonth()+1) }}
          style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#6C5CE7', padding:'0 8px' }}>‹</button>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:15, fontWeight:800, color:'#1a1a2e' }}>{statsYear}년 {statsMonth}월</div>
          <div style={{ fontSize:10, color:'#888', marginTop:2 }}>전 지점 통합 · 대표 전용</div>
          <div style={{ fontSize:10, color:'#bbb' }}>{statsData ? `할일 ${statsData.totalTodos}개 · 완료 ${statsData.totalChecks}건` : '클릭하여 로드'}</div>
        </div>
        <button onClick={()=>{ const d=new Date(statsYear,statsMonth,1); setStatsYear(d.getFullYear()); setStatsMonth(d.getMonth()+1); loadStats(d.getFullYear(),d.getMonth()+1) }}
          style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#6C5CE7', padding:'0 8px' }}>›</button>
      </div>
      {statsLoading ? (
        <div style={{ textAlign:'center', padding:'40px 0', color:'#bbb' }}>📊 불러오는 중...</div>
      ) : !statsData ? (
        <button onClick={()=>loadStats(statsYear,statsMonth)}
          style={{ width:'100%', padding:'14px', borderRadius:12, background:'rgba(108,92,231,0.08)', border:'1px dashed rgba(108,92,231,0.3)', color:'#6C5CE7', fontSize:13, fontWeight:700, cursor:'pointer' }}>
          📊 통계 불러오기
        </button>
      ) : (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:14 }}>
            {[
              {label:'전체 할일', value:statsData.totalTodos+'개', color:'#6C5CE7'},
              {label:'완료 체크', value:statsData.totalChecks+'건', color:'#00B894'},
              {label:'활동 인원', value:Object.keys(statsData.personMap).length+'명', color:'#E84393'},
            ].map(({label,value,color})=>(
              <div key={label} style={{ background:'#fff', borderRadius:12, padding:'12px 8px', textAlign:'center', border:`1px solid ${color}33` }}>
                <div style={{ fontSize:17, fontWeight:800, color }}>{value}</div>
                <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ background:'#fff', borderRadius:14, padding:'14px', marginBottom:12, border:'1px solid #F0F0F0' }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:12, color:'#1a1a2e' }}>🏆 전 직원 완료 랭킹</div>
            {Object.entries(statsData.personMap as Record<string,any>).sort((a,b)=>b[1].checks-a[1].checks).map(([name,data],idx)=>{
              const maxC=Math.max(...Object.values(statsData.personMap as Record<string,any>).map((v:any)=>v.checks),1)
              const pct=Math.round((data.checks/maxC)*100)
              const medals=['🥇','🥈','🥉']
              return (
                <div key={name} style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                    <span style={{ fontSize:12 }}>{medals[idx]||`${idx+1}.`} {name}</span>
                    <span style={{ fontSize:11, color:'#888' }}>{data.checks}건 · {data.days}일</span>
                  </div>
                  <div style={{ background:'#F4F6F9', borderRadius:8, height:8, overflow:'hidden' }}>
                    <div style={{ width:`${pct}%`, height:'100%', background:idx===0?'linear-gradient(90deg,#6C5CE7,#E84393)':'#a29bfe88', borderRadius:8 }} />
                  </div>
                </div>
              )
            })}
            {Object.keys(statsData.personMap).length===0&&<div style={{ textAlign:'center', color:'#ccc', fontSize:12, padding:'12px 0' }}>활동 기록 없음</div>}
          </div>
          <div style={{ background:'#fff', borderRadius:14, padding:'14px', marginBottom:12, border:'1px solid #F0F0F0' }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:10, color:'#1a1a2e' }}>📋 전체 할일 완료 현황</div>
            {/* 지점 필터 탭 */}
            <div style={{ display:'flex', gap:4, marginBottom:10, flexWrap:'wrap' }}>
              {[{id:'all',name:'전체'}, ...stores.map((s:any)=>({id:s.id,name:s.name}))].map((s:any)=>(
                <button key={s.id} onClick={()=>setStatsStoreFilter(s.id)}
                  style={{ padding:'4px 10px', borderRadius:8, border: statsStoreFilter===s.id?'1.5px solid #6C5CE7':'1px solid #E8ECF0', background: statsStoreFilter===s.id?'rgba(108,92,231,0.1)':'#F4F6F9', color: statsStoreFilter===s.id?'#6C5CE7':'#888', fontSize:11, fontWeight: statsStoreFilter===s.id?700:400, cursor:'pointer' }}>
                  {s.name}
                </button>
              ))}
              <span style={{ marginLeft:'auto', fontSize:11, color:'#aaa', alignSelf:'center' }}>
                {statsData.allTodos.filter((t:any)=> statsStoreFilter==='all' || t.store?.id===statsStoreFilter).length}건
              </span>
            </div>
            {statsData.allTodos.length===0 ? (
              <div style={{ textAlign:'center', color:'#ccc', fontSize:12, padding:'12px 0' }}>할일 없음</div>
            ) : (() => {
              const filtered = statsData.allTodos
                .filter((t:any) => statsStoreFilter==='all' || t.store?.id===statsStoreFilter)
                .sort((a:any,b:any)=> a.noticeDate>b.noticeDate?-1:1)
              const done = filtered.filter((t:any)=>t.checkers.length>0)
              const undone = filtered.filter((t:any)=>t.checkers.length===0)
              const sorted = [...undone, ...done] // 미완료 먼저
              return sorted.map((todo:any)=>{
                const isDone=todo.checkers.length>0
                const isExp=expandedTodo===todo.id
                return (
                  <div key={todo.id} style={{ marginBottom:6, borderRadius:10, border:`1px solid ${isDone?'rgba(0,184,148,0.2)':'rgba(232,67,147,0.2)'}`, overflow:'hidden' }}>
                    <div onClick={()=>setExpandedTodo(isExp?null:todo.id)}
                      style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', cursor:'pointer', background:isDone?'rgba(0,184,148,0.04)':'rgba(232,67,147,0.02)' }}>
                      <span style={{ fontSize:13, color:isDone?'#00B894':'#E84393' }}>{isDone?'✅':'○'}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, color:isDone?'#555':'#333', textDecoration:isDone?'line-through':'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{todo.content}</div>
                        <div style={{ fontSize:10, color:'#bbb', marginTop:1, display:'flex', gap:6 }}>
                          <span>{todo.noticeDate}</span>
                          <span style={{ color: todo.store?.color||'#aaa', fontWeight:600 }}>{todo.store?.name}</span>
                        </div>
                      </div>
                      <span style={{ fontSize:10, color:isDone?'#00B894':'#E84393', fontWeight:700, flexShrink:0 }}>{isDone?`${todo.checkers.length}명 ▾`:'미완료'}</span>
                    </div>
                    {isExp&&isDone&&(
                      <div style={{ background:'rgba(0,184,148,0.04)', padding:'6px 12px 10px', borderTop:'1px solid rgba(0,184,148,0.1)' }}>
                        {todo.checkers.map((c:any,i:number)=>(
                          <div key={i} style={{ fontSize:11, color:'#555', padding:'3px 0', display:'flex', justifyContent:'space-between' }}>
                            <span>✓ <strong>{c.checked_by}</strong></span>
                            <span style={{ color:'#aaa' }}>{new Date(c.checked_at).toLocaleString('ko',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {isExp&&!isDone&&(
                      <div style={{ background:'#FFF3F8', padding:'8px 12px', borderTop:'1px solid rgba(232,67,147,0.1)' }}>
                        <div style={{ fontSize:11, color:'#E84393' }}>⚠️ 아직 아무도 완료하지 않았어요</div>
                      </div>
                    )}
                  </div>
                )
              })
            })()}
          </div>
          <div style={{ background:'#fff', borderRadius:14, padding:'14px', border:'1px solid #F0F0F0' }}>
            <div style={{ fontSize:13, fontWeight:700, marginBottom:12, color:'#1a1a2e' }}>📢 공지 읽음 현황</div>
            {statsData.noticeList.map((n:any)=>{
              const readers=statsData.noticeReadMap[n.id]||[]
              const store=stores.find((s:any)=>s.id===n.store_id)
              return (
                <div key={n.id} style={{ padding:'8px 0', borderBottom:'1px solid #F4F6F9' }}>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    <div style={{ fontSize:12, color:'#333', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
                      {n.title} <span style={{ color:'#bbb', fontSize:10 }}>{store?.name}</span>
                    </div>
                    <span style={{ fontSize:10, color:readers.length>0?'#00B894':'#FFB347', fontWeight:700, marginLeft:8, flexShrink:0 }}>{readers.length}명 읽음</span>
                  </div>
                  {readers.length>0&&<div style={{ fontSize:10, color:'#00B894', marginTop:2 }}>✓ {readers.join(', ')}</div>}
                  {readers.length===0&&<div style={{ fontSize:10, color:'#FFB347', marginTop:2 }}>아직 읽은 사람 없음</div>}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )

  // ── 서브탭 바 ──
  const adminSubTabBar = (
    <div style={{ display:'flex', background:'#F4F6F9', borderRadius:10, padding:3, marginBottom:14, gap:3 }}>
      <button onClick={() => setAdminSubTab('main')}
        style={{ flex:1, padding:'7px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:adminSubTab==='main'?700:400, background:adminSubTab==='main'?'#fff':'transparent', color:adminSubTab==='main'?'#1a1a2e':'#888', boxShadow:adminSubTab==='main'?'0 1px 4px rgba(0,0,0,0.08)':undefined }}>
        🏪 관리
      </button>
      <button onClick={() => setAdminSubTab('stats')}
        style={{ flex:1, padding:'7px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:adminSubTab==='stats'?700:400, background:adminSubTab==='stats'?'#fff':'transparent', color:adminSubTab==='stats'?'#6C5CE7':'#888', boxShadow:adminSubTab==='stats'?'0 1px 4px rgba(0,0,0,0.08)':undefined }}>
        📊 통계
      </button>
    </div>
  )

  if (isPC) {
    return (
      <div>
        {adminSubTabBar}
        {adminSubTab === 'main' && (
      <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', gap: 16, alignItems: 'start', width: '100%', minWidth: 0 }}>
        {/* 좌: 캘린더 + 메모 (sticky) */}
        <div style={{ position: 'sticky', top: 72, minWidth: 0 }}>
          {calendarMemoSection}
        </div>
        {/* 우: 현황 그리드 + 빠른 추가 + 전체 할일 */}
        <div style={{ minWidth: 0, overflow: 'hidden' }}>
          {statusGrid}
          {adminNoticeSection}
          {quickAddSection}
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>📋 전 지점 할일 <span style={{ fontSize: 11, fontWeight: 400, color: '#888', marginLeft: 4 }}>({selectedCalDate.replace(/-/g, '.')})</span></div>
          {allTodosList}
        </div>
      </div>
        )}
        {adminSubTab === 'stats' && adminStatsSection}
      </div>
    )
  }

  // 모바일
  return (
    <div>
      {adminSubTabBar}
      {adminSubTab === 'stats' ? adminStatsSection : (
      <div>
      {statusGrid}
      {quickAddSection}
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>📋 전 지점 할일</div>
      {allTodosList}
      <div style={{ marginTop: 16 }}>
        <button onClick={() => setShowMemo(p => !p)}
          style={{ width: '100%', padding: '10px 0', borderRadius: 12, background: showMemo ? 'rgba(232,67,147,0.1)' : '#F4F6F9', border: showMemo ? '1px solid rgba(232,67,147,0.3)' : '1px solid #E8ECF0', color: showMemo ? '#E84393' : '#888', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: showMemo ? 12 : 0 }}>
          📅 내 스케줄 메모 {showMemo ? '▲' : '▼'}
        </button>
        {showMemo && calendarMemoSection}
      </div>
      </div>
      )}
    </div>
  )
}


export default function NoticePage() {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState('')
  const [userName, setUserName] = useState('')
  const [userId, setUserId] = useState('')
  const [userRole, setUserRole] = useState('')
  const [isPC, setIsPC] = useState(false)
  const today = toDateStr(new Date())

  type SubTab = 'notice' | 'todo' | 'admin' | 'stats'
  const [myStatsData, setMyStatsData] = useState<any>(null)
  const [myStatsLoading, setMyStatsLoading] = useState(false)
  const [myStatsYear, setMyStatsYear] = useState(new Date().getFullYear())
  const [myStatsMonth, setMyStatsMonth] = useState(new Date().getMonth() + 1)
  const [myExpandedTodo, setMyExpandedTodo] = useState<string|null>(null)
  const [subTab, setSubTab] = useState<SubTab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('notice_subTab')
      if (saved === 'notice' || saved === 'todo' || saved === 'admin' || saved === 'stats') return saved as SubTab
    }
    return 'notice'
  })
  // subTab 변경 시 localStorage 저장
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('notice_subTab', subTab)
    if (subTab === 'stats' && storeId) loadMyStats(myStatsYear, myStatsMonth)
  }, [subTab, storeId])

  // ── 공지 상태 ──
  const [notices, setNotices] = useState<any[]>([])
  const [noticeReads, setNoticeReads] = useState<Record<string, any[]>>({})
  const [showNoticeForm, setShowNoticeForm] = useState(false)
  const [editingNotice, setEditingNotice] = useState<any>(null)
  // 할일 탭 - 개별 항목 인라인 수정
  const [editingTodoItem, setEditingTodoItem] = useState<any>(null)
  const [editTodoItemContent, setEditTodoItemContent] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formPinned, setFormPinned] = useState(false)
  const [formNoticeAttachType, setFormNoticeAttachType] = useState<'none'|'link'|'image'>('none')
  const [formNoticeAttachUrl, setFormNoticeAttachUrl] = useState('')
  const [isUploadingNoticeAttach, setIsUploadingNoticeAttach] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedNotice, setSelectedNotice] = useState<any>(null)

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
  const [formTodoRepeat, setFormTodoRepeat] = useState('none')
  const [formTodoMission, setFormTodoMission] = useState(false)
  const [formTodoAttachType, setFormTodoAttachType] = useState<'none'|'link'|'image'>('none')
  const [formTodoAttachUrl, setFormTodoAttachUrl] = useState('')
  const [isUploadingTodoAttach, setIsUploadingTodoAttach] = useState(false)
  const [isSavingTodo, setIsSavingTodo] = useState(false)

  const [closingTodos, setClosingTodos] = useState<any[]>([])
  const [closingChecks, setClosingChecks] = useState<Record<string, any[]>>({})
  const [closingDateLabel, setClosingDateLabel] = useState('')

  const [overdueTodos, setOverdueTodos] = useState<any[]>([])
  const [overdueChecks, setOverdueChecks] = useState<Record<string, any[]>>({})

  // ── 미션 모달 ──
  const [missionModal, setMissionModal] = useState<{ todoId: string; content: string; noticeDate: string } | null>(null)
  const [missionPhotoUrl, setMissionPhotoUrl] = useState('')
  const [isUploadingMissionPhoto, setIsUploadingMissionPhoto] = useState(false)

  // ── 반복 할일 복사 제안 ──
  const [repeatSuggest, setRepeatSuggest] = useState<{ todoId: string; content: string; repeatType: string } | null>(null)

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
    setStoreId(store.id); setUserName(user.nm || ''); setUserRole(user.role || ''); setUserId(user.id || user.nm || '')
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
    const file = e.target.files?.[0]; if (!file) return
    setIsUploadingNoticeAttach(true)
    try { const url = await uploadImage(file); setFormNoticeAttachUrl(url) }
    catch (e: any) { alert('이미지 업로드 실패\n원인: ' + (e?.message || e)) }
    setIsUploadingNoticeAttach(false)
  }

  async function handleTodoImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setIsUploadingTodoAttach(true)
    try { const url = await uploadImage(file); setFormTodoAttachUrl(url) }
    catch { alert('이미지 업로드 실패.') }
    setIsUploadingTodoAttach(false)
  }

  async function handleMissionPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    setIsUploadingMissionPhoto(true)
    try { const url = await uploadImage(file); setMissionPhotoUrl(url) }
    catch { alert('사진 업로드 실패.') }
    setIsUploadingMissionPhoto(false)
  }

  // ── 로드 함수들 ──
  async function loadMyStats(year: number, month: number) {
    if (!storeId) return
    setMyStatsLoading(true)
    try {
      const startDate = `${year}-${String(month).padStart(2,'0')}-01`
      const lastDay = new Date(year, month, 0).getDate()
      const endDate = `${year}-${String(month).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`

      // 내 지점 공지+할일
      const { data: noticeList } = await supabase
        .from('notices')
        .select('id, title, notice_date, store_id, notice_todos(*)')
        .eq('store_id', storeId)
        .gte('notice_date', startDate)
        .lte('notice_date', endDate)
        .eq('is_from_closing', false)
        .not('title', 'like', '__%__')

      const noticeIds = (noticeList||[]).map((n:any)=>n.id)
      const allTodoIds = (noticeList||[]).flatMap((n:any)=>(n.notice_todos||[]).map((t:any)=>t.id))

      const [checksRes, readsRes] = await Promise.all([
        allTodoIds.length > 0
          ? supabase.from('notice_todo_checks').select('checked_by,checked_at,todo_id').in('todo_id', allTodoIds)
          : Promise.resolve({ data: [] }),
        noticeIds.length > 0
          ? supabase.from('notice_reads').select('notice_id,read_by,read_at').in('notice_id', noticeIds)
          : Promise.resolve({ data: [] })
      ])

      const checks = checksRes.data || []
      const reads = readsRes.data || []

      // 체크 맵
      const checksByTodo: Record<string, any[]> = {}
      for (const c of checks) {
        if (!checksByTodo[c.todo_id]) checksByTodo[c.todo_id] = []
        checksByTodo[c.todo_id].push(c)
      }

      // 직원별 집계
      const personMap: Record<string, {checks:number; days:Set<string>}> = {}
      for (const c of checks) {
        if (!c.checked_by) continue
        if (!personMap[c.checked_by]) personMap[c.checked_by] = {checks:0, days:new Set()}
        personMap[c.checked_by].checks++
        personMap[c.checked_by].days.add(c.checked_at.slice(0,10))
      }

      // 날짜별 체크 수
      const dateMap: Record<string, number> = {}
      for (const c of checks) {
        const d = c.checked_at.slice(0,10)
        dateMap[d] = (dateMap[d]||0) + 1
      }

      // 공지 읽음 맵
      const noticeReadMap: Record<string, string[]> = {}
      for (const r of reads) {
        if (!noticeReadMap[r.notice_id]) noticeReadMap[r.notice_id] = []
        noticeReadMap[r.notice_id].push(r.read_by)
      }

      // 할일 전체 + 체커
      const allTodos = (noticeList||[]).flatMap((n:any)=>
        (n.notice_todos||[]).map((t:any)=>({
          ...t, noticeTitle:n.title, noticeDate:n.notice_date,
          checkers: checksByTodo[t.id]||[]
        }))
      )

      setMyStatsData({
        year, month, startDate, endDate,
        personMap: Object.fromEntries(Object.entries(personMap).map(([k,v])=>[k,{...v,days:v.days.size}])),
        dateMap, noticeList:noticeList||[], noticeReadMap, allTodos,
        totalChecks: checks.length,
        totalTodos: allTodos.length,
        totalNotices: (noticeList||[]).length,
      })
    } catch(e) { console.error(e) }
    setMyStatsLoading(false)
  }

  async function loadNotices(sid: string) {
    const { data } = await supabase.from('notices').select('*, notice_todos(id)').eq('store_id', sid).eq('is_from_closing', false)
      .order('is_pinned', { ascending: false }).order('created_at', { ascending: false })
    // 순수 공지만: notice_todos가 없고 __PERSONAL_MEMO__ 아닌 것
    const pureNotices = (data || []).filter((n: any) => (!n.notice_todos || n.notice_todos.length === 0) && n.title !== '__PERSONAL_CHECKLIST__')
    setNotices(pureNotices)
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
    // 할일이 있는 것만, __PERSONAL_MEMO__ 제외
    const filtered = (data || []).filter((n: any) => (n.notice_todos && n.notice_todos.length > 0) && n.title !== '__PERSONAL_CHECKLIST__')
    setDayNotices(filtered)
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
    await supabase.from('notice_todos').insert({ notice_id: noticeId, content: todo.content, created_by: todo.created_by, visibility: todo.visibility, repeat_type: todo.repeat_type, is_mission: todo.is_mission })
    loadDayTodos(storeId, today); loadTodoDates(storeId); loadOverdueTodos(storeId)
    alert('오늘 날짜로 이동됐어요!')
  }

  async function toggleNoticeTodo(todoId: string, noticeDate: string, todo?: any) {
    if (!canCheckDate(noticeDate)) { alert('당일 할일만 체크할 수 있습니다.'); return }
    const myCheck = (noticeTodoChecks[todoId]||[]).find((c: any) => c.checked_by === userName)
    if (myCheck) {
      await supabase.from('notice_todo_checks').delete().eq('id', myCheck.id)
      setNoticeTodoChecks(p => ({ ...p, [todoId]: (p[todoId]||[]).filter((c: any) => c.id !== myCheck.id) }))
    } else {
      const { data } = await supabase.from('notice_todo_checks').insert({ todo_id: todoId, checked_by: userName, checked_at: new Date().toISOString() }).select().single()
      setNoticeTodoChecks(p => ({ ...p, [todoId]: [...(p[todoId]||[]), data] }))
      // 반복 할일 제안
      if (todo?.repeat_type && todo.repeat_type !== 'none') {
        setRepeatSuggest({ todoId, content: todo.content, repeatType: todo.repeat_type })
      }
    }
  }

  async function completeMissionTodo(todoId: string, noticeDate: string, photoUrl: string) {
    // update completion_photo_url on todo
    if (photoUrl) {
      await supabase.from('notice_todos').update({ completion_photo_url: photoUrl }).eq('id', todoId)
    }
    const { data } = await supabase.from('notice_todo_checks').insert({ todo_id: todoId, checked_by: userName, checked_at: new Date().toISOString() }).select().single()
    setNoticeTodoChecks(p => ({ ...p, [todoId]: [...(p[todoId]||[]), data] }))
    loadDayTodos(storeId, noticeDate)
    setMissionModal(null); setMissionPhotoUrl('')
  }

  async function copyRepeatTodo(content: string, repeatType: string) {
    // 다음 날짜 계산
    const nextDate = new Date(selectedDate)
    if (repeatType === 'daily') nextDate.setDate(nextDate.getDate() + 1)
    else if (repeatType === 'weekly') nextDate.setDate(nextDate.getDate() + 7)
    else if (repeatType === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1)
    const nextDateStr = toDateStr(nextDate)

    const { data: existing } = await supabase.from('notices').select('id').eq('store_id', storeId).eq('notice_date', nextDateStr).eq('title', '반복 할일').maybeSingle()
    let noticeId = existing?.id
    if (!noticeId) {
      const { data: newNotice } = await supabase.from('notices').insert({ store_id: storeId, title: '반복 할일', content: null, notice_date: nextDateStr, created_by: userName, is_from_closing: false, is_pinned: false }).select().single()
      noticeId = newNotice.id
    }
    await supabase.from('notice_todos').insert({ notice_id: noticeId, content, created_by: userName, repeat_type: repeatType, visibility: 'all', is_mission: false })
    loadTodoDates(storeId)
    setRepeatSuggest(null)
    alert(`${nextDateStr.replace(/-/g,'.')}에 반복 할일이 추가됐어요!`)
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
          repeat_type: formTodoRepeat,
          is_mission: formTodoMission,
          attachment_url: attachUrl,
          attachment_type: attachType,
        }))
      )
      setShowTodoForm(false); setFormTodoTitle(''); setFormTodos([''])
      setFormTodoVisibility('all'); setFormTodoRepeat('none'); setFormTodoMission(false)
      setFormTodoAttachType('none'); setFormTodoAttachUrl('')
      loadDayTodos(storeId, selectedDate); loadTodoDates(storeId)
    } catch (e: any) { alert('저장 실패: ' + e?.message) }
    finally { setIsSavingTodo(false) }
  }

  async function deleteTodoNotice(id: string) {
    if (!confirm('할일 그룹 전체를 삭제할까요?')) return
    await supabase.from('notices').delete().eq('id', id)
    loadDayTodos(storeId, selectedDate); loadTodoDates(storeId)
  }

  async function deleteNoticeTodoItem(todoId: string) {
    if (!confirm('이 항목을 삭제할까요?')) return
    await supabase.from('notice_todos').delete().eq('id', todoId)
    loadDayTodos(storeId, selectedDate)
  }

  async function updateNoticeTodoItem(todoId: string, newContent: string) {
    if (!newContent.trim()) return
    await supabase.from('notice_todos').update({ content: newContent.trim() }).eq('id', todoId)
    setEditingTodoItem(null)
    loadDayTodos(storeId, selectedDate)
  }

  async function updateNoticeTodoTitle(noticeId: string, newTitle: string) {
    if (!newTitle.trim()) return
    await supabase.from('notices').update({ title: newTitle.trim() }).eq('id', noticeId)
    loadDayTodos(storeId, selectedDate)
  }

  const tabBtn = (active: boolean) => ({
    flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer' as const,
    fontSize: 13, fontWeight: active ? 700 : 400,
    background: active ? '#fff' : 'transparent', color: active ? '#1a1a2e' : '#aaa',
    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
  })

  const unreadCount = notices.filter(n => !(noticeReads[n.id]||[]).find((r: any) => r.read_by === userName) && n.title !== '__PERSONAL_CHECKLIST__').length
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

      {/* 직급별 보기 */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>공개 범위</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {VISIBILITY_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setFormTodoVisibility(opt.value)}
              style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: formTodoVisibility === opt.value ? `1.5px solid ${opt.color}` : '1px solid #E8ECF0', background: formTodoVisibility === opt.value ? `${opt.color}12` : '#F4F6F9', color: formTodoVisibility === opt.value ? opt.color : '#aaa', fontSize: 10, fontWeight: formTodoVisibility === opt.value ? 700 : 400, cursor: 'pointer', textAlign: 'center' }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 반복 설정 */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>반복 설정</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {REPEAT_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setFormTodoRepeat(opt.value)}
              style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: formTodoRepeat === opt.value ? '1.5px solid #00B894' : '1px solid #E8ECF0', background: formTodoRepeat === opt.value ? 'rgba(0,184,148,0.12)' : '#F4F6F9', color: formTodoRepeat === opt.value ? '#00B894' : '#aaa', fontSize: 10, fontWeight: formTodoRepeat === opt.value ? 700 : 400, cursor: 'pointer', textAlign: 'center' }}>
              {opt.icon || '—'} {opt.label}
            </button>
          ))}
        </div>
        {formTodoRepeat !== 'none' && (
          <div style={{ fontSize: 10, color: '#00B894', marginTop: 4 }}>✅ 완료 시 다음 날짜로 복사 제안이 표시됩니다</div>
        )}
      </div>

      {/* 미션 모드 */}
      <div style={{ marginBottom: 10 }}>
        <button onClick={() => setFormTodoMission(p => !p)}
          style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: formTodoMission ? '1.5px solid #FDC400' : '1px solid #E8ECF0', background: formTodoMission ? 'rgba(253,196,0,0.1)' : '#F8F9FB', color: formTodoMission ? '#d4a800' : '#888', fontSize: 12, fontWeight: formTodoMission ? 700 : 400, cursor: 'pointer', textAlign: 'left' as const }}>
          📸 미션 모드 {formTodoMission ? 'ON — 완료 시 사진 인증' : 'OFF — 일반 완료'}
        </button>
        {formTodoMission && (
          <div style={{ fontSize: 10, color: '#d4a800', marginTop: 4, paddingLeft: 4 }}>완료 시 사진 촬영이 요청됩니다. 사진 없이 완료도 가능해요.</div>
        )}
      </div>

      <div style={{ fontSize: 11, color:'#888', marginBottom:6 }}>할일 항목</div>
      {formTodos.map((todo, i) => (
        <div key={i} style={{ display:'flex', gap:6, marginBottom:6 }}>
          <input value={todo} onChange={e => { const n=[...formTodos]; n[i]=e.target.value; setFormTodos(n) }} onKeyDown={e => e.key==='Enter' && setFormTodos([...formTodos,''])} placeholder={`항목 ${i+1}`} style={{ ...inp, flex:1 }} />
          {formTodos.length > 1 && <button onClick={() => setFormTodos(formTodos.filter((_,j)=>j!==i))} style={{ padding:'8px 10px', borderRadius:8, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#bbb', cursor:'pointer', fontSize:13 }}>✕</button>}
        </div>
      ))}
      <button onClick={() => setFormTodos([...formTodos,''])} style={{ width:'100%', padding:'7px 0', borderRadius:8, background:'#F4F6F9', border:'1px dashed #E0E4E8', color:'#aaa', fontSize:12, cursor:'pointer', marginBottom:10 }}>+ 항목 추가</button>
      <AttachmentForm
        attachType={formTodoAttachType} setAttachType={setFormTodoAttachType}
        attachUrl={formTodoAttachUrl} setAttachUrl={setFormTodoAttachUrl}
        isUploading={isUploadingTodoAttach} onFileChange={handleTodoImageUpload}
      />
      <button onClick={saveTodo} disabled={isSavingTodo} style={{ width:'100%', padding:'12px 0', borderRadius:12, background:isSavingTodo?'#ddd':'linear-gradient(135deg,#6C5CE7,#00B894)', border:'none', color:'#fff', fontSize:14, fontWeight:700, cursor:isSavingTodo?'not-allowed':'pointer' }}>
        {isSavingTodo ? '저장 중...' : '✅ 할일 등록'}
      </button>
    </div>
  )

  // ── 공지 탭 콘텐츠 ──
  const noticeTabContent = (
    <>
      {overdueCount > 0 && (
        <div style={{ ...bx, border:'1px solid rgba(255,107,53,0.3)', background:'rgba(255,107,53,0.02)', marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#FF6B35', marginBottom:8 }}>⚠️ 미완료 할일 {overdueCount}개</div>
          {overdueTodos.slice(0,3).map(todo => {
            const urgentColor = todo.day_count >= 3 ? '#E84393' : todo.day_count >= 2 ? '#FF6B35' : '#FDC400'
            return (
              <div key={`${todo.id}-${todo.origin_date}`} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom:'1px solid #F4F6F9' }}>
                <span style={{ fontSize:11, fontWeight:700, color: urgentColor, background:`${urgentColor}15`, padding:'1px 6px', borderRadius:6, flexShrink:0 }}>{todo.day_count}일째</span>
                <span style={{ fontSize:13, color:'#1a1a2e', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{todo.content}</span>
                <span style={{ fontSize:10, color:'#bbb', flexShrink:0 }}>{todo.origin_date?.replace(/-/g,'.')}</span>
              </div>
            )
          })}
          {overdueCount > 3 && <div style={{ fontSize:11, color:'#bbb', textAlign:'center', paddingTop:8 }}>외 {overdueCount - 3}개 더...</div>}
        </div>
      )}
      {noticeForm}
      {notices.filter(n => n.title !== '__PERSONAL_CHECKLIST__').length === 0 ? (
        <div style={{ ...bx, textAlign:'center', padding:32, color:'#bbb' }}>
          <div style={{ fontSize:24, marginBottom:8 }}>📭</div>
          <div style={{ fontSize:13 }}>등록된 공지가 없습니다</div>
          {isManager && <div style={{ fontSize:11, marginTop:4, color:'#aaa' }}>상단 "+ 공지 작성"으로 추가하세요</div>}
        </div>
      ) : (
        <>
          {notices.filter(n => n.is_pinned && n.title !== '__PERSONAL_CHECKLIST__').length > 0 && (
            <div style={{ marginBottom:4 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#6C5CE7', marginBottom:6, paddingLeft:2 }}>📌 고정</div>
              {notices.filter(n => n.is_pinned && n.title !== '__PERSONAL_CHECKLIST__').map(notice => (
                <NoticeCard key={notice.id} notice={notice} reads={noticeReads[notice.id]||[]} myName={userName} isManager={isManager} onRead={markRead}
                  onEdit={n => { setEditingNotice(n); setFormTitle(n.title); setFormContent(n.content||''); setFormPinned(n.is_pinned); setFormNoticeAttachType(n.attachment_type||'none'); setFormNoticeAttachUrl(n.attachment_url||''); setShowNoticeForm(true) }}
                  onDelete={deleteNotice} />
              ))}
            </div>
          )}
          {notices.filter(n => !n.is_pinned && n.title !== '__PERSONAL_CHECKLIST__').length > 0 && (
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#aaa', marginBottom:6, paddingLeft:2 }}>📋 전체 공지</div>
              {notices.filter(n => !n.is_pinned && n.title !== '__PERSONAL_CHECKLIST__').map(notice => (
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
      ) : dayNotices.filter((notice: any) => notice.title !== '__PERSONAL_MEMO__' || isOwner).map(notice => (
        <div key={notice.id} style={bx}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{notice.title}</div>
              <div style={{ fontSize:10, color:'#bbb', marginTop:2 }}>{notice.created_by}</div>
            </div>
            {isManager && (
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                <button onClick={() => { setEditingNotice(notice); setFormTitle(notice.title); setFormContent(notice.content||''); setFormPinned(notice.is_pinned); setFormNoticeAttachType(notice.attachment_type||'none'); setFormNoticeAttachUrl(notice.attachment_url||''); setShowTodoForm(false); setShowNoticeForm(false)
                  // 그룹명 인라인 수정
                  const newTitle = prompt('그룹명 수정:', notice.title); if (newTitle) updateNoticeTodoTitle(notice.id, newTitle)
                }} style={{ fontSize:11, color:'#6C5CE7', background:'rgba(108,92,231,0.08)', border:'1px solid rgba(108,92,231,0.2)', borderRadius:6, padding:'2px 8px', cursor:'pointer' }}>수정</button>
                <button onClick={() => deleteTodoNotice(notice.id)} style={{ fontSize:11, color:'#E84393', background:'rgba(232,67,147,0.08)', border:'1px solid rgba(232,67,147,0.2)', borderRadius:6, padding:'2px 8px', cursor:'pointer' }}>삭제</button>
              </div>
            )}
          </div>
          {(notice.notice_todos||[])
            .filter((todo: any) => canViewByVisibility(todo.visibility, userRole))
            .map((todo: any) => (
              <div key={todo.id}>
                {editingTodoItem?.id === todo.id ? (
                  <div style={{ display:'flex', gap:6, marginBottom:6, padding:'6px 0' }}>
                    <input value={editTodoItemContent} onChange={e => setEditTodoItemContent(e.target.value)}
                      onKeyDown={e => { if (e.key==='Enter') updateNoticeTodoItem(todo.id, editTodoItemContent); if (e.key==='Escape') setEditingTodoItem(null) }}
                      autoFocus
                      style={{ flex:1, padding:'6px 10px', borderRadius:8, border:'1px solid #6C5CE7', fontSize:13, outline:'none' }} />
                    <button onClick={() => updateNoticeTodoItem(todo.id, editTodoItemContent)}
                      style={{ padding:'6px 12px', borderRadius:8, background:'#6C5CE7', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>저장</button>
                    <button onClick={() => setEditingTodoItem(null)}
                      style={{ padding:'6px 10px', borderRadius:8, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', fontSize:12, cursor:'pointer' }}>취소</button>
                  </div>
                ) : (
                  <div style={{ position:'relative' }}>
                    <TodoItem
                      todo={todo} checks={noticeTodoChecks[todo.id]||[]}
                      onToggle={() => toggleNoticeTodo(todo.id, notice.notice_date, todo)}
                      canCheck={canCheckDate(notice.notice_date)} myName={userName} userRole={userRole}
                      onMissionComplete={(todoId) => setMissionModal({ todoId, content: todo.content, noticeDate: notice.notice_date })}
                    />
                    {isManager && (
                      <div style={{ display:'flex', gap:4, justifyContent:'flex-end', marginTop:-4, marginBottom:4 }}>
                        <button onClick={() => { setEditingTodoItem(todo); setEditTodoItemContent(todo.content) }}
                          style={{ fontSize:10, color:'#6C5CE7', background:'rgba(108,92,231,0.08)', border:'1px solid rgba(108,92,231,0.2)', borderRadius:5, padding:'1px 7px', cursor:'pointer' }}>✏️ 수정</button>
                        <button onClick={() => deleteNoticeTodoItem(todo.id)}
                          style={{ fontSize:10, color:'#E84393', background:'rgba(232,67,147,0.08)', border:'1px solid rgba(232,67,147,0.2)', borderRadius:5, padding:'1px 7px', cursor:'pointer' }}>🗑 삭제</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
        </div>
      ))}
    </>
  )

  // ── 탭 바 ──
  const tabBar = (
    <div style={{ display:'flex', background:'#F4F6F9', borderRadius:12, padding:4, marginBottom:14 }}>
      <button style={tabBtn(subTab==='notice')} onClick={() => setSubTab('notice')}>
        📢 공지 {unreadCount > 0 ? `(${unreadCount})` : notices.filter(n => n.title !== '__PERSONAL_CHECKLIST__').length > 0 ? `(${notices.filter(n => n.title !== '__PERSONAL_CHECKLIST__').length})` : ''}
      </button>
      <button style={tabBtn(subTab==='todo')} onClick={() => setSubTab('todo')}>
        ✅ 할일 {overdueCount > 0 ? `(${overdueCount} 미완료)` : ''}
      </button>
      {isOwner && (
        <button style={tabBtn(subTab==='admin')} onClick={() => setSubTab('admin')}>
          👑 관리
        </button>
      )}
      <button style={tabBtn(subTab==='stats')} onClick={() => setSubTab('stats')}>
        📊 통계
      </button>
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
        <button onClick={() => { setShowTodoForm(p=>!p); setFormTodoTitle(''); setFormTodos(['']); setFormTodoVisibility('all'); setFormTodoRepeat('none'); setFormTodoMission(false); setFormTodoAttachType('none'); setFormTodoAttachUrl('') }}
          style={{ padding:'6px 14px', borderRadius:9, background:'rgba(108,92,231,0.1)', border:'1px solid rgba(108,92,231,0.3)', color:'#6C5CE7', fontSize:12, fontWeight:700, cursor:'pointer' }}>
          {showTodoForm ? '✕ 취소' : '+ 할일 추가'}
        </button>
      )}
    </>
  )

  // ══ PC 레이아웃 ══
  if (isPC) {
    return (
      <div style={{ width: '100%', minWidth: 0, overflow: 'hidden' }}>
        {/* 헤더 */}
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

        {/* 관리 탭: 2컬럼 풀스크린 */}
        {subTab === 'admin' && isOwner && (
          <AdminTab storeId={storeId} userName={userName} isPC={true} />
        )}

        {/* 공지 탭: 2열 카드 그리드 */}

        {subTab === 'notice' && (
          <div>
            {overdueCount > 0 && (
              <div style={{ ...bx, border:'1px solid rgba(255,107,53,0.3)', background:'rgba(255,107,53,0.04)', marginBottom:14, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
                <span style={{ fontSize:13, fontWeight:700, color:'#FF6B35', flexShrink:0 }}>⚠️ 미완료 할일 {overdueCount}개</span>
                {overdueTodos.slice(0,4).map(todo => {
                  const urgentColor = todo.day_count >= 3 ? '#E84393' : todo.day_count >= 2 ? '#FF6B35' : '#FDC400'
                  return (
                    <span key={`${todo.id}-${todo.origin_date}`} style={{ fontSize:11, color:urgentColor, background:`${urgentColor}10`, padding:'3px 8px', borderRadius:8, border:`1px solid ${urgentColor}25` }}>
                      {todo.day_count}일째 · {todo.content}
                    </span>
                  )
                })}
              </div>
            )}
            {noticeForm}
            {/* 고정 공지 */}
            {notices.filter(n => n.is_pinned && n.title !== '__PERSONAL_CHECKLIST__').length > 0 && (
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#6C5CE7', marginBottom:8, paddingLeft:2 }}>📌 고정 공지</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
                  {notices.filter(n => n.is_pinned && n.title !== '__PERSONAL_CHECKLIST__').map(notice => {
                    const isRead = (noticeReads[notice.id]||[]).find((r:any)=>r.reader_name===userName)
                    const readCount = (noticeReads[notice.id]||[]).length
                    return (
                      <div key={notice.id} onClick={() => setSelectedNotice(selectedNotice?.id===notice.id ? null : notice)}
                        style={{ background:'#fff', borderRadius:14, border: selectedNotice?.id===notice.id ? '2px solid #6C5CE7' : '1px solid rgba(108,92,231,0.25)', padding:16, cursor:'pointer', transition:'box-shadow 0.15s', boxShadow: selectedNotice?.id===notice.id ? '0 4px 16px rgba(108,92,231,0.15)' : '0 1px 4px rgba(0,0,0,0.04)' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:'#1a1a2e', flex:1, lineHeight:1.3 }}>{notice.title}</div>
                          {!isRead && <span style={{ fontSize:9, padding:'2px 6px', borderRadius:6, background:'#FF6B35', color:'#fff', fontWeight:700, flexShrink:0, marginLeft:6 }}>NEW</span>}
                        </div>
                        {notice.content && <div style={{ fontSize:12, color:'#666', lineHeight:1.5, marginBottom:8, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{notice.content}</div>}
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontSize:10, color:'#bbb' }}>{notice.created_by} · {notice.notice_date?.replace(/-/g,'.')}</span>
                          <span style={{ fontSize:10, color:'#00B894' }}>👁 {readCount}명</span>
                        </div>
                        {selectedNotice?.id===notice.id && (
                          <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid #F4F6F9' }}>
                            {notice.content && <div style={{ fontSize:13, color:'#444', lineHeight:1.7, marginBottom:10, padding:'8px 10px', background:'#F8F9FB', borderRadius:8, whiteSpace:'pre-wrap' }}>{notice.content}</div>}
                            <AttachmentView url={notice.attachment_url} type={notice.attachment_type} />
                            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:8, marginBottom:8 }}>
                              {(noticeReads[notice.id]||[]).map((r:any) => (
                                <span key={r.id} style={{ fontSize:10, padding:'2px 6px', borderRadius:6, background:'rgba(0,184,148,0.1)', color:'#00B894' }}>{r.reader_name}</span>
                              ))}
                            </div>
                            <div style={{ display:'flex', gap:6, marginTop:6 }}>
                              {!isRead && <button onClick={e=>{e.stopPropagation();markRead(notice.id)}} style={{ flex:2, padding:'7px 0', borderRadius:8, background:'linear-gradient(135deg,#6C5CE7,#00B894)', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>✓ 읽음 확인</button>}
                              {isManager && <button onClick={e=>{e.stopPropagation();setEditingNotice(notice);setFormTitle(notice.title);setFormContent(notice.content||'');setFormPinned(notice.is_pinned);setFormNoticeAttachType(notice.attachment_type||'none');setFormNoticeAttachUrl(notice.attachment_url||'');setShowNoticeForm(true)}} style={{ flex:1, padding:'7px 0', borderRadius:8, background:'rgba(108,92,231,0.1)', border:'1px solid rgba(108,92,231,0.3)', color:'#6C5CE7', fontSize:11, cursor:'pointer' }}>수정</button>}
                              {isManager && <button onClick={e=>{e.stopPropagation();deleteNotice(notice.id);setSelectedNotice(null)}} style={{ flex:1, padding:'7px 0', borderRadius:8, background:'rgba(232,67,147,0.1)', border:'1px solid rgba(232,67,147,0.3)', color:'#E84393', fontSize:11, cursor:'pointer' }}>삭제</button>}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {/* 전체 공지 */}
            <div style={{ fontSize:11, fontWeight:700, color:'#aaa', marginBottom:8, paddingLeft:2 }}>📋 전체 공지</div>
            {notices.filter(n => !n.is_pinned && n.title !== '__PERSONAL_CHECKLIST__').length === 0 ? (
              <div style={{ ...bx, textAlign:'center', padding:32, color:'#bbb' }}>
                <div style={{ fontSize:24, marginBottom:8 }}>📭</div>
                <div style={{ fontSize:13 }}>등록된 공지가 없습니다</div>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
                {notices.filter(n => !n.is_pinned && n.title !== '__PERSONAL_CHECKLIST__').map(notice => {
                  const isRead = (noticeReads[notice.id]||[]).find((r:any)=>r.reader_name===userName)
                  const readCount = (noticeReads[notice.id]||[]).length
                  return (
                    <div key={notice.id} onClick={() => setSelectedNotice(selectedNotice?.id===notice.id ? null : notice)}
                      style={{ background:'#fff', borderRadius:14, border: selectedNotice?.id===notice.id ? '2px solid #6C5CE7' : '1px solid #E8ECF0', padding:16, cursor:'pointer', boxShadow: selectedNotice?.id===notice.id ? '0 4px 16px rgba(108,92,231,0.12)' : '0 1px 4px rgba(0,0,0,0.04)' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'#1a1a2e', flex:1, lineHeight:1.3 }}>{notice.title}</div>
                        {!isRead && <span style={{ fontSize:9, padding:'2px 6px', borderRadius:6, background:'#FF6B35', color:'#fff', fontWeight:700, flexShrink:0, marginLeft:6 }}>NEW</span>}
                      </div>
                      {notice.content && <div style={{ fontSize:12, color:'#666', lineHeight:1.5, marginBottom:8, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{notice.content}</div>}
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:10, color:'#bbb' }}>{notice.created_by} · {notice.notice_date?.replace(/-/g,'.')}</span>
                        <span style={{ fontSize:10, color:'#00B894' }}>👁 {readCount}명</span>
                      </div>
                      {selectedNotice?.id===notice.id && (
                        <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid #F4F6F9' }}>
                          {notice.content && <div style={{ fontSize:13, color:'#444', lineHeight:1.7, marginBottom:10, padding:'8px 10px', background:'#F8F9FB', borderRadius:8, whiteSpace:'pre-wrap' }}>{notice.content}</div>}
                          <AttachmentView url={notice.attachment_url} type={notice.attachment_type} />
                          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:8, marginBottom:8 }}>
                            {(noticeReads[notice.id]||[]).map((r:any) => (
                              <span key={r.id} style={{ fontSize:10, padding:'2px 6px', borderRadius:6, background:'rgba(0,184,148,0.1)', color:'#00B894' }}>{r.reader_name}</span>
                            ))}
                          </div>
                          <div style={{ display:'flex', gap:6, marginTop:6 }}>
                            {!isRead && <button onClick={e=>{e.stopPropagation();markRead(notice.id)}} style={{ flex:2, padding:'7px 0', borderRadius:8, background:'linear-gradient(135deg,#6C5CE7,#00B894)', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>✓ 읽음 확인</button>}
                            {isManager && <button onClick={e=>{e.stopPropagation();setEditingNotice(notice);setFormTitle(notice.title);setFormContent(notice.content||'');setFormPinned(notice.is_pinned);setFormNoticeAttachType(notice.attachment_type||'none');setFormNoticeAttachUrl(notice.attachment_url||'');setShowNoticeForm(true)}} style={{ flex:1, padding:'7px 0', borderRadius:8, background:'rgba(108,92,231,0.1)', border:'1px solid rgba(108,92,231,0.3)', color:'#6C5CE7', fontSize:11, cursor:'pointer' }}>수정</button>}
                            {isManager && <button onClick={e=>{e.stopPropagation();deleteNotice(notice.id);setSelectedNotice(null)}} style={{ flex:1, padding:'7px 0', borderRadius:8, background:'rgba(232,67,147,0.1)', border:'1px solid rgba(232,67,147,0.3)', color:'#E84393', fontSize:11, cursor:'pointer' }}>삭제</button>}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* 할일 탭: 3단 - 캘린더 | 미완료+마감전달사항 | 오늘 할일 */}
        {subTab === 'todo' && (
          <div style={{ display:'grid', gridTemplateColumns:'220px 1fr 1fr', gap:16, alignItems:'start' }}>
            {/* 1열: 캘린더 */}
            <div style={{ position:'sticky', top:80 }}>
              <MiniCalendar
                year={calYear} month={calMonth}
                todoDates={todoDates} selectedDate={selectedDate}
                onSelectDate={d => { setSelectedDate(d); const [y,m]=d.split('-').map(Number); setCalYear(y); setCalMonth(m-1) }}
                onChangeMonth={(y,m) => { setCalYear(y); setCalMonth(m) }}
              />
            </div>
            {/* 2열: 미완료 이월 + 마감 전달사항 (세로 스택) */}
            <div style={{ position:'sticky', top:80, display:'flex', flexDirection:'column', gap:12 }}>
              {/* 미완료 이월 */}
              {overdueTodos.length > 0 ? (
                <div style={{ borderRadius:14, border:'2px solid rgba(232,67,147,0.4)', background:'rgba(232,67,147,0.04)', padding:14 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                    <span style={{ fontSize:13, fontWeight:800, color:'#E84393' }}>⚠️ 미완료 이월</span>
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:8, background:'rgba(232,67,147,0.15)', color:'#E84393', fontWeight:700 }}>{overdueCount}개</span>
                  </div>
                  {overdueTodos.map(todo => {
                    const urgentColor = todo.day_count >= 3 ? '#E84393' : todo.day_count >= 2 ? '#FF6B35' : '#FDC400'
                    return (
                      <div key={`${todo.id}-${todo.origin_date}`} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom:'1px solid rgba(232,67,147,0.1)' }}>
                        <span style={{ fontSize:10, fontWeight:700, color:urgentColor, background:`${urgentColor}15`, padding:'2px 6px', borderRadius:6, flexShrink:0 }}>{todo.day_count}일째</span>
                        <span style={{ fontSize:12, color:'#333', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{todo.content}</span>
                        {isManager && (
                          <button onClick={() => moveTodoToToday(todo)} style={{ fontSize:10, padding:'3px 8px', borderRadius:6, background:'rgba(108,92,231,0.1)', border:'1px solid rgba(108,92,231,0.3)', color:'#6C5CE7', cursor:'pointer', flexShrink:0 }}>이동</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ borderRadius:14, border:'1px solid rgba(0,184,148,0.25)', background:'rgba(0,184,148,0.04)', padding:14, textAlign:'center' }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>✅</div>
                  <div style={{ fontSize:12, color:'#00B894', fontWeight:600 }}>이월 할일 없음</div>
                </div>
              )}
              {/* 마감 전달사항 */}
              <div style={{ borderRadius:14, border: closingTodos.length>0?'2px solid rgba(255,107,53,0.35)':'1px solid #E8ECF0', background: closingTodos.length>0?'rgba(255,107,53,0.03)':'#fff', padding:14 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:'#FF6B35' }}>📢 마감 전달사항</span>
                  <span style={{ fontSize:10, color:'#bbb' }}>{closingDateLabel}</span>
                </div>
                {closingTodos.length === 0
                  ? <div style={{ textAlign:'center', padding:'12px 0', color:'#bbb', fontSize:12 }}>전달사항 없음 ✓</div>
                  : closingTodos.map((todo: any) => (
                    <TodoItem key={todo.id} todo={todo} checks={closingChecks[todo.id]||[]} onToggle={() => toggleClosingTodo(todo.id)} canCheck={canCheckDate(selectedDate)} myName={userName} userRole={userRole} />
                  ))
                }
              </div>
            </div>
            {/* 3열: 오늘 할일 */}
            <div>
              {todoForm}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#1a1a2e' }}>
                  {selectedDate.replace(/-/g,'.')} 할일
                  {selectedDate === today && <span style={{ fontSize:10, color:'#FF6B35', background:'rgba(255,107,53,0.1)', padding:'1px 7px', borderRadius:6, marginLeft:6 }}>오늘</span>}
                </div>
                {!canCheckDate(selectedDate) && <span style={{ fontSize:10, color:'#bbb' }}>당일만 체크 가능</span>}
              </div>
              {dayNotices.length === 0 ? (
                <div style={{ ...bx, textAlign:'center', padding:24, color:'#bbb' }}>
                  <div style={{ fontSize:18, marginBottom:6 }}>✅</div>
                  <div style={{ fontSize:13 }}>이 날짜에 등록된 할일이 없습니다</div>
                  {isManager && <div style={{ fontSize:11, marginTop:4, color:'#aaa' }}>상단 "+ 할일 추가"로 등록하세요</div>}
                </div>
              ) : dayNotices.filter((notice: any) => notice.title !== '__PERSONAL_MEMO__' || isOwner).map(notice => (
                <div key={notice.id} style={bx}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{notice.title}</div>
                      <div style={{ fontSize:10, color:'#bbb', marginTop:2 }}>{notice.created_by}</div>
                    </div>
                    {isManager && (
                      <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                        <button onClick={() => { const t=prompt('그룹명 수정:',notice.title); if(t) updateNoticeTodoTitle(notice.id,t) }}
                          style={{ fontSize:11, color:'#6C5CE7', background:'rgba(108,92,231,0.08)', border:'1px solid rgba(108,92,231,0.2)', borderRadius:6, padding:'2px 8px', cursor:'pointer' }}>수정</button>
                        <button onClick={() => deleteTodoNotice(notice.id)}
                          style={{ fontSize:11, color:'#E84393', background:'rgba(232,67,147,0.08)', border:'1px solid rgba(232,67,147,0.2)', borderRadius:6, padding:'2px 8px', cursor:'pointer' }}>삭제</button>
                      </div>
                    )}
                  </div>
                  {(notice.notice_todos||[])
                    .filter((todo: any) => canViewByVisibility(todo.visibility, userRole))
                    .map((todo: any) => (
                      <div key={todo.id}>
                        {editingTodoItem?.id === todo.id ? (
                          <div style={{ display:'flex', gap:6, marginBottom:6, padding:'6px 0' }}>
                            <input value={editTodoItemContent} onChange={e => setEditTodoItemContent(e.target.value)}
                              onKeyDown={e => { if(e.key==='Enter') updateNoticeTodoItem(todo.id,editTodoItemContent); if(e.key==='Escape') setEditingTodoItem(null) }}
                              autoFocus style={{ flex:1, padding:'6px 10px', borderRadius:8, border:'1px solid #6C5CE7', fontSize:13, outline:'none' }} />
                            <button onClick={() => updateNoticeTodoItem(todo.id,editTodoItemContent)}
                              style={{ padding:'6px 12px', borderRadius:8, background:'#6C5CE7', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>저장</button>
                            <button onClick={() => setEditingTodoItem(null)}
                              style={{ padding:'6px 10px', borderRadius:8, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', fontSize:12, cursor:'pointer' }}>취소</button>
                          </div>
                        ) : (
                          <div style={{ position:'relative' }}>
                            <TodoItem
                              todo={todo} checks={noticeTodoChecks[todo.id]||[]}
                              onToggle={() => toggleNoticeTodo(todo.id, notice.notice_date, todo)}
                              canCheck={canCheckDate(notice.notice_date)} myName={userName} userRole={userRole}
                              onMissionComplete={(todoId) => setMissionModal({ todoId, content: todo.content, noticeDate: notice.notice_date })}
                            />
                            {isManager && (
                              <div style={{ display:'flex', gap:4, justifyContent:'flex-end', marginTop:-4, marginBottom:4 }}>
                                <button onClick={() => { setEditingTodoItem(todo); setEditTodoItemContent(todo.content) }}
                                  style={{ fontSize:10, color:'#6C5CE7', background:'rgba(108,92,231,0.08)', border:'1px solid rgba(108,92,231,0.2)', borderRadius:5, padding:'1px 7px', cursor:'pointer' }}>✏️ 수정</button>
                                <button onClick={() => deleteNoticeTodoItem(todo.id)}
                                  style={{ fontSize:10, color:'#E84393', background:'rgba(232,67,147,0.08)', border:'1px solid rgba(232,67,147,0.2)', borderRadius:5, padding:'1px 7px', cursor:'pointer' }}>🗑 삭제</button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 반복 할일 복사 제안 */}
        {repeatSuggest && (
          <div style={{ position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)', background:'#fff', borderRadius:16, padding:16, boxShadow:'0 4px 20px rgba(0,0,0,0.15)', border:'1px solid rgba(0,184,148,0.3)', zIndex:100, maxWidth:360, width:'90%' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#00B894', marginBottom:8 }}>🔁 반복 할일</div>
            <div style={{ fontSize:12, color:'#444', marginBottom:12 }}>"{repeatSuggest.content}" — {REPEAT_OPTIONS.find(r=>r.value===repeatSuggest.repeatType)?.label} 반복</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setRepeatSuggest(null)} style={{ flex:1, padding:'9px 0', borderRadius:10, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', fontSize:12, cursor:'pointer' }}>다음에</button>
              <button onClick={() => copyRepeatTodo(repeatSuggest.content, repeatSuggest.repeatType)} style={{ flex:2, padding:'9px 0', borderRadius:10, background:'linear-gradient(135deg,#6C5CE7,#00B894)', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>다음 날짜에 추가하기</button>
            </div>
          </div>
        )}

        {/* 미션 사진 모달 */}
        {missionModal && (
          <MissionPhotoModal
            todoContent={missionModal.content}
            onComplete={() => completeMissionTodo(missionModal.todoId, missionModal.noticeDate, missionPhotoUrl)}
            onCancel={() => { setMissionModal(null); setMissionPhotoUrl('') }}
            onUpload={handleMissionPhotoUpload}
            isUploading={isUploadingMissionPhoto}
            photoUrl={missionPhotoUrl}
          />
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
          ) : dayNotices.filter((notice: any) => notice.title !== '__PERSONAL_MEMO__' || isOwner).map(notice => (
            <div key={notice.id} style={bx}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{notice.title}</div>
                  <div style={{ fontSize:10, color:'#bbb', marginTop:2 }}>{notice.created_by}</div>
                </div>
                {isManager && <button onClick={() => deleteTodoNotice(notice.id)} style={{ fontSize:11, color:'#E84393', background:'rgba(232,67,147,0.08)', border:'1px solid rgba(232,67,147,0.2)', borderRadius:6, padding:'2px 8px', cursor:'pointer' }}>삭제</button>}
              </div>
              {(notice.notice_todos||[])
                .filter((todo: any) => canViewByVisibility(todo.visibility, userRole))
                .map((todo: any) => (
                  <TodoItem
                    key={todo.id} todo={todo} checks={noticeTodoChecks[todo.id]||[]}
                    onToggle={() => toggleNoticeTodo(todo.id, notice.notice_date, todo)}
                    canCheck={canCheckDate(notice.notice_date)} myName={userName} userRole={userRole}
                    onMissionComplete={(todoId) => setMissionModal({ todoId, content: todo.content, noticeDate: notice.notice_date })}
                  />
                ))}
            </div>
          ))}
        </>
      )}

      {subTab === 'stats' && (
        <div>
          {/* 내 지점 통계 헤더 */}
          <div style={{ fontSize:11, color:'#888', marginBottom:10, padding:'6px 10px', background:'rgba(108,92,231,0.05)', borderRadius:8 }}>📍 내 지점 기준 통계</div>
          {/* 월 네비게이션 */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, background:'#fff', borderRadius:14, padding:'10px 14px', border:'1px solid #F0F0F0' }}>
            <button onClick={() => { const d=new Date(myStatsYear,myStatsMonth-2,1); setMyStatsYear(d.getFullYear()); setMyStatsMonth(d.getMonth()+1); loadMyStats(d.getFullYear(),d.getMonth()+1) }}
              style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#6C5CE7', padding:'0 8px' }}>‹</button>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:15, fontWeight:800, color:'#1a1a2e' }}>{myStatsYear}년 {myStatsMonth}월</div>
              <div style={{ fontSize:10, color:'#bbb', marginTop:2 }}>{myStatsData ? `할일 ${myStatsData.totalTodos}개 · 완료 ${myStatsData.totalChecks}건` : '데이터 로딩 중'}</div>
            </div>
            <button onClick={() => { const d=new Date(myStatsYear,myStatsMonth,1); setMyStatsYear(d.getFullYear()); setMyStatsMonth(d.getMonth()+1); loadMyStats(d.getFullYear(),d.getMonth()+1) }}
              style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#6C5CE7', padding:'0 8px' }}>›</button>
          </div>
          {myStatsLoading ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:'#bbb' }}>📊 불러오는 중...</div>
          ) : !myStatsData ? (
            <div style={{ textAlign:'center', padding:'40px 0', color:'#bbb' }}>‹ › 로 월을 선택하세요</div>
          ) : (
            <>
              {/* 요약 */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:14 }}>
                {[
                  { label:'전체 할일', value:myStatsData.totalTodos+'개', color:'#6C5CE7' },
                  { label:'완료 체크', value:myStatsData.totalChecks+'건', color:'#00B894' },
                  { label:'활동 인원', value:Object.keys(myStatsData.personMap).length+'명', color:'#E84393' },
                ].map(({label,value,color})=>(
                  <div key={label} style={{ background:'#fff', borderRadius:12, padding:'12px 8px', textAlign:'center', border:`1px solid ${color}33` }}>
                    <div style={{ fontSize:17, fontWeight:800, color }}>{value}</div>
                    <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>{label}</div>
                  </div>
                ))}
              </div>
              {/* 직원 랭킹 */}
              <div style={{ background:'#fff', borderRadius:14, padding:'14px', marginBottom:12, border:'1px solid #F0F0F0' }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:12, color:'#1a1a2e' }}>🏆 직원별 완료 랭킹</div>
                {Object.entries(myStatsData.personMap as Record<string,any>).sort((a,b)=>b[1].checks-a[1].checks).map(([name,data],idx)=>{
                  const maxC = Math.max(...Object.values(myStatsData.personMap as Record<string,any>).map((v:any)=>v.checks),1)
                  const pct = Math.round((data.checks/maxC)*100)
                  const medals=['🥇','🥈','🥉']
                  const isMe = name===userName
                  return (
                    <div key={name} style={{ marginBottom:10 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                        <div style={{ fontSize:12, fontWeight:isMe?700:400, color:isMe?'#E84393':'#333' }}>
                          {medals[idx]||`${idx+1}.`} {name}{isMe&&<span style={{fontSize:10,marginLeft:4,color:'#E84393'}}>(나)</span>}
                        </div>
                        <div style={{ fontSize:11, color:'#888' }}>{data.checks}건 · {data.days}일</div>
                      </div>
                      <div style={{ background:'#F4F6F9', borderRadius:8, height:8, overflow:'hidden' }}>
                        <div style={{ width:`${pct}%`, height:'100%', background:idx===0?'linear-gradient(90deg,#6C5CE7,#E84393)':'#a29bfe88', borderRadius:8 }} />
                      </div>
                    </div>
                  )
                })}
                {Object.keys(myStatsData.personMap).length===0 && <div style={{ textAlign:'center', color:'#ccc', fontSize:12, padding:'12px 0' }}>활동 기록이 없어요</div>}
              </div>
              {/* 날짜별 그래프 */}
              <div style={{ background:'#fff', borderRadius:14, padding:'14px', marginBottom:12, border:'1px solid #F0F0F0' }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:10, color:'#1a1a2e' }}>📈 날짜별 완료</div>
                {(()=>{
                  const dates:string[]=[]
                  for(let d=new Date(myStatsData.startDate);d<=new Date(myStatsData.endDate);d.setDate(d.getDate()+1)) dates.push(d.toISOString().slice(0,10))
                  const maxV=Math.max(...dates.map(d=>myStatsData.dateMap[d]||0),1)
                  return (
                    <div style={{ display:'flex', alignItems:'flex-end', gap:2, height:64 }}>
                      {dates.map(d=>{
                        const val=myStatsData.dateMap[d]||0
                        const h=Math.max((val/maxV)*52,val>0?4:0)
                        const isToday=d===today
                        return (
                          <div key={d} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
                            {val>0&&<div style={{ fontSize:7, color:'#6C5CE7', fontWeight:700 }}>{val}</div>}
                            <div style={{ width:'100%', height:h, background:isToday?'linear-gradient(180deg,#E84393,#6C5CE7)':'#a29bfe', borderRadius:'2px 2px 0 0', minHeight:val>0?4:0 }} />
                            <div style={{ fontSize:6, color:isToday?'#E84393':'#ccc', fontWeight:isToday?700:400 }}>{d.slice(8)}</div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
              {/* 전체 할일 + 체커 */}
              <div style={{ background:'#fff', borderRadius:14, padding:'14px', marginBottom:12, border:'1px solid #F0F0F0' }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:12, color:'#1a1a2e' }}>📋 이달 할일 전체 <span style={{ fontSize:10, color:'#aaa', fontWeight:400 }}>누가 완료했는지</span></div>
                {myStatsData.allTodos.length===0 ? (
                  <div style={{ textAlign:'center', color:'#ccc', fontSize:12, padding:'12px 0' }}>이 기간 할일이 없어요</div>
                ) : myStatsData.allTodos.sort((a:any,b:any)=>a.noticeDate>b.noticeDate?-1:1).map((todo:any)=>{
                  const isDone=todo.checkers.length>0
                  const isExp=myExpandedTodo===todo.id
                  return (
                    <div key={todo.id} style={{ marginBottom:6, borderRadius:10, border:`1px solid ${isDone?'rgba(0,184,148,0.2)':'#F0F0F0'}`, overflow:'hidden' }}>
                      <div onClick={()=>setMyExpandedTodo(isExp?null:todo.id)}
                        style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', cursor:'pointer', background:isDone?'rgba(0,184,148,0.04)':'#fff' }}>
                        <span style={{ fontSize:13, color:isDone?'#00B894':'#ddd', flexShrink:0 }}>{isDone?'✅':'○'}</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, color:isDone?'#555':'#333', textDecoration:isDone?'line-through':'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{todo.content}</div>
                          <div style={{ fontSize:10, color:'#bbb', marginTop:1 }}>{todo.noticeDate}</div>
                        </div>
                        {isDone&&<span style={{ fontSize:10, color:'#00B894', fontWeight:700, flexShrink:0 }}>{todo.checkers.length}명 ▾</span>}
                      </div>
                      {isExp&&isDone&&(
                        <div style={{ background:'rgba(0,184,148,0.04)', padding:'6px 12px 10px', borderTop:'1px solid rgba(0,184,148,0.1)' }}>
                          {todo.checkers.map((c:any,i:number)=>(
                            <div key={i} style={{ fontSize:11, color:'#555', padding:'3px 0', display:'flex', justifyContent:'space-between' }}>
                              <span>✓ <strong>{c.checked_by}</strong></span>
                              <span style={{ color:'#aaa' }}>{new Date(c.checked_at).toLocaleString('ko',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {isExp&&!isDone&&(
                        <div style={{ background:'#FFF9F0', padding:'8px 12px', borderTop:'1px solid #F0F0F0' }}>
                          <div style={{ fontSize:11, color:'#FFB347' }}>⚠️ 아직 아무도 완료하지 않았어요</div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {/* 공지 읽음 현황 */}
              <div style={{ background:'#fff', borderRadius:14, padding:'14px', border:'1px solid #F0F0F0' }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:12, color:'#1a1a2e' }}>📢 공지 읽음 현황</div>
                {myStatsData.noticeList.length===0 ? (
                  <div style={{ textAlign:'center', color:'#ccc', fontSize:12, padding:'12px 0' }}>이 기간 공지가 없어요</div>
                ) : myStatsData.noticeList.map((n:any)=>{
                  const readers=myStatsData.noticeReadMap[n.id]||[]
                  return (
                    <div key={n.id} style={{ padding:'8px 0', borderBottom:'1px solid #F4F6F9' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                        <div style={{ fontSize:12, color:'#333', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n.title}</div>
                        <span style={{ fontSize:10, color:readers.length>0?'#00B894':'#FFB347', fontWeight:700, flexShrink:0, marginLeft:8 }}>{readers.length}명 읽음</span>
                      </div>
                      {readers.length>0&&<div style={{ fontSize:10, color:'#00B894' }}>✓ {readers.join(', ')}</div>}
                      {readers.length===0&&<div style={{ fontSize:10, color:'#FFB347' }}>아직 읽은 사람 없음</div>}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
      )}

      {subTab === 'admin' && isOwner && (
        <AdminTab storeId={storeId} userName={userName} isPC={false} />
      )}

      {/* 반복 할일 복사 제안 */}
      {repeatSuggest && (
        <div style={{ position:'fixed', bottom:80, left:16, right:16, background:'#fff', borderRadius:16, padding:16, boxShadow:'0 4px 20px rgba(0,0,0,0.15)', border:'1px solid rgba(0,184,148,0.3)', zIndex:100 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#00B894', marginBottom:8 }}>🔁 반복 할일 — {REPEAT_OPTIONS.find(r=>r.value===repeatSuggest.repeatType)?.label}</div>
          <div style={{ fontSize:12, color:'#444', marginBottom:12 }}>"{repeatSuggest.content}"을 다음 날짜에도 추가할까요?</div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setRepeatSuggest(null)} style={{ flex:1, padding:'9px 0', borderRadius:10, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', fontSize:12, cursor:'pointer' }}>건너뛰기</button>
            <button onClick={() => copyRepeatTodo(repeatSuggest.content, repeatSuggest.repeatType)} style={{ flex:2, padding:'9px 0', borderRadius:10, background:'linear-gradient(135deg,#6C5CE7,#00B894)', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>다음 날짜에 추가 ✓</button>
          </div>
        </div>
      )}

      {/* 미션 사진 모달 */}
      {missionModal && (
        <MissionPhotoModal
          todoContent={missionModal.content}
          onComplete={() => completeMissionTodo(missionModal.todoId, missionModal.noticeDate, missionPhotoUrl)}
          onCancel={() => { setMissionModal(null); setMissionPhotoUrl('') }}
          onUpload={handleMissionPhotoUpload}
          isUploading={isUploadingMissionPhoto}
          photoUrl={missionPhotoUrl}
        />
      )}
    </div>
  )
}