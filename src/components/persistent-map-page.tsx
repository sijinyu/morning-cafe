'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Map as MapIcon, List } from 'lucide-react';
import { motion } from 'framer-motion';
import { useCafeStore } from '@/lib/store/cafe-store';
import { CafeMap } from '@/components/map/cafe-map';
import { TimeFilter } from '@/components/map/time-filter';
import { MyLocationButton } from '@/components/map/my-location-button';
import { SearchBar } from '@/components/map/search-bar';
import { CafeListView } from '@/components/map/cafe-list-view';
import { cn } from '@/lib/utils';
import { SplashScreen } from '@/components/splash-screen';
import dynamic from 'next/dynamic';

const CafeBottomSheetWrapper = dynamic(
  () => import('@/components/map/cafe-bottom-sheet').then((mod) => mod.CafeBottomSheetWrapper),
  { ssr: false },
);

type ViewMode = 'map' | 'list';

export function PersistentMapPage() {
  const pathname = usePathname();
  const isMapRoute = pathname === '/';

  const fetchCafes = useCafeStore((state) => state.fetchCafes);
  const cafes = useCafeStore((state) => state.cafes);
  const setSelectedCafe = useCafeStore((state) => state.setSelectedCafe);
  const panToRef = useRef<((lat: number, lng: number) => void) | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [listSearchQuery, setListSearchQuery] = useState('');

  useEffect(() => {
    fetchCafes();
  }, [fetchCafes]);

  // Auto-request GPS on first load so the map can zoom to the user's location.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        // Permission denied or unavailable — map stays at Seoul City Hall fallback.
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  // Run once on mount only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep GPS fresh when switching to list view if we don't have a fix yet.
  useEffect(() => {
    if (viewMode === 'list' && !userLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
      );
    }
  }, [viewMode, userLocation]);

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
      <div className="absolute bottom-18 md:bottom-6 left-4 z-10">
        <motion.button
          onClick={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
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

      <div className="absolute bottom-16 md:bottom-2 left-1/2 z-10 -translate-x-1/2">
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
