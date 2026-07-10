'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, MapPin, Store, ChevronDown, RotateCcw } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useTranslations } from 'next-intl';
import {
  useCafeStore,
  type TimeFilter as TimeFilterType,
  type DayFilter,
} from '@/lib/store/cafe-store';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';

// ---- data -------------------------------------------------------------------

const TIME_OPTIONS: { value: TimeFilterType; labelKey: string }[] = [
  { value: 'all', labelKey: 'all' },
  { value: 'before6', labelKey: 'before6' },
  { value: '6to7', labelKey: '6to7' },
  { value: '7to8', labelKey: '7to8' },
] as const;

const DAY_OPTIONS: { value: DayFilter; labelKey: string }[] = [
  { value: 'today', labelKey: 'today' },
  { value: '월', labelKey: 'days.mon' },
  { value: '화', labelKey: 'days.tue' },
  { value: '수', labelKey: 'days.wed' },
  { value: '목', labelKey: 'days.thu' },
  { value: '금', labelKey: 'days.fri' },
  { value: '토', labelKey: 'days.sat' },
  { value: '일', labelKey: 'days.sun' },
] as const;

const DAY_KEY_MAP: Record<string, string> = {
  '월': 'mon',
  '화': 'tue',
  '수': 'wed',
  '목': 'thu',
  '금': 'fri',
  '토': 'sat',
  '일': 'sun',
};

// ---- dropdown helper --------------------------------------------------------

interface DropdownProps {
  trigger: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  align?: 'left' | 'right';
}

function Dropdown({ trigger, open, onToggle, children, align = 'left' }: DropdownProps) {
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: Event) {
      const target = e.target as Node;
      // Ignore clicks inside the dropdown or on the trigger
      if (ref.current && ref.current.contains(target)) return;
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      onToggle();
    }
    // Use setTimeout so the current click event doesn't immediately close
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('touchstart', handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('touchstart', handleClick);
    };
  }, [open, onToggle]);

  return (
    <div className="relative">
      <div
        ref={triggerRef}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        className="cursor-pointer"
      >
        {trigger}
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={ref}
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute top-full mt-1.5 z-30 rounded-2xl border border-border/60 bg-background/95 backdrop-blur-xl p-1.5 shadow-lg',
              align === 'right' ? 'right-0' : 'left-0',
            )}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- chip styles ------------------------------------------------------------

const CHIP_BASE = 'flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all duration-150';
const CHIP_ACTIVE = `${CHIP_BASE} bg-foreground text-background shadow-sm`;
const CHIP_INACTIVE = `${CHIP_BASE} bg-background/90 text-muted-foreground backdrop-blur-xl border border-border/60 hover:bg-background hover:border-foreground/15`;

// ---- 서울 25구 + 경기도 주요 도시 중심 좌표 ------------------------------------

