import { NextRequest, NextResponse } from 'next/server';
import { geminiModel, extractJson, safeParseJson, isGeminiConfigured } from '@/lib/ai/gemini';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LocationInput {
  lat: number;
  lng: number;
  address?: string;
}

interface CafeCommuteInput {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  opening_time?: string | null;
}

interface CommuteBody {
  home: LocationInput;
  work: LocationInput;
  departure_time: string;
  cafes: CafeCommuteInput[];
}

interface CommuteRecommendation {
  cafe_id: string;
  cafe_name: string;
  reason: string;
  estimated_timeline: string;
}

interface GeminiCommuteResponse {
  recommendations: CommuteRecommendation[];
  route_summary: string;
}

// ---------------------------------------------------------------------------
// In-memory response cache (30 min TTL)
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: GeminiCommuteResponse;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function getCached(key: string): GeminiCommuteResponse | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: GeminiCommuteResponse): void {
  responseCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function buildCacheKey(home: LocationInput, work: LocationInput, departureTime: string): string {
  const h = `${home.lat.toFixed(3)},${home.lng.toFixed(3)}`;
  const w = `${work.lat.toFixed(3)},${work.lng.toFixed(3)}`;
  return `commute:${h}:${w}:${departureTime}`;
}

// ---------------------------------------------------------------------------
// Distance helper (Haversine, kilometres)
// ---------------------------------------------------------------------------

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Detour ratio — how much longer is home→cafe→work vs home→work directly. */
function detourRatio(home: LocationInput, cafe: CafeCommuteInput, work: LocationInput): number {
  const direct = haversineKm(home.lat, home.lng, work.lat, work.lng);
  if (direct === 0) return 1;
  const via =
    haversineKm(home.lat, home.lng, cafe.lat, cafe.lng) +
    haversineKm(cafe.lat, cafe.lng, work.lat, work.lng);
  return via / direct;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(body: CommuteBody, cafes: CafeCommuteInput[]): string {
  const homeLabel = body.home.address ?? `위도 ${body.home.lat.toFixed(4)}, 경도 ${body.home.lng.toFixed(4)}`;
  const workLabel = body.work.address ?? `위도 ${body.work.lat.toFixed(4)}, 경도 ${body.work.lng.toFixed(4)}`;

  const cafeList = cafes
    .map((c, i) => {
      const fromHome = haversineKm(body.home.lat, body.home.lng, c.lat, c.lng).toFixed(2);
      const toWork = haversineKm(c.lat, c.lng, body.work.lat, body.work.lng).toFixed(2);
      return `${i + 1}. [${c.id}] ${c.name} | ${c.address} | 오픈: ${c.opening_time ?? '정보없음'} | 집→카페: ${fromHome}km, 카페→직장: ${toWork}km`;
    })
    .join('\n');

  return `너는 서울 출근길 카페를 추천해주는 따뜻한 친구야.

집: ${homeLabel}
직장: ${workLabel}
출발 시간: ${body.departure_time}

경로 중 카페:
${cafeList}

반드시 아래 JSON만 출력해 (마크다운 금지):
{"recommendations":[{"cafe_id":"카페ID","cafe_name":"카페명","reason":"추천 이유 1-2문장","estimated_timeline":"타임라인"}],"route_summary":"한줄 요약"}

말투 규칙:
- 친한 언니/오빠가 추천하듯 다정하게 ("~거든요", "~어울려요", "여기 진짜 좋아요", "~어때요?")
- 이모지 1-2개 자연스럽게
- reason은 30자 이내로 짧고 감성적으로
- 딱딱한 존댓말 금지 ("~입니다" "~습니다" 쓰지마)
- 카페 체류 시간은 40분 기준으로 타임라인 작성 (예: "06:30 출발 → 06:45 카페 → 07:25 출발 → 07:45 직장")
- 출발 시간에 영업 중인 카페 우선, 우회 적은 곳 우선`;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

const EMPTY_RESPONSE: GeminiCommuteResponse = {
  recommendations: [],
  route_summary: '현재 AI 출근길 추천을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
};

export async function POST(request: NextRequest) {
  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: 'AI 기능이 설정되지 않았습니다.', ...EMPTY_RESPONSE },
      { status: 503 },
    );
  }

  let body: CommuteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const { home, work, departure_time, cafes } = body;

  if (!home?.lat || !home?.lng || !work?.lat || !work?.lng) {
    return NextResponse.json({ error: '집과 직장 위치 정보가 필요합니다.' }, { status: 400 });
  }

  if (!departure_time?.trim()) {
    return NextResponse.json({ error: '출발 시간을 입력해 주세요.' }, { status: 400 });
  }

  if (!Array.isArray(cafes) || cafes.length === 0) {
    return NextResponse.json({ error: '카페 목록이 필요합니다.' }, { status: 400 });
  }

  // Sort cafes by detour ratio ascending, clamp to 20
  const sorted = [...cafes]
    .sort((a, b) => detourRatio(home, a, work) - detourRatio(home, b, work))
    .slice(0, 20);

  // Check cache
  const cacheKey = buildCacheKey(home, work, departure_time.trim());
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const prompt = buildPrompt(body, sorted);
    const result = await geminiModel.generateContent(prompt);
    const raw = result.response.text();
    const jsonStr = extractJson(raw);
    const parsed: GeminiCommuteResponse = safeParseJson(jsonStr);

    // Basic shape validation
    if (!Array.isArray(parsed.recommendations) || typeof parsed.route_summary !== 'string') {
      throw new Error('Unexpected response shape from Gemini');
    }

    const normalised: GeminiCommuteResponse = {
      route_summary: parsed.route_summary,
      recommendations: parsed.recommendations
        .slice(0, 3)
        .map((r) => ({
          cafe_id: String(r.cafe_id),
          cafe_name: String(r.cafe_name),
          reason: String(r.reason),
          estimated_timeline: String(r.estimated_timeline),
        })),
    };

    setCache(cacheKey, normalised);
    return NextResponse.json(normalised);
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    const errorStatus = (err as { errorDetails?: { status?: string }[] })?.errorDetails?.[0]?.status;
    const message = (err as Error)?.message ?? '';
    console.error('[ai-commute] Gemini error:', { status, errorStatus, message, errType: typeof err, keys: err && typeof err === 'object' ? Object.keys(err) : [] });

    if (status === 429 || errorStatus === 'RESOURCE_EXHAUSTED' || message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json(EMPTY_RESPONSE, { status: 429 });
    }

    return NextResponse.json(
      { ...EMPTY_RESPONSE, error: `AI 출근길 추천 중 오류가 발생했습니다. (${status ?? message.slice(0, 50)})` },
      { status: 500 },
    );
  }
}
