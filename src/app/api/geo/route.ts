import { NextRequest, NextResponse } from 'next/server';
import { isCoveredCity } from '@/lib/coverage';

/**
 * 요청자의 대략적 도시와 커버리지 여부를 반환.
 *
 * Vercel이 넣어주는 `x-vercel-ip-city` 헤더를 사용하므로 위치 권한이 필요 없다.
 * 별도 라우트로 분리한 이유: 페이지에서 `headers()`를 읽으면 해당 페이지가
 * 동적 렌더링으로 전환되어 24h ISR 캐시가 무력화된다. 라우트 핸들러만
 * 동적으로 두고 페이지는 정적 캐시를 유지한다.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const city = request.headers.get('x-vercel-ip-city');

  return NextResponse.json(
    {
      city,
      covered: isCoveredCity(city),
    },
    {
      headers: {
        // 사용자별 응답이므로 어디에도 캐시되지 않아야 한다.
        'Cache-Control': 'no-store',
      },
    },
  );
}
