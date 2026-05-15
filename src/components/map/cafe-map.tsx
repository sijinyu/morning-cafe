'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Map, MapMarker, MarkerClusterer } from 'react-kakao-maps-sdk';
import useKakaoLoader from '@/lib/hooks/use-kakao-loader';
import { useCafeStore, is24Hours, type Cafe } from '@/lib/store/cafe-store';
import { useFavorites } from '@/lib/hooks/use-favorites';

// Seoul City Hall coordinates — default map center
const SEOUL_CITY_HALL = { lat: 37.5665, lng: 126.978 };

// Color palette — warm cafe tones per opening hour bracket
interface MarkerColors {
  fill: string;       // pin body
  stroke: string;     // dark outline
  cream: string;      // inner circle (cream)
  steam: string;      // steam wisps
  coffee: string;     // coffee liquid
}

function getMarkerColors(cafe: Cafe): MarkerColors {
  // 24시간 카페: 빨간 계열 (배지 색상과 동일)
  if (is24Hours(cafe)) {
    return { fill: '#DC2626', stroke: '#2D3748', cream: '#FFF0F0', steam: '#EF4444', coffee: '#A16207' };
  }

  const openingTime = cafe.opening_time;
  if (!openingTime) return { fill: '#9CA3AF', stroke: '#4B5563', cream: '#FFF8F0', steam: '#D4A574', coffee: '#A16207' };

  const parts = openingTime.split(':');
  const totalMinutes = parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);

  if (totalMinutes < 360) {
    // ~6시: deep warm orange
    return { fill: '#EA580C', stroke: '#2D3748', cream: '#FFF8F0', steam: '#F59E0B', coffee: '#92400E' };
  }
  if (totalMinutes < 420) {
    // 6~7시: warm orange (like the reference image)
    return { fill: '#F28B4E', stroke: '#2D3748', cream: '#FFF8F0', steam: '#F59E0B', coffee: '#A16207' };
  }
  // 7~8시: light warm orange
  return { fill: '#FBBF24', stroke: '#2D3748', cream: '#FFFDF0', steam: '#F59E0B', coffee: '#A16207' };
}

interface CafeMarkerProps {
  cafe: Cafe;
  isSelected: boolean;
  isFavorite: boolean;
  onSelect: (cafe: Cafe) => void;
}

