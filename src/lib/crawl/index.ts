/**
 * Barrel export for the Seoul Earlybird Cafe crawling engine.
 *
 * Consumers should import from `@/lib/crawl` rather than individual modules
 * to insulate call-sites from internal file restructuring.
 */

// Types
export type {
  DayName,
} from './constants';

export type {
  GridCell,
  KakaoLocalPlace,
  KakaoLocalResponse,
  KakaoPlaceDetail,
  ParsedCafe,
} from './types';

// Constants
export {
  CAFE_CATEGORY_CODE,
  DAY_NAMES,
  EARLYBIRD_THRESHOLD,
  GRID_RADIUS,
  KAKAO_MAX_PAGE,
  KAKAO_MAX_RESULTS,
  KAKAO_PAGE_SIZE,
  KAKAO_PLACE_API_BASE,
  KAKAO_PLACE_API_HEADERS,
  REQUEST_DELAY_MS,
  SEOUL_BOUNDS,
} from './constants';

// Grid
export { generateSeoulGrid } from './grid';

// API clients
export { delay, searchCafesByCategory } from './kakao-api';
export { fetchPlaceDetail } from './place-detail';

// Parsers
export {
  buildParsedCafe,
  isEarlybird,
  parseInstagramUrl,
  parseOpeningTime,
} from './parser';
