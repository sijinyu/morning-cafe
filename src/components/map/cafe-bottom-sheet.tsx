'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import {
  X,
  MapPin,
  Phone,
  ExternalLink,
  Copy,
  Check,
  Bookmark,
  GitCompareArrows,
  Share2,
  Navigation,
  // Bell,
  // BellOff,
  Star,
  Car,
  Sparkles,
  Award,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useCafeStore, getOpenStatus, getOpeningTimeForDay, getDayLabel, type Cafe } from '@/lib/store/cafe-store';
import { is24HoursForDay, isNewCafe } from '@/lib/cafe-utils';
import { useFavorites } from '@/lib/hooks/use-favorites';
// import { useNotifications } from '@/lib/hooks/use-notifications';
import { useRecentCafes } from '@/lib/hooks/use-recent-cafes';
import { usePlaceDetail } from '@/lib/hooks/use-place-detail';
import { useCafeMemos } from '@/lib/hooks/use-cafe-memos';
// import { useStamps } from '@/lib/hooks/use-stamps';
import { extractGu } from '@/lib/types/cafe';
import { formatOpeningTime, getOpeningBadgeStyle, haversineKm } from '@/lib/cafe-utils';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import { isNativeApp } from '@/lib/capacitor';
import { PhotoCarousel } from './bottom-sheet/photo-carousel';
import { MenuSection } from './bottom-sheet/menu-section';
import { ReviewSection } from './bottom-sheet/review-section';
import { HoursSection } from './bottom-sheet/hours-section';
import { MemoSection } from './bottom-sheet/memo-section';
import { QuietScoreBadge } from './bottom-sheet/quiet-score-badge';
import { AiTagline } from '@/components/ai/ai-tagline';

/** 직선 거리 → 도보 예상 시간 (분) */
const WALK_DISTANCE_FACTOR = 1.3;
const WALK_SPEED_KMH = 4.5;

function estimateWalkMinutes(straightKm: number): number {
  return Math.round((straightKm * WALK_DISTANCE_FACTOR) / WALK_SPEED_KMH * 60);
}

// ---- constants --------------------------------------------------------------

