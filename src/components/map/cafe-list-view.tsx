'use client';

import { useMemo } from 'react';
import { MapPin, Clock, Navigation } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCafeStore, getOpenStatus, is24Hours, type Cafe } from '@/lib/store/cafe-store';
import { formatOpeningTime, getOpeningBadgeStyle } from '@/lib/cafe-utils';
import { cn } from '@/lib/utils';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

interface CafeListViewProps {
  userLocation: { lat: number; lng: number } | null;
  onSelectCafe: (cafe: Cafe) => void;
  searchQuery?: string;
}

export function CafeListView({ userLocation, onSelectCafe, searchQuery = '' }: CafeListViewProps) {
  const filteredCafes = useCafeStore((state) => state.filteredCafes);

  const sortedCafes = useMemo(() => {
    let cafes = filteredCafes;

    // 리스트 내 검색 필터
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      cafes = cafes.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        (c.road_address?.toLowerCase().includes(q) ?? false)
      );
    }

    if (!userLocation) return cafes;
    return [...cafes].sort((a, b) => {
      const dA = haversineKm(userLocation.lat, userLocation.lng, a.latitude, a.longitude);
      const dB = haversineKm(userLocation.lat, userLocation.lng, b.latitude, b.longitude);
      return dA - dB;
    });
  }, [filteredCafes, userLocation, searchQuery]);

  if (sortedCafes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <MapPin className="h-10 w-10 stroke-1" />
        <p className="text-sm">조건에 맞는 카페가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <ul className="divide-y divide-border">
        {sortedCafes.map((cafe, idx) => {
          const cafe24h = is24Hours(cafe);
          const openStatus = cafe24h ? 'open' as const : getOpenStatus(cafe);
          const dist = userLocation
            ? haversineKm(userLocation.lat, userLocation.lng, cafe.latitude, cafe.longitude)
            : null;

          return (
            <motion.li
              key={cafe.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.02, 0.3) }}
            >
              <button
                onClick={() => onSelectCafe(cafe)}
                className="flex w-full items-start gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{cafe.name}</span>
                    {cafe24h && (
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        24시간
                      </span>
                    )}
                    {openStatus !== 'unknown' && !cafe24h && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                          openStatus === 'open'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                        )}
                      >
                        <span className={cn(
                          'inline-block h-1 w-1 rounded-full',
                          openStatus === 'open' ? 'bg-emerald-500' : 'bg-gray-400'
                        )} />
                        {openStatus === 'open' ? '영업중' : '영업 전'}
                      </span>
                    )}
                    {cafe.opening_time && !cafe24h && (
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                          getOpeningBadgeStyle(cafe.opening_time),
                        )}
                      >
                        <Clock className="mr-0.5 h-2.5 w-2.5" />
                        {formatOpeningTime(cafe.opening_time)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {cafe.road_address ?? cafe.address}
                  </p>
                </div>
                {dist !== null && (
                  <div className="flex-shrink-0 flex items-center gap-1 text-xs text-muted-foreground pt-0.5">
                    <Navigation className="h-3 w-3" />
                    {formatDistance(dist)}
                  </div>
                )}
              </button>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
