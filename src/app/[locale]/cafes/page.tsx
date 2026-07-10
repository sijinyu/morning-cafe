import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Coffee } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { fetchGuStats } from '@/lib/supabase/queries';
import { formatOpeningTime } from '@/lib/cafe-utils';

export const revalidate = 86400; // 24h ISR

interface PageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'cafes' });
  const tMeta = await getTranslations({ locale, namespace: 'metadata' });

  const title = `${t('indexTitle')} — ${tMeta('siteName')}`;
  const description = t('indexDescription');

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
    alternates: {
      canonical: '/cafes',
    },
  };
}

export default async function CafesIndexPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'cafes' });

  const guStats = await fetchGuStats();
  const totalCount = guStats.reduce((sum, g) => sum + g.count, 0);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border px-5 py-5" style={{ paddingTop: 'calc(1.25rem + var(--safe-area-top))' }}>
        <div className="flex items-center gap-2">
          <Coffee className="h-5 w-5 text-red-500" />
          <h1 className="text-lg font-bold">{t('indexTitle')}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('indexSubtitle', { areas: guStats.length, count: totalCount })}
        </p>
      </header>

      {/* Grid of districts */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {guStats.map(({ gu, count, earliest }) => (
            <Link
              key={gu}
              href={`/cafes/${encodeURIComponent(gu)}`}
              className="group flex flex-col rounded-xl border border-border p-4 transition-colors hover:border-red-400 hover:bg-red-50/50 dark:hover:bg-red-900/10"
            >
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-red-500" />
                <span className="font-semibold text-sm">{gu}</span>
              </div>
              <span className="mt-2 text-xl font-bold text-red-600 dark:text-red-400">
                {count}
                <span className="text-sm font-normal text-muted-foreground ml-0.5">{t('cafeCountUnit')}</span>
              </span>
              {earliest && (
                <span className="mt-1 text-xs text-muted-foreground">
                  {t('earliestOpenAt', { time: formatOpeningTime(earliest) })}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
