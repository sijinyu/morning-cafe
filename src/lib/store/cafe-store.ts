'use client';
import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';

export type { Cafe } from '@/lib/types/cafe';
export { extractGu } from '@/lib/types/cafe';
export { is24Hours } from '@/lib/cafe-utils';
import { extractGu, type Cafe } from '@/lib/types/cafe';
import { is24Hours } from '@/lib/cafe-utils';

export type TimeFilter = 'all' | 'before6' | '6to7' | '7to8';
export type DayFilter = 'today' | '월' | '화' | '수' | '목' | '금' | '토' | '일';

// 휴무 판별 정규식 (모듈 레벨 상수 — 매번 컴파일 방지)
const CLOSED_REGEX = /휴무|정기|쉼/;

// 카페 메타데이터 사전 캐시 (gu, is24h — 데이터 로드 시 1회 계산)
interface CafeMeta { gu: string | null; is24h: boolean }
const cafeMetaCache = new Map<string, CafeMeta>();

function buildCafeMetaCache(cafes: Cafe[]): void {
  cafeMetaCache.clear();
  for (const cafe of cafes) {
    cafeMetaCache.set(cafe.id, {
      gu: extractGu(cafe.address),
      is24h: is24Hours(cafe),
    });
  }
}

function getCafeMeta(cafe: Cafe): CafeMeta {
  return cafeMetaCache.get(cafe.id) ?? { gu: extractGu(cafe.address), is24h: is24Hours(cafe) };
}

