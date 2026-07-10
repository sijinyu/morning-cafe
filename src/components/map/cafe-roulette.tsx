'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Dices, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useCafeStore } from '@/lib/store/cafe-store';
import { haversineKm, formatOpeningTime } from '@/lib/cafe-utils';
import { trackEvent } from '@/lib/analytics';
import { usePlaceDetail } from '@/lib/hooks/use-place-detail';
import { type Cafe } from '@/lib/types/cafe';

const NEARBY_RADIUS_KM = 3;
const SPIN_DURATION = 2000;
const SLOT_INTERVAL = 80;

interface CafeRouletteProps {
  mapCenter: { lat: number; lng: number };
  onSelectCafe: (cafe: Cafe) => void;
}

export function CafeRoulette({ mapCenter, onSelectCafe }: CafeRouletteProps) {
  const t = useTranslations('roulette');
  const tCafe = useTranslations('cafe');
  const tMorningPick = useTranslations('morningPick');
  const { filteredCafes, userLocation } = useCafeStore(
    useShallow((s) => ({ filteredCafes: s.filteredCafes, userLocation: s.userLocation })),
  );

  const [spinning, setSpinning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultCafe, setResultCafe] = useState<Cafe | null>(null);
  const [slotCafe, setSlotCafe] = useState<Cafe | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const spinTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (spinTimerRef.current) clearInterval(spinTimerRef.current);
    };
  }, []);

  const getNearbyCafes = useCallback(() => {
    return filteredCafes.filter((cafe) => {
      const dist = haversineKm(mapCenter.lat, mapCenter.lng, cafe.latitude, cafe.longitude);
      return dist <= NEARBY_RADIUS_KM;
    });
  }, [filteredCafes, mapCenter]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const handleSpin = useCallback(() => {
    if (spinning) return;

    const nearby = getNearbyCafes();
    if (nearby.length === 0) {
      showToast(t('noNearbyCafes'));
      return;
    }

    trackEvent('roulette_spin', { mode: 'map', nearby_count: nearby.length });
    setSpinning(true);
    setShowResult(false);
    setResultCafe(null);

    const winner = nearby[Math.floor(Math.random() * nearby.length)];

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
  }, [spinning, getNearbyCafes, showToast, t]);

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
  // 거리 기준: GPS 위치 우선, 없으면 지도 중심
  const distRef = userLocation ?? mapCenter;
  const distanceKm = resultCafe
    ? haversineKm(distRef.lat, distRef.lng, resultCafe.latitude, resultCafe.longitude)
    : null;
  const distanceText = distanceKm != null
    ? distanceKm >= 1 ? `${distanceKm.toFixed(1)}km` : `${Math.round(distanceKm * 1000)}m`
    : null;

  // Fetch place detail for result card (photos, rating, reviews)
  const { photos, rating, reviews } = usePlaceDetail(
    showResult && resultCafe ? resultCafe.kakao_place_id : null,
  );
  const cardPhoto = photos[0] ?? resultCafe?.thumbnail_url ?? null;

  return (
    <>
      {/* 룰렛 버튼 — 리스트 버튼 위 */}
      <motion.button
        onClick={handleSpin}
        disabled={spinning}
        whileTap={{ scale: 0.92 }}
        className={[
          'absolute md:bottom-6 left-4 z-10 flex h-12 items-center gap-1.5 px-4',
          'rounded-full bg-background/95 backdrop-blur-xl shadow-sm border border-border/60',
          'text-sm font-semibold text-foreground',
          'transition-opacity disabled:opacity-60',
        ].join(' ')}
        style={{ bottom: 'calc(var(--bottom-nav-height) + 1rem)' }}
        aria-label={t('ariaLabel')}
      >
        <Dices
          className={[
            'h-4 w-4',
            spinning ? 'animate-spin' : '',
          ].join(' ')}
        />
        {t('button')}
        <span className="text-[10px] text-muted-foreground font-normal">3km</span>
      </motion.button>

      {/* 토스트 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-32 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg whitespace-nowrap"
          >
            {toast}
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
              {/* 썸네일 — 결과 시 place-detail 사진 우선, 스피닝 시 DB 썸네일 */}
              {(showResult ? cardPhoto : displayCafe.thumbnail_url) && (
                <div className="relative h-40 w-full overflow-hidden bg-muted">
                  <img
                    src={(showResult ? cardPhoto : displayCafe.thumbnail_url) ?? ''}
                    alt={displayCafe.name}
                    className="h-full w-full object-cover"
                    decoding="async"
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
                      {t('spinning')}
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
                          <span className="text-red-600 font-medium">
                            {tMorningPick('opensAt', { time: formatOpeningTime(displayCafe.opening_time) })}
                          </span>
                        )}
                        {distanceText && (
                          <span className="text-muted-foreground">
                            {distanceText}
                          </span>
                        )}
                        {rating && (
                          <span className="flex items-center gap-0.5 text-muted-foreground">
                            <Star className="h-3 w-3 fill-red-400 text-red-400" />
                            {rating.score.toFixed(1)}
                          </span>
                        )}
                      </div>
                      {/* 리뷰 프리뷰 */}
                      {reviews.length > 0 && (
                        <div className="mt-2.5 space-y-1.5">
                          {reviews.slice(0, 2).map((r, i) => (
                            <p key={i} className="text-xs text-muted-foreground line-clamp-1 text-left">
                              &ldquo;{r.contents}&rdquo;
                            </p>
                          ))}
                        </div>
                      )}
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
                      {tCafe('close')}
                    </button>
                    <button
                      onClick={handleGoToCafe}
                      className="flex-1 rounded-xl bg-foreground py-3 text-sm font-bold text-background transition-colors hover:bg-foreground/90"
                    >
                      {t('goToCafe')}
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
                    {t('respin')}
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
