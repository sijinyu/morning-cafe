'use client';

import { useEffect, useState } from 'react';
import type { MenuItem, PlaceDetailResponse } from '@/app/api/place-detail/route';

export type { MenuItem };

interface UsePlaceDetailResult {
  photos: string[];
  menu: MenuItem[];
  loading: boolean;
}

const cache = new Map<string, PlaceDetailResponse>();

export function usePlaceDetail(kakaoPlaceId: string | null): UsePlaceDetailResult {
  const [data, setData] = useState<PlaceDetailResponse>({ photos: [], menu: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!kakaoPlaceId) {
      setData({ photos: [], menu: [] });
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
        cache.set(kakaoPlaceId, json);
        setData(json);
      })
      .catch(() => {
        if (!cancelled) setData({ photos: [], menu: [] });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [kakaoPlaceId]);

  return { photos: data.photos, menu: data.menu, loading };
}
