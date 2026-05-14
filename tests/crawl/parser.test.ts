/**
 * Unit tests for src/lib/crawl/parser.ts
 *
 * All tests are pure — no HTTP calls are made. The functions under test are
 * deterministic, so we provide inline fixture objects that mirror the shape of
 * the real Kakao API responses.
 */

import { describe, it, expect } from 'vitest';
import {
  parseOpeningTime,
  parseInstagramUrl,
  isEarlybird,
  buildParsedCafe,
} from '@/lib/crawl/parser';
import type { KakaoLocalPlace, KakaoPlaceDetail } from '@/lib/crawl/types';

// ---------------------------------------------------------------------------
// Fixture factories — create minimal but realistic API response objects.
// Using factory functions keeps each test focused on the fields that matter.
// ---------------------------------------------------------------------------

function makeDetail(overrides: Partial<KakaoPlaceDetail> = {}): KakaoPlaceDetail {
  return { ...overrides };
}

function makeWeekPeriod(
  days: Array<{
    desc: string;
    range?: string;
    isToday?: boolean;
    offText?: string;
  }>,
): NonNullable<
  NonNullable<
    NonNullable<KakaoPlaceDetail['open_hours']>['week_from_today']
  >['week_periods']
>[number] {
  return {
    days: days.map(({ desc, range, isToday, offText }) => ({
      day_of_the_week_desc: desc,
      ...(range !== undefined
        ? { on_days: { start_end_time_desc: range } }
        : {}),
      ...(offText !== undefined
        ? { off_days: { display_text: offText } }
        : {}),
      is_highlight: isToday ?? false,
    })),
  };
}

