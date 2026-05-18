export interface Cafe {
  id: string;
  kakao_place_id: string;
  name: string;
  address: string;
  road_address: string | null;
  phone: string | null;
  latitude: number;
  longitude: number;
  place_url: string | null;
  instagram_url: string | null;
  category: string | null;
  opening_time: string | null;
  closing_time: string | null;
  hours_by_day: Record<string, string> | null;
  is_earlybird: boolean;
  last_crawled_at: string | null;
}

/** 주소에서 구 이름 추출 */
export function extractGu(address: string): string | null {
  const match = address.match(/서울\S*\s+(\S+구)/);
  return match?.[1] ?? null;
}
