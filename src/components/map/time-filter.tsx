'use client';

import { motion } from 'framer-motion';
import { useCafeStore, type TimeFilter } from '@/lib/store/cafe-store';

interface FilterChip {
  value: TimeFilter;
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

  return (
    <div className="absolute top-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
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
  );
}