function makeLocalPlace(overrides: Partial<KakaoLocalPlace> = {}): KakaoLocalPlace {
  return {
    id: '1234567890',
    place_name: '블루보틀 성수점',
    category_name: '음식점 > 카페',
    phone: '02-1234-5678',
    address_name: '서울 성동구 성수동1가 685-3',
    road_address_name: '서울 성동구 아차산로 100',
    x: '127.0566',
    y: '37.5443',
    place_url: 'https://place.map.kakao.com/1234567890',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseOpeningTime
// ---------------------------------------------------------------------------

describe('parseOpeningTime', () => {
  it('returns nulls when open_hours is absent', () => {
    const result = parseOpeningTime(makeDetail());
    expect(result.openingTime).toBeNull();
    expect(result.closingTime).toBeNull();
    expect(result.hoursByDay).toBeNull();
  });

  it('returns nulls when week_periods is an empty array', () => {
    const detail = makeDetail({
      open_hours: {
        week_from_today: { week_periods: [] },
      },
    });
    const result = parseOpeningTime(detail);
    expect(result.openingTime).toBeNull();
    expect(result.closingTime).toBeNull();
    expect(result.hoursByDay).toBeNull();
  });

  it('parses opening and closing time from a simple single-day entry', () => {
    const detail = makeDetail({
      open_hours: {
        week_from_today: {
          week_periods: [
            makeWeekPeriod([
              { desc: '월(5/14)', range: '06:30 ~ 22:00', isToday: true },
            ]),
          ],
        },
      },
    });

    const result = parseOpeningTime(detail);
    expect(result.openingTime).toBe('06:30');
    expect(result.closingTime).toBe('22:00');
  });

  it('builds hoursByDay keyed by Korean weekday abbreviation', () => {
    const detail = makeDetail({
      open_hours: {
        week_from_today: {
          week_periods: [
            makeWeekPeriod([
              { desc: '월(5/14)', range: '07:00 ~ 22:00' },
              { desc: '화(5/15)', range: '07:00 ~ 22:00' },
              { desc: '수(5/16)', range: '08:00 ~ 21:00' },
              { desc: '토(5/18)', range: '09:00 ~ 20:00' },
              { desc: '일(5/19)', range: '09:00 ~ 20:00' },
            ]),
          ],
        },
      },
    });

    const result = parseOpeningTime(detail);
    expect(result.hoursByDay).not.toBeNull();
    expect(result.hoursByDay!['월']).toBe('07:00~22:00');
    expect(result.hoursByDay!['화']).toBe('07:00~22:00');
    expect(result.hoursByDay!['수']).toBe('08:00~21:00');
    expect(result.hoursByDay!['토']).toBe('09:00~20:00');
    expect(result.hoursByDay!['일']).toBe('09:00~20:00');
  });

  it('normalises whitespace around the tilde in time ranges', () => {
    const detail = makeDetail({
      open_hours: {
        week_from_today: {
          week_periods: [
            makeWeekPeriod([
              { desc: '월(5/14)', range: '06:00  ~  23:00', isToday: true },
            ]),
          ],
        },
      },
    });

    const result = parseOpeningTime(detail);
    expect(result.openingTime).toBe('06:00');
    expect(result.closingTime).toBe('23:00');
    expect(result.hoursByDay!['월']).toBe('06:00~23:00');
  });

  it('uses today (is_highlight=true) entry to derive opening/closing time', () => {
    const detail = makeDetail({
      open_hours: {
        week_from_today: {
          week_periods: [
            makeWeekPeriod([
              { desc: '월(5/13)', range: '07:00 ~ 22:00', isToday: false },
              { desc: '화(5/14)', range: '05:30 ~ 22:00', isToday: true },
              { desc: '수(5/15)', range: '07:00 ~ 22:00', isToday: false },
            ]),
          ],
        },
      },
    });

    const result = parseOpeningTime(detail);
    // Must pick the highlighted day, not the first one.
    expect(result.openingTime).toBe('05:30');
    expect(result.closingTime).toBe('22:00');
  });

  it('falls back to the first available entry when no day is highlighted', () => {
    const detail = makeDetail({
      open_hours: {
        week_from_today: {
          week_periods: [
            makeWeekPeriod([
              { desc: '월(5/14)', range: '09:00 ~ 21:00', isToday: false },
              { desc: '화(5/15)', range: '09:00 ~ 21:00', isToday: false },
            ]),
          ],
        },
      },
    });

    const result = parseOpeningTime(detail);
    expect(result.openingTime).toBe('09:00');
    expect(result.closingTime).toBe('21:00');
  });

  it('skips off_days entries (no start_end_time_desc) without crashing', () => {
    const detail = makeDetail({
      open_hours: {
        week_from_today: {
          week_periods: [
            makeWeekPeriod([
              { desc: '월(5/14)', range: '08:00 ~ 21:00', isToday: true },
              { desc: '화(5/15)', offText: '정기휴무' },
            ]),
          ],
        },
      },
    });

    const result = parseOpeningTime(detail);
    expect(result.openingTime).toBe('08:00');
    expect(result.hoursByDay).toHaveProperty('월');
    expect(result.hoursByDay).not.toHaveProperty('화');
  });

  it('handles multiple week_periods across one response', () => {
    const detail = makeDetail({
      open_hours: {
        week_from_today: {
          week_periods: [
            makeWeekPeriod([
              { desc: '월(5/14)', range: '06:30 ~ 22:00', isToday: true },
            ]),
            makeWeekPeriod([
              { desc: '화(5/15)', range: '06:30 ~ 22:00' },
              { desc: '수(5/16)', range: '06:30 ~ 22:00' },
            ]),
          ],
        },
      },
    });

    const result = parseOpeningTime(detail);
    expect(result.openingTime).toBe('06:30');
    expect(Object.keys(result.hoursByDay!)).toHaveLength(3);
  });

  it('does not duplicate keys when the same weekday appears twice', () => {
    const detail = makeDetail({
      open_hours: {
        week_from_today: {
          week_periods: [
            makeWeekPeriod([
              { desc: '월(5/14)', range: '06:30 ~ 22:00' },
            ]),
            makeWeekPeriod([
              // Same weekday abbreviation — second occurrence must be ignored.
              { desc: '월(5/21)', range: '10:00 ~ 18:00' },
            ]),
          ],
        },
      },
    });

    const result = parseOpeningTime(detail);
    expect(Object.keys(result.hoursByDay!).filter((k) => k === '월')).toHaveLength(1);
    expect(result.hoursByDay!['월']).toBe('06:30~22:00');
  });
});

// ---------------------------------------------------------------------------
// parseInstagramUrl
// ---------------------------------------------------------------------------

describe('parseInstagramUrl', () => {
  it('returns null when summary is absent', () => {
    expect(parseInstagramUrl(makeDetail())).toBeNull();
  });

  it('returns null when homepage is absent', () => {
    expect(parseInstagramUrl(makeDetail({ summary: {} }))).toBeNull();
  });

  it('returns null when homepage contains no Instagram URL', () => {
    const detail = makeDetail({ summary: { homepage: 'https://example.com' } });
    expect(parseInstagramUrl(detail)).toBeNull();
  });

  it('extracts a plain instagram.com URL', () => {
    const detail = makeDetail({
      summary: { homepage: 'https://www.instagram.com/bluebottle.korea/' },
    });
    expect(parseInstagramUrl(detail)).toBe('https://www.instagram.com/bluebottle.korea/');
  });

  it('extracts an instagram URL mixed with another URL (comma-separated)', () => {
    const detail = makeDetail({
      summary: {
        homepage:
          'https://bluebottle.com, https://www.instagram.com/bluebottle.korea/',
      },
    });
    expect(parseInstagramUrl(detail)).toBe('https://www.instagram.com/bluebottle.korea/');
  });

  it('extracts an instagram URL from a semicolon-separated list', () => {
    const detail = makeDetail({
      summary: {
        homepage: 'https://blog.naver.com/cafe123;https://instagram.com/cafe123',
      },
    });
    expect(parseInstagramUrl(detail)).toBe('https://instagram.com/cafe123');
  });

  it('normalises http:// Instagram URLs to https://', () => {
    const detail = makeDetail({
      summary: { homepage: 'http://www.instagram.com/cafefoo/' },
    });
    expect(parseInstagramUrl(detail)).toBe('https://www.instagram.com/cafefoo/');
  });

  it('normalises protocol-relative Instagram URLs', () => {
    const detail = makeDetail({
      summary: { homepage: '//www.instagram.com/cafebar/' },
    });
    expect(parseInstagramUrl(detail)).toBe('https://www.instagram.com/cafebar/');
  });

  it('extracts instagram URL from a pipe-separated list', () => {
    const detail = makeDetail({
      summary: {
        homepage: 'https://naver.me/abc|https://www.instagram.com/mystore/',
      },
    });
    expect(parseInstagramUrl(detail)).toBe('https://www.instagram.com/mystore/');
  });

  it('returns null when homepage is an empty string', () => {
    const detail = makeDetail({ summary: { homepage: '' } });
    expect(parseInstagramUrl(detail)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isEarlybird
// ---------------------------------------------------------------------------

describe('isEarlybird', () => {
  it('returns false for null opening time', () => {
    expect(isEarlybird(null)).toBe(false);
  });

  it('returns true when opening time is exactly 00:00', () => {
    expect(isEarlybird('00:00')).toBe(true);
  });

  it('returns true when opening time is 05:00', () => {
    expect(isEarlybird('05:00')).toBe(true);
  });

  it('returns true when opening time is 06:30', () => {
    expect(isEarlybird('06:30')).toBe(true);
  });

  it('returns true when opening time is 07:59 (just before threshold)', () => {
    expect(isEarlybird('07:59')).toBe(true);
  });

  it('returns false when opening time is exactly 08:00 (the threshold)', () => {
    // The contract is "strictly before 08:00", so 08:00 itself is not earlybird.
    expect(isEarlybird('08:00')).toBe(false);
  });

  it('returns false when opening time is 08:01', () => {
    expect(isEarlybird('08:01')).toBe(false);
  });

  it('returns false when opening time is 09:00', () => {
    expect(isEarlybird('09:00')).toBe(false);
  });

  it('returns false when opening time is 23:59', () => {
    expect(isEarlybird('23:59')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildParsedCafe
// ---------------------------------------------------------------------------

describe('buildParsedCafe', () => {
  it('maps KakaoLocalPlace scalar fields correctly', () => {
    const local = makeLocalPlace();
    const result = buildParsedCafe(local, null);

    expect(result.kakaoPlaceId).toBe('1234567890');
    expect(result.name).toBe('블루보틀 성수점');
    expect(result.address).toBe('서울 성동구 성수동1가 685-3');
    expect(result.roadAddress).toBe('서울 성동구 아차산로 100');
    expect(result.phone).toBe('02-1234-5678');
    expect(result.placeUrl).toBe('https://place.map.kakao.com/1234567890');
    expect(result.category).toBe('음식점 > 카페');
  });

  it('converts x/y coordinate strings to numbers', () => {
    const local = makeLocalPlace({ x: '127.0566', y: '37.5443' });
    const result = buildParsedCafe(local, null);

    expect(result.longitude).toBeCloseTo(127.0566, 4);
    expect(result.latitude).toBeCloseTo(37.5443, 4);
  });

  it('sets all detail-derived fields to null when detail is null', () => {
    const result = buildParsedCafe(makeLocalPlace(), null);

    expect(result.openingTime).toBeNull();
    expect(result.closingTime).toBeNull();
    expect(result.hoursByDay).toBeNull();
    expect(result.instagramUrl).toBeNull();
    expect(result.isEarlybird).toBe(false);
  });

  it('populates opening/closing times from detail', () => {
    const local = makeLocalPlace();
    const detail = makeDetail({
      open_hours: {
        week_from_today: {
          week_periods: [
            makeWeekPeriod([
              { desc: '월(5/14)', range: '06:00 ~ 22:00', isToday: true },
            ]),
          ],
        },
      },
    });

    const result = buildParsedCafe(local, detail);
    expect(result.openingTime).toBe('06:00');
    expect(result.closingTime).toBe('22:00');
  });

  it('sets isEarlybird=true when opening time is before 08:00', () => {
    const local = makeLocalPlace();
    const detail = makeDetail({
      open_hours: {
        week_from_today: {
          week_periods: [
            makeWeekPeriod([
              { desc: '월(5/14)', range: '06:30 ~ 21:00', isToday: true },
            ]),
          ],
        },
      },
    });

    const result = buildParsedCafe(local, detail);
    expect(result.isEarlybird).toBe(true);
  });

  it('sets isEarlybird=false when opening time is at or after 08:00', () => {
    const local = makeLocalPlace();
    const detail = makeDetail({
      open_hours: {
        week_from_today: {
          week_periods: [
            makeWeekPeriod([
              { desc: '월(5/14)', range: '09:00 ~ 21:00', isToday: true },
            ]),
          ],
        },
      },
    });

    const result = buildParsedCafe(local, detail);
    expect(result.isEarlybird).toBe(false);
  });

  it('extracts instagram URL from detail', () => {
    const local = makeLocalPlace();
    const detail = makeDetail({
      summary: { homepage: 'https://www.instagram.com/bluebottle.korea/' },
    });

    const result = buildParsedCafe(local, detail);
    expect(result.instagramUrl).toBe('https://www.instagram.com/bluebottle.korea/');
  });

  it('sets instagramUrl=null when detail has no homepage', () => {
    const local = makeLocalPlace();
    const detail = makeDetail({ summary: { homepage: undefined } });

    const result = buildParsedCafe(local, detail);
    expect(result.instagramUrl).toBeNull();
  });

  it('builds hoursByDay correctly from detail', () => {
    const local = makeLocalPlace();
    const detail = makeDetail({
      open_hours: {
        week_from_today: {
          week_periods: [
            makeWeekPeriod([
              { desc: '월(5/14)', range: '07:00 ~ 22:00', isToday: true },
              { desc: '화(5/15)', range: '07:00 ~ 22:00' },
              { desc: '토(5/18)', range: '10:00 ~ 20:00' },
            ]),
          ],
        },
      },
    });

    const result = buildParsedCafe(local, detail);
    expect(result.hoursByDay).toEqual({
      월: '07:00~22:00',
      화: '07:00~22:00',
      토: '10:00~20:00',
    });
  });

  it('produces a fully shaped ParsedCafe even when detail is partially empty', () => {
    const local = makeLocalPlace();
    // detail exists but has no open_hours and no summary
    const detail = makeDetail({});

    const result = buildParsedCafe(local, detail);

    // Must have all expected keys.
    const expectedKeys: Array<keyof typeof result> = [
      'kakaoPlaceId',
      'name',
      'address',
      'roadAddress',
      'phone',
      'longitude',
      'latitude',
      'placeUrl',
      'instagramUrl',
      'category',
      'openingTime',
      'closingTime',
      'hoursByDay',
      'isEarlybird',
    ];
    for (const key of expectedKeys) {
      expect(result).toHaveProperty(key);
    }
  });

  it('does not mutate the local or detail input objects', () => {
    const local = makeLocalPlace();
    const detail = makeDetail({
      open_hours: {
        week_from_today: {
          week_periods: [
            makeWeekPeriod([
              { desc: '월(5/14)', range: '06:30 ~ 22:00', isToday: true },
            ]),
          ],
        },
      },
    });

    const localCopy = JSON.parse(JSON.stringify(local)) as KakaoLocalPlace;
    const detailCopy = JSON.parse(JSON.stringify(detail)) as KakaoPlaceDetail;

    buildParsedCafe(local, detail);

    expect(local).toEqual(localCopy);
    expect(detail).toEqual(detailCopy);
  });
});
