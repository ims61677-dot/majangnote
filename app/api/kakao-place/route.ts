import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('query')
  const size = searchParams.get('size') || '5'

  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 })

  const apiKey = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'Kakao API key not configured' }, { status: 500 })
  }

  try {
    // 카카오 키워드 장소 검색
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=${size}&category_group_code=FD6`
    const res = await fetch(url, {
      headers: {
        'Authorization': `KakaoAK ${apiKey}`,
      },
    })
    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: err }, { status: res.status })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}