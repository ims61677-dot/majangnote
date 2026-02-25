'use client'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase'

const bx = { background: '#ffffff', borderRadius: 16,
  border: '1px solid #E8ECF0', padding: 16, marginBottom: 12,
  boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '8px 10px', borderRadius: 8,
  background: '#F8F9FB', border: '1px solid #E0E4E8',
  color: '#1a1a2e', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

function toComma(v: string | number) {
  if (v === '' || v === 0 || v === '0') return '0'
  const n = typeof v === 'string' ? Number(v.replace(/,/g, '')) : v
  return isNaN(n) ? '0' : n.toLocaleString('ko-KR')
}
function fromComma(s: string) { return Number(String(s).replace(/[^0-9.-]/g, '')) || 0 }

export default function ClosingPage() {
  const supabase = createSupabaseBrowserClient()
  const now = new Date()
  const [yr, setYr] = useState(now.getFullYear())
  const [mo, setMo] = useState(now.getMonth() + 1)
  const [sel, setSel] = useState<number | null>(null)
  const [closings, setClosings] = useState<Record<string, any>>({})
  const [channels, setChannels] = useState<any[]>([])
  const [storeId, setStoreId] = useState('')
  const [userId, setUserId] = useState('')
  const [saving, setSaving] = useState(false)
  const [isEdit, setIsEdit] = useState(false)
  const [showAddCh, setShowAddCh] = useState(false)
  const [newChL, setNewChL] = useState('')

  useEffect(() => {
    const store = JSON.parse(localStorage.getItem('mj_store') || '{}')
    const user = JSON.parse(localStorage.getItem('mj_user') || '{}')
    if (!store.id) return
    setStoreId(store.id); setUserId(user.id)
    setIsEdit(user.role === 'owner' || user.role === 'manager')
    loadChannels(store.id); loadClosings(store.id)
  }, [yr, mo])

  async function loadChannels(sid: string) {
    const { data } = await supabase.from('sales_channels').select('*').eq('store_id', sid).order('sort_order')
    if (data && data.length > 0) setChannels(data)
    else {
      const defaults = [
        { key: 'h', label: '홀', color: '#FF6B35', sort_order: 0 },
        { key: 'b', label: '배민', color: '#2DC6D6', sort_order: 1 },
        { key: 'y', label: '요기요', color: '#E84393', sort_order: 2 },
        { key: 'c', label: '쿠팡', color: '#6C5CE7', sort_order: 3 },
        { key: 'cash', label: '현금', color: '#FDCB6E', sort_order: 4 },
        { key: 'transfer', label: '계좌이체', color: '#00B894', sort_order: 5 },
        { key: 'etc', label: '기타', color: '#74B9FF', sort_order: 6 },
      ]
      await supabase.from('sales_channels').insert(defaults.map(d => ({ ...d, store_id: sid })))
      setChannels(defaults.map((d, i) => ({ ...d, id: String(i), store_id: sid })))
    }
  }

  async function loadClosings(sid: string) {
    const from = `${yr}-${String(mo).padStart(2,'0')}-01`
    const to = `${yr}-${String(mo).padStart(2,'0')}-${String(new Date(yr,mo,0).getDate()).padStart(2,'0')}`
    const { data } = await supabase.from('closings').select('*').eq('store_id', sid).gte('date', from).lte('date', to)
    const map: Record<string,any> = {}
    if (data) data.forEach(cl => {
      const d = parseInt(cl.date.split('-')[2])
      map[d] = { ...cl.channel_data, sj: cl.cash, memo: cl.memo }
    })
    setClosings(map)
  }

  const getCl = useCallback((d: number) => {
    const base: Record<string,any> = {}
    channels.forEach(ch => { base[ch.key] = '' })
    base.sj = ''; base.memo = ''
    return closings[d] || base
  }, [closings, channels])

  const setClF = useCallback((d: number, field: string, val: string) => {
    setClosings(p => ({ ...p, [d]: { ...(p[d] || {}), [field]: val } }))
  }, [])

  async function saveCl(d: number) {
    if (!storeId) return
    setSaving(true)
    const cl = getCl(d)
    const channelData: Record<string,number> = {}
    channels.forEach(ch => { channelData[ch.key] = fromComma(cl[ch.key] || '0') })
    const dateStr = `${yr}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    await supabase.from('closings').upsert({
      store_id: storeId, date: dateStr,
      channel_data: channelData, cash: fromComma(cl.sj || '0'),
      memo: cl.memo || '', created_by: userId, updated_at: new Date().toISOString()
    }, { onConflict: 'store_id,date' })
    setSaving(false)
  }

  const sales = useMemo(() => {
    return Object.entries(closings).map(([d, cl]) => {
      let t = 0; channels.forEach(ch => { t += fromComma(cl[ch.key] || '0') })
      return { d: parseInt(d), t, ...cl }
    }).filter(x => x.t > 0)
  }, [closings, channels])
  const sMap = useMemo(() => { const m: Record<number,any> = {}; sales.forEach(s => m[s.d] = s); return m }, [sales])

  async function addChannel() {
    if (!newChL.trim() || !storeId) return
    const key = 'ch_' + Date.now()
    const colors = ['#FF6B35','#2DC6D6','#E84393','#6C5CE7','#FDCB6E','#00B894','#74B9FF']
    const color = colors[channels.length % colors.length]
    const { data } = await supabase.from('sales_channels').insert({
      store_id: storeId, key, label: newChL.trim(), color, sort_order: channels.length
    }).select().single()
    if (data) setChannels(p => [...p, data])
    setNewChL(''); setShowAddCh(false)
  }

  const DAYS = ['일','월','화','수','목','금','토']
  function fmtW(n: number) { return n.toLocaleString('ko-KR') + '원' }

  // 달력
  const firstDay = new Date(yr, mo-1, 1).getDay()
  const daysInMonth = new Date(yr, mo, 0).getDate()
  const calCells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, i) => {
    const d = i - firstDay + 1
    return (d >= 1 && d <= daysInMonth) ? d : null
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>💰 마감일지</span>
        {isEdit && (
          <button onClick={() => setShowAddCh(p => !p)}
            style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(45,198,214,0.1)',
              border: '1px solid rgba(45,198,214,0.3)', color: '#2DC6D6', fontSize: 11, cursor: 'pointer' }}>
            + 채널추가
          </button>
        )}
      </div>

      {showAddCh && (
        <div style={{ ...bx, border: '1px solid rgba(45,198,214,0.3)' }}>
          <input value={newChL} onChange={e => setNewChL(e.target.value)}
            placeholder="채널 이름 (예: 네이버)" style={{ ...inp, marginBottom: 8 }} />
          <button onClick={addChannel}
            style={{ padding: '8px 16px', borderRadius: 8, background: '#2DC6D6', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>추가</button>
        </div>
      )}

      {/* 월 선택 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={() => { if (mo===1){setYr(yr-1);setMo(12)}else setMo(mo-1) }}
          style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: '#555', fontSize: 14 }}>←</button>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>{yr}년 {mo}월</span>
        <button onClick={() => { if (mo===12){setYr(yr+1);setMo(1)}else setMo(mo+1) }}
          style={{ background: '#fff', border: '1px solid #E8ECF0', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: '#555', fontSize: 14 }}>→</button>
      </div>

      {/* 달력 */}
      <div style={{ ...bx, padding: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 }}>
          {['일','월','화','수','목','금','토'].map((d,i) => (
            <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600,
              color: i===0 ? '#E84393' : i===6 ? '#4A90E2' : '#999', paddingBottom: 4 }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
          {calCells.map((d, i) => {
            if (!d) return <div key={i} />
            const s = sMap[d]
            const isSelected = sel === d
            const dayOfWeek = (firstDay + d - 1) % 7
            return (
              <div key={i} onClick={() => setSel(isSelected ? null : d)}
                style={{ textAlign: 'center', padding: '6px 2px', borderRadius: 8, cursor: 'pointer',
                  background: isSelected ? '#FF6B35' : s ? '#FFF0EB' : 'transparent',
                  border: isSelected ? '1px solid #FF6B35' : '1px solid transparent' }}>
                <div style={{ fontSize: 12, fontWeight: 600,
                  color: isSelected ? '#fff' : dayOfWeek===0 ? '#E84393' : dayOfWeek===6 ? '#4A90E2' : '#1a1a2e' }}>{d}</div>
                {s && <div style={{ fontSize: 8, color: isSelected ? '#fff' : '#FF6B35', fontWeight: 600 }}>
                  {s.t >= 10000 ? (s.t/10000).toFixed(0)+'만' : String(s.t)}
                </div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* 선택 날짜 입력 폼 */}
      {sel && (
        <div style={{ ...bx, border: '1px solid rgba(255,107,53,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>
              {mo}월 {sel}일 ({DAYS[new Date(yr,mo-1,sel).getDay()]})
            </span>
            <button onClick={() => setSel(null)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 16 }}>✕</button>
          </div>
          {channels.map((ch: any) => {
            const cl = getCl(sel)
            return (
              <div key={ch.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: ch.color, flexShrink: 0 }} />
                <span style={{ width: 60, fontSize: 12, color: '#555', fontWeight: 500 }}>{ch.label}</span>
                <input value={toComma(cl[ch.key] || '')} style={inp}
                  onChange={e => setClF(sel, ch.key, String(fromComma(e.target.value)))}
                  onFocus={e => { if (e.target.value === '0') e.target.value = '' }}
                  placeholder="0" readOnly={!isEdit} />
              </div>
            )
          })}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#555', width: 68, fontWeight: 500 }}>💰 시재</span>
            <input value={toComma(getCl(sel).sj || '')} style={inp}
              onChange={e => setClF(sel, 'sj', String(fromComma(e.target.value)))} placeholder="0" readOnly={!isEdit} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: '#555', fontWeight: 500 }}>📋 메모</span>
            <textarea value={getCl(sel).memo || ''} rows={2}
              onChange={e => setClF(sel, 'memo', e.target.value)}
              style={{ ...inp, resize: 'vertical', marginTop: 4 }} readOnly={!isEdit} />
          </div>
          {(() => {
            const cl = getCl(sel); let tot = 0
            channels.forEach(ch => { tot += fromComma(cl[ch.key] || '0') })
            return tot > 0 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                borderTop: '1px solid #F0F2F5', marginBottom: 10 }}>
                <span style={{ fontWeight: 700, color: '#FF6B35' }}>합계</span>
                <span style={{ fontWeight: 800, color: '#1a1a2e' }}>{fmtW(tot)}</span>
              </div>
            ) : null
          })()}
          {isEdit && (
            <button onClick={() => saveCl(sel)} disabled={saving}
              style={{ width: '100%', padding: 12, borderRadius: 10,
                background: saving ? '#ccc' : 'linear-gradient(135deg,#FF6B35,#E84393)',
                border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? '저장 중...' : '💾 저장'}
            </button>
          )}
        </div>
      )}

      {/* 월간 요약 */}
      {sales.length > 0 && (
        <div style={bx}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>📊 {mo}월 요약</div>
          {sales.sort((a,b) => a.d - b.d).map(s => (
            <div key={s.d} onClick={() => setSel(s.d)}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                borderBottom: '1px solid #F4F6F9', cursor: 'pointer' }}>
              <span style={{ fontSize: 12, color: '#888' }}>{mo}/{s.d} ({DAYS[new Date(yr,mo-1,s.d).getDay()]})</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#FF6B35' }}>{fmtW(s.t)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0',
            borderTop: '1px solid #E8ECF0', marginTop: 4 }}>
            <span style={{ fontWeight: 700, color: '#1a1a2e' }}>월 합계</span>
            <span style={{ fontWeight: 800, color: '#FF6B35' }}>{fmtW(sales.reduce((a,s) => a + s.t, 0))}</span>
          </div>
        </div>
      )}
    </div>
  )
}