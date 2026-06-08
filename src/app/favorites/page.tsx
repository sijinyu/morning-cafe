'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, MapPin, Clock, ExternalLink, Share2, Check } from 'lucide-react';
import { useFavorites } from '@/lib/hooks/use-favorites';
import { useCafeStore, getOpenStatus, type Cafe } from '@/lib/store/cafe-store';
import { getCachedFirstPhoto } from '@/lib/hooks/use-place-detail';
import { formatOpeningTime, getOpeningBadgeStyle, is24HoursForDay } from '@/lib/cafe-utils';
import { cn } from '@/lib/utils';
import { isNativeApp } from '@/lib/capacitor';
import { trackEvent } from '@/lib/analytics';

export default function FavoritesPage() {
  const { favorites, toggleFavorite } = useFavorites();
  const cafes = useCafeStore((state) => state.cafes);
  const chainCafeIds = useCafeStore((state) => state.chainCafeIds);
  const fetchCafes = useCafeStore((state) => state.fetchCafes);
  const setSelectedCafe = useCafeStore((state) => state.setSelectedCafe);
  const [mounted, setMounted] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    if (cafes.length === 0) fetchCafes();
  }, [cafes.length, fetchCafes]);

  if (!mounted) return null;

  const favoriteCafes = cafes.filter((cafe) => favorites.has(cafe.id));

  function handleCardClick(cafe: Cafe) {
    setSelectedCafe(cafe);
    router.push('/');
  }

  async function handleShareAll() {
    if (favoriteCafes.length === 0) return;
    trackEvent('share_favorites', { count: favoriteCafes.length });

    const BASE_URL = 'https://morning-cafe-phi.vercel.app';
    const cafesToShare = favoriteCafes.slice(0, 5);

    // Build text list
    const textList = favoriteCafes.map((c) => {
      const time = c.opening_time ? formatOpeningTime(c.opening_time) : '';
      return `☕ ${c.name}${time ? ` (${time} 오픈)` : ''}`;
    }).join('\n');
    const shareText = `나의 모닝카페 찜 ${favoriteCafes.length}곳\n\n${textList}`;
    const shareUrl = `${BASE_URL}/favorites`;

    // 1. Kakao ListFeed
    if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown> & { Kakao?: { isInitialized: () => boolean; Share: { sendDefault: (opts: unknown) => void } } }).Kakao?.isInitialized()) {
      try {
        const Kakao = (window as any).Kakao;
        Kakao.Share.sendDefault({
          objectType: 'list',
          headerTitle: `나의 모닝카페 찜 ${cafesToShare.length}곳`,
          headerLink: { mobileWebUrl: shareUrl, webUrl: shareUrl },
          contents: cafesToShare.map((c) => ({
            title: c.name,
            description: c.opening_time
              ? `${formatOpeningTime(c.opening_time)} 오픈 · ${(c.road_address ?? c.address).replace(/서울\S*\s+/, '')}`
              : (c.road_address ?? c.address).replace(/서울\S*\s+/, ''),
            imageUrl: `${BASE_URL}/icons/icon-512x512.png`,
            link: {
              mobileWebUrl: `${BASE_URL}/cafe/${c.id}`,
              webUrl: `${BASE_URL}/cafe/${c.id}`,
            },
          })),
          buttons: [{ title: '모닝카페에서 보기', link: { mobileWebUrl: shareUrl, webUrl: shareUrl } }],
        });
        return;
      } catch { /* fallback */ }
    }

    // 2. Native share (Capacitor)
    if (isNativeApp()) {
      try {
        const { Share } = await import('@capacitor/share');
        await Share.share({ title: '나의 모닝카페 찜', text: shareText, url: shareUrl });
        return;
      } catch { /* fallback */ }
    }

    // 3. Web Share API
    if (navigator.share) {
      try {
        await navigator.share({ title: '나의 모닝카페 찜', text: shareText, url: shareUrl });
        return;
      } catch { /* fallback */ }
    }

    // 4. Clipboard fallback
    try {
      await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch { /* silent fail */ }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-2 border-b border-border px-5 py-4">
        <Bookmark className="h-5 w-5 text-red-500" />
        <h1 className="text-lg font-bold">찜</h1>
        <span className="text-sm text-muted-foreground">({favoriteCafes.length})</span>
        <div className="flex-1" />
        {favoriteCafes.length > 0 && (
          <button
            onClick={handleShareAll}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label="찜 공유"
          >
            {shareCopied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Share2 className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {favoriteCafes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Bookmark className="h-10 w-10 stroke-1" />
            <p className="text-sm">찜한 카페가 없습니다</p>
            <p className="text-xs">지도에서 북마크를 눌러 추가하세요</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {favoriteCafes.map((cafe) => (
              <CafeItem
                key={cafe.id}
                cafe={cafe}
                isChain={chainCafeIds.has(cafe.id)}
                onCardClick={() => handleCardClick(cafe)}
                onRemove={() => toggleFavorite(cafe.id, { name: cafe.name, openingTime: cafe.opening_time })}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CafeItem({ cafe, isChain, onCardClick, onRemove }: { cafe: Cafe; isChain: boolean; onCardClick: () => void; onRemove: () => void }) {
  const displayAddress = cafe.road_address ?? cafe.address;
  const cafe24h = is24HoursForDay(cafe, (['일', '월', '화', '수', '목', '금', '토'] as const)[new Date().getDay()]!);
  const openStatus = cafe24h ? 'open' as const : getOpenStatus(cafe);

  return (
    <li
      onClick={onCardClick}
      className="flex items-start gap-3 px-5 py-4 cursor-pointer hover:bg-muted/50 active:bg-muted transition-colors"
    >
      {(() => {
        const photo = cafe.thumbnail_url || getCachedFirstPhoto(cafe.kakao_place_id);
        return photo ? (
          <div className="flex-shrink-0 h-11 w-11 rounded-full overflow-hidden bg-muted">
            <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
          </div>
        ) : (
          <div className="flex-shrink-0 h-11 w-11 rounded-full bg-muted flex items-center justify-center">
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </div>
        );
      })()}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold truncate">{cafe.name}</span>
          {isChain && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400">
              프랜차이즈
            </span>
          )}
          {cafe24h && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              24시간
            </span>
          )}
          {openStatus !== 'unknown' && !cafe24h && (
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
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            카카오맵
          </a>
        )}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors"
        aria-label="찜 해제"
      >
        <Bookmark className="h-4 w-4 fill-red-500 stroke-red-500" />
      </button>
    </li>
  );
}
