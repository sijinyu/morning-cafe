import { NextRequest, NextResponse } from 'next/server';
import { geminiModel, extractJson, isGeminiConfigured } from '@/lib/ai/gemini';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CafeCompareInput {
  id: string;
  name: string;
  address: string;
  opening_time?: string | null;
  rating_score?: number | null;
  rating_count?: number | null;
  facilities?: string[] | null;
  strengths?: string[] | null;
  quiet_score?: number | null;
}

interface CompareBody {
  cafeIds: string[];
  cafes: CafeCompareInput[];
}

interface CompareRow {
  cafe_id: string;
  cafe_name: string;
  values: string[];
}

interface GeminiCompareResponse {
  comparison: {
    categories: string[];
    rows: CompareRow[];
  };
  verdict: string;
  winner_id: string;
}

// ---------------------------------------------------------------------------
// In-memory response cache (30 min TTL)
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: GeminiCompareResponse;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function getCached(key: string): GeminiCompareResponse | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: GeminiCompareResponse): void {
  responseCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function buildCacheKey(ids: string[]): string {
  return `cmp:${[...ids].sort().join(',')}`;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(cafes: CafeCompareInput[]): string {
  const cafeDescriptions = cafes
    .map((c) => {
      const lines: string[] = [
        `ID: ${c.id}`,
        `이름: ${c.name}`,
        `주소: ${c.address}`,
        `오픈시간: ${c.opening_time ?? '정보없음'}`,
      ];
      if (c.rating_score != null) {
        lines.push(`카카오 별점: ${c.rating_score.toFixed(1)} (${c.rating_count ?? 0}개 리뷰)`);
      }
      if (c.quiet_score != null) {
        lines.push(`조용함 점수: ${c.quiet_score}/10`);
      }
      if (c.facilities?.length) {
        lines.push(`편의시설: ${c.facilities.join(', ')}`);
      }
      if (c.strengths?.length) {
        lines.push(`장점: ${c.strengths.join(', ')}`);
      }
      return lines.join('\n');
    })
    .join('\n\n---\n\n');

  return `당신은 서울 아침 카페 전문가입니다.
아래 ${cafes.length}개의 카페를 비교 분석하고 결과를 JSON으로 반환하세요.

카페 정보:
${cafeDescriptions}

응답 형식은 반드시 아래 JSON만 출력하세요 (마크다운 불필요):
{
  "comparison": {
    "categories": ["비교 항목1", "비교 항목2", ...],
    "rows": [
      { "cafe_id": "카페ID", "cafe_name": "카페명", "values": ["항목1 값", "항목2 값", ...] }
    ]
  },
  "verdict": "종합 평가 (한국어, 2-3문장)",
  "winner_id": "가장 추천하는 카페의 ID"
}

규칙:
- categories는 4~6개 항목 (예: 오픈시간, 별점, 접근성, 분위기, 편의시설, 아침 추천도)
- 각 카페의 values 배열 길이는 categories 길이와 동일해야 함
- winner_id는 반드시 제공된 카페 ID 중 하나여야 함
- 반드시 한국어로 응답`;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

const EMPTY_RESPONSE: GeminiCompareResponse = {
  comparison: { categories: [], rows: [] },
  verdict: '현재 AI 비교 기능을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  winner_id: '',
};

export async function POST(request: NextRequest) {
  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: 'AI 기능이 설정되지 않았습니다.', ...EMPTY_RESPONSE },
      { status: 503 },
    );
  }

  let body: CompareBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const { cafeIds, cafes } = body;

  if (!Array.isArray(cafeIds) || cafeIds.length < 2) {
    return NextResponse.json({ error: '비교할 카페를 2개 이상 선택해 주세요.' }, { status: 400 });
  }

  if (!Array.isArray(cafes) || cafes.length < 2) {
    return NextResponse.json({ error: '카페 상세 정보가 필요합니다.' }, { status: 400 });
  }

  // Clamp to max 3 cafes
  const cafeSlice = cafes.slice(0, 3);
  const idSlice = cafeIds.slice(0, 3);

  // Check cache
  const cacheKey = buildCacheKey(idSlice);
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const prompt = buildPrompt(cafeSlice);
    const result = await geminiModel.generateContent(prompt);
    const raw = result.response.text();
    const jsonStr = extractJson(raw);
    const parsed: GeminiCompareResponse = JSON.parse(jsonStr);

    // Basic shape validation
    if (
      !parsed.comparison?.categories ||
      !Array.isArray(parsed.comparison.rows) ||
      typeof parsed.verdict !== 'string' ||
      typeof parsed.winner_id !== 'string'
    ) {
      throw new Error('Unexpected response shape from Gemini');
    }

    // Ensure winner_id is valid
    const validIds = new Set(cafeSlice.map((c) => c.id));
    const winnerId = validIds.has(parsed.winner_id) ? parsed.winner_id : (cafeSlice[0]?.id ?? '');

    const normalised: GeminiCompareResponse = {
      comparison: parsed.comparison,
      verdict: parsed.verdict,
      winner_id: winnerId,
    };

    setCache(cacheKey, normalised);
    return NextResponse.json(normalised);
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 429) {
      return NextResponse.json(EMPTY_RESPONSE, { status: 429 });
    }

    return NextResponse.json(
      { ...EMPTY_RESPONSE, error: 'AI 비교 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
