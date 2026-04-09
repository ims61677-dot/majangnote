'use client'
import { useEffect, useState, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import YearMonthPicker from '@/components/YearMonthPicker'

const bx = { background:'#fff', borderRadius:16, border:'1px solid #E8ECF0', padding:16, marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width:'100%', padding:'8px 10px', borderRadius:8, background:'#F8F9FB', border:'1px solid #E0E4E8', color:'#1a1a2e', fontSize:13, outline:'none', boxSizing:'border-box' as const }
const lbl = { fontSize:11, color:'#888', marginBottom:4, display:'block' as const }

function numFmt(n: number) { return n.toLocaleString() }
function pct(v: number, total: number) { if (!total) return 0; return Math.round((v/total)*1000)/10 }

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

// ── 엑셀 ────────────────────────────────────────────────
async function exportSheetExcel(sheet: any, allItems: any[], year: number, month: number) {
  try {
    const ExcelJS = (await import('exceljs')).default
    const pad = (n: number) => String(n).padStart(2,'0')
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet(`${sheet.name}_${year}년${pad(month)}월`)
    ws.addRow(['날짜','품목명','금액','결제방법','수량','단가','단위','배송비','세금계산서','세금계산서발행일','입금일','구매처','메모','묶음ID'])
    ws.getRow(1).eachCell(cell => { cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1A1A2E'}}; cell.font={bold:true,color:{argb:'FFFFFFFF'}} })
    allItems.forEach(item => ws.addRow([item.date,item.itemName||'',item.amount||0,item.paymentMethod||'',item.quantity||'',item.unitPrice||'',item.priceUnit||'',item.deliveryFee||0,item.hasTaxInvoice?'O':'',item.taxInvoiceDate||'',item.depositDate||'',item.supplierName||'',item.memo||'',item.groupId||'']))
    ws.getColumn(3).numFmt='#,##0'; ws.columns.forEach(col=>{col.width=14})
    const buf = await wb.xlsx.writeBuffer()
    const blob = new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
    const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${sheet.icon}${sheet.name}_${year}년${pad(month)}월.xlsx`; a.click(); URL.revokeObjectURL(url)
  } catch(e:any) { alert('엑셀 오류: '+(e?.message||'')) }
}

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
    const netProfit=totalSales-totalExpense; const profitRate=totalSales>0?Math.round((netProfit/totalSales)*1000)/10:0
    wsSummary.addRow(['항목','금액(원)','비고']); wsSummary.getRow(3).eachCell(cell=>{ cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF2C3E50'}}; cell.font={bold:true,color:{argb:'FFFFFFFF'}} })
    wsSummary.addRow(['▶ 총 매출',totalSales,'']); Object.entries(salesByPlatform).forEach(([p,a])=>wsSummary.addRow([`   └ ${p}`,a,'']))
    wsSummary.addRow([]); wsSummary.addRow(['▶ 총 지출',totalExpense,'']); wsSummary.addRow([`   └ 💳 카드수수료 (${cardRate}% 자동)`,cardFeeAuto,'자동계산'])
    expenseSheets.forEach(sh=>{ const amt=(entrySums[sh.id]||0); wsSummary.addRow([`   └ ${sh.icon} ${sh.name}`,amt,amt===0?'미입력':'']) })
    wsSummary.addRow([]); const netRow=wsSummary.addRow(['▶ 순수익',netProfit,`수익률 ${profitRate}%`]); netRow.font={bold:true,size:13,color:{argb:netProfit>=0?'FF00B894':'FFE84393'}}
    wsSummary.getColumn(1).width=32; wsSummary.getColumn(2).numFmt='#,##0'; wsSummary.getColumn(2).width=18; wsSummary.getColumn(3).width=16
    for (const sheet of expenseSheets) {
      const { data: se } = await supabase.from('settlement_entries').select('*').eq('sheet_id',sheet.id).eq('year',year).eq('month',month).order('entry_date')
      const { data: so } = await supabase.from('orders').select('*').eq('settlement_sheet_id',sheet.id).eq('settlement_year',year).eq('settlement_month',month).order('confirmed_at')
      const ws=wb.addWorksheet(`${sheet.icon}${sheet.name}`)
      ws.addRow(['날짜','품목명','금액','결제방법','배송비','세금계산서','세금계산서발행일','묶음'])
      ws.getRow(1).eachCell(cell=>{ cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1A1A2E'}}; cell.font={bold:true,color:{argb:'FFFFFFFF'}} })
      const allI: any[]=[]
      ;(se||[]).forEach((e:any)=>allI.push({ date:e.entry_date, itemName:e.item_name, amount:e.amount, paymentMethod:e.payment_method, deliveryFee:0, hasTaxInvoice:e.has_tax_invoice, taxInvoiceDate:e.tax_invoice_date, groupId:e.group_id }))
      ;(so||[]).forEach((o:any)=>{ const d=new Date(o.confirmed_at||o.ordered_at); allI.push({ date:`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`, itemName:o.item_name, amount:o.settlement_amount, paymentMethod:o.payment_method, deliveryFee:o.delivery_fee, hasTaxInvoice:o.has_tax_invoice, taxInvoiceDate:o.tax_invoice_date, groupId:o.settlement_group_id }) })
      allI.sort((a,b)=>a.date.localeCompare(b.date))
      allI.forEach(item=>ws.addRow([item.date,item.itemName||'',item.amount||0,item.paymentMethod||'',item.deliveryFee||0,item.hasTaxInvoice?'O':'',item.taxInvoiceDate||'',item.groupId?'묶음':'']))
      ws.addRow([]); const total=allI.reduce((s,i)=>s+(i.amount||0),0); const tRow=ws.addRow(['합계','',total]); tRow.font={bold:true}
      ws.getColumn(3).numFmt='#,##0'; ws.columns.forEach(col=>{col.width=14})
    }
    const wsSales=wb.addWorksheet('💰 매출'); wsSales.addRow(['날짜','플랫폼','금액']); wsSales.getRow(1).eachCell(cell=>{ cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF00B894'}}; cell.font={bold:true,color:{argb:'FFFFFFFF'}} })
    if (cls?.length) {
      const { data: cd } = await supabase.from('closings').select('id,closing_date').eq('store_id',storeId).gte('closing_date',from).lte('closing_date',to).order('closing_date')
      const { data: sv } = await supabase.from('closing_sales').select('*').in('closing_id',(cd||[]).map((c:any)=>c.id))
      ;(cd||[]).forEach((cl:any)=>{ const ps=(sv||[]).filter((s:any)=>s.closing_id===cl.id&&s.amount>0); ps.forEach((p:any)=>wsSales.addRow([cl.closing_date,p.platform,p.amount])) })
    }
    wsSales.getColumn(3).numFmt='#,##0'; wsSales.columns.forEach(col=>{col.width=16})
    const buf=await wb.xlsx.writeBuffer(); const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`결산_전체_${year}년${pad(month)}월.xlsx`; a.click(); URL.revokeObjectURL(url)
  } catch(e:any) { alert('엑셀 오류: '+(e?.message||'')) }
}

// ── 발주 수정 모달 ────────────────────────────────────────
function OrderEditModal({ order, onSave, onClose }: { order:any; onSave:()=>void; onClose:()=>void }) {
  const supabase = createSupabaseBrowserClient()
  const [amount, setAmount] = useState<number|''>(order.settlement_amount||'')
  const [unitPrice, setUnitPrice] = useState<number|''>(order.settlement_unit_price||'')
  const [priceUnit, setPriceUnit] = useState(order.price_unit||'ea')
  const [deliveryFee, setDeliveryFee] = useState<number|''>(order.delivery_fee||'')
  const [hasDelivery, setHasDelivery] = useState(!!(order.delivery_fee&&order.delivery_fee>0))
  const [paymentMethod, setPaymentMethod] = useState(order.payment_method||'카드')
  const [taxInv, setTaxInv] = useState(order.has_tax_invoice||false)
  const [taxInvDate, setTaxInvDate] = useState(order.tax_invoice_date||'')
  const [memo, setMemo] = useState(order.memo||'')
  const [saving, setSaving] = useState(false)
  const [units, setUnits] = useState<string[]>(DEFAULT_UNITS)
  const [payMethods, setPayMethods] = useState<string[]>(DEFAULT_PAYMENT_METHODS)
  const [newUnit, setNewUnit] = useState(''); const [newPay, setNewPay] = useState('')

  async function handleSave() {
    if (!amount) { alert('금액을 입력해주세요'); return }
    setSaving(true)
    await supabase.from('orders').update({ settlement_amount:Number(amount), settlement_unit_price:unitPrice?Number(unitPrice):null, price_unit:priceUnit||null, delivery_fee:hasDelivery&&deliveryFee?Number(deliveryFee):null, payment_method:paymentMethod||null, has_tax_invoice:taxInv, tax_invoice_date:taxInv&&taxInvDate?taxInvDate:null, memo:memo.trim()||null }).eq('id',order.id)
    setSaving(false); onSave(); onClose()
  }
  const d=new Date(order.confirmed_at||order.ordered_at)
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:400, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:520, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'92vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>📦 발주 수정</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ padding:'10px 14px', background:'rgba(0,184,148,0.06)', borderRadius:10, border:'1px solid rgba(0,184,148,0.2)', marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:700, color:'#1a1a2e', marginBottom:4 }}>{order.item_name}</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
            <span style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:'#F4F6F9', color:'#666' }}>📅 {d.getMonth()+1}월 {d.getDate()}일</span>
            <span style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:'#F4F6F9', color:'#666' }}>📦 {order.quantity}{order.unit}</span>
            {order.supplier_name&&<span style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:'rgba(0,184,148,0.08)', color:'#00B894' }}>🏪 {order.supplier_name}</span>}
          </div>
        </div>
        <div style={{ marginBottom:12 }}>
          <span style={lbl}>결제 금액 *</span>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}><input type="number" value={amount} onChange={e=>setAmount(e.target.value===''?'':Number(e.target.value))} placeholder="0" style={inp} /><span style={{ fontSize:11, color:'#aaa', flexShrink:0 }}>원</span></div>
          {Number(amount)>0&&<div style={{ fontSize:11, color:'#FF6B35', marginTop:3, fontWeight:600 }}>{numFmt(Number(amount))}원</div>}
        </div>
        <div style={{ marginBottom:12 }}>
          <span style={lbl}>단가 (통계용)</span>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:6, marginBottom:6 }}>
            <input type="number" value={unitPrice} onChange={e=>setUnitPrice(e.target.value===''?'':Number(e.target.value))} placeholder="개당 가격" style={inp} />
            <select value={priceUnit} onChange={e=>setPriceUnit(e.target.value)} style={{ ...inp, width:'auto', minWidth:70 }}>{units.map(u=><option key={u} value={u}>{u}</option>)}</select>
          </div>
          <div style={{ display:'flex', gap:4 }}>
            <input value={newUnit} onChange={e=>setNewUnit(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&newUnit.trim()&&!units.includes(newUnit.trim())) { setUnits(p=>[...p,newUnit.trim()]); setNewUnit('') }}} placeholder="단위 추가" style={{ ...inp, flex:1, fontSize:12, padding:'5px 8px' }} />
            <button onClick={()=>{ if(newUnit.trim()&&!units.includes(newUnit.trim())) { setUnits(p=>[...p,newUnit.trim()]); setNewUnit('') }}} style={{ padding:'5px 12px', borderRadius:8, background:'rgba(108,92,231,0.1)', border:'1px solid rgba(108,92,231,0.2)', color:'#6C5CE7', fontSize:12, cursor:'pointer' }}>+ 추가</button>
          </div>
        </div>
        <div style={{ marginBottom:12 }}>
          <span style={lbl}>배송비</span>
          <div style={{ display:'flex', gap:6, marginBottom:hasDelivery?8:0 }}>
            <button onClick={()=>setHasDelivery(false)} style={{ flex:1, padding:'9px 0', borderRadius:8, border:!hasDelivery?'2px solid #6C5CE7':'1px solid #E8ECF0', background:!hasDelivery?'rgba(108,92,231,0.1)':'#F8F9FB', color:!hasDelivery?'#6C5CE7':'#888', fontSize:13, fontWeight:!hasDelivery?700:400, cursor:'pointer' }}>없음</button>
            <button onClick={()=>setHasDelivery(true)} style={{ flex:1, padding:'9px 0', borderRadius:8, border:hasDelivery?'2px solid #FF6B35':'1px solid #E8ECF0', background:hasDelivery?'rgba(255,107,53,0.1)':'#F8F9FB', color:hasDelivery?'#FF6B35':'#888', fontSize:13, fontWeight:hasDelivery?700:400, cursor:'pointer' }}>있음</button>
          </div>
          {hasDelivery&&<div style={{ display:'flex', alignItems:'center', gap:4 }}><input type="number" value={deliveryFee} onChange={e=>setDeliveryFee(e.target.value===''?'':Number(e.target.value))} placeholder="배송비 금액" style={inp} /><span style={{ fontSize:11, color:'#aaa', flexShrink:0 }}>원</span></div>}
        </div>
        <div style={{ marginBottom:12 }}>
          <span style={lbl}>결제방법</span>
          <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:6 }}>
            {payMethods.map(m=><button key={m} onClick={()=>setPaymentMethod(m)} style={{ padding:'6px 12px', borderRadius:8, border:paymentMethod===m?`2px solid ${PAYMENT_COLORS[m]||'#6C5CE7'}`:'1px solid #E8ECF0', background:paymentMethod===m?`${PAYMENT_COLORS[m]||'#6C5CE7'}18`:'#F8F9FB', color:paymentMethod===m?PAYMENT_COLORS[m]||'#6C5CE7':'#888', fontSize:12, fontWeight:paymentMethod===m?700:400, cursor:'pointer' }}>{m}</button>)}
          </div>
          <div style={{ display:'flex', gap:4 }}>
            <input value={newPay} onChange={e=>setNewPay(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&newPay.trim()&&!payMethods.includes(newPay.trim())) { setPayMethods(p=>[...p,newPay.trim()]); setNewPay('') }}} placeholder="결제방법 추가" style={{ ...inp, flex:1, fontSize:12, padding:'5px 8px' }} />
            <button onClick={()=>{ if(newPay.trim()&&!payMethods.includes(newPay.trim())) { setPayMethods(p=>[...p,newPay.trim()]); setNewPay('') }}} style={{ padding:'5px 12px', borderRadius:8, background:'rgba(108,92,231,0.1)', border:'1px solid rgba(108,92,231,0.2)', color:'#6C5CE7', fontSize:12, cursor:'pointer' }}>+ 추가</button>
          </div>
        </div>
        <div style={{ marginBottom:12 }}>
          <span style={lbl}>세금계산서</span>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <button onClick={()=>setTaxInv((v:boolean)=>!v)} style={{ flex:1, padding:'9px 0', borderRadius:8, border:taxInv?'2px solid #00B894':'1px solid #E8ECF0', background:taxInv?'rgba(0,184,148,0.1)':'#F8F9FB', color:taxInv?'#00B894':'#aaa', fontSize:13, fontWeight:taxInv?700:400, cursor:'pointer' }}>{taxInv?'✅ 발행됨':'⬜ 미발행'}</button>
            {taxInv&&<input type="date" value={taxInvDate} onChange={e=>setTaxInvDate(e.target.value)} style={{ ...inp, flex:1 }} />}
          </div>
        </div>
        <div style={{ marginBottom:16 }}><span style={lbl}>메모</span><input value={memo} onChange={e=>setMemo(e.target.value)} placeholder="메모" style={inp} /></div>
        <button onClick={handleSave} disabled={saving||!amount} style={{ width:'100%', padding:'13px 0', borderRadius:12, background:amount?'linear-gradient(135deg,#FF6B35,#E84393)':'#E8ECF0', border:'none', color:amount?'#fff':'#aaa', fontSize:14, fontWeight:700, cursor:amount?'pointer':'default' }}>{saving?'저장 중...':'수정 저장'}</button>
      </div>
    </div>
  )
}

// ── 미분류 탭 ─────────────────────────────────────────────
function UnclassifiedView({ storeId, year, month, sheets, onRefresh }: { storeId:string; year:number; month:number; sheets:any[]; onRefresh:()=>void }) {
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
  const [globalPayMethods, setGlobalPayMethods] = useState<string[]>(DEFAULT_PAYMENT_METHODS)
  const [globalUnits, setGlobalUnits] = useState<string[]>(DEFAULT_UNITS)
  const [newPayMethod, setNewPayMethod] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const [showMgr, setShowMgr] = useState(false)
  const expenseSheets = sheets.filter(s=>s.sheet_type==='expense'&&s.is_active)

  useEffect(()=>{ loadOrders() },[storeId,year,month])
  async function loadOrders() {
    setLoading(true)
    const pad=(n:number)=>String(n).padStart(2,'0')
    const from=`${year}-${pad(month)}-01`; const to=`${year}-${pad(month)}-${pad(new Date(year,month,0).getDate())}T23:59:59`
    const { data } = await supabase.from('orders').select('*').eq('store_id',storeId).is('settlement_sheet_id',null).not('confirmed_at','is',null).gte('confirmed_at',from).lte('confirmed_at',to).order('confirmed_at',{ascending:false})
    setOrders(data||[]); setLoading(false)
  }
  async function classifyOrder(orderId:string) {
    const sheetId=sheetIds[orderId]; const amount=amounts[orderId]
    if (!sheetId) { alert('분류할 시트를 선택해주세요'); return }
    if (!amount) { alert('금액을 입력해주세요'); return }
    setSaving(p=>({...p,[orderId]:true}))
    await supabase.from('orders').update({ settlement_sheet_id:sheetId, settlement_amount:Number(amount), settlement_unit_price:unitPrices[orderId]?Number(unitPrices[orderId]):null, price_unit:priceUnits[orderId]||null, delivery_fee:hasDelivery[orderId]&&deliveryFees[orderId]?Number(deliveryFees[orderId]):null, payment_method:payMethods[orderId]||null, settlement_classified_at:new Date().toISOString(), settlement_year:year, settlement_month:month }).eq('id',orderId)
    setSaving(p=>({...p,[orderId]:false})); setOrders(prev=>prev.filter(o=>o.id!==orderId)); onRefresh()
  }
  async function classifyAll() {
    const ready=orders.filter(o=>sheetIds[o.id]&&amounts[o.id])
    if (ready.length===0) { alert('시트와 금액을 입력한 항목이 없어요'); return }
    if (!confirm(`${ready.length}건을 한번에 분류할까요?`)) return
    await Promise.all(ready.map(o=>supabase.from('orders').update({ settlement_sheet_id:sheetIds[o.id], settlement_amount:Number(amounts[o.id]), settlement_unit_price:unitPrices[o.id]?Number(unitPrices[o.id]):null, price_unit:priceUnits[o.id]||null, delivery_fee:hasDelivery[o.id]&&deliveryFees[o.id]?Number(deliveryFees[o.id]):null, payment_method:payMethods[o.id]||null, settlement_classified_at:new Date().toISOString(), settlement_year:year, settlement_month:month }).eq('id',o.id)))
    setOrders(prev=>prev.filter(o=>!ready.find(r=>r.id===o.id))); onRefresh()
  }

  if (loading) return <div style={{ textAlign:'center', padding:48, color:'#bbb', fontSize:13 }}>불러오는 중...</div>
  if (orders.length===0) return <div style={{ textAlign:'center', padding:'64px 20px' }}><div style={{ fontSize:44, marginBottom:12 }}>🎉</div><div style={{ fontSize:16, fontWeight:700, color:'#ccc', marginBottom:6 }}>미분류 발주가 없어요!</div><div style={{ fontSize:12, color:'#ddd' }}>{year}년 {month}월 미분류 발주가 없거나 모두 분류됐어요</div></div>

  const readyCount=orders.filter(o=>sheetIds[o.id]&&amounts[o.id]).length
  return (
    <div>
      <div style={{ padding:'12px 14px', background:'rgba(108,92,231,0.06)', borderRadius:12, border:'1px solid rgba(108,92,231,0.2)', marginBottom:14 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#6C5CE7', marginBottom:4 }}>📦 {year}년 {month}월 발주 결산 분류</div>
        <div style={{ fontSize:11, color:'#888' }}>{month}월 미분류 발주 {orders.length}건이 있어요.</div>
      </div>
      <button onClick={()=>setShowMgr(v=>!v)} style={{ padding:'7px 14px', borderRadius:9, background:'rgba(108,92,231,0.08)', border:'1px solid rgba(108,92,231,0.2)', color:'#6C5CE7', fontSize:11, fontWeight:600, cursor:'pointer', marginBottom:12 }}>⚙️ 결제방법/단위 관리</button>
      {showMgr&&(
        <div style={{ ...bx, border:'1px solid rgba(108,92,231,0.2)', marginBottom:12 }}>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#6C5CE7', marginBottom:8 }}>💳 결제방법</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>{globalPayMethods.map(m=><span key={m} style={{ display:'flex', alignItems:'center', gap:3, padding:'4px 10px', borderRadius:20, background:'rgba(108,92,231,0.1)', border:'1px solid rgba(108,92,231,0.2)', fontSize:12, color:'#6C5CE7' }}>{m}{!DEFAULT_PAYMENT_METHODS.includes(m)&&<button onClick={()=>setGlobalPayMethods(p=>p.filter(x=>x!==m))} style={{ background:'none', border:'none', cursor:'pointer', color:'#E84393', fontSize:12, padding:0 }}>✕</button>}</span>)}</div>
            <div style={{ display:'flex', gap:4 }}><input value={newPayMethod} onChange={e=>setNewPayMethod(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&newPayMethod.trim()&&!globalPayMethods.includes(newPayMethod.trim())) { setGlobalPayMethods(p=>[...p,newPayMethod.trim()]); setNewPayMethod('') }}} placeholder="추가" style={{ ...inp, flex:1, fontSize:12 }} /><button onClick={()=>{ if(newPayMethod.trim()&&!globalPayMethods.includes(newPayMethod.trim())) { setGlobalPayMethods(p=>[...p,newPayMethod.trim()]); setNewPayMethod('') }}} style={{ padding:'8px 14px', borderRadius:8, background:'linear-gradient(135deg,#6C5CE7,#a29bfe)', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>추가</button></div>
          </div>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#2DC6D6', marginBottom:8 }}>📐 단위</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>{globalUnits.map(u=><span key={u} style={{ display:'flex', alignItems:'center', gap:3, padding:'4px 10px', borderRadius:20, background:'rgba(45,198,214,0.1)', border:'1px solid rgba(45,198,214,0.2)', fontSize:12, color:'#2DC6D6' }}>{u}{!DEFAULT_UNITS.slice(0,4).includes(u)&&<button onClick={()=>setGlobalUnits(p=>p.filter(x=>x!==u))} style={{ background:'none', border:'none', cursor:'pointer', color:'#E84393', fontSize:12, padding:0 }}>✕</button>}</span>)}</div>
            <div style={{ display:'flex', gap:4 }}><input value={newUnit} onChange={e=>setNewUnit(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'&&newUnit.trim()&&!globalUnits.includes(newUnit.trim())) { setGlobalUnits(p=>[...p,newUnit.trim()]); setNewUnit('') }}} placeholder="추가" style={{ ...inp, flex:1, fontSize:12 }} /><button onClick={()=>{ if(newUnit.trim()&&!globalUnits.includes(newUnit.trim())) { setGlobalUnits(p=>[...p,newUnit.trim()]); setNewUnit('') }}} style={{ padding:'8px 14px', borderRadius:8, background:'linear-gradient(135deg,#2DC6D6,#6C5CE7)', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>추가</button></div>
          </div>
        </div>
      )}
      {readyCount>0&&<button onClick={classifyAll} style={{ width:'100%', padding:'12px 0', borderRadius:12, background:'linear-gradient(135deg,#6C5CE7,#a29bfe)', border:'none', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', marginBottom:14 }}>✅ 입력된 {readyCount}건 한번에 분류</button>}
      {orders.map(order=>{
        const d=new Date(order.confirmed_at||order.ordered_at)
        const selectedSheet=expenseSheets.find(s=>s.id===sheetIds[order.id])
        const isReady=!!(sheetIds[order.id]&&amounts[order.id])
        return (
          <div key={order.id} style={{ ...bx, border:isReady?'1.5px solid rgba(108,92,231,0.35)':'1px solid #E8ECF0', background:isReady?'rgba(108,92,231,0.02)':'#fff' }}>
            <div style={{ marginBottom:12 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                <span style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>{order.item_name}</span>
                <span style={{ fontSize:14, fontWeight:700, color:'#888', flexShrink:0 }}>{order.quantity}{order.unit}</span>
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                <span style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:'#F4F6F9', color:'#666' }}>📅 {d.getMonth()+1}월 {d.getDate()}일</span>
                {order.supplier_name&&<span style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:'rgba(0,184,148,0.08)', color:'#00B894' }}>🏪 {order.supplier_name}</span>}
                {order.ordered_by&&<span style={{ fontSize:10, padding:'2px 8px', borderRadius:8, background:'rgba(108,92,231,0.07)', color:'#6C5CE7' }}>👤 {order.ordered_by}</span>}
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <span style={lbl}>시트 선택 *</span>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>{expenseSheets.map(sheet=><button key={sheet.id} onClick={()=>setSheetIds(p=>({...p,[order.id]:sheet.id}))} style={{ padding:'6px 11px', borderRadius:20, border:sheetIds[order.id]===sheet.id?'2px solid #6C5CE7':'1px solid #E8ECF0', background:sheetIds[order.id]===sheet.id?'rgba(108,92,231,0.1)':'#F8F9FB', color:sheetIds[order.id]===sheet.id?'#6C5CE7':'#888', fontSize:11, fontWeight:sheetIds[order.id]===sheet.id?700:400, cursor:'pointer' }}>{sheet.icon} {sheet.name}</button>)}</div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
              <div>
                <span style={lbl}>결제 금액 * (원)</span>
                <input type="number" placeholder="실제 결제 금액" value={amounts[order.id]??''} onChange={e=>setAmounts(p=>({...p,[order.id]:e.target.value===''?'':Number(e.target.value)}))} style={inp} />
                {(amounts[order.id]||0)>0&&<div style={{ fontSize:10, color:'#6C5CE7', marginTop:3, fontWeight:600 }}>{numFmt(Number(amounts[order.id]))}원</div>}
              </div>
              <div>
                <span style={lbl}>단가 (통계용)</span>
                <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:4 }}>
                  <input type="number" placeholder="개당 가격" value={unitPrices[order.id]??''} onChange={e=>setUnitPrices(p=>({...p,[order.id]:e.target.value===''?'':Number(e.target.value)}))} style={inp} />
                  <select value={priceUnits[order.id]||'ea'} onChange={e=>setPriceUnits(p=>({...p,[order.id]:e.target.value}))} style={{ ...inp, width:'auto', minWidth:56, fontSize:12 }}>{globalUnits.map(u=><option key={u} value={u}>{u}</option>)}</select>
                </div>
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <span style={lbl}>배송비</span>
              <div style={{ display:'flex', gap:6, marginBottom:hasDelivery[order.id]?6:0 }}>
                <button onClick={()=>setHasDelivery(p=>({...p,[order.id]:false}))} style={{ flex:1, padding:'7px 0', borderRadius:8, border:!hasDelivery[order.id]?'2px solid #6C5CE7':'1px solid #E8ECF0', background:!hasDelivery[order.id]?'rgba(108,92,231,0.1)':'#F8F9FB', color:!hasDelivery[order.id]?'#6C5CE7':'#888', fontSize:12, fontWeight:!hasDelivery[order.id]?700:400, cursor:'pointer' }}>없음</button>
                <button onClick={()=>setHasDelivery(p=>({...p,[order.id]:true}))} style={{ flex:1, padding:'7px 0', borderRadius:8, border:hasDelivery[order.id]?'2px solid #FF6B35':'1px solid #E8ECF0', background:hasDelivery[order.id]?'rgba(255,107,53,0.1)':'#F8F9FB', color:hasDelivery[order.id]?'#FF6B35':'#888', fontSize:12, fontWeight:hasDelivery[order.id]?700:400, cursor:'pointer' }}>있음</button>
              </div>
              {hasDelivery[order.id]&&<div style={{ display:'flex', alignItems:'center', gap:4 }}><input type="number" placeholder="배송비 금액" value={deliveryFees[order.id]??''} onChange={e=>setDeliveryFees(p=>({...p,[order.id]:e.target.value===''?'':Number(e.target.value)}))} style={inp} /><span style={{ fontSize:11, color:'#aaa', flexShrink:0 }}>원</span></div>}
            </div>
            <div style={{ marginBottom:12 }}>
              <span style={lbl}>결제방법</span>
              <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>{globalPayMethods.map(m=><button key={m} onClick={()=>setPayMethods(p=>({...p,[order.id]:m}))} style={{ padding:'5px 10px', borderRadius:8, border:payMethods[order.id]===m?`2px solid ${PAYMENT_COLORS[m]||'#6C5CE7'}`:'1px solid #E8ECF0', background:payMethods[order.id]===m?`${PAYMENT_COLORS[m]||'#6C5CE7'}18`:'#F8F9FB', color:payMethods[order.id]===m?PAYMENT_COLORS[m]||'#6C5CE7':'#888', fontSize:11, fontWeight:payMethods[order.id]===m?700:400, cursor:'pointer' }}>{m}</button>)}</div>
            </div>
            <button onClick={()=>classifyOrder(order.id)} disabled={saving[order.id]||!isReady} style={{ width:'100%', padding:'11px 0', borderRadius:11, background:isReady?'linear-gradient(135deg,#6C5CE7,#a29bfe)':'#F0F2F5', border:'none', color:isReady?'#fff':'#bbb', fontSize:13, fontWeight:700, cursor:isReady?'pointer':'default' }}>
              {saving[order.id]?'분류 중...':isReady?`✅ ${selectedSheet?.icon} ${selectedSheet?.name}으로 분류`:'시트와 금액을 입력해주세요'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── 설정 모달 ─────────────────────────────────────────────
function SettingsModal({ storeId, settings, onSave, onClose }: { storeId:string; settings:any; onSave:(s:any)=>void; onClose:()=>void }) {
  const supabase = createSupabaseBrowserClient()
  const [tab, setTab] = useState<'settings'|'permissions'>('settings')
  const [bizType, setBizType] = useState(settings?.business_type||'individual')
  const [cardRate, setCardRate] = useState<number|''>(settings?.card_fee_rate??1.1)
  const [saving, setSaving] = useState(false)
  const [members, setMembers] = useState<any[]>([])
  const [permissions, setPermissions] = useState<any[]>([])
  const [loadingPerms, setLoadingPerms] = useState(true)
  useEffect(()=>{ if(tab==='permissions') loadPermissions() },[tab])
  async function loadPermissions() { setLoadingPerms(true); const [{ data: mems },{ data: perms }] = await Promise.all([supabase.from('store_members').select('*, profiles(*)').eq('store_id',storeId).eq('active',true).neq('role','owner'),supabase.from('settlement_permissions').select('*').eq('store_id',storeId)]); setMembers(mems||[]); setPermissions(perms||[]); setLoadingPerms(false) }
  async function handleSaveSettings() { if (!cardRate) return; setSaving(true); const data={store_id:storeId, business_type:bizType, card_fee_rate:Number(cardRate)}; if (settings?.id) await supabase.from('settlement_settings').update(data).eq('id',settings.id); else await supabase.from('settlement_settings').insert(data); const { data: updated } = await supabase.from('settlement_settings').select('*').eq('store_id',storeId).maybeSingle(); setSaving(false); onSave(updated); onClose() }
  async function togglePermission(member:any) { const existing=permissions.find(p=>p.profile_id===member.profile_id); if (existing) { await supabase.from('settlement_permissions').delete().eq('id',existing.id); setPermissions(prev=>prev.filter(p=>p.id!==existing.id)) } else { const { data } = await supabase.from('settlement_permissions').insert({ store_id:storeId, profile_id:member.profile_id, granted_by:storeId }).select().single(); if(data) setPermissions(prev=>[...prev,data]) } }
  const GUIDE=[{label:'개인사업자 (연매출 3억 이하)',rate:0.5},{label:'개인사업자 (연매출 3~5억)',rate:1.1},{label:'개인사업자 (5억 초과)',rate:1.5},{label:'법인',rate:2.0}]
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'88vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}><span style={{ fontSize:15, fontWeight:700 }}>⚙️ 결산 설정</span><button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button></div>
        <div style={{ display:'flex', background:'#F4F6F9', borderRadius:10, padding:3, marginBottom:20, gap:2 }}>{[{key:'settings',label:'💳 카드수수료'},{key:'permissions',label:'👥 관리자 권한'}].map(t=><button key={t.key} onClick={()=>setTab(t.key as any)} style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:tab===t.key?700:400, background:tab===t.key?'#fff':'transparent', color:tab===t.key?'#1a1a2e':'#aaa', boxShadow:tab===t.key?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>{t.label}</button>)}</div>
        {tab==='settings'&&<div>
          <div style={{ marginBottom:16 }}><span style={lbl}>사업자 유형</span><div style={{ display:'flex', gap:8 }}>{[{key:'individual',label:'👤 개인사업자'},{key:'corporation',label:'🏢 법인'}].map(b=><button key={b.key} onClick={()=>setBizType(b.key)} style={{ flex:1, padding:'10px 0', borderRadius:10, border:bizType===b.key?'2px solid #6C5CE7':'1px solid #E8ECF0', background:bizType===b.key?'rgba(108,92,231,0.1)':'#F8F9FB', color:bizType===b.key?'#6C5CE7':'#888', fontSize:13, fontWeight:bizType===b.key?700:400, cursor:'pointer' }}>{b.label}</button>)}</div></div>
          <div style={{ marginBottom:8 }}><span style={lbl}>카드 수수료율 (%)</span><div style={{ display:'flex', alignItems:'center', gap:8 }}><input type="number" step="0.1" min="0" max="5" value={cardRate} onChange={e=>setCardRate(e.target.value===''?'':Number(e.target.value))} style={{ ...inp, flex:1, fontSize:20, fontWeight:700, textAlign:'center' as const }} /><span style={{ fontSize:14, color:'#888' }}>%</span></div></div>
          <div style={{ background:'rgba(108,92,231,0.05)', borderRadius:12, padding:14, marginBottom:20 }}><div style={{ fontSize:11, fontWeight:700, color:'#6C5CE7', marginBottom:10 }}>💡 참고표</div>{GUIDE.map(g=><div key={g.label} onClick={()=>setCardRate(g.rate)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 12px', borderRadius:9, marginBottom:4, cursor:'pointer', background:cardRate===g.rate?'rgba(108,92,231,0.12)':'transparent', border:cardRate===g.rate?'1px solid rgba(108,92,231,0.3)':'1px solid transparent' }}><span style={{ fontSize:12, color:cardRate===g.rate?'#6C5CE7':'#555', fontWeight:cardRate===g.rate?700:400 }}>{g.label}</span><span style={{ fontSize:14, fontWeight:800, color:cardRate===g.rate?'#6C5CE7':'#888' }}>{g.rate}%</span></div>)}</div>
          <button onClick={handleSaveSettings} disabled={saving||!cardRate} style={{ width:'100%', padding:'13px 0', borderRadius:12, background:cardRate?'linear-gradient(135deg,#6C5CE7,#a29bfe)':'#E8ECF0', border:'none', color:cardRate?'#fff':'#aaa', fontSize:14, fontWeight:700, cursor:cardRate?'pointer':'default' }}>{saving?'저장 중...':'설정 저장'}</button>
        </div>}
        {tab==='permissions'&&<div>
          <div style={{ padding:'10px 14px', background:'rgba(255,107,53,0.06)', borderRadius:10, border:'1px solid rgba(255,107,53,0.2)', marginBottom:16, fontSize:12, color:'#FF6B35' }}>💡 결산 메뉴는 기본적으로 대표만 볼 수 있어요.</div>
          {loadingPerms?<div style={{ textAlign:'center', padding:32, color:'#bbb' }}>불러오는 중...</div>:members.length===0?<div style={{ textAlign:'center', padding:32, color:'#bbb' }}><div style={{ fontSize:32, marginBottom:8 }}>👥</div>등록된 직원이 없어요</div>:members.map(member=>{ const hasPermi=permissions.some(p=>p.profile_id===member.profile_id); const name=member.profiles?.name||member.profiles?.nm||'이름없음'; return <div key={member.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', background:hasPermi?'rgba(0,184,148,0.05)':'#F8F9FB', borderRadius:12, marginBottom:8, border:`1px solid ${hasPermi?'rgba(0,184,148,0.25)':'#E8ECF0'}` }}><div style={{ display:'flex', alignItems:'center', gap:10 }}><div style={{ width:38, height:38, borderRadius:10, background:hasPermi?'linear-gradient(135deg,#00B894,#2DC6D6)':'#E8ECF0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, color:hasPermi?'#fff':'#aaa' }}>{name.charAt(0)}</div><div><div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{name}</div><div style={{ fontSize:10, color:'#aaa' }}>{member.role==='manager'?'관리자':'사원'} {hasPermi&&<span style={{ color:'#00B894', fontWeight:700 }}>· 결산 열람 가능</span>}</div></div></div><button onClick={()=>togglePermission(member)} style={{ padding:'8px 16px', borderRadius:10, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, background:hasPermi?'linear-gradient(135deg,#00B894,#2DC6D6)':'#F4F6F9', color:hasPermi?'#fff':'#888', minWidth:80 }}>{hasPermi?'✅ 허용됨':'권한 부여'}</button></div> })}
        </div>}
      </div>
    </div>
  )
}

// ── 항목 추가/수정 모달 ───────────────────────────────────
function EntryModal({ sheet, entry, storeId, userName, year, month, onSave, onClose }: { sheet:any; entry:any|null; storeId:string; userName:string; year:number; month:number; onSave:()=>void; onClose:()=>void }) {
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
    const data:any={ sheet_id:sheet.id, store_id:storeId, year, month, entry_date:date, item_name:itemName.trim()||null, amount:Number(amount), payment_method:payment, has_tax_invoice:taxInv, tax_invoice_date:taxInv&&taxInvDate?taxInvDate:null, memo:memo.trim()||null, created_by:userName, updated_at:new Date().toISOString(), deposit_date:depositDate||null, quantity:qty||null, unit_price:unitPrice||null }
    if (entry?.id) await supabase.from('settlement_entries').update(data).eq('id',entry.id)
    else await supabase.from('settlement_entries').insert(data)
    setSaving(false); onSave(); onClose()
  }
  async function handleDelete() { if (!entry?.id||!confirm('삭제할까요?')) return; await supabase.from('settlement_entries').delete().eq('id',entry.id); onSave(); onClose() }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'92vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}><span style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>{sheet.icon} {entry?'항목 수정':'항목 추가'} — {sheet.name}</span><button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button></div>
        <div style={{ marginBottom:10 }}><span style={lbl}>날짜</span><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inp} /></div>
        <div style={{ marginBottom:10 }}><span style={lbl}>품목명 (선택)</span><input value={itemName} onChange={e=>setItemName(e.target.value)} placeholder={`예: ${sheet.name} 구매`} style={inp} /></div>
        <div style={{ marginBottom:10 }}><span style={lbl}>금액 *</span><div style={{ display:'flex', alignItems:'center', gap:4 }}><input type="number" value={amount} onChange={e=>setAmount(e.target.value===''?'':Number(e.target.value))} placeholder="0" style={inp} /><span style={{ fontSize:11, color:'#aaa', flexShrink:0 }}>원</span></div>{Number(amount)>0&&<div style={{ fontSize:11, color:'#FF6B35', marginTop:3, fontWeight:600 }}>{numFmt(Number(amount))}원</div>}</div>
        <div style={{ marginBottom:10 }}><span style={lbl}>결제방법</span><div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>{DEFAULT_PAYMENT_METHODS.map(m=><button key={m} onClick={()=>setPayment(m)} style={{ padding:'6px 12px', borderRadius:8, border:payment===m?`2px solid ${PAYMENT_COLORS[m]||'#6C5CE7'}`:'1px solid #E8ECF0', background:payment===m?`${PAYMENT_COLORS[m]||'#6C5CE7'}18`:'#F8F9FB', color:payment===m?PAYMENT_COLORS[m]||'#6C5CE7':'#888', fontSize:12, fontWeight:payment===m?700:400, cursor:'pointer' }}>{m}</button>)}</div></div>
        <div style={{ marginBottom:10 }}><span style={lbl}>세금계산서</span><div style={{ display:'flex', gap:8, alignItems:'center' }}><button onClick={()=>setTaxInv((v:boolean)=>!v)} style={{ flex:1, padding:'9px 0', borderRadius:8, border:taxInv?'2px solid #00B894':'1px solid #E8ECF0', background:taxInv?'rgba(0,184,148,0.1)':'#F8F9FB', color:taxInv?'#00B894':'#aaa', fontSize:13, fontWeight:taxInv?700:400, cursor:'pointer' }}>{taxInv?'✅ 발행됨':'⬜ 미발행'}</button>{taxInv&&<input type="date" value={taxInvDate} onChange={e=>setTaxInvDate(e.target.value)} style={{ ...inp, flex:1 }} />}</div></div>
        <button onClick={()=>setShowExtra(v=>!v)} style={{ width:'100%', padding:'9px 0', borderRadius:10, border:'1px dashed #E8ECF0', background:'transparent', color:'#aaa', fontSize:12, cursor:'pointer', marginBottom:showExtra?10:16 }}>{showExtra?'▲ 상세정보 닫기':'▼ 상세정보 (입금일 · 수량 · 단가)'}</button>
        {showExtra&&<div style={{ background:'rgba(108,92,231,0.04)', borderRadius:12, padding:14, marginBottom:14, border:'1px solid rgba(108,92,231,0.12)' }}><div style={{ fontSize:11, fontWeight:700, color:'#6C5CE7', marginBottom:12 }}>📋 상세 정보 (법인세 관리용)</div><div style={{ marginBottom:10 }}><span style={lbl}>입금일</span><input type="date" value={depositDate} onChange={e=>setDepositDate(e.target.value)} style={inp} /></div><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}><div><span style={lbl}>수량</span><input type="number" step="0.1" value={qty} onChange={e=>setQty(e.target.value===''?'':Number(e.target.value))} placeholder="0" style={inp} /></div><div><span style={lbl}>단가 (원)</span><input type="number" value={unitPrice} onChange={e=>setUnitPrice(e.target.value===''?'':Number(e.target.value))} placeholder="0" style={inp} /></div></div>{qty&&unitPrice&&<div style={{ fontSize:10, color:'#6C5CE7', marginTop:6, fontWeight:600 }}>수량×단가 = {numFmt(Math.round(Number(qty)*Number(unitPrice)))}원</div>}</div>}
        <div style={{ marginBottom:16 }}><span style={lbl}>메모 (선택)</span><input value={memo} onChange={e=>setMemo(e.target.value)} placeholder="메모" style={inp} /></div>
        <div style={{ display:'flex', gap:8 }}>
          {entry&&<button onClick={handleDelete} style={{ padding:'12px 16px', borderRadius:12, background:'rgba(232,67,147,0.08)', border:'1px solid rgba(232,67,147,0.2)', color:'#E84393', fontSize:13, cursor:'pointer', fontWeight:600 }}>삭제</button>}
          <button onClick={handleSave} disabled={saving} style={{ flex:1, padding:'13px 0', borderRadius:12, background:saving?'#ddd':'linear-gradient(135deg,#FF6B35,#E84393)', border:'none', color:'#fff', fontSize:14, fontWeight:700, cursor:saving?'not-allowed':'pointer' }}>{saving?'저장 중...':entry?'수정 저장':'추가'}</button>
        </div>
      </div>
    </div>
  )
}

// ── 시트 관리 모달 ─────────────────────────────────────────
function SheetManageModal({ sheets, storeId, onSave, onClose }: { sheets:any[]; storeId:string; onSave:()=>void; onClose:()=>void }) {
  const supabase = createSupabaseBrowserClient()
  const [newName, setNewName] = useState(''); const [newIcon, setNewIcon] = useState('📋'); const [saving, setSaving] = useState(false); const [editId, setEditId] = useState<string|null>(null); const [editName, setEditName] = useState('')
  async function handleAdd() { if (!newName.trim()) return; setSaving(true); const maxOrder=sheets.reduce((max,s)=>Math.max(max,s.sort_order||0),0); await supabase.from('settlement_sheets').insert({ store_id:storeId, name:newName.trim(), icon:newIcon, sheet_type:'expense', sort_order:maxOrder+1 }); setNewName(''); setSaving(false); onSave() }
  async function handleToggle(sheet:any) { await supabase.from('settlement_sheets').update({ is_active:!sheet.is_active }).eq('id',sheet.id); onSave() }
  async function handleRename(id:string) { if (!editName.trim()) return; await supabase.from('settlement_sheets').update({ name:editName.trim() }).eq('id',id); setEditId(null); onSave() }
  async function handleDelete(sheet:any) { if (!confirm(`"${sheet.name}" 시트를 삭제할까요?`)) return; await supabase.from('settlement_sheets').delete().eq('id',sheet.id); onSave() }
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'88vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}><span style={{ fontSize:15, fontWeight:700 }}>📂 시트 관리</span><button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button></div>
        {sheets.filter(s=>s.sheet_type!=='sales').map(sheet=>(
          <div key={sheet.id} style={{ padding:'10px 14px', background:sheet.is_active?'#fff':'#F8F9FB', borderRadius:10, border:`1px solid ${sheet.is_active?'#E8ECF0':'#F0F0F0'}`, marginBottom:6 }}>
            {editId===sheet.id?<div style={{ display:'flex', gap:6 }}><input value={editName} onChange={e=>setEditName(e.target.value)} style={{ ...inp, flex:1 }} autoFocus /><button onClick={()=>handleRename(sheet.id)} style={{ padding:'6px 12px', borderRadius:8, background:'linear-gradient(135deg,#FF6B35,#E84393)', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>저장</button><button onClick={()=>setEditId(null)} style={{ padding:'6px 10px', borderRadius:8, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', cursor:'pointer', fontSize:12 }}>취소</button></div>
            :<div style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ fontSize:18 }}>{sheet.icon}</span><span style={{ flex:1, fontSize:13, fontWeight:600, color:sheet.is_active?'#1a1a2e':'#aaa' }}>{sheet.name}</span><button onClick={()=>{ setEditId(sheet.id); setEditName(sheet.name) }} style={{ background:'none', border:'none', fontSize:11, color:'#6C5CE7', cursor:'pointer' }}>수정</button><button onClick={()=>handleToggle(sheet)} style={{ padding:'2px 8px', borderRadius:6, border:`1px solid ${sheet.is_active?'rgba(0,184,148,0.3)':'#E8ECF0'}`, background:sheet.is_active?'rgba(0,184,148,0.08)':'#F4F6F9', color:sheet.is_active?'#00B894':'#aaa', fontSize:10, fontWeight:700, cursor:'pointer' }}>{sheet.is_active?'활성':'비활성'}</button><button onClick={()=>handleDelete(sheet)} style={{ background:'none', border:'none', color:'#E84393', fontSize:11, cursor:'pointer' }}>삭제</button></div>}
          </div>
        ))}
        <div style={{ background:'rgba(255,107,53,0.04)', borderRadius:12, padding:14, border:'1px dashed rgba(255,107,53,0.3)', marginTop:8 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#FF6B35', marginBottom:10 }}>+ 새 시트 추가</div>
          <div style={{ marginBottom:8 }}><span style={lbl}>시트 이름</span><input value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAdd()} placeholder="예: 포장재" style={inp} /></div>
          <div style={{ marginBottom:12 }}><span style={lbl}>아이콘</span><div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>{ICONS.map(ic=><button key={ic} onClick={()=>setNewIcon(ic)} style={{ width:34, height:34, borderRadius:8, border:newIcon===ic?'2px solid #FF6B35':'1px solid #E8ECF0', background:newIcon===ic?'rgba(255,107,53,0.1)':'#F8F9FB', fontSize:17, cursor:'pointer' }}>{ic}</button>)}</div></div>
          <button onClick={handleAdd} disabled={saving||!newName.trim()} style={{ width:'100%', padding:'11px 0', borderRadius:10, background:newName.trim()?'linear-gradient(135deg,#FF6B35,#E84393)':'#E8ECF0', border:'none', color:newName.trim()?'#fff':'#aaa', fontSize:13, fontWeight:700, cursor:newName.trim()?'pointer':'default' }}>{saving?'추가 중...':'시트 추가'}</button>
        </div>
      </div>
    </div>
  )
}

// ── 수익분석 뷰 ────────────────────────────────────────────
function ProfitAnalysisView({ sheets, storeId, year, month, settings }: { sheets:any[]; storeId:string; year:number; month:number; settings:any }) {
  const supabase = createSupabaseBrowserClient()
  const [entrySums, setEntrySums] = useState<Record<string,number>>({}); const [orderSums, setOrderSums] = useState<Record<string,number>>({}); const [salesByPlatform, setSalesByPlatform] = useState<Record<string,number>>({}); const [feeEntries, setFeeEntries] = useState<any[]>([]); const [loading, setLoading] = useState(true); const [exporting, setExporting] = useState(false)
  useEffect(()=>{ loadAll() },[storeId,year,month])
  async function loadAll() {
    setLoading(true); const pad=(n:number)=>String(n).padStart(2,'0'); const from=`${year}-${pad(month)}-01`; const to=`${year}-${pad(month)}-${pad(new Date(year,month,0).getDate())}`
    const { data: ent } = await supabase.from('settlement_entries').select('sheet_id,amount').eq('store_id',storeId).eq('year',year).eq('month',month); const sums: Record<string,number>={}; ;(ent||[]).forEach((e:any)=>{ sums[e.sheet_id]=(sums[e.sheet_id]||0)+(e.amount||0) }); setEntrySums(sums)
    const { data: linked } = await supabase.from('orders').select('settlement_sheet_id,settlement_amount').eq('store_id',storeId).eq('settlement_year',year).eq('settlement_month',month).not('settlement_sheet_id','is',null); const oSums: Record<string,number>={}; ;(linked||[]).forEach((o:any)=>{ if(o.settlement_sheet_id&&o.settlement_amount) oSums[o.settlement_sheet_id]=(oSums[o.settlement_sheet_id]||0)+o.settlement_amount }); setOrderSums(oSums)
    const feeSheet=sheets.find(s=>s.name==='수수료'); if (feeSheet) { const { data: fd } = await supabase.from('settlement_entries').select('*').eq('sheet_id',feeSheet.id).eq('year',year).eq('month',month); setFeeEntries(fd||[]) } else setFeeEntries([])
    const { data: cls } = await supabase.from('closings').select('id').eq('store_id',storeId).gte('closing_date',from).lte('closing_date',to)
    if (cls&&cls.length>0) { const { data: sv } = await supabase.from('closing_sales').select('platform,amount').in('closing_id',cls.map((c:any)=>c.id)); const bp: Record<string,number>={}; ;(sv||[]).forEach((s:any)=>{ bp[s.platform]=(bp[s.platform]||0)+(s.amount||0) }); setSalesByPlatform(bp) } else setSalesByPlatform({})
    setLoading(false)
  }
  const cardRate=settings?.card_fee_rate??1.1; const DELIVERY=['배달의민족','배민','쿠팡이츠','쿠팡','요기요']; const pos=Object.entries(salesByPlatform).filter(([k])=>!DELIVERY.includes(k)).reduce((s,[,v])=>s+v,0); const baemin=salesByPlatform['배달의민족']||salesByPlatform['배민']||0; const coupang=salesByPlatform['쿠팡이츠']||salesByPlatform['쿠팡']||0; const yogiyo=salesByPlatform['요기요']||0; const cardFeeAuto=Math.round(pos*(cardRate/100)); const getFee=(kws:string[])=>feeEntries.filter(e=>kws.some(k=>e.item_name?.includes(k))).reduce((s,e)=>s+(e.amount||0),0); const totalSales=Object.values(salesByPlatform).reduce((s,v)=>s+v,0); const expenseSheets=sheets.filter(s=>s.sheet_type==='expense'&&s.is_active); const totalExpense=expenseSheets.reduce((s,sh)=>s+(entrySums[sh.id]||0)+(orderSums[sh.id]||0),0)+cardFeeAuto; const netProfit=totalSales-totalExpense; const profitRate=totalSales>0?Math.round((netProfit/totalSales)*1000)/10:0
  if (loading) return <div style={{ textAlign:'center', padding:40, color:'#bbb', fontSize:13 }}>불러오는 중...</div>
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:10 }}><button onClick={async()=>{ setExporting(true); await exportAllExcel(storeId,year,month,sheets,settings); setExporting(false) }} disabled={exporting} style={{ padding:'9px 18px', borderRadius:11, background:exporting?'#F0F2F5':'linear-gradient(135deg,#00B894,#2DC6D6)', border:'none', color:exporting?'#bbb':'#fff', fontSize:13, fontWeight:700, cursor:exporting?'default':'pointer' }}>{exporting?'📊 생성 중...':'📥 전체 엑셀 다운로드'}</button></div>
      <div style={{ ...bx, border:`1.5px solid ${netProfit>=0?'rgba(0,184,148,0.4)':'rgba(232,67,147,0.4)'}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}><div><div style={{ fontSize:12, color:'#888', marginBottom:4 }}>{year}년 {month}월 수익분석</div><div style={{ fontSize:10, color:'#aaa' }}>{settings?.business_type==='corporation'?'법인':'개인사업자'} · 카드수수료 {cardRate}%</div></div><div style={{ textAlign:'right' }}><div style={{ fontSize:30, fontWeight:900, color:netProfit>=0?'#00B894':'#E84393', lineHeight:1.1 }}>{numFmt(netProfit)}원</div><div style={{ fontSize:14, fontWeight:700, color:netProfit>=0?'#00B894':'#E84393' }}>수익률 {profitRate}%</div></div></div>
        <div style={{ height:12, background:'#F0F2F5', borderRadius:8, overflow:'hidden', marginBottom:6 }}><div style={{ height:12, borderRadius:8, width:`${Math.min(Math.max(profitRate,0),50)*2}%`, background:profitRate>=20?'linear-gradient(90deg,#00B894,#00cec9)':profitRate>=10?'linear-gradient(90deg,#FF6B35,#FDC400)':'linear-gradient(90deg,#E84393,#FF6B35)', transition:'width 0.4s' }} /></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:14 }}>{[{l:'총 매출',v:totalSales,c:'#00B894',bg:'rgba(0,184,148,0.08)'},{l:'총 지출',v:totalExpense,c:'#E84393',bg:'rgba(232,67,147,0.06)'},{l:'순수익',v:netProfit,c:netProfit>=0?'#00B894':'#E84393',bg:netProfit>=0?'rgba(0,184,148,0.08)':'rgba(232,67,147,0.06)'}].map(item=><div key={item.l} style={{ padding:'10px 8px', background:item.bg, borderRadius:10, textAlign:'center' }}><div style={{ fontSize:10, color:'#aaa', marginBottom:3 }}>{item.l}</div><div style={{ fontSize:13, fontWeight:800, color:item.c }}>{Math.abs(item.v)>=10000?`${(item.v/10000).toFixed(0)}만`:`${numFmt(item.v)}`}원</div></div>)}</div>
      </div>
      <div style={bx}>
        <div style={{ fontSize:13, fontWeight:800, color:'#1a1a2e', marginBottom:14 }}>💰 매출 상세</div>
        {pos>0&&<div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}><span style={{ fontSize:12, fontWeight:700, color:'#555' }}>🏪 매장 매출</span><span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{numFmt(pos)}원</span></div>}
        {[{name:'배달의민족',sales:baemin,fee:getFee(['배민','배달의민족']),icon:'🛵'},{name:'쿠팡이츠',sales:coupang,fee:getFee(['쿠팡']),icon:'🟡'},{name:'요기요',sales:yogiyo,fee:getFee(['요기요']),icon:'🔴'}].filter(p=>p.sales>0||p.fee>0).map(p=><div key={p.name} style={{ marginBottom:10 }}><div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><span style={{ fontSize:12, fontWeight:700, color:'#555' }}>{p.icon} {p.name}</span><span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{numFmt(p.sales)}원</span></div>{p.fee>0&&<div style={{ display:'flex', justifyContent:'space-between', padding:'6px 12px', background:'rgba(232,67,147,0.05)', borderRadius:8 }}><span style={{ fontSize:11, color:'#E84393' }}>수수료</span><span style={{ fontSize:11, fontWeight:700, color:'#E84393' }}>-{numFmt(p.fee)}원</span></div>}</div>)}
        {totalSales===0&&<div style={{ textAlign:'center', padding:'16px 0', color:'#bbb', fontSize:12 }}>마감일지에서 매출 입력 시 자동 연동됩니다</div>}
        {totalSales>0&&<div style={{ borderTop:'2px dashed #E8ECF0', paddingTop:10, marginTop:8 }}><div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ fontSize:13, fontWeight:700 }}>총 매출</span><span style={{ fontSize:15, fontWeight:800, color:'#00B894' }}>{numFmt(totalSales)}원</span></div></div>}
      </div>
      <div style={bx}>
        <div style={{ fontSize:13, fontWeight:800, color:'#1a1a2e', marginBottom:14 }}>💸 지출 상세 분석</div>
        {cardFeeAuto>0&&<div style={{ marginBottom:14 }}><div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}><div style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ fontSize:16 }}>💳</span><span style={{ fontSize:12, color:'#555', fontWeight:600 }}>카드수수료 (자동 {cardRate}%)</span><span style={{ fontSize:9, background:'rgba(108,92,231,0.12)', color:'#6C5CE7', padding:'1px 6px', borderRadius:5, fontWeight:700 }}>자동</span></div><span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{numFmt(cardFeeAuto)}원</span></div><div style={{ height:7, background:'#F0F2F5', borderRadius:4 }}><div style={{ height:7, borderRadius:4, background:'linear-gradient(90deg,#6C5CE7,#a29bfe)', width:`${Math.min(pct(cardFeeAuto,totalSales)*2,100)}%` }} /></div></div>}
        {expenseSheets.map(sheet=>{ const mAmt=entrySums[sheet.id]||0; const oAmt=orderSums[sheet.id]||0; const amt=mAmt+oAmt; const ratio=pct(amt,totalSales); const isHigh=ratio>30; return <div key={sheet.id} style={{ marginBottom:amt>0?12:4 }}><div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:amt>0?4:0 }}><div style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ fontSize:15 }}>{sheet.icon}</span><span style={{ fontSize:12, color:amt>0?'#555':'#ccc', fontWeight:amt>0?600:400 }}>{sheet.name}</span>{isHigh&&amt>0&&<span style={{ fontSize:9, background:'rgba(232,67,147,0.15)', color:'#E84393', padding:'1px 5px', borderRadius:6, fontWeight:700 }}>⚠️</span>}{oAmt>0&&<span style={{ fontSize:9, background:'rgba(0,184,148,0.12)', color:'#00B894', padding:'1px 5px', borderRadius:5, fontWeight:700 }}>📦</span>}</div><div style={{ textAlign:'right' }}>{amt>0?<><span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{numFmt(amt)}원</span>{totalSales>0&&<span style={{ fontSize:10, color:'#aaa', marginLeft:4 }}>{ratio}%</span>}</>:<span style={{ fontSize:11, color:'#ddd' }}>미입력</span>}</div></div>{amt>0&&<div style={{ height:6, background:'#F0F2F5', borderRadius:4 }}><div style={{ height:6, borderRadius:4, background:isHigh?'linear-gradient(90deg,#E84393,#FF6B35)':'linear-gradient(90deg,#FF6B35,#FDC400)', width:`${Math.min(ratio*2,100)}%` }} /></div>}</div> })}
        <div style={{ display:'flex', justifyContent:'space-between', paddingTop:12, borderTop:'2px solid #E8ECF0' }}><span style={{ fontSize:13, fontWeight:700 }}>지출 합계</span><span style={{ fontSize:18, fontWeight:800, color:'#E84393' }}>{numFmt(totalExpense)}원</span></div>
      </div>
    </div>
  )
}

