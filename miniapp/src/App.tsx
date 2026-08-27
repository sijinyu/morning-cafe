import { useEffect, useMemo, useState } from 'react';
import { Accuracy, Device, openURL } from '@apps-in-toss/web-framework';

/** 본 서비스 프로덕션 API — 미니앱은 데이터를 여기서 가져온다 (CORS 허용됨) */
const API_BASE = 'https://morning-cafe-phi.vercel.app';
const PAGE_SIZE = 1000; // /api/cafes 페이지 크기와 동일해야 마지막 페이지 판정 가능
const CACHE_KEY = 'mc-miniapp-cafes';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 서버 캐시 주기(6h)와 동일

interface Cafe {
  id: string;
  name: string;
  address: string;
  road_address: string | null;
  opening_time: string | null;
  place_url: string | null;
  latitude: number;
  longitude: number;
  thumbnail_url?: string | null;
}

type TimeFilter = 'all' | 'before6' | 'before7' | 'before8';

const TIME_FILTERS: { key: TimeFilter; label: string; maxMinutes: number }[] = [
  { key: 'all', label: '전체', maxMinutes: Infinity },
  { key: 'before6', label: '6시 전', maxMinutes: 360 },
  { key: 'before7', label: '7시 전', maxMinutes: 420 },
  { key: 'before8', label: '8시 전', maxMinutes: 480 },
];

function openingMinutes(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(':');
  return parseInt(h ?? '0', 10) * 60 + parseInt(m ?? '0', 10);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** "서울 강남구 역삼동 1-1" → "강남구 역삼동 1-1" */
function shortAddress(cafe: Cafe): string {
  return (cafe.road_address ?? cafe.address).replace(/^(서울|부산|경기)\S*\s+/, '');
}

async function fetchAllCafes(): Promise<Cafe[]> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const cached = JSON.parse(raw) as { t: number; rows: Cafe[] };
      if (Date.now() - cached.t < CACHE_TTL_MS) return cached.rows;
    }
  } catch {
    // 캐시 손상 — 무시하고 새로 로드
  }

  const rows: Cafe[] = [];
  for (let page = 0; page <= 50; page++) {
    const res = await fetch(`${API_BASE}/api/cafes?page=${page}`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    const chunk = (await res.json()) as Cafe[];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
  }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), rows }));
  } catch {
    // 저장 실패(용량 등) — 동작에는 영향 없음
  }
  return rows;
}

export default function App() {
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('before8');
  const [query, setQuery] = useState('');
  const [myLoc, setMyLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    fetchAllCafes()
      .then((rows) => {
        setCafes(rows);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  async function locate() {
    if (locating) return;
    setLocating(true);
    try {
      const loc = await Device.getLocation({ accuracy: Accuracy.Balanced });
      setMyLoc({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {
      // 권한 거부 등 — 거리순 없이 그대로 사용
    } finally {
      setLocating(false);
    }
  }

  const list = useMemo(() => {
    const max = TIME_FILTERS.find((f) => f.key === timeFilter)!.maxMinutes;
    const q = query.trim().toLowerCase();
    const filtered = cafes.filter((c) => {
      const mins = openingMinutes(c.opening_time);
      const timeOk = max === Infinity || (mins !== null && mins < max);
      const queryOk = !q || c.name.toLowerCase().includes(q) || c.address.includes(q);
      return timeOk && queryOk;
    });

    const sorted = [...filtered];
    if (myLoc) {
      sorted.sort(
        (a, b) =>
          haversineKm(myLoc.lat, myLoc.lng, a.latitude, a.longitude) -
          haversineKm(myLoc.lat, myLoc.lng, b.latitude, b.longitude),
      );
    } else {
      sorted.sort((a, b) => (openingMinutes(a.opening_time) ?? 999) - (openingMinutes(b.opening_time) ?? 999));
    }
    return sorted.slice(0, 100);
  }, [cafes, timeFilter, query, myLoc]);

  return (
    <div className="app">
      <header className="header">
        <h1>☕ 모닝카페</h1>
        <p>아침 일찍 여는 카페 {cafes.length > 0 ? `${cafes.length.toLocaleString()}곳` : ''}</p>
      </header>

      <div className="controls">
        <input
          className="search"
          placeholder="카페명·지역 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="chips">
          {TIME_FILTERS.map((f) => (
            <button
              key={f.key}
              className={`chip ${timeFilter === f.key ? 'active' : ''}`}
              onClick={() => setTimeFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
          <button className={`chip ${myLoc ? 'active' : ''}`} onClick={locate} disabled={locating}>
            {locating ? '위치 확인 중…' : myLoc ? '📍 거리순' : '📍 내 주변'}
          </button>
        </div>
      </div>

      {status === 'loading' && <p className="notice">아침 카페를 불러오는 중…</p>}
      {status === 'error' && <p className="notice">데이터를 불러오지 못했어요. 잠시 후 다시 열어주세요.</p>}

      <ul className="list">
        {list.map((cafe) => {
          const mins = openingMinutes(cafe.opening_time);
          return (
            <li key={cafe.id}>
              <button
                className="row"
                onClick={() => cafe.place_url && openURL(cafe.place_url)}
              >
                <div className="thumb">
                  {cafe.thumbnail_url ? <img src={cafe.thumbnail_url} alt="" loading="lazy" /> : <span>☕</span>}
                </div>
                <div className="info">
                  <div className="name-line">
                    <span className="name">{cafe.name}</span>
                    {cafe.opening_time && (
                      <span className={`badge ${mins !== null && mins < 420 ? 'early' : ''}`}>
                        {cafe.opening_time.slice(0, 5)}
                      </span>
                    )}
                  </div>
                  <p className="addr">
                    {shortAddress(cafe)}
                    {myLoc && (
                      <em>
                        {' · '}
                        {haversineKm(myLoc.lat, myLoc.lng, cafe.latitude, cafe.longitude).toFixed(1)}km
                      </em>
                    )}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {status === 'ready' && list.length === 0 && (
        <p className="notice">조건에 맞는 카페가 없어요.</p>
      )}
    </div>
  );
}
