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
  opening_time?: string | null;
  category?: string | null;
}

interface DailyPickBody {
  userLat?: number;
  userLng?: number;
  cafes: CafeInput[];
}

interface GeminiDailyPickResponse {
  cafe_id: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// In-memory response cache (1 hour TTL — daily pick changes less frequently)
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: GeminiDailyPickResponse;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000;

function getCached(key: string): GeminiDailyPickResponse | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: GeminiDailyPickResponse): void {
  responseCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function buildCacheKey(cafeIds: string[]): string {
  const now = new Date();
  const dateKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}`;
  return `daily:${dateKey}:${cafeIds.slice(0, 5).join(',')}`;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(cafes: CafeInput[], userLat?: number, userLng?: number): string {
  const now = new Date();
  const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  const dayOfWeek = dayNames[now.getDay()];
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const locationNote =
    userLat != null && userLng != null
      ? `사용자 위치: 위도 ${userLat.toFixed(4)}, 경도 ${userLng.toFixed(4)}`
      : '사용자 위치 정보 없음';

  const cafeList = cafes
    .map(
      (c, i) =>
        `${i + 1}. [${c.id}] ${c.name} | ${c.address} | 오픈: ${c.opening_time ?? '정보없음'} | 카테고리: ${c.category ?? '카페'}`,
    )
    .join('\n');

  return `너는 서울 아침 카페를 추천해주는 따뜻한 친구야.
지금은 ${dayOfWeek} ${timeStr}이야.

아래 카페 중 지금 가기 딱 좋은 1곳을 골라줘.

${cafeList}

반드시 아래 JSON만 출력해 (마크다운 금지):
{"cafe_id":"카페ID","reason":"추천 이유 1-2문장"}

말투 규칙:
- 친한 친구가 카톡으로 추천하듯 다정하게 ("~거든요", "여기 어때요?", "~딱이에요")
- 이모지 1-2개 자연스럽게
- 오늘 요일/시간 분위기를 살려서
- 딱딱한 존댓말 금지 ("~입니다" "~습니다" 쓰지마)`;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

const EMPTY_RESPONSE: GeminiDailyPickResponse = {
  cafe_id: '',
  reason: '',
};

export async function POST(request: NextRequest) {
  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { error: 'AI 기능이 설정되지 않았습니다.', ...EMPTY_RESPONSE },
      { status: 503 },
    );
  }

  let body: DailyPickBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  const { userLat, userLng, cafes } = body;

  if (!Array.isArray(cafes) || cafes.length === 0) {
    return NextResponse.json({ error: '카페 목록이 필요합니다.' }, { status: 400 });
  }

  const cafeSlice = cafes.slice(0, 20);

  // Check cache
  const cacheKey = buildCacheKey(cafeSlice.map((c) => c.id));
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const prompt = buildPrompt(cafeSlice, userLat, userLng);
    const result = await geminiModel.generateContent(prompt);
    const raw = result.response.text();
    const jsonStr = extractJson(raw);
    const parsed: GeminiDailyPickResponse = JSON.parse(jsonStr);

    if (!parsed.cafe_id || typeof parsed.reason !== 'string') {
      throw new Error('Unexpected response shape');
    }

    // Verify cafe_id is valid
    const validIds = new Set(cafeSlice.map((c) => c.id));
    const normalised: GeminiDailyPickResponse = {
      cafe_id: validIds.has(parsed.cafe_id) ? parsed.cafe_id : (cafeSlice[0]?.id ?? ''),
      reason: parsed.reason,
    };

    setCache(cacheKey, normalised);
    return NextResponse.json(normalised);
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    const message = (err as Error)?.message ?? '';
    console.error('[ai-daily-pick] Gemini error:', { status, message });

    if (status === 429 || message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json({
        cafe_id: cafeSlice[0]?.id ?? '',
        reason: '오늘도 좋은 아침이에요. 가까운 카페에서 하루를 시작해보세요.',
      });
    }

    return NextResponse.json(
      { ...EMPTY_RESPONSE, error: `AI 추천 중 오류가 발생했습니다. (${status ?? message.slice(0, 50)})` },
      { status: 500 },
    );
  }
}
