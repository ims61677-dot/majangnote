'use client'
import { useEffect, useState, useMemo } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'
import YearMonthPicker from '@/components/YearMonthPicker'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8, background: '#F8F9FB', border: '1px solid #E0E4E8', color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }
const lbl = { fontSize: 11, color: '#888', marginBottom: 4, display: 'block' as const }

function numFmt(n: number) { return n.toLocaleString() }
function pct(n: number, total: number) { if (!total) return 0; return Math.round((n / total) * 1000) / 10 }

// ── 상수 ────────────────────────────────────────────────────
const SALES_FIELDS = [
  { key: 'pos_sales', label: 'POS 매출' },
  { key: 'cash_sales', label: '현금/기타 매출' },
  { key: 'baemin_sales', label: '배민 매출' },
  { key: 'coupang_sales', label: '쿠팡이츠 매출' },
  { key: 'yogiyo_sales', label: '요기요 매출' },
]
const MATERIAL_FIELDS = [
  { key: 'internet_order', label: '인터넷 발주' },
  { key: 'mart_order', label: '마트 발주' },
  { key: 'seafood', label: '수산물' },
  { key: 'meat', label: '육류' },
  { key: 'liquor', label: '주류' },
  { key: 'beverage', label: '음료' },
  { key: 'other_material', label: '기타 재료' },
]
const MGMT_FIELDS = [
  { key: 'fire_insurance', label: '화재보험' },
  { key: 'accountant_fee', label: '세무사' },
  { key: 'labor_advisor_fee', label: '노무사' },
  { key: 'cctv_fee', label: 'CCTV' },
  { key: 'sescco_fee', label: '세스코' },
  { key: 'now_waiting_fee', label: '나우웨이팅' },
  { key: 'phone_internet_fee', label: '전화&인터넷' },
  { key: 'pos_fee', label: 'POS' },
  { key: 'water_purifier_fee', label: '정수기' },
  { key: 'waste_fee', label: '음식물처리' },
  { key: 'parking_fee', label: '주차비' },
  { key: 'butane_fee', label: '부탄가스' },
  { key: 'ad_fee', label: '광고비' },
]
const SETTINGS_FIELDS = [
  { key: 'salary', label: '급여 총액 (기본값)' },
  { key: 'insurance4', label: '4대보험 (기본값)' },
  { key: 'rent', label: '월세 (기본값)' },
  { key: 'maintenance_fee', label: '관리비 (기본값)' },
  { key: 'electricity', label: '전기료 (기본값)' },
  { key: 'gas', label: '가스료 (기본값)' },
  { key: 'water', label: '수도료 (기본값)' },
  { key: 'accountant_fee', label: '세무사' },
  { key: 'labor_advisor_fee', label: '노무사' },
  { key: 'fire_insurance', label: '화재보험' },
  { key: 'cctv_fee', label: 'CCTV' },
  { key: 'sescco_fee', label: '세스코' },
  { key: 'now_waiting_fee', label: '나우웨이팅' },
  { key: 'phone_internet_fee', label: '전화&인터넷' },
  { key: 'pos_fee', label: 'POS' },
  { key: 'water_purifier_fee', label: '정수기' },
  { key: 'waste_fee', label: '음식물처리' },
  { key: 'parking_fee', label: '주차비' },
  { key: 'butane_fee', label: '부탄가스' },
  { key: 'ad_fee', label: '광고비' },
]
const FIXED_FROM_SETTINGS = SETTINGS_FIELDS.map(f => f.key)
const ALL_MONTHLY_FIELDS = [
  'pos_sales','cash_sales','baemin_sales','coupang_sales','yogiyo_sales',
  'internet_order','mart_order','seafood','meat','liquor','beverage','other_material',
  'salary','insurance4','rent','maintenance_fee','electricity','gas','water',
  'baemin_fee','coupang_fee','yogiyo_fee','barogo_fee',
  'vat_actual','withholding_tax','fine','registration_tax',
  'fire_insurance','accountant_fee','labor_advisor_fee','cctv_fee','sescco_fee',
  'now_waiting_fee','phone_internet_fee','pos_fee','water_purifier_fee','waste_fee',
  'parking_fee','butane_fee','ad_fee','other_mgmt',
]

// ── 합계 바 컴포넌트 ────────────────────────────────────────
function SumBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const rate = pct(value, total)
  return (
    <div style={{ marginTop: 12, padding: '10px 14px', background: `${color}12`, borderRadius: 10, border: `1px solid ${color}30`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: '#888' }}>{label}</span>
      <div>
        <span style={{ fontSize: 14, fontWeight: 800, color }}>{numFmt(value)}원</span>
        {total > 0 && <span style={{ fontSize: 11, color: '#aaa', marginLeft: 6 }}>{rate}%</span>}
      </div>
    </div>
  )
}

