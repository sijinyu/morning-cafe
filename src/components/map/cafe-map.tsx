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

function buildPinSvg(color: string, selected: boolean): string {
  if (selected) {
    // Larger pin with bounce shadow + yellow glow
    return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="58" viewBox="0 0 48 58">
      <defs>
        <filter id="s" x="-30%" y="-10%" width="160%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000" flood-opacity="0.25"/>
        </filter>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="1"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0.75"/>
        </linearGradient>
      </defs>
      <ellipse cx="24" cy="54" rx="8" ry="3" fill="#000" opacity="0.15"/>
      <path d="M24 2C14.06 2 6 10.06 6 20c0 12 18 34 18 34s18-22 18-34C42 10.06 33.94 2 24 2z" fill="url(#g)" stroke="#FACC15" stroke-width="2.5" filter="url(#s)"/>
      <circle cx="24" cy="19" r="9" fill="white" opacity="0.95"/>
      <text x="24" y="23.5" text-anchor="middle" font-size="14">☕</text>
    </svg>`;
  }
  // Default pin
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
    <defs>
      <filter id="s" x="-20%" y="-10%" width="140%" height="130%">
        <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.18"/>
      </filter>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="1"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.8"/>
      </linearGradient>
    </defs>
    <ellipse cx="16" cy="39" rx="5" ry="2" fill="#000" opacity="0.1"/>
    <path d="M16 2C9.37 2 4 7.37 4 14c0 8.5 12 24 12 24s12-15.5 12-24C28 7.37 22.63 2 16 2z" fill="url(#g)" stroke="white" stroke-width="1.5" filter="url(#s)"/>
    <circle cx="16" cy="13" r="6.5" fill="white" opacity="0.9"/>
    <text x="16" y="17" text-anchor="middle" font-size="10">☕</text>
  </svg>`;
}

// Cache SVG data URIs to avoid re-encoding on every render
const pinCache: Record<string, string> = {};

function getPinDataUri(color: string, selected: boolean): string {
  const key = `${color}-${selected}`;
  let uri = pinCache[key];
  if (!uri) {
    uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildPinSvg(color, selected))}`;
    pinCache[key] = uri;
  }
  return uri;
}

function CafeMarker({ cafe, isSelected, onSelect }: CafeMarkerProps) {
  const color = getMarkerColor(cafe.opening_time);
  const position = { lat: cafe.latitude, lng: cafe.longitude };

  const w = isSelected ? 48 : 32;
  const h = isSelected ? 58 : 42;

  return (
    <MapMarker
      position={position}
      title={cafe.name}
      onClick={() => onSelect(cafe)}
      zIndex={isSelected ? 100 : 0}
      image={{
        src: getPinDataUri(color, isSelected),
        size: { width: w, height: h },
        options: { offset: { x: w / 2, y: h } },
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
  // Subscribe to cafes directly so the component re-renders when fetchCafes()
  // resolves and populates the store. Without this subscription, filteredCafes()
  // is only invoked once at mount (when cafes is still []) because Zustand sees
  // the stable filteredCafes function reference and skips re-renders.
  useCafeStore((state) => state.cafes);
  const filteredCafes = useCafeStore((state) => state.filteredCafes)();
  // Re-render when filters change
  useCafeStore((state) => state.timeFilter);
  useCafeStore((state) => state.hideChains);
  useCafeStore((state) => state.dayFilter);
  useCafeStore((state) => state.guFilter);
  useCafeStore((state) => state.hide24h);

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
