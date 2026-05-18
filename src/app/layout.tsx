import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Geist } from 'next/font/google';
import Script from 'next/script';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { DesktopSidebar } from '@/components/layout/desktop-sidebar';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PersistentMapPage } from '@/components/persistent-map-page';

import './globals.css';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://morning-cafe-phi.vercel.app'),
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
        <link rel="preconnect" href="https://t1.daumcdn.net" />
        <link rel="dns-prefetch" href="https://t1.daumcdn.net" />
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
        {KAKAO_JS_KEY && (
          <>
            <Script
              src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
              integrity="sha384-DKYJZ8NLiK8MN4/C5P2ezmFnkrWRhOme9y/8M1MIo2OKIRBIMgjOV/W63VDcUls"
              crossOrigin="anonymous"
              strategy="afterInteractive"
            />
            <Script id="kakao-init" strategy="afterInteractive">
              {`
                (function wait(){
                  if(window.Kakao && !window.Kakao.isInitialized()){
                    window.Kakao.init('${KAKAO_JS_KEY}');
                  } else if(!window.Kakao){
                    setTimeout(wait, 100);
                  }
                })();
              `}
            </Script>
          </>
        )}
        <ThemeProvider>
          <div className="flex h-full">
            <DesktopSidebar />
            <main className="relative flex-1 overflow-hidden pb-14 md:pb-0">
              <Suspense><PersistentMapPage /></Suspense>
              {children}
            </main>
          </div>
          <BottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
