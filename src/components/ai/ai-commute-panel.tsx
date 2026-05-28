'use client';

import { useState, useCallback, useMemo } from 'react';
import { MapPin, Clock, Navigation, Train } from 'lucide-react';
import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useCafeStore } from '@/lib/store/cafe-store';
import { type Cafe } from '@/lib/types/cafe';
import { haversineKm, formatOpeningTime } from '@/lib/cafe-utils';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CommuteState = 'idle' | 'loading' | 'results' | 'error' | 'rate-limited';

interface AiCommutePanelProps {
  onClose: () => void;
}

interface CommuteRecommendation {
  cafe_id: string;
  cafe_name: string;
  reason: string;
  estimated_timeline: string;
}

interface CommuteResponse {
  recommendations: CommuteRecommendation[];
  route_summary: string;
}

// ---------------------------------------------------------------------------
// Time picker helpers
// ---------------------------------------------------------------------------

function getDefaultDepartureTime(): string {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AiCommutePanel({ onClose }: AiCommutePanelProps) {
  const { filteredCafes, userLocation } = useCafeStore(
    useShallow((s) => ({ filteredCafes: s.filteredCafes, userLocation: s.userLocation })),
  );
  const setSelectedCafe = useCafeStore((s) => s.setSelectedCafe);
  const cafes = useCafeStore((s) => s.cafes);

  const [useCurrentLocation, setUseCurrentLocation] = useState(!!userLocation);
  const [homeAddress, setHomeAddress] = useState('');
  const [workAddress, setWorkAddress] = useState('');
  const [departureTime, setDepartureTime] = useState(getDefaultDepartureTime);

  const [state, setState] = useState<CommuteState>('idle');
  const [results, setResults] = useState<CommuteResponse | null>(null);

  const cafesById = useMemo(() => {
    const map = new Map<string, Cafe>();
    for (const c of cafes) map.set(c.id, c);
    return map;
  }, [cafes]);

  const canSubmit =
    (useCurrentLocation ? !!userLocation : homeAddress.trim().length > 0) &&
    workAddress.trim().length > 0 &&
    departureTime.trim().length > 0;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || state === 'loading') return;

    setState('loading');
    setResults(null);

    trackEvent('ai_commute_submit', { departure_time: departureTime });

    // Build home location
    const home = useCurrentLocation && userLocation
      ? { lat: userLocation.lat, lng: userLocation.lng, address: '현위치' }
      : { lat: 37.5665, lng: 126.978, address: homeAddress.trim() }; // fallback coords for Seoul center

    // Build work location (approximate — geocoding would be ideal but we use AI to handle)
    const work = { lat: 37.5665, lng: 126.978, address: workAddress.trim() };

    // Pick nearby cafes that are between home and work area
    const candidateCafes = filteredCafes
      .slice(0, 50)
      .map((c) => ({
        id: c.id,
        name: c.name,
        address: c.road_address ?? c.address,
        lat: c.latitude,
        lng: c.longitude,
        opening_time: c.opening_time,
      }));

    try {
      const res = await fetch('/api/ai-commute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          home,
          work,
          departure_time: departureTime,
          cafes: candidateCafes,
        }),
      });

      if (res.status === 429) {
        setState('rate-limited');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: CommuteResponse = await res.json();
      setResults(data);
      setState('results');
      trackEvent('ai_commute_results', { count: data.recommendations?.length ?? 0 });
    } catch {
      setState('error');
    }
  }, [canSubmit, state, departureTime, useCurrentLocation, userLocation, homeAddress, workAddress, filteredCafes]);

  const handleSelectCafe = useCallback(
    (cafeId: string) => {
      const cafe = cafesById.get(cafeId);
      if (cafe) {
        setSelectedCafe(cafe);
        trackEvent('ai_commute_select', { cafe_name: cafe.name });
        onClose();
      }
    },
    [cafesById, setSelectedCafe, onClose],
  );

  const handleReset = useCallback(() => {
    setState('idle');
    setResults(null);
  }, []);

  return (
    <div className="flex flex-col gap-5 px-4 pb-6 pt-4">
      {/* Form */}
      {(state === 'idle' || state === 'error' || state === 'rate-limited') && (
        <>
          {/* Home */}
          <div className="flex flex-col gap-2">
            <p className="text-[12px] font-medium text-muted-foreground">출발지</p>
            <div className="flex gap-2">
              <button
                onClick={() => setUseCurrentLocation(true)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all',
                  useCurrentLocation
                    ? 'bg-foreground text-background shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted',
                )}
              >
                <Navigation className="h-3.5 w-3.5" />
                현위치
              </button>
              <button
                onClick={() => setUseCurrentLocation(false)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium transition-all',
                  !useCurrentLocation
                    ? 'bg-foreground text-background shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted',
                )}
              >
                <MapPin className="h-3.5 w-3.5" />
                주소 입력
              </button>
            </div>
            {!useCurrentLocation && (
              <input
                type="text"
                value={homeAddress}
                onChange={(e) => setHomeAddress(e.target.value)}
                placeholder="예: 서울역, 강남구 역삼동"
                className={cn(
                  'w-full rounded-xl border border-border/60 bg-background px-4 py-3',
                  'text-[14px] text-foreground placeholder:text-muted-foreground/40',
                  'outline-none focus:border-foreground/20 transition-all',
                )}
              />
            )}
            {useCurrentLocation && !userLocation && (
              <p className="text-[12px] text-amber-600 dark:text-amber-400">
                위치 권한을 허용해주세요
              </p>
            )}
          </div>

          {/* Work */}
          <div className="flex flex-col gap-2">
            <p className="text-[12px] font-medium text-muted-foreground">도착지 (직장)</p>
            <input
              type="text"
              value={workAddress}
              onChange={(e) => setWorkAddress(e.target.value)}
              placeholder="예: 광화문, 판교역"
              className={cn(
                'w-full rounded-xl border border-border/60 bg-background px-4 py-3',
                'text-[14px] text-foreground placeholder:text-muted-foreground/40',
                'outline-none focus:border-foreground/20 transition-all',
              )}
            />
          </div>

          {/* Departure time */}
          <div className="flex flex-col gap-2">
            <p className="text-[12px] font-medium text-muted-foreground">출발 시간</p>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className={cn(
                  'rounded-xl border border-border/60 bg-background px-4 py-3',
                  'text-[14px] text-foreground',
                  'outline-none focus:border-foreground/20 transition-all',
                )}
              />
            </div>
          </div>

          {/* Submit button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.1, type: 'tween' }}
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-2xl py-4',
              'text-[15px] font-bold transition-all',
              canSubmit
                ? 'bg-foreground text-background hover:opacity-90'
                : 'bg-muted text-muted-foreground cursor-not-allowed',
            )}
          >
            <Train className="h-4 w-4" />
            출근길 카페 찾기
          </motion.button>

          {state === 'rate-limited' && (
            <p className="text-center text-sm text-amber-600 dark:text-amber-400">
              AI 요청이 많아요. 1분 후 다시 시도해주세요.
            </p>
          )}
          {state === 'error' && (
            <p className="text-center text-sm text-red-500">
              추천에 실패했어요. 다시 시도해주세요.
            </p>
          )}
        </>
      )}

      {/* Loading */}
      {state === 'loading' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
          <p className="text-sm text-muted-foreground animate-pulse">출근길 카페를 찾고 있어요...</p>
        </div>
      )}

      {/* Results */}
      {state === 'results' && results && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, type: 'tween' }}
          className="flex flex-col gap-4"
        >
          {/* Route summary */}
          {results.route_summary && (
            <div className="rounded-2xl bg-muted/40 px-4 py-3.5">
              <p className="text-[14px] leading-relaxed text-foreground">{results.route_summary}</p>
            </div>
          )}

          {/* Recommendations */}
          {results.recommendations.length > 0 ? (
            results.recommendations.map((rec, idx) => {
              const cafe = cafesById.get(rec.cafe_id);
              const dist = cafe && userLocation
                ? haversineKm(userLocation.lat, userLocation.lng, cafe.latitude, cafe.longitude)
                : null;

              return (
                <motion.button
                  key={rec.cafe_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.06, type: 'tween' }}
                  onClick={() => handleSelectCafe(rec.cafe_id)}
                  className={cn(
                    'w-full rounded-2xl border border-border/50 bg-background p-4',
                    'text-left transition-colors hover:bg-muted/50 active:bg-muted/70',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-foreground">{rec.cafe_name}</p>
                      {cafe && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {cafe.road_address ?? cafe.address}
                        </p>
                      )}
                    </div>
                    {dist !== null && (
                      <span className="flex-shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                        {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{rec.reason}</p>
                  {/* Timeline */}
                  <div className="mt-3 rounded-xl bg-muted/30 px-3 py-2.5">
                    <p className="text-[12px] font-medium text-muted-foreground whitespace-pre-line leading-relaxed">
                      {rec.estimated_timeline}
                    </p>
                  </div>
                </motion.button>
              );
            })
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <p className="text-[15px] font-medium text-foreground">
                경로에 맞는 카페를 찾지 못했어요
              </p>
              <p className="text-sm text-muted-foreground">다른 경로로 다시 시도해보세요</p>
            </div>
          )}

          {/* Reset button */}
          <button
            onClick={handleReset}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            다시 검색하기
          </button>
        </motion.div>
      )}
    </div>
  );
}
