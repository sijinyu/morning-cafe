'use client';
import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';

export interface Cafe {
  id: string;
  kakao_place_id: string;
  name: string;
  address: string;
  road_address: string | null;
  phone: string | null;
  latitude: number;
  longitude: number;
  place_url: string | null;
  instagram_url: string | null;
  category: string | null;
  opening_time: string | null;
  closing_time: string | null;
  hours_by_day: Record<string, string> | null;
  is_earlybird: boolean;
  last_crawled_at: string | null;
}

export type TimeFilter = 'all' | 'before6' | '6to7' | '7to8';
export type DayFilter = 'today' | '월' | '화' | '수' | '목' | '금' | '토' | '일';

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
  '메가커피', '메가MGC', 'MEGA',
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
  // 무인카페
  '무인카페', '무인 카페', '무인24',
] as const;

export function isChainCafe(name: string): boolean {
  const lower = name.toLowerCase();
  return CHAIN_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

// 24시간 영업 판단
export function is24Hours(cafe: Cafe): boolean {
  if (cafe.opening_time === '00:00:00' && cafe.closing_time === '24:00:00') return true;
  if (cafe.opening_time === '00:00:00' && cafe.closing_time === '00:00:00') return true;
  // hours_by_day에 "00:00~24:00" 패턴
  const sample = Object.values(cafe.hours_by_day ?? {})[0];
  if (sample && /^00:00~24:00$/.test(sample)) return true;
  return false;
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

/** 주소에서 구 이름 추출 */
export function extractGu(address: string): string | null {
  const match = address.match(/서울\S*\s+(\S+구)/);
  return match?.[1] ?? null;
}

interface CafeState {
  cafes: Cafe[];
  selectedCafe: Cafe | null;
  timeFilter: TimeFilter;
  dayFilter: DayFilter;
  guFilter: string | null; // null = 전체
  hideChains: boolean;
  loading: boolean;
  fetchCafes: () => Promise<void>;
  setSelectedCafe: (cafe: Cafe | null) => void;
  setTimeFilter: (filter: TimeFilter) => void;
  setDayFilter: (filter: DayFilter) => void;
  setGuFilter: (gu: string | null) => void;
  setHideChains: (hide: boolean) => void;
  filteredCafes: () => Cafe[];
  availableGus: () => string[];
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
function resolveDayKey(dayFilter: DayFilter): string {
  if (dayFilter === 'today') return DAY_KEYS[new Date().getDay()]!;
  return dayFilter;
}

/** 특정 요일의 오픈 시간(분)을 반환 */
function getOpeningMinutesForDay(cafe: Cafe, dayKey: string): number | null {
  const dayHours = cafe.hours_by_day?.[dayKey];
  if (dayHours) {
    const match = dayHours.match(/^(\d{2}):(\d{2})~/);
    if (match) return parseInt(match[1]!, 10) * 60 + parseInt(match[2]!, 10);
  }
  // fallback: 전체 opening_time
  return parseOpeningMinutes(cafe.opening_time);
}

export const useCafeStore = create<CafeState>((set, get) => ({
  cafes: [],
  selectedCafe: null,
  timeFilter: 'all',
  dayFilter: 'today',
  guFilter: null,
  hideChains: true, // 기본값: 체인점 숨김
  loading: false,

  async fetchCafes() {
    set({ loading: true });
    try {
      const supabase = createClient();

      // cafes_with_coords is the VIEW defined in migration 002 that adds
      // latitude and longitude columns derived from the PostGIS geography column.
      const { data, error } = await supabase
        .from('cafes_with_coords')
        .select('*')
        .eq('is_earlybird', true);

      if (error) {
        // Supabase env vars may not be set yet — silently degrade.
        set({ cafes: [], loading: false });
        return;
      }

      const cafes: Cafe[] = (data ?? []).map((row) => ({
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

      set({ cafes, loading: false });
    } catch {
      // Silently degrade when Supabase is not configured.
      set({ cafes: [], loading: false });
    }
  },

  setSelectedCafe(cafe) {
    set({ selectedCafe: cafe });
  },

  setTimeFilter(filter) {
    set({ timeFilter: filter });
  },

  setDayFilter(filter) {
    set({ dayFilter: filter });
  },

  setGuFilter(gu) {
    set({ guFilter: gu });
  },

  setHideChains(hide) {
    set({ hideChains: hide });
  },

  filteredCafes() {
    const { cafes, timeFilter, dayFilter, guFilter, hideChains } = get();
    const dayKey = resolveDayKey(dayFilter);

    return cafes.filter((cafe) => {
      // 체인점 필터
      if (hideChains && isChainCafe(cafe.name)) return false;

      // 구 필터
      if (guFilter) {
        const gu = extractGu(cafe.address);
        if (gu !== guFilter) return false;
      }

      // 요일별 영업 여부 체크
      if (dayFilter !== 'today' && cafe.hours_by_day) {
        const dayHours = cafe.hours_by_day[dayKey];
        // 해당 요일 데이터가 있는데 "정기휴무" 등이면 제외
        if (dayHours && /휴무|정기|쉼/.test(dayHours)) return false;
      }

      // 시간 필터
      if (timeFilter === 'all') return true;
      const minutes = getOpeningMinutesForDay(cafe, dayKey);
      if (minutes === null) return false;

      switch (timeFilter) {
        case 'before6':
          return minutes < 360;
        case '6to7':
          return minutes >= 360 && minutes < 420;
        case '7to8':
          return minutes >= 420 && minutes < 480;
        default:
          return true;
      }
    });
  },

  availableGus() {
    const { cafes } = get();
    const gus = new Set<string>();
    for (const cafe of cafes) {
      const gu = extractGu(cafe.address);
      if (gu) gus.add(gu);
    }
    return [...gus].sort();
  },
}));
