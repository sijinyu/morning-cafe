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

/** Preload photos so the browser starts downloading before React renders <Image>.
 *  First 2: <link rel="preload"> (high priority, blocks nothing).
 *  Remaining: new Image() (low priority background fetch → browser disk cache). */
function preloadPhotos(photos: string[]) {
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
      // Background prefetch for remaining — lands in browser cache
      const img = new globalThis.Image();
      img.src = url;
    }
  }
}

/** Warm up keep-alive connection to kakaocdn on first call. */
let cdnWarmedUp = false;
function warmUpCdn() {
  if (cdnWarmedUp) return;
  cdnWarmedUp = true;
  // HEAD request establishes TCP+TLS keep-alive without downloading body
  fetch('https://img1.kakaocdn.net/cthumb/local/C280x280.q70/?fname=warmup', {
    method: 'HEAD',
    mode: 'no-cors',
  }).catch(() => {});
}

/** Prefetch place detail into cache (fire-and-forget, for hover/preload). */
export function prefetchPlaceDetail(kakaoPlaceId: string | null) {
  if (!kakaoPlaceId || cache.has(kakaoPlaceId)) return;
  warmUpCdn();
  fetch(`/api/place-detail?placeId=${kakaoPlaceId}`)
    .then((r) => r.json())
    .then((json: PlaceDetailResponse) => {
      if (cache.size >= MAX_CACHE_SIZE) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      cache.set(kakaoPlaceId, json);
      preloadPhotos(json.photos);
    })
    .catch(() => {});
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

    fetch(`/api/place-detail?placeId=${kakaoPlaceId}`)
      .then((r) => r.json())
      .then((json: PlaceDetailResponse) => {
        if (cancelled) return;
        if (cache.size >= MAX_CACHE_SIZE) {
          const oldest = cache.keys().next().value;
          if (oldest !== undefined) cache.delete(oldest);
        }
        cache.set(kakaoPlaceId, json);
        preloadPhotos(json.photos);
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
