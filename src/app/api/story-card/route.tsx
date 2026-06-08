import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { fetchCafeById } from '@/lib/supabase/queries';
import { formatOpeningTime } from '@/lib/cafe-utils';
import { extractGu } from '@/lib/types/cafe';

export const runtime = 'edge';

const WIDTH = 1080;
const HEIGHT = 1920;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Missing id parameter', { status: 400 });
  }

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

  const now = new Date();
  const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  const hours = now.getHours();
  const timeOfDay = hours < 7 ? '새벽' : hours < 9 ? '아침' : hours < 12 ? '오전' : '오후';
  const timeStr = `AM ${String(hours).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#FFF8F0',
          fontFamily: 'sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: 'absolute',
            top: -120,
            right: -120,
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'rgba(232, 85, 78, 0.08)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -80,
            left: -80,
            width: 300,
            height: 300,
            borderRadius: '50%',
            background: 'rgba(232, 85, 78, 0.06)',
          }}
        />

        {/* Top section — time & date */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 180,
            gap: 16,
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 600,
              color: '#B0A090',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            {dateStr}
          </div>
          <div
            style={{
              fontSize: 80,
              fontWeight: 900,
              color: '#3C2415',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            {timeStr}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                padding: '8px 24px',
                borderRadius: 999,
                backgroundColor: 'rgba(232, 85, 78, 0.12)',
                color: '#D04440',
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              {timeOfDay}
            </div>
          </div>
        </div>

        {/* Center — cafe info */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flex: 1,
            justifyContent: 'center',
            padding: '0 80px',
            gap: 32,
          }}
        >
          {/* Coffee cup icon */}
          <svg
            width="120"
            height="120"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Steam lines */}
            <path
              d="M35 25C35 18 40 15 40 8"
              fill="none"
              stroke="#E8554E"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.5"
            />
            <path
              d="M50 22C50 15 55 12 55 5"
              fill="none"
              stroke="#E8554E"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.4"
            />
            <path
              d="M65 25C65 18 70 15 70 8"
              fill="none"
              stroke="#E8554E"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.3"
            />
            {/* Cup body */}
            <rect x="20" y="35" width="55" height="45" rx="8" fill="#E8554E" />
            {/* Cup liquid */}
            <rect x="26" y="42" width="43" height="30" rx="5" fill="#D04440" />
            {/* Handle */}
            <path
              d="M75 45C82 45 86 52 86 58C86 64 82 71 75 71"
              fill="none"
              stroke="#E8554E"
              strokeWidth="6"
              strokeLinecap="round"
            />
            {/* Saucer */}
            <ellipse cx="50" cy="85" rx="40" ry="8" fill="#E5D5C0" />
          </svg>

          {/* Cafe name */}
          <div
            style={{
              fontSize: name.length > 12 ? 56 : 68,
              fontWeight: 900,
              color: '#3C2415',
              textAlign: 'center',
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              wordBreak: 'keep-all',
              maxWidth: 900,
            }}
          >
            {name}
          </div>

          {/* Badges */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {openTime && (
              <div
                style={{
                  padding: '12px 32px',
                  borderRadius: 999,
                  backgroundColor: '#E8554E',
                  color: '#FFFFFF',
                  fontSize: 30,
                  fontWeight: 700,
                }}
              >
                {openTime}
              </div>
            )}
            {gu && (
              <div
                style={{
                  padding: '12px 32px',
                  borderRadius: 999,
                  border: '3px solid #E8554E',
                  color: '#D04440',
                  fontSize: 30,
                  fontWeight: 600,
                }}
              >
                {gu}
              </div>
            )}
          </div>

          {/* Address */}
          <div
            style={{
              fontSize: 26,
              color: '#8B7355',
              fontWeight: 500,
              textAlign: 'center',
              lineHeight: 1.5,
              maxWidth: 800,
            }}
          >
            {address}
          </div>
        </div>

        {/* Bottom — branding */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingBottom: 140,
            gap: 16,
          }}
        >
          <div
            style={{
              width: 60,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#E5D5C0',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: '#E8554E',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              M
            </div>
            <div
              style={{
                fontSize: 24,
                color: '#B0A090',
                fontWeight: 600,
                letterSpacing: '0.02em',
              }}
            >
              모닝카페
            </div>
          </div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  );
}
