import { NextRequest, NextResponse } from 'next/server';
import { geminiModel, extractJson, isGeminiConfigured } from '@/lib/ai/gemini';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CafeInput {
  id: string;
  name: string;
  address: string;
  gu?: string | null;
  opening_time?: string | null;
  hours_by_day?: Record<string, string> | null;
  phone?: string | null;
  category?: string | null;
}

interface RecommendBody {
  query?: string;
  mode?: 'taste-finder';
  purpose?: string;
  mood?: string;
  facilities?: string[];
  userLat?: number;
  userLng?: number;
  cafes: CafeInput[];
}

interface RecommendResult {
  id: string;
  reason: string;
  score: number;
}

interface GeminiRecommendResponse {
  results: RecommendResult[];
  summary: string;
}

// ---------------------------------------------------------------------------
// In-memory response cache (30 min TTL)
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: GeminiRecommendResponse;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function getCached(key: string): GeminiRecommendResponse | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: GeminiRecommendResponse): void {
  responseCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Simple hash from query string for cache key. */
function hashQuery(query: string, cafeCount: number): string {
  let h = 0;
  for (let i = 0; i < query.length; i++) {
    h = ((h << 5) - h + query.charCodeAt(i)) | 0;
  }
  return `rec:${h}:${cafeCount}`;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(query: string, cafes: CafeInput[], userLat?: number, userLng?: number): string {
  const locationNote =
    userLat != null && userLng != null
      ? `사용자의 현재 위치는 위도 ${userLat.toFixed(4)}, 경도 ${userLng.toFixed(4)}입니다.`
      : '사용자 위치 정보가 없습니다.';

  const cafeList = cafes
    .map((c, i) => {
      const hours = c.hours_by_day
        ? Object.entries(c.hours_by_day)
            .map(([day, h]) => `${day}:${h}`)
            .join(', ')
        : c.opening_time ?? '정보없음';
      return `${i + 1}. [${c.id}] ${c.name} | ${c.address}${c.gu ? ` (${c.gu})` : ''} | 영업시간: ${hours} | 카테고리: ${c.category ?? '카페'}`;
    })
    .join('\n');

  return `당신은 서울 아침 카페 전문가입니다.
사용자 요청: "${query}"
${locationNote}

아래 카페 목록에서 사용자의 요청에 가장 잘 맞는 카페를 최대 5개 추천하세요.

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
- 요청과 관련 없는 카페는 포함하지 마세요
- score는 1(낮음)~10(높음) 정수
- results는 score 내림차순 정렬
- 최대 5개까지만 반환
- 반드시 한국어로 응답`;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

const EMPTY_RESPONSE: GeminiRecommendResponse = {
  results: [],
  summary: '현재 AI 추천을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
};

export async function POST(request: NextRequest) {
  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: 'AI 기능이 설정되지 않았습니다.', ...EMPTY_RESPONSE },
      { status: 503 },
    );
  }

  let body: RecommendBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const { userLat, userLng, cafes } = body;

  // Build query from taste-finder mode or use raw query
  let query: string;
  if (body.mode === 'taste-finder') {
    if (!body.purpose || !body.mood) {
      return NextResponse.json({ error: '목적과 분위기를 선택해 주세요.' }, { status: 400 });
    }
    const facilityStr = body.facilities?.length ? `, 필수시설: ${body.facilities.join(', ')}` : '';
    query = `목적: ${body.purpose}, 분위기: ${body.mood}${facilityStr}`;
  } else {
    if (!body.query?.trim()) {
      return NextResponse.json({ error: '검색어를 입력해 주세요.' }, { status: 400 });
    }
    query = body.query.trim();
  }

  if (!Array.isArray(cafes) || cafes.length === 0) {
    return NextResponse.json({ error: '카페 목록이 필요합니다.' }, { status: 400 });
  }

  // Clamp to max 50 to control token usage
  const cafeSlice = cafes.slice(0, 50);

  // Check cache
  const cacheKey = hashQuery(query, cafeSlice.length);
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const prompt = buildPrompt(query, cafeSlice, userLat, userLng);
    const result = await geminiModel.generateContent(prompt);
    const raw = result.response.text();
    const jsonStr = extractJson(raw);
    const parsed: GeminiRecommendResponse = JSON.parse(jsonStr);

    // Validate shape
    if (!Array.isArray(parsed.results) || typeof parsed.summary !== 'string') {
      throw new Error('Unexpected response shape from Gemini');
    }

    // Normalise scores to integers, clamp 1-10, limit to 5
    const normalised: GeminiRecommendResponse = {
      summary: parsed.summary,
      results: parsed.results
        .slice(0, 5)
        .map((r) => ({
          id: String(r.id),
          reason: String(r.reason),
          score: Math.max(1, Math.min(10, Math.round(Number(r.score) || 5))),
        }))
        .sort((a, b) => b.score - a.score),
    };

    setCache(cacheKey, normalised);
    return NextResponse.json(normalised);
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    const message = (err as Error)?.message ?? '';
    console.error('[ai-recommend] Gemini error:', { status, message });

    if (status === 429 || message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json(EMPTY_RESPONSE, { status: 429 });
    }

    return NextResponse.json(
      { ...EMPTY_RESPONSE, error: `AI 추천 중 오류가 발생했습니다. (${status ?? message.slice(0, 50)})` },
      { status: 500 },
    );
  }
}
