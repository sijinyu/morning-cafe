/**
 * Seoul Cafe Seeder v2 — Optimized for speed
 *
 * Key optimizations:
 * 1. Phase 1: 10 concurrent grid cell searches (was sequential)
 * 2. Phase 2: 5 concurrent detail fetches (was sequential)
 * 3. Batch upsert: 100 rows per request (was 1)
 * 4. Skip detail fetch for cafes already in DB with opening_time
 * 5. Minimal sleep between batches
 *
 * Usage:  npx tsx scripts/seed-cafes.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!KAKAO_REST_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing env vars. Need KAKAO_REST_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const SEOUL_BOUNDS = { minLat: 37.428, maxLat: 37.701, minLng: 126.764, maxLng: 127.183 };
const GRID_RADIUS = 500;
const OVERLAP_FACTOR = 0.5;
const EARTH_RADIUS_M = 6_371_000;
const DEG_PER_M_LAT = 1 / ((Math.PI / 180) * EARTH_RADIUS_M);
const EARLYBIRD_THRESHOLD = '08:00';

// Concurrency limits
const PHASE1_CONCURRENCY = 10;  // grid searches in parallel
const PHASE2_CONCURRENCY = 5;   // detail fetches in parallel
const BATCH_UPSERT_SIZE = 100;  // rows per upsert

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

interface GridCell { centerLng: number; centerLat: number; radius: number }

function metreToDegreeLng(metres: number, latDeg: number): number {
  return (metres * DEG_PER_M_LAT) / Math.max(Math.cos((latDeg * Math.PI) / 180), 1e-10);
}

function generateGrid(): GridCell[] {
  const stepM = GRID_RADIUS * OVERLAP_FACTOR;
  const stepLat = stepM * DEG_PER_M_LAT;
  const cells: GridCell[] = [];
  for (let lat = SEOUL_BOUNDS.minLat; lat <= SEOUL_BOUNDS.maxLat + stepLat; lat += stepLat) {
    const cLat = Math.min(lat, SEOUL_BOUNDS.maxLat);
    const stepLng = metreToDegreeLng(stepM, cLat);
    for (let lng = SEOUL_BOUNDS.minLng; lng <= SEOUL_BOUNDS.maxLng + stepLng; lng += stepLng) {
      cells.push({ centerLng: Math.min(lng, SEOUL_BOUNDS.maxLng), centerLat: cLat, radius: GRID_RADIUS });
      if (lng >= SEOUL_BOUNDS.maxLng) break;
    }
    if (lat >= SEOUL_BOUNDS.maxLat) break;
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Kakao Local API
// ---------------------------------------------------------------------------

interface KakaoPlace { id: string; place_name: string; phone: string; address_name: string; road_address_name: string; x: string; y: string; place_url: string; category_name: string }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function searchCell(cell: GridCell): Promise<KakaoPlace[]> {
  const seen = new Set<string>();
  const results: KakaoPlace[] = [];

  for (let page = 1; page <= 3; page++) {  // max 3 pages = 45건 (API limit anyway)
    const params = new URLSearchParams({
      category_group_code: 'CE7', x: String(cell.centerLng), y: String(cell.centerLat),
      radius: String(cell.radius), page: String(page), size: '15', sort: 'distance',
    });

    const res = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?${params}`, {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
    });

    if (!res.ok) {
      if (res.status === 429) await sleep(1000);
      break;
    }
    const data = await res.json();

    for (const p of data.documents) {
      if (!seen.has(p.id)) { seen.add(p.id); results.push(p); }
    }

    if (data.meta.is_end) break;
  }

  return results;
}

// ---------------------------------------------------------------------------
// Kakao Place Detail API
// ---------------------------------------------------------------------------

const DETAIL_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://place.map.kakao.com/',
  'pf': 'PC',
};

async function fetchDetail(placeId: string, retries = 2): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`https://place-api.map.kakao.com/places/panel3/${placeId}`, {
        headers: DETAIL_HEADERS,
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 429) {
        await sleep(attempt * 2000);
        continue;
      }
      if (!res.ok) {
        if (attempt < retries) { await sleep(500); continue; }
        return null;
      }
      const data = await res.json();
      if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
        if (attempt < retries) { await sleep(500); continue; }
        return null;
      }
      return data;
    } catch {
      if (attempt < retries) { await sleep(500); continue; }
      return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

function parseHours(detail: any): { openingTime: string | null; closingTime: string | null; hoursByDay: Record<string, string> | null } {
  const periods = detail?.open_hours?.week_from_today?.week_periods;
  if (!periods?.length) return { openingTime: null, closingTime: null, hoursByDay: null };

  const hoursByDay: Record<string, string> = {};
  let todayRange: string | null = null;
  let firstRange: string | null = null;

  for (const period of periods) {
    for (const day of (period.days ?? [])) {
      const raw = day.on_days?.start_end_time_desc;
      if (!raw) continue;
      const norm = raw.replace(/\s*~\s*/g, '~').trim();
      const dayKey = day.day_of_the_week_desc?.split('(')?.[0]?.trim() ?? '';
      if (dayKey && !(dayKey in hoursByDay)) hoursByDay[dayKey] = norm;
      if (!firstRange) firstRange = norm;
      if (day.is_highlight && !todayRange) todayRange = norm;
    }
  }

  const rep = todayRange ?? firstRange;
  if (!Object.keys(hoursByDay).length) return { openingTime: null, closingTime: null, hoursByDay: null };

  const openMatch = rep?.match(/^(\d{2}:\d{2})~/);
  const closeMatch = rep?.match(/~(\d{2}:\d{2})$/);

  return {
    openingTime: openMatch?.[1] ?? null,
    closingTime: closeMatch?.[1] ?? null,
    hoursByDay,
  };
}

