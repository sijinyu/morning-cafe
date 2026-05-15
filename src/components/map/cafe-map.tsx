'use client';

import { useEffect, useRef, useState } from 'react';
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
  isSelected: boolean;
  onSelect: (cafe: Cafe) => void;
}

function CafeMarker({ cafe, isSelected, onSelect }: CafeMarkerProps) {
  const color = getMarkerColor(cafe.opening_time);
  const position = { lat: cafe.latitude, lng: cafe.longitude };
  const size = isSelected ? 44 : 32;
  const r = isSelected ? 18 : 12;
  const cx = size / 2;
  const strokeW = isSelected ? 3 : 2;
  const strokeColor = isSelected ? '#FACC15' : 'white'; // yellow ring when selected
  const fontSize = isSelected ? 17 : 13;

  return (
    <MapMarker
      position={position}
      title={cafe.name}
      onClick={() => onSelect(cafe)}
      zIndex={isSelected ? 100 : 0}
      image={{
        src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            ${isSelected ? `<circle cx="${cx}" cy="${cx}" r="${r + 3}" fill="${strokeColor}" opacity="0.3"/>` : ''}
            <circle cx="${cx}" cy="${cx}" r="${r}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeW}"/>
            <text x="${cx}" y="${cx + 4}" text-anchor="middle" font-size="${fontSize}" fill="white">☕</text>
          </svg>`
        )}`,
        size: { width: size, height: size },
        options: { offset: { x: cx, y: cx } },
      }}
    />
  );
}

interface MapCenter {
  lat: number;
  lng: number;
}

// SVG source for the blue "you are here" dot.
// The pulsing ring is rendered as a second circle and animated via CSS
// injected into a <style> tag inside the SVG itself so it works even
// when the image is used as a Kakao MapMarker data-URI.
const USER_DOT_SIZE = 40;
const USER_DOT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${USER_DOT_SIZE}" height="${USER_DOT_SIZE}" viewBox="0 0 ${USER_DOT_SIZE} ${USER_DOT_SIZE}">
  <style>
    @keyframes pulse {
      0%   { r: 10; opacity: 0.55; }
      70%  { r: 18; opacity: 0; }
      100% { r: 18; opacity: 0; }
    }
    .ring { animation: pulse 1.8s ease-out infinite; }
  </style>
  <!-- pulsing ring -->
  <circle class="ring" cx="20" cy="20" r="10" fill="#3B82F6" opacity="0.55"/>
  <!-- white border -->
  <circle cx="20" cy="20" r="9" fill="white"/>
  <!-- blue core -->
  <circle cx="20" cy="20" r="6.5" fill="#3B82F6"/>
</svg>`;

export interface CafeMapProps {
  /**
   * Called once the underlying kakao.maps.Map is ready.
   * Receives a panTo helper so the parent can move the map
   * without depending on the kakao types directly.
   */
  onPanToReady?: (panTo: (lat: number, lng: number) => void) => void;
  /** Current GPS coordinates of the user. Renders a blue dot marker when set. */
  userLocation?: { lat: number; lng: number } | null;
}

export function CafeMap({ onPanToReady, userLocation }: CafeMapProps) {
  const { loading, error } = useKakaoLoader();

  const setSelectedCafe = useCafeStore((state) => state.setSelectedCafe);
  const selectedCafe = useCafeStore((state) => state.selectedCafe);
  const filteredCafes = useCafeStore((state) => state.filteredCafes)();
  // Re-render when filters change
  useCafeStore((state) => state.timeFilter);
  useCafeStore((state) => state.hideChains);
  useCafeStore((state) => state.dayFilter);
  useCafeStore((state) => state.guFilter);

  const [center, setCenter] = useState<MapCenter>(SEOUL_CITY_HALL);
  const mapInstanceRef = useRef<kakao.maps.Map | null>(null);
  // Guard: only auto-zoom to user location on the very first GPS fix.
  const hasAutoZoomedRef = useRef(false);

  // Auto-zoom to user location the first time a valid position arrives.
  useEffect(() => {
    if (!userLocation || hasAutoZoomedRef.current) return;
    hasAutoZoomedRef.current = true;

    if (mapInstanceRef.current) {
      const latlng = new kakao.maps.LatLng(userLocation.lat, userLocation.lng);
      mapInstanceRef.current.setLevel(4);
      mapInstanceRef.current.panTo(latlng);
    } else {
      // Map not mounted yet — pre-set the center so it opens at the right spot.
      setCenter({ lat: userLocation.lat, lng: userLocation.lng });
    }
  }, [userLocation]);

  function handleCreate(map: kakao.maps.Map) {
    mapInstanceRef.current = map;
    if (onPanToReady) {
      onPanToReady((lat, lng) => {
        const latlng = new kakao.maps.LatLng(lat, lng);
        map.panTo(latlng);
      });
    }
    // 지도 클릭 시 바텀시트 닫기
    kakao.maps.event.addListener(map, 'click', () => {
      setSelectedCafe(null);
    });
  }

  function handleCenterChange(map: kakao.maps.Map) {
    const latlng = map.getCenter();
    setCenter({ lat: latlng.getLat(), lng: latlng.getLng() });
  }

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/30">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/30 px-4 text-center">
        <p className="text-sm font-medium text-destructive">지도를 불러올 수 없습니다</p>
        <p className="text-xs text-muted-foreground">{String(error)}</p>
      </div>
    );
  }

  return (
    <Map
      center={center}
      level={5}
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
            isSelected={selectedCafe?.id === cafe.id}
            onSelect={setSelectedCafe}
          />
        ))}
      </MarkerClusterer>

      {/* "You are here" blue pulsing dot — rendered above cafe markers */}
      {userLocation && (
        <MapMarker
          position={{ lat: userLocation.lat, lng: userLocation.lng }}
          title="현재 위치"
          zIndex={200}
          image={{
            src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(USER_DOT_SVG)}`,
            size: { width: USER_DOT_SIZE, height: USER_DOT_SIZE },
            options: { offset: { x: USER_DOT_SIZE / 2, y: USER_DOT_SIZE / 2 } },
          }}
        />
      )}
    </Map>
  );
}
