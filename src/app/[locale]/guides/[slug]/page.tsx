import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MapPin, Clock, Map, ArrowLeft, Lightbulb, ChevronRight } from 'lucide-react';
import { localeAlternates } from '@/lib/i18n-meta';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { fetchAllEarlybirdCafes } from '@/lib/supabase/queries';
import {
  GUIDE_SLUGS,
  buildGuideData,
  isValidGuideSlug,
  type GuideSlug,
} from '@/lib/guides';
import { formatOpeningTime, getOpeningBadgeStyle } from '@/lib/cafe-utils';
import { cn } from '@/lib/utils';
import type { Cafe } from '@/lib/types/cafe';
import { AdFitBanner } from '@/components/adfit-banner';
import { AD_UNITS } from '@/lib/ad-units';
import { KakaoChannelCta } from '@/components/kakao-channel-cta';

export const revalidate = 86400; // 24h ISR

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
  return GUIDE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isValidGuideSlug(slug)) return {};

  const allCafes = await fetchAllEarlybirdCafes();
  const data = buildGuideData(slug, allCafes);
  const t = await getTranslations({ locale, namespace: 'guides' });
  const tMeta = await getTranslations({ locale, namespace: 'metadata' });

  const title = `${t(`${slug}.titleWithCount`, { count: data.stats.totalCount })} — ${tMeta('siteName')}`;
  const description = t(`${slug}.description`);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      locale: locale === 'ja' ? 'ja_JP' : locale === 'en' ? 'en_US' : 'ko_KR',
      siteName: tMeta('siteName'),
    },
    twitter: { card: 'summary_large_image', title, description },
    alternates: localeAlternates(`/guides/${slug}`, locale),
  };
}

export default async function GuidePage({ params }: PageProps) {
  const { locale, slug } = await params;
  if (!isValidGuideSlug(slug)) notFound();

  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'guides' });
  const tCafes = await getTranslations({ locale, namespace: 'cafes' });

  const allCafes = await fetchAllEarlybirdCafes();
  const data = buildGuideData(slug, allCafes);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header
        className="border-b border-border px-5 py-5"
        style={{ paddingTop: 'calc(1.25rem + var(--safe-area-top))' }}
      >
        <Link
          href="/guides"
          className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          {t('allGuides')}
        </Link>
        <h1 className="text-xl font-bold leading-tight">
          {t(`${slug}.titleWithCount`, { count: data.stats.totalCount })}
        </h1>
        <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
          <span className="font-medium text-red-600">
            {t('cafeCount', { count: data.stats.totalCount })}
          </span>
          <span>{t('districtCount', { count: data.stats.districtCount })}</span>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Intro */}
        <section className="px-5 py-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t(`${slug}.intro`, { count: data.stats.districtCount })}
          </p>
        </section>

        {/* Tip box */}
        <section className="mx-5 mb-4 rounded-xl bg-amber-50 p-3.5 dark:bg-amber-950/30">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 flex-shrink-0 text-amber-600 mt-0.5" />
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              {t(`${slug}.tip`)}
            </p>
          </div>
        </section>

        {/* Empty state */}
        {data.cafes.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            {slug === 'new-cafes'
              ? t('new-cafes.description')
              : t('cafeCount', { count: 0 })}
          </div>
        ) : (
          /* Cafes grouped by district */
          <div className="divide-y divide-border">
            {data.grouped.map(({ gu, cafes }) => (
              <section key={gu} className="py-4">
                <div className="mb-3 flex items-center justify-between px-5">
                  <h2 className="text-sm font-semibold">
                    {gu}{' '}
                    <span className="font-normal text-muted-foreground">
                      ({cafes.length})
                    </span>
                  </h2>
                  <Link
                    href={`/?gu=${encodeURIComponent(gu)}`}
                    className="flex items-center gap-0.5 text-xs text-red-500 hover:text-red-600 transition-colors"
                  >
                    <Map className="h-3 w-3" />
                    {tCafes('viewOnMap')}
                  </Link>
                </div>
                <ul>
                  {cafes.slice(0, 10).map((cafe, index) => (
                    <GuideCafeCard
                      key={cafe.id}
                      cafe={cafe}
                      rank={index + 1}
                      slug={slug}
                    />
                  ))}
                  {cafes.length > 10 && (
                    <li className="px-5 py-2">
                      <Link
                        href={`/cafes/${encodeURIComponent(gu)}`}
                        className="flex items-center justify-center gap-1 rounded-xl border border-border py-2.5 text-sm text-muted-foreground hover:border-red-400 hover:text-red-600 transition-colors"
                      >
                        +{cafes.length - 10}곳 더 보기
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </li>
                  )}
                </ul>
              </section>
            ))}
          </div>
        )}

        <div className="px-5 pt-5">
          <KakaoChannelCta placement="guide" />
        </div>

        <AdFitBanner unit={AD_UNITS.guide} className="flex justify-center px-5 py-4" />

        {/* Other guides */}
        <section className="border-t border-border px-5 py-6">
          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            {t('allGuides')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {GUIDE_SLUGS.filter((s) => s !== slug).map((s) => (
              <Link
                key={s}
                href={`/guides/${s}`}
                className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-red-400 hover:text-red-600"
              >
                {t(`${s}.title`)}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function GuideCafeCard({
  cafe,
  rank,
  slug,
}: {
  cafe: Cafe;
  rank: number;
  slug: GuideSlug;
}) {
  const displayAddress = cafe.road_address ?? cafe.address;
  // Strip leading "서울 XXX구 " for brevity
  const shortAddress = displayAddress.replace(/^서울\S*\s+\S+구\s*/, '');

  return (
    <li>
      <Link
        href={`/cafe/${cafe.id}`}
        className="flex items-start gap-3 px-5 py-3 hover:bg-muted/50 transition-colors"
      >
        {/* Rank number */}
        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
          {rank}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">{cafe.name}</span>
            {cafe.opening_time && slug !== '24h-cafes' && (
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
            {shortAddress}
          </p>
        </div>
      </Link>
    </li>
  );
}
