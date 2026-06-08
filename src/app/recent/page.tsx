'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, MapPin, Trash2, CheckCircle2, Circle, X } from 'lucide-react';
import { useRecentCafes } from '@/lib/hooks/use-recent-cafes';
import { useCafeStore, getOpenStatus, type Cafe } from '@/lib/store/cafe-store';
import { getCachedFirstPhoto } from '@/lib/hooks/use-place-detail';
import { formatOpeningTime, getOpeningBadgeStyle, is24HoursForDay } from '@/lib/cafe-utils';
import { cn } from '@/lib/utils';

export default function RecentPage() {
  const { recentIds, clearRecent, removeMultiple } = useRecentCafes();
  const cafes = useCafeStore((state) => state.cafes);
  const chainCafeIds = useCafeStore((state) => state.chainCafeIds);
  const fetchCafes = useCafeStore((state) => state.fetchCafes);
  const setSelectedCafe = useCafeStore((state) => state.setSelectedCafe);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
    if (cafes.length === 0) fetchCafes();
  }, [cafes.length, fetchCafes]);

  // Preserve insertion order: recentIds is newest-first
  const cafeMap = new Map<string, Cafe>(cafes.map((c) => [c.id, c]));
  const recentCafes = recentIds
    .map((id) => cafeMap.get(id))
    .filter((c): c is Cafe => c !== undefined);

  const handleSelectCafe = useCallback((cafe: Cafe) => {
    if (editMode) return;
    setSelectedCafe(cafe);
    router.push('/');
  }, [editMode, setSelectedCafe, router]);

  const toggleSelect = useCallback((cafeId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cafeId)) {
        next.delete(cafeId);
      } else {
        next.add(cafeId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === recentCafes.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recentCafes.map((c) => c.id)));
    }
  }, [selectedIds.size, recentCafes]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedIds.size === 0) return;
    if (selectedIds.size === recentCafes.length) {
      clearRecent();
    } else {
      removeMultiple(selectedIds);
    }
    setSelectedIds(new Set());
    setEditMode(false);
  }, [selectedIds, recentCafes.length, clearRecent, removeMultiple]);

  const handleExitEdit = useCallback(() => {
    setEditMode(false);
    setSelectedIds(new Set());
  }, []);

  if (!mounted) return null;

  const allSelected = recentCafes.length > 0 && selectedIds.size === recentCafes.length;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex items-center gap-2 border-b border-border px-5 py-4">
        {editMode ? (
          <>
            <button
              onClick={handleExitEdit}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
              aria-label="편집 취소"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
            <span className="text-sm font-medium text-foreground">
              {selectedIds.size > 0 ? `${selectedIds.size}개 선택` : '항목 선택'}
            </span>
            <div className="flex-1" />
            <button
              onClick={handleSelectAll}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              {allSelected ? '선택 해제' : '전체 선택'}
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={selectedIds.size === 0}
              className={cn(
                'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                selectedIds.size > 0
                  ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                  : 'text-muted-foreground/40 cursor-not-allowed',
              )}
            >
              <Trash2 className="h-3.5 w-3.5" />
              삭제
            </button>
          </>
        ) : (
          <>
            <Clock className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-bold">최근 본 카페</h1>
            <span className="text-sm text-muted-foreground">({recentCafes.length})</span>
            <div className="flex-1" />
            {recentCafes.length > 0 && (
              <button
                onClick={() => setEditMode(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted transition-colors"
                aria-label="편집"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </>
        )}
      </header>

      {/* List */}
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
                  exit={{ opacity: 0, x: -40, height: 0 }}
                  transition={{ duration: 0.18, delay: index * 0.02, type: 'tween' }}
                >
                  <RecentCafeItem
                    cafe={cafe}
                    isChain={chainCafeIds.has(cafe.id)}
                    editMode={editMode}
                    isSelected={selectedIds.has(cafe.id)}
                    onSelect={() => handleSelectCafe(cafe)}
                    onToggle={() => toggleSelect(cafe.id)}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {/* Bottom action bar — edit mode */}
      <AnimatePresence>
        {editMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ duration: 0.2, type: 'tween' }}
            className="flex-shrink-0 border-t border-border bg-background px-5 py-3"
          >
            <button
              onClick={handleDeleteSelected}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 py-3.5 text-sm font-bold text-white transition-colors hover:bg-red-600"
            >
              <Trash2 className="h-4 w-4" />
              {selectedIds.size}개 삭제
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RecentCafeItem({
  cafe,
  isChain,
  editMode,
  isSelected,
  onSelect,
  onToggle,
}: {
  cafe: Cafe;
  isChain: boolean;
  editMode: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const displayAddress = cafe.road_address ?? cafe.address;
  const cafe24h = is24HoursForDay(cafe, (['일', '월', '화', '수', '목', '금', '토'] as const)[new Date().getDay()]!);
  const openStatus = cafe24h ? ('open' as const) : getOpenStatus(cafe);
  const openingFormatted = cafe24h ? '24시간' : formatOpeningTime(cafe.opening_time);
  const badgeStyle = cafe24h
    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    : getOpeningBadgeStyle(cafe.opening_time);

  return (
    <button
      onClick={editMode ? onToggle : onSelect}
      className={cn(
        'w-full flex items-center gap-3 px-5 py-4 text-left transition-colors',
        editMode
          ? isSelected
            ? 'bg-red-50/50 dark:bg-red-900/10'
            : 'hover:bg-muted/30'
          : 'hover:bg-muted/50',
      )}
    >
      {/* Checkbox — edit mode */}
      {editMode && (
        <div className="flex-shrink-0">
          {isSelected ? (
            <CheckCircle2 className="h-5 w-5 text-red-500" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground/40" />
          )}
        </div>
      )}

      {/* Thumbnail — DB 우선, place-detail 캐시 fallback */}
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

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold truncate">{cafe.name}</span>
          {isChain && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400">
              프랜차이즈
            </span>
          )}
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
