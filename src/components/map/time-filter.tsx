'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Store, Calendar, MapPin, ChevronDown, Clock, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import {
  useCafeStore,
  type TimeFilter as TimeFilterType,
  type DayFilter,
} from '@/lib/store/cafe-store';
import { cn } from '@/lib/utils';

interface FilterChip {
  value: TimeFilterType;
  label: string;
}

const FILTER_CHIPS: FilterChip[] = [
  { value: 'all', label: '전체' },
  { value: 'before6', label: '~6시' },
  { value: '6to7', label: '6~7시' },
  { value: '7to8', label: '7~8시' },
];

const DAY_CHIPS: { value: DayFilter; label: string }[] = [
  { value: 'today', label: '오늘' },
  { value: '월', label: '월' },
  { value: '화', label: '화' },
  { value: '수', label: '수' },
  { value: '목', label: '목' },
  { value: '금', label: '금' },
  { value: '토', label: '토' },
  { value: '일', label: '일' },
];

// Active chip style — unified single accent color
const ACTIVE_CHIP = 'bg-foreground text-background shadow-md';
const INACTIVE_CHIP = 'border border-border bg-background/80 text-muted-foreground backdrop-blur-md hover:bg-background';

export function TimeFilter() {
  const timeFilter = useCafeStore((state) => state.timeFilter);
  const setTimeFilter = useCafeStore((state) => state.setTimeFilter);
  const dayFilter = useCafeStore((state) => state.dayFilter);
  const setDayFilter = useCafeStore((state) => state.setDayFilter);
  const guFilter = useCafeStore((state) => state.guFilter);
  const setGuFilter = useCafeStore((state) => state.setGuFilter);
  const hideChains = useCafeStore((state) => state.hideChains);
  const setHideChains = useCafeStore((state) => state.setHideChains);
  const hide24h = useCafeStore((state) => state.hide24h);
  const setHide24h = useCafeStore((state) => state.setHide24h);
  const availableGus = useCafeStore((state) => state.availableGus);
  const filteredCafes = useCafeStore((state) => state.filteredCafes);

  const [showMore, setShowMore] = useState(false);
  const [showDays, setShowDays] = useState(false);
  const [showGu, setShowGu] = useState(false);

  // Count how many secondary filters are active
  const activeSecondaryCount =
    (dayFilter !== 'today' ? 1 : 0) +
    (guFilter ? 1 : 0) +
    (hideChains ? 1 : 0) +
    (hide24h ? 1 : 0);

  return (
    <div className="absolute top-16 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 max-w-[95vw]">
      {/* 1행: 시간 필터 + 더보기 토글 */}
      <div className="flex gap-1.5 items-center">
        {FILTER_CHIPS.map(({ value, label }) => {
          const isActive = timeFilter === value;
          return (
            <motion.button
              key={value}
              onClick={() => setTimeFilter(value)}
              whileTap={{ scale: 0.95 }}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 whitespace-nowrap',
                isActive ? ACTIVE_CHIP : INACTIVE_CHIP,
              )}
            >
              {label}
            </motion.button>
          );
        })}

        {/* 더보기 토글 */}
        <motion.button
          onClick={() => { setShowMore(!showMore); setShowDays(false); setShowGu(false); }}
          whileTap={{ scale: 0.95 }}
          className={cn(
            'relative flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-all duration-200',
            showMore || activeSecondaryCount > 0 ? ACTIVE_CHIP : INACTIVE_CHIP,
          )}
        >
          <SlidersHorizontal className="h-3 w-3" />
          {activeSecondaryCount > 0 && (
            <span className={cn(
              'absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold',
              showMore ? 'bg-background text-foreground' : 'bg-foreground text-background',
            )}>
              {activeSecondaryCount}
            </span>
          )}
        </motion.button>
      </div>

      {/* 2행: 세부 필터 (접이식) */}
      <AnimatePresence>
        {showMore && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex gap-1.5 flex-wrap justify-center">
              {/* 요일 필터 */}
              <div className="relative">
                <motion.button
                  onClick={() => { setShowDays(!showDays); setShowGu(false); }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200',
                    dayFilter !== 'today' ? ACTIVE_CHIP : INACTIVE_CHIP,
                  )}
                >
                  <Calendar className="h-3 w-3" />
                  {dayFilter === 'today' ? '오늘' : `${dayFilter}요일`}
                  <ChevronDown className="h-3 w-3" />
                </motion.button>

                {showDays && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full mt-1 left-0 z-20 flex gap-1 rounded-2xl border border-border bg-background/95 backdrop-blur-md p-2 shadow-lg"
                  >
                    {DAY_CHIPS.map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => { setDayFilter(value); setShowDays(false); }}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                          dayFilter === value
                            ? 'bg-foreground text-background'
                            : 'hover:bg-muted text-muted-foreground',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* 구 필터 */}
              <div className="relative">
                <motion.button
                  onClick={() => { setShowGu(!showGu); setShowDays(false); }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200',
                    guFilter ? ACTIVE_CHIP : INACTIVE_CHIP,
                  )}
                >
                  <MapPin className="h-3 w-3" />
                  {guFilter ?? '서울 전체'}
                  <ChevronDown className="h-3 w-3" />
                </motion.button>

                {showGu && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full mt-1 right-0 z-20 max-h-60 w-36 overflow-y-auto rounded-2xl border border-border bg-background/95 backdrop-blur-md p-2 shadow-lg"
                  >
                    <button
                      onClick={() => { setGuFilter(null); setShowGu(false); }}
                      className={cn(
                        'w-full rounded-xl px-3 py-1.5 text-left text-xs font-medium transition-colors',
                        !guFilter ? 'bg-foreground text-background' : 'hover:bg-muted text-muted-foreground',
                      )}
                    >
                      서울 전체
                    </button>
                    {availableGus.map((gu) => (
                      <button
                        key={gu}
                        onClick={() => { setGuFilter(gu); setShowGu(false); }}
                        className={cn(
                          'w-full rounded-xl px-3 py-1.5 text-left text-xs font-medium transition-colors',
                          guFilter === gu ? 'bg-foreground text-background' : 'hover:bg-muted text-muted-foreground',
                        )}
                      >
                        {gu}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* 체인점 필터 */}
              <motion.button
                onClick={() => setHideChains(!hideChains)}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  'flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200',
                  hideChains ? ACTIVE_CHIP : INACTIVE_CHIP,
                )}
              >
                <Store className="h-3 w-3" />
                {hideChains ? '개인카페만' : '체인점 포함'}
              </motion.button>

              {/* 24시간 필터 */}
              <motion.button
                onClick={() => setHide24h(!hide24h)}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  'flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200',
                  hide24h ? ACTIVE_CHIP : INACTIVE_CHIP,
                )}
              >
                <Clock className="h-3 w-3" />
                {hide24h ? '24시간 제외' : '24시간 포함'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 결과 카운트 */}
      <motion.div
        key={filteredCafes.length}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="rounded-full bg-foreground/90 px-3 py-1 text-[11px] font-semibold text-background shadow-lg backdrop-blur-sm"
      >
        {filteredCafes.length.toLocaleString()}개 카페
      </motion.div>
    </div>
  );
}