// Clean pin-drop marker — colored pin with white inner dot
function buildMarkerSvg(colors: MarkerColors, selected: boolean, fav: boolean): string {
  const { fill, stroke, cream } = colors;

  if (selected) {
    const w = 44;
    const h = 54;
    const cx = w / 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs>
        <filter id="ds" x="-30%" y="-10%" width="160%" height="140%">
          <feDropShadow dx="1" dy="2" stdDeviation="2.5" flood-color="#000" flood-opacity="0.25"/>
        </filter>
      </defs>
      <path d="M${cx} ${h - 2} C${cx} ${h - 2} ${cx - 17} 30 ${cx - 17} 19 C${cx - 17} 9.5 ${cx - 9.5} 2 ${cx} 2 C${cx + 9.5} 2 ${cx + 17} 9.5 ${cx + 17} 19 C${cx + 17} 30 ${cx} ${h - 2} ${cx} ${h - 2}Z"
        fill="${fill}" stroke="${stroke}" stroke-width="2" filter="url(#ds)"/>
      <ellipse cx="${cx - 4}" cy="11" rx="3.5" ry="5" fill="white" opacity="0.25"/>
      <circle cx="${cx}" cy="19" r="8" fill="${cream}"/>
      ${fav ? `<circle cx="${cx + 13}" cy="6" r="6.5" fill="white" stroke="${stroke}" stroke-width="1"/>
      <path d="M${cx + 13} 9.5 l-0.9-0.8c-2.3-2-3.8-3.4-3.8-5.1 0-1.3 1.1-2.3 2.4-2.3 0.7 0 1.5 0.3 2 0.9 0.4-0.6 1.2-0.9 2-0.9 1.3 0 2.4 1 2.4 2.3 0 1.7-1.5 3.1-3.8 5.1z" fill="#EF4444"/>` : ''}
    </svg>`;
  }

  const w = fav ? 34 : 28;
  const h = fav ? 42 : 36;
  const cx = w / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <defs>
      <filter id="ds" x="-25%" y="-10%" width="150%" height="140%">
        <feDropShadow dx="1" dy="1.5" stdDeviation="1.5" flood-color="#000" flood-opacity="0.18"/>
      </filter>
    </defs>
    <path d="M${cx} ${h - 2} C${cx} ${h - 2} ${cx - 11} ${h - 14} ${cx - 11} ${Math.round(h * 0.39)} C${cx - 11} ${Math.round(h * 0.19)} ${cx - 6} 2 ${cx} 2 C${cx + 6} 2 ${cx + 11} ${Math.round(h * 0.19)} ${cx + 11} ${Math.round(h * 0.39)} C${cx + 11} ${h - 14} ${cx} ${h - 2} ${cx} ${h - 2}Z"
      fill="${fill}" stroke="${stroke}" stroke-width="1.5" filter="url(#ds)"/>
    <ellipse cx="${cx - 2}" cy="${Math.round(h * 0.22)}" rx="2.5" ry="3.5" fill="white" opacity="0.2"/>
    <circle cx="${cx}" cy="${Math.round(h * 0.39)}" r="6" fill="${cream}"/>
    ${fav ? `<circle cx="${cx + 9}" cy="5" r="5.5" fill="white" stroke="${stroke}" stroke-width="0.8"/>
    <path d="M${cx + 9} 8 l-0.7-0.6c-1.8-1.6-3-2.8-3-4.2 0-1.1 0.9-1.9 2-1.9 0.6 0 1.2 0.3 1.6 0.7 0.4-0.4 1-0.7 1.6-0.7 1.1 0 2 0.8 2 1.9 0 1.4-1.2 2.6-3 4.2z" fill="#EF4444"/>` : ''}
  </svg>`;
}

// Cache SVG data URIs to avoid re-encoding on every render
const markerCache: Record<string, string> = {};

function getMarkerDataUri(colors: MarkerColors, selected: boolean, fav: boolean): string {
  const key = `${colors.fill}-${selected}-${fav}`;
  let uri = markerCache[key];
  if (!uri) {
    uri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildMarkerSvg(colors, selected, fav))}`;
    markerCache[key] = uri;
  }
  return uri;
}

function CafeMarker({ cafe, isSelected, isFavorite: fav, onSelect }: CafeMarkerProps) {
  const colors = getMarkerColors(cafe);
  const position = { lat: cafe.latitude, lng: cafe.longitude };

  const w = isSelected ? 44 : (fav ? 34 : 28);
  const h = isSelected ? 54 : (fav ? 42 : 36);
  const offsetY = h - 2; // pin tip is at bottom

  return (
    <MapMarker
      position={position}
      title={cafe.name}
      onClick={() => onSelect(cafe)}
      zIndex={isSelected ? 100 : (fav ? 50 : 0)}
      image={{
        src: getMarkerDataUri(colors, isSelected, fav),
        size: { width: w, height: h },
        options: { offset: { x: w / 2, y: offsetY } },
      }}
    />
  );
}

interface MapCenter {
  lat: number;
  lng: number;
}

interface ViewportBounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
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
  const { favorites } = useFavorites();

  const setSelectedCafe = useCafeStore((state) => state.setSelectedCafe);
  const selectedCafe = useCafeStore((state) => state.selectedCafe);
  const filteredCafes = useCafeStore((state) => state.filteredCafes);

  const [center, setCenter] = useState<MapCenter>(SEOUL_CITY_HALL);
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  const mapInstanceRef = useRef<kakao.maps.Map | null>(null);
  // Guard: only auto-zoom to user location on the very first GPS fix.
  const hasAutoZoomedRef = useRef(false);
  const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateBounds = useCallback((map: kakao.maps.Map) => {
    if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
    boundsTimerRef.current = setTimeout(() => {
      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      setViewportBounds({
        swLat: sw.getLat(),
        swLng: sw.getLng(),
        neLat: ne.getLat(),
        neLng: ne.getLng(),
      });
    }, 250);
  }, []);

  // Filter cafes to only those within the current viewport
  const visibleCafes = useMemo(() => {
    if (!viewportBounds) return filteredCafes;
    const { swLat, swLng, neLat, neLng } = viewportBounds;
    return filteredCafes.filter((cafe) =>
      cafe.latitude >= swLat &&
      cafe.latitude <= neLat &&
      cafe.longitude >= swLng &&
      cafe.longitude <= neLng
    );
  }, [filteredCafes, viewportBounds]);

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
    // 줌 변경 시 bounds 갱신
    kakao.maps.event.addListener(map, 'zoom_changed', () => {
      updateBounds(map);
    });
    // 초기 bounds 설정
    updateBounds(map);
  }

  function handleCenterChange(map: kakao.maps.Map) {
    const latlng = map.getCenter();
    setCenter({ lat: latlng.getLat(), lng: latlng.getLng() });
    updateBounds(map);
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
        {visibleCafes.map((cafe) => (
          <CafeMarker
            key={cafe.id}
            cafe={cafe}
            isSelected={selectedCafe?.id === cafe.id}
            isFavorite={favorites.has(cafe.id)}
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
