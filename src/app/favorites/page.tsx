'use client';

import { useEffect, useState } from 'react';
import { Heart, MapPin, Clock, ExternalLink } from 'lucide-react';
import { useFavorites } from '@/lib/hooks/use-favorites';
import { useCafeStore, getOpenStatus, type Cafe } from '@/lib/store/cafe-store';
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

export default function FavoritesPage() {
  const { favorites, toggleFavorite } = useFavorites();
  const cafes = useCafeStore((state) => state.cafes);
  const fetchCafes = useCafeStore((state) => state.fetchCafes);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (cafes.length === 0) fetchCafes();
  }, [cafes.length, fetchCafes]);

  if (!mounted) return null;

  const favoriteCafes = cafes.filter((cafe) => favorites.has(cafe.id));

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border px-5 py-4">
        <Heart className="h-5 w-5 text-red-500" />
        <h1 className="text-lg font-bold">즐겨찾기</h1>
        <span className="text-sm text-muted-foreground">({favoriteCafes.length})</span>
      </header>

      <div className="flex-1 overflow-y-auto">
        {favoriteCafes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Heart className="h-10 w-10 stroke-1" />
            <p className="text-sm">즐겨찾기한 카페가 없습니다</p>
            <p className="text-xs">지도에서 하트를 눌러 추가하세요</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {favoriteCafes.map((cafe) => (
              <CafeItem
                key={cafe.id}
                cafe={cafe}
                onRemove={() => toggleFavorite(cafe.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CafeItem({ cafe, onRemove }: { cafe: Cafe; onRemove: () => void }) {
  const displayAddress = cafe.road_address ?? cafe.address;
  const openStatus = getOpenStatus(cafe);

  return (
    <li className="flex items-start gap-3 px-5 py-4">
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
              <span className={cn(
                'inline-block h-1.5 w-1.5 rounded-full',
                openStatus === 'open' ? 'bg-emerald-500' : 'bg-gray-400'
              )} />
              {openStatus === 'open' ? '영업중' : '영업 전'}
            </span>
          )}
          {cafe.opening_time && (
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap',
                getOpeningBadgeStyle(cafe.opening_time),
              )}
            >
              <Clock className="mr-0.5 h-2.5 w-2.5" />
              {formatOpeningTime(cafe.opening_time)}
            </span>
          )}
        </div>
        <p className="flex items-center gap-1 text-xs text-muted-foreground truncate">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          {displayAddress}
        </p>
        {cafe.place_url && (
          <a
            href={cafe.place_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            카카오맵
          </a>
        )}
      </div>
      <button
        onClick={onRemove}
        className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors"
        aria-label="즐겨찾기 제거"
      >
        <Heart className="h-4 w-4 fill-red-500 stroke-red-500" />
      </button>
    </li>
  );
}
