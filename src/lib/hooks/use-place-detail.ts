'use client';

import { useEffect, useState } from 'react';
import type { MenuItem, PlaceDetailResponse, RatingInfo, ParkingInfo, ReviewItem, BlogReviewItem } from '@/app/api/place-detail/route';

export type { MenuItem, RatingInfo, ParkingInfo, ReviewItem, BlogReviewItem };

interface UsePlaceDetailResult {
  photos: string[];
  photosHd: string[];
  menu: MenuItem[];
  rating: RatingInfo | null;
  parking: ParkingInfo | null;
  facilities: string[];
  strengths: string[];
  reviews: ReviewItem[];
  blogReviews: BlogReviewItem[];
  loading: boolean;
}

const EMPTY: PlaceDetailResponse = {
  photos: [],
  photosHd: [],
  menu: [],
  rating: null,
  parking: null,
  facilities: [],
  strengths: [],
  reviews: [],
  blogReviews: [],
};

const MAX_CACHE_SIZE = 150;
const cache = new Map<string, PlaceDetailResponse>();
/** In-flight fetch promises — prevents duplicate requests for the same placeId */
const inflight = new Map<string, Promise<PlaceDetailResponse>>();

/** Schedule work via requestIdleCallback (fallback: setTimeout 50ms) */
const scheduleIdle: (cb: () => void) => void =
  typeof requestIdleCallback !== 'undefined'
    ? (cb) => requestIdleCallback(cb)
    : (cb) => setTimeout(cb, 50);

/** Preload photos so the browser starts downloading before React renders <img>.
 *  Carousel first 2: <link rel="preload"> high priority.
 *  Carousel remaining: requestIdleCallback + new Image().
 *  HD first 3: requestIdleCallback background prefetch. */
function preloadPhotos(photos: string[], photosHd?: string[]) {
  for (let i = 0; i < photos.length; i++) {
    const url = photos[i];
    if (!url) continue;

    if (i < 2) {
      // High-priority preload for first 2 (visible in carousel viewport)
      if (document.querySelector(`link[rel="preload"][href="${CSS.escape(url)}"]`)) continue;
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      (link as HTMLLinkElement & { fetchPriority: string }).fetchPriority = 'high';
      document.head.appendChild(link);
    } else {
      // Background prefetch for remaining carousel images
      scheduleIdle(() => {
        const img = new globalThis.Image();
        img.src = url;
      });
    }
  }

  // HD first 3: background prefetch for instant lightbox
  if (photosHd) {
    for (let i = 0; i < Math.min(3, photosHd.length); i++) {
      const url = photosHd[i];
      if (!url) continue;
      scheduleIdle(() => {
        const img = new globalThis.Image();
        img.src = url;
      });
    }
  }
}

/** Start image preloading from SW cache in parallel with network fetch.
 *  If the SW has a cached API response, we can begin downloading images immediately
 *  without waiting for the network round-trip. */
function earlyPreloadFromCache(kakaoPlaceId: string) {
  if ('caches' in globalThis) {
    caches.open('place-detail-api').then((c) => {
      c.match(`/api/place-detail?placeId=${kakaoPlaceId}`).then((res) => {
        if (!res) return;
        res.json().then((json: PlaceDetailResponse) => {
          preloadPhotos(json.photos, json.photosHd);
        }).catch(() => {});
      });
    }).catch(() => {});
  }
}

/** Shared fetch — deduplicates concurrent requests for the same placeId.
 *  Returns cached data immediately, or joins an in-flight request, or starts a new one. */
