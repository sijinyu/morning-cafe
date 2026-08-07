import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, Clock, Moon, Sunrise, Sparkles } from 'lucide-react';
import { localeAlternates } from '@/lib/i18n-meta';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { fetchAllEarlybirdCafes } from '@/lib/supabase/queries';
import { GUIDE_SLUGS, buildGuideData, type GuideSlug } from '@/lib/guides';

export const revalidate = 86400; // 24h ISR

interface PageProps {
  params: Promise<{ locale: string }>;
}

const GUIDE_ICONS: Record<GuideSlug, React.ReactNode> = {
  'before-6am': <Sunrise className="h-5 w-5" />,
  '24h-cafes': <Moon className="h-5 w-5" />,
  'new-cafes': <Sparkles className="h-5 w-5" />,
  'weekend-morning': <Clock className="h-5 w-5" />,
};

const GUIDE_COLORS: Record<GuideSlug, string> = {
  'before-6am': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  '24h-cafes': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'new-cafes': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'weekend-morning': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'guides' });
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
    twitter: { card: 'summary_large_image', title, description },
    alternates: localeAlternates('/guides', locale),
  };
}

export default async function GuidesIndexPage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'guides' });

  const allCafes = await fetchAllEarlybirdCafes();

  const guidePreviews = GUIDE_SLUGS.map((slug) => {
    const data = buildGuideData(slug, allCafes);
    return { slug, stats: data.stats };
  });

  return (
    <div className="flex h-full flex-col bg-background">
      <header
        className="border-b border-border px-5 py-5"
        style={{ paddingTop: 'calc(1.25rem + var(--safe-area-top))' }}
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-red-500" />
          <h1 className="text-xl font-bold">{t('indexTitle')}</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t('indexSubtitle')}</p>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="grid gap-3">
          {guidePreviews.map(({ slug, stats }) => (
            <Link
              key={slug}
              href={`/guides/${slug}`}
              className="group flex items-start gap-4 rounded-2xl border border-border p-4 transition-colors hover:border-red-400 hover:bg-red-50/50 dark:hover:bg-red-950/20"
            >
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${GUIDE_COLORS[slug]}`}>
                {GUIDE_ICONS[slug]}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-foreground group-hover:text-red-600 transition-colors">
                  {t(`${slug}.title`)}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                  {t(`${slug}.description`)}
                </p>
                {stats.totalCount > 0 && (
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-medium text-red-600">{t('cafeCount', { count: stats.totalCount })}</span>
                    <span>{t('districtCount', { count: stats.districtCount })}</span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
