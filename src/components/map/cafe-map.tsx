'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Map, MapMarker, MarkerClusterer, CustomOverlayMap } from 'react-kakao-maps-sdk';
import useKakaoLoader from '@/lib/hooks/use-kakao-loader';
import { useShallow } from 'zustand/react/shallow';
import { useCafeStore, getOpeningTimeForDay, type Cafe } from '@/lib/store/cafe-store';
import { is24HoursForDay, SERVICE_BOUNDS, isInServiceArea } from '@/lib/cafe-utils';
import { useFavorites } from '@/lib/hooks/use-favorites';
import { prefetchPlaceDetail, getCachedFirstPhoto } from '@/lib/hooks/use-place-detail';
import { trackEvent } from '@/lib/analytics';
import { isNativeApp } from '@/lib/capacitor';

// Seoul City Hall coordinates — default map center
const SEOUL_CITY_HALL = { lat: 37.5665, lng: 126.978 };

// 위경도 근접 판정 임계값 (약 10m 이내 = 같은 건물)
const OVERLAP_THRESHOLD = 0.0001;

// 서울 + 경기도 경계 (팬 제한용) — SERVICE_BOUNDS와 동일
const SEOUL_BOUNDS = SERVICE_BOUNDS;

// 줌아웃 최대 레벨 — 모바일은 화면이 작아 더 넓게 허용
const IS_MOBILE = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
const MAX_ZOOM_LEVEL = IS_MOBILE ? 8 : 6;

// Color palette — warm cafe tones per opening hour bracket
interface MarkerColors {
  fill: string;       // pin body
  stroke: string;     // dark outline
  cream: string;      // inner circle (cream)
  steam: string;      // steam wisps
  coffee: string;     // coffee liquid
}

// Warm latte-brown palette for franchise/chain cafes
const CHAIN_COLORS: MarkerColors = {
  fill: '#A0845C',    // latte brown
  stroke: '#5C4A2E',  // dark mocha
  cream: '#FFF5E6',   // warm cream
  steam: '#C4A97D',   // light latte
  coffee: '#6B4F2E',  // espresso
};

const DAY_KEYS_MAP = ['일', '월', '화', '수', '목', '금', '토'] as const;

function getMarkerColors(cafe: Cafe, isChain: boolean): MarkerColors {
  // 프랜차이즈: stone 계열 단일 색상
  if (isChain) return CHAIN_COLORS;

  const todayKey = DAY_KEYS_MAP[new Date().getDay()]!;

  // 오늘 요일 기준 24시간 영업 판단
  if (is24HoursForDay(cafe, todayKey)) {
    return { fill: '#9B2C2C', stroke: '#2D3748', cream: '#FFF0F0', steam: '#C53030', coffee: '#742A2A' };
  }

  // 오늘 요일 기준 오픈 시간
  const openingTime = getOpeningTimeForDay(cafe, 'today');
  if (!openingTime) return { fill: '#9CA3AF', stroke: '#4B5563', cream: '#FEF2F1', steam: '#D4A574', coffee: '#7C3A30' };

  const parts = openingTime.split(':');
  const totalMinutes = parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);

  if (totalMinutes < 360) {
    // ~6시: deep coral
    return { fill: '#D04440', stroke: '#2D3748', cream: '#FEF2F1', steam: '#E8554E', coffee: '#7C3A30' };
  }
  if (totalMinutes < 420) {
    // 6~7시: coral (brand primary)
    return { fill: '#E8554E', stroke: '#2D3748', cream: '#FEF2F1', steam: '#F4807A', coffee: '#9B4440' };
  }
  // 7~8시: light coral
  return { fill: '#F4807A', stroke: '#2D3748', cream: '#FFF5F4', steam: '#F9AAA6', coffee: '#9B4440' };
}

interface CafeMarkerProps {
  cafe: Cafe;
  isSelected: boolean;
  isFavorite: boolean;
  isChain: boolean;
  hideIcon: boolean; // 사진 마커가 대신 보이는 경우 SVG 숨김
  onSelect: (cafe: Cafe) => void;
}

