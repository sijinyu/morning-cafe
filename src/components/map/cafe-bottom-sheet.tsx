'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import {
  X,
  MapPin,
  Phone,
  ExternalLink,
  Copy,
  Check,
  Heart,
  Share2,
  Navigation,
  Bell,
  BellOff,
  Star,
} from 'lucide-react';
import { useCafeStore, getOpenStatus, is24Hours, type Cafe } from '@/lib/store/cafe-store';
import { useFavorites } from '@/lib/hooks/use-favorites';
import { useNotifications } from '@/lib/hooks/use-notifications';
import { useRecentCafes } from '@/lib/hooks/use-recent-cafes';
import { usePlaceDetail } from '@/lib/hooks/use-place-detail';
import { useCafeMemos } from '@/lib/hooks/use-cafe-memos';
import { formatOpeningTime, getOpeningBadgeStyle } from '@/lib/cafe-utils';
import { cn } from '@/lib/utils';
import { PhotoCarousel } from './bottom-sheet/photo-carousel';
import { MenuSection } from './bottom-sheet/menu-section';
import { HoursSection } from './bottom-sheet/hours-section';
import { MemoSection } from './bottom-sheet/memo-section';

// ---- height states ----------------------------------------------------------

type SheetState = 'peek' | 'half';

const SHEET_HEIGHTS: Record<SheetState, string> = {
  peek: '140px',
  half: '55vh',
};

// ---- main component ---------------------------------------------------------

interface CafeBottomSheetProps {
  cafe: Cafe;
  onClose: () => void;
}

