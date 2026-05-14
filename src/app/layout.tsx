import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { DesktopSidebar } from '@/components/layout/desktop-sidebar';
import { BottomNav } from '@/components/layout/bottom-nav';

import './globals.css';

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '모닝카페 — 서울 얼리버드 카페 찾기',
  description: '서울에서 아침 6~8시에 오픈하는 카페를 지도에서 한눈에 찾아보세요.',
  openGraph: {
    title: '모닝카페 — 서울 얼리버드 카페 찾기',
    description: '서울에서 아침 6~8시에 오픈하는 카페를 지도에서 한눈에 찾아보세요.',
    type: 'website',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary',
    title: '모닝카페 — 서울 얼리버드 카페 찾기',
    description: '서울에서 아침 6~8시에 오픈하는 카페를 지도에서 한눈에 찾아보세요.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} h-full`} suppressHydrationWarning>
      <head />
      <body className="h-full bg-background text-foreground antialiased">
        <ThemeProvider>
          <div className="flex h-full">
            <DesktopSidebar />
            <main className="flex-1 overflow-hidden pb-14 md:pb-0">
              {children}
            </main>
          </div>
          <BottomNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
