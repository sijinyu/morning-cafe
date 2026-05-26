'use client';

import { useEffect, useState } from 'react';
import type { MenuItem, PlaceDetailResponse, RatingInfo, ParkingInfo } from '@/app/api/place-detail/route';

export type { MenuItem, RatingInfo, ParkingInfo };

interface UsePlaceDetailResult {
  photos: string[];
  photosHd: string[];
  menu: MenuItem[];
  rating: RatingInfo | null;
  parking: ParkingInfo | null;
  facilities: string[];
  strengths: string[];
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
};

const MAX_CACHE_SIZE = 150;
const cache = new Map<string, PlaceDetailResponse>();

/** Preload the first 2 photos so the browser starts downloading before React renders <Image>. */
function preloadPhotos(photos: string[]) {
  const urls = photos.slice(0, 2);
  for (const url of urls) {
    if (!url) continue;
    // Avoid duplicate preload links
    if (document.querySelector(`link[rel="preload"][href="${CSS.escape(url)}"]`)) continue;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    (link as HTMLLinkElement & { fetchPriority: string }).fetchPriority = 'high';
    document.head.appendChild(link);
  }
}

/** Prefetch place detail into cache (fire-and-forget, for hover/preload). */
export function prefetchPlaceDetail(kakaoPlaceId: string | null) {
  if (!kakaoPlaceId || cache.has(kakaoPlaceId)) return;
  fetch(`/api/place-detail?placeId=${kakaoPlaceId}`)
    .then((r) => r.json())
    .then((json: PlaceDetailResponse) => {
      if (cache.size >= MAX_CACHE_SIZE) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      cache.set(kakaoPlaceId, json);
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
    loading: cached ? false : loading,
  };
}