function fetchPlaceDetail(kakaoPlaceId: string): Promise<PlaceDetailResponse> {
  // Already cached
  const cached = cache.get(kakaoPlaceId);
  if (cached) return Promise.resolve(cached);

  // Already in-flight — join existing request
  const existing = inflight.get(kakaoPlaceId);
  if (existing) return existing;

  // Start preloading images from SW cache in parallel
  earlyPreloadFromCache(kakaoPlaceId);

  // New fetch
  const promise = fetch(`/api/place-detail?placeId=${kakaoPlaceId}`)
    .then((r) => r.json())
    .then((json: PlaceDetailResponse) => {
      if (cache.size >= MAX_CACHE_SIZE) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      cache.set(kakaoPlaceId, json);
      preloadPhotos(json.photos, json.photosHd);
      return json;
    })
    .finally(() => {
      inflight.delete(kakaoPlaceId);
    });

  inflight.set(kakaoPlaceId, promise);
  return promise;
}

/** Prefetch place detail into cache (fire-and-forget, for hover/preload).
 *  CDN preconnect is handled by <link rel="preconnect"> in layout.tsx. */
export function prefetchPlaceDetail(kakaoPlaceId: string | null) {
  if (!kakaoPlaceId) return;
  fetchPlaceDetail(kakaoPlaceId).catch(() => {});
}

// ---- CDN keep-alive warmup ------------------------------------------------

let warmedUp = false;

/** 앱 초기화 시 1회 호출 — kakaocdn TCP 커넥션 + place-detail API 콜드스타트를 사전에 해결.
 *  - kakaocdn: 1x1 투명 이미지 요청으로 실제 TCP+TLS 핸드셰이크 완료 (preconnect만으론 유지 안 됨)
 *  - place-detail API: Edge runtime 콜드스타트 워밍업 */
export function warmupConnections(firstCafeKakaoId?: string | null) {
  if (warmedUp) return;
  warmedUp = true;

  // 1. kakaocdn TCP keep-alive — 실제 이미지 요청으로 커넥션 확보
  //    존재하는 작은 이미지 URL로 요청 (q1 = 최저품질, 수백 바이트)
  const cdnWarmUrl = 'https://img1.kakaocdn.net/cthumb/local/C50x50.q1/?fname=https%3A%2F%2Ft1.daumcdn.net%2Fplace%2Flogo%2Fdefault.png';
  const img = new globalThis.Image();
  img.src = cdnWarmUrl;

  // 2. place-detail API 콜드스타트 워밍업 — 첫 번째 카페로 실제 요청
  if (firstCafeKakaoId) {
    scheduleIdle(() => {
      fetchPlaceDetail(firstCafeKakaoId).catch(() => {});
    });
  }
}

export function usePlaceDetail(kakaoPlaceId: string | null): UsePlaceDetailResult {
  const [fetchedData, setFetchedData] = useState<PlaceDetailResponse>(EMPTY);
  const [loading, setLoading] = useState(false);

  // Synchronous cache read — previously loaded cafes show instantly without skeleton flash
  const cached = kakaoPlaceId ? cache.get(kakaoPlaceId) : undefined;

  useEffect(() => {
    if (!kakaoPlaceId) {
      setFetchedData(EMPTY);
      return;
    }

    if (cache.has(kakaoPlaceId)) {
      setFetchedData(cache.get(kakaoPlaceId)!);
      return;
    }

    setFetchedData(EMPTY);
    let cancelled = false;
    setLoading(true);

    // Uses shared fetch — if prefetchPlaceDetail() already started the request,
    // we join the same promise instead of making a duplicate request
    fetchPlaceDetail(kakaoPlaceId)
      .then((json) => {
        if (cancelled) return;
        setFetchedData(json);
      })
      .catch(() => {
        if (!cancelled) setFetchedData(EMPTY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [kakaoPlaceId]);

  const data = cached ?? fetchedData;

  return {
    photos: data.photos,
    photosHd: data.photosHd ?? [],
    menu: data.menu,
    rating: data.rating ?? null,
    parking: data.parking ?? null,
    facilities: data.facilities ?? [],
    strengths: data.strengths ?? [],
    reviews: data.reviews ?? [],
    blogReviews: data.blogReviews ?? [],
    loading: cached ? false : loading,
  };
}
