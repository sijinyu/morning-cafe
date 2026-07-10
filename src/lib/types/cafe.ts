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
  created_at: string | null;
  thumbnail_url?: string | null;
}

/** 주소에서 지역명 추출 (서울 구 or 경기도 시) */
export function extractGu(address: string): string | null {
  // 서울: "서울 강남구" → "강남구"
  const seoulMatch = address.match(/서울\S*\s+(\S+구)/);
  if (seoulMatch?.[1]) return seoulMatch[1];

  // 경기도: "경기 성남시 분당구" → "성남시 분당구", "경기 고양시 일산동구" → "고양시 일산동구"
  const gyeonggiMatch = address.match(/경기\S*\s+(\S+시)\s+(\S+구)/);
  if (gyeonggiMatch?.[1] && gyeonggiMatch?.[2]) return `${gyeonggiMatch[1]} ${gyeonggiMatch[2]}`;

  // 경기도 (구 없는 시): "경기 하남시" → "하남시"
  const gyeonggiCityMatch = address.match(/경기\S*\s+(\S+시)/);
  if (gyeonggiCityMatch?.[1]) return gyeonggiCityMatch[1];

  // 경기도 (군): "경기 양평군" → "양평군"
  const gunMatch = address.match(/경기\S*\s+(\S+군)/);
  if (gunMatch?.[1]) return gunMatch[1];

  return null;
}
