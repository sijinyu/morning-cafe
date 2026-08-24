import { unstable_cache } from 'next/cache';
import { NextRequest } from 'next/server';
import { fetchEarlybirdPage } from '@/lib/supabase/queries';

/**
 * 전체 earlybird 카페 데이터 (페이지 단위, 6시간 캐시).
 *
 * 클라이언트(cafe-store)가 Supabase를 직접 읽던 구조는 방문자마다 전체
 * 데이터셋(수 MB) egress가 발생해 무료 쿼터를 초과시켰다(2026-08 장애).
 * 이 라우트는 Vercel Data Cache(unstable_cache) + CDN(s-maxage) 이중 캐시로
 * Supabase 조회를 리밸리데이션 시점으로만 제한한다.
 *
 * 페이지당 2,500건 ≈ 1.2MB — Vercel Data Cache 아이템 2MB 제한과
 * 함수 응답 4.5MB 제한을 모두 피하는 크기.
 */
const PAGE_SIZE = 2500;
const REVALIDATE_S = 21600; // 6h — 크롤 주기(5일)보다 훨씬 짧아 신선도 충분

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('page') ?? '0';
  const page = parseInt(raw, 10);
  if (Number.isNaN(page) || page < 0 || page > 50) {
    return Response.json({ error: 'invalid page' }, { status: 400 });
  }

  const getPage = unstable_cache(
    () => fetchEarlybirdPage(page, PAGE_SIZE),
    ['earlybird-page', String(page)],
    { revalidate: REVALIDATE_S },
  );

  try {
    const rows = await getPage();
    return Response.json(rows, {
      headers: {
        'Cache-Control': `public, s-maxage=${REVALIDATE_S}, stale-while-revalidate=86400`,
      },
    });
  } catch {
    // Supabase 제한/일시 장애 — 클라이언트는 sessionStorage 캐시로 폴백
    return Response.json({ error: 'upstream unavailable' }, { status: 503 });
  }
}
