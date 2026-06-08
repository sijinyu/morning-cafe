'use client';

import { MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { type Cafe } from '@/lib/types/cafe';
import { formatOpeningTime } from '@/lib/cafe-utils';

interface AiResultCardProps {
  cafe: Cafe;
  reason: string;
  score: number;
  index: number;
  onSelect: (cafe: Cafe) => void;
}

export function AiResultCard({ cafe, reason, score, index, onSelect }: AiResultCardProps) {
  const scorePercent = Math.round(score * 10);

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.06, type: 'tween', ease: 'easeOut' }}
      onClick={() => onSelect(cafe)}
      className={cn(
        'w-full rounded-2xl border border-border/50 bg-background p-4',
        'text-left transition-colors hover:bg-muted/50 active:bg-muted/70',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-foreground">{cafe.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {cafe.road_address ?? cafe.address}
          </p>
        </div>
        <span
          className={cn(
            'flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
            scorePercent >= 80
              ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
              : scorePercent >= 60
                ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                : 'bg-muted text-muted-foreground',
          )}
        >
          {scorePercent}점
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{reason}</p>
      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground/70">
        <MapPin className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">
          {cafe.opening_time ? `${formatOpeningTime(cafe.opening_time)} 오픈` : '오픈 시간 미확인'}
        </span>
      </div>
    </motion.button>
  );
}
