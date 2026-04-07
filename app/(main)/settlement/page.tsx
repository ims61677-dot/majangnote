'use client'
import { useEffect, useState, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import YearMonthPicker from '@/components/YearMonthPicker'

const bx = { background:'#fff', borderRadius:16, border:'1px solid #E8ECF0', padding:16, marginBottom:12, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width:'100%', padding:'8px 10px', borderRadius:8, background:'#F8F9FB', border:'1px solid #E0E4E8', color:'#1a1a2e', fontSize:13, outline:'none', boxSizing:'border-box' as const }
const lbl = { fontSize:11, color:'#888', marginBottom:4, display:'block' as const }

function numFmt(n: number) { return n.toLocaleString() }
function pct(v: number, total: number) { if (!total) return 0; return Math.round((v / total) * 1000) / 10 }

const PAYMENT_METHODS = ['카드','현금','계좌이체','기타']
const PAYMENT_COLORS: Record<string,string> = { '카드':'#6C5CE7','현금':'#00B894','계좌이체':'#2DC6D6','기타':'#aaa' }
const ICONS = ['📋','🌐','🛒','🥩','🐟','🍺','🥤','📦','👤','⚡','💳','🧾','💰','🏠','🚗','📱','🔧','✂️','🎯','💬']
const DEFAULT_OPT = { deposit_date: false, quantity: false, unit_price: false }

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

// ── ⚙️ 설정 + 👥 권한 모달 ────────────────────────────────
function SettingsModal({ storeId, settings, onSave, onClose }: {
  storeId: string; settings: any; onSave: (s: any) => void; onClose: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [tab, setTab] = useState<'settings'|'permissions'>('settings')
  const [bizType, setBizType] = useState(settings?.business_type || 'individual')
  const [cardRate, setCardRate] = useState<number|''>(settings?.card_fee_rate ?? 1.1)
  const [saving, setSaving] = useState(false)
  const [members, setMembers] = useState<any[]>([])
  const [permissions, setPermissions] = useState<any[]>([])
  const [loadingPerms, setLoadingPerms] = useState(true)

  useEffect(() => { if (tab === 'permissions') loadPermissions() }, [tab])

  async function loadPermissions() {
    setLoadingPerms(true)
    const [{ data: mems }, { data: perms }] = await Promise.all([
      supabase.from('store_members').select('*, profiles(*)').eq('store_id', storeId).eq('active', true).neq('role', 'owner'),
      supabase.from('settlement_permissions').select('*').eq('store_id', storeId),
    ])
    setMembers(mems || [])
    setPermissions(perms || [])
    setLoadingPerms(false)
  }

  async function handleSaveSettings() {
    if (!cardRate) return
    setSaving(true)
    const data = { store_id: storeId, business_type: bizType, card_fee_rate: Number(cardRate) }
    if (settings?.id) {
      await supabase.from('settlement_settings').update(data).eq('id', settings.id)
    } else {
      await supabase.from('settlement_settings').insert(data)
    }
    const { data: updated } = await supabase.from('settlement_settings').select('*').eq('store_id', storeId).maybeSingle()
    setSaving(false)
    onSave(updated)
    onClose()
  }

  async function togglePermission(member: any) {
    const existing = permissions.find(p => p.profile_id === member.profile_id)
    if (existing) {
      await supabase.from('settlement_permissions').delete().eq('id', existing.id)
      setPermissions(prev => prev.filter(p => p.id !== existing.id))
    } else {
      const { data } = await supabase.from('settlement_permissions').insert({
        store_id: storeId, profile_id: member.profile_id, granted_by: storeId
      }).select().single()
      if (data) setPermissions(prev => [...prev, data])
    }
  }

  const CARD_RATE_GUIDE = [
    { label: '개인사업자 (연매출 3억 이하)', rate: 0.5 },
    { label: '개인사업자 (연매출 3~5억)', rate: 1.1 },
    { label: '개인사업자 (5억 초과)', rate: 1.5 },
    { label: '법인', rate: 2.0 },
  ]

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'88vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>⚙️ 결산 설정</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>

        <div style={{ display:'flex', background:'#F4F6F9', borderRadius:10, padding:3, marginBottom:20, gap:2 }}>
          {[{ key:'settings', label:'💳 카드수수료 설정' }, { key:'permissions', label:'👥 관리자 권한' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              style={{ flex:1, padding:'8px 0', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight: tab===t.key?700:400, background: tab===t.key?'#fff':'transparent', color: tab===t.key?'#1a1a2e':'#aaa', boxShadow: tab===t.key?'0 1px 4px rgba(0,0,0,0.08)':'none' }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'settings' && (
          <div>
            <div style={{ marginBottom:16 }}>
              <span style={lbl}>사업자 유형</span>
              <div style={{ display:'flex', gap:8 }}>
                {[{ key:'individual', label:'👤 개인사업자' }, { key:'corporation', label:'🏢 법인' }].map(b => (
                  <button key={b.key} onClick={() => setBizType(b.key)}
                    style={{ flex:1, padding:'10px 0', borderRadius:10, border: bizType===b.key?'2px solid #6C5CE7':'1px solid #E8ECF0', background: bizType===b.key?'rgba(108,92,231,0.1)':'#F8F9FB', color: bizType===b.key?'#6C5CE7':'#888', fontSize:13, fontWeight: bizType===b.key?700:400, cursor:'pointer' }}>
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom:8 }}>
              <span style={lbl}>카드 수수료율 (%)</span>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input type="number" step="0.1" min="0" max="5" value={cardRate}
                  onChange={e => setCardRate(e.target.value===''?'':Number(e.target.value))}
                  style={{ ...inp, flex:1, fontSize:20, fontWeight:700, textAlign:'center' as const }} />
                <span style={{ fontSize:14, color:'#888', flexShrink:0 }}>%</span>
              </div>
            </div>

            <div style={{ background:'rgba(108,92,231,0.05)', borderRadius:12, padding:14, marginBottom:20 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#6C5CE7', marginBottom:10 }}>💡 카드수수료율 참고표 (탭하면 자동입력)</div>
              {CARD_RATE_GUIDE.map(g => (
                <div key={g.label} onClick={() => setCardRate(g.rate)}
                  style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 12px', borderRadius:9, marginBottom:4, cursor:'pointer', background: cardRate===g.rate?'rgba(108,92,231,0.12)':'transparent', border: cardRate===g.rate?'1px solid rgba(108,92,231,0.3)':'1px solid transparent', transition:'all 0.15s' }}>
                  <span style={{ fontSize:12, color: cardRate===g.rate?'#6C5CE7':'#555', fontWeight: cardRate===g.rate?700:400 }}>{g.label}</span>
                  <span style={{ fontSize:14, fontWeight:800, color: cardRate===g.rate?'#6C5CE7':'#888' }}>{g.rate}%</span>
                </div>
              ))}
              <div style={{ fontSize:10, color:'#bbb', marginTop:8 }}>※ 정확한 요율은 카드단말기 계약서 또는 VAN사에 확인하세요</div>
            </div>

            <button onClick={handleSaveSettings} disabled={saving||!cardRate}
              style={{ width:'100%', padding:'13px 0', borderRadius:12, background: cardRate?'linear-gradient(135deg,#6C5CE7,#a29bfe)':'#E8ECF0', border:'none', color: cardRate?'#fff':'#aaa', fontSize:14, fontWeight:700, cursor: cardRate?'pointer':'default' }}>
              {saving ? '저장 중...' : '설정 저장'}
            </button>
          </div>
        )}

        {tab === 'permissions' && (
          <div>
            <div style={{ padding:'10px 14px', background:'rgba(255,107,53,0.06)', borderRadius:10, border:'1px solid rgba(255,107,53,0.2)', marginBottom:16, fontSize:12, color:'#FF6B35', lineHeight:1.7 }}>
              💡 결산 메뉴는 기본적으로 대표만 볼 수 있어요.<br/>
              아래에서 관리자에게 결산 열람 권한을 부여할 수 있어요.
            </div>

            {loadingPerms ? (
              <div style={{ textAlign:'center', padding:32, color:'#bbb', fontSize:13 }}>불러오는 중...</div>
            ) : members.length === 0 ? (
              <div style={{ textAlign:'center', padding:32, color:'#bbb', fontSize:13 }}>
                <div style={{ fontSize:32, marginBottom:8 }}>👥</div>
                등록된 직원이 없어요
              </div>
            ) : (
              <div>
                {members.map(member => {
                  const hasPermi = permissions.some(p => p.profile_id === member.profile_id)
                  const roleLabel = member.role === 'manager' ? '관리자' : member.role === 'pt' ? 'PT' : '사원'
                  const name = member.profiles?.name || member.profiles?.nm || '이름없음'
                  return (
                    <div key={member.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 14px', background: hasPermi?'rgba(0,184,148,0.05)':'#F8F9FB', borderRadius:12, marginBottom:8, border:`1px solid ${hasPermi?'rgba(0,184,148,0.25)':'#E8ECF0'}`, transition:'all 0.2s' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ width:38, height:38, borderRadius:10, background: hasPermi?'linear-gradient(135deg,#00B894,#2DC6D6)':'#E8ECF0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:800, color: hasPermi?'#fff':'#aaa', flexShrink:0 }}>
                          {name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{name}</div>
                          <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>{roleLabel} {hasPermi && <span style={{ color:'#00B894', fontWeight:700 }}>· 결산 열람 가능</span>}</div>
                        </div>
                      </div>
                      <button onClick={() => togglePermission(member)}
                        style={{ padding:'8px 16px', borderRadius:10, border:'none', cursor:'pointer', fontSize:12, fontWeight:700, background: hasPermi?'linear-gradient(135deg,#00B894,#2DC6D6)':'#F4F6F9', color: hasPermi?'#fff':'#888', transition:'all 0.2s', minWidth:80 }}>
                        {hasPermi ? '✅ 허용됨' : '권한 부여'}
                      </button>
                    </div>
                  )
                })}
                <div style={{ marginTop:12, padding:'10px 14px', background:'#F8F9FB', borderRadius:10, border:'1px solid #E8ECF0', fontSize:11, color:'#aaa', lineHeight:1.7 }}>
                  ※ 권한 받은 관리자는 해당 지점 결산 데이터를 조회할 수 있어요<br/>
                  ※ 전지점 탭은 대표만 볼 수 있어요
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 항목 추가/수정 모달 ─────────────────────────────────────
function EntryModal({ sheet, entry, storeId, userName, year, month, favorites, onSave, onClose }: {
  sheet: any; entry: any|null; storeId: string; userName: string
  year: number; month: number; favorites: any[]; onSave: () => void; onClose: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const pad = (n: number) => String(n).padStart(2,'0')
  const opt = sheet.optional_fields || DEFAULT_OPT

  const [date, setDate] = useState(entry?.entry_date || `${year}-${pad(month)}-01`)
  const [itemName, setItemName] = useState(entry?.item_name || '')
  const [amount, setAmount] = useState<number|''>(entry?.amount || '')
  const [payment, setPayment] = useState(entry?.payment_method || '카드')
  const [taxInv, setTaxInv] = useState(entry?.has_tax_invoice || false)
  const [memo, setMemo] = useState(entry?.memo || '')
  const [depositDate, setDepositDate] = useState(entry?.deposit_date || '')
  const [qty, setQty] = useState<number|''>(entry?.quantity || '')
  const [unitPrice, setUnitPrice] = useState<number|''>(entry?.unit_price || '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (opt.quantity && opt.unit_price && qty && unitPrice)
      setAmount(Math.round(Number(qty) * Number(unitPrice)))
  }, [qty, unitPrice])

  async function handleSave() {
    if (!amount) { alert('금액을 입력해주세요'); return }
    setSaving(true)
    const data: any = {
      sheet_id: sheet.id, store_id: storeId, year, month,
      entry_date: date, item_name: itemName.trim() || null,
      amount: Number(amount), payment_method: payment,
      has_tax_invoice: taxInv, memo: memo.trim() || null,
      created_by: userName, updated_at: new Date().toISOString(),
      deposit_date: opt.deposit_date ? (depositDate || null) : null,
      quantity: opt.quantity ? (qty || null) : null,
      unit_price: opt.unit_price ? (unitPrice || null) : null,
    }
    if (entry?.id) await supabase.from('settlement_entries').update(data).eq('id', entry.id)
    else await supabase.from('settlement_entries').insert(data)

    if (itemName.trim()) {
      const fav = favorites.find(f => f.name === itemName.trim())
      if (fav) {
        await supabase.from('settlement_favorites').update({ use_count: (fav.use_count||0)+1, default_amount: Number(amount), default_payment: payment }).eq('id', fav.id)
      } else {
        try {
          await supabase.from('settlement_favorites').insert({ store_id: storeId, sheet_id: sheet.id, name: itemName.trim(), default_amount: Number(amount), default_payment: payment, use_count: 1 })
        } catch {}
      }
    }
    setSaving(false); onSave(); onClose()
  }

  async function handleDelete() {
    if (!entry?.id || !confirm('삭제할까요?')) return
    await supabase.from('settlement_entries').delete().eq('id', entry.id)
    onSave(); onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'92vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>{sheet.icon} {entry?'항목 수정':'항목 추가'} — {sheet.name}</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>

        {!entry && favorites.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, color:'#888', marginBottom:6 }}>⭐ 자주쓰는 품목 (탭하면 자동입력)</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {favorites.slice(0,8).map(f => (
                <button key={f.id} onClick={() => { setItemName(f.name); if(f.default_amount) setAmount(f.default_amount); if(f.default_payment) setPayment(f.default_payment) }}
                  style={{ padding:'5px 11px', borderRadius:20, border:'1px solid rgba(255,107,53,0.3)', background:'rgba(255,107,53,0.07)', color:'#FF6B35', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                  {f.name} {f.default_amount ? `(${numFmt(f.default_amount)}원)` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom:10 }}><span style={lbl}>날짜</span><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} /></div>
        {opt.deposit_date && <div style={{ marginBottom:10 }}><span style={lbl}>입금일자</span><input type="date" value={depositDate} onChange={e => setDepositDate(e.target.value)} style={inp} /></div>}
        <div style={{ marginBottom:10 }}><span style={lbl}>품목명 (선택)</span><input value={itemName} onChange={e => setItemName(e.target.value)} placeholder={`예: ${sheet.name} 구매`} style={inp} /></div>
        {(opt.quantity || opt.unit_price) && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            {opt.quantity && <div><span style={lbl}>수량</span><input type="number" step="0.1" value={qty} onChange={e => setQty(e.target.value===''?'':Number(e.target.value))} placeholder="0" style={inp} /></div>}
            {opt.unit_price && <div><span style={lbl}>단가 (원)</span><input type="number" value={unitPrice} onChange={e => setUnitPrice(e.target.value===''?'':Number(e.target.value))} placeholder="0" style={inp} /></div>}
          </div>
        )}
        <div style={{ marginBottom:10 }}>
          <span style={lbl}>금액 *</span>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value===''?'':Number(e.target.value))} placeholder="0" style={inp} />
            <span style={{ fontSize:11, color:'#aaa', flexShrink:0 }}>원</span>
          </div>
          {Number(amount)>0 && <div style={{ fontSize:11, color:'#FF6B35', marginTop:3, fontWeight:600 }}>{numFmt(Number(amount))}원</div>}
        </div>
        <div style={{ marginBottom:10 }}>
          <span style={lbl}>결제방법</span>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {PAYMENT_METHODS.map(m => (
              <button key={m} onClick={() => setPayment(m)}
                style={{ padding:'6px 12px', borderRadius:8, border: payment===m?`2px solid ${PAYMENT_COLORS[m]}`:'1px solid #E8ECF0', background: payment===m?`${PAYMENT_COLORS[m]}18`:'#F8F9FB', color: payment===m?PAYMENT_COLORS[m]:'#888', fontSize:12, fontWeight: payment===m?700:400, cursor:'pointer' }}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:10 }}>
          <span style={lbl}>세금계산서</span>
          <button onClick={() => setTaxInv((v:boolean)=>!v)}
            style={{ width:'100%', padding:'9px 0', borderRadius:8, border: taxInv?'2px solid #00B894':'1px solid #E8ECF0', background: taxInv?'rgba(0,184,148,0.1)':'#F8F9FB', color: taxInv?'#00B894':'#aaa', fontSize:13, fontWeight: taxInv?700:400, cursor:'pointer' }}>
            {taxInv ? '✅ 발행됨' : '⬜ 미발행'}
          </button>
        </div>
        <div style={{ marginBottom:16 }}><span style={lbl}>메모 (선택)</span><input value={memo} onChange={e => setMemo(e.target.value)} placeholder="메모" style={inp} /></div>
        <div style={{ display:'flex', gap:8 }}>
          {entry && <button onClick={handleDelete} style={{ padding:'12px 16px', borderRadius:12, background:'rgba(232,67,147,0.08)', border:'1px solid rgba(232,67,147,0.2)', color:'#E84393', fontSize:13, cursor:'pointer', fontWeight:600 }}>삭제</button>}
          <button onClick={handleSave} disabled={saving}
            style={{ flex:1, padding:'13px 0', borderRadius:12, background: saving?'#ddd':'linear-gradient(135deg,#FF6B35,#E84393)', border:'none', color:'#fff', fontSize:14, fontWeight:700, cursor: saving?'not-allowed':'pointer' }}>
            {saving ? '저장 중...' : entry ? '수정 저장' : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 시트 관리 모달 ─────────────────────────────────────────
function SheetManageModal({ sheets, storeId, onSave, onClose }: {
  sheets: any[]; storeId: string; onSave: () => void; onClose: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📋')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)
  const [editName, setEditName] = useState('')
  const [configId, setConfigId] = useState<string|null>(null)

  async function handleAdd() {
    if (!newName.trim()) return
    setSaving(true)
    const maxOrder = sheets.reduce((max, s) => Math.max(max, s.sort_order||0), 0)
    await supabase.from('settlement_sheets').insert({ store_id: storeId, name: newName.trim(), icon: newIcon, sheet_type: 'expense', sort_order: maxOrder+1 })
    setNewName(''); setSaving(false); onSave()
  }
  async function handleToggleField(sheet: any, field: string) {
    const current = sheet.optional_fields || DEFAULT_OPT
    await supabase.from('settlement_sheets').update({ optional_fields: { ...current, [field]: !current[field] } }).eq('id', sheet.id)
    onSave()
  }
  async function handleToggle(sheet: any) {
    await supabase.from('settlement_sheets').update({ is_active: !sheet.is_active }).eq('id', sheet.id); onSave()
  }
  async function handleRename(id: string) {
    if (!editName.trim()) return
    await supabase.from('settlement_sheets').update({ name: editName.trim() }).eq('id', id)
    setEditId(null); onSave()
  }
  async function handleDelete(sheet: any) {
    if (!confirm(`"${sheet.name}" 시트를 삭제할까요?\n모든 항목도 함께 삭제됩니다.`)) return
    await supabase.from('settlement_sheets').delete().eq('id', sheet.id); onSave()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', width:'100%', maxWidth:480, borderRadius:'20px 20px 0 0', padding:20, maxHeight:'88vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:15, fontWeight:700 }}>📂 시트 관리</span>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:'#aaa', cursor:'pointer' }}>✕</button>
        </div>
        {sheets.filter(s => s.sheet_type !== 'sales').map(sheet => {
          const opt = sheet.optional_fields || DEFAULT_OPT
          return (
            <div key={sheet.id} style={{ marginBottom:8 }}>
              <div style={{ padding:'10px 14px', background: sheet.is_active?'#fff':'#F8F9FB', borderRadius:10, border:`1px solid ${sheet.is_active?'#E8ECF0':'#F0F0F0'}` }}>
                {editId === sheet.id ? (
                  <div style={{ display:'flex', gap:6 }}>
                    <input value={editName} onChange={e => setEditName(e.target.value)} style={{ ...inp, flex:1 }} autoFocus />
                    <button onClick={() => handleRename(sheet.id)} style={{ padding:'6px 12px', borderRadius:8, background:'linear-gradient(135deg,#FF6B35,#E84393)', border:'none', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}>저장</button>
                    <button onClick={() => setEditId(null)} style={{ padding:'6px 10px', borderRadius:8, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', cursor:'pointer', fontSize:12 }}>취소</button>
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:18 }}>{sheet.icon}</span>
                    <span style={{ flex:1, fontSize:13, fontWeight:600, color: sheet.is_active?'#1a1a2e':'#aaa' }}>{sheet.name}</span>
                    <button onClick={() => setConfigId(configId===sheet.id?null:sheet.id)} style={{ background:'none', border:'none', fontSize:11, color:'#2DC6D6', cursor:'pointer' }}>⚙️ 필드</button>
                    <button onClick={() => { setEditId(sheet.id); setEditName(sheet.name) }} style={{ background:'none', border:'none', fontSize:11, color:'#6C5CE7', cursor:'pointer' }}>수정</button>
                    <button onClick={() => handleToggle(sheet)} style={{ padding:'2px 8px', borderRadius:6, border:`1px solid ${sheet.is_active?'rgba(0,184,148,0.3)':'#E8ECF0'}`, background: sheet.is_active?'rgba(0,184,148,0.08)':'#F4F6F9', color: sheet.is_active?'#00B894':'#aaa', fontSize:10, fontWeight:700, cursor:'pointer' }}>
                      {sheet.is_active ? '활성' : '비활성'}
                    </button>
                    <button onClick={() => handleDelete(sheet)} style={{ background:'none', border:'none', color:'#E84393', fontSize:11, cursor:'pointer' }}>삭제</button>
                  </div>
                )}
              </div>
              {configId === sheet.id && (
                <div style={{ padding:'12px 14px', background:'rgba(45,198,214,0.05)', borderRadius:10, border:'1px solid rgba(45,198,214,0.2)', marginTop:4 }}>
                  <div style={{ fontSize:11, color:'#2DC6D6', fontWeight:700, marginBottom:6 }}>선택 필드 (시트별 ON/OFF)</div>
                  <div style={{ fontSize:10, color:'#aaa', marginBottom:8 }}>기본 필드: 날짜, 품목명, 금액, 결제방법, 세금계산서, 메모 (항상 표시)</div>
                  {[{ key:'deposit_date', label:'📅 입금일자' },{ key:'quantity', label:'🔢 수량' },{ key:'unit_price', label:'💲 단가' }].map(({ key, label }) => (
                    <div key={key} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                      <span style={{ fontSize:12, color:'#555' }}>{label}</span>
                      <button onClick={() => handleToggleField(sheet, key)}
                        style={{ padding:'4px 14px', borderRadius:8, border:'none', cursor:'pointer', fontSize:11, fontWeight:700, background: opt[key]?'linear-gradient(135deg,#2DC6D6,#6C5CE7)':'#F4F6F9', color: opt[key]?'#fff':'#aaa' }}>
                        {opt[key] ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <div style={{ background:'rgba(255,107,53,0.04)', borderRadius:12, padding:14, border:'1px dashed rgba(255,107,53,0.3)', marginTop:8 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#FF6B35', marginBottom:10 }}>+ 새 시트 추가</div>
          <div style={{ marginBottom:8 }}><span style={lbl}>시트 이름</span><input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key==='Enter' && handleAdd()} placeholder="예: 포장재, 소모품" style={inp} /></div>
          <div style={{ marginBottom:12 }}>
            <span style={lbl}>아이콘</span>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              {ICONS.map(ic => (<button key={ic} onClick={() => setNewIcon(ic)} style={{ width:34, height:34, borderRadius:8, border: newIcon===ic?'2px solid #FF6B35':'1px solid #E8ECF0', background: newIcon===ic?'rgba(255,107,53,0.1)':'#F8F9FB', fontSize:17, cursor:'pointer' }}>{ic}</button>))}
            </div>
          </div>
          <button onClick={handleAdd} disabled={saving||!newName.trim()}
            style={{ width:'100%', padding:'11px 0', borderRadius:10, background: newName.trim()?'linear-gradient(135deg,#FF6B35,#E84393)':'#E8ECF0', border:'none', color: newName.trim()?'#fff':'#aaa', fontSize:13, fontWeight:700, cursor: newName.trim()?'pointer':'default' }}>
            {saving ? '추가 중...' : '시트 추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 수익분석 뷰 ────────────────────────────────────────────
function ProfitAnalysisView({ sheets, storeId, year, month, settings }: {
  sheets: any[]; storeId: string; year: number; month: number; settings: any
}) {
  const supabase = createSupabaseBrowserClient()
  const [entrySums, setEntrySums] = useState<Record<string,number>>({})
  const [salesByPlatform, setSalesByPlatform] = useState<Record<string,number>>({})
  const [feeEntries, setFeeEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [storeId, year, month])

  async function loadAll() {
    setLoading(true)
    const pad = (n: number) => String(n).padStart(2,'0')
    const from = `${year}-${pad(month)}-01`
    const to = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`
    const { data: entries } = await supabase.from('settlement_entries').select('sheet_id, amount').eq('store_id', storeId).eq('year', year).eq('month', month)
    const sums: Record<string,number> = {}
    ;(entries || []).forEach((e: any) => { sums[e.sheet_id] = (sums[e.sheet_id]||0) + (e.amount||0) })
    setEntrySums(sums)
    const feeSheet = sheets.find(s => s.name === '수수료')
    if (feeSheet) {
      const { data: feeData } = await supabase.from('settlement_entries').select('*').eq('sheet_id', feeSheet.id).eq('year', year).eq('month', month)
      setFeeEntries(feeData || [])
    } else setFeeEntries([])
    const { data: cls } = await supabase.from('closings').select('id').eq('store_id', storeId).gte('closing_date', from).lte('closing_date', to)
    if (cls && cls.length > 0) {
      const { data: sv } = await supabase.from('closing_sales').select('platform, amount').in('closing_id', cls.map((c: any) => c.id))
      const byPlatform: Record<string,number> = {}
      ;(sv || []).forEach((s: any) => { byPlatform[s.platform] = (byPlatform[s.platform]||0) + (s.amount||0) })
      setSalesByPlatform(byPlatform)
    } else setSalesByPlatform({})
    setLoading(false)
  }

  const cardRate = settings?.card_fee_rate ?? 1.1
  const DELIVERY_PLATFORMS = ['배달의민족','배민','쿠팡이츠','쿠팡','요기요']
  const pos = Object.entries(salesByPlatform).filter(([k]) => !DELIVERY_PLATFORMS.includes(k)).reduce((s,[,v]) => s+v, 0)
  const baemin = salesByPlatform['배달의민족'] || salesByPlatform['배민'] || 0
  const coupang = salesByPlatform['쿠팡이츠'] || salesByPlatform['쿠팡'] || 0
  const yogiyo = salesByPlatform['요기요'] || 0
  const cardFeeAuto = Math.round(pos * (cardRate / 100))
  function getFeeForPlatform(keywords: string[]) { return feeEntries.filter(e => keywords.some(kw => e.item_name?.includes(kw))).reduce((s, e) => s + (e.amount||0), 0) }
  const baeminFee = getFeeForPlatform(['배민','배달의민족'])
  const coupangFee = getFeeForPlatform(['쿠팡'])
  const yogiyoFee = getFeeForPlatform(['요기요'])
  const feeSheetTotal = feeEntries.reduce((s,e) => s+(e.amount||0), 0)
  const totalFee = cardFeeAuto + feeSheetTotal
  const totalSales = Object.values(salesByPlatform).reduce((s,v) => s+v, 0)
  const netSales = totalSales - totalFee
  const expenseSheets = sheets.filter(s => s.sheet_type === 'expense' && s.is_active)
  const totalExpense = expenseSheets.reduce((s, sheet) => s + (entrySums[sheet.id]||0), 0)
  const netProfit = totalSales - totalExpense
  const profitRate = totalSales > 0 ? Math.round((netProfit / totalSales) * 1000) / 10 : 0
  const materialNames = ['인터넷발주','마트발주','육류','수산물','주류','음료','기타재료']
  const fixedNames = ['인건비','임대료','공과금','기타관리비']
  const materialTotal = expenseSheets.filter(s => materialNames.includes(s.name)).reduce((s,sh) => s+(entrySums[sh.id]||0), 0)
  const fixedTotal = expenseSheets.filter(s => fixedNames.includes(s.name)).reduce((s,sh) => s+(entrySums[sh.id]||0), 0)
  const topExpense = expenseSheets.filter(s => entrySums[s.id]>0).sort((a,b) => (entrySums[b.id]||0)-(entrySums[a.id]||0))[0]

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'#bbb', fontSize:13 }}>불러오는 중...</div>

  return (
    <div>
      <div style={{ ...bx, border:`1.5px solid ${netProfit>=0?'rgba(0,184,148,0.4)':'rgba(232,67,147,0.4)'}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
          <div>
            <div style={{ fontSize:12, color:'#888', marginBottom:4 }}>{year}년 {month}월 수익분석</div>
            <div style={{ fontSize:10, color:'#aaa' }}>{settings?.business_type==='corporation'?'법인':'개인사업자'} · 카드수수료 {cardRate}%</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:30, fontWeight:900, color: netProfit>=0?'#00B894':'#E84393', lineHeight:1.1 }}>{numFmt(netProfit)}원</div>
            <div style={{ fontSize:14, fontWeight:700, color: netProfit>=0?'#00B894':'#E84393' }}>수익률 {profitRate}%</div>
          </div>
        </div>
        <div style={{ height:12, background:'#F0F2F5', borderRadius:8, overflow:'hidden', marginBottom:6 }}>
          <div style={{ height:12, borderRadius:8, width:`${Math.min(Math.max(profitRate,0),50)*2}%`, background: profitRate>=20?'linear-gradient(90deg,#00B894,#00cec9)':profitRate>=10?'linear-gradient(90deg,#FF6B35,#FDC400)':'linear-gradient(90deg,#E84393,#FF6B35)', transition:'width 0.4s' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
          <span style={{ fontSize:10, color:'#aaa' }}>0%</span>
          <span style={{ fontSize:11, fontWeight:700, color: profitRate>=20?'#00B894':profitRate>=10?'#FF6B35':profitRate>=0?'#E67E22':'#E84393' }}>
            {profitRate>=20?'🎉 우수 (20%+)':profitRate>=10?'✅ 보통 (10~20%)':profitRate>=0?'⚠️ 낮음 (0~10%)':'🚨 적자'}
          </span>
          <span style={{ fontSize:10, color:'#aaa' }}>50%</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          {[{ l:'총 매출', v:totalSales, c:'#00B894', bg:'rgba(0,184,148,0.08)' },{ l:'총 지출', v:totalExpense, c:'#E84393', bg:'rgba(232,67,147,0.06)' },{ l:'순수익', v:netProfit, c: netProfit>=0?'#00B894':'#E84393', bg: netProfit>=0?'rgba(0,184,148,0.08)':'rgba(232,67,147,0.06)' }].map(item => (
            <div key={item.l} style={{ padding:'10px 8px', background:item.bg, borderRadius:10, textAlign:'center' }}>
              <div style={{ fontSize:10, color:'#aaa', marginBottom:3 }}>{item.l}</div>
              <div style={{ fontSize:13, fontWeight:800, color:item.c }}>{Math.abs(item.v)>=10000?`${(item.v/10000).toFixed(0)}만`:`${numFmt(item.v)}`}원</div>
            </div>
          ))}
        </div>
      </div>

      <div style={bx}>
        <div style={{ fontSize:13, fontWeight:800, color:'#1a1a2e', marginBottom:14 }}>💰 매출 상세</div>
        {pos > 0 && (
          <div style={{ marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:12, fontWeight:700, color:'#555' }}>🏪 매장 매출 (POS/현금 등)</span>
              <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{numFmt(pos)}원</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 12px', background:'rgba(232,67,147,0.05)', borderRadius:8, border:'1px solid rgba(232,67,147,0.15)' }}>
              <span style={{ fontSize:11, color:'#E84393' }}>카드수수료 자동계산 ({cardRate}%)</span>
              <span style={{ fontSize:11, fontWeight:700, color:'#E84393' }}>-{numFmt(cardFeeAuto)}원</span>
            </div>
          </div>
        )}
        {[{ name:'배달의민족', sales:baemin, fee:baeminFee, icon:'🛵' },{ name:'쿠팡이츠', sales:coupang, fee:coupangFee, icon:'🟡' },{ name:'요기요', sales:yogiyo, fee:yogiyoFee, icon:'🔴' }].filter(p => p.sales > 0 || p.fee > 0).map(p => (
          <div key={p.name} style={{ marginBottom:12 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
              <span style={{ fontSize:12, fontWeight:700, color:'#555' }}>{p.icon} {p.name}</span>
              <span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{numFmt(p.sales)}원</span>
            </div>
            {p.fee > 0 && (<>
              <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 12px', background:'rgba(232,67,147,0.05)', borderRadius:8, border:'1px solid rgba(232,67,147,0.15)', marginBottom:4 }}>
                <span style={{ fontSize:11, color:'#E84393' }}>수수료 (수수료 시트 기준)</span>
                <span style={{ fontSize:11, fontWeight:700, color:'#E84393' }}>-{numFmt(p.fee)}원</span>
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end' }}><span style={{ fontSize:10, color:'#aaa' }}>순수령: </span><span style={{ fontSize:11, fontWeight:700, color:'#6C5CE7', marginLeft:4 }}>{numFmt(p.sales - p.fee)}원</span></div>
            </>)}
          </div>
        ))}
        {Object.entries(salesByPlatform).filter(([k]) => !DELIVERY_PLATFORMS.includes(k)).map(([k,v]) => v > 0 && (
          <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}><span style={{ fontSize:12, color:'#888' }}>📱 {k}</span><span style={{ fontSize:12, fontWeight:600, color:'#1a1a2e' }}>{numFmt(v)}원</span></div>
        ))}
        {totalSales === 0 && <div style={{ textAlign:'center', padding:'16px 0', color:'#bbb', fontSize:12 }}>마감일지에서 매출 입력 시 자동 연동됩니다</div>}
        {totalSales > 0 && (
          <div style={{ borderTop:'2px dashed #E8ECF0', paddingTop:10, marginTop:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><span style={{ fontSize:12, color:'#555' }}>총 수수료</span><span style={{ fontSize:12, fontWeight:700, color:'#E84393' }}>-{numFmt(totalFee)}원 ({pct(totalFee, totalSales)}%)</span></div>
            <div style={{ display:'flex', justifyContent:'space-between' }}><span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>수수료 차감 후 실수령</span><span style={{ fontSize:15, fontWeight:800, color:'#6C5CE7' }}>{numFmt(netSales)}원</span></div>
          </div>
        )}
      </div>

      <div style={bx}>
        <div style={{ fontSize:13, fontWeight:800, color:'#1a1a2e', marginBottom:14 }}>💸 지출 상세 분석</div>
        {expenseSheets.map(sheet => {
          const amt = entrySums[sheet.id] || 0
          const ratio = pct(amt, totalSales)
          const ofExpense = pct(amt, totalExpense)
          const isHigh = ratio > 30
          return (
            <div key={sheet.id} style={{ marginBottom: amt>0?14:6 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: amt>0?4:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                  <span style={{ fontSize:16 }}>{sheet.icon}</span>
                  <span style={{ fontSize:12, color: amt>0?'#555':'#ccc', fontWeight: amt>0?600:400 }}>{sheet.name}</span>
                  {isHigh && amt>0 && <span style={{ fontSize:9, background:'rgba(232,67,147,0.15)', color:'#E84393', padding:'1px 5px', borderRadius:6, fontWeight:700 }}>⚠️ 비중 높음</span>}
                </div>
                <div style={{ textAlign:'right' }}>
                  {amt>0 ? (<><span style={{ fontSize:13, fontWeight:700, color:'#1a1a2e' }}>{numFmt(amt)}원</span>{totalSales>0 && <span style={{ fontSize:10, color:'#aaa', marginLeft:5 }}>매출대비 {ratio}%</span>}</>) : <span style={{ fontSize:11, color:'#ddd' }}>미입력</span>}
                </div>
              </div>
              {amt > 0 && (<>
                <div style={{ height:7, background:'#F0F2F5', borderRadius:4 }}><div style={{ height:7, borderRadius:4, background: isHigh?'linear-gradient(90deg,#E84393,#FF6B35)':'linear-gradient(90deg,#FF6B35,#FDC400)', width:`${Math.min(ratio*2, 100)}%`, transition:'width 0.3s' }} /></div>
                {totalExpense>0 && <div style={{ fontSize:9, color:'#bbb', marginTop:2, textAlign:'right' }}>지출 내 비중 {ofExpense}%</div>}
              </>)}
            </div>
          )
        })}
        <div style={{ display:'flex', justifyContent:'space-between', paddingTop:12, borderTop:'2px solid #E8ECF0' }}><span style={{ fontSize:13, fontWeight:700 }}>지출 합계</span><span style={{ fontSize:18, fontWeight:800, color:'#E84393' }}>{numFmt(totalExpense)}원</span></div>
      </div>

      {totalExpense > 0 && (
        <div style={bx}>
          <div style={{ fontSize:13, fontWeight:800, color:'#1a1a2e', marginBottom:14 }}>🔍 결산 분석</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
            {[{ l:'재료비 합계', v:materialTotal, pv:pct(materialTotal,totalSales), color:'#6C5CE7', warn: pct(materialTotal,totalSales)>35, note:'권장 35% 이하' },{ l:'인건비+고정비', v:fixedTotal, pv:pct(fixedTotal,totalSales), color:'#E84393', warn: pct(fixedTotal,totalSales)>30, note:'권장 30% 이하' }].map(item => (
              <div key={item.l} style={{ padding:'12px', background:'#F8F9FB', borderRadius:12, border:`1px solid ${item.warn&&totalSales>0?'rgba(232,67,147,0.3)':'#E8ECF0'}` }}>
                <div style={{ fontSize:11, color:'#888', marginBottom:4 }}>{item.l}</div>
                <div style={{ fontSize:16, fontWeight:800, color:item.color }}>{numFmt(item.v)}원</div>
                {totalSales>0 && (<><div style={{ fontSize:11, fontWeight:600, color: item.warn?'#E84393':'#aaa' }}>매출 대비 {item.pv}%</div><div style={{ fontSize:9, color:'#bbb', marginTop:2 }}>{item.note}</div></>)}
              </div>
            ))}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {topExpense && (<div style={{ padding:'10px 14px', background:'rgba(108,92,231,0.07)', borderRadius:10, border:'1px solid rgba(108,92,231,0.2)' }}><span style={{ fontSize:12, fontWeight:700, color:'#6C5CE7' }}>💡 최대 지출 항목</span><span style={{ fontSize:12, color:'#555', marginLeft:8 }}>{topExpense.icon} {topExpense.name} — {numFmt(entrySums[topExpense.id]||0)}원 ({pct(entrySums[topExpense.id]||0, totalSales)}%)</span></div>)}
            {totalSales>0 && pct(materialTotal,totalSales)>35 && (<div style={{ padding:'10px 14px', background:'rgba(232,67,147,0.07)', borderRadius:10, border:'1px solid rgba(232,67,147,0.2)' }}><span style={{ fontSize:12, fontWeight:700, color:'#E84393' }}>⚠️ 재료비 비중이 {pct(materialTotal,totalSales)}%로 높아요</span><div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>재료비는 매출의 30~35% 이하 유지를 권장해요</div></div>)}
            {profitRate < 10 && totalSales > 0 && (<div style={{ padding:'10px 14px', background:'rgba(253,196,0,0.1)', borderRadius:10, border:'1px solid rgba(253,196,0,0.3)' }}><span style={{ fontSize:12, fontWeight:700, color:'#B8860B' }}>⚠️ 수익률이 {profitRate}%로 낮아요</span><div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>지출 중 줄일 수 있는 항목이 있는지 확인해보세요</div></div>)}
            {expenseSheets.filter(s => !entrySums[s.id]).length > 0 && (<div style={{ padding:'10px 14px', background:'#F8F9FB', borderRadius:10, border:'1px solid #E8ECF0' }}><span style={{ fontSize:12, fontWeight:700, color:'#aaa' }}>📋 미입력 시트</span><span style={{ fontSize:11, color:'#bbb', marginLeft:6 }}>{expenseSheets.filter(s => !entrySums[s.id]).map(s => s.name).join(', ')}</span></div>)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 시트 뷰 ────────────────────────────────────────────────
function SheetView({ sheet, storeId, userName, year, month }: { sheet: any; storeId: string; userName: string; year: number; month: number }) {
  const supabase = createSupabaseBrowserClient()
  const [entries, setEntries] = useState<any[]>([])
  const [favorites, setFavorites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editEntry, setEditEntry] = useState<any>(null)

  useEffect(() => { loadEntries(); loadFavorites() }, [sheet.id, year, month])

  async function loadEntries() { setLoading(true); const { data } = await supabase.from('settlement_entries').select('*').eq('sheet_id', sheet.id).eq('year', year).eq('month', month).order('entry_date', { ascending: false }).order('created_at', { ascending: false }); setEntries(data || []); setLoading(false) }
  async function loadFavorites() { const { data } = await supabase.from('settlement_favorites').select('*').eq('sheet_id', sheet.id).order('use_count', { ascending: false }); setFavorites(data || []) }
  async function deleteFavorite(id: string) { await supabase.from('settlement_favorites').delete().eq('id', id); loadFavorites() }

  const total = useMemo(() => entries.reduce((s, e) => s+(e.amount||0), 0), [entries])
  const taxCount = entries.filter(e => e.has_tax_invoice).length
  const grouped = useMemo(() => {
    const map: Record<string,any[]> = {}
    entries.forEach(e => { if (!map[e.entry_date]) map[e.entry_date]=[]; map[e.entry_date].push(e) })
    return Object.entries(map).sort((a,b) => b[0].localeCompare(a[0]))
  }, [entries])

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'#bbb', fontSize:13 }}>불러오는 중...</div>

  return (
    <div>
      <div style={{ ...bx, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <div style={{ fontSize:11, color:'#aaa' }}>{year}년 {month}월 합계</div>
          <div style={{ fontSize:24, fontWeight:900, color:'#FF6B35' }}>{numFmt(total)}원</div>
          <div style={{ display:'flex', gap:8, marginTop:4 }}>
            <span style={{ fontSize:11, color:'#bbb' }}>총 {entries.length}건</span>
            {taxCount>0 && <span style={{ fontSize:11, color:'#00B894', fontWeight:600 }}>세금계산서 {taxCount}건</span>}
          </div>
        </div>
        <button onClick={() => { setEditEntry(null); setShowModal(true) }} style={{ padding:'12px 18px', borderRadius:12, background:'linear-gradient(135deg,#FF6B35,#E84393)', border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ 항목 추가</button>
      </div>

      {favorites.length > 0 && (
        <div style={{ ...bx }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#1a1a2e', marginBottom:8 }}>⭐ 자주쓰는 품목 ({favorites.length}개)</div>
          {favorites.map(f => (
            <div key={f.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 12px', background:'rgba(255,107,53,0.04)', borderRadius:9, border:'1px solid rgba(255,107,53,0.12)', marginBottom:4 }}>
              <div><span style={{ fontSize:12, fontWeight:600, color:'#1a1a2e' }}>{f.name}</span><span style={{ fontSize:10, color:'#aaa', marginLeft:8 }}>총 {f.use_count}회 · 최근 {numFmt(f.default_amount||0)}원</span></div>
              <button onClick={() => deleteFavorite(f.id)} style={{ background:'none', border:'none', fontSize:10, color:'#E84393', cursor:'pointer' }}>삭제</button>
            </div>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'#bbb' }}>
          <div style={{ fontSize:40, marginBottom:10 }}>{sheet.icon}</div>
          <div style={{ fontSize:13, color:'#ccc', marginBottom:4 }}>{year}년 {month}월 항목이 없어요</div>
          <div style={{ fontSize:11, color:'#ddd' }}>+ 항목 추가를 눌러 시작하세요</div>
        </div>
      ) : grouped.map(([date, items]) => {
        const d = new Date(date+'T00:00:00')
        const dow = ['일','월','화','수','목','금','토'][d.getDay()]
        const isSun = d.getDay()===0; const isSat = d.getDay()===6
        const dayTotal = items.reduce((s,e) => s+(e.amount||0), 0)
        return (
          <div key={date} style={{ marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
              <span style={{ fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:20, background:'rgba(108,92,231,0.08)', color: isSun?'#E84393':isSat?'#2DC6D6':'#6C5CE7' }}>{d.getMonth()+1}월 {d.getDate()}일 ({dow})</span>
              <span style={{ fontSize:13, fontWeight:700, color:'#FF6B35' }}>{numFmt(dayTotal)}원</span>
            </div>
            {items.map(entry => (
              <div key={entry.id} onClick={() => { setEditEntry(entry); setShowModal(true) }}
                style={{ background:'#fff', borderRadius:12, border:'1px solid #E8ECF0', padding:'11px 14px', marginBottom:6, cursor:'pointer', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom: entry.memo?4:0 }}>
                      {entry.item_name && <span style={{ fontSize:13, fontWeight:600, color:'#1a1a2e' }}>{entry.item_name}</span>}
                      <span style={{ fontSize:10, padding:'1px 7px', borderRadius:10, background:`${PAYMENT_COLORS[entry.payment_method]||'#aaa'}18`, color:PAYMENT_COLORS[entry.payment_method]||'#aaa', fontWeight:600 }}>{entry.payment_method}</span>
                      {entry.has_tax_invoice && <span style={{ fontSize:10, color:'#00B894', fontWeight:700 }}>✅ 세금계산서</span>}
                      {entry.deposit_date && <span style={{ fontSize:10, color:'#6C5CE7' }}>입금 {entry.deposit_date.slice(5)}</span>}
                    </div>
                    {entry.memo && <div style={{ fontSize:11, color:'#aaa' }}>📝 {entry.memo}</div>}
                    {entry.quantity && <div style={{ fontSize:10, color:'#bbb' }}>수량 {entry.quantity} × 단가 {numFmt(entry.unit_price||0)}원</div>}
                  </div>
                  <div style={{ textAlign:'right', marginLeft:12, flexShrink:0 }}><div style={{ fontSize:16, fontWeight:800, color:'#1a1a2e' }}>{numFmt(entry.amount)}원</div></div>
                </div>
              </div>
            ))}
          </div>
        )
      })}

      {showModal && (
        <EntryModal sheet={sheet} entry={editEntry} storeId={storeId} userName={userName} year={year} month={month} favorites={favorites}
          onSave={() => { loadEntries(); loadFavorites() }}
          onClose={() => { setShowModal(false); setEditEntry(null) }} />
      )}
    </div>
  )
}

// ── 매출 뷰 ────────────────────────────────────────────────
function SalesView({ storeId, year, month }: { storeId: string; year: number; month: number }) {
  const supabase = createSupabaseBrowserClient()
  const [dailySales, setDailySales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { loadSales() }, [storeId, year, month])
  async function loadSales() {
    setLoading(true)
    const pad = (n:number) => String(n).padStart(2,'0')
    const from = `${year}-${pad(month)}-01`; const to = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`
    const { data: cls } = await supabase.from('closings').select('id, closing_date').eq('store_id', storeId).gte('closing_date', from).lte('closing_date', to).order('closing_date', { ascending: false })
    if (!cls?.length) { setDailySales([]); setLoading(false); return }
    const { data: sv } = await supabase.from('closing_sales').select('*').in('closing_id', cls.map((c:any)=>c.id))
    setDailySales(cls.map((cl:any) => { const platforms = (sv||[]).filter((s:any)=>s.closing_id===cl.id); return { ...cl, total: platforms.reduce((s:number,p:any)=>s+(p.amount||0),0), platforms } }))
    setLoading(false)
  }
  const monthTotal = dailySales.reduce((s,d)=>s+d.total,0)
  const avgDaily = dailySales.length>0 ? Math.round(monthTotal/dailySales.length) : 0
  if (loading) return <div style={{ textAlign:'center', padding:40, color:'#bbb', fontSize:13 }}>불러오는 중...</div>
  return (
    <div>
      <div style={bx}>
        <div style={{ fontSize:11, color:'#aaa', marginBottom:2 }}>{year}년 {month}월 총 매출</div>
        <div style={{ fontSize:26, fontWeight:900, color:'#00B894', marginBottom:4 }}>{numFmt(monthTotal)}원</div>
        <div style={{ display:'flex', gap:12 }}><span style={{ fontSize:11, color:'#bbb' }}>마감 {dailySales.length}일</span>{avgDaily>0 && <span style={{ fontSize:11, color:'#6C5CE7', fontWeight:600 }}>일평균 {numFmt(avgDaily)}원</span>}</div>
        <div style={{ marginTop:8, padding:'7px 12px', background:'rgba(0,184,148,0.07)', borderRadius:8, fontSize:11, color:'#00B894', fontWeight:600 }}>✅ 마감일지 데이터 자동 연동</div>
      </div>
      {dailySales.length===0 ? <div style={{ textAlign:'center', padding:'60px 0', color:'#bbb' }}><div style={{ fontSize:36, marginBottom:8 }}>💰</div><div style={{ fontSize:12 }}>마감일지에서 매출 입력 시 자동 표시됩니다</div></div>
      : dailySales.map(day => {
        const d = new Date(day.closing_date+'T00:00:00'); const dow = ['일','월','화','수','목','금','토'][d.getDay()]; const isSun = d.getDay()===0; const isSat = d.getDay()===6
        return (
          <div key={day.id} style={{ background:'#fff', borderRadius:12, border:'1px solid rgba(0,184,148,0.2)', padding:'11px 14px', marginBottom:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: day.platforms.filter((p:any)=>p.amount>0).length>0?8:0 }}>
              <span style={{ fontSize:13, fontWeight:700, color: isSun?'#E84393':isSat?'#2DC6D6':'#1a1a2e' }}>{d.getMonth()+1}월 {d.getDate()}일 ({dow})</span>
              <span style={{ fontSize:16, fontWeight:800, color:'#00B894' }}>{numFmt(day.total)}원</span>
            </div>
            {day.platforms.filter((p:any)=>p.amount>0).length>0 && <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>{day.platforms.filter((p:any)=>p.amount>0).map((p:any) => <span key={p.id} style={{ fontSize:10, color:'#888', background:'#F4F6F9', padding:'2px 8px', borderRadius:8 }}>{p.platform} {numFmt(p.amount)}원</span>)}</div>}
          </div>
        )
      })}
    </div>
  )
}

// ── 전지점 뷰 ──────────────────────────────────────────────
function AdminView({ profileId, year, month }: { profileId: string; year: number; month: number }) {
  const supabase = createSupabaseBrowserClient()
  const [stores, setStores] = useState<any[]>([])
  const [storeData, setStoreData] = useState<Record<string,any>>({})
  const [loading, setLoading] = useState(true)
  useEffect(() => { loadAll() }, [profileId, year, month])
  async function loadAll() {
    setLoading(true)
    const { data: members } = await supabase.from('store_members').select('*, stores(*)').eq('profile_id', profileId).eq('active', true)
    const storeList = (members||[]).map((m:any) => m.stores).filter(Boolean)
    setStores(storeList)
    const pad = (n:number)=>String(n).padStart(2,'0')
    const from = `${year}-${pad(month)}-01`; const to = `${year}-${pad(month)}-${pad(new Date(year,month,0).getDate())}`
    const result: Record<string,any> = {}
    await Promise.all(storeList.map(async (store:any) => {
      const sid = store.id
      const [{ data: cls }, { data: entries }, { data: sheets }, { data: settings }] = await Promise.all([
        supabase.from('closings').select('id').eq('store_id', sid).gte('closing_date', from).lte('closing_date', to),
        supabase.from('settlement_entries').select('sheet_id, amount').eq('store_id', sid).eq('year', year).eq('month', month),
        supabase.from('settlement_sheets').select('id, name, icon').eq('store_id', sid).eq('is_active', true).eq('sheet_type','expense').order('sort_order'),
        supabase.from('settlement_settings').select('*').eq('store_id', sid).maybeSingle(),
      ])
      let sales = 0
      if (cls?.length) { const { data: sv } = await supabase.from('closing_sales').select('amount').in('closing_id', cls.map((c:any)=>c.id)); sales = (sv||[]).reduce((s:number,r:any)=>s+(r.amount||0), 0) }
      const sums: Record<string,number> = {}
      ;(entries||[]).forEach((e:any) => { sums[e.sheet_id]=(sums[e.sheet_id]||0)+(e.amount||0) })
      const expense = Object.values(sums).reduce((s:number,v:any)=>s+(v as number), 0)
      result[sid] = { sales, expense, sheets: (sheets||[]).map((sh:any) => ({ ...sh, amount: sums[sh.id]||0 })), settings: settings||null }
    }))
    setStoreData(result); setLoading(false)
  }
  async function exportExcel() {
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook(); const pad = (n:number)=>String(n).padStart(2,'0')
      const ws = wb.addWorksheet(`${year}년${pad(month)}월 요약`)
      ws.addRow(['지점명','총매출','총지출','순수익','수익률(%)','사업자유형'])
      ws.getRow(1).eachCell(cell => { cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF1A1A2E'}}; cell.font={bold:true,color:{argb:'FFFFFFFF'}}; cell.alignment={horizontal:'center'} })
      stores.forEach((store:any) => { const d = storeData[store.id]; if (!d) return; const net = d.sales - d.expense; const rate = d.sales>0 ? Math.round((net/d.sales)*1000)/10 : 0; ws.addRow([store.name, d.sales, d.expense, net, rate, d.settings?.business_type==='corporation'?'법인':'개인사업자']) })
      ws.getColumn(2).numFmt='#,##0'; ws.getColumn(3).numFmt='#,##0'; ws.getColumn(4).numFmt='#,##0'; ws.columns.forEach(col => { col.width=16 })
      stores.forEach((store:any) => {
        const d = storeData[store.id]; if (!d) return
        const wsDetail = wb.addWorksheet(store.name.slice(0,31))
        wsDetail.addRow(['항목','금액(원)','매출대비(%)'])
        wsDetail.getRow(1).eachCell(cell => { cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF2C3E50'}}; cell.font={bold:true,color:{argb:'FFFFFFFF'}} })
        wsDetail.addRow(['📊 총 매출', d.sales, 100])
        d.sheets.forEach((sh:any) => { const r = d.sales>0 ? Math.round((sh.amount/d.sales)*1000)/10 : 0; wsDetail.addRow([`${sh.icon} ${sh.name}`, sh.amount, r]) })
        wsDetail.addRow(['💰 순수익', d.sales-d.expense, d.sales>0?Math.round(((d.sales-d.expense)/d.sales)*1000)/10:0])
        wsDetail.getColumn(2).numFmt='#,##0'; wsDetail.columns.forEach(col => { col.width=20 })
      })
      const buf = await wb.xlsx.writeBuffer()
      const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=`결산_${year}년${pad(month)}월.xlsx`; a.click(); URL.revokeObjectURL(url)
    } catch(e:any) { alert('내보내기 실패: '+(e?.message||'다시 시도해주세요')) }
  }
  if (loading) return <div style={{ textAlign:'center', padding:48, color:'#bbb', fontSize:13 }}>전 지점 결산 불러오는 중...</div>
  const totSales = stores.reduce((s,st) => s+(storeData[st.id]?.sales||0), 0)
  const totExpense = stores.reduce((s,st) => s+(storeData[st.id]?.expense||0), 0)
  return (
    <div>
      <div style={{ ...bx, border:'1.5px solid rgba(108,92,231,0.3)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:800, color:'#1a1a2e' }}>👑 {year}년 {month}월 전지점 합산</div>
          <button onClick={exportExcel} style={{ padding:'7px 14px', borderRadius:10, background:'rgba(0,184,148,0.1)', border:'1px solid rgba(0,184,148,0.3)', color:'#00B894', fontSize:12, fontWeight:700, cursor:'pointer' }}>📥 엑셀</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          {[{ l:'전체 매출', v:totSales, c:'#00B894', bg:'rgba(0,184,148,0.08)' },{ l:'전체 지출', v:totExpense, c:'#E84393', bg:'rgba(232,67,147,0.06)' },{ l:'전체 순수익', v:totSales-totExpense, c:(totSales-totExpense)>=0?'#00B894':'#E84393', bg:(totSales-totExpense)>=0?'rgba(0,184,148,0.08)':'rgba(232,67,147,0.06)' }].map(item => (
            <div key={item.l} style={{ padding:'12px 8px', background:item.bg, borderRadius:12, textAlign:'center' }}><div style={{ fontSize:10, color:'#aaa', marginBottom:3 }}>{item.l}</div><div style={{ fontSize:13, fontWeight:800, color:item.c }}>{Math.abs(item.v)>=10000?`${(item.v/10000).toFixed(0)}만`:`${numFmt(item.v)}`}원</div></div>
          ))}
        </div>
      </div>
      {stores.map((store:any) => {
        const d = storeData[store.id]; if (!d) return null
        const net = d.sales - d.expense; const profR = d.sales>0 ? Math.round((net/d.sales)*1000)/10 : 0
        return (
          <div key={store.id} style={{ ...bx, border:`1.5px solid ${net>=0?'rgba(0,184,148,0.3)':'rgba(232,67,147,0.3)'}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div><span style={{ fontSize:14, fontWeight:800, color:'#1a1a2e' }}>🏪 {store.name}</span><span style={{ fontSize:10, color:'#aaa', marginLeft:8, background:'#F4F6F9', padding:'2px 7px', borderRadius:5 }}>{d.settings?.business_type==='corporation'?'법인':'개인사업자'}</span></div>
              <span style={{ fontSize:13, fontWeight:700, padding:'4px 12px', borderRadius:8, background: net>=0?'rgba(0,184,148,0.12)':'rgba(232,67,147,0.1)', color: net>=0?'#00B894':'#E84393' }}>수익률 {profR}%</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
              {[{ l:'매출', v:d.sales, c:'#00B894' },{ l:'지출', v:d.expense, c:'#E84393' },{ l:'순수익', v:net, c:net>=0?'#00B894':'#E84393' }].map(item => (
                <div key={item.l} style={{ textAlign:'center', padding:'10px 6px', background:'#F8F9FB', borderRadius:10 }}><div style={{ fontSize:10, color:'#aaa' }}>{item.l}</div><div style={{ fontSize:14, fontWeight:800, color:item.c, marginTop:3 }}>{Math.abs(item.v)>=10000?`${(item.v/10000).toFixed(0)}만`:`${numFmt(item.v)}`}원</div></div>
              ))}
            </div>
            {d.sheets.filter((sh:any)=>sh.amount>0).length>0 && <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>{d.sheets.filter((sh:any)=>sh.amount>0).slice(0,6).map((sh:any) => <span key={sh.id} style={{ fontSize:10, background:'rgba(255,107,53,0.07)', color:'#FF6B35', padding:'2px 9px', borderRadius:10, fontWeight:600 }}>{sh.icon} {sh.name} {numFmt(sh.amount)}원</span>)}</div>}
            {d.sales===0 && d.expense===0 && <div style={{ fontSize:11, color:'#bbb', textAlign:'center', padding:'8px 0' }}>결산 데이터 없음</div>}
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
  const [hasPermission, setHasPermission] = useState(false)
  const [permChecked, setPermChecked] = useState(false)
  const [showSheetMgr, setShowSheetMgr] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [loading, setLoading] = useState(true)
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()+1)
  const isOwner = userRole === 'owner'

  useEffect(() => { const check = () => setIsPC(window.innerWidth >= 768); check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check) }, [])

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id); setUserName(user.nm||''); setUserRole(user.role||''); setProfileId(user.id||'')
    if (user.role==='owner') { setHasPermission(true); setPermChecked(true); loadSheets(store.id); loadSettings(store.id) }
    else if (user.role==='manager') checkAndLoad(store.id, user.id)
    else { setPermChecked(true); setLoading(false) }
  }, [])

  async function loadSettings(sid: string) { const { data } = await supabase.from('settlement_settings').select('*').eq('store_id', sid).maybeSingle(); setSettings(data) }
  async function checkAndLoad(sid: string, pid: string) {
    const { data } = await supabase.from('settlement_permissions').select('id').eq('store_id', sid).eq('profile_id', pid).maybeSingle()
    setHasPermission(!!data); setPermChecked(true)
    if (data) { loadSheets(sid); loadSettings(sid) } else setLoading(false)
  }
  async function loadSheets(sid: string) {
    const { data } = await supabase.from('settlement_sheets').select('*').eq('store_id', sid).order('sort_order')
    if (!data || data.length===0) { const rows = DEFAULT_SHEETS.map(s => ({ ...s, store_id: sid })); const { data: inserted } = await supabase.from('settlement_sheets').insert(rows).select(); setSheets(inserted || []) }
    else setSheets(data)
    setLoading(false)
  }

  const activeSheets = useMemo(() => sheets.filter(s => s.is_active), [sheets])
  const currentSheet = activeSheets.find(s => s.id === selectedSheet)

  if (!permChecked || loading) return <div style={{ minHeight:'60vh', display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ color:'#bbb', fontSize:13 }}>로딩 중...</span></div>

  if (!hasPermission) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'80px 20px', textAlign:'center' }}>
      <div style={{ fontSize:40, marginBottom:16 }}>🔒</div>
      <div style={{ fontSize:18, fontWeight:800, color:'#1a1a2e', marginBottom:8 }}>접근 권한이 없습니다</div>
      <div style={{ fontSize:13, color:'#aaa', lineHeight:1.7 }}>결산 메뉴는 대표만 사용할 수 있어요.<br/>대표가 권한을 부여하면 이용할 수 있습니다.</div>
    </div>
  )

  return (
    <div>
      {showSheetMgr && <SheetManageModal sheets={sheets} storeId={storeId} onSave={() => { setLoading(true); loadSheets(storeId) }} onClose={() => setShowSheetMgr(false)} />}
      {showSettings && <SettingsModal storeId={storeId} settings={settings} onSave={(s) => setSettings(s)} onClose={() => setShowSettings(false)} />}

      {/* 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <span style={{ fontSize: isPC?20:17, fontWeight:700, color:'#1a1a2e' }}>💹 결산</span>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ fontSize:10, padding:'3px 10px', borderRadius:10, background: isOwner?'rgba(108,92,231,0.1)':'rgba(255,107,53,0.1)', color: isOwner?'#6C5CE7':'#FF6B35', fontWeight:700 }}>{isOwner?'대표':'관리자'}</span>
          {isOwner && (<>
            <button onClick={() => setShowSettings(true)} style={{ padding:'6px 12px', borderRadius:9, background:'rgba(108,92,231,0.08)', border:'1px solid rgba(108,92,231,0.2)', color:'#6C5CE7', fontSize:12, cursor:'pointer', fontWeight:600 }}>⚙️ 설정</button>
            <button onClick={() => setShowSheetMgr(true)} style={{ padding:'6px 12px', borderRadius:9, background:'#F4F6F9', border:'1px solid #E8ECF0', color:'#888', fontSize:12, cursor:'pointer' }}>📂 시트관리</button>
          </>)}
        </div>
      </div>

      {/* 카드수수료 배너 */}
      {isOwner && settings && (
        <div style={{ padding:'8px 14px', background:'rgba(108,92,231,0.05)', borderRadius:10, border:'1px solid rgba(108,92,231,0.15)', marginBottom:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:11, color:'#6C5CE7', fontWeight:600 }}>💳 카드수수료 {settings.card_fee_rate}% · {settings.business_type==='corporation'?'법인':'개인사업자'}</span>
          <button onClick={() => setShowSettings(true)} style={{ background:'none', border:'none', fontSize:11, color:'#aaa', cursor:'pointer' }}>변경 →</button>
        </div>
      )}
      {isOwner && !settings && (
        <div onClick={() => setShowSettings(true)} style={{ padding:'10px 14px', background:'rgba(255,107,53,0.06)', borderRadius:10, border:'1px dashed rgba(255,107,53,0.3)', marginBottom:12, cursor:'pointer', textAlign:'center', fontSize:12, color:'#FF6B35', fontWeight:600 }}>
          ⚙️ 카드수수료율을 설정해주세요 (현재 기본값 1.1% 적용 중)
        </div>
      )}

      {/* 월 선택 */}
      <div style={{ ...bx, padding:'12px 16px', marginBottom:14 }}>
        <YearMonthPicker year={year} month={month-1} onChange={(y,m) => { setYear(y); setMonth(m+1) }} color="#FF6B35" />
      </div>

      {/* 탭 */}
      <div style={{ overflowX:'auto', marginBottom:16, scrollbarWidth:'none' as const }}>
        <div style={{ display:'flex', gap:6, paddingBottom:4, minWidth:'max-content' }}>
          <button onClick={() => setSelectedSheet('analysis')} style={{ padding:'8px 16px', borderRadius:20, border: selectedSheet==='analysis'?'2px solid #FF6B35':'1px solid #E8ECF0', background: selectedSheet==='analysis'?'rgba(255,107,53,0.1)':'#fff', color: selectedSheet==='analysis'?'#FF6B35':'#888', fontSize:12, fontWeight: selectedSheet==='analysis'?700:500, cursor:'pointer', flexShrink:0 }}>📊 수익분석</button>
          {activeSheets.filter(s=>s.sheet_type==='expense').map(sheet => (
            <button key={sheet.id} onClick={() => setSelectedSheet(sheet.id)} style={{ padding:'8px 14px', borderRadius:20, border: selectedSheet===sheet.id?'2px solid #6C5CE7':'1px solid #E8ECF0', background: selectedSheet===sheet.id?'rgba(108,92,231,0.1)':'#fff', color: selectedSheet===sheet.id?'#6C5CE7':'#888', fontSize:12, fontWeight: selectedSheet===sheet.id?700:500, cursor:'pointer', flexShrink:0 }}>
              {sheet.icon} {sheet.name}
            </button>
          ))}
          <button onClick={() => setSelectedSheet('sales')} style={{ padding:'8px 14px', borderRadius:20, border: selectedSheet==='sales'?'2px solid #00B894':'1px solid #E8ECF0', background: selectedSheet==='sales'?'rgba(0,184,148,0.1)':'#fff', color: selectedSheet==='sales'?'#00B894':'#888', fontSize:12, fontWeight: selectedSheet==='sales'?700:500, cursor:'pointer', flexShrink:0 }}>💰 매출</button>
          {isOwner && <button onClick={() => setSelectedSheet('admin')} style={{ padding:'8px 14px', borderRadius:20, border: selectedSheet==='admin'?'2px solid #6C5CE7':'1px solid #E8ECF0', background: selectedSheet==='admin'?'rgba(108,92,231,0.1)':'#fff', color: selectedSheet==='admin'?'#6C5CE7':'#888', fontSize:12, fontWeight: selectedSheet==='admin'?700:500, cursor:'pointer', flexShrink:0 }}>👑 전지점</button>}
        </div>
      </div>

      {selectedSheet==='analysis' && <ProfitAnalysisView sheets={activeSheets} storeId={storeId} year={year} month={month} settings={settings} />}
      {selectedSheet==='sales' && <SalesView storeId={storeId} year={year} month={month} />}
      {selectedSheet==='admin' && isOwner && <AdminView profileId={profileId} year={year} month={month} />}
      {currentSheet && <SheetView sheet={currentSheet} storeId={storeId} userName={userName} year={year} month={month} />}
    </div>
  )
}