// 체인점 키워드
const CHAIN_KEYWORDS = [
  // 대형 프랜차이즈
  '스타벅스', 'STARBUCKS',
  '투썸플레이스', '투썸',
  '이디야', 'EDIYA',
  '할리스', 'HOLLYS',
  '탐앤탐스', '탐탐',
  '카페베네', '엔제리너스',
  '폴바셋', 'PAUL BASSETT',
  // 저가 프랜차이즈
  '메가커피', '메가MGC', '메가엠지씨', 'MEGA',
  '컴포즈', '컴포즈커피', 'COMPOSE',
  '빽다방', '백다방', 'PAIK',
  '더벤티', 'THE VENTI',
  '바나프레소',
  '매머드', '매머드커피', '매머드익스프레스',
  '커피에반하다',
  '커피베이',
  '달콤커피',
  // 음료 프랜차이즈
  '공차', 'GONGCHA',
  '쥬씨',
  '요거프레소',
  // 중소 프랜차이즈
  '셀렉토커피',
  '커피왕', '커피스미스',
  '커피나무',
  '에그카페', '에그카페24',
  '데이롱', '데이롱카페',
  '커피빈', 'COFFEE BEAN',
  '파스쿠찌', 'PASCUCCI',
  '드롭탑', 'DROPTOP',
  '카페봄봄',
  '만랩커피',
  '더착한커피',
  '감성커피',
  '커피명가',
  '전광수커피',
  '텐퍼센트', '10PERCENT', '10%커피',
  '우지커피', 'WOOJI',
  // 소규모 프랜차이즈
  '커피인류',
  '로칼커피',
  '백억커피',
  '더리터',
  '빈스빈스',
  '라떼킹',
  '커피마마',
  '하삼동',
  '청자다방',
  '카페인중독',
  '하이오커피',
  '토프레소',
  '아마스빈',
  '디저트39',
  '커피니',
  '더카페 ',
  '가배도',
  '빈브라더스',
  '벌크커피',
  '커스텀커피',
  '에가엠지', '에가MGC',
  '커피나인',
  '카페051',
  '벤티프레소',
  '마린커피',
  '카페아이엔지', 'ING',
  '카페잇',
  '망고식스',
  '천씨씨커피', '1000CC',
  '카페만월경',
  '카페인24',
  '국민우유집',
  '모리커피',
  '스트렝스커피',
  '카페신호',
  '함께그린카페',
  '카페온니',
  '고품격커피공장',
  '투달러커피',
  '포트캔커피',
  '해머스미스커피',
  '펠어커피초코', '펠어 커피초코',
  '더치앤빈',
  '달콤N',
  '알리바바',
  '오슬로우커피',
  '위클리베이글',
  '힘이나는커피생활',
  '카페홈즈',
  '아덴블랑제리',
  '블루샥',
  '일리커피',
  '파스꾸찌',
  '미니말레커피뢰스터', '미니말레 커피뢰스터',
  '루트비커피',
  '날쌘카페',
  '요커',
  '스몰굿커피',
  '잼잼키즈룸',
  '조선커피',
  '트러스트커피',
  '백미당',
  '잠바주스',
  '키즈앤룸',
  '카페게이트',
  '사과당',
  '와요커피',
  '옥타커피',
  '카페늘봄',
  '오금동커피',
  '박스커피',
  '영커피',
  '나인블럭',
  '소디스에스프레소',
  '오페라빈',
  '요거트퍼플',
  '커피829',
  '더치즈샵',
  '코삼이커피',
  '더정',
  '우롱티프로젝트',
  '기기커피',
  '카페블라썸',
  '뉴욕쟁이디저트',
  '옐로우캔',
  '이공커피',
  '베러먼데이',
  '커피사피엔스',
  '바나타이거',
  '카페16온스',
  // 카카오 카테고리 기반 발견
  '카페일분',
  '카페프리헷',
  '나이스카페인클럽',
  '파란만잔',
  '브루다커피',
  '카페드림',
  '커피랑도서관',
  '팔공티',
  '매스커피',
  '쉬즈베이글커피',
  // 유저 제보
  '발도스커피',
  '카페7그램',
  '본솔커피',
  '댄싱컵',
  '와플샵',
  '블루포트',
  '와드커피',
  '성북당',
  '커피볶는아침',
  '감탄커피앤베이커리', '감탄커피',
  '일리카페',
  '플라워베이커리',
  '테라커피',
  '투빅커피',
  '크레이저커피',
  '진심커피',
  '킁킁커피',
  '꿀잼키즈룸',
  '더베이크',
  '키즈카페파이용',
  '커피나라',
  '템포커피',
  '마이쥬스',
  '위카페',
  '프롬하츠커피',
  '도프커피',
  '커피루소',
  '스템커피',
  '로스터리 락온',
  '오슬랑커피',
  '봄꽃피는자리',
  '커피DZ',
  '소림사',
  '트립플러스',
  '남대문커피',
  '박스프레소',
  '빵아커피',
  '읍천리382',
  '희망카페',
  '비니커피',
  '디저트 문정', '디저트문정',
  '그라츠커피랩',
  '커피기업',
  // 무인카페
  '무인카페', '무인 카페', '무인24',
  // 추가
  '트리플에이',
  '베어글스',
  // 추가 체인 (2026-05 유저 제보)
  '에센스커피',
  '아토커피',
  '카페자스',
  '카페아이엠티',
  '에슬로우',
  '커피무카24',
  '커피볶는시골커피',
  '산체스커피',
  '24시무인셀프카페',
  '세이프룻',
  '아이스빌리지',
  '에이미스커피',
  '달리는커피',
  '과일의시작야미', '과일의시작 카페야미',
  '마니달오',
  '플러스82',
  '더마실카페',
  '오가다',
  '커피앳웍스',
  '아리스타커피',
  '리사르커피',
  '37.5 시그니처',
  '하루떡',
  '스탠딩커피',
  '쥬청과',
  '티오무인셀프카페24',
  '카인드카페',
  '호호참',
  '누나커피',
  '고망고',
  '빅피처커피',
  '커피코트',
  '위치커피',
  '지오씨커피', 'GOC커피',
  '셀프리커피',
  '웨이크업커피',
  '옵션스페셜티',
  '풍치커피익스프레스',
  '리플커피',
  '테이큰 커피', '테이큰커피',
  '바오밥커피로스터스',
  '데니스커피',
  '워너커피',
  '페이브커피',
  '헤이키커피',
  '타이커커피',
  '커피공장103',
  '어빌리티커피',
  '카페카운티',
  '메타킹커피',
  '우아한과일',
  '캘리토스트',
  '홈즈앤루팡',
  '컵넛',
  '미르보드',
  '와플스토리',
  '그릭엔젤 요거트', '그릭엔젤',
  '앙호두',
  '베브릿지',
  '삼시커피',
  '몬스터커피',
  '라이프커피',
  '로봇카페 비트', '로봇카페비트',
  '더빈마켓',
  '데일리프룻',
  '경이로운커피',
  '아아수혈',
  '퍼스트커피랩',
  '익커피',
  '심신프리',
  '오브민',
  '오하하커피',
  '브알라',
  '애니파크',
  '파머스빈',
  '레프트커피',
  '메가후르츠',
  '스쿠치커피',
  '제로커피',
  '사랑해베이글',
  '커피온리',
  // 2026-05-26 추가
  '카페우디',
  '플러스앤코',
  '히든커피',
  '일레븐보울',
  '백피트',
  '빈트립', '빈 트립',
  '커피맥스',
  '카우보이',
  '엑스엑스 커피메이커', '엑스엑스커피메이커', 'XX커피메이커',
  '커피투어',
  '아이엠베이글',
  '커피살롱',
  '아재커피',
] as const;

