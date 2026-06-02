'use client';

import { useSyncExternalStore, useCallback } from 'react';
import { trackEvent } from '@/lib/analytics';
import { isNativeApp } from '@/lib/capacitor';
import {
  scheduleNativeNotification,
  cancelNativeNotification,
} from '@/lib/native-notifications';

const STORAGE_KEY = 'morning-cafe-favorites';

function getSnapshot(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

const EMPTY_SET: Set<string> = new Set();

function getServerSnapshot(): Set<string> {
  return EMPTY_SET;
}

let cachedSet: Set<string> | null = null;

function subscribe(callback: () => void): () => void {
  function handleStorage(e: StorageEvent) {
    if (e.key === STORAGE_KEY) {
      cachedSet = null;
      callback();
    }
  }

  function handleCustom() {
    cachedSet = null;
    callback();
  }

  window.addEventListener('storage', handleStorage);
  window.addEventListener('favorites-changed', handleCustom);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('favorites-changed', handleCustom);
  };
}

function getStableSnapshot(): Set<string> {
  if (!cachedSet) {
    cachedSet = getSnapshot();
  }
  return cachedSet;
}

function toggle(cafeId: string): boolean {
  const current = getSnapshot();
  const next = new Set(current);

  if (next.has(cafeId)) {
    next.delete(cafeId);
  } else {
    next.add(cafeId);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  cachedSet = null;
  window.dispatchEvent(new Event('favorites-changed'));
  return next.has(cafeId);
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, getStableSnapshot, getServerSnapshot);

  const toggleFavorite = useCallback((
    cafeId: string,
    cafeInfo?: { name: string; openingTime: string | null },
  ) => {
    trackEvent('toggle_favorite', { cafe_id: cafeId });
    if (isNativeApp()) {
      import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => {
        Haptics.impact({ style: ImpactStyle.Medium });
      }).catch(() => {});
    }
    const isNowFavorite = toggle(cafeId);

    // Schedule/cancel native local notification
    if (isNativeApp() && cafeInfo?.openingTime) {
      if (isNowFavorite) {
        scheduleNativeNotification(cafeId, cafeInfo.name, cafeInfo.openingTime);
      } else {
        cancelNativeNotification(cafeId);
      }
    }

    return isNowFavorite;
  }, []);

  const isFavorite = useCallback((cafeId: string) => {
    return favorites.has(cafeId);
  }, [favorites]);

  return { favorites, toggleFavorite, isFavorite };
}
