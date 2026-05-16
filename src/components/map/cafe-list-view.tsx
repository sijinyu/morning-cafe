'use client';

import { useMemo, useRef } from 'react';
import { MapPin, Clock, Navigation } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCafeStore, getOpenStatus, is24Hours, getOpeningTimeForDay, type Cafe, type DayFilter } from '@/lib/store/cafe-store';
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

interface CafeWithDistance {
  readonly cafe: Cafe;
  readonly distance: number | null;
}

interface CafeListViewProps {
  userLocation: { lat: number; lng: number } | null;
  onSelectCafe: (cafe: Cafe) => void;
  searchQuery?: string;
}

export function CafeListView({ userLocation, onSelectCafe, searchQuery = '' }: CafeListViewProps) {
  const filteredCafes = useCafeStore((state) => state.filteredCafes);
  const dayFilter = useCafeStore((state) => state.dayFilter);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sortedCafes: readonly CafeWithDistance[] = useMemo(() => {
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

    // 거리 한 번만 계산 + 정렬 + 결과에 포함
    if (!userLocation) {
      return cafes.map((cafe) => ({ cafe, distance: null }));
    }

    return cafes
      .map((cafe) => ({
        cafe,
        distance: haversineKm(userLocation.lat, userLocation.lng, cafe.latitude, cafe.longitude),
      }))
      .toSorted((a, b) => a.distance - b.distance);
  }, [filteredCafes, userLocation, searchQuery]);

  const virtualizer = useVirtualizer({
    count: sortedCafes.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 88,
    overscan: 5,
  });

  if (sortedCafes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <MapPin className="h-10 w-10 stroke-1" />
        <p className="text-sm">조건에 맞는 카페가 없습니다</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const { cafe, distance } = sortedCafes[virtualRow.index];
          const cafe24h = is24Hours(cafe);
          const openStatus = cafe24h ? 'open' as const : getOpenStatus(cafe);

          return (
            <div
              key={cafe.id}
              className="absolute left-0 top-0 w-full"
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <button
                onClick={() => onSelectCafe(cafe)}
                className="flex w-full items-start gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors text-left border-b border-border"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm truncate">{cafe.name}</span>
                    {cafe24h && (
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
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
                    {(() => {
                      const dayTime = getOpeningTimeForDay(cafe, dayFilter);
                      return dayTime && !cafe24h ? (
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                            getOpeningBadgeStyle(dayTime),
                          )}
                        >
                          <Clock className="mr-0.5 h-2.5 w-2.5" />
                          {formatOpeningTime(dayTime)}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {cafe.road_address ?? cafe.address}
                  </p>
                </div>
                {distance !== null && (
                  <div className="flex-shrink-0 flex items-center gap-1 text-xs text-muted-foreground pt-0.5">
                    <Navigation className="h-3 w-3" />
                    {formatDistance(distance)}
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