const CHAIN_KEYWORDS_LOWER = CHAIN_KEYWORDS.map((kw) => kw.toLowerCase());

export function isChainCafe(name: string): boolean {
  const lower = name.toLowerCase();
  return CHAIN_KEYWORDS_LOWER.some((kw) => lower.includes(kw));
}

// 요일 매핑 (Date.getDay() → Korean day key in hours_by_day)
const DAY_KEYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 현재 시간 기준으로 카페가 영업중인지 판단 */
export function getOpenStatus(cafe: Cafe): 'open' | 'closed' | 'unknown' {
  const now = new Date();
  const dayKey = DAY_KEYS[now.getDay()];

  // 1) 요일별 영업시간 체크
  const todayHours = cafe.hours_by_day?.[dayKey ?? ''];
  if (todayHours) {
    const match = todayHours.match(/^(\d{2}):(\d{2})~(\d{2}):(\d{2})$/);
    if (match) {
      const openMin = parseInt(match[1]!, 10) * 60 + parseInt(match[2]!, 10);
      const closeMin = parseInt(match[3]!, 10) * 60 + parseInt(match[4]!, 10);
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (closeMin > openMin) {
        return nowMin >= openMin && nowMin < closeMin ? 'open' : 'closed';
      }
      // 자정 넘김 (ex: 22:00~02:00)
      return nowMin >= openMin || nowMin < closeMin ? 'open' : 'closed';
    }
  }

  // 2) fallback: opening_time / closing_time
  if (cafe.opening_time && cafe.closing_time) {
    const openMin = parseOpeningMinutes(cafe.opening_time);
    const closeMin = parseOpeningMinutes(cafe.closing_time);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (openMin !== null && closeMin !== null) {
      if (closeMin > openMin) {
        return nowMin >= openMin && nowMin < closeMin ? 'open' : 'closed';
      }
      return nowMin >= openMin || nowMin < closeMin ? 'open' : 'closed';
    }
  }

  return 'unknown';
}


interface CafeState {
  cafes: Cafe[];
  chainCafeIds: Set<string>;
  selectedCafe: Cafe | null;
  userLocation: { lat: number; lng: number } | null;
  timeFilter: TimeFilter;
  dayFilter: DayFilter;
  guFilter: string | null; // null = 전체
  hideChains: boolean;
  hide24h: boolean;
  loading: boolean;
  /** Pre-computed filtered list — updated whenever cafes or filters change. */
  filteredCafes: Cafe[];
  /** Pre-computed sorted list of available 구 names. */
  availableGus: string[];
  fetchCafes: () => Promise<void>;
  setSelectedCafe: (cafe: Cafe | null) => void;
  setUserLocation: (loc: { lat: number; lng: number } | null) => void;
  setTimeFilter: (filter: TimeFilter) => void;
  setDayFilter: (filter: DayFilter) => void;
  setGuFilter: (gu: string | null) => void;
  setHideChains: (hide: boolean) => void;
  setHide24h: (hide: boolean) => void;
}

function parseOpeningMinutes(openingTime: string | null): number | null {
  if (!openingTime) return null;
  // Handle "HH:MM:SS" or "HH:MM" formats from Postgres time column.
  const parts = openingTime.split(':');
  const hours = parseInt(parts[0] ?? '0', 10);
  const minutes = parseInt(parts[1] ?? '0', 10);
  return hours * 60 + minutes;
}

