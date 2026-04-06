'use client'
import { useEffect, useState, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import YearMonthPicker from '@/components/YearMonthPicker'

// ── 한국 공휴일 ──
const KR_HOLIDAYS: Record<string, string> = {
  '0101': '신정', '0301': '삼일절', '0505': '어린이날',
  '0606': '현충일', '0815': '광복절', '1003': '개천절',
  '1009': '한글날', '1225': '크리스마스', '0501': '근로자의날',
  '20250128': '설 전날', '20250129': '설날', '20250130': '설 다음날',
  '20250506': '대체공휴일', '20250605': '대체공휴일',
  '20251005': '추석 전날', '20251006': '추석', '20251007': '추석 다음날', '20251008': '대체공휴일',
  '20260216': '설 전날', '20260217': '설날', '20260218': '설 다음날',
  '20260302': '대체공휴일', '20260524': '부처님오신날',
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
function getRemainingDays(y: number, m: number, week: number, today: Date): number {
  const days = getWeekDays(y, m, week)
  const todayDate = today.getFullYear()===y && today.getMonth()+1===m ? today.getDate() : -1
  return days.filter(d => d > todayDate).length
}
function getMonthRemainingDays(y: number, m: number, today: Date): number {
  const total = getDaysInMonth(y, m)
  const todayDate = today.getFullYear()===y && today.getMonth()+1===m ? today.getDate() : -1
  let count = 0
  for (let d = todayDate + 1; d <= total; d++) count++
  return count
}

// ── 사진 base64 변환 ──
function fileToBase64(file: File, maxWidth = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const ratio = Math.min(1, maxWidth / img.width)
        canvas.width = img.width * ratio
        canvas.height = img.height * ratio
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── 스타일 ──
const bx = { background:'#fff', borderRadius:16, border:'1px solid #E8ECF0', padding:16, marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width:'100%', padding:'9px 12px', borderRadius:8, background:'#F8F9FB', border:'1px solid #E0E4E8', color:'#1a1a2e', fontSize:14, outline:'none', boxSizing:'border-box' as const, textAlign:'right' as const }
const ta = { width:'100%', padding:'9px 12px', borderRadius:8, background:'#F8F9FB', border:'1px solid #E0E4E8', color:'#1a1a2e', fontSize:12, outline:'none', boxSizing:'border-box' as const, resize:'vertical' as const, minHeight:70, lineHeight:1.6 }
const singleInp = { width:'100%', padding:'9px 12px', borderRadius:8, background:'#fff', border:'1px solid rgba(232,67,147,0.2)', color:'#1a1a2e', fontSize:13, outline:'none', boxSizing:'border-box' as const }

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
function getRateColor(rate:number){ return rate>=100?'#00B894':rate>=80?'#FF6B35':rate>=60?'#F39C12':'#E84393' }
function getRateLabel(rate:number){ return rate>=100?'🎉 달성':rate>=80?'🔥 분발':rate>=60?'⚡ 주의':'🚨 위험' }

const DOW=['일','월','화','수','목','금','토']
const FAIL_CHECKS=['날씨/외부요인','인력 부족','재고 부족','서비스 문제','경쟁사 영향','마케팅 부족','시즌 비수기','기타']

const STORE_COLORS = ['#FF6B35','#6C5CE7','#00B894','#E84393','#2DC6D6','#F39C12']

type Issue = { id: string; text: string; imageUrl?: string; imageBase64?: string }
function getIssueImage(issue: Issue): string { return issue.imageBase64 || issue.imageUrl || '' }
function parseWeekIssues(raw: any): Record<number, Issue[]> {
  if (!raw) return {}
  const result: Record<number, Issue[]> = {}
  try {
    for (const key of Object.keys(raw)) {
      const val = raw[key]; const weekNum = Number(key)
      if (Array.isArray(val)) result[weekNum] = val.filter((v: any) => v && v.id && v.text)
      else if (val && typeof val === 'object') {
        const items: Issue[] = []
        if (val.issue1?.trim()) items.push({ id: 'legacy1', text: val.issue1 })
        if (val.issue2?.trim()) items.push({ id: 'legacy2', text: val.issue2 })
        result[weekNum] = items
      }
    }
  } catch(e) {}
  return result
}

// ════════════════════════════════════════
// ★ 전지점 목표 탭 (대표 전용) - 가로 비교 형식
// ════════════════════════════════════════
function AllStoresGoalTab({ mainStoreId }: { mainStoreId: string }) {
  const supabase = createSupabaseBrowserClient()
  const now = new Date()
  const [yr, setYr] = useState(now.getFullYear())
  const [mo, setMo] = useState(now.getMonth())
  const [stores, setStores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)

  type StoreCalc = {
    monthGoal: number; monthActual: number; expectedSales: number
    weekCalc: Record<number, { goal:number; actual:number; weekdays:number; redDays:number }>
    weekGoals: Record<number, { weekday:number; weekend:number }>
  }
  const [storeData, setStoreData] = useState<Record<string, StoreCalc>>({})

  const moNum = mo + 1
  const totalWeeks = getWeeksInMonth(yr, moNum)
  const currentWeek = yr===now.getFullYear()&&moNum===now.getMonth()+1 ? getWeekNum(yr,moNum,now.getDate()) : -1
  const isCurrentMonth = yr===now.getFullYear()&&moNum===now.getMonth()+1

  useEffect(() => { loadStores() }, [mainStoreId])
  useEffect(() => { if (stores.length > 0) loadAllData() }, [stores, yr, mo])

  async function loadStores() {
    setLoading(true)
    const { data: memberData } = await supabase
      .from('store_members').select('store_id, role, stores(id, name)').eq('role', 'owner')
    let storeList = (memberData || [])
      .map((m: any) => m.stores).filter(Boolean)
      .filter((s: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.id === s.id) === i)
    if (storeList.length === 0) {
      const { data: sd } = await supabase.from('stores').select('id, name').eq('id', mainStoreId).maybeSingle()
      if (sd) storeList = [sd]
    }
    setStores(storeList)
    setLoading(false)
  }

  async function loadAllData() {
    setDataLoading(true)
    const result: Record<string, StoreCalc> = {}
    await Promise.all(stores.map(async (store: any) => {
      const sid = store.id
      const { data: g } = await supabase.from('goals').select('*')
        .eq('store_id', sid).eq('year', yr).eq('month', moNum).maybeSingle()
      const weekGoals: Record<number, {weekday:number;weekend:number}> = g?.weekly_goals || {}

      const from = `${yr}-${String(moNum).padStart(2,'0')}-01`
      const to = `${yr}-${String(moNum).padStart(2,'0')}-${String(getDaysInMonth(yr,moNum)).padStart(2,'0')}`
      const { data: cls } = await supabase.from('closings').select('id,closing_date')
        .eq('store_id', sid).gte('closing_date', from).lte('closing_date', to)

      const dailySales: Record<number, number> = {}
      if (cls && cls.length > 0) {
        const { data: sv } = await supabase.from('closing_sales').select('closing_id,amount')
          .in('closing_id', cls.map((c: any) => c.id))
        cls.forEach((cl: any) => {
          const day = parseInt(cl.closing_date.split('-')[2])
          const total = (sv || []).filter((s: any) => s.closing_id === cl.id).reduce((a: number, s: any) => a + (s.amount || 0), 0)
          if (total > 0) dailySales[day] = total
        })
      }

      const weekCalc: Record<number, {goal:number;actual:number;weekdays:number;redDays:number}> = {}
      let monthGoal = 0, monthActual = 0
      for (let w = 1; w <= totalWeeks; w++) {
        const days = getWeekDays(yr, moNum, w)
        let weekdays = 0, redDays = 0, actual = 0
        days.forEach(d => {
          if (isRedDay(yr, moNum, d)) redDays++; else weekdays++
          actual += dailySales[d] || 0
        })
        const wg = weekGoals[w] || { weekday: 0, weekend: 0 }
        const goal = wg.weekday * weekdays + wg.weekend * redDays
        weekCalc[w] = { goal, actual, weekdays, redDays }
        monthGoal += goal; monthActual += actual
      }

      let expectedSales = 0
      for (let w = 1; w <= totalWeeks; w++) {
        const calc = weekCalc[w] || { goal:0, actual:0 }
        if (w < currentWeek) { expectedSales += calc.actual }
        else if (w === currentWeek) {
          const days = getWeekDays(yr, moNum, w)
          const wg = weekGoals[w] || { weekday:0, weekend:0 }
          let futureGoal = 0
          days.forEach(d => { if (d > now.getDate()) futureGoal += isRedDay(yr,moNum,d) ? wg.weekend : wg.weekday })
          expectedSales += calc.actual + futureGoal
        } else { expectedSales += calc.goal }
      }

      result[sid] = { monthGoal, monthActual, expectedSales, weekCalc, weekGoals }
    }))
    setStoreData(result)
    setDataLoading(false)
  }

  if (loading) return (
    <div style={{ textAlign:'center', padding:48, color:'#bbb' }}>
      <div style={{ fontSize:24, marginBottom:8 }}>⏳</div>
      <div style={{ fontSize:13 }}>전 지점 데이터 불러오는 중...</div>
    </div>
  )

  const weeks = Array.from({length: totalWeeks}, (_, i) => i + 1)

  return (
    <div>
      <div style={{ marginBottom:16 }}>
        <YearMonthPicker year={yr} month={mo} onChange={(y,m)=>{setYr(y);setMo(m)}} color="#6C5CE7"/>
      </div>
      {dataLoading && (
        <div style={{ textAlign:'center', padding:'10px', fontSize:12, color:'#aaa', marginBottom:8 }}>🔄 데이터 업데이트 중...</div>
      )}

      {/* ── 월 달성률 가로 비교 카드 ── */}
      <div style={{ overflowX:'auto', marginBottom:12 }}>
        <div style={{ display:'flex', gap:10, minWidth: stores.length > 2 ? stores.length * 160 : 'auto' }}>
          {stores.map((store: any, si: number) => {
            const d = storeData[store.id]
            const color = STORE_COLORS[si % STORE_COLORS.length]
            const monthRate = d && d.monthGoal > 0 ? Math.round((d.monthActual / d.monthGoal) * 100) : 0
            const expectedRate = d && d.monthGoal > 0 ? Math.round((d.expectedSales / d.monthGoal) * 100) : 0
            const monthRemaining = d ? Math.max(d.monthGoal - d.monthActual, 0) : 0
            const monthRemainDays = getMonthRemainingDays(yr, moNum, now)

            return (
              <div key={store.id} style={{ flex:1, minWidth:150, background:'#fff', borderRadius:16, border:`2px solid ${color}30`, padding:14, boxShadow:`0 2px 12px ${color}15` }}>
                {/* 지점명 */}
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:color, flexShrink:0 }}/>
                  <span style={{ fontSize:13, fontWeight:800, color:'#1a1a2e' }}>{store.name}</span>
                </div>

                {d && d.monthGoal > 0 ? (
                  <>
                    {/* 달성률 크게 */}
                    <div style={{ textAlign:'center', marginBottom:10 }}>
                      <div style={{ fontSize:32, fontWeight:900, color:getRateColor(monthRate), lineHeight:1 }}>{monthRate}%</div>
                      <div style={{ fontSize:11, fontWeight:700, color:getRateColor(monthRate), marginTop:3 }}>{getRateLabel(monthRate)}</div>
                    </div>
                    <ProgressBar value={monthRate} color={color} height={8}/>
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, marginBottom:10 }}>
                      <div>
                        <div style={{ fontSize:9, color:'#aaa' }}>실제 매출</div>
                        <div style={{ fontSize:12, fontWeight:800, color }}>{ fmtW(d.monthActual)}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:9, color:'#aaa' }}>월 목표</div>
                        <div style={{ fontSize:12, fontWeight:700, color:'#1a1a2e' }}>{fmtW(d.monthGoal)}</div>
                      </div>
                    </div>

                    {/* 남은 매출 */}
                    {monthRemaining > 0 ? (
                      <div style={{ padding:'8px 10px', borderRadius:10, background:`${color}08`, border:`1px dashed ${color}40`, marginBottom:8 }}>
                        <div style={{ fontSize:9, color:'#aaa', marginBottom:3 }}>
                          달성까지 {isCurrentMonth&&monthRemainDays>0?`(${monthRemainDays}일 남음)`:''}
                        </div>
                        <div style={{ fontSize:14, fontWeight:900, color }}>-{fmtW(monthRemaining)}</div>
                        {isCurrentMonth&&monthRemainDays>0&&(
                          <div style={{ fontSize:9, color:'#aaa', marginTop:2 }}>
                            하루 {fmtW(Math.ceil(monthRemaining/monthRemainDays))} 필요
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ padding:'7px 10px', borderRadius:10, background:'rgba(0,184,148,0.08)', marginBottom:8, textAlign:'center' }}>
                        <span style={{ fontSize:11, fontWeight:700, color:'#00B894' }}>🎉 달성!</span>
                      </div>
                    )}

                    {/* 예상 */}
                    {isCurrentMonth && (
                      <div style={{ padding:'7px 10px', borderRadius:10, background:'rgba(108,92,231,0.06)', border:'1px solid rgba(108,92,231,0.15)' }}>
                        <div style={{ fontSize:9, color:'#6C5CE7', marginBottom:3 }}>🔮 예상 달성률</div>
                        <div style={{ fontSize:16, fontWeight:800, color:'#6C5CE7' }}>{expectedRate}%</div>
                        <div style={{ fontSize:9, color:'#aaa', marginTop:1 }}>
                          {d.monthGoal > d.expectedSales
                            ? `-${fmtW(d.monthGoal - d.expectedSales)} 부족 예상`
                            : `+${fmtW(d.expectedSales - d.monthGoal)} 초과 예상`}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign:'center', padding:'20px 0', color:'#ccc', fontSize:12 }}>
                    목표 미설정
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 주차별 가로 비교표 ── */}
      <div style={{ background:'#fff', borderRadius:16, border:'1px solid #E8ECF0', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid #F0F2F5', fontSize:12, fontWeight:700, color:'#1a1a2e' }}>
          📅 주차별 비교
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:'#F8F9FB' }}>
                <th style={{ padding:'10px 14px', textAlign:'left', color:'#888', fontWeight:700, fontSize:11, borderBottom:'1px solid #E8ECF0', whiteSpace:'nowrap', minWidth:80 }}>주차</th>
                {stores.map((store: any, si: number) => (
                  <th key={store.id} style={{ padding:'10px 12px', textAlign:'center', borderBottom:'1px solid #E8ECF0', minWidth:140 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:STORE_COLORS[si % STORE_COLORS.length] }}/>
                      <span style={{ fontSize:12, fontWeight:700, color:'#1a1a2e' }}>{store.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map(week => {
                const days = getWeekDays(yr, moNum, week)
                const isCurrent = yr===now.getFullYear()&&moNum===now.getMonth()+1&&days.includes(now.getDate())
                const isPast = isCurrentMonth && week < currentWeek

                return (
                  <tr key={week} style={{ background: isCurrent ? 'rgba(255,107,53,0.03)' : '#fff', borderBottom:'1px solid #F4F6F9' }}>
                    {/* 주차 라벨 */}
                    <td style={{ padding:'12px 14px', verticalAlign:'middle' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        {isCurrent && (
                          <span style={{ fontSize:9, background:'rgba(255,107,53,0.15)', color:'#FF6B35', padding:'1px 5px', borderRadius:4, fontWeight:700, whiteSpace:'nowrap' }}>이번 주</span>
                        )}
                        {isPast && (
                          <span style={{ fontSize:9, background:'#F0F2F5', color:'#aaa', padding:'1px 5px', borderRadius:4, fontWeight:600, whiteSpace:'nowrap' }}>지난 주</span>
                        )}
                        {!isCurrent && !isPast && isCurrentMonth && (
                          <span style={{ fontSize:9, background:'rgba(108,92,231,0.1)', color:'#6C5CE7', padding:'1px 5px', borderRadius:4, fontWeight:600, whiteSpace:'nowrap' }}>예정</span>
                        )}
                      </div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', marginTop:2 }}>{week}주차</div>
                      <div style={{ fontSize:10, color:'#aaa' }}>{moNum}/{days[0]}~{moNum}/{days[days.length-1]}</div>
                    </td>

                    {/* 지점별 주간 데이터 */}
                    {stores.map((store: any, si: number) => {
                      const d = storeData[store.id]
                      const color = STORE_COLORS[si % STORE_COLORS.length]
                      const calc = d?.weekCalc[week] || { goal:0, actual:0 }
                      const rate = calc.goal > 0 ? Math.round((calc.actual / calc.goal) * 100) : 0
                      const remaining = Math.max(calc.goal - calc.actual, 0)
                      const remainDays = getRemainingDays(yr, moNum, week, now)

                      return (
                        <td key={store.id} style={{ padding:'12px', verticalAlign:'middle', borderLeft:'1px solid #F4F6F9' }}>
                          {calc.goal > 0 ? (
                            <div>
                              {/* 달성률 + 라벨 */}
                              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:5 }}>
                                <span style={{ fontSize:11, fontWeight:700, color:getRateColor(rate) }}>{getRateLabel(rate)}</span>
                                <span style={{ fontSize:16, fontWeight:900, color:getRateColor(rate) }}>{rate}%</span>
                              </div>
                              <ProgressBar value={rate} color={color} height={6}/>
                              {/* 실제/목표 */}
                              <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
                                <span style={{ fontSize:10, color:color, fontWeight:700 }}>{fmtW(calc.actual)}</span>
                                <span style={{ fontSize:10, color:'#aaa' }}>{fmtW(calc.goal)}</span>
                              </div>
                              {/* 남은 매출 */}
                              {remaining > 0 && (
                                <div style={{ marginTop:5, padding:'4px 8px', borderRadius:7, background:`${getRateColor(rate)}10`, border:`1px solid ${getRateColor(rate)}25` }}>
                                  <div style={{ fontSize:9, color:'#aaa' }}>
                                    {remainDays > 0 ? `${remainDays}일 남음` : '마감'}
                                  </div>
                                  <div style={{ fontSize:11, fontWeight:800, color:getRateColor(rate) }}>-{fmtW(remaining)}</div>
                                  {remainDays > 0 && (
                                    <div style={{ fontSize:9, color:'#aaa' }}>하루 {fmtW(Math.ceil(remaining/remainDays))}</div>
                                  )}
                                </div>
                              )}
                              {remaining === 0 && (
                                <div style={{ marginTop:5, padding:'4px 8px', borderRadius:7, background:'rgba(0,184,148,0.08)', textAlign:'center' }}>
                                  <span style={{ fontSize:10, fontWeight:700, color:'#00B894' }}>🎉 달성!</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ textAlign:'center', color:'#ddd', fontSize:11 }}>미설정</div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}

              {/* 월 합계 행 */}
              <tr style={{ background:'#F8F9FB', borderTop:'2px solid #E8ECF0' }}>
                <td style={{ padding:'12px 14px' }}>
                  <div style={{ fontSize:12, fontWeight:800, color:'#1a1a2e' }}>📊 월 합계</div>
                </td>
                {stores.map((store: any, si: number) => {
                  const d = storeData[store.id]
                  const color = STORE_COLORS[si % STORE_COLORS.length]
                  const monthRate = d && d.monthGoal > 0 ? Math.round((d.monthActual / d.monthGoal) * 100) : 0
                  return (
                    <td key={store.id} style={{ padding:'12px', borderLeft:'1px solid #E8ECF0' }}>
                      {d && d.monthGoal > 0 ? (
                        <div>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                            <span style={{ fontSize:11, fontWeight:700, color:getRateColor(monthRate) }}>{monthRate}%</span>
                          </div>
                          <ProgressBar value={monthRate} color={color} height={6}/>
                          <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
                            <span style={{ fontSize:10, color, fontWeight:700 }}>{fmtW(d.monthActual)}</span>
                            <span style={{ fontSize:10, color:'#aaa' }}>{fmtW(d.monthGoal)}</span>
                          </div>
                          {isCurrentMonth && (
                            <div style={{ marginTop:5, padding:'4px 8px', borderRadius:7, background:'rgba(108,92,231,0.08)' }}>
                              <div style={{ fontSize:9, color:'#6C5CE7' }}>🔮 예상</div>
                              <div style={{ fontSize:11, fontWeight:800, color:'#6C5CE7' }}>
                                {d.monthGoal > 0 ? Math.round((d.expectedSales / d.monthGoal) * 100) : 0}%
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ textAlign:'center', color:'#ddd', fontSize:11 }}>미설정</div>
                      )}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// 메인 페이지
// ════════════════════════════════════════
export default function GoalPage(){
  const supabase = createSupabaseBrowserClient()
  const now = new Date()
  const [yr,setYr] = useState(now.getFullYear())
  const [mo,setMo] = useState(now.getMonth())
  const [storeId,setStoreId] = useState('')
  const [myRole,setMyRole] = useState('')
  const [tab, setTab] = useState<'my'|'all'>('my')

  const [weekGoals,setWeekGoals] = useState<Record<number,{weekday:number;weekend:number}>>({})
  const [weekReviews,setWeekReviews] = useState<Record<number,{failReasons:string[];comment:string;action:string}>>({})
  const [weekIssues,setWeekIssues] = useState<Record<number,Issue[]>>({})

  const [newText,setNewText] = useState<Record<number,string>>({})
  const [newPreview,setNewPreview] = useState<Record<number,string>>({})
  const [newBase64,setNewBase64] = useState<Record<number,string>>({})
  const [converting,setConverting] = useState(false)

  const [editingIssue,setEditingIssue] = useState<{week:number;id:string}|null>(null)
  const [editText,setEditText] = useState('')
  const [editBase64,setEditBase64] = useState('')
  const [editPreview,setEditPreview] = useState('')

  const [dailySales,setDailySales] = useState<Record<number,number>>({})
  const [saving,setSaving] = useState(false)
  const [saveError,setSaveError] = useState<string|null>(null)
  const [savedWeek,setSavedWeek] = useState<number|null>(null)
  const [expandedWeek,setExpandedWeek] = useState<number|null>(null)
  const [lightbox,setLightbox] = useState<string|null>(null)

  const isOwner = myRole==='owner'
  const canEdit = myRole==='owner'||myRole==='manager'
  const moNum = mo+1
  const totalWeeks = getWeeksInMonth(yr,moNum)
  const isCurrentMonth = yr===now.getFullYear()&&moNum===now.getMonth()+1
  const currentWeek = isCurrentMonth ? getWeekNum(yr,moNum,now.getDate()) : -1

  useEffect(()=>{
    const store=JSON.parse(localStorage.getItem('mj_store')||'{}')
    const user=JSON.parse(localStorage.getItem('mj_user')||'{}')
    if(!store.id) return
    setStoreId(store.id); setMyRole(user.role||'')
    loadAll(store.id,yr,moNum)
  },[yr,mo])

  async function loadAll(sid:string,y:number,m:number){
    const {data:g}=await supabase.from('goals').select('*').eq('store_id',sid).eq('year',y).eq('month',m).single()
    if(g?.weekly_goals) setWeekGoals(g.weekly_goals); else setWeekGoals({})
    if(g?.week_reviews) setWeekReviews(g.week_reviews); else setWeekReviews({})
    setWeekIssues(parseWeekIssues(g?.week_issues))
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

  async function handleNewImage(week:number, file:File){
    setConverting(true)
    try { const b64=await fileToBase64(file); setNewBase64(p=>({...p,[week]:b64})); setNewPreview(p=>({...p,[week]:b64})) }
    catch(e){ alert('이미지 변환 실패') }
    setConverting(false)
  }
  async function handleEditImage(file:File){
    setConverting(true)
    try { const b64=await fileToBase64(file); setEditBase64(b64); setEditPreview(b64) }
    catch(e){ alert('이미지 변환 실패') }
    setConverting(false)
  }

  function addIssue(week:number){
    const text=(newText[week]||'').trim(); if(!text) return
    const item:Issue={ id:Date.now().toString(), text, ...(newBase64[week]?{imageBase64:newBase64[week]}:{}) }
    setWeekIssues(p=>({...p,[week]:[...(p[week]||[]),item]}))
    setNewText(p=>({...p,[week]:''})); setNewBase64(p=>({...p,[week]:''})); setNewPreview(p=>({...p,[week]:''}))
  }
  function startEdit(week:number,issue:Issue){
    setEditingIssue({week,id:issue.id}); setEditText(issue.text)
    const img=getIssueImage(issue); setEditBase64(img); setEditPreview(img)
  }
  function saveEdit(week:number){
    if(!editingIssue) return
    setWeekIssues(p=>({...p,[week]:(p[week]||[]).map(i=>i.id===editingIssue.id?{...i,text:editText,imageBase64:editBase64||undefined,imageUrl:editBase64?undefined:i.imageUrl}:i)}))
    setEditingIssue(null); setEditText(''); setEditBase64(''); setEditPreview('')
  }
  function deleteIssue(week:number,id:string){
    setWeekIssues(p=>({...p,[week]:(p[week]||[]).filter(i=>i.id!==id)}))
  }

  const weekCalc=useMemo(()=>{
    const result:Record<number,{goal:number;actual:number;weekdays:number;redDays:number}>={}
    for(let w=1;w<=totalWeeks;w++){
      const days=getWeekDays(yr,moNum,w)
      let weekdays=0,redDays=0,actual=0
      days.forEach(d=>{ if(isRedDay(yr,moNum,d)) redDays++; else weekdays++; actual+=dailySales[d]||0 })
      const wg=weekGoals[w]||{weekday:0,weekend:0}
      result[w]={goal:wg.weekday*weekdays+wg.weekend*redDays,actual,weekdays,redDays}
    }
    return result
  },[weekGoals,dailySales,yr,moNum,totalWeeks])

  const monthGoalTotal=useMemo(()=>Object.values(weekCalc).reduce((a,b)=>a+b.goal,0),[weekCalc])
  const monthActualTotal=useMemo(()=>Object.values(dailySales).reduce((a,b)=>a+b,0),[dailySales])
  const monthRate=monthGoalTotal>0?Math.round((monthActualTotal/monthGoalTotal)*100):0
  const monthRemaining=monthGoalTotal>monthActualTotal?monthGoalTotal-monthActualTotal:0
  const monthRemainDays=getMonthRemainingDays(yr,moNum,now)

  const expectedMonthSales=useMemo(()=>{
    let total=0
    for(let w=1;w<=totalWeeks;w++){
      const calc=weekCalc[w]||{goal:0,actual:0}
      if(w < currentWeek) { total+=calc.actual }
      else if(w === currentWeek) {
        const days=getWeekDays(yr,moNum,w)
        const wg=weekGoals[w]||{weekday:0,weekend:0}
        let futureGoal=0
        days.forEach(d=>{ if(d > now.getDate()) futureGoal+=isRedDay(yr,moNum,d)?wg.weekend:wg.weekday })
        total+=calc.actual+futureGoal
      } else { total+=calc.goal }
    }
    return total
  },[weekCalc,weekGoals,yr,moNum,totalWeeks,currentWeek])

  const expectedGap=monthGoalTotal-expectedMonthSales
  const expectedRate=monthGoalTotal>0?Math.round((expectedMonthSales/monthGoalTotal)*100):0

  const avgWeekday=useMemo(()=>{ const v=Object.values(weekGoals).map(w=>w.weekday).filter(v=>v>0); return v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length):0 },[weekGoals])
  const avgWeekend=useMemo(()=>{ const v=Object.values(weekGoals).map(w=>w.weekend).filter(v=>v>0); return v.length?Math.round(v.reduce((a,b)=>a+b,0)/v.length):0 },[weekGoals])

  async function saveWeek(week:number){
    if(!storeId||!canEdit) return
    setSaving(true); setSaveError(null)
    try {
      const {error}=await supabase.from('goals').upsert({
        store_id:storeId,year:yr,month:moNum,
        weekday_goal:avgWeekday,weekend_goal:avgWeekend,
        weekly_goals:weekGoals,week_reviews:weekReviews,week_issues:weekIssues,
      },{onConflict:'store_id,year,month'})
      if(error) setSaveError(`저장 실패: ${error.message}`)
      else { setSavedWeek(week); setTimeout(()=>setSavedWeek(null),2000) }
    } catch(e:any){ setSaveError(`저장 오류: ${e?.message||'알 수 없는 오류'}`) }
    finally { setSaving(false) }
  }

  function setWG(week:number,field:'weekday'|'weekend',val:number){
    setWeekGoals(p=>({...p,[week]:{...(p[week]||{weekday:0,weekend:0}),[field]:val}}))
  }
  function setWR(week:number,field:string,val:any){
    setWeekReviews(p=>({...p,[week]:{...(p[week]||{failReasons:[],comment:'',action:''}),[field]:val}}))
  }

  return(
    <div>
      {lightbox&&(
        <div onClick={()=>setLightbox(null)} style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.88)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
          <img src={lightbox} alt="확대" style={{maxWidth:'100%',maxHeight:'90vh',borderRadius:12,objectFit:'contain'}}/>
          <button onClick={()=>setLightbox(null)} style={{position:'absolute',top:16,right:16,background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',fontSize:20,width:36,height:36,borderRadius:'50%',cursor:'pointer'}}>✕</button>
        </div>
      )}

      {/* 탭 (대표만) */}
      {isOwner && (
        <div style={{ display:'flex', background:'#E8ECF0', borderRadius:12, padding:4, marginBottom:16 }}>
          {[{v:'my' as const,l:'📊 내 매장'},{v:'all' as const,l:'🏪 전 지점'}].map(t=>(
            <button key={t.v} onClick={()=>setTab(t.v)}
              style={{flex:1,padding:'9px 0',borderRadius:10,border:'none',cursor:'pointer',fontSize:13,fontWeight:tab===t.v?700:400,background:tab===t.v?'#fff':'transparent',color:tab===t.v?'#1a1a2e':'#aaa',boxShadow:tab===t.v?'0 1px 4px rgba(0,0,0,0.08)':'none'}}>
              {t.l}
            </button>
          ))}
        </div>
      )}

      {/* 전지점 탭 */}
      {tab==='all' && isOwner && storeId && <AllStoresGoalTab mainStoreId={storeId}/>}

      {/* 내 매장 탭 */}
      {tab==='my' && (
        <>
          {saveError&&(
            <div style={{marginBottom:12,padding:'12px 16px',borderRadius:12,background:'rgba(232,67,147,0.08)',border:'1px solid rgba(232,67,147,0.3)',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:'#E84393',marginBottom:2}}>⚠️ 저장 실패</div>
                <div style={{fontSize:11,color:'#E84393'}}>{saveError}</div>
              </div>
              <button onClick={()=>setSaveError(null)} style={{background:'none',border:'none',color:'#E84393',fontSize:16,cursor:'pointer',marginLeft:8}}>✕</button>
            </div>
          )}

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
                <div style={{fontSize:10,fontWeight:600,color:getRateColor(monthRate)}}>{monthRate>=100?'🎉 달성!':monthRate>=80?'🔥 거의 다 왔어요':monthRate>=60?'⚡ 분발 필요':monthRate>0?'🚨 위험':'미집계'}</div>
              </div>
            </div>
            <ProgressBar value={monthRate} color="#FF6B35" height={12}/>
            <div style={{display:'flex',justifyContent:'space-between',marginTop:10,marginBottom:12}}>
              <div><div style={{fontSize:10,color:'#aaa'}}>실제 매출</div><div style={{fontSize:16,fontWeight:800,color:'#FF6B35'}}>{fmtW(monthActualTotal)}</div></div>
              <div style={{textAlign:'right'}}><div style={{fontSize:10,color:'#aaa'}}>월 목표</div><div style={{fontSize:16,fontWeight:800,color:'#1a1a2e'}}>{monthGoalTotal>0?fmtW(monthGoalTotal):'미설정'}</div></div>
            </div>
            {monthGoalTotal>0&&(monthRemaining>0?(
              <div style={{borderRadius:12,padding:'12px 14px',marginBottom:12,background:monthRate<60?'rgba(232,67,147,0.08)':'rgba(255,107,53,0.07)',border:`1px dashed ${monthRate<60?'rgba(232,67,147,0.35)':'rgba(255,107,53,0.3)'}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                  <div>
                    <div style={{fontSize:10,color:'#888',marginBottom:4}}>🏁 월 목표 달성까지{isCurrentMonth&&monthRemainDays>0&&<span style={{color:'#bbb'}}> (남은 {monthRemainDays}일)</span>}</div>
                    <div style={{fontSize:22,fontWeight:900,color:monthRate<60?'#E84393':'#FF6B35',lineHeight:1.1}}>{fmtW(monthRemaining)}</div>
                    <div style={{fontSize:10,color:'#aaa',marginTop:3}}>더 필요해요</div>
                  </div>
                  {isCurrentMonth&&monthRemainDays>0&&(
                    <div style={{textAlign:'right',background:'#fff',borderRadius:10,padding:'8px 12px',border:'1px solid #E8ECF0',flexShrink:0}}>
                      <div style={{fontSize:9,color:'#aaa',marginBottom:2}}>하루 평균 필요</div>
                      <div style={{fontSize:16,fontWeight:800,color:monthRate<60?'#E84393':'#FF6B35'}}>{fmtW(Math.ceil(monthRemaining/monthRemainDays))}</div>
                      <div style={{fontSize:9,color:'#bbb',marginTop:1}}>/일</div>
                    </div>
                  )}
                </div>
              </div>
            ):(
              <div style={{borderRadius:12,padding:'12px 14px',marginBottom:12,background:'rgba(0,184,148,0.08)',border:'1px solid rgba(0,184,148,0.25)',textAlign:'center'}}>
                <div style={{fontSize:14,fontWeight:800,color:'#00B894'}}>🎉 이번 달 목표 달성!</div>
                <div style={{fontSize:11,color:'#00B894',marginTop:2}}>{fmtW(monthActualTotal-monthGoalTotal)} 초과 달성</div>
              </div>
            ))}
            {monthGoalTotal>0&&isCurrentMonth&&(
              <div style={{borderRadius:12,padding:'14px',background:'rgba(108,92,231,0.06)',border:'1px solid rgba(108,92,231,0.2)'}}>
                <div style={{fontSize:11,fontWeight:700,color:'#6C5CE7',marginBottom:6}}>🔮 이번 달 예상 매출</div>
                <div style={{fontSize:9,color:'#aaa',marginBottom:10}}>지난 주·이번 주 실제 + 남은 주 목표 합산</div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5}}>
                  <span style={{fontSize:11,fontWeight:700,color:expectedGap>0?'#E84393':'#00B894'}}>
                    {expectedGap>0?`목표보다 ${fmtW(expectedGap)} 부족 예상`:`목표 초과 ${fmtW(-expectedGap)} 예상 🎉`}
                  </span>
                  <span style={{fontSize:14,fontWeight:900,color:getRateColor(expectedRate)}}>{expectedRate}%</span>
                </div>
                <ProgressBar value={expectedRate} color="#6C5CE7" height={8}/>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginTop:10}}>
                  <div style={{background:'#fff',borderRadius:10,padding:'8px 10px',border:'1px solid #E8ECF0',textAlign:'center'}}>
                    <div style={{fontSize:9,color:'#aaa',marginBottom:3}}>월 목표</div>
                    <div style={{fontSize:13,fontWeight:800,color:'#1a1a2e'}}>{fmtW(monthGoalTotal)}</div>
                  </div>
                  <div style={{background:'#fff',borderRadius:10,padding:'8px 10px',border:'1px solid rgba(108,92,231,0.2)',textAlign:'center'}}>
                    <div style={{fontSize:9,color:'#6C5CE7',marginBottom:3}}>예상 달성</div>
                    <div style={{fontSize:13,fontWeight:800,color:'#6C5CE7'}}>{fmtW(expectedMonthSales)}</div>
                  </div>
                  <div style={{background:expectedGap>0?'rgba(232,67,147,0.06)':'rgba(0,184,148,0.06)',borderRadius:10,padding:'8px 10px',border:`1px solid ${expectedGap>0?'rgba(232,67,147,0.2)':'rgba(0,184,148,0.2)'}`,textAlign:'center'}}>
                    <div style={{fontSize:9,color:expectedGap>0?'#E84393':'#00B894',marginBottom:3}}>예상 간극</div>
                    <div style={{fontSize:13,fontWeight:800,color:expectedGap>0?'#E84393':'#00B894'}}>{expectedGap>0?`-${fmtW(expectedGap)}`:`+${fmtW(-expectedGap)}`}</div>
                  </div>
                </div>
                {expectedGap>0&&expectedRate<90&&(
                  <div style={{marginTop:10,padding:'8px 12px',borderRadius:8,background:'rgba(232,67,147,0.08)',border:'1px solid rgba(232,67,147,0.2)'}}>
                    <div style={{fontSize:11,color:'#E84393',fontWeight:600}}>⚠️ 지금 페이스대로면 이번 달 목표 달성이 어려워요</div>
                    <div style={{fontSize:10,color:'#aaa',marginTop:3}}>남은 주 목표를 올리거나 매출을 더 올려야 해요</div>
                  </div>
                )}
                {expectedGap<=0&&(
                  <div style={{marginTop:10,padding:'8px 12px',borderRadius:8,background:'rgba(0,184,148,0.08)',border:'1px solid rgba(0,184,148,0.2)'}}>
                    <div style={{fontSize:11,color:'#00B894',fontWeight:600}}>✅ 지금 페이스라면 이번 달 목표 달성 가능해요!</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 주차별 카드 */}
          {Array.from({length:totalWeeks},(_,i)=>i+1).map(week=>{
            const days=getWeekDays(yr,moNum,week)
            const calc=weekCalc[week]||{goal:0,actual:0,weekdays:0,redDays:0}
            const rate=calc.goal>0?Math.round((calc.actual/calc.goal)*100):0
            const weekRemaining=calc.goal>calc.actual?calc.goal-calc.actual:0
            const remainDays=getRemainingDays(yr,moNum,week,now)
            const isCurrent=yr===now.getFullYear()&&moNum===now.getMonth()+1&&days.includes(now.getDate())
            const isPast=isCurrentMonth&&week<currentWeek
            const wg=weekGoals[week]||{weekday:0,weekend:0}
            const wr=weekReviews[week]||{failReasons:[],comment:'',action:''}
            const issues=weekIssues[week]||[]
            const isExpanded=expandedWeek===week
            const isSaved=savedWeek===week

            return(
              <div key={week} style={{...bx,border:isCurrent&&rate<60&&calc.goal>0?'2px solid #E84393':isCurrent?'2px solid rgba(255,107,53,0.45)':'1px solid #E8ECF0'}}>
                <div onClick={()=>setExpandedWeek(isExpanded?null:week)} style={{cursor:'pointer'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      {isCurrent&&<span style={{fontSize:10,background:'rgba(255,107,53,0.15)',color:'#FF6B35',padding:'2px 7px',borderRadius:6,fontWeight:700}}>이번 주</span>}
                      {isPast&&<span style={{fontSize:10,background:'#F0F2F5',color:'#aaa',padding:'2px 7px',borderRadius:6,fontWeight:600}}>지난 주</span>}
                      <span style={{fontSize:14,fontWeight:700,color:'#1a1a2e'}}>{week}주차</span>
                      <span style={{fontSize:11,color:'#aaa'}}>{moNum}/{days[0]} ~ {moNum}/{days[days.length-1]}</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      {issues.length>0&&<span style={{fontSize:10,background:'rgba(232,67,147,0.1)',color:'#E84393',padding:'2px 6px',borderRadius:6,fontWeight:700}}>📌 {issues.length}건</span>}
                      {calc.goal>0&&<span style={{fontSize:14,fontWeight:800,color:getRateColor(rate)}}>{rate}%</span>}
                      <span style={{fontSize:11,color:'#ccc'}}>{isExpanded?'▲':'▼'}</span>
                    </div>
                  </div>

                  {calc.goal>0&&(
                    <div style={{background:rate>=100?'rgba(0,184,148,0.07)':rate>=80?'rgba(255,107,53,0.07)':'rgba(232,67,147,0.07)',borderRadius:10,padding:'10px 12px',marginBottom:10,border:`1px solid ${rate>=100?'rgba(0,184,148,0.2)':rate>=80?'rgba(255,107,53,0.2)':'rgba(232,67,147,0.2)'}`}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                        <span style={{fontSize:11,fontWeight:700,color:getRateColor(rate)}}>{rate>=100?'🎉 달성!':rate>=80?'🔥 거의 다 왔어요':rate>=60?'⚡ 분발 필요':'🚨 위험'}</span>
                        <span style={{fontSize:20,fontWeight:900,color:getRateColor(rate)}}>{rate}%</span>
                      </div>
                      <ProgressBar value={rate} color={getRateColor(rate)} height={10}/>
                      <div style={{display:'flex',justifyContent:'space-between',marginTop:6,marginBottom:weekRemaining>0||rate>=100?8:0}}>
                        <span style={{fontSize:11,color:'#aaa'}}>실제 {fmtW(calc.actual)}</span>
                        <span style={{fontSize:11,color:'#aaa'}}>목표 {fmtW(calc.goal)}</span>
                      </div>
                      {weekRemaining>0&&(
                        <div style={{padding:'10px 12px',borderRadius:8,background:rate<60?'rgba(232,67,147,0.08)':'rgba(255,107,53,0.06)',border:`1px dashed ${rate<60?'rgba(232,67,147,0.3)':'rgba(255,107,53,0.25)'}`}}>
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                            <div>
                              <div style={{fontSize:10,color:'#888',marginBottom:3}}>🎯 달성까지 필요{remainDays>0&&<span style={{color:'#bbb'}}> (남은 {remainDays}일)</span>}</div>
                              <div style={{fontSize:18,fontWeight:900,color:rate<60?'#E84393':'#FF6B35',lineHeight:1.1}}>{fmtW(weekRemaining)}</div>
                              <div style={{fontSize:10,color:'#aaa',marginTop:2}}>더 필요해요</div>
                            </div>
                            {remainDays>0&&(
                              <div style={{textAlign:'right',background:'#fff',borderRadius:8,padding:'7px 10px',border:'1px solid #E8ECF0',flexShrink:0}}>
                                <div style={{fontSize:9,color:'#aaa',marginBottom:2}}>하루 평균</div>
                                <div style={{fontSize:14,fontWeight:800,color:rate<60?'#E84393':'#FF6B35'}}>{fmtW(Math.ceil(weekRemaining/remainDays))}</div>
                                <div style={{fontSize:9,color:'#bbb',marginTop:1}}>/일</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {weekRemaining===0&&calc.goal>0&&(
                        <div style={{padding:'8px 10px',borderRadius:8,background:'rgba(0,184,148,0.08)',textAlign:'center'}}>
                          <span style={{fontSize:12,fontWeight:700,color:'#00B894'}}>🎉 이번 주 목표 달성!</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{display:'flex',gap:3,marginTop:4}}>
                    {days.map(d=>{
                      const dow=getDow(yr,moNum,d); const sale=dailySales[d]||0
                      const holiday=getHoliday(yr,moNum,d); const isRed=dow===0||dow===6||!!holiday
                      const dayGoal=isRed?(wg.weekend||0):(wg.weekday||0)
                      const dayRate=dayGoal>0&&sale>0?Math.round((sale/dayGoal)*100):null
                      const isToday=yr===now.getFullYear()&&moNum===now.getMonth()+1&&d===now.getDate()
                      return(
                        <div key={d} style={{flex:1,textAlign:'center',borderRadius:8,padding:'5px 2px',minHeight:64,background:sale>0?(dayRate!==null&&dayRate>=100?'rgba(0,184,148,0.1)':'rgba(255,107,53,0.07)'):'#F8F9FB',border:isToday?'2px solid #FF6B35':'1px solid #F0F0F0'}}>
                          <div style={{fontSize:9,color:isRed?'#E84393':'#bbb',fontWeight:600}}>{holiday?'🔴':DOW[dow]}</div>
                          <div style={{fontSize:11,fontWeight:isToday?800:500,color:isRed?'#E84393':'#555',marginTop:1}}>{d}</div>
                          {holiday&&<div style={{fontSize:7,color:'#E84393',marginTop:1,lineHeight:1.1}}>{holiday}</div>}
                          {sale>0&&<div style={{fontSize:8,color:'#FF6B35',fontWeight:700,marginTop:1}}>{fmtW(sale)}</div>}
                          {dayRate!==null&&<div style={{fontSize:7,color:dayRate>=100?'#00B894':'#E84393',fontWeight:700}}>{dayRate}%</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {isExpanded&&(
                  <div style={{marginTop:16,borderTop:'1px solid #F4F6F9',paddingTop:16}}>
                    {/* 지적사항 */}
                    <div style={{marginBottom:16,background:'rgba(232,67,147,0.04)',borderRadius:12,padding:14,border:'1px solid rgba(232,67,147,0.15)'}}>
                      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                        <div style={{display:'flex',alignItems:'center',gap:6}}>
                          <span style={{fontSize:12,fontWeight:700,color:'#E84393'}}>📌 주간 지적사항</span>
                          {issues.length>0&&<span style={{fontSize:10,background:'rgba(232,67,147,0.12)',color:'#E84393',padding:'2px 6px',borderRadius:10,fontWeight:700}}>{issues.length}건</span>}
                        </div>
                        {isOwner?<span style={{fontSize:9,background:'rgba(232,67,147,0.12)',color:'#E84393',padding:'2px 6px',borderRadius:4,fontWeight:600}}>대표 입력</span>
                          :<span style={{fontSize:9,background:'#F0F2F5',color:'#aaa',padding:'2px 6px',borderRadius:4}}>열람만 가능</span>}
                      </div>
                      {issues.length===0&&<div style={{textAlign:'center',padding:'14px 0',fontSize:12,color:'#ccc'}}>{isOwner?'아래에서 지적사항을 추가하세요':'등록된 지적사항 없음'}</div>}
                      {issues.map((issue,idx)=>{
                        const imgSrc=getIssueImage(issue)
                        return(
                          <div key={issue.id} style={{marginBottom:8}}>
                            {editingIssue?.week===week&&editingIssue?.id===issue.id?(
                              <div style={{background:'#fff',borderRadius:10,padding:12,border:'1px solid rgba(232,67,147,0.3)'}}>
                                <div style={{fontSize:10,color:'#E84393',fontWeight:600,marginBottom:8}}>✏️ {idx+1}번 수정 중</div>
                                <input value={editText} onChange={e=>setEditText(e.target.value)} placeholder="지적사항 내용..." style={{...singleInp,marginBottom:8}} autoFocus/>
                                {editPreview?(
                                  <div style={{position:'relative',marginBottom:8}}>
                                    <img src={editPreview} alt="미리보기" style={{width:'100%',maxHeight:160,objectFit:'cover',borderRadius:8,border:'1px solid #E8ECF0'}}/>
                                    <button onClick={()=>{setEditBase64('');setEditPreview('')}} style={{position:'absolute',top:4,right:4,background:'rgba(0,0,0,0.55)',border:'none',borderRadius:'50%',width:24,height:24,color:'#fff',fontSize:13,cursor:'pointer'}}>✕</button>
                                  </div>
                                ):(
                                  <label style={{display:'flex',alignItems:'center',gap:6,padding:'8px 10px',borderRadius:8,border:'1px dashed rgba(232,67,147,0.3)',cursor:'pointer',marginBottom:8,background:'rgba(232,67,147,0.03)'}}>
                                    <span style={{fontSize:13}}>📷</span>
                                    <span style={{fontSize:11,color:'#E84393'}}>{converting?'변환 중...':'사진 변경'}</span>
                                    <input type="file" accept="image/*" style={{display:'none'}} disabled={converting} onChange={e=>{ const f=e.target.files?.[0]; if(f) handleEditImage(f) }}/>
                                  </label>
                                )}
                                <div style={{display:'flex',gap:6}}>
                                  <button onClick={()=>saveEdit(week)} style={{flex:1,padding:'8px 0',borderRadius:8,border:'none',background:'#E84393',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>✓ 저장</button>
                                  <button onClick={()=>{setEditingIssue(null);setEditText('');setEditBase64('');setEditPreview('')}} style={{flex:1,padding:'8px 0',borderRadius:8,border:'1px solid #E0E4E8',background:'#fff',color:'#888',fontSize:12,cursor:'pointer'}}>취소</button>
                                </div>
                              </div>
                            ):(
                              <div style={{background:'#fff',borderRadius:10,padding:'10px 12px',border:'1px solid rgba(232,67,147,0.15)'}}>
                                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:imgSrc?8:0}}>
                                  <span style={{fontSize:11,color:'#E84393',fontWeight:700,flexShrink:0}}>#{idx+1}</span>
                                  <span style={{fontSize:12,color:'#1a1a2e',flex:1}}>{issue.text}</span>
                                  {isOwner&&(
                                    <div style={{display:'flex',gap:4,flexShrink:0}}>
                                      <button onClick={e=>{e.stopPropagation();startEdit(week,issue)}} style={{padding:'3px 8px',borderRadius:6,border:'1px solid #E0E4E8',background:'#F8F9FB',color:'#555',fontSize:11,cursor:'pointer'}}>수정</button>
                                      <button onClick={e=>{e.stopPropagation();if(confirm('삭제할까요?'))deleteIssue(week,issue.id)}} style={{padding:'3px 8px',borderRadius:6,border:'1px solid rgba(232,67,147,0.2)',background:'rgba(232,67,147,0.06)',color:'#E84393',fontSize:11,cursor:'pointer'}}>삭제</button>
                                    </div>
                                  )}
                                </div>
                                {imgSrc&&<img src={imgSrc} alt="지적사항 사진" onClick={()=>setLightbox(imgSrc)} style={{width:'100%',maxHeight:200,objectFit:'cover',borderRadius:8,border:'1px solid #E8ECF0',cursor:'pointer',display:'block'}}/>}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {isOwner&&(
                        <div style={{marginTop:10,background:'#fff',borderRadius:10,padding:12,border:'1px dashed rgba(232,67,147,0.25)'}}>
                          <div style={{fontSize:10,color:'#E84393',fontWeight:600,marginBottom:8}}>+ 새 지적사항</div>
                          <input value={newText[week]||''} onChange={e=>setNewText(p=>({...p,[week]:e.target.value}))}
                            placeholder="지적사항 내용 입력..." style={{...singleInp,marginBottom:8}}
                            onKeyDown={e=>{ if(e.key==='Enter') addIssue(week) }}/>
                          {newPreview[week]?(
                            <div style={{position:'relative',marginBottom:8}}>
                              <img src={newPreview[week]} alt="미리보기" style={{width:'100%',maxHeight:140,objectFit:'cover',borderRadius:8,border:'1px solid #E8ECF0'}}/>
                              <button onClick={()=>{setNewBase64(p=>({...p,[week]:''}));setNewPreview(p=>({...p,[week]:''}))}} style={{position:'absolute',top:4,right:4,background:'rgba(0,0,0,0.55)',border:'none',borderRadius:'50%',width:24,height:24,color:'#fff',fontSize:13,cursor:'pointer'}}>✕</button>
                            </div>
                          ):(
                            <label style={{display:'flex',alignItems:'center',gap:6,padding:'8px 10px',borderRadius:8,border:'1px dashed #E0E4E8',cursor:'pointer',marginBottom:8,background:'#F8F9FB'}}>
                              <span style={{fontSize:13}}>📷</span>
                              <span style={{fontSize:11,color:'#888'}}>{converting?'변환 중...':'사진 첨부 (선택)'}</span>
                              <input type="file" accept="image/*" style={{display:'none'}} disabled={converting} onChange={e=>{ const f=e.target.files?.[0]; if(f) handleNewImage(week,f) }}/>
                            </label>
                          )}
                          <button onClick={()=>addIssue(week)} disabled={!(newText[week]||'').trim()||converting}
                            style={{width:'100%',padding:'9px 0',borderRadius:8,border:'none',background:!(newText[week]||'').trim()||converting?'#ddd':'#E84393',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                            {converting?'사진 처리 중...':'+ 지적사항 추가'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 목표 설정 */}
                    <div style={{fontSize:12,fontWeight:700,color:'#555',marginBottom:10}}>🎯 목표 설정</div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                      <div style={{background:'#FFF5F0',borderRadius:12,padding:12,border:'1px solid rgba(255,107,53,0.2)'}}>
                        <div style={{fontSize:10,color:'#FF6B35',fontWeight:700,marginBottom:6}}>📅 평일 목표 <span style={{color:'#aaa',fontWeight:400}}>({calc.weekdays}일)</span></div>
                        {canEdit?<input value={toComma(wg.weekday)} onChange={e=>setWG(week,'weekday',fromComma(e.target.value))} placeholder="0" style={{...inp,background:'#fff',fontSize:13}}/>
                          :<div style={{fontSize:15,fontWeight:800,color:'#FF6B35'}}>{wg.weekday>0?fmtW(wg.weekday):'미설정'}</div>}
                        {wg.weekday>0&&<div style={{fontSize:9,color:'#FF6B35',textAlign:'right',marginTop:3}}>합계 {fmtW(wg.weekday*calc.weekdays)}</div>}
                      </div>
                      <div style={{background:'#FFF0F0',borderRadius:12,padding:12,border:'1px solid rgba(232,67,147,0.2)'}}>
                        <div style={{fontSize:10,color:'#E84393',fontWeight:700,marginBottom:6}}>🔴 주말/공휴일 <span style={{color:'#aaa',fontWeight:400}}>({calc.redDays}일)</span></div>
                        {canEdit?<input value={toComma(wg.weekend)} onChange={e=>setWG(week,'weekend',fromComma(e.target.value))} placeholder="0" style={{...inp,background:'#fff',fontSize:13}}/>
                          :<div style={{fontSize:15,fontWeight:800,color:'#E84393'}}>{wg.weekend>0?fmtW(wg.weekend):'미설정'}</div>}
                        {wg.weekend>0&&<div style={{fontSize:9,color:'#E84393',textAlign:'right',marginTop:3}}>합계 {fmtW(wg.weekend*calc.redDays)}</div>}
                      </div>
                    </div>
                    {calc.goal>0&&(
                      <div style={{background:'rgba(255,107,53,0.06)',borderRadius:10,padding:'8px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                        <span style={{fontSize:12,color:'#888'}}>이번 주 목표 합계</span>
                        <span style={{fontSize:15,fontWeight:800,color:'#FF6B35'}}>{fmtW(calc.goal)}</span>
                      </div>
                    )}

                    <div style={{fontSize:12,fontWeight:700,color:'#555',marginBottom:10}}>📝 주간 리뷰</div>
                    {calc.goal>0&&calc.actual<calc.goal&&(
                      <div style={{marginBottom:12}}>
                        <div style={{fontSize:11,color:'#E84393',fontWeight:600,marginBottom:8}}>미달성 원인 체크</div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                          {FAIL_CHECKS.map(fc=>(
                            <label key={fc} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 10px',borderRadius:8,background:wr.failReasons?.includes(fc)?'rgba(232,67,147,0.08)':'#F8F9FB',border:`1px solid ${wr.failReasons?.includes(fc)?'rgba(232,67,147,0.25)':'#E8ECF0'}`,cursor:canEdit?'pointer':'default'}}>
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
                        style={{width:'100%',marginTop:12,padding:'11px 0',borderRadius:10,border:'none',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',background:isSaved?'#00B894':saving?'#ddd':'linear-gradient(135deg,#FF6B35,#E84393)'}}>
                        {isSaved?'✓ 저장완료!':saving?'저장 중...':'💾 저장'}
                      </button>
                    )}
                    {!canEdit&&<div style={{marginTop:10,textAlign:'center',fontSize:11,color:'#ccc'}}>목표 설정은 대표/관리자만 가능합니다</div>}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}