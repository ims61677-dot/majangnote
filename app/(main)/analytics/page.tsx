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
    if (m < 0) { y--; m = 11 } else if (m > 11) { y++; m = 0 }
    onChange(y, m)
  }
  const now = new Date()
  const isCurrent = year === now.getFullYear() && month === now.getMonth()
  const months = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
  const years = Array.from({length:6}, (_,i) => now.getFullYear()-2+i)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
        <button onClick={() => go(-3)} style={{ padding:'5px 9px', borderRadius:8, border:'1px solid #E8ECF0', background:'#F8F9FB', cursor:'pointer', fontSize:12, color:'#888', fontWeight:700 }}>«3</button>
        <button onClick={() => go(-1)} style={{ width:32, height:32, borderRadius:8, border:'1px solid #E8ECF0', background:'#fff', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', color:'#555' }}>‹</button>
        <span style={{ fontSize:17, fontWeight:800, color:'#1a1a2e', minWidth:100, textAlign:'center' }}>{year}년 {month+1}월</span>
        <button onClick={() => go(1)} style={{ width:32, height:32, borderRadius:8, border:'1px solid #E8ECF0', background:'#fff', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', color:'#555' }}>›</button>
        <button onClick={() => go(3)} style={{ padding:'5px 9px', borderRadius:8, border:'1px solid #E8ECF0', background:'#F8F9FB', cursor:'pointer', fontSize:12, color:'#888', fontWeight:700 }}>3»</button>
        {!isCurrent && <button onClick={() => onChange(now.getFullYear(), now.getMonth())} style={{ padding:'5px 11px', borderRadius:8, border:'1px solid rgba(255,107,53,0.4)', background:'rgba(255,107,53,0.08)', cursor:'pointer', fontSize:12, color:'#FF6B35', fontWeight:700 }}>이번달</button>}
      </div>
      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
        {years.map(y => (
          <button key={y} onClick={() => onChange(y, month)}
            style={{ padding:'4px 9px', borderRadius:8, border:y===year?'none':'1px solid #E8ECF0',
              background:y===year?'linear-gradient(135deg,#FF6B35,#E84393)':'#F8F9FB',
              color:y===year?'#fff':'#888', fontSize:11, fontWeight:700, cursor:'pointer' }}>{y}</button>
        ))}
        <span style={{ width:'100%', height:0 }} />
        {months.map((ml,mi) => (
          <button key={mi} onClick={() => onChange(year, mi)}
            style={{ padding:'4px 8px', borderRadius:8, border:mi===month&&year===year?'none':'1px solid #E8ECF0',
              background:mi===month?'linear-gradient(135deg,#FF6B35,#E84393)':'#F8F9FB',
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


  // ── 블로그/카페/카카오 검색 상태 ──
  const [searchKeyword, setSearchKeyword] = useState('')
  const [savedKeyword, setSavedKeyword] = useState('')
  const [blogData, setBlogData] = useState<any[]>([])
  const [cafeData, setCafeData] = useState<any[]>([])
  const [kakaoData, setKakaoData] = useState<any>(null)
  const [marketingLoading, setMarketingLoading] = useState(false)
  const [keywordSaving, setKeywordSaving] = useState(false)
  const [openDrops, setOpenDrops] = useState<Record<string,boolean>>({})

  useEffect(() => {
    if (storeId) loadKeyword(storeId)
  }, [storeId])

  async function loadKeyword(sid: string) {
    const { data } = await supabase.from('stores').select('search_keyword').eq('id', sid).maybeSingle()
    if (data?.search_keyword) {
      setSavedKeyword(data.search_keyword)
      setSearchKeyword(data.search_keyword)
    }
  }

  async function saveKeyword() {
    if (!searchKeyword.trim() || !storeId) return
    setKeywordSaving(true)
    await supabase.from('stores').update({ search_keyword: searchKeyword.trim() }).eq('id', storeId)
    setSavedKeyword(searchKeyword.trim())
    setKeywordSaving(false)
    fetchMarketingData(searchKeyword.trim())
  }

  async function fetchMarketingData(kw: string) {
    if (!kw) return
    setMarketingLoading(true)
    try {
      const [blogRes, cafeRes, kakaoRes] = await Promise.all([
        fetch(`/api/naver-search?query=${encodeURIComponent(kw)}&type=blog&display=20`),
        fetch(`/api/naver-search?query=${encodeURIComponent(kw)}&type=cafearticle&display=20`),
        fetch(`/api/kakao-place?query=${encodeURIComponent(kw)}&size=1`),
      ])
      if (blogRes.ok) { const d = await blogRes.json(); setBlogData(d.items || []) }
      if (cafeRes.ok) { const d = await cafeRes.json(); setCafeData(d.items || []) }
      if (kakaoRes.ok) { const d = await kakaoRes.json(); setKakaoData(d.documents?.[0] || null) }
    } catch {}
    setMarketingLoading(false)
  }

  useEffect(() => {
    if (savedKeyword) fetchMarketingData(savedKeyword)
  }, [savedKeyword, year, month])

  function toggleDrop(key: string) {
    setOpenDrops(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ── 블로그 데이터 이번달 필터링 ──
  const blogThisMonth = useMemo(() => {
    const from = new Date(year, month, 1)
    const to = new Date(year, month+1, 0)
    return blogData.filter(item => {
      const d = new Date(item.postdate)
      return d >= from && d <= to
    })
  }, [blogData, year, month])

  const cafeThisMonth = useMemo(() => {
    const from = new Date(year, month, 1)
    const to = new Date(year, month+1, 0)
    return cafeData.filter(item => {
      const d = new Date(item.postdate)
      return d >= from && d <= to
    })
  }, [cafeData, year, month])

  // 블로그 주차별 집계
  const blogByWeek = useMemo(() => {
    const weeks: Record<number, number> = {1:0,2:0,3:0,4:0,5:0}
    blogThisMonth.forEach(item => {
      const d = new Date(item.postdate)
      const day = d.getDate()
      const w = Math.ceil(day/7)
      weeks[Math.min(w,5)]++
    })
    return weeks
  }, [blogThisMonth])

  // 날씨별 매출 분석
  const weatherStats = useMemo(() => {
    const map: Record<string,{days:number;total:number;counts:number}> = {}
    daily.forEach(d => {
      if (d.weatherCode === null || d.weatherCode === undefined) return
      const icon = weatherIcon(d.weatherCode)
      const label = d.weatherCode === 0 ? '맑음' : d.weatherCode <= 2 ? '구름조금' : d.weatherCode <= 3 ? '흐림' : d.weatherCode <= 49 ? '안개' : d.weatherCode <= 67 ? '비' : d.weatherCode <= 77 ? '눈' : '기타'
      if (!map[label]) map[label] = {days:0,total:0,counts:0}
      map[label].days++; map[label].total+=d.amount; map[label].counts+=d.count
    })
    return Object.entries(map).map(([label,v]) => ({
      label, icon: label==='맑음'?'☀️':label==='구름조금'?'🌤️':label==='흐림'?'☁️':label==='비'?'🌧️':label==='눈'?'❄️':'🌫️',
      days:v.days, avg:v.days>0?Math.round(v.total/v.days):0, total:v.total, counts:v.counts
    })).sort((a,b) => b.avg-a.avg)
  }, [daily])

  const baseWeatherAvg = weatherStats.find(w=>w.label==='흐림')?.avg || weatherStats[Math.floor(weatherStats.length/2)]?.avg || 0

  // 스타일 상수
  const card = { background:'#fff', borderRadius:16, border:'1px solid #E8ECF0', marginBottom:10, boxShadow:'0 1px 4px rgba(0,0,0,0.04)', overflow:'hidden' as const }
  const dropHeader = { padding:'15px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', userSelect:'none' as const }
  const dropBodyStyle = (open:boolean) => ({ maxHeight: open ? '9999px' : '0', overflow:'hidden' as const, transition:'max-height .35s ease' })
  const subCard = { background:'#F8F9FB', borderRadius:12, border:'1px solid #E8ECF0', marginTop:10, overflow:'hidden' as const }
  const tbl = { width:'100%', borderCollapse:'collapse' as const }

  function DropSection({ id, title, summary, summaryColor='#00B894', children }: { id:string; title:string; summary:string; summaryColor?:string; children:React.ReactNode }) {
    const open = !!openDrops[id]
    return (
      <div style={card}>
        <div style={dropHeader} onClick={() => toggleDrop(id)}>
          <div style={{ fontSize:14, fontWeight:800, color:'#1a1a2e' }}>{title}</div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:11, fontWeight:700, padding:'3px 10px', borderRadius:20, background:`${summaryColor}18`, color:summaryColor }}>{summary}</span>
            <span style={{ fontSize:11, color:'#bbb', transform:open?'rotate(180deg)':'none', transition:'transform .25s', display:'inline-block' }}>▼</span>
          </div>
        </div>
        <div style={dropBodyStyle(open)}>
          <div style={{ padding:'0 18px 18px', borderTop:'1px solid #F0F2F5' }}>
            {children}
          </div>
        </div>
      </div>
    )
  }

  function SubSection({ id, title, children }: { id:string; title:string; children:React.ReactNode }) {
    const open = !!openDrops[id]
    return (
      <div style={subCard}>
        <div style={{ ...dropHeader, padding:'11px 14px' }} onClick={() => toggleDrop(id)}>
          <div style={{ fontSize:12, fontWeight:700, color:'#555' }}>{title}</div>
          <span style={{ fontSize:10, color:'#bbb', transform:open?'rotate(180deg)':'none', transition:'transform .25s', display:'inline-block' }}>▼</span>
        </div>
        <div style={dropBodyStyle(open)}>
          <div style={{ padding:'10px 14px', borderTop:'1px solid #E8ECF0' }}>
            {children}
          </div>
        </div>
      </div>
    )
  }

  function HBar({ label, value, max, color, suffix='' }: { label:string; value:number; max:number; color:string; suffix?:string }) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
        <div style={{ fontSize:11, color:'#555', width:72, flexShrink:0 }}>{label}</div>
        <div style={{ flex:1, background:'#F0F2F5', borderRadius:99, height:8, overflow:'hidden' }}>
          <div style={{ width:`${max>0?Math.round((value/max)*100):0}%`, height:'100%', background:color, borderRadius:99 }} />
        </div>
        <div style={{ fontSize:11, fontWeight:700, color, minWidth:60, textAlign:'right' }}>{suffix || fmtW(value)}</div>
      </div>
    )
  }

  function KpiMini({ label, value, color='#1a1a2e', sub, border }: { label:string; value:string; color?:string; sub?:string; border?:string }) {
    return (
      <div style={{ background:'#F8F9FB', borderRadius:10, padding:'10px 12px', border: border||'1px solid #E8ECF0' }}>
        <div style={{ fontSize:9, color:'#aaa', marginBottom:3, fontWeight:600 }}>{label}</div>
        <div style={{ fontSize:15, fontWeight:800, color }}>{value}</div>
        {sub && <div style={{ fontSize:9, color:'#aaa', marginTop:2 }}>{sub}</div>}
      </div>
    )
  }

  const maxDow = Math.max(...dowStats.map(d=>d.value),1)
  const totalReviewsMonth = daily.reduce((s,d)=>s+d.totalReviews,0)
  const totalRepliesMonth = daily.reduce((s,d)=>s+d.totalReplies,0)
  const replyRate = totalReviewsMonth>0?Math.round((totalRepliesMonth/totalReviewsMonth)*100):0
  const reviewDays = daily.filter(d=>d.totalReviews>0)
  const noReviewDays = daily.filter(d=>d.totalReviews===0&&d.amount>0)
  const reviewDayAvg = reviewDays.length>0?Math.round(reviewDays.reduce((s,d)=>s+d.amount,0)/reviewDays.length):0
  const noReviewDayAvg = noReviewDays.length>0?Math.round(noReviewDays.reduce((s,d)=>s+d.amount,0)/noReviewDays.length):0
  const maxPlatform = Math.max(...platforms.map(p=>p.amount),1)
  const prevMonthPct = prevTotal>0?Math.round(((totalSales-prevTotal)/prevTotal)*100):0
  const prevYearPct = prevYearTotal>0?Math.round(((totalSales-prevYearTotal)/prevYearTotal)*100):0

  // ── 탭별 콘텐츠 ──

  // ▶ 종합
  const overviewContent = (
    <div>
      {/* 핵심 KPI */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
        <div style={{ background:'linear-gradient(135deg,rgba(255,107,53,.05),#fff)', borderRadius:14, padding:'16px 18px', border:'1px solid rgba(255,107,53,.25)' }}>
          <div style={{ fontSize:10, color:'#aaa', fontWeight:600, marginBottom:6 }}>총 매출</div>
          <div style={{ fontSize:28, fontWeight:900, color:'#FF6B35', lineHeight:1 }}>{fmtW(totalSales)}</div>
          {prevTotal>0&&<div style={{ fontSize:11, fontWeight:700, marginTop:6, color:totalSales>=prevTotal?'#00B894':'#E84393' }}>{totalSales>=prevTotal?'▲':'▼'} {Math.abs(prevMonthPct)}% 전월비</div>}
          <div style={{ fontSize:11, color:'#aaa', marginTop:4 }}>일평균 {fmtW(daily.length>0?Math.round(totalSales/daily.length):0)} · {daily.length}일</div>
        </div>
        <div style={{ background:'linear-gradient(135deg,rgba(108,92,231,.05),#fff)', borderRadius:14, padding:'16px 18px', border:'1px solid rgba(108,92,231,.25)' }}>
          <div style={{ fontSize:10, color:'#aaa', fontWeight:600, marginBottom:6 }}>종합 객단가</div>
          <div style={{ fontSize:28, fontWeight:900, color:'#6C5CE7', lineHeight:1 }}>{fmtW(avgUnit)}</div>
          <div style={{ fontSize:11, color:'#aaa', marginTop:6 }}>총 {totalCount}건 · 취소 {totalCancel}건</div>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:10 }}>
        {[
          { label:'목표달성률', value: goalAmt>0?`${goalPct}%`:'-', color:'#FF6B35' },
          { label:'최고 매출일', value: daily.length>0?`${daily.reduce((a,b)=>b.amount>a.amount?b:a,daily[0]).day}일`:'–', color:'#00B894' },
          { label:'블로그 언급', value: blogThisMonth.length>0?`${blogThisMonth.length}건`:'–', color:'#6C5CE7' },
          { label:'리뷰 답글률', value: totalReviewsMonth>0?`${replyRate}%`:'–', color:replyRate>=80?'#00B894':replyRate>=50?'#FDC400':'#E84393' },
        ].map(s=>(
          <div key={s.label} style={{ background:'#fff', borderRadius:12, padding:'12px 14px', border:'1px solid #E8ECF0' }}>
            <div style={{ fontSize:10, color:'#aaa', marginBottom:3, fontWeight:600 }}>{s.label}</div>
            <div style={{ fontSize:18, fontWeight:800, color:s.color }}>{loading?'…':s.value}</div>
          </div>
        ))}
      </div>

      {/* 목표 달성률 */}
      {goalAmt>0&&(
        <div style={{ ...card, padding:'14px 18px', marginBottom:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <span style={{ fontSize:13, fontWeight:700 }}>🎯 월 목표 달성률</span>
            <span style={{ fontSize:18, fontWeight:900, color:goalPct>=100?'#00B894':'#FF6B35' }}>{goalPct}%</span>
          </div>
          <div style={{ background:'#F0F2F5', borderRadius:99, height:10, overflow:'hidden', marginBottom:6 }}>
            <div style={{ width:`${goalPct}%`, height:'100%', background:goalPct>=100?'#00B894':'linear-gradient(90deg,#FF6B35,#E84393)', borderRadius:99 }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#aaa' }}>
            <span>현재 {fmtW(totalSales)}</span><span>목표 {fmtW(goalAmt)}</span>
          </div>
          {goalPct<100&&<div style={{ marginTop:8, padding:'7px 12px', background:'rgba(108,92,231,.07)', borderRadius:8, fontSize:11, color:'#6C5CE7' }}>
            남은 금액 {fmtW(goalAmt-totalSales)} · 하루 {daily.length>0?fmtW(Math.round((goalAmt-totalSales)/Math.max(new Date(year,month+1,0).getDate()-daily[daily.length-1]?.day,1))):'-'} 필요
          </div>}
        </div>
      )}

      {/* 매출분석 요약 드롭 */}
      <DropSection id="ov-sales" title="📈 매출분석 요약" summary={`${fmtW(totalSales)} ${prevMonthPct>=0?'▲':'▼'}${Math.abs(prevMonthPct)}%`} summaryColor="#FF6B35">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginTop:14 }}>
          <KpiMini label="최고 매출일" value={daily.length>0?`${daily.reduce((a,b)=>b.amount>a.amount?b:a,daily[0]).day}일`:'-'} color="#FF6B35" sub={daily.length>0?fmtW(Math.max(...daily.map(d=>d.amount))):''} />
          <KpiMini label="최저 매출일" value={daily.filter(d=>d.amount>0).length>0?`${daily.filter(d=>d.amount>0).reduce((a,b)=>b.amount<a.amount?b:a,daily.filter(d=>d.amount>0)[0]).day}일`:'-'} color="#E84393" sub={daily.filter(d=>d.amount>0).length>0?fmtW(Math.min(...daily.filter(d=>d.amount>0).map(d=>d.amount))):''} />
          <KpiMini label="주말 비중" value={totalSales>0?`${Math.round((daily.filter(d=>d.dow===0||d.dow===6).reduce((s,d)=>s+d.amount,0)/totalSales)*100)}%`:'-'} color="#6C5CE7" />
        </div>
        <div style={{ marginTop:10 }}>
          {platforms.slice(0,3).map(p=>(
            <HBar key={p.name} label={p.name} value={p.amount} max={maxPlatform} color={p.color} />
          ))}
        </div>
      </DropSection>

      {/* 마케팅 요약 드롭 */}
      <DropSection id="ov-mkt" title="⭐ 마케팅 요약" summary={`리뷰 ${totalReviewsMonth}건 · 블로그 ${blogThisMonth.length}건`} summaryColor="#E84393">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginTop:14 }}>
          <KpiMini label="총 리뷰" value={`${totalReviewsMonth}건`} color="#FF6B35" />
          <KpiMini label="답글률" value={totalReviewsMonth>0?`${replyRate}%`:'-'} color={replyRate>=80?'#00B894':'#E84393'} />
          <KpiMini label="블로그+카페" value={`${blogThisMonth.length+cafeThisMonth.length}건`} color="#6C5CE7" />
        </div>
        {reviewDayAvg>0&&noReviewDayAvg>0&&(
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:10 }}>
            <div style={{ background:'rgba(0,184,148,.07)', borderRadius:10, padding:'10px 14px', border:'1px solid rgba(0,184,148,.2)' }}>
              <div style={{ fontSize:9, color:'#aaa', marginBottom:2 }}>리뷰 있는 날 평균</div>
              <div style={{ fontSize:16, fontWeight:800, color:'#00B894' }}>{fmtW(reviewDayAvg)}</div>
            </div>
            <div style={{ background:'rgba(108,92,231,.07)', borderRadius:10, padding:'10px 14px', border:'1px solid rgba(108,92,231,.2)' }}>
              <div style={{ fontSize:9, color:'#aaa', marginBottom:2 }}>블로그 많은 주 매출</div>
              <div style={{ fontSize:16, fontWeight:800, color:'#6C5CE7' }}>분석 중</div>
            </div>
          </div>
        )}
      </DropSection>

      {/* 인사이트 요약 드롭 */}
      <DropSection id="ov-ins" title="💡 인사이트 요약" summary={`즉시조치 ${insights.filter(i=>i.priority===1).length}건`} summaryColor="#E84393">
        <div style={{ marginTop:14 }}>
          {insights.slice(0,3).map((ins,i)=>(
            <div key={i} style={{ display:'flex', gap:10, padding:'10px 12px', borderRadius:12, background:i===0?`${ins.color}10`:'#F8F9FB', border:`1px solid ${i===0?ins.color+'30':'#E8ECF0'}`, marginBottom:8 }}>
              <span style={{ fontSize:18 }}>{ins.icon}</span>
              <div>
                <div style={{ fontSize:12, fontWeight:700, marginBottom:2 }}>{ins.title}</div>
                <div style={{ fontSize:11, color:'#777', lineHeight:1.5 }}>{ins.desc}</div>
              </div>
            </div>
          ))}
          {insights.length===0&&<div style={{ textAlign:'center', padding:'20px', color:'#ccc', fontSize:12 }}>데이터가 쌓이면 인사이트가 나타나요</div>}
        </div>
      </DropSection>
    </div>
  )

  // ▶ 매출분석
  const salesContent = (
    <div>
      {/* 일별 흐름 */}
      <DropSection id="s-daily" title="📅 일별 매출 흐름" summary={daily.length>0?`최고 ${daily.reduce((a,b)=>b.amount>a.amount?b:a,daily[0]).day}일 ${fmtW(Math.max(...daily.map(d=>d.amount)))}`:'-'} summaryColor="#FF6B35">
        <SubSection id="s-daily-chart" title="📊 일별 매출 바차트">
          {daily.length===0?<div style={{ textAlign:'center', padding:20, color:'#ccc', fontSize:12 }}>데이터 없음</div>:(()=>{
            const maxAmt = Math.max(...daily.map(d=>d.amount),1)
            return (
              <>
                <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:80, marginBottom:6 }}>
                  {daily.map(d=>(
                    <div key={d.day} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2, minWidth:0 }}>
                      <div style={{ flex:1, width:'100%', borderRadius:'3px 3px 0 0', background: d.dow===0||d.dow===6?'#6C5CE7':'#FF6B35', opacity: d.amount===Math.max(...daily.map(x=>x.amount))?1:0.6, height:`${Math.max((d.amount/maxAmt)*100,3)}%` }} />
                    </div>
                  ))}
                </div>
                <div style={{ display:'flex', gap:3 }}>
                  {daily.map(d=><div key={d.day} style={{ flex:1, textAlign:'center', fontSize:8, color:d.dow===0||d.dow===6?'#6C5CE7':'#aaa', minWidth:0 }}>{d.day}</div>)}
                </div>
              </>
            )
          })()}
        </SubSection>
        <SubSection id="s-daily-tbl" title="📋 일별 상세 테이블">
          <div style={{ overflowX:'auto' }}>
            <table style={tbl}>
              <thead>
                <tr style={{ borderBottom:'1px solid #F0F2F5' }}>
                  {['날짜','요일','날씨','매출','건수','객단가','전일비'].map(h=><th key={h} style={{ fontSize:10, color:'#aaa', fontWeight:700, padding:'6px 8px', textAlign:'left' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {daily.map((d,i)=>{
                  const prev = daily[i-1]
                  const diff = prev&&prev.amount>0?Math.round(((d.amount-prev.amount)/prev.amount)*100):null
                  return (
                    <tr key={d.day} style={{ borderBottom:'1px solid #F8F9FB' }}>
                      <td style={{ fontSize:12, padding:'8px 8px', fontWeight:600 }}>3/{d.day}</td>
                      <td style={{ fontSize:12, padding:'8px 8px', color:d.dow===0||d.dow===6?'#6C5CE7':'#888', fontWeight:d.dow===0||d.dow===6?700:400 }}>{DOW[d.dow]}</td>
                      <td style={{ fontSize:12, padding:'8px 8px' }}>{d.weatherCode!==null&&d.weatherCode!==undefined?weatherIcon(d.weatherCode):'-'}</td>
                      <td style={{ fontSize:12, padding:'8px 8px', fontWeight:700, color:'#FF6B35' }}>{fmtW(d.amount)}</td>
                      <td style={{ fontSize:12, padding:'8px 8px' }}>{d.count}건</td>
                      <td style={{ fontSize:12, padding:'8px 8px', color:'#6C5CE7' }}>{d.unitPrice>0?fmtW(d.unitPrice):'-'}</td>
                      <td style={{ fontSize:11, padding:'8px 8px', fontWeight:700, color:diff===null?'#aaa':diff>=0?'#00B894':'#E84393' }}>{diff===null?'-':`${diff>=0?'▲':'▼'}${Math.abs(diff)}%`}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SubSection>
        <SubSection id="s-daily-stats" title="📈 통계 요약">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
            <KpiMini label="일 평균" value={fmtW(daily.length>0?Math.round(totalSales/daily.length):0)} color="#FF6B35" />
            <KpiMini label="최고 매출" value={daily.length>0?fmtW(Math.max(...daily.map(d=>d.amount))):'-'} color="#00B894" sub={daily.length>0?`${daily.reduce((a,b)=>b.amount>a.amount?b:a,daily[0]).day}일`:''} />
            <KpiMini label="최저 매출" value={daily.filter(d=>d.amount>0).length>0?fmtW(Math.min(...daily.filter(d=>d.amount>0).map(d=>d.amount))):'-'} color="#E84393" sub={daily.filter(d=>d.amount>0).length>0?`${daily.filter(d=>d.amount>0).reduce((a,b)=>b.amount<a.amount?b:a,daily.filter(d=>d.amount>0)[0]).day}일`:''} />
          </div>
        </SubSection>
      </DropSection>

      {/* 요일별 패턴 */}
      <DropSection id="s-dow" title="📆 요일별 패턴" summary={dowStats.filter(d=>d.value>0).length>0?`${dowStats.filter(d=>d.value>0).sort((a,b)=>b.value-a.value)[0].label}요일 최고`:'-'} summaryColor="#2DC6D6">
        <SubSection id="s-dow-avg" title="📊 요일별 평균 매출">
          <div style={{ display:'flex', alignItems:'flex-end', gap:5, height:80, marginBottom:8 }}>
            {dowStats.map(d=>(
              <div key={d.label} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3, minWidth:0 }}>
                <div style={{ flex:1, width:'100%', borderRadius:'4px 4px 0 0', background:d.color, opacity: d.value===maxDow?1:0.55, minHeight:4, height:`${maxDow>0?(d.value/maxDow)*100:0}%` }} />
                <div style={{ fontSize:9, color:d.color, fontWeight:700 }}>{d.label}</div>
              </div>
            ))}
          </div>
          <table style={tbl}>
            <thead><tr style={{ borderBottom:'1px solid #F0F2F5' }}>
              {['요일','평균매출','평균건수','평균객단가','영업횟수'].map(h=><th key={h} style={{ fontSize:10, color:'#aaa', fontWeight:700, padding:'6px 8px', textAlign:'left' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {dowStats.filter(d=>d.value>0).map(d=>(
                <tr key={d.label} style={{ borderBottom:'1px solid #F8F9FB' }}>
                  <td style={{ fontSize:12, padding:'8px 8px', fontWeight:700, color:d.color }}>{d.label}</td>
                  <td style={{ fontSize:12, padding:'8px 8px', fontWeight:700, color:d.value===maxDow?'#FF6B35':'#1a1a2e' }}>{fmtW(d.value)}</td>
                  <td style={{ fontSize:12, padding:'8px 8px' }}>{Math.round(daily.filter(x=>DOW[x.dow]===d.label).reduce((s,x)=>s+x.count,0)/Math.max(d.count,1))}건</td>
                  <td style={{ fontSize:12, padding:'8px 8px', color:'#6C5CE7' }}>{d.value>0&&daily.filter(x=>DOW[x.dow]===d.label).reduce((s,x)=>s+x.count,0)>0?fmtW(Math.round(daily.filter(x=>DOW[x.dow]===d.label).reduce((s,x)=>s+x.amount,0)/daily.filter(x=>DOW[x.dow]===d.label).reduce((s,x)=>s+x.count,0))):'-'}</td>
                  <td style={{ fontSize:12, padding:'8px 8px', color:'#aaa' }}>{d.count}회</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SubSection>
        <SubSection id="s-dow-wknd" title="🆚 주중 vs 주말">
          {(()=>{
            const wknd = daily.filter(d=>d.dow===0||d.dow===6)
            const wkdy = daily.filter(d=>d.dow!==0&&d.dow!==6)
            const wkndAvg = wknd.length>0?Math.round(wknd.reduce((s,d)=>s+d.amount,0)/wknd.length):0
            const wkdyAvg = wkdy.length>0?Math.round(wkdy.reduce((s,d)=>s+d.amount,0)/wkdy.length):0
            return (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div style={{ background:'rgba(108,92,231,.07)', borderRadius:12, padding:14, border:'1px solid rgba(108,92,231,.2)' }}>
                  <div style={{ fontSize:10, color:'#aaa', marginBottom:4 }}>주중 평균 (월~금)</div>
                  <div style={{ fontSize:22, fontWeight:900, color:'#6C5CE7' }}>{fmtW(wkdyAvg)}</div>
                  <div style={{ fontSize:11, color:'#aaa', marginTop:4 }}>{wkdy.length}일 영업</div>
                </div>
                <div style={{ background:'rgba(255,107,53,.07)', borderRadius:12, padding:14, border:'1px solid rgba(255,107,53,.2)' }}>
                  <div style={{ fontSize:10, color:'#aaa', marginBottom:4 }}>주말 평균 (토/일)</div>
                  <div style={{ fontSize:22, fontWeight:900, color:'#FF6B35' }}>{fmtW(wkndAvg)}</div>
                  <div style={{ fontSize:11, color:'#aaa', marginTop:4 }}>{wknd.length}일 영업</div>
                </div>
              </div>
            )
          })()}
        </SubSection>
      </DropSection>

      {/* 플랫폼별 */}
      <DropSection id="s-platform" title="🥧 플랫폼별 분석" summary={platforms[0]?`${platforms[0].name} 1위 ${totalSales>0?Math.round((platforms[0].amount/totalSales)*100):0}%`:'-'} summaryColor="#FF6B35">
        <SubSection id="s-plat-share" title="💰 플랫폼별 매출 비중">
          <div style={{ overflowX:'auto' }}>
            <table style={tbl}>
              <thead><tr style={{ borderBottom:'1px solid #F0F2F5' }}>
                {['플랫폼','매출','비중','건수','객단가'].map(h=><th key={h} style={{ fontSize:10, color:'#aaa', fontWeight:700, padding:'6px 8px', textAlign:'left' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {platforms.map(p=>(
                  <tr key={p.name} style={{ borderBottom:'1px solid #F8F9FB' }}>
                    <td style={{ padding:'8px 8px' }}><span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:6, background:`${p.color}18`, color:p.color }}>{p.name}</span></td>
                    <td style={{ fontSize:12, padding:'8px 8px', fontWeight:700 }}>{fmtW(p.amount)}</td>
                    <td style={{ fontSize:12, padding:'8px 8px' }}>{totalSales>0?Math.round((p.amount/totalSales)*100):0}%</td>
                    <td style={{ fontSize:12, padding:'8px 8px' }}>{p.count}건</td>
                    <td style={{ fontSize:12, padding:'8px 8px', color:'#6C5CE7', fontWeight:700 }}>{p.count>0?fmtW(Math.round(p.amount/p.count)):'-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:10 }}>
            {platforms.map(p=><HBar key={p.name} label={p.name} value={p.amount} max={maxPlatform} color={p.color} />)}
          </div>
        </SubSection>
        <SubSection id="s-plat-unit" title="💡 플랫폼별 객단가 비교">
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
            {platforms.filter(p=>p.count>0).map(p=>{
              const pu = Math.round(p.amount/p.count)
              return (
                <div key={p.name} style={{ background:'#F8F9FB', borderRadius:10, padding:'12px', border:`1px solid ${p.color}40` }}>
                  <div style={{ fontSize:10, color:'#aaa', marginBottom:4 }}>{p.name}</div>
                  <div style={{ fontSize:18, fontWeight:800, color:p.color }}>{fmtW(pu)}</div>
                  {avgUnit>0&&<div style={{ fontSize:9, color:pu>=avgUnit?'#00B894':'#E84393', marginTop:2 }}>{pu>=avgUnit?'▲':'▼'} 종합비 {Math.abs(Math.round(((pu-avgUnit)/avgUnit)*100))}%</div>}
                </div>
              )
            })}
          </div>
        </SubSection>
      </DropSection>

      {/* 전월/전년 비교 */}
      <DropSection id="s-compare" title="📊 전월 / 전년 비교" summary={`전월 ${prevMonthPct>=0?'▲':'▼'}${Math.abs(prevMonthPct)}% · YoY ${prevYearPct>=0?'+':''}${prevYearPct}%`} summaryColor={prevMonthPct>=0?'#00B894':'#E84393'}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:14 }}>
          <div style={{ background:totalSales>=prevTotal?'rgba(0,184,148,.07)':'rgba(232,67,147,.07)', borderRadius:12, padding:14, border:`1px solid ${totalSales>=prevTotal?'rgba(0,184,148,.25)':'rgba(232,67,147,.25)'}` }}>
            <div style={{ fontSize:10, color:'#aaa', marginBottom:4 }}>전월 대비 ({prevMonthLabel})</div>
            <div style={{ fontSize:24, fontWeight:900, color:totalSales>=prevTotal?'#00B894':'#E84393' }}>{totalSales>=prevTotal?'▲':'▼'} {Math.abs(prevMonthPct)}%</div>
            <div style={{ fontSize:11, color:'#aaa', marginTop:6 }}>{prevMonthLabel} {fmtW(prevTotal)}</div>
            {prevTotal>0&&<div style={{ fontSize:11, fontWeight:700, marginTop:2, color:totalSales>=prevTotal?'#00B894':'#E84393' }}>{totalSales>=prevTotal?'+':''}{fmtW(Math.abs(totalSales-prevTotal))} {totalSales>=prevTotal?'증가':'감소'}</div>}
          </div>
          {prevYearTotal>0&&(
            <div style={{ background:totalSales>=prevYearTotal?'rgba(0,184,148,.07)':'rgba(232,67,147,.07)', borderRadius:12, padding:14, border:`1px solid ${totalSales>=prevYearTotal?'rgba(0,184,148,.25)':'rgba(232,67,147,.25)'}` }}>
              <div style={{ fontSize:10, color:'#aaa', marginBottom:4 }}>전년 동월 ({year-1}년 {month+1}월)</div>
              <div style={{ fontSize:24, fontWeight:900, color:totalSales>=prevYearTotal?'#00B894':'#E84393' }}>{totalSales>=prevYearTotal?'+':''}{prevYearPct}%</div>
              <div style={{ fontSize:11, color:'#aaa', marginTop:6 }}>{year-1}년 {month+1}월 {fmtW(prevYearTotal)}</div>
            </div>
          )}
        </div>
        <SubSection id="s-cmp-tbl" title="📋 항목별 비교">
          <table style={tbl}>
            <thead><tr style={{ borderBottom:'1px solid #F0F2F5' }}>
              {['항목','이번달','전월','전년동월'].map(h=><th key={h} style={{ fontSize:10, color:'#aaa', fontWeight:700, padding:'6px 8px', textAlign:'left' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {[
                { label:'총 매출', cur:fmtW(totalSales), prev:fmtW(prevTotal), pyear:fmtW(prevYearTotal) },
                { label:'객단가', cur:fmtW(avgUnit), prev:fmtW(prevClosings.length>0?Math.round(prevClosings.reduce((s,c)=>{const sv=prevSalesRows.filter(r=>r.closing_id===c.id);return s+sv.reduce((a,r)=>a+(r.amount||0),0)},0)/Math.max(prevClosings.reduce((s,c)=>{const sv=prevSalesRows.filter(r=>r.closing_id===c.id);return s+sv.reduce((a,r)=>a+(r.count||0),0)},0),1)):0), pyear:'-' },
                { label:'총 건수', cur:`${totalCount}건`, prev:`${prevClosings.length>0?prevSalesRows.reduce((s,r)=>s+(r.count||0),0):0}건`, pyear:`${prevYearClosings.length>0?prevYearSalesRows.reduce((s,r)=>s+(r.count||0),0):0}건` },
                { label:'영업일', cur:`${daily.length}일`, prev:`${prevClosings.length}일`, pyear:`${prevYearClosings.length}일` },
              ].map(r=>(
                <tr key={r.label} style={{ borderBottom:'1px solid #F8F9FB' }}>
                  <td style={{ fontSize:12, padding:'8px 8px', fontWeight:600 }}>{r.label}</td>
                  <td style={{ fontSize:12, padding:'8px 8px', fontWeight:700, color:'#FF6B35' }}>{r.cur}</td>
                  <td style={{ fontSize:12, padding:'8px 8px', color:'#888' }}>{r.prev}</td>
                  <td style={{ fontSize:12, padding:'8px 8px', color:'#aaa' }}>{r.pyear}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SubSection>
      </DropSection>
    </div>
  )

  // ▶ 마케팅
  const marketingContent = (
    <div>
      {/* 리뷰 */}
      <DropSection id="m-review" title="⭐ 리뷰 분석" summary={`${totalReviewsMonth}건 · 답글률 ${replyRate}%`} summaryColor={replyRate>=80?'#00B894':'#E84393'}>
        <SubSection id="m-rev-daily" title="📅 일별 리뷰 × 매출 비교">
          <div style={{ overflowX:'auto' }}>
            <table style={tbl}>
              <thead><tr style={{ borderBottom:'1px solid #F0F2F5' }}>
                {['날짜','리뷰','답글','매출','리뷰영향'].map(h=><th key={h} style={{ fontSize:10, color:'#aaa', fontWeight:700, padding:'6px 8px', textAlign:'left' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {daily.map(d=>(
                  <tr key={d.day} style={{ borderBottom:'1px solid #F8F9FB' }}>
                    <td style={{ fontSize:12, padding:'8px 8px', fontWeight:600 }}>{month+1}/{d.day} {DOW[d.dow]}</td>
                    <td style={{ fontSize:12, padding:'8px 8px', fontWeight:700, color:d.totalReviews>0?'#FF6B35':'#ddd' }}>{d.totalReviews>0?`${d.totalReviews}건`:'-'}</td>
                    <td style={{ fontSize:12, padding:'8px 8px', color:d.totalReplies>0?'#00B894':'#ddd' }}>{d.totalReplies>0?`${d.totalReplies}건`:'-'}</td>
                    <td style={{ fontSize:12, padding:'8px 8px', fontWeight:700, color:'#FF6B35' }}>{fmtW(d.amount)}</td>
                    <td style={{ fontSize:12, padding:'8px 8px' }}>
                      {d.totalReviews>0?<span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:6, background:'rgba(0,184,148,.1)', color:'#00B894' }}>있음</span>
                      :<span style={{ fontSize:10, padding:'2px 7px', borderRadius:6, background:'#F4F6F9', color:'#bbb' }}>없음</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {reviewDayAvg>0&&noReviewDayAvg>0&&(
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:10 }}>
              <div style={{ background:'rgba(0,184,148,.07)', borderRadius:10, padding:'10px 14px', border:'1px solid rgba(0,184,148,.2)' }}>
                <div style={{ fontSize:9, color:'#aaa', marginBottom:2 }}>리뷰 있는 날 평균 ({reviewDays.length}일)</div>
                <div style={{ fontSize:17, fontWeight:800, color:'#00B894' }}>{fmtW(reviewDayAvg)}</div>
              </div>
              <div style={{ background:'rgba(232,67,147,.06)', borderRadius:10, padding:'10px 14px', border:'1px solid rgba(232,67,147,.15)' }}>
                <div style={{ fontSize:9, color:'#aaa', marginBottom:2 }}>리뷰 없는 날 평균 ({noReviewDays.length}일)</div>
                <div style={{ fontSize:17, fontWeight:800, color:'#E84393' }}>{fmtW(noReviewDayAvg)}</div>
              </div>
            </div>
          )}
        </SubSection>
        <SubSection id="m-rev-plat" title="🏪 플랫폼별 리뷰 현황">
          <table style={tbl}>
            <thead><tr style={{ borderBottom:'1px solid #F0F2F5' }}>
              {['플랫폼','리뷰','답글','답글률','평균매출'].map(h=><th key={h} style={{ fontSize:10, color:'#aaa', fontWeight:700, padding:'6px 8px', textAlign:'left' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {reviewPlatforms.map(p=>(
                <tr key={p.name} style={{ borderBottom:'1px solid #F8F9FB' }}>
                  <td style={{ fontSize:12, padding:'8px 8px', fontWeight:700 }}>{p.name}</td>
                  <td style={{ fontSize:12, padding:'8px 8px', fontWeight:700, color:'#FF6B35' }}>{p.reviews}건</td>
                  <td style={{ fontSize:12, padding:'8px 8px', color:'#00B894' }}>{p.replies}건</td>
                  <td style={{ fontSize:12, padding:'8px 8px', fontWeight:700, color:p.replyRate>=80?'#00B894':'#E84393' }}>{p.replyRate}%</td>
                  <td style={{ fontSize:12, padding:'8px 8px', color:'#6C5CE7' }}>{p.avgSalesPerReview>0?fmtW(p.avgSalesPerReview):'-'}</td>
                </tr>
              ))}
              {reviewPlatforms.length===0&&<tr><td colSpan={5} style={{ textAlign:'center', padding:20, color:'#ccc', fontSize:12 }}>리뷰 데이터 없음</td></tr>}
            </tbody>
          </table>
        </SubSection>
      </DropSection>

      {/* 블로그/카페/카카오 */}
      <DropSection id="m-blog" title="📝 온라인 언급 분석" summary={`블로그 ${blogThisMonth.length}건 · 카페 ${cafeThisMonth.length}건`} summaryColor="#6C5CE7">
        {/* 키워드 설정 */}
        <div style={{ marginTop:14, padding:'12px 14px', background:'rgba(108,92,231,.06)', borderRadius:12, border:'1px solid rgba(108,92,231,.2)', marginBottom:12 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#6C5CE7', marginBottom:8 }}>🔍 검색 키워드 설정</div>
          <div style={{ display:'flex', gap:8 }}>
            <input
              value={searchKeyword}
              onChange={e=>setSearchKeyword(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&saveKeyword()}
              placeholder="예: 파스타랑 고덕"
              style={{ flex:1, padding:'8px 12px', borderRadius:8, border:'1px solid rgba(108,92,231,.3)', fontSize:12, outline:'none', background:'#fff' }}
            />
            <button
              onClick={saveKeyword}
              disabled={keywordSaving||!searchKeyword.trim()}
              style={{ padding:'8px 16px', borderRadius:8, border:'none', background:'#6C5CE7', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', opacity:keywordSaving?0.6:1 }}
            >{keywordSaving?'저장 중...':'저장 · 검색'}</button>
          </div>
          {savedKeyword&&<div style={{ fontSize:10, color:'#aaa', marginTop:6 }}>현재 키워드: <strong style={{ color:'#6C5CE7' }}>{savedKeyword}</strong></div>}
        </div>

        {marketingLoading?(
          <div style={{ textAlign:'center', padding:30, color:'#aaa', fontSize:12 }}>🔍 데이터 수집 중...</div>
        ):(
          <>
            {/* 카카오맵 */}
            {kakaoData&&(
              <div style={{ padding:'12px 14px', background:'#FFF9E6', borderRadius:12, border:'1px solid rgba(253,196,0,.3)', marginBottom:10 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#B8860B', marginBottom:6 }}>🗺️ 카카오맵 정보</div>
                <div style={{ fontSize:13, fontWeight:800, color:'#1a1a2e', marginBottom:2 }}>{kakaoData.place_name}</div>
                <div style={{ fontSize:11, color:'#888' }}>{kakaoData.address_name}</div>
                <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>카테고리: {kakaoData.category_name}</div>
              </div>
            )}

            {/* 블로그 언급 */}
            <SubSection id="m-blog-list" title={`📝 네이버 블로그 이번 달 ${blogThisMonth.length}건`}>
              {blogThisMonth.length===0?(
                <div style={{ textAlign:'center', padding:16, color:'#ccc', fontSize:12 }}>{savedKeyword?'이번 달 블로그 언급 없음':'키워드를 먼저 설정해주세요'}</div>
              ):(
                <>
                  {/* 주차별 차트 */}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:12 }}>
                    {[1,2,3,4].map(w=>(
                      <div key={w} style={{ background:'#F8F9FB', borderRadius:8, padding:'8px', textAlign:'center', border:'1px solid #E8ECF0' }}>
                        <div style={{ fontSize:16, fontWeight:800, color:'#6C5CE7' }}>{blogByWeek[w]||0}</div>
                        <div style={{ fontSize:9, color:'#aaa' }}>{w}주차</div>
                      </div>
                    ))}
                  </div>
                  {/* 게시물 목록 */}
                  <div style={{ borderRadius:10, border:'1px solid #E8ECF0', overflow:'hidden' }}>
                    {blogThisMonth.slice(0,10).map((item,i)=>(
                      <div key={i} style={{ padding:'10px 14px', borderBottom:i<blogThisMonth.length-1?'1px solid #F0F2F5':'none', background:i%2===0?'#fff':'#FAFBFC' }}>
                        <div style={{ fontSize:12, fontWeight:700, color:'#6C5CE7', marginBottom:2 }}
                          dangerouslySetInnerHTML={{ __html: item.title.replace(/<[^>]*>/g,'') }} />
                        <div style={{ fontSize:10, color:'#aaa' }}>{item.postdate?.slice(0,4)}.{item.postdate?.slice(4,6)}.{item.postdate?.slice(6,8)}</div>
                      </div>
                    ))}
                  </div>
                  {blogThisMonth.length>10&&<div style={{ fontSize:11, color:'#aaa', textAlign:'center', marginTop:8 }}>외 {blogThisMonth.length-10}건 더 있어요</div>}
                </>
              )}
            </SubSection>

            {/* 카페 언급 */}
            <SubSection id="m-cafe-list" title={`☕ 네이버 카페 이번 달 ${cafeThisMonth.length}건`}>
              {cafeThisMonth.length===0?(
                <div style={{ textAlign:'center', padding:16, color:'#ccc', fontSize:12 }}>{savedKeyword?'이번 달 카페 언급 없음':'키워드를 먼저 설정해주세요'}</div>
              ):(
                <div style={{ borderRadius:10, border:'1px solid #E8ECF0', overflow:'hidden' }}>
                  {cafeThisMonth.slice(0,10).map((item,i)=>(
                    <div key={i} style={{ padding:'10px 14px', borderBottom:i<cafeThisMonth.length-1?'1px solid #F0F2F5':'none', background:i%2===0?'#fff':'#FAFBFC' }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#2DC6D6', marginBottom:2 }}
                        dangerouslySetInnerHTML={{ __html: item.title.replace(/<[^>]*>/g,'') }} />
                      <div style={{ fontSize:10, color:'#aaa' }}>{item.cafename} · {item.postdate?.slice(0,4)}.{item.postdate?.slice(4,6)}.{item.postdate?.slice(6,8)}</div>
                    </div>
                  ))}
                </div>
              )}
            </SubSection>
          </>
        )}
      </DropSection>

      {/* 메모/컴플레인 */}
      <DropSection id="m-memo" title="📌 메모 / 컴플레인 분석" summary={`${daily.filter(d=>d.note).length}건 컴플레인`} summaryColor="#E84393">
        {(()=>{
          const memoDays = daily.filter(d=>d.memo)
          const noteDays = daily.filter(d=>d.note)
          const normalDays = daily.filter(d=>!d.memo&&!d.note&&d.amount>0)
          const memoAvg = memoDays.length>0?Math.round(memoDays.reduce((s,d)=>s+d.amount,0)/memoDays.length):0
          const noteAvg = noteDays.length>0?Math.round(noteDays.reduce((s,d)=>s+d.amount,0)/noteDays.length):0
          const normalAvg = normalDays.length>0?Math.round(normalDays.reduce((s,d)=>s+d.amount,0)/normalDays.length):0
          return (
            <>
              <div style={{ display:'grid', gridTemplateColumns:`repeat(${[normalAvg>0,memoAvg>0,noteAvg>0].filter(Boolean).length},1fr)`, gap:8, marginTop:14, marginBottom:12 }}>
                {normalAvg>0&&<KpiMini label={`평상시 (${normalDays.length}일)`} value={fmtW(normalAvg)} color="#555" />}
                {memoAvg>0&&<KpiMini label={`특이사항 (${memoDays.length}일)`} value={fmtW(memoAvg)} color="#FF6B35" sub={normalAvg>0?`${memoAvg>=normalAvg?'▲':'▼'}${Math.abs(Math.round(((memoAvg-normalAvg)/normalAvg)*100))}%`:undefined} />}
                {noteAvg>0&&<KpiMini label={`컴플레인 (${noteDays.length}일)`} value={fmtW(noteAvg)} color="#E84393" sub={normalAvg>0?`${noteAvg>=normalAvg?'▲':'▼'}${Math.abs(Math.round(((noteAvg-normalAvg)/normalAvg)*100))}%`:undefined} />}
              </div>
              {(memoDays.length>0||noteDays.length>0)&&(
                <SubSection id="m-memo-list" title="📋 메모/컴플레인 목록">
                  <table style={tbl}>
                    <thead><tr style={{ borderBottom:'1px solid #F0F2F5' }}>
                      {['날짜','유형','내용','매출'].map(h=><th key={h} style={{ fontSize:10, color:'#aaa', fontWeight:700, padding:'6px 8px', textAlign:'left' }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {[...memoDays.map(d=>({...d,type:'특이'})),...noteDays.map(d=>({...d,type:'컴플레인'}))].sort((a,b)=>a.day-b.day).map(d=>(
                        <tr key={d.day+d.type} style={{ borderBottom:'1px solid #F8F9FB' }}>
                          <td style={{ fontSize:12, padding:'8px 8px' }}>{month+1}/{d.day}</td>
                          <td style={{ padding:'8px 8px' }}><span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:6, background:d.type==='컴플레인'?'rgba(232,67,147,.1)':'rgba(255,107,53,.1)', color:d.type==='컴플레인'?'#E84393':'#FF6B35' }}>{d.type}</span></td>
                          <td style={{ fontSize:11, padding:'8px 8px', color:'#666', maxWidth:160 }}>{d.type==='특이'?d.memo:d.note}</td>
                          <td style={{ fontSize:12, padding:'8px 8px', fontWeight:700, color:'#FF6B35' }}>{fmtW(d.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </SubSection>
              )}
            </>
          )
        })()}
      </DropSection>
    </div>
  )

  // ▶ 인사이트
  const insightContent = (
    <div>
      {/* 날씨 × 매출 */}
      <DropSection id="i-weather" title="🌤️ 날씨 × 매출 분석" summary={weatherStats.length>0?`${weatherStats[0].label} 최고 ${fmtW(weatherStats[0].avg)}`:'-'} summaryColor="#2DC6D6">
        {weatherStats.length===0?(
          <div style={{ textAlign:'center', padding:30, color:'#ccc', fontSize:12, marginTop:14 }}>날씨 데이터가 쌓이면 분석이 나타나요</div>
        ):(
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8, marginTop:14 }}>
              {weatherStats.map(w=>(
                <div key={w.label} style={{ background:'#F8F9FB', borderRadius:12, padding:'12px', border:'1px solid #E8ECF0', textAlign:'center' }}>
                  <div style={{ fontSize:22, marginBottom:4 }}>{w.icon}</div>
                  <div style={{ fontSize:10, color:'#aaa', marginBottom:5, fontWeight:600 }}>{w.label}</div>
                  <div style={{ fontSize:16, fontWeight:900, color:'#FF6B35' }}>{fmtW(w.avg)}</div>
                  <div style={{ fontSize:9, color:'#bbb', marginTop:2 }}>{w.days}일 · {w.counts}건</div>
                  {baseWeatherAvg>0&&w.avg!==baseWeatherAvg&&(
                    <div style={{ fontSize:10, fontWeight:700, marginTop:4, color:w.avg>=baseWeatherAvg?'#00B894':'#E84393' }}>
                      {w.avg>=baseWeatherAvg?'▲':'▼'} {Math.abs(Math.round(((w.avg-baseWeatherAvg)/baseWeatherAvg)*100))}%
                    </div>
                  )}
                </div>
              ))}
            </div>
            <SubSection id="i-wx-tbl" title="📋 일별 날씨 × 매출 대조표">
              <div style={{ overflowX:'auto' }}>
                <table style={tbl}>
                  <thead><tr style={{ borderBottom:'1px solid #F0F2F5' }}>
                    {['날짜','날씨','최고기온','최저기온','매출','건수'].map(h=><th key={h} style={{ fontSize:10, color:'#aaa', fontWeight:700, padding:'6px 8px', textAlign:'left' }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {daily.map(d=>(
                      <tr key={d.day} style={{ borderBottom:'1px solid #F8F9FB' }}>
                        <td style={{ fontSize:12, padding:'8px 8px', fontWeight:600 }}>{month+1}/{d.day}</td>
                        <td style={{ fontSize:12, padding:'8px 8px' }}>{d.weatherCode!==null&&d.weatherCode!==undefined?weatherIcon(d.weatherCode):'-'}</td>
                        <td style={{ fontSize:12, padding:'8px 8px', color:'#FF6B35' }}>{d.tempMax!=null?`${d.tempMax}°`:'-'}</td>
                        <td style={{ fontSize:12, padding:'8px 8px', color:'#2DC6D6' }}>{d.tempMin!=null?`${d.tempMin}°`:'-'}</td>
                        <td style={{ fontSize:12, padding:'8px 8px', fontWeight:700, color:'#FF6B35' }}>{fmtW(d.amount)}</td>
                        <td style={{ fontSize:12, padding:'8px 8px' }}>{d.count}건</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SubSection>
          </>
        )}
      </DropSection>

      {/* 액션 인사이트 */}
      <DropSection id="i-action" title="⚡ 액션 인사이트" summary={`즉시조치 ${insights.filter(i=>i.priority===1).length}건 · 권고 ${insights.filter(i=>i.priority===2).length}건`} summaryColor="#E84393">
        {daily.length===0?(
          <div style={{ textAlign:'center', padding:30, color:'#ccc', fontSize:12, marginTop:14 }}>마감일지를 작성하면 인사이트가 나타나요</div>
        ):(
          <div style={{ marginTop:14 }}>
            {insights.filter(i=>i.priority===1).length>0&&(
              <>
                <div style={{ fontSize:10, fontWeight:700, color:'#E84393', marginBottom:8, letterSpacing:.5 }}>🔴 즉시 조치</div>
                {insights.filter(i=>i.priority===1).map((ins,i)=>(
                  <div key={i} style={{ display:'flex', gap:10, padding:'12px 14px', borderRadius:12, background:'rgba(232,67,147,.07)', border:'1px solid rgba(232,67,147,.2)', marginBottom:8 }}>
                    <span style={{ fontSize:18 }}>{ins.icon}</span>
                    <div><div style={{ fontSize:12, fontWeight:700, marginBottom:3 }}>{ins.title}</div><div style={{ fontSize:11, color:'#777', lineHeight:1.5 }}>{ins.desc}</div>
                    {ins.action&&<div style={{ marginTop:6, fontSize:11, fontWeight:700, color:'#E84393', padding:'3px 10px', background:'rgba(232,67,147,.1)', borderRadius:7, display:'inline-block' }}>→ {ins.action}</div>}</div>
                  </div>
                ))}
              </>
            )}
            {insights.filter(i=>i.priority===2).length>0&&(
              <>
                <div style={{ fontSize:10, fontWeight:700, color:'#FDC400', marginBottom:8, letterSpacing:.5, marginTop:12 }}>🟡 개선 권고</div>
                {insights.filter(i=>i.priority===2).map((ins,i)=>(
                  <div key={i} style={{ display:'flex', gap:10, padding:'12px 14px', borderRadius:12, background:'rgba(253,196,0,.07)', border:'1px solid rgba(253,196,0,.3)', marginBottom:8 }}>
                    <span style={{ fontSize:18 }}>{ins.icon}</span>
                    <div><div style={{ fontSize:12, fontWeight:700, marginBottom:3 }}>{ins.title}</div><div style={{ fontSize:11, color:'#777', lineHeight:1.5 }}>{ins.desc}</div>
                    {ins.action&&<div style={{ marginTop:6, fontSize:11, fontWeight:700, color:'#B8860B', padding:'3px 10px', background:'rgba(253,196,0,.12)', borderRadius:7, display:'inline-block' }}>→ {ins.action}</div>}</div>
                  </div>
                ))}
              </>
            )}
            {insights.filter(i=>i.priority>=3).length>0&&(
              <>
                <div style={{ fontSize:10, fontWeight:700, color:'#00B894', marginBottom:8, letterSpacing:.5, marginTop:12 }}>✅ 잘하고 있어요</div>
                {insights.filter(i=>i.priority>=3).map((ins,i)=>(
                  <div key={i} style={{ display:'flex', gap:10, padding:'12px 14px', borderRadius:12, background:'rgba(0,184,148,.07)', border:'1px solid rgba(0,184,148,.2)', marginBottom:8 }}>
                    <span style={{ fontSize:18 }}>{ins.icon}</span>
                    <div><div style={{ fontSize:12, fontWeight:700, marginBottom:3 }}>{ins.title}</div><div style={{ fontSize:11, color:'#777', lineHeight:1.5 }}>{ins.desc}</div></div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </DropSection>
    </div>
  )

  const TAB_LIST = [
    { id:'overview', label:'🏠 종합', content: overviewContent },
    { id:'sales', label:'📈 매출분석', content: salesContent },
    { id:'marketing', label:'⭐ 마케팅', content: marketingContent },
    { id:'insight', label:'💡 인사이트', content: insightContent },
  ]

  return (
    <div style={{ background:'#F2F4F7', minHeight:'100vh', paddingBottom:80 }}>
      {/* 탭 네비 */}
      <div style={{ background:'#fff', borderBottom:'1px solid #E8ECF0', padding:'0 16px', display:'flex', gap:2, overflowX:'auto', position:'sticky', top:0, zIndex:100 }}>
        {TAB_LIST.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id as any)}
            style={{ padding:'13px 16px', fontSize:12, fontWeight:700, color:tab===t.id?'#FF6B35':'#aaa', border:'none', background:'none', cursor:'pointer', whiteSpace:'nowrap', borderBottom:`3px solid ${tab===t.id?'#FF6B35':'transparent'}`, transition:'all .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 월 선택 */}
      <div style={{ padding:'12px 16px', background:'#fff', borderBottom:'1px solid #E8ECF0' }}>
        <MonthNav year={year} month={month} onChange={(y,m)=>{setYear(y);setMonth(m)}} />
      </div>

      {/* 콘텐츠 */}
      <div style={{ padding:'12px 16px', maxWidth:860, margin:'0 auto' }}>
        {loading?(
          <div style={{ textAlign:'center', padding:60, color:'#ccc' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>📊</div>
            <div style={{ fontSize:14 }}>데이터 로딩 중...</div>
          </div>
        ):(
          TAB_LIST.find(t=>t.id===tab)?.content
        )}
      </div>
    </div>
  )
}