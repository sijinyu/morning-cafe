/**
 * All shared types for the Seoul Earlybird Cafe crawling engine.
 * No runtime dependencies — pure type definitions only.
 */

// ---------------------------------------------------------------------------
// Kakao Local Search API (official)
// https://developers.kakao.com/docs/latest/ko/local/dev-guide#search-by-category
// ---------------------------------------------------------------------------

/** A single place entry returned by the Kakao Local category search API. */
export interface KakaoLocalPlace {
  /** Unique Kakao place identifier (numeric string). */
  id: string;
  place_name: string;
  category_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  /** WGS84 longitude as a decimal string. */
  x: string;
  /** WGS84 latitude as a decimal string. */
  y: string;
  place_url: string;
}

/** Top-level response envelope from the Kakao Local category search endpoint. */
export interface KakaoLocalResponse {
  meta: {
    total_count: number;
    pageable_count: number;
    /** `true` when the current page is the last available page. */
    is_end: boolean;
  };
  documents: KakaoLocalPlace[];
}

// ---------------------------------------------------------------------------
// Kakao Map internal place-detail API (unofficial)
// Endpoint: https://place-api.map.kakao.com/places/panel3/{place_id}
// Only the fields we actually use are defined; the full response is much larger.
// ---------------------------------------------------------------------------

/** Subset of the Kakao Map internal place-detail response we consume. */
export interface KakaoPlaceDetail {
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
      /** Status code such as `"OPEN"` or `"CLOSED"`. */
      code?: string;
      display_text?: string;
    };
    week_from_today?: {
      week_periods?: Array<{
        days?: Array<{
          /** Korean weekday with date, e.g. `"월(5/14)"`. */
          day_of_the_week_desc?: string;
          on_days?: {
            /** Operating hours range, e.g. `"06:30 ~ 22:00"`. */
            start_end_time_desc?: string;
          };
          off_days?: {
            /** Reason for closure, e.g. `"정기휴무"`. */
            display_text?: string;
          };
          /** `true` when this day entry represents today. */
          is_highlight?: boolean;
        }>;
      }>;
    };
  };
}

// ---------------------------------------------------------------------------
// Our normalised output
// ---------------------------------------------------------------------------

/**
 * A fully parsed and enriched cafe record ready for persistence or display.
 * All nullable fields reflect genuinely optional data from upstream APIs.
 */
export interface ParsedCafe {
  kakaoPlaceId: string;
  name: string;
  address: string;
  roadAddress: string;
  phone: string;
  longitude: number;
  latitude: number;
  placeUrl: string;
  instagramUrl: string | null;
  category: string;
  /** Opening time in `"HH:MM"` 24-hour format, or `null` if unavailable. */
  openingTime: string | null;
  /** Closing time in `"HH:MM"` 24-hour format, or `null` if unavailable. */
  closingTime: string | null;
  /**
   * Per-weekday hours keyed by Korean weekday abbreviation.
   * Example: `{ "월": "06:30~22:00", "화": "07:00~22:00" }`.
   * `null` when hour data is entirely absent.
   */
  hoursByDay: Record<string, string> | null;
  /** `true` when the cafe opens strictly before 08:00. */
  isEarlybird: boolean;
}

// ---------------------------------------------------------------------------
// Grid search primitives
// ---------------------------------------------------------------------------

/**
 * A single circular search cell used to tile Seoul for category API queries.
 * The Kakao Local API accepts a `(x, y, radius)` tuple per request.
 */
export interface GridCell {
  centerLng: number;
  centerLat: number;
  /** Search radius in metres. */
  radius: number;
}
