import { ImageResponse } from 'next/og';
import { fetchCafeById } from '@/lib/supabase/queries';
import { formatOpeningTime } from '@/lib/cafe-utils';
import { extractGu } from '@/lib/types/cafe';

export const runtime = 'edge';
export const alt = '모닝커피 — 서울 아침 카페';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let name = '카페';
  let address = '서울';
  let openTime = '';
  let gu = '';

  try {
    const cafe = await fetchCafeById(id);
    if (cafe) {
      name = cafe.name;
      address = cafe.road_address ?? cafe.address;
      gu = extractGu(cafe.address) ?? '';
      const is24h = cafe.opening_time === '00:00:00' && (cafe.closing_time === '00:00:00' || cafe.closing_time === '24:00:00');
      openTime = is24h ? '24시간 영업' : cafe.opening_time ? `${formatOpeningTime(cafe.opening_time)} 오픈` : '';
    }
  } catch {
    // fallback
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
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, maxWidth: 750 }}>
          {/* Cafe name */}
          <div
            style={{
              fontSize: name.length > 15 ? 48 : 56,
              fontWeight: 900,
              color: '#3C2415',
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              wordBreak: 'keep-all',
            }}
          >
            {name}
          </div>

          {/* Opening time badge */}
          {openTime && (
            <div
              style={{
                marginTop: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  padding: '10px 24px',
                  borderRadius: 999,
                  backgroundColor: '#F59E0B',
                  color: '#FFFFFF',
                  fontSize: 24,
                  fontWeight: 700,
                }}
              >
                {openTime}
              </div>
              {gu && (
                <div
                  style={{
                    padding: '10px 24px',
                    borderRadius: 999,
                    border: '2px solid #F59E0B',
                    color: '#F59E0B',
                    fontSize: 24,
                    fontWeight: 600,
                  }}
                >
                  {gu}
                </div>
              )}
            </div>
          )}

          {/* Address */}
          <div
            style={{
              marginTop: 20,
              fontSize: 22,
              color: '#8B7355',
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            {address}
          </div>

          {/* Brand */}
          <div
            style={{
              marginTop: 40,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: '#F59E0B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontSize: 18,
                fontWeight: 900,
              }}
            >
              M
            </div>
            <div
              style={{
                fontSize: 20,
                color: '#B0A090',
                fontWeight: 600,
                letterSpacing: '0.02em',
              }}
            >
              모닝커피 — 서울 아침 카페 지도
            </div>
          </div>
        </div>

        {/* Right: Pin marker */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 280,
            height: 400,
          }}
        >
          <svg
            width="220"
            height="300"
            viewBox="0 0 100 130"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M50 126C50 126 10 72 10 42C10 19.9 27.9 2 50 2C72.1 2 90 19.9 90 42C90 72 50 126 50 126Z"
              fill="#F59E0B"
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
