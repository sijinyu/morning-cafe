/**
 * process-crawl-queue — Supabase Edge Function
 *
 * Dequeues up to 5 pending items from `crawl_queue`, fetches full place detail
 * from the Kakao Map internal API, parses hours and Instagram URL, then upserts
 * the result into the `cafes` table.
 *
 * Invocation: HTTP POST (typically triggered by pg_cron every 30 seconds).
 *
 * Environment variables required:
 *   SUPABASE_URL              — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Service-role key that bypasses RLS
 *
 * Note: The Kakao Map internal place-detail API does not require authentication.
 *       It does however require specific User-Agent, Referer, and pf headers to
 *       avoid a 403 rejection.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ---------------------------------------------------------------------------
// Types (inlined from src/lib/crawl/types.ts — Deno cannot import from Next.js)
// ---------------------------------------------------------------------------

interface KakaoPlaceDetail {
  summary?: {
    name?: string;
    category?: string;
    phone?: string;
    /** May contain an Instagram URL (e.g. https://www.instagram.com/...). */
    homepage?: string;
    address?: string;
    road_address?: string;
  };
  open_hours?: {
    headline?: {
      code?: string;
      display_text?: string;
    };
    week_from_today?: {
      week_periods?: Array<{
        days?: Array<{
          /** Korean weekday with date, e.g. "월(5/14)". */
          day_of_the_week_desc?: string;
          on_days?: {
            /** Operating hours range, e.g. "06:30 ~ 22:00". */
            start_end_time_desc?: string;
          };
          off_days?: {
            display_text?: string;
          };
          /** true when this day entry represents today. */
          is_highlight?: boolean;
        }>;
      }>;
    };
  };
}

interface CrawlQueueRow {
  id: number;
  kakao_place_id: string;
  attempts: number;
}

// ---------------------------------------------------------------------------
// Constants (inlined from src/lib/crawl/constants.ts)
// ---------------------------------------------------------------------------

/** Kakao Map internal place-detail API base URL. */
const KAKAO_PLACE_API_BASE = 'https://place-api.map.kakao.com';

/**
 * HTTP headers required to avoid 403 rejection by the Kakao Map internal API.
 * The internal API validates Referer and pf on every request.
 */
const KAKAO_PLACE_API_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://place.map.kakao.com/',
  'pf': 'PC',
};

/** Minimum wait in milliseconds between consecutive Kakao internal API calls. */
const REQUEST_DELAY_MS = 500;

/** Fetch timeout per place-detail request in milliseconds. */
const FETCH_TIMEOUT_MS = 10_000;

/** Maximum failed attempts before a queue row is permanently marked failed. */
const MAX_ATTEMPTS = 3;

/** Earlybird threshold: opening time strictly before this string is earlybird. */
const EARLYBIRD_THRESHOLD = '08:00';

/** Number of queue items to process per invocation. */
const BATCH_SIZE = 5;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Kakao place-detail API client (inlined from src/lib/crawl/place-detail.ts)
// ---------------------------------------------------------------------------

