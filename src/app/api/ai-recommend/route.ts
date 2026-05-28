import { NextRequest, NextResponse } from 'next/server';
import { geminiModel, extractJson, safeParseJson, isGeminiConfigured } from '@/lib/ai/gemini';

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

function buildPrompt(query: string, cafes: CafeInput[]): string {
  const cafeList = cafes
    .map((c, i) => `${i + 1}. [${c.id}] ${c.name} | ${c.address} | ${c.opening_time ?? '정보없음'}`)
    .join('\n');

  return `너는 서울 아침 카페를 추천해주는 따뜻한 친구야.
사용자 취향: "${query}"

아래 카페 중 딱 맞는 곳을 최대 3개 골라줘.

${cafeList}

반드시 아래 JSON만 출력해 (마크다운 금지):
{"results":[{"id":"카페ID","reason":"추천 이유 1-2문장","score":1-10}],"summary":"한줄 요약"}

말투 규칙:
- 친한 언니/오빠가 추천하듯 다정하게 ("~거든요", "~어울려요", "여기 진짜 좋아요", "~어때요?")
- 이모지 1-2개 자연스럽게
- reason은 30자 이내로 짧고 감성적으로
- 딱딱한 존댓말 금지 ("~입니다" "~습니다" 쓰지마)`;
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

  // Clamp to max 30 to control token usage
  const cafeSlice = cafes.slice(0, 30);

  // Check cache
  const cacheKey = hashQuery(query, cafeSlice.length);
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const prompt = buildPrompt(query, cafeSlice);
    const result = await geminiModel.generateContent(prompt);
    const raw = result.response.text();
    const jsonStr = extractJson(raw);

    const parsed: GeminiRecommendResponse = safeParseJson(jsonStr);

    // Validate shape
    if (!Array.isArray(parsed.results) || typeof parsed.summary !== 'string') {
      throw new Error('Unexpected response shape from Gemini');
    }

    // Normalise scores to integers, clamp 1-10, limit to 3
    const normalised: GeminiRecommendResponse = {
      summary: parsed.summary,
      results: parsed.results
        .slice(0, 3)
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
    const errorStatus = (err as { errorDetails?: { status?: string }[] })?.errorDetails?.[0]?.status;
    const message = (err as Error)?.message ?? '';
    console.error('[ai-recommend] Gemini error:', { status, errorStatus, message, errType: typeof err, keys: err && typeof err === 'object' ? Object.keys(err) : [] });

    if (status === 429 || errorStatus === 'RESOURCE_EXHAUSTED' || message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json(EMPTY_RESPONSE, { status: 429 });
    }

    return NextResponse.json(
      { ...EMPTY_RESPONSE, error: `AI 추천 중 오류가 발생했습니다. (${status ?? message.slice(0, 50)})` },
      { status: 500 },
    );
  }
}
