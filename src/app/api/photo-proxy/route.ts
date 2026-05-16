import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = new Set([
  'postfiles.pstatic.net',
  'blogfiles.pstatic.net',
  'blogpfthumb-phinf.pstatic.net',
]);

const ALLOWED_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
];

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

const PROXY_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Referer: 'https://search.naver.com/',
  Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
};

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url');

  if (!rawUrl) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return new NextResponse('Invalid url', { status: 400 });
  }

  if (parsed.protocol !== 'https:') {
    return new NextResponse('Only HTTPS URLs allowed', { status: 403 });
  }

  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(parsed.hostname)) {
    return new NextResponse('IP addresses not allowed', { status: 403 });
  }

  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return new NextResponse('Host not allowed', { status: 403 });
  }

  try {
    const upstream = await fetch(rawUrl, {
      headers: PROXY_HEADERS,
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      return new NextResponse('Upstream error', { status: upstream.status });
    }

    const contentLength = upstream.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_SIZE) {
      return new NextResponse('File too large', { status: 413 });
    }

    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
    if (!ALLOWED_MIMES.some((mime) => contentType.startsWith(mime))) {
      return new NextResponse('Invalid content type', { status: 415 });
    }

    const body = upstream.body;

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'",
      },
    });
  } catch {
    return new NextResponse('Failed to fetch image', { status: 502 });
  }
}
