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

const MAX_CACHE_SIZE = 50;
const cache = new Map<string, PlaceDetailResponse>();

export function usePlaceDetail(kakaoPlaceId: string | null): UsePlaceDetailResult {
  const [data, setData] = useState<PlaceDetailResponse>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!kakaoPlaceId) {
      setData(EMPTY);
      return;
    }

    const cached = cache.get(kakaoPlaceId);
    if (cached) {
      setData(cached);
      return;
    }

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
        setData(json);
      })
      .catch(() => {
        if (!cancelled) setData(EMPTY);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [kakaoPlaceId]);

  return {
    photos: data.photos,
    photosHd: data.photosHd ?? [],
    menu: data.menu,
    rating: data.rating ?? null,
    parking: data.parking ?? null,
    facilities: data.facilities ?? [],
    strengths: data.strengths ?? [],
    loading,
  };
}
