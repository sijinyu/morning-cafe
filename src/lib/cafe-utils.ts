/** Shared cafe display utilities — single source of truth. */

import type { Cafe } from '@/lib/types/cafe';

/** 24시간 영업 판단 — 서버/클라이언트 양쪽에서 사용 가능 */
export function is24Hours(cafe: Pick<Cafe, 'opening_time' | 'closing_time' | 'hours_by_day'>): boolean {
  if (cafe.opening_time === '00:00:00' && cafe.closing_time === '24:00:00') return true;
  if (cafe.opening_time === '00:00:00' && cafe.closing_time === '00:00:00') return true;
  // hours_by_day에 "00:00~24:00" 패턴
  const sample = Object.values(cafe.hours_by_day ?? {})[0];
  if (sample && /^00:00~24:00$/.test(sample)) return true;
  return false;
}

/** Format "HH:MM:SS" → "HH:MM" for display. */
export function formatOpeningTime(openingTime: string | null): string {
  if (!openingTime) return '정보 없음';
  const parts = openingTime.split(':');
  return `${parts[0] ?? '00'}:${parts[1] ?? '00'}`;
}

/** Tailwind class string for the opening-time badge color. */
export function getOpeningBadgeStyle(openingTime: string | null): string {
  if (!openingTime) return 'bg-muted text-muted-foreground';
  const parts = openingTime.split(':');
  const totalMinutes = parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
  if (totalMinutes < 360) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
  if (totalMinutes < 420) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  return 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400';
}
