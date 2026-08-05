import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { waitlistRegionKey } from '@/lib/coverage';

/** 지역 키 최대 길이 — 정규화된 로마자 도시명은 훨씬 짧다. */
const MAX_REGION_LENGTH = 64;

interface WaitlistBody {
  region?: unknown;
  subscribedChannel?: unknown;
}

/** referrer에서 호스트만 추출 (쿼리스트링·경로는 저장하지 않는다). */
function referrerHost(request: NextRequest): string | null {
  const referer = request.headers.get('referer');
  if (!referer) return null;
  try {
    return new URL(referer).host;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  let body: WaitlistBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 경계에서 검증 — 클라이언트가 보낸 값은 신뢰하지 않는다.
  if (typeof body.region !== 'string') {
    return NextResponse.json({ error: 'region is required' }, { status: 400 });
  }

  const rawCity = body.region.slice(0, MAX_REGION_LENGTH);
  const region = waitlistRegionKey(rawCity);

  if (!region) {
    return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
  }

  const subscribedChannel = body.subscribedChannel === true;

  try {
    const supabase = createServiceClient();

    const { error } = await supabase.from('region_waitlist').insert({
      region,
      raw_city: rawCity,
      subscribed_channel: subscribedChannel,
      referrer_host: referrerHost(request),
    });

    if (error) {
      return NextResponse.json({ error: 'Failed to save request' }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
