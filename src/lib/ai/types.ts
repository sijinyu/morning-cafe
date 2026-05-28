export interface AiResult {
  id: string;
  reason: string;
  score: number;
}

export interface AiRecommendResponse {
  results: AiResult[];
  summary: string;
}

export interface AiTaglineResponse {
  tagline: string;
}

export interface AiDailyPickResponse {
  reason: string;
}

export interface AiCompareRow {
  cafe_id: string;
  cafe_name: string;
  values: string[];
}

export interface AiCompareResponse {
  comparison: {
    categories: string[];
    rows: AiCompareRow[];
  };
  verdict: string;
  winner_id: string;
}

export type TasteFinderPurpose = '작업/공부' | '독서' | '수다/미팅' | '데이트' | '혼카';
export type TasteFinderMood = '조용한' | '활기찬' | '아늑한' | '모던한';
export type TasteFinderFacility = '콘센트' | '와이파이' | '주차' | '넓은 좌석';
