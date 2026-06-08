'use client';

import { useState, useCallback, useMemo } from 'react';
import { Zap, MapPin, Clock, Navigation } from 'lucide-react';
import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useCafeStore, getOpeningTimeForDay } from '@/lib/store/cafe-store';
import { type Cafe } from '@/lib/types/cafe';
import { haversineKm, formatOpeningTime } from '@/lib/cafe-utils';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PickState = 'idle' | 'loading' | 'result' | 'error' | 'rate-limited';

interface AiDailyPickProps {
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAY_KEYS = ['일', '월', '화', '수', '목', '금', '토'] as const;
type DayKey = (typeof DAY_KEYS)[number];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AiDailyPick({ onClose }: AiDailyPickProps) {
  const { filteredCafes, cafes, userLocation } = useCafeStore(
    useShallow((s) => ({ filteredCafes: s.filteredCafes, cafes: s.cafes, userLocation: s.userLocation })),
  );
  const setSelectedCafe = useCafeStore((s) => s.setSelectedCafe);

  const [state, setState] = useState<PickState>('idle');
  const [pickedCafe, setPickedCafe] = useState<Cafe | null>(null);
  const [reason, setReason] = useState('');

  // Get candidates: nearest, not recently visited (반경 제한 없음)
  const candidates = useMemo(() => {
    const pool = filteredCafes.length > 0 ? filteredCafes : cafes;

    // Exclude recently visited cafes (top 5)
    const recentIds = new Set<string>();
    try {
      const raw = localStorage.getItem('morning-cafe-recent');
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        parsed.slice(0, 5).forEach((id) => recentIds.add(id));
      }
    } catch {
      // localStorage unavailable — continue without exclusion
    }

    const filtered = pool.filter((c) => !recentIds.has(c.id));
    // 최근 방문 제외 후 0개면 전체 사용
    const source = filtered.length > 0 ? filtered : pool;

    if (!userLocation) return source.slice(0, 20);

    return source
      .map((cafe) => ({
        cafe,
        dist: haversineKm(userLocation.lat, userLocation.lng, cafe.latitude, cafe.longitude),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 20)
      .map((x) => x.cafe);
  }, [filteredCafes, cafes, userLocation]);

  const handlePick = useCallback(async () => {
    if (state === 'loading' || candidates.length === 0) return;

    setState('loading');
    trackEvent('ai_daily_pick_submit', {});

    try {
      const res = await fetch('/api/ai-daily-pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userLat: userLocation?.lat,
          userLng: userLocation?.lng,
          cafes: candidates.map((c) => ({
            id: c.id,
            name: c.name,
            address: c.road_address ?? c.address,
            opening_time: c.opening_time,
            category: c.category,
          })),
        }),
      });

      if (res.status === 429) {
        setState('rate-limited');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as { cafe_id?: string; reason?: string };
      const cafe = candidates.find((c) => c.id === data.cafe_id) ?? candidates[0];

      if (cafe) {
        setPickedCafe(cafe);
        setReason(data.reason ?? '');
        setState('result');
        trackEvent('ai_daily_pick_result', { cafe_name: cafe.name });
      } else {
        setState('error');
      }
    } catch {
      setState('error');
    }
  }, [state, candidates, userLocation]);

  const handleGo = useCallback(() => {
    if (!pickedCafe) return;
    setSelectedCafe(pickedCafe);
    trackEvent('ai_daily_pick_go', { cafe_name: pickedCafe.name });
    onClose();
  }, [pickedCafe, setSelectedCafe, onClose]);

  const handleReset = useCallback(() => {
    setState('idle');
    setPickedCafe(null);
    setReason('');
  }, []);

  const dist =
    pickedCafe && userLocation
      ? haversineKm(userLocation.lat, userLocation.lng, pickedCafe.latitude, pickedCafe.longitude)
      : null;

  const todayKey: DayKey = DAY_KEYS[new Date().getDay()] ?? '월';
  const todayOpenTime = pickedCafe ? getOpeningTimeForDay(pickedCafe, todayKey) : null;

  return (
    <div className="flex flex-col gap-5 px-4 pb-6 pt-4">
      {/* Idle state */}
      {state === 'idle' && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/20">
            <Zap className="h-8 w-8 text-emerald-500" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-[17px] font-bold text-foreground">오늘의 추천</p>
            <p className="text-sm text-muted-foreground">
              {userLocation
                ? '근처에서 지금 가기 좋은 카페 1곳을 골라드려요'
                : '지금 가기 좋은 카페 1곳을 골라드려요'}
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.1, type: 'tween' }}
            onClick={handlePick}
            disabled={candidates.length === 0}
            className={cn(
              'flex items-center justify-center gap-2 rounded-2xl px-8 py-4',
              'text-[15px] font-bold transition-all',
              candidates.length > 0
                ? 'bg-foreground text-background hover:opacity-90'
                : 'bg-muted text-muted-foreground cursor-not-allowed',
            )}
          >
            <Zap className="h-4 w-4" />
            추천 받기
          </motion.button>
          {candidates.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {cafes.length === 0 ? '카페 데이터를 불러오는 중...' : '추천할 카페가 없어요'}
            </p>
          )}
        </div>
      )}

      {/* Loading state */}
      {state === 'loading' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
          <p className="text-sm text-muted-foreground animate-pulse">오늘의 카페를 고르고 있어요...</p>
        </div>
      )}

      {/* Rate limited */}
      {state === 'rate-limited' && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-[15px] font-medium text-red-600 dark:text-red-400">AI 요청이 많아요</p>
          <p className="text-sm text-muted-foreground">1분 후 다시 시도해주세요</p>
          <button
            onClick={handleReset}
            className="rounded-full border border-border/60 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            돌아가기
          </button>
        </div>
      )}

      {/* Error state */}
      {state === 'error' && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-[15px] font-medium text-foreground">추천에 실패했어요</p>
          <button
            onClick={handleReset}
            className="rounded-full border border-border/60 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* Result state */}
      {state === 'result' && pickedCafe && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, type: 'tween' }}
          className="flex flex-col gap-4"
        >
          {/* Cafe card */}
          <div className="rounded-2xl border border-border/50 overflow-hidden">
            {pickedCafe.thumbnail_url && (
              <div className="h-40 w-full bg-muted">
                <img
                  src={pickedCafe.thumbnail_url}
                  alt={pickedCafe.name}
                  className="h-full w-full object-cover"
                  loading="eager"
                  decoding="async"
                />
              </div>
            )}
            <div className="p-4 space-y-3">
              <h3 className="text-lg font-bold text-foreground">{pickedCafe.name}</h3>
              <div className="flex items-center gap-2 flex-wrap">
                {todayOpenTime && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    <Clock className="h-3 w-3" />
                    {formatOpeningTime(todayOpenTime)} 오픈
                  </span>
                )}
                {dist !== null && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    <Navigation className="h-3 w-3" />
                    {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}
                  </span>
                )}
              </div>
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                {pickedCafe.road_address ?? pickedCafe.address}
              </p>
            </div>
          </div>

          {/* AI reason */}
          {reason && (
            <div className="rounded-2xl bg-muted/40 px-4 py-3.5">
              <p className="text-[14px] leading-relaxed text-foreground">{reason}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-border py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              다시 뽑기
            </button>
            <button
              onClick={handleGo}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-foreground py-3.5 text-sm font-bold text-background transition-colors hover:bg-foreground/90"
            >
              이 카페로!
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