const GU_CENTERS: Record<string, { lat: number; lng: number }> = {
  // 서울 25구
  '강남구': { lat: 37.5172, lng: 127.0473 },
  '강동구': { lat: 37.5301, lng: 127.1238 },
  '강북구': { lat: 37.6396, lng: 127.0257 },
  '강서구': { lat: 37.5509, lng: 126.8495 },
  '관악구': { lat: 37.4784, lng: 126.9516 },
  '광진구': { lat: 37.5385, lng: 127.0823 },
  '구로구': { lat: 37.4954, lng: 126.8874 },
  '금천구': { lat: 37.4568, lng: 126.8955 },
  '노원구': { lat: 37.6542, lng: 127.0568 },
  '도봉구': { lat: 37.6688, lng: 127.0471 },
  '동대문구': { lat: 37.5744, lng: 127.0396 },
  '동작구': { lat: 37.5124, lng: 126.9393 },
  '마포구': { lat: 37.5638, lng: 126.9084 },
  '서대문구': { lat: 37.5791, lng: 126.9368 },
  '서초구': { lat: 37.4837, lng: 127.0324 },
  '성동구': { lat: 37.5633, lng: 127.0371 },
  '성북구': { lat: 37.5894, lng: 127.0167 },
  '송파구': { lat: 37.5145, lng: 127.1060 },
  '양천구': { lat: 37.5169, lng: 126.8664 },
  '영등포구': { lat: 37.5264, lng: 126.8963 },
  '용산구': { lat: 37.5324, lng: 126.9906 },
  '은평구': { lat: 37.6027, lng: 126.9291 },
  '종로구': { lat: 37.5735, lng: 126.9790 },
  '중구': { lat: 37.5641, lng: 126.9979 },
  '중랑구': { lat: 37.6063, lng: 127.0928 },
  // 경기도 주요 도시
  '성남시 분당구': { lat: 37.3825, lng: 127.1195 },
  '성남시 수정구': { lat: 37.4501, lng: 127.1457 },
  '성남시 중원구': { lat: 37.4319, lng: 127.1194 },
  '수원시 영통구': { lat: 37.2594, lng: 127.0466 },
  '수원시 장안구': { lat: 37.3040, lng: 127.0107 },
  '수원시 팔달구': { lat: 37.2821, lng: 127.0195 },
  '수원시 권선구': { lat: 37.2574, lng: 126.9716 },
  '용인시 수지구': { lat: 37.3219, lng: 127.0986 },
  '용인시 기흥구': { lat: 37.2805, lng: 127.1150 },
  '용인시 처인구': { lat: 37.2341, lng: 127.2010 },
  '고양시 일산동구': { lat: 37.6687, lng: 126.7735 },
  '고양시 일산서구': { lat: 37.6753, lng: 126.7505 },
  '고양시 덕양구': { lat: 37.6376, lng: 126.8320 },
  '부천시': { lat: 37.5034, lng: 126.7660 },
  '안양시 동안구': { lat: 37.3943, lng: 126.9568 },
  '안양시 만안구': { lat: 37.3866, lng: 126.9270 },
  '하남시': { lat: 37.5393, lng: 127.2147 },
  '광명시': { lat: 37.4786, lng: 126.8647 },
  '과천시': { lat: 37.4292, lng: 126.9876 },
  '의왕시': { lat: 37.3449, lng: 126.9685 },
  '구리시': { lat: 37.5943, lng: 127.1295 },
  '남양주시': { lat: 37.6360, lng: 127.2163 },
  '파주시': { lat: 37.7598, lng: 126.7800 },
  '김포시': { lat: 37.6153, lng: 126.7156 },
  '화성시': { lat: 37.2000, lng: 126.8313 },
  // 경기도 확장 (2026-07-10)
  '광주시': { lat: 37.4294, lng: 127.2551 },
  '의정부시': { lat: 37.7381, lng: 127.0338 },
  '안산시 상록구': { lat: 37.3008, lng: 126.8468 },
  '안산시 단원구': { lat: 37.3184, lng: 126.7687 },
  '시흥시': { lat: 37.3800, lng: 126.8028 },
  '군포시': { lat: 37.3617, lng: 126.9352 },
  '오산시': { lat: 37.1497, lng: 127.0770 },
  '양주시': { lat: 37.7852, lng: 127.0456 },
  '동두천시': { lat: 37.9034, lng: 127.0606 },
  '포천시': { lat: 37.8947, lng: 127.2002 },
  '이천시': { lat: 37.2720, lng: 127.4350 },
  '평택시': { lat: 36.9924, lng: 127.1127 },
  '안성시': { lat: 37.0080, lng: 127.2798 },
  '여주시': { lat: 37.2983, lng: 127.6372 },
  '양평군': { lat: 37.4917, lng: 127.4876 },
  '가평군': { lat: 37.8315, lng: 127.5095 },
  '연천군': { lat: 38.0966, lng: 127.0745 },
};

// ---- main component ---------------------------------------------------------

interface TimeFilterProps {
  onPanToGu?: (lat: number, lng: number) => void;
}