// Selected marker stroke color (coral-700 — brand dark coral)
const SELECTED_STROKE = '#B83B36';
const SELECTED_STROKE_WIDTH = 3;

// 원형 마커 — 커피잔 아이콘 (야장맵 스타일)
// 사진이 없는 카페용. 사진이 있으면 CustomOverlayMap에서 원형 사진으로 대체.
function buildMarkerSvg(colors: MarkerColors, selected: boolean, fav: boolean): string {
  const { fill, stroke, cream, coffee } = colors;
  const sz = selected ? 44 : (fav ? 36 : 30);
  const r = sz / 2;
  const borderW = selected ? 3 : 2;
  const borderColor = selected ? SELECTED_STROKE : '#fff';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}" fill="none">
    <defs>
      <filter id="ds" x="-20%" y="-10%" width="140%" height="150%">
        <feDropShadow dx="0" dy="1" stdDeviation="${selected ? 2.5 : 1.5}" flood-color="#000" flood-opacity="${selected ? 0.25 : 0.18}"/>
      </filter>
    </defs>
    <circle cx="${r}" cy="${r}" r="${r - borderW / 2}" fill="${fill}" stroke="${borderColor}" stroke-width="${borderW}" filter="url(#ds)"/>
    <circle cx="${r}" cy="${r}" r="${r * 0.52}" fill="${cream}" stroke="${stroke}" stroke-width="${selected ? 1.2 : 0.9}"/>
    <rect x="${r - r * 0.28}" y="${r - r * 0.16}" width="${r * 0.48}" height="${r * 0.38}" rx="${r * 0.06}" fill="none" stroke="${stroke}" stroke-width="${selected ? 1.1 : 0.8}"/>
    <path d="M${r + r * 0.2} ${r - r * 0.04}C${r + r * 0.32} ${r - r * 0.04} ${r + r * 0.38} ${r + r * 0.04} ${r + r * 0.38} ${r + r * 0.12}C${r + r * 0.38} ${r + r * 0.2} ${r + r * 0.32} ${r + r * 0.28} ${r + r * 0.2} ${r + r * 0.28}" stroke="${stroke}" stroke-width="${selected ? 0.9 : 0.7}" stroke-linecap="round"/>
    <rect x="${r - r * 0.22}" y="${r + r * 0.08}" width="${r * 0.36}" height="${r * 0.14}" rx="${r * 0.03}" fill="${coffee}" opacity="0.9"/>
    ${fav ? `<circle cx="${sz - 7}" cy="5" r="5.5" fill="white" stroke="${stroke}" stroke-width="0.8"/>
    <path d="M${sz - 7 - 2.5} 1.5h5v6l-2.5-1.5-2.5 1.5z" fill="#E8554E" stroke="#D04440" stroke-width="0.5"/>` : ''}
  </svg>`;
}

// Cache marker colors by cafe ID + chain status + today's day.
// ponytail: 날짜가 바뀌면 캐시 무효화 — 요일별 24시간/색상 변경 반영
let colorCacheDay = new Date().getDay();
const colorCache: Record<string, MarkerColors> = {};

function getCachedMarkerColors(cafe: Cafe, isChain: boolean): MarkerColors {
  const today = new Date().getDay();
  if (today !== colorCacheDay) {
    // 날짜 넘어감 → 전체 캐시 무효화
    for (const k of Object.keys(colorCache)) delete colorCache[k];
    colorCacheDay = today;
  }
  const cacheKey = `${cafe.id}-${isChain}`;
  let colors = colorCache[cacheKey];
  if (!colors) {
    colors = getMarkerColors(cafe, isChain);
    colorCache[cacheKey] = colors;
  }
  return colors;
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

// 1x1 투명 PNG — 사진 마커가 대신 보일 때 MapMarker를 숨기되 클러스터 카운트 유지
const TRANSPARENT_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRElEQkSuQmCC';

const CafeMarker = memo(function CafeMarker({ cafe, isSelected, isFavorite: fav, isChain, hideIcon, onSelect }: CafeMarkerProps) {
  const colors = getCachedMarkerColors(cafe, isChain);
  const position = { lat: cafe.latitude, lng: cafe.longitude };

  // 사진 마커가 보이는 경우 SVG 마커 숨김 (1x1 투명, 클러스터는 유지)
  if (hideIcon) {
    return (
      <MapMarker
        position={position}
        title={cafe.name}
        onClick={() => { trackEvent('select_cafe', { cafe_name: cafe.name }); prefetchPlaceDetail(cafe.kakao_place_id); onSelect(cafe); }}
        onMouseOver={() => prefetchPlaceDetail(cafe.kakao_place_id)}
        zIndex={0}
        image={{ src: TRANSPARENT_1PX, size: { width: 1, height: 1 } }}
      />
    );
  }

  // 원형 마커 — 가로세로 동일, 중심 오프셋
  const sz = isSelected ? 44 : (fav ? 36 : 30);

  return (
    <MapMarker
      position={position}
      title={cafe.name}
      onClick={() => { trackEvent('select_cafe', { cafe_name: cafe.name }); prefetchPlaceDetail(cafe.kakao_place_id); onSelect(cafe); }}
      onMouseOver={() => prefetchPlaceDetail(cafe.kakao_place_id)}
      zIndex={isSelected ? 100 : (fav ? 50 : 0)}
      image={{
        src: getMarkerDataUri(colors, isSelected, fav),
        size: { width: sz, height: sz },
        options: { offset: { x: sz / 2, y: sz / 2 } },
      }}
    />
  );
}, (prev, next) =>
  prev.cafe.id === next.cafe.id &&
  prev.isSelected === next.isSelected &&
  prev.isFavorite === next.isFavorite &&
  prev.isChain === next.isChain &&
  prev.hideIcon === next.hideIcon
);

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
  <circle class="ring" cx="20" cy="20" r="10" fill="#E8554E" opacity="0.55"/>
  <!-- white border -->
  <circle cx="20" cy="20" r="9" fill="white"/>
  <!-- coral core -->
  <circle cx="20" cy="20" r="6.5" fill="#E8554E"/>
</svg>`;