function parseInstagram(detail: any): string | null {
  const hp = detail?.summary?.homepage;
  if (!hp) return null;
  for (const token of hp.split(/[,;|\s]+/).filter(Boolean)) {
    const url = token.replace(/^\/\//, 'https://').replace(/^http:\/\//, 'https://');
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('instagram.com')) return url;
    } catch {}
  }
  return null;
}

// ---------------------------------------------------------------------------
// Supabase — batch upsert
// ---------------------------------------------------------------------------

interface CafeRow {
  kakao_place_id: string; name: string; address: string; road_address: string | null;
  phone: string | null; latitude: number; longitude: number; place_url: string | null;
  instagram_url: string | null; category: string | null;
  opening_time: string | null; closing_time: string | null;
  hours_by_day: Record<string, string> | null; is_earlybird: boolean;
  last_crawled_at: string;
}

async function batchUpsert(rows: CafeRow[]): Promise<number> {
  if (!rows.length) return 0;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/cafes?on_conflict=kakao_place_id`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify(rows),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`  Batch upsert failed (${rows.length} rows): ${err}`);
    return 0;
  }
  return rows.length;
}

/** Fetch existing kakao_place_ids from DB to skip redundant detail fetches */
async function getExistingIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  let offset = 0;
  const limit = 1000;

  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/cafes?select=kakao_place_id,opening_time&opening_time=not.is.null&offset=${offset}&limit=${limit}`,
      {
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
      },
    );
    if (!res.ok) break;
    const data = await res.json();
    for (const row of data) ids.add(row.kakao_place_id);
    if (data.length < limit) break;
    offset += limit;
  }

  return ids;
}

// ---------------------------------------------------------------------------
// Concurrency helper
// ---------------------------------------------------------------------------

