'use client';

import { motion } from 'framer-motion';
import { Store } from 'lucide-react';
import { useCafeStore, type TimeFilter as TimeFilterType } from '@/lib/store/cafe-store';

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

export function TimeFilter() {
  const timeFilter = useCafeStore((state) => state.timeFilter);
  const setTimeFilter = useCafeStore((state) => state.setTimeFilter);
  const hideChains = useCafeStore((state) => state.hideChains);
  const setHideChains = useCafeStore((state) => state.setHideChains);

  return (
    <div className="absolute top-4 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2">
      {/* 시간 필터 */}
      <div className="flex gap-2">
        {FILTER_CHIPS.map(({ value, label }) => {
          const isActive = timeFilter === value;
          return (
            <motion.button
              key={value}
              onClick={() => setTimeFilter(value)}
              whileTap={{ scale: 0.95 }}
              className={[
                'rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 whitespace-nowrap',
                isActive
                  ? 'bg-foreground text-background shadow-md'
                  : 'border border-border bg-background/80 text-muted-foreground backdrop-blur-md hover:bg-background',
              ].join(' ')}
            >
              {label}
            </motion.button>
          );
        })}
      </div>

      {/* 체인점 필터 토글 */}
      <motion.button
        onClick={() => setHideChains(!hideChains)}
        whileTap={{ scale: 0.95 }}
        className={[
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200',
          hideChains
            ? 'bg-amber-500 text-white shadow-md'
            : 'border border-border bg-background/80 text-muted-foreground backdrop-blur-md hover:bg-background',
        ].join(' ')}
      >
        <Store className="h-3 w-3" />
        {hideChains ? '개인카페만' : '체인점 포함'}
      </motion.button>
    </div>
  );
}
