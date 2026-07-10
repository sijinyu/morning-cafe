import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { DesktopSidebar } from '@/components/layout/desktop-sidebar';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PersistentMapPage } from '@/components/persistent-map-page';
import { SwUpdatePrompt } from '@/components/sw-update-prompt';
import { PwaInstallPrompt } from '@/components/pwa-install-prompt';
import { StatusBarConfig } from '@/components/native/status-bar-config';
import { OfflineScreen } from '@/components/native/offline-screen';
import { PushInit } from '@/components/native/push-init';
import { SplashScreen } from '@/components/splash-screen';
import { locales } from '@/i18n/config';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

const BASE_URL = 'https://morning-cafe-phi.vercel.app';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  return {
    metadataBase: new URL(BASE_URL),
    title: t('title'),
    description: t('description'),
    keywords: locale === 'ko'
      ? ['아침 카페', '새벽 카페', '서울 카페', '경기 카페', '판교 카페', '분당 카페', '얼리버드 카페', '카페 오픈 시간', '모닝카페']
      : locale === 'ja'
      ? ['ソウル カフェ', '早朝 カフェ', '朝 カフェ', 'ソウル 旅行', '京畿道 カフェ', 'モーニングカフェ', '韓国 カフェ']
      : ['morning cafe', 'early bird cafe', 'Seoul cafe', 'Gyeonggi cafe', 'cafe open early', 'Korea cafe map'],
    openGraph: {
      title: t('title'),
      description: t('description'),
      type: 'website',
      locale: locale === 'ko' ? 'ko_KR' : locale === 'ja' ? 'ja_JP' : 'en_US',
      siteName: t('siteName'),
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
    },
    verification: {
      google: 'google9e17854a21ef9763',
      other: {
        'naver-site-verification': 'b4928168a48b4c0705f4e7ded72513a7f235f4df',
      },
    },
    robots: { index: true, follow: true },
    alternates: {
      canonical: locale === 'ko' ? '/' : locale === 'ja' ? '/ja' : '/en',
      languages: {
        'ko': '/',
        'en': '/en',
        'ja': '/ja',
      },
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <SplashScreen />
      <ThemeProvider>
          <div className="flex h-full">
            <DesktopSidebar />
            <main className="relative flex-1 overflow-hidden pb-14 md:pb-0">
              <Suspense><PersistentMapPage /></Suspense>
              {children}
            </main>
          </div>
          <BottomNav />
          <StatusBarConfig />
          <OfflineScreen />
          <SwUpdatePrompt />
          <PwaInstallPrompt />
          <PushInit />
        </ThemeProvider>
    </NextIntlClientProvider>
  );
}
