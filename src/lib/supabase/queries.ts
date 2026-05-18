import { createClient as supabaseCreateClient } from '@supabase/supabase-js';
import { extractGu, type Cafe } from '@/lib/types/cafe';

const PAGE_SIZE = 1000;

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
    .select('*')
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
      .select('*')
      .eq('is_earlybird', true)
      .ilike('address', `%${gu}%`)
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
  const gus = new Set<string>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('cafes_with_coords')
      .select('address')
      .eq('is_earlybird', true)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to fetch addresses: ${error.message}`);
    }

    for (const row of data ?? []) {
      const gu = extractGu(row.address as string);
      if (gu) gus.add(gu);
    }

    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return [...gus].sort();
}

/** Fetch cafe count per 구 for the index page. */
export async function fetchGuStats(): Promise<{ gu: string; count: number; earliest: string | null }[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createServerClient();
  const guMap = new Map<string, { count: number; earliest: string | null }>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('cafes_with_coords')
      .select('address, opening_time')
      .eq('is_earlybird', true)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to fetch gu stats: ${error.message}`);
    }

    for (const row of data ?? []) {
      const gu = extractGu(row.address as string);
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
  };
}
