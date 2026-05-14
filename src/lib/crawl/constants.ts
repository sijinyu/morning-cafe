/**
 * Shared constants for the Seoul Earlybird Cafe crawling engine.
 */

// ---------------------------------------------------------------------------
// Geographic bounds
// ---------------------------------------------------------------------------

/** Approximate WGS84 bounding box covering the Seoul metropolitan area. */
export const SEOUL_BOUNDS = {
  minLat: 37.413,
  maxLat: 37.715,
  minLng: 126.734,
  maxLng: 127.269,
} as const;

// ---------------------------------------------------------------------------
// Kakao API
// ---------------------------------------------------------------------------

/** Kakao Local category code for cafes. */
export const CAFE_CATEGORY_CODE = 'CE7' as const;

/** Maximum page index the Kakao Local API will honour (1-indexed). */
export const KAKAO_MAX_PAGE = 45;

/** Number of results returned per page by the Kakao Local API. */
export const KAKAO_PAGE_SIZE = 15;

/**
 * Hard ceiling on results retrievable per single radius query.
 * Kakao enforces `max_page * page_size` = 675 results per (x, y, radius) call.
 */
export const KAKAO_MAX_RESULTS = KAKAO_MAX_PAGE * KAKAO_PAGE_SIZE; // 675

// ---------------------------------------------------------------------------
// Grid search geometry
// ---------------------------------------------------------------------------

/**
 * Radius in metres for each grid-cell search circle.
 * Cells are spaced closer than this value so adjacent circles overlap,
 * eliminating coverage gaps at cell boundaries.
 */
export const GRID_RADIUS = 2000; // 2 km

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

/** Minimum wait in milliseconds between consecutive HTTP requests. */
export const REQUEST_DELAY_MS = 500;

// ---------------------------------------------------------------------------
// Business logic
// ---------------------------------------------------------------------------

/**
 * A cafe is classified as "earlybird" when its opening time is strictly
 * earlier than this threshold (24-hour `"HH:MM"` string comparison).
 */
export const EARLYBIRD_THRESHOLD = '08:00' as const;

// ---------------------------------------------------------------------------
// Kakao Map internal place-detail API
// ---------------------------------------------------------------------------

/** Base URL for the unofficial Kakao place-detail API. */
export const KAKAO_PLACE_API_BASE = 'https://place-api.map.kakao.com' as const;

/**
 * HTTP headers required to avoid rejection by the Kakao Map internal API.
 * The internal API validates `Referer` and `pf` on every request.
 */
export const KAKAO_PLACE_API_HEADERS: Readonly<Record<string, string>> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://place.map.kakao.com/',
  pf: 'PC',
} as const;

// ---------------------------------------------------------------------------
// Korean weekday names (ordered Monday → Sunday)
// ---------------------------------------------------------------------------

export const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'] as const;

/** Union type of Korean weekday abbreviations. */
export type DayName = (typeof DAY_NAMES)[number];
