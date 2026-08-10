'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { isNativeApp } from '@/lib/capacitor';
import { showAdmobBanner, hideAdmobBanner } from '@/lib/admob';

/** AdMob 배너를 띄우는 지면 — 웹 광고(AdFit/애드센스)와 동일 원칙, 지도(/)는 금지 */
const AD_ROUTE_PREFIXES = ['/guides', '/cafes', '/cafe/'];

/** 로케일 프리픽스(/en, /ja) 제거 — ko는 프리픽스 없음 */
function stripLocale(pathname: string): string {
  return pathname.replace(/^\/(en|ja)(?=\/|$)/, '') || '/';
}

/**
 * 라우트에 따라 AdMob 배너를 show/hide하는 컨트롤러. 렌더링 없음.
 * 네이티브 앱이 아니면 아무것도 하지 않는다.
 */
export function AdmobBanner() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isNativeApp()) return;
    const path = stripLocale(pathname);
    const shouldShow = AD_ROUTE_PREFIXES.some((prefix) => path.startsWith(prefix));
    if (shouldShow) {
      void showAdmobBanner();
    } else {
      void hideAdmobBanner();
    }
  }, [pathname]);

  return null;
}
