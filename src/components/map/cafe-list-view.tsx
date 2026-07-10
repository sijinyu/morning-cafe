'use client';

import { useMemo, useRef, useCallback, type MouseEvent as ReactMouseEvent } from 'react';
import { MapPin, Clock, Navigation, Sparkles } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useShallow } from 'zustand/react/shallow';
import { useTranslations } from 'next-intl';
import { useCafeStore, getOpenStatus, getOpeningTimeForDay, getDayLabel, type Cafe } from '@/lib/store/cafe-store';
import { getCachedFirstPhoto } from '@/lib/hooks/use-place-detail';
import { formatOpeningTime, getOpeningBadgeStyle, is24HoursForDay, isNewCafe, haversineKm } from '@/lib/cafe-utils';
import { cn } from '@/lib/utils';

/** 웹에서 마우스 드래그 가로 스크롤 지원 — moved flag로 드래그 후 클릭 차단 */
function useDragScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef({ isDown: false, startX: 0, scrollLeft: 0, moved: false });

  const onMouseDown = useCallback((e: ReactMouseEvent) => {
    const el = ref.current;
    if (!el) return;
    state.current = { isDown: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft, moved: false };
    el.style.cursor = 'grabbing';
  }, []);

  const onMouseMove = useCallback((e: ReactMouseEvent) => {
    if (!state.current.isDown || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = x - state.current.startX;
    if (Math.abs(walk) > 3) state.current.moved = true;
    ref.current.scrollLeft = state.current.scrollLeft - walk;
  }, []);

  const onMouseUp = useCallback(() => {
    if (!ref.current) return;
    state.current.isDown = false;
    ref.current.style.cursor = 'grab';
  }, []);

  /** 드래그 중이었으면 true 반환 → 클릭 핸들러에서 무시용 */
  const wasDragging = useCallback(() => state.current.moved, []);

  return { ref, onMouseDown, onMouseMove, onMouseUp, onMouseLeave: onMouseUp, wasDragging };
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
  const t = useTranslations('list');
  const tCafe = useTranslations('cafe');
  const { filteredCafes, dayFilter, chainCafeIds } = useCafeStore(
    useShallow((state) => ({
      filteredCafes: state.filteredCafes,
      dayFilter: state.dayFilter,
      chainCafeIds: state.chainCafeIds,
    })),
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const newDrag = useDragScroll();
  const nearbyDrag = useDragScroll();

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

  // 내 근처 카페 (GPS 있을 때만, 가까운 순 5개)
  const nearbyCafes = useMemo(() => {
    if (!userLocation) return [];
    return [...filteredCafes]
      .map((c) => ({ cafe: c, dist: haversineKm(userLocation.lat, userLocation.lng, c.latitude, c.longitude) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5)
      .map(({ cafe }) => cafe);
  }, [filteredCafes, userLocation]);

  const virtualizer = useVirtualizer({
    count: sortedCafes.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 96,
    overscan: 5,
  });

  const hasFeatures = newCafes.length > 0 || nearbyCafes.length > 0;

  if (sortedCafes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <MapPin className="h-10 w-10 stroke-1" />
        <p className="text-sm">{t('emptyState')}</p>
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
                <h3 className="text-xs font-semibold text-foreground">{t('newCafes')}</h3>
                <span className="text-[10px] text-muted-foreground">{t('last7Days')}</span>
              </div>
              <div
                ref={newDrag.ref}
                onMouseDown={newDrag.onMouseDown}
                onMouseMove={newDrag.onMouseMove}
                onMouseUp={newDrag.onMouseUp}
                onMouseLeave={newDrag.onMouseLeave}
                className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1 cursor-grab select-none"
              >
                {newCafes.map((cafe) => (
                  <FeatureCard
                    key={cafe.id}
                    cafe={cafe}
                    onSelect={onSelectCafe}
                    wasDragging={newDrag.wasDragging}
                    badge="NEW"
                    badgeColor="bg-emerald-500 text-white"
                    userLocation={userLocation}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 내 근처 */}
          {nearbyCafes.length > 0 && (
            <section>
              <div className="flex items-center gap-1.5 mb-2">
                <Navigation className="h-3.5 w-3.5 text-blue-500" />
                <h3 className="text-xs font-semibold text-foreground">{t('nearby')}</h3>
              </div>
              <div
                ref={nearbyDrag.ref}
                onMouseDown={nearbyDrag.onMouseDown}
                onMouseMove={nearbyDrag.onMouseMove}
                onMouseUp={nearbyDrag.onMouseUp}
                onMouseLeave={nearbyDrag.onMouseLeave}
                className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1 cursor-grab select-none"
              >
                {nearbyCafes.map((cafe) => (
                  <FeatureCard
                    key={cafe.id}
                    cafe={cafe}
                    onSelect={onSelectCafe}
                    wasDragging={nearbyDrag.wasDragging}
                    userLocation={userLocation}
                    showDistance
                  />
                ))}
              </div>
            </section>
          )}

          {hasFeatures && (
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
                {(() => {
                  const photo = cafe.thumbnail_url || getCachedFirstPhoto(cafe.kakao_place_id);
                  return photo ? (
                    <div className="flex-shrink-0 h-11 w-11 rounded-full overflow-hidden bg-muted">
                      <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                    </div>
                  ) : (
                    <div className="flex-shrink-0 h-11 w-11 rounded-full bg-muted flex items-center justify-center">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    </div>
                  );
                })()}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm truncate">{cafe.name}</span>
                    {isNewCafe(cafe) && (
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500 text-white">
                        NEW
                      </span>
                    )}
                    {isChain && (
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400">
                        {tCafe('franchise')}
                      </span>
                    )}
                    {cafe24h && (
                      <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        {tCafe('hours24')}
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
                        {openStatus === 'open' ? tCafe('open') : tCafe('closed')}
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
  wasDragging?: () => boolean;
  badge?: string;
  badgeColor?: string;
  userLocation?: { lat: number; lng: number } | null;
  showDistance?: boolean;
}

function FeatureCard({ cafe, onSelect, wasDragging, badge, badgeColor, userLocation, showDistance }: FeatureCardProps) {
  const distance = userLocation
    ? haversineKm(userLocation.lat, userLocation.lng, cafe.latitude, cafe.longitude)
    : null;

  return (
    <button
      onClick={() => { if (wasDragging?.()) return; onSelect(cafe); }}
      className="flex-shrink-0 w-36 rounded-2xl border border-border/60 bg-background overflow-hidden text-left transition-colors hover:bg-foreground/[0.03] active:bg-foreground/[0.05]"
    >
      <div className="h-20 w-full bg-muted">
        {(() => {
          const photo = cafe.thumbnail_url || getCachedFirstPhoto(cafe.kakao_place_id);
          return photo ? (
            <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <MapPin className="h-5 w-5 text-muted-foreground/40" />
            </div>
          );
        })()}
      </div>
      <div className="p-3">
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        {badge && (
          <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', badgeColor)}>
            {badge}
          </span>
        )}
        {showDistance && distance !== null && (
          <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
            {formatDistance(distance)}
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
      </div>
    </button>
  );
}
