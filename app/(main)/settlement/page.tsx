'use client'
import { useEffect, useState, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import YearMonthPicker from '@/components/YearMonthPicker'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
const lbl = { fontSize: 11, color: '#888', marginBottom: 4, display: 'block' as const }

function numFmt(n: number) { return n.toLocaleString() }

const DEFAULT_SHEETS = [
  { name: '인터넷발주', icon: '🌐', sheet_type: 'expense', sort_order: 1 },
  { name: '마트발주',   icon: '🛒', sheet_type: 'expense', sort_order: 2 },
  { name: '육류',       icon: '🥩', sheet_type: 'expense', sort_order: 3 },
  { name: '수산물',     icon: '🐟', sheet_type: 'expense', sort_order: 4 },
  { name: '주류',       icon: '🍺', sheet_type: 'expense', sort_order: 5 },
  { name: '음료',       icon: '🥤', sheet_type: 'expense', sort_order: 6 },
  { name: '기타재료',   icon: '📦', sheet_type: 'expense', sort_order: 7 },
  { name: '인건비',     icon: '👤', sheet_type: 'expense', sort_order: 8 },
  { name: '공과금',     icon: '⚡', sheet_type: 'expense', sort_order: 9 },
  { name: '기타관리비', icon: '📋', sheet_type: 'expense', sort_order: 10 },
  { name: '수수료',     icon: '💳', sheet_type: 'expense', sort_order: 11 },
  { name: '세금',       icon: '🧾', sheet_type: 'expense', sort_order: 12 },
]

const PAYMENT_METHODS = ['카드', '현금', '계좌이체', '기타']
const ICONS = ['📋','🌐','🛒','🥩','🐟','🍺','🥤','📦','👤','⚡','💳','🧾','💰','🏠','🚗','📱','🔧','✂️','🎯','💬']

const PAYMENT_COLORS: Record<string, string> = {
  '카드': '#6C5CE7', '현금': '#00B894', '계좌이체': '#2DC6D6', '기타': '#aaa'
}

// ── 항목 추가/수정 모달 ─────────────────────────────────────
function EntryModal({ sheet, entry, storeId, userName, year, month, onSave, onClose }: {
  sheet: any; entry: any | null; storeId: string; userName: string
  year: number; month: number; onSave: () => void; onClose: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const pad = (n: number) => String(n).padStart(2, '0')
  const [date, setDate] = useState(entry?.entry_date || `${year}-${pad(month)}-01`)
  const [itemName, setItemName] = useState(entry?.item_name || '')
  const [amount, setAmount] = useState<number | ''>(entry?.amount || '')
  const [paymentMethod, setPaymentMethod] = useState(entry?.payment_method || '카드')
  const [hasTaxInvoice, setHasTaxInvoice] = useState(entry?.has_tax_invoice || false)
  const [memo, setMemo] = useState(entry?.memo || '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!amount) { alert('금액을 입력해주세요'); return }
    setSaving(true)
    const data = {
      sheet_id: sheet.id, store_id: storeId, year, month,
      entry_date: date, item_name: itemName.trim() || null,
      amount: Number(amount), payment_method: paymentMethod,
      has_tax_invoice: hasTaxInvoice, memo: memo.trim() || null,
      created_by: userName, updated_at: new Date().toISOString(),
    }
    if (entry?.id) {
      await supabase.from('settlement_entries').update(data).eq('id', entry.id)
    } else {
      await supabase.from('settlement_entries').insert(data)
    }
    setSaving(false); onSave(); onClose()
  }

  async function handleDelete() {
    if (!entry?.id) return
    if (!confirm('이 항목을 삭제할까요?')) return
    await supabase.from('settlement_entries').delete().eq('id', entry.id)
    onSave(); onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>
            {sheet.icon} {entry ? '항목 수정' : '항목 추가'} — {sheet.name}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={lbl}>날짜</span>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={lbl}>품목명 (선택)</span>
            <input value={itemName} onChange={e => setItemName(e.target.value)} placeholder="예: 새우 5kg, 3월 급여" style={inp} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={lbl}>금액 *</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" style={inp} />
              <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>원</span>
            </div>
            {Number(amount) > 0 && (
              <div style={{ fontSize: 11, color: '#FF6B35', marginTop: 4, fontWeight: 600 }}>{numFmt(Number(amount))}원</div>
            )}
          </div>
          <div>
            <span style={lbl}>결제방법</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {PAYMENT_METHODS.map(m => (
                <button key={m} onClick={() => setPaymentMethod(m)} style={{ padding: '5px 10px', borderRadius: 8, border: paymentMethod === m ? `2px solid ${PAYMENT_COLORS[m]}` : '1px solid #E8ECF0', background: paymentMethod === m ? `${PAYMENT_COLORS[m]}18` : '#F8F9FB', color: paymentMethod === m ? PAYMENT_COLORS[m] : '#888', fontSize: 11, fontWeight: paymentMethod === m ? 700 : 400, cursor: 'pointer' }}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span style={lbl}>세금계산서</span>
            <button onClick={() => setHasTaxInvoice((v: boolean) => !v)} style={{ width: '100%', padding: '8px 0', borderRadius: 8, border: hasTaxInvoice ? '2px solid #00B894' : '1px solid #E8ECF0', background: hasTaxInvoice ? 'rgba(0,184,148,0.1)' : '#F8F9FB', color: hasTaxInvoice ? '#00B894' : '#aaa', fontSize: 12, fontWeight: hasTaxInvoice ? 700 : 400, cursor: 'pointer' }}>
              {hasTaxInvoice ? '✅ 발행됨' : '⬜ 미발행'}
            </button>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <span style={lbl}>메모 (선택)</span>
            <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="메모" style={inp} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {entry && (
            <button onClick={handleDelete} style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(232,67,147,0.08)', border: '1px solid rgba(232,67,147,0.2)', color: '#E84393', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>삭제</button>
          )}
          <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: '13px 0', borderRadius: 12, background: saving ? '#ddd' : 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? '저장 중...' : entry ? '수정 저장' : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 시트 관리 모달 ──────────────────────────────────────────
function SheetManageModal({ sheets, storeId, onSave, onClose }: {
  sheets: any[]; storeId: string; onSave: () => void; onClose: () => void
}) {
  const supabase = createSupabaseBrowserClient()
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📋')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  async function handleAdd() {
    if (!newName.trim()) return
    setSaving(true)
    const maxOrder = sheets.reduce((max, s) => Math.max(max, s.sort_order || 0), 0)
    await supabase.from('settlement_sheets').insert({ store_id: storeId, name: newName.trim(), icon: newIcon, sheet_type: 'expense', sort_order: maxOrder + 1 })
    setNewName(''); setSaving(false); onSave()
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return
    await supabase.from('settlement_sheets').update({ name: editName.trim() }).eq('id', id)
    setEditId(null); onSave()
  }

  async function handleToggle(sheet: any) {
    await supabase.from('settlement_sheets').update({ is_active: !sheet.is_active }).eq('id', sheet.id)
    onSave()
  }

  async function handleDelete(sheet: any) {
    if (!confirm(`"${sheet.name}" 시트를 삭제할까요?\n이 시트의 모든 항목도 함께 삭제됩니다.`)) return
    await supabase.from('settlement_sheets').delete().eq('id', sheet.id)
    onSave()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', width: '100%', maxWidth: 480, borderRadius: '20px 20px 0 0', padding: 20, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>📂 시트 관리</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ marginBottom: 16 }}>
          {sheets.filter(s => s.sheet_type !== 'sales').map(sheet => (
            <div key={sheet.id} style={{ padding: '10px 14px', background: sheet.is_active ? '#fff' : '#F8F9FB', borderRadius: 10, marginBottom: 6, border: `1px solid ${sheet.is_active ? '#E8ECF0' : '#F0F0F0'}` }}>
              {editId === sheet.id ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input value={editName} onChange={e => setEditName(e.target.value)} style={{ ...inp, flex: 1 }} autoFocus />
                  <button onClick={() => handleRename(sheet.id)} style={{ padding: '6px 12px', borderRadius: 8, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>저장</button>
                  <button onClick={() => setEditId(null)} style={{ padding: '6px 10px', borderRadius: 8, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', cursor: 'pointer', fontSize: 12 }}>취소</button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{sheet.icon}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: sheet.is_active ? '#1a1a2e' : '#aaa' }}>{sheet.name}</span>
                  <button onClick={() => { setEditId(sheet.id); setEditName(sheet.name) }} style={{ background: 'none', border: 'none', fontSize: 11, color: '#6C5CE7', cursor: 'pointer' }}>수정</button>
                  <button onClick={() => handleToggle(sheet)} style={{ padding: '3px 9px', borderRadius: 6, border: `1px solid ${sheet.is_active ? 'rgba(0,184,148,0.3)' : '#E8ECF0'}`, background: sheet.is_active ? 'rgba(0,184,148,0.08)' : '#F4F6F9', color: sheet.is_active ? '#00B894' : '#aaa', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                    {sheet.is_active ? '활성' : '비활성'}
                  </button>
                  <button onClick={() => handleDelete(sheet)} style={{ background: 'none', border: 'none', color: '#E84393', fontSize: 11, cursor: 'pointer' }}>삭제</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(255,107,53,0.04)', borderRadius: 12, padding: 14, border: '1px dashed rgba(255,107,53,0.3)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#FF6B35', marginBottom: 10 }}>+ 새 시트 추가</div>
          <div style={{ marginBottom: 10 }}>
            <span style={lbl}>시트 이름</span>
            <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder="예: 포장재, 소모품" style={inp} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <span style={lbl}>아이콘</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ICONS.map(ic => (
                <button key={ic} onClick={() => setNewIcon(ic)} style={{ width: 36, height: 36, borderRadius: 8, border: newIcon === ic ? '2px solid #FF6B35' : '1px solid #E8ECF0', background: newIcon === ic ? 'rgba(255,107,53,0.1)' : '#F8F9FB', fontSize: 18, cursor: 'pointer' }}>
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleAdd} disabled={saving || !newName.trim()} style={{ width: '100%', padding: '11px 0', borderRadius: 10, background: newName.trim() ? 'linear-gradient(135deg,#FF6B35,#E84393)' : '#E8ECF0', border: 'none', color: newName.trim() ? '#fff' : '#aaa', fontSize: 13, fontWeight: 700, cursor: newName.trim() ? 'pointer' : 'default' }}>
            {saving ? '추가 중...' : '시트 추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 시트 뷰 (일별 항목 CRUD) ────────────────────────────────
function SheetView({ sheet, storeId, userName, year, month }: {
  sheet: any; storeId: string; userName: string; year: number; month: number
}) {
  const supabase = createSupabaseBrowserClient()
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editEntry, setEditEntry] = useState<any>(null)

  useEffect(() => { loadEntries() }, [sheet.id, year, month])

  async function loadEntries() {
    setLoading(true)
    const { data } = await supabase.from('settlement_entries').select('*')
      .eq('sheet_id', sheet.id).eq('year', year).eq('month', month)
      .order('entry_date', { ascending: false }).order('created_at', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  const total = useMemo(() => entries.reduce((s, e) => s + (e.amount || 0), 0), [entries])
  const taxCount = useMemo(() => entries.filter(e => e.has_tax_invoice).length, [entries])

  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {}
    entries.forEach(e => { if (!map[e.entry_date]) map[e.entry_date] = []; map[e.entry_date].push(e) })
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]))
  }, [entries])

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 13 }}>불러오는 중...</div>

  return (
    <div>
      {/* 상단 합계 */}
      <div style={{ ...bx, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: '#aaa' }}>{year}년 {month}월 합계</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#FF6B35' }}>{numFmt(total)}원</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <span style={{ fontSize: 11, color: '#bbb' }}>총 {entries.length}건</span>
            {taxCount > 0 && <span style={{ fontSize: 11, color: '#00B894', fontWeight: 600 }}>세금계산서 {taxCount}건</span>}
          </div>
        </div>
        <button onClick={() => { setEditEntry(null); setShowModal(true) }} style={{ padding: '12px 20px', borderRadius: 12, background: 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + 항목 추가
        </button>
      </div>

      {entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>{sheet.icon}</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#ccc', marginBottom: 6 }}>{sheet.name}</div>
          <div style={{ fontSize: 12 }}>이번 달 항목이 없어요</div>
          <div style={{ fontSize: 11, marginTop: 4, color: '#ddd' }}>+ 항목 추가 버튼을 눌러 시작하세요</div>
        </div>
      ) : (
        grouped.map(([date, items]) => {
          const dayTotal = items.reduce((s, e) => s + (e.amount || 0), 0)
          const d = new Date(date + 'T00:00:00')
          const dow = ['일','월','화','수','목','금','토'][d.getDay()]
          const isSun = d.getDay() === 0; const isSat = d.getDay() === 6
          return (
            <div key={date} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(108,92,231,0.08)', color: isSun ? '#E84393' : isSat ? '#2DC6D6' : '#6C5CE7' }}>
                  {d.getMonth()+1}월 {d.getDate()}일 ({dow})
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#FF6B35' }}>{numFmt(dayTotal)}원</span>
              </div>
              {items.map(entry => (
                <div key={entry.id} onClick={() => { setEditEntry(entry); setShowModal(true) }}
                  style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8ECF0', padding: '11px 14px', marginBottom: 6, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: entry.memo ? 4 : 0 }}>
                      {entry.item_name && <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{entry.item_name}</span>}
                      <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: `${PAYMENT_COLORS[entry.payment_method] || '#aaa'}18`, color: PAYMENT_COLORS[entry.payment_method] || '#aaa', fontWeight: 600 }}>
                        {entry.payment_method}
                      </span>
                      {entry.has_tax_invoice && <span style={{ fontSize: 10, color: '#00B894', fontWeight: 700 }}>✅ 세금계산서</span>}
                    </div>
                    {entry.memo && <div style={{ fontSize: 11, color: '#aaa' }}>📝 {entry.memo}</div>}
                  </div>
                  <div style={{ textAlign: 'right', marginLeft: 10, flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a2e' }}>{numFmt(entry.amount)}원</div>
                  </div>
                </div>
              ))}
            </div>
          )
        })
      )}

      {showModal && (
        <EntryModal sheet={sheet} entry={editEntry} storeId={storeId} userName={userName} year={year} month={month}
          onSave={loadEntries} onClose={() => { setShowModal(false); setEditEntry(null) }} />
      )}
    </div>
  )
}

// ── 매출 뷰 (마감일지 자동 연동) ────────────────────────────
function SalesView({ storeId, year, month }: { storeId: string; year: number; month: number }) {
  const supabase = createSupabaseBrowserClient()
  const [closings, setClosings] = useState<any[]>([])
  const [salesData, setSalesData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadSales() }, [storeId, year, month])

  async function loadSales() {
    setLoading(true)
    const pad = (n: number) => String(n).padStart(2,'0')
    const from = `${year}-${pad(month)}-01`
    const to = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`
    const { data: cls } = await supabase.from('closings').select('id, closing_date, writer, weather_code').eq('store_id', storeId).gte('closing_date', from).lte('closing_date', to).order('closing_date', { ascending: false })
    if (!cls || cls.length === 0) { setClosings([]); setSalesData([]); setLoading(false); return }
    const { data: sv } = await supabase.from('closing_sales').select('*').in('closing_id', cls.map((c: any) => c.id))
    setClosings(cls); setSalesData(sv || [])
    setLoading(false)
  }

  const dailySales = useMemo(() => closings.map(cl => {
    const daySales = salesData.filter((s: any) => s.closing_id === cl.id)
    const total = daySales.reduce((sum: number, s: any) => sum + (s.amount || 0), 0)
    return { ...cl, total, platforms: daySales }
  }), [closings, salesData])

  const monthTotal = useMemo(() => dailySales.reduce((s, d) => s + d.total, 0), [dailySales])
  const avgDaily = dailySales.length > 0 ? Math.round(monthTotal / dailySales.length) : 0

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 13 }}>불러오는 중...</div>

  return (
    <div>
      <div style={{ ...bx }}>
        <div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>{year}년 {month}월 총 매출</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: '#00B894', marginBottom: 4 }}>{numFmt(monthTotal)}원</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ fontSize: 11, color: '#bbb' }}>마감 {closings.length}일</span>
          {avgDaily > 0 && <span style={{ fontSize: 11, color: '#6C5CE7', fontWeight: 600 }}>일평균 {numFmt(avgDaily)}원</span>}
        </div>
        <div style={{ marginTop: 8, padding: '7px 12px', background: 'rgba(0,184,148,0.07)', borderRadius: 8, fontSize: 11, color: '#00B894', fontWeight: 600 }}>
          ✅ 마감일지 데이터 자동 연동 — 수동 입력 불필요
        </div>
      </div>

      {dailySales.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#bbb' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>💰</div>
          <div style={{ fontSize: 13 }}>이번 달 마감일지 데이터가 없어요</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>마감일지에서 매출을 입력하면 자동으로 표시됩니다</div>
        </div>
      ) : (
        dailySales.map(day => {
          const d = new Date(day.closing_date + 'T00:00:00')
          const dow = ['일','월','화','수','목','금','토'][d.getDay()]
          const isSun = d.getDay() === 0; const isSat = d.getDay() === 6
          return (
            <div key={day.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(0,184,148,0.2)', padding: '11px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: day.platforms.filter((p: any) => p.amount > 0).length > 0 ? 8 : 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: isSun ? '#E84393' : isSat ? '#2DC6D6' : '#1a1a2e' }}>
                  {d.getMonth()+1}월 {d.getDate()}일 ({dow})
                </span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#00B894' }}>{numFmt(day.total)}원</span>
              </div>
              {day.platforms.filter((p: any) => p.amount > 0).length > 0 && (
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {day.platforms.filter((p: any) => p.amount > 0).map((p: any) => (
                    <span key={p.id} style={{ fontSize: 10, color: '#888', background: '#F4F6F9', padding: '2px 8px', borderRadius: 8 }}>
                      {p.platform} {numFmt(p.amount)}원
                    </span>
                  ))}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// ── 요약 뷰 ─────────────────────────────────────────────────
function SummaryView({ sheets, storeId, year, month, isPC }: {
  sheets: any[]; storeId: string; year: number; month: number; isPC: boolean
}) {
  const supabase = createSupabaseBrowserClient()
  const [entrySums, setEntrySums] = useState<Record<string, number>>({})
  const [salesTotal, setSalesTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [storeId, year, month])

  async function loadAll() {
    setLoading(true)
    const pad = (n: number) => String(n).padStart(2, '0')

    const { data: entries } = await supabase.from('settlement_entries').select('sheet_id, amount').eq('store_id', storeId).eq('year', year).eq('month', month)
    const sums: Record<string, number> = {}
    ;(entries || []).forEach((e: any) => { sums[e.sheet_id] = (sums[e.sheet_id] || 0) + (e.amount || 0) })
    setEntrySums(sums)

    const from = `${year}-${pad(month)}-01`
    const to = `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}`
    const { data: cls } = await supabase.from('closings').select('id').eq('store_id', storeId).gte('closing_date', from).lte('closing_date', to)
    if (cls && cls.length > 0) {
      const { data: sv } = await supabase.from('closing_sales').select('amount').in('closing_id', cls.map((c: any) => c.id))
      setSalesTotal((sv || []).reduce((s: number, r: any) => s + (r.amount || 0), 0))
    } else {
      setSalesTotal(0)
    }
    setLoading(false)
  }

  const expenseSheets = sheets.filter(s => s.sheet_type === 'expense' && s.is_active)
  const totalExpense = expenseSheets.reduce((s, sheet) => s + (entrySums[sheet.id] || 0), 0)
  const netProfit = salesTotal - totalExpense
  const profitRate = salesTotal > 0 ? Math.round((netProfit / salesTotal) * 1000) / 10 : 0

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: '#bbb', fontSize: 13 }}>불러오는 중...</div>

  return (
    <div>
      {/* 순수익 카드 */}
      <div style={{ ...bx, border: `1.5px solid ${netProfit >= 0 ? 'rgba(0,184,148,0.4)' : 'rgba(232,67,147,0.4)'}` }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1a2e', marginBottom: 14 }}>📊 {year}년 {month}월 결산 요약</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <div style={{ padding: '12px', background: 'rgba(0,184,148,0.08)', borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#aaa', marginBottom: 4 }}>총 매출</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#00B894' }}>{numFmt(salesTotal)}원</div>
          </div>
          <div style={{ padding: '12px', background: 'rgba(232,67,147,0.06)', borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#aaa', marginBottom: 4 }}>총 지출</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#E84393' }}>{numFmt(totalExpense)}원</div>
          </div>
        </div>
        <div style={{ padding: '14px 16px', borderRadius: 14, background: netProfit >= 0 ? 'rgba(0,184,148,0.1)' : 'rgba(232,67,147,0.08)', border: `1.5px solid ${netProfit >= 0 ? 'rgba(0,184,148,0.3)' : 'rgba(232,67,147,0.3)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: netProfit >= 0 ? '#00B894' : '#E84393' }}>순수익</div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>매출 - 총지출</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: netProfit >= 0 ? '#00B894' : '#E84393', lineHeight: 1.1 }}>{numFmt(netProfit)}원</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: netProfit >= 0 ? '#00B894' : '#E84393' }}>수익률 {profitRate}%</div>
          </div>
        </div>
        <div style={{ height: 10, background: '#F0F2F5', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ height: 10, borderRadius: 8, width: `${Math.min(Math.max(profitRate, 0), 50) * 2}%`, background: profitRate >= 20 ? 'linear-gradient(90deg,#00B894,#00cec9)' : profitRate >= 10 ? 'linear-gradient(90deg,#FF6B35,#FDC400)' : 'linear-gradient(90deg,#E84393,#FF6B35)', transition: 'width 0.4s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ fontSize: 10, color: '#aaa' }}>0%</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: profitRate >= 20 ? '#00B894' : profitRate >= 10 ? '#FF6B35' : profitRate >= 0 ? '#E67E22' : '#E84393' }}>
            {profitRate >= 20 ? '🎉 우수 (20%+)' : profitRate >= 10 ? '✅ 보통 (10~20%)' : profitRate >= 0 ? '⚠️ 낮음 (0~10%)' : '🚨 적자'}
          </span>
          <span style={{ fontSize: 10, color: '#aaa' }}>50%</span>
        </div>
      </div>

      {/* 항목별 지출 */}
      <div style={bx}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>💸 항목별 지출 내역</div>
        {expenseSheets.map(sheet => {
          const amount = entrySums[sheet.id] || 0
          const rate = salesTotal > 0 ? Math.round((amount / salesTotal) * 1000) / 10 : 0
          return (
            <div key={sheet.id} style={{ marginBottom: amount > 0 ? 12 : 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: amount > 0 ? 4 : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 15 }}>{sheet.icon}</span>
                  <span style={{ fontSize: 12, color: amount > 0 ? '#555' : '#ccc', fontWeight: amount > 0 ? 600 : 400 }}>{sheet.name}</span>
                </div>
                <div>
                  {amount > 0 ? (
                    <>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#E84393' }}>{numFmt(amount)}원</span>
                      {salesTotal > 0 && <span style={{ fontSize: 10, color: '#aaa', marginLeft: 5 }}>{rate}%</span>}
                    </>
                  ) : (
                    <span style={{ fontSize: 11, color: '#ddd' }}>미입력</span>
                  )}
                </div>
              </div>
              {amount > 0 && salesTotal > 0 && (
                <div style={{ height: 5, background: '#F0F2F5', borderRadius: 4 }}>
                  <div style={{ height: 5, borderRadius: 4, background: 'linear-gradient(90deg,#E84393,#FF6B35)', width: `${Math.min(rate, 100)}%`, transition: 'width 0.3s' }} />
                </div>
              )}
            </div>
          )
        })}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '2px solid #E8ECF0', marginTop: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>지출 합계</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#E84393' }}>{numFmt(totalExpense)}원</span>
        </div>
      </div>

      {/* 미입력 시트 안내 */}
      {expenseSheets.filter(s => !entrySums[s.id]).length > 0 && (
        <div style={{ padding: '10px 14px', background: 'rgba(253,196,0,0.08)', borderRadius: 10, border: '1px solid rgba(253,196,0,0.3)', fontSize: 11, color: '#B8860B' }}>
          💡 미입력 시트: {expenseSheets.filter(s => !entrySums[s.id]).map(s => s.name).join(', ')}
        </div>
      )}
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
  const [isPC, setIsPC] = useState(false)
  const [sheets, setSheets] = useState<any[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string>('summary')
  const [hasPermission, setHasPermission] = useState(false)
  const [permChecked, setPermChecked] = useState(false)
  const [showSheetMgr, setShowSheetMgr] = useState(false)
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const isOwner = userRole === 'owner'

  useEffect(() => {
    const check = () => setIsPC(window.innerWidth >= 768)
    check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id); setUserName(user.nm || ''); setUserRole(user.role || '')
    if (user.role === 'owner') {
      setHasPermission(true); setPermChecked(true); loadSheets(store.id)
    } else if (user.role === 'manager') {
      checkAndLoad(store.id, user.id)
    } else {
      setPermChecked(true); setLoading(false)
    }
  }, [])

  async function checkAndLoad(sid: string, pid: string) {
    const { data } = await supabase.from('settlement_permissions').select('id').eq('store_id', sid).eq('profile_id', pid).maybeSingle()
    setHasPermission(!!data); setPermChecked(true)
    if (data) loadSheets(sid); else setLoading(false)
  }

  async function loadSheets(sid: string) {
    const { data } = await supabase.from('settlement_sheets').select('*').eq('store_id', sid).order('sort_order')
    if (!data || data.length === 0) {
      const rows = DEFAULT_SHEETS.map(s => ({ ...s, store_id: sid }))
      const { data: inserted } = await supabase.from('settlement_sheets').insert(rows).select()
      setSheets(inserted || [])
    } else {
      setSheets(data)
    }
    setLoading(false)
  }

  const activeSheets = useMemo(() => sheets.filter(s => s.is_active), [sheets])
  const currentSheet = activeSheets.find(s => s.id === selectedSheet)

  if (!permChecked || loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ color: '#bbb', fontSize: 13 }}>로딩 중...</span>
    </div>
  )

  if (!hasPermission) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e', marginBottom: 8 }}>접근 권한이 없습니다</div>
      <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.7 }}>결산 메뉴는 대표만 사용할 수 있어요.<br />대표가 권한을 부여하면 이용할 수 있습니다.</div>
    </div>
  )

  return (
    <div>
      {showSheetMgr && (
        <SheetManageModal sheets={sheets} storeId={storeId}
          onSave={() => { setLoading(true); loadSheets(storeId) }}
          onClose={() => setShowSheetMgr(false)} />
      )}

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: isPC ? 20 : 17, fontWeight: 700, color: '#1a1a2e' }}>💹 결산</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 10, background: isOwner ? 'rgba(108,92,231,0.1)' : 'rgba(255,107,53,0.1)', color: isOwner ? '#6C5CE7' : '#FF6B35', fontWeight: 700 }}>
            {isOwner ? '대표' : '관리자'}
          </span>
          {isOwner && (
            <button onClick={() => setShowSheetMgr(true)} style={{ padding: '6px 12px', borderRadius: 9, background: '#F4F6F9', border: '1px solid #E8ECF0', color: '#888', fontSize: 12, cursor: 'pointer' }}>
              📂 시트관리
            </button>
          )}
        </div>
      </div>

      {/* 월 선택 */}
      <div style={{ ...bx, padding: '12px 16px', marginBottom: 14 }}>
        <YearMonthPicker year={year} month={month - 1} onChange={(y, m) => { setYear(y); setMonth(m + 1) }} color="#FF6B35" />
      </div>

      {/* 탭 - 가로 스크롤 */}
      <div style={{ overflowX: 'auto', marginBottom: 16, scrollbarWidth: 'none' as const }}>
        <div style={{ display: 'flex', gap: 6, paddingBottom: 4, minWidth: 'max-content' }}>
          <button onClick={() => setSelectedSheet('summary')}
            style={{ padding: '8px 16px', borderRadius: 20, border: selectedSheet === 'summary' ? '2px solid #FF6B35' : '1px solid #E8ECF0', background: selectedSheet === 'summary' ? 'rgba(255,107,53,0.1)' : '#fff', color: selectedSheet === 'summary' ? '#FF6B35' : '#888', fontSize: 12, fontWeight: selectedSheet === 'summary' ? 700 : 500, cursor: 'pointer', flexShrink: 0 }}>
            📊 요약
          </button>
          {activeSheets.filter(s => s.sheet_type === 'expense').map(sheet => (
            <button key={sheet.id} onClick={() => setSelectedSheet(sheet.id)}
              style={{ padding: '8px 14px', borderRadius: 20, border: selectedSheet === sheet.id ? '2px solid #6C5CE7' : '1px solid #E8ECF0', background: selectedSheet === sheet.id ? 'rgba(108,92,231,0.1)' : '#fff', color: selectedSheet === sheet.id ? '#6C5CE7' : '#888', fontSize: 12, fontWeight: selectedSheet === sheet.id ? 700 : 500, cursor: 'pointer', flexShrink: 0 }}>
              {sheet.icon} {sheet.name}
            </button>
          ))}
          <button onClick={() => setSelectedSheet('sales')}
            style={{ padding: '8px 14px', borderRadius: 20, border: selectedSheet === 'sales' ? '2px solid #00B894' : '1px solid #E8ECF0', background: selectedSheet === 'sales' ? 'rgba(0,184,148,0.1)' : '#fff', color: selectedSheet === 'sales' ? '#00B894' : '#888', fontSize: 12, fontWeight: selectedSheet === 'sales' ? 700 : 500, cursor: 'pointer', flexShrink: 0 }}>
            💰 매출
          </button>
        </div>
      </div>

      {/* 콘텐츠 */}
      {selectedSheet === 'summary' && (
        <SummaryView sheets={activeSheets} storeId={storeId} year={year} month={month} isPC={isPC} />
      )}
      {selectedSheet === 'sales' && (
        <SalesView storeId={storeId} year={year} month={month} />
      )}
      {currentSheet && (
        <SheetView sheet={currentSheet} storeId={storeId} userName={userName} year={year} month={month} />
      )}
    </div>
  )
}