'use client';

import { useSyncExternalStore, useCallback } from 'react';
import { trackEvent } from '@/lib/analytics';
import { isNativeApp } from '@/lib/capacitor';

const STORAGE_KEY = 'morning-cafe-stamps';

export interface StampRecord {
  readonly cafeId: string;
  readonly cafeName: string;
  readonly gu: string;
  readonly checkedAt: string; // ISO timestamp
}

function getSnapshot(): StampRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StampRecord[];
  } catch {
    return [];
  }
}

const EMPTY: StampRecord[] = [];

function getServerSnapshot(): StampRecord[] {
  return EMPTY;
}

let cached: StampRecord[] | null = null;

function subscribe(callback: () => void): () => void {
  function handleStorage(e: StorageEvent) {
    if (e.key === STORAGE_KEY) {
      cached = null;
      callback();
    }
  }

  function handleCustom() {
    cached = null;
    callback();
  }

  window.addEventListener('storage', handleStorage);
  window.addEventListener('stamps-changed', handleCustom);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('stamps-changed', handleCustom);
  };
}

function getStableSnapshot(): StampRecord[] {
  if (!cached) {
    cached = getSnapshot();
  }
  return cached;
}

function addStampToStorage(record: StampRecord): void {
  const current = getSnapshot();
  // 같은 카페 중복 체크인 방지 (하루 1회)
  const today = new Date().toDateString();
  const alreadyToday = current.some(
    (s) => s.cafeId === record.cafeId && new Date(s.checkedAt).toDateString() === today,
  );
  if (alreadyToday) return;

  const next = [record, ...current];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  cached = null;
  window.dispatchEvent(new Event('stamps-changed'));
}

/** 서울 25개 구 목록 */
export const SEOUL_GUS = [
  '강남구', '강동구', '강북구', '강서구', '관악구',
  '광진구', '구로구', '금천구', '노원구', '도봉구',
  '동대문구', '동작구', '마포구', '서대문구', '서초구',
  '성동구', '성북구', '송파구', '양천구', '영등포구',
  '용산구', '은평구', '종로구', '중구', '중랑구',
] as const;

export function useStamps() {
  const stamps = useSyncExternalStore(subscribe, getStableSnapshot, getServerSnapshot);

  const addStamp = useCallback((cafeId: string, cafeName: string, gu: string) => {
    const record: StampRecord = {
      cafeId,
      cafeName,
      gu,
      checkedAt: new Date().toISOString(),
    };
    addStampToStorage(record);
    trackEvent('checkin', { cafe_name: cafeName, gu });

    if (isNativeApp()) {
      import('@capacitor/haptics').then(({ Haptics, NotificationType }) => {
        Haptics.notification({ type: NotificationType.Success });
      }).catch(() => {});
    }
  }, []);

  /** 오늘 이미 체크인했는지 */
  const hasCheckedInToday = useCallback((cafeId: string) => {
    const today = new Date().toDateString();
    return stamps.some(
      (s) => s.cafeId === cafeId && new Date(s.checkedAt).toDateString() === today,
    );
  }, [stamps]);

  /** 정복한 구 Set — "서울 25구 정복" 컨셉이므로 서울 구만 집계.
   *  경기 카페 체크인(gu="성남시 분당구" 등)은 그리드에 없어 카운트/그리드 불일치를 유발하므로 제외. */
  const seoulGuSet = new Set<string>(SEOUL_GUS);
  const conqueredGus = new Set(stamps.map((s) => s.gu).filter((gu) => seoulGuSet.has(gu)));

  /** 총 스탬프 수 (경기 포함, 방문 기록 전체) */
  const totalStamps = stamps.length;

  /** 서울 25구 정복 완료 여부 */
  const allConquered = conqueredGus.size >= SEOUL_GUS.length;

  return { stamps, addStamp, hasCheckedInToday, conqueredGus, totalStamps, allConquered };
}
