'use client';

import { useState } from 'react';
import { Bookmark, Clock, Check } from 'lucide-react';
import { useFavorites } from '@/lib/hooks/use-favorites';
import { useRecentCafes } from '@/lib/hooks/use-recent-cafes';
import { useCafeStore } from '@/lib/store/cafe-store';
import { type Cafe } from '@/lib/types/cafe';
import { cn } from '@/lib/utils';

interface CafeQuickAddProps {
  selectedIds: Set<string>;
  onAdd: (cafe: Cafe) => void;
  maxItems?: number;
}

export function CafeQuickAdd({ selectedIds, onAdd, maxItems = 3 }: CafeQuickAddProps) {
  const [tab, setTab] = useState<'favorites' | 'recent'>('favorites');
  const { favorites } = useFavorites();
  const { recentIds } = useRecentCafes();
  const cafes = useCafeStore((s) => s.cafes);

  const cafeMap = new Map(cafes.map((c) => [c.id, c]));

  const favCafes = [...favorites]
    .map((id) => cafeMap.get(id))
    .filter((c): c is Cafe => c !== undefined)
    .slice(0, 10);

  const recentCafes = recentIds
    .map((id) => cafeMap.get(id))
    .filter((c): c is Cafe => c !== undefined)
    .slice(0, 10);

  const list = tab === 'favorites' ? favCafes : recentCafes;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          onClick={() => setTab('favorites')}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
            tab === 'favorites'
              ? 'bg-foreground text-background'
              : 'bg-muted/60 text-muted-foreground hover:bg-muted',
          )}
        >
          <Bookmark className="h-3 w-3" />
          찜 ({favCafes.length})
        </button>
        <button
          onClick={() => setTab('recent')}
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
            tab === 'recent'
              ? 'bg-foreground text-background'
              : 'bg-muted/60 text-muted-foreground hover:bg-muted',
          )}
        >
          <Clock className="h-3 w-3" />
          최근 ({recentCafes.length})
        </button>
      </div>

      {list.length === 0 ? (
        <p className="py-3 text-xs text-muted-foreground/60">
          {tab === 'favorites' ? '찜한 카페가 없어요' : '최근 본 카페가 없어요'}
        </p>
      ) : (
        <div className="flex flex-col">
          {list.slice(0, maxItems === Infinity ? undefined : maxItems * 3).map((cafe) => {
            const isAdded = selectedIds.has(cafe.id);
            return (
              <button
                key={cafe.id}
                onClick={() => !isAdded && onAdd(cafe)}
                disabled={isAdded}
                className={cn(
                  'flex items-center gap-3 px-1 py-2.5',
                  'border-b border-border/30 last:border-b-0',
                  'text-left transition-colors',
                  isAdded ? 'opacity-40' : 'hover:bg-muted/30',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">{cafe.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {cafe.road_address ?? cafe.address}
                  </p>
                </div>
                {isAdded && <Check className="h-4 w-4 flex-shrink-0 text-red-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