// ── 숫자 입력 행 컴포넌트 ──────────────────────────────────
function NumRow({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div>
      <span style={lbl}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input
          type="number" value={value || ''} placeholder="0" disabled={disabled}
          onChange={e => onChange(Number(e.target.value))}
          style={{ ...inp, background: disabled ? '#F4F6F9' : '#F8F9FB' }}
        />
        <span style={{ fontSize: 10, color: '#aaa', flexShrink: 0 }}>원</span>
      </div>
    </div>
  )
}

// ════════════════════════════════════════
// 지점 결산 탭
// ════════════════════════════════════════
function SettlementBranchTab({ storeId, isOwner, isPC }: { storeId: string; isOwner: boolean; isPC: boolean }) {
  const supabase = createSupabaseBrowserClient()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [settings, setSettings] = useState<any>(null)
  const [monthly, setMonthly] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showPermMgr, setShowPermMgr] = useState(false)
  const [loading, setLoading] = useState(true)
  const [managers, setManagers] = useState<any[]>([])
  const [permList, setPermList] = useState<any[]>([])

  // 설정 폼
  const [bizType, setBizType] = useState<'corporation' | 'individual'>('individual')
  const [cardFeeRate, setCardFeeRate] = useState(1.1)
  const [settingsForm, setSettingsForm] = useState<Record<string, number>>({})

  // 월별 폼
  const [form, setForm] = useState<Record<string, number>>({})
  const [note, setNote] = useState('')

  useEffect(() => { loadAll() }, [storeId, year, month])

  async function loadAll() {
    setLoading(true)
    const [{ data: s }, { data: m }] = await Promise.all([
      supabase.from('settlement_settings').select('*').eq('store_id', storeId).maybeSingle(),
      supabase.from('settlement_monthly').select('*').eq('store_id', storeId).eq('year', year).eq('month', month).maybeSingle(),
    ])
    setSettings(s)
    setMonthly(m)

    if (s) {
      setBizType(s.business_type || 'individual')
      setCardFeeRate(s.card_fee_rate || 1.1)
      const sf: Record<string, number> = {}
      SETTINGS_FIELDS.forEach(f => { sf[f.key] = s[f.key] || 0 })
      setSettingsForm(sf)
    }

    const mf: Record<string, number> = {}
    ALL_MONTHLY_FIELDS.forEach(f => { mf[f] = 0 })

    if (m) {
      ALL_MONTHLY_FIELDS.forEach(f => { mf[f] = m[f] || 0 })
      setNote(m.note || '')
    } else if (s) {
      // 저장된 결산 없으면 settings 기본값으로 프리필
      FIXED_FROM_SETTINGS.forEach(f => { mf[f] = s[f] || 0 })
      setNote('')
    }
    setForm(mf)
    setLoading(false)
  }

  async function loadPermissions() {
    const [{ data: perms }, { data: members }] = await Promise.all([
      supabase.from('settlement_permissions').select('*').eq('store_id', storeId),
      supabase.from('store_members').select('profile_id, profiles(nm, id)').eq('store_id', storeId).eq('active', true),
    ])
    setPermList(perms || [])
    const mgrs = (members || []).filter((m: any) => {
      const profileRole = m.profiles?.role
      return true // 모든 멤버 표시 (대표 제외는 UI에서)
    }).map((m: any) => ({ id: m.profile_id, nm: m.profiles?.nm || '' }))
    setManagers(mgrs)
  }

  async function togglePerm(profileId: string, nm: string) {
    const exists = permList.find((p: any) => p.profile_id === profileId)
    if (exists) {
      await supabase.from('settlement_permissions').delete().eq('id', exists.id)
    } else {
      const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
      await supabase.from('settlement_permissions').insert({ store_id: storeId, profile_id: profileId, granted_by: user.nm || '' })
    }
    loadPermissions()
  }

  function setF(key: string, val: number) { setForm(p => ({ ...p, [key]: val })) }

  // ── 자동 계산 ──
  const storeSales = (form.pos_sales || 0) + (form.cash_sales || 0)
  const deliverySales = (form.baemin_sales || 0) + (form.coupang_sales || 0) + (form.yogiyo_sales || 0)
  const totalSales = storeSales + deliverySales

  const cardFeeAuto = Math.round(storeSales * ((cardFeeRate || 1.1) / 100))
  const materialTotal = MATERIAL_FIELDS.reduce((s, f) => s + (form[f.key] || 0), 0)
  const laborTotal = (form.salary || 0) + (form.insurance4 || 0)
  const rentTotal = (form.rent || 0) + (form.maintenance_fee || 0)
  const utilityTotal = (form.electricity || 0) + (form.gas || 0) + (form.water || 0)
  const feeTotal = cardFeeAuto + (form.baemin_fee || 0) + (form.coupang_fee || 0) + (form.yogiyo_fee || 0) + (form.barogo_fee || 0)
  const mgmtTotal = MGMT_FIELDS.reduce((s, f) => s + (form[f.key] || 0), 0) + (form.other_mgmt || 0)
  const taxTotal = ['vat_actual', 'withholding_tax', 'fine', 'registration_tax'].reduce((s, k) => s + (form[k] || 0), 0)
  const vatExpected = totalSales > 0 ? Math.round((totalSales - materialTotal) * (10 / 110)) : 0
  const totalExpense = materialTotal + laborTotal + rentTotal + utilityTotal + feeTotal + mgmtTotal + taxTotal
  const netProfit = totalSales - totalExpense
  const profitRate = totalSales > 0 ? Math.round((netProfit / totalSales) * 1000) / 10 : 0

  async function saveSettings() {
    setSaving(true)
    const { error } = await supabase.from('settlement_settings').upsert({
      store_id: storeId, business_type: bizType, card_fee_rate: cardFeeRate,
      ...settingsForm, updated_at: new Date().toISOString(),
    }, { onConflict: 'store_id' })
    if (error) alert('저장 실패: ' + error.message)
    else { alert('설정이 저장되었습니다!'); loadAll(); setShowSettings(false) }
    setSaving(false)
  }

  async function saveMonthly() {
    if (!totalSales && !materialTotal) {
      if (!confirm('매출과 지출이 모두 0입니다. 그래도 저장할까요?')) return
    }
    setSaving(true)
    const { error } = await supabase.from('settlement_monthly').upsert({
      store_id: storeId, year, month, ...form,
      card_fee_auto: cardFeeAuto, vat_expected: vatExpected, note,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'store_id,year,month' })
    if (error) alert('저장 실패: ' + error.message)
    else { alert('저장되었습니다!'); loadAll() }
    setSaving(false)
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 48, color: '#bbb' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
      <div style={{ fontSize: 13 }}>불러오는 중...</div>
    </div>
  )

  return (
    <div>
      {/* ── 월 선택 ── */}
      <div style={{ ...bx, padding: '12px 16px' }}>
        <YearMonthPicker year={year} month={month - 1} onChange={(y, m) => { setYear(y); setMonth(m + 1) }} color="#FF6B35" />
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 10 }}>
          {monthly
            ? <span style={{ fontSize: 11, color: '#00B894', fontWeight: 600 }}>✓ {year}년 {month}월 결산 저장됨</span>
            : <span style={{ fontSize: 11, color: '#bbb' }}>미저장 (입력 후 하단 저장 버튼)</span>
          }
        </div>
      </div>

      {/* ── 지점 기본 설정 (대표만) ── */}
      {isOwner && (
        <div style={bx}>
          <button onClick={() => setShowSettings(v => !v)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>⚙️ 지점 기본 설정</span>
            <span style={{ fontSize: 11, color: '#aaa' }}>{showSettings ? '▲ 닫기' : '▼ 편집'}</span>
          </button>
          {showSettings && (
            <div style={{ marginTop: 14 }}>
              {/* 사업자 유형 */}
              <div style={{ marginBottom: 14 }}>
                <span style={lbl}>사업자 유형</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ v: 'individual', l: '🧾 개인사업자' }, { v: 'corporation', l: '🏢 법인' }].map(({ v, l }) => (
                    <button key={v} onClick={() => setBizType(v as any)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: bizType === v ? '2px solid #FF6B35' : '1px solid #E8ECF0', background: bizType === v ? 'rgba(255,107,53,0.1)' : '#F8F9FB', color: bizType === v ? '#FF6B35' : '#888', fontSize: 13, fontWeight: bizType === v ? 700 : 400, cursor: 'pointer' }}>
                      {l}
                    </button>
                  ))}
                </div>
                {bizType === 'corporation' && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(108,92,231,0.07)', borderRadius: 8, fontSize: 11, color: '#6C5CE7' }}>
                    법인: 법인세 9~24% 적용 (순수익 기준 예상치 표시)
                  </div>
                )}
                {bizType === 'individual' && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(255,107,53,0.07)', borderRadius: 8, fontSize: 11, color: '#FF6B35' }}>
                    개인사업자: 종합소득세 6~45% 적용 (연 신고 기준)
                  </div>
                )}
              </div>
              {/* 카드수수료율 */}
              <div style={{ marginBottom: 14 }}>
                <span style={lbl}>카드수수료율 (%)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="number" step="0.1" value={cardFeeRate} onChange={e => setCardFeeRate(Number(e.target.value))} style={{ ...inp, width: 90 }} />
                  <span style={{ fontSize: 11, color: '#6C5CE7', background: 'rgba(108,92,231,0.07)', padding: '5px 10px', borderRadius: 8, flexShrink: 0 }}>
                    연매출 3억↓: 0.5% · 5억↓: 1.1% · 10억↓: 1.5%
                  </span>
                </div>
              </div>
              {/* 고정비 기본값 */}
              <div style={{ marginBottom: 10, fontSize: 11, color: '#aaa' }}>
                📌 아래 값은 매월 결산 입력 시 기본값으로 자동 입력됩니다 (수정 가능)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: isPC ? 'repeat(3,1fr)' : 'repeat(2,1fr)', gap: 10 }}>
                {SETTINGS_FIELDS.map(f => (
                  <NumRow key={f.key} label={f.label} value={settingsForm[f.key] || 0} onChange={v => setSettingsForm(p => ({ ...p, [f.key]: v }))} />
                ))}
              </div>
              <button onClick={saveSettings} disabled={saving} style={{ width: '100%', marginTop: 14, padding: 12, borderRadius: 12, background: saving ? '#ddd' : 'linear-gradient(135deg,#6C5CE7,#E84393)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? '저장 중...' : '⚙️ 기본 설정 저장'}
              </button>

              {/* 관리자 권한 부여 */}
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #F0F2F5' }}>
                <button onClick={() => { setShowPermMgr(v => !v); if (!showPermMgr) loadPermissions() }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#6C5CE7', fontWeight: 700 }}>
                  👥 관리자 결산 권한 설정 {showPermMgr ? '▲' : '▼'}
                </button>
                {showPermMgr && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: '#aaa', marginBottom: 8 }}>권한을 켜면 해당 관리자가 이 지점의 결산을 입력/조회할 수 있습니다</div>
                    {managers.length === 0
                      ? <div style={{ fontSize: 12, color: '#bbb', padding: '8px 0' }}>등록된 직원이 없습니다</div>
                      : managers.map((mgr: any) => {
                        const hasPerm = permList.some((p: any) => p.profile_id === mgr.id)
                        return (
                          <div key={mgr.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: hasPerm ? 'rgba(0,184,148,0.06)' : '#F8F9FB', borderRadius: 10, marginBottom: 6, border: hasPerm ? '1px solid rgba(0,184,148,0.25)' : '1px solid #E8ECF0' }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{mgr.nm}</span>
                            <button onClick={() => togglePerm(mgr.id, mgr.nm)} style={{ padding: '5px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: hasPerm ? 'rgba(232,67,147,0.1)' : 'rgba(0,184,148,0.12)', color: hasPerm ? '#E84393' : '#00B894' }}>
                              {hasPerm ? '권한 해제' : '권한 부여'}
                            </button>
                          </div>
                        )
                      })
                    }
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 매출 ── */}
      <div style={bx}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>💰 매출</div>
        <div style={{ display: 'grid', gridTemplateColumns: isPC ? 'repeat(3,1fr)' : 'repeat(2,1fr)', gap: 10 }}>
          {SALES_FIELDS.map(f => (
            <NumRow key={f.key} label={f.label} value={form[f.key] || 0} onChange={v => setF(f.key, v)} />
          ))}
        </div>
        <div style={{ marginTop: 12, padding: '12px 14px', background: 'rgba(255,107,53,0.07)', borderRadius: 12, border: '1px solid rgba(255,107,53,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: '#888' }}>
              매장 {numFmt(storeSales)}원 · 배달 {numFmt(deliverySales)}원
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: '#aaa' }}>매출합계</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#FF6B35' }}>{numFmt(totalSales)}원</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 재료비 ── */}
      <div style={bx}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>🛒 재료비</div>
        <div style={{ display: 'grid', gridTemplateColumns: isPC ? 'repeat(4,1fr)' : 'repeat(2,1fr)', gap: 10 }}>
          {MATERIAL_FIELDS.map(f => (
            <NumRow key={f.key} label={f.label} value={form[f.key] || 0} onChange={v => setF(f.key, v)} />
          ))}
        </div>
        <SumBar label="재료비 합계" value={materialTotal} total={totalSales} color="#6C5CE7" />
      </div>

      {/* ── 인건비 ── */}
      <div style={bx}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>👤 인건비</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          <NumRow label="급여 (총액)" value={form.salary || 0} onChange={v => setF('salary', v)} />
          <NumRow label="4대보험료" value={form.insurance4 || 0} onChange={v => setF('insurance4', v)} />
        </div>
        <SumBar label="인건비 합계" value={laborTotal} total={totalSales} color="#E84393" />
      </div>

      {/* ── 임대료 ── */}
      <div style={bx}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>🏠 임대료</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          <NumRow label="월세" value={form.rent || 0} onChange={v => setF('rent', v)} />
          <NumRow label="관리비" value={form.maintenance_fee || 0} onChange={v => setF('maintenance_fee', v)} />
        </div>
        <SumBar label="임대료 합계" value={rentTotal} total={totalSales} color="#2DC6D6" />
      </div>

      {/* ── 공과금 ── */}
      <div style={bx}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>⚡ 공과금</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          <NumRow label="전기료" value={form.electricity || 0} onChange={v => setF('electricity', v)} />
          <NumRow label="가스료" value={form.gas || 0} onChange={v => setF('gas', v)} />
          <NumRow label="수도료" value={form.water || 0} onChange={v => setF('water', v)} />
        </div>
        <SumBar label="공과금 합계" value={utilityTotal} total={totalSales} color="#00B894" />
      </div>

      {/* ── 수수료 ── */}
      <div style={bx}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>💳 수수료</div>
        <div style={{ padding: '10px 14px', background: 'rgba(108,92,231,0.06)', borderRadius: 10, border: '1px solid rgba(108,92,231,0.2)', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6C5CE7' }}>카드수수료 (자동계산)</div>
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>매장매출 {numFmt(storeSales)}원 × {cardFeeRate || 1.1}%</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#6C5CE7' }}>{numFmt(cardFeeAuto)}원</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
          🛵 배달 수수료 — 각 앱 정산서 기준 <span style={{ color: '#FF6B35', fontWeight: 600 }}>배달비+수수료+광고비 합계</span>로 입력
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isPC ? 'repeat(4,1fr)' : 'repeat(2,1fr)', gap: 10 }}>
          <NumRow label="배민 총액" value={form.baemin_fee || 0} onChange={v => setF('baemin_fee', v)} />
          <NumRow label="쿠팡이츠 총액" value={form.coupang_fee || 0} onChange={v => setF('coupang_fee', v)} />
          <NumRow label="요기요 총액" value={form.yogiyo_fee || 0} onChange={v => setF('yogiyo_fee', v)} />
          <NumRow label="바로고" value={form.barogo_fee || 0} onChange={v => setF('barogo_fee', v)} />
        </div>
        <SumBar label="수수료 합계" value={feeTotal} total={totalSales} color="#FF6B35" />
      </div>

      {/* ── 기타관리비 ── */}
      <div style={bx}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>📋 기타관리비</div>
        <div style={{ display: 'grid', gridTemplateColumns: isPC ? 'repeat(4,1fr)' : 'repeat(2,1fr)', gap: 10 }}>
          {MGMT_FIELDS.map(f => (
            <NumRow key={f.key} label={f.label} value={form[f.key] || 0} onChange={v => setF(f.key, v)} />
          ))}
          <NumRow label="기타" value={form.other_mgmt || 0} onChange={v => setF('other_mgmt', v)} />
        </div>
        <SumBar label="기타관리비 합계" value={mgmtTotal} total={totalSales} color="#E67E22" />
      </div>

      {/* ── 세금 ── */}
      <div style={bx}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>🧾 세금</div>
        <div style={{ padding: '10px 14px', background: 'rgba(255,107,53,0.06)', borderRadius: 10, border: '1px solid rgba(255,107,53,0.2)', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#FF6B35' }}>부가세 예상치 (자동)</div>
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>(매출 - 재료비) × 10/110 ≈ 매입세액 공제 전 어림값</div>
              <div style={{ fontSize: 10, color: '#bbb', marginTop: 1 }}>실제 납부액은 아래 입력칸에 따로 입력하세요</div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#FF6B35' }}>{numFmt(vatExpected)}원</div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isPC ? 'repeat(4,1fr)' : 'repeat(2,1fr)', gap: 10 }}>
          <NumRow label="부가세 실제납부" value={form.vat_actual || 0} onChange={v => setF('vat_actual', v)} />
          <NumRow label="원천세" value={form.withholding_tax || 0} onChange={v => setF('withholding_tax', v)} />
          <NumRow label="과태료" value={form.fine || 0} onChange={v => setF('fine', v)} />
          <NumRow label="등록면허세" value={form.registration_tax || 0} onChange={v => setF('registration_tax', v)} />
        </div>
        <SumBar label="세금 합계" value={taxTotal} total={totalSales} color="#E84393" />
      </div>

      {/* ── 메모 ── */}
      <div style={bx}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 8 }}>📝 메모</div>
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="특이사항 메모 (선택)" rows={2} style={{ ...inp, resize: 'none' as const, lineHeight: 1.6 }} />
      </div>

      {/* ── 결산 요약 ── */}
      <div style={{ ...bx, border: `1.5px solid ${netProfit >= 0 ? 'rgba(0,184,148,0.4)' : 'rgba(232,67,147,0.4)'}`, background: netProfit >= 0 ? 'rgba(0,184,148,0.02)' : 'rgba(232,67,147,0.02)' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1a2e', marginBottom: 16 }}>📊 결산 요약</div>
        {/* 지출 구성 막대 */}
        {[
          { label: '재료비', value: materialTotal, color: '#6C5CE7' },
          { label: '인건비', value: laborTotal, color: '#E84393' },
          { label: '임대료', value: rentTotal, color: '#2DC6D6' },
          { label: '공과금', value: utilityTotal, color: '#00B894' },
          { label: '수수료', value: feeTotal, color: '#FF6B35' },
          { label: '기타관리비', value: mgmtTotal, color: '#E67E22' },
          { label: '세금', value: taxTotal, color: '#b2bec3' },
        ].map(item => item.value > 0 && (
          <div key={item.label} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: '#555' }}>{item.label}</span>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: item.color }}>{numFmt(item.value)}원</span>
                <span style={{ fontSize: 10, color: '#aaa', marginLeft: 6 }}>{pct(item.value, totalSales)}%</span>
              </div>
            </div>
            <div style={{ height: 6, background: '#F0F2F5', borderRadius: 4 }}>
              <div style={{ height: 6, borderRadius: 4, background: item.color, width: `${Math.min(pct(item.value, totalSales), 100)}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
        ))}

        <div style={{ borderTop: '2px dashed #E8ECF0', marginTop: 14, paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: '#555' }}>매출합계</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#FF6B35' }}>{numFmt(totalSales)}원</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: '#555' }}>총 지출</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: '#E84393' }}>
              {numFmt(totalExpense)}원 <span style={{ fontSize: 11, fontWeight: 400, color: '#aaa' }}>({pct(totalExpense, totalSales)}%)</span>
            </span>
          </div>
          {/* 순수익 카드 */}
          <div style={{ padding: '16px 18px', borderRadius: 14, background: netProfit >= 0 ? 'rgba(0,184,148,0.1)' : 'rgba(232,67,147,0.08)', border: `2px solid ${netProfit >= 0 ? 'rgba(0,184,148,0.35)' : 'rgba(232,67,147,0.35)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: netProfit >= 0 ? '#00B894' : '#E84393' }}>순수익</div>
                <div style={{ fontSize: 10, color: '#aaa', marginTop: 3 }}>
                  {bizType === 'corporation' ? '※ 법인세(9~24%) 반영 전' : '※ 종합소득세(6~45%) 반영 전'}
                </div>
                {/* 법인세 예상 */}
                {bizType === 'corporation' && netProfit > 0 && (
                  <div style={{ marginTop: 6, fontSize: 10, color: '#6C5CE7', background: 'rgba(108,92,231,0.08)', padding: '4px 10px', borderRadius: 7, display: 'inline-block' }}>
                    법인세 예상: {numFmt(Math.round(netProfit * 0.09))}~{numFmt(Math.round(netProfit * 0.24))}원
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: netProfit >= 0 ? '#00B894' : '#E84393', lineHeight: 1.1 }}>{numFmt(netProfit)}원</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: netProfit >= 0 ? '#00B894' : '#E84393', marginTop: 2 }}>수익률 {profitRate}%</div>
              </div>
            </div>
            {/* 수익률 게이지 */}
            <div style={{ marginTop: 12, height: 10, background: 'rgba(0,0,0,0.08)', borderRadius: 8, overflow: 'hidden' }}>
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
        </div>
      </div>

      {/* 저장 버튼 */}
      <button onClick={saveMonthly} disabled={saving} style={{ width: '100%', padding: 16, borderRadius: 14, background: saving ? '#ddd' : 'linear-gradient(135deg,#FF6B35,#E84393)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', marginBottom: 24, boxShadow: saving ? 'none' : '0 4px 14px rgba(255,107,53,0.35)' }}>
        {saving ? '저장 중...' : monthly ? '✏️ 결산 수정 저장' : '💾 결산 저장'}
      </button>
    </div>
  )
}

// ════════════════════════════════════════
// 전지점 결산 탭 (대표 전용)
// ════════════════════════════════════════
function SettlementAdminTab({ profileId, isPC }: { profileId: string; isPC: boolean }) {
  const supabase = createSupabaseBrowserClient()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [storeItems, setStoreItems] = useState<any[]>([])
  const [allMonthly, setAllMonthly] = useState<any[]>([])
  const [allSettings, setAllSettings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [profileId, year, month])

  async function loadAll() {
    setLoading(true)
    const { data: members } = await supabase.from('store_members').select('*, stores(*)').eq('profile_id', profileId).eq('active', true)
    const storeIds = (members || []).map((m: any) => m.stores?.id).filter(Boolean)
    setStoreItems(members || [])

    if (storeIds.length > 0) {
      const [{ data: md }, { data: sd }] = await Promise.all([
        supabase.from('settlement_monthly').select('*').in('store_id', storeIds).eq('year', year).eq('month', month),
        supabase.from('settlement_settings').select('*').in('store_id', storeIds),
      ])
      setAllMonthly(md || [])
      setAllSettings(sd || [])
    }
    setLoading(false)
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 48, color: '#bbb' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
      <div style={{ fontSize: 13 }}>전 지점 결산 불러오는 중...</div>
    </div>
  )

  const totalSalesAll = allMonthly.reduce((s, m) => s + (m.pos_sales || 0) + (m.cash_sales || 0) + (m.baemin_sales || 0) + (m.coupang_sales || 0) + (m.yogiyo_sales || 0), 0)
  const totalNetAll = allMonthly.reduce((m_acc, m) => {
    const sales = (m.pos_sales || 0) + (m.cash_sales || 0) + (m.baemin_sales || 0) + (m.coupang_sales || 0) + (m.yogiyo_sales || 0)
    const matT = MATERIAL_FIELDS.reduce((s, f) => s + (m[f.key] || 0), 0)
    const exp = matT + (m.salary || 0) + (m.insurance4 || 0) + (m.rent || 0) + (m.maintenance_fee || 0) + (m.electricity || 0) + (m.gas || 0) + (m.water || 0) + (m.card_fee_auto || 0) + (m.baemin_fee || 0) + (m.coupang_fee || 0) + (m.yogiyo_fee || 0) + (m.barogo_fee || 0) + MGMT_FIELDS.reduce((s, f) => s + (m[f.key] || 0), 0) + (m.other_mgmt || 0) + (m.vat_actual || 0) + (m.withholding_tax || 0) + (m.fine || 0) + (m.registration_tax || 0)
    return m_acc + (sales - exp)
  }, 0)

  return (
    <div>
      {/* 월 선택 */}
      <div style={{ ...bx, padding: '12px 16px' }}>
        <YearMonthPicker year={year} month={month - 1} onChange={(y, m) => { setYear(y); setMonth(m + 1) }} color="#6C5CE7" />
      </div>

      {/* 전체 요약 */}
      <div style={{ ...bx, border: '1.5px solid rgba(108,92,231,0.3)', background: 'rgba(108,92,231,0.03)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 12 }}>📊 {year}년 {month}월 전지점 합산</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[
            { label: '전체 매출', value: totalSalesAll, color: '#FF6B35', bg: 'rgba(255,107,53,0.08)' },
            { label: '전체 순수익', value: totalNetAll, color: totalNetAll >= 0 ? '#00B894' : '#E84393', bg: totalNetAll >= 0 ? 'rgba(0,184,148,0.08)' : 'rgba(232,67,147,0.06)' },
            { label: '결산 완료', value: allMonthly.length, color: '#6C5CE7', bg: 'rgba(108,92,231,0.08)', isCount: true, total: storeItems.length },
          ].map(item => (
            <div key={item.label} style={{ padding: '12px 8px', background: item.bg, borderRadius: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#aaa', marginBottom: 4 }}>{item.label}</div>
              {(item as any).isCount
                ? <div style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.value}/{item.total}</div>
                : <div style={{ fontSize: 14, fontWeight: 800, color: item.color }}>
                  {Math.abs(item.value) >= 10000 ? `${(item.value / 10000).toFixed(0)}만` : numFmt(item.value)}원
                </div>
              }
            </div>
          ))}
        </div>
      </div>

      {/* 지점별 카드 */}
      {storeItems.map((member: any) => {
        const sid = member.stores?.id
        const storeName = member.stores?.name || ''
        const m = allMonthly.find((x: any) => x.store_id === sid)
        const s = allSettings.find((x: any) => x.store_id === sid)

        if (!m) return (
          <div key={sid} style={{ ...bx, border: '1px solid rgba(255,107,53,0.2)', background: 'rgba(255,107,53,0.01)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>🏪 {storeName}</span>
              <span style={{ fontSize: 11, color: '#bbb', background: '#F8F9FB', padding: '3px 10px', borderRadius: 8 }}>
                {s ? `${s.business_type === 'corporation' ? '법인' : '개인사업자'}` : ''} · 결산 미입력
              </span>
            </div>
          </div>
        )

        const sales = (m.pos_sales || 0) + (m.cash_sales || 0) + (m.baemin_sales || 0) + (m.coupang_sales || 0) + (m.yogiyo_sales || 0)
        const matT = MATERIAL_FIELDS.reduce((acc, f) => acc + (m[f.key] || 0), 0)
        const expT = matT + (m.salary || 0) + (m.insurance4 || 0) + (m.rent || 0) + (m.maintenance_fee || 0) + (m.electricity || 0) + (m.gas || 0) + (m.water || 0) + (m.card_fee_auto || 0) + (m.baemin_fee || 0) + (m.coupang_fee || 0) + (m.yogiyo_fee || 0) + (m.barogo_fee || 0) + MGMT_FIELDS.reduce((acc, f) => acc + (m[f.key] || 0), 0) + (m.other_mgmt || 0) + (m.vat_actual || 0) + (m.withholding_tax || 0) + (m.fine || 0) + (m.registration_tax || 0)
        const netP = sales - expT
        const profR = sales > 0 ? Math.round((netP / sales) * 1000) / 10 : 0
        const bizLabel = s ? (s.business_type === 'corporation' ? '법인' : '개인사업자') : ''

        return (
          <div key={sid} style={{ ...bx, border: `1.5px solid ${netP >= 0 ? 'rgba(0,184,148,0.3)' : 'rgba(232,67,147,0.3)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>🏪 {storeName}</span>
                {bizLabel && <span style={{ fontSize: 10, color: '#aaa', marginLeft: 8, background: '#F4F6F9', padding: '2px 7px', borderRadius: 5 }}>{bizLabel}</span>}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 8, background: netP >= 0 ? 'rgba(0,184,148,0.12)' : 'rgba(232,67,147,0.1)', color: netP >= 0 ? '#00B894' : '#E84393' }}>
                수익률 {profR}%
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
              {[
                { label: '매출', value: sales, color: '#FF6B35' },
                { label: '지출', value: expT, color: '#E84393' },
                { label: '순수익', value: netP, color: netP >= 0 ? '#00B894' : '#E84393' },
              ].map(item => (
                <div key={item.label} style={{ textAlign: 'center', padding: '10px 6px', background: '#F8F9FB', borderRadius: 10 }}>
                  <div style={{ fontSize: 10, color: '#aaa' }}>{item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: item.color, marginTop: 3 }}>
                    {Math.abs(item.value) >= 10000 ? `${(item.value / 10000).toFixed(0)}만` : numFmt(item.value)}원
                  </div>
                </div>
              ))}
            </div>
            {/* 간략 지출 구성 */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { label: '재료', value: matT, color: '#6C5CE7' },
                { label: '인건비', value: (m.salary || 0) + (m.insurance4 || 0), color: '#E84393' },
                { label: '임대료', value: (m.rent || 0) + (m.maintenance_fee || 0), color: '#2DC6D6' },
                { label: '수수료', value: (m.card_fee_auto || 0) + (m.baemin_fee || 0) + (m.coupang_fee || 0) + (m.yogiyo_fee || 0), color: '#FF6B35' },
              ].map(item => item.value > 0 && (
                <span key={item.label} style={{ fontSize: 10, color: item.color, background: `${item.color}12`, padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                  {item.label} {pct(item.value, sales)}%
                </span>
              ))}
            </div>
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
  const [userRole, setUserRole] = useState('')
  const [profileId, setProfileId] = useState('')
  const [isPC, setIsPC] = useState(false)
  const [tab, setTab] = useState<'branch' | 'admin'>('branch')
  const [hasPermission, setHasPermission] = useState(false)
  const [permChecked, setPermChecked] = useState(false)

  const isOwner = userRole === 'owner'

  useEffect(() => {
    const check = () => setIsPC(window.innerWidth >= 768)
    check(); window.addEventListener('resize', check); return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id)
    setUserRole(user.role || '')
    setProfileId(user.id || '')
    if (user.role === 'owner') {
      setHasPermission(true); setPermChecked(true)
    } else if (user.role === 'manager') {
      checkPermission(store.id, user.id)
    } else {
      setPermChecked(true)
    }
  }, [])

  async function checkPermission(sid: string, pid: string) {
    const { data } = await supabase.from('settlement_permissions').select('id').eq('store_id', sid).eq('profile_id', pid).maybeSingle()
    setHasPermission(!!data)
    setPermChecked(true)
  }

  if (!permChecked) return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: '#bbb', fontSize: 13 }}>로딩 중...</span></div>

  // 권한 없는 관리자/직원
  if (!isOwner && !hasPermission) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center' }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: 'rgba(108,92,231,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a2e', marginBottom: 8 }}>접근 권한이 없습니다</div>
        <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.7 }}>
          결산 메뉴는 대표만 사용할 수 있어요.<br />
          대표가 권한을 부여하면 이용할 수 있습니다.
        </div>
      </div>
    )
  }

  const tabBtn = (active: boolean) => ({
    flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer' as const,
    fontSize: 13, fontWeight: active ? 700 : 400, background: active ? '#fff' : 'transparent',
    color: active ? '#1a1a2e' : '#aaa', boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
  })

  return (
    <div style={{ padding: isPC ? '0 8px' : 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: isPC ? 20 : 17, fontWeight: 700, color: '#1a1a2e' }}>💹 결산</span>
        <span style={{ fontSize: 10, padding: '3px 10px', borderRadius: 10, background: isOwner ? 'rgba(108,92,231,0.1)' : 'rgba(255,107,53,0.1)', color: isOwner ? '#6C5CE7' : '#FF6B35', fontWeight: 700 }}>
          {isOwner ? '대표' : '관리자'}
        </span>
      </div>

      {isOwner && (
        <div style={{ display: 'flex', background: '#E8ECF0', borderRadius: 12, padding: 4, marginBottom: 16 }}>
          <button style={tabBtn(tab === 'branch')} onClick={() => setTab('branch')}>🏪 지점 결산</button>
          <button style={tabBtn(tab === 'admin')} onClick={() => setTab('admin')}>👑 전지점 현황</button>
        </div>
      )}

      {tab === 'branch' && storeId && (
        <SettlementBranchTab storeId={storeId} isOwner={isOwner} isPC={isPC} />
      )}
      {tab === 'admin' && isOwner && profileId && (
        <SettlementAdminTab profileId={profileId} isPC={isPC} />
      )}
    </div>
  )
}