'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, MapPin, Trash2 } from 'lucide-react';
import { useRecentCafes } from '@/lib/hooks/use-recent-cafes';
import { useCafeStore, getOpenStatus, is24Hours, type Cafe } from '@/lib/store/cafe-store';
import { cn } from '@/lib/utils';

function formatOpeningTime(openingTime: string | null): string {
  if (!openingTime) return '정보 없음';
  const parts = openingTime.split(':');
  return `${parts[0] ?? '00'}:${parts[1] ?? '00'}`;
}

function getOpeningBadgeStyle(openingTime: string | null): string {
  if (!openingTime) return 'bg-muted text-muted-foreground';
  const parts = openingTime.split(':');
  const totalMinutes = parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
  if (totalMinutes < 360) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (totalMinutes < 420) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
}

export default function RecentPage() {
  const { recentIds, clearRecent } = useRecentCafes();
  const cafes = useCafeStore((state) => state.cafes);
  const fetchCafes = useCafeStore((state) => state.fetchCafes);
  const setSelectedCafe = useCafeStore((state) => state.setSelectedCafe);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (cafes.length === 0) fetchCafes();
  }, [cafes.length, fetchCafes]);

  if (!mounted) return null;

  // Preserve insertion order: recentIds is newest-first
  const cafeMap = new Map<string, Cafe>(cafes.map((c) => [c.id, c]));
  const recentCafes = recentIds
    .map((id) => cafeMap.get(id))
    .filter((c): c is Cafe => c !== undefined);

  function handleSelectCafe(cafe: Cafe) {
    setSelectedCafe(cafe);
    router.push('/');
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border px-5 py-4">
        <Clock className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-bold">최근 본 카페</h1>
        <span className="text-sm text-muted-foreground">({recentCafes.length})</span>
        {recentCafes.length > 0 && (
          <button
            onClick={clearRecent}
            className="ml-auto flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="전체 삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
            전체 삭제
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {recentCafes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Clock className="h-10 w-10 stroke-1" />
            <p className="text-sm">아직 본 카페가 없어요</p>
            <p className="text-xs">지도에서 카페를 탭해보세요</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {recentCafes.map((cafe, index) => (
                <motion.li
                  key={cafe.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.18, delay: index * 0.03 }}
                >
                  <RecentCafeItem cafe={cafe} onSelect={() => handleSelectCafe(cafe)} />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}

function RecentCafeItem({ cafe, onSelect }: { cafe: Cafe; onSelect: () => void }) {
  const displayAddress = cafe.road_address ?? cafe.address;
  const cafe24h = is24Hours(cafe);
  const openStatus = cafe24h ? ('open' as const) : getOpenStatus(cafe);
  const openingFormatted = cafe24h ? '24시간' : formatOpeningTime(cafe.opening_time);
  const badgeStyle = cafe24h
    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    : getOpeningBadgeStyle(cafe.opening_time);

  return (
    <button
      onClick={onSelect}
      className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-muted/50 transition-colors"
    >
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold truncate">{cafe.name}</span>
          {openStatus !== 'unknown' && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap',
                openStatus === 'open'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              )}
            >
              <span
                className={cn(
                  'inline-block h-1.5 w-1.5 rounded-full',
                  openStatus === 'open' ? 'bg-emerald-500' : 'bg-gray-400'
                )}
              />
              {openStatus === 'open' ? '영업중' : '영업 전'}
            </span>
          )}
          {(cafe.opening_time || cafe24h) && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap',
                badgeStyle
              )}
            >
              <Clock className="h-2.5 w-2.5" />
              {cafe24h ? '24시간 영업' : `아침 ${openingFormatted} 오픈`}
            </span>
          )}
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground truncate">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          {displayAddress}
        </p>
      </div>
    </button>
  );
}
