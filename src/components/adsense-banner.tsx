'use client';

import { useEffect } from 'react';
import { isNativeApp } from '@/lib/capacitor';

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

interface AdsenseBannerProps {
  slot?: string;
  className?: string;
}

/**
 * 구글 애드센스 반응형 배너.
 *
 * client/slot 미설정 시 렌더하지 않는다(no-op). 네이티브 앱(WebView)에서
 * 애드센스 웹광고 노출은 정책 위반이므로 push하지 않는다(빈 공간도 minHeight 0).
 *
 * `<ins>`는 AdFitBanner와 같은 이유로 **SSR HTML에 포함**시킨다 — 심사
 * 크롤러가 페이지 소스에서 광고 설치를 확인할 수 있도록. 로더 스크립트는
 * `layout.tsx`에서 사이트 전역 로드(사이트 소유권 확인에도 필요).
 */
export function AdsenseBanner({ slot, className }: AdsenseBannerProps) {
  useEffect(() => {
    if (!ADSENSE_CLIENT || !slot || isNativeApp()) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // 로더 미로드(광고차단기 등) 또는 이미 채워진 <ins> — 무시
    }
  }, [slot]);

  if (!ADSENSE_CLIENT || !slot) return null;

  return (
    // minHeight로 자리를 미리 확보해 광고 로드 시 레이아웃 시프트를 막는다.
    <div className={className} style={{ minHeight: 100 }}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
