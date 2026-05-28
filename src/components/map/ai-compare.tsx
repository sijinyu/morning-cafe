'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, GitCompareArrows, Plus, Check, Trophy, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCafeStore } from '@/lib/store/cafe-store';
import { type Cafe } from '@/lib/types/cafe';
import { formatOpeningTime } from '@/lib/cafe-utils';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompareRow {
  cafe_id: string;
  cafe_name: string;
  values: string[];
}

interface CompareResult {
  categories: string[];
  rows: CompareRow[];
}

interface AiCompareResponse {
  comparison: CompareResult;
  verdict: string;
  winner_id: string;
}

type CompareState = 'idle' | 'loading' | 'results' | 'error';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CAFES = 3;
const MIN_CAFES = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCafePayload(cafe: Cafe): Record<string, unknown> {
  return {
    id: cafe.id,
    name: cafe.name,
    address: cafe.road_address ?? cafe.address,
    opening_time: cafe.opening_time,
    closing_time: cafe.closing_time,
    hours_by_day: cafe.hours_by_day,
    category: cafe.category,
    phone: cafe.phone,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface CafeSlotProps {
  cafe: Cafe | null;
  index: number;
  isWinner: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

function CafeSlot({ cafe, index, isWinner, onAdd, onRemove }: CafeSlotProps) {
  if (!cafe) {
    return (
      <motion.button
        whileTap={{ scale: 0.96 }}
        transition={{ duration: 0.1, type: 'tween' }}
        onClick={onAdd}
        className={cn(
          'flex flex-1 min-w-0 flex-col items-center justify-center gap-1.5',
          'rounded-2xl border-2 border-dashed border-border/50',
          'py-4 px-3',
          'text-muted-foreground/50 transition-colors hover:border-foreground/20 hover:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20',
        )}
        aria-label={`${index + 1}번째 카페 추가`}
      >
        <Plus className="h-5 w-5" />
        <span className="text-xs font-medium">카페 추가</span>
      </motion.button>
    );
  }

  return (
    <div
      className={cn(
        'relative flex flex-1 min-w-0 flex-col rounded-2xl border-2 py-3 px-3',
        isWinner
          ? 'border-amber-400/70 bg-amber-50/60 dark:bg-amber-900/10'
          : 'border-border/50 bg-muted/30',
      )}
    >
      {isWinner && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
          <span className="flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-white whitespace-nowrap shadow-sm">
            <Trophy className="h-2.5 w-2.5" />
            최고
          </span>
        </div>
      )}
      <button
        onClick={() => onRemove(cafe.id)}
        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-foreground/8 transition-colors hover:bg-foreground/15"
        aria-label={`${cafe.name} 제거`}
      >
        <X className="h-3 w-3 text-muted-foreground" />
      </button>
      <p className="pr-6 text-[13px] font-semibold text-foreground leading-snug line-clamp-2">
        {cafe.name}
      </p>
      {cafe.opening_time && (
        <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3 flex-shrink-0" />
          <span>{formatOpeningTime(cafe.opening_time)} 오픈</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search dropdown
// ---------------------------------------------------------------------------

interface CafeSearchDropdownProps {
  query: string;
  onChangeQuery: (q: string) => void;
  results: Cafe[];
  selectedIds: Set<string>;
  onSelect: (cafe: Cafe) => void;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

function CafeSearchDropdown({
  query,
  onChangeQuery,
  results,
  selectedIds,
  onSelect,
  onClose,
  inputRef,
}: CafeSearchDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div ref={containerRef} className="flex flex-col gap-2">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onChangeQuery(e.target.value)}
          placeholder="카페 이름으로 검색..."
          className={cn(
            'w-full rounded-xl border border-border/60 bg-background px-4 py-3',
            'text-[14px] text-foreground placeholder:text-muted-foreground/40',
            'outline-none focus:border-foreground/20 focus:ring-2 focus:ring-foreground/10',
            'transition-all',
          )}
          autoComplete="off"
          autoCorrect="off"
        />
        {query && (
          <button
            onClick={() => onChangeQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full bg-muted/80 transition-colors hover:bg-muted"
            aria-label="검색어 지우기"
          >
            <X className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>

      {query.trim().length >= 1 && (
        <div className="max-h-52 overflow-y-auto rounded-xl border border-border/60 bg-background shadow-md">
          {results.length === 0 ? (
            <p className="px-4 py-4 text-center text-sm text-muted-foreground">
              검색 결과가 없어요
            </p>
          ) : (
            results.slice(0, 8).map((cafe) => {
              const alreadySelected = selectedIds.has(cafe.id);
              return (
                <button
                  key={cafe.id}
                  onClick={() => {
                    if (!alreadySelected) onSelect(cafe);
                  }}
                  disabled={alreadySelected}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-3',
                    'border-b border-border/40 last:border-b-0',
                    'text-left transition-colors',
                    alreadySelected
                      ? 'cursor-default opacity-40'
                      : 'hover:bg-muted/50 active:bg-muted/70',
                    'focus-visible:outline-none focus-visible:bg-muted/50',
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[14px] font-medium text-foreground">
                      {cafe.name}
                    </p>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {cafe.road_address ?? cafe.address}
                    </p>
                  </div>
                  {alreadySelected && (
                    <Check className="h-4 w-4 flex-shrink-0 text-amber-500" />
                  )}
                  {cafe.opening_time && !alreadySelected && (
                    <span className="flex-shrink-0 text-[11px] text-muted-foreground/70 tabular-nums">
                      {formatOpeningTime(cafe.opening_time)}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comparison table
// ---------------------------------------------------------------------------

interface ComparisonTableProps {
  result: AiCompareResponse;
  cafes: Cafe[];
}

function ComparisonTable({ result, cafes }: ComparisonTableProps) {
  const { comparison, verdict, winner_id } = result;
  const [expanded, setExpanded] = useState(false);

  const PREVIEW_ROW_COUNT = 4;
  const hasMore = comparison.categories.length > PREVIEW_ROW_COUNT;
  const visibleCategories = expanded
    ? comparison.categories
    : comparison.categories.slice(0, PREVIEW_ROW_COUNT);

  // Order cafes to match row order (preserving the API's column ordering)
  const orderedCafes = comparison.rows
    .map((row) => cafes.find((c) => c.id === row.cafe_id))
    .filter((c): c is Cafe => c !== undefined);

  return (
    <div className="flex flex-col gap-4">
      {/* Table */}
      <div className="overflow-x-auto -mx-4">
        <table className="min-w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {/* Category label column */}
              <th className="w-24 min-w-[6rem] px-4 py-2.5 text-left text-xs font-medium text-muted-foreground/60 bg-muted/30 first:rounded-tl-xl">
                항목
              </th>
              {orderedCafes.map((cafe) => {
                const isWinner = cafe.id === winner_id;
                return (
                  <th
                    key={cafe.id}
                    className={cn(
                      'px-3 py-2.5 text-center text-[13px] font-semibold',
                      isWinner
                        ? 'bg-amber-50/80 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400'
                        : 'bg-muted/30 text-foreground',
                    )}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      {isWinner && (
                        <Trophy className="h-3 w-3 text-amber-500" />
                      )}
                      <span className="line-clamp-2 leading-snug">{cafe.name}</span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleCategories.map((category, rowIdx) => (
              <tr
                key={category}
                className={cn(
                  'border-t border-border/40',
                  rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20',
                )}
              >
                <td className="px-4 py-2.5 text-[12px] font-medium text-muted-foreground whitespace-nowrap">
                  {category}
                </td>
                {comparison.rows.map((row) => {
                  const value = row.values[rowIdx] ?? '-';
                  const isWinner = row.cafe_id === winner_id;
                  return (
                    <td
                      key={row.cafe_id}
                      className={cn(
                        'px-3 py-2.5 text-center text-[13px] leading-snug',
                        isWinner ? 'text-foreground font-medium' : 'text-muted-foreground',
                      )}
                    >
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Expand toggle */}
      {hasMore && (
        <button
          onClick={() => setExpanded((p) => !p)}
          className="flex items-center justify-center gap-1.5 self-center rounded-full border border-border/60 px-4 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              접기
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              더보기 ({comparison.categories.length - PREVIEW_ROW_COUNT}개)
            </>
          )}
        </button>
      )}

      {/* Verdict card */}
      <div className="rounded-2xl bg-muted/40 px-4 py-4">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60">
          AI 총평
        </p>
        <p className="text-[14px] leading-relaxed text-foreground">{verdict}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function CompareSkeleton({ cafeCount }: { cafeCount: number }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground animate-pulse">AI가 카페를 비교하고 있어요...</p>
      <div className="overflow-x-auto -mx-4">
        <table className="min-w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="w-24 px-4 py-2.5 bg-muted/30" />
              {Array.from({ length: cafeCount }).map((_, i) => (
                <th key={i} className="px-3 py-2.5 bg-muted/30">
                  <div className="h-4 w-16 animate-pulse rounded-full bg-muted mx-auto" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, rowIdx) => (
              <tr key={rowIdx} className="border-t border-border/40">
                <td className="px-4 py-2.5">
                  <div className="h-3 w-14 animate-pulse rounded-full bg-muted" />
                </td>
                {Array.from({ length: cafeCount }).map((_, colIdx) => (
                  <td key={colIdx} className="px-3 py-2.5">
                    <div className="h-3 w-12 animate-pulse rounded-full bg-muted mx-auto" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-2xl bg-muted/40 px-4 py-4">
        <div className="h-3 w-16 animate-pulse rounded-full bg-muted mb-2" />
        <div className="space-y-1.5">
          <div className="h-3 w-full animate-pulse rounded-full bg-muted" />
          <div className="h-3 w-4/5 animate-pulse rounded-full bg-muted" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AiCompare() {
  const cafes = useCafeStore((state) => state.cafes);

  const [open, setOpen] = useState(false);
  const [selectedCafes, setSelectedCafes] = useState<Cafe[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [compareState, setCompareState] = useState<CompareState>('idle');
  const [compareResult, setCompareResult] = useState<AiCompareResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter cafes by search query
  const searchResults = searchQuery.trim().length >= 1
    ? cafes.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase().trim()),
      )
    : [];

  const selectedIds = new Set(selectedCafes.map((c) => c.id));
  const canCompare = selectedCafes.length >= MIN_CAFES;

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (showSearch) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 60);
      return () => clearTimeout(timer);
    }
  }, [showSearch]);

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    setOpen(false);
    setTimeout(() => {
      setSelectedCafes([]);
      setSearchQuery('');
      setShowSearch(false);
      setCompareState('idle');
      setCompareResult(null);
    }, 300);
  }, []);

  const handleAddCafe = useCallback((cafe: Cafe) => {
    setSelectedCafes((prev) => {
      if (prev.length >= MAX_CAFES) return prev;
      if (prev.some((c) => c.id === cafe.id)) return prev;
      return [...prev, cafe];
    });
    setSearchQuery('');
    setShowSearch(false);
  }, []);

  const handleRemoveCafe = useCallback((id: string) => {
    setSelectedCafes((prev) => prev.filter((c) => c.id !== id));
    // If results are shown, reset to idle since selection changed
    setCompareState((prev) => (prev === 'results' ? 'idle' : prev));
    setCompareResult(null);
  }, []);

  const handleOpenSearch = useCallback(() => {
    if (selectedCafes.length >= MAX_CAFES) return;
    setShowSearch(true);
  }, [selectedCafes.length]);

  const handleCompare = useCallback(async () => {
    if (!canCompare || compareState === 'loading') return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setCompareState('loading');
    setCompareResult(null);

    trackEvent('ai_compare_submit', { cafe_count: selectedCafes.length });

    try {
      const res = await fetch('/api/ai-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cafeIds: selectedCafes.map((c) => c.id),
          cafes: selectedCafes.map(buildCafePayload),
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: AiCompareResponse = await res.json();
      setCompareResult(data);
      setCompareState('results');

      trackEvent('ai_compare_results', {
        cafe_count: selectedCafes.length,
        winner: data.winner_id,
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setCompareState('error');
      trackEvent('ai_compare_error', {});
    }
  }, [canCompare, compareState, selectedCafes]);

  // Build slot array: always 3 slots (filled or empty)
  const slots: (Cafe | null)[] = [
    selectedCafes[0] ?? null,
    selectedCafes[1] ?? null,
    selectedCafes[2] ?? null,
  ];

  return (
    <>
      {/* Floating trigger button — right side, above MyLocationButton */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        transition={{ duration: 0.12, type: 'tween' }}
        onClick={() => setOpen(true)}
        aria-label="카페 비교 열기"
        className={cn(
          'absolute right-4 z-10',
          'flex h-12 w-12 items-center justify-center',
          'rounded-full bg-background/95 backdrop-blur-xl shadow-sm border border-border/60',
          'transition-colors hover:bg-foreground/5',
          'md:bottom-[5.5rem]',
        )}
        style={{ bottom: 'calc(var(--bottom-nav-height) + 4.5rem)' }}
      >
        <GitCompareArrows className="h-5 w-5 text-foreground" />
      </motion.button>

      {/* Modal overlay + sheet */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="compare-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, type: 'tween' }}
              className="fixed inset-0 z-[59] bg-black/30 backdrop-blur-[2px]"
              onClick={handleClose}
            />

            {/* Modal panel — slides up from bottom, full screen */}
            <motion.div
              key="compare-modal"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.28, type: 'tween', ease: [0.32, 0.72, 0, 1] }}
              className="fixed inset-0 z-[60] flex flex-col bg-background"
              style={{
                paddingTop: 'var(--safe-area-top)',
                paddingBottom: 'var(--safe-area-bottom)',
              }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5 flex-shrink-0">
                <div className="flex flex-1 items-center gap-2">
                  <GitCompareArrows className="h-4 w-4 flex-shrink-0 text-foreground" />
                  <span className="text-[15px] font-semibold text-foreground">AI 카페 비교</span>
                </div>
                <button
                  onClick={handleClose}
                  aria-label="닫기"
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted/60 transition-colors hover:bg-muted"
                >
                  <X className="h-[18px] w-[18px] text-muted-foreground" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-6 pt-5">

                {/* Cafe slot selection */}
                <div className="flex flex-col gap-3">
                  <p className="text-[12px] font-medium text-muted-foreground">
                    카페 선택 ({selectedCafes.length}/{MAX_CAFES})
                  </p>

                  {/* Slot row */}
                  <div className="flex gap-2">
                    {slots.map((cafe, idx) => (
                      <CafeSlot
                        key={idx}
                        cafe={cafe}
                        index={idx}
                        isWinner={
                          compareState === 'results' &&
                          compareResult?.winner_id === cafe?.id
                        }
                        onAdd={handleOpenSearch}
                        onRemove={handleRemoveCafe}
                      />
                    ))}
                  </div>

                  {/* Search input */}
                  <AnimatePresence>
                    {showSearch && selectedCafes.length < MAX_CAFES && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18, type: 'tween' }}
                      >
                        <CafeSearchDropdown
                          query={searchQuery}
                          onChangeQuery={setSearchQuery}
                          results={searchResults}
                          selectedIds={selectedIds}
                          onSelect={handleAddCafe}
                          onClose={() => {
                            setShowSearch(false);
                            setSearchQuery('');
                          }}
                          inputRef={searchInputRef}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Hint text */}
                  {selectedCafes.length < MIN_CAFES && (
                    <p className="text-[12px] text-muted-foreground/60">
                      카페를 2개 이상 추가하면 AI 비교를 시작할 수 있어요
                    </p>
                  )}
                </div>

                {/* Divider */}
                <div className="h-px bg-border/60" />

                {/* Compare button / results area */}
                {compareState === 'idle' && (
                  <div className="flex flex-col gap-4">
                    {/* Example hint */}
                    <div className="rounded-2xl bg-muted/40 px-4 py-3.5">
                      <p className="text-[13px] font-medium text-foreground mb-1">이런 항목을 비교해요</p>
                      <ul className="space-y-1">
                        {COMPARE_HINT_ITEMS.map((hint) => (
                          <li key={hint} className="flex items-center gap-2 text-[12px] text-muted-foreground">
                            <span className="h-1 w-1 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                            {hint}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      transition={{ duration: 0.1, type: 'tween' }}
                      onClick={handleCompare}
                      disabled={!canCompare}
                      className={cn(
                        'flex w-full items-center justify-center gap-2 rounded-2xl py-4',
                        'text-[15px] font-bold transition-all',
                        canCompare
                          ? 'bg-foreground text-background hover:opacity-90 active:opacity-80'
                          : 'bg-muted text-muted-foreground cursor-not-allowed',
                      )}
                    >
                      <GitCompareArrows className="h-4 w-4" />
                      AI 비교 시작
                    </motion.button>
                  </div>
                )}

                {compareState === 'loading' && (
                  <CompareSkeleton cafeCount={selectedCafes.length} />
                )}

                {compareState === 'error' && (
                  <div className="flex flex-col items-center gap-3 py-8 text-center">
                    <p className="text-[15px] font-medium text-foreground">
                      비교에 실패했어요
                    </p>
                    <p className="text-sm text-muted-foreground">
                      네트워크 문제가 발생했어요. 다시 시도해보세요.
                    </p>
                    <button
                      onClick={() => {
                        setCompareState('idle');
                        setCompareResult(null);
                      }}
                      className="mt-1 rounded-full border border-border/60 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      다시 시도
                    </button>
                  </div>
                )}

                {compareState === 'results' && compareResult && (
                  <div className="flex flex-col gap-5">
                    <ComparisonTable result={compareResult} cafes={selectedCafes} />

                    {/* Re-compare button */}
                    <button
                      onClick={() => {
                        setCompareState('idle');
                        setCompareResult(null);
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                    >
                      다시 비교하기
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const COMPARE_HINT_ITEMS = [
  '영업 시간 및 오픈 시간',
  '카테고리 및 분위기',
  '위치 및 접근성',
  '편의시설 여부',
  '종합 추천 의견',
] as const;
