import { NextRequest, NextResponse } from 'next/server';

const DETAIL_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://place.map.kakao.com/',
  pf: 'PC',
};

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get('placeId');
  if (!placeId || !/^\d+$/.test(placeId)) {
    return NextResponse.json({ photos: [] }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://place-api.map.kakao.com/places/panel3/${placeId}`,
      { headers: DETAIL_HEADERS, signal: AbortSignal.timeout(5000) },
    );

    if (!res.ok) {
      return NextResponse.json({ photos: [] });
    }

    const data = await res.json();
    const rawPhotos: { url: string }[] = data?.photos?.photos ?? [];

    // Return first 5 photo URLs (use HTTPS)
    const photos = rawPhotos
      .slice(0, 5)
      .map((p) => p.url?.replace('http://', 'https://'))
      .filter(Boolean);

    return NextResponse.json(
      { photos },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      },
    );
  } catch {
    return NextResponse.json({ photos: [] });
  }
}
