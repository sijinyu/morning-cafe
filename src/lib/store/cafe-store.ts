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

// 체인점 키워드 (스타벅스 제외)
const CHAIN_KEYWORDS = [
  '무인카페', '무인 카페', '무인24',
  '백다방', '빽다방',
  '컴포즈', '컴포즈커피',
  '메가커피', '메가MGC',
  '바나프레소',
  '이디야', '투썸플레이스', '투썸',
  '할리스', '탐앤탐스', '탐탐',
  '카페베네', '엔제리너스',
  '더벤티', '매머드', '매머드커피', '매머드익스프레스',
  '커피에반하다', '커피베이',
  '달콤커피', '커피나무',
  '요거프레소', '공차',
  '쥬씨', '셀렉토커피',
  '커피왕', '커피스미스',
  '에그카페', '에그카페24',
  '데이롱', '데이롱카페',
] as const;

export function isChainCafe(name: string): boolean {
  const lower = name.toLowerCase();
  return CHAIN_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

interface CafeState {
  cafes: Cafe[];
  selectedCafe: Cafe | null;
  timeFilter: TimeFilter;
  hideChains: boolean;
  loading: boolean;
  fetchCafes: () => Promise<void>;
  setSelectedCafe: (cafe: Cafe | null) => void;
  setTimeFilter: (filter: TimeFilter) => void;
  setHideChains: (hide: boolean) => void;
  filteredCafes: () => Cafe[];
}

function parseOpeningMinutes(openingTime: string | null): number | null {
  if (!openingTime) return null;
  // Handle "HH:MM:SS" or "HH:MM" formats from Postgres time column.
  const parts = openingTime.split(':');
  const hours = parseInt(parts[0] ?? '0', 10);
  const minutes = parseInt(parts[1] ?? '0', 10);
  return hours * 60 + minutes;
}

export const useCafeStore = create<CafeState>((set, get) => ({
  cafes: [],
  selectedCafe: null,
  timeFilter: 'all',
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

  setHideChains(hide) {
    set({ hideChains: hide });
  },

  filteredCafes() {
    const { cafes, timeFilter, hideChains } = get();

    return cafes.filter((cafe) => {
      // 체인점 필터
      if (hideChains && isChainCafe(cafe.name)) return false;

      // 시간 필터
      if (timeFilter === 'all') return true;
      const minutes = parseOpeningMinutes(cafe.opening_time);
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
}));
