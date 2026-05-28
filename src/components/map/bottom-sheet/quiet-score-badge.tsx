'use client';

import { useMemo } from 'react';
import { Leaf } from 'lucide-react';
import { calculateQuietScore, type QuietScoreResult } from '@/lib/quiet-score';
import { cn } from '@/lib/utils';

interface QuietScoreBadgeProps {
  strengths: string[];
  facilities: string[];
  reviews: { contents: string }[];
}

const SCORE_STYLES: Record<string, string> = {
  '작업 천국': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  '작업 추천': 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
  '조용한 편': 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  '보통': 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

export function QuietScoreBadge({ strengths, facilities, reviews }: QuietScoreBadgeProps) {
  const result: QuietScoreResult = useMemo(
    () => calculateQuietScore(strengths, facilities, reviews),
    [strengths, facilities, reviews],
  );

  // 정보 부족이면 표시하지 않음
  if (result.label === '정보 부족' || result.label === '정보 없음') return null;

  const badgeStyle = SCORE_STYLES[result.label] ?? SCORE_STYLES['보통'];

  return (
    <div className="py-1.5">
      <div className="flex items-center gap-2">
        <Leaf className="h-4 w-4 text-emerald-500 flex-shrink-0" />
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', badgeStyle)}>
          {result.label}
        </span>
        <span className="text-xs text-muted-foreground">{result.score.toFixed(1)}/5</span>
      </div>
      {result.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5 ml-6">
          {result.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
