/**
 * 카카오 AdFit 광고단위 ID (지면별).
 *
 * AdFit은 지면마다 별도 광고단위를 발급받아야 하므로 env를 분리한다.
 * 미설정 지면은 `undefined` → `AdFitBanner`가 렌더하지 않는다(no-op).
 * 따라서 광고단위를 아직 발급받지 못한 지면도 안전하게 배포할 수 있다.
 *
 * 지도 뷰에는 광고를 넣지 않는다 — North Star("카페를 찾아 출발하기까지
 * 걸리는 시간")를 직접 훼손하기 때문. 단 메인 라우트의 **리스트뷰**는 예외 지면:
 * AdFit 매체 심사가 대표 URL에서 광고 설치를 확인하기 때문에 필요하다.
 */
export const AD_UNITS = {
  /** 구별 SEO 목록 `/cafes/[gu]` */
  gu: process.env.NEXT_PUBLIC_ADFIT_UNIT_GU,
  /** 메인 리스트뷰 (지도 아님) — 매체 심사 요구로 추가. 전용 광고단위 발급 전엔 GU 값 재사용 가능 */
  list: process.env.NEXT_PUBLIC_ADFIT_UNIT_LIST,
  /** 개별 카페 상세 `/cafe/[id]` — 네이버 검색 유입 최다 지면 */
  cafeDetail: process.env.NEXT_PUBLIC_ADFIT_UNIT_CAFE,
  /** 콘텐츠 가이드 `/guides/[slug]` */
  guide: process.env.NEXT_PUBLIC_ADFIT_UNIT_GUIDE,
  /** 구 목록 인덱스 `/cafes` */
  cafesIndex: process.env.NEXT_PUBLIC_ADFIT_UNIT_CAFES_INDEX,
} as const;

/** AdFit 모바일 배너 표준 규격 (320x100). */
export const AD_SIZE_MOBILE = { width: 320, height: 100 } as const;
