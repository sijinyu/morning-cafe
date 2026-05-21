/** Shared cafe display utilities — single source of truth. */

import type { Cafe } from '@/lib/types/cafe';

/** 24시간 영업 판단 — **모든** 요일이 24시간인 경우만 true */
export function is24Hours(cafe: Pick<Cafe, 'opening_time' | 'closing_time' | 'hours_by_day'>): boolean {
  // hours_by_day가 있으면 모든 요일이 00:00~24:00인지 확인
  if (cafe.hours_by_day) {
    const values = Object.values(cafe.hours_by_day);
    if (values.length === 0) return false;
    return values.every((v) => /^00:00~24:00$/.test(v));
  }
  // hours_by_day가 없으면 opening_time/closing_time fallback
  if (cafe.opening_time === '00:00:00' && cafe.closing_time === '24:00:00') return true;
  if (cafe.opening_time === '00:00:00' && cafe.closing_time === '00:00:00') return true;
  return false;
}

/** 특정 요일에 24시간 영업하는지 판단 */
export function is24HoursForDay(
  cafe: Pick<Cafe, 'opening_time' | 'closing_time' | 'hours_by_day'>,
  dayKey: string,
): boolean {
  if (cafe.hours_by_day) {
    const dayHours = cafe.hours_by_day[dayKey];
    return dayHours ? /^00:00~24:00$/.test(dayHours) : false;
  }
  // hours_by_day가 없으면 opening_time/closing_time fallback
  if (cafe.opening_time === '00:00:00' && cafe.closing_time === '24:00:00') return true;
  if (cafe.opening_time === '00:00:00' && cafe.closing_time === '00:00:00') return true;
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
