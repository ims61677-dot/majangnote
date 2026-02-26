'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
const lbl = { fontSize: 11, color: '#888', marginBottom: 4, display: 'block' as const }

const DEFAULT_PLATFORMS = ['카드', '현금', '계좌이체', '배달의민족', '쿠팡이츠', '요기요']
const DEFAULT_CHECKLIST = ['가스 밸브 잠금', '냉장고 온도 확인', '시재 봉투 금고 보관', '쓰레기 분리수거', '전등 소등', '출입문 잠금']

function toDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ─────────────────────────────────────────────
// 캘린더 컴포넌트
// ─────────────────────────────────────────────
function ClosingCalendar({ year, month, salesMap, selectedDate, onSelectDate, onChangeMonth }: {
  year: number; month: number; salesMap: Record<string, number>
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

  const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`
  const totalMonthSales = Object.entries(salesMap).filter(([k]) => k.startsWith(monthStr)).reduce((s, [, v]) => s + v, 0)

  function prevMonth() { month === 0 ? onChangeMonth(year - 1, 11) : onChangeMonth(year, month - 1) }
  function nextMonth() { month === 11 ? onChangeMonth(year + 1, 0) : onChangeMonth(year, month + 1) }

  return (
    <div style={{ ...bx, padding: '14px 12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer', padding: '0 6px' }}>‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>{year}년 {month + 1}월</div>
          {totalMonthSales > 0 && <div style={{ fontSize: 11, color: '#FF6B35', fontWeight: 600, marginTop: 1 }}>월 매출 {totalMonthSales.toLocaleString()}원</div>}
        </div>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer', padding: '0 6px' }}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: i === 0 ? '#E84393' : i === 6 ? '#2DC6D6' : '#aaa', padding: '2px 0' }}>{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
          {week.map((day, di) => {
            if (!day) return <div key={di} />
            const dateStr = `${monthStr}-${String(day).padStart(2, '0')}`
            const sales = salesMap[dateStr]
            const hasSales = sales !== undefined
            const isSelected = dateStr === selectedDate
            const isToday = dateStr === today
            return (
              <button key={di} onClick={() => onSelectDate(dateStr)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '4px 2px', borderRadius: 8, cursor: 'pointer', minHeight: 44,
                border: isSelected ? '2px solid #FF6B35' : isToday ? '1px solid rgba(255,107,53,0.3)' : '1px solid transparent',
                background: isSelected ? 'rgba(255,107,53,0.1)' : hasSales ? 'rgba(0,184,148,0.06)' : 'transparent',
              }}>
                <span style={{ fontSize: 12, fontWeight: isSelected || isToday ? 700 : 400, color: isSelected ? '#FF6B35' : di === 0 ? '#E84393' : di === 6 ? '#2DC6D6' : '#1a1a2e' }}>{day}</span>
                {hasSales && <span style={{ fontSize: 8, color: '#00B894', fontWeight: 600, marginTop: 1, lineHeight: 1 }}>{sales >= 10000 ? `${Math.floor(sales / 10000)}만` : sales.toLocaleString()}</span>}
                {hasSales && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#00B894', marginTop: 1 }} />}
              </button>
            )
          })}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, marginTop: 8, paddingTop: 8, borderTop: '1px solid #F0F0F0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#00B894', display: 'inline-block' }} />
          <span style={{ fontSize: 9, color: '#aaa' }}>마감일지 저장됨</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(255,107,53,0.2)', border: '1px solid #FF6B35', display: 'inline-block' }} />
          <span style={{ fontSize: 9, color: '#aaa' }}>선택된 날짜</span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────
export default function ClosingPage() {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState('')
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()))
  const [closing, setClosing] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [salesMap, setSalesMap] = useState<Record<string, number>>({})
  const closingRef = useRef<any>(null)

  const [openStaff, setOpenStaff] = useState('')
  const [closeStaff, setCloseStaff] = useState('')
  const [visitTables, setVisitTables] = useState(0)
  const [cancelCount, setCancelCount] = useState(0)
  const [cashAmount, setCashAmount] = useState(0)
  const [note, setNote] = useState('')
  const [nextMemo, setNextMemo] = useState('')

  const [platforms, setPlatforms] = useState<any[]>([])
  const [sales, setSales] = useState<Record<string, number>>({})
  const [checkItems, setCheckItems] = useState<any[]>([])
  const [checks, setChecks] = useState<Record<string, any>>({})
  const [memoReads, setMemoReads] = useState<any[]>([])

  const [showPlatformMgr, setShowPlatformMgr] = useState(false)
  const [newPlatformName, setNewPlatformName] = useState('')
  const [showCheckMgr, setShowCheckMgr] = useState(false)
  const [newCheckItem, setNewCheckItem] = useState('')
  const [showMemoPanel, setShowMemoPanel] = useState(false)

  const isManager = userRole === 'owner' || userRole === 'manager'
  const isSaved = !!closingRef.current

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id)
    setUserName(user.nm || '')
    setUserRole(user.role || '')
    loadBase(store.id)
    loadSalesMap(store.id)
  }, [])

  useEffect(() => {
    if (storeId) loadClosing(storeId, selectedDate)
  }, [selectedDate, storeId])

  useEffect(() => { closingRef.current = closing }, [closing])

  // ✅ 각 지점 처음 접속 시 플랫폼/체크리스트 자동 생성
  async function loadBase(sid: string) {
    // 플랫폼
    const { data: pl } = await supabase.from('closing_platforms').select('*').eq('store_id', sid).order('sort_order')
    if (!pl || pl.length === 0) {
      const rows = DEFAULT_PLATFORMS.map((name, i) => ({ store_id: sid, name, sort_order: i + 1 }))
      const { data: inserted } = await supabase.from('closing_platforms').insert(rows).select()
      setPlatforms(inserted || [])
    } else {
      setPlatforms(pl)
    }

    // 체크리스트
    const { data: ci } = await supabase.from('closing_checklist_items').select('*').eq('store_id', sid).order('sort_order')
    if (!ci || ci.length === 0) {
      const rows = DEFAULT_CHECKLIST.map((title, i) => ({ store_id: sid, title, sort_order: i + 1 }))
      const { data: inserted } = await supabase.from('closing_checklist_items').insert(rows).select()
      setCheckItems(inserted || [])
    } else {
      setCheckItems(ci)
    }
  }

  async function loadSalesMap(sid: string) {
    const { data: cls } = await supabase.from('closings').select('id, closing_date').eq('store_id', sid)
    if (!cls || cls.length === 0) return
    const { data: sv } = await supabase.from('closing_sales').select('closing_id, amount').in('closing_id', cls.map((c: any) => c.id))
    const map: Record<string, number> = {}
    cls.forEach((c: any) => {
      const total = sv ? sv.filter((s: any) => s.closing_id === c.id).reduce((sum: number, s: any) => sum + (s.amount || 0), 0) : 0
      map[c.closing_date] = total
    })
    setSalesMap(map)
  }

  async function loadClosing(sid: string, date: string) {
    const { data: cl } = await supabase.from('closings').select('*').eq('store_id', sid).eq('closing_date', date).maybeSingle()
    if (cl) {
      setClosing(cl); closingRef.current = cl
      setOpenStaff(cl.open_staff || ''); setCloseStaff(cl.close_staff || '')
      setVisitTables(cl.visit_tables || 0); setCancelCount(cl.cancel_count || 0)
      setCashAmount(cl.cash_amount || 0); setNote(cl.note || ''); setNextMemo(cl.next_memo || '')
      const { data: sv } = await supabase.from('closing_sales').select('*').eq('closing_id', cl.id)
      const sm: Record<string, number> = {}
      if (sv) sv.forEach((s: any) => { sm[s.platform] = s.amount })
      setSales(sm)
      const { data: ck } = await supabase.from('closing_checks').select('*').eq('closing_id', cl.id)
      const cm: Record<string, any> = {}
      if (ck) ck.forEach((c: any) => { cm[c.item_id] = c })
      setChecks(cm)
      const { data: mr } = await supabase.from('closing_memo_reads').select('*').eq('closing_id', cl.id)
      setMemoReads(mr || [])
      setShowForm(true)
    } else {
      setClosing(null); closingRef.current = null
      setOpenStaff(''); setCloseStaff(''); setVisitTables(0); setCancelCount(0)
      setCashAmount(0); setNote(''); setNextMemo(''); setSales({}); setChecks({}); setMemoReads([])
      setShowForm(false)
    }
  }

  function handleSelectDate(d: string) {
    setSelectedDate(d)
    const [y, m] = d.split('-').map(Number)
    setCalYear(y); setCalMonth(m - 1)
  }

  async function saveClosing() {
    if (!storeId) return
    if (closingRef.current && !isManager) {
      alert('저장된 마감일지는 매니저/대표만 수정할 수 있습니다.')
      return
    }
    setIsSaving(true)
    try {
      const current = closingRef.current
      let closingId: string
      if (current?.id) {
        closingId = current.id
        await supabase.from('closings').update({
          open_staff: openStaff, close_staff: closeStaff,
          visit_tables: visitTables, cancel_count: cancelCount,
          cash_amount: cashAmount, note, next_memo: nextMemo
        }).eq('id', closingId)
      } else {
        const { data, error } = await supabase.from('closings').insert({
          store_id: storeId, closing_date: selectedDate,
          open_staff: openStaff, close_staff: closeStaff,
          visit_tables: visitTables, cancel_count: cancelCount,
          cash_amount: cashAmount, note, next_memo: nextMemo,
          created_by: userName
        }).select().single()
        if (error) throw error
        closingId = data.id
        setClosing(data); closingRef.current = data
      }
      await supabase.from('closing_sales').delete().eq('closing_id', closingId)
      const rows = platforms.map(p => ({ closing_id: closingId, platform: p.name, amount: sales[p.name] || 0, sort_order: p.sort_order }))
      if (rows.length > 0) await supabase.from('closing_sales').insert(rows)
      const newTotal = platforms.reduce((s, p) => s + (sales[p.name] || 0), 0)
      setSalesMap(prev => ({ ...prev, [selectedDate]: newTotal }))
      setShowForm(true)
      alert('저장되었습니다!')
    } catch (e: any) {
      alert('저장 실패: ' + (e?.message || '다시 시도해주세요'))
    } finally {
      setIsSaving(false)
    }
  }

  async function getOrCreateClosingId(): Promise<string> {
    const current = closingRef.current
    if (current?.id) return current.id
    const { data, error } = await supabase.from('closings').insert({
      store_id: storeId, closing_date: selectedDate,
      open_staff: openStaff, close_staff: closeStaff,
      visit_tables: visitTables, cancel_count: cancelCount,
      cash_amount: cashAmount, note, next_memo: nextMemo,
      created_by: userName
    }).select().single()
    if (error) throw error
    setClosing(data); closingRef.current = data
    return data.id
  }

  async function toggleCheck(itemId: string) {
    const closingId = await getOrCreateClosingId()
    if (checks[itemId]) {
      await supabase.from('closing_checks').delete().eq('id', checks[itemId].id)
      setChecks(p => { const n = { ...p }; delete n[itemId]; return n })
    } else {
      const { data } = await supabase.from('closing_checks').insert({
        closing_id: closingId, item_id: itemId,
        checked_by: userName, checked_at: new Date().toISOString()
      }).select().single()
      setChecks(p => ({ ...p, [itemId]: data }))
    }
  }

  async function readMemo() {
    if (!closing?.id || memoReads.find(r => r.read_by === userName)) return
    const { data } = await supabase.from('closing_memo_reads').insert({
      closing_id: closing.id, read_by: userName, read_at: new Date().toISOString()
    }).select().single()
    setMemoReads(p => [...p, data])
  }

  async function addPlatform() {
    if (!newPlatformName.trim()) return
    const maxOrder = platforms.reduce((max, p) => Math.max(max, p.sort_order || 0), 0)
    const { data } = await supabase.from('closing_platforms').insert({ store_id: storeId, name: newPlatformName.trim(), sort_order: maxOrder + 1 }).select().single()
    setPlatforms(p => [...p, data]); setNewPlatformName('')
  }

  async function deletePlatform(id: string) {
    if (!confirm('삭제할까요?')) return
    await supabase.from('closing_platforms').delete().eq('id', id)
    setPlatforms(p => p.filter(x => x.id !== id))
  }

  async function addCheckItem() {
    if (!newCheckItem.trim()) return
    const maxOrder = checkItems.reduce((max, c) => Math.max(max, c.sort_order || 0), 0)
    const { data } = await supabase.from('closing_checklist_items').insert({ store_id: storeId, title: newCheckItem.trim(), sort_order: maxOrder + 1 }).select().single()
    setCheckItems(p => [...p, data]); setNewCheckItem('')
  }

  async function deleteCheckItem(id: string) {
    if (!confirm('삭제할까요?')) return
    await supabase.from('closing_checklist_items').delete().eq('id', id)
    setCheckItems(p => p.filter(x => x.id !== id))
  }

  const totalSales = useMemo(() => platforms.reduce((sum, p) => sum + (sales[p.name] || 0), 0), [platforms, sales])
  const checkedCount = Object.keys(checks).length
  const hasUnreadMemo = closing?.next_memo && !memoReads.find(r => r.read_by === userName)

  return (
    <div>
      {/* 전달사항 팝업 */}
      {showMemoPanel && closing?.next_memo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 360 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>📢 전달사항</div>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 12 }}>이전 마감 담당자의 전달사항입니다</div>
            <div style={{ fontSize: 13, color: '#444', lineHeight: 1.7, background: '#F8F9FB', borderRadius: 12, padding: 14, marginBottom: 14 }}>{closing.next_memo}</div>
            {memoReads.length > 0 && (
              <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 10, background: 'rgba(0,184,148,0.06)', border: '1px solid rgba(0,184,148,0.2)' }}>
                <div style={{ fontSize: 10, color: '#00B894', fontWeight: 700, marginBottom: 4 }}>✓ 읽은 사람</div>
                {memoReads.map(r => <div key={r.id} style={{ fontSize: 11, color: '#666' }}>{r.read_by} · {new Date(r.read_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>)}
              </div>
            )}
            <button onClick={() => { readMemo(); setShowMemoPanel(false) }}
              style={{ width: '100%', padding: '12px 0', borderRadius: 12, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              ✓ 확인했습니다
            </button>
          </div>
        </div>
      )}

      {/* 플랫폼 관리 */}
      {showPlatformMgr && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '75vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>💳 매출 플랫폼 관리</span>
              <button onClick={() => setShowPlatformMgr(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
            </div>
            {platforms.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8F9FB', borderRadius: 10, padding: '10px 14px', marginBottom: 6 }}>
                <span style={{ fontSize: 13 }}>{p.name}</span>
                <button onClick={() => deletePlatform(p.id)} style={{ background: 'none', border: 'none', fontSize: 11, color: '#E84393', cursor: 'pointer' }}>삭제</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input value={newPlatformName} onChange={e => setNewPlatformName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlatform()} placeholder="새 플랫폼 (예: 네이버페이)" style={{ ...inp, flex: 1 }} />
              <button onClick={addPlatform} style={{ padding: '8px 14px', borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>추가</button>
            </div>
          </div>
        </div>
      )}

      {/* 체크리스트 관리 */}
      {showCheckMgr && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '75vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>✅ 체크리스트 관리</span>
              <button onClick={() => setShowCheckMgr(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
            </div>
            {checkItems.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8F9FB', borderRadius: 10, padding: '10px 14px', marginBottom: 6 }}>
                <span style={{ fontSize: 13 }}>{c.title}</span>
                <button onClick={() => deleteCheckItem(c.id)} style={{ background: 'none', border: 'none', fontSize: 11, color: '#E84393', cursor: 'pointer' }}>삭제</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCheckItem()} placeholder="새 항목 (예: 에어컨 끄기)" style={{ ...inp, flex: 1 }} />
              <button onClick={addCheckItem} style={{ padding: '8px 14px', borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>추가</button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>📋 마감일지</span>
        {hasUnreadMemo && (
          <button onClick={() => setShowMemoPanel(true)}
            style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(255,107,53,0.15)', border: '1px solid rgba(255,107,53,0.5)', color: '#FF6B35', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
            📢 전달사항 확인
          </button>
        )}
      </div>

      {/* 캘린더 */}
      <ClosingCalendar year={calYear} month={calMonth} salesMap={salesMap} selectedDate={selectedDate}
        onSelectDate={handleSelectDate} onChangeMonth={(y, m) => { setCalYear(y); setCalMonth(m) }} />

      {/* 선택 날짜 바 */}
      <div style={{ ...bx, padding: '12px 16px', background: isSaved ? 'rgba(0,184,148,0.04)' : '#fff', border: isSaved ? '1px solid rgba(0,184,148,0.3)' : '1px solid #E8ECF0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>{selectedDate.replace(/-/g, '.')}</div>
            {isSaved
              ? <div style={{ fontSize: 11, color: '#00B894', marginTop: 2 }}>✓ 저장됨 · 총 매출 {totalSales.toLocaleString()}원</div>
              : <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>미작성</div>
            }
          </div>
          <button onClick={() => setShowForm(p => !p)}
            style={{ padding: '7px 14px', borderRadius: 9, background: isSaved ? 'rgba(0,184,148,0.1)' : 'rgba(255,107,53,0.1)', border: isSaved ? '1px solid rgba(0,184,148,0.3)' : '1px solid rgba(255,107,53,0.3)', color: isSaved ? '#00B894' : '#FF6B35', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {showForm ? '▲ 접기' : isSaved ? '📂 열기' : '✏️ 작성'}
          </button>
        </div>
      </div>

      {/* 마감일지 폼 */}
      {showForm && (
        <>
          {isSaved && !isManager && (
            <div style={{ background: 'rgba(253,196,0,0.1)', border: '1px solid rgba(253,196,0,0.4)', borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#B8860B' }}>
              🔒 저장된 마감일지는 매니저/대표만 수정 가능합니다. 체크리스트는 누구나 가능해요.
            </div>
          )}

          {/* 담당자 */}
          <div style={bx}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>👤 담당자</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <span style={lbl}>오픈 담당자</span>
                <input value={openStaff} onChange={e => setOpenStaff(e.target.value)} placeholder="이름" disabled={isSaved && !isManager} style={{ ...inp, background: isSaved && !isManager ? '#F4F6F9' : '#F8F9FB' }} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={lbl}>마감 담당자</span>
                <input value={closeStaff} onChange={e => setCloseStaff(e.target.value)} placeholder="이름" disabled={isSaved && !isManager} style={{ ...inp, background: isSaved && !isManager ? '#F4F6F9' : '#F8F9FB' }} />
              </div>
            </div>
          </div>

          {/* 매출 */}
          <div style={bx}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>💰 매출</span>
              {isManager && (
                <button onClick={() => setShowPlatformMgr(true)} style={{ fontSize: 10, color: '#2DC6D6', background: 'rgba(45,198,214,0.1)', border: '1px solid rgba(45,198,214,0.3)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>플랫폼 관리</button>
              )}
            </div>
            {platforms.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 8 }}>
                <span style={{ fontSize: 12, color: '#555', width: 90, flexShrink: 0 }}>{p.name}</span>
                <input type="number" value={sales[p.name] || ''} onChange={e => setSales(prev => ({ ...prev, [p.name]: Number(e.target.value) }))}
                  placeholder="0" disabled={isSaved && !isManager} style={{ ...inp, textAlign: 'right', background: isSaved && !isManager ? '#F4F6F9' : '#F8F9FB' }} />
                <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>원</span>
              </div>
            ))}
            <div style={{ borderTop: '1px dashed #E8ECF0', paddingTop: 10, marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>총 매출</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#FF6B35' }}>{totalSales.toLocaleString()}원</span>
            </div>
          </div>

          {/* 운영 현황 */}
          <div style={bx}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>📊 운영 현황</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <span style={lbl}>방문 테이블 수</span>
                <input type="number" value={visitTables || ''} onChange={e => setVisitTables(Number(e.target.value))} placeholder="0" disabled={isSaved && !isManager} style={{ ...inp, textAlign: 'center', background: isSaved && !isManager ? '#F4F6F9' : '#F8F9FB' }} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={lbl}>취소/환불 건수</span>
                <input type="number" value={cancelCount || ''} onChange={e => setCancelCount(Number(e.target.value))} placeholder="0" disabled={isSaved && !isManager} style={{ ...inp, textAlign: 'center', background: isSaved && !isManager ? '#F4F6F9' : '#F8F9FB' }} />
              </div>
            </div>
          </div>

          {/* 시재 */}
          <div style={bx}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>💵 시재</div>
            <input type="number" value={cashAmount || ''} onChange={e => setCashAmount(Number(e.target.value))} placeholder="마감 시재 금액 입력" disabled={isSaved && !isManager} style={{ ...inp, textAlign: 'right', background: isSaved && !isManager ? '#F4F6F9' : '#F8F9FB' }} />
            {cashAmount > 0 && <div style={{ fontSize: 11, color: '#888', marginTop: 4, textAlign: 'right' }}>{cashAmount.toLocaleString()}원</div>}
          </div>

          {/* 체크리스트 */}
          <div style={bx}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>✅ 마감 체크리스트</span>
                <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: checkedCount === checkItems.length && checkItems.length > 0 ? 'rgba(0,184,148,0.12)' : '#F4F6F9', color: checkedCount === checkItems.length && checkItems.length > 0 ? '#00B894' : '#aaa' }}>
                  {checkedCount}/{checkItems.length}
                </span>
              </div>
              {isManager && (
                <button onClick={() => setShowCheckMgr(true)} style={{ fontSize: 10, color: '#2DC6D6', background: 'rgba(45,198,214,0.1)', border: '1px solid rgba(45,198,214,0.3)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer' }}>항목 관리</button>
              )}
            </div>
            {checkItems.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: '#bbb', fontSize: 12 }}>체크리스트 항목이 없습니다</div>}
            {checkItems.map(item => {
              const ck = checks[item.id]
              return (
                <button key={item.id} onClick={() => toggleCheck(item.id)}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px', borderRadius: 10, border: ck ? '1px solid rgba(0,184,148,0.3)' : '1px solid #E8ECF0', background: ck ? 'rgba(0,184,148,0.06)' : '#F8F9FB', marginBottom: 6, cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 17, color: ck ? '#00B894' : '#ddd', lineHeight: 1 }}>{ck ? '✓' : '○'}</span>
                    <span style={{ fontSize: 13, color: ck ? '#00B894' : '#444', textDecoration: ck ? 'line-through' : 'none' }}>{item.title}</span>
                  </div>
                  {ck && <span style={{ fontSize: 10, color: '#00B894', flexShrink: 0 }}>{ck.checked_by} · {new Date(ck.checked_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>}
                </button>
              )
            })}
          </div>

          {/* 클레임/특이사항 */}
          <div style={bx}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>📝 클레임/특이사항</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={isSaved && !isManager ? '' : '오늘 발생한 클레임이나 특이사항을 기록하세요'} disabled={isSaved && !isManager}
              style={{ ...inp, minHeight: 80, resize: 'none' as const, lineHeight: 1.6, background: isSaved && !isManager ? '#F4F6F9' : '#F8F9FB' }} />
          </div>

          {/* 전달사항 */}
          <div style={{ ...bx, border: nextMemo ? '1px solid rgba(255,107,53,0.35)' : '1px solid #E8ECF0' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>📢 다음 담당자 전달사항</div>
            <div style={{ fontSize: 10, color: '#aaa', marginBottom: 8 }}>다음 오픈 담당자가 앱 접속 시 알림으로 표시됩니다</div>
            <textarea value={nextMemo} onChange={e => setNextMemo(e.target.value)} placeholder={isSaved && !isManager ? '' : '다음 담당자에게 전달할 내용을 적어주세요'} disabled={isSaved && !isManager}
              style={{ ...inp, minHeight: 80, resize: 'none' as const, lineHeight: 1.6, background: isSaved && !isManager ? '#F4F6F9' : '#F8F9FB' }} />
            {memoReads.length > 0 && (
              <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 10, background: 'rgba(0,184,148,0.06)', border: '1px solid rgba(0,184,148,0.2)' }}>
                <div style={{ fontSize: 10, color: '#00B894', fontWeight: 700, marginBottom: 4 }}>✓ 읽음 확인</div>
                {memoReads.map(r => <div key={r.id} style={{ fontSize: 11, color: '#555' }}>{r.read_by} · {new Date(r.read_at).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit', hour12: false })}</div>)}
              </div>
            )}
          </div>

          {/* 저장 버튼 */}
          {(!isSaved || isManager) ? (
            <button onClick={saveClosing} disabled={isSaving}
              style={{ width: '100%', padding: '15px 0', borderRadius: 14, background: isSaving ? '#ddd' : 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: isSaving ? 'not-allowed' : 'pointer', marginBottom: 24 }}>
              {isSaving ? '저장 중...' : isSaved ? '✏️ 마감일지 수정 저장' : '💾 마감일지 저장'}
            </button>
          ) : (
            <div style={{ width: '100%', padding: '15px 0', borderRadius: 14, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#bbb', fontSize: 14, fontWeight: 600, textAlign: 'center', marginBottom: 24 }}>
              🔒 저장된 일지 수정은 매니저/대표만 가능합니다
            </div>
          )}
        </>
      )}
    </div>
  )
}