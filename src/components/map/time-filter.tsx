'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, MapPin, Store, ChevronDown } from 'lucide-react';
import {
  useCafeStore,
  type TimeFilter as TimeFilterType,
  type DayFilter,
} from '@/lib/store/cafe-store';
import { cn } from '@/lib/utils';

// ---- data -------------------------------------------------------------------

const TIME_OPTIONS: { value: TimeFilterType; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'before6', label: '~6시' },
  { value: '6to7', label: '6~7시' },
  { value: '7to8', label: '7~8시' },
];

const DAY_OPTIONS: { value: DayFilter; label: string }[] = [
  { value: 'today', label: '오늘' },
  { value: '월', label: '월' },
  { value: '화', label: '화' },
  { value: '수', label: '수' },
  { value: '목', label: '목' },
  { value: '금', label: '금' },
  { value: '토', label: '토' },
  { value: '일', label: '일' },
];

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
      <div ref={triggerRef} onClick={onToggle} role="button" tabIndex={0} className="cursor-pointer">
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
              'absolute top-full mt-1.5 z-30 rounded-2xl border border-border bg-background/95 backdrop-blur-md p-1.5 shadow-xl',
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
const CHIP_INACTIVE = `${CHIP_BASE} bg-background/80 text-muted-foreground backdrop-blur-md border border-border hover:bg-background`;

// ---- main component ---------------------------------------------------------

export function TimeFilter() {
  const timeFilter = useCafeStore((s) => s.timeFilter);
  const setTimeFilter = useCafeStore((s) => s.setTimeFilter);
  const dayFilter = useCafeStore((s) => s.dayFilter);
  const setDayFilter = useCafeStore((s) => s.setDayFilter);
  const guFilter = useCafeStore((s) => s.guFilter);
  const setGuFilter = useCafeStore((s) => s.setGuFilter);
  const hideChains = useCafeStore((s) => s.hideChains);
  const setHideChains = useCafeStore((s) => s.setHideChains);
  const hide24h = useCafeStore((s) => s.hide24h);
  const setHide24h = useCafeStore((s) => s.setHide24h);
  const availableGus = useCafeStore((s) => s.availableGus);
  const filteredCount = useCafeStore((s) => s.filteredCafes).length;

  const [openDropdown, setOpenDropdown] = useState<'time' | 'area' | null>(null);

  const timeLabel = TIME_OPTIONS.find((o) => o.value === timeFilter)?.label ?? '전체';
  const dayLabel = dayFilter === 'today' ? '오늘' : `${dayFilter}요일`;

  function toggleDropdown(key: 'time' | 'area') {
    setOpenDropdown((prev) => (prev === key ? null : key));
  }

  return (
    <div className="absolute top-16 left-3 right-3 z-10 flex items-center justify-center gap-1.5">
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
          <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">오픈 시간</p>
          <div className="flex flex-wrap gap-1 px-1 pb-2">
            {TIME_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => { setTimeFilter(value); }}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                  timeFilter === value ? 'bg-foreground text-background' : 'hover:bg-muted text-muted-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="h-px bg-border mx-1" />
          {/* 요일 */}
          <p className="px-2 pt-2 pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">요일</p>
          <div className="flex flex-wrap gap-1 px-1 pb-1.5">
            {DAY_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => { setDayFilter(value); }}
                className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                  dayFilter === value ? 'bg-foreground text-background' : 'hover:bg-muted text-muted-foreground',
                )}
              >
                {label}
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
            <span>{guFilter ?? '전체'}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </div>
        }
        align="left"
      >
        <div className="w-36 max-h-60 overflow-y-auto">
          <button
            onClick={() => { setGuFilter(null); setOpenDropdown(null); }}
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
              onClick={() => { setGuFilter(gu); setOpenDropdown(null); }}
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
        onClick={() => setHideChains(!hideChains)}
        className={hideChains ? CHIP_ACTIVE : CHIP_INACTIVE}
      >
        <Store className="h-3 w-3" />
        {hideChains ? '개인만' : '전체'}
      </button>

      {/* 24시간 토글 */}
      {hide24h && (
        <button
          onClick={() => setHide24h(false)}
          className={CHIP_ACTIVE}
        >
          24h 제외
        </button>
      )}

      {/* 카운트 */}
      <motion.span
        key={filteredCount}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="rounded-full bg-foreground/90 px-2.5 py-1.5 text-[10px] font-semibold text-background shadow-md backdrop-blur-sm whitespace-nowrap"
      >
        총 {filteredCount.toLocaleString()}개
      </motion.span>
    </div>
  );
}