async function fetchPlaceDetail(
  placeId: string,
): Promise<KakaoPlaceDetail | null> {
  const url = `${KAKAO_PLACE_API_BASE}/places/panel3/${encodeURIComponent(placeId)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { ...KAKAO_PLACE_API_HEADERS },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`[detail] HTTP ${response.status} for place ${placeId}`);
      return null;
    }

    const text = await response.text();
    if (!text || text.trim() === '') {
      console.warn(`[detail] empty body for place ${placeId}`);
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.warn(`[detail] JSON parse error for place ${placeId}`);
      return null;
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    return parsed as KakaoPlaceDetail;
  } catch (err) {
    // Covers AbortError (timeout), NetworkError, and any other fetch failure.
    console.warn(`[detail] fetch error for place ${placeId}: ${err}`);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------------------------------------------------------------------------
// Parsing logic (inlined from src/lib/crawl/parser.ts)
// ---------------------------------------------------------------------------

function extractDayAbbreviation(dayOfTheWeekDesc: string): string {
  const parenIndex = dayOfTheWeekDesc.indexOf('(');
  return parenIndex === -1
    ? dayOfTheWeekDesc.trim()
    : dayOfTheWeekDesc.slice(0, parenIndex).trim();
}

function normaliseTimeRange(raw: string): string {
  return raw.replace(/\s*~\s*/g, '~').trim();
}

function extractStartTime(range: string): string | null {
  const match = /^(\d{2}:\d{2})~/.exec(range);
  return match ? match[1] : null;
}

function extractEndTime(range: string): string | null {
  const match = /~(\d{2}:\d{2})$/.exec(range);
  return match ? match[1] : null;
}

function parseOpeningTime(detail: KakaoPlaceDetail): {
  openingTime: string | null;
  closingTime: string | null;
  hoursByDay: Record<string, string> | null;
} {
  const weekPeriods = detail.open_hours?.week_from_today?.week_periods;

  if (!weekPeriods || weekPeriods.length === 0) {
    return { openingTime: null, closingTime: null, hoursByDay: null };
  }

  const hoursByDay: Record<string, string> = {};
  let todayRange: string | null = null;
  let firstRange: string | null = null;

  for (const period of weekPeriods) {
    const days = period.days ?? [];

    for (const day of days) {
      const rawRange = day.on_days?.start_end_time_desc;
      if (!rawRange) continue;

      const normRange = normaliseTimeRange(rawRange);
      const dayKey = day.day_of_the_week_desc
        ? extractDayAbbreviation(day.day_of_the_week_desc)
        : '';

      if (dayKey && !(dayKey in hoursByDay)) {
        hoursByDay[dayKey] = normRange;
      }

      if (firstRange === null) {
        firstRange = normRange;
      }

      if (day.is_highlight === true && todayRange === null) {
        todayRange = normRange;
      }
    }
  }

  const representativeRange = todayRange ?? firstRange;

  if (Object.keys(hoursByDay).length === 0) {
    return { openingTime: null, closingTime: null, hoursByDay: null };
  }

  return {
    openingTime: representativeRange
      ? extractStartTime(representativeRange)
      : null,
    closingTime: representativeRange
      ? extractEndTime(representativeRange)
      : null,
    hoursByDay,
  };
}

function parseInstagramUrl(detail: KakaoPlaceDetail): string | null {
  const homepage = detail.summary?.homepage;
  if (!homepage) return null;

  const tokens = homepage
    .split(/[,;|\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const normalised = token
      .replace(/^\/\//, 'https://')
      .replace(/^http:\/\//, 'https://');

    try {
      const parsed = new URL(normalised);
      if (
        parsed.hostname === 'www.instagram.com' ||
        parsed.hostname === 'instagram.com'
      ) {
        return normalised;
      }
    } catch {
      // Token is not a valid URL; skip it.
    }
  }

  return null;
}

function isEarlybird(openingTime: string | null): boolean {
  if (openingTime === null) return false;
  return openingTime < EARLYBIRD_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Database record builder
// ---------------------------------------------------------------------------

/**
 * Build the `cafes` upsert payload from raw Kakao place-detail API data.
 * The caller is responsible for providing the coordinates from the queue row
 * (or from the detail response itself if available).
 *
 * PostGIS geography column requires a raw SQL expression; we handle this via
 * Supabase's `.rpc()` or by passing a raw column literal — see upsert below.
 */
interface CafeUpsertPayload {
  kakao_place_id: string;
  name: string;
  address: string;
  road_address: string | null;
  phone: string | null;
  place_url: string | null;
  instagram_url: string | null;
  category: string | null;
  opening_time: string | null;
  closing_time: string | null;
  hours_by_day: Record<string, string> | null;
  is_earlybird: boolean;
  last_crawled_at: string;
}

function buildCafePayload(
  placeId: string,
  detail: KakaoPlaceDetail,
): CafeUpsertPayload {
  const { openingTime, closingTime, hoursByDay } = parseOpeningTime(detail);
  const instagramUrl = parseInstagramUrl(detail);

  return {
    kakao_place_id: placeId,
    name: detail.summary?.name ?? '',
    address: detail.summary?.address ?? '',
    road_address: detail.summary?.road_address ?? null,
    phone: detail.summary?.phone ?? null,
    place_url: `https://place.map.kakao.com/${placeId}`,
    instagram_url: instagramUrl,
    category: detail.summary?.category ?? null,
    opening_time: openingTime,
    closing_time: closingTime,
    hours_by_day: hoursByDay,
    is_earlybird: isEarlybird(openingTime),
    last_crawled_at: new Date().toISOString(),
  };
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
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Validate environment variables
  // ---------------------------------------------------------------------------

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[env] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
    return new Response(
      JSON.stringify({ success: false, error: 'Supabase credentials not configured' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }

  // ---------------------------------------------------------------------------
  // Supabase client — service_role bypasses RLS for crawl_queue and cafes
  // ---------------------------------------------------------------------------

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // ---------------------------------------------------------------------------
  // Phase 1: Dequeue up to BATCH_SIZE pending items with advisory lock
  //          (SELECT FOR UPDATE SKIP LOCKED prevents double-processing when
  //           multiple invocations run concurrently)
  // ---------------------------------------------------------------------------

  console.log(`[process] dequeuing up to ${BATCH_SIZE} pending item(s) from crawl_queue`);

  // Supabase JS does not expose FOR UPDATE SKIP LOCKED directly; we use a
  // Postgres RPC (function) or fall back to a two-step claim pattern:
  // 1. Atomically mark rows as 'processing' via an RPC.
  // 2. Return the claimed row IDs.
  //
  // We use the RPC approach which executes inside a single transaction.
  const { data: claimedRows, error: claimErr } = await supabase
    .rpc('claim_crawl_queue_batch', { batch_size: BATCH_SIZE });

  if (claimErr) {
    // The RPC may not exist yet (first deploy) — fall back to a non-locking
    // select and best-effort status update.
    console.warn(
      `[process] claim RPC failed (${claimErr.message}), falling back to non-locking dequeue`,
    );

    const { data: fallbackRows, error: fallbackErr } = await supabase
      .from('crawl_queue')
      .select('id, kakao_place_id, attempts')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fallbackErr) {
      console.error(`[process] dequeue failed: ${fallbackErr.message}`);
      return new Response(
        JSON.stringify({ success: false, error: fallbackErr.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    if (!fallbackRows || fallbackRows.length === 0) {
      console.log('[process] crawl_queue is empty — nothing to do');
      return new Response(
        JSON.stringify({ success: true, data: { processed: 0 } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Mark as processing to reduce concurrent double-pick risk
    const claimedIds = fallbackRows.map((r: CrawlQueueRow) => r.id);
    await supabase
      .from('crawl_queue')
      .update({ status: 'processing' })
      .in('id', claimedIds);

    return processBatch(supabase, fallbackRows as CrawlQueueRow[]);
  }

  if (!claimedRows || claimedRows.length === 0) {
    console.log('[process] crawl_queue is empty — nothing to do');
    return new Response(
      JSON.stringify({ success: true, data: { processed: 0 } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  return processBatch(supabase, claimedRows as CrawlQueueRow[]);
});

// ---------------------------------------------------------------------------
// Batch processing — separated so both code paths share the same logic
// ---------------------------------------------------------------------------

async function processBatch(
  // deno-lint-ignore no-explicit-any
  supabase: ReturnType<typeof createClient>,
  rows: CrawlQueueRow[],
): Promise<Response> {
  console.log(`[process] processing ${rows.length} item(s)`);

  const results = {
    done: 0,
    failed: 0,
    skipped: 0,
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Throttle calls to the Kakao internal API
    if (i > 0) {
      await delay(REQUEST_DELAY_MS);
    }

    console.log(
      `[process] [${i + 1}/${rows.length}] fetching place ${row.kakao_place_id}`,
    );

    const detail = await fetchPlaceDetail(row.kakao_place_id);

    if (detail === null) {
      // Fetch failed or returned empty
      const newAttempts = row.attempts + 1;
      const isFinalFailure = newAttempts >= MAX_ATTEMPTS;

      const { error: failErr } = await supabase
        .from('crawl_queue')
        .update({
          status: isFinalFailure ? 'failed' : 'pending',
          attempts: newAttempts,
          error_message: 'place-detail API returned null or empty response',
          processed_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      if (failErr) {
        console.error(
          `[process] failed to update queue row ${row.id}: ${failErr.message}`,
        );
      }

      console.warn(
        `[process] place ${row.kakao_place_id} fetch failed — attempts=${newAttempts} final=${isFinalFailure}`,
      );

      results.failed++;
      continue;
    }

    // ---------------------------------------------------------------------------
    // Build upsert payload
    // ---------------------------------------------------------------------------

    const cafePayload = buildCafePayload(row.kakao_place_id, detail);

    // ---------------------------------------------------------------------------
    // Upsert into cafes table.
    // The `location` column is a PostGIS geography(POINT, 4326) which cannot be
    // set via a plain JSON value — it requires a SQL expression. We use a raw
    // SQL upsert via supabase.rpc or, if coordinates are in the detail, we use
    // the Supabase PostGIS helper format `POINT(lng lat)`.
    //
    // The Kakao internal API does not reliably return coordinates in panel3.
    // When coordinates are missing we still upsert all other fields and leave
    // location unchanged (the initial seed from the Local API sets it).
    // ---------------------------------------------------------------------------

    // Extract coordinates if the detail response includes them
    const lng = extractLng(detail);
    const lat = extractLat(detail);

    let upsertError: Error | null = null;

    if (lng !== null && lat !== null) {
      // Use RPC to perform the upsert with a PostGIS expression for location
      const { error: rpcErr } = await supabase.rpc('upsert_cafe_with_location', {
        p_kakao_place_id: cafePayload.kakao_place_id,
        p_name: cafePayload.name,
        p_address: cafePayload.address,
        p_road_address: cafePayload.road_address,
        p_phone: cafePayload.phone,
        p_place_url: cafePayload.place_url,
        p_instagram_url: cafePayload.instagram_url,
        p_category: cafePayload.category,
        p_opening_time: cafePayload.opening_time,
        p_closing_time: cafePayload.closing_time,
        p_hours_by_day: cafePayload.hours_by_day
          ? JSON.stringify(cafePayload.hours_by_day)
          : null,
        p_is_earlybird: cafePayload.is_earlybird,
        p_last_crawled_at: cafePayload.last_crawled_at,
        p_lng: lng,
        p_lat: lat,
      });

      if (rpcErr) {
        console.warn(
          `[process] upsert_cafe_with_location RPC failed for ${row.kakao_place_id}: ${rpcErr.message} — falling back to plain upsert`,
        );
        upsertError = new Error(rpcErr.message);
      }
    }

    // Fall back to plain upsert without updating location
    // (safe when the cafe row already exists from a previous crawl)
    if (lng === null || lat === null || upsertError !== null) {
      const { error: plainErr } = await supabase
        .from('cafes')
        .upsert(
          {
            kakao_place_id: cafePayload.kakao_place_id,
            name: cafePayload.name,
            address: cafePayload.address,
            road_address: cafePayload.road_address,
            phone: cafePayload.phone,
            place_url: cafePayload.place_url,
            instagram_url: cafePayload.instagram_url,
            category: cafePayload.category,
            opening_time: cafePayload.opening_time,
            closing_time: cafePayload.closing_time,
            hours_by_day: cafePayload.hours_by_day,
            is_earlybird: cafePayload.is_earlybird,
            last_crawled_at: cafePayload.last_crawled_at,
          },
          { onConflict: 'kakao_place_id' },
        );

      if (plainErr) {
        console.error(
          `[process] plain upsert failed for ${row.kakao_place_id}: ${plainErr.message}`,
        );

        // Mark as failed in the queue
        const newAttempts = row.attempts + 1;
        await supabase
          .from('crawl_queue')
          .update({
            status: newAttempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
            attempts: newAttempts,
            error_message: plainErr.message,
            processed_at: new Date().toISOString(),
          })
          .eq('id', row.id);

        results.failed++;
        continue;
      }
    }

    // ---------------------------------------------------------------------------
    // Mark queue item as done
    // ---------------------------------------------------------------------------

    const { error: doneErr } = await supabase
      .from('crawl_queue')
      .update({
        status: 'done',
        attempts: row.attempts + 1,
        error_message: null,
        processed_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    if (doneErr) {
      console.error(
        `[process] failed to mark queue row ${row.id} as done: ${doneErr.message}`,
      );
    }

    console.log(
      `[process] place ${row.kakao_place_id} upserted successfully (earlybird=${cafePayload.is_earlybird})`,
    );

    results.done++;
  }

  console.log(
    `[process] batch complete — done=${results.done} failed=${results.failed} skipped=${results.skipped}`,
  );

  return new Response(
    JSON.stringify({ success: true, data: results }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  );
}

// ---------------------------------------------------------------------------
// Coordinate extraction from KakaoPlaceDetail
//
// The panel3 API does not have a consistent top-level coordinate field.
// The best available approach is to look inside known sub-objects.
// We return null if no coordinates are found, in which case the caller
// falls back to a plain upsert that leaves the location column unchanged.
// ---------------------------------------------------------------------------

function extractLng(detail: KakaoPlaceDetail): number | null {
  // deno-lint-ignore no-explicit-any
  const raw = (detail as any)?.summary?.x ?? (detail as any)?.x ?? null;
  if (raw === null || raw === undefined) return null;
  const n = parseFloat(String(raw));
  return isNaN(n) ? null : n;
}

function extractLat(detail: KakaoPlaceDetail): number | null {
  // deno-lint-ignore no-explicit-any
  const raw = (detail as any)?.summary?.y ?? (detail as any)?.y ?? null;
  if (raw === null || raw === undefined) return null;
  const n = parseFloat(String(raw));
  return isNaN(n) ? null : n;
}
