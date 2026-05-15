'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Map, MapMarker, MarkerClusterer } from 'react-kakao-maps-sdk';
import useKakaoLoader from '@/lib/hooks/use-kakao-loader';
import { useCafeStore, is24Hours, type Cafe } from '@/lib/store/cafe-store';
import { useFavorites } from '@/lib/hooks/use-favorites';
import { trackEvent } from '@/lib/analytics';

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
    return { fill: '#E8501F', stroke: '#2D3748', cream: '#FFF8F0', steam: '#F59E0B', coffee: '#A16207' };
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

// New marker design with sparkle + coffee mug + squiggle tail
function buildMarkerSvg(colors: MarkerColors, selected: boolean, fav: boolean): string {
  const { fill, stroke, cream, coffee } = colors;

  if (selected) {
    // Selected: larger version (44x54)
    const w = 44;
    const h = 54;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">
      <defs>
        <filter id="ds" x="-30%" y="-20%" width="160%" height="180%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000" flood-opacity="0.2"/>
        </filter>
      </defs>
      <path d="M22 52C22 52 4.7 35.4 4.7 22C4.7 11.6 12.4 3.1 22 3.1C31.6 3.1 39.3 11.6 39.3 22C39.3 35.4 22 52 22 52Z"
        fill="${fill}" stroke="${stroke}" stroke-width="2" filter="url(#ds)"/>
      <ellipse cx="16.3" cy="12" rx="4.4" ry="3" fill="#FFFFFF" opacity="0.28" transform="rotate(-18 16.3 12)"/>
      <path d="M34.7 9.1L35.8 11.5L38.3 12.6L35.8 13.7L34.7 16.1L33.6 13.7L31.1 12.6L33.6 11.5L34.7 9.1Z"
        fill="${cream}" stroke="${stroke}" stroke-width="1.1" stroke-linejoin="round"/>
      <circle cx="22" cy="22" r="10.7" fill="${cream}" stroke="${stroke}" stroke-width="1.4"/>
      <rect x="16.5" y="18.2" width="9.9" height="8.5" rx="1.7" fill="none" stroke="${stroke}" stroke-width="1.3"/>
      <path d="M26.4 20.3C28.3 20.3 29.4 21.2 29.4 22.5C29.4 23.8 28.3 24.7 26.4 24.7" stroke="${stroke}" stroke-width="1.1" stroke-linecap="round"/>
      <rect x="17.8" y="22.1" width="7.1" height="2.8" rx="0.6" fill="${coffee}" opacity="0.9"/>
      <path d="M17.6 39.5C18.9 38.5 19.9 38.5 21 39.5C22 40.4 23 40.4 24.1 39.4" stroke="${stroke}" stroke-width="1.4" stroke-linecap="round" opacity="0.9"/>
      ${fav ? `<circle cx="35" cy="6" r="7" fill="white" stroke="${stroke}" stroke-width="1"/>
      <path d="M35 10 l-1-0.9c-2.5-2.2-4.1-3.7-4.1-5.5 0-1.4 1.2-2.5 2.6-2.5 0.8 0 1.6 0.3 2.2 1 0.5-0.7 1.3-1 2.2-1 1.4 0 2.6 1.1 2.6 2.5 0 1.8-1.6 3.3-4.1 5.5z" fill="#EF4444"/>` : ''}
    </svg>`;
  }

  // Normal marker (28x36) or favorite (34x42)
  const w = fav ? 34 : 28;
  const h = fav ? 42 : 36;
  const s = w / 28; // scale factor

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">
    <defs>
      <filter id="ds" x="-30%" y="-20%" width="160%" height="180%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.8" flood-color="#000" flood-opacity="0.16"/>
      </filter>
    </defs>
    <path d="M${w / 2} ${h - 2}C${w / 2} ${h - 2} ${3 * s} ${(h - 13.5 * s)}  ${3 * s} ${14 * s}C${3 * s} ${7.4 * s} ${7.9 * s} ${2 * s} ${14 * s} ${2 * s}C${20.1 * s} ${2 * s} ${25 * s} ${7.4 * s} ${25 * s} ${14 * s}C${25 * s} ${(h - 13.5 * s)} ${w / 2} ${h - 2} ${w / 2} ${h - 2}Z"
      fill="${fill}" stroke="${stroke}" stroke-width="1.8" filter="url(#ds)"/>
    <ellipse cx="${10.4 * s}" cy="${7.6 * s}" rx="${2.8 * s}" ry="${1.9 * s}" fill="#FFFFFF" opacity="0.28" transform="rotate(-18 ${10.4 * s} ${7.6 * s})"/>
    <path d="M${22.1 * s} ${5.8 * s}L${22.8 * s} ${7.3 * s}L${24.4 * s} ${8 * s}L${22.8 * s} ${8.7 * s}L${22.1 * s} ${10.2 * s}L${21.4 * s} ${8.7 * s}L${19.8 * s} ${8 * s}L${21.4 * s} ${7.3 * s}L${22.1 * s} ${5.8 * s}Z"
      fill="${cream}" stroke="${stroke}" stroke-width="0.9" stroke-linejoin="round"/>
    <circle cx="${14 * s}" cy="${14 * s}" r="${6.8 * s}" fill="${cream}" stroke="${stroke}" stroke-width="1.2"/>
    <rect x="${10.5 * s}" y="${11.6 * s}" width="${6.3 * s}" height="${5.4 * s}" rx="${1.1 * s}" fill="none" stroke="${stroke}" stroke-width="1"/>
    <path d="M${16.8 * s} ${12.9 * s}C${18 * s} ${12.9 * s} ${18.7 * s} ${13.5 * s} ${18.7 * s} ${14.3 * s}C${18.7 * s} ${15.1 * s} ${18 * s} ${15.7 * s} ${16.8 * s} ${15.7 * s}" stroke="${stroke}" stroke-width="0.9" stroke-linecap="round"/>
    <rect x="${11.3 * s}" y="${14.1 * s}" width="${4.5 * s}" height="${1.8 * s}" rx="${0.4 * s}" fill="${coffee}" opacity="0.92"/>
    <path d="M${11.2 * s} ${25.1 * s}C${12 * s} ${24.5 * s} ${12.7 * s} ${24.5 * s} ${13.4 * s} ${25.1 * s}C${14 * s} ${25.7 * s} ${14.7 * s} ${25.7 * s} ${15.4 * s} ${25 * s}" stroke="${stroke}" stroke-width="1.1" stroke-linecap="round" opacity="0.9"/>
    ${fav ? `<circle cx="${w - 8}" cy="5" r="5.5" fill="white" stroke="${stroke}" stroke-width="0.8"/>
    <path d="M${w - 8} 8 l-0.7-0.6c-1.8-1.6-3-2.8-3-4.2 0-1.1 0.9-1.9 2-1.9 0.6 0 1.2 0.3 1.6 0.7 0.4-0.4 1-0.7 1.6-0.7 1.1 0 2 0.8 2 1.9 0 1.4-1.2 2.6-3 4.2z" fill="#EF4444"/>` : ''}
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
      onClick={() => { trackEvent('select_cafe', { cafe_name: cafe.name }); onSelect(cafe); }}
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
        // 검색으로 카페 선택 시 줌인 (레벨 3 = 거리 수준)
        if (map.getLevel() > 3) {
          map.setLevel(3);
        }
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
