'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Share2, Sunrise } from 'lucide-react';
import { useStamps, type StampRecord } from '@/lib/hooks/use-stamps';
import { trackEvent } from '@/lib/analytics';

interface RecapStats {
  ym: string; // "2026-08"
  checkins: number;
  cafes: number;
  gus: number;
  earliest: string | null; // "05:58"
  topGu: string | null;
}

function computeRecap(stamps: readonly StampRecord[]): RecapStats | null {
  const now = new Date();
  const monthStamps = stamps.filter((s) => {
    const d = new Date(s.checkedAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  if (monthStamps.length === 0) return null;

  let earliestMin = Infinity;
  const guCount = new Map<string, number>();
  for (const s of monthStamps) {
    const d = new Date(s.checkedAt);
    const mins = d.getHours() * 60 + d.getMinutes();
    if (mins < earliestMin) earliestMin = mins;
    if (s.gu) guCount.set(s.gu, (guCount.get(s.gu) ?? 0) + 1);
  }
  const topGu = [...guCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const earliest =
    earliestMin === Infinity
      ? null
      : `${String(Math.floor(earliestMin / 60)).padStart(2, '0')}:${String(earliestMin % 60).padStart(2, '0')}`;

  return {
    ym: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    checkins: monthStamps.length,
    cafes: new Set(monthStamps.map((s) => s.cafeId)).size,
    gus: guCount.size,
    earliest,
    topGu,
  };
}

function recapCardUrl(r: RecapStats): string {
  const params = new URLSearchParams({
    ym: r.ym,
    c: String(r.checkins),
    k: String(r.cafes),
    g: String(r.gus),
  });
  if (r.earliest) params.set('e', r.earliest);
  if (r.topGu) params.set('t', r.topGu);
  return `/api/recap-card?${params.toString()}`;
}

/**
 * 이번 달 아침 리캡 — 스탬프(localStorage)에서 집계해 요약 + 스토리 카드 공유.
 * 이번 달 체크인이 없으면 렌더하지 않는다.
 */
export function MonthlyRecap() {
  const t = useTranslations('stamp');
  const locale = useLocale();
  const { stamps } = useStamps();
  const [sharing, setSharing] = useState(false);

  const recap = computeRecap(stamps);
  if (!recap) return null;

  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date());

  async function share() {
    if (!recap || sharing) return;
    setSharing(true);
    trackEvent('share_recap', { checkins: recap.checkins, cafes: recap.cafes });
    const url = recapCardUrl(recap);
    try {
      const blob = await fetch(url).then((r) => {
        if (!r.ok) throw new Error('card fetch failed');
        return r.blob();
      });
      const file = new File([blob], `morning-recap-${recap.ym}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        window.open(url, '_blank');
      }
    } catch {
      // 공유 시트 취소 포함 — 조용히 무시하되 새 탭 폴백은 하지 않는다 (취소와 구분 불가)
    } finally {
      setSharing(false);
    }
  }

  return (
    <section className="px-4 pt-5">
      <div className="rounded-2xl bg-gradient-to-br from-red-50 to-orange-50 p-4 dark:from-red-950/30 dark:to-orange-950/20">
        <div className="flex items-center gap-1.5">
          <Sunrise className="h-4 w-4 text-red-500" />
          <h2 className="text-xs font-semibold text-red-800 dark:text-red-300">
            {t('recapTitle', { month: monthLabel })}
          </h2>
        </div>
        <p className="mt-1.5 text-2xl font-bold text-foreground">
          {t('recapMornings', { count: recap.checkins })}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('recapStats', { cafes: recap.cafes, gus: recap.gus })}
          {recap.earliest && ` · ${t('recapEarliest', { time: recap.earliest })}`}
        </p>
        <button
          onClick={share}
          disabled={sharing}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-60"
        >
          <Share2 className="h-3.5 w-3.5" />
          {t('recapShare')}
        </button>
      </div>
    </section>
  );
}
