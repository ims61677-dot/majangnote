'use client'
import { useEffect, useState, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const DOW = ['일','월','화','수','목','금','토']
const COLORS = ['#FF6B35','#6C5CE7','#00B894','#E84393','#2DC6D6','#FDC400','#A29BFE']
const bx = { background:'#fff', borderRadius:16, border:'1px solid #E8ECF0', padding:20, marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }

function fmtW(n: number) {
  if (n >= 100000000) return (n/100000000).toFixed(1).replace(/\.0$/,'')+'억'
  if (n >= 10000) return (n/10000).toFixed(1).replace(/\.0$/,'')+'만'
  return n.toLocaleString()+'원'
}
function fmtWFull(n: number) { return n.toLocaleString()+'원' }
function pad(n: number) { return String(n).padStart(2,'0') }

function weatherIcon(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 2) return '🌤️'
  if (code <= 3) return '☁️'
  if (code <= 49) return '🌫️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 82) return '🌧️'
  if (code <= 86) return '🌨️'
  if (code <= 99) return '⛈️'
  return '🌡️'
}

function MonthNav({ year, month, onChange }: { year:number; month:number; onChange:(y:number,m:number)=>void }) {
  function go(delta: number) {
    let m = month + delta, y = year
    while (m < 0) { y--; m += 12 }
    while (m > 11) { y++; m -= 12 }
    onChange(y, m)
  }
  const now = new Date()
  const isCurrent = year === now.getFullYear() && month === now.getMonth()
  const months = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
  const years = Array.from({length:6}, (_,i) => now.getFullYear()-2+i)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
        <button onClick={() => go(-3)} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #E8ECF0', background:'#F8F9FB', cursor:'pointer', fontSize:12, color:'#888', fontWeight:700 }}>«3</button>
        <button onClick={() => go(-1)} style={{ width:32, height:32, borderRadius:8, border:'1px solid #E8ECF0', background:'#fff', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', color:'#555' }}>‹</button>
        <span style={{ fontSize:17, fontWeight:800, color:'#1a1a2e', minWidth:100, textAlign:'center' }}>{year}년 {month+1}월</span>
        <button onClick={() => go(1)} style={{ width:32, height:32, borderRadius:8, border:'1px solid #E8ECF0', background:'#fff', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', color:'#555' }}>›</button>
        <button onClick={() => go(3)} style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #E8ECF0', background:'#F8F9FB', cursor:'pointer', fontSize:12, color:'#888', fontWeight:700 }}>3»</button>
        {!isCurrent && <button onClick={() => onChange(now.getFullYear(), now.getMonth())} style={{ padding:'5px 12px', borderRadius:8, border:'1px solid rgba(255,107,53,0.4)', background:'rgba(255,107,53,0.08)', cursor:'pointer', fontSize:12, color:'#FF6B35', fontWeight:700 }}>이번달</button>}
      </div>
      <div style={{ display:'flex', gap:4, flexWrap:'wrap', alignItems:'center' }}>
        {years.map(y => (
          <button key={y} onClick={() => onChange(y, month)}
            style={{ padding:'4px 10px', borderRadius:8, border:'none',
              background:y===year?'linear-gradient(135deg,#FF6B35,#E84393)':'#F0F2F5',
              color:y===year?'#fff':'#888', fontSize:11, fontWeight:700, cursor:'pointer' }}>{y}</button>
        ))}
      </div>
      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
        {months.map((ml,mi) => (
          <button key={mi} onClick={() => onChange(year, mi)}
            style={{ padding:'4px 8px', borderRadius:8, border:'none',
              background:mi===month?'linear-gradient(135deg,#FF6B35,#E84393)':'#F0F2F5',
              color:mi===month?'#fff':'#888', fontSize:11, fontWeight:600, cursor:'pointer' }}>{ml}</button>
        ))}
      </div>
    </div>
  )
}

function LineChart({ data, goal, color='#FF6B35', height=160, prevData }: {
  data:{x:number;y:number;label:string}[]
  prevData?:{x:number;y:number}[]
  goal?:number; color?:string; height?:number
}) {
  if (!data.length) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color:'#ccc', fontSize:12 }}>데이터 없음</div>
  const allY = [...data.map(d=>d.y), ...(prevData||[]).map(d=>d.y), goal||0]
  const maxY = Math.max(...allY) * 1.12 || 1
  const chartH = height - 22
  function toY(v:number) { return ((maxY-v)/maxY)*chartH }
  function toX(i:number, total:number) { return total<=1?50:(i/(total-1))*100 }
  return (
    <div style={{ position:'relative', height }}>
      <svg width="100%" height={chartH} style={{ overflow:'visible' }}>
        <defs>
          <linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {goal && goal > 0 && <line x1="0%" y1={toY(goal)} x2="100%" y2={toY(goal)} stroke="#6C5CE7" strokeWidth="1.5" strokeDasharray="5,4" />}
        {prevData && prevData.length > 1 && <polyline points={prevData.map((d,i)=>`${toX(i,prevData!.length)}%,${toY(d.y)}`).join(' ')} fill="none" stroke="#6C5CE7" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.5" />}
        {data.length > 1 && <polygon points={[...data.map((d,i)=>`${toX(i,data.length)}%,${toY(d.y)}`),`${toX(data.length-1,data.length)}%,${chartH}`,`0%,${chartH}`].join(' ')} fill="url(#lg1)" />}
        <polyline points={data.map((d,i)=>`${toX(i,data.length)}%,${toY(d.y)}`).join(' ')} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d,i) => <circle key={i} cx={`${toX(i,data.length)}%`} cy={toY(d.y)} r={3.5} fill="#fff" stroke={color} strokeWidth="2" />)}
      </svg>
      <div style={{ position:'absolute', bottom:0, left:0, right:0, display:'flex' }}>
        {data.map((d,i) => <div key={i} style={{ flex:1, textAlign:'center', fontSize:9, color:'#bbb' }}>{d.label}</div>)}
      </div>
    </div>
  )
}

function BarChart({ data, height=120 }: { data:{label:string;value:number;color?:string}[]; height?:number }) {
  const maxV = Math.max(...data.map(d=>d.value), 1)
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:4, height, paddingBottom:20 }}>
      {data.map((d,i) => {
        const h = maxV > 0 ? Math.max(Math.round((d.value/maxV)*(height-20)), d.value>0?4:0) : 0
        const isMax = d.value === maxV && d.value > 0
        return (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', height:'100%' }}>
            {d.value > 0 && <div style={{ fontSize:8, color:isMax?(d.color||COLORS[0]):'#bbb', marginBottom:2, fontWeight:isMax?700:400 }}>{fmtW(d.value)}</div>}
            <div style={{ width:'100%', height:h, borderRadius:'4px 4px 0 0', background:isMax?(d.color||COLORS[0]):`${d.color||COLORS[0]}66` }} />
            <div style={{ fontSize:10, color:isMax?'#555':'#aaa', marginTop:3, fontWeight:isMax?700:400 }}>{d.label}</div>
          </div>
        )
      })}
    </div>
  )
}

