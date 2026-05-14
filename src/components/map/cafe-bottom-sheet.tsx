'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import {
  X,
  MapPin,
  Phone,
  ExternalLink,
  Copy,
  ChevronDown,
  ChevronUp,
  Clock,
  Flag,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCafeStore, type Cafe } from '@/lib/store/cafe-store';
import { FavoriteButton } from '@/components/cafe/favorite-button';
import { useAuthStore } from '@/lib/store/auth-store';
import { ReviewSheet } from '@/components/cafe/review-sheet';
import { ReviewList } from '@/components/cafe/review-list';
import { cn } from '@/lib/utils';

// ---- helpers ----------------------------------------------------------------

function formatOpeningTime(openingTime: string | null): string {
  if (!openingTime) return '정보 없음';
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

function getLastCrawledLabel(lastCrawledAt: string | null): string {
  if (!lastCrawledAt) return '확인 정보 없음';
  const now = new Date();
  const crawled = new Date(lastCrawledAt);
  const diffDays = Math.floor((now.getTime() - crawled.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return '오늘 확인';
  if (diffDays === 1) return '1일 전 확인';
  return `${diffDays}일 전 확인`;
}

const DAY_ORDER = ['월', '화', '수', '목', '금', '토', '일'];

// ---- sub-components ---------------------------------------------------------

interface HoursSectionProps {
  hoursByDay: Record<string, string> | null;
}

function HoursSection({ hoursByDay }: HoursSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (!hoursByDay || Object.keys(hoursByDay).length === 0) return null;

  const entries = DAY_ORDER
    .filter((day) => day in hoursByDay)
    .map((day) => ({ day, hours: hoursByDay[day] ?? '' }));

  if (entries.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span>요일별 영업시간</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-1 rounded-2xl bg-muted/50 px-4 py-3 space-y-1.5">
              {entries.map(({ day, hours }) => (
                <div key={day} className="flex justify-between text-sm">
                  <span className="font-medium text-muted-foreground w-6">{day}</span>
                  <span className="text-foreground">{hours}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- height states ----------------------------------------------------------

type SheetState = 'peek' | 'half' | 'full';

const SHEET_HEIGHTS: Record<SheetState, string> = {
  peek: '140px',
  half: '55vh',
  full: '85vh',
};

// ---- main component ---------------------------------------------------------

interface CafeBottomSheetProps {
  cafe: Cafe;
  onClose: () => void;
}

function CafeBottomSheet({ cafe, onClose }: CafeBottomSheetProps) {
  const user = useAuthStore((state) => state.user);
  const [sheetState, setSheetState] = useState<SheetState>('half');
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const dragStartY = useRef(0);

  // Reset to half when cafe changes
  useEffect(() => {
    setSheetState('half');
  }, [cafe.id]);

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const velocity = info.velocity.y;
    const offset = info.offset.y;

    if (velocity > 300 || offset > 120) {
      // Swipe down hard → dismiss or go to peek
      if (sheetState === 'peek') {
        onClose();
      } else if (sheetState === 'half') {
        setSheetState('peek');
      } else {
        setSheetState('half');
      }
    } else if (velocity < -300 || offset < -80) {
      // Swipe up → expand
      if (sheetState === 'peek') {
        setSheetState('half');
      } else if (sheetState === 'half') {
        setSheetState('full');
      }
    }
  }

  function handleCopyAddress() {
    const addr = cafe.road_address ?? cafe.address;
    navigator.clipboard.writeText(addr).then(() => {
      toast.success('주소가 복사되었습니다');
    }).catch(() => {
      toast.error('주소 복사에 실패했습니다');
    });
  }

  function handleReport() {
    window.location.href = `/report?cafeId=${cafe.id}&cafeName=${encodeURIComponent(cafe.name)}`;
  }

  const displayAddress = cafe.road_address ?? cafe.address;
  const openingFormatted = formatOpeningTime(cafe.opening_time);
  const badgeStyle = getOpeningBadgeStyle(cafe.opening_time);
  const lastCrawled = getLastCrawledLabel(cafe.last_crawled_at);

  return (
    <>
      {/* Backdrop — only dim when half/full */}
      <AnimatePresence>
        {sheetState === 'full' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/20"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.1}
        onDragStart={(_event, info) => {
          dragStartY.current = info.point.y;
        }}
        onDragEnd={handleDragEnd}
        animate={{ height: SHEET_HEIGHTS[sheetState] }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-40',
          'rounded-t-3xl bg-background shadow-[0_-4px_24px_rgba(0,0,0,0.12)]',
          'flex flex-col overflow-hidden',
          // Account for bottom nav
          'mb-16 md:mb-0'
        )}
        style={{ touchAction: 'none' }}
      >
        {/* Drag handle */}
        <div
          className="flex-shrink-0 flex flex-col items-center pt-3 pb-1 cursor-grab active:cursor-grabbing"
        >
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
            {cafe.opening_time && (
              <div className="mt-1.5">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
                    badgeStyle
                  )}
                >
                  아침 {openingFormatted} 오픈
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <FavoriteButton
              cafeId={cafe.id}
              initialFavorited={false}
            />
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
              {/* Divider */}
              <div className="h-px bg-border" />

              {/* Address */}
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground leading-relaxed">{displayAddress}</p>
                </div>
                <button
                  onClick={handleCopyAddress}
                  className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
                  aria-label="주소 복사"
                >
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
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
                {cafe.instagram_url ? (
                  <a
                    href={
                      cafe.instagram_url.startsWith('http')
                        ? cafe.instagram_url
                        : `https://instagram.com/${cafe.instagram_url}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-foreground hover:text-primary transition-colors truncate"
                  >
                    {cafe.instagram_url}
                  </a>
                ) : (
                  <a
                    href={`https://www.instagram.com/explore/tags/${encodeURIComponent(cafe.name)}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    인스타그램에서 검색하기
                  </a>
                )}
              </div>

              {/* Hours by day */}
              <HoursSection hoursByDay={cafe.hours_by_day} />

              {/* Divider */}
              <div className="h-px bg-border" />

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2.5">
                {cafe.place_url && (
                  <a
                    href={cafe.place_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-2xl',
                      'border border-border bg-background py-3.5',
                      'text-sm font-medium text-foreground',
                      'hover:bg-muted transition-colors'
                    )}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    카카오맵에서 보기
                  </a>
                )}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    if (!user) {
                      toast.error('로그인이 필요합니다', {
                        action: {
                          label: '로그인',
                          onClick: () => {
                            window.location.href = '/login';
                          },
                        },
                      });
                      return;
                    }
                    setReviewSheetOpen(true);
                  }}
                  className={cn(
                    'flex items-center justify-center rounded-2xl',
                    'bg-foreground text-background py-3.5',
                    'text-sm font-medium',
                    'hover:opacity-90 transition-opacity',
                    !cafe.place_url && 'col-span-2'
                  )}
                >
                  한줄평 남기기
                </motion.button>
              </div>

              {/* Report button */}
              <button
                onClick={handleReport}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
              >
                <Flag className="h-3.5 w-3.5" />
                정보 수정 제보
              </button>

              {/* Reviews section (full state only) */}
              {sheetState === 'full' && (
                <div className="space-y-3">
                  <div className="h-px bg-border" />
                  <h3 className="text-base font-semibold">한줄평</h3>
                  <ReviewList cafeId={cafe.id} />
                </div>
              )}

              {/* Footer */}
              <p className="text-center text-xs text-muted-foreground/50 pt-1">
                마지막 확인: {lastCrawled}
              </p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Review sheet */}
      <ReviewSheet
        cafeId={cafe.id}
        cafeName={cafe.name}
        isOpen={reviewSheetOpen}
        onClose={() => setReviewSheetOpen(false)}
      />
    </>
  );
}

// ---- wrapper that reads from store ------------------------------------------

export function CafeBottomSheetWrapper() {
  const selectedCafe = useCafeStore((state) => state.selectedCafe);
  const setSelectedCafe = useCafeStore((state) => state.setSelectedCafe);

  return (
    <AnimatePresence>
      {selectedCafe && (
        <CafeBottomSheet
          key={selectedCafe.id}
          cafe={selectedCafe}
          onClose={() => setSelectedCafe(null)}
        />
      )}
    </AnimatePresence>
  );
}
