declare global {
  interface Window {
    gtag: (
      command: 'event' | 'config' | 'js',
      target: string | Date,
      params?: Record<string, string | number | boolean>
    ) => void;
  }
}

export function trackEvent(
  action: string,
  params?: Record<string, string | number>
) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, params);
  }
}
