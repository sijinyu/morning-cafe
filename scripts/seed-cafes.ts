/**
 * Local seeding script — runs on your machine, no Edge Function limits.
 *
 * 1. Scans Seoul grid via Kakao Local API (CE7 category)
 * 2. For each discovered cafe, fetches place detail from Kakao internal API
 * 3. Parses opening hours, determines earlybird status
 * 4. Upserts into Supabase via the upsert_cafe_with_location RPC
 *
 * Usage:
 *   npx tsx scripts/seed-cafes.ts
 *
 * Requires .env.local with:
 *   KAKAO_REST_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (not the anon key!)
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

// 서울특별시 행정경계 (경기도 제외)
const SEOUL_BOUNDS = { minLat: 37.428, maxLat: 37.701, minLng: 126.764, maxLng: 127.183 };
const GRID_RADIUS = 2000;
const OVERLAP_FACTOR = 0.75;
const EARTH_RADIUS_M = 6_371_000;
const DEG_PER_M_LAT = 1 / ((Math.PI / 180) * EARTH_RADIUS_M);
const EARLYBIRD_THRESHOLD = '08:00';

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
// Kakao Local API (카페 목록)
// ---------------------------------------------------------------------------

interface KakaoPlace { id: string; place_name: string; phone: string; address_name: string; road_address_name: string; x: string; y: string; place_url: string; category_name: string }

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function searchCell(cell: GridCell): Promise<KakaoPlace[]> {
  const seen = new Set<string>();
  const results: KakaoPlace[] = [];

  for (let page = 1; page <= 45; page++) {
    const params = new URLSearchParams({
      category_group_code: 'CE7', x: String(cell.centerLng), y: String(cell.centerLat),
      radius: String(cell.radius), page: String(page), size: '15', sort: 'distance',
    });

    const res = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?${params}`, {
      headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
    });

    if (!res.ok) { console.warn(`  Kakao API ${res.status} at page ${page}`); break; }
    const data = await res.json();

    for (const p of data.documents) {
      if (!seen.has(p.id)) { seen.add(p.id); results.push(p); }
    }

    if (data.meta.is_end) break;
    await sleep(100); // 빠르게 — 로컬이니까
  }

  return results;
}

// ---------------------------------------------------------------------------
// Kakao Place Detail API (영업시간)
// ---------------------------------------------------------------------------

const DETAIL_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://place.map.kakao.com/',
  'pf': 'PC',
};

async function fetchDetail(placeId: string): Promise<any> {
  try {
    const res = await fetch(`https://place-api.map.kakao.com/places/panel3/${placeId}`, {
      headers: DETAIL_HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
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
// Supabase upsert (REST API 직접 호출 — 의존성 0)
// ---------------------------------------------------------------------------

async function upsertCafe(payload: {
  kakao_place_id: string; name: string; address: string; road_address: string | null;
  phone: string | null; lng: number; lat: number; place_url: string | null;
  instagram_url: string | null; category: string | null;
  opening_time: string | null; closing_time: string | null;
  hours_by_day: Record<string, string> | null; is_earlybird: boolean;
}): Promise<boolean> {
  // Direct REST upsert — no RPC, no PostGIS, no bullshit
  const row = {
    kakao_place_id: payload.kakao_place_id,
    name: payload.name,
    address: payload.address,
    road_address: payload.road_address,
    phone: payload.phone,
    latitude: payload.lat,
    longitude: payload.lng,
    place_url: payload.place_url,
    instagram_url: payload.instagram_url,
    category: payload.category,
    opening_time: payload.opening_time,
    closing_time: payload.closing_time,
    hours_by_day: payload.hours_by_day,
    is_earlybird: payload.is_earlybird,
    last_crawled_at: new Date().toISOString(),
  };

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
      body: JSON.stringify(row),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    console.error(`  Upsert failed: ${err}`);
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Seoul Earlybird Cafe Seeder ===\n');

  // Phase 1: 서울 그리드 스캔 → 카페 place ID 수집
  const grid = generateGrid();
  console.log(`Grid cells: ${grid.length}`);

  const allPlaces = new Map<string, KakaoPlace>();

  for (let i = 0; i < grid.length; i++) {
    const cell = grid[i];
    if ((i + 1) % 10 === 0 || i === grid.length - 1) console.log(`[${i + 1}/${grid.length}] Scanning... (${allPlaces.size} cafes found)`);

    try {
      const places = await searchCell(cell);
      for (const p of places) allPlaces.set(p.id, p);
    } catch (e) {
      console.warn(`\n  Cell ${i + 1} error: ${e}`);
    }

    await sleep(50);
  }

  console.log(`\n\nPhase 1 complete: ${allPlaces.size} unique cafes found\n`);

  // Phase 2: 각 카페 상세 조회 → 영업시간 파싱 → DB upsert
  const places = [...allPlaces.values()];
  let upserted = 0;
  let earlybirds = 0;
  let skipped = 0;

  for (let i = 0; i < places.length; i++) {
    const place = places[i];
    if ((i + 1) % 50 === 0 || i === places.length - 1) console.log(`[${i + 1}/${places.length}] Processing... (${earlybirds} earlybirds, ${upserted} total)`);

    // 상세 조회
    const detail = await fetchDetail(place.id);
    await sleep(200); // 예의 바르게

    const { openingTime, closingTime, hoursByDay } = detail ? parseHours(detail) : { openingTime: null, closingTime: null, hoursByDay: null };
    const instagram = detail ? parseInstagram(detail) : null;
    const isEarlybird = openingTime !== null && openingTime < EARLYBIRD_THRESHOLD;

    const lng = parseFloat(place.x);
    const lat = parseFloat(place.y);

    if (isNaN(lng) || isNaN(lat)) { skipped++; continue; }

    // 서울특별시 한정 — 주소에 "서울"이 없으면 스킵
    if (!place.address_name.includes('서울')) { skipped++; continue; }

    const ok = await upsertCafe({
      kakao_place_id: place.id,
      name: place.place_name,
      address: place.address_name,
      road_address: place.road_address_name || null,
      phone: place.phone || null,
      lng, lat,
      place_url: `https://place.map.kakao.com/${place.id}`,
      instagram_url: instagram,
      category: place.category_name?.split('>').pop()?.trim() ?? null,
      opening_time: openingTime,
      closing_time: closingTime,
      hours_by_day: hoursByDay,
      is_earlybird: isEarlybird,
    });

    if (ok) {
      upserted++;
      if (isEarlybird) earlybirds++;
    }
  }

  console.log(`\n\n=== Done ===`);
  console.log(`Total cafes: ${places.length}`);
  console.log(`Upserted: ${upserted}`);
  console.log(`Earlybirds: ${earlybirds}`);
  console.log(`Skipped: ${skipped}`);
}

main().catch(console.error);
