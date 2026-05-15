import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import Script from 'next/script';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { DesktopSidebar } from '@/components/layout/desktop-sidebar';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PersistentMapPage } from '@/components/persistent-map-page';

import './globals.css';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://morningcoffee.kr'),
  title: '모닝커피 — 서울 아침 카페 지도',
  description: '서울에서 아침 일찍 여는 카페를 한눈에! 6시, 7시 오픈 카페를 지도에서 바로 찾아보세요.',
  keywords: ['아침 카페', '새벽 카페', '서울 카페', '얼리버드 카페', '카페 오픈 시간', '모닝커피'],
  openGraph: {
    title: '모닝커피 — 서울 아침 카페 지도',
    description: '서울에서 아침 일찍 여는 카페를 한눈에! 6시, 7시 오픈 카페를 지도에서 바로 찾아보세요.',
    type: 'website',
    locale: 'ko_KR',
    siteName: '모닝커피',
  },
  twitter: {
    card: 'summary_large_image',
    title: '모닝커피 — 서울 아침 카페 지도',
    description: '서울에서 아침 일찍 여는 카페를 한눈에!',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: '/',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#F59E0B',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} h-full`} suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="h-full bg-background text-foreground antialiased">
        {GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        )}
        <ThemeProvider>
          <div className="flex h-full">
            <DesktopSidebar />
            <main className="relative flex-1 overflow-hidden pb-14 md:pb-0">
              <PersistentMapPage />
              {children}
            </main>
          </div>
          <BottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
