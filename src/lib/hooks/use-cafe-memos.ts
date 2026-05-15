'use client';

import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'cafe-memos';

type MemoMap = Record<string, string>;

let memosSnapshot: MemoMap = {};

function getSnapshot(): MemoMap {
  return memosSnapshot;
}

function getServerSnapshot(): MemoMap {
  return {};
}

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify() {
  for (const cb of listeners) cb();
}

function load(): MemoMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(memos: MemoMap) {
  memosSnapshot = memos;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
  notify();
}

// Init on first import (client only)
if (typeof window !== 'undefined') {
  memosSnapshot = load();
}

export function useCafeMemos() {
  const memos = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const getMemo = useCallback((cafeId: string): string => {
    return memos[cafeId] ?? '';
  }, [memos]);

  const setMemo = useCallback((cafeId: string, text: string) => {
    const current = load();
    if (text.trim()) {
      save({ ...current, [cafeId]: text.trim() });
    } else {
      const { [cafeId]: _, ...rest } = current;
      save(rest);
    }
  }, []);

  return { getMemo, setMemo };
}
