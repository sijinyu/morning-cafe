/**
 * seed-crawl-queue — Supabase Edge Function
 *
 * Scans Seoul for cafes via the Kakao Local category-search API (CE7) using an
 * overlapping grid of circular cells. Collects all discovered place IDs and
 * inserts any that are not already present (or recently crawled) into the
 * `crawl_queue` table.
 *
 * Invocation: HTTP POST (typically triggered by pg_cron daily).
 *
 * Environment variables required:
 *   KAKAO_REST_API_KEY        — Kakao REST API key (the part after "KakaoAK ")
 *   SUPABASE_URL              — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Service-role key that bypasses RLS
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ---------------------------------------------------------------------------
// Types (inlined from src/lib/crawl/types.ts — Deno cannot import from Next.js)
// ---------------------------------------------------------------------------

interface KakaoLocalPlace {
  id: string;
  place_name: string;
  category_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  /** WGS84 longitude as decimal string. */
  x: string;
  /** WGS84 latitude as decimal string. */
  y: string;
  place_url: string;
}

interface KakaoLocalResponse {
  meta: {
    total_count: number;
    pageable_count: number;
    is_end: boolean;
  };
  documents: KakaoLocalPlace[];
}

interface GridCell {
  centerLng: number;
  centerLat: number;
  /** Search radius in metres. */
  radius: number;
}

// ---------------------------------------------------------------------------
// Constants (inlined from src/lib/crawl/constants.ts)
// ---------------------------------------------------------------------------

const SEOUL_BOUNDS = {
  minLat: 37.413,
  maxLat: 37.715,
  minLng: 126.734,
  maxLng: 127.269,
} as const;

const CAFE_CATEGORY_CODE = 'CE7' as const;
const KAKAO_MAX_PAGE = 45;
const KAKAO_PAGE_SIZE = 15;
const GRID_RADIUS = 2000; // metres

/** Delay between Kakao API calls — 200 ms to stay within Edge Function budget. */
const API_DELAY_MS = 200;

/** Re-crawl window: skip place IDs crawled within the last 7 days. */
const RECRAWL_WINDOW_DAYS = 7;

/** Maximum items per INSERT batch to avoid request payload limits. */
const INSERT_BATCH_SIZE = 500;

/** Kakao Local API base URL. */
const KAKAO_LOCAL_BASE = 'https://dapi.kakao.com/v2/local/search';

// ---------------------------------------------------------------------------
// Grid generation (inlined from src/lib/crawl/grid.ts)
// ---------------------------------------------------------------------------

const OVERLAP_FACTOR = 0.75;
const EARTH_RADIUS_M = 6_371_000;
const DEG_PER_M_LAT = 1 / ((Math.PI / 180) * EARTH_RADIUS_M);

function metreToDegreeLng(metres: number, latDeg: number): number {
  const cosLat = Math.cos((latDeg * Math.PI) / 180);
  const effectiveCos = Math.max(cosLat, 1e-10);
  return (metres * DEG_PER_M_LAT) / effectiveCos;
}

function generateSeoulGrid(): GridCell[] {
  const stepM = GRID_RADIUS * OVERLAP_FACTOR;
  const stepLat = stepM * DEG_PER_M_LAT;
  const cells: GridCell[] = [];

  for (
    let lat = SEOUL_BOUNDS.minLat;
    lat <= SEOUL_BOUNDS.maxLat + stepLat;
    lat += stepLat
  ) {
    const centerLat = Math.min(lat, SEOUL_BOUNDS.maxLat);
    const stepLng = metreToDegreeLng(stepM, centerLat);

    for (
      let lng = SEOUL_BOUNDS.minLng;
      lng <= SEOUL_BOUNDS.maxLng + stepLng;
      lng += stepLng
    ) {
      const centerLng = Math.min(lng, SEOUL_BOUNDS.maxLng);
      cells.push({ centerLng, centerLat, radius: GRID_RADIUS });

      if (lng >= SEOUL_BOUNDS.maxLng) break;
    }

    if (lat >= SEOUL_BOUNDS.maxLat) break;
  }

  return cells;
}

