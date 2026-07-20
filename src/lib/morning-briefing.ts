'use client';

// 오늘의 아침 브리핑 — 매일 바뀌는 재방문 이유.
// 날씨/일출은 Open-Meteo (무료·키 불필요). 하루 1회만 호출, localStorage 캐시.
// 문구는 요일×날씨 조합으로 매일 달라지게 → "매일 열 이유".

const CACHE_KEY = 'morning-briefing';
// 서울시청 — GPS 없어도 브리핑이 뜨도록 기본 좌표. 위치는 브리핑 핵심이 아니라 fallback.
const DEFAULT_LAT = 37.5665;
const DEFAULT_LNG = 126.978;

export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'snow';

export interface Briefing {
  readonly date: string; // YYYY-M-D
  readonly sunrise: string; // "6:47"
  readonly weather: WeatherKind;
  readonly tempC: number | null;
  /** 문구 i18n 키 인덱스 (0-based) — 요일×날씨로 결정, 표시는 next-intl에서 */
  readonly nudgeKey: string;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Open-Meteo WMO weather code → 4분류 */
function classifyWeather(code: number): WeatherKind {
  if (code === 0 || code === 1) return 'clear';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 85 && code <= 86) return 'snow';
  if (code >= 51 && code <= 67) return 'rain';
  if (code >= 80 && code <= 82) return 'rain';
  if (code >= 95) return 'rain'; // 뇌우도 비 계열로 단순화
  return 'cloudy';
}

/** "2026-07-20T06:47" → "6:47" */
function formatSunrise(iso: string): string {
  const timePart = iso.split('T')[1] ?? '';
  const [h, m] = timePart.split(':');
  if (!h || !m) return '';
  return `${Number(h)}:${m}`;
}

/**
 * 문구 키 선택 — 요일(0~6)×날씨(4종) = 최대 28조합을 문구 풀에 매핑.
 * 날씨별 문구 개수가 다를 수 있어 요일로 순환 인덱싱 → 매일 다른 문구 보장.
 * 반환: "clear.2" 같은 i18n 키 (messages의 briefing.nudge.clear[] 인덱스).
 */
const NUDGE_COUNTS: Record<WeatherKind, number> = {
  clear: 5,
  cloudy: 5,
  rain: 5,
  snow: 3,
};

function pickNudgeKey(weather: WeatherKind, day: number): string {
  const count = NUDGE_COUNTS[weather];
  const idx = day % count;
  // 플랫 키 (next-intl 배열 인덱싱 비신뢰) — messages의 briefing.nudge.clear0 등
  return `${weather}${idx}`;
}

function readCache(): Briefing | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Briefing;
    return data.date === todayKey() ? data : null;
  } catch {
    return null;
  }
}

/**
 * 오늘의 브리핑을 가져온다. 캐시 있으면 즉시 반환(네트워크 X).
 * 없으면 Open-Meteo 1회 호출 → 캐시. 실패 시 null (브리핑은 부가기능, 없어도 앱 정상).
 */
export async function getBriefing(
  loc?: { lat: number; lng: number } | null,
): Promise<Briefing | null> {
  const cached = readCache();
  if (cached) return cached;

  const lat = loc?.lat ?? DEFAULT_LAT;
  const lng = loc?.lng ?? DEFAULT_LNG;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
    `&daily=sunrise&current=temperature_2m,weather_code&timezone=Asia%2FSeoul&forecast_days=1`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();

    const sunriseIso: string = json?.daily?.sunrise?.[0] ?? '';
    const code: number = json?.current?.weather_code ?? -1;
    const temp: number | null = json?.current?.temperature_2m ?? null;
    if (!sunriseIso || code < 0) return null;

    const weather = classifyWeather(code);
    const briefing: Briefing = {
      date: todayKey(),
      sunrise: formatSunrise(sunriseIso),
      weather,
      tempC: temp === null ? null : Math.round(temp),
      nudgeKey: pickNudgeKey(weather, new Date().getDay()),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(briefing));
    return briefing;
  } catch {
    return null; // 네트워크/타임아웃 — 조용히 스킵
  }
}

/** 날씨별 이모지 (문구 앞) */
export const WEATHER_EMOJI: Record<WeatherKind, string> = {
  clear: '☀️',
  cloudy: '☁️',
  rain: '🌧️',
  snow: '❄️',
};
