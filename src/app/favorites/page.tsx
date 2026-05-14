'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { useAuthStore } from '@/lib/store/auth-store';
import { useCafeStore, type Cafe } from '@/lib/store/cafe-store';
import { createClient } from '@/lib/supabase/client';
import { FavoriteButton } from '@/components/cafe/favorite-button';
import { cn } from '@/lib/utils';

function formatOpeningTime(openingTime: string | null): string {
  if (!openingTime) return '';
  const parts = openingTime.split(':');
  const hours = parts[0] ?? '00';
  const minutes = parts[1] ?? '00';
  return `${hours}:${minutes}`;
}

function getOpeningBadgeStyle(openingTime: string | null): string {
  if (!openingTime) return 'bg-muted text-muted-foreground';
  const parts = openingTime.split(':');
  const totalMinutes = parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
  if (totalMinutes < 360) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (totalMinutes < 420) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
  return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
}

interface FavoriteCafe extends Cafe {
  favoriteId: string;
}

export default function FavoritesPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.loading);
  const setSelectedCafe = useCafeStore((state) => state.setSelectedCafe);

  const [favorites, setFavorites] = useState<FavoriteCafe[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setFavorites([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      // Step 1: get favorite cafe IDs for this user
      const { data: favData, error: favError } = await supabase
        .from('favorites')
        .select('id, cafe_id, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (favError || !favData || favData.length === 0) {
        setFavorites([]);
        setLoading(false);
        return;
      }

      const cafeIds = favData.map((row) => row.cafe_id as string);

      // Step 2: fetch cafe details from the view
      const { data: cafeData, error: cafeError } = await supabase
        .from('cafes_with_coords')
        .select('*')
        .in('id', cafeIds);

      if (cafeError || !cafeData) {
        setFavorites([]);
        setLoading(false);
        return;
      }

      // Build a map for efficient lookup
      const cafeMap = new Map<string, Record<string, unknown>>();
      for (const row of cafeData) {
        cafeMap.set(row.id as string, row as Record<string, unknown>);
      }

      // Preserve favorites ordering and merge with cafe data
      const parsed: FavoriteCafe[] = favData
        .filter((row) => cafeMap.has(row.cafe_id as string))
        .map((row) => {
          const cafe = cafeMap.get(row.cafe_id as string)!;
          return {
            favoriteId: row.id as string,
            id: cafe['id'] as string,
            kakao_place_id: cafe['kakao_place_id'] as string,
            name: cafe['name'] as string,
            address: cafe['address'] as string,
            road_address: cafe['road_address'] as string | null,
            phone: cafe['phone'] as string | null,
            latitude: cafe['latitude'] as number,
            longitude: cafe['longitude'] as number,
            place_url: cafe['place_url'] as string | null,
            instagram_url: cafe['instagram_url'] as string | null,
            category: cafe['category'] as string | null,
            opening_time: cafe['opening_time'] as string | null,
            closing_time: cafe['closing_time'] as string | null,
            hours_by_day: cafe['hours_by_day'] as Record<string, string> | null,
            is_earlybird: cafe['is_earlybird'] as boolean,
            last_crawled_at: cafe['last_crawled_at'] as string | null,
          };
        });

      setFavorites(parsed);
    } catch {
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  function handleCafeClick(cafe: FavoriteCafe) {
    setSelectedCafe(cafe);
    router.push('/');
  }

  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <Heart className="h-10 w-10 text-muted-foreground/30" />
        </div>
        <h1 className="text-xl font-bold">즐겨찾기</h1>
        <p className="text-sm text-muted-foreground">
          로그인하고 즐겨찾는 카페를 저장해보세요
        </p>
        <button
          onClick={() => router.push('/login')}
          className="mt-2 rounded-full bg-foreground px-8 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-80"
        >
          카카오로 로그인
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-0 pt-4">
        <div className="px-5 pb-4">
          <h1 className="text-xl font-bold">즐겨찾기</h1>
        </div>
        <div className="px-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <Heart className="h-10 w-10 text-muted-foreground/30" />
        </div>
        <h1 className="text-xl font-bold">즐겨찾기</h1>
        <p className="text-sm text-muted-foreground">
          아직 즐겨찾기한 카페가 없어요
        </p>
        <p className="text-xs text-muted-foreground/60">
          지도에서 카페를 선택하고 하트를 눌러보세요
        </p>
        <button
          onClick={() => router.push('/')}
          className="mt-2 rounded-full bg-foreground px-8 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-80"
        >
          지도에서 카페 찾기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-6 pb-4">
        <h1 className="text-xl font-bold">즐겨찾기</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {favorites.length}개의 카페
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
        {favorites.map((cafe) => {
          const displayAddress = cafe.road_address ?? cafe.address;
          const openingFormatted = formatOpeningTime(cafe.opening_time);
          const badgeStyle = getOpeningBadgeStyle(cafe.opening_time);

          return (
            <div
              key={cafe.favoriteId}
              className={cn(
                'rounded-2xl border border-border bg-card p-4',
                'shadow-sm hover:shadow-md transition-shadow'
              )}
            >
              <div className="flex items-start gap-3">
                {/* Clickable area */}
                <button
                  onClick={() => handleCafeClick(cafe)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-semibold text-foreground">
                      {cafe.name}
                    </span>
                    {cafe.opening_time && (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          badgeStyle
                        )}
                      >
                        {openingFormatted} 오픈
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    {displayAddress}
                  </p>
                </button>

                {/* Favorite toggle */}
                <FavoriteButton
                  cafeId={cafe.id}
                  initialFavorited={true}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
