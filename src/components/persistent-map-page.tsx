'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePathname } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { Map as MapIcon, List } from 'lucide-react';
import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useCafeStore } from '@/lib/store/cafe-store';
import { warmupConnections } from '@/lib/hooks/use-place-detail';
import { isNewCafe, isInServiceArea } from '@/lib/cafe-utils';
import { CafeMap } from '@/components/map/cafe-map';
import { MapErrorBoundary } from '@/components/map/map-error-boundary';
import { TimeFilter } from '@/components/map/time-filter';
import { MyLocationButton } from '@/components/map/my-location-button';
import { SearchBar } from '@/components/map/search-bar';
import { CafeListView } from '@/components/map/cafe-list-view';
import { CafeRoulette } from '@/components/map/cafe-roulette';
// import { AiHubButton } from '@/components/ai/ai-hub-button'; // AI 유료 전환 후 복원
import { MorningPick } from '@/components/morning-pick';
import { cn } from '@/lib/utils';

import { trackEvent } from '@/lib/analytics';
import dynamic from 'next/dynamic';

const CafeBottomSheetWrapper = dynamic(
  () => import('@/components/map/cafe-bottom-sheet').then((mod) => mod.CafeBottomSheetWrapper),
  { ssr: false },
);

type ViewMode = 'map' | 'list';

