'use client'
import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import YearMonthPicker from '@/components/YearMonthPicker'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
const lbl = { fontSize: 11, color: '#888', marginBottom: 4, display: 'block' as const }

const DEFAULT_PLATFORMS = ['카드', '현금', '계좌이체', '배달의민족', '쿠팡이츠', '요기요']
const DEFAULT_CHECKLIST = ['가스 밸브 잠금', '냉장고 온도 확인', '시재 봉투 금고 보관', '쓰레기 분리수거', '전등 소등', '출입문 잠금']
const DEFAULT_REVIEW_PLATFORMS = ['네이버', '배민', '요기요', '쿠팡', '카카오맵', '당근']

const FIELD_LABELS: Record<string, string> = {
  writer: '작성자', close_staff: '마감담당자', staff_count: '직원수',
  open_time: '오픈시간', close_time: '마감시간', discount_amount: '할인금액',
  cash_amount: '시재', note: '클레임/특이사항', memo: '특이사항메모',
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function weatherIcon(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 2) return '🌤️'
  if (code <= 3) return '☁️'
  if (code <= 49) return '🌫️'
  if (code <= 59) return '🌧️'
  if (code <= 69) return '🌨️'
  if (code <= 79) return '❄️'
  if (code <= 82) return '🌧️'
  if (code <= 86) return '🌨️'
  if (code <= 99) return '⛈️'
  return '🌡️'
}

