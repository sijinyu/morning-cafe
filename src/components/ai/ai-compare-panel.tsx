'use client';

import { useState, useRef, useCallback } from 'react';
import { GitCompareArrows, X, Trophy, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { type Cafe } from '@/lib/types/cafe';
import { formatOpeningTime } from '@/lib/cafe-utils';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import { CafeQuickAdd } from './shared/cafe-quick-add';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompareRow {
  cafe_id: string;
  cafe_name: string;
  values: string[];
}

interface AiCompareResponse {
  comparison: { categories: string[]; rows: CompareRow[] };
  verdict: string;
  winner_id: string;
}

type CompareState = 'idle' | 'loading' | 'results' | 'error';

interface AiComparePanelProps {
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CAFES = 3;
const MIN_CAFES = 2;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface CafeSlotProps {
  cafe: Cafe;
  isWinner: boolean;
  onRemove: (id: string) => void;
}

function CafeSlot({ cafe, isWinner, onRemove }: CafeSlotProps) {
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
              <th className="w-24 min-w-[6rem] px-4 py-2.5 text-left text-xs font-medium text-muted-foreground/60 bg-muted/30">
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
                      {isWinner && <Trophy className="h-3 w-3 text-amber-500" />}
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
                {comparison.rows.map((row) => (
                  <td
                    key={row.cafe_id}
                    className={cn(
                      'px-3 py-2.5 text-center text-[13px] leading-snug',
                      row.cafe_id === winner_id
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground',
                    )}
                  >
                    {row.values[rowIdx] ?? '-'}
                  </td>
                ))}
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
// Compare skeleton
// ---------------------------------------------------------------------------

function CompareSkeleton({ cafeCount }: { cafeCount: number }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground animate-pulse">AI가 카페를 비교하고 있어요...</p>
      <div className="overflow-x-auto -mx-4">
        <table className="min-w-full border-collapse">
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AiComparePanel({ onClose: _onClose }: AiComparePanelProps) {
  const [selectedCafes, setSelectedCafes] = useState<Cafe[]>([]);
  const [compareState, setCompareState] = useState<CompareState>('idle');
  const [compareResult, setCompareResult] = useState<AiCompareResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const selectedIds = new Set(selectedCafes.map((c) => c.id));
  const canCompare = selectedCafes.length >= MIN_CAFES;

  const handleAddCafe = useCallback((cafe: Cafe) => {
    setSelectedCafes((prev) => {
      if (prev.length >= MAX_CAFES || prev.some((c) => c.id === cafe.id)) return prev;
      return [...prev, cafe];
    });
  }, []);

  const handleRemoveCafe = useCallback((id: string) => {
    setSelectedCafes((prev) => prev.filter((c) => c.id !== id));
    setCompareState((prev) => (prev === 'results' ? 'idle' : prev));
    setCompareResult(null);
  }, []);

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
          cafes: selectedCafes.map((c) => ({
            id: c.id,
            name: c.name,
            address: c.road_address ?? c.address,
            opening_time: c.opening_time,
            closing_time: c.closing_time,
            hours_by_day: c.hours_by_day,
            category: c.category,
            phone: c.phone,
          })),
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
    }
  }, [canCompare, compareState, selectedCafes]);

  const handleReset = useCallback(() => {
    setCompareState('idle');
    setCompareResult(null);
  }, []);

  return (
    <div className="flex flex-col gap-5 px-4 pb-6 pt-4">
      {/* Selected cafes */}
      <div className="flex flex-col gap-3">
        <p className="text-[12px] font-medium text-muted-foreground">
          비교할 카페 ({selectedCafes.length}/{MAX_CAFES})
        </p>
        {selectedCafes.length > 0 && (
          <div className="flex gap-2">
            {selectedCafes.map((cafe) => (
              <CafeSlot
                key={cafe.id}
                cafe={cafe}
                isWinner={compareState === 'results' && compareResult?.winner_id === cafe.id}
                onRemove={handleRemoveCafe}
              />
            ))}
          </div>
        )}
        {selectedCafes.length < MIN_CAFES && (
          <p className="text-[12px] text-muted-foreground/60">
            카페를 2개 이상 추가하면 AI 비교를 시작할 수 있어요
          </p>
        )}
      </div>

      {/* Quick add from favorites/recent */}
      {selectedCafes.length < MAX_CAFES && (
        <CafeQuickAdd
          selectedIds={selectedIds}
          onAdd={handleAddCafe}
          maxItems={MAX_CAFES}
        />
      )}

      <div className="h-px bg-border/60" />

      {/* Compare action */}
      {compareState === 'idle' && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.1, type: 'tween' }}
          onClick={handleCompare}
          disabled={!canCompare}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-2xl py-4',
            'text-[15px] font-bold transition-all',
            canCompare
              ? 'bg-foreground text-background hover:opacity-90'
              : 'bg-muted text-muted-foreground cursor-not-allowed',
          )}
        >
          <GitCompareArrows className="h-4 w-4" />
          AI 비교 시작
        </motion.button>
      )}

      {compareState === 'loading' && <CompareSkeleton cafeCount={selectedCafes.length} />}

      {compareState === 'error' && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-[15px] font-medium text-foreground">비교에 실패했어요</p>
          <button
            onClick={handleReset}
            className="mt-1 rounded-full border border-border/60 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            다시 시도
          </button>
        </div>
      )}

      {compareState === 'results' && compareResult && (
        <div className="flex flex-col gap-5">
          <ComparisonTable result={compareResult} cafes={selectedCafes} />
          <button
            onClick={handleReset}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border/60 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            다시 비교하기
          </button>
        </div>
      )}
    </div>
  );
}