function CafeBottomSheet({ cafe, onClose }: CafeBottomSheetProps) {
  const [sheetState, setSheetState] = useState<SheetState>('half');
  const [copied, setCopied] = useState(false);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { hasReminder, scheduleReminder, removeReminder, requestPermission } = useNotifications();
  const { addRecent } = useRecentCafes();
  const { photos, menu, loading: photosLoading } = usePlaceDetail(cafe.kakao_place_id);
  const { getMemo, setMemo } = useCafeMemos();
  const favorited = isFavorite(cafe.id);
  const reminded = hasReminder(cafe.id);
  const canRemind = !is24Hours(cafe) && cafe.opening_time !== null;

  async function handleBellClick() {
    if (reminded) {
      removeReminder(cafe.id);
      return;
    }
    const permission = await requestPermission();
    if (permission !== 'granted') return;
    scheduleReminder(cafe.id, cafe.name, cafe.opening_time!);
  }

  useEffect(() => {
    setSheetState('half');
    addRecent(cafe.id);
  }, [cafe.id, addRecent]);

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const velocity = info.velocity.y;
    const offset = info.offset.y;

    if (velocity > 300 || offset > 120) {
      if (sheetState === 'peek') {
        onClose();
      } else {
        setSheetState('peek');
      }
    } else if (velocity < -300 || offset < -80) {
      if (sheetState === 'peek') {
        setSheetState('half');
      }
    }
  }

  function handleCopyAddress() {
    const addr = cafe.road_address ?? cafe.address;
    navigator.clipboard.writeText(addr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  const displayAddress = cafe.road_address ?? cafe.address;
  const is24h = is24Hours(cafe);
  const openingFormatted = is24h ? '24시간' : formatOpeningTime(cafe.opening_time);
  const badgeStyle = is24h ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : getOpeningBadgeStyle(cafe.opening_time);
  const openStatus = is24h ? 'open' as const : getOpenStatus(cafe);

  const instagramHref = cafe.instagram_url
    ? (cafe.instagram_url.startsWith('http') ? cafe.instagram_url : `https://instagram.com/${cafe.instagram_url}`)
    : `https://www.instagram.com/explore/tags/${encodeURIComponent(cafe.name)}/`;

  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.1}
      onDragEnd={handleDragEnd}
      initial={{ y: '100%' }}
      animate={{ y: 0, height: SHEET_HEIGHTS[sheetState] }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 32, stiffness: 320 }}
      className={cn(
        'fixed bottom-14 md:bottom-0 left-0 right-0 z-40',
        'rounded-t-3xl bg-background shadow-[0_-4px_24px_rgba(0,0,0,0.12)]',
        'flex flex-col overflow-hidden',
      )}
      style={{ touchAction: 'none' }}
    >
      {/* Drag handle */}
      <div className="flex-shrink-0 flex flex-col items-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
        <div className="h-1 w-10 rounded-full bg-border" />
      </div>

      {/* Peek content — always visible */}
      <div className="flex-shrink-0 flex items-start justify-between px-5 py-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold truncate">{cafe.name}</h2>
            {cafe.category && (
              <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground whitespace-nowrap">
                {cafe.category}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
            {openStatus !== 'unknown' && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  openStatus === 'open'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                )}
              >
                <span className={cn(
                  'inline-block h-1.5 w-1.5 rounded-full',
                  openStatus === 'open' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
                )} />
                {openStatus === 'open' ? '영업중' : '영업 전'}
              </span>
            )}
            {(cafe.opening_time || is24h) && (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                  badgeStyle
                )}
              >
                {is24h ? '24시간 영업' : `아침 ${openingFormatted} 오픈`}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {canRemind && (
            <motion.button
              onClick={handleBellClick}
              whileTap={{ scale: 0.85 }}
              animate={{ scale: reminded ? [1, 1.25, 1] : 1 }}
              transition={{ duration: 0.25 }}
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted transition-colors"
              aria-label={reminded ? '알림 제거' : '오픈 알림 설정'}
            >
              {reminded ? (
                <BellOff className="h-5 w-5 fill-amber-400 stroke-amber-500" />
              ) : (
                <Bell className="h-5 w-5 stroke-muted-foreground" />
              )}
            </motion.button>
          )}
          <motion.button
            onClick={() => toggleFavorite(cafe.id)}
            whileTap={{ scale: 0.85 }}
            animate={{ scale: favorited ? [1, 1.25, 1] : 1 }}
            transition={{ duration: 0.25 }}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label={favorited ? '즐겨찾기 제거' : '즐겨찾기 추가'}
          >
            <Heart
              className={cn(
                'h-5 w-5 transition-colors',
                favorited ? 'fill-red-500 stroke-red-500' : 'stroke-muted-foreground'
              )}
            />
          </motion.button>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label="닫기"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Scrollable detail content */}
      {sheetState !== 'peek' && (
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-5 pb-6 space-y-4">
            <div className="h-px bg-border" />

            <PhotoCarousel
              photos={photos}
              loading={photosLoading}
              cafeName={cafe.name}
              placeUrl={cafe.place_url}
            />

            <MenuSection menu={menu} />

            {/* Address */}
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="flex-1 min-w-0 text-sm text-foreground leading-relaxed">{displayAddress}</p>
              <button
                onClick={handleCopyAddress}
                className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
                aria-label="주소 복사"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            </div>

            {/* Phone */}
            {cafe.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <a
                  href={`tel:${cafe.phone}`}
                  className="text-sm text-foreground hover:text-primary transition-colors"
                >
                  {cafe.phone}
                </a>
              </div>
            )}

            {/* Instagram */}
            <div className="flex items-center gap-3">
              <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <a
                href={instagramHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'text-sm transition-colors truncate',
                  cafe.instagram_url
                    ? 'text-foreground hover:text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {cafe.instagram_url ? '인스타그램' : '인스타그램에서 검색'}
              </a>
            </div>

            <HoursSection hoursByDay={cafe.hours_by_day} />

            <MemoSection cafeId={cafe.id} getMemo={getMemo} setMemo={setMemo} />

            {/* 리뷰 링크 */}
            {cafe.place_url && (
              <a
                href={`${cafe.place_url}#comment`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Star className="h-4 w-4" />
                <span>카카오맵 리뷰 보기</span>
                <ExternalLink className="h-3 w-3 ml-auto" />
              </a>
            )}

            <div className="h-px bg-border" />

            {/* Action buttons */}
            <div className="flex gap-2">
              {cafe.place_url && (
                <a
                  href={cafe.place_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-2xl',
                    'bg-foreground text-background py-3.5',
                    'text-sm font-medium',
                    'hover:opacity-90 transition-opacity'
                  )}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  카카오맵에서 보기
                </a>
              )}
              <a
                href={`https://map.kakao.com/link/to/${encodeURIComponent(cafe.name)},${cafe.latitude},${cafe.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-2xl',
                  'border border-border py-3.5 px-4',
                  'text-sm font-medium text-foreground',
                  'hover:bg-muted transition-colors'
                )}
                aria-label="길찾기"
              >
                <Navigation className="h-4 w-4" />
                길찾기
              </a>
              <button
                onClick={() => {
                  const text = `${cafe.name} — 아침 ${openingFormatted} 오픈\n${displayAddress}${cafe.place_url ? `\n${cafe.place_url}` : ''}`;
                  if (navigator.share) {
                    navigator.share({ title: cafe.name, text }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(text).catch(() => {});
                  }
                }}
                className={cn(
                  'flex items-center justify-center rounded-2xl',
                  'border border-border py-3.5 px-4',
                  'text-sm font-medium text-foreground',
                  'hover:bg-muted transition-colors'
                )}
                aria-label="공유하기"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ---- wrapper that reads from store ------------------------------------------

export function CafeBottomSheetWrapper() {
  const selectedCafe = useCafeStore((state) => state.selectedCafe);
  const setSelectedCafe = useCafeStore((state) => state.setSelectedCafe);
  const [wasOpen, setWasOpen] = useState(false);

  useEffect(() => {
    if (selectedCafe) {
      setWasOpen(true);
    } else {
      setWasOpen(false);
    }
  }, [selectedCafe]);

  return (
    <AnimatePresence>
      {selectedCafe && (
        <CafeBottomSheet
          key={wasOpen ? 'sheet-stable' : selectedCafe.id}
          cafe={selectedCafe}
          onClose={() => setSelectedCafe(null)}
        />
      )}
    </AnimatePresence>
  );
}
