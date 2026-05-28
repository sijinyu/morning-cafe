'use client';

import { useSyncExternalStore, useCallback } from 'react';

const STORAGE_KEY = 'morning-cafe-recent';
const MAX_ITEMS = 20;

function getSnapshot(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function getServerSnapshot(): string[] {
  return [];
}

let cachedList: string[] | null = null;

function subscribe(callback: () => void): () => void {
  function handleStorage(e: StorageEvent) {
    if (e.key === STORAGE_KEY) {
      cachedList = null;
      callback();
    }
  }

  function handleCustom() {
    cachedList = null;
    callback();
  }

  window.addEventListener('storage', handleStorage);
  window.addEventListener('recent-cafes-changed', handleCustom);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('recent-cafes-changed', handleCustom);
  };
}

function getStableSnapshot(): string[] {
  if (!cachedList) {
    cachedList = getSnapshot();
  }
  return cachedList;
}

function addRecentToStorage(cafeId: string): void {
  const current = getSnapshot();
  const deduplicated = current.filter((id) => id !== cafeId);
  const next = [cafeId, ...deduplicated].slice(0, MAX_ITEMS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  cachedList = null;
  window.dispatchEvent(new Event('recent-cafes-changed'));
}

function clearRecentFromStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
  cachedList = null;
  window.dispatchEvent(new Event('recent-cafes-changed'));
}

function removeRecentFromStorage(cafeId: string): void {
  const current = getSnapshot();
  const next = current.filter((id) => id !== cafeId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  cachedList = null;
  window.dispatchEvent(new Event('recent-cafes-changed'));
}

function removeMultipleFromStorage(cafeIds: Set<string>): void {
  const current = getSnapshot();
  const next = current.filter((id) => !cafeIds.has(id));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  cachedList = null;
  window.dispatchEvent(new Event('recent-cafes-changed'));
}

export function useRecentCafes() {
  const recentIds = useSyncExternalStore(subscribe, getStableSnapshot, getServerSnapshot);

  const addRecent = useCallback((cafeId: string) => {
    addRecentToStorage(cafeId);
  }, []);

  const clearRecent = useCallback(() => {
    clearRecentFromStorage();
  }, []);

  const removeRecent = useCallback((cafeId: string) => {
    removeRecentFromStorage(cafeId);
  }, []);

  const removeMultiple = useCallback((cafeIds: Set<string>) => {
    removeMultipleFromStorage(cafeIds);
  }, []);

  return { recentIds, addRecent, clearRecent, removeRecent, removeMultiple };
}
