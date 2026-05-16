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

export interface RatingInfo {
  score: number;
  count: number;
}

export interface ParkingInfo {
  available: boolean;
  summary: string | null;
}

export interface PlaceDetailResponse {
  photos: string[];
  photosHd: string[];
  menu: MenuItem[];
  rating: RatingInfo | null;
  parking: ParkingInfo | null;
  facilities: string[];
  strengths: string[];
}

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get('placeId');
  if (!placeId || !/^\d+$/.test(placeId)) {
    return NextResponse.json(
      { photos: [], photosHd: [], menu: [], rating: null, parking: null, facilities: [], strengths: [] } satisfies PlaceDetailResponse,
      { status: 400 },
    );
  }

  try {
    const res = await fetch(
      `https://place-api.map.kakao.com/places/panel3/${placeId}`,
      { headers: DETAIL_HEADERS, signal: AbortSignal.timeout(5000) },
    );

    if (!res.ok) {
      return NextResponse.json(
        { photos: [], photosHd: [], menu: [], rating: null, parking: null, facilities: [], strengths: [] } satisfies PlaceDetailResponse,
      );
    }

    const data = await res.json();

    // Photos
    const rawPhotos: { url: string }[] = data?.photos?.photos ?? [];
    const httpsUrls = rawPhotos
      .slice(0, 5)
      .map((p) => p.url?.replace('http://', 'https://'))
      .filter(Boolean) as string[];

    const photos = httpsUrls.map((url) => {
      if (url.includes('pstatic.net')) {
        return `/api/photo-proxy?url=${encodeURIComponent(url)}`;
      }
      return url;
    });

    const photosHd = httpsUrls.map((url) => {
      if (url.includes('pstatic.net')) {
        const hdUrl = `${url.split('?')[0]}?type=w966`;
        return `/api/photo-proxy?url=${encodeURIComponent(hdUrl)}`;
      }
      return url;
    });

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

    // Rating
    const scoreSet = data?.kakaomap_review?.score_set;
    const rating: RatingInfo | null =
      scoreSet?.average_score != null
        ? { score: scoreSet.average_score as number, count: (scoreSet.review_count as number) ?? 0 }
        : null;

    // Parking
    const addInfo = data?.place_add_info;
    const isParkingAvailable: boolean = addInfo?.facilities?.is_parking === true;
    const parkingSummary: string | null =
      (addInfo?.simple_parking_infos?.summary as string | undefined) ?? null;
    const parkingTexts: string[] = (addInfo?.simple_parking_infos?.texts as string[] | undefined) ?? [];
    const parking: ParkingInfo | null =
      addInfo?.facilities != null
        ? {
            available: isParkingAvailable,
            summary: parkingSummary ?? (parkingTexts.length > 0 ? parkingTexts[0] : null),
          }
        : null;

    // Facilities
    const rawDetails: { text?: string }[] = addInfo?.simple_detail_infos ?? [];
    const facilities: string[] = rawDetails
      .map((d) => d.text)
      .filter((t): t is string => Boolean(t));

    // Strengths
    const rawStrengths: { name?: string }[] = data?.kakaomap_review?.strength_description ?? [];
    const strengths: string[] = rawStrengths
      .map((s) => s.name)
      .filter((n): n is string => Boolean(n));

    return NextResponse.json(
      { photos, photosHd, menu, rating, parking, facilities, strengths } satisfies PlaceDetailResponse,
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      },
    );
  } catch {
    return NextResponse.json(
      { photos: [], photosHd: [], menu: [], rating: null, parking: null, facilities: [], strengths: [] } satisfies PlaceDetailResponse,
    );
  }
}
