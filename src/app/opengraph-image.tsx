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
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#FFF8F0',
          fontFamily: 'sans-serif',
          padding: '60px 80px',
        }}
      >
        {/* 좌측: 텍스트 */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* 타이틀 2줄 */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: '#E8501F',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            MORNING
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 900,
              color: '#E8501F',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            CAFE
          </div>

          {/* 서브 텍스트 */}
          <div
            style={{
              marginTop: 20,
              fontSize: 24,
              color: '#8B6914',
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}
          >
            FIND YOUR MORNING SPOT
          </div>

          {/* 태그 pills */}
          <div
            style={{
              marginTop: 36,
              display: 'flex',
              gap: 12,
            }}
          >
            {['6시 오픈', '7시 오픈', '24시간', '3000+ 카페'].map((tag) => (
              <div
                key={tag}
                style={{
                  padding: '8px 18px',
                  borderRadius: 999,
                  border: '2px solid #E8501F',
                  backgroundColor: '#FFF8F0',
                  color: '#E8501F',
                  fontSize: 18,
                  fontWeight: 600,
                }}
              >
                {tag}
              </div>
            ))}
          </div>

          {/* EST. 2026 */}
          <div
            style={{
              marginTop: 40,
              fontSize: 14,
              color: '#B0A090',
              letterSpacing: '0.1em',
              fontWeight: 500,
            }}
          >
            EST. 2026
          </div>
        </div>

        {/* 우측: 큰 핀 마커 SVG + 커피 스플래시 */}
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
          {/* 커피 스플래시 점들 */}
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

          {/* 핀 마커 SVG */}
          <svg
            width="250"
            height="340"
            viewBox="0 0 100 130"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* 핀 몸체 */}
            <path
              d="M50 126C50 126 10 72 10 42C10 19.9 27.9 2 50 2C72.1 2 90 19.9 90 42C90 72 50 126 50 126Z"
              fill="#E8501F"
            />
            {/* 하이라이트 */}
            <ellipse cx="38" cy="28" rx="18" ry="14" fill="white" opacity="0.18" />
            {/* 핀 안의 원 */}
            <circle cx="50" cy="42" r="24" fill="#5C3A1E" />
            {/* 커피잔 */}
            <rect x="37" y="35" width="20" height="16" rx="3" fill="#FFF8F0" />
            {/* 커피 액체 */}
            <rect x="39" y="40" width="16" height="9" rx="2" fill="#A0652A" />
            {/* 손잡이 */}
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