export interface CafeMapProps {
  /**
   * Called once the underlying kakao.maps.Map is ready.
   * Receives a panTo helper (with bottom-sheet offset) so the parent
   * can move the map without depending on the kakao types directly.
   */
  onPanToReady?: (panTo: (lat: number, lng: number) => void) => void;
  /** Plain panTo without bottom-sheet offset — for GPS "현위치" button. */
  onPlainPanToReady?: (panTo: (lat: number, lng: number) => void) => void;
  /** Current GPS coordinates of the user. Renders a blue dot marker when set. */
  userLocation?: { lat: number; lng: number } | null;
  /** Called when the map center changes (pan/zoom). */
  onCenterChange?: (lat: number, lng: number) => void;
}

/**
 * 바텀시트/사이드바를 고려하여 마커가 "보이는 지도 영역" 중앙에 오도록
 * 오프셋된 좌표를 반환한다.
 *
 * 모바일: 바텀시트 55vh가 하단을 덮음 → 남쪽 오프셋 (위도 감소)
 * 데스크탑: 사이드바 w-56(224px) 왼쪽 → 동쪽 오프셋 (경도 증가)
 */
/** 줌 레벨 3 이하로 확대 후, 바텀시트/사이드바 보정 panTo */
function panToWithOffset(map: kakao.maps.Map, lat: number, lng: number) {
  // 줌이 축소되어 있으면 먼저 확대 (레벨 2 = 더 가까이)
  if (map.getLevel() > 2) {
    map.setLevel(2);
  }

  // setLevel 후 bounds가 바뀌므로 새 bounds 기준으로 오프셋 계산
  const bounds = map.getBounds();
  const latSpan = bounds.getNorthEast().getLat() - bounds.getSouthWest().getLat();
  const lngSpan = bounds.getNorthEast().getLng() - bounds.getSouthWest().getLng();

  const isMd = typeof window !== 'undefined' && window.innerWidth >= 768;

  if (isMd) {
    // 데스크탑: 사이드바 224px 왼쪽 + 바텀시트 55vh 하단
    const mapWidth = map.getNode().offsetWidth;
    const sidebarPx = 224;
    const lngOffset = (sidebarPx / mapWidth) * lngSpan * 0.5;
    const mapHeight = map.getNode().offsetHeight;
    const sheetPx = window.innerHeight * 0.55;
    const latOffset = (sheetPx / mapHeight) * latSpan * 0.35;
    map.panTo(new kakao.maps.LatLng(lat - latOffset, lng + lngOffset));
  } else {
    // 모바일: 바텀시트 55vh + 네비바 56px
    const mapHeight = map.getNode().offsetHeight;
    const sheetPx = window.innerHeight * 0.55 + 56;
    const latOffset = (sheetPx / mapHeight) * latSpan * 0.35;
    map.panTo(new kakao.maps.LatLng(lat - latOffset, lng));
  }
}

