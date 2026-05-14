/**
 * Kakao Map internal place-detail API client (unofficial).
 *
 * Endpoint: GET https://place-api.map.kakao.com/places/panel3/{placeId}
 *
 * This endpoint is not part of the official Kakao Developer API; it is the
 * internal JSON feed powering the Kakao Map place panel. Because it is
 * unofficial it may change without notice. Specific headers are required to
 * avoid a 403 rejection.
 *
 * Failure contract
 * ----------------
 * `fetchPlaceDetail` NEVER throws. Any network error, non-200 status, timeout,
 * or parse failure causes it to return `null` so the caller can decide whether
 * to skip or retry the place.
 */

import {
  KAKAO_PLACE_API_BASE,
  KAKAO_PLACE_API_HEADERS,
  REQUEST_DELAY_MS,
} from './constants';
import type { KakaoPlaceDetail } from './types';
import { delay } from './kakao-api';

/** Request timeout in milliseconds for a single place-detail fetch. */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Validate that a parsed JSON value has at least the rough shape of a
 * `KakaoPlaceDetail` object (non-null object). We do not assert nested field
 * presence because the internal API omits many fields for certain places.
 */
function isKakaoPlaceDetail(value: unknown): value is KakaoPlaceDetail {
  return typeof value === 'object' && value !== null;
}

/**
 * Fetch the Kakao Map internal place-detail record for a given place ID.
 *
 * Includes the required `User-Agent`, `Referer`, and `pf` headers so the
 * internal API treats the request as originating from the Kakao Map web client.
 * A configurable timeout is applied via `AbortController`.
 *
 * A `REQUEST_DELAY_MS` pause is applied before each call so the function can
 * be invoked in a tight loop without triggering rate limits.
 *
 * @param placeId  The numeric Kakao place ID (e.g. `"1234567890"`).
 * @returns        Parsed `KakaoPlaceDetail` object, or `null` on any failure.
 */
export async function fetchPlaceDetail(
  placeId: string,
): Promise<KakaoPlaceDetail | null> {
  await delay(REQUEST_DELAY_MS);

  const url = `${KAKAO_PLACE_API_BASE}/places/panel3/${encodeURIComponent(placeId)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { ...KAKAO_PLACE_API_HEADERS },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    // Guard against empty bodies (content-length: 0 or empty JSON).
    const text = await response.text();
    if (!text || text.trim() === '') {
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }

    if (!isKakaoPlaceDetail(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    // Covers AbortError (timeout), NetworkError, and any other fetch failure.
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
