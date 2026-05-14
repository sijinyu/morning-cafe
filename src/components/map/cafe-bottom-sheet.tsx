'use client';

import { useState, useEffect } from 'react';
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
  Check,
  Heart,
} from 'lucide-react';
import { useCafeStore, type Cafe } from '@/lib/store/cafe-store';
import { useFavorites } from '@/lib/hooks/use-favorites';
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
  const favorited = isFavorite(cafe.id);

  useEffect(() => {
    setSheetState('half');
  }, [cafe.id]);

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
  const openingFormatted = formatOpeningTime(cafe.opening_time);
  const badgeStyle = getOpeningBadgeStyle(cafe.opening_time);

  const instagramHref = cafe.instagram_url
    ? (cafe.instagram_url.startsWith('http') ? cafe.instagram_url : `https://instagram.com/${cafe.instagram_url}`)
    : `https://www.instagram.com/explore/tags/${encodeURIComponent(cafe.name)}/`;

  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.1}
      onDragEnd={handleDragEnd}
      animate={{ height: SHEET_HEIGHTS[sheetState] }}
      transition={{ type: 'spring', damping: 32, stiffness: 320 }}
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40',
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

            {/* Hours by day */}
            <HoursSection hoursByDay={cafe.hours_by_day} />

            <div className="h-px bg-border" />

            {/* Action button */}
            {cafe.place_url && (
              <a
                href={cafe.place_url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex w-full items-center justify-center gap-1.5 rounded-2xl',
                  'bg-foreground text-background py-3.5',
                  'text-sm font-medium',
                  'hover:opacity-90 transition-opacity'
                )}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                카카오맵에서 보기
              </a>
            )}
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
