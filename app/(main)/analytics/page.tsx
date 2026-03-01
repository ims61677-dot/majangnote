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

// ── 년/월 네비게이터 ──
function MonthNav({ year, month, onChange, compact=false }: {
  year: number; month: number
  onChange: (y: number, m: number) => void
  compact?: boolean
}) {
  function go(delta: number) {
    let m = month + delta, y = year
    if (m < 0) { y--; m = 11 }
    if (m > 11) { y++; m = 0 }
    onChange(y, m)
  }
  function goYear(delta: number) { onChange(year + delta, month) }
  const now = new Date()
  const isCurrent = year === now.getFullYear() && month === now.getMonth()

  return (
    <div style={{ display:'flex', alignItems:'center', gap: compact?4:6, flexWrap:'wrap' }}>
      {/* 연도 이동 */}
      <button onClick={() => goYear(-1)} style={{ padding: compact?'3px 7px':'4px 10px', borderRadius:6, border:'1px solid #E8ECF0', background:'#F8F9FB', cursor:'pointer', fontSize:11, color:'#888', fontWeight:600 }}>
        ‹‹ {year-1}
      </button>
      {/* 월 이동 */}
      <button onClick={() => go(-1)} style={{ width:compact?26:30, height:compact?26:30, borderRadius:8, border:'1px solid #E8ECF0', background:'#fff', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', color:'#555' }}>‹</button>
      <span style={{ fontSize: compact?14:17, fontWeight:800, color:'#1a1a2e', minWidth: compact?80:96, textAlign:'center' }}>
        {year}년 {month+1}월
      </span>
      <button onClick={() => go(1)} style={{ width:compact?26:30, height:compact?26:30, borderRadius:8, border:'1px solid #E8ECF0', background:'#fff', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', color:'#555' }}>›</button>
      {/* 연도 이동 */}
      <button onClick={() => goYear(1)} style={{ padding: compact?'3px 7px':'4px 10px', borderRadius:6, border:'1px solid #E8ECF0', background:'#F8F9FB', cursor:'pointer', fontSize:11, color:'#888', fontWeight:600 }}>
        {year+1} ››
      </button>
      {/* 이번달 버튼 */}
      {!isCurrent && (
        <button onClick={() => onChange(now.getFullYear(), now.getMonth())}
          style={{ padding: compact?'3px 9px':'4px 12px', borderRadius:8, border:'1px solid rgba(255,107,53,0.4)', background:'rgba(255,107,53,0.08)', cursor:'pointer', fontSize:11, color:'#FF6B35', fontWeight:700 }}>
          이번달
        </button>
      )}
    </div>
  )
}

// ── 꺾은선 그래프 ──
function LineChart({ data, goal, color='#FF6B35', height=160, prevData }: {
  data: {x:number; y:number; label:string}[]
  prevData?: {x:number; y:number}[]
  goal?: number; color?: string; height?: number
}) {
  if (!data.length) return (
    <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color:'#ccc', fontSize:12 }}>데이터 없음</div>
  )
  const allY = [...data.map(d=>d.y), ...(prevData||[]).map(d=>d.y), goal||0]
  const maxY = Math.max(...allY) * 1.12 || 1
  const chartH = height - 22
  function toY(v: number) { return ((maxY - v) / maxY) * chartH }
  function toX(i: number, total: number) { return total <= 1 ? 50 : (i / (total-1)) * 100 }

  return (
    <div style={{ position:'relative', height }}>
      <svg width="100%" height={chartH} style={{ overflow:'visible' }}>
        <defs>
          <linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* 목표선 */}
        {goal && goal > 0 && (
          <line x1="0%" y1={toY(goal)} x2="100%" y2={toY(goal)}
            stroke="#6C5CE7" strokeWidth="1.5" strokeDasharray="5,4" />
        )}
        {/* 전월 선 */}
        {prevData && prevData.length > 1 && (
          <polyline
            points={prevData.map((d,i) => `${toX(i,prevData!.length)}%,${toY(d.y)}`).join(' ')}
            fill="none" stroke="#6C5CE7" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.5" />
        )}
        {/* 이번달 면적 */}
        {data.length > 1 && (
          <polygon
            points={[
              ...data.map((d,i) => `${toX(i,data.length)}%,${toY(d.y)}`),
              `${toX(data.length-1,data.length)}%,${chartH}`, `0%,${chartH}`
            ].join(' ')}
            fill="url(#lg1)" />
        )}
        {/* 이번달 선 */}
        <polyline
          points={data.map((d,i) => `${toX(i,data.length)}%,${toY(d.y)}`).join(' ')}
          fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* 점 */}
        {data.map((d,i) => (
          <circle key={i} cx={`${toX(i,data.length)}%`} cy={toY(d.y)}
            r={3.5} fill="#fff" stroke={color} strokeWidth="2" />
        ))}
      </svg>
      {/* X축 */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, display:'flex' }}>
        {data.map((d,i) => (
          <div key={i} style={{ flex:1, textAlign:'center', fontSize:9, color:'#bbb' }}>{d.label}</div>
        ))}
      </div>
    </div>
  )
}

// ── 막대 그래프 ──
function BarChart({ data, height=120 }: { data:{label:string;value:number;color?:string}[]; height?:number }) {
  const maxV = Math.max(...data.map(d=>d.value), 1)
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:4, height, paddingBottom:20 }}>
      {data.map((d,i) => {
        const h = maxV > 0 ? Math.max(Math.round((d.value/maxV)*(height-20)), d.value>0?4:0) : 0
        const isMax = d.value === maxV && d.value > 0
        return (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', height:'100%' }}>
            {d.value > 0 && <div style={{ fontSize:8, color: isMax?(d.color||COLORS[0]):'#bbb', marginBottom:2, fontWeight:isMax?700:400 }}>{fmtW(d.value)}</div>}
            <div style={{ width:'100%', height:h, borderRadius:'4px 4px 0 0',
              background: isMax ? (d.color||COLORS[0]) : `${d.color||COLORS[0]}66` }} />
            <div style={{ fontSize:10, color: isMax?'#555':'#aaa', marginTop:3, fontWeight:isMax?700:400 }}>{d.label}</div>
          </div>
        )
      })}
    </div>
  )
}

// ── 파이차트 ──
function PieChart({ data, size=130 }: { data:{label:string;value:number;color:string}[]; size?:number }) {
  const total = data.reduce((s,d)=>s+d.value,0)
  if (!total) return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:'#F4F6F9', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#ccc' }}>없음</div>
  )
  const r = size/2 - 6, cx = size/2, cy = size/2
  let cumAngle = -90
  function toXY(angle: number) {
    const rad = angle * Math.PI / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }
  return (
    <svg width={size} height={size}>
      {data.filter(d=>d.value>0).map((d,i) => {
        const angle = (d.value/total)*360
        const start = toXY(cumAngle)
        cumAngle += angle
        const end = toXY(cumAngle)
        const large = angle > 180 ? 1 : 0
        return (
          <path key={i}
            d={`M${cx},${cy} L${start.x},${start.y} A${r},${r} 0 ${large},1 ${end.x},${end.y} Z`}
            fill={d.color} stroke="#fff" strokeWidth="2.5" />
        )
      })}
      <circle cx={cx} cy={cy} r={r*0.52} fill="#fff" />
      <text x={cx} y={cy-5} textAnchor="middle" fontSize="10" fill="#aaa">{data.filter(d=>d.value>0).length}개</text>
      <text x={cx} y={cy+9} textAnchor="middle" fontSize="9" fill="#bbb">플랫폼</text>
    </svg>
  )
}

