'use client'
import { useState } from 'react'

const bx = { background: '#ffffff', borderRadius: 16, border: '1px solid #E8ECF0', padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }
const inp = { width: '100%', padding: '10px 12px', borderRadius: 10, background: '#F8F9FB', border: '1.5px solid #E0E4E8', color: '#1a1a2e', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' }
const lbl = { fontSize: 11, color: '#888', marginBottom: 5, display: 'block' as const }

type PlaceItem = {
  rank: number
  name: string
  category: string
  address: string
  reviewCount: number
  saveCount: number
  isMine: boolean
}

type RankResult = {
  keyword: string
  rank: number
  total: number
  places: PlaceItem[]
  checkedAt: string
  error?: string
}

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

export default function PlaceRankChecker() {
  const [storeName, setStoreName] = useState('')
  const [kwInput, setKwInput] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [currentKw, setCurrentKw] = useState('')
  const [results, setResults] = useState<RankResult[]>([])

  function addKeyword() {
    const val = kwInput.trim()
    if (!val) return
    if (keywords.includes(val)) { alert('이미 추가된 키워드예요!'); return }
    setKeywords(p => [...p, val])
    setKwInput('')
  }

  function removeKeyword(kw: string) {
    setKeywords(p => p.filter(k => k !== kw))
  }

  async function startSearch() {
    if (!storeName.trim()) { alert('업체명을 입력해주세요!'); return }
    if (keywords.length === 0) { alert('키워드를 1개 이상 추가해주세요!'); return }

    setLoading(true)
    setResults([])

    for (let i = 0; i < keywords.length; i++) {
      const kw = keywords[i]
      setCurrentKw(kw)

      try {
        const res = await fetch(`/api/place-rank?keyword=${encodeURIComponent(kw)}&store=${encodeURIComponent(storeName.trim())}`)
        const data = await res.json()

        setResults(p => [...p, {
          keyword: kw,
          rank: data.rank ?? -1,
          total: data.total ?? 0,
          places: data.places ?? [],
          checkedAt: data.checkedAt ?? new Date().toISOString(),
          error: data.error,
        }])
      } catch {
        setResults(p => [...p, { keyword: kw, rank: -1, total: 0, places: [], checkedAt: new Date().toISOString(), error: '조회 실패' }])
      }

      if (i < keywords.length - 1) await new Promise(r => setTimeout(r, 1000))
    }

    setLoading(false)
    setCurrentKw('')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>📍 플레이스 순위</span>
        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(255,107,53,0.1)', color: '#FF6B35', border: '1px solid rgba(255,107,53,0.25)', fontWeight: 600 }}>LIVE</span>
      </div>

      {/* 안내 */}
      <div style={{ background: 'rgba(45,198,214,0.06)', border: '1px solid rgba(45,198,214,0.22)', borderRadius: 12, padding: '10px 14px', marginBottom: 12, fontSize: 11, color: '#2DC6D6', lineHeight: 1.7 }}>
        💡 키워드 검색으로 내 업체가 몇 위에 노출되는지 확인해요.<br />내 플레이스에는 아무런 영향이 없어요.
      </div>

      {/* 업체명 */}
      <div style={bx}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>🏪 내 업체명</div>
        <span style={lbl}>네이버 플레이스에 등록된 정확한 업체명</span>
        <input
          style={inp} value={storeName}
          onChange={e => setStoreName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && document.getElementById('kwInput')?.focus()}
          placeholder="예) 홍길동 미용실, OO치킨 강남점"
        />
      </div>

      {/* 키워드 */}
      <div style={bx}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 }}>🔍 검색 키워드</div>
        <span style={lbl}>순위를 확인할 키워드 (여러 개 가능)</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="kwInput" style={{ ...inp, flex: 1 }} value={kwInput}
            onChange={e => setKwInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addKeyword()}
            placeholder="예) 강남 미용실, 강남역 헤어샵"
          />
          <button onClick={addKeyword} style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(255,107,53,0.1)', border: '1.5px solid rgba(255,107,53,0.3)', color: '#FF6B35', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>추가</button>
        </div>
        {keywords.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {keywords.map(kw => (
              <div key={kw} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 8px 5px 12px', borderRadius: 20, background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.25)', fontSize: 12, color: '#FF6B35', fontWeight: 600 }}>
                {kw}
                <button onClick={() => removeKeyword(kw)} style={{ background: 'none', border: 'none', color: '#FF6B35', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0, opacity: 0.5 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 조회 버튼 */}
      <button
        onClick={startSearch} disabled={loading}
        style={{ width: '100%', padding: '15px 0', borderRadius: 13, background: loading ? '#ddd' : 'linear-gradient(135deg, #FF6B35, #E84393)', border: 'none', color: '#fff', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 16, boxShadow: loading ? 'none' : '0 4px 16px rgba(255,107,53,0.28)', fontFamily: 'inherit' }}
      >
        {loading ? `"${currentKw}" 조회 중...` : '🔍 순위 조회하기'}
      </button>

      {/* 로딩 */}
      {loading && (
        <div style={bx}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid #F0F2F5', borderTopColor: '#FF6B35', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: '#FF6B35' }}>"{currentKw}" 검색 중...</div>
            <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>네이버 플레이스 순위를 확인하고 있어요</div>
          </div>
        </div>
      )}

      {/* 결과 */}
      {results.map((r, i) => {
        if (r.error) return (
          <div key={i} style={{ ...bx, background: 'rgba(232,67,147,0.04)', border: '1px solid rgba(232,67,147,0.2)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#E84393', marginBottom: 4 }}>⚠️ "{r.keyword}" 조회 실패</div>
            <div style={{ fontSize: 11, color: '#aaa' }}>{r.error}</div>
          </div>
        )

        const b = getBannerStyle(r.rank)

        return (
          <div key={i}>
            {/* 순위 배너 */}
            <div style={{ background: b.bg, border: `1px solid ${b.border}`, borderRadius: 16, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 30 }}>{b.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>"{r.keyword}" 검색 결과</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: b.color, lineHeight: 1 }}>
                  {r.rank > 0 ? `${r.rank}위` : '100위 밖'}
                </div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 3 }}>{b.desc}</div>
              </div>
              <div style={{ fontSize: 10, color: '#ccc', textAlign: 'right' }}>
                {new Date(r.checkedAt).toLocaleTimeString('ko', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {/* 업체 리스트 */}
            <div style={{ ...bx, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <span style={{ background: 'rgba(45,198,214,0.1)', color: '#2DC6D6', padding: '2px 9px', borderRadius: 10, border: '1px solid rgba(45,198,214,0.25)', fontSize: 11, fontWeight: 700 }}>{r.keyword}</span>
                <span style={{ fontSize: 10, color: '#bbb', marginLeft: 'auto' }}>상위 {r.places.length}개 · 총 {r.total}개</span>
              </div>
              {r.places.map(p => (
                <div key={p.rank} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #F4F6F9' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, flexShrink: 0, ...getRankBadgeStyle(p.rank) }}>
                    {p.rank}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: p.isMine ? 700 : 600, color: p.isMine ? '#FF6B35' : '#1a1a2e', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: 10, color: '#bbb', marginTop: 2 }}>
                      {p.category}{p.reviewCount > 0 ? ` · 리뷰 ${p.reviewCount.toLocaleString()}` : ''}{p.saveCount > 0 ? ` · 저장 ${p.saveCount.toLocaleString()}` : ''}
                    </div>
                  </div>
                  {p.isMine && (
                    <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 8, background: 'rgba(255,107,53,0.12)', color: '#FF6B35', border: '1px solid rgba(255,107,53,0.3)', fontWeight: 700, flexShrink: 0 }}>내 업체</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}