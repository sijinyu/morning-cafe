import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  matcher: [
    // Match all pathnames except api, _next, static files, and common assets
    '/((?!api|_next|.*\\..*).*)',
  ],
};
