import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get('keyword')
  const storeName = searchParams.get('store')

  if (!keyword || !storeName) {
    return NextResponse.json({ error: '키워드와 업체명을 입력해주세요' }, { status: 400 })
  }

  try {
    // 네이버 지도 검색 API 호출 (서버사이드 → CORS 없음)
    const url = `https://map.naver.com/p/api/search/allSearch?query=${encodeURIComponent(keyword)}&type=all&searchCoord=&boundary=`

    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ko-KR,ko;q=0.9',
        'Referer': 'https://map.naver.com/',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
      next: { revalidate: 0 } // 캐시 없이 항상 최신 결과
    })

    if (!res.ok) {
      throw new Error(`네이버 서버 오류: ${res.status}`)
    }

    const data = await res.json()
    const places: any[] = data?.result?.place?.list || []

    if (places.length === 0) {
      return NextResponse.json({ rank: -1, total: 0, places: [] })
    }

    // 업체명 매칭 (공백 제거 후 포함 여부 확인)
    const normalize = (s: string) => s.replace(/\s/g, '').toLowerCase()
    const storeNorm = normalize(storeName)

    let foundRank = -1
    places.forEach((p: any, idx: number) => {
      const nameNorm = normalize(p.name || '')
      if (foundRank === -1 && (nameNorm.includes(storeNorm) || storeNorm.includes(nameNorm))) {
        foundRank = idx + 1
      }
    })

    // 상위 15개 업체 정보 반환
    const placeList = places.slice(0, 15).map((p: any, idx: number) => {
      const nameNorm = normalize(p.name || '')
      return {
        rank: idx + 1,
        name: p.name || '',
        category: p.category || '',
        address: p.roadAddress || p.address || '',
        reviewCount: p.reviewCount || 0,
        saveCount: p.saveCount || 0,
        isMine: nameNorm.includes(storeNorm) || storeNorm.includes(nameNorm),
      }
    })

    return NextResponse.json({
      rank: foundRank,
      total: places.length,
      places: placeList,
      checkedAt: new Date().toISOString(),
    })

  } catch (error: any) {
    console.error('Place rank error:', error)
    return NextResponse.json(
      { error: error.message || '순위 조회 중 오류가 발생했어요' },
      { status: 500 }
    )
  }
}