import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

const WIDTH = 1080;
const HEIGHT = 1920;

/** 쿼리 정수 파싱 + 범위 클램프 (외부 입력 검증) */
function clampInt(raw: string | null, max: number): number {
  const n = parseInt(raw ?? '0', 10);
  if (Number.isNaN(n) || n < 0) return 0;
  return Math.min(n, max);
}

/**
 * 월간 아침 리캡 스토리 카드 (1080x1920).
 * 데이터는 클라이언트 localStorage(스탬프)에서 계산해 쿼리로 전달받는다 —
 * 서버에 사용자 기록이 없기 때문. 공유 버튼 클릭 시에만 생성되므로
 * ImageResponse CPU 비용(CLAUDE.md #56)은 무시 가능한 수준.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const ym = searchParams.get('ym') ?? '';
  const ymMatch = ym.match(/^(\d{4})-(\d{2})$/);
  if (!ymMatch) {
    return new Response('Invalid ym (YYYY-MM)', { status: 400 });
  }
  const year = ymMatch[1]!;
  const month = parseInt(ymMatch[2]!, 10);
  if (month < 1 || month > 12) {
    return new Response('Invalid month', { status: 400 });
  }

  const checkins = clampInt(searchParams.get('c'), 999);
  const cafes = clampInt(searchParams.get('k'), 999);
  const gus = clampInt(searchParams.get('g'), 99);
  if (checkins < 1) {
    return new Response('Nothing to recap', { status: 400 });
  }

  const earliestRaw = searchParams.get('e') ?? '';
  const earliest = /^\d{2}:\d{2}$/.test(earliestRaw) ? earliestRaw : null;
  const topGu = (searchParams.get('t') ?? '').slice(0, 12) || null;

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
        {/* Decorative circles — story-card와 동일한 디자인 언어 */}
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

        {/* Top — month */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 200,
            gap: 20,
          }}
        >
          <div
            style={{
              fontSize: 30,
              fontWeight: 600,
              color: '#B0A090',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            MY MORNING RECAP
          </div>
          <div
            style={{
              fontSize: 76,
              fontWeight: 900,
              color: '#3C2415',
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            {`${year}년 ${month}월`}
          </div>
        </div>

        {/* Center — big number + stats */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            flex: 1,
            justifyContent: 'center',
            padding: '0 80px',
            gap: 40,
          }}
        >
          {/* Coffee cup */}
          <svg width="130" height="130" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M35 25C35 18 40 15 40 8" fill="none" stroke="#E8554E" strokeWidth="3" strokeLinecap="round" opacity="0.5" />
            <path d="M50 22C50 15 55 12 55 5" fill="none" stroke="#E8554E" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
            <path d="M65 25C65 18 70 15 70 8" fill="none" stroke="#E8554E" strokeWidth="3" strokeLinecap="round" opacity="0.3" />
            <rect x="20" y="35" width="55" height="45" rx="8" fill="#E8554E" />
            <rect x="26" y="42" width="43" height="30" rx="5" fill="#D04440" />
            <path d="M75 45C82 45 86 52 86 58C86 64 82 71 75 71" fill="none" stroke="#E8554E" strokeWidth="6" strokeLinecap="round" />
            <ellipse cx="50" cy="85" rx="40" ry="8" fill="#E5D5C0" />
          </svg>

          {/* Big number */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <div
              style={{
                fontSize: 180,
                fontWeight: 900,
                color: '#E8554E',
                lineHeight: 1,
                letterSpacing: '-0.04em',
              }}
            >
              {String(checkins)}
            </div>
            <div style={{ fontSize: 56, fontWeight: 800, color: '#3C2415' }}>번의 아침</div>
          </div>

          {/* Stat pills */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div
              style={{
                padding: '14px 32px',
                borderRadius: 999,
                backgroundColor: 'rgba(232, 85, 78, 0.12)',
                color: '#D04440',
                fontSize: 32,
                fontWeight: 700,
              }}
            >
              {`카페 ${cafes}곳`}
            </div>
            <div
              style={{
                padding: '14px 32px',
                borderRadius: 999,
                backgroundColor: 'rgba(232, 85, 78, 0.12)',
                color: '#D04440',
                fontSize: 32,
                fontWeight: 700,
              }}
            >
              {`동네 ${gus}곳`}
            </div>
          </div>

          {(earliest || topGu) && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
                fontSize: 34,
                color: '#8A7560',
                fontWeight: 600,
              }}
            >
              {earliest && <div>{`가장 이른 아침 ${earliest}`}</div>}
              {topGu && <div>{`가장 자주 간 동네 · ${topGu}`}</div>}
            </div>
          )}
        </div>

        {/* Bottom — brand */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 24,
            paddingBottom: 140,
          }}
        >
          <div style={{ width: 60, height: 4, borderRadius: 2, backgroundColor: '#E5D5C0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
            <div style={{ fontSize: 24, color: '#B0A090', fontWeight: 600, letterSpacing: '0.02em' }}>
              모닝카페
            </div>
          </div>
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  );
}