export function PersistentMapPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('list');
  const tBrand = useTranslations('brand');
  const tToast = useTranslations('toast');
  const isMapRoute = pathname === '/';

  const { fetchCafes, cafes, filteredCafes, setSelectedCafe, userLocation, setUserLocation } = useCafeStore(
    useShallow((state) => ({
      fetchCafes: state.fetchCafes,
      cafes: state.cafes,
      filteredCafes: state.filteredCafes,
      setSelectedCafe: state.setSelectedCafe,
      userLocation: state.userLocation,
      setUserLocation: state.setUserLocation,
    })),
  );
  const panToRef = useRef<((lat: number, lng: number) => void) | null>(null);
  const plainPanToRef = useRef<((lat: number, lng: number) => void) | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: 37.5665, lng: 126.978 });
  const deepLinkHandledRef = useRef<string | null>(null);
  const [listSeen, setListSeen] = useState(true); // SSR safe default
  const [outOfAreaToast, setOutOfAreaToast] = useState(false);
  const newCafeCount = useMemo(() => filteredCafes.filter(isNewCafe).length, [filteredCafes]);

  useEffect(() => {
    fetchCafes();
  }, [fetchCafes]);

  // CDN + API warmup — cafes 로드 직후 1회 실행
  const cafesReady = cafes.length > 0;
  useEffect(() => {
    if (!cafesReady) return;
    warmupConnections(cafes[0]?.kakao_place_id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cafesReady]);

  // Deep link: /?cafeId=xxx → select and pan to the cafe
  useEffect(() => {
    const cafeId = searchParams.get('cafeId');
    if (!cafeId || cafes.length === 0) return;
    if (deepLinkHandledRef.current === cafeId) return;
    // ponytail: 한번 처리 시도한 cafeId는 즉시 마킹 — 미발견 시 무한 루프 방지
    deepLinkHandledRef.current = cafeId;
    const target = cafes.find((c) => c.id === cafeId);
    if (target) {
      setSelectedCafe(target);
      let attempts = 0;
      const tryPanTo = () => {
        if (panToRef.current) {
          panToRef.current(target.latitude, target.longitude);
        } else if (attempts < 5) {
          attempts++;
          setTimeout(tryPanTo, 300);
        }
      };
      setTimeout(tryPanTo, 200);
    }
  }, [searchParams, cafes, setSelectedCafe]);

  // selectedCafe 변경 시 (찜/최근/외부에서 set) → 자동 panTo
  const selectedCafe = useCafeStore((s) => s.selectedCafe);
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedCafe) { prevSelectedRef.current = null; return; }
    // 같은 카페 재선택 무시 (마커 클릭은 CafeMap 내부에서 직접 panTo)
    if (prevSelectedRef.current === selectedCafe.id) return;
    prevSelectedRef.current = selectedCafe.id;
    // 지도가 아닌 다른 탭에서 왔을 수 있으므로 약간의 딜레이
    const timer = setTimeout(() => {
      panToRef.current?.(selectedCafe.latitude, selectedCafe.longitude);
    }, 150);
    return () => clearTimeout(timer);
  }, [selectedCafe]);

  // First-visit list button pulse
  useEffect(() => {
    const seen = localStorage.getItem('morning-cafe-list-seen');
    if (!seen) setListSeen(false);
  }, []);

  const handleToggleView = useCallback(() => {
    const next = viewMode === 'map' ? 'list' : 'map';
    trackEvent('toggle_view', { mode: next });
    if (!listSeen) {
      localStorage.setItem('morning-cafe-list-seen', '1');
      setListSeen(true);
    }
    setViewMode(next);
  }, [viewMode, listSeen]);

  // Auto-request GPS on first load so the map can zoom to the user's location.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        trackEvent('gps_result', { status: 'granted' });
        const { latitude: lat, longitude: lng } = pos.coords;
        if (isInServiceArea(lat, lng)) {
          setUserLocation({ lat, lng });
        } else {
          // ponytail: 서비스 지역 밖 → 서울시청 기본 위치 유지, 토스트만 표시
          trackEvent('gps_result', { status: 'out_of_area' });
          setOutOfAreaToast(true);
          setTimeout(() => setOutOfAreaToast(false), 3000);
        }
      },
      () => {
        trackEvent('gps_result', { status: 'denied' });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  // Run once on mount only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLocationUpdate(lat: number, lng: number) {
    if (!isInServiceArea(lat, lng)) {
      setOutOfAreaToast(true);
      setTimeout(() => setOutOfAreaToast(false), 3000);
      return;
    }
    setUserLocation({ lat, lng });
    plainPanToRef.current?.(lat, lng);
  }

  return (
    <div
      className={cn('relative h-full w-full', !isMapRoute && 'invisible absolute inset-0 pointer-events-none')}
      aria-hidden={!isMapRoute}
    >
      {viewMode === 'map' ? (
        <>
          <MapErrorBoundary>
            <CafeMap
              onPanToReady={(fn) => { panToRef.current = fn; }}
              onPlainPanToReady={(fn) => { plainPanToRef.current = fn; }}
              userLocation={userLocation}
              onCenterChange={(lat, lng) => setMapCenter({ lat, lng })}
            />
          </MapErrorBoundary>
          <MyLocationButton onLocation={handleLocationUpdate} />
          <CafeRoulette
            mapCenter={mapCenter}
            onSelectCafe={(cafe) => {
              setSelectedCafe(cafe);
              setTimeout(() => panToRef.current?.(cafe.latitude, cafe.longitude), 100);
            }}
          />
          {/* <AiHubButton /> */}{/* AI 유료 전환 후 복원 */}
          <CafeBottomSheetWrapper />
        </>
      ) : (
        <div className="h-full" style={{ paddingTop: 'calc(7rem + var(--safe-area-top))' }}>
          <CafeListView
            userLocation={userLocation}
            searchQuery={listSearchQuery}
            onSelectCafe={(cafe) => {
              setSelectedCafe(cafe);
              setViewMode('map');
              setTimeout(() => panToRef.current?.(cafe.latitude, cafe.longitude), 100);
            }}
          />
        </div>
      )}

      {isMapRoute && (
        <>
          <SearchBar
            mode={viewMode}
            onSelectCafe={(lat, lng) => {
              if (viewMode === 'list') setViewMode('map');
              setTimeout(() => panToRef.current?.(lat, lng), viewMode === 'list' ? 150 : 0);
            }}
            onQueryChange={setListSearchQuery}
          />
          <TimeFilter onPanToGu={(lat, lng) => {
            if (viewMode === 'list') setViewMode('map');
            setTimeout(() => panToRef.current?.(lat, lng), viewMode === 'list' ? 150 : 0);
          }} />
        </>
      )}

      {/* 뷰 모드 토글 — 현위치 버튼과 같은 수평선, 양끝 */}
      {isMapRoute && (
        <div className="absolute md:bottom-[5.5rem] left-4 z-10" style={{ bottom: 'calc(var(--bottom-nav-height) + 4.5rem)' }}>
          <motion.button
            onClick={handleToggleView}
            whileTap={{ scale: 0.92 }}
            className={cn(
              'relative flex h-12 items-center gap-2 rounded-full px-4',
              'shadow-sm border border-border/60',
              'text-sm font-semibold',
              'transition-all',
              viewMode === 'list'
                ? 'bg-background/60 backdrop-blur-xl text-foreground hover:bg-background/80'
                : 'bg-background/95 backdrop-blur-xl text-foreground hover:bg-foreground/5',
              !listSeen && 'ring-2 ring-foreground/20 ring-offset-2 ring-offset-background animate-pulse',
            )}
          >
            {/* 신규카페 뱃지 — 지도 모드에서만 표시 */}
            {viewMode === 'map' && newCafeCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white shadow-sm">
                {newCafeCount > 9 ? '9+' : newCafeCount}
              </span>
            )}
            {viewMode === 'map' ? (
              <>
                <List className="h-4 w-4" />
                {t('toggle')}
              </>
            ) : (
              <>
                <MapIcon className="h-4 w-4" />
                {t('mapToggle')}
              </>
            )}
          </motion.button>
        </div>
      )}

      {isMapRoute && (
        <div className="absolute md:bottom-2 left-1/2 z-10 -translate-x-1/2" style={{ bottom: 'calc(var(--bottom-nav-height) + 0.5rem)' }}>
          <a
            href="mailto:morningcafeapp@gmail.com"
            className="rounded-full bg-background/60 px-3 py-1 text-[10px] text-muted-foreground/50 backdrop-blur-sm hover:text-muted-foreground transition-colors"
          >
            {tBrand('copyright')}
          </a>
        </div>
      )}

      {/* 오늘의 아침 카페 — 1일 1추천 */}
      {isMapRoute && (
        <MorningPick
          userLocation={userLocation}
          cafesReady={cafesReady}
          onSelectCafe={(cafe) => {
            setSelectedCafe(cafe);
            setTimeout(() => panToRef.current?.(cafe.latitude, cafe.longitude), 100);
          }}
        />
      )}

      {/* 서비스 지역 밖 GPS 토스트 */}
      {outOfAreaToast && (
        <div className="fixed top-20 left-1/2 z-[100] -translate-x-1/2 rounded-2xl bg-foreground/90 px-5 py-3 text-sm font-medium text-background shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
          {tToast('outOfArea')}
        </div>
      )}
    </div>
  );
}
