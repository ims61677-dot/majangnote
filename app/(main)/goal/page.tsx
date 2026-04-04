'use client'
import { useEffect, useState, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import YearMonthPicker from '@/components/YearMonthPicker'

// ── 한국 공휴일 ──
const KR_HOLIDAYS: Record<string, string> = {
  '0101': '신정', '0301': '삼일절', '0505': '어린이날',
  '0606': '현충일', '0815': '광복절', '1003': '개천절',
  '1009': '한글날', '1225': '크리스마스',
  '0501': '근로자의날',
  '20250128': '설 전날', '20250129': '설날', '20250130': '설 다음날',
  '20250506': '대체공휴일', '20250605': '대체공휴일',
  '20251005': '추석 전날', '20251006': '추석', '20251007': '추석 다음날', '20251008': '대체공휴일',
  '20260216': '설 전날', '20260217': '설날', '20260218': '설 다음날',
  '20260302': '대체공휴일',
  '20260524': '부처님오신날',
  '20260924': '추석 전날', '20260925': '추석', '20260926': '추석 다음날',
  '20270206': '설 전날', '20270207': '설날', '20270208': '설 다음날',
  '20270513': '부처님오신날',
  '20271014': '추석 전날', '20271015': '추석', '20271016': '추석 다음날',
}
function getHoliday(y: number, m: number, d: number): string | null {
  const mmdd = `${String(m).padStart(2,'0')}${String(d).padStart(2,'0')}`
  const full = `${y}${mmdd}`
  return KR_HOLIDAYS[full] || KR_HOLIDAYS[mmdd] || null
}
function isRedDay(y: number, m: number, d: number): boolean {
  const dow = new Date(y, m - 1, d).getDay()
  return dow === 0 || dow === 6 || !!getHoliday(y, m, d)
}

// ── 날짜 유틸 ──
function getDaysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate() }
function getDow(y: number, m: number, d: number) { return new Date(y, m - 1, d).getDay() }
function getWeekNum(y: number, m: number, d: number) {
  const startDow = new Date(y, m - 1, 1).getDay()
  return Math.ceil((d + (startDow === 0 ? 6 : startDow - 1)) / 7)
}
function getWeeksInMonth(y: number, m: number) { return getWeekNum(y, m, getDaysInMonth(y, m)) }
function getWeekDays(y: number, m: number, week: number) {
  const days: number[] = []
  for (let d = 1; d <= getDaysInMonth(y, m); d++)
    if (getWeekNum(y, m, d) === week) days.push(d)
  return days
}

// ── 포맷 ──
const bx = { background:'#fff', borderRadius:16, border:'1px solid #E8ECF0', padding:16, marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width:'100%', padding:'9px 12px', borderRadius:8, background:'#F8F9FB', border:'1px solid #E0E4E8', color:'#1a1a2e', fontSize:14, outline:'none', boxSizing:'border-box' as const, textAlign:'right' as const }
const ta = { width:'100%', padding:'9px 12px', borderRadius:8, background:'#F8F9FB', border:'1px solid #E0E4E8', color:'#1a1a2e', fontSize:12, outline:'none', boxSizing:'border-box' as const, resize:'vertical' as const, minHeight:70, lineHeight:1.6 }
function toComma(v:number){ return v>0 ? v.toLocaleString('ko-KR') : '' }
function fromComma(s:string){ return Number(String(s).replace(/[^0-9]/g,''))||0 }
function fmtW(n:number){
  if(n>=100000000) return (n/100000000).toFixed(1).replace(/\.0$/,'')+'억원'
  if(n>=10000) return (n/10000).toFixed(1).replace(/\.0$/,'')+'만원'
  return n.toLocaleString('ko-KR')+'원'
}
function ProgressBar({value,color='#FF6B35',height=8}:{value:number;color?:string;height?:number}){
  const pct=Math.min(Math.max(value,0),100)
  return <div style={{width:'100%',height,borderRadius:height,background:'#F0F2F5',overflow:'hidden'}}>
    <div style={{width:`${pct}%`,height:'100%',borderRadius:height,background:pct>=100?'#00B894':color,transition:'width 0.5s'}}/>
  </div>
}

