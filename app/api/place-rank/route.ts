import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const keyword = searchParams.get('keyword')
  const storeName = searchParams.get('store')

  if (!keyword || !storeName) {
    return NextResponse.json({ error: '키워드와 업체명을 입력해주세요' }, { status: 400 })
  }

  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'API 키가 설정되지 않았어요' }, { status: 500 })
  }

  try {
    const allPlaces: any[] = []
    const seenNames = new Set<string>()

    for (let start = 1; start <= 100; start += 5) {
      const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(keyword)}&display=5&start=${start}&sort=comment`

      const res = await fetch(url, {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
      })

      if (!res.ok) break

      const data = await res.json()
      const items = data?.items || []
      if (items.length === 0) break

      for (const item of items) {
        const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '')
        const name = stripHtml(item.title || '').trim()
        if (!seenNames.has(name)) {
          seenNames.add(name)
          allPlaces.push(item)
        }
      }

      if (items.length < 5) break
    }

    if (allPlaces.length === 0) {
      return NextResponse.json({ rank: -1, total: 0, places: [] })
    }

    const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '')
    const normalize = (s: string) => stripHtml(s).replace(/\s/g, '').toLowerCase()
    const storeNorm = normalize(storeName)

    let foundRank = -1
    allPlaces.forEach((p: any, idx: number) => {
      const nameNorm = normalize(p.title || '')
      if (foundRank === -1 && (nameNorm.includes(storeNorm) || storeNorm.includes(nameNorm))) {
        foundRank = idx + 1
      }
    })

    const placeList = allPlaces.slice(0, 15).map((p: any, idx: number) => {
      const nameNorm = normalize(p.title || '')
      return {
        rank: idx + 1,
        name: stripHtml(p.title || ''),
        category: p.category || '',
        address: p.roadAddress || p.address || '',
        reviewCount: 0,
        saveCount: 0,
        isMine: nameNorm.includes(storeNorm) || storeNorm.includes(nameNorm),
      }
    })

    return NextResponse.json({
      rank: foundRank,
      total: allPlaces.length,
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