const DRAG_VELOCITY_THRESHOLD = 300;
const DRAG_OFFSET_DOWN_THRESHOLD = 120;
const DRAG_OFFSET_UP_THRESHOLD = 80;
const COPY_TOAST_DURATION_MS = 1500;
const MAX_WALK_DISTANCE_KM = 3;

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
  const { dayFilter, chainCafeIds, userLocation, compareSlots, addToCompare } = useCafeStore(
    useShallow((s) => ({ dayFilter: s.dayFilter, chainCafeIds: s.chainCafeIds, userLocation: s.userLocation, compareSlots: s.compareSlots, addToCompare: s.addToCompare })),
  );
  const isChain = chainCafeIds.has(cafe.id);
  const isInCompare = compareSlots.some((c) => c.id === cafe.id);
  const canAddToCompare = compareSlots.length < 3 && !isInCompare;
  const [sheetState, setSheetState] = useState<SheetState>('half');
  const [copied, setCopied] = useState(false);
  const [phoneCopied, setPhoneCopied] = useState(false);
  const { isFavorite, toggleFavorite } = useFavorites();
  // const { hasReminder, scheduleReminder, removeReminder, requestPermission } = useNotifications();
  const { addRecent } = useRecentCafes();
  const { photos, photosHd, menu, rating, parking, facilities, strengths, reviews, blogReviews, loading: photosLoading } = usePlaceDetail(cafe.kakao_place_id);
  const { getMemo, setMemo } = useCafeMemos();
  // const { addStamp, hasCheckedInToday } = useStamps();
  const favorited = isFavorite(cafe.id);
  // const checkedIn = hasCheckedInToday(cafe.id);
  // const reminded = hasReminder(cafe.id);
  // const canRemind = !is24Hours(cafe) && cafe.opening_time !== null;

  // async function handleBellClick() {
  //   if (reminded) {
  //     removeReminder(cafe.id);
  //     return;
  //   }
  //   const permission = await requestPermission();
  //   if (permission !== 'granted') return;
  //   scheduleReminder(cafe.id, cafe.name, cafe.opening_time!);
  // }

  const [cardLoading, setCardLoading] = useState(false);

  const handleStoryCard = useCallback(async () => {
    if (cardLoading) return;
    setCardLoading(true);
    trackEvent('story_card', { cafe_name: cafe.name, cafe_id: cafe.id });

    try {
      const res = await fetch(`/api/story-card?id=${cafe.id}`);
      if (!res.ok) throw new Error('Failed to generate card');
      const blob = await res.blob();
      const file = new File([blob], `morning-cafe-${cafe.name}.png`, { type: 'image/png' });

      // 1. Web Share API with file
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${cafe.name} — 모닝커피`,
        });
      } else {
        // 2. Download fallback
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `morning-cafe-${cafe.name}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // user cancelled share or fetch failed — ignore
    } finally {
      setCardLoading(false);
    }
  }, [cafe.id, cafe.name, cardLoading]);

  // const CHECKIN_RADIUS_KM = 0.1; // 100m
  // const handleCheckin = useCallback(() => {
  //   if (checkedIn || !userLocation) return;
  //   const km = haversineKm(userLocation.lat, userLocation.lng, cafe.latitude, cafe.longitude);
  //   if (km > CHECKIN_RADIUS_KM) return;
  //   const gu = extractGu(cafe.address) ?? '';
  //   addStamp(cafe.id, cafe.name, gu);
  // }, [checkedIn, userLocation, cafe, addStamp]);
  // const canCheckin = userLocation
  //   ? !checkedIn && haversineKm(userLocation.lat, userLocation.lng, cafe.latitude, cafe.longitude) <= CHECKIN_RADIUS_KM
  //   : false;

  useEffect(() => {
    setSheetState('half');
    addRecent(cafe.id);
  }, [cafe.id, addRecent]);

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const velocity = info.velocity.y;
    const offset = info.offset.y;

    if (velocity > DRAG_VELOCITY_THRESHOLD || offset > DRAG_OFFSET_DOWN_THRESHOLD) {
      if (sheetState === 'peek') {
        trackEvent('sheet_close', { cafe_name: cafe.name });
        onClose();
      } else {
        trackEvent('sheet_peek', { cafe_name: cafe.name });
        setSheetState('peek');
      }
    } else if (velocity < -DRAG_VELOCITY_THRESHOLD || offset < -DRAG_OFFSET_UP_THRESHOLD) {
      if (sheetState === 'peek') {
        trackEvent('sheet_expand', { cafe_name: cafe.name });
        setSheetState('half');
      }
    }
  }

  function handleCopyAddress() {
    const addr = cafe.road_address ?? cafe.address;
    navigator.clipboard.writeText(addr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_TOAST_DURATION_MS);
    }).catch(() => {});
  }

  function handleCopyPhone() {
    if (!cafe.phone) return;
    navigator.clipboard.writeText(cafe.phone).then(() => {
      setPhoneCopied(true);
      setTimeout(() => setPhoneCopied(false), COPY_TOAST_DURATION_MS);
    }).catch(() => {});
  }

  const displayAddress = cafe.road_address ?? cafe.address;
  const is24h = is24HoursForDay(cafe, (['일', '월', '화', '수', '목', '금', '토'] as const)[new Date().getDay()]!);
  const todayOpeningTime = getOpeningTimeForDay(cafe, dayFilter);
  const openingFormatted = is24h ? '24시간' : formatOpeningTime(todayOpeningTime);
  const badgeStyle = is24h ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : getOpeningBadgeStyle(todayOpeningTime);
  const openStatus = is24h ? 'open' as const : getOpenStatus(cafe);

  const instagramHref = cafe.instagram_url
    ? (cafe.instagram_url.startsWith('http') ? cafe.instagram_url : `https://instagram.com/${cafe.instagram_url}`)
    : `https://www.instagram.com/explore/tags/${encodeURIComponent(cafe.name)}/`;

  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.05}
      dragTransition={{ bounceStiffness: 600, bounceDamping: 60 }}
      onDragEnd={handleDragEnd}
      initial={{ y: '100%' }}
      animate={{ y: 0, height: SHEET_HEIGHTS[sheetState] }}
      exit={{ y: '100%' }}
      transition={{ type: 'tween', duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      className={cn(
        'fixed left-0 right-0 z-40 bottom-14 md:bottom-0',
        'rounded-t-3xl bg-background shadow-[0_-4px_24px_rgba(0,0,0,0.12)] dark:shadow-none dark:border-t dark:border-border',
        'flex flex-col overflow-hidden',
      )}
      style={{ touchAction: 'none', willChange: 'transform, height', contain: 'layout style' }}
    >
      {/* Drag handle */}
      <div className="flex-shrink-0 flex flex-col items-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
        <div className="h-[5px] w-9 rounded-full bg-foreground/15" />
      </div>

      {/* Peek content — always visible */}
      <div className="flex-shrink-0 flex items-start justify-between px-5 py-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-extrabold tracking-tight truncate">{cafe.name}</h2>
            {isNewCafe(cafe) && (
              <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white whitespace-nowrap">
                NEW
              </span>
            )}
            {isChain && (
              <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400 whitespace-nowrap">
                프랜차이즈
              </span>
            )}
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
                {is24h ? '24시간 영업' : `${getDayLabel(dayFilter)} ${openingFormatted} 오픈`}
              </span>
            )}
          </div>
          <AiTagline
            cafeId={cafe.id}
            cafeName={cafe.name}
            strengths={strengths}
            facilities={facilities}
            rating={rating}
            reviews={reviews}
          />
        </div>

        <div className="flex items-center -mr-2 flex-shrink-0">
          {/* 비교함 담기 버튼 */}
          <motion.button
            onClick={() => {
              if (canAddToCompare) {
                addToCompare(cafe);
                trackEvent('add_to_compare', { cafe_name: cafe.name });
              }
            }}
            whileTap={{ scale: 0.85 }}
            transition={{ duration: 0.25 }}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted transition-colors',
              isInCompare && 'opacity-40',
            )}
            aria-label={isInCompare ? '비교함에 추가됨' : '비교함 담기'}
            disabled={!canAddToCompare && !isInCompare}
          >
            <GitCompareArrows
              className={cn(
                'h-[18px] w-[18px] transition-colors',
                isInCompare ? 'text-blue-500' : 'stroke-muted-foreground'
              )}
            />
          </motion.button>
          {/* TODO: 알림 기능 추후 활성화
          {canRemind && (
            <motion.button
              onClick={handleBellClick}
              whileTap={{ scale: 0.85 }}
              animate={{ scale: reminded ? [1, 1.25, 1] : 1 }}
              transition={{ duration: 0.25 }}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted transition-colors"
              aria-label={reminded ? '알림 제거' : '오픈 알림 설정'}
            >
              {reminded ? (
                <BellOff className="h-[18px] w-[18px] fill-amber-400 stroke-amber-500" />
              ) : (
                <Bell className="h-[18px] w-[18px] stroke-muted-foreground" />
              )}
            </motion.button>
          )}
          */}
          <motion.button
            onClick={() => toggleFavorite(cafe.id)}
            whileTap={{ scale: 0.85 }}
            animate={{ scale: favorited ? [1, 1.25, 1] : 1 }}
            transition={{ duration: 0.25 }}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label={favorited ? '찜 해제' : '찜 추가'}
          >
            <Bookmark
              className={cn(
                'h-[18px] w-[18px] transition-colors',
                favorited ? 'fill-amber-500 stroke-amber-500' : 'stroke-muted-foreground'
              )}
            />
          </motion.button>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label="닫기"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Scrollable detail content */}
      {sheetState !== 'peek' && (
        <div className="flex-1 overflow-y-auto overscroll-contain" style={{ contain: 'content' }}>
          <div className="px-5 pb-6 space-y-3">
            <div className="h-px bg-border" />

            {/* Photo carousel — fixed min-height to prevent CLS */}
            <div className="min-h-[10rem]">
              <PhotoCarousel
                photos={photos}
                photosHd={photosHd}
                loading={photosLoading}
                cafeName={cafe.name}
                placeUrl={cafe.place_url}
              />
            </div>

            {/* All detail rows — compact spacing, items-start for multiline */}
            <div className="space-y-0">
              {/* Rating */}
              {rating && (
                <div className="flex items-center gap-2 py-1.5">
                  <Star className="h-4 w-4 fill-amber-400 stroke-amber-400 flex-shrink-0" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">{rating.score.toFixed(1)}</span>
                    {rating.count > 0 && (
                      <span className="text-xs text-muted-foreground">({rating.count.toLocaleString()}개 리뷰)</span>
                    )}
                  </div>
                </div>
              )}

              {/* Strengths */}
              {strengths.length > 0 && (
                <div className="py-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {strengths.map((s) => (
                      <span key={s} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quiet Morning Score */}
              <QuietScoreBadge strengths={strengths} facilities={facilities} reviews={reviews} />

              {/* Parking — items-start: 두 줄일 때 아이콘 상단 정렬 */}
              {parking && (
                <div className="flex items-start gap-2 py-1.5">
                  <Car className={cn('h-4 w-4 flex-shrink-0 mt-0.5', parking.available ? 'text-emerald-500' : 'text-muted-foreground')} />
                  <div className="flex-1 min-w-0">
                    <span className={cn('text-sm', parking.available ? 'text-foreground' : 'text-muted-foreground')}>
                      {parking.available ? '주차 가능' : '주차 불가'}
                    </span>
                    {parking.summary && (
                      <p className="text-xs text-muted-foreground leading-snug mt-0.5">{parking.summary}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Facilities */}
              {facilities.length > 0 && (
                <div className="py-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {facilities.map((f) => (
                      <span key={f} className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Address — items-start: 긴 주소 줄바꿈 시 아이콘 상단 정렬 */}
              <div className="flex items-start gap-2 py-2">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <p className="flex-1 min-w-0 text-sm text-foreground leading-snug">{displayAddress}</p>
                <button
                  onClick={handleCopyAddress}
                  className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted transition-colors"
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
                <div className="flex items-center gap-2 py-2">
                  <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <a
                    href={`tel:${cafe.phone}`}
                    className="flex-1 min-w-0 text-sm text-foreground hover:text-primary transition-colors"
                  >
                    {cafe.phone}
                  </a>
                  <button
                    onClick={handleCopyPhone}
                    className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted transition-colors"
                    aria-label="전화번호 복사"
                  >
                    {phoneCopied ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>
                </div>
              )}

              {/* Instagram */}
              <div className="flex items-center gap-2 py-1.5">
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
            </div>

            <MenuSection menu={menu} placeUrl={cafe.place_url} />

            <HoursSection hoursByDay={cafe.hours_by_day} />

            <MemoSection cafeId={cafe.id} getMemo={getMemo} setMemo={setMemo} />

            <ReviewSection reviews={reviews} blogReviews={blogReviews} placeUrl={cafe.place_url} />

            <div className="h-px bg-border" />

            {/* Action buttons */}
            <div className="flex gap-2">
              {cafe.place_url && (
                <a
                  href={cafe.place_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent('view_kakaomap', { cafe_name: cafe.name })}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-2xl',
                    'bg-foreground text-background py-3.5',
                    'text-sm font-semibold whitespace-nowrap',
                    'hover:opacity-90 transition-opacity'
                  )}
                >
                  <ExternalLink className="h-4 w-4 flex-shrink-0" />
                  카카오맵
                </a>
              )}
              <a
                href={`https://map.kakao.com/link/to/${encodeURIComponent(cafe.name)},${cafe.latitude},${cafe.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent('navigate', { cafe_name: cafe.name })}
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
                {(() => {
                  if (!userLocation) return null;
                  const km = haversineKm(userLocation.lat, userLocation.lng, cafe.latitude, cafe.longitude);
                  if (km > MAX_WALK_DISTANCE_KM) return null;
                  const min = estimateWalkMinutes(km);
                  return (
                    <span className="text-xs text-muted-foreground">
                      도보 {min}분
                    </span>
                  );
                })()}
              </a>
              {/* Checkin button — 비활성 (스탬프 시스템 보류) */}
              {/* <button
                onClick={handleCheckin}
                disabled={!canCheckin && !checkedIn}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-2xl',
                  'py-3.5 px-4 text-sm font-medium transition-colors',
                  checkedIn
                    ? 'bg-amber-500 text-white'
                    : canCheckin
                      ? 'border border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                      : 'border border-border text-muted-foreground opacity-50',
                )}
                aria-label={checkedIn ? '체크인 완료' : '체크인'}
              >
                <Award className="h-4 w-4" />
                {checkedIn ? (
                  <Check className="h-3.5 w-3.5" />
                ) : null}
              </button> */}
              {/* 감성 카드 버튼 — 보류 */}
              {/* <button
                onClick={handleStoryCard}
                disabled={cardLoading}
                className={cn(
                  'flex items-center justify-center rounded-2xl',
                  'border border-border py-3.5 px-4',
                  'text-sm font-medium text-foreground',
                  'hover:bg-muted transition-colors',
                  cardLoading && 'opacity-50',
                )}
                aria-label="감성 카드"
              >
                <Sparkles className={cn('h-4 w-4', cardLoading && 'animate-pulse')} />
              </button> */}
              <button
                onClick={() => {
                  trackEvent('share_cafe', { cafe_name: cafe.name, cafe_id: cafe.id });
                  const shareUrl = `https://morning-cafe-phi.vercel.app/cafe/${cafe.id}`;
                  const shareText = `${cafe.name} — 아침 ${openingFormatted} 오픈\n${displayAddress}`;

                  // 0. Native share (Capacitor)
                  if (isNativeApp()) {
                    import('@capacitor/share').then(({ Share }) => {
                      Share.share({
                        title: cafe.name,
                        text: shareText,
                        url: shareUrl,
                      });
                    }).catch(() => {});
                    return;
                  }

                  // 1. Kakao Share
                  if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).Kakao) {
                    const Kakao = (window as unknown as { Kakao: { isInitialized: () => boolean; Share: { sendDefault: (o: Record<string, unknown>) => void } } }).Kakao;
                    if (Kakao.isInitialized()) {
                      try {
                        Kakao.Share.sendDefault({
                          objectType: 'feed',
                          content: {
                            title: cafe.name,
                            description: shareText,
                            imageUrl: 'https://morning-cafe-phi.vercel.app/icons/icon-512x512.png',
                            link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
                          },
                          buttons: [{ title: '모닝커피에서 보기', link: { mobileWebUrl: shareUrl, webUrl: shareUrl } }],
                        });
                        return;
                      } catch { /* fallback */ }
                    }
                  }

                  // 2. Web Share API
                  if (navigator.share) {
                    navigator.share({ title: cafe.name, text: shareText, url: shareUrl }).catch(() => {});
                  } else {
                    // 3. Clipboard fallback
                    navigator.clipboard.writeText(`${shareText}\n${shareUrl}`).catch(() => {});
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
