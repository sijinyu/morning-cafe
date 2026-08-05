/**
 * 카카오 플랫폼 스크립트(JS SDK, AdFit)의 전역 타입.
 *
 * Kakao SDK 로드/초기화는 `src/app/layout.tsx`에서 한 번만 수행한다.
 * 여기서 중앙 관리하는 이유: 여러 컴포넌트가 `window.Kakao`를 쓰는데
 * 파일별로 `declare global`을 하면 프로퍼티 타입 충돌이 발생한다.
 */
declare global {
  interface KakaoShareApi {
    sendDefault: (options: Record<string, unknown>) => void;
  }

  /** 카카오톡 채널 API — SDK 버전에 따라 없을 수 있어 optional. */
  interface KakaoChannelApi {
    addChannel: (settings: { channelPublicId: string }) => void;
    chat: (settings: { channelPublicId: string }) => void;
  }

  interface KakaoSdk {
    isInitialized: () => boolean;
    Share: KakaoShareApi;
    Channel?: KakaoChannelApi;
  }

  /** 카카오 AdFit 로더(`ba.min.js`)가 전역에 노출하는 API. */
  interface AdFitApi {
    destroy?: (unit: string) => void;
  }

  interface Window {
    Kakao?: KakaoSdk;
    adfit?: AdFitApi;
  }
}

export {};