export function TimeFilter({ onPanToGu }: TimeFilterProps = {}) {
  const t = useTranslations('filter');
  const { timeFilter, dayFilter, guFilter, hideChains, hide24h, availableGus } = useCafeStore(
    useShallow((s) => ({
      timeFilter: s.timeFilter,
      dayFilter: s.dayFilter,
      guFilter: s.guFilter,
      hideChains: s.hideChains,
      hide24h: s.hide24h,
      availableGus: s.availableGus,
    })),
  );
  const { setTimeFilter, setDayFilter, setGuFilter, setHideChains, setHide24h, resetFilters } = useCafeStore(
    useShallow((s) => ({
      setTimeFilter: s.setTimeFilter,
      setDayFilter: s.setDayFilter,
      setGuFilter: s.setGuFilter,
      setHideChains: s.setHideChains,
      setHide24h: s.setHide24h,
      resetFilters: s.resetFilters,
    })),
  );
  const filteredCount = useCafeStore((s) => s.filteredCafes.length);

  const activeFilterCount = [
    timeFilter !== 'all',
    dayFilter !== 'today',
    guFilter !== null,
    !hideChains, // default is true, so false = actively changed
    hide24h,
  ].filter(Boolean).length;

  const [openDropdown, setOpenDropdown] = useState<'time' | 'area' | null>(null);

  const timeLabel = t(TIME_OPTIONS.find((o) => o.value === timeFilter)?.labelKey ?? 'all');
  const dayLabel = dayFilter === 'today' ? t('today') : t(`days.${DAY_KEY_MAP[dayFilter] ?? dayFilter}`);

  function toggleDropdown(key: 'time' | 'area') {
    setOpenDropdown((prev) => (prev === key ? null : key));
  }

  return (
    <div className="absolute left-4 right-4 z-10 flex flex-wrap items-center justify-center gap-1.5 py-1" style={{ top: 'calc(4rem + var(--safe-area-top))' }}>
      {/* 시간 & 요일 드롭다운 */}
      <Dropdown
        open={openDropdown === 'time'}
        onToggle={() => toggleDropdown('time')}
        trigger={
          <div className={cn(
            CHIP_BASE,
            timeFilter !== 'all' || dayFilter !== 'today' ? CHIP_ACTIVE : CHIP_INACTIVE,
          )}>
            <Clock className="h-3 w-3" />
            <span>{timeLabel}</span>
            <span className="text-[10px] opacity-70">· {dayLabel}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </div>
        }
      >
        <div className="w-52">
          {/* 시간 */}
          <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t('openTime')}</p>
          <div className="flex flex-wrap gap-1 px-1 pb-2">
            {TIME_OPTIONS.map(({ value, labelKey }) => (
              <button
                key={value}
                onClick={() => { trackEvent('filter_time', { value }); setTimeFilter(value); }}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                  timeFilter === value ? 'bg-foreground text-background' : 'hover:bg-muted text-muted-foreground',
                )}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
          <div className="h-px bg-border mx-1" />
          {/* 요일 */}
          <p className="px-2 pt-2 pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{t('dayOfWeek')}</p>
          <div className="flex flex-wrap gap-1 px-1 pb-1.5">
            {DAY_OPTIONS.map(({ value, labelKey }) => (
              <button
                key={value}
                onClick={() => { trackEvent('filter_day', { value }); setDayFilter(value); }}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                  dayFilter === value ? 'bg-foreground text-background' : 'hover:bg-muted text-muted-foreground',
                )}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>
      </Dropdown>

      {/* 지역 드롭다운 */}
      <Dropdown
        open={openDropdown === 'area'}
        onToggle={() => toggleDropdown('area')}
        trigger={
          <div className={cn(
            CHIP_BASE,
            guFilter ? CHIP_ACTIVE : CHIP_INACTIVE,
          )}>
            <MapPin className="h-3 w-3" />
            <span>{guFilter ?? t('all')}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </div>
        }
        align="left"
      >
        <div className="w-44 max-h-60 overflow-y-auto">
          <button
            onClick={() => { trackEvent('filter_gu', { value: 'all' }); setGuFilter(null); setOpenDropdown(null); }}
            className={cn(
              'w-full rounded-xl px-3 py-1.5 text-left text-xs font-medium transition-colors',
              !guFilter ? 'bg-foreground text-background' : 'hover:bg-muted text-muted-foreground',
            )}
          >
            {t('allAreas')}
          </button>
          {availableGus.map((gu) => (
            <button
              key={gu}
              onClick={() => {
                trackEvent('filter_gu', { value: gu });
                setGuFilter(gu);
                setOpenDropdown(null);
                const center = GU_CENTERS[gu];
                if (center && onPanToGu) onPanToGu(center.lat, center.lng);
              }}
              className={cn(
                'w-full rounded-xl px-3 py-1.5 text-left text-xs font-medium transition-colors',
                guFilter === gu ? 'bg-foreground text-background' : 'hover:bg-muted text-muted-foreground',
              )}
            >
              {gu}
            </button>
          ))}
        </div>
      </Dropdown>

      {/* 체인점 토글 */}
      <button
        onClick={() => { trackEvent('filter_chains', { hide: !hideChains ? 'yes' : 'no' }); setHideChains(!hideChains); }}
        className={hideChains ? CHIP_ACTIVE : CHIP_INACTIVE}
      >
        <Store className="h-3 w-3" />
        {hideChains ? t('personal') : t('all')}
      </button>

      {/* 24시간 토글 */}
      {hide24h && (
        <button
          onClick={() => setHide24h(false)}
          className={CHIP_ACTIVE}
        >
          {t('exclude24h')}
        </button>
      )}

      {/* 카운트 */}
      <motion.span
        key={filteredCount}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="rounded-full bg-foreground/90 px-2.5 py-1.5 text-[10px] font-semibold text-background shadow-sm backdrop-blur-sm whitespace-nowrap"
      >
        {t('totalCount', { count: filteredCount.toLocaleString() })}
      </motion.span>

      {/* 초기화 */}
      {activeFilterCount > 0 && (
        <button
          onClick={() => { trackEvent('reset_filters'); resetFilters(); }}
          className={`${CHIP_BASE} bg-background/90 text-foreground backdrop-blur-xl border border-border/60 hover:bg-foreground/5 !px-1.5`}
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
