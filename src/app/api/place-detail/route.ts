import { NextRequest, NextResponse } from 'next/server';

const DETAIL_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://place.map.kakao.com/',
  pf: 'PC',
};

export interface MenuItem {
  name: string;
  price: string | null;
  photo: string | null;
}

export interface PlaceDetailResponse {
  photos: string[];
  menu: MenuItem[];
}

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get('placeId');
  if (!placeId || !/^\d+$/.test(placeId)) {
    return NextResponse.json({ photos: [], menu: [] } satisfies PlaceDetailResponse, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://place-api.map.kakao.com/places/panel3/${placeId}`,
      { headers: DETAIL_HEADERS, signal: AbortSignal.timeout(5000) },
    );

    if (!res.ok) {
      return NextResponse.json({ photos: [], menu: [] } satisfies PlaceDetailResponse);
    }

    const data = await res.json();

    // Photos
    const rawPhotos: { url: string }[] = data?.photos?.photos ?? [];
    const photos = rawPhotos
      .slice(0, 5)
      .map((p) => p.url?.replace('http://', 'https://'))
      .filter(Boolean) as string[];

    // Menu — yogiyo_menus (배달메뉴) or yogiyo_pickup_menus (픽업메뉴)
    const menuData = data?.menu ?? {};
    const rawMenu: { name?: string; price?: number; photo_url?: string }[] =
      menuData?.yogiyo_menus?.items ??
      menuData?.yogiyo_pickup_menus?.items ??
      [];
    const menu: MenuItem[] = rawMenu
      .slice(0, 8)
      .map((m) => ({
        name: m.name ?? '',
        price: m.price != null ? `${m.price.toLocaleString()}원` : null,
        photo: m.photo_url ? m.photo_url.replace('http://', 'https://') : null,
      }))
      .filter((m) => m.name);

    return NextResponse.json(
      { photos, menu } satisfies PlaceDetailResponse,
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      },
    );
  } catch {
    return NextResponse.json({ photos: [], menu: [] } satisfies PlaceDetailResponse);
  }
}
