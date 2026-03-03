'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '10px 12px', borderRadius: 10, background: '#F8F9FB', border: '1.5px solid #E0E4E8', color: '#1a1a2e', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' }
const lbl = { fontSize: 11, color: '#888', marginBottom: 5, display: 'block' as const }

type Tracker = { id: string; store_name: string; keyword: string }
type HistoryItem = { checked_date: string; rank: number }
type PlaceItem = { rank: number; name: string; category: string; reviewCount: number; saveCount: number; isMine: boolean }
type RankResult = { keyword: string; rank: number; total: number; places: PlaceItem[]; checkedAt: string; error?: string }

function getRankBadgeStyle(rank: number) {
  if (rank === 1) return { background: 'rgba(253,196,0,0.15)', color: '#FDC400', border: '1px solid rgba(253,196,0,0.4)' }
  if (rank === 2) return { background: 'rgba(160,160,160,0.1)', color: '#999', border: '1px solid rgba(160,160,160,0.3)' }
  if (rank === 3) return { background: 'rgba(205,127,50,0.1)', color: '#B87333', border: '1px solid rgba(205,127,50,0.3)' }
  if (rank <= 10) return { background: 'rgba(0,184,148,0.08)', color: '#00B894', border: '1px solid rgba(0,184,148,0.25)' }
  if (rank <= 30) return { background: 'rgba(108,92,231,0.08)', color: '#6C5CE7', border: '1px solid rgba(108,92,231,0.2)' }
  return { background: '#F4F6F9', color: '#bbb', border: '1px solid #E8ECF0' }
}

function getBannerStyle(rank: number) {
  if (rank <= 3)  return { bg: 'linear-gradient(135deg, rgba(253,196,0,0.1), rgba(255,107,53,0.07))', border: 'rgba(253,196,0,0.35)', color: '#FDC400', icon: '🏆', desc: '상위 노출 중이에요! 최고예요 🎉' }
  if (rank <= 10) return { bg: 'rgba(0,184,148,0.07)', border: 'rgba(0,184,148,0.25)', color: '#00B894', icon: '✅', desc: '상위 10위 안에 있어요' }
  if (rank <= 30) return { bg: 'rgba(108,92,231,0.07)', border: 'rgba(108,92,231,0.2)', color: '#6C5CE7', icon: '📊', desc: '30위 안에 있어요' }
  if (rank > 30)  return { bg: 'rgba(232,67,147,0.06)', border: 'rgba(232,67,147,0.2)', color: '#E84393', icon: '📉', desc: '순위가 낮아요. 관리가 필요해요' }
  return { bg: '#F8F9FB', border: '#E8ECF0', color: '#bbb', icon: '😶', desc: '100위 안에 없어요' }
}

function MiniGraph({ history }: { history: HistoryItem[] }) {
  if (history.length < 2) return null
  const sorted = [...history].sort((a, b) => a.checked_date.localeCompare(b.checked_date))
  const ranks = sorted.map(h => h.rank)
  const maxR = Math.max(...ranks)
  const minR = Math.min(...ranks)
  const range = maxR - minR || 1
  const w = 200, h = 60, pad = 8
  const points = ranks.map((r, i) => {
    const x = pad + (i / (ranks.length - 1)) * (w - pad * 2)
    const y = pad + ((r - minR) / range) * (h - pad * 2)
    return `${x},${y}`
  }).join(' ')

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, color: '#bbb', marginBottom: 4 }}>순위 변동 (최근 {sorted.length}일)</div>
      <svg width={w} height={h} style={{ overflow: 'visible' }}>
        <polyline points={points} fill="none" stroke="#FF6B35" strokeWidth="2" strokeLinejoin="round" />
        {ranks.map((r, i) => {
          const x = pad + (i / (ranks.length - 1)) * (w - pad * 2)
          const y = pad + ((r - minR) / range) * (h - pad * 2)
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={3} fill="#FF6B35" />
              <text x={x} y={y - 6} textAnchor="middle" fontSize={9} fill="#FF6B35">{r}위</text>
            </g>
          )
        })}
        {sorted.map((h, i) => {
          const x = pad + (i / (ranks.length - 1)) * (w - pad * 2)
          return <text key={i} x={x} y={58} textAnchor="middle" fontSize={8} fill="#ccc">{h.checked_date.slice(5)}</text>
        })}
      </svg>
    </div>
  )
}

