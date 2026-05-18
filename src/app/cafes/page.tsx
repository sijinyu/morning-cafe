import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Coffee } from 'lucide-react';
import { fetchGuStats } from '@/lib/supabase/queries';
import { formatOpeningTime } from '@/lib/cafe-utils';

export const revalidate = 86400; // 24h ISR

export const metadata: Metadata = {
  title: '서울 구별 아침 카페 — 모닝커피',
  description:
    '서울 각 구별 아침 일찍 여는 카페를 한눈에. 강남, 마포, 종로 등 구별 얼리버드 카페 목록.',
  openGraph: {
    title: '서울 구별 아침 카페 — 모닝커피',
    description: '서울 각 구별 아침 일찍 여는 카페를 한눈에.',
    type: 'website',
    locale: 'ko_KR',
    siteName: '모닝커피',
  },
  twitter: {
    card: 'summary_large_image',
    title: '서울 구별 아침 카페 — 모닝커피',
    description: '서울 각 구별 아침 일찍 여는 카페를 한눈에.',
  },
  alternates: {
    canonical: '/cafes',
  },
};

export default async function CafesIndexPage() {
  const guStats = await fetchGuStats();
  const totalCount = guStats.reduce((sum, g) => sum + g.count, 0);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border px-5 py-5">
        <div className="flex items-center gap-2">
          <Coffee className="h-5 w-5 text-amber-500" />
          <h1 className="text-lg font-bold">서울 구별 아침 카페</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          서울 전역 {guStats.length}개 구, 총 {totalCount}곳
        </p>
      </header>

      {/* Grid of districts */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {guStats.map(({ gu, count, earliest }) => (
            <Link
              key={gu}
              href={`/cafes/${encodeURIComponent(gu)}`}
              className="group flex flex-col rounded-xl border border-border p-4 transition-colors hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-900/10"
            >
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-amber-500" />
                <span className="font-semibold text-sm">{gu}</span>
              </div>
              <span className="mt-2 text-xl font-bold text-amber-600 dark:text-amber-400">
                {count}
                <span className="text-sm font-normal text-muted-foreground ml-0.5">곳</span>
              </span>
              {earliest && (
                <span className="mt-1 text-xs text-muted-foreground">
                  최초 {formatOpeningTime(earliest)} 오픈
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
