import { unstable_cache } from 'next/cache';
import { createClient as supabaseCreateClient } from '@supabase/supabase-js';
import { extractGu, type Cafe } from '@/lib/types/cafe';
import { haversineKm } from '@/lib/cafe-utils';

const PAGE_SIZE = 1000;

// Cafe 타입에 필요한 컬럼만 선택 (select('*') 대신 사용)
const CAFE_COLUMNS = 'id, kakao_place_id, name, address, road_address, phone, latitude, longitude, place_url, instagram_url, category, opening_time, closing_time, hours_by_day, is_earlybird, last_crawled_at, created_at, thumbnail_url';

function isSupabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
}

/** Create Supabase client — prefers service role key, falls back to anon key */
function createServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase URL or key');
  }

  return supabaseCreateClient(url, key);
}

/** Fetch a single cafe by its UUID. */
export async function fetchCafeById(id: string): Promise<Cafe | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('cafes_with_coords')
    .select(CAFE_COLUMNS)
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return mapRowToCafe(data as Record<string, unknown>);
}

/** Fetch earlybird cafes in a specific 구, sorted by opening_time ASC. */
export async function fetchCafesByGu(gu: string): Promise<Cafe[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createServerClient();
  const allRows: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('cafes_with_coords')
      .select(CAFE_COLUMNS)
      .eq('is_earlybird', true)
      .eq('gu', gu)
      .order('opening_time', { ascending: true, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error(`Failed to fetch cafes for ${gu}: ${error.message}`);
      return [];
    }

    allRows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allRows.map(mapRowToCafe);
}

/** Extract all unique 구 names from earlybird cafes, sorted alphabetically. */
export async function fetchAllGus(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createServerClient();

  // gu 컬럼에서 distinct 조회 (인덱스 활용)
  const { data, error } = await supabase
    .from('cafes_with_coords')
    .select('gu')
    .eq('is_earlybird', true)
    .not('gu', 'is', null);

  if (error) {
    console.error(`Failed to fetch gus: ${error.message}`);
    return [];
  }

  const gus = new Set<string>();
  for (const row of data ?? []) {
    if (row.gu) gus.add(row.gu as string);
  }
  return [...gus].sort();
}

/** Fetch all earlybird cafe IDs for sitemap generation (lightweight — id only). */
export async function fetchAllCafeIds(): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createServerClient();
  const allIds: string[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('cafes_with_coords')
      .select('id')
      .eq('is_earlybird', true)
      .range(from, from + PAGE_SIZE - 1);

    if (error) break;

    for (const row of data ?? []) {
      allIds.push(row.id as string);
    }
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allIds;
}

/** Fetch cafe count per 구 for the index page.
 *  Uses PostgreSQL RPC function (002-gu-stats-function.sql) for server-side aggregation.
 *  Fallback: JS aggregation if RPC not available. */
export async function fetchGuStats(): Promise<{ gu: string; count: number; earliest: string | null }[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createServerClient();

  // RPC 함수 호출 시도 (서버 사이드 집계 — 25행만 반환)
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_gu_stats');

  if (!rpcError && rpcData) {
    return (rpcData as { gu: string; count: number; earliest: string | null }[])
      .filter((row) => row.gu != null);
  }

  // Fallback: RPC 함수 미생성 시 JS 집계
  const guMap = new Map<string, { count: number; earliest: string | null }>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('cafes_with_coords')
      .select('gu, opening_time')
      .eq('is_earlybird', true)
      .not('gu', 'is', null)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error(`Failed to fetch gu stats: ${error.message}`);
      return [];
    }

    for (const row of data ?? []) {
      const gu = row.gu as string;
      if (!gu) continue;

      const existing = guMap.get(gu);
      const openingTime = row.opening_time as string | null;

      if (!existing) {
        guMap.set(gu, { count: 1, earliest: openingTime });
      } else {
        guMap.set(gu, {
          count: existing.count + 1,
          earliest:
            openingTime && (!existing.earliest || openingTime < existing.earliest)
              ? openingTime
              : existing.earliest,
        });
      }
    }

    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return [...guMap.entries()]
    .map(([gu, stats]) => ({ gu, ...stats }))
    .sort((a, b) => a.gu.localeCompare(b.gu, 'ko'));
}

/**
 * Earlybird 카페 한 페이지 조회 — `/api/cafes` 캐시 라우트용.
 * 클라이언트가 Supabase를 직접 읽으면 방문자 수만큼 egress가 나가 무료 쿼터가
 * 초과되므로(2026-08 장애), Vercel CDN 캐시 뒤에서만 호출한다.
 */
