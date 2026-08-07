/**
 * Guide definitions — template-based content page system.
 * Each guide filters/sorts from the full earlybird cafe dataset.
 * Pages are SSG + 24h ISR, fully automated with zero manual content.
 */

import type { Cafe } from '@/lib/types/cafe';
import { extractGu } from '@/lib/types/cafe';
import { is24Hours, formatOpeningTime } from '@/lib/cafe-utils';

/** Ordered list of guide slugs (determines display order on index page). */
export const GUIDE_SLUGS = [
  'before-6am',
  'weekend-morning',
  '24h-cafes',
  'new-cafes',
] as const;

export type GuideSlug = (typeof GUIDE_SLUGS)[number];

export interface GuideData {
  slug: GuideSlug;
  cafes: Cafe[];
  /** Cafes grouped by district (gu), sorted by count descending */
  grouped: { gu: string; cafes: Cafe[] }[];
  stats: {
    totalCount: number;
    districtCount: number;
    earliestTime: string | null;
  };
}

/** Parse "HH:MM:SS" to minutes since midnight */
function parseMinutes(time: string | null): number | null {
  if (!time) return null;
  const parts = time.split(':');
  return parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
}

/** Extract opening minutes for a specific day from hours_by_day */
function getWeekendOpeningMinutes(cafe: Cafe, dayKey: 'sat' | 'sun'): number | null {
  if (!cafe.hours_by_day) {
    return parseMinutes(cafe.opening_time);
  }
  const dayHours = cafe.hours_by_day[dayKey];
  if (!dayHours) return null;
  // "06:30~22:00" → "06:30"
  const openStr = dayHours.split('~')[0];
  if (!openStr) return null;
  const parts = openStr.split(':');
  return parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type FilterFn = (cafe: Cafe) => boolean;
type SortFn = (a: Cafe, b: Cafe) => number;

const GUIDE_FILTERS: Record<GuideSlug, FilterFn> = {
  'before-6am': (c) => {
    const mins = parseMinutes(c.opening_time);
    return mins !== null && mins < 360;
  },
  '24h-cafes': (c) => is24Hours(c),
  'new-cafes': (c) => {
    if (!c.created_at) return false;
    return Date.now() - new Date(c.created_at).getTime() < SEVEN_DAYS_MS;
  },
  'weekend-morning': (c) => {
    const satMins = getWeekendOpeningMinutes(c, 'sat');
    const sunMins = getWeekendOpeningMinutes(c, 'sun');
    // At least one weekend day opens before 8 AM (480 min)
    return (satMins !== null && satMins < 480) || (sunMins !== null && sunMins < 480);
  },
};

const GUIDE_SORTS: Record<GuideSlug, SortFn> = {
  'before-6am': (a, b) => {
    const aMin = parseMinutes(a.opening_time) ?? 999;
    const bMin = parseMinutes(b.opening_time) ?? 999;
    return aMin - bMin;
  },
  '24h-cafes': (a, b) => a.name.localeCompare(b.name, 'ko'),
  'new-cafes': (a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bTime - aTime; // newest first
  },
  'weekend-morning': (a, b) => {
    // Sort by earliest weekend opening
    const aMin = Math.min(
      getWeekendOpeningMinutes(a, 'sat') ?? 999,
      getWeekendOpeningMinutes(a, 'sun') ?? 999,
    );
    const bMin = Math.min(
      getWeekendOpeningMinutes(b, 'sat') ?? 999,
      getWeekendOpeningMinutes(b, 'sun') ?? 999,
    );
    return aMin - bMin;
  },
};

/** Group cafes by district, sorted by group size descending */
function groupByDistrict(cafes: Cafe[]): { gu: string; cafes: Cafe[] }[] {
  const guMap = new Map<string, Cafe[]>();
  for (const cafe of cafes) {
    const gu = extractGu(cafe.address);
    if (!gu) continue;
    const existing = guMap.get(gu);
    if (existing) {
      existing.push(cafe);
    } else {
      guMap.set(gu, [cafe]);
    }
  }
  return [...guMap.entries()]
    .map(([gu, items]) => ({ gu, cafes: items }))
    .sort((a, b) => b.cafes.length - a.cafes.length);
}

/** Build guide data from all earlybird cafes */
export function buildGuideData(slug: GuideSlug, allCafes: readonly Cafe[]): GuideData {
  const filterFn = GUIDE_FILTERS[slug];
  const sortFn = GUIDE_SORTS[slug];

  const filtered = allCafes.filter(filterFn);
  const sorted = [...filtered].sort(sortFn);
  const grouped = groupByDistrict(sorted);

  let earliestTime: string | null = null;
  for (const cafe of sorted) {
    if (cafe.opening_time) {
      earliestTime = formatOpeningTime(cafe.opening_time);
      break;
    }
  }

  return {
    slug,
    cafes: sorted,
    grouped,
    stats: {
      totalCount: sorted.length,
      districtCount: grouped.length,
      earliestTime,
    },
  };
}

/** Check if a slug is a valid guide */
export function isValidGuideSlug(slug: string): slug is GuideSlug {
  return (GUIDE_SLUGS as readonly string[]).includes(slug);
}