export default function PlaceRankChecker() {
  const [tab, setTab] = useState<'check' | 'track'>('check')
  const [storeName, setStoreName] = useState('')
  const [kwInput, setKwInput] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [currentKw, setCurrentKw] = useState('')
  const [results, setResults] = useState<RankResult[]>([])
  const [trackers, setTrackers] = useState<Tracker[]>([])
  const [histories, setHistories] = useState<Record<string, HistoryItem[]>>({})
  const [trackStore, setTrackStore] = useState('')
  const [trackKw, setTrackKw] = useState('')
  const [storeId, setStoreId] = useState('')

  useEffect(() => {
    // store_id를 로컬스토리지에서 가져오거나 생성
    let sid = localStorage.getItem('place_store_id')
    if (!sid) { sid = Math.random().toString(36).slice(2); localStorage.setItem('place_store_id', sid) }
    setStoreId(sid)
    loadTrackers(sid)
  }, [])

  async function loadTrackers(sid: string) {
    const { data } = await supabase.from('place_rank_trackers').select('*').eq('store_id', sid)
    if (data) {
      setTrackers(data)
      for (const t of data) {
        const { data: h } = await supabase.from('place_rank_history').select('checked_date, rank').eq('tracker_id', t.id).order('checked_date', { ascending: true })
        if (h) setHistories(prev => ({ ...prev, [t.id]: h }))
      }
    }
  }

  async function addTracker() {
    if (!trackStore.trim() || !trackKw.trim()) { alert('업체명과 키워드를 입력해주세요!'); return }
    const { data, error } = await supabase.from('place_rank_trackers').insert({ store_id: storeId, store_name: trackStore.trim(), keyword: trackKw.trim() }).select().single()
    if (error) { alert('이미 등록된 키워드예요!'); return }
    setTrackers(prev => [...prev, data])
    setTrackKw('')
    alert('등록됐어요!')
  }

  async function deleteTracker(id: string) {
    await supabase.from('place_rank_trackers').delete().eq('id', id)
    setTrackers(prev => prev.filter(t => t.id !== id))
    setHistories(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  async function saveRank(tracker: Tracker, rank: number) {
    await supabase.from('place_rank_history').upsert({
      tracker_id: tracker.id,
      store_id: storeId,
      keyword: tracker.keyword,
      rank,
      checked_date: new Date().toISOString().slice(0, 10),
    }, { onConflict: 'tracker_id,checked_date' })
  }

  async function checkAllTrackers() {
    setLoading(true)
    for (const t of trackers) {
      setCurrentKw(t.keyword)
      try {
        const res = await fetch(`/api/place-rank?keyword=${encodeURIComponent(t.keyword)}&store=${encodeURIComponent(t.store_name)}`)
        const data = await res.json()
        if (data.rank > 0) await saveRank(t, data.rank)
        const { data: h } = await supabase.from('place_rank_history').select('checked_date, rank').eq('tracker_id', t.id).order('checked_date', { ascending: true })
        if (h) setHistories(prev => ({ ...prev, [t.id]: h }))
      } catch {}
      await new Promise(r => setTimeout(r, 1000))
    }
    setLoading(false)
    setCurrentKw('')
    alert('순위 저장 완료!')
  }

  function addKeyword() {
    const val = kwInput.trim()
    if (!val) return
    if (keywords.includes(val)) { alert('이미 추가된 키워드예요!'); return }
    setKeywords(p => [...p, val])
    setKwInput('')
  }

  function removeKeyword(kw: string) { setKeywords(p => p.filter(k => k !== kw)) }

  async function startSearch() {
    if (!storeName.trim()) { alert('업체명을 입력해주세요!'); return }
    if (keywords.length === 0) { alert('키워드를 1개 이상 추가해주세요!'); return }
    setLoading(true); setResults([])
    for (let i = 0; i < keywords.length; i++) {
      const kw = keywords[i]; setCurrentKw(kw)
      try {
        const res = await fetch(`/api/place-rank?keyword=${encodeURIComponent(kw)}&store=${encodeURIComponent(storeName.trim())}`)
        const data = await res.json()
        setResults(p => [...p, { keyword: kw, rank: data.rank ?? -1, total: data.total ?? 0, places: data.places ?? [], checkedAt: data.checkedAt ?? new Date().toISOString(), error: data.error }])
      } catch {
        setResults(p => [...p, { keyword: kw, rank: -1, total: 0, places: [], checkedAt: new Date().toISOString(), error: '조회 실패' }])
      }
      if (i < keywords.length - 1) await new Promise(r => setTimeout(r, 1000))
    }
    setLoading(false); setCurrentKw('')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>📍 플레이스 순위</span>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(255,107,53,0.1)', color: '#FF6B35', border: '1px solid rgba(255,107,53,0.25)', fontWeight: 600 }}>LIVE</span>
      </div>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['check', 'track'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', background: tab === t ? 'linear-gradient(135deg, #FF6B35, #E84393)' : '#F4F6F9', color: tab === t ? '#fff' : '#888' }}>
            {t === 'check' ? '🔍 순위 조회' : '📈 순위 추적'}
          </button>
        ))}
      </div>

      {tab === 'check' && (
        <>
          <div style={{ background: 'rgba(45,198,214,0.06)', border: '1px solid rgba(45,198,214,0.22)', borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: 11, color: '#2DC6D6', lineHeight: 1.7 }}>
            💡 키워드 검색으로 내 업체가 몇 위에 노출되는지 확인해요.
          </div>
          <div style={bx}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>🏪 내 업체명</div>
            <span style={lbl}>네이버 플레이스에 등록된 정확한 업체명</span>
            <input style={inp} value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="예) 파스타랑 W 평택고덕로데오점" />
          </div>
          <div style={bx}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>🔍 검색 키워드</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inp, flex: 1 }} value={kwInput} onChange={e => setKwInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addKeyword()} placeholder="예) 평택파스타, 평택맛집" />
              <button onClick={addKeyword} style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(255,107,53,0.1)', border: '1.5px solid rgba(255,107,53,0.3)', color: '#FF6B35', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>추가</button>
            </div>
            {keywords.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {keywords.map(kw => (
                  <div key={kw} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px 5px 12px', borderRadius: 20, background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.25)', fontSize: 12, color: '#FF6B35', fontWeight: 600 }}>
                    {kw}<button onClick={() => removeKeyword(kw)} style={{ background: 'none', border: 'none', color: '#FF6B35', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0, opacity: 0.5 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={startSearch} disabled={loading} style={{ width: '100%', padding: '15px 0', borderRadius: 13, background: loading ? '#ddd' : 'linear-gradient(135deg, #FF6B35, #E84393)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 16, boxShadow: loading ? 'none' : '0 4px 16px rgba(255,107,53,0.28)', fontFamily: 'inherit' }}>
            {loading ? `"${currentKw}" 조회 중...` : '🔍 순위 조회하기'}
          </button>
          {results.map((r, i) => {
            if (r.error) return (
              <div key={i} style={{ ...bx, background: 'rgba(232,67,147,0.04)', border: '1px solid rgba(232,67,147,0.2)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#E84393' }}>⚠️ "{r.keyword}" 조회 실패</div>
              </div>
            )
            const b = getBannerStyle(r.rank)
            return (
              <div key={i}>
                <div style={{ background: b.bg, border: `1px solid ${b.border}`, borderRadius: 16, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 30 }}>{b.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>"{r.keyword}" 검색 결과</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: b.color, lineHeight: 1 }}>{r.rank > 0 ? `${r.rank}위` : '100위 밖'}</div>
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>{b.desc}</div>
                  </div>
                </div>
                <div style={{ ...bx, marginBottom: 20 }}>
                  {r.places.map(p => (
                    <div key={p.rank} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #F4F6F9' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, flexShrink: 0, ...getRankBadgeStyle(p.rank) }}>{p.rank}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: p.isMine ? 700 : 600, color: p.isMine ? '#FF6B35' : '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>{p.category}</div>
                      </div>
                      {p.isMine && <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 8, background: 'rgba(255,107,53,0.12)', color: '#FF6B35', border: '1px solid rgba(255,107,53,0.3)', fontWeight: 700 }}>내 업체</span>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}

      {tab === 'track' && (
        <>
          {/* 키워드 등록 */}
          <div style={bx}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>➕ 추적 키워드 등록</div>
            <span style={lbl}>업체명</span>
            <input style={{ ...inp, marginBottom: 8 }} value={trackStore} onChange={e => setTrackStore(e.target.value)} placeholder="예) 파스타랑 W 평택고덕로데오점" />
            <span style={lbl}>키워드</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inp, flex: 1 }} value={trackKw} onChange={e => setTrackKw(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTracker()} placeholder="예) 평택파스타" />
              <button onClick={addTracker} style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(255,107,53,0.1)', border: '1.5px solid rgba(255,107,53,0.3)', color: '#FF6B35', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>등록</button>
            </div>
          </div>

          {trackers.length > 0 && (
            <>
              <button onClick={checkAllTrackers} disabled={loading} style={{ width: '100%', padding: '13px 0', borderRadius: 13, background: loading ? '#ddd' : 'linear-gradient(135deg, #FF6B35, #E84393)', border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 14, fontFamily: 'inherit' }}>
                {loading ? `"${currentKw}" 조회 중...` : '📊 오늘 순위 저장하기'}
              </button>

              {trackers.map(t => {
                const h = histories[t.id] || []
                const latest = h[h.length - 1]
                const prev = h[h.length - 2]
                const diff = latest && prev ? prev.rank - latest.rank : 0
                return (
                  <div key={t.id} style={bx}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>{t.store_name}</span>
                        <span style={{ fontSize: 11, color: '#FF6B35', marginLeft: 8, fontWeight: 600 }}>#{t.keyword}</span>
                      </div>
                      <button onClick={() => deleteTracker(t.id)} style={{ background: 'none', border: 'none', color: '#ddd', cursor: 'pointer', fontSize: 16 }}>×</button>
                    </div>
                    {latest ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: '#FF6B35' }}>{latest.rank}위</div>
                        {diff !== 0 && (
                          <div style={{ fontSize: 12, fontWeight: 700, color: diff > 0 ? '#00B894' : '#E84393' }}>
                            {diff > 0 ? `▲ ${diff}` : `▼ ${Math.abs(diff)}`}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: '#bbb' }}>{latest.checked_date}</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: '#bbb' }}>아직 조회 기록이 없어요. 위 버튼을 눌러주세요!</div>
                    )}
                    <MiniGraph history={h} />
                  </div>
                )
              })}
            </>
          )}

          {trackers.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#bbb', fontSize: 13 }}>
              추적할 키워드를 등록해보세요 😊
            </div>
          )}
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}