// ---------------------------------------------------------------------------
// Kakao Local API helpers (inlined from src/lib/crawl/kakao-api.ts)
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildCategorySearchUrl(
  lng: number,
  lat: number,
  radius: number,
  page: number,
): string {
  const params = new URLSearchParams({
    category_group_code: CAFE_CATEGORY_CODE,
    x: String(lng),
    y: String(lat),
    radius: String(radius),
    page: String(page),
    size: String(KAKAO_PAGE_SIZE),
    sort: 'distance',
  });
  return `${KAKAO_LOCAL_BASE}/category.json?${params.toString()}`;
}

async function fetchCategoryPage(
  url: string,
  apiKey: string,
): Promise<KakaoLocalResponse | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[kakao] HTTP ${response.status} for ${url}`);
      return null;
    }

    const data: unknown = await response.json();

    if (
      typeof data !== 'object' ||
      data === null ||
      !('documents' in data) ||
      !('meta' in data)
    ) {
      return null;
    }

    return data as KakaoLocalResponse;
  } catch (err) {
    console.warn(`[kakao] fetch error: ${err}`);
    return null;
  }
}

/**
 * Search for cafes within a grid cell, paginating through all available pages.
 * Uses a shorter delay (API_DELAY_MS) than the standard 500 ms to fit within
 * the Edge Function 150-second wall-clock budget.
 */
async function searchCafesByCategory(
  cell: GridCell,
  apiKey: string,
): Promise<KakaoLocalPlace[]> {
  const seen = new Set<string>();
  const results: KakaoLocalPlace[] = [];

  for (let page = 1; page <= KAKAO_MAX_PAGE; page++) {
    if (page > 1) {
      await delay(API_DELAY_MS);
    }

    const url = buildCategorySearchUrl(
      cell.centerLng,
      cell.centerLat,
      cell.radius,
      page,
    );

    const pageData = await fetchCategoryPage(url, apiKey);

    if (pageData === null) {
      break;
    }

    for (const place of pageData.documents) {
      if (!seen.has(place.id)) {
        seen.add(place.id);
        results.push(place);
      }
    }

    if (pageData.meta.is_end) {
      break;
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Edge Function handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // ---------------------------------------------------------------------------
  // Validate required environment variables
  // ---------------------------------------------------------------------------

  const kakaoApiKey = Deno.env.get('KAKAO_REST_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!kakaoApiKey) {
    console.error('[env] KAKAO_REST_API_KEY is not set');
    return new Response(
      JSON.stringify({ success: false, error: 'KAKAO_REST_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[env] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
    return new Response(
      JSON.stringify({ success: false, error: 'Supabase credentials not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // ---------------------------------------------------------------------------
  // Supabase client — service_role key bypasses RLS for crawl_queue and cafes
  // ---------------------------------------------------------------------------

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // ---------------------------------------------------------------------------
  // Phase 1: Fetch place IDs already crawled within the recrawl window
  //          so we can skip inserting them back into the queue.
  // ---------------------------------------------------------------------------

  const recrawlCutoff = new Date(
    Date.now() - RECRAWL_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  console.log(`[seed] fetching recently crawled place IDs (cutoff: ${recrawlCutoff})`);

  const { data: recentRows, error: recentErr } = await supabase
    .from('cafes')
    .select('kakao_place_id')
    .gte('last_crawled_at', recrawlCutoff);

  if (recentErr) {
    console.error(`[seed] failed to fetch recent cafes: ${recentErr.message}`);
    return new Response(
      JSON.stringify({ success: false, error: recentErr.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const recentlyCrawled = new Set<string>(
    (recentRows ?? []).map((r) => r.kakao_place_id as string),
  );

  console.log(`[seed] ${recentlyCrawled.size} place(s) crawled within last ${RECRAWL_WINDOW_DAYS} days — will skip`);

  // ---------------------------------------------------------------------------
  // Phase 2: Scan Seoul grid and collect unique place IDs
  // ---------------------------------------------------------------------------

  const grid = generateSeoulGrid();
  console.log(`[seed] scanning ${grid.length} grid cell(s) across Seoul`);

  const allPlaceIds = new Set<string>();
  let cellIndex = 0;

  for (const cell of grid) {
    cellIndex++;
    console.log(
      `[seed] cell ${cellIndex}/${grid.length} — lat=${cell.centerLat.toFixed(4)} lng=${cell.centerLng.toFixed(4)}`,
    );

    try {
      const places = await searchCafesByCategory(cell, kakaoApiKey);
      for (const place of places) {
        allPlaceIds.add(place.id);
      }
      console.log(`[seed] cell ${cellIndex}: found ${places.length} place(s), total unique so far: ${allPlaceIds.size}`);
    } catch (err) {
      // Non-fatal: log and continue with remaining cells
      console.warn(`[seed] cell ${cellIndex} error: ${err}`);
    }

    // Small delay between cells to avoid bursting the rate limit
    if (cellIndex < grid.length) {
      await delay(API_DELAY_MS);
    }
  }

  console.log(`[seed] grid scan complete. Total unique place IDs found: ${allPlaceIds.size}`);

  // ---------------------------------------------------------------------------
  // Phase 3: Filter out place IDs recently crawled
  // ---------------------------------------------------------------------------

  const candidateIds = [...allPlaceIds].filter((id) => !recentlyCrawled.has(id));
  console.log(
    `[seed] ${candidateIds.length} candidate(s) after excluding recently crawled`,
  );

  if (candidateIds.length === 0) {
    return new Response(
      JSON.stringify({ success: true, data: { inserted: 0, scanned: allPlaceIds.size } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // ---------------------------------------------------------------------------
  // Phase 4: Batch INSERT into crawl_queue.
  //
  // We use upsert with ignoreDuplicates: true which maps to
  // INSERT ... ON CONFLICT (kakao_place_id) DO NOTHING in PostgreSQL.
  // crawl_queue does not have a unique constraint on kakao_place_id by default,
  // so we simply insert and tolerate duplicates — the worker deduplicates
  // naturally by processing each row once and marking it done.
  //
  // To truly avoid inserting duplicates for already-pending rows we filter
  // against existing pending/processing rows fetched below.
  // ---------------------------------------------------------------------------

  // Fetch existing pending/processing place IDs so we do not re-queue them
  const { data: existingQueueRows, error: queueCheckErr } = await supabase
    .from('crawl_queue')
    .select('kakao_place_id')
    .in('status', ['pending', 'processing']);

  if (queueCheckErr) {
    // Non-fatal: log and proceed — worst case we insert some duplicates
    console.warn(`[seed] could not check existing queue: ${queueCheckErr.message}`);
  }

  const alreadyQueued = new Set<string>(
    (existingQueueRows ?? []).map((r) => r.kakao_place_id as string),
  );

  const toInsert = candidateIds.filter((id) => !alreadyQueued.has(id));
  console.log(
    `[seed] ${toInsert.length} item(s) to insert after excluding already-queued entries`,
  );

  let totalInserted = 0;

  for (let offset = 0; offset < toInsert.length; offset += INSERT_BATCH_SIZE) {
    const batchNum = Math.floor(offset / INSERT_BATCH_SIZE) + 1;
    const batch = toInsert
      .slice(offset, offset + INSERT_BATCH_SIZE)
      .map((kakaoPlaceId) => ({ kakao_place_id: kakaoPlaceId, status: 'pending' }));

    const { error: insertErr, count } = await supabase
      .from('crawl_queue')
      .insert(batch, { count: 'exact' });

    if (insertErr) {
      console.error(`[seed] batch ${batchNum} insert failed: ${insertErr.message}`);
      // Continue with remaining batches rather than aborting the whole run
      continue;
    }

    const inserted = count ?? batch.length;
    totalInserted += inserted;
    console.log(`[seed] batch ${batchNum}: inserted ${inserted} row(s)`);
  }

  // ---------------------------------------------------------------------------
  // Phase 5: Respond
  // ---------------------------------------------------------------------------

  console.log(
    `[seed] done. scanned=${allPlaceIds.size} candidates=${candidateIds.length} inserted=${totalInserted}`,
  );

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        scanned: allPlaceIds.size,
        candidates: candidateIds.length,
        inserted: totalInserted,
      },
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
