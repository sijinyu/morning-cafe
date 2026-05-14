'use client';

import { useRef, useState } from 'react';
import { Map, MapMarker, MarkerClusterer } from 'react-kakao-maps-sdk';
import useKakaoLoader from '@/lib/hooks/use-kakao-loader';
import { useCafeStore, type Cafe } from '@/lib/store/cafe-store';

// Seoul City Hall coordinates — default map center
const SEOUL_CITY_HALL = { lat: 37.5665, lng: 126.978 };

function getMarkerColor(openingTime: string | null): string {
  if (!openingTime) return '#6B7280'; // gray — unknown

  const parts = openingTime.split(':');
  const hours = parseInt(parts[0] ?? '0', 10);
  const minutes = parseInt(parts[1] ?? '0', 10);
  const totalMinutes = hours * 60 + minutes;

  if (totalMinutes < 360) return '#EF4444';   // red   — before 06:00
  if (totalMinutes < 420) return '#F59E0B';   // amber — 06:xx
  return '#10B981';                            // green — 07:xx
}

interface CafeMarkerProps {
  cafe: Cafe;
  onSelect: (cafe: Cafe) => void;
}

function CafeMarker({ cafe, onSelect }: CafeMarkerProps) {
  const color = getMarkerColor(cafe.opening_time);
  const position = { lat: cafe.latitude, lng: cafe.longitude };

  return (
    <MapMarker
      position={position}
      title={cafe.name}
      onClick={() => onSelect(cafe)}
      image={{
        // Inline SVG data URI — colored circle with coffee emoji
        src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="12" fill="${color}" stroke="white" stroke-width="2"/>
            <text x="16" y="20" text-anchor="middle" font-size="13" fill="white">☕</text>
          </svg>`
        )}`,
        size: { width: 32, height: 32 },
        options: { offset: { x: 16, y: 16 } },
      }}
    />
  );
}

interface MapCenter {
  lat: number;
  lng: number;
}

export interface CafeMapProps {
  /**
   * Called once the underlying kakao.maps.Map is ready.
   * Receives a panTo helper so the parent can move the map
   * without depending on the kakao types directly.
   */
  onPanToReady?: (panTo: (lat: number, lng: number) => void) => void;
}

export function CafeMap({ onPanToReady }: CafeMapProps) {
  useKakaoLoader();

  const filteredCafes = useCafeStore((state) => state.filteredCafes());
  const setSelectedCafe = useCafeStore((state) => state.setSelectedCafe);

  const [center, setCenter] = useState<MapCenter>(SEOUL_CITY_HALL);
  const mapInstanceRef = useRef<kakao.maps.Map | null>(null);

  function handleCreate(map: kakao.maps.Map) {
    mapInstanceRef.current = map;
    if (onPanToReady) {
      onPanToReady((lat, lng) => {
        // LatLng constructor is available once the SDK is loaded.
        const latlng = new kakao.maps.LatLng(lat, lng);
        map.panTo(latlng);
      });
    }
  }

  function handleCenterChange(map: kakao.maps.Map) {
    const latlng = map.getCenter();
    setCenter({ lat: latlng.getLat(), lng: latlng.getLng() });
  }

  return (
    <Map
      center={center}
      level={8}
      className="h-full w-full"
      onCreate={handleCreate}
      onCenterChanged={handleCenterChange}
    >
      <MarkerClusterer
        averageCenter
        minLevel={6}
        gridSize={80}
      >
        {filteredCafes.map((cafe) => (
          <CafeMarker
            key={cafe.id}
            cafe={cafe}
            onSelect={setSelectedCafe}
          />
        ))}
      </MarkerClusterer>
    </Map>
  );
}