// ── 달성률 뱃지 색상 ──
function getRateColor(rate:number){ return rate>=100?'#00B894':rate>=80?'#FF6B35':rate>=60?'#F39C12':'#E84393' }
function getRateLabel(rate:number){ return rate>=100?'🎉 달성!':rate>=80?'🔥 거의 다 왔어요':rate>=60?'⚡ 분발 필요':rate>0?'🚨 위험':'미집계' }

const DOW=['일','월','화','수','목','금','토']
const FAIL_CHECKS=['날씨/외부요인','인력 부족','재고 부족','서비스 문제','경쟁사 영향','마케팅 부족','시즌 비수기','기타']

export default function GoalPage(){
  const supabase=createSupabaseBrowserClient()
  const now=new Date()
  const [yr,setYr]=useState(now.getFullYear())
  const [mo,setMo]=useState(now.getMonth()) // 0-based
  const [storeId,setStoreId]=useState('')
  const [myRole,setMyRole]=useState('')
  const [myName,setMyName]=useState('')

  const [weekGoals,setWeekGoals]=useState<Record<number,{weekday:number;weekend:number}>>({})
  const [weekReviews,setWeekReviews]=useState<Record<number,{failReasons:string[];comment:string;action:string}>>({})
  const [weekIssues,setWeekIssues]=useState<Record<number,{issue1:string;issue2:string}>>({})
  const [dailySales,setDailySales]=useState<Record<number,number>>({})
  const [saving,setSaving]=useState(false)
  const [savedWeek,setSavedWeek]=useState<number|null>(null)
  const [expandedWeek,setExpandedWeek]=useState<number|null>(null)

  const isOwner=myRole==='owner'
  const canEdit=myRole==='owner'||myRole==='manager'
  const moNum=mo+1
  const totalWeeks=getWeeksInMonth(yr,moNum)

  useEffect(()=>{
    const store=JSON.parse(localStorage.getItem('mj_store')||'{}')
    const user=JSON.parse(localStorage.getItem('mj_user')||'{}')
    if(!store.id) return
    setStoreId(store.id); setMyRole(user.role||''); setMyName(user.nm||'')
    loadAll(store.id,yr,moNum)
  },[yr,mo])

  async function loadAll(sid:string,y:number,m:number){
    const {data:g}=await supabase.from('goals').select('*').eq('store_id',sid).eq('year',y).eq('month',m).single()
    if(g?.weekly_goals) setWeekGoals(g.weekly_goals); else setWeekGoals({})
    if(g?.week_reviews) setWeekReviews(g.week_reviews); else setWeekReviews({})
    if(g?.week_issues) setWeekIssues(g.week_issues); else setWeekIssues({})

    const from=`${y}-${String(m).padStart(2,'0')}-01`
    const to=`${y}-${String(m).padStart(2,'0')}-${String(getDaysInMonth(y,m)).padStart(2,'0')}`
    const {data:cls}=await supabase.from('closings').select('id,closing_date').eq('store_id',sid).gte('closing_date',from).lte('closing_date',to)
    if(cls&&cls.length>0){
      const {data:sv}=await supabase.from('closing_sales').select('closing_id,amount').in('closing_id',cls.map((c:any)=>c.id))
      const map:Record<number,number>={}
      cls.forEach((cl:any)=>{
        const day=parseInt(cl.closing_date.split('-')[2])
        const total=(sv||[]).filter((s:any)=>s.closing_id===cl.id).reduce((a:number,s:any)=>a+(s.amount||0),0)
        if(total>0) map[day]=total
      })
      setDailySales(map)
    } else setDailySales({})
  }

  const weekCalc=useMemo(()=>{
    const result:Record<number,{goal:number;actual:number;weekdays:number;redDays:number}>={}
    for(let w=1;w<=totalWeeks;w++){
      const days=getWeekDays(yr,moNum,w)
      let weekdays=0,redDays=0,actual=0
      days.forEach(d=>{
        if(isRedDay(yr,moNum,d)) redDays++; else weekdays++
        actual+=dailySales[d]||0
      })
      const wg=weekGoals[w]||{weekday:0,weekend:0}
      const goal=wg.weekday*weekdays+wg.weekend*redDays
      result[w]={goal,actual,weekdays,redDays}
    }
    return result
  },[weekGoals,dailySales,yr,moNum,totalWeeks])

  const monthGoalTotal=useMemo(()=>Object.values(weekCalc).reduce((a,b)=>a+b.goal,0),[weekCalc])
  const monthActualTotal=useMemo(()=>Object.values(dailySales).reduce((a,b)=>a+b,0),[dailySales])
  const monthRate=monthGoalTotal>0?Math.round((monthActualTotal/monthGoalTotal)*100):0

  const avgWeekday=useMemo(()=>{
    const vals=Object.values(weekGoals).map(w=>w.weekday).filter(v=>v>0)
    return vals.length>0?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):0
  },[weekGoals])
  const avgWeekend=useMemo(()=>{
    const vals=Object.values(weekGoals).map(w=>w.weekend).filter(v=>v>0)
    return vals.length>0?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):0
  },[weekGoals])

  async function saveWeek(week:number){
    if(!storeId||!canEdit) return
    setSaving(true)
    await supabase.from('goals').upsert({
      store_id:storeId, year:yr, month:moNum,
      weekday_goal:avgWeekday,
      weekend_goal:avgWeekend,
      weekly_goals:weekGoals,
      week_reviews:weekReviews,
      week_issues:weekIssues,
    },{onConflict:'store_id,year,month'})
    setSaving(false); setSavedWeek(week)
    setTimeout(()=>setSavedWeek(null),2000)
  }

  function setWG(week:number,field:'weekday'|'weekend',val:number){
    setWeekGoals(p=>({...p,[week]:{...(p[week]||{weekday:0,weekend:0}),[field]:val}}))
  }
  function setWR(week:number,field:string,val:any){
    setWeekReviews(p=>({...p,[week]:{...(p[week]||{failReasons:[],comment:'',action:''}),[field]:val}}))
  }
  function setWI(week:number,field:'issue1'|'issue2',val:string){
    setWeekIssues(p=>({...p,[week]:{...(p[week]||{issue1:'',issue2:''}),[field]:val}}))
  }

  return(
    <div>
      <div style={{marginBottom:16}}>
        <YearMonthPicker year={yr} month={mo} onChange={(y,m)=>{setYr(y);setMo(m)}} color="#FF6B35"/>
      </div>

      {/* 월 전체 현황 */}
      <div style={{...bx,background:'linear-gradient(135deg,rgba(255,107,53,0.07),rgba(232,67,147,0.07))',border:'1px solid rgba(255,107,53,0.25)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:'#1a1a2e'}}>📊 {moNum}월 전체 현황</div>
            <div style={{fontSize:10,color:'#aaa',marginTop:2}}>주간 목표 자동 합산</div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:28,fontWeight:900,color:getRateColor(monthRate)}}>{monthRate}%</div>
            <div style={{fontSize:10,fontWeight:600,color:getRateColor(monthRate)}}>{getRateLabel(monthRate)}</div>
          </div>
        </div>
        <ProgressBar value={monthRate} color="#FF6B35" height={12}/>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:10}}>
          <div>
            <div style={{fontSize:10,color:'#aaa'}}>실제 매출</div>
            <div style={{fontSize:16,fontWeight:800,color:'#FF6B35'}}>{fmtW(monthActualTotal)}</div>
          </div>
          {monthGoalTotal>0&&(
            <div style={{textAlign:'center'}}>
              <div style={{fontSize:10,color:'#aaa'}}>남은 금액</div>
              <div style={{fontSize:14,fontWeight:700,color:monthActualTotal>=monthGoalTotal?'#00B894':'#E84393'}}>
                {monthActualTotal>=monthGoalTotal?'🎉 달성!':fmtW(monthGoalTotal-monthActualTotal)}
              </div>
            </div>
          )}
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:10,color:'#aaa'}}>월 목표 합계</div>
            <div style={{fontSize:16,fontWeight:800,color:'#1a1a2e'}}>{monthGoalTotal>0?fmtW(monthGoalTotal):'미설정'}</div>
          </div>
        </div>
      </div>

      {/* 주차별 카드 */}
      {Array.from({length:totalWeeks},(_,i)=>i+1).map(week=>{
        const days=getWeekDays(yr,moNum,week)
        const calc=weekCalc[week]||{goal:0,actual:0,weekdays:0,redDays:0}
        const rate=calc.goal>0?Math.round((calc.actual/calc.goal)*100):0
        const wg=weekGoals[week]||{weekday:0,weekend:0}
        const wr=weekReviews[week]||{failReasons:[],comment:'',action:''}
        const wi=weekIssues[week]||{issue1:'',issue2:''}
        const isExpanded=expandedWeek===week
        const isCurrent=yr===now.getFullYear()&&moNum===now.getMonth()+1&&days.includes(now.getDate())
        const isSaved=savedWeek===week
        const hasIssues=wi.issue1||wi.issue2

        return(
          <div key={week} style={{...bx,border:isCurrent?'2px solid rgba(255,107,53,0.45)':'1px solid #E8ECF0'}}>
            {/* 헤더 */}
            <div onClick={()=>setExpandedWeek(isExpanded?null:week)} style={{cursor:'pointer'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  {isCurrent&&<span style={{fontSize:10,background:'rgba(255,107,53,0.15)',color:'#FF6B35',padding:'2px 7px',borderRadius:6,fontWeight:700}}>이번 주</span>}
                  <span style={{fontSize:14,fontWeight:700,color:'#1a1a2e'}}>{week}주차</span>
                  <span style={{fontSize:11,color:'#aaa'}}>{moNum}/{days[0]} ~ {moNum}/{days[days.length-1]}</span>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  {hasIssues&&<span style={{fontSize:10,background:'rgba(232,67,147,0.1)',color:'#E84393',padding:'2px 6px',borderRadius:6,fontWeight:700}}>📌 지적사항</span>}
                  {calc.goal>0&&(
                    <span style={{fontSize:14,fontWeight:800,color:getRateColor(rate)}}>{rate}%</span>
                  )}
                  <span style={{fontSize:11,color:'#ccc'}}>{isExpanded?'▲':'▼'}</span>
                </div>
              </div>

              {/* 주간 달성률 강조 배너 */}
              {calc.goal>0&&(
                <div style={{background:rate>=100?'rgba(0,184,148,0.07)':rate>=80?'rgba(255,107,53,0.07)':'rgba(232,67,147,0.07)',
                  borderRadius:10,padding:'8px 12px',marginBottom:10,
                  border:`1px solid ${rate>=100?'rgba(0,184,148,0.2)':rate>=80?'rgba(255,107,53,0.2)':'rgba(232,67,147,0.2)'}`}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                    <span style={{fontSize:11,fontWeight:700,color:getRateColor(rate)}}>
                      {getRateLabel(rate)}
                    </span>
                    <span style={{fontSize:20,fontWeight:900,color:getRateColor(rate)}}>{rate}%</span>
                  </div>
                  <ProgressBar value={rate} color={getRateColor(rate)} height={10}/>
                  <div style={{display:'flex',justifyContent:'space-between',marginTop:5}}>
                    <span style={{fontSize:11,color:'#aaa'}}>실제 {fmtW(calc.actual)}</span>
                    {calc.actual<calc.goal&&<span style={{fontSize:11,color:'#E84393',fontWeight:600}}>-{fmtW(calc.goal-calc.actual)}</span>}
                    <span style={{fontSize:11,color:'#aaa'}}>목표 {fmtW(calc.goal)}</span>
                  </div>
                </div>
              )}

              {/* 일별 미니 캘린더 */}
              <div style={{display:'flex',gap:3,marginTop:4}}>
                {days.map(d=>{
                  const dow=getDow(yr,moNum,d)
                  const sale=dailySales[d]||0
                  const holiday=getHoliday(yr,moNum,d)
                  const isRed=dow===0||dow===6||!!holiday
                  const dayGoal=isRed?(wg.weekend||0):(wg.weekday||0)
                  const dayRate=dayGoal>0&&sale>0?Math.round((sale/dayGoal)*100):null
                  const isToday=yr===now.getFullYear()&&moNum===now.getMonth()+1&&d===now.getDate()
                  return(
                    <div key={d} style={{flex:1,textAlign:'center',borderRadius:8,padding:'5px 2px',minHeight:64,
                      background:sale>0?(dayRate!==null&&dayRate>=100?'rgba(0,184,148,0.1)':'rgba(255,107,53,0.07)'):'#F8F9FB',
                      border:isToday?'2px solid #FF6B35':'1px solid #F0F0F0'}}>
                      <div style={{fontSize:9,color:isRed?'#E84393':'#bbb',fontWeight:600}}>
                        {holiday?'🔴':DOW[dow]}
                      </div>
                      <div style={{fontSize:11,fontWeight:isToday?800:500,color:isRed?'#E84393':'#555',marginTop:1}}>{d}</div>
                      {holiday&&<div style={{fontSize:7,color:'#E84393',marginTop:1,lineHeight:1.1}}>{holiday}</div>}
                      {sale>0&&<div style={{fontSize:8,color:'#FF6B35',fontWeight:700,marginTop:1}}>{fmtW(sale)}</div>}
                      {dayRate!==null&&<div style={{fontSize:7,color:dayRate>=100?'#00B894':'#E84393',fontWeight:700}}>{dayRate}%</div>}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 펼침 영역 */}
            {isExpanded&&(
              <div style={{marginTop:16,borderTop:'1px solid #F4F6F9',paddingTop:16}}>

                {/* 주간 지적사항 - 대표만 입력, 전직원 열람 */}
                <div style={{marginBottom:16,background:'rgba(232,67,147,0.04)',borderRadius:12,padding:14,border:'1px solid rgba(232,67,147,0.15)'}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
                    <span style={{fontSize:12,fontWeight:700,color:'#E84393'}}>📌 주간 지적사항</span>
                    {isOwner
                      ? <span style={{fontSize:9,background:'rgba(232,67,147,0.12)',color:'#E84393',padding:'2px 6px',borderRadius:4,fontWeight:600}}>대표 입력</span>
                      : <span style={{fontSize:9,background:'#F0F2F5',color:'#aaa',padding:'2px 6px',borderRadius:4}}>열람만 가능</span>
                    }
                  </div>

                  <div style={{marginBottom:8}}>
                    <div style={{fontSize:11,color:'#E84393',fontWeight:600,marginBottom:4}}>① 지적사항 1</div>
                    {isOwner
                      ? <textarea
                          value={wi.issue1||''}
                          onChange={e=>setWI(week,'issue1',e.target.value)}
                          placeholder="이번 주 첫 번째 지적사항을 입력하세요..."
                          style={{...ta,minHeight:56,borderColor:'rgba(232,67,147,0.25)',background:'#fff'}}
                        />
                      : <div style={{padding:'8px 12px',borderRadius:8,background:'#fff',border:'1px solid #E8ECF0',fontSize:12,color:wi.issue1?'#1a1a2e':'#ccc',minHeight:40,lineHeight:1.6}}>
                          {wi.issue1||'입력된 지적사항 없음'}
                        </div>
                    }
                  </div>

                  <div>
                    <div style={{fontSize:11,color:'#E84393',fontWeight:600,marginBottom:4}}>② 지적사항 2</div>
                    {isOwner
                      ? <textarea
                          value={wi.issue2||''}
                          onChange={e=>setWI(week,'issue2',e.target.value)}
                          placeholder="이번 주 두 번째 지적사항을 입력하세요..."
                          style={{...ta,minHeight:56,borderColor:'rgba(232,67,147,0.25)',background:'#fff'}}
                        />
                      : <div style={{padding:'8px 12px',borderRadius:8,background:'#fff',border:'1px solid #E8ECF0',fontSize:12,color:wi.issue2?'#1a1a2e':'#ccc',minHeight:40,lineHeight:1.6}}>
                          {wi.issue2||'입력된 지적사항 없음'}
                        </div>
                    }
                  </div>
                </div>

                {/* 목표 입력 */}
                <div style={{fontSize:12,fontWeight:700,color:'#555',marginBottom:10}}>🎯 목표 설정</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                  <div style={{background:'#FFF5F0',borderRadius:12,padding:12,border:'1px solid rgba(255,107,53,0.2)'}}>
                    <div style={{fontSize:10,color:'#FF6B35',fontWeight:700,marginBottom:6}}>
                      📅 평일 목표
                      <span style={{color:'#aaa',fontWeight:400}}> ({calc.weekdays}일)</span>
                    </div>
                    {canEdit
                      ? <input value={toComma(wg.weekday)} onChange={e=>setWG(week,'weekday',fromComma(e.target.value))} placeholder="0" style={{...inp,background:'#fff',fontSize:13}}/>
                      : <div style={{fontSize:15,fontWeight:800,color:'#FF6B35'}}>{wg.weekday>0?fmtW(wg.weekday):'미설정'}</div>
                    }
                    {wg.weekday>0&&<div style={{fontSize:9,color:'#FF6B35',textAlign:'right',marginTop:3}}>합계 {fmtW(wg.weekday*calc.weekdays)}</div>}
                  </div>
                  <div style={{background:'#FFF0F0',borderRadius:12,padding:12,border:'1px solid rgba(232,67,147,0.2)'}}>
                    <div style={{fontSize:10,color:'#E84393',fontWeight:700,marginBottom:6}}>
                      🔴 주말/공휴일 목표
                      <span style={{color:'#aaa',fontWeight:400}}> ({calc.redDays}일)</span>
                    </div>
                    {canEdit
                      ? <input value={toComma(wg.weekend)} onChange={e=>setWG(week,'weekend',fromComma(e.target.value))} placeholder="0" style={{...inp,background:'#fff',fontSize:13}}/>
                      : <div style={{fontSize:15,fontWeight:800,color:'#E84393'}}>{wg.weekend>0?fmtW(wg.weekend):'미설정'}</div>
                    }
                    {wg.weekend>0&&<div style={{fontSize:9,color:'#E84393',textAlign:'right',marginTop:3}}>합계 {fmtW(wg.weekend*calc.redDays)}</div>}
                  </div>
                </div>

                {/* 주 목표 합계 */}
                {calc.goal>0&&(
                  <div style={{background:'rgba(255,107,53,0.06)',borderRadius:10,padding:'8px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                    <span style={{fontSize:12,color:'#888'}}>이번 주 목표 합계</span>
                    <span style={{fontSize:15,fontWeight:800,color:'#FF6B35'}}>{fmtW(calc.goal)}</span>
                  </div>
                )}

                {/* 리뷰 섹션 */}
                <div style={{fontSize:12,fontWeight:700,color:'#555',marginBottom:10}}>📝 주간 리뷰</div>

                {calc.goal>0&&calc.actual<calc.goal&&(
                  <div style={{marginBottom:12}}>
                    <div style={{fontSize:11,color:'#E84393',fontWeight:600,marginBottom:8}}>미달성 원인 체크</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                      {FAIL_CHECKS.map(fc=>(
                        <label key={fc} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 10px',borderRadius:8,
                          background:wr.failReasons?.includes(fc)?'rgba(232,67,147,0.08)':'#F8F9FB',
                          border:`1px solid ${wr.failReasons?.includes(fc)?'rgba(232,67,147,0.25)':'#E8ECF0'}`,
                          cursor:canEdit?'pointer':'default'}}>
                          <input type="checkbox" checked={wr.failReasons?.includes(fc)||false} disabled={!canEdit}
                            onChange={e=>setWR(week,'failReasons',e.target.checked?[...(wr.failReasons||[]),fc]:(wr.failReasons||[]).filter((r:string)=>r!==fc))}
                            style={{accentColor:'#E84393',flexShrink:0}}/>
                          <span style={{fontSize:11,color:wr.failReasons?.includes(fc)?'#E84393':'#666'}}>{fc}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{fontSize:11,color:'#888',marginBottom:5}}>코멘트 / 분석</div>
                <textarea value={wr.comment||''} onChange={e=>canEdit&&setWR(week,'comment',e.target.value)}
                  placeholder={canEdit?"이번 주 성과 분석, 특이사항...":"작성된 내용 없음"} style={{...ta,marginBottom:10}} readOnly={!canEdit}/>

                <div style={{fontSize:11,color:'#6C5CE7',fontWeight:600,marginBottom:5}}>🚀 다음 주 액션 플랜</div>
                <textarea value={wr.action||''} onChange={e=>canEdit&&setWR(week,'action',e.target.value)}
                  placeholder={canEdit?"다음 주 매출 향상을 위한 실행 계획...":"작성된 내용 없음"} style={{...ta,borderColor:'rgba(108,92,231,0.3)'}} readOnly={!canEdit}/>

                {canEdit&&(
                  <button onClick={()=>saveWeek(week)} disabled={saving}
                    style={{width:'100%',marginTop:12,padding:'11px 0',borderRadius:10,border:'none',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',
                      background:isSaved?'#00B894':saving?'#ddd':'linear-gradient(135deg,#FF6B35,#E84393)'}}>
                    {isSaved?'✓ 저장완료!':saving?'저장 중...':'💾 저장'}
                  </button>
                )}
                {!canEdit&&<div style={{marginTop:10,textAlign:'center',fontSize:11,color:'#ccc'}}>목표 설정은 대표/관리자만 가능합니다</div>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}