// ── 시트 뷰 ✅ 날짜순 + 묶음 기능 ────────────────────────
function SheetView({ sheet, allSheets, storeId, userName, year, month }: { sheet:any; allSheets:any[]; storeId:string; userName:string; year:number; month:number }) {
  const supabase = createSupabaseBrowserClient()
  const [entries, setEntries] = useState<any[]>([])
  const [linkedOrders, setLinkedOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editEntry, setEditEntry] = useState<any>(null)
  const [editOrder, setEditOrder] = useState<any>(null)
  const [searchQ, setSearchQ] = useState('')
  const [reclassifyId, setReclassifyId] = useState<string|null>(null)

  // ✅ 묶음 기능
  const [editMode, setEditMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(()=>{ loadAll() },[sheet.id,year,month])
  useEffect(()=>{ if (!editMode) setSelectedIds(new Set()) },[editMode])

  async function loadAll() {
    setLoading(true)
    const [{ data: ent },{ data: linked }] = await Promise.all([
      supabase.from('settlement_entries').select('*').eq('sheet_id',sheet.id).eq('year',year).eq('month',month),
      supabase.from('orders').select('*').eq('settlement_sheet_id',sheet.id).eq('settlement_year',year).eq('settlement_month',month).eq('store_id',storeId),
    ])
    setEntries(ent||[]); setLinkedOrders(linked||[]); setLoading(false)
  }

  // ✅ 묶음 지정
  async function groupSelected() {
    if (selectedIds.size < 2) { alert('2개 이상 선택해야 묶을 수 있어요'); return }
    const newGroupId = crypto.randomUUID()
    const entryIds = [...selectedIds].filter(id=>id.startsWith('entry-')).map(id=>id.replace('entry-',''))
    const orderIds = [...selectedIds].filter(id=>id.startsWith('order-')).map(id=>id.replace('order-',''))
    if (entryIds.length>0) await supabase.from('settlement_entries').update({ group_id:newGroupId }).in('id',entryIds)
    if (orderIds.length>0) await supabase.from('orders').update({ settlement_group_id:newGroupId }).in('id',orderIds)
    setSelectedIds(new Set()); setEditMode(false); loadAll()
  }

  // ✅ 묶음 해제
  async function ungroupItem(item: any) {
    if (!confirm('이 항목을 묶음에서 해제할까요?')) return
    if (item.type==='entry') await supabase.from('settlement_entries').update({ group_id:null }).eq('id',item.data.id)
    else await supabase.from('orders').update({ settlement_group_id:null }).eq('id',item.data.id)
    loadAll()
  }

  // ✅ 전체 묶음 해제
  async function ungroupAll(groupId: string, items: any[]) {
    if (!confirm('묶음 전체를 해제할까요?')) return
    const eIds=items.filter(i=>i.type==='entry').map(i=>i.data.id)
    const oIds=items.filter(i=>i.type==='order').map(i=>i.data.id)
    if (eIds.length>0) await supabase.from('settlement_entries').update({ group_id:null }).in('id',eIds)
    if (oIds.length>0) await supabase.from('orders').update({ settlement_group_id:null }).in('id',oIds)
    loadAll()
  }

  async function deleteEntry(id:string) { if (!confirm('삭제할까요?')) return; await supabase.from('settlement_entries').delete().eq('id',id); loadAll() }
  async function reclassifyOrder(orderId:string, newSheetId:string) { await supabase.from('orders').update({ settlement_sheet_id:newSheetId }).eq('id',orderId); setReclassifyId(null); loadAll() }
  async function unclassifyOrder(orderId:string) { if (!confirm('미분류 탭으로 이동할까요?')) return; await supabase.from('orders').update({ settlement_sheet_id:null, settlement_amount:null, settlement_unit_price:null, price_unit:null, delivery_fee:null, payment_method:null, settlement_classified_at:null, settlement_year:null, settlement_month:null }).eq('id',orderId); loadAll() }

  const pad=(n:number)=>String(n).padStart(2,'0')

  const allItems = useMemo(()=>{
    const items: any[] = []
    entries.forEach(e=>items.push({ type:'entry', key:`entry-${e.id}`, date:e.entry_date, sortKey:e.entry_date, groupId:e.group_id||null, data:e }))
    linkedOrders.forEach(o=>{ const d=new Date(o.confirmed_at||o.ordered_at); const date=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; items.push({ type:'order', key:`order-${o.id}`, date, sortKey:date, groupId:o.settlement_group_id||null, data:o }) })
    return items.sort((a,b)=>b.sortKey.localeCompare(a.sortKey))
  },[entries,linkedOrders])

  const filtered = useMemo(()=>{
    if (!searchQ.trim()) return allItems
    return allItems.filter(item=>(item.type==='entry'?(item.data.item_name||'').includes(searchQ):( (item.data.item_name||'').includes(searchQ))))
  },[allItems,searchQ])

  // 날짜별 그룹핑 → 각 날짜 안에서 묶음/단독 구분
  const grouped = useMemo(()=>{
    const map: Record<string,any[]>={}
    filtered.forEach(item=>{ if(!map[item.date]) map[item.date]=[]; map[item.date].push(item) })
    return Object.entries(map).sort((a,b)=>b[0].localeCompare(a[0]))
  },[filtered])

  const total = useMemo(()=>allItems.reduce((s,item)=>s+(item.type==='entry'?(item.data.amount||0):(item.data.settlement_amount||0)),0),[allItems])
  const expenseSheets = allSheets.filter(s=>s.sheet_type==='expense'&&s.is_active&&s.id!==sheet.id)

  // 날짜 안에서 렌더 유닛 구성 (묶음/단독)
  function buildRenderUnits(items: any[]) {
    const units: any[] = []
    const processedGroupIds = new Set<string>()
    items.forEach(item=>{
      if (item.groupId) {
        if (!processedGroupIds.has(item.groupId)) {
          processedGroupIds.add(item.groupId)
          const groupItems = items.filter(i=>i.groupId===item.groupId)
          units.push({ type:'group', groupId:item.groupId, items:groupItems })
        }
      } else {
        units.push({ type:'single', item })
      }
    })
    return units
  }

  function toggleSelect(key: string) {
    setSelectedIds(prev=>{
      const next=new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function renderItemCard(item: any, inGroup=false) {
    const isSelected = selectedIds.has(item.key)
    const isOrder = item.type==='order'
    const e = item.data
    const d = isOrder ? new Date(e.confirmed_at||e.ordered_at) : null

    return (
      <div key={item.key} style={{ background: inGroup?'transparent':'#fff', borderRadius:12, border:inGroup?'none':(isSelected&&editMode?'2px solid #6C5CE7':'1px solid #E8ECF0'), padding: inGroup?'8px 0':'12px 14px', marginBottom:inGroup?4:6, cursor:'default' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
          {/* ✅ 체크박스 */}
          {editMode&&(
            <div onClick={()=>toggleSelect(item.key)} style={{ flexShrink:0, width:22, height:22, borderRadius:6, border:isSelected?'2px solid #6C5CE7':'2px solid #E0E4E8', background:isSelected?'#6C5CE7':'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', marginTop:2 }}>
              {isSelected&&<span style={{ color:'#fff', fontSize:13, fontWeight:900 }}>✓</span>}
            </div>
          )}
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', cursor:'pointer' }} onClick={()=>{ if(editMode) { toggleSelect(item.key); return }; if(isOrder) setEditOrder(e); else { setEditEntry(e); setShowModal(true) } }}>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:4 }}>
                  {e.item_name&&<span style={{ fontSize:13, fontWeight:600, color:'#1a1a2e' }}>{e.item_name}</span>}
                  {e.payment_method&&<span style={{ fontSize:10, padding:'1px 7px', borderRadius:10, background:`${PAYMENT_COLORS[e.payment_method]||'#aaa'}18`, color:PAYMENT_COLORS[e.payment_method]||'#aaa', fontWeight:600 }}>{e.payment_method}</span>}
                  {!editMode&&<span style={{ fontSize:10, color:'#bbb' }}>✏️</span>}
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {isOrder?(
                    <>
                      {e.has_tax_invoice?<span style={{ fontSize:10, fontWeight:700, color:'#00B894' }}>✅ 세금계산서{e.tax_invoice_date&&` (${e.tax_invoice_date.slice(5)} 발행)`}</span>:<span style={{ fontSize:10, color:'#ddd' }}>세금계산서 미발행</span>}
                      {e.supplier_name&&<span style={{ fontSize:10, color:'#00B894' }}>🏪 {e.supplier_name}</span>}
                      {e.delivery_fee>0&&<span style={{ fontSize:10, color:'#FF6B35' }}>🚚 배송비 {numFmt(e.delivery_fee)}원</span>}
                      {e.memo&&<span style={{ fontSize:10, color:'#aaa' }}>📝 {e.memo}</span>}
                    </>
                  ):(
                    <>
                      {e.has_tax_invoice?<span style={{ fontSize:10, fontWeight:700, color:'#00B894' }}>✅ 세금계산서{e.tax_invoice_date&&` (${e.tax_invoice_date.slice(5)} 발행)`}</span>:<span style={{ fontSize:10, color:'#ddd' }}>세금계산서 미발행</span>}
                      {e.deposit_date&&<span style={{ fontSize:10, color:'#6C5CE7' }}>💰 입금 {e.deposit_date.slice(5)}</span>}
                      {e.memo&&<span style={{ fontSize:10, color:'#aaa' }}>📝 {e.memo}</span>}
                    </>
                  )}
                </div>
              </div>
              <div style={{ textAlign:'right', marginLeft:12, flexShrink:0 }}>
                <div style={{ fontSize:16, fontWeight:800, color:'#1a1a2e' }}>{numFmt(isOrder?(e.settlement_amount||0):(e.amount||0))}원</div>
              </div>
            </div>
            {/* 단독 항목의 시트변경/미분류 버튼 (발주만) */}
            {!editMode&&!inGroup&&isOrder&&(
              <div style={{ display:'flex', gap:6, marginTop:8 }}>
                <button onClick={e2=>{e2.stopPropagation();setReclassifyId(reclassifyId===e.id?null:e.id)}} style={{ padding:'4px 10px', borderRadius:7, background:reclassifyId===e.id?'rgba(108,92,231,0.15)':'rgba(108,92,231,0.07)', border:'1px solid rgba(108,92,231,0.2)', color:'#6C5CE7', fontSize:10, fontWeight:700, cursor:'pointer' }}>{reclassifyId===e.id?'✕ 취소':'🔀 시트 변경'}</button>
                <button onClick={e2=>{e2.stopPropagation();unclassifyOrder(e.id)}} style={{ padding:'4px 10px', borderRadius:7, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#aaa', fontSize:10, cursor:'pointer' }}>미분류로 이동</button>
              </div>
            )}
            {!editMode&&!inGroup&&isOrder&&reclassifyId===e.id&&(
              <div style={{ marginTop:8, padding:'10px 12px', background:'rgba(108,92,231,0.05)', borderRadius:9, border:'1px solid rgba(108,92,231,0.15)' }}>
                <div style={{ fontSize:11, color:'#6C5CE7', fontWeight:700, marginBottom:8 }}>어느 시트로 이동?</div>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>{expenseSheets.map(s=><button key={s.id} onClick={()=>reclassifyOrder(e.id,s.id)} style={{ padding:'6px 11px', borderRadius:20, border:'1px solid rgba(108,92,231,0.25)', background:'rgba(108,92,231,0.08)', color:'#6C5CE7', fontSize:11, fontWeight:600, cursor:'pointer' }}>{s.icon} {s.name}</button>)}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'#bbb', fontSize:13 }}>불러오는 중...</div>

  return (
    <div>
      {editOrder&&<OrderEditModal order={editOrder} onSave={loadAll} onClose={()=>setEditOrder(null)} />}

      {/* 헤더 */}
      <div style={{ ...bx, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:11, color:'#aaa' }}>{year}년 {month}월 · 총 {allItems.length}건</div>
          <div style={{ fontSize:24, fontWeight:900, color:'#FF6B35' }}>{numFmt(total)}원</div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={()=>{ const allI=allItems.map(i=>({ date:i.date, itemName:i.data.item_name, amount:i.type==='entry'?i.data.amount:i.data.settlement_amount, paymentMethod:i.data.payment_method, quantity:i.data.quantity, unitPrice:i.type==='entry'?i.data.unit_price:i.data.settlement_unit_price, priceUnit:i.type==='order'?i.data.price_unit:'', deliveryFee:i.type==='order'?i.data.delivery_fee:0, hasTaxInvoice:i.data.has_tax_invoice, taxInvoiceDate:i.data.tax_invoice_date, depositDate:i.type==='entry'?i.data.deposit_date:'', supplierName:i.type==='order'?i.data.supplier_name:'', memo:i.data.memo, groupId:i.groupId })); exportSheetExcel(sheet,allI,year,month) }} style={{ padding:'7px 12px', borderRadius:10, background:'rgba(0,184,148,0.08)', border:'1px solid rgba(0,184,148,0.25)', color:'#00B894', fontSize:11, fontWeight:700, cursor:'pointer' }}>📥 엑셀</button>
          {/* ✅ 묶기 모드 토글 */}
          <button onClick={()=>setEditMode(v=>!v)} style={{ padding:'7px 12px', borderRadius:10, background:editMode?'rgba(108,92,231,0.15)':'rgba(108,92,231,0.08)', border:`1px solid ${editMode?'rgba(108,92,231,0.4)':'rgba(108,92,231,0.2)'}`, color:'#6C5CE7', fontSize:11, fontWeight:700, cursor:'pointer' }}>{editMode?'✕ 취소':'🔗 묶기'}</button>
          <button onClick={()=>{ setEditEntry(null); setShowModal(true) }} style={{ padding:'10px 14px', borderRadius:12, background:'linear-gradient(135deg,#FF6B35,#E84393)', border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ 추가</button>
        </div>
      </div>

      {/* 묶기 모드 안내 + 실행 버튼 */}
      {editMode&&(
        <div style={{ padding:'12px 16px', background:'rgba(108,92,231,0.06)', borderRadius:12, border:'1px solid rgba(108,92,231,0.2)', marginBottom:12 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#6C5CE7', marginBottom:6 }}>🔗 묶음 모드</div>
          <div style={{ fontSize:11, color:'#888', marginBottom:10 }}>함께 결제한 항목들을 선택하세요. {selectedIds.size>0&&<strong style={{ color:'#6C5CE7' }}>{selectedIds.size}개 선택됨</strong>}</div>
          <button onClick={groupSelected} disabled={selectedIds.size<2}
            style={{ width:'100%', padding:'11px 0', borderRadius:10, background:selectedIds.size>=2?'linear-gradient(135deg,#6C5CE7,#a29bfe)':'#E8ECF0', border:'none', color:selectedIds.size>=2?'#fff':'#aaa', fontSize:13, fontWeight:700, cursor:selectedIds.size>=2?'pointer':'default' }}>
            {selectedIds.size>=2?`🔗 선택한 ${selectedIds.size}개 묶기`:'2개 이상 선택해주세요'}
          </button>
        </div>
      )}

      {/* 검색 */}
      <div style={{ position:'relative', marginBottom:12 }}>
        <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:13, color:'#bbb' }}>🔍</span>
        <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder={`${sheet.name} 항목 검색...`} style={{ ...inp, paddingLeft:32, paddingRight:searchQ?30:10 }} />
        {searchQ&&<button onClick={()=>setSearchQ('')} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'#bbb', cursor:'pointer', fontSize:14 }}>✕</button>}
      </div>

      {/* 날짜순 목록 */}
      {grouped.length===0?(
        <div style={{ textAlign:'center', padding:'48px 0', color:'#bbb' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>{sheet.icon}</div>
          <div style={{ fontSize:12 }}>{searchQ?'검색 결과가 없어요':'미분류 탭에서 발주 분류하거나 + 추가로 직접 입력하세요'}</div>
        </div>
      ):grouped.map(([date,items])=>{
        const d=new Date(date+'T00:00:00'); const dow=['일','월','화','수','목','금','토'][d.getDay()]; const isSun=d.getDay()===0; const isSat=d.getDay()===6
        const dayTotal=items.reduce((s,item)=>s+(item.type==='entry'?(item.data.amount||0):(item.data.settlement_amount||0)),0)
        const renderUnits = buildRenderUnits(items)

        return (
          <div key={date} style={{ marginBottom:20 }}>
            {/* 날짜 헤더 */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <span style={{ fontSize:13, fontWeight:700, padding:'4px 12px', borderRadius:20, background:isSun?'rgba(232,67,147,0.1)':isSat?'rgba(45,198,214,0.1)':'rgba(108,92,231,0.08)', color:isSun?'#E84393':isSat?'#2DC6D6':'#6C5CE7' }}>
                {d.getFullYear()}년 {d.getMonth()+1}월 {d.getDate()}일 ({dow})
              </span>
              <span style={{ fontSize:13, fontWeight:700, color:'#FF6B35' }}>{numFmt(dayTotal)}원</span>
            </div>

            {renderUnits.map((unit,ui)=>{
              if (unit.type==='single') {
                return renderItemCard(unit.item)
              } else {
                // ✅ 묶음 박스
                const groupTotal=unit.items.reduce((s:number,i:any)=>s+(i.type==='entry'?(i.data.amount||0):(i.data.settlement_amount||0)),0)
                return (
                  <div key={unit.groupId} style={{ background:'rgba(108,92,231,0.04)', borderRadius:14, border:'2px solid rgba(108,92,231,0.25)', padding:'12px 14px', marginBottom:8 }}>
                    {/* 묶음 헤더 */}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                        <span style={{ fontSize:11, fontWeight:700, color:'#6C5CE7', background:'rgba(108,92,231,0.12)', padding:'3px 10px', borderRadius:20 }}>🔗 묶음 결제</span>
                        <span style={{ fontSize:10, color:'#aaa' }}>{unit.items.length}개 항목</span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:16, fontWeight:900, color:'#6C5CE7' }}>{numFmt(groupTotal)}원</span>
                        {!editMode&&<button onClick={()=>ungroupAll(unit.groupId,unit.items)} style={{ background:'none', border:'none', fontSize:10, color:'#E84393', cursor:'pointer', padding:'2px 6px' }}>묶음 해제</button>}
                      </div>
                    </div>
                    {/* 구분선 */}
                    <div style={{ borderTop:'1px dashed rgba(108,92,231,0.2)', marginBottom:10 }} />
                    {/* 묶음 내 항목들 */}
                    {unit.items.map((item:any)=>(
                      <div key={item.key}>
                        {editMode?(
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                            <div onClick={()=>toggleSelect(item.key)} style={{ flexShrink:0, width:22, height:22, borderRadius:6, border:selectedIds.has(item.key)?'2px solid #6C5CE7':'2px solid #E0E4E8', background:selectedIds.has(item.key)?'#6C5CE7':'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
                              {selectedIds.has(item.key)&&<span style={{ color:'#fff', fontSize:13, fontWeight:900 }}>✓</span>}
                            </div>
                            <div style={{ flex:1 }}>
                              {renderItemCard(item, true)}
                            </div>
                          </div>
                        ):(
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid rgba(108,92,231,0.1)' }}>
                            <div style={{ flex:1 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:3, cursor:'pointer' }} onClick={()=>item.type==='order'?setEditOrder(item.data):(setEditEntry(item.data),setShowModal(true))}>
                                {item.data.item_name&&<span style={{ fontSize:13, fontWeight:600, color:'#1a1a2e' }}>{item.data.item_name}</span>}
                                {item.data.payment_method&&<span style={{ fontSize:10, padding:'1px 7px', borderRadius:10, background:`${PAYMENT_COLORS[item.data.payment_method]||'#aaa'}18`, color:PAYMENT_COLORS[item.data.payment_method]||'#aaa', fontWeight:600 }}>{item.data.payment_method}</span>}
                                <span style={{ fontSize:10, color:'#bbb' }}>✏️</span>
                              </div>
                              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                                {item.data.has_tax_invoice?<span style={{ fontSize:10, fontWeight:700, color:'#00B894' }}>✅ 세금계산서{item.data.tax_invoice_date&&` (${item.data.tax_invoice_date.slice(5)} 발행)`}</span>:<span style={{ fontSize:10, color:'#ddd' }}>세금계산서 미발행</span>}
                                {item.type==='order'&&item.data.delivery_fee>0&&<span style={{ fontSize:10, color:'#FF6B35' }}>🚚 배송비 {numFmt(item.data.delivery_fee)}원</span>}
                                {item.type==='entry'&&item.data.deposit_date&&<span style={{ fontSize:10, color:'#6C5CE7' }}>💰 입금 {item.data.deposit_date.slice(5)}</span>}
                                {item.data.memo&&<span style={{ fontSize:10, color:'#aaa' }}>📝 {item.data.memo}</span>}
                              </div>
                            </div>
                            <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:12 }}>
                              <span style={{ fontSize:15, fontWeight:800, color:'#1a1a2e' }}>{numFmt(item.type==='entry'?item.data.amount:item.data.settlement_amount)}원</span>
                              <button onClick={()=>ungroupItem(item)} style={{ background:'none', border:'none', fontSize:10, color:'#E84393', cursor:'pointer' }}>분리</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {/* 묶음 합계 재표시 */}
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:10, paddingTop:8, borderTop:'1px solid rgba(108,92,231,0.15)' }}>
                      <span style={{ fontSize:11, color:'#6C5CE7', fontWeight:600 }}>은행 내역 합계</span>
                      <span style={{ fontSize:14, fontWeight:900, color:'#6C5CE7' }}>{numFmt(groupTotal)}원</span>
                    </div>
                  </div>
                )
              }
            })}
          </div>
        )
      })}

      {showModal&&<EntryModal sheet={sheet} entry={editEntry} storeId={storeId} userName={userName} year={year} month={month} onSave={loadAll} onClose={()=>{ setShowModal(false); setEditEntry(null) }} />}
    </div>
  )
}

// ── 매출 뷰 ────────────────────────────────────────────────
function SalesView({ storeId, year, month }: { storeId:string; year:number; month:number }) {
  const supabase = createSupabaseBrowserClient()
  const [dailySales, setDailySales] = useState<any[]>([]); const [loading, setLoading] = useState(true)
  useEffect(()=>{ loadSales() },[storeId,year,month])
  async function loadSales() { setLoading(true); const pad=(n:number)=>String(n).padStart(2,'0'); const from=`${year}-${pad(month)}-01`; const to=`${year}-${pad(month)}-${pad(new Date(year,month,0).getDate())}`; const { data: cls } = await supabase.from('closings').select('id,closing_date').eq('store_id',storeId).gte('closing_date',from).lte('closing_date',to).order('closing_date',{ascending:false}); if (!cls?.length) { setDailySales([]); setLoading(false); return }; const { data: sv } = await supabase.from('closing_sales').select('*').in('closing_id',cls.map((c:any)=>c.id)); setDailySales(cls.map((cl:any)=>{ const platforms=(sv||[]).filter((s:any)=>s.closing_id===cl.id); return { ...cl, total:platforms.reduce((s:number,p:any)=>s+(p.amount||0),0), platforms } })); setLoading(false) }
  const monthTotal=dailySales.reduce((s,d)=>s+d.total,0); const avgDaily=dailySales.length>0?Math.round(monthTotal/dailySales.length):0
  if (loading) return <div style={{ textAlign:'center', padding:40, color:'#bbb', fontSize:13 }}>불러오는 중...</div>
  return (
    <div>
      <div style={bx}><div style={{ fontSize:11, color:'#aaa', marginBottom:2 }}>{year}년 {month}월 총 매출</div><div style={{ fontSize:26, fontWeight:900, color:'#00B894', marginBottom:4 }}>{numFmt(monthTotal)}원</div><div style={{ display:'flex', gap:12 }}><span style={{ fontSize:11, color:'#bbb' }}>마감 {dailySales.length}일</span>{avgDaily>0&&<span style={{ fontSize:11, color:'#6C5CE7', fontWeight:600 }}>일평균 {numFmt(avgDaily)}원</span>}</div></div>
      {dailySales.length===0?<div style={{ textAlign:'center', padding:'60px 0', color:'#bbb' }}><div style={{ fontSize:36, marginBottom:8 }}>💰</div><div style={{ fontSize:12 }}>마감일지에서 매출 입력 시 자동 표시됩니다</div></div>
      :dailySales.map(day=>{ const d=new Date(day.closing_date+'T00:00:00'); const dow=['일','월','화','수','목','금','토'][d.getDay()]; const isSun=d.getDay()===0; const isSat=d.getDay()===6; return <div key={day.id} style={{ background:'#fff', borderRadius:12, border:'1px solid rgba(0,184,148,0.2)', padding:'11px 14px', marginBottom:8 }}><div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:day.platforms.filter((p:any)=>p.amount>0).length>0?8:0 }}><span style={{ fontSize:13, fontWeight:700, color:isSun?'#E84393':isSat?'#2DC6D6':'#1a1a2e' }}>{d.getMonth()+1}월 {d.getDate()}일 ({dow})</span><span style={{ fontSize:16, fontWeight:800, color:'#00B894' }}>{numFmt(day.total)}원</span></div>{day.platforms.filter((p:any)=>p.amount>0).length>0&&<div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>{day.platforms.filter((p:any)=>p.amount>0).map((p:any)=><span key={p.id} style={{ fontSize:10, color:'#888', background:'#F4F6F9', padding:'2px 8px', borderRadius:8 }}>{p.platform} {numFmt(p.amount)}원</span>)}</div>}</div> })}
    </div>
  )
}

// ── 전지점 뷰 ──────────────────────────────────────────────
function AdminView({ profileId, year, month }: { profileId:string; year:number; month:number }) {
  const supabase = createSupabaseBrowserClient()
  const [stores, setStores] = useState<any[]>([]); const [storeData, setStoreData] = useState<Record<string,any>>({}); const [loading, setLoading] = useState(true)
  useEffect(()=>{ loadAll() },[profileId,year,month])
  async function loadAll() {
    setLoading(true); const { data: members } = await supabase.from('store_members').select('*, stores(*)').eq('profile_id',profileId).eq('active',true); const storeList=(members||[]).map((m:any)=>m.stores).filter(Boolean); setStores(storeList)
    const pad=(n:number)=>String(n).padStart(2,'0'); const from=`${year}-${pad(month)}-01`; const to=`${year}-${pad(month)}-${pad(new Date(year,month,0).getDate())}`; const result: Record<string,any>={}
    await Promise.all(storeList.map(async (store:any)=>{ const sid=store.id; const [{ data: cls },{ data: ent },{ data: linked },{ data: sheets },{ data: settings }] = await Promise.all([supabase.from('closings').select('id').eq('store_id',sid).gte('closing_date',from).lte('closing_date',to),supabase.from('settlement_entries').select('sheet_id,amount').eq('store_id',sid).eq('year',year).eq('month',month),supabase.from('orders').select('settlement_sheet_id,settlement_amount').eq('store_id',sid).eq('settlement_year',year).eq('settlement_month',month).not('settlement_sheet_id','is',null),supabase.from('settlement_sheets').select('id,name,icon').eq('store_id',sid).eq('is_active',true).eq('sheet_type','expense').order('sort_order'),supabase.from('settlement_settings').select('*').eq('store_id',sid).maybeSingle()]); let sales=0; if (cls?.length) { const { data: sv } = await supabase.from('closing_sales').select('amount').in('closing_id',cls.map((c:any)=>c.id)); sales=(sv||[]).reduce((s:number,r:any)=>s+(r.amount||0),0) }; const sums: Record<string,number>={}; ;(ent||[]).forEach((e:any)=>{ sums[e.sheet_id]=(sums[e.sheet_id]||0)+(e.amount||0) }); ;(linked||[]).forEach((o:any)=>{ if(o.settlement_sheet_id&&o.settlement_amount) sums[o.settlement_sheet_id]=(sums[o.settlement_sheet_id]||0)+o.settlement_amount }); const expense=Object.values(sums).reduce((s:number,v:any)=>s+(v as number),0); result[sid]={ sales, expense, sheets:(sheets||[]).map((sh:any)=>({...sh,amount:sums[sh.id]||0})), settings:settings||null } }))
    setStoreData(result); setLoading(false)
  }
  async function exportExcel() { try { const ExcelJS=(await import('exceljs')).default; const wb=new ExcelJS.Workbook(); const pad=(n:number)=>String(n).padStart(2,'0'); const ws=wb.addWorksheet(`${year}년${pad(month)}월 요약`); ws.addRow(['지점명','총매출','총지출','순수익','수익률(%)']); ws.getRow(1).eachCell(cell=>{ cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1A1A2E'}}; cell.font={bold:true,color:{argb:'FFFFFFFF'}}; cell.alignment={horizontal:'center'} }); stores.forEach((store:any)=>{ const d=storeData[store.id]; if(!d) return; const net=d.sales-d.expense; const rate=d.sales>0?Math.round((net/d.sales)*1000)/10:0; ws.addRow([store.name,d.sales,d.expense,net,rate]) }); ws.getColumn(2).numFmt='#,##0'; ws.getColumn(3).numFmt='#,##0'; ws.getColumn(4).numFmt='#,##0'; ws.columns.forEach(col=>{col.width=16}); stores.forEach((store:any)=>{ const d=storeData[store.id]; if(!d) return; const wsD=wb.addWorksheet(store.name.slice(0,31)); wsD.addRow(['항목','금액(원)']); wsD.getRow(1).eachCell(cell=>{ cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF2C3E50'}}; cell.font={bold:true,color:{argb:'FFFFFFFF'}} }); wsD.addRow(['총 매출',d.sales]); d.sheets.forEach((sh:any)=>wsD.addRow([`${sh.icon} ${sh.name}`,sh.amount])); wsD.addRow(['순수익',d.sales-d.expense]); wsD.getColumn(2).numFmt='#,##0'; wsD.columns.forEach(col=>{col.width=20}) }); const buf=await wb.xlsx.writeBuffer(); const blob=new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`결산_${year}년${pad(month)}월.xlsx`; a.click(); URL.revokeObjectURL(url) } catch(e:any) { alert('내보내기 실패: '+(e?.message||'')) } }
  if (loading) return <div style={{ textAlign:'center', padding:48, color:'#bbb', fontSize:13 }}>전 지점 결산 불러오는 중...</div>
  const totSales=stores.reduce((s,st)=>s+(storeData[st.id]?.sales||0),0); const totExpense=stores.reduce((s,st)=>s+(storeData[st.id]?.expense||0),0)
  return (
    <div>
      <div style={{ ...bx, border:'1.5px solid rgba(108,92,231,0.3)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}><div style={{ fontSize:13, fontWeight:800, color:'#1a1a2e' }}>👑 {year}년 {month}월 전지점 합산</div><button onClick={exportExcel} style={{ padding:'7px 14px', borderRadius:10, background:'rgba(0,184,148,0.1)', border:'1px solid rgba(0,184,148,0.3)', color:'#00B894', fontSize:12, fontWeight:700, cursor:'pointer' }}>📥 엑셀</button></div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>{[{l:'전체 매출',v:totSales,c:'#00B894',bg:'rgba(0,184,148,0.08)'},{l:'전체 지출',v:totExpense,c:'#E84393',bg:'rgba(232,67,147,0.06)'},{l:'전체 순수익',v:totSales-totExpense,c:(totSales-totExpense)>=0?'#00B894':'#E84393',bg:(totSales-totExpense)>=0?'rgba(0,184,148,0.08)':'rgba(232,67,147,0.06)'}].map(item=><div key={item.l} style={{ padding:'12px 8px', background:item.bg, borderRadius:12, textAlign:'center' }}><div style={{ fontSize:10, color:'#aaa', marginBottom:3 }}>{item.l}</div><div style={{ fontSize:13, fontWeight:800, color:item.c }}>{Math.abs(item.v)>=10000?`${(item.v/10000).toFixed(0)}만`:`${numFmt(item.v)}`}원</div></div>)}</div>
      </div>
      {stores.map((store:any)=>{ const d=storeData[store.id]; if(!d) return null; const net=d.sales-d.expense; const profR=d.sales>0?Math.round((net/d.sales)*1000)/10:0; return <div key={store.id} style={{ ...bx, border:`1.5px solid ${net>=0?'rgba(0,184,148,0.3)':'rgba(232,67,147,0.3)'}` }}><div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}><span style={{ fontSize:14, fontWeight:800, color:'#1a1a2e' }}>🏪 {store.name}</span><span style={{ fontSize:13, fontWeight:700, padding:'4px 12px', borderRadius:8, background:net>=0?'rgba(0,184,148,0.12)':'rgba(232,67,147,0.1)', color:net>=0?'#00B894':'#E84393' }}>수익률 {profR}%</span></div><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>{[{l:'매출',v:d.sales,c:'#00B894'},{l:'지출',v:d.expense,c:'#E84393'},{l:'순수익',v:net,c:net>=0?'#00B894':'#E84393'}].map(item=><div key={item.l} style={{ textAlign:'center', padding:'10px 6px', background:'#F8F9FB', borderRadius:10 }}><div style={{ fontSize:10, color:'#aaa' }}>{item.l}</div><div style={{ fontSize:14, fontWeight:800, color:item.c, marginTop:3 }}>{Math.abs(item.v)>=10000?`${(item.v/10000).toFixed(0)}만`:`${numFmt(item.v)}`}원</div></div>)}</div>{d.sheets.filter((sh:any)=>sh.amount>0).length>0&&<div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>{d.sheets.filter((sh:any)=>sh.amount>0).slice(0,6).map((sh:any)=><span key={sh.id} style={{ fontSize:10, background:'rgba(255,107,53,0.07)', color:'#FF6B35', padding:'2px 9px', borderRadius:10, fontWeight:600 }}>{sh.icon} {sh.name} {numFmt(sh.amount)}원</span>)}</div>}</div> })}
    </div>
  )
}

// ════════════════════════════════════════
// 메인 페이지
// ════════════════════════════════════════
export default function SettlementPage() {
  const supabase = createSupabaseBrowserClient()
  const [storeId, setStoreId] = useState(''); const [userName, setUserName] = useState(''); const [userRole, setUserRole] = useState(''); const [profileId, setProfileId] = useState(''); const [isPC, setIsPC] = useState(false); const [sheets, setSheets] = useState<any[]>([]); const [settings, setSettings] = useState<any>(null); const [selectedSheet, setSelectedSheet] = useState<string>('analysis'); const [viewMode, setViewMode] = useState<'store'|'all'>('store'); const [hasPermission, setHasPermission] = useState(false); const [permChecked, setPermChecked] = useState(false); const [showSheetMgr, setShowSheetMgr] = useState(false); const [showSettings, setShowSettings] = useState(false); const [loading, setLoading] = useState(true); const [unclassifiedCount, setUnclassifiedCount] = useState(0)
  const now = new Date(); const [year, setYear] = useState(now.getFullYear()); const [month, setMonth] = useState(now.getMonth()+1)
  const isOwner = userRole==='owner'

  useEffect(()=>{ const check=()=>setIsPC(window.innerWidth>=768); check(); window.addEventListener('resize',check); return ()=>window.removeEventListener('resize',check) },[])
  useEffect(()=>{
    const store=JSON.parse(localStorage.getItem('mj_store')||'{}'); const user=JSON.parse(localStorage.getItem('mj_user')||'{}')
    if (!store.id) return
    setStoreId(store.id); setUserName(user.nm||''); setUserRole(user.role||''); setProfileId(user.id||'')
    if (user.role==='owner') { setHasPermission(true); setPermChecked(true); loadSheets(store.id); loadSettings(store.id) }
    else if (user.role==='manager') checkAndLoad(store.id, user.id)
    else { setPermChecked(true); setLoading(false) }
  },[])
  useEffect(()=>{ if(storeId) loadUnclassifiedCount() },[storeId,year,month])

  async function loadUnclassifiedCount() { const pad=(n:number)=>String(n).padStart(2,'0'); const from=`${year}-${pad(month)}-01`; const to=`${year}-${pad(month)}-${pad(new Date(year,month,0).getDate())}T23:59:59`; const { count } = await supabase.from('orders').select('*',{count:'exact',head:true}).eq('store_id',storeId).is('settlement_sheet_id',null).not('confirmed_at','is',null).gte('confirmed_at',from).lte('confirmed_at',to); setUnclassifiedCount(count||0) }
  async function loadSettings(sid:string) { const { data } = await supabase.from('settlement_settings').select('*').eq('store_id',sid).maybeSingle(); setSettings(data) }
  async function checkAndLoad(sid:string, pid:string) { const { data } = await supabase.from('settlement_permissions').select('id').eq('store_id',sid).eq('profile_id',pid).maybeSingle(); setHasPermission(!!data); setPermChecked(true); if(data) { loadSheets(sid); loadSettings(sid) } else setLoading(false) }
  async function loadSheets(sid:string) { const { data } = await supabase.from('settlement_sheets').select('*').eq('store_id',sid).order('sort_order'); if (!data||data.length===0) { const rows=DEFAULT_SHEETS.map(s=>({...s,store_id:sid})); const { data: inserted } = await supabase.from('settlement_sheets').insert(rows).select(); setSheets(inserted||[]) } else setSheets(data); setLoading(false) }

  const activeSheets=useMemo(()=>sheets.filter(s=>s.is_active),[sheets])
  const currentSheet=activeSheets.find(s=>s.id===selectedSheet)

  if (!permChecked||loading) return <div style={{ minHeight:'60vh', display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ color:'#bbb', fontSize:13 }}>로딩 중...</span></div>
  if (!hasPermission) return <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px', textAlign:'center' }}><div style={{ fontSize:40, marginBottom:16 }}>🔒</div><div style={{ fontSize:18, fontWeight:800, color:'#1a1a2e', marginBottom:8 }}>접근 권한이 없습니다</div><div style={{ fontSize:13, color:'#aaa' }}>결산 메뉴는 대표만 사용할 수 있어요.</div></div>

  return (
    <div>
      {showSheetMgr&&<SheetManageModal sheets={sheets} storeId={storeId} onSave={()=>{ setLoading(true); loadSheets(storeId) }} onClose={()=>setShowSheetMgr(false)} />}
      {showSettings&&<SettingsModal storeId={storeId} settings={settings} onSave={(s)=>setSettings(s)} onClose={()=>setShowSettings(false)} />}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <span style={{ fontSize:isPC?20:17, fontWeight:700, color:'#1a1a2e' }}>💹 결산</span>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ fontSize:10, padding:'3px 10px', borderRadius:10, background:isOwner?'rgba(108,92,231,0.1)':'rgba(255,107,53,0.1)', color:isOwner?'#6C5CE7':'#FF6B35', fontWeight:700 }}>{isOwner?'대표':'관리자'}</span>
          {isOwner&&<><button onClick={()=>setShowSettings(true)} style={{ padding:'6px 12px', borderRadius:9, background:'rgba(108,92,231,0.08)', border:'1px solid rgba(108,92,231,0.2)', color:'#6C5CE7', fontSize:12, cursor:'pointer', fontWeight:600 }}>⚙️ 설정</button><button onClick={()=>setShowSheetMgr(true)} style={{ padding:'6px 12px', borderRadius:9, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', fontSize:12, cursor:'pointer' }}>📂 시트관리</button></>}
        </div>
      </div>

      {isOwner&&<div style={{ display:'flex', background:'#F4F6F9', borderRadius:12, padding:4, marginBottom:14, gap:3 }}><button onClick={()=>setViewMode('store')} style={{ flex:1, padding:'11px 0', borderRadius:9, border:'none', cursor:'pointer', fontSize:13, fontWeight:viewMode==='store'?700:400, background:viewMode==='store'?'#fff':'transparent', color:viewMode==='store'?'#1a1a2e':'#aaa', boxShadow:viewMode==='store'?'0 1px 6px rgba(0,0,0,0.09)':'none' }}>🏪 내 지점</button><button onClick={()=>setViewMode('all')} style={{ flex:1, padding:'11px 0', borderRadius:9, border:'none', cursor:'pointer', fontSize:13, fontWeight:viewMode==='all'?700:400, background:viewMode==='all'?'linear-gradient(135deg,#6C5CE7,#a29bfe)':'transparent', color:viewMode==='all'?'#fff':'#aaa', boxShadow:viewMode==='all'?'0 2px 8px rgba(108,92,231,0.3)':'none' }}>👑 전지점</button></div>}

      {viewMode==='all'&&isOwner&&<><div style={{ ...bx, padding:'12px 16px', marginBottom:14 }}><YearMonthPicker year={year} month={month-1} onChange={(y:number,m:number)=>{ setYear(y); setMonth(m+1) }} color="#6C5CE7" /></div><AdminView profileId={profileId} year={year} month={month} /></>}

      {viewMode==='store'&&(
        <>
          {isOwner&&settings&&<div style={{ padding:'8px 14px', background:'rgba(108,92,231,0.05)', borderRadius:10, border:'1px solid rgba(108,92,231,0.15)', marginBottom:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}><span style={{ fontSize:11, color:'#6C5CE7', fontWeight:600 }}>💳 카드수수료 {settings.card_fee_rate}% · {settings.business_type==='corporation'?'법인':'개인사업자'}</span><button onClick={()=>setShowSettings(true)} style={{ background:'none', border:'none', fontSize:11, color:'#aaa', cursor:'pointer' }}>변경 →</button></div>}
          {isOwner&&!settings&&<div onClick={()=>setShowSettings(true)} style={{ padding:'10px 14px', background:'rgba(255,107,53,0.06)', borderRadius:10, border:'1px dashed rgba(255,107,53,0.3)', marginBottom:12, cursor:'pointer', textAlign:'center', fontSize:12, color:'#FF6B35', fontWeight:600 }}>⚙️ 카드수수료율을 설정해주세요</div>}
          <div style={{ ...bx, padding:'12px 16px', marginBottom:14 }}><YearMonthPicker year={year} month={month-1} onChange={(y:number,m:number)=>{ setYear(y); setMonth(m+1) }} color="#FF6B35" /></div>

          <div style={{ overflowX:'auto', marginBottom:16, scrollbarWidth:'none' as const }}>
            <div style={{ display:'flex', gap:6, paddingBottom:4, minWidth:'max-content' }}>
              <button onClick={()=>setSelectedSheet('analysis')} style={{ padding:'8px 16px', borderRadius:20, border:selectedSheet==='analysis'?'2px solid #FF6B35':'1px solid #E8ECF0', background:selectedSheet==='analysis'?'rgba(255,107,53,0.1)':'#fff', color:selectedSheet==='analysis'?'#FF6B35':'#888', fontSize:12, fontWeight:selectedSheet==='analysis'?700:500, cursor:'pointer', flexShrink:0 }}>📊 수익분석</button>
              <button onClick={()=>setSelectedSheet('unclassified')} style={{ padding:'8px 14px', borderRadius:20, border:selectedSheet==='unclassified'?'2px solid #E84393':'1px solid #E8ECF0', background:selectedSheet==='unclassified'?'rgba(232,67,147,0.1)':'#fff', color:selectedSheet==='unclassified'?'#E84393':'#888', fontSize:12, fontWeight:selectedSheet==='unclassified'?700:500, cursor:'pointer', flexShrink:0 }}>
                📦 미분류{unclassifiedCount>0&&<span style={{ marginLeft:5, background:'#E84393', color:'#fff', borderRadius:10, fontSize:10, padding:'1px 6px', fontWeight:700 }}>{unclassifiedCount}</span>}
              </button>
              {activeSheets.filter(s=>s.sheet_type==='expense').map(sheet=>(
                <button key={sheet.id} onClick={()=>setSelectedSheet(sheet.id)} style={{ padding:'8px 14px', borderRadius:20, border:selectedSheet===sheet.id?'2px solid #6C5CE7':'1px solid #E8ECF0', background:selectedSheet===sheet.id?'rgba(108,92,231,0.1)':'#fff', color:selectedSheet===sheet.id?'#6C5CE7':'#888', fontSize:12, fontWeight:selectedSheet===sheet.id?700:500, cursor:'pointer', flexShrink:0 }}>{sheet.icon} {sheet.name}</button>
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