/**
 * 조용한 아침 지수 (Quiet Morning Score)
 *
 * strengths[], facilities[], reviews[] 키워드 매칭으로
 * "아침에 조용히 작업하기 좋은 카페" 점수를 0~5 스케일로 산출.
 */

// 긍정 키워드 (가중치)
const POSITIVE_KEYWORDS: [RegExp, number][] = [
  // 조용함/분위기
  [/조용/i, 2],
  [/한적/i, 2],
  [/아늑/i, 1.5],
  [/차분/i, 1.5],
  [/편안/i, 1],
  [/분위기/i, 0.5],
  // 작업/공부
  [/작업/i, 2],
  [/노트북/i, 2],
  [/공부/i, 2],
  [/카공/i, 2],
  [/집중/i, 1.5],
  [/스터디/i, 1.5],
  [/업무/i, 1],
  [/코딩/i, 1.5],
  // 공간
  [/넓[어은]/i, 1.5],
  [/좌석.*많/i, 1],
  [/테이블.*넓/i, 1],
  [/층.*넓/i, 1],
  // 시설
  [/콘센트/i, 2],
  [/충전/i, 1],
  [/와이파이|wifi|wi-fi/i, 1.5],
  // 강점 키워드 (카카오맵 strengths에서 나오는 패턴)
  [/인테리어.*좋/i, 0.5],
  [/뷰.*좋/i, 0.5],
];

// 부정 키워드 (감점)
const NEGATIVE_KEYWORDS: [RegExp, number][] = [
  [/시끄/i, -2],
  [/좁[아은]/i, -1],
  [/복잡/i, -1],
  [/웨이팅/i, -1],
  [/줄서/i, -1],
  [/사람.*많/i, -0.5],
];

export interface QuietScoreResult {
  /** 0~5 스케일 (소수점 1자리) */
  score: number;
  /** 점수 등급 라벨 */
  label: string;
  /** 매칭된 긍정 키워드 */
  tags: string[];
}

/**
 * place-detail 데이터로 조용한 아침 지수 계산
 */
export function calculateQuietScore(
  strengths: string[],
  facilities: string[],
  reviews: { contents: string }[],
): QuietScoreResult {
  let rawScore = 0;
  const matchedTags = new Set<string>();

  // 모든 텍스트를 하나로 합침
  const allTexts = [
    ...strengths,
    ...facilities,
    ...reviews.map((r) => r.contents),
  ];

  if (allTexts.length === 0) {
    return { score: 0, label: '정보 없음', tags: [] };
  }

  const combined = allTexts.join(' ');

  // 긍정 키워드 매칭
  for (const [pattern, weight] of POSITIVE_KEYWORDS) {
    if (pattern.test(combined)) {
      rawScore += weight;
      // 태그 추출: 패턴의 핵심어
      const label = getTagLabel(pattern);
      if (label) matchedTags.add(label);
    }
  }

  // 부정 키워드 매칭
  for (const [pattern, weight] of NEGATIVE_KEYWORDS) {
    if (pattern.test(combined)) {
      rawScore += weight; // weight가 음수
    }
  }

  // 시설 보너스
  const facilitySet = new Set(facilities.map((f) => f.toLowerCase()));
  if (facilitySet.has('콘센트') || facilities.some((f) => /콘센트/.test(f))) {
    matchedTags.add('콘센트');
  }
  if (facilities.some((f) => /와이파이|wifi/i.test(f))) {
    matchedTags.add('와이파이');
  }

  // 0~5 스케일로 정규화 (rawScore 범위: -5 ~ 20+)
  const normalized = Math.max(0, Math.min(5, (rawScore / 10) * 5));
  const score = Math.round(normalized * 10) / 10;

  return {
    score,
    label: getLabel(score),
    tags: [...matchedTags].slice(0, 4),
  };
}

function getLabel(score: number): string {
  if (score >= 4) return '작업 천국';
  if (score >= 3) return '작업 추천';
  if (score >= 2) return '조용한 편';
  if (score >= 1) return '보통';
  return '정보 부족';
}

function getTagLabel(pattern: RegExp): string | null {
  const source = pattern.source;
  if (/조용/.test(source)) return '조용해요';
  if (/한적/.test(source)) return '한적해요';
  if (/아늑/.test(source)) return '아늑해요';
  if (/작업|노트북|카공|코딩/.test(source)) return '작업 친화';
  if (/공부|스터디/.test(source)) return '공부하기 좋아요';
  if (/집중/.test(source)) return '집중하기 좋아요';
  if (/넓|좌석|테이블/.test(source)) return '넓어요';
  if (/콘센트|충전/.test(source)) return '콘센트';
  if (/와이파이|wifi/.test(source)) return '와이파이';
  return null;
}
