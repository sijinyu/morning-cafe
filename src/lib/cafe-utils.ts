/** Shared cafe display utilities — single source of truth. */

import type { Cafe } from '@/lib/types/cafe';

/** 두 좌표 간 직선 거리 (km) — haversine 공식 */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** 카페가 7일 이내에 추가되었는지 판별 */
export function isNewCafe(cafe: Pick<Cafe, 'created_at'>): boolean {
  if (!cafe.created_at) return false;
  return Date.now() - new Date(cafe.created_at).getTime() < SEVEN_DAYS_MS;
}

/** 서비스 지역 (서울 + 경기) 경계 — cafe-map.tsx SEOUL_BOUNDS와 동일 */
export const SERVICE_BOUNDS = {
  swLat: 37.15,
  swLng: 126.50,
  neLat: 37.85,
  neLng: 127.35,
};

/** 좌표가 서비스 지역(서울+경기) 내인지 판별 */
export function isInServiceArea(lat: number, lng: number): boolean {
  return (
    lat >= SERVICE_BOUNDS.swLat && lat <= SERVICE_BOUNDS.neLat &&
    lng >= SERVICE_BOUNDS.swLng && lng <= SERVICE_BOUNDS.neLng
  );
}

/** Tailwind class string for the opening-time badge color. */
export function getOpeningBadgeStyle(openingTime: string | null): string {
  if (!openingTime) return 'bg-muted text-muted-foreground';
  const parts = openingTime.split(':');
  const totalMinutes = parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
  if (totalMinutes < 360) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  if (totalMinutes < 420) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  return 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400';
}
