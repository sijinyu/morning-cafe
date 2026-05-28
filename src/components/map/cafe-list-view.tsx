'use client';

import { useMemo, useRef } from 'react';
import { MapPin, Clock, Navigation, Sparkles } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useShallow } from 'zustand/react/shallow';
import { useCafeStore, getOpenStatus, getOpeningTimeForDay, getDayLabel, type Cafe } from '@/lib/store/cafe-store';
import { formatOpeningTime, getOpeningBadgeStyle, is24HoursForDay, isNewCafe } from '@/lib/cafe-utils';
import { cn } from '@/lib/utils';

function parseMinutes(time: string | null): number | null {
  if (!time) return null;
  const parts = time.split(':');
  return parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
}

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
  const { filteredCafes, dayFilter, chainCafeIds } = useCafeStore(
    useShallow((state) => ({
      filteredCafes: state.filteredCafes,
      dayFilter: state.dayFilter,
      chainCafeIds: state.chainCafeIds,
    })),
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1단계: 검색 필터 (검색 쿼리 변경 시에만 재계산)
  const searchFilteredCafes = useMemo(() => {
    if (!searchQuery.trim()) return filteredCafes;
    const q = searchQuery.trim().toLowerCase();
    return filteredCafes.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.address.toLowerCase().includes(q) ||
      (c.road_address?.toLowerCase().includes(q) ?? false)
    );
  }, [filteredCafes, searchQuery]);

  // 2단계: 거리 계산 + 정렬 (위치 변경 시에만 재계산, 검색만 바뀌면 거리 계산 스킵)
  const sortedCafes: readonly CafeWithDistance[] = useMemo(() => {
    if (!userLocation) {
      return searchFilteredCafes.map((cafe) => ({ cafe, distance: null }));
    }
    return searchFilteredCafes
      .map((cafe) => ({
        cafe,
        distance: haversineKm(userLocation.lat, userLocation.lng, cafe.latitude, cafe.longitude),
      }))
      .toSorted((a, b) => a.distance - b.distance);
  }, [searchFilteredCafes, userLocation]);

  // 신규 카페 (7일 이내 created_at)
  const newCafes = useMemo(() => {
    return filteredCafes.filter((c) => isNewCafe(c)).slice(0, 10);
  }, [filteredCafes]);

  // 인기 카페 (가장 일찍 여는 카페 TOP 8)
  const popularCafes = useMemo(() => {
    return [...filteredCafes]
      .filter((c) => c.opening_time)
      .sort((a, b) => {
        const aMin = parseMinutes(a.opening_time);
        const bMin = parseMinutes(b.opening_time);
        return (aMin ?? 999) - (bMin ?? 999);
      })
      .slice(0, 8);
  }, [filteredCafes]);

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
      {/* Featured sections — only when not searching */}
      {!searchQuery.trim() && (
        <div className="px-4 pb-2 space-y-4 pt-3">
          {/* 신규 카페 */}
          {newCafes.length > 0 && (
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                <h3 className="text-xs font-semibold text-foreground">신규 카페</h3>
                <span className="text-[10px] text-muted-foreground">최근 7일</span>
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
                {newCafes.map((cafe) => (
                  <FeatureCard
                    key={cafe.id}
                    cafe={cafe}
                    onSelect={onSelectCafe}
                    badge="NEW"
                    badgeColor="bg-emerald-500 text-white"
                  />
                ))}
              </div>
            </section>
          )}

          {/* 인기 카페 — 가장 일찍 여는 카페 */}
          {popularCafes.length > 0 && (
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <h3 className="text-xs font-semibold text-foreground">얼리버드 TOP</h3>
              </div>
              <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
                {popularCafes.map((cafe) => (
                  <FeatureCard
                    key={cafe.id}
                    cafe={cafe}
                    onSelect={onSelectCafe}
                  />
                ))}
              </div>
            </section>
          )}

          {(newCafes.length > 0 || popularCafes.length > 0) && (
            <div className="h-px bg-border" />
          )}
        </div>
      )}

      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const { cafe, distance } = sortedCafes[virtualRow.index];
          const cafe24h = is24HoursForDay(cafe, (['일', '월', '화', '수', '목', '금', '토'] as const)[new Date().getDay()]!);
          const isChain = chainCafeIds.has(cafe.id);
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
                className="flex w-full items-start gap-3 px-5 py-4 hover:bg-foreground/[0.03] active:bg-foreground/[0.05] transition-colors text-left border-b border-border/50"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm truncate">{cafe.name}</span>
                    {isNewCafe(cafe) && (
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500 text-white">
                        NEW
                      </span>
                    )}
                    {isChain && (
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                        프랜차이즈
                      </span>
                    )}
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
                          {getDayLabel(dayFilter)} {formatOpeningTime(dayTime)}
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

interface FeatureCardProps {
  cafe: Cafe;
  onSelect: (cafe: Cafe) => void;
  badge?: string;
  badgeColor?: string;
}

function FeatureCard({ cafe, onSelect, badge, badgeColor }: FeatureCardProps) {
  return (
    <button
      onClick={() => onSelect(cafe)}
      className="flex-shrink-0 w-36 rounded-2xl border border-border/60 bg-background p-3 text-left transition-colors hover:bg-foreground/[0.03] active:bg-foreground/[0.05]"
    >
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        {badge && (
          <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', badgeColor)}>
            {badge}
          </span>
        )}
        {cafe.opening_time && (
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
              getOpeningBadgeStyle(cafe.opening_time),
            )}
          >
            {formatOpeningTime(cafe.opening_time)}
          </span>
        )}
      </div>
      <p className="font-bold text-xs truncate">{cafe.name}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground truncate">
        {(cafe.road_address ?? cafe.address).replace(/서울\S*\s+\S+구\s*/, '')}
      </p>
    </button>
  );
}