/** 요일 필터에 해당하는 day key 반환 */
export function resolveDayKey(dayFilter: DayFilter): string {
  if (dayFilter === 'today') return DAY_KEYS[new Date().getDay()]!;
  return dayFilter;
}

/** 배지용 요일 라벨 ("오늘" 또는 "토") */
export function getDayLabel(dayFilter: DayFilter): string {
  if (dayFilter === 'today') return '오늘';
  return dayFilter;
}

/** 특정 요일의 오픈 시간 문자열을 반환 ("HH:MM" 형식). 없으면 opening_time fallback. */
export function getOpeningTimeForDay(cafe: Cafe, dayFilter: DayFilter = 'today'): string | null {
  const dayKey = resolveDayKey(dayFilter);
  if (cafe.hours_by_day) {
    // hours_by_day가 있으면 해당 요일 데이터만 사용 (없으면 null = 정보없음)
    const dayHours = cafe.hours_by_day[dayKey];
    if (!dayHours) return null;
    const match = dayHours.match(/^(\d{2}:\d{2})~/);
    if (match) return match[1]!;
    return null;
  }
  // hours_by_day 자체가 null이면 opening_time fallback
  return cafe.opening_time;
}

/** 특정 요일의 오픈 시간(분)을 반환 */
function getOpeningMinutesForDay(cafe: Cafe, dayKey: string): number | null {
  if (cafe.hours_by_day) {
    // hours_by_day가 있으면 해당 요일 데이터만 사용 (없으면 null = 정보없음)
    const dayHours = cafe.hours_by_day[dayKey];
    if (!dayHours) return null;
    const match = dayHours.match(/^(\d{2}):(\d{2})~/);
    if (match) return parseInt(match[1]!, 10) * 60 + parseInt(match[2]!, 10);
    return null;
  }
  // hours_by_day 자체가 null이면 opening_time fallback (요일 정보 없는 카페)
  return parseOpeningMinutes(cafe.opening_time);
}

/** Pure filter logic — called internally to recompute derived state. */
function computeFilteredCafes(
  cafes: Cafe[],
  chainCafeIds: Set<string>,
  timeFilter: TimeFilter,
  dayFilter: DayFilter,
  guFilter: string | null,
  hideChains: boolean,
  hide24h: boolean,
): Cafe[] {
  const dayKey = resolveDayKey(dayFilter);

  return cafes.filter((cafe) => {
    const meta = getCafeMeta(cafe);
    if (hideChains && chainCafeIds.has(cafe.id)) return false;
    if (hide24h && meta.is24h) return false;
    if (guFilter && meta.gu !== guFilter) return false;
    if (cafe.hours_by_day) {
      const dayHours = cafe.hours_by_day[dayKey];
      // 명시적 휴무 텍스트
      if (dayHours && CLOSED_REGEX.test(dayHours)) return false;
      // hours_by_day는 있는데 이 요일 키가 아예 없으면 = 휴무/정보없음 → 시간 필터 시 제외
      if (!dayHours && timeFilter !== 'all') return false;
    }
    if (timeFilter === 'all') return true;
    const minutes = getOpeningMinutesForDay(cafe, dayKey);
    if (minutes === null) return false;
    switch (timeFilter) {
      case 'before6':
        return minutes < 360;
      case '6to7':
        return minutes >= 360 && minutes <= 420;
      case '7to8':
        return minutes >= 420 && minutes <= 480;
      default:
        return true;
    }
  });
}

function computeAvailableGus(cafes: Cafe[]): string[] {
  const gus = new Set<string>();
  for (const cafe of cafes) {
    const meta = getCafeMeta(cafe);
    if (meta.gu) gus.add(meta.gu);
  }
  return [...gus].sort();
}

// --- sessionStorage cache helpers ---

const CACHE_KEY = 'morning-cafe:cafes';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CafeCache {
  timestamp: number;
  rows: Record<string, unknown>[];
}

function readCache(): Record<string, unknown>[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CafeCache = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      sessionStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed.rows;
  } catch {
    return null;
  }
}

function writeCache(rows: Record<string, unknown>[]): void {
  try {
    const entry: CafeCache = { timestamp: Date.now(), rows };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // sessionStorage full or unavailable — silently ignore
  }
}

