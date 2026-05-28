'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Dices } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useCafeStore } from '@/lib/store/cafe-store';
import { haversineKm, formatOpeningTime } from '@/lib/cafe-utils';
import { trackEvent } from '@/lib/analytics';
import { type Cafe } from '@/lib/types/cafe';

const NEARBY_RADIUS_KM = 2; // 반경 2km
const SPIN_DURATION = 2000; // 2초 슬롯 애니메이션
const SLOT_INTERVAL = 80; // 슬롯 전환 간격 (ms)

interface CafeRouletteProps {
  userLocation: { lat: number; lng: number } | null;
  onSelectCafe: (cafe: Cafe) => void;
}

export function CafeRoulette({ userLocation, onSelectCafe }: CafeRouletteProps) {
  const { filteredCafes } = useCafeStore(
    useShallow((s) => ({ filteredCafes: s.filteredCafes })),
  );

  const [spinning, setSpinning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultCafe, setResultCafe] = useState<Cafe | null>(null);
  const [slotCafe, setSlotCafe] = useState<Cafe | null>(null);
  const [noLocation, setNoLocation] = useState(false);
  const [noCafes, setNoCafes] = useState(false);
  const spinTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 클린업
  useEffect(() => {
    return () => {
      if (spinTimerRef.current) clearInterval(spinTimerRef.current);
    };
  }, []);

  const getNearbyCafes = useCallback(() => {
    if (!userLocation) return [];
    return filteredCafes.filter((cafe) => {
      const dist = haversineKm(userLocation.lat, userLocation.lng, cafe.latitude, cafe.longitude);
      return dist <= NEARBY_RADIUS_KM;
    });
  }, [filteredCafes, userLocation]);

  const handleSpin = useCallback(() => {
    if (spinning) return;

    if (!userLocation) {
      setNoLocation(true);
      setTimeout(() => setNoLocation(false), 2000);
      return;
    }

    const nearby = getNearbyCafes();
    if (nearby.length === 0) {
      setNoCafes(true);
      setTimeout(() => setNoCafes(false), 2000);
      return;
    }

    trackEvent('roulette_spin', { nearby_count: nearby.length });
    setSpinning(true);
    setShowResult(false);
    setResultCafe(null);

    // 최종 당첨 카페 미리 결정
    const winner = nearby[Math.floor(Math.random() * nearby.length)];

    // 슬롯 애니메이션: 랜덤 카페를 빠르게 전환
    let elapsed = 0;
    spinTimerRef.current = setInterval(() => {
      elapsed += SLOT_INTERVAL;
      const random = nearby[Math.floor(Math.random() * nearby.length)];
      setSlotCafe(random);

      if (elapsed >= SPIN_DURATION) {
        if (spinTimerRef.current) clearInterval(spinTimerRef.current);
        spinTimerRef.current = null;
        setSlotCafe(winner);
        setResultCafe(winner);
        setSpinning(false);
        setShowResult(true);
      }
    }, SLOT_INTERVAL);
  }, [spinning, userLocation, getNearbyCafes]);

  const handleGoToCafe = useCallback(() => {
    if (!resultCafe) return;
    trackEvent('roulette_select', { cafe_name: resultCafe.name });
    setShowResult(false);
    setSlotCafe(null);
    onSelectCafe(resultCafe);
  }, [resultCafe, onSelectCafe]);

  const handleClose = useCallback(() => {
    setShowResult(false);
    setSlotCafe(null);
    setResultCafe(null);
  }, []);

  const displayCafe = slotCafe;
  const distanceText = resultCafe && userLocation
    ? `${(haversineKm(userLocation.lat, userLocation.lng, resultCafe.latitude, resultCafe.longitude) * 1000).toFixed(0)}m`
    : null;

  return (
    <>
      {/* 룰렛 버튼 — 현위치 버튼 위에 pill 형태 */}
      <motion.button
        onClick={handleSpin}
        disabled={spinning}
        whileTap={{ scale: 0.92 }}
        className={[
          'absolute md:bottom-[5.5rem] right-4 z-10 flex h-12 items-center gap-1.5 px-4',
          'rounded-full bg-background/95 backdrop-blur-xl shadow-sm border border-border/60',
          'text-sm font-semibold text-foreground',
          'transition-opacity disabled:opacity-60',
        ].join(' ')}
        style={{ bottom: 'calc(var(--bottom-nav-height) + 4.5rem)' }}
        aria-label="근처 카페 랜덤 추천"
      >
        <Dices
          className={[
            'h-4 w-4',
            spinning ? 'animate-spin' : '',
          ].join(' ')}
        />
        랜덤
      </motion.button>

      {/* 토스트: 위치 없음 */}
      <AnimatePresence>
        {noLocation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-32 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg"
          >
            위치를 먼저 켜주세요
          </motion.div>
        )}
      </AnimatePresence>

      {/* 토스트: 근처 카페 없음 */}
      <AnimatePresence>
        {noCafes && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-32 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg whitespace-nowrap"
          >
            반경 2km 내 카페가 없어요
          </motion.div>
        )}
      </AnimatePresence>

      {/* 슬롯 오버레이 */}
      <AnimatePresence>
        {(spinning || showResult) && displayCafe && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={showResult ? handleClose : undefined}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'tween', duration: 0.2 }}
              className="mx-6 w-full max-w-sm overflow-hidden rounded-2xl bg-background shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 썸네일 */}
              {displayCafe.thumbnail_url && (
                <div className="relative h-40 w-full overflow-hidden bg-muted">
                  <img
                    src={displayCafe.thumbnail_url}
                    alt={displayCafe.name}
                    className="h-full w-full object-cover"
                  />
                  {spinning && (
                    <div className="absolute inset-0 bg-background/20 backdrop-blur-[2px]" />
                  )}
                </div>
              )}

              {/* 카페 정보 */}
              <div className="p-5">
                <div className="mb-1 text-center">
                  {spinning && (
                    <p className="text-xs text-muted-foreground mb-2 animate-pulse">
                      어디로 갈까...?
                    </p>
                  )}
                  <h3 className={[
                    'text-lg font-bold text-foreground transition-all',
                    spinning ? 'blur-[1px]' : '',
                  ].join(' ')}>
                    {displayCafe.name}
                  </h3>
                  {showResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 space-y-1"
                    >
                      <p className="text-sm text-muted-foreground">
                        {displayCafe.road_address || displayCafe.address}
                      </p>
                      <div className="flex items-center justify-center gap-2 text-sm">
                        {displayCafe.opening_time && (
                          <span className="text-amber-600 font-medium">
                            {formatOpeningTime(displayCafe.opening_time)} 오픈
                          </span>
                        )}
                        {distanceText && (
                          <span className="text-muted-foreground">
                            {distanceText}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* 버튼 */}
                {showResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="mt-4 flex gap-2"
                  >
                    <button
                      onClick={handleClose}
                      className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                    >
                      닫기
                    </button>
                    <button
                      onClick={handleGoToCafe}
                      className="flex-1 rounded-xl bg-foreground py-3 text-sm font-bold text-background transition-colors hover:bg-foreground/90"
                    >
                      이 카페로!
                    </button>
                  </motion.div>
                )}

                {/* 다시 돌리기 */}
                {showResult && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClose();
                      setTimeout(handleSpin, 200);
                    }}
                    className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    다시 돌리기
                  </motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
