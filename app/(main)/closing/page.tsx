'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import YearMonthPicker from '@/components/YearMonthPicker'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
const lbl = { fontSize: 11, color: '#888', marginBottom: 4, display: 'block' as const }

const DEFAULT_PLATFORMS = ['ì¹´ë“œ', '?„ê¸ˆ', 'ê³„ì¢Œ?´ì²´', 'ë°°ë‹¬?˜ë?ì¡?, 'ì¿ íŒ¡?´ì¸ ', '?”ê¸°??]
const DEFAULT_CHECKLIST = ['ê°€??ë°¸ë¸Œ ? ê¸ˆ', '?‰ì¥ê³??¨ë„ ?•ì¸', '?œì¬ ë´‰íˆ¬ ê¸ˆê³  ë³´ê?', '?°ë ˆê¸?ë¶„ë¦¬?˜ê±°', '?„ë“± ?Œë“±', 'ì¶œì…ë¬?? ê¸ˆ']
const DEFAULT_REVIEW_PLATFORMS = ['?¤ì´ë²?, 'ë°°ë?', '?”ê¸°??, 'ì¿ íŒ¡', 'ì¹´ì¹´?¤ë§µ', '?¹ê·¼']

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ? ì”¨ ì½”ë“œ ???„ì´ì½?ë³€??function weatherIcon(code: number): string {
  if (code === 0) return '?€ï¸?
  if (code <= 2) return '?Œ¤ï¸?
  if (code <= 3) return '?ï¸'
  if (code <= 49) return '?Œ«ï¸?
  if (code <= 59) return '?Œ§ï¸?
  if (code <= 69) return '?Œ¨ï¸?
  if (code <= 79) return '?„ï¸'
  if (code <= 82) return '?Œ§ï¸?
  if (code <= 86) return '?Œ¨ï¸?
  if (code <= 99) return '?ˆï¸'
  return '?Œ¡ï¸?
}

