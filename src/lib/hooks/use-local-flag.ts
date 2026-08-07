'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * localStorage에 저장되는 on/off 플래그를 SSR-안전하게 읽고 쓴다.
 *
 * `useState` + `useEffect(() => setMounted(true))` 패턴을 대체한다. 그 방식은
 * 이펙트 안에서 동기적으로 setState를 호출해 연쇄 렌더를 유발하고,
 * 첫 페인트에 CTA가 깜빡이는 문제가 있다.
 *
 * `useSyncExternalStore`의 서버 스냅샷을 `true`(=이미 설정됨)로 두면 SSR·하이드레이션
 * 시점에는 아무것도 렌더하지 않고, 하이드레이션 직후 실제 값으로 교체된다.
 */
const listeners = new Set<() => void>();

/**
 * localStorage 쓰기가 막힌 환경(프라이빗 모드 등)에서도 이번 세션 동안은
 * 설정 상태를 유지하기 위한 메모리 폴백.
 */
const memoryFlags = new Set<string>();

function emitChange() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // 다른 탭에서의 변경도 반영한다.
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function readFlag(key: string): boolean {
  if (memoryFlags.has(key)) return true;
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    // 프라이빗 모드 등 접근 불가 시에는 미설정으로 취급한다.
    return false;
  }
}

/** `[플래그가 설정되었는가, 설정하는 함수]` */
export function useLocalFlag(key: string): readonly [boolean, () => void] {
  const isSet = useSyncExternalStore(
    subscribe,
    useCallback(() => readFlag(key), [key]),
    // 서버에서는 값을 알 수 없으므로 "설정됨"으로 가정해 UI를 숨긴다.
    () => true,
  );

  const set = useCallback(() => {
    memoryFlags.add(key);
    try {
      window.localStorage.setItem(key, '1');
    } catch {
      // 저장 실패해도 메모리 폴백으로 이번 세션은 유지된다.
    }
    emitChange();
  }, [key]);

  return [isSet, set] as const;
}
