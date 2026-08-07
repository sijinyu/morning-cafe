'use client';

import { useSyncExternalStore } from 'react';
import { readGeoCookie } from '@/lib/coverage';

/**
 * 지역 쿠키는 페이지 생애 동안 바뀌지 않으므로 구독은 no-op.
 * (미들웨어가 응답마다 심어주지만, 값이 바뀌면 어차피 새 문서다.)
 */
function subscribe(): () => void {
  return () => {};
}

/** 서버에서는 쿠키를 읽을 수 없으므로 null — 하이드레이션 전에는 렌더하지 않는다. */
function getServerSnapshot(): string | null {
  return null;
}

/**
 * 미들웨어가 심어둔 정규화된 지역 키를 SSR-안전하게 읽는다.
 *
 * `useState` + `useEffect(setCity)` 대신 사용 — 이펙트 내 동기 setState로 인한
 * 연쇄 렌더가 없다. `readGeoCookie`는 문자열(또는 null)을 반환하므로
 * `Object.is` 비교가 안정적이다.
 */
export function useGeoCity(): string | null {
  return useSyncExternalStore(subscribe, readGeoCookie, getServerSnapshot);
}