function ClosingCalendar({ year, month, salesMap, weatherMap, selectedDate, onSelectDate, onChangeMonth }: {
  year: number; month: number; salesMap: Record<string, number>
  weatherMap: Record<string, { code: number; tmax: number; tmin: number }>
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
  const totalMonthSales = Object.entries(salesMap).filter(([k]) => k.startsWith(monthStr)).reduce((s,[,v]) => s+v, 0)

  return (
    <div style={{ ...bx, padding: '14px 12px' }}>
      <div style={{ marginBottom: 10 }}>
        <YearMonthPicker year={year} month={month} onChange={onChangeMonth} color="#FF6B35" />
        {totalMonthSales > 0 && <div style={{ fontSize:11, color:'#FF6B35', fontWeight:600, textAlign:'center', marginTop:4 }}>??ë§¤ì¶œ {totalMonthSales.toLocaleString()}??/div>}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:4 }}>
        {['??,'??,'??,'??,'ëª?,'ê¸?,'??].map((d,i) => (
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
            return (
              <button key={di} onClick={() => onSelectDate(dateStr)} style={{
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                padding:'4px 2px', borderRadius:8, cursor:'pointer', minHeight:52,
                border: isSelected ? '2px solid #FF6B35' : isToday ? '1px solid rgba(255,107,53,0.3)' : '1px solid transparent',
                background: isSelected ? 'rgba(255,107,53,0.1)' : hasSales ? 'rgba(0,184,148,0.06)' : 'transparent',
              }}>
                <span style={{ fontSize:12, fontWeight: isSelected||isToday?700:400, color: isSelected?'#FF6B35':di===0?'#E84393':di===6?'#2DC6D6':'#1a1a2e' }}>{day}</span>
                {weather && <span style={{ fontSize:11, lineHeight:1, marginTop:1 }}>{weatherIcon(weather.code)}</span>}
                {weather && <span style={{ fontSize:7, color:'#2DC6D6', fontWeight:600, lineHeight:1, marginTop:1 }}>{Math.round(weather.tmax)}Â°</span>}
                {hasSales && <span style={{ fontSize:8, color:'#00B894', fontWeight:600, marginTop:1, lineHeight:1 }}>{sales>=10000?`${Math.floor(sales/10000)}ë§?:sales.toLocaleString()}</span>}
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
  const [showForm, setShowForm] = useState(false)
  const now = new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [salesMap, setSalesMap] = useState<Record<string, number>>({})
  const [weatherMap, setWeatherMap] = useState<Record<string, { code: number; tmax: number; tmin: number }>>({})
  const closingRef = useRef<any>(null)
  const [isPC, setIsPC] = useState(false)

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

  // ë¦¬ë·° ê´€???íƒœ
  const [reviewPlatforms, setReviewPlatforms] = useState<any[]>([])
  const [reviews, setReviews] = useState<Record<string, { review_count: number; reply_count: number }>>({})
  const [showReviewMgr, setShowReviewMgr] = useState(false)
  const [newReviewPlatformName, setNewReviewPlatformName] = useState('')
  const [editingReviewPlatform, setEditingReviewPlatform] = useState<any>(null)
  const [editReviewPlatformName, setEditReviewPlatformName] = useState('')

  // ?˜ì • ?´ë ¥ ê´€???íƒœ
  const [editLogs, setEditLogs] = useState<any[]>([])
  const [showEditLogs, setShowEditLogs] = useState(false)
  const [unreadEditCount, setUnreadEditCount] = useState(0)
  const [unreadLogCount, setUnreadLogCount] = useState(0)
  const prevClosingSnapshot = useRef<any>(null)
  const autoSaveTimer = useRef<any>(null)
  const autoSaveTimerRef = useRef<any>(null)

  const isManager = userRole === 'owner' || userRole === 'manager'
  const isOwner = userRole === 'owner'
  const isSaved = !!closingRef.current

  // ?˜ì • ?´ë ¥ ê´€???íƒœ
  const [editLogs, setEditLogs] = useState<any[]>([])
  const [showEditLogs, setShowEditLogs] = useState(false)
  const [unreadLogCount, setUnreadLogCount] = useState(0)
  const prevValuesRef = useRef<Record<string, any>>({})
  const autoSaveTimerRef = useRef<any>(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle'|'saving'|'saved'>('idle')

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
    if (user.role === 'owner') loadUnreadEditCount(store.id, user.nm || '')
  }, [])

  async function loadUnreadEditCount(sid: string, uname: string) {
    const lastSeen = localStorage.getItem(`mj_edit_log_seen_${sid}`) || '1970-01-01'
    const { count } = await supabase.from('closing_edit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('store_id', sid)
      .neq('edited_by', uname)
      .gt('edited_at', lastSeen)
    setUnreadEditCount(count || 0)
  }

  async function loadEditLogs(closingId: string) {
    const { data } = await supabase.from('closing_edit_logs')
      .select('*').eq('closing_id', closingId)
      .order('edited_at', { ascending: false }).limit(50)
    setEditLogs(data || [])
  }

  useEffect(() => { if (storeId) loadClosing(storeId, selectedDate) }, [selectedDate, storeId])
  useEffect(() => { closingRef.current = closing }, [closing])

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

    // ë¦¬ë·° ?Œë«??ë¡œë“œ
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
    setSalesMap(map)
    setWeatherMap(wmap)
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

      // ë¦¬ë·° ë¡œë“œ
      const { data: rv } = await supabase.from('closing_reviews').select('*').eq('closing_id', cl.id)
      const rvm: Record<string, { review_count: number; reply_count: number }> = {}
      if (rv) rv.forEach((r:any) => { rvm[r.platform] = { review_count: r.review_count || 0, reply_count: r.reply_count || 0 } })
      setReviews(rvm)
      setShowForm(true)

      // ?¤ëƒ…???€??      prevClosingSnapshot.current = {
        writer: cl.writer || cl.created_by || '', closeStaff: cl.close_staff || '',
        cancelCount: cl.cancel_count || 0, cashAmount: cl.cash_amount || 0,
        note: cl.note || '', memo: cl.memo || '', discountAmount: cl.discount_amount || 0,
        staffCount: cl.staff_count || 0, openTime: cl.open_time || '', closeTime: cl.close_time || '',
        sales: sm, counts: cm, cancelCounts: ccm, reviews: rvm
      }
      // ?˜ì •?´ë ¥ ë¡œë“œ (?€?œë§Œ)
      if (userRole === 'owner') loadEditLogs(cl.id)
    } else {
      setClosing(null); closingRef.current = null
      setWriter(''); setCloseStaff(''); setCancelCount(0)
      setCashAmount(0); setNote(''); setMemo(''); setDiscountAmount(0)
      setStaffCount(0); setOpenTime(''); setCloseTime('')
      setSales({}); setCounts({}); setCancelCounts({})
      setChecks({}); setSoldouts([]); setNextTodos([]); setTodoChecks({})
      setReviews({})
      setShowForm(false)
    }
  }

  function handleSelectDate(d: string) {
    setSelectedDate(d)
    const [y, m] = d.split('-').map(Number)
    setCalYear(y); setCalMonth(m-1)
  }

  // ?˜ì • ?´ë ¥ ê¸°ë¡ ?¨ìˆ˜
  async function logEdit(closingId: string, fieldName: string, oldValue: string, newValue: string) {
    if (oldValue === newValue) return
    await supabase.from('closing_edit_logs').insert({
      closing_id: closingId,
      store_id: storeId,
      edited_by: userName,
      field_name: fieldName,
      old_value: String(oldValue),
      new_value: String(newValue),
    })
  }

  // ?€?œìš© ?˜ì •?´ë ¥ ë¡œë“œ
  async function loadEditLogs(closingId: string) {
    const { data } = await supabase.from('closing_edit_logs')
      .select('*').eq('closing_id', closingId)
      .order('edited_at', { ascending: false })
    setEditLogs(data || [])
    // ë¯¸í™•???´ë ¥ ì¹´ìš´??(?´ê? ?˜ì •??ê²??œì™¸)
    const unread = (data || []).filter((l: any) => l.edited_by !== userName).length
    setUnreadLogCount(unread)
  }

  // ?¹ì¼ ?ë™?€??  async function autoSave(changedField?: string, oldVal?: string, newVal?: string) {
    if (!storeId) return
    const isToday = selectedDate === toDateStr(new Date())
    if (!isToday) return // ?¹ì¼ë§??ë™?€??    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(async () => {
      setAutoSaveStatus('saving')
      try {
        let weatherData: any = {}
        const { data: storeData } = await supabase.from('stores').select('lat, lng').eq('id', storeId).maybeSingle()
        if (storeData?.lat && storeData?.lng && !closingRef.current) {
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
              }
            }
          } catch (e) {}
        }

        const current = closingRef.current
        let closingId: string
        if (current?.id) {
          closingId = current.id
          await supabase.from('closings').update({
            writer, close_staff: closeStaff, cancel_count: cancelCount,
            cash_amount: cashAmount, note, memo, discount_amount: discountAmount,
            staff_count: staffCount, open_time: openTime, close_time: closeTime,
          }).eq('id', closingId)
          // ?˜ì •?´ë ¥ ê¸°ë¡ (?¹ì¼ ???˜ì •?œì—ë§?- ?¹ì¼?€ ?¼ìƒ?ì´???ëµ?˜ê±°??ê¸°ë¡)
          if (changedField && oldVal !== undefined && newVal !== undefined && oldVal !== newVal) {
            await logEdit(closingId, changedField, oldVal, newVal)
          }
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

        // ë§¤ì¶œ/ë¦¬ë·° ?€??        await supabase.from('closing_sales').delete().eq('closing_id', closingId)
        const rows = platforms.map(p => ({
          closing_id: closingId, platform: p.name,
          amount: sales[p.name] || 0, count: counts[p.name] || 0,
          cancel_count: cancelCounts[p.name] || 0, sort_order: p.sort_order
        }))
        if (rows.length > 0) await supabase.from('closing_sales').insert(rows)

        await supabase.from('closing_reviews').delete().eq('closing_id', closingId)
        const reviewRows = reviewPlatforms
          .filter(p => reviews[p.name]?.review_count || reviews[p.name]?.reply_count)
          .map(p => ({ closing_id: closingId, platform: p.name, review_count: reviews[p.name]?.review_count || 0, reply_count: reviews[p.name]?.reply_count || 0 }))
        if (reviewRows.length > 0) await supabase.from('closing_reviews').insert(reviewRows)

        const newTotal = platforms.reduce((s, p) => s + (sales[p.name]||0), 0)
        setSalesMap(prev => ({ ...prev, [selectedDate]: newTotal }))
        setShowForm(true)
        setAutoSaveStatus('saved')
        setTimeout(() => setAutoSaveStatus('idle'), 2000)
      } catch (e) { setAutoSaveStatus('idle') }
    }, 800)
  }

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

  async function saveClosing() {
    if (!storeId) return
    if (isSaved && !isManager) { alert('?€?¥ëœ ë§ˆê°?¼ì???ë§¤ë‹ˆ?€/?€?œë§Œ ?˜ì •?????ˆìŠµ?ˆë‹¤.'); return }
    setIsSaving(true)
    try {
      // ? ì”¨ ?°ì´??ê°€?¸ì˜¤ê¸?      let weatherData: any = {}
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
        } catch (e) { console.error('? ì”¨ ?˜ì§‘ ?¤íŒ¨:', e) }
      }

      const current = closingRef.current
      let closingId: string
      if (current?.id) {
        closingId = current.id
        await supabase.from('closings').update({
          writer, close_staff: closeStaff,
          cancel_count: cancelCount, cash_amount: cashAmount,
          note, memo, discount_amount: discountAmount,
          staff_count: staffCount, open_time: openTime, close_time: closeTime,
          ...weatherData
        }).eq('id', closingId)

        // ?˜ì •?´ë ¥ ê¸°ë¡ (ê³¼ê±° ? ì§œ ?˜ì •??
        if (selectedDate !== todayStr && prevClosingSnapshot.current) {
          const prev = prevClosingSnapshot.current
          const fieldChecks = [
            { label: '?‘ì„±??, old: prev.writer, new: writer },
            { label: 'ë§ˆê°?´ë‹¹??, old: prev.closeStaff, new: closeStaff },
            { label: '?¹ì´?¬í•­', old: prev.memo, new: memo },
            { label: '?´ë ˆ???¹ì´?¬í•­', old: prev.note, new: note },
            { label: '? ì¸ê¸ˆì•¡', old: String(prev.discountAmount||0), new: String(discountAmount) },
            { label: '?œì¬', old: String(prev.cashAmount||0), new: String(cashAmount) },
            { label: 'ì§ì›??, old: String(prev.staffCount||0), new: String(staffCount) },
            { label: '?¤í”ˆ?œê°„', old: prev.openTime||'', new: openTime },
            { label: 'ë§ˆê°?œê°„', old: prev.closeTime||'', new: closeTime },
          ]
          for (const f of fieldChecks) {
            if (f.old !== f.new) await logEdit(closingId, f.label, f.old, f.new)
          }
          for (const p of platforms) {
            const prevSale = String(prev.sales?.[p.name] || 0)
            const newSale = String(sales[p.name] || 0)
            if (prevSale !== newSale) await logEdit(closingId, `ë§¤ì¶œ-${p.name}`, `${Number(prevSale).toLocaleString()}??, `${Number(newSale).toLocaleString()}??)
            const prevCount = String(prev.counts?.[p.name] || 0)
            const newCount = String(counts[p.name] || 0)
            if (prevCount !== newCount) await logEdit(closingId, `ê±´ìˆ˜-${p.name}`, `${prevCount}ê±?, `${newCount}ê±?)
          }
          // ?¤ëƒ…??ê°±ì‹ 
          prevClosingSnapshot.current = { writer, closeStaff, memo, note, discountAmount, cashAmount, staffCount, openTime, closeTime, sales: {...sales}, counts: {...counts}, cancelCounts: {...cancelCounts}, reviews: {...reviews} }
          await loadEditLogs(closingId)
        }
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

      // ë¦¬ë·° ?€??      await supabase.from('closing_reviews').delete().eq('closing_id', closingId)
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
      setShowForm(true); alert('?€?¥ë˜?ˆìŠµ?ˆë‹¤!')
    } catch (e: any) { alert('?€???¤íŒ¨: ' + (e?.message || '?¤ì‹œ ?œë„?´ì£¼?¸ìš”')) }
    finally { setIsSaving(false) }
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
    if (!confirm('?? œ? ê¹Œ??')) return
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
    if (!isManager) { alert('ë§¤ë‹ˆ?€/?€?œë§Œ ?? œ?????ˆìŠµ?ˆë‹¤.'); return }
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
    if (!isManager) { alert('ë§¤ë‹ˆ?€/?€?œë§Œ ?? œ?????ˆìŠµ?ˆë‹¤.'); return }
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
    if (!confirm('?? œ? ê¹Œ??')) return
    await supabase.from('closing_platforms').delete().eq('id', id)
    setPlatforms(p => p.filter(x => x.id !== id))
  }

  // ë¦¬ë·° ?Œë«??ê´€ë¦?  async function addReviewPlatform() {
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
    if (!confirm('?? œ? ê¹Œ??')) return
    await supabase.from('closing_review_platforms').delete().eq('id', id)
    setReviewPlatforms(p => p.filter(x => x.id !== id))
  }

  const totalSales = useMemo(() => platforms.reduce((sum, p) => sum + (sales[p.name]||0), 0), [platforms, sales])
  const totalCount = useMemo(() => platforms.reduce((sum, p) => sum + (counts[p.name]||0), 0), [platforms, counts])
  const totalCancelCount = useMemo(() => platforms.reduce((sum, p) => sum + (cancelCounts[p.name]||0), 0), [platforms, cancelCounts])
  const avgPerOrder = totalCount > 0 ? Math.round(totalSales / totalCount) : 0
  const checkedCount = Object.keys(checks).length
  const todayStr = toDateStr(new Date())
  const isToday = selectedDate === todayStr
  const disabled = isSaved && !isManager && !isToday

  const totalReviews = useMemo(() => reviewPlatforms.reduce((sum, p) => sum + (reviews[p.name]?.review_count || 0), 0), [reviewPlatforms, reviews])
  const totalReplies = useMemo(() => reviewPlatforms.reduce((sum, p) => sum + (reviews[p.name]?.reply_count || 0), 0), [reviewPlatforms, reviews])

  // ?€?€ ??ì½˜í…ì¸?(PC/ëª¨ë°”??ê³µìš©) ?€?€
  const formContent = (
    <>
      {isSaved && !isManager && !isToday && (
        <div style={{ background:'rgba(253,196,0,0.1)', border:'1px solid rgba(253,196,0,0.4)', borderRadius:12, padding:'10px 14px', marginBottom:12, fontSize:12, color:'#B8860B' }}>
          ?”’ ?€?¥ëœ ë§ˆê°?¼ì???ë§¤ë‹ˆ?€/?€?œë§Œ ?˜ì • ê°€?¥í•©?ˆë‹¤. ì²´í¬ë¦¬ìŠ¤?¸ëŠ” ?„êµ¬??ê°€?¥í•´??
        </div>
      )}

      {/* ?‘ì„±??*/}
      <div style={bx}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <span style={{ fontSize:12, fontWeight:700, color:'#1a1a2e' }}>?‘¤ ?‘ì„±??/ ?ì—… ?•ë³´</span>
          {isOwner && isSaved && (
            <button onClick={() => setShowEditLogs(true)} style={{ position:'relative', fontSize:11, color:'#6C5CE7', background:'rgba(108,92,231,0.08)', border:'1px solid rgba(108,92,231,0.2)', borderRadius:8, padding:'3px 10px', cursor:'pointer' }}>
              ?“‹ ?˜ì •?´ë ¥ {unreadLogCount > 0 && <span style={{ marginLeft:4, background:'#E84393', color:'#fff', borderRadius:10, fontSize:10, padding:'0 5px' }}>{unreadLogCount}</span>}
            </button>
          )}
        </div>
        <div style={{ display:'grid', gridTemplateColumns: isPC ? '1fr 1fr 1fr 80px 80px' : '1fr 1fr', gap:8 }}>
          <div>
            <span style={lbl}>?‘ì„±??/span>
            <input value={writer} onChange={e => setWriter(e.target.value)} onBlur={() => isToday && autoSave('?‘ì„±??, prevValuesRef.current.writer, writer)} placeholder="?‘ì„±?? disabled={disabled}
              style={{ ...inp, background: disabled?'#F4F6F9':'#F8F9FB' }} />
          </div>
          <div>
            <span style={lbl}>ë§ˆê° ?´ë‹¹??/span>
            <input value={closeStaff} onChange={e => setCloseStaff(e.target.value)} onBlur={() => isToday && autoSave()} placeholder="ë§ˆê° ?´ë‹¹?? disabled={disabled}
              style={{ ...inp, background: disabled?'#F4F6F9':'#F8F9FB' }} />
          </div>
          <div>
            <span style={lbl}>ê·¼ë¬´ ì§ì› ??/span>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <input type="number" value={staffCount||''} onChange={e => setStaffCount(Number(e.target.value))} placeholder="0" disabled={disabled}
                style={{ ...inp, textAlign:'center', background: disabled?'#F4F6F9':'#F8F9FB' }} />
              <span style={{ fontSize:11, color:'#aaa', flexShrink:0 }}>ëª?/span>
            </div>
          </div>
          <div>
            <span style={lbl}>?¤í”ˆ</span>
            <input type="time" value={openTime} onChange={e => setOpenTime(e.target.value)} disabled={disabled}
              style={{ ...inp, background: disabled?'#F4F6F9':'#F8F9FB' }} />
          </div>
          <div>
            <span style={lbl}>ë§ˆê°</span>
            <input type="time" value={closeTime} onChange={e => setCloseTime(e.target.value)} disabled={disabled}
              style={{ ...inp, background: disabled?'#F4F6F9':'#F8F9FB' }} />
          </div>
        </div>
      </div>

      {/* ë§¤ì¶œ */}
      <div style={bx}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <span style={{ fontSize:12, fontWeight:700, color:'#1a1a2e' }}>?’° ë§¤ì¶œ</span>
          {isManager && <button onClick={() => setShowPlatformMgr(true)} style={{ fontSize:10, color:'#2DC6D6', background:'rgba(45,198,214,0.1)', border:'1px solid rgba(45,198,214,0.3)', borderRadius:6, padding:'3px 8px', cursor:'pointer' }}>?Œë«??ê´€ë¦?/button>}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'80px 1fr 64px 64px', gap:6, marginBottom:6, paddingBottom:6, borderBottom:'1px solid #F0F2F5' }}>
          <span style={{ fontSize:10, color:'#aaa', fontWeight:600 }}>?Œë«??/span>
          <span style={{ fontSize:10, color:'#aaa', fontWeight:600, textAlign:'right' }}>ë§¤ì¶œ</span>
          <span style={{ fontSize:10, color:'#aaa', fontWeight:600, textAlign:'center' }}>ê±´ìˆ˜</span>
          <span style={{ fontSize:10, color:'#aaa', fontWeight:600, textAlign:'center' }}>ì·¨ì†Œ/?˜ë¶ˆ</span>
        </div>
        {platforms.map(p => (
          <div key={p.id} style={{ display:'grid', gridTemplateColumns:'80px 1fr 64px 64px', gap:6, marginBottom:8, alignItems:'center' }}>
            <span style={{ fontSize:12, color:'#555', fontWeight:600 }}>{p.name}</span>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <input type="number" value={sales[p.name]||''} onChange={e => setSales(prev => ({ ...prev, [p.name]: Number(e.target.value) }))}
                onBlur={() => isToday && autoSave()}
                placeholder="0" disabled={disabled} style={{ ...inp, textAlign:'right', padding:'6px 8px', background: disabled?'#F4F6F9':'#F8F9FB' }} />
              <span style={{ fontSize:10, color:'#aaa', flexShrink:0 }}>??/span>
            </div>
            <input type="number" value={counts[p.name]||''} onChange={e => setCounts(prev => ({ ...prev, [p.name]: Number(e.target.value) }))}
              onBlur={() => isToday && autoSave()}
              placeholder="0" disabled={disabled} style={{ ...inp, textAlign:'center', padding:'6px 4px', background: disabled?'#F4F6F9':'#F8F9FB' }} />
            <input type="number" value={cancelCounts[p.name]||''} onChange={e => setCancelCounts(prev => ({ ...prev, [p.name]: Number(e.target.value) }))}
              onBlur={() => isToday && autoSave()}
              placeholder="0" disabled={disabled} style={{ ...inp, textAlign:'center', padding:'6px 4px', background: disabled?'#F4F6F9':'rgba(232,67,147,0.04)', border:'1px solid rgba(232,67,147,0.2)' }} />
          </div>
        ))}
        <div style={{ borderTop:'1px dashed #E8ECF0', paddingTop:10, marginTop:4 }}>
          <div style={{ display:'grid', gridTemplateColumns:'80px 1fr 64px 64px', gap:6, alignItems:'center' }}>
            <span style={{ fontSize:12, fontWeight:700, color:'#1a1a2e' }}>?©ê³„</span>
            <span style={{ fontSize:18, fontWeight:800, color:'#FF6B35', textAlign:'right' }}>{totalSales.toLocaleString()}??/span>
            <span style={{ fontSize:13, fontWeight:700, color:'#6C5CE7', textAlign:'center' }}>{totalCount}ê±?/span>
            <span style={{ fontSize:13, fontWeight:700, color:'#E84393', textAlign:'center' }}>{totalCancelCount}ê±?/span>
          </div>
          {avgPerOrder > 0 && (
            <div style={{ marginTop:8, padding:'8px 12px', background:'rgba(108,92,231,0.06)', borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:11, color:'#6C5CE7', fontWeight:600 }}>?“Š ê°ë‹¨ê°€</span>
              <span style={{ fontSize:14, fontWeight:800, color:'#6C5CE7' }}>{avgPerOrder.toLocaleString()}??/span>
            </div>
          )}
        </div>
      </div>

      {/* ì·¨ì†Œ/? ì¸ */}
      <div style={bx}>
        <div style={{ fontSize:12, fontWeight:700, color:'#1a1a2e', marginBottom:10 }}>?“‰ ì·¨ì†Œ/? ì¸</div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ flex:1 }}>
            <span style={lbl}>ì´?ì·¨ì†Œ/?˜ë¶ˆ ê±´ìˆ˜</span>
            <div style={{ padding:'10px 12px', borderRadius:8, background:'rgba(232,67,147,0.06)', border:'1px solid rgba(232,67,147,0.2)', fontSize:14, fontWeight:700, color:'#E84393', textAlign:'center' }}>
              {totalCancelCount}ê±?            </div>
          </div>
          <div style={{ flex:1 }}>
            <span style={lbl}>? ì¸/?„ë¡œëª¨ì…˜ ê¸ˆì•¡</span>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <input type="number" value={discountAmount||''} onChange={e => setDiscountAmount(Number(e.target.value))} onBlur={() => isToday && autoSave()} placeholder="0" disabled={disabled}
                style={{ ...inp, textAlign:'right', background: disabled?'#F4F6F9':'#F8F9FB' }} />
              <span style={{ fontSize:11, color:'#aaa', flexShrink:0 }}>??/span>
            </div>
          </div>
        </div>
      </div>

      {/* ?œì¬ */}
      <div style={bx}>
        <div style={{ fontSize:12, fontWeight:700, color:'#1a1a2e', marginBottom:10 }}>?’µ ?œì¬</div>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <input type="number" value={cashAmount||''} onChange={e => setCashAmount(Number(e.target.value))} onBlur={() => isToday && autoSave()} placeholder="ë§ˆê° ?œì¬ ê¸ˆì•¡ ?…ë ¥" disabled={disabled}
            style={{ ...inp, textAlign:'right', background: disabled?'#F4F6F9':'#F8F9FB' }} />
          <span style={{ fontSize:11, color:'#aaa', flexShrink:0 }}>??/span>
        </div>
        {cashAmount > 0 && <div style={{ fontSize:11, color:'#888', marginTop:4, textAlign:'right' }}>{cashAmount.toLocaleString()}??/div>}
      </div>

      {/* ë¦¬ë·° ?µê? */}
      <div style={bx}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div>
            <span style={{ fontSize:12, fontWeight:700, color:'#1a1a2e' }}>â­?ë¦¬ë·° / ?µê?</span>
            {(totalReviews > 0 || totalReplies > 0) && (
              <span style={{ marginLeft:8, fontSize:11, color:'#FF6B35' }}>ë¦¬ë·° {totalReviews}ê±?Â· ?µê? {totalReplies}ê±?/span>
            )}
          </div>
          {isManager && <button onClick={() => setShowReviewMgr(true)} style={{ fontSize:10, color:'#6C5CE7', background:'rgba(108,92,231,0.1)', border:'1px solid rgba(108,92,231,0.3)', borderRadius:6, padding:'3px 8px', cursor:'pointer' }}>?Œë«??ê´€ë¦?/button>}
        </div>
        <div style={{ display:'grid', gridTemplateColumns: isPC ? 'repeat(3,1fr)' : 'repeat(2,1fr)', gap:8 }}>
          {reviewPlatforms.map(p => (
            <div key={p.id} style={{ background:'#F8F9FB', borderRadius:12, padding:'10px 12px', border:'1px solid #E8ECF0' }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#1a1a2e', marginBottom:8 }}>{p.name}</div>
              <div style={{ display:'flex', gap:6 }}>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:9, color:'#aaa', display:'block', marginBottom:3 }}>ë¦¬ë·° ??/span>
                  <input type="number" value={reviews[p.name]?.review_count||''} disabled={disabled}
                    onChange={e => setReviews(prev => ({ ...prev, [p.name]: { ...prev[p.name], review_count: Number(e.target.value), reply_count: prev[p.name]?.reply_count||0 } }))}
                    onBlur={() => isToday && autoSave()}
                    placeholder="0" style={{ ...inp, textAlign:'center', padding:'5px 4px', fontSize:13, fontWeight:700, background: disabled?'#F4F6F9':'#fff', color:'#FF6B35' }} />
                </div>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:9, color:'#aaa', display:'block', marginBottom:3 }}>?µê? ??/span>
                  <input type="number" value={reviews[p.name]?.reply_count||''} disabled={disabled}
                    onChange={e => setReviews(prev => ({ ...prev, [p.name]: { review_count: prev[p.name]?.review_count||0, reply_count: Number(e.target.value) } }))}
                    onBlur={() => isToday && autoSave()}
                    placeholder="0" style={{ ...inp, textAlign:'center', padding:'5px 4px', fontSize:13, fontWeight:700, background: disabled?'#F4F6F9':'#fff', color:'#00B894' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ?¹ì´?¬í•­ ë©”ëª¨ */}
      <div style={bx}>
        <div style={{ fontSize:12, fontWeight:700, color:'#1a1a2e', marginBottom:8 }}>?“Œ ?¹ì´?¬í•­ ë©”ëª¨</div>
        <div style={{ fontSize:10, color:'#aaa', marginBottom:8 }}>?´ë²¤?? ?‰ì‚¬, ? ì”¨, ?¹ì´ ?í™© ????ë¶„ì„??—??ë§¤ì¶œê³??°ê²°?©ë‹ˆ??/div>
        <textarea value={memo} onChange={e => setMemo(e.target.value)} onBlur={() => isToday && autoSave()} placeholder="?¤ëŠ˜???¹ì´?¬í•­??ê¸°ë¡?˜ì„¸??(?´ë²¤?? ? ì”¨, ?‰ì‚¬ ??" disabled={disabled}
          style={{ ...inp, minHeight:70, resize:'none' as const, lineHeight:1.6, background: disabled?'#F4F6F9':'#F8F9FB' }} />
      </div>

      {/* ?ˆì ˆ ë©”ë‰´ */}
      <div style={bx}>
        <div style={{ fontSize:12, fontWeight:700, color:'#1a1a2e', marginBottom:10 }}>?š« ?ˆì ˆ ë©”ë‰´</div>
        {soldouts.length === 0 && <div style={{ fontSize:12, color:'#bbb', textAlign:'center', padding:'8px 0', marginBottom:8 }}>?ˆì ˆ ë©”ë‰´ ?†ìŒ ??/div>}
        {soldouts.map(so => (
          <div key={so.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 12px', borderRadius:9, background:'rgba(232,67,147,0.06)', border:'1px solid rgba(232,67,147,0.2)', marginBottom:6 }}>
            <div>
              <span style={{ fontSize:13, color:'#1a1a2e' }}>{so.menu_name}</span>
              <span style={{ fontSize:10, color:'#bbb', marginLeft:8 }}>{so.created_by}</span>
            </div>
            {isManager && <button onClick={() => deleteSoldout(so.id)} style={{ background:'none', border:'none', fontSize:11, color:'#E84393', cursor:'pointer' }}>?? œ</button>}
          </div>
        ))}
        <div style={{ display:'flex', gap:8, marginTop:6 }}>
          <input value={newSoldout} onChange={e => setNewSoldout(e.target.value)} onKeyDown={e => e.key==='Enter' && addSoldout()} placeholder="?ˆì ˆ ë©”ë‰´ëª??…ë ¥" style={{ ...inp, flex:1 }} />
          <button onClick={addSoldout} style={{ padding:'8px 12px', borderRadius:8, background:'rgba(232,67,147,0.1)', border:'1px solid rgba(232,67,147,0.3)', color:'#E84393', fontSize:12, fontWeight:700, cursor:'pointer' }}>ì¶”ê?</button>
        </div>
      </div>

      {/* ë§ˆê° ì²´í¬ë¦¬ìŠ¤??*/}
      <div style={bx}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:12, fontWeight:700, color:'#1a1a2e' }}>??ë§ˆê° ì²´í¬ë¦¬ìŠ¤??/span>
            <span style={{ fontSize:10, padding:'1px 7px', borderRadius:10, background: checkedCount===checkItems.length&&checkItems.length>0?'rgba(0,184,148,0.12)':'#F4F6F9', color: checkedCount===checkItems.length&&checkItems.length>0?'#00B894':'#aaa' }}>
              {checkedCount}/{checkItems.length}
            </span>
          </div>
          {isManager && <button onClick={() => setShowCheckMgr(true)} style={{ fontSize:10, color:'#2DC6D6', background:'rgba(45,198,214,0.1)', border:'1px solid rgba(45,198,214,0.3)', borderRadius:6, padding:'3px 8px', cursor:'pointer' }}>??ª© ê´€ë¦?/button>}
        </div>
        {isPC ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:6 }}>
            {checkItems.map(item => {
              const ck = checks[item.id]
              return (
                <button key={item.id} onClick={() => toggleCheck(item.id)}
                  style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 14px', borderRadius:10, border: ck?'1px solid rgba(0,184,148,0.3)':'1px solid #E8ECF0', background: ck?'rgba(0,184,148,0.06)':'#F8F9FB', cursor:'pointer', textAlign:'left' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:17, color: ck?'#00B894':'#ddd', lineHeight:1 }}>{ck?'??:'??}</span>
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
                  <span style={{ fontSize:17, color: ck?'#00B894':'#ddd', lineHeight:1 }}>{ck?'??:'??}</span>
                  <span style={{ fontSize:13, color: ck?'#00B894':'#444', textDecoration: ck?'line-through':'none' }}>{item.title}</span>
                </div>
                {ck && <span style={{ fontSize:10, color:'#00B894', flexShrink:0 }}>{ck.checked_by} Â· {new Date(ck.checked_at).toLocaleTimeString('ko',{hour:'2-digit',minute:'2-digit',hour12:false})}</span>}
              </button>
            )
          })
        )}
      </div>

      {/* ?´ë ˆ???¹ì´?¬í•­ */}
      <div style={bx}>
        <div style={{ fontSize:12, fontWeight:700, color:'#1a1a2e', marginBottom:8 }}>?“ ?´ë ˆ???¹ì´?¬í•­</div>
        <textarea value={note} onChange={e => setNote(e.target.value)} onBlur={() => isToday && autoSave()} placeholder={disabled?'':'?¤ëŠ˜ ë°œìƒ???´ë ˆ?„ì´???¹ì´?¬í•­??ê¸°ë¡?˜ì„¸??} disabled={disabled}
          style={{ ...inp, minHeight:80, resize:'none' as const, lineHeight:1.6, background: disabled?'#F4F6F9':'#F8F9FB' }} />
      </div>

      {/* ?¤ìŒ ?´ë‹¹???„ë‹¬?¬í•­ */}
      <div style={{ ...bx, border: nextTodos.length>0?'1px solid rgba(255,107,53,0.35)':'1px solid #E8ECF0' }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#1a1a2e', marginBottom:4 }}>?“¢ ?¤ìŒ ?´ë‹¹???„ë‹¬?¬í•­</div>
        <div style={{ fontSize:10, color:'#aaa', marginBottom:10 }}>?„êµ¬????ª© ì¶”ê? ê°€??Â· ê³µì? ??—?œë„ ?•ì¸ ê°€??/div>
        {nextTodos.length === 0 && <div style={{ fontSize:12, color:'#bbb', textAlign:'center', padding:'8px 0', marginBottom:8 }}>?„ë‹¬?¬í•­ ?†ìŒ</div>}
        {nextTodos.map(todo => {
          const chks = todoChecks[todo.id] || []
          const myChecked = chks.find((c:any) => c.checked_by === userName)
          return (
            <div key={todo.id} style={{ borderRadius:10, border: myChecked?'1px solid rgba(0,184,148,0.3)':'1px solid #E8ECF0', background: myChecked?'rgba(0,184,148,0.04)':'#F8F9FB', marginBottom:8, overflow:'hidden' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px' }}>
                <button onClick={() => toggleTodoCheck(todo.id)} style={{ display:'flex', alignItems:'center', gap:10, background:'none', border:'none', cursor:'pointer', flex:1, textAlign:'left', padding:0 }}>
                  <span style={{ fontSize:17, color: myChecked?'#00B894':'#ddd', lineHeight:1, flexShrink:0 }}>{myChecked?'??:'??}</span>
                  <div>
                    <div style={{ fontSize:13, color: myChecked?'#00B894':'#444', textDecoration: myChecked?'line-through':'none' }}>{todo.content}</div>
                    <div style={{ fontSize:10, color:'#bbb', marginTop:2 }}>?‘ì„±: {todo.created_by}</div>
                  </div>
                </button>
                {isManager && <button onClick={() => deleteNextTodo(todo.id)} style={{ background:'none', border:'none', fontSize:11, color:'#E84393', cursor:'pointer', marginLeft:8, flexShrink:0 }}>?? œ</button>}
              </div>
              {chks.length > 0 && (
                <div style={{ padding:'6px 14px 10px', borderTop:'1px solid rgba(0,184,148,0.1)', background:'rgba(0,184,148,0.02)' }}>
                  <div style={{ fontSize:9, color:'#00B894', fontWeight:700, marginBottom:3 }}>???•ì¸???¬ëŒ</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                    {chks.map((c:any) => (
                      <span key={c.id} style={{ fontSize:10, color:'#00B894', background:'rgba(0,184,148,0.1)', padding:'1px 7px', borderRadius:10 }}>
                        {c.checked_by} Â· {new Date(c.checked_at).toLocaleTimeString('ko',{hour:'2-digit',minute:'2-digit',hour12:false})}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        <div style={{ display:'flex', gap:8, marginTop:6 }}>
          <input value={newTodo} onChange={e => setNewTodo(e.target.value)} onKeyDown={e => e.key==='Enter' && addNextTodo()} placeholder="?„ë‹¬???´ìš© ?…ë ¥" style={{ ...inp, flex:1 }} />
          <button onClick={addNextTodo} style={{ padding:'8px 12px', borderRadius:8, background:'rgba(255,107,53,0.1)', border:'1px solid rgba(255,107,53,0.3)', color:'#FF6B35', fontSize:12, fontWeight:700, cursor:'pointer' }}>ì¶”ê?</button>
        </div>
      </div>

      {isToday ? (
        // ?¹ì¼: ?ë™?€???œì‹œ + ?€?œëŠ” ?˜ì •?´ë ¥ ë²„íŠ¼
        <div style={{ marginBottom:24 }}>
          <div style={{ width:'100%', padding:'14px 16px', borderRadius:14, background: autoSaveStatus==='saved'?'rgba(0,184,148,0.08)':autoSaveStatus==='saving'?'rgba(255,107,53,0.06)':'#F8F9FB', border:`1px solid ${autoSaveStatus==='saved'?'rgba(0,184,148,0.3)':autoSaveStatus==='saving'?'rgba(255,107,53,0.2)':'#E8ECF0'}`, color: autoSaveStatus==='saved'?'#00B894':autoSaveStatus==='saving'?'#FF6B35':'#bbb', fontSize:13, fontWeight:600, textAlign:'center' }}>
            {autoSaveStatus==='saving'?'?’¾ ?ë™ ?€??ì¤?..':autoSaveStatus==='saved'?'???ë™ ?€?¥ë¨':isSaved?'???€?¥ë¨ Â· ?…ë ¥?˜ë©´ ?ë™ ?€??:'?ï¸ ?…ë ¥?˜ë©´ ?ë™?¼ë¡œ ?€?¥ë¼??}
          </div>
          {isSaved && isOwner && (
            <button onClick={() => { setShowEditLogs(true); if(closingRef.current) loadEditLogs(closingRef.current.id); localStorage.setItem(`mj_edit_log_seen_${storeId}`, new Date().toISOString()); setUnreadLogCount(0); setUnreadEditCount(0) }}
              style={{ width:'100%', marginTop:8, padding:'10px 0', borderRadius:12, background:'rgba(108,92,231,0.08)', border:'1px solid rgba(108,92,231,0.25)', color:'#6C5CE7', fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              ?“‹ ?˜ì • ?´ë ¥ ë³´ê¸°
              {unreadLogCount > 0 && <span style={{ background:'#E84393', color:'#fff', borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:700 }}>???´ë ¥ {unreadLogCount}ê±?/span>}
            </button>
          )}
        </div>
      ) : (!isSaved || isManager) ? (
        <div style={{ marginBottom:24 }}>
          <button onClick={saveClosing} disabled={isSaving}
            style={{ width:'100%', padding:'15px 0', borderRadius:14, background: isSaving?'#ddd':'linear-gradient(135deg,#FF6B35,#E84393)', border:'none', color:'#fff', fontSize:15, fontWeight:700, cursor: isSaving?'not-allowed':'pointer' }}>
            {isSaving ? '?€??ì¤?..' : isSaved ? '?ï¸ ë§ˆê°?¼ì? ?˜ì • ?€?? : '?’¾ ë§ˆê°?¼ì? ?€??}
          </button>
          {isSaved && isOwner && (
            <button onClick={() => { setShowEditLogs(true); if(closingRef.current) loadEditLogs(closingRef.current.id); localStorage.setItem(`mj_edit_log_seen_${storeId}`, new Date().toISOString()); setUnreadLogCount(0); setUnreadEditCount(0) }}
              style={{ width:'100%', marginTop:8, padding:'10px 0', borderRadius:12, background:'rgba(108,92,231,0.08)', border:'1px solid rgba(108,92,231,0.25)', color:'#6C5CE7', fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
              ?“‹ ?˜ì • ?´ë ¥ ë³´ê¸°
              {unreadLogCount > 0 && <span style={{ background:'#E84393', color:'#fff', borderRadius:10, padding:'1px 7px', fontSize:10, fontWeight:700 }}>???´ë ¥ {unreadLogCount}ê±?/span>}
            </button>
          )}
        </div>
      ) : (
        <div style={{ width:'100%', padding:'15px 0', borderRadius:14, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#bbb', fontSize:14, fontWeight:600, textAlign:'center', marginBottom:24 }}>
          ?”’ ?€?¥ëœ ?¼ì? ?˜ì •?€ ë§¤ë‹ˆ?€/?€?œë§Œ ê°€?¥í•©?ˆë‹¤
        </div>
      )}

      {/* ?˜ì •?´ë ¥ ëª¨ë‹¬ (?€?œë§Œ) */}
      {showEditLogs && isOwner && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div style={{ background:'#fff', width:'100%', maxWidth:520, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'80vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div>
                <span style={{ fontSize:15, fontWeight:700 }}>?“‹ ?˜ì • ?´ë ¥</span>
                <span style={{ fontSize:11, color:'#aaa', marginLeft:8 }}>{selectedDate}</span>
              </div>
              <button onClick={() => setShowEditLogs(false)} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>??/button>
            </div>
            {editLogs.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:'#ccc', fontSize:13 }}>?˜ì • ?´ë ¥???†ì–´??/div>
            ) : editLogs.map((log: any) => (
              <div key={log.id} style={{ borderRadius:12, border:'1px solid #E8ECF0', padding:'12px 14px', marginBottom:8, background:'#FAFBFC' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{log.edited_by}</span>
                  <span style={{ fontSize:10, color:'#aaa' }}>{new Date(log.edited_at).toLocaleString('ko', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false })}</span>
                </div>
                <div style={{ fontSize:12, color:'#555', marginBottom:4 }}>
                  <span style={{ fontWeight:600, color:'#6C5CE7' }}>{log.field_name}</span> ë³€ê²?                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                  <span style={{ fontSize:11, color:'#E84393', background:'rgba(232,67,147,0.07)', padding:'3px 9px', borderRadius:8, textDecoration:'line-through' }}>{log.old_value || '(?†ìŒ)'}</span>
                  <span style={{ fontSize:11, color:'#aaa' }}>??/span>
                  <span style={{ fontSize:11, color:'#00B894', background:'rgba(0,184,148,0.07)', padding:'3px 9px', borderRadius:8 }}>{log.new_value || '(?†ìŒ)'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )

  return (
    <div>
      {/* ?Œë«??ê´€ë¦?ëª¨ë‹¬ */}
      {showPlatformMgr && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'75vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <span style={{ fontSize:15, fontWeight:700 }}>?’³ ë§¤ì¶œ ?Œë«??ê´€ë¦?/span>
              <button onClick={() => setShowPlatformMgr(false)} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>??/button>
            </div>
            {platforms.map(p => (
              <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#F8F9FB', borderRadius:10, padding:'10px 14px', marginBottom:6 }}>
                <span style={{ fontSize:13 }}>{p.name}</span>
                <button onClick={() => deletePlatform(p.id)} style={{ background:'none', border:'none', fontSize:11, color:'#E84393', cursor:'pointer' }}>?? œ</button>
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:10 }}>
              <input value={newPlatformName} onChange={e => setNewPlatformName(e.target.value)} onKeyDown={e => e.key==='Enter' && addPlatform()} placeholder="???Œë«?? style={{ ...inp, flex:1 }} />
              <button onClick={addPlatform} style={{ padding:'8px 14px', borderRadius:8, background:'linear-gradient(135deg,#FF6B35,#E84393)', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>ì¶”ê?</button>
            </div>
          </div>
        </div>
      )}

      {/* ë¦¬ë·° ?Œë«??ê´€ë¦?ëª¨ë‹¬ */}
      {showReviewMgr && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'75vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <span style={{ fontSize:15, fontWeight:700 }}>â­?ë¦¬ë·° ?Œë«??ê´€ë¦?/span>
              <button onClick={() => setShowReviewMgr(false)} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>??/button>
            </div>
            {reviewPlatforms.map(p => (
              <div key={p.id} style={{ background:'#F8F9FB', borderRadius:10, padding:'10px 14px', marginBottom:6 }}>
                {editingReviewPlatform?.id === p.id ? (
                  <div style={{ display:'flex', gap:8 }}>
                    <input value={editReviewPlatformName} onChange={e => setEditReviewPlatformName(e.target.value)}
                      style={{ ...inp, flex:1 }} autoFocus />
                    <button onClick={() => updateReviewPlatform(p.id)} style={{ padding:'6px 12px', borderRadius:8, background:'linear-gradient(135deg,#FF6B35,#E84393)', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>?€??/button>
                    <button onClick={() => setEditingReviewPlatform(null)} style={{ padding:'6px 10px', borderRadius:8, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', cursor:'pointer', fontSize:12 }}>ì·¨ì†Œ</button>
                  </div>
                ) : (
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:13 }}>{p.name}</span>
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => { setEditingReviewPlatform(p); setEditReviewPlatformName(p.name) }} style={{ background:'none', border:'none', fontSize:11, color:'#6C5CE7', cursor:'pointer' }}>?˜ì •</button>
                      <button onClick={() => deleteReviewPlatform(p.id)} style={{ background:'none', border:'none', fontSize:11, color:'#E84393', cursor:'pointer' }}>?? œ</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:10 }}>
              <input value={newReviewPlatformName} onChange={e => setNewReviewPlatformName(e.target.value)} onKeyDown={e => e.key==='Enter' && addReviewPlatform()} placeholder="???Œë«??(?? êµ¬ê?ë§?" style={{ ...inp, flex:1 }} />
              <button onClick={addReviewPlatform} style={{ padding:'8px 14px', borderRadius:8, background:'linear-gradient(135deg,#6C5CE7,#E84393)', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>ì¶”ê?</button>
            </div>
          </div>
        </div>
      )}

      {/* ì²´í¬ë¦¬ìŠ¤??ê´€ë¦?ëª¨ë‹¬ */}
      {showCheckMgr && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
          <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'75vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <span style={{ fontSize:15, fontWeight:700 }}>??ì²´í¬ë¦¬ìŠ¤??ê´€ë¦?/span>
              <button onClick={() => setShowCheckMgr(false)} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>??/button>
            </div>
            {checkItems.map(c => (
              <div key={c.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#F8F9FB', borderRadius:10, padding:'10px 14px', marginBottom:6 }}>
                <span style={{ fontSize:13 }}>{c.title}</span>
                <button onClick={() => deleteCheckItem(c.id)} style={{ background:'none', border:'none', fontSize:11, color:'#E84393', cursor:'pointer' }}>?? œ</button>
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:10 }}>
              <input value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)} onKeyDown={e => e.key==='Enter' && addCheckItem()} placeholder="????ª©" style={{ ...inp, flex:1 }} />
              <button onClick={addCheckItem} style={{ padding:'8px 14px', borderRadius:8, background:'linear-gradient(135deg,#FF6B35,#E84393)', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>ì¶”ê?</button>
            </div>
          </div>
        </div>
      )}

      {/* PC ?ˆì´?„ì›ƒ */}
      {isPC ? (
        <div style={{ padding:'0 8px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <span style={{ fontSize:20, fontWeight:700, color:'#1a1a2e' }}>?“‹ ë§ˆê°?¼ì?</span>
            {isOwner && unreadEditCount > 0 && (
              <button onClick={() => { setShowEditLogs(true); if(closingRef.current) loadEditLogs(closingRef.current.id); localStorage.setItem(`mj_edit_log_seen_${storeId}`, new Date().toISOString()); setUnreadEditCount(0); setUnreadLogCount(0) }}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:10, background:'rgba(232,67,147,0.1)', border:'1px solid rgba(232,67,147,0.3)', color:'#E84393', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                ?”” ?˜ì • ?Œë¦¼ <span style={{ background:'#E84393', color:'#fff', borderRadius:10, padding:'1px 7px', fontSize:10 }}>{unreadEditCount}</span>
              </button>
            )}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:20, alignItems:'start' }}>
            {/* ì¢Œì¸¡: ?¬ë ¥ + ?íƒœ */}
            <div style={{ position:'sticky', top:80 }}>
              <ClosingCalendar year={calYear} month={calMonth} salesMap={salesMap} weatherMap={weatherMap} selectedDate={selectedDate}
                onSelectDate={handleSelectDate} onChangeMonth={(y,m) => { setCalYear(y); setCalMonth(m) }} />
              <div style={{ ...bx, padding:'12px 16px', background: isSaved?'rgba(0,184,148,0.04)':'#fff', border: isSaved?'1px solid rgba(0,184,148,0.3)':'1px solid #E8ECF0' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#1a1a2e' }}>{selectedDate.replace(/-/g,'.')}</div>
                    {isSaved
                      ? <div style={{ fontSize:11, color:'#00B894', marginTop:2 }}>???€?¥ë¨ Â· ì´?ë§¤ì¶œ {totalSales.toLocaleString()}??Â· {totalCount}ê±?/div>
                      : <div style={{ fontSize:11, color:'#bbb', marginTop:2 }}>ë¯¸ì‘??/div>}
                  </div>
                  <button onClick={() => setShowForm(p => !p)}
                    style={{ padding:'7px 14px', borderRadius:9, background: isSaved?'rgba(0,184,148,0.1)':'rgba(255,107,53,0.1)', border: isSaved?'1px solid rgba(0,184,148,0.3)':'1px solid rgba(255,107,53,0.3)', color: isSaved?'#00B894':'#FF6B35', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                    {showForm ? '???‘ê¸°' : isSaved ? '?“‚ ?´ê¸°' : '?ï¸ ?‘ì„±'}
                  </button>
                </div>
              </div>
            </div>
            {/* ?°ì¸¡: ??*/}
            <div>
              {showForm && formContent}
            </div>
          </div>
        </div>
      ) : (
        /* ëª¨ë°”???ˆì´?„ì›ƒ */
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <span style={{ fontSize:17, fontWeight:700, color:'#1a1a2e' }}>?“‹ ë§ˆê°?¼ì?</span>
            {isOwner && unreadEditCount > 0 && (
              <button onClick={() => { setShowEditLogs(true); if(closingRef.current) loadEditLogs(closingRef.current.id); localStorage.setItem(`mj_edit_log_seen_${storeId}`, new Date().toISOString()); setUnreadEditCount(0); setUnreadLogCount(0) }}
                style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 10px', borderRadius:9, background:'rgba(232,67,147,0.1)', border:'1px solid rgba(232,67,147,0.3)', color:'#E84393', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                ?”” <span style={{ background:'#E84393', color:'#fff', borderRadius:8, padding:'1px 6px', fontSize:10 }}>{unreadEditCount}</span>
              </button>
            )}
          </div>
          <ClosingCalendar year={calYear} month={calMonth} salesMap={salesMap} weatherMap={weatherMap} selectedDate={selectedDate}
            onSelectDate={handleSelectDate} onChangeMonth={(y,m) => { setCalYear(y); setCalMonth(m) }} />
          <div style={{ ...bx, padding:'12px 16px', background: isSaved?'rgba(0,184,148,0.04)':'#fff', border: isSaved?'1px solid rgba(0,184,148,0.3)':'1px solid #E8ECF0' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:14, fontWeight:700, color:'#1a1a2e' }}>{selectedDate.replace(/-/g,'.')}</div>
                {isSaved
                  ? <div style={{ fontSize:11, color:'#00B894', marginTop:2 }}>???€?¥ë¨ Â· ì´?ë§¤ì¶œ {totalSales.toLocaleString()}??Â· {totalCount}ê±?/div>
                  : <div style={{ fontSize:11, color:'#bbb', marginTop:2 }}>ë¯¸ì‘??/div>}
              </div>
              <button onClick={() => setShowForm(p => !p)}
                style={{ padding:'7px 14px', borderRadius:9, background: isSaved?'rgba(0,184,148,0.1)':'rgba(255,107,53,0.1)', border: isSaved?'1px solid rgba(0,184,148,0.3)':'1px solid rgba(255,107,53,0.3)', color: isSaved?'#00B894':'#FF6B35', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                {showForm ? '???‘ê¸°' : isSaved ? '?“‚ ?´ê¸°' : '?ï¸ ?‘ì„±'}
              </button>
            </div>
          </div>
          {showForm && formContent}
        </div>
      )}
    </div>
  )
}
