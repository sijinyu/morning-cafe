'use client';

import { useSyncExternalStore, useCallback } from 'react';

const STORAGE_KEY = 'morning-cafe-search-history';
const MAX_ITEMS = 10;
const MIN_QUERY_LENGTH = 2;

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
  window.addEventListener('search-history-changed', handleCustom);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('search-history-changed', handleCustom);
  };
}

function getStableSnapshot(): string[] {
  if (!cachedList) {
    cachedList = getSnapshot();
  }
  return cachedList;
}

function addSearchToStorage(query: string): void {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return;
  const current = getSnapshot();
  const deduplicated = current.filter((q) => q !== trimmed);
  const next = [trimmed, ...deduplicated].slice(0, MAX_ITEMS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  cachedList = null;
  window.dispatchEvent(new Event('search-history-changed'));
}

function removeSearchFromStorage(query: string): void {
  const current = getSnapshot();
  const next = current.filter((q) => q !== query);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  cachedList = null;
  window.dispatchEvent(new Event('search-history-changed'));
}

function clearHistoryFromStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
  cachedList = null;
  window.dispatchEvent(new Event('search-history-changed'));
}

export function useSearchHistory() {
  const history = useSyncExternalStore(subscribe, getStableSnapshot, getServerSnapshot);

  const addSearch = useCallback((query: string) => {
    addSearchToStorage(query);
  }, []);

  const removeSearch = useCallback((query: string) => {
    removeSearchFromStorage(query);
  }, []);

  const clearHistory = useCallback(() => {
    clearHistoryFromStorage();
  }, []);

  return { history, addSearch, removeSearch, clearHistory };
}
