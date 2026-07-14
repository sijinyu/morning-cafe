declare global {
  interface Window {
    gtag: (
      command: 'event' | 'config' | 'js',
      target: string | Date,
      params?: Record<string, string | number | boolean>
    ) => void;
  }
}

// 앱(Capacitor 웹뷰) vs 웹 판정 — layout.tsx의 app_platform 로직과 동일 기준.
// 모든 이벤트에 platform을 붙여 GA4에서 앱/웹 세그먼트를 나눌 수 있게 함
// (기존엔 앱 유입이 Unassigned로 새고 있었음).
function currentPlatform(): 'app' | 'web' {
  if (typeof window === 'undefined') return 'web';
  const isApp =
    new URLSearchParams(window.location.search).get('platform') === 'app' ||
    (window as unknown as Record<string, unknown>).Capacitor !== undefined;
  return isApp ? 'app' : 'web';
}

export function trackEvent(
  action: string,
  params?: Record<string, string | number>
) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, { ...params, platform: currentPlatform() });
  }
}