export default function AnalyticsPage() {
  const supabase = createSupabaseBrowserClient()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [storeId, setStoreId] = useState('')
  const [isPC, setIsPC] = useState<boolean|null>(null)
  const [tab, setTab] = useState<'sales'|'unit'|'dow'|'platform'|'compare'|'yearcmp'|'memo'>('sales')
  const [loading, setLoading] = useState(false)

  const [closings, setClosings] = useState<any[]>([])
  const [salesRows, setSalesRows] = useState<any[]>([])
  const [prevClosings, setPrevClosings] = useState<any[]>([])
  const [prevSalesRows, setPrevSalesRows] = useState<any[]>([])
  const [prevYearClosings, setPrevYearClosings] = useState<any[]>([])
  const [prevYearSalesRows, setPrevYearSalesRows] = useState<any[]>([])
  const [goal, setGoal] = useState<any>(null)

  useEffect(() => {
    const check = () => setIsPC(window.innerWidth >= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    if (!store.id) return
    setStoreId(store.id)
  }, [])

  useEffect(() => {
    if (!storeId) return
    loadData(storeId, year, month)
  }, [storeId, year, month])

  async function loadData(sid: string, y: number, m: number) {
    setLoading(true)
    const moNum = m + 1
    const from = `${y}-${pad(moNum)}-01`
    const to = `${y}-${pad(moNum)}-${pad(new Date(y, m+1, 0).getDate())}`

    const { data: cls } = await supabase.from('closings').select('*').eq('store_id', sid).gte('closing_date', from).lte('closing_date', to)
    setClosings(cls || [])
    if (cls && cls.length > 0) {
      const { data: sv } = await supabase.from('closing_sales').select('*').in('closing_id', cls.map((c:any)=>c.id))
      setSalesRows(sv || [])
    } else setSalesRows([])

    // 전월
    let pm = m - 1, py = y
    if (pm < 0) { pm = 11; py-- }
    const pmNum = pm + 1
    const pFrom = `${py}-${pad(pmNum)}-01`
    const pTo = `${py}-${pad(pmNum)}-${pad(new Date(py, pm+1, 0).getDate())}`
    const { data: pCls } = await supabase.from('closings').select('*').eq('store_id', sid).gte('closing_date', pFrom).lte('closing_date', pTo)
    setPrevClosings(pCls || [])
    if (pCls && pCls.length > 0) {
      const { data: pSv } = await supabase.from('closing_sales').select('*').in('closing_id', pCls.map((c:any)=>c.id))
      setPrevSalesRows(pSv || [])
    } else setPrevSalesRows([])

    // 전년도 같은 달
    const pyYear = y - 1
    const pyFrom = `${pyYear}-${pad(moNum)}-01`
    const pyTo = `${pyYear}-${pad(moNum)}-${pad(new Date(pyYear, m+1, 0).getDate())}`
    const { data: pyCls } = await supabase.from('closings').select('*').eq('store_id', sid).gte('closing_date', pyFrom).lte('closing_date', pyTo)
    setPrevYearClosings(pyCls || [])
    if (pyCls && pyCls.length > 0) {
      const { data: pySv } = await supabase.from('closing_sales').select('*').in('closing_id', pyCls.map((c:any)=>c.id))
      setPrevYearSalesRows(pySv || [])
    } else setPrevYearSalesRows([])

    const { data: g } = await supabase.from('goals').select('*').eq('store_id', sid).eq('year', y).eq('month', moNum).maybeSingle()
    setGoal(g || null)
    setLoading(false)
  }

  // ── 계산 ──
  const daily = useMemo(() => closings.map(cl => {
    const sv = salesRows.filter(s => s.closing_id === cl.id)
    const amount = sv.reduce((s,r)=>s+(r.amount||0),0)
    const count = sv.reduce((s,r)=>s+(r.count||0),0)
    const cancel = sv.reduce((s,r)=>s+(r.cancel_count||0),0)
    const day = parseInt(cl.closing_date.split('-')[2])
    const dow = new Date(cl.closing_date).getDay()
    return { day, dow, date: cl.closing_date, amount, count, cancel,
      unitPrice: count>0 ? Math.round(amount/count) : 0,
      discount: cl.discount_amount||0, memo: cl.memo||'', note: cl.note||'' }
  }).sort((a,b)=>a.day-b.day), [closings, salesRows])

  const prevDaily = useMemo(() => prevClosings.map(cl => {
    const sv = prevSalesRows.filter(s=>s.closing_id===cl.id)
    const amount = sv.reduce((s,r)=>s+(r.amount||0),0)
    const count = sv.reduce((s,r)=>s+(r.count||0),0)
    const day = parseInt(cl.closing_date.split('-')[2])
    return { day, amount, count, unitPrice: count>0?Math.round(amount/count):0 }
  }).sort((a,b)=>a.day-b.day), [prevClosings, prevSalesRows])

  const prevYearDaily = useMemo(() => prevYearClosings.map(cl => {
    const sv = prevYearSalesRows.filter(s=>s.closing_id===cl.id)
    const amount = sv.reduce((s,r)=>s+(r.amount||0),0)
    const count = sv.reduce((s,r)=>s+(r.count||0),0)
    const day = parseInt(cl.closing_date.split('-')[2])
    return { day, amount, count, unitPrice: count>0?Math.round(amount/count):0 }
  }).sort((a,b)=>a.day-b.day), [prevYearClosings, prevYearSalesRows])

  const totalSales = useMemo(()=>daily.reduce((s,d)=>s+d.amount,0),[daily])
  const totalCount = useMemo(()=>daily.reduce((s,d)=>s+d.count,0),[daily])
  const totalCancel = useMemo(()=>daily.reduce((s,d)=>s+d.cancel,0),[daily])
  const totalDiscount = useMemo(()=>daily.reduce((s,d)=>s+d.discount,0),[daily])
  const avgUnit = totalCount>0 ? Math.round(totalSales/totalCount) : 0
  const prevTotal = useMemo(()=>prevDaily.reduce((s,d)=>s+d.amount,0),[prevDaily])
  const prevYearTotal = useMemo(()=>prevYearDaily.reduce((s,d)=>s+d.amount,0),[prevYearDaily])

  const platforms = useMemo(()=>{
    const map: Record<string,{amount:number;count:number;cancel:number}> = {}
    salesRows.forEach(r=>{
      if (!map[r.platform]) map[r.platform]={amount:0,count:0,cancel:0}
      map[r.platform].amount+=r.amount||0
      map[r.platform].count+=r.count||0
      map[r.platform].cancel+=r.cancel_count||0
    })
    return Object.entries(map).map(([name,v],i)=>({name,...v,color:COLORS[i%COLORS.length]}))
      .sort((a,b)=>b.amount-a.amount)
  },[salesRows])

  const hallAmt = useMemo(()=>platforms.filter(p=>!['배달의민족','쿠팡이츠','요기요'].includes(p.name)).reduce((s,p)=>s+p.amount,0),[platforms])
  const delivAmt = useMemo(()=>platforms.filter(p=>['배달의민족','쿠팡이츠','요기요'].includes(p.name)).reduce((s,p)=>s+p.amount,0),[platforms])

  const dowStats = useMemo(()=>{
    const map: Record<number,number[]> = {0:[],1:[],2:[],3:[],4:[],5:[],6:[]}
    daily.forEach(d=>map[d.dow].push(d.amount))
    return [1,2,3,4,5,6,0].map(d=>({
      label:DOW[d], value:map[d].length?Math.round(map[d].reduce((a,b)=>a+b,0)/map[d].length):0,
      count:map[d].length, color:d===0||d===6?'#6C5CE7':'#FF6B35'
    }))
  },[daily])

  const prevMonthLabel = useMemo(()=>{
    let pm=month-1,py=year; if(pm<0){pm=11;py--}; return `${py}년 ${pm+1}월`
  },[year,month])

  const compareData = useMemo(()=>{
    const days = new Set([...daily.map(d=>d.day),...prevDaily.map(d=>d.day)])
    return Array.from(days).sort((a,b)=>a-b).map(day=>({
      day, curr:daily.find(d=>d.day===day)?.amount||0, prev:prevDaily.find(d=>d.day===day)?.amount||0
    })).filter(d=>d.curr>0||d.prev>0)
  },[daily,prevDaily])

  const memoData = useMemo(()=>daily.filter(d=>d.memo||d.note),[daily])

  if (isPC===null) return <div style={{minHeight:'100vh',background:'#F4F6F9'}} />

  const TAB_LIST = [
    {id:'sales',label:'📈 일별 매출'},
    {id:'unit',label:'💡 객단가'},
    {id:'dow',label:'📆 요일 패턴'},
    {id:'platform',label:'🥧 플랫폼'},
    {id:'compare',label:'🔄 전월 비교'},
    {id:'yearcmp',label:'📅 전년 비교'},
    {id:'memo',label:'📌 특이사항'},
  ]

  const summaryCards = [
    {label:'총 매출',value:fmtW(totalSales),color:'#FF6B35'},
    {label:'총 건수',value:`${totalCount}건`,color:'#6C5CE7'},
    {label:'객단가',value:fmtW(avgUnit),color:'#00B894'},
    {label:'취소/환불',value:`${totalCancel}건`,color:'#E84393'},
    {label:'영업일',value:`${daily.length}일`,color:'#555'},
    {label:'할인금액',value:fmtW(totalDiscount),color:'#FDC400'},
  ]

  const mainContent = (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>

      {/* 요약 카드 */}
      <div style={{display:'grid', gridTemplateColumns:isPC?'repeat(6,1fr)':'repeat(3,1fr)', gap:8, marginBottom:12}}>
        {summaryCards.map(s=>(
          <div key={s.label} style={{background:'#fff',borderRadius:12,border:'1px solid #E8ECF0',padding:isPC?'12px 16px':'10px 12px',boxShadow:'0 1px 3px rgba(0,0,0,0.04)'}}>
            <div style={{fontSize:10,color:'#aaa',marginBottom:3}}>{s.label}</div>
            <div style={{fontSize:isPC?17:14,fontWeight:800,color:s.color}}>{loading?'…':s.value}</div>
          </div>
        ))}
      </div>

      {/* 전월/전년 대비 배너 */}
      {!loading && (prevTotal>0 || prevYearTotal>0) && (
        <div style={{display:'grid',gridTemplateColumns:prevTotal>0&&prevYearTotal>0?'1fr 1fr':'1fr',gap:8,marginBottom:12}}>
          {prevTotal>0 && (
            <div style={{background:totalSales>=prevTotal?'rgba(0,184,148,0.08)':'rgba(232,67,147,0.08)',
              border:`1px solid ${totalSales>=prevTotal?'rgba(0,184,148,0.3)':'rgba(232,67,147,0.3)'}`,
              borderRadius:10,padding:'9px 14px',display:'flex',flexDirection:'column',gap:2}}>
              <span style={{fontSize:10,color:'#aaa'}}>전월 대비</span>
              <span style={{fontSize:14,fontWeight:800,color:totalSales>=prevTotal?'#00B894':'#E84393'}}>
                {totalSales>=prevTotal?'▲':'▼'} {prevTotal>0?Math.abs(Math.round(((totalSales-prevTotal)/prevTotal)*100)):0}%
              </span>
              <span style={{fontSize:10,color:'#aaa'}}>{prevMonthLabel} {fmtW(prevTotal)}</span>
            </div>
          )}
          {prevYearTotal>0 && (
            <div style={{background:totalSales>=prevYearTotal?'rgba(0,184,148,0.08)':'rgba(232,67,147,0.08)',
              border:`1px solid ${totalSales>=prevYearTotal?'rgba(0,184,148,0.3)':'rgba(232,67,147,0.3)'}`,
              borderRadius:10,padding:'9px 14px',display:'flex',flexDirection:'column',gap:2}}>
              <span style={{fontSize:10,color:'#aaa'}}>전년 동월 대비</span>
              <span style={{fontSize:14,fontWeight:800,color:totalSales>=prevYearTotal?'#00B894':'#E84393'}}>
                {totalSales>=prevYearTotal?'▲':'▼'} {Math.abs(Math.round(((totalSales-prevYearTotal)/prevYearTotal)*100))}%
              </span>
              <span style={{fontSize:10,color:'#aaa'}}>{year-1}년 {month+1}월 {fmtW(prevYearTotal)}</span>
            </div>
          )}
        </div>
      )}

      {/* 탭 */}
      <div style={{display:'flex',gap:4,marginBottom:14,overflowX:'auto',flexShrink:0,paddingBottom:2}}>
        {TAB_LIST.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id as any)}
            style={{padding:'7px 14px',borderRadius:20,border:tab===t.id?'none':'1px solid #E8ECF0',
              background:tab===t.id?'linear-gradient(135deg,#FF6B35,#E84393)':'#fff',
              color:tab===t.id?'#fff':'#888',fontSize:12,fontWeight:tab===t.id?700:500,
              cursor:'pointer',whiteSpace:'nowrap',flexShrink:0}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 컨텐츠 */}
      <div style={{flex:1,overflow:'auto'}}>
        {loading && <div style={{textAlign:'center',padding:'60px 0',color:'#aaa',fontSize:13}}>불러오는 중…</div>}

        {/* ── 일별 매출 ── */}
        {!loading && tab==='sales' && (
          <div>
            <div style={bx}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <span style={{fontSize:14,fontWeight:700,color:'#1a1a2e'}}>📈 일별 매출 흐름</span>
                {prevTotal>0 && <span style={{fontSize:10,color:'#aaa'}}>점선 = {prevMonthLabel}</span>}
              </div>
              {daily.length>0 ? (
                <LineChart
                  data={daily.map(d=>({x:d.day,y:d.amount,label:String(d.day)}))}
                  prevData={prevDaily.map(d=>({x:d.day,y:d.amount}))}
                  goal={goal?.weekday_goal||undefined}
                  color="#FF6B35" height={isPC?220:160} />
              ) : (
                <div style={{textAlign:'center',padding:'40px 0',color:'#ccc',fontSize:13}}>이번 달 마감 데이터가 없어요</div>
              )}
            </div>

            {daily.length>0 && (
              <div style={bx}>
                <div style={{fontSize:13,fontWeight:700,color:'#1a1a2e',marginBottom:12}}>📋 일별 상세</div>
                <div style={{display:'grid',gridTemplateColumns:'68px 1fr 76px 56px 56px 30px',gap:4,paddingBottom:8,borderBottom:'1px solid #F0F2F5',marginBottom:6}}>
                  {['날짜','매출','건수','취소','메모',''].map((h,i)=>(
                    <span key={i} style={{fontSize:10,color:'#aaa',fontWeight:600,textAlign:i===0?'left':'center'}}>{h}</span>
                  ))}
                </div>
                {[...daily].sort((a,b)=>b.day-a.day).map(d=>(
                  <div key={d.day} style={{display:'grid',gridTemplateColumns:'68px 1fr 76px 56px 56px 30px',gap:4,padding:'8px 0',borderBottom:'1px solid #F8F9FB',alignItems:'center'}}>
                    <span style={{fontSize:11,color:d.dow===0||d.dow===6?'#E84393':'#888'}}>{month+1}/{d.day}({DOW[d.dow]})</span>
                    <span style={{fontSize:13,fontWeight:700,color:'#FF6B35'}}>{fmtWFull(d.amount)}</span>
                    <span style={{fontSize:12,color:'#6C5CE7',textAlign:'center'}}>{d.count>0?`${d.count}건`:'-'}</span>
                    <span style={{fontSize:12,color:'#E84393',textAlign:'center'}}>{d.cancel>0?`${d.cancel}건`:'-'}</span>
                    <span style={{fontSize:11,color:'#aaa',textAlign:'center'}}>{d.unitPrice>0?fmtW(d.unitPrice):'-'}</span>
                    <span style={{fontSize:12,textAlign:'center'}}>{d.memo||d.note?'📌':''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 객단가 ── */}
        {!loading && tab==='unit' && (
          <div>
            <div style={bx}>
              <div style={{fontSize:14,fontWeight:700,color:'#1a1a2e',marginBottom:4}}>💡 객단가 추이</div>
              <div style={{fontSize:11,color:'#aaa',marginBottom:14}}>주문 1건당 평균 결제금액 — 높을수록 메뉴 구성이 좋고, 낮으면 객단가를 올릴 여지가 있어요</div>
              {daily.filter(d=>d.count>0).length>0 ? (
                <LineChart
                  data={daily.filter(d=>d.count>0).map(d=>({x:d.day,y:d.unitPrice,label:String(d.day)}))}
                  prevData={prevDaily.filter(d=>d.count>0).map(d=>({x:d.day,y:d.unitPrice}))}
                  color="#6C5CE7" height={isPC?220:160} />
              ) : (
                <div style={{textAlign:'center',padding:'40px 0',color:'#ccc',fontSize:13}}>건수를 입력하면 객단가가 계산돼요<br/><span style={{fontSize:11}}>마감일지 → 각 플랫폼 건수 입력</span></div>
              )}
            </div>

            {daily.filter(d=>d.count>0).length>0 && (
              <div style={{display:'grid',gridTemplateColumns:isPC?'repeat(4,1fr)':'repeat(2,1fr)',gap:10,marginBottom:12}}>
                {[
                  {label:'평균 객단가',value:fmtW(avgUnit),color:'#6C5CE7'},
                  {label:'최고 객단가',value:fmtW(Math.max(...daily.filter(d=>d.count>0).map(d=>d.unitPrice))),color:'#FF6B35'},
                  {label:'최저 객단가',value:fmtW(Math.min(...daily.filter(d=>d.count>0).map(d=>d.unitPrice))),color:'#E84393'},
                  {label:'객단가 수준',value:avgUnit>15000?'✅ 양호':avgUnit>10000?'⚠️ 보통':'❌ 낮음',color:avgUnit>15000?'#00B894':avgUnit>10000?'#FDC400':'#E84393'},
                ].map(s=>(
                  <div key={s.label} style={{background:'#fff',borderRadius:12,border:'1px solid #E8ECF0',padding:'14px 16px'}}>
                    <div style={{fontSize:10,color:'#aaa',marginBottom:4}}>{s.label}</div>
                    <div style={{fontSize:18,fontWeight:800,color:s.color}}>{s.value}</div>
                  </div>
                ))}
              </div>
            )}

            {totalCancel>0 && (
              <div style={{...bx,border:'1px solid rgba(232,67,147,0.25)'}}>
                <div style={{fontSize:13,fontWeight:700,color:'#E84393',marginBottom:12}}>🚨 취소/환불 분석</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                  {[
                    {label:'총 취소/환불',value:`${totalCancel}건`,color:'#E84393'},
                    {label:'취소율',value:`${totalCount>0?Math.round((totalCancel/(totalCount+totalCancel))*100):0}%`,color:'#E84393'},
                    {label:'추정 손실',value:fmtW(totalCancel*avgUnit),color:'#E84393'},
                  ].map(s=>(
                    <div key={s.label} style={{background:'rgba(232,67,147,0.06)',borderRadius:10,padding:'12px 14px'}}>
                      <div style={{fontSize:10,color:'#aaa',marginBottom:4}}>{s.label}</div>
                      <div style={{fontSize:16,fontWeight:800,color:s.color}}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 요일별 패턴 ── */}
        {!loading && tab==='dow' && (
          <div>
            <div style={bx}>
              <div style={{fontSize:14,fontWeight:700,color:'#1a1a2e',marginBottom:4}}>📆 요일별 평균 매출</div>
              <div style={{fontSize:11,color:'#aaa',marginBottom:14}}>어느 요일에 매출이 집중되는지 파악해 직원 배치와 프로모션에 활용하세요</div>
              <BarChart data={dowStats} height={isPC?200:150} />
            </div>

            {daily.length>0 && (()=>{
              const sorted=[...dowStats].filter(d=>d.value>0).sort((a,b)=>b.value-a.value)
              const best=sorted[0], worst=sorted[sorted.length-1]
              const wdAvg=dowStats.filter(d=>['월','화','수','목','금'].includes(d.label)).filter(d=>d.value>0)
              const weAvg=dowStats.filter(d=>['토','일'].includes(d.label)).filter(d=>d.value>0)
              const wdMean=wdAvg.length?Math.round(wdAvg.reduce((s,d)=>s+d.value,0)/wdAvg.length):0
              const weMean=weAvg.length?Math.round(weAvg.reduce((s,d)=>s+d.value,0)/weAvg.length):0
              return (
                <div style={bx}>
                  <div style={{fontSize:13,fontWeight:700,color:'#1a1a2e',marginBottom:12}}>💡 요일 인사이트</div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {best && <div style={{padding:'10px 14px',borderRadius:10,background:'rgba(0,184,148,0.08)',border:'1px solid rgba(0,184,148,0.2)',fontSize:12,color:'#00B894'}}>
                      🏆 최고 요일: <strong>{best.label}요일</strong> 평균 {fmtW(best.value)} ({best.count}회 영업)
                    </div>}
                    {worst && <div style={{padding:'10px 14px',borderRadius:10,background:'rgba(232,67,147,0.06)',border:'1px solid rgba(232,67,147,0.15)',fontSize:12,color:'#E84393'}}>
                      📉 최저 요일: <strong>{worst.label}요일</strong> 평균 {fmtW(worst.value)} — 이 날 프로모션을 고려해보세요
                    </div>}
                    {wdMean>0 && weMean>0 && (weMean>wdMean
                      ? <div style={{padding:'10px 14px',borderRadius:10,background:'rgba(108,92,231,0.06)',border:'1px solid rgba(108,92,231,0.15)',fontSize:12,color:'#6C5CE7'}}>
                          📊 주말 강세 매장: 주말 평균이 평일보다 {Math.round(((weMean-wdMean)/wdMean)*100)}% 높아요
                        </div>
                      : <div style={{padding:'10px 14px',borderRadius:10,background:'rgba(255,107,53,0.06)',border:'1px solid rgba(255,107,53,0.15)',fontSize:12,color:'#FF6B35'}}>
                          📊 평일 강세 매장: 평일 평균이 주말보다 {weMean>0?Math.round(((wdMean-weMean)/weMean)*100):100}% 높아요
                        </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* ── 플랫폼 ── */}
        {!loading && tab==='platform' && (
          <div>
            <div style={bx}>
              <div style={{fontSize:14,fontWeight:700,color:'#1a1a2e',marginBottom:16}}>🥧 플랫폼별 매출 비중</div>
              {platforms.length>0 ? (
                <div style={{display:'flex',gap:24,alignItems:'center',flexWrap:'wrap'}}>
                  <PieChart data={platforms.map(p=>({label:p.name,value:p.amount,color:p.color}))} size={isPC?160:130} />
                  <div style={{flex:1,minWidth:180}}>
                    {platforms.map(p=>(
                      <div key={p.name} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                        <div style={{width:10,height:10,borderRadius:3,background:p.color,flexShrink:0}} />
                        <span style={{fontSize:12,color:'#555',flex:1}}>{p.name}</span>
                        <span style={{fontSize:12,fontWeight:700,color:'#1a1a2e'}}>{fmtW(p.amount)}</span>
                        <span style={{fontSize:11,color:'#aaa',width:34,textAlign:'right'}}>{totalSales>0?Math.round((p.amount/totalSales)*100):0}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{textAlign:'center',padding:'40px 0',color:'#ccc',fontSize:13}}>데이터 없음</div>
              )}
            </div>

            {(hallAmt>0||delivAmt>0) && (
              <div style={bx}>
                <div style={{fontSize:13,fontWeight:700,color:'#1a1a2e',marginBottom:14}}>🏠 홀 vs 🛵 배달</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                  <div style={{background:'rgba(255,107,53,0.08)',borderRadius:12,padding:'14px 16px',border:'1px solid rgba(255,107,53,0.2)'}}>
                    <div style={{fontSize:10,color:'#aaa',marginBottom:4}}>🏠 홀 매출</div>
                    <div style={{fontSize:20,fontWeight:800,color:'#FF6B35'}}>{fmtW(hallAmt)}</div>
                    <div style={{fontSize:11,color:'#FF6B35',marginTop:2}}>{totalSales>0?Math.round((hallAmt/totalSales)*100):0}%</div>
                  </div>
                  <div style={{background:'rgba(108,92,231,0.08)',borderRadius:12,padding:'14px 16px',border:'1px solid rgba(108,92,231,0.2)'}}>
                    <div style={{fontSize:10,color:'#aaa',marginBottom:4}}>🛵 배달 매출</div>
                    <div style={{fontSize:20,fontWeight:800,color:'#6C5CE7'}}>{fmtW(delivAmt)}</div>
                    <div style={{fontSize:11,color:'#6C5CE7',marginTop:2}}>{totalSales>0?Math.round((delivAmt/totalSales)*100):0}%</div>
                  </div>
                </div>
                <div style={{height:12,borderRadius:6,background:'rgba(108,92,231,0.15)',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${totalSales>0?Math.round((hallAmt/totalSales)*100):0}%`,background:'linear-gradient(90deg,#FF6B35,#FDC400)',borderRadius:6,transition:'width 0.5s'}} />
                </div>
                <div style={{display:'flex',justifyContent:'space-between',marginTop:4,fontSize:10,color:'#aaa'}}>
                  <span>홀 {totalSales>0?Math.round((hallAmt/totalSales)*100):0}%</span>
                  <span>배달 {totalSales>0?Math.round((delivAmt/totalSales)*100):0}%</span>
                </div>
                <div style={{marginTop:12,padding:'10px 14px',borderRadius:10,background:'#F8F9FB',fontSize:12,color:'#888',lineHeight:1.6}}>
                  {delivAmt>hallAmt
                    ? '🛵 배달 비중이 높아요. 홀 마케팅 강화 시 배달 수수료 비용을 줄일 수 있어요.'
                    : '🏠 홀 비중이 높아요. 배달앱 프로모션으로 배달 매출을 늘려볼 수 있어요.'}
                </div>
              </div>
            )}

            {platforms.some(p=>p.count>0) && (
              <div style={bx}>
                <div style={{fontSize:13,fontWeight:700,color:'#1a1a2e',marginBottom:12}}>📊 플랫폼별 건수 & 취소</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 72px 72px 80px',gap:6,paddingBottom:8,borderBottom:'1px solid #F0F2F5',marginBottom:6}}>
                  {['플랫폼','건수','취소','객단가'].map(h=>(
                    <span key={h} style={{fontSize:10,color:'#aaa',fontWeight:600,textAlign:'center'}}>{h}</span>
                  ))}
                </div>
                {platforms.map(p=>(
                  <div key={p.name} style={{display:'grid',gridTemplateColumns:'1fr 72px 72px 80px',gap:6,padding:'8px 0',borderBottom:'1px solid #F8F9FB',alignItems:'center'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <div style={{width:8,height:8,borderRadius:2,background:p.color,flexShrink:0}} />
                      <span style={{fontSize:12,color:'#555'}}>{p.name}</span>
                    </div>
                    <span style={{fontSize:12,color:'#6C5CE7',fontWeight:600,textAlign:'center'}}>{p.count>0?`${p.count}건`:'-'}</span>
                    <span style={{fontSize:12,color:'#E84393',textAlign:'center'}}>{p.cancel>0?`${p.cancel}건`:'-'}</span>
                    <span style={{fontSize:11,color:'#888',textAlign:'center'}}>{p.count>0?fmtW(Math.round(p.amount/p.count)):'-'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── 전월 비교 ── */}
        {!loading && tab==='compare' && (
          <div>
            {/* 요약 비교 카드 3개 */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:12}}>
              {[
                {label:'이번달',value:fmtW(totalSales),color:'#FF6B35',sub:`${daily.length}일 영업`},
                {label:`전월 (${prevMonthLabel})`,value:fmtW(prevTotal),color:'#6C5CE7',
                  sub:prevTotal>0?`${totalSales>=prevTotal?'▲':'▼'} ${Math.abs(Math.round(((totalSales-prevTotal)/prevTotal)*100))}%`:'데이터없음'},
                {label:`전년 (${year-1}년 ${month+1}월)`,value:fmtW(prevYearTotal),color:'#00B894',
                  sub:prevYearTotal>0?`${totalSales>=prevYearTotal?'▲':'▼'} ${Math.abs(Math.round(((totalSales-prevYearTotal)/prevYearTotal)*100))}%`:'데이터없음'},
              ].map(s=>(
                <div key={s.label} style={{background:'#fff',borderRadius:12,border:'1px solid #E8ECF0',padding:'12px 14px'}}>
                  <div style={{fontSize:10,color:'#aaa',marginBottom:4}}>{s.label}</div>
                  <div style={{fontSize:isPC?16:13,fontWeight:800,color:s.color}}>{s.value}</div>
                  <div style={{fontSize:10,color:s.color,marginTop:3,opacity:0.8}}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* 전월 비교 차트 */}
            <div style={bx}>
              <div style={{fontSize:13,fontWeight:700,color:'#1a1a2e',marginBottom:6}}>🔄 전월 비교</div>
              <div style={{display:'flex',gap:16,marginBottom:12,fontSize:11}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:14,height:3,background:'#FF6B35',borderRadius:2}} /><span style={{color:'#aaa'}}>이번달</span></div>
                <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:14,height:3,background:'#6C5CE7',borderRadius:2,opacity:0.6}} /><span style={{color:'#aaa'}}>{prevMonthLabel}</span></div>
              </div>
              {(()=>{
                const data=[...daily.map(d=>d.day),...prevDaily.map(d=>d.day)]
                const days=[...new Set(data)].sort((a,b)=>a-b)
                const cd=days.map(day=>({day,curr:daily.find(d=>d.day===day)?.amount||0,prev:prevDaily.find(d=>d.day===day)?.amount||0})).filter(d=>d.curr>0||d.prev>0)
                if(!cd.length) return <div style={{textAlign:'center',padding:'30px 0',color:'#ccc',fontSize:13}}>비교할 데이터가 없어요</div>
                const maxV=Math.max(...cd.map(d=>Math.max(d.curr,d.prev)),1)
                const barH=isPC?140:110
                return (
                  <div style={{overflowX:'auto'}}>
                    <div style={{display:'flex',alignItems:'flex-end',gap:3,minWidth:cd.length*28,height:barH+20,paddingBottom:18}}>
                      {cd.map(d=>(
                        <div key={d.day} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',height:'100%'}}>
                          <div style={{display:'flex',alignItems:'flex-end',gap:1,width:'100%'}}>
                            <div style={{flex:1,height:Math.max(Math.round((d.curr/maxV)*barH),d.curr>0?3:0),background:'rgba(255,107,53,0.75)',borderRadius:'3px 3px 0 0'}} />
                            <div style={{flex:1,height:Math.max(Math.round((d.prev/maxV)*barH),d.prev>0?3:0),background:'rgba(108,92,231,0.45)',borderRadius:'3px 3px 0 0'}} />
                          </div>
                          <div style={{fontSize:8,color:'#bbb',marginTop:3}}>{d.day}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* 전년도 비교 차트 */}
            <div style={bx}>
              <div style={{fontSize:13,fontWeight:700,color:'#1a1a2e',marginBottom:6}}>📅 전년 동월 비교 <span style={{fontSize:11,color:'#aaa',fontWeight:400}}>({year-1}년 {month+1}월)</span></div>
              <div style={{display:'flex',gap:16,marginBottom:12,fontSize:11}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:14,height:3,background:'#FF6B35',borderRadius:2}} /><span style={{color:'#aaa'}}>이번달</span></div>
                <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:14,height:3,background:'#00B894',borderRadius:2,opacity:0.6}} /><span style={{color:'#aaa'}}>{year-1}년 {month+1}월</span></div>
              </div>
              {(()=>{
                const data=[...daily.map(d=>d.day),...prevYearDaily.map(d=>d.day)]
                const days=[...new Set(data)].sort((a,b)=>a-b)
                const cd=days.map(day=>({day,curr:daily.find(d=>d.day===day)?.amount||0,prev:prevYearDaily.find(d=>d.day===day)?.amount||0})).filter(d=>d.curr>0||d.prev>0)
                if(!cd.length) return <div style={{textAlign:'center',padding:'30px 0',color:'#ccc',fontSize:13}}>{year-1}년 {month+1}월 데이터가 없어요</div>
                const maxV=Math.max(...cd.map(d=>Math.max(d.curr,d.prev)),1)
                const barH=isPC?140:110
                return (
                  <div style={{overflowX:'auto'}}>
                    <div style={{display:'flex',alignItems:'flex-end',gap:3,minWidth:cd.length*28,height:barH+20,paddingBottom:18}}>
                      {cd.map(d=>(
                        <div key={d.day} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',height:'100%'}}>
                          <div style={{display:'flex',alignItems:'flex-end',gap:1,width:'100%'}}>
                            <div style={{flex:1,height:Math.max(Math.round((d.curr/maxV)*barH),d.curr>0?3:0),background:'rgba(255,107,53,0.75)',borderRadius:'3px 3px 0 0'}} />
                            <div style={{flex:1,height:Math.max(Math.round((d.prev/maxV)*barH),d.prev>0?3:0),background:'rgba(0,184,148,0.5)',borderRadius:'3px 3px 0 0'}} />
                          </div>
                          <div style={{fontSize:8,color:'#bbb',marginTop:3}}>{d.day}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* 전년도 인사이트 */}
            {prevYearTotal>0 && (
              <div style={{...bx, border:`1px solid ${totalSales>=prevYearTotal?'rgba(0,184,148,0.25)':'rgba(232,67,147,0.25)'}`}}>
                <div style={{fontSize:13,fontWeight:700,color:'#1a1a2e',marginBottom:10}}>💡 전년 동기 인사이트</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:10}}>
                  <div style={{background:totalSales>=prevYearTotal?'rgba(0,184,148,0.07)':'rgba(232,67,147,0.07)',borderRadius:10,padding:'12px 14px'}}>
                    <div style={{fontSize:10,color:'#aaa',marginBottom:4}}>YoY 성장률</div>
                    <div style={{fontSize:20,fontWeight:800,color:totalSales>=prevYearTotal?'#00B894':'#E84393'}}>
                      {totalSales>=prevYearTotal?'+':''}{Math.round(((totalSales-prevYearTotal)/prevYearTotal)*100)}%
                    </div>
                    <div style={{fontSize:10,color:'#aaa',marginTop:2}}>전년 동월 대비</div>
                  </div>
                  <div style={{background:'rgba(255,107,53,0.06)',borderRadius:10,padding:'12px 14px'}}>
                    <div style={{fontSize:10,color:'#aaa',marginBottom:4}}>매출 증감</div>
                    <div style={{fontSize:18,fontWeight:800,color:totalSales>=prevYearTotal?'#00B894':'#E84393'}}>
                      {totalSales>=prevYearTotal?'+':''}{fmtW(totalSales-prevYearTotal)}
                    </div>
                    <div style={{fontSize:10,color:'#aaa',marginTop:2}}>{fmtW(prevYearTotal)} → {fmtW(totalSales)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 일별 3열 비교 테이블 */}
            {(prevTotal>0||prevYearTotal>0) && daily.length>0 && (
              <div style={bx}>
                <div style={{fontSize:13,fontWeight:700,color:'#1a1a2e',marginBottom:12}}>📋 일별 3열 비교</div>
                <div style={{display:'grid',gridTemplateColumns:'44px 1fr 1fr 1fr',gap:4,paddingBottom:8,borderBottom:'1px solid #F0F2F5',marginBottom:6}}>
                  <span style={{fontSize:10,color:'#aaa',fontWeight:600,textAlign:'center'}}>일</span>
                  <span style={{fontSize:10,color:'#FF6B35',fontWeight:700,textAlign:'center'}}>이번달</span>
                  <span style={{fontSize:10,color:'#6C5CE7',fontWeight:700,textAlign:'center'}}>전월</span>
                  <span style={{fontSize:10,color:'#00B894',fontWeight:700,textAlign:'center'}}>전년</span>
                </div>
                {(()=>{
                  const allDays=[...new Set([...daily.map(d=>d.day),...prevDaily.map(d=>d.day),...prevYearDaily.map(d=>d.day)])].sort((a,b)=>b-a)
                  return allDays.slice(0,20).map(day=>{
                    const curr=daily.find(d=>d.day===day)?.amount||0
                    const prev=prevDaily.find(d=>d.day===day)?.amount||0
                    const pyear=prevYearDaily.find(d=>d.day===day)?.amount||0
                    if(!curr&&!prev&&!pyear) return null
                    return (
                      <div key={day} style={{display:'grid',gridTemplateColumns:'44px 1fr 1fr 1fr',gap:4,padding:'7px 0',borderBottom:'1px solid #F8F9FB',alignItems:'center'}}>
                        <span style={{fontSize:11,color:'#888',textAlign:'center'}}>{month+1}/{day}</span>
                        <span style={{fontSize:11,fontWeight:curr>0?700:400,color:curr>0?'#FF6B35':'#ddd',textAlign:'center'}}>{curr>0?fmtW(curr):'-'}</span>
                        <span style={{fontSize:11,color:prev>0?'#6C5CE7':'#ddd',textAlign:'center'}}>{prev>0?fmtW(prev):'-'}</span>
                        <span style={{fontSize:11,color:pyear>0?'#00B894':'#ddd',textAlign:'center'}}>{pyear>0?fmtW(pyear):'-'}</span>
                      </div>
                    )
                  })
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── 전년 비교 ── */}
        {!loading && tab==='yearcmp' && (
          <div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
              <div style={{background:'#fff',borderRadius:12,border:'1px solid #E8ECF0',padding:'14px 16px'}}>
                <div style={{fontSize:10,color:'#aaa',marginBottom:4}}>이번달 ({year}년 {month+1}월)</div>
                <div style={{fontSize:18,fontWeight:800,color:'#FF6B35'}}>{fmtW(totalSales)}</div>
                <div style={{fontSize:10,color:'#aaa',marginTop:2}}>{daily.length}일 영업</div>
              </div>
              <div style={{background:'#fff',borderRadius:12,border:'1px solid #E8ECF0',padding:'14px 16px'}}>
                <div style={{fontSize:10,color:'#aaa',marginBottom:4}}>전년 동월 ({year-1}년 {month+1}월)</div>
                <div style={{fontSize:18,fontWeight:800,color:'#00B894'}}>{prevYearTotal>0?fmtW(prevYearTotal):'데이터없음'}</div>
                <div style={{fontSize:10,color:'#aaa',marginTop:2}}>{prevYearDaily.length}일 영업</div>
              </div>
            </div>

            {/* YoY 인사이트 */}
            {prevYearTotal>0 && (
              <div style={{...bx,border:`1px solid ${totalSales>=prevYearTotal?'rgba(0,184,148,0.3)':'rgba(232,67,147,0.3)'}`,
                background:totalSales>=prevYearTotal?'rgba(0,184,148,0.05)':'rgba(232,67,147,0.05)',marginBottom:12}}>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                  {[
                    {label:'YoY 성장률',value:`${totalSales>=prevYearTotal?'+':''}${Math.round(((totalSales-prevYearTotal)/prevYearTotal)*100)}%`,color:totalSales>=prevYearTotal?'#00B894':'#E84393'},
                    {label:'매출 증감',value:`${totalSales>=prevYearTotal?'+':''}${fmtW(totalSales-prevYearTotal)}`,color:totalSales>=prevYearTotal?'#00B894':'#E84393'},
                    {label:'일평균 매출',value:fmtW(daily.length>0?Math.round(totalSales/daily.length):0),color:'#FF6B35'},
                  ].map(s=>(
                    <div key={s.label}>
                      <div style={{fontSize:10,color:'#aaa',marginBottom:4}}>{s.label}</div>
                      <div style={{fontSize:16,fontWeight:800,color:s.color}}>{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 전년 비교 차트 */}
            <div style={bx}>
              <div style={{fontSize:13,fontWeight:700,color:'#1a1a2e',marginBottom:6}}>📅 전년 동월 일별 비교</div>
              <div style={{display:'flex',gap:16,marginBottom:12,fontSize:11}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:14,height:3,background:'#FF6B35',borderRadius:2}} /><span style={{color:'#aaa'}}>{year}년</span></div>
                <div style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:14,height:3,background:'#00B894',borderRadius:2,opacity:0.6}} /><span style={{color:'#aaa'}}>{year-1}년</span></div>
              </div>
              {(()=>{
                const days=[...new Set([...daily.map(d=>d.day),...prevYearDaily.map(d=>d.day)])].sort((a,b)=>a-b)
                const cd=days.map(day=>({day,curr:daily.find(d=>d.day===day)?.amount||0,prev:prevYearDaily.find(d=>d.day===day)?.amount||0})).filter(d=>d.curr>0||d.prev>0)
                if(!cd.length) return <div style={{textAlign:'center',padding:'30px 0',color:'#ccc',fontSize:13}}>{year-1}년 {month+1}월 데이터가 없어요</div>
                const maxV=Math.max(...cd.map(d=>Math.max(d.curr,d.prev)),1)
                const barH=isPC?160:120
                return (
                  <div style={{overflowX:'auto'}}>
                    <div style={{display:'flex',alignItems:'flex-end',gap:3,minWidth:cd.length*28,height:barH+20,paddingBottom:18}}>
                      {cd.map(d=>(
                        <div key={d.day} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',height:'100%'}}>
                          <div style={{display:'flex',alignItems:'flex-end',gap:1,width:'100%'}}>
                            <div style={{flex:1,height:Math.max(Math.round((d.curr/maxV)*barH),d.curr>0?3:0),background:'rgba(255,107,53,0.75)',borderRadius:'3px 3px 0 0'}} />
                            <div style={{flex:1,height:Math.max(Math.round((d.prev/maxV)*barH),d.prev>0?3:0),background:'rgba(0,184,148,0.5)',borderRadius:'3px 3px 0 0'}} />
                          </div>
                          <div style={{fontSize:8,color:'#bbb',marginTop:3}}>{d.day}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>

            {/* 일별 전년 비교 테이블 */}
            {(daily.length>0||prevYearDaily.length>0) && (
              <div style={bx}>
                <div style={{fontSize:13,fontWeight:700,color:'#1a1a2e',marginBottom:12}}>📋 일별 전년 비교</div>
                <div style={{display:'grid',gridTemplateColumns:'44px 1fr 1fr 72px',gap:4,paddingBottom:8,borderBottom:'1px solid #F0F2F5',marginBottom:6}}>
                  <span style={{fontSize:10,color:'#aaa',textAlign:'center'}}>일</span>
                  <span style={{fontSize:10,color:'#FF6B35',fontWeight:700,textAlign:'center'}}>{year}년</span>
                  <span style={{fontSize:10,color:'#00B894',fontWeight:700,textAlign:'center'}}>{year-1}년</span>
                  <span style={{fontSize:10,color:'#aaa',textAlign:'center'}}>증감</span>
                </div>
                {[...new Set([...daily.map(d=>d.day),...prevYearDaily.map(d=>d.day)])].sort((a,b)=>b-a).map(day=>{
                  const curr=daily.find(d=>d.day===day)?.amount||0
                  const prev=prevYearDaily.find(d=>d.day===day)?.amount||0
                  if(!curr&&!prev) return null
                  const diff=curr-prev
                  return (
                    <div key={day} style={{display:'grid',gridTemplateColumns:'44px 1fr 1fr 72px',gap:4,padding:'7px 0',borderBottom:'1px solid #F8F9FB',alignItems:'center'}}>
                      <span style={{fontSize:11,color:'#888',textAlign:'center'}}>{month+1}/{day}</span>
                      <span style={{fontSize:11,fontWeight:curr>0?700:400,color:curr>0?'#FF6B35':'#ddd',textAlign:'center'}}>{curr>0?fmtW(curr):'-'}</span>
                      <span style={{fontSize:11,color:prev>0?'#00B894':'#ddd',textAlign:'center'}}>{prev>0?fmtW(prev):'-'}</span>
                      <span style={{fontSize:11,fontWeight:600,color:diff>0?'#00B894':diff<0?'#E84393':'#ddd',textAlign:'center'}}>
                        {curr>0&&prev>0?`${diff>=0?'+':''}${fmtW(diff)}`:'-'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}


        {!loading && tab==='memo' && (
          <div>
            <div style={bx}>
              <div style={{fontSize:14,fontWeight:700,color:'#1a1a2e',marginBottom:4}}>📌 특이사항 타임라인</div>
              <div style={{fontSize:11,color:'#aaa',marginBottom:16}}>이벤트·날씨·행사가 매출에 어떤 영향을 줬는지 확인하세요</div>
              {memoData.length>0 ? memoData.sort((a,b)=>b.day-a.day).map(d=>(
                <div key={d.day} style={{borderRadius:12,border:'1px solid #E8ECF0',padding:'14px 16px',marginBottom:10,background:'#FAFBFC'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,flexWrap:'wrap',gap:6}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <span style={{fontSize:12,fontWeight:700,color:d.dow===0||d.dow===6?'#E84393':'#888'}}>{month+1}월 {d.day}일 ({DOW[d.dow]})</span>
                      <span style={{fontSize:14,fontWeight:800,color:'#FF6B35'}}>{fmtWFull(d.amount)}</span>
                    </div>
                    {d.count>0 && <span style={{fontSize:11,color:'#6C5CE7',fontWeight:600}}>{d.count}건 · 객단가 {fmtW(d.unitPrice)}</span>}
                  </div>
                  {d.memo && (
                    <div style={{padding:'8px 12px',background:'rgba(255,107,53,0.06)',borderRadius:8,marginBottom:6,border:'1px solid rgba(255,107,53,0.15)'}}>
                      <div style={{fontSize:10,color:'#FF6B35',fontWeight:700,marginBottom:2}}>📌 특이사항</div>
                      <div style={{fontSize:12,color:'#555',lineHeight:1.6}}>{d.memo}</div>
                    </div>
                  )}
                  {d.note && (
                    <div style={{padding:'8px 12px',background:'rgba(232,67,147,0.05)',borderRadius:8,border:'1px solid rgba(232,67,147,0.15)'}}>
                      <div style={{fontSize:10,color:'#E84393',fontWeight:700,marginBottom:2}}>📝 클레임</div>
                      <div style={{fontSize:12,color:'#555',lineHeight:1.6}}>{d.note}</div>
                    </div>
                  )}
                </div>
              )) : (
                <div style={{textAlign:'center',padding:'40px 0',color:'#ccc'}}>
                  <div style={{fontSize:32,marginBottom:10}}>📌</div>
                  <div style={{fontSize:13}}>이번 달 특이사항 메모가 없어요</div>
                  <div style={{fontSize:11,marginTop:6}}>마감일지에서 특이사항을 입력하면 여기서 확인할 수 있어요</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // ── PC 풀스크린 ──
  if (isPC) return (
    <div style={{position:'fixed',inset:0,background:'#F4F6F9',zIndex:200,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <header style={{background:'#fff',borderBottom:'1px solid #E8ECF0',boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
        display:'flex',alignItems:'center',padding:'0 28px',height:54,flexShrink:0,gap:20}}>
        <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <div style={{width:32,height:32,borderRadius:8,background:'linear-gradient(135deg,#FF6B35,#E84393)',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:800,color:'#fff'}}>M</div>
          <div>
            <div style={{fontSize:14,fontWeight:700,color:'#1a1a2e',lineHeight:1.2}}>매장노트</div>
            <div style={{fontSize:10,color:'#FF6B35',fontWeight:600}}>📊 분석</div>
          </div>
        </div>
        {/* 네비 탭 */}
        <nav style={{display:'flex',gap:2,flex:1,justifyContent:'center'}}>
          {[
            {href:'/dash',ic:'📊',l:'대시'},
            {href:'/closing',ic:'📋',l:'마감'},
            {href:'/analytics',ic:'📈',l:'분석'},
            {href:'/notice',ic:'📢',l:'공지'},
            {href:'/inventory',ic:'📦',l:'재고'},
            {href:'/recipe',ic:'🍳',l:'레시피'},
            {href:'/staff',ic:'👥',l:'직원관리'},
            {href:'/goal',ic:'🎯',l:'목표매출'},
            {href:'/mypage',ic:'📋',l:'마이페이지'},
          ].map(t=>{
            const active=t.href==='/analytics'
            return (
              <a key={t.href} href={t.href} style={{textDecoration:'none'}}>
                <div style={{display:'flex',alignItems:'center',gap:4,padding:'6px 10px',borderRadius:8,cursor:'pointer',
                  background:active?'rgba(255,107,53,0.08)':'transparent',
                  borderBottom:active?'2px solid #FF6B35':'2px solid transparent'}}>
                  <span style={{fontSize:13}}>{t.ic}</span>
                  <span style={{fontSize:12,fontWeight:active?700:500,color:active?'#FF6B35':'#888',whiteSpace:'nowrap'}}>{t.l}</span>
                </div>
              </a>
            )
          })}
        </nav>
        <div style={{flexShrink:0}}>
          <MonthNav year={year} month={month} onChange={(y,m)=>{setYear(y);setMonth(m)}} compact />
        </div>
      </header>
      <div style={{flex:1,overflow:'auto',padding:'20px 28px'}}>
        {mainContent}
      </div>
    </div>
  )

  // ── 모바일 ──
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
        <span style={{fontSize:17,fontWeight:700,color:'#1a1a2e'}}>📊 분석</span>
      </div>
      <div style={{marginBottom:16}}>
        <MonthNav year={year} month={month} onChange={(y,m)=>{setYear(y);setMonth(m)}} />
      </div>
      {mainContent}
    </div>
  )
}