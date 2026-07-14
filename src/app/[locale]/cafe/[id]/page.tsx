import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  MapPin,
  Clock,
  Phone,
  ExternalLink,
  Map,
  ChevronLeft,
} from 'lucide-react';
import { fetchCafeById } from '@/lib/supabase/queries';
import { is24Hours, formatOpeningTime, getOpeningBadgeStyle } from '@/lib/cafe-utils';
import { romanizeAddress } from '@/lib/romanize';
import { cn } from '@/lib/utils';
import { extractGu, type Cafe } from '@/lib/types/cafe';
import { CafeShareButton } from './share-button';

// SSR — revalidate every 24h
export const revalidate = 86400;

const BASE_URL = 'https://morning-cafe-phi.vercel.app';

interface PageProps {
  params: Promise<{ id: string; locale: string }>;
}

/** JSON-LD addressLocality: 주소 첫 토큰에서 도시/특별시 레벨 지역명 추출 */
function extractLocality(cafe: Cafe): string {
  const address = cafe.road_address ?? cafe.address;
  const firstToken = address.trim().split(/\s+/)[0] ?? '';
  // 서울특별시, 서울시, 서울 → 서울
  if (firstToken.startsWith('서울')) return '서울';
  // 경기도, 경기 → extractGu로 시명 추출 (예: "성남시 분당구" → "성남", "하남시" → "하남")
  if (firstToken.startsWith('경기')) {
    const gu = extractGu(address);
    if (gu) {
      const city = gu.split(/\s+/)[0] ?? gu; // "성남시 분당구" → "성남시"
      return city.replace(/[시군]$/, '');
    }
    return '경기';
  }
  // 기타: 첫 토큰에서 시/도 접미사 제거 (예: "인천광역시" → "인천")
  return firstToken.replace(/(특별시|광역시|특별자치시|특별자치도|도|시|군)$/, '') || firstToken;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id, locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cafeDetail' });
  const tMeta = await getTranslations({ locale, namespace: 'metadata' });
  const cafe = await fetchCafeById(id);

  if (!cafe) {
    return { title: t('notFound') };
  }

  const openTime = cafe.opening_time ? formatOpeningTime(cafe.opening_time) : '';
  const gu = extractGu(cafe.road_address ?? cafe.address) ?? '';
  const title = t('title', { name: cafe.name });
  const description = t('description', { name: cafe.name, gu, time: openTime });
  const url = `${BASE_URL}/cafe/${id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      locale: locale === 'ja' ? 'ja_JP' : locale === 'en' ? 'en_US' : 'ko_KR',
      siteName: tMeta('siteName'),
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

// 요일 데이터 상수: hours_by_day 룩업 키(DB값, 건드리지 않음) → i18n 라벨 키 매핑
const DAY_KEYS = ['월', '화', '수', '목', '금', '토', '일'] as const;
const DAY_LABEL_KEYS: Record<string, string> = {
  월: 'mon',
  화: 'tue',
  수: 'wed',
  목: 'thu',
  금: 'fri',
  토: 'sat',
  일: 'sun',
};

interface HoursTableTranslators {
  title: string;
  noInfo: string;
  dayLabel: (dayKey: string) => string;
}

/** Render opening hours table from hours_by_day */
function HoursTable({
  hoursByDay,
  t,
}: {
  hoursByDay: Record<string, string> | null;
  t: HoursTableTranslators;
}) {
  if (!hoursByDay || Object.keys(hoursByDay).length === 0) return null;

  const now = new Date();
  const todayIdx = now.getDay(); // 0=Sun
  const todayLabel = ['일', '월', '화', '수', '목', '금', '토'][todayIdx];

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-foreground">{t.title}</h3>
      <div className="space-y-0.5">
        {DAY_KEYS.map((day) => {
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
                {t.dayLabel(day)}
              </span>
              <span className={isToday ? 'text-foreground' : 'text-muted-foreground'}>
                {hours ?? t.noInfo}
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
      addressLocality: extractLocality(cafe),
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
  const { id, locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'cafeDetail' });
  const tCafe = await getTranslations({ locale, namespace: 'cafe' });
  const tFilter = await getTranslations({ locale, namespace: 'filter' });
  const cafe = await fetchCafeById(id);

  if (!cafe) {
    notFound();
  }

  const displayAddress = romanizeAddress(cafe.road_address ?? cafe.address, locale);
  const is24h = is24Hours(cafe);
  const openingFormatted = is24h
    ? tCafe('hours24Full')
    : cafe.opening_time
      ? t('openAt', { time: formatOpeningTime(cafe.opening_time) })
      : null;
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
              aria-label={t('back')}
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
            <HoursTable
              hoursByDay={cafe.hours_by_day}
              t={{
                title: t('hoursTable'),
                noInfo: tCafe('noInfo'),
                dayLabel: (dayKey) => tFilter(`days.${DAY_LABEL_KEYS[dayKey]}`),
              }}
            />

            {/* Kakao Map link */}
            {cafe.place_url && (
              <a
                href={cafe.place_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                {t('viewOnKakao')}
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
                {t('viewOnApp')}
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
                  {tCafe('kakaoMap')}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