async function runConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i]!, i);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const startTime = Date.now();
  console.log('=== Seoul Cafe Seeder v2 (Optimized) ===\n');

  // Load existing IDs to skip redundant detail fetches
  console.log('Loading existing cafe IDs from DB...');
  const existingIds = await getExistingIds();
  console.log(`  ${existingIds.size} cafes already have opening_time in DB\n`);

  // Phase 1: Parallel grid scan
  const grid = generateGrid();
  console.log(`Phase 1: Scanning ${grid.length} grid cells (${PHASE1_CONCURRENCY} concurrent)...\n`);

  const allPlaces = new Map<string, KakaoPlace>();
  let cellsDone = 0;

  await runConcurrent(grid, PHASE1_CONCURRENCY, async (cell, _i) => {
    try {
      const places = await searchCell(cell);
      for (const p of places) allPlaces.set(p.id, p);
    } catch (e) {
      // silently continue
    }
    cellsDone++;
    if (cellsDone % 100 === 0 || cellsDone === grid.length) {
      console.log(`  [${cellsDone}/${grid.length}] ${allPlaces.size} unique cafes`);
    }
    await sleep(20); // minimal delay
  });

  const phase1Time = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\nPhase 1 done: ${allPlaces.size} unique cafes in ${phase1Time}s\n`);

  // Phase 2: Detail fetch + upsert (parallel)
  // Filter: Seoul only + skip already-detailed cafes
  const places = [...allPlaces.values()].filter(p => p.address_name.includes('서울'));
  const needsDetail = places.filter(p => !existingIds.has(p.id));
  const alreadyHaveDetail = places.filter(p => existingIds.has(p.id));

  console.log(`Phase 2: ${places.length} Seoul cafes`);
  console.log(`  ${alreadyHaveDetail.length} already in DB (will upsert basic info only)`);
  console.log(`  ${needsDetail.length} need detail fetch (${PHASE2_CONCURRENCY} concurrent)\n`);

  let upserted = 0;
  let earlybirds = 0;
  let detailFailed = 0;
  let noHours = 0;
  const now = new Date().toISOString();
  let batch: CafeRow[] = [];

  async function flushBatch() {
    if (!batch.length) return;
    const count = await batchUpsert(batch);
    upserted += count;
    batch = [];
  }

  function buildRow(place: KakaoPlace, openingTime: string | null, closingTime: string | null, hoursByDay: Record<string, string> | null, instagram: string | null): CafeRow {
    return {
      kakao_place_id: place.id,
      name: place.place_name,
      address: place.address_name,
      road_address: place.road_address_name || null,
      phone: place.phone || null,
      latitude: parseFloat(place.y),
      longitude: parseFloat(place.x),
      place_url: `https://place.map.kakao.com/${place.id}`,
      instagram_url: instagram,
      category: place.category_name?.split('>').pop()?.trim() ?? null,
      opening_time: openingTime,
      closing_time: closingTime,
      hours_by_day: hoursByDay,
      is_earlybird: openingTime !== null && openingTime < EARLYBIRD_THRESHOLD,
      last_crawled_at: now,
    };
  }

  // 2a: Upsert already-known cafes (no detail fetch needed — just update basic info)
  // These already have opening_time in DB, so we only upsert coords/name/address without wiping hours
  // Actually skip these entirely — they're already complete in DB
  console.log(`  Skipping ${alreadyHaveDetail.length} already-complete cafes\n`);

  // 2b: Fetch details for new cafes
  let detailDone = 0;

  await runConcurrent(needsDetail, PHASE2_CONCURRENCY, async (place) => {
    const detail = await fetchDetail(place.id);
    await sleep(200 + Math.random() * 100); // 200-300ms jitter

    const { openingTime, closingTime, hoursByDay } = detail ? parseHours(detail) : { openingTime: null, closingTime: null, hoursByDay: null };
    const instagram = detail ? parseInstagram(detail) : null;

    if (!detail) detailFailed++;
    else if (!openingTime) noHours++;
    if (openingTime !== null && openingTime < EARLYBIRD_THRESHOLD) earlybirds++;

    const lng = parseFloat(place.x);
    const lat = parseFloat(place.y);
    if (isNaN(lng) || isNaN(lat)) return;

    const row = buildRow(place, openingTime, closingTime, hoursByDay, instagram);
    batch.push(row);

    if (batch.length >= BATCH_UPSERT_SIZE) {
      await flushBatch();
    }

    detailDone++;
    if (detailDone % 100 === 0 || detailDone === needsDetail.length) {
      console.log(`  [${detailDone}/${needsDetail.length}] upserted:${upserted} earlybirds:${earlybirds} failed:${detailFailed} noHours:${noHours}`);
    }
  });

  await flushBatch(); // final batch

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n=== Done in ${totalTime} min ===`);
  console.log(`Total unique Seoul cafes found: ${places.length}`);
  console.log(`New cafes upserted: ${upserted}`);
  console.log(`New earlybirds: ${earlybirds}`);
  console.log(`Detail fetch failed: ${detailFailed}`);
  console.log(`No hours data: ${noHours}`);
  console.log(`Already in DB (skipped): ${alreadyHaveDetail.length}`);
}

main().catch(console.error);
