'use client';

import { useEffect, useState } from 'react';
import { Award, CheckCircle2, MapPin } from 'lucide-react';
import { useStamps, SEOUL_GUS } from '@/lib/hooks/use-stamps';
import { cn } from '@/lib/utils';

function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

export default function StampPage() {
  const { stamps, conqueredGus, totalStamps, allConquered } = useStamps();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const recentStamps = stamps.slice(0, 20);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-2 border-b border-border px-5 py-4">
        <Award className="h-5 w-5 text-amber-500" />
        <h1 className="text-lg font-bold">스탬프</h1>
        <span className="text-sm text-muted-foreground">({totalStamps})</span>
        <div className="flex-1" />
        <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
          {conqueredGus.size}/25구 정복
        </span>
      </header>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {totalStamps === 0 ? (
          /* Empty state */
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Award className="h-10 w-10 stroke-1" />
            <p className="text-sm">아직 스탬프가 없습니다</p>
            <p className="text-xs">카페 근처에서 체크인하면 스탬프가 찍혀요</p>
          </div>
        ) : (
          <div className="pb-6">
            {/* 25구 conquest grid */}
            <section className="px-4 pt-5 pb-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">서울 25구 정복 지도</h2>

              {allConquered && (
                <div className="mb-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-center">
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                    서울 25구를 모두 정복했습니다!
                  </p>
                  <p className="mt-0.5 text-xs text-amber-600/80 dark:text-amber-500/80">
                    진정한 얼리버드 정복자
                  </p>
                </div>
              )}

              <div className="grid grid-cols-5 gap-1.5">
                {SEOUL_GUS.map((gu) => {
                  const conquered = conqueredGus.has(gu);
                  return (
                    <div
                      key={gu}
                      className={cn(
                        'relative flex flex-col items-center justify-center rounded-xl px-1 py-2.5 text-center transition-colors',
                        conquered
                          ? 'bg-amber-100 dark:bg-amber-900/30'
                          : 'bg-muted/50',
                      )}
                    >
                      {conquered && (
                        <CheckCircle2 className="mb-1 h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                      )}
                      <span
                        className={cn(
                          'text-[10px] font-semibold leading-tight',
                          conquered
                            ? 'text-amber-800 dark:text-amber-300'
                            : 'text-muted-foreground',
                        )}
                      >
                        {/* Strip trailing "구" for space, re-add with styling */}
                        {gu.replace('구', '')}
                        <span className="opacity-60">구</span>
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="mt-3 text-right text-xs text-muted-foreground">
                {conqueredGus.size}구 / 25구
              </p>
            </section>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Recent stamps list */}
            <section className="pt-4">
              <h2 className="mb-1 px-5 text-sm font-semibold text-foreground">최근 체크인</h2>
              <ul className="divide-y divide-border">
                {recentStamps.map((stamp, index) => (
                  <li
                    key={`${stamp.cafeId}-${stamp.checkedAt}-${index}`}
                    className="flex items-center gap-3 px-5 py-3.5"
                  >
                    {/* Stamp dot */}
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                      <MapPin className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {stamp.cafeName}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {stamp.gu && (
                          <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                            {stamp.gu}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {relativeTime(stamp.checkedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Check icon */}
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-amber-400 dark:text-amber-500" />
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