export async function fetchEarlybirdPage(page: number, size: number): Promise<Record<string, unknown>[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createServerClient();
  const from = page * size;
  const { data, error } = await supabase
    .from('cafes_with_coords')
    .select(CAFE_COLUMNS)
    .eq('is_earlybird', true)
    .order('id', { ascending: true })
    .range(from, from + size - 1);
  if (error) {
    throw new Error(`Failed to fetch earlybird page ${page}: ${error.message}`);
  }
  return data ?? [];
}

/** Fetch all earlybird cafes across all districts. For guide/content pages (ISR cached). */
export async function fetchAllEarlybirdCafes(): Promise<Cafe[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createServerClient();
  const allRows: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('cafes_with_coords')
      .select(CAFE_COLUMNS)
      .eq('is_earlybird', true)
      .order('opening_time', { ascending: true, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error(`Failed to fetch all earlybird cafes: ${error.message}`);
      break;
    }

    allRows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allRows.map(mapRowToCafe);
}

export interface NearbyCafesResult {
  /** 기준 카페가 속한 구. 추출 실패 시 null. */
  gu: string | null;
  /** 거리순 가까운 다른 얼리버드 카페 */
  nearby: Cafe[];
  /** 같은 구의 전체 얼리버드 카페 수 (기준 카페 포함) */
  totalInGu: number;
}

/**
 * 구별 카페 목록을 요청 간에 캐시한다.
 *
 * `/cafe/[id]`는 동적 SSR(프리렌더 없음)이라 카페 페이지마다 같은 구를 다시
 * 조회하면 행 매핑 비용이 그대로 Vercel Fluid Active CPU로 잡힌다. 구 단위로
 * 캐시하면 "카페 수 × 하루"가 "구 수 × 하루"로 줄어든다.
 *
 * `unstable_cache`는 Next.js 16에서 `use cache`로 대체 예정이지만, `use cache`는
 * `cacheComponents` 옵트인이 필요해 앱 전체 렌더링 동작이 바뀐다. CPU 수정의
 * 부수 효과로 그런 변경을 끌고 오지 않기 위해 현행 API를 쓴다.
 */
const fetchCafesByGuCached = unstable_cache(
  async (gu: string) => fetchCafesByGu(gu),
  ['cafes-by-gu'],
  { revalidate: 86400 },
);

/**
 * 같은 구의 다른 얼리버드 카페를 거리순으로 반환.
 *
 * 카페 상세(`/cafe/[id]`)의 유일한 출구가 카카오맵뿐이라 세션이 1페이지에서
 * 끝나던 문제를 해결하기 위한 내부 링크용. 체류·광고 노출·지도 도달률·SEO
 * 크롤링을 함께 개선한다.
 */
export async function fetchNearbyCafes(
  cafe: Cafe,
  limit = 4,
): Promise<NearbyCafesResult> {
  const gu = extractGu(cafe.road_address ?? cafe.address);
  if (!gu) return { gu: null, nearby: [], totalInGu: 0 };

  const siblings = await fetchCafesByGuCached(gu);

  const nearby = siblings
    .filter((candidate) => candidate.id !== cafe.id)
    .map((candidate) => ({
      cafe: candidate,
      km: haversineKm(cafe.latitude, cafe.longitude, candidate.latitude, candidate.longitude),
    }))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit)
    .map((entry) => entry.cafe);

  return { gu, nearby, totalInGu: siblings.length };
}

function mapRowToCafe(row: Record<string, unknown>): Cafe {
  return {
    id: row.id as string,
    kakao_place_id: row.kakao_place_id as string,
    name: row.name as string,
    address: row.address as string,
    road_address: row.road_address as string | null,
    phone: row.phone as string | null,
    latitude: row.latitude as number,
    longitude: row.longitude as number,
    place_url: row.place_url as string | null,
    instagram_url: row.instagram_url as string | null,
    category: row.category as string | null,
    opening_time: row.opening_time as string | null,
    closing_time: row.closing_time as string | null,
    hours_by_day: row.hours_by_day as Record<string, string> | null,
    is_earlybird: row.is_earlybird as boolean,
    last_crawled_at: row.last_crawled_at as string | null,
    created_at: (row.created_at as string | null) ?? null,
    thumbnail_url: (row.thumbnail_url as string | null) ?? null,
  };
}
