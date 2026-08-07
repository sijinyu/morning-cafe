'use client';

import { useEffect, useRef } from 'react';
import { isNativeApp } from '@/lib/capacitor';

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

interface AdsenseBannerProps {
  slot?: string;
  className?: string;
}

/**
 * 구글 애드센스 반응형 배너.
 * client/slot 미설정 시 no-op. 네이티브 앱(WebView)에서 애드센스 웹 광고 노출은
 * 정책 위반이므로 렌더하지 않음. 로더 스크립트는 layout.tsx에서 로드.
 */
export function AdsenseBanner({ slot, className }: AdsenseBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!ADSENSE_CLIENT || !slot || !el || isNativeApp()) return;

    const ins = document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.style.display = 'block';
    ins.dataset.adClient = ADSENSE_CLIENT;
    ins.dataset.adSlot = slot;
    ins.dataset.adFormat = 'auto';
    ins.dataset.fullWidthResponsive = 'true';
    el.append(ins);

    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch {
      // 로더 스크립트 미로드(개발환경, 광고차단기) 시 무시
    }

    return () => {
      el.replaceChildren();
    };
  }, [slot]);

  if (!ADSENSE_CLIENT || !slot) return null;

  return <div ref={containerRef} className={className} />;
}