export function CafeMap({ onPanToReady, onPlainPanToReady, userLocation, onCenterChange }: CafeMapProps) {
  const t = useTranslations('map');
  const tCafe = useTranslations('cafe');
  const { loading, error } = useKakaoLoader();
  const { favorites } = useFavorites();

  const { selectedCafe, filteredCafes, chainCafeIds, setSelectedCafe } = useCafeStore(
    useShallow((state) => ({
      selectedCafe: state.selectedCafe,
      filteredCafes: state.filteredCafes,
      chainCafeIds: state.chainCafeIds,
      setSelectedCafe: state.setSelectedCafe,
    })),
  );

  const [center, setCenter] = useState<MapCenter>(SEOUL_CITY_HALL);
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds | null>(null);
  const [zoomLevel, setZoomLevel] = useState(5);
  const [overlapPopup, setOverlapPopup] = useState<{ cafes: Cafe[]; lat: number; lng: number } | null>(null);
  const mapInstanceRef = useRef<kakao.maps.Map | null>(null);
  // Guard: only auto-zoom to user location on the very first GPS fix.
  const hasAutoZoomedRef = useRef(false);
  const boundsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard: prevent feedback loops when we programmatically adjust zoom/center
  const isAdjustingRef = useRef(false);
  // Track center at last valid zoom level (to restore when zoom limit enforced)
  const lastValidCenterRef = useRef<kakao.maps.LatLng | null>(null);

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

  // 뷰포트 내 가까운 카페 place-detail 프리페치
  // 마커 클릭 시 API 응답이 이미 캐시에 있으면 이미지 즉시 로드
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userLoc = useCafeStore((s) => s.userLocation);
  useEffect(() => {
    if (!viewportBounds || zoomLevel > 5) return;

    if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
    prefetchTimerRef.current = setTimeout(() => {
      // 기준점: GPS 있으면 유저 위치, 없으면 뷰포트 중심
      const refLat = userLoc?.lat ?? (viewportBounds.swLat + viewportBounds.neLat) / 2;
      const refLng = userLoc?.lng ?? (viewportBounds.swLng + viewportBounds.neLng) / 2;
      const inView = filteredCafes.filter((c) =>
        c.latitude >= viewportBounds.swLat &&
        c.latitude <= viewportBounds.neLat &&
        c.longitude >= viewportBounds.swLng &&
        c.longitude <= viewportBounds.neLng
      );
      const nearest = inView
        .map((c) => ({ cafe: c, dist: (c.latitude - refLat) ** 2 + (c.longitude - refLng) ** 2 }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 10);
      for (const { cafe } of nearest) {
        prefetchPlaceDetail(cafe.kakao_place_id);
      }
    }, 400);

    return () => {
      if (prefetchTimerRef.current) clearTimeout(prefetchTimerRef.current);
    };
  }, [viewportBounds, zoomLevel, filteredCafes, userLoc]);

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

  // 같은 위치(건물)의 카페 그룹 인덱스
  const overlapIndex = useMemo(() => {
    const index: Record<string, Cafe[]> = {};
    for (const cafe of visibleCafes) {
      // 소수점 4자리까지 반올림 → ~10m 이내 같은 키
      const key = `${cafe.latitude.toFixed(4)},${cafe.longitude.toFixed(4)}`;
      const group = index[key];
      if (group) {
        group.push(cafe);
      } else {
        index[key] = [cafe];
      }
    }
    return index;
  }, [visibleCafes]);

  const handleMarkerSelect = useCallback((cafe: Cafe) => {
    // 네이티브 앱: 미세 햅틱
    if (isNativeApp()) {
      import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => {
        Haptics.impact({ style: ImpactStyle.Light });
      }).catch(() => {});
    }
    // 같은 위치에 카페가 2개 이상이면 목록 팝업
    const key = `${cafe.latitude.toFixed(4)},${cafe.longitude.toFixed(4)}`;
    const group = overlapIndex[key];
    if (group && group.length > 1) {
      setOverlapPopup({ cafes: group, lat: cafe.latitude, lng: cafe.longitude });
      return;
    }
    setOverlapPopup(null);
    setSelectedCafe(cafe);
    // 바텀시트/사이드바를 고려하여 마커가 보이는 영역 중앙에 오도록 panTo
    if (mapInstanceRef.current) {
      panToWithOffset(mapInstanceRef.current, cafe.latitude, cafe.longitude);
    }
  }, [overlapIndex, setSelectedCafe]);

  // Auto-zoom to user location the first time a valid position arrives.
  useEffect(() => {
    if (!userLocation || hasAutoZoomedRef.current) return;
    // ponytail: 서비스 지역 밖 좌표는 무시 — persistent-map-page에서 이미 필터링하지만 방어 코드
    if (!isInServiceArea(userLocation.lat, userLocation.lng)) return;
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
        panToWithOffset(map, lat, lng);
      });
    }
    if (onPlainPanToReady) {
      onPlainPanToReady((lat, lng) => {
        map.setLevel(4);
        map.panTo(new kakao.maps.LatLng(lat, lng));
      });
    }
    // 지도 클릭 시 바텀시트 + 겹침 팝업 닫기
    kakao.maps.event.addListener(map, 'click', () => {
      setSelectedCafe(null);
      setOverlapPopup(null);
    });

    // ── 줌아웃 차단: MAX_ZOOM_LEVEL에서 줌아웃 제스처 자체를 막음 ──

    const container = map.getNode();

    // 1) 마우스 휠: zoom-out 방향(deltaY > 0)만 차단
    container.addEventListener('wheel', (e: WheelEvent) => {
      if (e.deltaY > 0 && map.getLevel() >= MAX_ZOOM_LEVEL) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, { passive: false });

    // 2) 모바일 핀치: MAX_ZOOM_LEVEL 도달 시 zoomable 끄고,
    //    zoom-in 핀치(손가락 벌림) 감지 시 다시 켬
    let initialPinchDist = 0;

    container.addEventListener('touchstart', (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDist = Math.hypot(dx, dy);

        // MAX 레벨이면 일단 줌 비활성화 (줌아웃 차단)
        if (map.getLevel() >= MAX_ZOOM_LEVEL) {
          map.setZoomable(false);
        }
      }
    }, { passive: true });

    container.addEventListener('touchmove', (e: TouchEvent) => {
      if (e.touches.length === 2 && initialPinchDist > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDist = Math.hypot(dx, dy);

        // 손가락이 벌어짐 = zoom-in → zoomable 다시 활성화
        if (currentDist > initialPinchDist + 10) {
          map.setZoomable(true);
        }
      }
    }, { passive: true });

    container.addEventListener('touchend', () => {
      // 핀치 종료 시 항상 zoomable 복원
      map.setZoomable(true);
      initialPinchDist = 0;
    }, { passive: true });

    // 줌 변경 시 bounds 갱신 + 줌 레벨 추적
    kakao.maps.event.addListener(map, 'zoom_changed', () => {
      if (isAdjustingRef.current) return;
      const level = map.getLevel();
      setZoomLevel(level);
      if (level > MAX_ZOOM_LEVEL) {
        isAdjustingRef.current = true;
        map.setLevel(MAX_ZOOM_LEVEL);
        if (lastValidCenterRef.current) {
          map.setCenter(lastValidCenterRef.current);
        }
        queueMicrotask(() => { isAdjustingRef.current = false; });
      } else {
        lastValidCenterRef.current = map.getCenter();
      }
      updateBounds(map);
    });
    // 초기 bounds 설정
    updateBounds(map);
  }

  function handleCenterChange(map: kakao.maps.Map) {
    // 프로그래매틱 조정 중이면 무시 (피드백 루프 방지)
    if (isAdjustingRef.current) return;

    const latlng = map.getCenter();
    let lat = latlng.getLat();
    let lng = latlng.getLng();

    // 서울 경계 밖으로 나가면 클램핑
    const clampedLat = Math.max(SEOUL_BOUNDS.swLat, Math.min(SEOUL_BOUNDS.neLat, lat));
    const clampedLng = Math.max(SEOUL_BOUNDS.swLng, Math.min(SEOUL_BOUNDS.neLng, lng));

    if (clampedLat !== lat || clampedLng !== lng) {
      isAdjustingRef.current = true;
      map.setCenter(new kakao.maps.LatLng(clampedLat, clampedLng));
      lat = clampedLat;
      lng = clampedLng;
      queueMicrotask(() => { isAdjustingRef.current = false; });
    }

    setCenter({ lat, lng });
    updateBounds(map);
    onCenterChange?.(lat, lng);
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
        <p className="text-sm font-medium text-destructive">{t('loadError')}</p>
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
        minLevel={4}
        gridSize={80}
        styles={[
          { width: '52px', height: '52px', background: 'rgba(232,85,78,0.75)', borderRadius: '50%', color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: '13px', lineHeight: '52px' },
          { width: '56px', height: '56px', background: 'rgba(208,68,64,0.8)', borderRadius: '50%', color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: '14px', lineHeight: '56px' },
          { width: '66px', height: '66px', background: 'rgba(184,59,54,0.85)', borderRadius: '50%', color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: '15px', lineHeight: '66px' },
        ]}
      >
        {visibleCafes.map((cafe) => {
          const isChain = chainCafeIds.has(cafe.id);
          // DB thumbnail_url 우선, 없으면 place-detail 캐시 fallback
          const photo = isChain ? null : (cafe.thumbnail_url || getCachedFirstPhoto(cafe.kakao_place_id));
          // 줌 ≤ 3 + 개인카페 + 사진 있음 → 사진 마커가 대신 표시되므로 SVG 숨김
          const hideIcon = zoomLevel <= 3 && !!photo;
          return (
            <CafeMarker
              key={cafe.id}
              cafe={cafe}
              isSelected={selectedCafe?.id === cafe.id}
              isFavorite={favorites.has(cafe.id)}
              isChain={isChain}
              hideIcon={hideIcon}
              onSelect={handleMarkerSelect}
            />
          );
        })}
      </MarkerClusterer>

      {/* SVG 핀 마커용 ripple — 사진 마커 내부 ripple이 없는 경우에만 표시 */}
      {selectedCafe && (() => {
        const isChainCafe = chainCafeIds.has(selectedCafe.id);
        const hasPhoto = !isChainCafe && !!(selectedCafe.thumbnail_url || getCachedFirstPhoto(selectedCafe.kakao_place_id));
        // 사진 마커가 보이는 상황(zoom ≤ 3 + photo)이면 사진 내부 ripple이 담당 → 여기서는 스킵
        if (zoomLevel <= 3 && hasPhoto) return null;
        const colors = getCachedMarkerColors(selectedCafe, isChainCafe);
        return (
          <CustomOverlayMap
            key={`ripple-${selectedCafe.id}`}
            position={{ lat: selectedCafe.latitude, lng: selectedCafe.longitude }}
            yAnchor={0.5}
            xAnchor={0.5}
            zIndex={0}
          >
            <svg
              width="200"
              height="200"
              viewBox="0 0 200 200"
              style={{ pointerEvents: 'none' }}
            >
              <style>{`
                @keyframes cafe-ripple-svg {
                  0% { r: 22; opacity: 0.45; stroke-width: 2.5; }
                  100% { r: 80; opacity: 0; stroke-width: 0.5; }
                }
                .ripple-svg { fill: none; stroke: ${colors.fill}; animation: cafe-ripple-svg 2.5s ease-out infinite; }
              `}</style>
              <circle className="ripple-svg" cx="100" cy="100" r="22" style={{ animationDelay: '0ms' }} />
              <circle className="ripple-svg" cx="100" cy="100" r="22" style={{ animationDelay: '800ms' }} />
              <circle className="ripple-svg" cx="100" cy="100" r="22" style={{ animationDelay: '1600ms' }} />
            </svg>
          </CustomOverlayMap>
        );
      })()}

      {/* 충분히 확대 시: 개인카페 + 사진 → 원형 사진 마커, 체인은 SVG 마커 유지 */}
      {zoomLevel <= 3 && visibleCafes.map((cafe) => {
        const isChain = chainCafeIds.has(cafe.id);
        const photo = isChain ? null : (cafe.thumbnail_url || getCachedFirstPhoto(cafe.kakao_place_id));
        const isSelected = selectedCafe?.id === cafe.id;
        const size = isSelected ? 52 : 42;

        if (photo) {
          const isFav = favorites.has(cafe.id);
          return (
            <CustomOverlayMap
              key={`photo-${cafe.id}`}
              position={{ lat: cafe.latitude, lng: cafe.longitude }}
              xAnchor={0.5}
              yAnchor={0.35}
              zIndex={isSelected ? 99 : 2}
            >
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  trackEvent('select_cafe', { cafe_name: cafe.name, source: 'photo_marker' });
                  handleMarkerSelect(cafe);
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '2px',
                  cursor: 'pointer',
                }}
              >
                {/* 사진 원형 + 파동 + 찜 배지 relative 컨테이너 */}
                <div style={{ position: 'relative', display: 'inline-flex' }}>
                  {/* 파동 — 사진과 동일 중심, 사진 둘레에서 시작 → 3.5배 확장 */}
                  {isSelected && (() => {
                    const markerColors = getCachedMarkerColors(cafe, false);
                    return (
                      <svg
                        width="200" height="200" viewBox="0 0 200 200"
                        style={{
                          position: 'absolute',
                          top: '50%', left: '50%',
                          transform: 'translate(-50%, -50%)',
                          pointerEvents: 'none',
                        }}
                      >
                        <style>{`
                          @keyframes cafe-ripple-photo {
                            0% { r: 26; opacity: 0.45; stroke-width: 2.5; }
                            100% { r: 90; opacity: 0; stroke-width: 0.5; }
                          }
                          .ripple-photo { fill: none; stroke: ${markerColors.fill}; animation: cafe-ripple-photo 2.5s ease-out infinite; }
                        `}</style>
                        <circle className="ripple-photo" cx="100" cy="100" r="26" style={{ animationDelay: '0ms' }} />
                        <circle className="ripple-photo" cx="100" cy="100" r="26" style={{ animationDelay: '800ms' }} />
                        <circle className="ripple-photo" cx="100" cy="100" r="26" style={{ animationDelay: '1600ms' }} />
                      </svg>
                    );
                  })()}
                  {/* 사진 원형 */}
                  <div
                    style={{
                      width: `${size}px`,
                      height: `${size}px`,
                      borderRadius: '50%',
                      border: isSelected ? '3px solid #B83B36' : '2.5px solid #fff',
                      boxShadow: isSelected
                        ? '0 2px 8px rgba(184,59,54,0.4)'
                        : '0 2px 6px rgba(0,0,0,0.2)',
                      overflow: 'hidden',
                      background: '#f5f5f4',
                      transition: 'transform 0.15s ease',
                      transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                    }}
                  >
                    <img
                      src={photo}
                      alt={cafe.name}
                      width={size}
                      height={size}
                      loading="lazy"
                      decoding="async"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  </div>
                  {/* 찜 배지 */}
                  {isFav && (
                    <div style={{
                      position: 'absolute', top: -2, right: -2, zIndex: 1,
                      width: 18, height: 18, borderRadius: '50%',
                      background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}>
                      <svg width="10" height="12" viewBox="0 0 10 12">
                        <path d="M1 0h8v11L5 8.5 1 11z" fill="#E8554E" stroke="#D04440" strokeWidth="0.5"/>
                      </svg>
                    </div>
                  )}
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#1f2937',
                    backgroundColor: 'rgba(255,255,255,0.92)',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    pointerEvents: 'none',
                    maxWidth: '100px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {cafe.name}
                </span>
              </div>
            </CustomOverlayMap>
          );
        }

        // 사진 없는 카페: 이름 라벨만
        return (
          <CustomOverlayMap
            key={`label-${cafe.id}`}
            position={{ lat: cafe.latitude, lng: cafe.longitude }}
            yAnchor={-0.2}
            zIndex={isSelected ? 99 : 1}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: '#1f2937',
                backgroundColor: 'rgba(255,255,255,0.92)',
                padding: '1px 5px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                pointerEvents: 'none',
              }}
            >
              {cafe.name}
            </span>
          </CustomOverlayMap>
        );
      })}

      {/* 겹친 카페 목록 팝업 */}
      {overlapPopup && (
        <CustomOverlayMap
          position={{ lat: overlapPopup.lat, lng: overlapPopup.lng }}
          yAnchor={1.15}
          zIndex={300}
        >
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
          <div
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            style={{
              background: 'var(--background, #fff)',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
              padding: '8px 0',
              minWidth: '180px',
              maxWidth: '240px',
              maxHeight: '200px',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              border: '1px solid var(--border, #e5e7eb)',
              position: 'relative',
              zIndex: 9999,
            }}
          >
            <div style={{ padding: '4px 12px 6px', fontSize: '11px', fontWeight: 600, color: 'var(--muted-foreground, #6b7280)' }}>
              {t('cafesAtLocation', { count: overlapPopup.cafes.length })}
            </div>
            {overlapPopup.cafes.map((cafe) => (
              <button
                key={cafe.id}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  trackEvent('select_cafe', { cafe_name: cafe.name, source: 'overlap_popup' });
                  setOverlapPopup(null);
                  setSelectedCafe(cafe);
                  if (mapInstanceRef.current) panToWithOffset(mapInstanceRef.current, cafe.latitude, cafe.longitude);
                }}
                onMouseOver={() => prefetchPlaceDetail(cafe.kakao_place_id)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 12px',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--foreground, #1f2937)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderTop: '1px solid var(--border, #f3f4f6)',
                  WebkitTapHighlightColor: 'rgba(0,0,0,0.05)',
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--muted, #f9fafb)'; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}
              >
                {cafe.name}
              </button>
            ))}
          </div>
        </CustomOverlayMap>
      )}

      {/* "You are here" blue pulsing dot — rendered above cafe markers */}
      {userLocation && (
        <MapMarker
          position={{ lat: userLocation.lat, lng: userLocation.lng }}
          title={tCafe('currentLocation')}
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
