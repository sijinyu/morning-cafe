'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Map as MapIcon, List } from 'lucide-react';
import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useCafeStore } from '@/lib/store/cafe-store';
import { CafeMap } from '@/components/map/cafe-map';
import { TimeFilter } from '@/components/map/time-filter';
import { MyLocationButton } from '@/components/map/my-location-button';
import { SearchBar } from '@/components/map/search-bar';
import { CafeListView } from '@/components/map/cafe-list-view';
import { cn } from '@/lib/utils';
import { SplashScreen } from '@/components/splash-screen';
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
  const isMapRoute = pathname === '/';

  const { fetchCafes, cafes, setSelectedCafe, userLocation, setUserLocation } = useCafeStore(
    useShallow((state) => ({
      fetchCafes: state.fetchCafes,
      cafes: state.cafes,
      setSelectedCafe: state.setSelectedCafe,
      userLocation: state.userLocation,
      setUserLocation: state.setUserLocation,
    })),
  );
  const panToRef = useRef<((lat: number, lng: number) => void) | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [listSearchQuery, setListSearchQuery] = useState('');
  const deepLinkHandledRef = useRef<string | null>(null);

  useEffect(() => {
    fetchCafes();
  }, [fetchCafes]);

  // Deep link: /?cafeId=xxx → select and pan to the cafe
  useEffect(() => {
    const cafeId = searchParams.get('cafeId');
    if (!cafeId || cafes.length === 0) return;
    if (deepLinkHandledRef.current === cafeId) return;
    const target = cafes.find((c) => c.id === cafeId);
    if (target) {
      deepLinkHandledRef.current = cafeId;
      setSelectedCafe(target);
      // panTo retry: 카카오 SDK 초기화 전에 cafes가 먼저 로드되면
      // panToRef가 아직 null일 수 있으므로 최대 5회 재시도
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

  // Auto-request GPS on first load so the map can zoom to the user's location.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        trackEvent('gps_result', { status: 'granted' });
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
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
    setUserLocation({ lat, lng });
    panToRef.current?.(lat, lng);
  }

  return (
    <div
      className={cn('relative h-full w-full', !isMapRoute && 'invisible absolute inset-0')}
      aria-hidden={!isMapRoute}
    >
      <SplashScreen ready={cafes.length > 0} />
      {viewMode === 'map' ? (
        <>
          <CafeMap
            onPanToReady={(fn) => { panToRef.current = fn; }}
            userLocation={userLocation}
          />
          <MyLocationButton onLocation={handleLocationUpdate} />
          <CafeBottomSheetWrapper />
        </>
      ) : (
        <div className="h-full pt-28">
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

      <SearchBar
        mode={viewMode}
        onSelectCafe={(lat, lng) => {
          if (viewMode === 'list') setViewMode('map');
          setTimeout(() => panToRef.current?.(lat, lng), viewMode === 'list' ? 150 : 0);
        }}
        onQueryChange={setListSearchQuery}
      />
      <TimeFilter />

      {/* 뷰 모드 토글 — 현위치 버튼과 같은 수평선, 양끝 */}
      <div className="absolute md:bottom-6 left-4 z-10" style={{ bottom: 'calc(var(--bottom-nav-height) + 1rem)' }}>
        <motion.button
          onClick={() => { const next = viewMode === 'map' ? 'list' : 'map'; trackEvent('toggle_view', { mode: next }); setViewMode(next); }}
          whileTap={{ scale: 0.92 }}
          className={cn(
            'flex h-12 items-center gap-2 rounded-full px-4',
            'bg-background shadow-lg border border-border',
            'text-sm font-medium text-foreground',
            'transition-colors hover:bg-muted',
          )}
        >
          {viewMode === 'map' ? (
            <>
              <List className="h-4 w-4" />
              리스트
            </>
          ) : (
            <>
              <MapIcon className="h-4 w-4" />
              지도
            </>
          )}
        </motion.button>
      </div>

      <div className="absolute md:bottom-2 left-1/2 z-10 -translate-x-1/2" style={{ bottom: 'calc(var(--bottom-nav-height) + 0.5rem)' }}>
        <a
          href="mailto:sijinyudev@gmail.com"
          className="rounded-full bg-background/60 px-3 py-1 text-[10px] text-muted-foreground/50 backdrop-blur-sm hover:text-muted-foreground transition-colors"
        >
          ⓒ 2026. 유시진 All rights reserved.
        </a>
      </div>
    </div>
  );
}
