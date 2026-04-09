'use client'
import { useEffect, useState, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import YearMonthPicker from '@/components/YearMonthPicker'

const bx = { background:'#fff', borderRadius:16, border:'1px solid #E8ECF0', padding:16, marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width:'100%', padding:'8px 10px', borderRadius:8, background:'#F8F9FB', border:'1px solid #E0E4E8', color:'#1a1a2e', fontSize:13, outline:'none', boxSizing:'border-box' as const }
const lbl = { fontSize:11, color:'#888', marginBottom:4, display:'block' as const }

function numFmt(n: number) { return n.toLocaleString() }
function pct(v: number, total: number) { if (!total) return 0; return Math.round((v/total)*1000)/10 }

// 기본 결제방법 / 단위
const DEFAULT_PAYMENT_METHODS = ['카드','계좌이체','현금','어음','기타']
const DEFAULT_UNITS = ['ea','box','kg','g','L','개','병','팩','봉']

const PAYMENT_COLORS: Record<string,string> = { '카드':'#6C5CE7','현금':'#00B894','계좌이체':'#2DC6D6','어음':'#FF6B35','기타':'#aaa' }
const ICONS = ['📋','🌐','🛒','🥩','🐟','🍺','🥤','📦','👤','⚡','💳','🧾','💰','🏠','🚗','📱','🔧','✂️','🎯','💬']

const DEFAULT_SHEETS = [
  { name:'인터넷발주', icon:'🌐', sheet_type:'expense', sort_order:1 },
  { name:'마트발주',   icon:'🛒', sheet_type:'expense', sort_order:2 },
  { name:'육류',       icon:'🥩', sheet_type:'expense', sort_order:3 },
  { name:'수산물',     icon:'🐟', sheet_type:'expense', sort_order:4 },
  { name:'주류',       icon:'🍺', sheet_type:'expense', sort_order:5 },
  { name:'음료',       icon:'🥤', sheet_type:'expense', sort_order:6 },
  { name:'기타재료',   icon:'📦', sheet_type:'expense', sort_order:7 },
  { name:'인건비',     icon:'👤', sheet_type:'expense', sort_order:8 },
  { name:'공과금',     icon:'⚡', sheet_type:'expense', sort_order:9 },
  { name:'기타관리비', icon:'📋', sheet_type:'expense', sort_order:10 },
  { name:'수수료',     icon:'💳', sheet_type:'expense', sort_order:11 },
  { name:'세금',       icon:'🧾', sheet_type:'expense', sort_order:12 },
]

// ── 엑셀 (시트별) ─────────────────────────────────────────
async function exportSheetExcel(sheet: any, entries: any[], linkedOrders: any[], year: number, month: number) {
  try {
    const ExcelJS = (await import('exceljs')).default
    const pad = (n:number)=>String(n).padStart(2,'0')
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(`${sheet.name}_${year}년${pad(month)}월`)
    ws.addRow(['구분','날짜','품목명','금액','결제방법','수량','단가','단위','배송비','입금일','세금계산서','세금계산서날짜','메모','구매처'])
    ws.getRow(1).eachCell(cell=>{ cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1A1A2E'}}; cell.font={bold:true,color:{argb:'FFFFFFFF'}} })
    entries.forEach(e=>ws.addRow(['직접입력',e.entry_date,e.item_name||'',e.amount||0,e.payment_method||'',e.quantity||'',e.unit_price||'','',0,e.deposit_date||'',e.has_tax_invoice?'O':'',e.tax_invoice_date||'',e.memo||'','']))
    linkedOrders.forEach(o=>{ const d=new Date(o.confirmed_at||o.ordered_at); ws.addRow(['발주연동',`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,o.item_name||'',o.settlement_amount||0,o.payment_method||'',o.quantity||'',o.settlement_unit_price||'',o.price_unit||'',o.delivery_fee||0,'','','',o.memo||'',o.supplier_name||'']) })
    ws.getColumn(4).numFmt='#,##0'; ws.columns.forEach(col=>{col.width=14})
    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
    const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${sheet.icon}${sheet.name}_${year}년${pad(month)}월.xlsx`; a.click(); URL.revokeObjectURL(url)
  } catch(e:any) { alert('엑셀 오류: '+(e?.message||'')) }
}

// ── 전체 엑셀 ────────────────────────────────────────────
async function exportAllExcel(storeId:string, year:number, month:number, sheets:any[], settings:any) {
  try {
    const supabase = createSupabaseBrowserClient()
    const ExcelJS = (await import('exceljs')).default
    const pad=(n:number)=>String(n).padStart(2,'0')
    const wb = new ExcelJS.Workbook()
    const from=`${year}-${pad(month)}-01`; const to=`${year}-${pad(month)}-${pad(new Date(year,month,0).getDate())}`
    const wsSummary = wb.addWorksheet('📊 수익분석 요약')
    wsSummary.addRow([`${year}년 ${month}월 결산 요약`]); wsSummary.getRow(1).font={bold:true,size:14}; wsSummary.addRow([])
    const { data: cls } = await supabase.from('closings').select('id').eq('store_id',storeId).gte('closing_date',from).lte('closing_date',to)
    let salesByPlatform: Record<string,number>={}
    if (cls?.length) { const { data: sv } = await supabase.from('closing_sales').select('platform,amount').in('closing_id',cls.map((c:any)=>c.id)); ;(sv||[]).forEach((s:any)=>{ salesByPlatform[s.platform]=(salesByPlatform[s.platform]||0)+s.amount }) }
    const totalSales=Object.values(salesByPlatform).reduce((s,v)=>s+v,0)
    const { data: entries } = await supabase.from('settlement_entries').select('sheet_id,amount').eq('store_id',storeId).eq('year',year).eq('month',month)
    const { data: linked } = await supabase.from('orders').select('settlement_sheet_id,settlement_amount').eq('store_id',storeId).eq('settlement_year',year).eq('settlement_month',month).not('settlement_sheet_id','is',null)
    const entrySums: Record<string,number>={}
    ;(entries||[]).forEach((e:any)=>{ entrySums[e.sheet_id]=(entrySums[e.sheet_id]||0)+e.amount })
    ;(linked||[]).forEach((o:any)=>{ if(o.settlement_sheet_id&&o.settlement_amount) entrySums[o.settlement_sheet_id]=(entrySums[o.settlement_sheet_id]||0)+o.settlement_amount })
    const cardRate=settings?.card_fee_rate??1.1
    const DELIVERY=['배달의민족','배민','쿠팡이츠','쿠팡','요기요']
    const pos=Object.entries(salesByPlatform).filter(([k])=>!DELIVERY.includes(k)).reduce((s,[,v])=>s+v,0)
    const cardFeeAuto=Math.round(pos*(cardRate/100))
    const expenseSheets=sheets.filter(s=>s.sheet_type==='expense'&&s.is_active)
    const totalExpense=expenseSheets.reduce((s,sh)=>s+(entrySums[sh.id]||0),0)+cardFeeAuto
    const netProfit=totalSales-totalExpense
    const profitRate=totalSales>0?Math.round((netProfit/totalSales)*1000)/10:0
    wsSummary.addRow(['항목','금액(원)','비고']); wsSummary.getRow(3).eachCell(cell=>{ cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF2C3E50'}}; cell.font={bold:true,color:{argb:'FFFFFFFF'}} })
    wsSummary.addRow(['▶ 총 매출',totalSales,''])
    Object.entries(salesByPlatform).forEach(([p,a])=>wsSummary.addRow([`   └ ${p}`,a,'']))
    wsSummary.addRow([]); wsSummary.addRow(['▶ 총 지출',totalExpense,'']); wsSummary.addRow([`   └ 💳 카드수수료 (${cardRate}% 자동)`,cardFeeAuto,'자동계산'])
    expenseSheets.forEach(sh=>{ const amt=(entrySums[sh.id]||0); wsSummary.addRow([`   └ ${sh.icon} ${sh.name}`,amt,amt===0?'미입력':'']) })
    wsSummary.addRow([])
    const netRow=wsSummary.addRow(['▶ 순수익',netProfit,`수익률 ${profitRate}%`]); netRow.font={bold:true,size:13,color:{argb:netProfit>=0?'FF00B894':'FFE84393'}}
    wsSummary.getColumn(1).width=32; wsSummary.getColumn(2).numFmt='#,##0'; wsSummary.getColumn(2).width=18; wsSummary.getColumn(3).width=16
    for (const sheet of expenseSheets) {
      const { data: se } = await supabase.from('settlement_entries').select('*').eq('sheet_id',sheet.id).eq('year',year).eq('month',month).order('entry_date')
      const { data: so } = await supabase.from('orders').select('*').eq('settlement_sheet_id',sheet.id).eq('settlement_year',year).eq('settlement_month',month).order('confirmed_at')
      const ws=wb.addWorksheet(`${sheet.icon}${sheet.name}`)
      ws.addRow(['구분','날짜','품목명','금액','결제방법','수량','단가','단위','배송비','세금계산서','메모','구매처'])
      ws.getRow(1).eachCell(cell=>{ cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1A1A2E'}}; cell.font={bold:true,color:{argb:'FFFFFFFF'}} })
      ;(se||[]).forEach((e:any)=>ws.addRow(['직접입력',e.entry_date,e.item_name||'',e.amount||0,e.payment_method||'',e.quantity||'',e.unit_price||'','','',e.has_tax_invoice?'O':'',e.memo||'','']))
      ;(so||[]).forEach((o:any)=>{ const d=new Date(o.confirmed_at||o.ordered_at); ws.addRow(['발주연동',`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,o.item_name||'',o.settlement_amount||0,o.payment_method||'',o.quantity||'',o.settlement_unit_price||'',o.price_unit||'',o.delivery_fee||0,'',o.memo||'',o.supplier_name||'']) })
      ws.addRow([])
      const total=(se||[]).reduce((s:number,e:any)=>s+(e.amount||0),0)+(so||[]).reduce((s:number,o:any)=>s+(o.settlement_amount||0),0)
      const tRow=ws.addRow(['합계','','',total]); tRow.font={bold:true}
      ws.getColumn(4).numFmt='#,##0'; ws.columns.forEach(col=>{col.width=14})
    }
    const wsSales=wb.addWorksheet('💰 매출'); wsSales.addRow(['날짜','플랫폼','금액'])
    wsSales.getRow(1).eachCell(cell=>{ cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF00B894'}}; cell.font={bold:true,color:{argb:'FFFFFFFF'}} })
    if (cls?.length) {
      const { data: cd } = await supabase.from('closings').select('id,closing_date').eq('store_id',storeId).gte('closing_date',from).lte('closing_date',to).order('closing_date')
      const { data: sv } = await supabase.from('closing_sales').select('*').in('closing_id',(cd||[]).map((c:any)=>c.id))
      ;(cd||[]).forEach((cl:any)=>{ const ps=(sv||[]).filter((s:any)=>s.closing_id===cl.id&&s.amount>0); ps.forEach((p:any)=>wsSales.addRow([cl.closing_date,p.platform,p.amount])) })
    }
    wsSales.getColumn(3).numFmt='#,##0'; wsSales.columns.forEach(col=>{col.width=16})
    const buf=await wb.xlsx.writeBuffer()
    const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`결산_전체_${year}년${pad(month)}월.xlsx`; a.click(); URL.revokeObjectURL(url)
  } catch(e:any) { alert('엑셀 오류: '+(e?.message||'')) }
}

// ── 발주 연동 항목 수정 모달 ✅ (모든 시트에서 사용) ──────
function OrderEditModal({ order, onSave, onClose }: {
  order: any; onSave: ()=>void; onClose: ()=>void
}) {
  const supabase = createSupabaseBrowserClient()
  const [amount, setAmount] = useState<number|''>(order.settlement_amount||'')
  const [unitPrice, setUnitPrice] = useState<number|''>(order.settlement_unit_price||'')
  const [priceUnit, setPriceUnit] = useState(order.price_unit||'ea')
  const [deliveryFee, setDeliveryFee] = useState<number|''>(order.delivery_fee||'')
  const [hasDelivery, setHasDelivery] = useState(!!(order.delivery_fee && order.delivery_fee>0))
  const [paymentMethod, setPaymentMethod] = useState(order.payment_method||'카드')
  const [taxInv, setTaxInv] = useState(order.has_tax_invoice||false)
  const [taxInvDate, setTaxInvDate] = useState(order.tax_invoice_date||'')
  const [memo, setMemo] = useState(order.memo||'')
  const [saving, setSaving] = useState(false)

  // 커스텀 결제방법/단위 관리
  const [payMethods, setPayMethods] = useState<string[]>(DEFAULT_PAYMENT_METHODS)
  const [units, setUnits] = useState<string[]>(DEFAULT_UNITS)
  const [newPayMethod, setNewPayMethod] = useState('')
  const [newUnit, setNewUnit] = useState('')

  function addPayMethod() {
    const v=newPayMethod.trim(); if(!v||payMethods.includes(v)) return
    setPayMethods(p=>[...p,v]); setNewPayMethod('')
  }
  function removePayMethod(m:string) { if(DEFAULT_PAYMENT_METHODS.includes(m)) return; setPayMethods(p=>p.filter(x=>x!==m)); if(paymentMethod===m) setPaymentMethod('카드') }
  function addUnit() {
    const v=newUnit.trim(); if(!v||units.includes(v)) return
    setUnits(p=>[...p,v]); setNewUnit('')
  }
  function removeUnit(u:string) { if(DEFAULT_UNITS.slice(0,4).includes(u)) return; setUnits(p=>p.filter(x=>x!==u)); if(priceUnit===u) setPriceUnit('ea') }

  async function handleSave() {
    if (!amount) { alert('금액을 입력해주세요'); return }
    setSaving(true)
    await supabase.from('orders').update({
      settlement_amount: Number(amount),
      settlement_unit_price: unitPrice?Number(unitPrice):null,
      price_unit: priceUnit||null,
      delivery_fee: hasDelivery&&deliveryFee?Number(deliveryFee):null,
      payment_method: paymentMethod||null,
      has_tax_invoice: taxInv,
      tax_invoice_date: taxInv&&taxInvDate?taxInvDate:null,
      memo: memo.trim()||null,
    }).eq('id', order.id)
    setSaving(false); onSave(); onClose()
  }

  const d = new Date(order.confirmed_at||order.ordered_at)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:400, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:520, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'92vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>📦 발주 수정</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>

        {/* 발주 기본 정보 */}
        <div style={{ padding:'10px 14px', background:'rgba(0,184,148,0.06)', borderRadius:10, border:'1px solid rgba(0,184,148,0.2)', marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#1a1a2e', marginBottom:4 }}>{order.item_name}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
            <span style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:'#F4F6F9', color:'#666' }}>📅 {d.getMonth()+1}월 {d.getDate()}일 주문확인</span>
            <span style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:'#F4F6F9', color:'#666' }}>📦 {order.quantity}{order.unit}</span>
            {order.supplier_name&&<span style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:'rgba(0,184,148,0.08)', color:'#00B894' }}>🏪 {order.supplier_name}</span>}
          </div>
        </div>

        {/* 금액 */}
        <div style={{ marginBottom:12 }}>
          <span style={lbl}>결제 금액 *</span>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <input type="number" value={amount} onChange={e=>setAmount(e.target.value===''?'':Number(e.target.value))} placeholder="0" style={inp} />
            <span style={{ fontSize:11, color:'#aaa', flexShrink:0 }}>원</span>
          </div>
          {Number(amount)>0&&<div style={{ fontSize:11, color:'#FF6B35', marginTop:3, fontWeight:600 }}>{numFmt(Number(amount))}원</div>}
        </div>

        {/* 단가 + 단위 */}
        <div style={{ marginBottom:12 }}>
          <span style={lbl}>단가 (선택, 통계용)</span>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:6, marginBottom:6 }}>
            <input type="number" value={unitPrice} onChange={e=>setUnitPrice(e.target.value===''?'':Number(e.target.value))} placeholder="개당 가격" style={inp} />
            <select value={priceUnit} onChange={e=>setPriceUnit(e.target.value)} style={{ ...inp, width:'auto', minWidth:70 }}>
              {units.map(u=><option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          {/* 단위 커스텀 추가/삭제 */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:4 }}>
            {units.map(u=>(
              <span key={u} style={{ display:'flex', alignItems:'center', gap:2, padding:'2px 8px', borderRadius:20, background: priceUnit===u?'rgba(108,92,231,0.15)':'#F4F6F9', border:`1px solid ${priceUnit===u?'rgba(108,92,231,0.3)':'#E8ECF0'}`, fontSize:11, color: priceUnit===u?'#6C5CE7':'#888' }}>
                <button onClick={()=>setPriceUnit(u)} style={{ background:'none', border:'none', cursor:'pointer', color:'inherit', fontSize:11, padding:0 }}>{u}</button>
                {!DEFAULT_UNITS.slice(0,4).includes(u)&&<button onClick={()=>removeUnit(u)} style={{ background:'none', border:'none', cursor:'pointer', color:'#E84393', fontSize:10, padding:0, marginLeft:2 }}>✕</button>}
              </span>
            ))}
          </div>
          <div style={{ display:'flex', gap:4 }}>
            <input value={newUnit} onChange={e=>setNewUnit(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addUnit()} placeholder="단위 추가 (예: 묶음)" style={{ ...inp, flex:1, fontSize:12, padding:'5px 8px' }} />
            <button onClick={addUnit} style={{ padding:'5px 12px', borderRadius:8, background:'rgba(108,92,231,0.1)', border:'1px solid rgba(108,92,231,0.2)', color:'#6C5CE7', fontSize:12, cursor:'pointer', flexShrink:0 }}>+ 추가</button>
          </div>
        </div>

        {/* 배송비 ✅ */}
        <div style={{ marginBottom:12 }}>
          <span style={lbl}>배송비</span>
          <div style={{ display:'flex', gap:6, marginBottom: hasDelivery?8:0 }}>
            <button onClick={()=>setHasDelivery(false)} style={{ flex:1, padding:'9px 0', borderRadius:8, border:!hasDelivery?'2px solid #6C5CE7':'1px solid #E8ECF0', background:!hasDelivery?'rgba(108,92,231,0.1)':'#F8F9FB', color:!hasDelivery?'#6C5CE7':'#888', fontSize:13, fontWeight:!hasDelivery?700:400, cursor:'pointer' }}>없음</button>
            <button onClick={()=>setHasDelivery(true)} style={{ flex:1, padding:'9px 0', borderRadius:8, border:hasDelivery?'2px solid #FF6B35':'1px solid #E8ECF0', background:hasDelivery?'rgba(255,107,53,0.1)':'#F8F9FB', color:hasDelivery?'#FF6B35':'#888', fontSize:13, fontWeight:hasDelivery?700:400, cursor:'pointer' }}>있음</button>
          </div>
          {hasDelivery&&(
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <input type="number" value={deliveryFee} onChange={e=>setDeliveryFee(e.target.value===''?'':Number(e.target.value))} placeholder="배송비 금액" style={inp} />
              <span style={{ fontSize:11, color:'#aaa', flexShrink:0 }}>원</span>
            </div>
          )}
        </div>

        {/* 결제방법 ✅ */}
        <div style={{ marginBottom:12 }}>
          <span style={lbl}>결제방법</span>
          <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:6 }}>
            {payMethods.map(m=>(
              <div key={m} style={{ display:'flex', alignItems:'center', gap:2 }}>
                <button onClick={()=>setPaymentMethod(m)}
                  style={{ padding:'6px 12px', borderRadius:8, border:paymentMethod===m?`2px solid ${PAYMENT_COLORS[m]||'#6C5CE7'}`:'1px solid #E8ECF0', background:paymentMethod===m?`${PAYMENT_COLORS[m]||'#6C5CE7'}18`:'#F8F9FB', color:paymentMethod===m?PAYMENT_COLORS[m]||'#6C5CE7':'#888', fontSize:12, fontWeight:paymentMethod===m?700:400, cursor:'pointer' }}>
                  {m}
                </button>
                {!DEFAULT_PAYMENT_METHODS.includes(m)&&<button onClick={()=>removePayMethod(m)} style={{ background:'none', border:'none', cursor:'pointer', color:'#E84393', fontSize:11, padding:'0 2px' }}>✕</button>}
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:4 }}>
            <input value={newPayMethod} onChange={e=>setNewPayMethod(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addPayMethod()} placeholder="결제방법 추가 (예: 법인카드)" style={{ ...inp, flex:1, fontSize:12, padding:'5px 8px' }} />
            <button onClick={addPayMethod} style={{ padding:'5px 12px', borderRadius:8, background:'rgba(108,92,231,0.1)', border:'1px solid rgba(108,92,231,0.2)', color:'#6C5CE7', fontSize:12, cursor:'pointer', flexShrink:0 }}>+ 추가</button>
          </div>
        </div>

        {/* 세금계산서 */}
        <div style={{ marginBottom:12 }}>
          <span style={lbl}>세금계산서</span>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={()=>setTaxInv((v:boolean)=>!v)} style={{ flex:1, padding:'9px 0', borderRadius:8, border:taxInv?'2px solid #00B894':'1px solid #E8ECF0', background:taxInv?'rgba(0,184,148,0.1)':'#F8F9FB', color:taxInv?'#00B894':'#aaa', fontSize:13, fontWeight:taxInv?700:400, cursor:'pointer' }}>
              {taxInv?'✅ 발행됨':'⬜ 미발행'}
            </button>
            {taxInv&&<input type="date" value={taxInvDate} onChange={e=>setTaxInvDate(e.target.value)} style={{ ...inp, flex:1 }} placeholder="발행일" />}
          </div>
        </div>

        {/* 메모 */}
        <div style={{ marginBottom:16 }}>
          <span style={lbl}>메모</span>
          <input value={memo} onChange={e=>setMemo(e.target.value)} placeholder="메모" style={inp} />
        </div>

        <button onClick={handleSave} disabled={saving||!amount}
          style={{ width:'100%', padding:'13px 0', borderRadius:12, background:amount?'linear-gradient(135deg,#FF6B35,#E84393)':'#E8ECF0', border:'none', color:amount?'#fff':'#aaa', fontSize:14, fontWeight:700, cursor:amount?'pointer':'default' }}>
          {saving?'저장 중...':'수정 저장'}
        </button>
      </div>
    </div>
  )
}

// ── 📦 미분류 탭 ─────────────────────────────────────────
function UnclassifiedView({ storeId, year, month, sheets, onRefresh }: {
  storeId:string; year:number; month:number; sheets:any[]; onRefresh:()=>void
}) {
  const supabase = createSupabaseBrowserClient()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [amounts, setAmounts] = useState<Record<string,number|''>>({})
  const [unitPrices, setUnitPrices] = useState<Record<string,number|''>>({})
  const [priceUnits, setPriceUnits] = useState<Record<string,string>>({})
  const [deliveryFees, setDeliveryFees] = useState<Record<string,number|''>>({})
  const [hasDelivery, setHasDelivery] = useState<Record<string,boolean>>({})
  const [payMethods, setPayMethods] = useState<Record<string,string>>({})
  const [sheetIds, setSheetIds] = useState<Record<string,string>>({})
  const [saving, setSaving] = useState<Record<string,boolean>>({})

  // 전역 결제방법/단위 (미분류 탭 전체에서 공유)
  const [globalPayMethods, setGlobalPayMethods] = useState<string[]>(DEFAULT_PAYMENT_METHODS)
  const [globalUnits, setGlobalUnits] = useState<string[]>(DEFAULT_UNITS)
  const [newPayMethod, setNewPayMethod] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [showPayMethodMgr, setShowPayMethodMgr] = useState(false)
  const [showUnitMgr, setShowUnitMgr] = useState(false)

  const expenseSheets = sheets.filter(s=>s.sheet_type==='expense'&&s.is_active)

  useEffect(()=>{ loadOrders() },[storeId,year,month])

  async function loadOrders() {
    setLoading(true)
    const pad=(n:number)=>String(n).padStart(2,'0')
    const from=`${year}-${pad(month)}-01`
    const to=`${year}-${pad(month)}-${pad(new Date(year,month,0).getDate())}T23:59:59`
    const { data } = await supabase.from('orders').select('*').eq('store_id',storeId).is('settlement_sheet_id',null).not('confirmed_at','is',null).gte('confirmed_at',from).lte('confirmed_at',to).order('confirmed_at',{ascending:false})
    setOrders(data||[])
    // 기존값 세팅
    const initPriceUnits: Record<string,string> = {}
    const initPayMethods: Record<string,string> = {}
    ;(data||[]).forEach((o:any) => {
      if (o.price_unit) initPriceUnits[o.id] = o.price_unit
      if (o.payment_method) initPayMethods[o.id] = o.payment_method
    })
    setPriceUnits(initPriceUnits)
    setPayMethods(initPayMethods)
    setLoading(false)
  }

  function addGlobalPayMethod() {
    const v=newPayMethod.trim(); if(!v||globalPayMethods.includes(v)) return
    setGlobalPayMethods(p=>[...p,v]); setNewPayMethod('')
  }
  function removeGlobalPayMethod(m:string) {
    if(DEFAULT_PAYMENT_METHODS.includes(m)) return
    setGlobalPayMethods(p=>p.filter(x=>x!==m))
    setPayMethods(prev=>{ const n={...prev}; Object.keys(n).forEach(k=>{ if(n[k]===m) delete n[k] }); return n })
  }
  function addGlobalUnit() {
    const v=newUnit.trim(); if(!v||globalUnits.includes(v)) return
    setGlobalUnits(p=>[...p,v]); setNewUnit('')
  }
  function removeGlobalUnit(u:string) {
    if(DEFAULT_UNITS.slice(0,4).includes(u)) return
    setGlobalUnits(p=>p.filter(x=>x!==u))
    setPriceUnits(prev=>{ const n={...prev}; Object.keys(n).forEach(k=>{ if(n[k]===u) n[k]='ea' }); return n })
  }

  async function classifyOrder(orderId: string) {
    const sheetId=sheetIds[orderId]; const amount=amounts[orderId]
    if (!sheetId) { alert('분류할 시트를 선택해주세요'); return }
    if (!amount) { alert('금액을 입력해주세요'); return }
    setSaving(p=>({...p,[orderId]:true}))
    await supabase.from('orders').update({
      settlement_sheet_id: sheetId,
      settlement_amount: Number(amount),
      settlement_unit_price: unitPrices[orderId]?Number(unitPrices[orderId]):null,
      price_unit: priceUnits[orderId]||null,
      delivery_fee: hasDelivery[orderId]&&deliveryFees[orderId]?Number(deliveryFees[orderId]):null,
      payment_method: payMethods[orderId]||null,
      settlement_classified_at: new Date().toISOString(),
      settlement_year: year, settlement_month: month,
    }).eq('id',orderId)
    setSaving(p=>({...p,[orderId]:false}))
    setOrders(prev=>prev.filter(o=>o.id!==orderId))
    onRefresh()
  }

  async function classifyAll() {
    const ready=orders.filter(o=>sheetIds[o.id]&&amounts[o.id])
    if (ready.length===0) { alert('시트와 금액을 입력한 항목이 없어요'); return }
    if (!confirm(`${ready.length}건을 한번에 분류할까요?`)) return
    await Promise.all(ready.map(o=>supabase.from('orders').update({
      settlement_sheet_id: sheetIds[o.id],
      settlement_amount: Number(amounts[o.id]),
      settlement_unit_price: unitPrices[o.id]?Number(unitPrices[o.id]):null,
      price_unit: priceUnits[o.id]||null,
      delivery_fee: hasDelivery[o.id]&&deliveryFees[o.id]?Number(deliveryFees[o.id]):null,
      payment_method: payMethods[o.id]||null,
      settlement_classified_at: new Date().toISOString(),
      settlement_year: year, settlement_month: month,
    }).eq('id',o.id)))
    setOrders(prev=>prev.filter(o=>!ready.find(r=>r.id===o.id)))
    onRefresh()
  }

  if (loading) return <div style={{ textAlign:'center', padding:48, color:'#bbb', fontSize:13 }}>불러오는 중...</div>

  if (orders.length===0) return (
    <div style={{ textAlign:'center', padding:'64px 20px' }}>
      <div style={{ fontSize:44, marginBottom:12 }}>🎉</div>
      <div style={{ fontSize:16, fontWeight:700, color:'#ccc', marginBottom:6 }}>미분류 발주가 없어요!</div>
      <div style={{ fontSize:12, color:'#ddd' }}>{year}년 {month}월 미분류 발주가 없거나 모두 분류됐어요</div>
    </div>
  )

  const readyCount=orders.filter(o=>sheetIds[o.id]&&amounts[o.id]).length

  return (
    <div>
      <div style={{ padding:'12px 14px', background:'rgba(108,92,231,0.06)', borderRadius:12, border:'1px solid rgba(108,92,231,0.2)', marginBottom:14 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#6C5CE7', marginBottom:4 }}>📦 {year}년 {month}월 발주 결산 분류</div>
        <div style={{ fontSize:11, color:'#888', lineHeight:1.6 }}>{month}월 미분류 발주 {orders.length}건이 있어요.<br/>시트 선택 + 금액 입력 후 분류 버튼을 누르세요.</div>
      </div>

      {/* 결제방법/단위 전역 관리 버튼 */}
      <div style={{ display:'flex', gap:6, marginBottom:12 }}>
        <button onClick={()=>setShowPayMethodMgr(v=>!v)}
          style={{ padding:'6px 12px', borderRadius:9, background:'rgba(108,92,231,0.08)', border:'1px solid rgba(108,92,231,0.2)', color:'#6C5CE7', fontSize:11, fontWeight:600, cursor:'pointer' }}>
          💳 결제방법 관리
        </button>
        <button onClick={()=>setShowUnitMgr(v=>!v)}
          style={{ padding:'6px 12px', borderRadius:9, background:'rgba(45,198,214,0.08)', border:'1px solid rgba(45,198,214,0.2)', color:'#2DC6D6', fontSize:11, fontWeight:600, cursor:'pointer' }}>
          📐 단위 관리
        </button>
      </div>

      {/* 결제방법 관리 패널 */}
      {showPayMethodMgr&&(
        <div style={{ ...bx, border:'1px solid rgba(108,92,231,0.2)', background:'rgba(108,92,231,0.03)', marginBottom:12 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#6C5CE7', marginBottom:10 }}>💳 결제방법 관리</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
            {globalPayMethods.map(m=>(
              <span key={m} style={{ display:'flex', alignItems:'center', gap:3, padding:'4px 10px', borderRadius:20, background: DEFAULT_PAYMENT_METHODS.includes(m)?'rgba(108,92,231,0.1)':'rgba(255,107,53,0.1)', border:`1px solid ${DEFAULT_PAYMENT_METHODS.includes(m)?'rgba(108,92,231,0.25)':'rgba(255,107,53,0.25)'}`, fontSize:12, color: DEFAULT_PAYMENT_METHODS.includes(m)?'#6C5CE7':'#FF6B35' }}>
                {m}
                {!DEFAULT_PAYMENT_METHODS.includes(m)&&<button onClick={()=>removeGlobalPayMethod(m)} style={{ background:'none', border:'none', cursor:'pointer', color:'#E84393', fontSize:12, padding:0, marginLeft:3 }}>✕</button>}
              </span>
            ))}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <input value={newPayMethod} onChange={e=>setNewPayMethod(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addGlobalPayMethod()} placeholder="예: 법인카드, 외상" style={{ ...inp, flex:1, fontSize:12 }} />
            <button onClick={addGlobalPayMethod} style={{ padding:'8px 14px', borderRadius:8, background:'linear-gradient(135deg,#6C5CE7,#a29bfe)', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>추가</button>
          </div>
        </div>
      )}

      {/* 단위 관리 패널 */}
      {showUnitMgr&&(
        <div style={{ ...bx, border:'1px solid rgba(45,198,214,0.2)', background:'rgba(45,198,214,0.03)', marginBottom:12 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#2DC6D6', marginBottom:10 }}>📐 단위 관리</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
            {globalUnits.map(u=>(
              <span key={u} style={{ display:'flex', alignItems:'center', gap:3, padding:'4px 10px', borderRadius:20, background: DEFAULT_UNITS.slice(0,4).includes(u)?'rgba(45,198,214,0.1)':'rgba(255,107,53,0.1)', border:`1px solid ${DEFAULT_UNITS.slice(0,4).includes(u)?'rgba(45,198,214,0.25)':'rgba(255,107,53,0.25)'}`, fontSize:12, color: DEFAULT_UNITS.slice(0,4).includes(u)?'#2DC6D6':'#FF6B35' }}>
                {u}
                {!DEFAULT_UNITS.slice(0,4).includes(u)&&<button onClick={()=>removeGlobalUnit(u)} style={{ background:'none', border:'none', cursor:'pointer', color:'#E84393', fontSize:12, padding:0, marginLeft:3 }}>✕</button>}
              </span>
            ))}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <input value={newUnit} onChange={e=>setNewUnit(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addGlobalUnit()} placeholder="예: 묶음, 세트, 롤" style={{ ...inp, flex:1, fontSize:12 }} />
            <button onClick={addGlobalUnit} style={{ padding:'8px 14px', borderRadius:8, background:'linear-gradient(135deg,#2DC6D6,#6C5CE7)', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', flexShrink:0 }}>추가</button>
          </div>
        </div>
      )}

      {readyCount>0&&(
        <button onClick={classifyAll} style={{ width:'100%', padding:'12px 0', borderRadius:12, background:'linear-gradient(135deg,#6C5CE7,#a29bfe)', border:'none', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', marginBottom:14 }}>
          ✅ 입력된 {readyCount}건 한번에 분류
        </button>
      )}

      {orders.map(order=>{
        const d=new Date(order.confirmed_at||order.ordered_at)
        const selectedSheet=expenseSheets.find(s=>s.id===sheetIds[order.id])
        const isReady=!!(sheetIds[order.id]&&amounts[order.id])
        return (
          <div key={order.id} style={{ ...bx, border:isReady?'1.5px solid rgba(108,92,231,0.35)':'1px solid #E8ECF0', background:isReady?'rgba(108,92,231,0.02)':'#fff' }}>
            {/* 발주 정보 */}
            <div style={{ marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                <span style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>{order.item_name}</span>
                <span style={{ fontSize:14, fontWeight:700, color:'#888', flexShrink:0 }}>{order.quantity}{order.unit}</span>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                <span style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:'#F4F6F9', color:'#666' }}>📅 {d.getMonth()+1}월 {d.getDate()}일 주문확인</span>
                {order.supplier_name&&<span style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:'rgba(0,184,148,0.08)', color:'#00B894' }}>🏪 {order.supplier_name}</span>}
                {order.ordered_by&&<span style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:'rgba(108,92,231,0.07)', color:'#6C5CE7' }}>👤 {order.ordered_by}</span>}
                {order.memo&&<span style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:'rgba(255,107,53,0.07)', color:'#FF6B35' }}>📝 {order.memo}</span>}
              </div>
            </div>

            {/* 시트 선택 */}
            <div style={{ marginBottom:10 }}>
              <span style={lbl}>어느 항목으로 분류? *</span>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {expenseSheets.map(sheet=>(
                  <button key={sheet.id} onClick={()=>setSheetIds(p=>({...p,[order.id]:sheet.id}))}
                    style={{ padding:'6px 11px', borderRadius:20, border:sheetIds[order.id]===sheet.id?'2px solid #6C5CE7':'1px solid #E8ECF0', background:sheetIds[order.id]===sheet.id?'rgba(108,92,231,0.1)':'#F8F9FB', color:sheetIds[order.id]===sheet.id?'#6C5CE7':'#888', fontSize:11, fontWeight:sheetIds[order.id]===sheet.id?700:400, cursor:'pointer' }}>
                    {sheet.icon} {sheet.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 금액 + 단가/단위 */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
              <div>
                <span style={lbl}>결제 금액 * (원)</span>
                <input type="number" placeholder="실제 결제 금액" value={amounts[order.id]??''} onChange={e=>setAmounts(p=>({...p,[order.id]:e.target.value===''?'':Number(e.target.value)}))} style={inp} />
                {(amounts[order.id]||0)>0&&<div style={{ fontSize:10, color:'#6C5CE7', marginTop:3, fontWeight:600 }}>{numFmt(Number(amounts[order.id]))}원</div>}
              </div>
              <div>
                <span style={lbl}>단가 (선택, 통계용)</span>
                <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:4 }}>
                  <input type="number" placeholder="개당 가격" value={unitPrices[order.id]??''} onChange={e=>setUnitPrices(p=>({...p,[order.id]:e.target.value===''?'':Number(e.target.value)}))} style={inp} />
                  <select value={priceUnits[order.id]||'ea'} onChange={e=>setPriceUnits(p=>({...p,[order.id]:e.target.value}))} style={{ ...inp, width:'auto', minWidth:56, fontSize:12 }}>
                    {globalUnits.map(u=><option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* 배송비 ✅ */}
            <div style={{ marginBottom:10 }}>
              <span style={lbl}>배송비</span>
              <div style={{ display:'flex', gap:6, marginBottom: hasDelivery[order.id]?6:0 }}>
                <button onClick={()=>setHasDelivery(p=>({...p,[order.id]:false}))}
                  style={{ flex:1, padding:'7px 0', borderRadius:8, border:!hasDelivery[order.id]?'2px solid #6C5CE7':'1px solid #E8ECF0', background:!hasDelivery[order.id]?'rgba(108,92,231,0.1)':'#F8F9FB', color:!hasDelivery[order.id]?'#6C5CE7':'#888', fontSize:12, fontWeight:!hasDelivery[order.id]?700:400, cursor:'pointer' }}>없음</button>
                <button onClick={()=>setHasDelivery(p=>({...p,[order.id]:true}))}
                  style={{ flex:1, padding:'7px 0', borderRadius:8, border:hasDelivery[order.id]?'2px solid #FF6B35':'1px solid #E8ECF0', background:hasDelivery[order.id]?'rgba(255,107,53,0.1)':'#F8F9FB', color:hasDelivery[order.id]?'#FF6B35':'#888', fontSize:12, fontWeight:hasDelivery[order.id]?700:400, cursor:'pointer' }}>있음</button>
              </div>
              {hasDelivery[order.id]&&(
                <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <input type="number" placeholder="배송비 금액" value={deliveryFees[order.id]??''} onChange={e=>setDeliveryFees(p=>({...p,[order.id]:e.target.value===''?'':Number(e.target.value)}))} style={inp} />
                  <span style={{ fontSize:11, color:'#aaa', flexShrink:0 }}>원</span>
                </div>
              )}
            </div>

            {/* 결제방법 ✅ */}
            <div style={{ marginBottom:12 }}>
              <span style={lbl}>결제방법</span>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                {globalPayMethods.map(m=>(
                  <button key={m} onClick={()=>setPayMethods(p=>({...p,[order.id]:m}))}
                    style={{ padding:'5px 10px', borderRadius:8, border:payMethods[order.id]===m?`2px solid ${PAYMENT_COLORS[m]||'#6C5CE7'}`:'1px solid #E8ECF0', background:payMethods[order.id]===m?`${PAYMENT_COLORS[m]||'#6C5CE7'}18`:'#F8F9FB', color:payMethods[order.id]===m?PAYMENT_COLORS[m]||'#6C5CE7':'#888', fontSize:11, fontWeight:payMethods[order.id]===m?700:400, cursor:'pointer' }}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={()=>classifyOrder(order.id)} disabled={saving[order.id]||!isReady}
              style={{ width:'100%', padding:'11px 0', borderRadius:11, background:isReady?'linear-gradient(135deg,#6C5CE7,#a29bfe)':'#F0F2F5', border:'none', color:isReady?'#fff':'#bbb', fontSize:13, fontWeight:700, cursor:isReady?'pointer':'default' }}>
              {saving[order.id]?'분류 중...':isReady?`✅ ${selectedSheet?.icon} ${selectedSheet?.name}으로 분류`:'시트와 금액을 입력해주세요'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── ⚙️ 설정 모달 ──────────────────────────────────────────
function SettingsModal({ storeId, settings, onSave, onClose }: {
  storeId:string; settings:any; onSave:(s:any)=>void; onClose:()=>void
}) {
  const supabase = createSupabaseBrowserClient()
  const [tab, setTab] = useState<'settings'|'permissions'>('settings')
  const [bizType, setBizType] = useState(settings?.business_type||'individual')
  const [cardRate, setCardRate] = useState<number|''>(settings?.card_fee_rate??1.1)
  const [saving, setSaving] = useState(false)
  const [members, setMembers] = useState<any[]>([])
  const [permissions, setPermissions] = useState<any[]>([])
  const [loadingPerms, setLoadingPerms] = useState(true)

  useEffect(()=>{ if(tab==='permissions') loadPermissions() },[tab])
  async function loadPermissions() {
    setLoadingPerms(true)
    const [{ data: mems },{ data: perms }] = await Promise.all([
      supabase.from('store_members').select('*, profiles(*)').eq('store_id',storeId).eq('active',true).neq('role','owner'),
      supabase.from('settlement_permissions').select('*').eq('store_id',storeId),
    ])
    setMembers(mems||[]); setPermissions(perms||[]); setLoadingPerms(false)
  }
  async function handleSaveSettings() {
    if (!cardRate) return; setSaving(true)
    const data={store_id:storeId, business_type:bizType, card_fee_rate:Number(cardRate)}
    if (settings?.id) await supabase.from('settlement_settings').update(data).eq('id',settings.id)
    else await supabase.from('settlement_settings').insert(data)
    const { data: updated } = await supabase.from('settlement_settings').select('*').eq('store_id',storeId).maybeSingle()
    setSaving(false); onSave(updated); onClose()
  }
  async function togglePermission(member: any) {
    const existing=permissions.find(p=>p.profile_id===member.profile_id)
    if (existing) { await supabase.from('settlement_permissions').delete().eq('id',existing.id); setPermissions(prev=>prev.filter(p=>p.id!==existing.id)) }
    else { const { data } = await supabase.from('settlement_permissions').insert({ store_id:storeId, profile_id:member.profile_id, granted_by:storeId }).select().single(); if(data) setPermissions(prev=>[...prev,data]) }
  }
  const CARD_RATE_GUIDE = [
    { label:'개인사업자 (연매출 3억 이하)', rate:0.5 },
    { label:'개인사업자 (연매출 3~5억)', rate:1.1 },
    { label:'개인사업자 (5억 초과)', rate:1.5 },
    { label:'법인', rate:2.0 },
  ]
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'88vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>⚙️ 결산 설정</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ display:'flex', background:'#F4F6F9', borderRadius:10, padding:3, marginBottom:20, gap:2 }}>
          {[{key:'settings',label:'💳 카드수수료'},{key:'permissions',label:'👥 관리자 권한'}].map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key as any)} style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:tab===t.key?700:400, background:tab===t.key?'#fff':'transparent', color:tab===t.key?'#1a1a2e':'#aaa', boxShadow:tab===t.key?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>{t.label}</button>
          ))}
        </div>
        {tab==='settings'&&(
          <div>
            <div style={{ marginBottom:16 }}>
              <span style={lbl}>사업자 유형</span>
              <div style={{ display:'flex', gap:8 }}>
                {[{key:'individual',label:'👤 개인사업자'},{key:'corporation',label:'🏢 법인'}].map(b=>(
                  <button key={b.key} onClick={()=>setBizType(b.key)} style={{ flex:1, padding:'10px 0', borderRadius:10, border:bizType===b.key?'2px solid #6C5CE7':'1px solid #E8ECF0', background:bizType===b.key?'rgba(108,92,231,0.1)':'#F8F9FB', color:bizType===b.key?'#6C5CE7':'#888', fontSize:13, fontWeight:bizType===b.key?700:400, cursor:'pointer' }}>{b.label}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:8 }}>
              <span style={lbl}>카드 수수료율 (%)</span>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input type="number" step="0.1" min="0" max="5" value={cardRate} onChange={e=>setCardRate(e.target.value===''?'':Number(e.target.value))} style={{ ...inp, flex:1, fontSize:20, fontWeight:700, textAlign:'center' as const }} />
                <span style={{ fontSize:14, color:'#888' }}>%</span>
              </div>
            </div>
            <div style={{ background:'rgba(108,92,231,0.05)', borderRadius:12, padding:14, marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#6C5CE7', marginBottom:10 }}>💡 참고표 (탭하면 자동입력)</div>
              {CARD_RATE_GUIDE.map(g=>(
                <div key={g.label} onClick={()=>setCardRate(g.rate)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 12px', borderRadius:9, marginBottom:4, cursor:'pointer', background:cardRate===g.rate?'rgba(108,92,231,0.12)':'transparent', border:cardRate===g.rate?'1px solid rgba(108,92,231,0.3)':'1px solid transparent' }}>
                  <span style={{ fontSize:12, color:cardRate===g.rate?'#6C5CE7':'#555', fontWeight:cardRate===g.rate?700:400 }}>{g.label}</span>
                  <span style={{ fontSize:14, fontWeight:800, color:cardRate===g.rate?'#6C5CE7':'#888' }}>{g.rate}%</span>
                </div>
              ))}
            </div>
            <button onClick={handleSaveSettings} disabled={saving||!cardRate} style={{ width:'100%', padding:'13px 0', borderRadius:12, background:cardRate?'linear-gradient(135deg,#6C5CE7,#a29bfe)':'#E8ECF0', border:'none', color:cardRate?'#fff':'#aaa', fontSize:14, fontWeight:700, cursor:cardRate?'pointer':'default' }}>
              {saving?'저장 중...':'설정 저장'}
            </button>
          </div>
        )}
        {tab==='permissions'&&(
          <div>
            <div style={{ padding:'10px 14px', background:'rgba(255,107,53,0.06)', borderRadius:10, border:'1px solid rgba(255,107,53,0.2)', marginBottom:16, fontSize:12, color:'#FF6B35', lineHeight:1.7 }}>
              💡 결산 메뉴는 기본적으로 대표만 볼 수 있어요.
            </div>
            {loadingPerms?<div style={{ textAlign:'center', padding:32, color:'#bbb' }}>불러오는 중...</div>
            :members.length===0?<div style={{ textAlign:'center', padding:32, color:'#bbb' }}><div style={{ fontSize:32, marginBottom:8 }}>👥</div>등록된 직원이 없어요</div>
            :members.map(member=>{
              const hasPermi=permissions.some(p=>p.profile_id===member.profile_id)
              const name=member.profiles?.name||member.profiles?.nm||'이름없음'
              return (
                <div key={member.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', background:hasPermi?'rgba(0,184,148,0.05)':'#F8F9FB', borderRadius:12, marginBottom:8, border:`1px solid ${hasPermi?'rgba(0,184,148,0.25)':'#E8ECF0'}` }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:38, height:38, borderRadius:10, background:hasPermi?'linear-gradient(135deg,#00B894,#2DC6D6)':'#E8ECF0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, color:hasPermi?'#fff':'#aaa' }}>{name.charAt(0)}</div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{name}</div>
                      <div style={{ fontSize:10, color:'#aaa' }}>{member.role==='manager'?'관리자':'사원'} {hasPermi&&<span style={{ color:'#00B894', fontWeight:700 }}>· 결산 열람 가능</span>}</div>
                    </div>
                  </div>
                  <button onClick={()=>togglePermission(member)} style={{ padding:'8px 16px', borderRadius:10, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, background:hasPermi?'linear-gradient(135deg,#00B894,#2DC6D6)':'#F4F6F9', color:hasPermi?'#fff':'#888', minWidth:80 }}>
                    {hasPermi?'✅ 허용됨':'권한 부여'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 항목 추가/수정 모달 ─────────────────────────────────────
function EntryModal({ sheet, entry, storeId, userName, year, month, favorites, onSave, onClose }: {
  sheet:any; entry:any|null; storeId:string; userName:string
  year:number; month:number; favorites:any[]; onSave:()=>void; onClose:()=>void
}) {
  const supabase = createSupabaseBrowserClient()
  const pad=(n:number)=>String(n).padStart(2,'0')
  const [date, setDate] = useState(entry?.entry_date||`${year}-${pad(month)}-01`)
  const [itemName, setItemName] = useState(entry?.item_name||'')
  const [amount, setAmount] = useState<number|''>(entry?.amount||'')
  const [payment, setPayment] = useState(entry?.payment_method||'카드')
  const [taxInv, setTaxInv] = useState(entry?.has_tax_invoice||false)
  const [taxInvDate, setTaxInvDate] = useState(entry?.tax_invoice_date||'')
  const [memo, setMemo] = useState(entry?.memo||'')
  const [depositDate, setDepositDate] = useState(entry?.deposit_date||'')
  const [qty, setQty] = useState<number|''>(entry?.quantity||'')
  const [unitPrice, setUnitPrice] = useState<number|''>(entry?.unit_price||'')
  const [showExtra, setShowExtra] = useState(!!(entry?.deposit_date||entry?.tax_invoice_date||entry?.quantity||entry?.unit_price))
  const [saving, setSaving] = useState(false)

  useEffect(()=>{ if(qty&&unitPrice) setAmount(Math.round(Number(qty)*Number(unitPrice))) },[qty,unitPrice])

  async function handleSave() {
    if (!amount) { alert('금액을 입력해주세요'); return }
    setSaving(true)
    const data:any={
      sheet_id:sheet.id, store_id:storeId, year, month,
      entry_date:date, item_name:itemName.trim()||null,
      amount:Number(amount), payment_method:payment,
      has_tax_invoice:taxInv, tax_invoice_date:taxInv&&taxInvDate?taxInvDate:null,
      memo:memo.trim()||null, created_by:userName, updated_at:new Date().toISOString(),
      deposit_date:depositDate||null, quantity:qty||null, unit_price:unitPrice||null,
    }
    if (entry?.id) await supabase.from('settlement_entries').update(data).eq('id',entry.id)
    else await supabase.from('settlement_entries').insert(data)
    if (itemName.trim()) {
      const fav=favorites.find(f=>f.name===itemName.trim())
      if (fav) await supabase.from('settlement_favorites').update({ use_count:(fav.use_count||0)+1, default_amount:Number(amount), default_payment:payment }).eq('id',fav.id)
      else { try { await supabase.from('settlement_favorites').insert({ store_id:storeId, sheet_id:sheet.id, name:itemName.trim(), default_amount:Number(amount), default_payment:payment, use_count:1 }) } catch {} }
    }
    setSaving(false); onSave(); onClose()
  }
  async function handleDelete() {
    if (!entry?.id||!confirm('삭제할까요?')) return
    await supabase.from('settlement_entries').delete().eq('id',entry.id); onSave(); onClose()
  }

  const PAYMENT_METHODS_ENTRY = ['카드','현금','계좌이체','어음','기타']

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'92vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>{sheet.icon} {entry?'항목 수정':'항목 추가'} — {sheet.name}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>
        {!entry&&favorites.length>0&&(
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>⭐ 자주쓰는 품목</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {favorites.slice(0,8).map(f=>(
                <button key={f.id} onClick={()=>{ setItemName(f.name); if(f.default_amount) setAmount(f.default_amount); if(f.default_payment) setPayment(f.default_payment) }}
                  style={{ padding:'5px 11px', borderRadius:20, border:'1px solid rgba(255,107,53,0.3)', background:'rgba(255,107,53,0.07)', color:'#FF6B35', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                  {f.name} {f.default_amount?`(${numFmt(f.default_amount)}원)`:''}
                </button>
              ))}
            </div>
          </div>
        )}
        <div style={{ marginBottom:10 }}><span style={lbl}>날짜 (주문일)</span><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inp} /></div>
        <div style={{ marginBottom:10 }}><span style={lbl}>품목명 (선택)</span><input value={itemName} onChange={e=>setItemName(e.target.value)} placeholder={`예: ${sheet.name} 구매`} style={inp} /></div>
        <div style={{ marginBottom:10 }}>
          <span style={lbl}>금액 *</span>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <input type="number" value={amount} onChange={e=>setAmount(e.target.value===''?'':Number(e.target.value))} placeholder="0" style={inp} />
            <span style={{ fontSize:11, color:'#aaa', flexShrink:0 }}>원</span>
          </div>
          {Number(amount)>0&&<div style={{ fontSize:11, color:'#FF6B35', marginTop:3, fontWeight:600 }}>{numFmt(Number(amount))}원</div>}
        </div>
        <div style={{ marginBottom:10 }}>
          <span style={lbl}>결제방법</span>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {PAYMENT_METHODS_ENTRY.map(m=>(
              <button key={m} onClick={()=>setPayment(m)} style={{ padding:'6px 12px', borderRadius:8, border:payment===m?`2px solid ${PAYMENT_COLORS[m]||'#6C5CE7'}`:'1px solid #E8ECF0', background:payment===m?`${PAYMENT_COLORS[m]||'#6C5CE7'}18`:'#F8F9FB', color:payment===m?PAYMENT_COLORS[m]||'#6C5CE7':'#888', fontSize:12, fontWeight:payment===m?700:400, cursor:'pointer' }}>{m}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:10 }}>
          <span style={lbl}>세금계산서</span>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={()=>setTaxInv((v:boolean)=>!v)} style={{ flex:1, padding:'9px 0', borderRadius:8, border:taxInv?'2px solid #00B894':'1px solid #E8ECF0', background:taxInv?'rgba(0,184,148,0.1)':'#F8F9FB', color:taxInv?'#00B894':'#aaa', fontSize:13, fontWeight:taxInv?700:400, cursor:'pointer' }}>
              {taxInv?'✅ 발행됨':'⬜ 미발행'}
            </button>
            {taxInv&&<input type="date" value={taxInvDate} onChange={e=>setTaxInvDate(e.target.value)} style={{ ...inp, flex:1 }} />}
          </div>
        </div>
        <button onClick={()=>setShowExtra(v=>!v)} style={{ width:'100%', padding:'9px 0', borderRadius:10, border:'1px dashed #E8ECF0', background:'transparent', color:'#aaa', fontSize:12, cursor:'pointer', marginBottom:showExtra?10:16 }}>
          {showExtra?'▲ 상세정보 닫기':'▼ 상세정보 (입금일 · 수량 · 단가)'}
        </button>
        {showExtra&&(
          <div style={{ background:'rgba(108,92,231,0.04)', borderRadius:12, padding:14, marginBottom:14, border:'1px solid rgba(108,92,231,0.12)' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#6C5CE7', marginBottom:12 }}>📋 상세 정보 (업체 관리용)</div>
            <div style={{ marginBottom:10 }}><span style={lbl}>입금일</span><input type="date" value={depositDate} onChange={e=>setDepositDate(e.target.value)} style={inp} /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div><span style={lbl}>수량</span><input type="number" step="0.1" value={qty} onChange={e=>setQty(e.target.value===''?'':Number(e.target.value))} placeholder="0" style={inp} /></div>
              <div><span style={lbl}>단가 (원)</span><input type="number" value={unitPrice} onChange={e=>setUnitPrice(e.target.value===''?'':Number(e.target.value))} placeholder="0" style={inp} /></div>
            </div>
            {qty&&unitPrice&&<div style={{ fontSize:10, color:'#6C5CE7', marginTop:6, fontWeight:600 }}>수량×단가 = {numFmt(Math.round(Number(qty)*Number(unitPrice)))}원 → 금액 자동반영</div>}
          </div>
        )}
        <div style={{ marginBottom:16 }}><span style={lbl}>메모 (선택)</span><input value={memo} onChange={e=>setMemo(e.target.value)} placeholder="메모" style={inp} /></div>
        <div style={{ display:'flex', gap:8 }}>
          {entry&&<button onClick={handleDelete} style={{ padding:'12px 16px', borderRadius:12, background:'rgba(232,67,147,0.08)', border:'1px solid rgba(232,67,147,0.2)', color:'#E84393', fontSize:13, cursor:'pointer', fontWeight:600 }}>삭제</button>}
          <button onClick={handleSave} disabled={saving} style={{ flex:1, padding:'13px 0', borderRadius:12, background:saving?'#ddd':'linear-gradient(135deg,#FF6B35,#E84393)', border:'none', color:'#fff', fontSize:14, fontWeight:700, cursor:saving?'not-allowed':'pointer' }}>
            {saving?'저장 중...':entry?'수정 저장':'추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 시트 관리 모달 ─────────────────────────────────────────
function SheetManageModal({ sheets, storeId, onSave, onClose }: {
  sheets:any[]; storeId:string; onSave:()=>void; onClose:()=>void
}) {
  const supabase = createSupabaseBrowserClient()
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📋')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)
  const [editName, setEditName] = useState('')

  async function handleAdd() {
    if (!newName.trim()) return; setSaving(true)
    const maxOrder=sheets.reduce((max,s)=>Math.max(max,s.sort_order||0),0)
    await supabase.from('settlement_sheets').insert({ store_id:storeId, name:newName.trim(), icon:newIcon, sheet_type:'expense', sort_order:maxOrder+1 })
    setNewName(''); setSaving(false); onSave()
  }
  async function handleToggle(sheet:any) { await supabase.from('settlement_sheets').update({ is_active:!sheet.is_active }).eq('id',sheet.id); onSave() }
  async function handleRename(id:string) {
    if (!editName.trim()) return
    await supabase.from('settlement_sheets').update({ name:editName.trim() }).eq('id',id); setEditId(null); onSave()
  }
  async function handleDelete(sheet:any) {
    if (!confirm(`"${sheet.name}" 시트를 삭제할까요?`)) return
    await supabase.from('settlement_sheets').delete().eq('id',sheet.id); onSave()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'88vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:15, fontWeight:700 }}>📂 시트 관리</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>
        {sheets.filter(s=>s.sheet_type!=='sales').map(sheet=>(
          <div key={sheet.id} style={{ padding:'10px 14px', background:sheet.is_active?'#fff':'#F8F9FB', borderRadius:10, border:`1px solid ${sheet.is_active?'#E8ECF0':'#F0F0F0'}`, marginBottom:6 }}>
            {editId===sheet.id?(
              <div style={{ display:'flex', gap:6 }}>
                <input value={editName} onChange={e=>setEditName(e.target.value)} style={{ ...inp, flex:1 }} autoFocus />
                <button onClick={()=>handleRename(sheet.id)} style={{ padding:'6px 12px', borderRadius:8, background:'linear-gradient(135deg,#FF6B35,#E84393)', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>저장</button>
                <button onClick={()=>setEditId(null)} style={{ padding:'6px 10px', borderRadius:8, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', cursor:'pointer', fontSize:12 }}>취소</button>
              </div>
            ):(
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:18 }}>{sheet.icon}</span>
                <span style={{ flex:1, fontSize:13, fontWeight:600, color:sheet.is_active?'#1a1a2e':'#aaa' }}>{sheet.name}</span>
                <button onClick={()=>{ setEditId(sheet.id); setEditName(sheet.name) }} style={{ background:'none', border:'none', fontSize:11, color:'#6C5CE7', cursor:'pointer' }}>수정</button>
                <button onClick={()=>handleToggle(sheet)} style={{ padding:'2px 8px', borderRadius:6, border:`1px solid ${sheet.is_active?'rgba(0,184,148,0.3)':'#E8ECF0'}`, background:sheet.is_active?'rgba(0,184,148,0.08)':'#F4F6F9', color:sheet.is_active?'#00B894':'#aaa', fontSize:10, fontWeight:700, cursor:'pointer' }}>{sheet.is_active?'활성':'비활성'}</button>
                <button onClick={()=>handleDelete(sheet)} style={{ background:'none', border:'none', color:'#E84393', fontSize:11, cursor:'pointer' }}>삭제</button>
              </div>
            )}
          </div>
        ))}
        <div style={{ background:'rgba(255,107,53,0.04)', borderRadius:12, padding:14, border:'1px dashed rgba(255,107,53,0.3)', marginTop:8 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#FF6B35', marginBottom:10 }}>+ 새 시트 추가</div>
          <div style={{ marginBottom:8 }}><span style={lbl}>시트 이름</span><input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAdd()} placeholder="예: 포장재" style={inp} /></div>
          <div style={{ marginBottom:12 }}>
            <span style={lbl}>아이콘</span>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              {ICONS.map(ic=><button key={ic} onClick={()=>setNewIcon(ic)} style={{ width:34, height:34, borderRadius:8, border:newIcon===ic?'2px solid #FF6B35':'1px solid #E8ECF0', background:newIcon===ic?'rgba(255,107,53,0.1)':'#F8F9FB', fontSize:17, cursor:'pointer' }}>{ic}</button>)}
            </div>
          </div>
          <button onClick={handleAdd} disabled={saving||!newName.trim()} style={{ width:'100%', padding:'11px 0', borderRadius:10, background:newName.trim()?'linear-gradient(135deg,#FF6B35,#E84393)':'#E8ECF0', border:'none', color:newName.trim()?'#fff':'#aaa', fontSize:13, fontWeight:700, cursor:newName.trim()?'pointer':'default' }}>
            {saving?'추가 중...':'시트 추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 수익분석 뷰 ────────────────────────────────────────────
function ProfitAnalysisView({ sheets, storeId, year, month, settings }: {
  sheets:any[]; storeId:string; year:number; month:number; settings:any
}) {
  const supabase = createSupabaseBrowserClient()
  const [entrySums, setEntrySums] = useState<Record<string,number>>({})
  const [orderSums, setOrderSums] = useState<Record<string,number>>({})
  const [salesByPlatform, setSalesByPlatform] = useState<Record<string,number>>({})
  const [feeEntries, setFeeEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(()=>{ loadAll() },[storeId,year,month])

  async function loadAll() {
    setLoading(true)
    const pad=(n:number)=>String(n).padStart(2,'0')
    const from=`${year}-${pad(month)}-01`; const to=`${year}-${pad(month)}-${pad(new Date(year,month,0).getDate())}`
    const { data: ent } = await supabase.from('settlement_entries').select('sheet_id,amount').eq('store_id',storeId).eq('year',year).eq('month',month)
    const sums: Record<string,number>={}
    ;(ent||[]).forEach((e:any)=>{ sums[e.sheet_id]=(sums[e.sheet_id]||0)+(e.amount||0) })
    setEntrySums(sums)
    const { data: linked } = await supabase.from('orders').select('settlement_sheet_id,settlement_amount').eq('store_id',storeId).eq('settlement_year',year).eq('settlement_month',month).not('settlement_sheet_id','is',null)
    const oSums: Record<string,number>={}
    ;(linked||[]).forEach((o:any)=>{ if(o.settlement_sheet_id&&o.settlement_amount) oSums[o.settlement_sheet_id]=(oSums[o.settlement_sheet_id]||0)+o.settlement_amount })
    setOrderSums(oSums)
    const feeSheet=sheets.find(s=>s.name==='수수료')
    if (feeSheet) { const { data: fd } = await supabase.from('settlement_entries').select('*').eq('sheet_id',feeSheet.id).eq('year',year).eq('month',month); setFeeEntries(fd||[]) } else setFeeEntries([])
    const { data: cls } = await supabase.from('closings').select('id').eq('store_id',storeId).gte('closing_date',from).lte('closing_date',to)
    if (cls&&cls.length>0) {
      const { data: sv } = await supabase.from('closing_sales').select('platform,amount').in('closing_id',cls.map((c:any)=>c.id))
      const bp: Record<string,number>={}
      ;(sv||[]).forEach((s:any)=>{ bp[s.platform]=(bp[s.platform]||0)+(s.amount||0) })
      setSalesByPlatform(bp)
    } else setSalesByPlatform({})
    setLoading(false)
  }

  async function handleExportAll() { setExporting(true); await exportAllExcel(storeId,year,month,sheets,settings); setExporting(false) }

  const cardRate=settings?.card_fee_rate??1.1
  const DELIVERY=['배달의민족','배민','쿠팡이츠','쿠팡','요기요']
  const pos=Object.entries(salesByPlatform).filter(([k])=>!DELIVERY.includes(k)).reduce((s,[,v])=>s+v,0)
  const baemin=salesByPlatform['배달의민족']||salesByPlatform['배민']||0
  const coupang=salesByPlatform['쿠팡이츠']||salesByPlatform['쿠팡']||0
  const yogiyo=salesByPlatform['요기요']||0
  const cardFeeAuto=Math.round(pos*(cardRate/100))
  const getFee=(kws:string[])=>feeEntries.filter(e=>kws.some(k=>e.item_name?.includes(k))).reduce((s,e)=>s+(e.amount||0),0)
  const totalSales=Object.values(salesByPlatform).reduce((s,v)=>s+v,0)
  const expenseSheets=sheets.filter(s=>s.sheet_type==='expense'&&s.is_active)
  const totalExpense=expenseSheets.reduce((s,sh)=>s+(entrySums[sh.id]||0)+(orderSums[sh.id]||0),0)+cardFeeAuto
  const netProfit=totalSales-totalExpense
  const profitRate=totalSales>0?Math.round((netProfit/totalSales)*1000)/10:0

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'#bbb', fontSize:13 }}>불러오는 중...</div>

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}>
        <button onClick={handleExportAll} disabled={exporting} style={{ padding:'9px 18px', borderRadius:11, background:exporting?'#F0F2F5':'linear-gradient(135deg,#00B894,#2DC6D6)', border:'none', color:exporting?'#bbb':'#fff', fontSize:13, fontWeight:700, cursor:exporting?'default':'pointer' }}>
          {exporting?'📊 엑셀 생성 중...':'📥 전체 엑셀 다운로드'}
        </button>
      </div>
      <div style={{ ...bx, border:`1.5px solid ${netProfit>=0?'rgba(0,184,148,0.4)':'rgba(232,67,147,0.4)'}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:12, color:'#888', marginBottom:4 }}>{year}년 {month}월 수익분석</div>
            <div style={{ fontSize:10, color:'#aaa' }}>{settings?.business_type==='corporation'?'법인':'개인사업자'} · 카드수수료 {cardRate}%</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:30, fontWeight:900, color:netProfit>=0?'#00B894':'#E84393', lineHeight:1.1 }}>{numFmt(netProfit)}원</div>
            <div style={{ fontSize:14, fontWeight:700, color:netProfit>=0?'#00B894':'#E84393' }}>수익률 {profitRate}%</div>
          </div>
        </div>
        <div style={{ height:12, background:'#F0F2F5', borderRadius:8, overflow:'hidden', marginBottom:6 }}>
          <div style={{ height:12, borderRadius:8, width:`${Math.min(Math.max(profitRate,0),50)*2}%`, background:profitRate>=20?'linear-gradient(90deg,#00B894,#00cec9)':profitRate>=10?'linear-gradient(90deg,#FF6B35,#FDC400)':'linear-gradient(90deg,#E84393,#FF6B35)', transition:'width 0.4s' }} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:14 }}>
          {[{l:'총 매출',v:totalSales,c:'#00B894',bg:'rgba(0,184,148,0.08)'},{l:'총 지출',v:totalExpense,c:'#E84393',bg:'rgba(232,67,147,0.06)'},{l:'순수익',v:netProfit,c:netProfit>=0?'#00B894':'#E84393',bg:netProfit>=0?'rgba(0,184,148,0.08)':'rgba(232,67,147,0.06)'}].map(item=>(
            <div key={item.l} style={{ padding:'10px 8px', background:item.bg, borderRadius:10, textAlign:'center' }}>
              <div style={{ fontSize:10, color:'#aaa', marginBottom:3 }}>{item.l}</div>
              <div style={{ fontSize:13, fontWeight:800, color:item.c }}>{Math.abs(item.v)>=10000?`${(item.v/10000).toFixed(0)}만`:`${numFmt(item.v)}`}원</div>
            </div>
          ))}
        </div>
      </div>
      <div style={bx}>
        <div style={{ fontSize:13, fontWeight:800, color:'#1a1a2e', marginBottom:14 }}>💰 매출 상세</div>
        {pos>0&&<div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}><span style={{ fontSize:12, fontWeight:700, color:'#555' }}>🏪 매장 매출</span><span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{numFmt(pos)}원</span></div>}
        {[{name:'배달의민족',sales:baemin,fee:getFee(['배민','배달의민족']),icon:'🛵'},{name:'쿠팡이츠',sales:coupang,fee:getFee(['쿠팡']),icon:'🟡'},{name:'요기요',sales:yogiyo,fee:getFee(['요기요']),icon:'🔴'}].filter(p=>p.sales>0||p.fee>0).map(p=>(
          <div key={p.name} style={{ marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><span style={{ fontSize:12, fontWeight:700, color:'#555' }}>{p.icon} {p.name}</span><span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{numFmt(p.sales)}원</span></div>
            {p.fee>0&&<div style={{ display:'flex', justifyContent:'space-between', padding:'6px 12px', background:'rgba(232,67,147,0.05)', borderRadius:8 }}><span style={{ fontSize:11, color:'#E84393' }}>수수료</span><span style={{ fontSize:11, fontWeight:700, color:'#E84393' }}>-{numFmt(p.fee)}원</span></div>}
          </div>
        ))}
        {totalSales===0&&<div style={{ textAlign:'center', padding:'16px 0', color:'#bbb', fontSize:12 }}>마감일지에서 매출 입력 시 자동 연동됩니다</div>}
        {totalSales>0&&<div style={{ borderTop:'2px dashed #E8ECF0', paddingTop:10, marginTop:8 }}><div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ fontSize:13, fontWeight:700 }}>총 매출</span><span style={{ fontSize:15, fontWeight:800, color:'#00B894' }}>{numFmt(totalSales)}원</span></div></div>}
      </div>
      <div style={bx}>
        <div style={{ fontSize:13, fontWeight:800, color:'#1a1a2e', marginBottom:14 }}>💸 지출 상세 분석</div>
        {cardFeeAuto>0&&(
          <div style={{ marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ fontSize:16 }}>💳</span>
                <span style={{ fontSize:12, color:'#555', fontWeight:600 }}>카드수수료 (자동 {cardRate}%)</span>
                <span style={{ fontSize:9, background:'rgba(108,92,231,0.12)', color:'#6C5CE7', padding:'1px 6px', borderRadius:5, fontWeight:700 }}>자동</span>
              </div>
              <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{numFmt(cardFeeAuto)}원</span>
            </div>
            <div style={{ height:7, background:'#F0F2F5', borderRadius:4 }}><div style={{ height:7, borderRadius:4, background:'linear-gradient(90deg,#6C5CE7,#a29bfe)', width:`${Math.min(pct(cardFeeAuto,totalSales)*2,100)}%` }} /></div>
          </div>
        )}
        {expenseSheets.map(sheet=>{
          const mAmt=entrySums[sheet.id]||0; const oAmt=orderSums[sheet.id]||0; const amt=mAmt+oAmt
          const ratio=pct(amt,totalSales); const isHigh=ratio>30
          return (
            <div key={sheet.id} style={{ marginBottom:amt>0?12:4 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:amt>0?4:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <span style={{ fontSize:15 }}>{sheet.icon}</span>
                  <span style={{ fontSize:12, color:amt>0?'#555':'#ccc', fontWeight:amt>0?600:400 }}>{sheet.name}</span>
                  {isHigh&&amt>0&&<span style={{ fontSize:9, background:'rgba(232,67,147,0.15)', color:'#E84393', padding:'1px 5px', borderRadius:6, fontWeight:700 }}>⚠️</span>}
                  {oAmt>0&&<span style={{ fontSize:9, background:'rgba(0,184,148,0.12)', color:'#00B894', padding:'1px 5px', borderRadius:5, fontWeight:700 }}>📦</span>}
                </div>
                <div style={{ textAlign:'right' }}>
                  {amt>0?(<><span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{numFmt(amt)}원</span>{totalSales>0&&<span style={{ fontSize:10, color:'#aaa', marginLeft:4 }}>{ratio}%</span>}</>):<span style={{ fontSize:11, color:'#ddd' }}>미입력</span>}
                </div>
              </div>
              {amt>0&&<div style={{ height:6, background:'#F0F2F5', borderRadius:4 }}><div style={{ height:6, borderRadius:4, background:isHigh?'linear-gradient(90deg,#E84393,#FF6B35)':'linear-gradient(90deg,#FF6B35,#FDC400)', width:`${Math.min(ratio*2,100)}%` }} /></div>}
            </div>
          )
        })}
        <div style={{ display:'flex', justifyContent:'space-between', paddingTop:12, borderTop:'2px solid #E8ECF0' }}><span style={{ fontSize:13, fontWeight:700 }}>지출 합계</span><span style={{ fontSize:18, fontWeight:800, color:'#E84393' }}>{numFmt(totalExpense)}원</span></div>
      </div>
    </div>
  )
}

// ── 시트 뷰 (✅ 발주 연동 항목 수정 가능 — 모든 시트) ────
function SheetView({ sheet, allSheets, storeId, userName, year, month }: {
  sheet:any; allSheets:any[]; storeId:string; userName:string; year:number; month:number
}) {
  const supabase = createSupabaseBrowserClient()
  const [entries, setEntries] = useState<any[]>([])
  const [favorites, setFavorites] = useState<any[]>([])
  const [linkedOrders, setLinkedOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editEntry, setEditEntry] = useState<any>(null)
  const [editOrder, setEditOrder] = useState<any>(null) // ✅ 발주 수정용
  const [searchQ, setSearchQ] = useState('')
  const [reclassifyId, setReclassifyId] = useState<string|null>(null)

  useEffect(()=>{ loadAll() },[sheet.id,year,month])

  async function loadAll() {
    setLoading(true)
    const [{ data: ent },{ data: favs },{ data: linked }] = await Promise.all([
      supabase.from('settlement_entries').select('*').eq('sheet_id',sheet.id).eq('year',year).eq('month',month).order('entry_date',{ascending:false}),
      supabase.from('settlement_favorites').select('*').eq('sheet_id',sheet.id).order('use_count',{ascending:false}),
      supabase.from('orders').select('*').eq('settlement_sheet_id',sheet.id).eq('settlement_year',year).eq('settlement_month',month).eq('store_id',storeId).order('confirmed_at',{ascending:false}),
    ])
    setEntries(ent||[]); setFavorites(favs||[]); setLinkedOrders(linked||[]); setLoading(false)
  }

  async function reclassifyOrder(orderId: string, newSheetId: string) {
    await supabase.from('orders').update({ settlement_sheet_id:newSheetId }).eq('id',orderId)
    setReclassifyId(null); loadAll()
  }
  async function unclassifyOrder(orderId: string) {
    if (!confirm('미분류 탭으로 이동할까요?')) return
    await supabase.from('orders').update({ settlement_sheet_id:null, settlement_amount:null, settlement_unit_price:null, price_unit:null, delivery_fee:null, payment_method:null, settlement_classified_at:null, settlement_year:null, settlement_month:null }).eq('id',orderId)
    loadAll()
  }
  async function deleteFavorite(id:string) { await supabase.from('settlement_favorites').delete().eq('id',id); loadAll() }

  const manualTotal=useMemo(()=>entries.reduce((s,e)=>s+(e.amount||0),0),[entries])
  const orderTotal=useMemo(()=>linkedOrders.reduce((s,o)=>s+(o.settlement_amount||0),0),[linkedOrders])
  const total=manualTotal+orderTotal
  const filteredEntries=useMemo(()=>searchQ.trim()?entries.filter(e=>(e.item_name||'').includes(searchQ)||String(e.amount).includes(searchQ)):entries,[entries,searchQ])
  const filteredOrders=useMemo(()=>searchQ.trim()?linkedOrders.filter(o=>(o.item_name||'').includes(searchQ)):linkedOrders,[linkedOrders,searchQ])
  const grouped=useMemo(()=>{
    const map: Record<string,any[]>={}
    filteredEntries.forEach(e=>{ if(!map[e.entry_date]) map[e.entry_date]=[]; map[e.entry_date].push(e) })
    return Object.entries(map).sort((a,b)=>b[0].localeCompare(a[0]))
  },[filteredEntries])
  const expenseSheets=allSheets.filter(s=>s.sheet_type==='expense'&&s.is_active&&s.id!==sheet.id)

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'#bbb', fontSize:13 }}>불러오는 중...</div>

  return (
    <div>
      {/* ✅ 발주 수정 모달 */}
      {editOrder&&<OrderEditModal order={editOrder} onSave={()=>{ loadAll() }} onClose={()=>setEditOrder(null)} />}

      <div style={{ ...bx, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:11, color:'#aaa' }}>{year}년 {month}월 합계</div>
          <div style={{ fontSize:24, fontWeight:900, color:'#FF6B35' }}>{numFmt(total)}원</div>
          <div style={{ display:'flex', gap:8, marginTop:4, flexWrap:'wrap' }}>
            {manualTotal>0&&<span style={{ fontSize:10, color:'#bbb' }}>직접입력 {numFmt(manualTotal)}원</span>}
            {orderTotal>0&&<span style={{ fontSize:10, color:'#00B894', fontWeight:600 }}>📦 발주 {numFmt(orderTotal)}원</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <button onClick={()=>exportSheetExcel(sheet,entries,linkedOrders,year,month)} style={{ padding:'7px 12px', borderRadius:10, background:'rgba(0,184,148,0.08)', border:'1px solid rgba(0,184,148,0.25)', color:'#00B894', fontSize:11, fontWeight:700, cursor:'pointer' }}>📥 엑셀</button>
          <button onClick={()=>{ setEditEntry(null); setShowModal(true) }} style={{ padding:'10px 14px', borderRadius:12, background:'linear-gradient(135deg,#FF6B35,#E84393)', border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ 추가</button>
        </div>
      </div>

      <div style={{ position:'relative', marginBottom:12 }}>
        <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:13, color:'#bbb' }}>🔍</span>
        <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder={`${sheet.name} 항목 검색...`} style={{ ...inp, paddingLeft:32, paddingRight:searchQ?30:10 }} />
        {searchQ&&<button onClick={()=>setSearchQ('')} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'#bbb', cursor:'pointer', fontSize:14 }}>✕</button>}
      </div>

      {/* ✅ 발주 연동 항목 — 클릭하면 수정 모달 */}
      {filteredOrders.length>0&&(
        <div style={{ ...bx, border:'1px solid rgba(0,184,148,0.25)', background:'rgba(0,184,148,0.02)' }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#00B894', marginBottom:4 }}>📦 발주 연동 ({filteredOrders.length}건)</div>
          <div style={{ fontSize:10, color:'#aaa', marginBottom:10 }}>품목을 누르면 수정할 수 있어요</div>
          {filteredOrders.map(order=>{
            const d=new Date(order.confirmed_at||order.ordered_at)
            const isReclassify=reclassifyId===order.id
            return (
              <div key={order.id} style={{ padding:'10px 12px', background:'rgba(0,184,148,0.06)', borderRadius:10, marginBottom:6, border:'1px solid rgba(0,184,148,0.15)' }}>
                {/* ✅ 품목명 클릭 → 수정 모달 */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', cursor:'pointer' }} onClick={()=>setEditOrder(order)}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                      <span style={{ fontSize:9, background:'rgba(0,184,148,0.2)', color:'#00B894', padding:'1px 6px', borderRadius:4, fontWeight:700 }}>📦</span>
                      <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{order.item_name}</span>
                      <span style={{ fontSize:10, color:'#6C5CE7', fontWeight:600 }}>✏️ 수정</span>
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      <span style={{ fontSize:10, color:'#aaa' }}>📅 {d.getMonth()+1}월 {d.getDate()}일</span>
                      {order.quantity&&<span style={{ fontSize:10, color:'#aaa' }}>· {order.quantity}{order.unit}</span>}
                      {order.supplier_name&&<span style={{ fontSize:10, color:'#6C5CE7' }}>· 🏪 {order.supplier_name}</span>}
                      {order.payment_method&&<span style={{ fontSize:10, color:PAYMENT_COLORS[order.payment_method]||'#888' }}>· 💳 {order.payment_method}</span>}
                      {order.settlement_unit_price&&<span style={{ fontSize:10, color:'#FF6B35' }}>· 단가 {numFmt(order.settlement_unit_price)}원/{order.price_unit||''}</span>}
                      {order.delivery_fee>0&&<span style={{ fontSize:10, color:'#FF6B35' }}>· 배송비 {numFmt(order.delivery_fee)}원</span>}
                      {order.has_tax_invoice&&<span style={{ fontSize:10, color:'#00B894', fontWeight:700 }}>· ✅ 세금계산서</span>}
                    </div>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0, marginLeft:8 }}>
                    {order.settlement_amount?<span style={{ fontSize:15, fontWeight:800, color:'#1a1a2e' }}>{numFmt(order.settlement_amount)}원</span>:<span style={{ fontSize:11, color:'#bbb' }}>금액없음</span>}
                  </div>
                </div>
                {/* 시트 변경 / 미분류 이동 */}
                <div style={{ display:'flex', gap:6, marginTop:8 }} onClick={e=>e.stopPropagation()}>
                  <button onClick={()=>setReclassifyId(isReclassify?null:order.id)}
                    style={{ padding:'4px 10px', borderRadius:7, background:isReclassify?'rgba(108,92,231,0.15)':'rgba(108,92,231,0.07)', border:'1px solid rgba(108,92,231,0.2)', color:'#6C5CE7', fontSize:10, fontWeight:700, cursor:'pointer' }}>
                    {isReclassify?'✕ 취소':'🔀 시트 변경'}
                  </button>
                  <button onClick={()=>unclassifyOrder(order.id)} style={{ padding:'4px 10px', borderRadius:7, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#aaa', fontSize:10, cursor:'pointer' }}>
                    미분류로 이동
                  </button>
                </div>
                {isReclassify&&(
                  <div style={{ marginTop:8, padding:'10px 12px', background:'rgba(108,92,231,0.05)', borderRadius:9, border:'1px solid rgba(108,92,231,0.15)' }} onClick={e=>e.stopPropagation()}>
                    <div style={{ fontSize:11, color:'#6C5CE7', fontWeight:700, marginBottom:8 }}>어느 시트로 이동할까요?</div>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                      {expenseSheets.map(s=>(
                        <button key={s.id} onClick={()=>reclassifyOrder(order.id,s.id)}
                          style={{ padding:'6px 11px', borderRadius:20, border:'1px solid rgba(108,92,231,0.25)', background:'rgba(108,92,231,0.08)', color:'#6C5CE7', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                          {s.icon} {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {favorites.length>0&&!searchQ&&(
        <div style={bx}>
          <div style={{ fontSize:12, fontWeight:700, marginBottom:8 }}>⭐ 자주쓰는 품목</div>
          {favorites.map(f=>(
            <div key={f.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 12px', background:'rgba(255,107,53,0.04)', borderRadius:9, border:'1px solid rgba(255,107,53,0.12)', marginBottom:4 }}>
              <div><span style={{ fontSize:12, fontWeight:600, color:'#1a1a2e' }}>{f.name}</span><span style={{ fontSize:10, color:'#aaa', marginLeft:8 }}>{f.use_count}회 · {numFmt(f.default_amount||0)}원</span></div>
              <button onClick={()=>deleteFavorite(f.id)} style={{ background:'none', border:'none', fontSize:10, color:'#E84393', cursor:'pointer' }}>삭제</button>
            </div>
          ))}
        </div>
      )}

      {filteredEntries.length===0&&filteredOrders.length===0?(
        <div style={{ textAlign:'center', padding:'48px 0', color:'#bbb' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>{sheet.icon}</div>
          <div style={{ fontSize:12 }}>{searchQ?'검색 결과가 없어요':'미분류 탭에서 발주 분류하거나 + 추가로 직접 입력하세요'}</div>
        </div>
      ):grouped.map(([date,items])=>{
        const d=new Date(date+'T00:00:00'); const dow=['일','월','화','수','목','금','토'][d.getDay()]; const isSun=d.getDay()===0; const isSat=d.getDay()===6
        const dayTotal=items.reduce((s,e)=>s+(e.amount||0),0)
        return (
          <div key={date} style={{ marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span style={{ fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'rgba(108,92,231,0.08)', color:isSun?'#E84393':isSat?'#2DC6D6':'#6C5CE7' }}>{d.getMonth()+1}월 {d.getDate()}일 ({dow})</span>
              <span style={{ fontSize:13, fontWeight:700, color:'#FF6B35' }}>{numFmt(dayTotal)}원</span>
            </div>
            {items.map(entry=>(
              <div key={entry.id} onClick={()=>{ setEditEntry(entry); setShowModal(true) }}
                style={{ background:'#fff', borderRadius:12, border:'1px solid #E8ECF0', padding:'11px 14px', marginBottom:6, cursor:'pointer' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:2 }}>
                      {entry.item_name&&<span style={{ fontSize:13, fontWeight:600, color:'#1a1a2e' }}>{entry.item_name}</span>}
                      <span style={{ fontSize:10, padding:'1px 7px', borderRadius:10, background:`${PAYMENT_COLORS[entry.payment_method]||'#aaa'}18`, color:PAYMENT_COLORS[entry.payment_method]||'#aaa', fontWeight:600 }}>{entry.payment_method}</span>
                      {entry.has_tax_invoice&&<span style={{ fontSize:10, color:'#00B894', fontWeight:700 }}>✅ 세금계산서</span>}
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {entry.deposit_date&&<span style={{ fontSize:10, color:'#6C5CE7' }}>💰 입금 {entry.deposit_date.slice(5)}</span>}
                      {entry.tax_invoice_date&&<span style={{ fontSize:10, color:'#00B894' }}>🧾 {entry.tax_invoice_date.slice(5)}</span>}
                      {entry.unit_price&&<span style={{ fontSize:10, color:'#aaa' }}>단가 {numFmt(entry.unit_price)}원</span>}
                      {entry.memo&&<span style={{ fontSize:10, color:'#aaa' }}>📝 {entry.memo}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign:'right', marginLeft:12, flexShrink:0 }}><div style={{ fontSize:16, fontWeight:800, color:'#1a1a2e' }}>{numFmt(entry.amount)}원</div></div>
                </div>
              </div>
            ))}
          </div>
        )
      })}

      {showModal&&(
        <EntryModal sheet={sheet} entry={editEntry} storeId={storeId} userName={userName} year={year} month={month} favorites={favorites}
          onSave={loadAll} onClose={()=>{ setShowModal(false); setEditEntry(null) }} />
      )}
    </div>
  )
}

// ── 매출 뷰 ────────────────────────────────────────────────
function SalesView({ storeId, year, month }: { storeId:string; year:number; month:number }) {
  const supabase = createSupabaseBrowserClient()
  const [dailySales, setDailySales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(()=>{ loadSales() },[storeId,year,month])
  async function loadSales() {
    setLoading(true)
    const pad=(n:number)=>String(n).padStart(2,'0')
    const from=`${year}-${pad(month)}-01`; const to=`${year}-${pad(month)}-${pad(new Date(year,month,0).getDate())}`
    const { data: cls } = await supabase.from('closings').select('id,closing_date').eq('store_id',storeId).gte('closing_date',from).lte('closing_date',to).order('closing_date',{ascending:false})
    if (!cls?.length) { setDailySales([]); setLoading(false); return }
    const { data: sv } = await supabase.from('closing_sales').select('*').in('closing_id',cls.map((c:any)=>c.id))
    setDailySales(cls.map((cl:any)=>{ const platforms=(sv||[]).filter((s:any)=>s.closing_id===cl.id); return { ...cl, total:platforms.reduce((s:number,p:any)=>s+(p.amount||0),0), platforms } }))
    setLoading(false)
  }
  const monthTotal=dailySales.reduce((s,d)=>s+d.total,0)
  const avgDaily=dailySales.length>0?Math.round(monthTotal/dailySales.length):0
  if (loading) return <div style={{ textAlign:'center', padding:40, color:'#bbb', fontSize:13 }}>불러오는 중...</div>
  return (
    <div>
      <div style={bx}>
        <div style={{ fontSize:11, color:'#aaa', marginBottom:2 }}>{year}년 {month}월 총 매출</div>
        <div style={{ fontSize:26, fontWeight:900, color:'#00B894', marginBottom:4 }}>{numFmt(monthTotal)}원</div>
        <div style={{ display:'flex', gap:12 }}><span style={{ fontSize:11, color:'#bbb' }}>마감 {dailySales.length}일</span>{avgDaily>0&&<span style={{ fontSize:11, color:'#6C5CE7', fontWeight:600 }}>일평균 {numFmt(avgDaily)}원</span>}</div>
      </div>
      {dailySales.length===0?<div style={{ textAlign:'center', padding:'60px 0', color:'#bbb' }}><div style={{ fontSize:36, marginBottom:8 }}>💰</div><div style={{ fontSize:12 }}>마감일지에서 매출 입력 시 자동 표시됩니다</div></div>
      :dailySales.map(day=>{
        const d=new Date(day.closing_date+'T00:00:00'); const dow=['일','월','화','수','목','금','토'][d.getDay()]; const isSun=d.getDay()===0; const isSat=d.getDay()===6
        return (
          <div key={day.id} style={{ background:'#fff', borderRadius:12, border:'1px solid rgba(0,184,148,0.2)', padding:'11px 14px', marginBottom:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:day.platforms.filter((p:any)=>p.amount>0).length>0?8:0 }}>
              <span style={{ fontSize:13, fontWeight:700, color:isSun?'#E84393':isSat?'#2DC6D6':'#1a1a2e' }}>{d.getMonth()+1}월 {d.getDate()}일 ({dow})</span>
              <span style={{ fontSize:16, fontWeight:800, color:'#00B894' }}>{numFmt(day.total)}원</span>
            </div>
            {day.platforms.filter((p:any)=>p.amount>0).length>0&&<div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>{day.platforms.filter((p:any)=>p.amount>0).map((p:any)=><span key={p.id} style={{ fontSize:10, color:'#888', background:'#F4F6F9', padding:'2px 8px', borderRadius:8 }}>{p.platform} {numFmt(p.amount)}원</span>)}</div>}
          </div>
        )
      })}
    </div>
  )
}

// ── 전지점 뷰 ──────────────────────────────────────────────
function AdminView({ profileId, year, month }: { profileId:string; year:number; month:number }) {
  const supabase = createSupabaseBrowserClient()
  const [stores, setStores] = useState<any[]>([])
  const [storeData, setStoreData] = useState<Record<string,any>>({})
  const [loading, setLoading] = useState(true)
  useEffect(()=>{ loadAll() },[profileId,year,month])
  async function loadAll() {
    setLoading(true)
    const { data: members } = await supabase.from('store_members').select('*, stores(*)').eq('profile_id',profileId).eq('active',true)
    const storeList=(members||[]).map((m:any)=>m.stores).filter(Boolean)
    setStores(storeList)
    const pad=(n:number)=>String(n).padStart(2,'0')
    const from=`${year}-${pad(month)}-01`; const to=`${year}-${pad(month)}-${pad(new Date(year,month,0).getDate())}`
    const result: Record<string,any>={}
    await Promise.all(storeList.map(async (store:any)=>{
      const sid=store.id
      const [{ data: cls },{ data: ent },{ data: linked },{ data: sheets },{ data: settings }] = await Promise.all([
        supabase.from('closings').select('id').eq('store_id',sid).gte('closing_date',from).lte('closing_date',to),
        supabase.from('settlement_entries').select('sheet_id,amount').eq('store_id',sid).eq('year',year).eq('month',month),
        supabase.from('orders').select('settlement_sheet_id,settlement_amount').eq('store_id',sid).eq('settlement_year',year).eq('settlement_month',month).not('settlement_sheet_id','is',null),
        supabase.from('settlement_sheets').select('id,name,icon').eq('store_id',sid).eq('is_active',true).eq('sheet_type','expense').order('sort_order'),
        supabase.from('settlement_settings').select('*').eq('store_id',sid).maybeSingle(),
      ])
      let sales=0
      if (cls?.length) { const { data: sv } = await supabase.from('closing_sales').select('amount').in('closing_id',cls.map((c:any)=>c.id)); sales=(sv||[]).reduce((s:number,r:any)=>s+(r.amount||0),0) }
      const sums: Record<string,number>={}
      ;(ent||[]).forEach((e:any)=>{ sums[e.sheet_id]=(sums[e.sheet_id]||0)+(e.amount||0) })
      ;(linked||[]).forEach((o:any)=>{ if(o.settlement_sheet_id&&o.settlement_amount) sums[o.settlement_sheet_id]=(sums[o.settlement_sheet_id]||0)+o.settlement_amount })
      const expense=Object.values(sums).reduce((s:number,v:any)=>s+(v as number),0)
      result[sid]={ sales, expense, sheets:(sheets||[]).map((sh:any)=>({...sh,amount:sums[sh.id]||0})), settings:settings||null }
    }))
    setStoreData(result); setLoading(false)
  }
  async function exportExcel() {
    try {
      const ExcelJS=(await import('exceljs')).default
      const wb=new ExcelJS.Workbook(); const pad=(n:number)=>String(n).padStart(2,'0')
      const ws=wb.addWorksheet(`${year}년${pad(month)}월 요약`)
      ws.addRow(['지점명','총매출','총지출','순수익','수익률(%)'])
      ws.getRow(1).eachCell(cell=>{ cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1A1A2E'}}; cell.font={bold:true,color:{argb:'FFFFFFFF'}}; cell.alignment={horizontal:'center'} })
      stores.forEach((store:any)=>{ const d=storeData[store.id]; if(!d) return; const net=d.sales-d.expense; const rate=d.sales>0?Math.round((net/d.sales)*1000)/10:0; ws.addRow([store.name,d.sales,d.expense,net,rate]) })
      ws.getColumn(2).numFmt='#,##0'; ws.getColumn(3).numFmt='#,##0'; ws.getColumn(4).numFmt='#,##0'; ws.columns.forEach(col=>{col.width=16})
      stores.forEach((store:any)=>{
        const d=storeData[store.id]; if(!d) return
        const wsD=wb.addWorksheet(store.name.slice(0,31))
        wsD.addRow(['항목','금액(원)']); wsD.getRow(1).eachCell(cell=>{ cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF2C3E50'}}; cell.font={bold:true,color:{argb:'FFFFFFFF'}} })
        wsD.addRow(['총 매출',d.sales]); d.sheets.forEach((sh:any)=>wsD.addRow([`${sh.icon} ${sh.name}`,sh.amount])); wsD.addRow(['순수익',d.sales-d.expense])
        wsD.getColumn(2).numFmt='#,##0'; wsD.columns.forEach(col=>{col.width=20})
      })
      const buf=await wb.xlsx.writeBuffer()
      const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
      const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`결산_${year}년${pad(month)}월.xlsx`; a.click(); URL.revokeObjectURL(url)
    } catch(e:any) { alert('내보내기 실패: '+(e?.message||'')) }
  }
  if (loading) return <div style={{ textAlign:'center', padding:48, color:'#bbb', fontSize:13 }}>전 지점 결산 불러오는 중...</div>
  const totSales=stores.reduce((s,st)=>s+(storeData[st.id]?.sales||0),0)
  const totExpense=stores.reduce((s,st)=>s+(storeData[st.id]?.expense||0),0)
  return (
    <div>
      <div style={{ ...bx, border:'1.5px solid rgba(108,92,231,0.3)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:800, color:'#1a1a2e' }}>👑 {year}년 {month}월 전지점 합산</div>
          <button onClick={exportExcel} style={{ padding:'7px 14px', borderRadius:10, background:'rgba(0,184,148,0.1)', border:'1px solid rgba(0,184,148,0.3)', color:'#00B894', fontSize:12, fontWeight:700, cursor:'pointer' }}>📥 엑셀</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          {[{l:'전체 매출',v:totSales,c:'#00B894',bg:'rgba(0,184,148,0.08)'},{l:'전체 지출',v:totExpense,c:'#E84393',bg:'rgba(232,67,147,0.06)'},{l:'전체 순수익',v:totSales-totExpense,c:(totSales-totExpense)>=0?'#00B894':'#E84393',bg:(totSales-totExpense)>=0?'rgba(0,184,148,0.08)':'rgba(232,67,147,0.06)'}].map(item=>(
            <div key={item.l} style={{ padding:'12px 8px', background:item.bg, borderRadius:12, textAlign:'center' }}><div style={{ fontSize:10, color:'#aaa', marginBottom:3 }}>{item.l}</div><div style={{ fontSize:13, fontWeight:800, color:item.c }}>{Math.abs(item.v)>=10000?`${(item.v/10000).toFixed(0)}만`:`${numFmt(item.v)}`}원</div></div>
          ))}
        </div>
      </div>
      {stores.map((store:any)=>{
        const d=storeData[store.id]; if(!d) return null
        const net=d.sales-d.expense; const profR=d.sales>0?Math.round((net/d.sales)*1000)/10:0
        return (
          <div key={store.id} style={{ ...bx, border:`1.5px solid ${net>=0?'rgba(0,184,148,0.3)':'rgba(232,67,147,0.3)'}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <span style={{ fontSize:14, fontWeight:800, color:'#1a1a2e' }}>🏪 {store.name}</span>
              <span style={{ fontSize:13, fontWeight:700, padding:'4px 12px', borderRadius:8, background:net>=0?'rgba(0,184,148,0.12)':'rgba(232,67,147,0.1)', color:net>=0?'#00B894':'#E84393' }}>수익률 {profR}%</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
              {[{l:'매출',v:d.sales,c:'#00B894'},{l:'지출',v:d.expense,c:'#E84393'},{l:'순수익',v:net,c:net>=0?'#00B894':'#E84393'}].map(item=>(
                <div key={item.l} style={{ textAlign:'center', padding:'10px 6px', background:'#F8F9FB', borderRadius:10 }}><div style={{ fontSize:10, color:'#aaa' }}>{item.l}</div><div style={{ fontSize:14, fontWeight:800, color:item.c, marginTop:3 }}>{Math.abs(item.v)>=10000?`${(item.v/10000).toFixed(0)}만`:`${numFmt(item.v)}`}원</div></div>
              ))}
            </div>
            {d.sheets.filter((sh:any)=>sh.amount>0).length>0&&<div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>{d.sheets.filter((sh:any)=>sh.amount>0).slice(0,6).map((sh:any)=><span key={sh.id} style={{ fontSize:10, background:'rgba(255,107,53,0.07)', color:'#FF6B35', padding:'2px 9px', borderRadius:10, fontWeight:600 }}>{sh.icon} {sh.name} {numFmt(sh.amount)}원</span>)}</div>}
          </div>
        )
      })}
    </div>
  )
}

// ════════════════════════════════════════
// 메인 페이지
// ════════════════════════════════════════
export default function SettlementPage() {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState('')
  const [userName, setUserName] = useState('')
  const [userRole, setUserRole] = useState('')
  const [profileId, setProfileId] = useState('')
  const [isPC, setIsPC] = useState(false)
  const [sheets, setSheets] = useState<any[]>([])
  const [settings, setSettings] = useState<any>(null)
  const [selectedSheet, setSelectedSheet] = useState<string>('analysis')
  const [viewMode, setViewMode] = useState<'store'|'all'>('store')
  const [hasPermission, setHasPermission] = useState(false)
  const [permChecked, setPermChecked] = useState(false)
  const [showSheetMgr, setShowSheetMgr] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(true)
  const [unclassifiedCount, setUnclassifiedCount] = useState(0)
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()+1)
  const isOwner = userRole==='owner'

  useEffect(()=>{ const check=()=>setIsPC(window.innerWidth>=768); check(); window.addEventListener('resize',check); return ()=>window.removeEventListener('resize',check) },[])
  useEffect(()=>{
    const store=JSON.parse(localStorage.getItem('mj_store')||'{}')
    const user=JSON.parse(localStorage.getItem('mj_user')||'{}')
    if (!store.id) return
    setStoreId(store.id); setUserName(user.nm||''); setUserRole(user.role||''); setProfileId(user.id||'')
    if (user.role==='owner') { setHasPermission(true); setPermChecked(true); loadSheets(store.id); loadSettings(store.id) }
    else if (user.role==='manager') checkAndLoad(store.id, user.id)
    else { setPermChecked(true); setLoading(false) }
  },[])

  useEffect(()=>{ if(storeId) loadUnclassifiedCount() },[storeId, year, month])

  async function loadUnclassifiedCount() {
    const pad=(n:number)=>String(n).padStart(2,'0')
    const from=`${year}-${pad(month)}-01`
    const to=`${year}-${pad(month)}-${pad(new Date(year,month,0).getDate())}T23:59:59`
    const { count } = await supabase.from('orders').select('*',{count:'exact',head:true}).eq('store_id',storeId).is('settlement_sheet_id',null).not('confirmed_at','is',null).gte('confirmed_at',from).lte('confirmed_at',to)
    setUnclassifiedCount(count||0)
  }

  async function loadSettings(sid:string) { const { data } = await supabase.from('settlement_settings').select('*').eq('store_id',sid).maybeSingle(); setSettings(data) }
  async function checkAndLoad(sid:string, pid:string) {
    const { data } = await supabase.from('settlement_permissions').select('id').eq('store_id',sid).eq('profile_id',pid).maybeSingle()
    setHasPermission(!!data); setPermChecked(true)
    if(data) { loadSheets(sid); loadSettings(sid) } else setLoading(false)
  }
  async function loadSheets(sid:string) {
    const { data } = await supabase.from('settlement_sheets').select('*').eq('store_id',sid).order('sort_order')
    if (!data||data.length===0) { const rows=DEFAULT_SHEETS.map(s=>({...s,store_id:sid})); const { data: inserted } = await supabase.from('settlement_sheets').insert(rows).select(); setSheets(inserted||[]) }
    else setSheets(data)
    setLoading(false)
  }

  const activeSheets=useMemo(()=>sheets.filter(s=>s.is_active),[sheets])
  const currentSheet=activeSheets.find(s=>s.id===selectedSheet)

  if (!permChecked||loading) return <div style={{ minHeight:'60vh', display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ color:'#bbb', fontSize:13 }}>로딩 중...</span></div>

  if (!hasPermission) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px', textAlign:'center' }}>
      <div style={{ fontSize:40, marginBottom:16 }}>🔒</div>
      <div style={{ fontSize:18, fontWeight:800, color:'#1a1a2e', marginBottom:8 }}>접근 권한이 없습니다</div>
      <div style={{ fontSize:13, color:'#aaa', lineHeight:1.7 }}>결산 메뉴는 대표만 사용할 수 있어요.</div>
    </div>
  )

  return (
    <div>
      {showSheetMgr&&<SheetManageModal sheets={sheets} storeId={storeId} onSave={()=>{ setLoading(true); loadSheets(storeId) }} onClose={()=>setShowSheetMgr(false)} />}
      {showSettings&&<SettingsModal storeId={storeId} settings={settings} onSave={(s)=>setSettings(s)} onClose={()=>setShowSettings(false)} />}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <span style={{ fontSize:isPC?20:17, fontWeight:700, color:'#1a1a2e' }}>💹 결산</span>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ fontSize:10, padding:'3px 10px', borderRadius:10, background:isOwner?'rgba(108,92,231,0.1)':'rgba(255,107,53,0.1)', color:isOwner?'#6C5CE7':'#FF6B35', fontWeight:700 }}>{isOwner?'대표':'관리자'}</span>
          {isOwner&&(<>
            <button onClick={()=>setShowSettings(true)} style={{ padding:'6px 12px', borderRadius:9, background:'rgba(108,92,231,0.08)', border:'1px solid rgba(108,92,231,0.2)', color:'#6C5CE7', fontSize:12, cursor:'pointer', fontWeight:600 }}>⚙️ 설정</button>
            <button onClick={()=>setShowSheetMgr(true)} style={{ padding:'6px 12px', borderRadius:9, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', fontSize:12, cursor:'pointer' }}>📂 시트관리</button>
          </>)}
        </div>
      </div>

      {isOwner&&(
        <div style={{ display:'flex', background:'#F4F6F9', borderRadius:12, padding:4, marginBottom:14, gap:3 }}>
          <button onClick={()=>setViewMode('store')} style={{ flex:1, padding:'11px 0', borderRadius:9, border:'none', cursor:'pointer', fontSize:13, fontWeight:viewMode==='store'?700:400, background:viewMode==='store'?'#fff':'transparent', color:viewMode==='store'?'#1a1a2e':'#aaa', boxShadow:viewMode==='store'?'0 1px 6px rgba(0,0,0,0.09)':'none' }}>🏪 내 지점</button>
          <button onClick={()=>setViewMode('all')} style={{ flex:1, padding:'11px 0', borderRadius:9, border:'none', cursor:'pointer', fontSize:13, fontWeight:viewMode==='all'?700:400, background:viewMode==='all'?'linear-gradient(135deg,#6C5CE7,#a29bfe)':'transparent', color:viewMode==='all'?'#fff':'#aaa', boxShadow:viewMode==='all'?'0 2px 8px rgba(108,92,231,0.3)':'none' }}>👑 전지점</button>
        </div>
      )}

      {viewMode==='all'&&isOwner&&(
        <>
          <div style={{ ...bx, padding:'12px 16px', marginBottom:14 }}>
            <YearMonthPicker year={year} month={month-1} onChange={(y:number,m:number)=>{ setYear(y); setMonth(m+1) }} color="#6C5CE7" />
          </div>
          <AdminView profileId={profileId} year={year} month={month} />
        </>
      )}

      {viewMode==='store'&&(
        <>
          {isOwner&&settings&&(
            <div style={{ padding:'8px 14px', background:'rgba(108,92,231,0.05)', borderRadius:10, border:'1px solid rgba(108,92,231,0.15)', marginBottom:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:11, color:'#6C5CE7', fontWeight:600 }}>💳 카드수수료 {settings.card_fee_rate}% · {settings.business_type==='corporation'?'법인':'개인사업자'}</span>
              <button onClick={()=>setShowSettings(true)} style={{ background:'none', border:'none', fontSize:11, color:'#aaa', cursor:'pointer' }}>변경 →</button>
            </div>
          )}
          {isOwner&&!settings&&(
            <div onClick={()=>setShowSettings(true)} style={{ padding:'10px 14px', background:'rgba(255,107,53,0.06)', borderRadius:10, border:'1px dashed rgba(255,107,53,0.3)', marginBottom:12, cursor:'pointer', textAlign:'center', fontSize:12, color:'#FF6B35', fontWeight:600 }}>
              ⚙️ 카드수수료율을 설정해주세요
            </div>
          )}
          <div style={{ ...bx, padding:'12px 16px', marginBottom:14 }}>
            <YearMonthPicker year={year} month={month-1} onChange={(y:number,m:number)=>{ setYear(y); setMonth(m+1) }} color="#FF6B35" />
          </div>

          <div style={{ overflowX:'auto', marginBottom:16, scrollbarWidth:'none' as const }}>
            <div style={{ display:'flex', gap:6, paddingBottom:4, minWidth:'max-content' }}>
              <button onClick={()=>setSelectedSheet('analysis')} style={{ padding:'8px 16px', borderRadius:20, border:selectedSheet==='analysis'?'2px solid #FF6B35':'1px solid #E8ECF0', background:selectedSheet==='analysis'?'rgba(255,107,53,0.1)':'#fff', color:selectedSheet==='analysis'?'#FF6B35':'#888', fontSize:12, fontWeight:selectedSheet==='analysis'?700:500, cursor:'pointer', flexShrink:0 }}>📊 수익분석</button>
              <button onClick={()=>setSelectedSheet('unclassified')} style={{ padding:'8px 14px', borderRadius:20, border:selectedSheet==='unclassified'?'2px solid #E84393':'1px solid #E8ECF0', background:selectedSheet==='unclassified'?'rgba(232,67,147,0.1)':'#fff', color:selectedSheet==='unclassified'?'#E84393':'#888', fontSize:12, fontWeight:selectedSheet==='unclassified'?700:500, cursor:'pointer', flexShrink:0 }}>
                📦 미분류{unclassifiedCount>0&&<span style={{ marginLeft:5, background:'#E84393', color:'#fff', borderRadius:10, fontSize:10, padding:'1px 6px', fontWeight:700 }}>{unclassifiedCount}</span>}
              </button>
              {activeSheets.filter(s=>s.sheet_type==='expense').map(sheet=>(
                <button key={sheet.id} onClick={()=>setSelectedSheet(sheet.id)} style={{ padding:'8px 14px', borderRadius:20, border:selectedSheet===sheet.id?'2px solid #6C5CE7':'1px solid #E8ECF0', background:selectedSheet===sheet.id?'rgba(108,92,231,0.1)':'#fff', color:selectedSheet===sheet.id?'#6C5CE7':'#888', fontSize:12, fontWeight:selectedSheet===sheet.id?700:500, cursor:'pointer', flexShrink:0 }}>
                  {sheet.icon} {sheet.name}
                </button>
              ))}
              <button onClick={()=>setSelectedSheet('sales')} style={{ padding:'8px 14px', borderRadius:20, border:selectedSheet==='sales'?'2px solid #00B894':'1px solid #E8ECF0', background:selectedSheet==='sales'?'rgba(0,184,148,0.1)':'#fff', color:selectedSheet==='sales'?'#00B894':'#888', fontSize:12, fontWeight:selectedSheet==='sales'?700:500, cursor:'pointer', flexShrink:0 }}>💰 매출</button>
            </div>
          </div>

          {selectedSheet==='analysis'&&<ProfitAnalysisView sheets={activeSheets} storeId={storeId} year={year} month={month} settings={settings} />}
          {selectedSheet==='unclassified'&&<UnclassifiedView storeId={storeId} year={year} month={month} sheets={activeSheets} onRefresh={loadUnclassifiedCount} />}
          {selectedSheet==='sales'&&<SalesView storeId={storeId} year={year} month={month} />}
          {currentSheet&&<SheetView sheet={currentSheet} allSheets={activeSheets} storeId={storeId} userName={userName} year={year} month={month} />}
        </>
      )}
    </div>
  )
}