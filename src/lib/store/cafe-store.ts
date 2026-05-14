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

interface CafeState {
  cafes: Cafe[];
  selectedCafe: Cafe | null;
  timeFilter: TimeFilter;
  loading: boolean;
  fetchCafes: () => Promise<void>;
  setSelectedCafe: (cafe: Cafe | null) => void;
  setTimeFilter: (filter: TimeFilter) => void;
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

  filteredCafes() {
    const { cafes, timeFilter } = get();
    if (timeFilter === 'all') return cafes;

    return cafes.filter((cafe) => {
      const minutes = parseOpeningMinutes(cafe.opening_time);
      if (minutes === null) return false;

      switch (timeFilter) {
        case 'before6':
          return minutes < 360; // before 06:00
        case '6to7':
          return minutes >= 360 && minutes < 420; // 06:00 – 06:59
        case '7to8':
          return minutes >= 420 && minutes < 480; // 07:00 – 07:59
        default:
          return true;
      }
    });
  },
}));
