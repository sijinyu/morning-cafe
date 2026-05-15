'use client';

import { useEffect, useState } from 'react';

interface UsePlacePhotosResult {
  photos: string[];
  loading: boolean;
}

const cache = new Map<string, string[]>();

export function usePlacePhotos(kakaoPlaceId: string | null): UsePlacePhotosResult {
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!kakaoPlaceId) {
      setPhotos([]);
      return;
    }

    const cached = cache.get(kakaoPlaceId);
    if (cached) {
      setPhotos(cached);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/place-photos?placeId=${kakaoPlaceId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const result: string[] = data.photos ?? [];
        cache.set(kakaoPlaceId, result);
        setPhotos(result);
      })
      .catch(() => {
        if (!cancelled) setPhotos([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [kakaoPlaceId]);

  return { photos, loading };
}
