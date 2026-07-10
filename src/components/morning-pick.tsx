'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { MapPin, Clock, Navigation, X, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useShallow } from 'zustand/react/shallow';
import { useCafeStore } from '@/lib/store/cafe-store';
import { haversineKm, formatOpeningTime } from '@/lib/cafe-utils';
import { getOpeningTimeForDay } from '@/lib/store/cafe-store';
import { trackEvent } from '@/lib/analytics';
import { type Cafe } from '@/lib/types/cafe';

const PICK_STORAGE_KEY = 'morning-pick';
const MAX_WALK_KM = 1.5; // 도보 15분 ≈ 1.5km

interface MorningPickProps {
  userLocation: { lat: number; lng: number } | null;
  onSelectCafe: (cafe: Cafe) => void;
  cafesReady: boolean;
}

/** 오늘 날짜 키 */
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** 오늘 이미 봤는지 */
function seenToday(): boolean {
  try {
    const raw = localStorage.getItem(PICK_STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return data.date === todayKey();
  } catch {
    return false;
  }
}

function markSeen() {
  localStorage.setItem(PICK_STORAGE_KEY, JSON.stringify({ date: todayKey() }));
}

export function MorningPick({ userLocation, onSelectCafe, cafesReady }: MorningPickProps) {
  const t = useTranslations('morningPick');
  const tCafe = useTranslations('cafe');
  const { filteredCafes, chainCafeIds } = useCafeStore(
    useShallow((s) => ({ filteredCafes: s.filteredCafes, chainCafeIds: s.chainCafeIds })),
  );

  const [visible, setVisible] = useState(false);
  const [pickIndex, setPickIndex] = useState(0);
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null);

  // 추천 후보: 근처 + 현재 요일 오픈 + 최근 방문 제외
  const candidates = useMemo(() => {
    if (!userLocation || filteredCafes.length === 0) return [];

    const dayKeys = ['일', '월', '화', '수', '목', '금', '토'] as const;
    const today = dayKeys[new Date().getDay()];
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const nowMinutes = hour * 60 + minute;

    // 최근 방문 카페 제외
    let recentIds: Set<string> = new Set();
    try {
      const raw = localStorage.getItem('morning-cafe-recent');
      if (raw) recentIds = new Set(JSON.parse(raw).slice(0, 10));
    } catch { /* */ }

    return filteredCafes
      .map((cafe) => {
        const dist = haversineKm(userLocation.lat, userLocation.lng, cafe.latitude, cafe.longitude);
        if (dist > MAX_WALK_KM) return null;

        // 오늘 오픈 시간 확인
        const openTime = getOpeningTimeForDay(cafe, today);
        if (!openTime) return null;

        // 아직 안 연 카페도 포함 (곧 열 카페)
        const [h, m] = openTime.split(':').map(Number);
        const openMinutes = (h ?? 0) * 60 + (m ?? 0);
        // 이미 닫았을 가능성: closing_time 체크 (없으면 포함)
        if (cafe.closing_time) {
          const [ch, cm] = cafe.closing_time.split(':').map(Number);
          const closeMinutes = (ch ?? 0) * 60 + (cm ?? 0);
          if (closeMinutes > openMinutes && nowMinutes > closeMinutes) return null;
        }

        return { cafe, dist, openMinutes };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .filter((x) => !recentIds.has(x.cafe.id))
      .sort((a, b) => {
        // 1차: 곧 여는 카페 우선 (아직 안 열었으면 오픈까지 남은 시간)
        // 2차: 가까운 순
        const aScore = a.dist * 0.6 + Math.abs(a.openMinutes - nowMinutes) * 0.01;
        const bScore = b.dist * 0.6 + Math.abs(b.openMinutes - nowMinutes) * 0.01;
        return aScore - bScore;
      })
      .map((x) => ({ cafe: x.cafe, dist: x.dist }));
  }, [filteredCafes, userLocation]);

  // cafes 로드 + GPS 후 1회만 표시
  useEffect(() => {
    if (!cafesReady || !userLocation || seenToday()) return;
    if (candidates.length === 0) return;
    // 스플래시가 사라진 뒤 표시
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, [cafesReady, userLocation, candidates.length]);

  const currentPick = candidates[pickIndex] ?? null;

  const handleDismiss = useCallback(() => {
    markSeen();
    setVisible(false);
    trackEvent('morning_pick_dismiss', {});
  }, []);

  const handleGo = useCallback(() => {
    if (!currentPick) return;
    markSeen();
    setVisible(false);
    trackEvent('morning_pick_go', { cafe_name: currentPick.cafe.name });
    onSelectCafe(currentPick.cafe);
  }, [currentPick, onSelectCafe]);

  const handleNext = useCallback(() => {
    setSwipeDir('left');
    setTimeout(() => {
      setPickIndex((i) => Math.min(i + 1, candidates.length - 1));
      setSwipeDir(null);
    }, 200);
    trackEvent('morning_pick_next', {});
  }, [candidates.length]);

  const handleDragEnd = useCallback((_: unknown, info: PanInfo) => {
    const threshold = 80;
    if (info.offset.x < -threshold) {
      // 왼쪽 스와이프 → 다음
      if (pickIndex < candidates.length - 1) handleNext();
    } else if (info.offset.x > threshold) {
      // 오른쪽 스와이프 → 출발
      handleGo();
    }
  }, [pickIndex, candidates.length, handleNext, handleGo]);

  if (!visible || !currentPick) return null;

  const { cafe, dist } = currentPick;
  const isChain = chainCafeIds.has(cafe.id);
  const dayKeys = ['일', '월', '화', '수', '목', '금', '토'] as const;
  const todayOpenTime = getOpeningTimeForDay(cafe, dayKeys[new Date().getDay()]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={handleDismiss}
        >
          <motion.div
            key={cafe.id}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{
              x: swipeDir === 'left' ? -300 : swipeDir === 'right' ? 300 : 0,
              opacity: 0,
              scale: 0.9,
            }}
            transition={{ type: 'tween', duration: 0.25 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.3}
            onDragEnd={handleDragEnd}
            className="relative mx-6 w-full max-w-sm overflow-hidden rounded-3xl bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 닫기 */}
            <button
              onClick={handleDismiss}
              className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm"
            >
              <X className="h-4 w-4 text-white" />
            </button>

            {/* 헤더 라벨 */}
            <div className="absolute top-3 left-3 z-10 rounded-full bg-red-500 px-3 py-1">
              <span className="text-xs font-bold text-white">{t('title')}</span>
            </div>

            {/* 썸네일 */}
            {cafe.thumbnail_url ? (
              <div className="h-48 w-full bg-muted">
                <img
                  src={cafe.thumbnail_url}
                  alt={cafe.name}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="h-32 w-full bg-gradient-to-br from-red-100 to-red-50 dark:from-red-900/30 dark:to-red-900/20 flex items-center justify-center">
                <span className="text-4xl">☕</span>
              </div>
            )}

            {/* 카페 정보 */}
            <div className="p-5 space-y-3">
              <div>
                <h2 className="text-xl font-bold">{cafe.name}</h2>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  {todayOpenTime && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800 dark:bg-red-900/30 dark:text-red-400">
                      <Clock className="h-3 w-3" />
                      {t('opensAt', { time: formatOpeningTime(todayOpenTime) })}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    <Navigation className="h-3 w-3" />
                    {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}
                  </span>
                  {isChain && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      {tCafe('franchise')}
                    </span>
                  )}
                </div>
              </div>

              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                {cafe.road_address ?? cafe.address}
              </p>

              {/* 액션 버튼 */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleNext}
                  disabled={pickIndex >= candidates.length - 1}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-border py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                >
                  <RotateCcw className="h-4 w-4" />
                  {t('next')}
                </button>
                <button
                  onClick={handleGo}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-foreground py-3.5 text-sm font-bold text-background transition-colors hover:bg-foreground/90"
                >
                  {t('go')}
                </button>
              </div>

              {/* 스와이프 힌트 */}
              <p className="text-center text-[10px] text-muted-foreground/50">
                {t('swipeHint')}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
