/**
 * Pure parsing functions for the Seoul Earlybird Cafe crawling engine.
 *
 * All functions in this module are pure:
 * - No I/O or side effects.
 * - Given the same arguments they always return the same result.
 * - They never throw; callers receive `null` / empty structures on bad input.
 */

import { EARLYBIRD_THRESHOLD } from './constants';
import type {
  KakaoLocalPlace,
  KakaoPlaceDetail,
  ParsedCafe,
} from './types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract the two-character Korean weekday abbreviation from a day descriptor
 * such as `"월(5/14)"` → `"월"`.
 */
function extractDayAbbreviation(dayOfTheWeekDesc: string): string {
  // The abbreviation is the first character(s) up to the first `(`.
  const parenIndex = dayOfTheWeekDesc.indexOf('(');
  return parenIndex === -1
    ? dayOfTheWeekDesc.trim()
    : dayOfTheWeekDesc.slice(0, parenIndex).trim();
}

/**
 * Normalise a raw time-range string `"06:30 ~ 22:00"` into the compact form
 * `"06:30~22:00"` expected by `ParsedCafe.hoursByDay`.
 */
function normaliseTimeRange(raw: string): string {
  return raw.replace(/\s*~\s*/g, '~').trim();
}

/**
 * Extract just the start time from a compact range like `"06:30~22:00"`.
 * Returns `null` when the string does not match the expected pattern.
 */
function extractStartTime(range: string): string | null {
  const match = /^(\d{2}:\d{2})~/.exec(range);
  return match ? match[1] : null;
}

/**
 * Extract just the end time from a compact range like `"06:30~22:00"`.
 * Returns `null` when the string does not match the expected pattern.
 */
function extractEndTime(range: string): string | null {
  const match = /~(\d{2}:\d{2})$/.exec(range);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Public parsing functions
// ---------------------------------------------------------------------------

/**
 * Parse operating hours from a `KakaoPlaceDetail` response.
 *
 * Iterates over `open_hours.week_from_today.week_periods[*].days` and builds a
 * day-keyed map of normalised time ranges. The opening and closing times are
 * derived from the entry whose `is_highlight` flag is `true` (= today) when
 * present; otherwise the first available entry is used as a fallback.
 *
 * @returns An object containing:
 *   - `openingTime`  — start time for the representative day (`"HH:MM"`), or `null`.
 *   - `closingTime`  — end time for the representative day (`"HH:MM"`), or `null`.
 *   - `hoursByDay`   — full weekday map, or `null` when no data is available.
 */
export function parseOpeningTime(detail: KakaoPlaceDetail): {
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

      if (dayKey) {
        // Only record the first encounter per day key (immutable-style guard).
        if (!(dayKey in hoursByDay)) {
          hoursByDay[dayKey] = normRange;
        }
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

/**
 * Extract an Instagram URL from the `summary.homepage` field of a place detail.
 *
 * Kakao stores multiple homepage variants in a single string separated by
 * various delimiters. We scan each token for an Instagram domain and return the
 * first match, normalising to `https://`.
 *
 * @returns The full Instagram URL string, or `null` if none is found.
 */
export function parseInstagramUrl(detail: KakaoPlaceDetail): string | null {
  const homepage = detail.summary?.homepage;
  if (!homepage) return null;

  // Split on common delimiters used by Kakao (comma, semicolon, pipe, space).
  const tokens = homepage.split(/[,;|\s]+/).map((t) => t.trim()).filter(Boolean);

  for (const token of tokens) {
    // Normalise protocol-relative or http URLs.
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

/**
 * Determine whether a cafe qualifies as "earlybird" based on its opening time.
 *
 * Comparison is performed as a lexicographic string comparison which is
 * correct for zero-padded `"HH:MM"` time strings.
 *
 * @param openingTime  Opening time in `"HH:MM"` format, or `null`.
 * @returns `true` when `openingTime` is strictly before `EARLYBIRD_THRESHOLD`
 *          (`"08:00"`). Returns `false` for `null` or equal times.
 */
export function isEarlybird(openingTime: string | null): boolean {
  if (openingTime === null) return false;
  return openingTime < EARLYBIRD_THRESHOLD;
}

/**
 * Combine a Kakao Local place record with an (optional) internal place-detail
 * record into a single normalised `ParsedCafe` object.
 *
 * When `detail` is `null` (e.g. the internal API failed for this place), all
 * detail-derived fields are set to their null/false defaults so the caller
 * always receives a fully-shaped object.
 *
 * @param local   The place entry from the Kakao Local category-search API.
 * @param detail  The enriched detail from the internal place-detail API, or
 *                `null` when unavailable.
 * @returns       A fully normalised `ParsedCafe` ready for persistence.
 */
export function buildParsedCafe(
  local: KakaoLocalPlace,
  detail: KakaoPlaceDetail | null,
): ParsedCafe {
  const { openingTime, closingTime, hoursByDay } =
    detail !== null
      ? parseOpeningTime(detail)
      : { openingTime: null, closingTime: null, hoursByDay: null };

  const instagramUrl =
    detail !== null ? parseInstagramUrl(detail) : null;

  return {
    kakaoPlaceId: local.id,
    name: local.place_name,
    address: local.address_name,
    roadAddress: local.road_address_name,
    phone: local.phone,
    longitude: parseFloat(local.x),
    latitude: parseFloat(local.y),
    placeUrl: local.place_url,
    instagramUrl,
    category: local.category_name,
    openingTime,
    closingTime,
    hoursByDay,
    isEarlybird: isEarlybird(openingTime),
  };
}
