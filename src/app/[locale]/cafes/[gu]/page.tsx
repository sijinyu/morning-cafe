import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Clock, ExternalLink, Map, Sparkles } from 'lucide-react';
import { localeAlternates } from '@/lib/i18n-meta';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { fetchCafesByGu, fetchAllGus } from '@/lib/supabase/queries';
import { formatOpeningTime, getOpeningBadgeStyle } from '@/lib/cafe-utils';
import { cn } from '@/lib/utils';
import type { Cafe } from '@/lib/types/cafe';

const MAX_FEATURED = 8;

export const revalidate = 86400; // 24h ISR

interface PageProps {
  params: Promise<{ locale: string; gu: string }>;
}

export async function generateStaticParams() {
  const gus = await fetchAllGus();
  return gus.map((gu) => ({ gu }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, gu } = await params;
  const decodedGu = decodeURIComponent(gu);
  const cafes = await fetchCafesByGu(decodedGu);
  const count = cafes.length;

  const t = await getTranslations({ locale, namespace: 'cafes' });
  const tMeta = await getTranslations({ locale, namespace: 'metadata' });

  const title = `${t('guTitleWithCount', { gu: decodedGu, count })} — ${tMeta('siteName')}`;
  const description = t('guDescriptionWithCount', { gu: decodedGu, count });

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: locale === 'ja' ? 'ja_JP' : locale === 'en' ? 'en_US' : 'ko_KR',
      siteName: tMeta('siteName'),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: localeAlternates(`/cafes/${encodeURIComponent(decodedGu)}`, locale),
  };
}

/** Parse opening_time to minutes for grouping. */
function parseMinutes(openingTime: string | null): number | null {
  if (!openingTime) return null;
  const parts = openingTime.split(':');
  return parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
}

type TimeGroupKey = 'before6' | 'between6and7' | 'between7and8';

interface TimeGroup {
  key: TimeGroupKey;
  cafes: Cafe[];
}

function groupByTime(cafes: Cafe[]): TimeGroup[] {
  const before6: Cafe[] = [];
  const sixToSeven: Cafe[] = [];
  const sevenToEight: Cafe[] = [];

  for (const cafe of cafes) {
    const minutes = parseMinutes(cafe.opening_time);
    if (minutes === null) continue;
    if (minutes < 360) {
      before6.push(cafe);
    } else if (minutes < 420) {
      sixToSeven.push(cafe);
    } else {
      sevenToEight.push(cafe);
    }
  }

  const groups: TimeGroup[] = [];
  if (before6.length > 0) groups.push({ key: 'before6', cafes: before6 });
  if (sixToSeven.length > 0) groups.push({ key: 'between6and7', cafes: sixToSeven });
  if (sevenToEight.length > 0) groups.push({ key: 'between7and8', cafes: sevenToEight });

  return groups;
}

export default async function GuPage({ params }: PageProps) {
  const { locale, gu } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'cafes' });
  const tCafe = await getTranslations({ locale, namespace: 'cafe' });

  const decodedGu = decodeURIComponent(gu);
  const cafes = await fetchCafesByGu(decodedGu);
  const allGus = await fetchAllGus();
  const otherGus = allGus.filter((g) => g !== decodedGu);
  const timeGroups = groupByTime(cafes);

  // Featured cafes: sort by earliest opening time (earlybirds first)
  const featuredCafes = [...cafes]
    .filter((c) => c.opening_time)
    .sort((a, b) => {
      const aMin = parseMinutes(a.opening_time) ?? 999;
      const bMin = parseMinutes(b.opening_time) ?? 999;
      return aMin - bMin;
    })
    .slice(0, MAX_FEATURED);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border px-5 py-5" style={{ paddingTop: 'calc(1.25rem + var(--safe-area-top))' }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{t('guTitle', { gu: decodedGu })}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('guSubtitle', { count: cafes.length })}
            </p>
          </div>
          <Link
            href={`/?gu=${encodeURIComponent(decodedGu)}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600"
          >
            <Map className="h-4 w-4" />
            {t('viewOnMap')}
          </Link>
        </div>
      </header>

      {/* Cafe list */}
      <div className="flex-1 overflow-y-auto">
        {/* Featured cafes */}
        {featuredCafes.length > 0 && (
          <section className="px-5 py-4">
            <div className="flex items-center gap-1.5 mb-3">
              <Sparkles className="h-4 w-4 text-red-500" />
              <h2 className="text-sm font-semibold text-foreground">{t('earlybirdSection')}</h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
              {featuredCafes.map((cafe) => (
                <FeaturedCafeCard key={cafe.id} cafe={cafe} />
              ))}
            </div>
          </section>
        )}
        {cafes.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
            <MapPin className="h-10 w-10 stroke-1" />
            <p className="text-sm">{t('guEmpty', { gu: decodedGu })}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {timeGroups.map((group) => (
              <section key={group.key} className="py-4">
                <h2 className="mb-3 px-5 text-sm font-semibold text-muted-foreground">
                  {t(group.key)} ({group.cafes.length})
                </h2>
                <ul className="divide-y divide-border/50">
                  {group.cafes.map((cafe) => (
                    <CafeCard key={cafe.id} cafe={cafe} kakaoMapLabel={tCafe('kakaoMap')} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {/* Other districts */}
        {otherGus.length > 0 && (
          <section className="border-t border-border px-5 py-6">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              {t('otherDistricts')}
            </h2>
            <div className="flex flex-wrap gap-2">
              {otherGus.map((g) => (
                <Link
                  key={g}
                  href={`/cafes/${encodeURIComponent(g)}`}
                  className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-red-400 hover:text-red-600"
                >
                  {g}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function FeaturedCafeCard({ cafe }: { cafe: Cafe }) {
  const displayAddress = cafe.road_address ?? cafe.address;
  const addressShort = displayAddress.replace(/서울\S*\s+\S+구\s*/, '');

  return (
    <Link
      href={`/cafe/${cafe.id}`}
      className="flex-shrink-0 w-40 rounded-2xl border border-border bg-muted/30 p-3.5 transition-colors hover:bg-muted/60"
    >
      <div className="flex items-center gap-1.5 mb-2">
        {cafe.opening_time && (
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap',
              getOpeningBadgeStyle(cafe.opening_time),
            )}
          >
            <Clock className="mr-0.5 h-2.5 w-2.5" />
            {formatOpeningTime(cafe.opening_time)}
          </span>
        )}
      </div>
      <p className="font-semibold text-sm truncate">{cafe.name}</p>
      <p className="mt-0.5 text-xs text-muted-foreground truncate">{addressShort}</p>
    </Link>
  );
}

function CafeCard({ cafe, kakaoMapLabel }: { cafe: Cafe; kakaoMapLabel: string }) {
  const displayAddress = cafe.road_address ?? cafe.address;

  return (
    <li>
      <Link
        href={`/cafe/${cafe.id}`}
        className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{cafe.name}</span>
            {cafe.opening_time && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap',
                  getOpeningBadgeStyle(cafe.opening_time),
                )}
              >
                <Clock className="mr-0.5 h-2.5 w-2.5" />
                {formatOpeningTime(cafe.opening_time)}
              </span>
            )}
          </div>
          <p className="flex items-center gap-1 text-xs text-muted-foreground truncate">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            {displayAddress}
          </p>
          {cafe.place_url && (
            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
              <ExternalLink className="h-3 w-3" />
              {kakaoMapLabel}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}
