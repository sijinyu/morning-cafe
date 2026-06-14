import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  MapPin,
  Clock,
  Phone,
  ExternalLink,
  Map,
  Share2,
  ChevronLeft,
} from 'lucide-react';
import { fetchCafeById } from '@/lib/supabase/queries';
import { is24Hours, formatOpeningTime, getOpeningBadgeStyle } from '@/lib/cafe-utils';
import { cn } from '@/lib/utils';
import type { Cafe } from '@/lib/types/cafe';
import { CafeShareButton } from './share-button';

// SSR — revalidate every 24h
export const revalidate = 86400;

const BASE_URL = 'https://morning-cafe-phi.vercel.app';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const cafe = await fetchCafeById(id);

  if (!cafe) {
    return { title: '카페를 찾을 수 없습니다 — 모닝카페' };
  }

  const openTime = cafe.opening_time
    ? `아침 ${formatOpeningTime(cafe.opening_time)} 오픈`
    : '아침 카페';
  const title = `${cafe.name} — ${openTime} | 모닝카페`;
  const description = `${cafe.name} — ${cafe.road_address ?? cafe.address}. ${openTime}. 모닝카페에서 서울 아침 카페를 찾아보세요.`;
  const url = `${BASE_URL}/cafe/${id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      locale: 'ko_KR',
      siteName: '모닝카페',
      url,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
    alternates: {
      canonical: url,
    },
  };
}

/** Render opening hours table from hours_by_day */
function HoursTable({ hoursByDay }: { hoursByDay: Record<string, string> | null }) {
  if (!hoursByDay || Object.keys(hoursByDay).length === 0) return null;

  const days = ['월', '화', '수', '목', '금', '토', '일'];
  const now = new Date();
  const todayIdx = now.getDay(); // 0=Sun
  const todayLabel = ['일', '월', '화', '수', '목', '금', '토'][todayIdx];

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-foreground">영업시간</h3>
      <div className="space-y-0.5">
        {days.map((day) => {
          const hours = hoursByDay[day];
          const isToday = day === todayLabel;
          return (
            <div
              key={day}
              className={cn(
                'flex items-center gap-3 rounded-lg px-2 py-1 text-sm',
                isToday && 'bg-red-50 dark:bg-red-900/20 font-medium',
              )}
            >
              <span className={cn('w-6 text-center', isToday ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                {day}
              </span>
              <span className={isToday ? 'text-foreground' : 'text-muted-foreground'}>
                {hours ?? '정보 없음'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** JSON-LD LocalBusiness structured data */
function JsonLd({ cafe }: { cafe: Cafe }) {
  const openingTime = cafe.opening_time ? formatOpeningTime(cafe.opening_time) : null;
  const closingTime = cafe.closing_time ? formatOpeningTime(cafe.closing_time) : null;

  const openingHoursSpec = openingTime
    ? {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        opens: openingTime,
        ...(closingTime ? { closes: closingTime } : {}),
      }
    : undefined;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CafeOrCoffeeShop',
    name: cafe.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: cafe.road_address ?? cafe.address,
      addressLocality: '서울',
      addressCountry: 'KR',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: cafe.latitude,
      longitude: cafe.longitude,
    },
    ...(cafe.phone ? { telephone: cafe.phone } : {}),
    ...(openingHoursSpec ? { openingHoursSpecification: openingHoursSpec } : {}),
    url: `${BASE_URL}/cafe/${cafe.id}`,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default async function CafePage({ params }: PageProps) {
  const { id } = await params;
  const cafe = await fetchCafeById(id);

  if (!cafe) {
    notFound();
  }

  const displayAddress = cafe.road_address ?? cafe.address;
  const is24h = is24Hours(cafe);
  const openingFormatted = is24h ? '24시간 영업' : cafe.opening_time ? `${formatOpeningTime(cafe.opening_time)} 오픈` : null;
  const badgeStyle = is24h
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    : getOpeningBadgeStyle(cafe.opening_time);

  const mapLink = `/?cafeId=${cafe.id}`;

  return (
    <>
      <JsonLd cafe={cafe} />
      <div className="flex h-full flex-col bg-background">
        {/* Header */}
        <header className="sticky z-10 border-b border-border bg-background/95 backdrop-blur-md px-4 py-3" style={{ top: 'var(--safe-area-top)', paddingTop: 'calc(0.75rem + var(--safe-area-top))' }}>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
              aria-label="뒤로가기"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <h1 className="text-lg font-bold truncate flex-1">{cafe.name}</h1>
            <CafeShareButton cafe={cafe} />
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-5 space-y-5">
            {/* Name & badges */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {cafe.category && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {cafe.category}
                  </span>
                )}
                {openingFormatted && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      badgeStyle,
                    )}
                  >
                    <Clock className="h-3 w-3" />
                    {openingFormatted}
                  </span>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground leading-snug">{displayAddress}</p>
            </div>

            {/* Phone */}
            {cafe.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <a
                  href={`tel:${cafe.phone}`}
                  className="text-sm text-foreground hover:text-primary transition-colors"
                >
                  {cafe.phone}
                </a>
              </div>
            )}

            {/* Opening hours */}
            <HoursTable hoursByDay={cafe.hours_by_day} />

            {/* Kakao Map link */}
            {cafe.place_url && (
              <a
                href={cafe.place_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                카카오맵에서 보기
              </a>
            )}

            <div className="h-px bg-border" />

            {/* CTA buttons */}
            <div className="flex gap-2">
              <Link
                href={mapLink}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-2xl',
                  'bg-primary text-primary-foreground py-3.5',
                  'text-sm font-medium',
                  'hover:opacity-90 transition-opacity',
                )}
              >
                <Map className="h-4 w-4" />
                모닝카페에서 보기
              </Link>
              {cafe.place_url && (
                <a
                  href={cafe.place_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-2xl',
                    'border border-border py-3.5 px-5',
                    'text-sm font-medium text-foreground',
                    'hover:bg-muted transition-colors',
                  )}
                >
                  <ExternalLink className="h-4 w-4" />
                  카카오맵
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
