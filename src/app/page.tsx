'use client';

import { useEffect, useRef } from 'react';
import { useCafeStore } from '@/lib/store/cafe-store';
import { CafeMap } from '@/components/map/cafe-map';
import { TimeFilter } from '@/components/map/time-filter';
import { MyLocationButton } from '@/components/map/my-location-button';
import { CafeBottomSheetWrapper } from '@/components/map/cafe-bottom-sheet';
import { SearchBar } from '@/components/map/search-bar';

export default function MapPage() {
  const fetchCafes = useCafeStore((state) => state.fetchCafes);
  // panToRef holds the panTo helper exposed by CafeMap so MyLocationButton
  // and SearchBar can move the map without needing a direct kakao.maps.Map
  // reference here.
  const panToRef = useRef<((lat: number, lng: number) => void) | null>(null);

  useEffect(() => {
    fetchCafes();
  }, [fetchCafes]);

  return (
    <div className="relative h-full w-full">
      <CafeMap onPanToReady={(fn) => { panToRef.current = fn; }} />
      <TimeFilter />
      <SearchBar onSelectCafe={(lat, lng) => panToRef.current?.(lat, lng)} />
      <MyLocationButton onLocation={(lat, lng) => panToRef.current?.(lat, lng)} />
      <CafeBottomSheetWrapper />
    </div>
  );
}