function PieChart({ data, size=130 }: { data:{label:string;value:number;color:string}[]; size?:number }) {
  const total = data.reduce((s,d)=>s+d.value,0)
  if (!total) return <div style={{ width:size, height:size, borderRadius:'50%', background:'#F4F6F9', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#ccc' }}>없음</div>
  const r = size/2-6, cx = size/2, cy = size/2
  let cumAngle = -90
  function toXY(angle:number) { const rad = angle*Math.PI/180; return { x: cx+r*Math.cos(rad), y: cy+r*Math.sin(rad) } }
  return (
    <svg width={size} height={size}>
      {data.filter(d=>d.value>0).map((d,i) => {
        const angle = (d.value/total)*360
        const start = toXY(cumAngle); cumAngle += angle; const end = toXY(cumAngle)
        const large = angle > 180 ? 1 : 0
        return <path key={i} d={`M${cx},${cy} L${start.x},${start.y} A${r},${r} 0 ${large},1 ${end.x},${end.y} Z`} fill={d.color} stroke="#fff" strokeWidth="2.5" />
      })}
      <circle cx={cx} cy={cy} r={r*0.52} fill="#fff" />
      <text x={cx} y={cy-5} textAnchor="middle" fontSize="10" fill="#aaa">{data.filter(d=>d.value>0).length}개</text>
      <text x={cx} y={cy+9} textAnchor="middle" fontSize="9" fill="#bbb">플랫폼</text>
    </svg>
  )
}

// ── 진행률 바 ──
function ProgressBar({ value, max, color='#FF6B35', height=10 }: { value:number; max:number; color?:string; height?:number }) {
  const pct = max > 0 ? Math.min(Math.round((value/max)*100), 100) : 0
  return (
    <div style={{ height, borderRadius:height/2, background:'#F0F2F5', overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:height/2, transition:'width 0.6s ease' }} />
    </div>
  )
}

// ── 인사이트 카드 ──
function InsightCard({ icon, title, desc, color, action }: { icon:string; title:string; desc:string; color:string; action?:string }) {
  return (
    <div style={{ borderRadius:14, border:`1px solid ${color}33`, background:`${color}08`, padding:'14px 16px', marginBottom:10 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
        <span style={{ fontSize:22, flexShrink:0 }}>{icon}</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:3 }}>{title}</div>
          <div style={{ fontSize:12, color:'#666', lineHeight:1.6 }}>{desc}</div>
          {action && <div style={{ marginTop:8, fontSize:11, fontWeight:700, color, padding:'4px 10px', background:`${color}15`, borderRadius:8, display:'inline-block' }}>→ {action}</div>}
        </div>
      </div>
    </div>
  )
}

export default function AnalyticsPage() {
  const supabase = createSupabaseBrowserClient()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [storeId, setStoreId] = useState('')
  const [isPC, setIsPC] = useState<boolean|null>(null)
  const [tab, setTab] = useState<'overview'|'action'|'sales'|'unit'|'dow'|'platform'|'review'|'place'|'compare'|'yearcmp'|'memo'>('overview')
  const [loading, setLoading] = useState(false)

  const [closings, setClosings] = useState<any[]>([])
  const [salesRows, setSalesRows] = useState<any[]>([])
  const [prevClosings, setPrevClosings] = useState<any[]>([])
  const [prevSalesRows, setPrevSalesRows] = useState<any[]>([])
  const [prevYearClosings, setPrevYearClosings] = useState<any[]>([])
  const [prevYearSalesRows, setPrevYearSalesRows] = useState<any[]>([])
  const [goal, setGoal] = useState<any>(null)
  const [reviewRows, setReviewRows] = useState<any[]>([])
  const [placeTrackers, setPlaceTrackers] = useState<any[]>([])
  const [placeHistory, setPlaceHistory] = useState<any[]>([])

  useEffect(() => {
    const check = () => setIsPC(window.innerWidth >= 768)
    check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    if (!store.id) return
    setStoreId(store.id)
  }, [])

  useEffect(() => { if (storeId) loadData(storeId, year, month) }, [storeId, year, month])

  async function loadData(sid:string, y:number, m:number) {
    setLoading(true)
    const moNum = m+1
    const from = `${y}-${pad(moNum)}-01`
    const to = `${y}-${pad(moNum)}-${pad(new Date(y,m+1,0).getDate())}`

    const { data: cls } = await supabase.from('closings').select('*').eq('store_id', sid).gte('closing_date', from).lte('closing_date', to)
    setClosings(cls || [])
    if (cls && cls.length > 0) {
      const { data: sv } = await supabase.from('closing_sales').select('*').in('closing_id', cls.map((c:any)=>c.id))
      setSalesRows(sv || [])
      const { data: rv } = await supabase.from('closing_reviews').select('*').in('closing_id', cls.map((c:any)=>c.id))
      setReviewRows(rv || [])
    } else { setSalesRows([]); setReviewRows([]) }

    // 전월
    let pm = m-1, py = y; if (pm < 0) { pm = 11; py-- }
    const pmNum = pm+1
    const { data: pCls } = await supabase.from('closings').select('*').eq('store_id', sid).gte('closing_date', `${py}-${pad(pmNum)}-01`).lte('closing_date', `${py}-${pad(pmNum)}-${pad(new Date(py,pm+1,0).getDate())}`)
    setPrevClosings(pCls || [])
    if (pCls && pCls.length > 0) {
      const { data: pSv } = await supabase.from('closing_sales').select('*').in('closing_id', pCls.map((c:any)=>c.id))
      setPrevSalesRows(pSv || [])
    } else setPrevSalesRows([])

    // 전년
    const pyYear = y-1
    const { data: pyCls } = await supabase.from('closings').select('*').eq('store_id', sid).gte('closing_date', `${pyYear}-${pad(moNum)}-01`).lte('closing_date', `${pyYear}-${pad(moNum)}-${pad(new Date(pyYear,m+1,0).getDate())}`)
    setPrevYearClosings(pyCls || [])
    if (pyCls && pyCls.length > 0) {
      const { data: pySv } = await supabase.from('closing_sales').select('*').in('closing_id', pyCls.map((c:any)=>c.id))
      setPrevYearSalesRows(pySv || [])
    } else setPrevYearSalesRows([])

    const { data: g } = await supabase.from('goals').select('*').eq('store_id', sid).eq('year', y).eq('month', moNum).maybeSingle()
    setGoal(g || null)

    // 플레이스 순위
    const { data: pt } = await supabase.from('place_rank_trackers').select('*').eq('store_id', sid)
    setPlaceTrackers(pt || [])
    if (pt && pt.length > 0) {
      const { data: ph } = await supabase.from('place_rank_history').select('*').in('tracker_id', pt.map((t:any)=>t.id)).gte('checked_date', from).lte('checked_date', to)
      setPlaceHistory(ph || [])
    } else setPlaceHistory([])

    setLoading(false)
  }

  // ── 계산 ──
  const daily = useMemo(() => closings.map(cl => {
    const sv = salesRows.filter(s=>s.closing_id===cl.id)
    const amount = sv.reduce((s,r)=>s+(r.amount||0),0)
    const count = sv.reduce((s,r)=>s+(r.count||0),0)
    const cancel = sv.reduce((s,r)=>s+(r.cancel_count||0),0)
    const day = parseInt(cl.closing_date.split('-')[2])
    const dow = new Date(cl.closing_date).getDay()
    const rv = reviewRows.filter(r=>r.closing_id===cl.id)
    const totalReviews = rv.reduce((s,r)=>s+(r.review_count||0),0)
    const totalReplies = rv.reduce((s,r)=>s+(r.reply_count||0),0)
    return { day, dow, date: cl.closing_date, amount, count, cancel,
      unitPrice: count>0?Math.round(amount/count):0,
      discount: cl.discount_amount||0, memo: cl.memo||'', note: cl.note||'',
      staffCount: cl.staff_count||0, openTime: cl.open_time||'', closeTime: cl.close_time||'',
      weatherCode: cl.weather_code, tempMax: cl.temp_max, tempMin: cl.temp_min,
      totalReviews, totalReplies }
  }).sort((a,b)=>a.day-b.day), [closings, salesRows, reviewRows])

  const prevDaily = useMemo(() => prevClosings.map(cl => {
    const sv = prevSalesRows.filter(s=>s.closing_id===cl.id)
    const amount = sv.reduce((s,r)=>s+(r.amount||0),0)
    const count = sv.reduce((s,r)=>s+(r.count||0),0)
    const day = parseInt(cl.closing_date.split('-')[2])
    return { day, amount, count, unitPrice:count>0?Math.round(amount/count):0 }
  }).sort((a,b)=>a.day-b.day), [prevClosings, prevSalesRows])

  const prevYearDaily = useMemo(() => prevYearClosings.map(cl => {
    const sv = prevYearSalesRows.filter(s=>s.closing_id===cl.id)
    const amount = sv.reduce((s,r)=>s+(r.amount||0),0)
    const count = sv.reduce((s,r)=>s+(r.count||0),0)
    const day = parseInt(cl.closing_date.split('-')[2])
    return { day, amount, count, unitPrice:count>0?Math.round(amount/count):0 }
  }).sort((a,b)=>a.day-b.day), [prevYearClosings, prevYearSalesRows])

  const totalSales = useMemo(()=>daily.reduce((s,d)=>s+d.amount,0),[daily])
  const totalCount = useMemo(()=>daily.reduce((s,d)=>s+d.count,0),[daily])
  const totalCancel = useMemo(()=>daily.reduce((s,d)=>s+d.cancel,0),[daily])
  const totalDiscount = useMemo(()=>daily.reduce((s,d)=>s+d.discount,0),[daily])
  const avgUnit = totalCount>0?Math.round(totalSales/totalCount):0
  const prevTotal = useMemo(()=>prevDaily.reduce((s,d)=>s+d.amount,0),[prevDaily])
  const prevYearTotal = useMemo(()=>prevYearDaily.reduce((s,d)=>s+d.amount,0),[prevYearDaily])
  const goalAmt = useMemo(() => {
    if (!goal?.weekly_goals) return 0
    const wg = goal.weekly_goals
    let total = 0
    const daysInMonth = new Date(year, month+1, 0).getDate()
    for (let w = 1; w <= 6; w++) {
      if (!wg[w]) continue
      let weekdays = 0, redDays = 0
      for (let d = 1; d <= daysInMonth; d++) {
        const dow = new Date(year, month, d).getDay()
        const firstDow = new Date(year, month, 1).getDay()
        const wn = Math.ceil((d + (firstDow === 0 ? 6 : firstDow - 1)) / 7)
        if (wn !== w) continue
        if (dow === 0 || dow === 6) redDays++; else weekdays++
      }
      total += (wg[w].weekday||0) * weekdays + (wg[w].weekend||0) * redDays
    }
    return total
  }, [goal, year, month])
  const goalPct = goalAmt > 0 ? Math.min(Math.round((totalSales/goalAmt)*100),100) : 0

  const platforms = useMemo(()=>{
    const map: Record<string,{amount:number;count:number;cancel:number}> = {}
    salesRows.forEach(r=>{ if(!map[r.platform]) map[r.platform]={amount:0,count:0,cancel:0}; map[r.platform].amount+=r.amount||0; map[r.platform].count+=r.count||0; map[r.platform].cancel+=r.cancel_count||0 })
    return Object.entries(map).map(([name,v],i)=>({name,...v,color:COLORS[i%COLORS.length]})).sort((a,b)=>b.amount-a.amount)
  },[salesRows])

  const reviewPlatforms = useMemo(()=>{
    const map: Record<string,{reviews:number;replies:number;amounts:number[]}> = {}
    reviewRows.forEach(r=>{
      if(!map[r.platform]) map[r.platform]={reviews:0,replies:0,amounts:[]}
      map[r.platform].reviews+=r.review_count||0
      map[r.platform].replies+=r.reply_count||0
    })
    // 날짜별 매출과 연결
    daily.forEach(d=>{
      const rv = reviewRows.filter(r=>{ const cl = closings.find(c=>c.id===r.closing_id); return cl?.closing_date===d.date })
      rv.forEach(r=>{ if(map[r.platform] && d.amount>0) map[r.platform].amounts.push(d.amount) })
    })
    return Object.entries(map).map(([name,v],i)=>({
      name, ...v,
      replyRate: v.reviews>0?Math.round((v.replies/v.reviews)*100):0,
      avgSalesPerReview: v.reviews>0?Math.round(v.amounts.reduce((s,a)=>s+a,0)/Math.max(v.amounts.length,1)):0,
      color: COLORS[i%COLORS.length]
    })).sort((a,b)=>b.reviews-a.reviews)
  },[reviewRows,daily,closings])

  const hallAmt = useMemo(()=>platforms.filter(p=>!['배달의민족','쿠팡이츠','요기요'].includes(p.name)).reduce((s,p)=>s+p.amount,0),[platforms])
  const delivAmt = useMemo(()=>platforms.filter(p=>['배달의민족','쿠팡이츠','요기요'].includes(p.name)).reduce((s,p)=>s+p.amount,0),[platforms])

  const dowStats = useMemo(()=>{
    const map: Record<number,number[]> = {0:[],1:[],2:[],3:[],4:[],5:[],6:[]}
    daily.forEach(d=>map[d.dow].push(d.amount))
    return [1,2,3,4,5,6,0].map(d=>({ label:DOW[d], value:map[d].length?Math.round(map[d].reduce((a,b)=>a+b,0)/map[d].length):0, count:map[d].length, color:d===0||d===6?'#6C5CE7':'#FF6B35' }))
  },[daily])

  const prevMonthLabel = useMemo(()=>{ let pm=month-1,py=year; if(pm<0){pm=11;py--}; return `${py}년 ${pm+1}월` },[year,month])

  // ── 플레이스 순위 × 매출 ──
  const placeCorrelation = useMemo(()=>{
    return placeTrackers.map(t=>{
      const hist = placeHistory.filter(h=>h.tracker_id===t.id)
      return hist.map(h=>{
        const d = daily.find(d=>d.date===h.checked_date)
        return { date: h.checked_date, rank: h.rank, sales: d?.amount||0, day: d?.day }
      }).filter(h=>h.sales>0)
    }).flat()
  },[placeTrackers, placeHistory, daily])

  // ── 자동 인사이트 생성 ──
  const insights = useMemo(()=>{
    const list: {icon:string;title:string;desc:string;color:string;action?:string;priority:number}[] = []
    if (daily.length === 0) return list

    // 매출 성장률
    if (prevTotal > 0) {
      const growthRate = Math.round(((totalSales-prevTotal)/prevTotal)*100)
      if (growthRate >= 10) list.push({ icon:'🚀', title:`전월 대비 +${growthRate}% 성장!`, desc:`지난달보다 ${fmtW(totalSales-prevTotal)} 더 벌었어요. 어떤 요인이 좋았는지 분석해서 유지하세요.`, color:'#00B894', action:'잘된 요인 파악하기', priority:1 })
      else if (growthRate <= -10) list.push({ icon:'📉', title:`전월 대비 ${growthRate}% 감소`, desc:`지난달보다 ${fmtW(Math.abs(totalSales-prevTotal))} 감소했어요. 요일별/플랫폼별 원인을 파악하세요.`, color:'#E84393', action:'원인 분석 필요', priority:1 })
    }

    // 목표 달성률
    if (goalAmt > 0) {
      if (goalPct >= 100) list.push({ icon:'🏆', title:'월 목표 달성!', desc:`목표 ${fmtW(goalAmt)} 달성! 현재 ${fmtW(totalSales)}으로 ${goalPct}% 달성했어요.`, color:'#FDC400', priority:1 })
      else {
        const daysLeft = new Date(year, month+1, 0).getDate() - daily[daily.length-1]?.day || 0
        const needed = goalAmt - totalSales
        list.push({ icon:'🎯', title:`목표까지 ${fmtW(needed)} 남았어요`, desc:`현재 달성률 ${goalPct}%. 남은 기간 하루 평균 ${daysLeft>0?fmtW(Math.round(needed/daysLeft)):'—'} 이상 필요해요.`, color:'#6C5CE7', action:'매출 목표 전략 수립', priority:2 })
      }
    }

    // 객단가
    if (avgUnit > 0 && avgUnit < 12000) list.push({ icon:'💡', title:`객단가 ${fmtW(avgUnit)} — 개선 여지 있어요`, desc:'객단가가 낮아요. 세트메뉴 구성, 추가 판매(사이드/음료), 가격 재검토를 고려해보세요.', color:'#FF6B35', action:'메뉴 구성 개선', priority:2 })
    else if (avgUnit >= 18000) list.push({ icon:'✅', title:`객단가 ${fmtW(avgUnit)} — 양호해요`, desc:'객단가가 높은 편이에요. 이 수준을 유지하면서 건수를 늘리는 전략이 효과적이에요.', color:'#00B894', priority:3 })

    // 취소율
    if (totalCancel > 0 && totalCount > 0) {
      const cancelRate = Math.round((totalCancel/(totalCount+totalCancel))*100)
      if (cancelRate >= 5) list.push({ icon:'🚨', title:`취소율 ${cancelRate}% — 주의 필요`, desc:`총 ${totalCancel}건 취소/환불. 취소 원인을 파악하고 주방 운영, 배달 품질을 점검하세요.`, color:'#E84393', action:'취소 원인 파악', priority:1 })
    }

    // 요일별 패턴
    const sortedDow = [...dowStats].filter(d=>d.value>0).sort((a,b)=>b.value-a.value)
    if (sortedDow.length >= 2) {
      const best = sortedDow[0], worst = sortedDow[sortedDow.length-1]
      list.push({ icon:'📆', title:`${best.label}요일이 가장 잘 돼요`, desc:`${best.label}요일 평균 ${fmtW(best.value)} vs ${worst.label}요일 ${fmtW(worst.value)}. ${worst.label}요일에 프로모션을 집중하면 매출 평탄화가 가능해요.`, color:'#2DC6D6', action:`${worst.label}요일 프로모션 기획`, priority:2 })
    }

    // 배달 vs 홀 비율
    if (delivAmt > 0 && hallAmt > 0) {
      const delivRatio = Math.round((delivAmt/(delivAmt+hallAmt))*100)
      if (delivRatio > 60) list.push({ icon:'🛵', title:`배달 비중 ${delivRatio}% — 수수료 점검 필요`, desc:'배달 비중이 높아 수수료 부담이 클 수 있어요. 홀 매출을 늘리거나 배달앱 수수료 협상을 검토하세요.', color:'#6C5CE7', action:'수수료 구조 점검', priority:2 })
      else if (delivRatio < 20) list.push({ icon:'🏠', title:`홀 비중 ${100-delivRatio}% — 배달 채널 확대 기회`, desc:'배달 비중이 낮아요. 배달앱 프로모션을 활용하면 매출 채널을 다각화할 수 있어요.', color:'#FF6B35', action:'배달앱 프로모션 검토', priority:3 })
    }

    // 날씨 분석
    const rainyDays = daily.filter(d=>d.weatherCode !== null && d.weatherCode !== undefined && d.weatherCode >= 51)
    const sunnyDays = daily.filter(d=>d.weatherCode !== null && d.weatherCode !== undefined && d.weatherCode < 3)
    if (rainyDays.length >= 2 && sunnyDays.length >= 2) {
      const rainyAvg = Math.round(rainyDays.reduce((s,d)=>s+d.amount,0)/rainyDays.length)
      const sunnyAvg = Math.round(sunnyDays.reduce((s,d)=>s+d.amount,0)/sunnyDays.length)
      if (Math.abs(rainyAvg-sunnyAvg) > sunnyAvg*0.15) {
        if (rainyAvg > sunnyAvg) list.push({ icon:'🌧️', title:'비 오는 날 매출이 더 높아요', desc:`맑은 날 평균 ${fmtW(sunnyAvg)} vs 비 오는 날 ${fmtW(rainyAvg)}. 우천 시 배달 수요가 증가하는 매장이에요.`, color:'#2DC6D6', priority:3 })
        else list.push({ icon:'☀️', title:'맑은 날 매출이 더 높아요', desc:`맑은 날 평균 ${fmtW(sunnyAvg)} vs 비 오는 날 ${fmtW(rainyAvg)}. 날씨 좋은 날 적극적인 홀 마케팅이 효과적이에요.`, color:'#FDC400', priority:3 })
      }
    }

    // 리뷰 답글률
    const totalReviewsMonth = daily.reduce((s,d)=>s+d.totalReviews,0)
    const totalRepliesMonth = daily.reduce((s,d)=>s+d.totalReplies,0)
    if (totalReviewsMonth > 0) {
      const replyRate = Math.round((totalRepliesMonth/totalReviewsMonth)*100)
      if (replyRate < 50) list.push({ icon:'⭐', title:`리뷰 답글률 ${replyRate}% — 개선 필요`, desc:`${totalReviewsMonth}개 리뷰 중 ${totalRepliesMonth}개만 답글. 답글률이 낮으면 신규 고객 유입에 불리해요.`, color:'#E84393', action:'리뷰 답글 관리 강화', priority:2 })
    }

    return list.sort((a,b)=>a.priority-b.priority)
  },[daily, totalSales, totalCount, totalCancel, totalDiscount, avgUnit, prevTotal, goalAmt, goalPct, dowStats, delivAmt, hallAmt])

  const memoData = useMemo(()=>daily.filter(d=>d.memo||d.note),[daily])

  if (isPC === null) return <div style={{ minHeight:'100vh', background:'#F4F6F9' }} />

  const TAB_LIST = [
    {id:'overview', label:'🏠 종합'},
    {id:'action', label:'⚡ 액션'},
    {id:'sales', label:'📈 일별 매출'},
    {id:'unit', label:'💡 객단가'},
    {id:'dow', label:'📆 요일'},
    {id:'platform', label:'🥧 플랫폼'},
    {id:'review', label:'⭐ 리뷰'},
    {id:'place', label:'📍 순위'},
    {id:'compare', label:'🔄 전월'},
    {id:'yearcmp', label:'📅 전년'},
    {id:'memo', label:'📌 메모'},
  ]

  // ── 종합 탭 ──
  const overviewContent = (
    <div>
      {/* 핵심 KPI */}
      <div style={{ ...bx, background:'linear-gradient(135deg, rgba(255,107,53,0.06), rgba(232,67,147,0.04))' }}>
        <div style={{ fontSize:14, fontWeight:800, color:'#1a1a2e', marginBottom:16 }}>📊 {year}년 {month+1}월 핵심 지표</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:12, marginBottom:16 }}>
          <div style={{ background:'#fff', borderRadius:14, padding:'16px', border:'1px solid rgba(255,107,53,0.2)' }}>
            <div style={{ fontSize:10, color:'#aaa', marginBottom:4 }}>총 매출</div>
            <div style={{ fontSize:24, fontWeight:900, color:'#FF6B35' }}>{fmtW(totalSales)}</div>
            {prevTotal > 0 && <div style={{ fontSize:11, marginTop:4, color:totalSales>=prevTotal?'#00B894':'#E84393', fontWeight:700 }}>{totalSales>=prevTotal?'▲':'▼'} {Math.abs(Math.round(((totalSales-prevTotal)/prevTotal)*100))}% 전월비</div>}
          </div>
          <div style={{ background:'#fff', borderRadius:14, padding:'16px', border:'1px solid rgba(108,92,231,0.2)' }}>
            <div style={{ fontSize:10, color:'#aaa', marginBottom:4 }}>종합 객단가</div>
            <div style={{ fontSize:24, fontWeight:900, color:'#6C5CE7' }}>{fmtW(avgUnit)}</div>
            <div style={{ fontSize:11, marginTop:4, color:'#aaa' }}>총 {totalCount}건</div>
            {platforms.filter(p=>p.count>0).length>0 && (
              <div style={{ marginTop:8, borderTop:'1px solid #F4F6F9', paddingTop:8 }}>
                {platforms.filter(p=>p.count>0).map(p => (
                  <div key={p.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                      <div style={{ width:6, height:6, borderRadius:2, background:p.color, flexShrink:0 }} />
                      <span style={{ fontSize:10, color:'#888' }}>{p.name}</span>
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, color:p.color }}>{fmtW(Math.round(p.amount/p.count))}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:isPC?'repeat(4,1fr)':'repeat(2,1fr)', gap:8 }}>
          {[
            { label:'영업일', value:`${daily.length}일`, color:'#555' },
            { label:'취소/환불', value:`${totalCancel}건`, color:'#E84393' },
            { label:'할인금액', value:fmtW(totalDiscount), color:'#FDC400' },
            { label:'일평균', value:fmtW(daily.length>0?Math.round(totalSales/daily.length):0), color:'#2DC6D6' },
          ].map(s => (
            <div key={s.label} style={{ background:'#fff', borderRadius:12, padding:'12px 14px', border:'1px solid #E8ECF0' }}>
              <div style={{ fontSize:10, color:'#aaa', marginBottom:3 }}>{s.label}</div>
              <div style={{ fontSize:16, fontWeight:800, color:s.color }}>{loading?'…':s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 목표 달성률 */}
      {goalAmt > 0 && (
        <div style={bx}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>🎯 월 목표 달성률</span>
            <span style={{ fontSize:16, fontWeight:900, color: goalPct>=100?'#00B894':'#FF6B35' }}>{goalPct}%</span>
          </div>
          <ProgressBar value={totalSales} max={goalAmt} color={goalPct>=100?'#00B894':'#FF6B35'} height={14} />
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:11, color:'#aaa' }}>
            <span>현재 {fmtW(totalSales)}</span>
            <span>목표 {fmtW(goalAmt)}</span>
          </div>
          {goalPct < 100 && <div style={{ marginTop:8, fontSize:11, color:'#6C5CE7', background:'rgba(108,92,231,0.07)', borderRadius:8, padding:'6px 10px' }}>
            남은 금액 {fmtW(goalAmt-totalSales)} · 하루 {daily.length>0?fmtW(Math.round((goalAmt-totalSales)/Math.max(new Date(year,month+1,0).getDate()-daily[daily.length-1]?.day,1))):'-'} 필요
          </div>}
        </div>
      )}

      {/* 전월/전년 대비 */}
      {(prevTotal > 0 || prevYearTotal > 0) && (
        <div style={bx}>
          <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:12 }}>📊 성과 비교</div>
          <div style={{ display:'grid', gridTemplateColumns:prevTotal>0&&prevYearTotal>0?'1fr 1fr':'1fr', gap:10 }}>
            {prevTotal > 0 && (
              <div style={{ borderRadius:12, padding:'14px', background:totalSales>=prevTotal?'rgba(0,184,148,0.07)':'rgba(232,67,147,0.07)', border:`1px solid ${totalSales>=prevTotal?'rgba(0,184,148,0.25)':'rgba(232,67,147,0.25)'}` }}>
                <div style={{ fontSize:10, color:'#aaa', marginBottom:4 }}>전월 대비</div>
                <div style={{ fontSize:22, fontWeight:900, color:totalSales>=prevTotal?'#00B894':'#E84393' }}>
                  {totalSales>=prevTotal?'▲':'▼'} {Math.abs(Math.round(((totalSales-prevTotal)/prevTotal)*100))}%
                </div>
                <div style={{ fontSize:11, color:'#aaa', marginTop:4 }}>{prevMonthLabel} {fmtW(prevTotal)}</div>
              </div>
            )}
            {prevYearTotal > 0 && (
              <div style={{ borderRadius:12, padding:'14px', background:totalSales>=prevYearTotal?'rgba(0,184,148,0.07)':'rgba(232,67,147,0.07)', border:`1px solid ${totalSales>=prevYearTotal?'rgba(0,184,148,0.25)':'rgba(232,67,147,0.25)'}` }}>
                <div style={{ fontSize:10, color:'#aaa', marginBottom:4 }}>전년 동월 대비 (YoY)</div>
                <div style={{ fontSize:22, fontWeight:900, color:totalSales>=prevYearTotal?'#00B894':'#E84393' }}>
                  {totalSales>=prevYearTotal?'+':''}{Math.round(((totalSales-prevYearTotal)/prevYearTotal)*100)}%
                </div>
                <div style={{ fontSize:11, color:'#aaa', marginTop:4 }}>{year-1}년 {month+1}월 {fmtW(prevYearTotal)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 매출 흐름 미니차트 */}
      {daily.length > 0 && (
        <div style={bx}>
          <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:10 }}>📈 매출 흐름</div>
          <LineChart data={daily.map(d=>({x:d.day,y:d.amount,label:String(d.day)}))} prevData={prevDaily.map(d=>({x:d.day,y:d.amount}))} color="#FF6B35" height={isPC?180:140} />
        </div>
      )}

      {/* 플랫폼 요약 */}
      {platforms.length > 0 && (
        <div style={bx}>
          <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:12 }}>🥧 플랫폼 요약</div>
          <div style={{ display:'flex', gap:20, alignItems:'center' }}>
            <PieChart data={platforms.map(p=>({label:p.name,value:p.amount,color:p.color}))} size={100} />
            <div style={{ flex:1 }}>
              {platforms.slice(0,4).map(p => (
                <div key={p.name} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                  <div style={{ width:8, height:8, borderRadius:2, background:p.color, flexShrink:0 }} />
                  <span style={{ fontSize:12, color:'#555', flex:1 }}>{p.name}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:'#1a1a2e' }}>{fmtW(p.amount)}</span>
                  <span style={{ fontSize:10, color:'#aaa', width:30, textAlign:'right' }}>{totalSales>0?Math.round((p.amount/totalSales)*100):0}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 리뷰 × 매출 분석 */}
      {(()=>{
        const totalReviewsMonth = daily.reduce((s,d)=>s+d.totalReviews,0)
        const totalRepliesMonth = daily.reduce((s,d)=>s+d.totalReplies,0)
        if(totalReviewsMonth===0) return null
        const reviewDays = daily.filter(d=>d.totalReviews>0)
        const noReviewDays = daily.filter(d=>d.totalReviews===0&&d.amount>0)
        const replyRate = Math.round((totalRepliesMonth/totalReviewsMonth)*100)
        const reviewDayAvg = reviewDays.length>0?Math.round(reviewDays.reduce((s,d)=>s+d.amount,0)/reviewDays.length):0
        const noReviewDayAvg = noReviewDays.length>0?Math.round(noReviewDays.reduce((s,d)=>s+d.amount,0)/noReviewDays.length):0
        return (
          <div style={bx}>
            <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:12 }}>⭐ 리뷰 × 매출 분석</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:12 }}>
              {[
                {label:'이달 리뷰 수',value:`${totalReviewsMonth}건`,color:'#FF6B35'},
                {label:'답글 수',value:`${totalRepliesMonth}건`,color:'#00B894'},
                {label:'답글률',value:`${replyRate}%`,color:replyRate>=80?'#00B894':replyRate>=50?'#FDC400':'#E84393'},
              ].map(s=>(
                <div key={s.label} style={{ background:'#F8F9FB', borderRadius:10, padding:'10px 12px', border:'1px solid #E8ECF0' }}>
                  <div style={{ fontSize:9, color:'#aaa', marginBottom:3 }}>{s.label}</div>
                  <div style={{ fontSize:16, fontWeight:800, color:s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            {reviewDayAvg>0&&noReviewDayAvg>0&&(
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                <div style={{ background:'rgba(0,184,148,0.07)', borderRadius:10, padding:'10px 14px', border:'1px solid rgba(0,184,148,0.2)' }}>
                  <div style={{ fontSize:9, color:'#aaa', marginBottom:2 }}>리뷰 있는 날 평균</div>
                  <div style={{ fontSize:15, fontWeight:800, color:'#00B894' }}>{fmtW(reviewDayAvg)}</div>
                </div>
                <div style={{ background:'rgba(232,67,147,0.06)', borderRadius:10, padding:'10px 14px', border:'1px solid rgba(232,67,147,0.15)' }}>
                  <div style={{ fontSize:9, color:'#aaa', marginBottom:2 }}>리뷰 없는 날 평균</div>
                  <div style={{ fontSize:15, fontWeight:800, color:'#E84393' }}>{fmtW(noReviewDayAvg)}</div>
                </div>
              </div>
            )}
            {replyRate<80&&(
              <div style={{ fontSize:11, color:'#E84393', background:'rgba(232,67,147,0.06)', borderRadius:8, padding:'7px 10px' }}>
                ⚠️ 미답글 {Math.max(totalReviewsMonth-totalRepliesMonth,0)}건 — 답글률을 높이면 재방문율이 올라가요
              </div>
            )}
          </div>
        )
      })()}

      {/* 메모/컴플레인 × 매출 분석 */}
      {(()=>{
        const memoDays = daily.filter(d=>d.memo)
        const noteDays = daily.filter(d=>d.note)
        if(memoDays.length===0&&noteDays.length===0) return null
        const normalDays = daily.filter(d=>!d.memo&&!d.note&&d.amount>0)
        const memoAvg = memoDays.length>0?Math.round(memoDays.reduce((s,d)=>s+d.amount,0)/memoDays.length):0
        const noteAvg = noteDays.length>0?Math.round(noteDays.reduce((s,d)=>s+d.amount,0)/noteDays.length):0
        const normalAvg = normalDays.length>0?Math.round(normalDays.reduce((s,d)=>s+d.amount,0)/normalDays.length):0
        const colCount = [normalAvg>0, memoAvg>0, noteAvg>0].filter(Boolean).length
        return (
          <div style={bx}>
            <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:4 }}>📌 메모/컴플레인 × 매출 영향</div>
            <div style={{ fontSize:11, color:'#aaa', marginBottom:12 }}>특이사항이 있는 날과 없는 날의 매출을 비교해요</div>
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${colCount},1fr)`, gap:8, marginBottom:12 }}>
              {normalAvg>0&&<div style={{ background:'#F8F9FB', borderRadius:10, padding:'10px 12px', border:'1px solid #E8ECF0' }}>
                <div style={{ fontSize:9, color:'#aaa', marginBottom:2 }}>평상시 ({normalDays.length}일)</div>
                <div style={{ fontSize:14, fontWeight:800, color:'#555' }}>{fmtW(normalAvg)}</div>
              </div>}
              {memoAvg>0&&<div style={{ background:'rgba(255,107,53,0.07)', borderRadius:10, padding:'10px 12px', border:'1px solid rgba(255,107,53,0.2)' }}>
                <div style={{ fontSize:9, color:'#aaa', marginBottom:2 }}>특이사항 ({memoDays.length}일)</div>
                <div style={{ fontSize:14, fontWeight:800, color:'#FF6B35' }}>{fmtW(memoAvg)}</div>
                {normalAvg>0&&<div style={{ fontSize:9, color:memoAvg>=normalAvg?'#00B894':'#E84393', marginTop:2 }}>{memoAvg>=normalAvg?'▲':'▼'} {Math.abs(Math.round(((memoAvg-normalAvg)/normalAvg)*100))}%</div>}
              </div>}
              {noteAvg>0&&<div style={{ background:'rgba(232,67,147,0.06)', borderRadius:10, padding:'10px 12px', border:'1px solid rgba(232,67,147,0.15)' }}>
                <div style={{ fontSize:9, color:'#aaa', marginBottom:2 }}>컴플레인 ({noteDays.length}일)</div>
                <div style={{ fontSize:14, fontWeight:800, color:'#E84393' }}>{fmtW(noteAvg)}</div>
                {normalAvg>0&&<div style={{ fontSize:9, color:noteAvg>=normalAvg?'#00B894':'#E84393', marginTop:2 }}>{noteAvg>=normalAvg?'▲':'▼'} {Math.abs(Math.round(((noteAvg-normalAvg)/normalAvg)*100))}%</div>}
              </div>}
            </div>
            {noteDays.length>0&&<div style={{ fontSize:11, color:'#E84393', background:'rgba(232,67,147,0.06)', borderRadius:8, padding:'7px 10px' }}>
              📝 이달 컴플레인 {noteDays.length}건 — 메모탭에서 내용을 확인하세요
            </div>}
          </div>
        )
      })()}

      {/* 인사이트 미리보기 */}
      {insights.length > 0 && (
        <div style={bx}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>⚡ 주요 인사이트</span>
            <button onClick={()=>setTab('action')} style={{ fontSize:11, color:'#FF6B35', background:'rgba(255,107,53,0.08)', border:'1px solid rgba(255,107,53,0.25)', borderRadius:8, padding:'4px 10px', cursor:'pointer' }}>전체 보기</button>
          </div>
          {insights.slice(0,3).map((ins,i) => <InsightCard key={i} {...ins} />)}
        </div>
      )}
    </div>
  )

  // ── 액션 인사이트 탭 ──
  const actionContent = (
    <div>
      <div style={{ ...bx, background:'linear-gradient(135deg,rgba(108,92,231,0.06),rgba(232,67,147,0.04))', border:'1px solid rgba(108,92,231,0.2)' }}>
        <div style={{ fontSize:14, fontWeight:800, color:'#1a1a2e', marginBottom:4 }}>⚡ 매출 향상 액션 플랜</div>
        <div style={{ fontSize:11, color:'#aaa' }}>AI가 이번 달 데이터를 분석해 자동으로 만든 개선 포인트예요. 회의에서 바로 활용하세요.</div>
      </div>

      {/* 목표 달성률 */}
      {goalAmt > 0 && (
        <div style={{ ...bx, border:`1px solid ${goalPct>=100?'rgba(0,184,148,0.35)':'rgba(108,92,231,0.25)'}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ fontSize:13, fontWeight:700 }}>🎯 목표 달성률</span>
            <span style={{ fontSize:18, fontWeight:900, color:goalPct>=100?'#00B894':'#6C5CE7' }}>{goalPct}%</span>
          </div>
          <ProgressBar value={totalSales} max={goalAmt} color={goalPct>=100?'#00B894':'#6C5CE7'} height={16} />
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontSize:12 }}>
            <span style={{ color:'#555', fontWeight:700 }}>{fmtWFull(totalSales)}</span>
            <span style={{ color:'#aaa' }}>/ 목표 {fmtWFull(goalAmt)}</span>
          </div>
          {goalPct < 100 && (
            <div style={{ marginTop:10, padding:'10px 14px', background:'rgba(108,92,231,0.07)', borderRadius:10, fontSize:12, color:'#6C5CE7', lineHeight:1.7 }}>
              부족분 <strong>{fmtW(goalAmt-totalSales)}</strong><br/>
              남은 기간 하루 <strong>{fmtW(Math.round((goalAmt-totalSales)/Math.max(new Date(year,month+1,0).getDate()-(daily[daily.length-1]?.day||0),1)))}</strong> 달성 필요
            </div>
          )}
        </div>
      )}

      {/* 자동 분석 인사이트 */}
      {daily.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'#ccc' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📊</div>
          <div style={{ fontSize:14 }}>마감일지를 작성하면 인사이트가 나타나요</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize:12, fontWeight:700, color:'#888', marginBottom:8, paddingLeft:4 }}>🔴 즉시 조치 필요</div>
          {insights.filter(i=>i.priority===1).map((ins,i) => <InsightCard key={i} {...ins} />)}
          {insights.filter(i=>i.priority===1).length===0 && <div style={{ padding:'12px 16px', borderRadius:12, background:'rgba(0,184,148,0.06)', border:'1px solid rgba(0,184,148,0.2)', fontSize:12, color:'#00B894', marginBottom:12 }}>✅ 즉각 개선이 필요한 항목이 없어요</div>}

          <div style={{ fontSize:12, fontWeight:700, color:'#888', marginBottom:8, marginTop:4, paddingLeft:4 }}>🟡 개선 권장</div>
          {insights.filter(i=>i.priority===2).map((ins,i) => <InsightCard key={i} {...ins} />)}

          <div style={{ fontSize:12, fontWeight:700, color:'#888', marginBottom:8, marginTop:4, paddingLeft:4 }}>🟢 참고 사항</div>
          {insights.filter(i=>i.priority===3).map((ins,i) => <InsightCard key={i} {...ins} />)}

          {/* 회의 체크리스트 */}
          <div style={{ ...bx, border:'1px solid rgba(253,196,0,0.4)', background:'rgba(253,196,0,0.04)' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:12 }}>📋 이번 달 회의 체크리스트</div>
            {[
              { check: totalSales>0, label:'이번 달 총 매출 확인', value:fmtW(totalSales) },
              { check: prevTotal>0, label:'전월 대비 성과', value:prevTotal>0?`${totalSales>=prevTotal?'▲':'▼'}${Math.abs(Math.round(((totalSales-prevTotal)/prevTotal)*100))}%`:'데이터 없음' },
              { check: avgUnit>0, label:'객단가 현황', value:fmtW(avgUnit) },
              { check: totalCancel>0, label:'취소/환불 현황', value:`${totalCancel}건`, warn:true },
              { check: true, label:'최고/최저 요일 파악', value:dowStats.filter(d=>d.value>0).sort((a,b)=>b.value-a.value)[0]?.label+'요일 최고' },
              { check: platforms.length>0, label:'플랫폼별 매출 점검', value:platforms[0]?.name+' 1위' },
            ].map((item,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 0', borderBottom:'1px solid #F4F6F9' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:15, color:item.check?item.warn?'#FDC400':'#00B894':'#ddd' }}>{item.check?'✓':'○'}</span>
                  <span style={{ fontSize:12, color:'#555' }}>{item.label}</span>
                </div>
                <span style={{ fontSize:11, color:'#888', fontWeight:600 }}>{item.value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )

  // ── 리뷰 분석 탭 ──
  const reviewContent = (
    <div>
      {/* 요약 */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:12 }}>
        {[
          { label:'총 리뷰 수', value:`${daily.reduce((s,d)=>s+d.totalReviews,0)}건`, color:'#FF6B35' },
          { label:'총 답글 수', value:`${daily.reduce((s,d)=>s+d.totalReplies,0)}건`, color:'#00B894' },
          { label:'전체 답글률', value:`${daily.reduce((s,d)=>s+d.totalReviews,0)>0?Math.round((daily.reduce((s,d)=>s+d.totalReplies,0)/daily.reduce((s,d)=>s+d.totalReviews,0))*100):0}%`, color:'#6C5CE7' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', borderRadius:12, border:'1px solid #E8ECF0', padding:'12px 14px' }}>
            <div style={{ fontSize:10, color:'#aaa', marginBottom:3 }}>{s.label}</div>
            <div style={{ fontSize:18, fontWeight:800, color:s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* 플랫폼별 리뷰 */}
      {reviewPlatforms.length > 0 ? (
        <div style={bx}>
          <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:14 }}>⭐ 플랫폼별 리뷰 현황</div>
          {reviewPlatforms.map(p => (
            <div key={p.name} style={{ marginBottom:16, paddingBottom:16, borderBottom:'1px solid #F4F6F9' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:8, height:8, borderRadius:2, background:p.color }} />
                  <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{p.name}</span>
                </div>
                <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:`${p.color}15`, color:p.color, fontWeight:700, border:`1px solid ${p.color}33` }}>답글률 {p.replyRate}%</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:8 }}>
                <div style={{ background:'#F8F9FB', borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
                  <div style={{ fontSize:9, color:'#aaa', marginBottom:3 }}>리뷰 수</div>
                  <div style={{ fontSize:18, fontWeight:800, color:'#FF6B35' }}>{p.reviews}</div>
                </div>
                <div style={{ background:'#F8F9FB', borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
                  <div style={{ fontSize:9, color:'#aaa', marginBottom:3 }}>답글 수</div>
                  <div style={{ fontSize:18, fontWeight:800, color:'#00B894' }}>{p.replies}</div>
                </div>
                <div style={{ background:'#F8F9FB', borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
                  <div style={{ fontSize:9, color:'#aaa', marginBottom:3 }}>미답글</div>
                  <div style={{ fontSize:18, fontWeight:800, color:p.reviews-p.replies>0?'#E84393':'#bbb' }}>{Math.max(p.reviews-p.replies,0)}</div>
                </div>
              </div>
              <div style={{ marginBottom:4 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#aaa', marginBottom:4 }}>
                  <span>답글률</span><span>{p.replyRate}%</span>
                </div>
                <ProgressBar value={p.replies} max={Math.max(p.reviews,1)} color={p.replyRate>=80?'#00B894':p.replyRate>=50?'#FDC400':'#E84393'} height={8} />
              </div>
              {p.replyRate < 80 && p.reviews > 0 && (
                <div style={{ fontSize:11, color:'#E84393', background:'rgba(232,67,147,0.06)', borderRadius:8, padding:'6px 10px' }}>
                  ⚠️ {p.name} 미답글 {Math.max(p.reviews-p.replies,0)}건 — 빠른 답글이 재방문율을 높여요
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign:'center', padding:'60px 0', color:'#ccc' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>⭐</div>
          <div style={{ fontSize:13 }}>마감일지에서 리뷰/답글 수를 입력하면 여기서 분석할 수 있어요</div>
        </div>
      )}

      {/* 리뷰 수 × 매출 상관관계 */}
      {daily.filter(d=>d.totalReviews>0).length >= 3 && (
        <div style={bx}>
          <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:4 }}>📊 리뷰 수 × 매출 상관관계</div>
          <div style={{ fontSize:11, color:'#aaa', marginBottom:12 }}>리뷰가 많은 날 매출도 높은지 확인해요</div>
          {daily.filter(d=>d.totalReviews>0).sort((a,b)=>b.totalReviews-a.totalReviews).slice(0,8).map(d => (
            <div key={d.day} style={{ display:'grid', gridTemplateColumns:'60px 1fr 80px', gap:8, padding:'7px 0', borderBottom:'1px solid #F8F9FB', alignItems:'center' }}>
              <span style={{ fontSize:11, color:'#888' }}>{month+1}/{d.day}({DOW[d.dow]})</span>
              <div>
                <div style={{ fontSize:10, color:'#aaa', marginBottom:2 }}>리뷰 {d.totalReviews}건 · 답글 {d.totalReplies}건</div>
                <ProgressBar value={d.totalReplies} max={Math.max(d.totalReviews,1)} color='#00B894' height={5} />
              </div>
              <span style={{ fontSize:12, fontWeight:700, color:'#FF6B35', textAlign:'right' }}>{fmtW(d.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // ── 플레이스 순위 × 매출 탭 ──
  const placeContent = (
    <div>
      {placeTrackers.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'#ccc' }}>
          <div style={{ fontSize:32, marginBottom:12 }}>📍</div>
          <div style={{ fontSize:13 }}>플레이스 순위 탭에서 키워드를 등록하고<br/>순위를 저장하면 여기서 매출과 비교할 수 있어요</div>
        </div>
      ) : (
        <>
          {placeTrackers.map(t => {
            const hist = placeHistory.filter(h=>h.tracker_id===t.id).sort((a,b)=>a.checked_date.localeCompare(b.checked_date))
            const corr = hist.map(h=>{ const d=daily.find(d=>d.date===h.checked_date); return { date:h.checked_date, rank:h.rank, sales:d?.amount||0 } }).filter(h=>h.sales>0)
            const latestRank = hist[hist.length-1]?.rank
            return (
              <div key={t.id} style={bx}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                  <div>
                    <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{t.store_name}</span>
                    <span style={{ fontSize:11, color:'#FF6B35', marginLeft:8 }}>#{t.keyword}</span>
                  </div>
                  {latestRank && <div style={{ fontSize:22, fontWeight:900, color:'#FF6B35' }}>{latestRank}위</div>}
                </div>
                {corr.length >= 2 ? (
                  <>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, marginBottom:14 }}>
                      {[
                        { label:'순위 좋은 날 평균 매출', value:fmtW(Math.round(corr.filter(c=>c.rank<=10).reduce((s,c)=>s+c.sales,0)/Math.max(corr.filter(c=>c.rank<=10).length,1))), color:'#00B894' },
                        { label:'순위 낮은 날 평균 매출', value:fmtW(Math.round(corr.filter(c=>c.rank>10).reduce((s,c)=>s+c.sales,0)/Math.max(corr.filter(c=>c.rank>10).length,1))), color:'#E84393' },
                      ].map(s => (
                        <div key={s.label} style={{ background:'#F8F9FB', borderRadius:10, padding:'12px', border:'1px solid #E8ECF0' }}>
                          <div style={{ fontSize:10, color:'#aaa', marginBottom:4 }}>{s.label}</div>
                          <div style={{ fontSize:16, fontWeight:800, color:s.color }}>{s.value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize:12, fontWeight:700, color:'#1a1a2e', marginBottom:8 }}>날짜별 순위 × 매출</div>
                    {corr.sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8).map((c,i) => (
                      <div key={i} style={{ display:'grid', gridTemplateColumns:'80px 50px 1fr', gap:8, padding:'7px 0', borderBottom:'1px solid #F8F9FB', alignItems:'center' }}>
                        <span style={{ fontSize:11, color:'#aaa' }}>{c.date.slice(5)}</span>
                        <span style={{ fontSize:13, fontWeight:700, color:c.rank<=10?'#00B894':c.rank<=30?'#6C5CE7':'#bbb' }}>{c.rank}위</span>
                        <div>
                          <ProgressBar value={c.sales} max={Math.max(...corr.map(x=>x.sales))} color='#FF6B35' height={8} />
                          <span style={{ fontSize:10, color:'#888' }}>{fmtW(c.sales)}</span>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div style={{ fontSize:12, color:'#bbb', textAlign:'center', padding:'16px 0' }}>이 달 순위 기록이 부족해요. 플레이스 탭에서 순위를 저장해주세요.</div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )

  const mainContent = (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* 요약 카드 (overview 이외 탭에서만) */}
      {tab !== 'overview' && (
        <div style={{ display:'grid', gridTemplateColumns:isPC?'repeat(6,1fr)':'repeat(3,1fr)', gap:8, marginBottom:12 }}>
          {[
            {label:'총 매출',value:fmtW(totalSales),color:'#FF6B35'},
            {label:'총 건수',value:`${totalCount}건`,color:'#6C5CE7'},
            {label:'객단가',value:fmtW(avgUnit),color:'#00B894'},
            {label:'취소/환불',value:`${totalCancel}건`,color:'#E84393'},
            {label:'영업일',value:`${daily.length}일`,color:'#555'},
            {label:'할인금액',value:fmtW(totalDiscount),color:'#FDC400'},
          ].map(s => (
            <div key={s.label} style={{ background:'#fff', borderRadius:12, border:'1px solid #E8ECF0', padding:isPC?'12px 16px':'10px 12px', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize:10, color:'#aaa', marginBottom:3 }}>{s.label}</div>
              <div style={{ fontSize:isPC?17:14, fontWeight:800, color:s.color }}>{loading?'…':s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* 탭 */}
      <div style={{ display:'flex', gap:4, marginBottom:14, overflowX:'auto', flexShrink:0, paddingBottom:2 }}>
        {TAB_LIST.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id as any)}
            style={{ padding:'7px 14px', borderRadius:20, border:tab===t.id?'none':'1px solid #E8ECF0',
              background:tab===t.id?'linear-gradient(135deg,#FF6B35,#E84393)':'#fff',
              color:tab===t.id?'#fff':'#888', fontSize:12, fontWeight:tab===t.id?700:500,
              cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflow:'auto' }}>
        {loading && <div style={{ textAlign:'center', padding:'60px 0', color:'#aaa', fontSize:13 }}>불러오는 중…</div>}

        {!loading && tab==='overview' && overviewContent}
        {!loading && tab==='action' && actionContent}
        {!loading && tab==='review' && reviewContent}
        {!loading && tab==='place' && placeContent}

        {!loading && tab==='sales' && (
          <div>
            <div style={bx}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                <span style={{ fontSize:14, fontWeight:700, color:'#1a1a2e' }}>📈 일별 매출 흐름</span>
                {prevTotal>0 && <span style={{ fontSize:10, color:'#aaa' }}>점선 = {prevMonthLabel}</span>}
              </div>
              {daily.length>0 ? (
                <LineChart data={daily.map(d=>({x:d.day,y:d.amount,label:String(d.day)}))} prevData={prevDaily.map(d=>({x:d.day,y:d.amount}))} goal={goal?.weekday_goal||undefined} color="#FF6B35" height={isPC?220:160} />
              ) : <div style={{ textAlign:'center', padding:'40px 0', color:'#ccc', fontSize:13 }}>이번 달 마감 데이터가 없어요</div>}
            </div>
            {daily.length>0 && (
              <div style={bx}>
                <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:12 }}>📋 일별 상세</div>
                <div style={{ display:'grid', gridTemplateColumns:'68px 1fr 76px 56px 56px 30px', gap:4, paddingBottom:8, borderBottom:'1px solid #F0F2F5', marginBottom:6 }}>
                  {['날짜','매출','건수','취소','객단가',''].map((h,i) => <span key={i} style={{ fontSize:10, color:'#aaa', fontWeight:600, textAlign:i===0?'left':'center' }}>{h}</span>)}
                </div>
                {[...daily].sort((a,b)=>b.day-a.day).map(d => (
                  <div key={d.day} style={{ display:'grid', gridTemplateColumns:'68px 1fr 76px 56px 56px 30px', gap:4, padding:'8px 0', borderBottom:'1px solid #F8F9FB', alignItems:'center' }}>
                    <span style={{ fontSize:11, color:d.dow===0||d.dow===6?'#E84393':'#888' }}>{month+1}/{d.day}({DOW[d.dow]}){d.weatherCode!=null?weatherIcon(d.weatherCode):''}</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'#FF6B35' }}>{fmtWFull(d.amount)}</span>
                    <span style={{ fontSize:12, color:'#6C5CE7', textAlign:'center' }}>{d.count>0?`${d.count}건`:'-'}</span>
                    <span style={{ fontSize:12, color:'#E84393', textAlign:'center' }}>{d.cancel>0?`${d.cancel}건`:'-'}</span>
                    <span style={{ fontSize:11, color:'#aaa', textAlign:'center' }}>{d.unitPrice>0?fmtW(d.unitPrice):'-'}</span>
                    <span style={{ fontSize:12, textAlign:'center' }}>{d.memo||d.note?'📌':''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && tab==='unit' && (
          <div>
            <div style={bx}>
              <div style={{ fontSize:14, fontWeight:700, color:'#1a1a2e', marginBottom:4 }}>💡 종합 객단가 추이</div>
              <div style={{ fontSize:11, color:'#aaa', marginBottom:14 }}>주문 1건당 평균 결제금액 — 높을수록 메뉴 구성이 좋고, 낮으면 올릴 여지가 있어요</div>
              {daily.filter(d=>d.count>0).length>0 ? (
                <LineChart data={daily.filter(d=>d.count>0).map(d=>({x:d.day,y:d.unitPrice,label:String(d.day)}))} prevData={prevDaily.filter(d=>d.count>0).map(d=>({x:d.day,y:d.unitPrice}))} color="#6C5CE7" height={isPC?200:150} />
              ) : <div style={{ textAlign:'center', padding:'40px 0', color:'#ccc', fontSize:13 }}>건수를 입력하면 객단가가 계산돼요</div>}
            </div>
            {daily.filter(d=>d.count>0).length>0 && (
              <div style={{ display:'grid', gridTemplateColumns:isPC?'repeat(4,1fr)':'repeat(2,1fr)', gap:10, marginBottom:12 }}>
                {[
                  {label:'종합 객단가',value:fmtW(avgUnit),color:'#6C5CE7'},
                  {label:'최고 객단가',value:fmtW(Math.max(...daily.filter(d=>d.count>0).map(d=>d.unitPrice))),color:'#FF6B35'},
                  {label:'최저 객단가',value:fmtW(Math.min(...daily.filter(d=>d.count>0).map(d=>d.unitPrice))),color:'#E84393'},
                  {label:'객단가 수준',value:avgUnit>15000?'✅ 양호':avgUnit>10000?'⚠️ 보통':'❌ 낮음',color:avgUnit>15000?'#00B894':avgUnit>10000?'#FDC400':'#E84393'},
                ].map(s => (
                  <div key={s.label} style={{ background:'#fff', borderRadius:12, border:'1px solid #E8ECF0', padding:'14px 16px' }}>
                    <div style={{ fontSize:10, color:'#aaa', marginBottom:4 }}>{s.label}</div>
                    <div style={{ fontSize:18, fontWeight:800, color:s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* 플랫폼별 객단가 */}
            {platforms.filter(p=>p.count>0).length>0 && (
              <div style={bx}>
                <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:4 }}>🥧 플랫폼별 객단가</div>
                <div style={{ fontSize:11, color:'#aaa', marginBottom:14 }}>채널마다 고객이 얼마나 쓰는지 비교해요</div>
                {(()=>{
                  const sorted = [...platforms.filter(p=>p.count>0)].sort((a,b)=>Math.round(b.amount/b.count)-Math.round(a.amount/a.count))
                  const maxU = Math.round(sorted[0].amount/sorted[0].count)
                  return sorted.map(p => {
                    const pu = Math.round(p.amount/p.count)
                    return (
                      <div key={p.name} style={{ marginBottom:16 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ width:8, height:8, borderRadius:2, background:p.color }} />
                            <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{p.name}</span>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <span style={{ fontSize:16, fontWeight:800, color:p.color }}>{fmtW(pu)}</span>
                            <span style={{ fontSize:10, color:'#aaa', marginLeft:6 }}>{p.count}건</span>
                          </div>
                        </div>
                        <ProgressBar value={pu} max={maxU} color={p.color} height={8} />
                        <div style={{ display:'flex', justifyContent:'space-between', marginTop:4, fontSize:10, color:'#aaa' }}>
                          <span>총 {fmtW(p.amount)}</span>
                          <span>{avgUnit>0?`종합 대비 ${pu>=avgUnit?'▲':'▼'} ${Math.abs(Math.round(((pu-avgUnit)/avgUnit)*100))}%`:''}</span>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            )}

            {totalCancel>0 && (
              <div style={{ ...bx, border:'1px solid rgba(232,67,147,0.25)' }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#E84393', marginBottom:12 }}>🚨 취소/환불 분석</div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                  {[
                    {label:'총 취소/환불',value:`${totalCancel}건`,color:'#E84393'},
                    {label:'취소율',value:`${totalCount>0?Math.round((totalCancel/(totalCount+totalCancel))*100):0}%`,color:'#E84393'},
                    {label:'추정 손실',value:fmtW(totalCancel*avgUnit),color:'#E84393'},
                  ].map(s => (
                    <div key={s.label} style={{ background:'rgba(232,67,147,0.06)', borderRadius:10, padding:'12px 14px' }}>
                      <div style={{ fontSize:10, color:'#aaa', marginBottom:4 }}>{s.label}</div>
                      <div style={{ fontSize:16, fontWeight:800, color:s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && tab==='dow' && (
          <div>
            <div style={bx}>
              <div style={{ fontSize:14, fontWeight:700, color:'#1a1a2e', marginBottom:4 }}>📆 요일별 평균 매출</div>
              <div style={{ fontSize:11, color:'#aaa', marginBottom:14 }}>어느 요일에 매출이 집중되는지 파악해 직원 배치와 프로모션에 활용하세요</div>
              <BarChart data={dowStats} height={isPC?200:150} />
            </div>
            {daily.length>0 && (()=>{
              const sorted=[...dowStats].filter(d=>d.value>0).sort((a,b)=>b.value-a.value)
              const best=sorted[0], worst=sorted[sorted.length-1]
              const wdAvg=dowStats.filter(d=>['월','화','수','목','금'].includes(d.label)&&d.value>0)
              const weAvg=dowStats.filter(d=>['토','일'].includes(d.label)&&d.value>0)
              const wdMean=wdAvg.length?Math.round(wdAvg.reduce((s,d)=>s+d.value,0)/wdAvg.length):0
              const weMean=weAvg.length?Math.round(weAvg.reduce((s,d)=>s+d.value,0)/weAvg.length):0
              return (
                <div style={bx}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:12 }}>💡 요일 인사이트</div>
                  {best && <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(0,184,148,0.08)', border:'1px solid rgba(0,184,148,0.2)', fontSize:12, color:'#00B894', marginBottom:8 }}>🏆 최고 요일: <strong>{best.label}요일</strong> 평균 {fmtW(best.value)} ({best.count}회)</div>}
                  {worst && <div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(232,67,147,0.06)', border:'1px solid rgba(232,67,147,0.15)', fontSize:12, color:'#E84393', marginBottom:8 }}>📉 최저 요일: <strong>{worst.label}요일</strong> 평균 {fmtW(worst.value)} — 이 날 프로모션을 고려해보세요</div>}
                  {wdMean>0&&weMean>0&&(weMean>wdMean
                    ?<div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(108,92,231,0.06)', border:'1px solid rgba(108,92,231,0.15)', fontSize:12, color:'#6C5CE7' }}>📊 주말 강세: 주말 평균이 평일보다 {Math.round(((weMean-wdMean)/wdMean)*100)}% 높아요</div>
                    :<div style={{ padding:'10px 14px', borderRadius:10, background:'rgba(255,107,53,0.06)', border:'1px solid rgba(255,107,53,0.15)', fontSize:12, color:'#FF6B35' }}>📊 평일 강세: 평일 평균이 주말보다 {weMean>0?Math.round(((wdMean-weMean)/weMean)*100):100}% 높아요</div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {!loading && tab==='platform' && (
          <div>
            <div style={bx}>
              <div style={{ fontSize:14, fontWeight:700, color:'#1a1a2e', marginBottom:16 }}>🥧 플랫폼별 매출 비중</div>
              {platforms.length>0 ? (
                <div style={{ display:'flex', gap:24, alignItems:'center', flexWrap:'wrap' }}>
                  <PieChart data={platforms.map(p=>({label:p.name,value:p.amount,color:p.color}))} size={isPC?160:130} />
                  <div style={{ flex:1, minWidth:180 }}>
                    {platforms.map(p => (
                      <div key={p.name} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                        <div style={{ width:10, height:10, borderRadius:3, background:p.color, flexShrink:0 }} />
                        <span style={{ fontSize:12, color:'#555', flex:1 }}>{p.name}</span>
                        <span style={{ fontSize:12, fontWeight:700, color:'#1a1a2e' }}>{fmtW(p.amount)}</span>
                        <span style={{ fontSize:11, color:'#aaa', width:34, textAlign:'right' }}>{totalSales>0?Math.round((p.amount/totalSales)*100):0}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <div style={{ textAlign:'center', padding:'40px 0', color:'#ccc', fontSize:13 }}>데이터 없음</div>}
            </div>
            {(hallAmt>0||delivAmt>0) && (
              <div style={bx}>
                <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:14 }}>🏠 홀 vs 🛵 배달</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                  <div style={{ background:'rgba(255,107,53,0.08)', borderRadius:12, padding:'14px 16px', border:'1px solid rgba(255,107,53,0.2)' }}>
                    <div style={{ fontSize:10, color:'#aaa', marginBottom:4 }}>🏠 홀 매출</div>
                    <div style={{ fontSize:20, fontWeight:800, color:'#FF6B35' }}>{fmtW(hallAmt)}</div>
                    <div style={{ fontSize:11, color:'#FF6B35', marginTop:2 }}>{totalSales>0?Math.round((hallAmt/totalSales)*100):0}%</div>
                  </div>
                  <div style={{ background:'rgba(108,92,231,0.08)', borderRadius:12, padding:'14px 16px', border:'1px solid rgba(108,92,231,0.2)' }}>
                    <div style={{ fontSize:10, color:'#aaa', marginBottom:4 }}>🛵 배달 매출</div>
                    <div style={{ fontSize:20, fontWeight:800, color:'#6C5CE7' }}>{fmtW(delivAmt)}</div>
                    <div style={{ fontSize:11, color:'#6C5CE7', marginTop:2 }}>{totalSales>0?Math.round((delivAmt/totalSales)*100):0}%</div>
                  </div>
                </div>
                <ProgressBar value={hallAmt} max={totalSales} color='#FF6B35' height={12} />
              </div>
            )}
          </div>
        )}

        {!loading && tab==='compare' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:12 }}>
              {[
                {label:'이번달',value:fmtW(totalSales),color:'#FF6B35',sub:`${daily.length}일 영업`},
                {label:`전월`,value:fmtW(prevTotal),color:'#6C5CE7',sub:prevTotal>0?`${totalSales>=prevTotal?'▲':'▼'}${Math.abs(Math.round(((totalSales-prevTotal)/prevTotal)*100))}%`:'데이터없음'},
                {label:`전년 동월`,value:fmtW(prevYearTotal),color:'#00B894',sub:prevYearTotal>0?`${totalSales>=prevYearTotal?'▲':'▼'}${Math.abs(Math.round(((totalSales-prevYearTotal)/prevYearTotal)*100))}%`:'데이터없음'},
              ].map(s => (
                <div key={s.label} style={{ background:'#fff', borderRadius:12, border:'1px solid #E8ECF0', padding:'12px 14px' }}>
                  <div style={{ fontSize:10, color:'#aaa', marginBottom:4 }}>{s.label}</div>
                  <div style={{ fontSize:isPC?16:13, fontWeight:800, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:10, color:s.color, marginTop:3, opacity:0.8 }}>{s.sub}</div>
                </div>
              ))}
            </div>
            <div style={bx}>
              <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginBottom:10 }}>🔄 전월 비교 차트</div>
              {(()=>{
                const days=[...new Set([...daily.map(d=>d.day),...prevDaily.map(d=>d.day)])].sort((a,b)=>a-b)
                const cd=days.map(day=>({day,curr:daily.find(d=>d.day===day)?.amount||0,prev:prevDaily.find(d=>d.day===day)?.amount||0})).filter(d=>d.curr>0||d.prev>0)
                if(!cd.length) return <div style={{ textAlign:'center', padding:'30px 0', color:'#ccc', fontSize:13 }}>비교 데이터 없음</div>
                const maxV=Math.max(...cd.map(d=>Math.max(d.curr,d.prev)),1), barH=isPC?140:110
                return (
                  <div style={{ overflowX:'auto' }}>
                    <div style={{ display:'flex', alignItems:'flex-end', gap:3, minWidth:cd.length*28, height:barH+20, paddingBottom:18 }}>
                      {cd.map(d => (
                        <div key={d.day} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', height:'100%' }}>
                          <div style={{ display:'flex', alignItems:'flex-end', gap:1, width:'100%' }}>
                            <div style={{ flex:1, height:Math.max(Math.round((d.curr/maxV)*barH),d.curr>0?3:0), background:'rgba(255,107,53,0.75)', borderRadius:'3px 3px 0 0' }} />
                            <div style={{ flex:1, height:Math.max(Math.round((d.prev/maxV)*barH),d.prev>0?3:0), background:'rgba(108,92,231,0.45)', borderRadius:'3px 3px 0 0' }} />
                          </div>
                          <div style={{ fontSize:8, color:'#bbb', marginTop:3 }}>{d.day}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {!loading && tab==='yearcmp' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div style={{ background:'#fff', borderRadius:12, border:'1px solid #E8ECF0', padding:'14px 16px' }}>
                <div style={{ fontSize:10, color:'#aaa', marginBottom:4 }}>{year}년 {month+1}월</div>
                <div style={{ fontSize:18, fontWeight:800, color:'#FF6B35' }}>{fmtW(totalSales)}</div>
              </div>
              <div style={{ background:'#fff', borderRadius:12, border:'1px solid #E8ECF0', padding:'14px 16px' }}>
                <div style={{ fontSize:10, color:'#aaa', marginBottom:4 }}>{year-1}년 {month+1}월</div>
                <div style={{ fontSize:18, fontWeight:800, color:'#00B894' }}>{prevYearTotal>0?fmtW(prevYearTotal):'데이터없음'}</div>
              </div>
            </div>
            {prevYearTotal>0 && (
              <div style={{ ...bx, border:`1px solid ${totalSales>=prevYearTotal?'rgba(0,184,148,0.3)':'rgba(232,67,147,0.3)'}` }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
                  {[
                    {label:'YoY 성장률',value:`${totalSales>=prevYearTotal?'+':''}${Math.round(((totalSales-prevYearTotal)/prevYearTotal)*100)}%`,color:totalSales>=prevYearTotal?'#00B894':'#E84393'},
                    {label:'매출 증감',value:`${totalSales>=prevYearTotal?'+':''}${fmtW(totalSales-prevYearTotal)}`,color:totalSales>=prevYearTotal?'#00B894':'#E84393'},
                    {label:'일평균',value:fmtW(daily.length>0?Math.round(totalSales/daily.length):0),color:'#FF6B35'},
                  ].map(s => (
                    <div key={s.label}>
                      <div style={{ fontSize:10, color:'#aaa', marginBottom:4 }}>{s.label}</div>
                      <div style={{ fontSize:16, fontWeight:800, color:s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && tab==='memo' && (
          <div>
            <div style={bx}>
              <div style={{ fontSize:14, fontWeight:700, color:'#1a1a2e', marginBottom:4 }}>📌 특이사항 타임라인</div>
              <div style={{ fontSize:11, color:'#aaa', marginBottom:16 }}>이벤트·날씨·행사가 매출에 어떤 영향을 줬는지 확인하세요</div>
              {memoData.length>0 ? memoData.sort((a,b)=>b.day-a.day).map(d => (
                <div key={d.day} style={{ borderRadius:12, border:'1px solid #E8ECF0', padding:'14px 16px', marginBottom:10, background:'#FAFBFC' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, flexWrap:'wrap', gap:6 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:12, fontWeight:700, color:d.dow===0||d.dow===6?'#E84393':'#888' }}>{month+1}월 {d.day}일 ({DOW[d.dow]}){d.weatherCode!=null?' '+weatherIcon(d.weatherCode):''}</span>
                      <span style={{ fontSize:14, fontWeight:800, color:'#FF6B35' }}>{fmtWFull(d.amount)}</span>
                    </div>
                    {d.count>0&&<span style={{ fontSize:11, color:'#6C5CE7', fontWeight:600 }}>{d.count}건 · {fmtW(d.unitPrice)}</span>}
                  </div>
                  {d.memo && <div style={{ padding:'8px 12px', background:'rgba(255,107,53,0.06)', borderRadius:8, marginBottom:6, border:'1px solid rgba(255,107,53,0.15)' }}><div style={{ fontSize:10, color:'#FF6B35', fontWeight:700, marginBottom:2 }}>📌 특이사항</div><div style={{ fontSize:12, color:'#555', lineHeight:1.6 }}>{d.memo}</div></div>}
                  {d.note && <div style={{ padding:'8px 12px', background:'rgba(232,67,147,0.05)', borderRadius:8, border:'1px solid rgba(232,67,147,0.15)' }}><div style={{ fontSize:10, color:'#E84393', fontWeight:700, marginBottom:2 }}>📝 클레임</div><div style={{ fontSize:12, color:'#555', lineHeight:1.6 }}>{d.note}</div></div>}
                </div>
              )) : <div style={{ textAlign:'center', padding:'40px 0', color:'#ccc' }}><div style={{ fontSize:32, marginBottom:10 }}>📌</div><div style={{ fontSize:13 }}>이번 달 특이사항 메모가 없어요</div></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  if (isPC) return (
    <div style={{ padding:'20px 28px' }}>
      <div style={{ marginBottom:16 }}>
        <MonthNav year={year} month={month} onChange={(y,m)=>{setYear(y);setMonth(m)}} />
      </div>
      {mainContent}
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom:16 }}>
        <MonthNav year={year} month={month} onChange={(y,m)=>{setYear(y);setMonth(m)}} />
      </div>
      {mainContent}
    </div>
  )
}