async function fetchFromSupabase(): Promise<Record<string, unknown>[] | null> {
  const supabase = createClient();
  const allRows: Record<string, unknown>[] = [];
  const PAGE_SIZE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('cafes_with_coords')
      .select('id, kakao_place_id, name, address, road_address, phone, latitude, longitude, place_url, instagram_url, category, opening_time, closing_time, hours_by_day, is_earlybird, last_crawled_at')
      .eq('is_earlybird', true)
      .range(from, from + PAGE_SIZE - 1);

    if (error) return null;

    allRows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allRows;
}

function mapRowsToCafes(rows: Record<string, unknown>[]): Cafe[] {
  return rows.map((row) => ({
    id: row.id as string,
    kakao_place_id: row.kakao_place_id as string,
    name: row.name as string,
    address: row.address as string,
    road_address: row.road_address as string | null,
    phone: row.phone as string | null,
    latitude: row.latitude as number,
    longitude: row.longitude as number,
    place_url: row.place_url as string | null,
    instagram_url: row.instagram_url as string | null,
    category: row.category as string | null,
    opening_time: row.opening_time as string | null,
    closing_time: row.closing_time as string | null,
    hours_by_day: row.hours_by_day as Record<string, string> | null,
    is_earlybird: row.is_earlybird as boolean,
    last_crawled_at: row.last_crawled_at as string | null,
  }));
}

function computeChainCafeIds(cafes: Cafe[]): Set<string> {
  const ids = new Set<string>();
  for (const cafe of cafes) {
    if (isChainCafe(cafe.name)) ids.add(cafe.id);
  }
  return ids;
}

function applyData(
  rows: Record<string, unknown>[],
  get: () => CafeState,
  set: (partial: Partial<CafeState>) => void,
) {
  const cafes = mapRowsToCafes(rows);
  buildCafeMetaCache(cafes);
  const chainCafeIds = computeChainCafeIds(cafes);
  set({ cafes, chainCafeIds, availableGus: computeAvailableGus(cafes), loading: false });
  recompute(get, set);
}

/** Recompute derived state and merge into store. */
function recompute(get: () => CafeState, set: (partial: Partial<CafeState>) => void) {
  const { cafes, chainCafeIds, timeFilter, dayFilter, guFilter, hideChains, hide24h } = get();
  set({
    filteredCafes: computeFilteredCafes(cafes, chainCafeIds, timeFilter, dayFilter, guFilter, hideChains, hide24h),
  });
}

export const useCafeStore = create<CafeState>((set, get) => ({
  cafes: [],
  chainCafeIds: new Set<string>(),
  selectedCafe: null,
  userLocation: null,
  timeFilter: '7to8',
  dayFilter: 'today',
  guFilter: null,
  hideChains: true,
  hide24h: false,
  loading: false,
  filteredCafes: [],
  availableGus: [],

  async fetchCafes() {
    set({ loading: true });

    // Stale-While-Revalidate: serve cache immediately, refresh in background
    const cached = readCache();
    if (cached) {
      applyData(cached, get, set);
      // Background refresh — don't await
      fetchFromSupabase().then((freshRows) => {
        if (freshRows) {
          writeCache(freshRows);
          applyData(freshRows, get, set);
        }
      });
      return;
    }

    // No cache — fetch from Supabase directly
    try {
      const rows = await fetchFromSupabase();
      if (!rows) {
        set({ cafes: [], filteredCafes: [], availableGus: [], loading: false });
        return;
      }
      writeCache(rows);
      applyData(rows, get, set);
    } catch {
      set({ cafes: [], filteredCafes: [], availableGus: [], loading: false });
    }
  },

  setSelectedCafe(cafe) {
    set({ selectedCafe: cafe });
  },

  setUserLocation(loc) {
    set({ userLocation: loc });
  },

  setTimeFilter(filter) {
    set({ timeFilter: filter });
    recompute(get, set);
  },

  setDayFilter(filter) {
    set({ dayFilter: filter });
    recompute(get, set);
  },

  setGuFilter(gu) {
    set({ guFilter: gu });
    recompute(get, set);
  },

  setHideChains(hide) {
    set({ hideChains: hide });
    recompute(get, set);
  },

  setHide24h(hide) {
    set({ hide24h: hide });
    recompute(get, set);
  },
}));
