import { createClient as supabaseCreateClient } from '@supabase/supabase-js';
import { type Cafe } from '@/lib/types/cafe';

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
      throw new Error(`Failed to fetch cafes for ${gu}: ${error.message}`);
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
    throw new Error(`Failed to fetch gus: ${error.message}`);
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
      throw new Error(`Failed to fetch gu stats: ${error.message}`);
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
