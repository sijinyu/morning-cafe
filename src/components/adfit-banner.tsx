'use client';

import { useEffect } from 'react';
import { isNativeApp } from '@/lib/capacitor';

/** AdFit 로더 스크립트. 로드 시점에 문서의 `.kakao_ad_area`를 스캔한다. */
const ADFIT_SCRIPT_SRC = 'https://t1.kakaocdn.net/kas/static/ba.min.js';

/**
 * 이 문서에서 로더가 이미 한 번 실행됐는지(=최초 페이지 로드가 끝났는지).
 *
 * 최초 로드는 HTML에 포함된 `<script async>`가 처리한다. 이후 SPA 이동으로
 * 새 `<ins>`가 생기면 로더가 다시 실행돼야 스캔되므로, 그때만 추가로 주입한다.
 */
let loaderHandledInitialLoad = false;

interface AdFitBannerProps {
  unit?: string;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * 카카오 AdFit 배너.
 *
 * `unit` 미설정 시 렌더하지 않는다(no-op). 네이티브 앱(WebView)에서는 AdFit
 * 웹광고 노출이 정책 위반이므로 로더를 주입하지 않는다.
 *
 * `<ins>`는 JSX로 렌더해 **SSR HTML에 포함**시킨다. 예전처럼 `useEffect`에서
 * DOM으로 주입하면 페이지 소스에 광고 코드가 남지 않아, AdFit 매체 심사에서
 * "광고 미설치"로 보류될 수 있다. 로더 스크립트만 클라이언트에서 붙인다.
 */
export function AdFitBanner({ unit, width = 320, height = 100, className }: AdFitBannerProps) {
  useEffect(() => {
    if (!unit || isNativeApp()) return;

    // 최초 로드는 HTML에 포함된 로더가 처리한다. React가 렌더한 <script> 노드를
    // 직접 제거하면 언마운트 시 DOM 불일치가 나므로 건드리지 않는다.
    if (!loaderHandledInitialLoad) {
      loaderHandledInitialLoad = true;
      return;
    }

    // SPA 이동으로 새로 마운트된 경우 — 새 <ins>를 스캔시키기 위해 로더를 한 번 더 실행.
    const script = document.createElement('script');
    script.async = true;
    script.src = ADFIT_SCRIPT_SRC;
    document.body.appendChild(script);

    return () => {
      window.adfit?.destroy?.(unit);
      script.remove();
    };
  }, [unit]);

  if (!unit) return null;

  return (
    // minHeight로 자리를 미리 확보해 광고 로드 시 레이아웃 시프트를 막는다.
    // 심사 승인 전에는 빈 공간으로 보이는 것이 정상이다.
    <div className={className} style={{ minHeight: height }}>
      <ins
        className="kakao_ad_area"
        style={{ display: 'none' }}
        data-ad-unit={unit}
        data-ad-width={String(width)}
        data-ad-height={String(height)}
      />
      {/* AdFit 공식 스니펫과 동일하게 로더도 HTML에 포함시킨다 — 심사 크롤러가
          페이지 소스에서 광고 설치를 확인할 수 있도록. React 19가 async script를
          head로 호이스트하고 src 기준으로 중복 제거한다. */}
      <script async src={ADFIT_SCRIPT_SRC} />
    </div>
  );
}