function ClosingCalendar({ year, month, salesMap, weatherMap, editedDates, selectedDate, onSelectDate, onChangeMonth }: {
  year: number; month: number
  salesMap: Record<string, number>
  weatherMap: Record<string, { code: number; tmax: number; tmin: number }>
  editedDates: Set<string>
  selectedDate: string
  onSelectDate: (d: string) => void
  onChangeMonth: (y: number, m: number) => void
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
  const totalMonthSales = Object.entries(salesMap).filter(([k]) => k.startsWith(monthStr)).reduce((s,[,v]) => s+v, 0)

  return (
    <div style={{ ...bx, padding: '14px 12px' }}>
      <div style={{ marginBottom: 10 }}>
        <YearMonthPicker year={year} month={month} onChange={onChangeMonth} color="#FF6B35" />
        {totalMonthSales > 0 && <div style={{ fontSize:11, color:'#FF6B35', fontWeight:600, textAlign:'center', marginTop:4 }}>월 매출 {totalMonthSales.toLocaleString()}원</div>}
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
            const sales = salesMap[dateStr]
            const hasSales = sales !== undefined
            const weather = weatherMap[dateStr]
            const isSelected = dateStr === selectedDate
            const isToday = dateStr === today
            const wasEdited = editedDates.has(dateStr)
            return (
              <button key={di} onClick={() => onSelectDate(dateStr)} style={{
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                padding:'4px 2px', borderRadius:8, cursor:'pointer', minHeight:52, position:'relative',
                border: isSelected ? '2px solid #FF6B35' : isToday ? '1px solid rgba(255,107,53,0.3)' : '1px solid transparent',
                background: isSelected ? 'rgba(255,107,53,0.1)' : hasSales ? 'rgba(0,184,148,0.06)' : 'transparent',
              }}>
                {wasEdited && (
                  <div style={{ position:'absolute', top:3, right:3, width:6, height:6, borderRadius:'50%', background:'#E84393', boxShadow:'0 0 0 1px #fff' }} />
                )}
                <span style={{ fontSize:12, fontWeight: isSelected||isToday?700:400, color: isSelected?'#FF6B35':di===0?'#E84393':di===6?'#2DC6D6':'#1a1a2e' }}>{day}</span>
                {weather && <span style={{ fontSize:11, lineHeight:1, marginTop:1 }}>{weatherIcon(weather.code)}</span>}
                {weather && <span style={{ fontSize:7, color:'#2DC6D6', fontWeight:600, lineHeight:1, marginTop:1 }}>{Math.round(weather.tmax)}°</span>}
                {hasSales && <span style={{ fontSize:8, color:'#00B894', fontWeight:600, marginTop:1, lineHeight:1 }}>{sales>=10000?`${Math.floor(sales/10000)}만`:sales.toLocaleString()}</span>}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default function ClosingPage() {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState('')
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()))
  const [closing, setClosing] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle'|'pending'|'saving'|'saved'>('idle')
  const [showForm, setShowForm] = useState(false)
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [salesMap, setSalesMap] = useState<Record<string, number>>({})
  const [weatherMap, setWeatherMap] = useState<Record<string, { code: number; tmax: number; tmin: number }>>({})
  const closingRef = useRef<any>(null)
  const [isPC, setIsPC] = useState(false)
  const autoSaveTimer = useRef<any>(null)
  const prevDataRef = useRef<any>(null)
  const isSavingRef = useRef(false)

  // 수정 이력 관련
  const [editLogs, setEditLogs] = useState<any[]>([])
  const [showEditLogs, setShowEditLogs] = useState(false)
  const [unreadEditCount, setUnreadEditCount] = useState(0)
  const [editedDates, setEditedDates] = useState<Set<string>>(new Set())

  const [writer, setWriter] = useState('')
  const [closeStaff, setCloseStaff] = useState('')
  const [discountAmount, setDiscountAmount] = useState(0)
  const [cancelCount, setCancelCount] = useState(0)
  const [cashAmount, setCashAmount] = useState(0)
  const [note, setNote] = useState('')
  const [memo, setMemo] = useState('')
  const [staffCount, setStaffCount] = useState(0)
  const [openTime, setOpenTime] = useState('')
  const [closeTime, setCloseTime] = useState('')
  const [platforms, setPlatforms] = useState<any[]>([])
  const [sales, setSales] = useState<Record<string, number>>({})
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [cancelCounts, setCancelCounts] = useState<Record<string, number>>({})
  const [checkItems, setCheckItems] = useState<any[]>([])
  const [checks, setChecks] = useState<Record<string, any>>({})
  const [showCheckMgr, setShowCheckMgr] = useState(false)
  const [newCheckItem, setNewCheckItem] = useState('')
  const [soldouts, setSoldouts] = useState<any[]>([])
  const [newSoldout, setNewSoldout] = useState('')
  const [nextTodos, setNextTodos] = useState<any[]>([])
  const [todoChecks, setTodoChecks] = useState<Record<string, any[]>>({})
  const [newTodo, setNewTodo] = useState('')
  const [showPlatformMgr, setShowPlatformMgr] = useState(false)
  const [newPlatformName, setNewPlatformName] = useState('')
  const [reviewPlatforms, setReviewPlatforms] = useState<any[]>([])
  const [reviews, setReviews] = useState<Record<string, { review_count: number; reply_count: number }>>({})
  const [showReviewMgr, setShowReviewMgr] = useState(false)
  const [newReviewPlatformName, setNewReviewPlatformName] = useState('')
  const [editingReviewPlatform, setEditingReviewPlatform] = useState<any>(null)
  const [editReviewPlatformName, setEditReviewPlatformName] = useState('')

  const isManager = userRole === 'owner' || userRole === 'manager'
  const isOwner = userRole === 'owner'
  const isSaved = !!closingRef.current
  const todayStr = toDateStr(new Date())
  const isToday = selectedDate === todayStr
  const disabled = isSaved && !isManager && !isToday

  useEffect(() => {
    const check = () => setIsPC(window.innerWidth >= 768)
    check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id); setUserName(user.nm || ''); setUserRole(user.role || '')
    loadBase(store.id); loadSalesMap(store.id)
  }, [])

  useEffect(() => { if (storeId) loadClosing(storeId, selectedDate) }, [selectedDate, storeId])
  useEffect(() => { closingRef.current = closing }, [closing])

  useEffect(() => {
    if (isOwner && storeId) loadEditLogs(storeId)
  }, [isOwner, storeId])

  // 페이지 떠날 때 대기 중인 자동저장 즉시 실행
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && autoSaveStatus === 'pending') {
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
        performSave(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [autoSaveStatus])

  async function loadEditLogs(sid: string) {
    const { data } = await supabase
      .from('closing_edit_logs')
      .select('*')
      .eq('store_id', sid)
      .order('edited_at', { ascending: false })
      .limit(300)
    if (!data) return
    setEditLogs(data)
    const lastSeen = localStorage.getItem('mj_edit_log_seen') || '1970-01-01'
    const myName = JSON.parse(localStorage.getItem('mj_user') || '{}').nm || ''
    const unread = data.filter((l: any) => l.edited_at > lastSeen && l.edited_by !== myName)
    setUnreadEditCount(unread.length)
    const dates = new Set<string>(data.map((l: any) => l.closing_date).filter(Boolean))
    setEditedDates(dates)
  }

  async function logEdit(closingId: string, closingDate: string, changes: {field: string; oldVal: string; newVal: string}[]) {
    if (changes.length === 0) return
    const rows = changes.map(c => ({
      closing_id: closingId, store_id: storeId, closing_date: closingDate,
      edited_by: userName, field_name: c.field, old_value: c.oldVal, new_value: c.newVal,
    }))
    await supabase.from('closing_edit_logs').insert(rows)
    if (isOwner) loadEditLogs(storeId)
  }

  function detectChanges(prev: any, next: any): {field: string; oldVal: string; newVal: string}[] {
    if (!prev) return []
    const changes: {field: string; oldVal: string; newVal: string}[] = []
    const fields = ['writer','close_staff','staff_count','open_time','close_time','discount_amount','cash_amount','note','memo']
    fields.forEach(f => {
      const o = String(prev[f] ?? ''), n = String(next[f] ?? '')
      if (o !== n) changes.push({ field: FIELD_LABELS[f] || f, oldVal: o, newVal: n })
    })
    platforms.forEach(p => {
      const oldAmt = String(prev.salesSnapshot?.[p.name] ?? 0)
      const newAmt = String(next.salesSnapshot?.[p.name] ?? 0)
      if (oldAmt !== newAmt) changes.push({
        field: `${p.name} 매출`,
        oldVal: `${Number(oldAmt).toLocaleString()}원`,
        newVal: `${Number(newAmt).toLocaleString()}원`
      })
    })
    return changes
  }

  async function loadBase(sid: string) {
    const { data: pl } = await supabase.from('closing_platforms').select('*').eq('store_id', sid).order('sort_order')
    if (!pl || pl.length === 0) {
      const rows = DEFAULT_PLATFORMS.map((name, i) => ({ store_id: sid, name, sort_order: i+1 }))
      const { data: inserted } = await supabase.from('closing_platforms').insert(rows).select()
      setPlatforms(inserted || [])
    } else { setPlatforms(pl) }

    const { data: ci } = await supabase.from('closing_checklist_items').select('*').eq('store_id', sid).order('sort_order')
    if (!ci || ci.length === 0) {
      const rows = DEFAULT_CHECKLIST.map((title, i) => ({ store_id: sid, title, sort_order: i+1 }))
      const { data: inserted } = await supabase.from('closing_checklist_items').insert(rows).select()
      setCheckItems(inserted || [])
    } else { setCheckItems(ci) }

    const { data: rp } = await supabase.from('closing_review_platforms').select('*').eq('store_id', sid).order('sort_order')
    if (!rp || rp.length === 0) {
      const rows = DEFAULT_REVIEW_PLATFORMS.map((name, i) => ({ store_id: sid, name, sort_order: i+1 }))
      const { data: inserted } = await supabase.from('closing_review_platforms').insert(rows).select()
      setReviewPlatforms(inserted || [])
    } else { setReviewPlatforms(rp) }
  }

  async function loadSalesMap(sid: string) {
    const { data: cls } = await supabase.from('closings').select('id, closing_date, weather_code, temp_max, temp_min').eq('store_id', sid)
    if (!cls || cls.length === 0) return
    const { data: sv } = await supabase.from('closing_sales').select('closing_id, amount').in('closing_id', cls.map((c:any) => c.id))
    const map: Record<string, number> = {}
    const wmap: Record<string, { code: number; tmax: number; tmin: number }> = {}
    cls.forEach((c:any) => {
      const total = sv ? sv.filter((s:any) => s.closing_id === c.id).reduce((sum:number, s:any) => sum + (s.amount||0), 0) : 0
      map[c.closing_date] = total
      if (c.weather_code !== null && c.weather_code !== undefined) {
        wmap[c.closing_date] = { code: c.weather_code, tmax: c.temp_max, tmin: c.temp_min }
      }
    })
    setSalesMap(map); setWeatherMap(wmap)
  }

  async function loadClosing(sid: string, date: string) {
    const { data: cl } = await supabase.from('closings').select('*').eq('store_id', sid).eq('closing_date', date).maybeSingle()
    if (cl) {
      setClosing(cl); closingRef.current = cl
      setWriter(cl.writer || cl.created_by || '')
      setCloseStaff(cl.close_staff || '')
      setCancelCount(cl.cancel_count || 0)
      setCashAmount(cl.cash_amount || 0)
      setNote(cl.note || '')
      setMemo(cl.memo || '')
      setDiscountAmount(cl.discount_amount || 0)
      setStaffCount(cl.staff_count || 0)
      setOpenTime(cl.open_time || '')
      setCloseTime(cl.close_time || '')

      const { data: sv } = await supabase.from('closing_sales').select('*').eq('closing_id', cl.id)
      const sm: Record<string, number> = {}; const cm: Record<string, number> = {}; const ccm: Record<string, number> = {}
      if (sv) sv.forEach((s:any) => { sm[s.platform] = s.amount; cm[s.platform] = s.count || 0; ccm[s.platform] = s.cancel_count || 0 })
      setSales(sm); setCounts(cm); setCancelCounts(ccm)

      const { data: ck } = await supabase.from('closing_checks').select('*').eq('closing_id', cl.id)
      const ckm: Record<string, any> = {}
      if (ck) ck.forEach((c:any) => { ckm[c.item_id] = c })
      setChecks(ckm)

      const { data: so } = await supabase.from('closing_soldout').select('*').eq('closing_id', cl.id).order('created_at')
      setSoldouts(so || [])

      const { data: todos } = await supabase.from('closing_next_todos').select('*').eq('closing_id', cl.id).order('created_at')
      setNextTodos(todos || [])
      if (todos && todos.length > 0) {
        const { data: tchks } = await supabase.from('closing_next_todo_checks').select('*').in('todo_id', todos.map((t:any) => t.id))
        const tm: Record<string, any[]> = {}
        if (tchks) tchks.forEach((c:any) => { if (!tm[c.todo_id]) tm[c.todo_id] = []; tm[c.todo_id].push(c) })
        setTodoChecks(tm)
      } else { setTodoChecks({}) }

      const { data: rv } = await supabase.from('closing_reviews').select('*').eq('closing_id', cl.id)
      const rvm: Record<string, { review_count: number; reply_count: number }> = {}
      if (rv) rv.forEach((r:any) => { rvm[r.platform] = { review_count: r.review_count || 0, reply_count: r.reply_count || 0 } })
      setReviews(rvm)

      prevDataRef.current = {
        writer: cl.writer || '', close_staff: cl.close_staff || '',
        staff_count: cl.staff_count || 0, open_time: cl.open_time || '',
        close_time: cl.close_time || '', discount_amount: cl.discount_amount || 0,
        cash_amount: cl.cash_amount || 0, note: cl.note || '', memo: cl.memo || '',
        salesSnapshot: sm
      }
      setShowForm(true)
    } else {
      setClosing(null); closingRef.current = null
      setWriter(''); setCloseStaff(''); setCancelCount(0)
      setCashAmount(0); setNote(''); setMemo(''); setDiscountAmount(0)
      setStaffCount(0); setOpenTime(''); setCloseTime('')
      setSales({}); setCounts({}); setCancelCounts({})
      setChecks({}); setSoldouts([]); setNextTodos([]); setTodoChecks({})
      setReviews({}); prevDataRef.current = null
      // 당일이면 폼 자동으로 열기
      setShowForm(date === todayStr)
    }
  }

  function handleSelectDate(d: string) {
    setSelectedDate(d)
    const [y, m] = d.split('-').map(Number)
    setCalYear(y); setCalMonth(m-1)
  }

  // 자동저장 트리거 - 당일이면 즉시 저장 (이미 저장 중이면 스킵)
  const triggerAutoSave = useCallback(() => {
    if (selectedDate !== todayStr) return
    if (isSavingRef.current) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => performSave(true), 100)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, todayStr])

  async function getOrCreateClosingId(): Promise<string> {
    const current = closingRef.current
    if (current?.id) return current.id
    const { data, error } = await supabase.from('closings').insert({
      store_id: storeId, closing_date: selectedDate, writer: userName, close_staff: closeStaff,
      cancel_count: cancelCount, cash_amount: cashAmount, note, memo,
      discount_amount: discountAmount, created_by: userName,
      staff_count: staffCount, open_time: openTime, close_time: closeTime
    }).select().single()
    if (error) throw error
    setClosing(data); closingRef.current = data
    return data.id
  }

  async function performSave(isAuto = false) {
    if (!storeId) return
    if (isSaved && !isManager && selectedDate !== todayStr) {
      if (!isAuto) alert('저장된 마감일지는 매니저/대표만 수정할 수 있습니다.')
      return
    }
    if (isAuto) setAutoSaveStatus('saving')
    else setIsSaving(true)
    isSavingRef.current = true

    try {
      let weatherData: any = {}
      const { data: storeData } = await supabase.from('stores').select('lat, lng').eq('id', storeId).maybeSingle()
      if (storeData?.lat && storeData?.lng) {
        try {
          const res = await fetch(
            'https://api.open-meteo.com/v1/forecast?latitude=' + storeData.lat +
            '&longitude=' + storeData.lng +
            '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode' +
            '&timezone=Asia/Seoul&start_date=' + selectedDate + '&end_date=' + selectedDate
          )
          const wJson = await res.json()
          if (wJson.daily) {
            weatherData = {
              weather_code: wJson.daily.weathercode?.[0] ?? null,
              temp_max: wJson.daily.temperature_2m_max?.[0] ?? null,
              temp_min: wJson.daily.temperature_2m_min?.[0] ?? null,
              precipitation: wJson.daily.precipitation_sum?.[0] ?? null,
            }
          }
        } catch {}
      }

      const current = closingRef.current
      let closingId: string

      const nextSnapshot = {
        writer, close_staff: closeStaff, staff_count: staffCount,
        open_time: openTime, close_time: closeTime, discount_amount: discountAmount,
        cash_amount: cashAmount, note, memo, salesSnapshot: { ...sales }
      }

      if (current?.id) {
        closingId = current.id
        if (prevDataRef.current) {
          const changes = detectChanges(prevDataRef.current, nextSnapshot)
          if (changes.length > 0) await logEdit(closingId, selectedDate, changes)
        }
        await supabase.from('closings').update({
          writer, close_staff: closeStaff,
          cancel_count: cancelCount, cash_amount: cashAmount,
          note, memo, discount_amount: discountAmount,
          staff_count: staffCount, open_time: openTime, close_time: closeTime,
          ...weatherData
        }).eq('id', closingId)
      } else {
        const { data, error } = await supabase.from('closings').insert({
          store_id: storeId, closing_date: selectedDate, writer, close_staff: closeStaff,
          cancel_count: cancelCount, cash_amount: cashAmount, note, memo,
          discount_amount: discountAmount, created_by: userName,
          staff_count: staffCount, open_time: openTime, close_time: closeTime,
          ...weatherData
        }).select().single()
        if (error) throw error
        closingId = data.id; setClosing(data); closingRef.current = data
      }

      await supabase.from('closing_sales').delete().eq('closing_id', closingId)
      const rows = platforms.map(p => ({
        closing_id: closingId, platform: p.name,
        amount: sales[p.name] || 0, count: counts[p.name] || 0,
        cancel_count: cancelCounts[p.name] || 0, sort_order: p.sort_order
      }))
      if (rows.length > 0) await supabase.from('closing_sales').insert(rows)

      await supabase.from('closing_reviews').delete().eq('closing_id', closingId)
      const reviewRows = reviewPlatforms
        .filter(p => reviews[p.name]?.review_count || reviews[p.name]?.reply_count)
        .map(p => ({
          closing_id: closingId, platform: p.name,
          review_count: reviews[p.name]?.review_count || 0,
          reply_count: reviews[p.name]?.reply_count || 0
        }))
      if (reviewRows.length > 0) await supabase.from('closing_reviews').insert(reviewRows)

      const newTotal = platforms.reduce((s, p) => s + (sales[p.name]||0), 0)
      setSalesMap(prev => ({ ...prev, [selectedDate]: newTotal }))
      if (weatherData.weather_code !== null && weatherData.weather_code !== undefined) {
        setWeatherMap(prev => ({ ...prev, [selectedDate]: { code: weatherData.weather_code, tmax: weatherData.temp_max, tmin: weatherData.temp_min } }))
      }

      prevDataRef.current = { ...nextSnapshot }
      setShowForm(true)

      if (isAuto) { setAutoSaveStatus('saved'); setTimeout(() => setAutoSaveStatus('idle'), 2500) }
      else { alert('저장되었습니다!') }
    } catch (e: any) {
      if (!isAuto) alert('저장 실패: ' + (e?.message || '다시 시도해주세요'))
      if (isAuto) setAutoSaveStatus('idle')
    } finally {
      if (!isAuto) setIsSaving(false)
      isSavingRef.current = false
    }
  }

  // 당일 자동저장 래퍼 - isSaved 여부 무관하게 항상 트리거
  function aw<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); if (selectedDate === todayStr) triggerAutoSave() }
  }

  async function toggleCheck(itemId: string) {
    const closingId = await getOrCreateClosingId()
    if (checks[itemId]) {
      await supabase.from('closing_checks').delete().eq('id', checks[itemId].id)
      setChecks(p => { const n = {...p}; delete n[itemId]; return n })
    } else {
      const { data } = await supabase.from('closing_checks').insert({ closing_id: closingId, item_id: itemId, checked_by: userName, checked_at: new Date().toISOString() }).select().single()
      setChecks(p => ({ ...p, [itemId]: data }))
    }
  }

  async function addCheckItem() {
    if (!newCheckItem.trim()) return
    const maxOrder = checkItems.reduce((max, c) => Math.max(max, c.sort_order||0), 0)
    const { data } = await supabase.from('closing_checklist_items').insert({ store_id: storeId, title: newCheckItem.trim(), sort_order: maxOrder+1 }).select().single()
    setCheckItems(p => [...p, data]); setNewCheckItem('')
  }

  async function deleteCheckItem(id: string) {
    if (!confirm('삭제할까요?')) return
    await supabase.from('closing_checklist_items').delete().eq('id', id)
    setCheckItems(p => p.filter(x => x.id !== id))
  }

  async function addSoldout() {
    if (!newSoldout.trim()) return
    const closingId = await getOrCreateClosingId()
    const { data } = await supabase.from('closing_soldout').insert({ closing_id: closingId, menu_name: newSoldout.trim(), created_by: userName }).select().single()
    setSoldouts(p => [...p, data]); setNewSoldout('')
  }

  async function deleteSoldout(id: string) {
    if (!isManager) { alert('매니저/대표만 삭제할 수 있습니다.'); return }
    await supabase.from('closing_soldout').delete().eq('id', id)
    setSoldouts(p => p.filter(x => x.id !== id))
  }

  async function addNextTodo() {
    if (!newTodo.trim()) return
    const closingId = await getOrCreateClosingId()
    const { data } = await supabase.from('closing_next_todos').insert({ closing_id: closingId, content: newTodo.trim(), created_by: userName }).select().single()
    setNextTodos(p => [...p, data]); setNewTodo('')
  }

  async function deleteNextTodo(id: string) {
    if (!isManager) { alert('매니저/대표만 삭제할 수 있습니다.'); return }
    await supabase.from('closing_next_todos').delete().eq('id', id)
    setNextTodos(p => p.filter(x => x.id !== id))
    setTodoChecks(p => { const n = {...p}; delete n[id]; return n })
  }

  async function toggleTodoCheck(todoId: string) {
    const myCheck = (todoChecks[todoId] || []).find((c:any) => c.checked_by === userName)
    if (myCheck) {
      await supabase.from('closing_next_todo_checks').delete().eq('id', myCheck.id)
      setTodoChecks(p => ({ ...p, [todoId]: (p[todoId]||[]).filter((c:any) => c.id !== myCheck.id) }))
    } else {
      const { data } = await supabase.from('closing_next_todo_checks').insert({ todo_id: todoId, checked_by: userName, checked_at: new Date().toISOString() }).select().single()
      setTodoChecks(p => ({ ...p, [todoId]: [...(p[todoId]||[]), data] }))
    }
  }

  async function addPlatform() {
    if (!newPlatformName.trim()) return
    const maxOrder = platforms.reduce((max, p) => Math.max(max, p.sort_order||0), 0)
    const { data } = await supabase.from('closing_platforms').insert({ store_id: storeId, name: newPlatformName.trim(), sort_order: maxOrder+1 }).select().single()
    setPlatforms(p => [...p, data]); setNewPlatformName('')
  }

  async function deletePlatform(id: string) {
    if (!confirm('삭제할까요?')) return
    await supabase.from('closing_platforms').delete().eq('id', id)
    setPlatforms(p => p.filter(x => x.id !== id))
  }

  async function addReviewPlatform() {
    if (!newReviewPlatformName.trim()) return
    const maxOrder = reviewPlatforms.reduce((max, p) => Math.max(max, p.sort_order||0), 0)
    const { data } = await supabase.from('closing_review_platforms').insert({ store_id: storeId, name: newReviewPlatformName.trim(), sort_order: maxOrder+1 }).select().single()
    setReviewPlatforms(p => [...p, data]); setNewReviewPlatformName('')
  }

  async function updateReviewPlatform(id: string) {
    if (!editReviewPlatformName.trim()) return
    await supabase.from('closing_review_platforms').update({ name: editReviewPlatformName.trim() }).eq('id', id)
    setReviewPlatforms(p => p.map(x => x.id === id ? { ...x, name: editReviewPlatformName.trim() } : x))
    setEditingReviewPlatform(null); setEditReviewPlatformName('')
  }

  async function deleteReviewPlatform(id: string) {
    if (!confirm('삭제할까요?')) return
    await supabase.from('closing_review_platforms').delete().eq('id', id)
    setReviewPlatforms(p => p.filter(x => x.id !== id))
  }

  const totalSales = useMemo(() => platforms.reduce((sum, p) => sum + (sales[p.name]||0), 0), [platforms, sales])
  const totalCount = useMemo(() => platforms.reduce((sum, p) => sum + (counts[p.name]||0), 0), [platforms, counts])
  const totalCancelCount = useMemo(() => platforms.reduce((sum, p) => sum + (cancelCounts[p.name]||0), 0), [platforms, cancelCounts])
  const avgPerOrder = totalCount > 0 ? Math.round(totalSales / totalCount) : 0
  const checkedCount = Object.keys(checks).length
  const totalReviews = useMemo(() => reviewPlatforms.reduce((sum, p) => sum + (reviews[p.name]?.review_count || 0), 0), [reviewPlatforms, reviews])
  const totalReplies = useMemo(() => reviewPlatforms.reduce((sum, p) => sum + (reviews[p.name]?.reply_count || 0), 0), [reviewPlatforms, reviews])

  // ── 수정 이력 모달 (대표 전용) ──
  const editLogModal = showEditLogs && isOwner && (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:'#fff', width:'100%', maxWidth:540, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'82vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <span style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>📋 수정 이력</span>
            <span style={{ fontSize:11, color:'#aaa', marginLeft:8 }}>대표만 볼 수 있어요</span>
          </div>
          <button onClick={() => {
            setShowEditLogs(false)
            localStorage.setItem('mj_edit_log_seen', new Date().toISOString())
            setUnreadEditCount(0)
          }} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>
        {editLogs.length === 0 ? (
          <div style={{ textAlign:'center', padding:'48px 0', color:'#ccc', fontSize:13 }}>수정 이력이 없어요</div>
        ) : (() => {
          const grouped: Record<string, any[]> = {}
          editLogs.forEach(l => {
            const date = l.closing_date || l.edited_at?.slice(0,10) || '?'
            if (!grouped[date]) grouped[date] = []
            grouped[date].push(l)
          })
          return Object.entries(grouped).map(([date, logs]) => (
            <div key={date} style={{ marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#888', marginBottom:8, paddingBottom:6, borderBottom:'1px solid #F0F2F5', display:'flex', alignItems:'center', gap:6 }}>
                <span>📅 {date.replace(/-/g,'.')} 마감일지</span>
                <span style={{ fontWeight:400, color:'#ccc' }}>({logs.length}건 수정)</span>
              </div>
              {logs.map((l: any, i: number) => (
                <div key={i} style={{ borderRadius:12, border:'1px solid #F0F2F5', padding:'12px 14px', marginBottom:8, background:'#FAFBFC' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#6C5CE7,#E84393)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <span style={{ fontSize:12, color:'#fff', fontWeight:700 }}>{l.edited_by?.[0] || '?'}</span>
                      </div>
                      <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{l.edited_by}</span>
                    </div>
                    <span style={{ fontSize:10, color:'#aaa' }}>
                      {new Date(l.edited_at).toLocaleString('ko',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})}
                    </span>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    <span style={{ fontSize:11, color:'#fff', fontWeight:600, background:'#6C5CE7', padding:'2px 8px', borderRadius:6 }}>{l.field_name}</span>
                    <span style={{ fontSize:12, color:'#E84393', background:'rgba(232,67,147,0.08)', padding:'2px 8px', borderRadius:6, textDecoration:'line-through' }}>{l.old_value || '(없음)'}</span>
                    <span style={{ fontSize:12, color:'#aaa' }}>→</span>
                    <span style={{ fontSize:12, color:'#00B894', fontWeight:700, background:'rgba(0,184,148,0.08)', padding:'2px 8px', borderRadius:6 }}>{l.new_value || '(없음)'}</span>
                  </div>
                </div>
              ))}
            </div>
          ))
        })()}
      </div>
    </div>
  )

  // ── 폼 콘텐츠 ──
  const formContent = (
    <>
      {/* 자동저장 상태 (당일만) */}
      {isToday && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6, marginBottom:10 }}>
          {autoSaveStatus === 'pending' && <span style={{ fontSize:11, color:'#FDC400', fontWeight:600 }}>⏳ 저장 대기 중...</span>}
          {autoSaveStatus === 'saving' && <span style={{ fontSize:11, color:'#6C5CE7', fontWeight:600 }}>💾 저장 중...</span>}
          {autoSaveStatus === 'saved' && <span style={{ fontSize:11, color:'#00B894', fontWeight:600 }}>✅ 자동저장 완료</span>}
          {autoSaveStatus === 'idle' && <span style={{ fontSize:11, color:'#aaa' }}>✏️ 입력하면 자동 저장돼요</span>}
        </div>
      )}

      {isSaved && !isManager && !isToday && (
        <div style={{ background:'rgba(253,196,0,0.1)', border:'1px solid rgba(253,196,0,0.4)', borderRadius:12, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#B8860B' }}>
          🔒 저장된 마감일지는 매니저/대표만 수정 가능합니다. 체크리스트는 누구나 가능해요.
        </div>
      )}

      {/* 작성자 */}
      <div style={bx}>
        <div style={{ fontSize:12, fontWeight:700, color:'#1a1a2e', marginBottom:10 }}>👤 작성자 / 영업 정보</div>
        <div style={{ display:'grid', gridTemplateColumns: isPC ? '1fr 1fr 1fr 80px 80px' : '1fr 1fr', gap:8 }}>
          <div>
            <span style={lbl}>작성자</span>
            <input value={writer} onChange={e => aw(setWriter)(e.target.value)} placeholder="작성자" disabled={disabled}
              style={{ ...inp, background: disabled?'#F4F6F9':'#F8F9FB' }} />
          </div>
          <div>
            <span style={lbl}>마감 담당자</span>
            <input value={closeStaff} onChange={e => aw(setCloseStaff)(e.target.value)} placeholder="마감 담당자" disabled={disabled}
              style={{ ...inp, background: disabled?'#F4F6F9':'#F8F9FB' }} />
          </div>
          <div>
            <span style={lbl}>근무 직원 수</span>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <input type="number" value={staffCount||''} onChange={e => aw(setStaffCount)(Number(e.target.value))} placeholder="0" disabled={disabled}
                style={{ ...inp, textAlign:'center', background: disabled?'#F4F6F9':'#F8F9FB' }} />
              <span style={{ fontSize:11, color:'#aaa', flexShrink:0 }}>명</span>
            </div>
          </div>
          <div>
            <span style={lbl}>오픈</span>
            <input type="time" value={openTime} onChange={e => aw(setOpenTime)(e.target.value)} disabled={disabled}
              style={{ ...inp, background: disabled?'#F4F6F9':'#F8F9FB' }} />
          </div>
          <div>
            <span style={lbl}>마감</span>
            <input type="time" value={closeTime} onChange={e => aw(setCloseTime)(e.target.value)} disabled={disabled}
              style={{ ...inp, background: disabled?'#F4F6F9':'#F8F9FB' }} />
          </div>
        </div>
      </div>

      {/* 매출 */}
      <div style={bx}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <span style={{ fontSize:12, fontWeight:700, color:'#1a1a2e' }}>💰 매출</span>
          {isManager && <button onClick={() => setShowPlatformMgr(true)} style={{ fontSize:10, color:'#2DC6D6', background:'rgba(45,198,214,0.1)', border:'1px solid rgba(45,198,214,0.3)', borderRadius:6, padding:'3px 8px', cursor:'pointer' }}>플랫폼 관리</button>}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'80px 1fr 64px 64px', gap:6, marginBottom:6, paddingBottom:6, borderBottom:'1px solid #F0F2F5' }}>
          <span style={{ fontSize:10, color:'#aaa', fontWeight:600 }}>플랫폼</span>
          <span style={{ fontSize:10, color:'#aaa', fontWeight:600, textAlign:'right' }}>매출</span>
          <span style={{ fontSize:10, color:'#aaa', fontWeight:600, textAlign:'center' }}>건수</span>
          <span style={{ fontSize:10, color:'#aaa', fontWeight:600, textAlign:'center' }}>취소/환불</span>
        </div>
        {platforms.map(p => (
          <div key={p.id} style={{ display:'grid', gridTemplateColumns:'80px 1fr 64px 64px', gap:6, marginBottom:8, alignItems:'center' }}>
            <span style={{ fontSize:12, color:'#555', fontWeight:600 }}>{p.name}</span>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <input type="number" value={sales[p.name]||''} placeholder="0" disabled={disabled}
                onChange={e => { const v = Number(e.target.value); setSales(prev => ({...prev,[p.name]:v})); if(selectedDate===todayStr) triggerAutoSave() }}
                style={{ ...inp, textAlign:'right', padding:'6px 8px', background: disabled?'#F4F6F9':'#F8F9FB' }} />
              <span style={{ fontSize:10, color:'#aaa', flexShrink:0 }}>원</span>
            </div>
            <input type="number" value={counts[p.name]||''} placeholder="0" disabled={disabled}
              onChange={e => { const v = Number(e.target.value); setCounts(prev => ({...prev,[p.name]:v})); if(selectedDate===todayStr) triggerAutoSave() }}
              style={{ ...inp, textAlign:'center', padding:'6px 4px', background: disabled?'#F4F6F9':'#F8F9FB' }} />
            <input type="number" value={cancelCounts[p.name]||''} placeholder="0" disabled={disabled}
              onChange={e => { const v = Number(e.target.value); setCancelCounts(prev => ({...prev,[p.name]:v})); if(selectedDate===todayStr) triggerAutoSave() }}
              style={{ ...inp, textAlign:'center', padding:'6px 4px', background: disabled?'#F4F6F9':'rgba(232,67,147,0.04)', border:'1px solid rgba(232,67,147,0.2)' }} />
          </div>
        ))}
        <div style={{ borderTop:'1px dashed #E8ECF0', paddingTop:10, marginTop:4 }}>
          <div style={{ display:'grid', gridTemplateColumns:'80px 1fr 64px 64px', gap:6, alignItems:'center' }}>
            <span style={{ fontSize:12, fontWeight:700, color:'#1a1a2e' }}>합계</span>
            <span style={{ fontSize:18, fontWeight:800, color:'#FF6B35', textAlign:'right' }}>{totalSales.toLocaleString()}원</span>
            <span style={{ fontSize:13, fontWeight:700, color:'#6C5CE7', textAlign:'center' }}>{totalCount}건</span>
            <span style={{ fontSize:13, fontWeight:700, color:'#E84393', textAlign:'center' }}>{totalCancelCount}건</span>
          </div>
          {avgPerOrder > 0 && (
            <div style={{ marginTop:8, padding:'8px 12px', background:'rgba(108,92,231,0.06)', borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:11, color:'#6C5CE7', fontWeight:600 }}>📊 객단가</span>
              <span style={{ fontSize:14, fontWeight:800, color:'#6C5CE7' }}>{avgPerOrder.toLocaleString()}원</span>
            </div>
          )}
        </div>
      </div>

      {/* 취소/할인 */}
      <div style={bx}>
        <div style={{ fontSize:12, fontWeight:700, color:'#1a1a2e', marginBottom:10 }}>📉 취소/할인</div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ flex:1 }}>
            <span style={lbl}>총 취소/환불 건수</span>
            <div style={{ padding:'10px 12px', borderRadius:8, background:'rgba(232,67,147,0.06)', border:'1px solid rgba(232,67,147,0.2)', fontSize:14, fontWeight:700, color:'#E84393', textAlign:'center' }}>
              {totalCancelCount}건
            </div>
          </div>
          <div style={{ flex:1 }}>
            <span style={lbl}>할인/프로모션 금액</span>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <input type="number" value={discountAmount||''} onChange={e => aw(setDiscountAmount)(Number(e.target.value))} placeholder="0" disabled={disabled}
                style={{ ...inp, textAlign:'right', background: disabled?'#F4F6F9':'#F8F9FB' }} />
              <span style={{ fontSize:11, color:'#aaa', flexShrink:0 }}>원</span>
            </div>
          </div>
        </div>
      </div>

      {/* 시재 */}
      <div style={bx}>
        <div style={{ fontSize:12, fontWeight:700, color:'#1a1a2e', marginBottom:10 }}>💵 시재</div>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <input type="number" value={cashAmount||''} onChange={e => aw(setCashAmount)(Number(e.target.value))} placeholder="마감 시재 금액 입력" disabled={disabled}
            style={{ ...inp, textAlign:'right', background: disabled?'#F4F6F9':'#F8F9FB' }} />
          <span style={{ fontSize:11, color:'#aaa', flexShrink:0 }}>원</span>
        </div>
        {cashAmount > 0 && <div style={{ fontSize:11, color:'#888', marginTop:4, textAlign:'right' }}>{cashAmount.toLocaleString()}원</div>}
      </div>

      {/* 리뷰 답글 */}
      <div style={bx}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div>
            <span style={{ fontSize:12, fontWeight:700, color:'#1a1a2e' }}>⭐ 리뷰 / 답글</span>
            {(totalReviews > 0 || totalReplies > 0) && (
              <span style={{ marginLeft:8, fontSize:11, color:'#FF6B35' }}>리뷰 {totalReviews}건 · 답글 {totalReplies}건</span>
            )}
          </div>
          {isManager && <button onClick={() => setShowReviewMgr(true)} style={{ fontSize:10, color:'#6C5CE7', background:'rgba(108,92,231,0.1)', border:'1px solid rgba(108,92,231,0.3)', borderRadius:6, padding:'3px 8px', cursor:'pointer' }}>플랫폼 관리</button>}
        </div>
        <div style={{ display:'grid', gridTemplateColumns: isPC ? 'repeat(3,1fr)' : 'repeat(2,1fr)', gap:8 }}>
          {reviewPlatforms.map(p => (
            <div key={p.id} style={{ background:'#F8F9FB', borderRadius:12, padding:'10px 12px', border:'1px solid #E8ECF0' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#1a1a2e', marginBottom:8 }}>{p.name}</div>
              <div style={{ display:'flex', gap:6 }}>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:9, color:'#aaa', display:'block', marginBottom:3 }}>리뷰 수</span>
                  <input type="number" value={reviews[p.name]?.review_count||''} disabled={disabled}
                    onChange={e => setReviews(prev => ({ ...prev, [p.name]: { ...prev[p.name], review_count: Number(e.target.value), reply_count: prev[p.name]?.reply_count||0 } }))}
                    placeholder="0" style={{ ...inp, textAlign:'center', padding:'5px 4px', fontSize:13, fontWeight:700, background: disabled?'#F4F6F9':'#fff', color:'#FF6B35' }} />
                </div>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:9, color:'#aaa', display:'block', marginBottom:3 }}>답글 수</span>
                  <input type="number" value={reviews[p.name]?.reply_count||''} disabled={disabled}
                    onChange={e => setReviews(prev => ({ ...prev, [p.name]: { review_count: prev[p.name]?.review_count||0, reply_count: Number(e.target.value) } }))}
                    placeholder="0" style={{ ...inp, textAlign:'center', padding:'5px 4px', fontSize:13, fontWeight:700, background: disabled?'#F4F6F9':'#fff', color:'#00B894' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 특이사항 메모 */}
      <div style={bx}>
        <div style={{ fontSize:12, fontWeight:700, color:'#1a1a2e', marginBottom:8 }}>📌 특이사항 메모</div>
        <div style={{ fontSize:10, color:'#aaa', marginBottom:8 }}>이벤트, 행사, 날씨, 특이 상황 등 — 분석탭에서 매출과 연결됩니다</div>
        <textarea value={memo} onChange={e => aw(setMemo)(e.target.value)} placeholder="오늘의 특이사항을 기록하세요 (이벤트, 날씨, 행사 등)" disabled={disabled}
          style={{ ...inp, minHeight:70, resize:'none' as const, lineHeight:1.6, background: disabled?'#F4F6F9':'#F8F9FB' }} />
      </div>

      {/* 품절 메뉴 */}
      <div style={bx}>
        <div style={{ fontSize:12, fontWeight:700, color:'#1a1a2e', marginBottom:10 }}>🚫 품절 메뉴</div>
        {soldouts.length === 0 && <div style={{ fontSize:12, color:'#bbb', textAlign:'center', padding:'8px 0', marginBottom:8 }}>품절 메뉴 없음 ✓</div>}
        {soldouts.map(so => (
          <div key={so.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 12px', borderRadius:9, background:'rgba(232,67,147,0.06)', border:'1px solid rgba(232,67,147,0.2)', marginBottom:6 }}>
            <div>
              <span style={{ fontSize:13, color:'#1a1a2e' }}>{so.menu_name}</span>
              <span style={{ fontSize:10, color:'#bbb', marginLeft:8 }}>{so.created_by}</span>
            </div>
            {isManager && <button onClick={() => deleteSoldout(so.id)} style={{ background:'none', border:'none', fontSize:11, color:'#E84393', cursor:'pointer' }}>삭제</button>}
          </div>
        ))}
        <div style={{ display:'flex', gap:8, marginTop:6 }}>
          <input value={newSoldout} onChange={e => setNewSoldout(e.target.value)} onKeyDown={e => e.key==='Enter' && addSoldout()} placeholder="품절 메뉴명 입력" style={{ ...inp, flex:1 }} />
          <button onClick={addSoldout} style={{ padding:'8px 12px', borderRadius:8, background:'rgba(232,67,147,0.1)', border:'1px solid rgba(232,67,147,0.3)', color:'#E84393', fontSize:12, fontWeight:700, cursor:'pointer' }}>추가</button>
        </div>
      </div>

      {/* 마감 체크리스트 */}
      <div style={bx}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'#1a1a2e' }}>✅ 마감 체크리스트</span>
            <span style={{ fontSize:10, padding:'1px 7px', borderRadius:10, background: checkedCount===checkItems.length&&checkItems.length>0?'rgba(0,184,148,0.12)':'#F4F6F9', color: checkedCount===checkItems.length&&checkItems.length>0?'#00B894':'#aaa' }}>
              {checkedCount}/{checkItems.length}
            </span>
          </div>
          {isManager && <button onClick={() => setShowCheckMgr(true)} style={{ fontSize:10, color:'#2DC6D6', background:'rgba(45,198,214,0.1)', border:'1px solid rgba(45,198,214,0.3)', borderRadius:6, padding:'3px 8px', cursor:'pointer' }}>항목 관리</button>}
        </div>
        {isPC ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
            {checkItems.map(item => {
              const ck = checks[item.id]
              return (
                <button key={item.id} onClick={() => toggleCheck(item.id)}
                  style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 14px', borderRadius:10, border: ck?'1px solid rgba(0,184,148,0.3)':'1px solid #E8ECF0', background: ck?'rgba(0,184,148,0.06)':'#F8F9FB', cursor:'pointer', textAlign:'left' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:17, color: ck?'#00B894':'#ddd', lineHeight:1 }}>{ck?'✓':'○'}</span>
                    <span style={{ fontSize:13, color: ck?'#00B894':'#444', textDecoration: ck?'line-through':'none' }}>{item.title}</span>
                  </div>
                  {ck && <span style={{ fontSize:10, color:'#00B894', flexShrink:0 }}>{ck.checked_by}</span>}
                </button>
              )
            })}
          </div>
        ) : (
          checkItems.map(item => {
            const ck = checks[item.id]
            return (
              <button key={item.id} onClick={() => toggleCheck(item.id)}
                style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 14px', borderRadius:10, border: ck?'1px solid rgba(0,184,148,0.3)':'1px solid #E8ECF0', background: ck?'rgba(0,184,148,0.06)':'#F8F9FB', marginBottom:6, cursor:'pointer', textAlign:'left' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:17, color: ck?'#00B894':'#ddd', lineHeight:1 }}>{ck?'✓':'○'}</span>
                  <span style={{ fontSize:13, color: ck?'#00B894':'#444', textDecoration: ck?'line-through':'none' }}>{item.title}</span>
                </div>
                {ck && <span style={{ fontSize:10, color:'#00B894', flexShrink:0 }}>{ck.checked_by} · {new Date(ck.checked_at).toLocaleTimeString('ko',{hour:'2-digit',minute:'2-digit',hour12:false})}</span>}
              </button>
            )
          })
        )}
      </div>

      {/* 클레임/특이사항 */}
      <div style={bx}>
        <div style={{ fontSize:12, fontWeight:700, color:'#1a1a2e', marginBottom:8 }}>📝 클레임/특이사항</div>
        <textarea value={note} onChange={e => aw(setNote)(e.target.value)} placeholder={disabled?'':'오늘 발생한 클레임이나 특이사항을 기록하세요'} disabled={disabled}
          style={{ ...inp, minHeight:80, resize:'none' as const, lineHeight:1.6, background: disabled?'#F4F6F9':'#F8F9FB' }} />
      </div>

      {/* 다음 담당자 전달사항 */}
      <div style={{ ...bx, border: nextTodos.length>0?'1px solid rgba(255,107,53,0.35)':'1px solid #E8ECF0' }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#1a1a2e', marginBottom:4 }}>📢 다음 담당자 전달사항</div>
        <div style={{ fontSize:10, color:'#aaa', marginBottom:10 }}>누구나 항목 추가 가능 · 공지 탭에서도 확인 가능</div>
        {nextTodos.length === 0 && <div style={{ fontSize:12, color:'#bbb', textAlign:'center', padding:'8px 0', marginBottom:8 }}>전달사항 없음</div>}
        {nextTodos.map(todo => {
          const chks = todoChecks[todo.id] || []
          const myChecked = chks.find((c:any) => c.checked_by === userName)
          return (
            <div key={todo.id} style={{ borderRadius:10, border: myChecked?'1px solid rgba(0,184,148,0.3)':'1px solid #E8ECF0', background: myChecked?'rgba(0,184,148,0.04)':'#F8F9FB', marginBottom:8, overflow:'hidden' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px' }}>
                <button onClick={() => toggleTodoCheck(todo.id)} style={{ display:'flex', alignItems:'center', gap:10, background:'none', border:'none', cursor:'pointer', flex:1, textAlign:'left', padding:0 }}>
                  <span style={{ fontSize:17, color: myChecked?'#00B894':'#ddd', lineHeight:1, flexShrink:0 }}>{myChecked?'✓':'○'}</span>
                  <div>
                    <div style={{ fontSize:13, color: myChecked?'#00B894':'#444', textDecoration: myChecked?'line-through':'none' }}>{todo.content}</div>
                    <div style={{ fontSize:10, color:'#bbb', marginTop:2 }}>작성: {todo.created_by}</div>
                  </div>
                </button>
                {isManager && <button onClick={() => deleteNextTodo(todo.id)} style={{ background:'none', border:'none', fontSize:11, color:'#E84393', cursor:'pointer', marginLeft:8, flexShrink:0 }}>삭제</button>}
              </div>
              {chks.length > 0 && (
                <div style={{ padding:'6px 14px 10px', borderTop:'1px solid rgba(0,184,148,0.1)', background:'rgba(0,184,148,0.02)' }}>
                  <div style={{ fontSize:9, color:'#00B894', fontWeight:700, marginBottom:3 }}>✓ 확인한 사람</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {chks.map((c:any) => (
                      <span key={c.id} style={{ fontSize:10, color:'#00B894', background:'rgba(0,184,148,0.1)', padding:'1px 7px', borderRadius:10 }}>
                        {c.checked_by} · {new Date(c.checked_at).toLocaleTimeString('ko',{hour:'2-digit',minute:'2-digit',hour12:false})}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <div style={{ display:'flex', gap:8, marginTop:6 }}>
          <input value={newTodo} onChange={e => setNewTodo(e.target.value)} onKeyDown={e => e.key==='Enter' && addNextTodo()} placeholder="전달할 내용 입력" style={{ ...inp, flex:1 }} />
          <button onClick={addNextTodo} style={{ padding:'8px 12px', borderRadius:8, background:'rgba(255,107,53,0.1)', border:'1px solid rgba(255,107,53,0.3)', color:'#FF6B35', fontSize:12, fontWeight:700, cursor:'pointer' }}>추가</button>
        </div>
      </div>

      {/* 저장 버튼: 당일은 없음(자동저장) / 과거 날짜만 표시 */}
      {!isToday && (
        (!isSaved || isManager) ? (
          <button onClick={() => performSave(false)} disabled={isSaving}
            style={{ width:'100%', padding:'15px 0', borderRadius:14, background: isSaving?'#ddd':'linear-gradient(135deg,#FF6B35,#E84393)', border:'none', color:'#fff', fontSize:15, fontWeight:700, cursor: isSaving?'not-allowed':'pointer', marginBottom:24 }}>
            {isSaving ? '저장 중...' : isSaved ? '✏️ 마감일지 수정 저장' : '💾 마감일지 저장'}
          </button>
        ) : (
          <div style={{ width:'100%', padding:'15px 0', borderRadius:14, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#bbb', fontSize:14, fontWeight:600, textAlign:'center', marginBottom:24 }}>
            🔒 저장된 일지 수정은 매니저/대표만 가능합니다
          </div>
        )
      )}
    </>
  )

  const editLogBtn = isOwner && (
    <button onClick={() => setShowEditLogs(true)}
      style={{ position:'relative', padding:'6px 14px', borderRadius:10, background:'rgba(232,67,147,0.08)', border:'1px solid rgba(232,67,147,0.25)', color:'#E84393', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
      📋 수정 이력
      {unreadEditCount > 0 && (
        <span style={{ background:'#E84393', color:'#fff', fontSize:10, fontWeight:800, borderRadius:'50%', minWidth:18, height:18, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px' }}>
          {unreadEditCount}
        </span>
      )}
    </button>
  )

  return (
    <div>
      {editLogModal}

      {showPlatformMgr && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'75vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <span style={{ fontSize:15, fontWeight:700 }}>💳 매출 플랫폼 관리</span>
              <button onClick={() => setShowPlatformMgr(false)} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
            </div>
            {platforms.map(p => (
              <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#F8F9FB', borderRadius:10, padding:'10px 14px', marginBottom:6 }}>
                <span style={{ fontSize:13 }}>{p.name}</span>
                <button onClick={() => deletePlatform(p.id)} style={{ background:'none', border:'none', fontSize:11, color:'#E84393', cursor:'pointer' }}>삭제</button>
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:10 }}>
              <input value={newPlatformName} onChange={e => setNewPlatformName(e.target.value)} onKeyDown={e => e.key==='Enter' && addPlatform()} placeholder="새 플랫폼" style={{ ...inp, flex:1 }} />
              <button onClick={addPlatform} style={{ padding:'8px 14px', borderRadius:8, background:'linear-gradient(135deg,#FF6B35,#E84393)', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>추가</button>
            </div>
          </div>
        </div>
      )}

      {showReviewMgr && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'75vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <span style={{ fontSize:15, fontWeight:700 }}>⭐ 리뷰 플랫폼 관리</span>
              <button onClick={() => setShowReviewMgr(false)} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
            </div>
            {reviewPlatforms.map(p => (
              <div key={p.id} style={{ background:'#F8F9FB', borderRadius:10, padding:'10px 14px', marginBottom:6 }}>
                {editingReviewPlatform?.id === p.id ? (
                  <div style={{ display:'flex', gap:8 }}>
                    <input value={editReviewPlatformName} onChange={e => setEditReviewPlatformName(e.target.value)} style={{ ...inp, flex:1 }} autoFocus />
                    <button onClick={() => updateReviewPlatform(p.id)} style={{ padding:'6px 12px', borderRadius:8, background:'linear-gradient(135deg,#FF6B35,#E84393)', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>저장</button>
                    <button onClick={() => setEditingReviewPlatform(null)} style={{ padding:'6px 10px', borderRadius:8, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', cursor:'pointer', fontSize:12 }}>취소</button>
                  </div>
                ) : (
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:13 }}>{p.name}</span>
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => { setEditingReviewPlatform(p); setEditReviewPlatformName(p.name) }} style={{ background:'none', border:'none', fontSize:11, color:'#6C5CE7', cursor:'pointer' }}>수정</button>
                      <button onClick={() => deleteReviewPlatform(p.id)} style={{ background:'none', border:'none', fontSize:11, color:'#E84393', cursor:'pointer' }}>삭제</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:10 }}>
              <input value={newReviewPlatformName} onChange={e => setNewReviewPlatformName(e.target.value)} onKeyDown={e => e.key==='Enter' && addReviewPlatform()} placeholder="새 플랫폼 (예: 구글맵)" style={{ ...inp, flex:1 }} />
              <button onClick={addReviewPlatform} style={{ padding:'8px 14px', borderRadius:8, background:'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>추가</button>
            </div>
          </div>
        </div>
      )}

      {showCheckMgr && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'75vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <span style={{ fontSize:15, fontWeight:700 }}>✅ 체크리스트 관리</span>
              <button onClick={() => setShowCheckMgr(false)} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
            </div>
            {checkItems.map(c => (
              <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#F8F9FB', borderRadius:10, padding:'10px 14px', marginBottom:6 }}>
                <span style={{ fontSize:13 }}>{c.title}</span>
                <button onClick={() => deleteCheckItem(c.id)} style={{ background:'none', border:'none', fontSize:11, color:'#E84393', cursor:'pointer' }}>삭제</button>
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:10 }}>
              <input value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)} onKeyDown={e => e.key==='Enter' && addCheckItem()} placeholder="새 항목" style={{ ...inp, flex:1 }} />
              <button onClick={addCheckItem} style={{ padding:'8px 14px', borderRadius:8, background:'linear-gradient(135deg,#FF6B35,#E84393)', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>추가</button>
            </div>
          </div>
        </div>
      )}

      {isPC ? (
        <div style={{ padding:'0 8px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <span style={{ fontSize:20, fontWeight:700, color:'#1a1a2e' }}>📋 마감일지</span>
            {editLogBtn}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:20, alignItems:'start' }}>
            <div style={{ position:'sticky', top:80 }}>
              <ClosingCalendar year={calYear} month={calMonth} salesMap={salesMap} weatherMap={weatherMap} editedDates={editedDates}
                selectedDate={selectedDate} onSelectDate={handleSelectDate} onChangeMonth={(y,m) => { setCalYear(y); setCalMonth(m) }} />
              <div style={{ ...bx, padding:'12px 16px', background: isSaved?'rgba(0,184,148,0.04)':'#fff', border: isSaved?'1px solid rgba(0,184,148,0.3)':'1px solid #E8ECF0' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#1a1a2e' }}>{selectedDate.replace(/-/g,'.')}</div>
                    {isSaved
                      ? <div style={{ fontSize:11, color:'#00B894', marginTop:2 }}>✓ 저장됨 · 총 매출 {totalSales.toLocaleString()}원 · {totalCount}건</div>
                      : <div style={{ fontSize:11, color:'#bbb', marginTop:2 }}>{isToday ? '✏️ 오늘 일지 작성 중' : '미작성'}</div>}
                  </div>
                  <button onClick={() => setShowForm(p => !p)}
                    style={{ padding:'7px 14px', borderRadius:9, background: isSaved?'rgba(0,184,148,0.1)':'rgba(255,107,53,0.1)', border: isSaved?'1px solid rgba(0,184,148,0.3)':'1px solid rgba(255,107,53,0.3)', color: isSaved?'#00B894':'#FF6B35', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                    {showForm ? '▲ 접기' : isSaved ? '📂 열기' : '✏️ 작성'}
                  </button>
                </div>
              </div>
            </div>
            <div>{showForm && formContent}</div>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <span style={{ fontSize:17, fontWeight:700, color:'#1a1a2e' }}>📋 마감일지</span>
            {editLogBtn}
          </div>
          <ClosingCalendar year={calYear} month={calMonth} salesMap={salesMap} weatherMap={weatherMap} editedDates={editedDates}
            selectedDate={selectedDate} onSelectDate={handleSelectDate} onChangeMonth={(y,m) => { setCalYear(y); setCalMonth(m) }} />
          <div style={{ ...bx, padding:'12px 16px', background: isSaved?'rgba(0,184,148,0.04)':'#fff', border: isSaved?'1px solid rgba(0,184,148,0.3)':'1px solid #E8ECF0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:'#1a1a2e' }}>{selectedDate.replace(/-/g,'.')}</div>
                {isSaved
                  ? <div style={{ fontSize:11, color:'#00B894', marginTop:2 }}>✓ 저장됨 · 총 매출 {totalSales.toLocaleString()}원 · {totalCount}건</div>
                  : <div style={{ fontSize:11, color:'#bbb', marginTop:2 }}>{isToday ? '✏️ 오늘 일지 작성 중' : '미작성'}</div>}
              </div>
              <button onClick={() => setShowForm(p => !p)}
                style={{ padding:'7px 14px', borderRadius:9, background: isSaved?'rgba(0,184,148,0.1)':'rgba(255,107,53,0.1)', border: isSaved?'1px solid rgba(0,184,148,0.3)':'1px solid rgba(255,107,53,0.3)', color: isSaved?'#00B894':'#FF6B35', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                {showForm ? '▲ 접기' : isSaved ? '📂 열기' : '✏️ 작성'}
              </button>
            </div>
          </div>
          {showForm && formContent}
        </div>
      )}
    </div>
  )
}