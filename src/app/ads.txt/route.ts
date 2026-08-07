const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

export function GET(): Response {
  if (!ADSENSE_CLIENT) {
    return new Response(null, { status: 404 });
  }
  // ads.txt는 "pub-" 접두사 사용 (client ID의 "ca-" 제거)
  const publisherId = ADSENSE_CLIENT.replace(/^ca-/, '');
  return new Response(`google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { 'Content-Type': 'text/plain' },
  });
}
