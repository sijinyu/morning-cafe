import { ImageResponse } from 'next/og';
import { fetchCafesByGu } from '@/lib/supabase/queries';

export const runtime = 'edge';
export const alt = '모닝카페 — 구별 아침 카페';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({ params }: { params: Promise<{ gu: string }> }) {
  const { gu } = await params;
  const decodedGu = decodeURIComponent(gu);

  let count = 0;
  try {
    const cafes = await fetchCafesByGu(decodedGu);
    count = cafes.length;
  } catch {
    // Fallback to 0 if fetch fails during build
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#FFF8F0',
          fontFamily: 'sans-serif',
          padding: '60px 80px',
        }}
      >
        {/* Left: Text */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* District name */}
          <div
            style={{
              fontSize: 64,
              fontWeight: 900,
              color: '#E8554E',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            {decodedGu}
          </div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 900,
              color: '#E8554E',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
              marginTop: 4,
            }}
          >
            아침 카페
          </div>

          {/* Count */}
          <div
            style={{
              marginTop: 24,
              fontSize: 28,
              color: '#8B6914',
              fontWeight: 600,
            }}
          >
            {count}곳의 얼리버드 카페
          </div>

          {/* Tag pills */}
          <div
            style={{
              marginTop: 36,
              display: 'flex',
              gap: 12,
            }}
          >
            {['6시 오픈', '7시 오픈', '아침 카페'].map((tag) => (
              <div
                key={tag}
                style={{
                  padding: '8px 18px',
                  borderRadius: 999,
                  border: '2px solid #E8554E',
                  backgroundColor: '#FFF8F0',
                  color: '#E8554E',
                  fontSize: 18,
                  fontWeight: 600,
                }}
              >
                {tag}
              </div>
            ))}
          </div>

          {/* Brand */}
          <div
            style={{
              marginTop: 40,
              fontSize: 16,
              color: '#B0A090',
              letterSpacing: '0.08em',
              fontWeight: 500,
            }}
          >
            morning-cafe-phi.vercel.app
          </div>
        </div>

        {/* Right: Pin marker SVG */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            width: 300,
            height: 420,
          }}
        >
          {/* Coffee splash dots */}
          {[
            { left: 30, top: 60, size: 14 },
            { left: 250, top: 80, size: 10 },
            { left: 50, top: 300, size: 12 },
            { left: 240, top: 280, size: 10 },
            { left: 140, top: 20, size: 8 },
          ].map((dot, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: dot.left,
                top: dot.top,
                width: dot.size,
                height: dot.size,
                borderRadius: '50%',
                backgroundColor: '#5C3A1E',
                opacity: 0.4,
              }}
            />
          ))}

          {/* Pin marker SVG */}
          <svg
            width="250"
            height="340"
            viewBox="0 0 100 130"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M50 126C50 126 10 72 10 42C10 19.9 27.9 2 50 2C72.1 2 90 19.9 90 42C90 72 50 126 50 126Z"
              fill="#E8554E"
            />
            <ellipse cx="38" cy="28" rx="18" ry="14" fill="white" opacity="0.18" />
            <circle cx="50" cy="42" r="24" fill="#5C3A1E" />
            <rect x="37" y="35" width="20" height="16" rx="3" fill="#FFF8F0" />
            <rect x="39" y="40" width="16" height="9" rx="2" fill="#A0652A" />
            <path
              d="M57 38C60 38 62 41 62 43C62 45 60 48 57 48"
              fill="none"
              stroke="#FFF8F0"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    ),
    { ...size },
  );
}
