'use client';

import { useEffect, useRef } from 'react';
import { isNativeApp } from '@/lib/capacitor';

interface AdFitBannerProps {
  unit?: string;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * 카카오 AdFit 배너.
 * unit 미설정 시 no-op. 네이티브 앱(WebView)에서는 AdFit 웹 광고 노출이
 * 정책 위반이므로 렌더하지 않음.
 */
export function AdFitBanner({ unit, width = 320, height = 100, className }: AdFitBannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!unit || !el || isNativeApp()) return;

    el.style.minHeight = `${height}px`;

    const ins = document.createElement('ins');
    ins.className = 'kakao_ad_area';
    ins.style.display = 'none';
    ins.dataset.adUnit = unit;
    ins.dataset.adWidth = String(width);
    ins.dataset.adHeight = String(height);

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://t1.kakaocdn.net/kas/static/ba.min.js';

    el.append(ins, script);

    return () => {
      const adfit = (window as unknown as { adfit?: { destroy?: (unit: string) => void } }).adfit;
      adfit?.destroy?.(unit);
      el.replaceChildren();
      el.style.minHeight = '';
    };
  }, [unit, width, height]);

  if (!unit) return null;

  return <div ref={containerRef} className={className} />;
}
