/**
 * 카카오톡 채널 설정.
 *
 * 리텐션 전략의 핵심: 저빈도 JTBD("아침 카페 찾기")를 주 1회 카톡 메시지로
 * 우회한다. 앱 재방문에 의존하지 않고 우리가 먼저 말을 걸 수 있는 유일한
 * 채널이며, localStorage와 달리 자산이 누적된다.
 *
 * `NEXT_PUBLIC_KAKAO_CHANNEL_ID` 미설정 시 관련 UI는 전부 렌더하지 않는다.
 * 채널 개설(https://center-pf.kakao.com) 후 env만 채우면 자동 활성화된다.
 */

/** 카카오톡 채널 공개 ID (예: `_xkLxjTb`). 미설정 시 undefined. */
export const KAKAO_CHANNEL_ID = process.env.NEXT_PUBLIC_KAKAO_CHANNEL_ID;

/** 채널 홈 URL — SDK를 쓸 수 없을 때의 폴백. */
export function kakaoChannelUrl(channelId: string): string {
  return `https://pf.kakao.com/${channelId}`;
}

/** CTA를 닫은 사용자를 기억하는 localStorage 키 (반복 노출 방지). */
export const CHANNEL_CTA_DISMISS_KEY = 'mc_channel_cta_dismissed';
