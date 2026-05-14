/**
 * Kakao Local Search API client (official REST API).
 *
 * Documentation:
 * https://developers.kakao.com/docs/latest/ko/local/dev-guide#search-by-category
 *
 * Key constraints
 * ---------------
 * - Authentication: `Authorization: KakaoAK {REST_API_KEY}` header.
 * - Max 45 pages × 15 results = 675 results per (x, y, radius) query.
 * - Requests are rate-limited; we insert a configurable delay between pages.
 */

import {
  CAFE_CATEGORY_CODE,
  KAKAO_MAX_PAGE,
  KAKAO_PAGE_SIZE,
  REQUEST_DELAY_MS,
} from './constants';
import type { GridCell, KakaoLocalPlace, KakaoLocalResponse } from './types';

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

/**
 * Returns a promise that resolves after `ms` milliseconds.
 * Used to throttle outbound API requests and stay within rate limits.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Base URL for the Kakao Local (Daum API) search endpoints. */
const KAKAO_LOCAL_BASE = 'https://dapi.kakao.com/v2/local/search';

/**
 * Build the URL for a single category-search page request.
 */
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

/**
 * Fetch a single page from the Kakao Local category-search endpoint.
 * Returns `null` when the request fails or the response is malformed.
 */
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
      return null;
    }

    const data: unknown = await response.json();

    // Minimal structural validation before casting.
    if (
      typeof data !== 'object' ||
      data === null ||
      !('documents' in data) ||
      !('meta' in data)
    ) {
      return null;
    }

    return data as KakaoLocalResponse;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search for cafes within a grid cell using the Kakao Local category API.
 *
 * Automatically paginates through all available pages (up to the Kakao-imposed
 * ceiling of 45 pages × 15 results = 675 total) and deduplicates results by
 * place ID before returning.
 *
 * A `REQUEST_DELAY_MS` pause is inserted between every page request to avoid
 * hitting Kakao's rate limits.
 *
 * @param cell    The circular search area (centre + radius).
 * @param apiKey  Your Kakao REST API key (the part after `KakaoAK `).
 * @returns       Array of unique `KakaoLocalPlace` objects found in the cell.
 *                Returns an empty array on any error rather than throwing.
 */
export async function searchCafesByCategory(
  cell: GridCell,
  apiKey: string,
): Promise<KakaoLocalPlace[]> {
  const seen = new Set<string>();
  const results: KakaoLocalPlace[] = [];

  for (let page = 1; page <= KAKAO_MAX_PAGE; page++) {
    if (page > 1) {
      await delay(REQUEST_DELAY_MS);
    }

    const url = buildCategorySearchUrl(
      cell.centerLng,
      cell.centerLat,
      cell.radius,
      page,
    );

    const pageData = await fetchCategoryPage(url, apiKey);

    if (pageData === null) {
      // Treat any page-level failure as end-of-data for this cell.
      break;
    }

    for (const place of pageData.documents) {
      if (!seen.has(place.id)) {
        seen.add(place.id);
        results.push(place);
      }
    }

    // Stop early when Kakao signals there are no more pages.
    if (pageData.meta.is_end) {
      break;
    }
  }

  return results;
}
