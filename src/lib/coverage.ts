/**
 * 서비스 커버리지 판정.
 *
 * Vercel이 요청 헤더로 넣어주는 `x-vercel-ip-city`(로마자, 예: "Goyang-si")를
 * 정규화해서 크롤링 대상 지역인지 판정한다. GPS 권한이 필요 없으므로
 * 첫 방문자에게도 즉시 동작한다.
 *
 * 커버리지 목록은 `scripts/seed-cafes.ts`의 `ALLOWED_REGIONS`와 짝을 이룬다.
 * 크롤링 지역을 추가하면 여기도 함께 갱신해야 한다.
 */

/** 크롤링 대상 지역 (정규화된 로마자 키). */
const COVERED_CITIES: ReadonlySet<string> = new Set([
  'seoul',
  // 경기 15개 도시
  'seongnam',
  'suwon',
  'yongin',
  'goyang',
  'bucheon',
  'anyang',
  'hanam',
  'gwangmyeong',
  'gwacheon',
  'uiwang',
  'guri',
  'namyangju',
  'paju',
  'gimpo',
  'hwaseong',
]);

/**
 * 미커버 주요 도시의 한글 표기.
 * 웨이팅리스트 카드에서 "부산은 아직 준비 중이에요"처럼 보여주기 위한 것.
 * 목록에 없으면 헤더의 로마자 값을 그대로 노출한다.
 */
const KOREAN_CITY_NAMES: Readonly<Record<string, string>> = {
  busan: '부산',
  daegu: '대구',
  incheon: '인천',
  daejeon: '대전',
  gwangju: '광주',
  ulsan: '울산',
  sejong: '세종',
  jeju: '제주',
  cheongju: '청주',
  cheonan: '천안',
  jeonju: '전주',
  pohang: '포항',
  changwon: '창원',
  gimhae: '김해',
  chuncheon: '춘천',
  gangneung: '강릉',
  wonju: '원주',
  ansan: '안산',
  pyeongtaek: '평택',
  siheung: '시흥',
  uijeongbu: '의정부',
  yangju: '양주',
};

/**
 * `x-vercel-ip-city` 값을 비교 가능한 키로 정규화.
 * "Goyang-si" → "goyang", "Seoul" → "seoul", "Namyangju%20si" → "namyangju"
 */
export function normalizeCity(rawCity: string): string {
  let decoded = rawCity;
  try {
    decoded = decodeURIComponent(rawCity);
  } catch {
    // 잘못된 인코딩이면 원본 사용 — 헤더는 신뢰할 수 없는 입력이다.
  }

  return decoded
    .trim()
    .toLowerCase()
    .replace(/[-\s_]?(si|gun|gu|city)$/, '')
    .replace(/[-\s_]/g, '');
}

/** 해당 도시가 크롤링 커버리지 안에 있는가. 판정 불가면 `true`(카드 숨김). */
export function isCoveredCity(rawCity: string | null | undefined): boolean {
  if (!rawCity) return true;
  const key = normalizeCity(rawCity);
  if (!key) return true;
  return COVERED_CITIES.has(key);
}

/** 사용자에게 보여줄 지역명. 한글 표기가 있으면 그것을, 없으면 원본을 쓴다. */
export function displayCityName(rawCity: string, locale: string): string {
  const key = normalizeCity(rawCity);
  const korean = KOREAN_CITY_NAMES[key];

  if (locale === 'ko' && korean) return korean;

  // 로마자: 첫 글자만 대문자로 (헤더 값이 이미 "Busan" 형태지만 방어적으로)
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** 웨이팅리스트 DB에 저장할 정규화 키. */
export function waitlistRegionKey(rawCity: string): string {
  return normalizeCity(rawCity);
}
