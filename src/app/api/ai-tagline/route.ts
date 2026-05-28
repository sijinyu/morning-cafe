import { NextRequest, NextResponse } from 'next/server';
import { geminiModel, extractJson, isGeminiConfigured } from '@/lib/ai/gemini';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaglineBody {
  cafeId: string;
  name: string;
  strengths?: string[];
  facilities?: string[];
  rating?: { score: number; count: number } | null;
  reviewSnippets?: string[];
}

interface GeminiTaglineResponse {
  tagline: string;
}

// ---------------------------------------------------------------------------
// In-memory response cache (7 days — taglines rarely change)
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: GeminiTaglineResponse;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getCached(key: string): GeminiTaglineResponse | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: GeminiTaglineResponse): void {
  responseCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(body: TaglineBody): string {
  const details: string[] = [];
  if (body.strengths?.length) details.push(`장점: ${body.strengths.join(', ')}`);
  if (body.facilities?.length) details.push(`편의시설: ${body.facilities.join(', ')}`);
  if (body.rating) details.push(`별점: ${body.rating.score.toFixed(1)} (${body.rating.count}개 리뷰)`);
  if (body.reviewSnippets?.length) details.push(`리뷰 발췌: ${body.reviewSnippets.join(' / ')}`);

  return `카페: ${body.name}
${details.length > 0 ? details.join(', ') : ''}

이 카페를 친구에게 소개하듯 한줄로 표현해줘 (15~20자).
반드시 JSON만: {"tagline":"한줄"}
- 다정한 톤 ("~거든요", "~좋아요")
- 딱딱한 존댓말 금지`;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  if (!isGeminiConfigured()) {
    return NextResponse.json({ tagline: '' }, { status: 503 });
  }

  let body: TaglineBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: '카페 이름이 필요합니다.' }, { status: 400 });
  }

  // Check cache
  const cacheKey = `tag:${body.cafeId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  try {
    const prompt = buildPrompt(body);
    const result = await geminiModel.generateContent(prompt);
    const raw = result.response.text();
    const jsonStr = extractJson(raw);
    const parsed: GeminiTaglineResponse = JSON.parse(jsonStr);

    if (typeof parsed.tagline !== 'string') {
      throw new Error('Unexpected response shape');
    }

    const normalised: GeminiTaglineResponse = {
      tagline: parsed.tagline.slice(0, 40), // safety limit
    };

    setCache(cacheKey, normalised);
    return NextResponse.json(normalised);
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    const message = (err as Error)?.message ?? '';
    console.error('[ai-tagline] Gemini error:', { status, message });

    if (status === 429 || message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json({ tagline: '' });
    }

    return NextResponse.json({ tagline: '', error: `AI 분석 중 오류 발생 (${status ?? message.slice(0, 50)})` }, { status: 500 });
  }
}
