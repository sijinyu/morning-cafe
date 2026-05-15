import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = '모닝커피 — 서울 아침 카페 지도';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #FFF8F0 0%, #FFF1E0 50%, #FFE8CC 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        {/* 커피잔 SVG */}
        <svg
          width="140"
          height="120"
          viewBox="0 0 72 60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* 김 (steam) */}
          <path
            d="M24 8C24 4 26 2 26 0"
            stroke="#B45309"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.3"
          />
          <path
            d="M30 6C30 2 32 0 32 -2"
            stroke="#B45309"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.4"
          />
          <path
            d="M36 8C36 4 38 2 38 0"
            stroke="#B45309"
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.3"
          />
          {/* 머그 본체 */}
          <rect x="10" y="10" width="40" height="36" rx="6" fill="#B45309" />
          {/* 커피 액체 */}
          <rect x="14" y="22" width="32" height="20" rx="4" fill="#78350F" opacity="0.8" />
          {/* 손잡이 */}
          <path
            d="M50 20C56 20 60 25 60 30C60 35 56 40 50 40"
            stroke="#B45309"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          {/* 하이라이트 */}
          <ellipse cx="24" cy="18" rx="8" ry="4" fill="white" opacity="0.2" />
        </svg>

        {/* 로고 텍스트 */}
        <div
          style={{
            marginTop: 24,
            fontSize: 64,
            fontWeight: 800,
            color: '#78350F',
            letterSpacing: '-0.02em',
          }}
        >
          모닝커피
        </div>

        {/* 서브 텍스트 */}
        <div
          style={{
            marginTop: 12,
            fontSize: 28,
            color: '#92400E',
            opacity: 0.7,
          }}
        >
          서울의 아침을 깨우는 카페
        </div>

        {/* 태그라인 */}
        <div
          style={{
            marginTop: 32,
            display: 'flex',
            gap: 16,
          }}
        >
          {['6시 오픈', '7시 오픈', '24시간', '3000+ 카페'].map((tag) => (
            <div
              key={tag}
              style={{
                padding: '8px 20px',
                borderRadius: 999,
                backgroundColor: 'rgba(180, 83, 9, 0.1)',
                color: '#92400E',
                fontSize: 20,
                fontWeight: 600,
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
