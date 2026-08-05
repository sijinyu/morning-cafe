import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from './i18n/routing';
import { GEO_COOKIE_NAME, normalizeCity } from './lib/coverage';

const handleI18nRouting = createMiddleware(routing);

/** 지역 쿠키 수명 — 하루면 충분하다(사용자 위치는 자주 안 바뀐다). */
const GEO_COOKIE_MAX_AGE = 60 * 60 * 24;

/**
 * i18n 라우팅 + 지역 쿠키 주입.
 *
 * 미들웨어는 이미 모든 페이지 요청에서 실행되므로, 여기서 Vercel의
 * `x-vercel-ip-city`를 정규화해 쿠키로 심으면 클라이언트가 **추가 함수 호출
 * 없이** 커버리지를 판정할 수 있다. 별도 `/api/geo` 라우트는 페이지뷰마다
 * 서버리스 함수를 깨워 Fluid Active CPU를 낭비했다.
 */
export default function middleware(request: NextRequest) {
  const response = handleI18nRouting(request);

  const city = request.headers.get('x-vercel-ip-city');
  if (city) {
    const normalized = normalizeCity(city);
    if (normalized) {
      response.cookies.set(GEO_COOKIE_NAME, normalized, {
        path: '/',
        sameSite: 'lax',
        maxAge: GEO_COOKIE_MAX_AGE,
        // 클라이언트 컴포넌트가 읽어야 하므로 httpOnly를 쓰지 않는다.
        // 대략적인 도시명일 뿐이라 민감 정보가 아니다.
        httpOnly: false,
      });
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match all pathnames except api, _next, static files, and common assets
    '/((?!api|_next|.*\\..*).*)',
  ],
};
