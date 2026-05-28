// All AI prompt templates in one place.
// Each function takes structured inputs and returns a ready-to-use prompt string.

export function buildTasteFinderPrompt(params: {
  purpose: string;
  mood: string;
  facilities: string[];
  cafes: {
    id: string;
    name: string;
    address: string;
    opening_time: string | null;
    hours_by_day: Record<string, string> | null;
    category: string | null;
  }[];
  userLat?: number;
  userLng?: number;
}): string {
  const locationNote =
    params.userLat != null && params.userLng != null
      ? `사용자의 현재 위치는 위도 ${params.userLat.toFixed(4)}, 경도 ${params.userLng.toFixed(4)}입니다.`
      : '사용자 위치 정보가 없습니다.';

  const cafeList = params.cafes
    .map((c, i) => {
      const hours = c.hours_by_day
        ? Object.entries(c.hours_by_day)
            .map(([day, h]) => `${day}:${h}`)
            .join(', ')
        : (c.opening_time ?? '정보없음');
      return `${i + 1}. [${c.id}] ${c.name} | ${c.address} | 영업시간: ${hours} | 카테고리: ${c.category ?? '카페'}`;
    })
    .join('\n');

  return `당신은 서울 아침 카페 전문가입니다.
사용자의 취향 조건:
- 목적: ${params.purpose}
- 분위기: ${params.mood}
- 필수시설: ${params.facilities.length > 0 ? params.facilities.join(', ') : '없음'}
${locationNote}

아래 카페 목록에서 사용자 취향에 가장 잘 맞는 카페를 최대 5개 추천하세요.

카페 목록:
${cafeList}

응답 형식은 반드시 아래 JSON만 출력하세요 (마크다운 불필요):
{
  "results": [
    { "id": "카페ID", "reason": "추천 이유 (한국어, 2-3문장)", "score": 추천점수1-10 }
  ],
  "summary": "전체 추천 요약 (한국어, 1-2문장)"
}

규칙:
- 목적과 분위기에 맞는 카페만 추천
- 필수시설이 있는 경우 해당 시설이 있을 것 같은 카페 우선
- score는 1(낮음)~10(높음) 정수
- results는 score 내림차순 정렬
- 최대 5개까지만 반환
- 반드시 한국어로 응답`;
}

export function buildDailyPickPrompt(params: {
  cafe: {
    id: string;
    name: string;
    address: string;
    opening_time: string | null;
    category: string | null;
  };
  timeOfDay: string;
  dayOfWeek: string;
}): string {
  return `당신은 서울 아침 카페 전문가이자 감성 카피라이터입니다.
오늘은 ${params.dayOfWeek}이고, 현재 시간은 ${params.timeOfDay}입니다.

아래 카페에 대해 짧고 감성적인 추천 이유를 작성하세요:
- 카페명: ${params.cafe.name}
- 주소: ${params.cafe.address}
- 오픈시간: ${params.cafe.opening_time ?? '정보없음'}
- 카테고리: ${params.cafe.category ?? '카페'}

응답 형식은 반드시 아래 JSON만 출력하세요:
{
  "reason": "감성적 추천 이유 (한국어, 2-3문장, 오늘의 날씨/시간/요일 분위기 반영)"
}

규칙:
- 따뜻하고 친근한 톤으로 작성
- "~해요" 체 사용
- 반드시 한국어로 응답`;
}

export function buildTaglinePrompt(params: {
  name: string;
  strengths: string[];
  facilities: string[];
  rating: { score: number; count: number } | null;
  reviewSnippets: string[];
}): string {
  const details: string[] = [];
  if (params.strengths.length > 0) details.push(`장점: ${params.strengths.join(', ')}`);
  if (params.facilities.length > 0) details.push(`편의시설: ${params.facilities.join(', ')}`);
  if (params.rating) {
    details.push(`별점: ${params.rating.score.toFixed(1)} (${params.rating.count}개 리뷰)`);
  }
  if (params.reviewSnippets.length > 0) {
    details.push(`리뷰 발췌: ${params.reviewSnippets.join(' / ')}`);
  }

  return `당신은 서울 카페 한줄 카피라이터입니다.

카페: ${params.name}
${details.join('\n')}

이 카페를 한줄로 표현하세요 (15~25자).

응답 형식은 반드시 아래 JSON만 출력하세요:
{
  "tagline": "한줄 태그라인"
}

규칙:
- 15~25자 이내 (한국어)
- 카페의 핵심 매력을 담을 것
- 형용사+명사 조합 (예: "조용하고 커피 맛있는 아침 작업 카페")
- 반드시 한국어로 응답`;
}
