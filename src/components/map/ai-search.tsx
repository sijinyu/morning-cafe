'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Sparkles, Send, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCafeStore } from '@/lib/store/cafe-store';
import { type Cafe } from '@/lib/types/cafe';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AiSearchProps {
  userLocation: { lat: number; lng: number } | null;
  onSelectCafe: (cafe: Cafe) => void;
}

interface AiResult {
  id: string;
  reason: string;
  score: number;
}

interface AiResponse {
  results: AiResult[];
  summary: string;
}

type SearchState = 'idle' | 'loading' | 'results' | 'error';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEG_TO_RAD = Math.PI / 180;

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) *
      Math.cos(lat2 * DEG_TO_RAD) *
      Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

function pickCafesForApi(
  cafes: Cafe[],
  userLocation: { lat: number; lng: number } | null,
  limit = 50,
): Cafe[] {
  if (userLocation) {
    return cafes
      .map((c) => ({
        cafe: c,
        dist: haversineKm(userLocation.lat, userLocation.lng, c.latitude, c.longitude),
      }))
      .filter(({ dist }) => dist <= 5)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, limit)
      .map(({ cafe }) => cafe);
  }
  return cafes.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border/50 bg-muted/40 p-4">
      <div className="mb-2 h-4 w-2/5 animate-pulse rounded-full bg-muted" />
      <div className="h-3 w-3/4 animate-pulse rounded-full bg-muted" />
      <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded-full bg-muted" />
    </div>
  );
}

interface ResultCardProps {
  cafe: Cafe;
  result: AiResult;
  onSelect: (cafe: Cafe) => void;
}

function ResultCard({ cafe, result, onSelect }: ResultCardProps) {
  const score = Math.round(result.score * 100);

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onClick={() => onSelect(cafe)}
      className={cn(
        'w-full rounded-2xl border border-border/50 bg-background p-4',
        'text-left transition-colors hover:bg-muted/50 active:bg-muted/70',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-foreground">
            {cafe.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {cafe.road_address ?? cafe.address}
          </p>
        </div>
        {/* Score badge */}
        <span
          className={cn(
            'flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
            score >= 80
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
              : score >= 60
                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
                : 'bg-muted text-muted-foreground',
          )}
        >
          {score}점
        </span>
      </div>
      {/* AI reason */}
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {result.reason}
      </p>
      {/* Location hint */}
      <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground/70">
        <MapPin className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">
          {cafe.opening_time ? `${cafe.opening_time} 오픈` : '오픈 시간 미확인'}
        </span>
      </div>
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AiSearch({ userLocation, onSelectCafe }: AiSearchProps) {
  const filteredCafes = useCafeStore((state) => state.filteredCafes);
  const setSelectedCafe = useCafeStore((state) => state.setSelectedCafe);
  const cafesById = useCafeStore((state) => {
    const map = new Map<string, Cafe>();
    for (const c of state.cafes) map.set(c.id, c);
    return map;
  });

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>('idle');
  const [results, setResults] = useState<AiResult[]>([]);
  const [summary, setSummary] = useState('');

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Auto-focus input when modal opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(timer);
    }
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

  // Lock body scroll while modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    setOpen(false);
    // Reset state after exit animation completes
    setTimeout(() => {
      setQuery('');
      setState('idle');
      setResults([]);
      setSummary('');
    }, 300);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed || state === 'loading') return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState('loading');
    setResults([]);
    setSummary('');

    trackEvent('ai_search_submit', { query_length: trimmed.length });

    const cafesForApi = pickCafesForApi(filteredCafes, userLocation);

    try {
      const res = await fetch('/api/ai-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmed,
          userLat: userLocation?.lat,
          userLng: userLocation?.lng,
          cafes: cafesForApi,
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: AiResponse = await res.json();
      setResults(data.results ?? []);
      setSummary(data.summary ?? '');
      setState('results');

      trackEvent('ai_search_results', { result_count: data.results?.length ?? 0 });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setState('error');
      trackEvent('ai_search_error', {});
    }
  }, [query, state, filteredCafes, userLocation]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleSelectCafe = useCallback(
    (cafe: Cafe) => {
      setSelectedCafe(cafe);
      onSelectCafe(cafe);
      trackEvent('ai_search_select', { cafe_name: cafe.name });
      handleClose();
    },
    [setSelectedCafe, onSelectCafe, handleClose],
  );

  // Resolve result IDs to full Cafe objects
  const resolvedResults = results
    .map((r) => ({ result: r, cafe: cafesById.get(r.id) }))
    .filter((item): item is { result: AiResult; cafe: Cafe } => item.cafe !== undefined);

  return (
    <>
      {/* Trigger pill button */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.12, type: 'tween' }}
        onClick={() => setOpen(true)}
        aria-label="AI 검색 열기"
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3.5 py-2',
          'bg-foreground text-background shadow-md',
          'text-[13px] font-semibold',
          'transition-opacity hover:opacity-90 active:opacity-80',
          'border border-foreground/10',
        )}
      >
        <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
        AI 검색
      </motion.button>

      {/* Modal overlay + sheet */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="ai-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, type: 'tween' }}
              className="fixed inset-0 z-[59] bg-black/30 backdrop-blur-[2px]"
              onClick={handleClose}
            />

            {/* Modal panel — slides up from bottom */}
            <motion.div
              key="ai-modal"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.28, type: 'tween', ease: [0.32, 0.72, 0, 1] }}
              className={cn(
                'fixed inset-0 z-[60] flex flex-col bg-background',
                'safe-area-inset',
              )}
              style={{ paddingTop: 'var(--safe-area-top)', paddingBottom: 'var(--safe-area-bottom)' }}
            >
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5">
                <div className="flex flex-1 items-center gap-2">
                  <Sparkles className="h-4 w-4 flex-shrink-0 text-amber-500" />
                  <span className="text-[15px] font-semibold text-foreground">AI 카페 추천</span>
                </div>
                <button
                  onClick={handleClose}
                  aria-label="닫기"
                  className={cn(
                    'flex h-10 w-10 flex-shrink-0 items-center justify-center',
                    'rounded-full bg-muted/60 transition-colors hover:bg-muted',
                  )}
                >
                  <X className="h-[18px] w-[18px] text-muted-foreground" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 pt-4">
                {/* Input area */}
                <div
                  className={cn(
                    'relative rounded-2xl border bg-background transition-all',
                    state === 'loading'
                      ? 'border-amber-400/60'
                      : 'border-border/60 focus-within:border-foreground/20',
                    'shadow-sm focus-within:shadow-md',
                  )}
                >
                  <textarea
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="강남역 근처 콘센트 있는 조용한 카페"
                    rows={3}
                    disabled={state === 'loading'}
                    className={cn(
                      'w-full resize-none rounded-2xl bg-transparent px-4 pb-12 pt-4',
                      'text-[15px] leading-relaxed text-foreground',
                      'placeholder:text-muted-foreground/40',
                      'outline-none disabled:opacity-60',
                    )}
                  />
                  {/* Submit button — anchored bottom-right of textarea */}
                  <div className="absolute bottom-3 right-3">
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      transition={{ duration: 0.1, type: 'tween' }}
                      onClick={handleSubmit}
                      disabled={!query.trim() || state === 'loading'}
                      aria-label="검색"
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-full',
                        'bg-foreground text-background transition-opacity',
                        'disabled:opacity-30',
                      )}
                    >
                      <Send className="h-4 w-4" />
                    </motion.button>
                  </div>
                </div>

                {/* Hint chips */}
                {state === 'idle' && (
                  <div className="flex flex-wrap gap-2">
                    {EXAMPLE_QUERIES.map((ex) => (
                      <button
                        key={ex}
                        onClick={() => setQuery(ex)}
                        className={cn(
                          'rounded-full border border-border/60 px-3 py-1.5',
                          'bg-muted/40 text-xs text-muted-foreground',
                          'transition-colors hover:bg-muted hover:text-foreground',
                        )}
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                )}

                {/* Empty / intro state */}
                {state === 'idle' && (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
                    <Sparkles className="h-8 w-8 text-amber-400/70" />
                    <p className="text-[15px] font-medium text-foreground">
                      AI에게 원하는 카페를 자유롭게 설명해보세요
                    </p>
                    <p className="text-sm text-muted-foreground">
                      위치, 분위기, 시설 등 뭐든 물어보세요
                    </p>
                  </div>
                )}

                {/* Loading skeletons */}
                {state === 'loading' && (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                      카페를 찾고 있어요...
                    </p>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <SkeletonCard key={i} />
                    ))}
                  </div>
                )}

                {/* Error state */}
                {state === 'error' && (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
                    <p className="text-[15px] font-medium text-foreground">
                      잠시 후 다시 시도해주세요
                    </p>
                    <p className="text-sm text-muted-foreground">
                      네트워크 문제가 발생했어요
                    </p>
                    <button
                      onClick={handleSubmit}
                      className={cn(
                        'mt-2 rounded-full border border-border/60 px-4 py-2',
                        'text-sm font-medium text-foreground',
                        'transition-colors hover:bg-muted',
                      )}
                    >
                      다시 시도
                    </button>
                  </div>
                )}

                {/* Results */}
                {state === 'results' && (
                  <div className="flex flex-col gap-3">
                    {/* Summary */}
                    {summary && (
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {summary}
                      </p>
                    )}

                    {resolvedResults.length > 0 ? (
                      resolvedResults.map(({ result, cafe }, idx) => (
                        <motion.div
                          key={cafe.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: 0.22,
                            delay: idx * 0.06,
                            type: 'tween',
                            ease: 'easeOut',
                          }}
                        >
                          <ResultCard
                            cafe={cafe}
                            result={result}
                            onSelect={handleSelectCafe}
                          />
                        </motion.div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center gap-2 py-10 text-center">
                        <p className="text-[15px] font-medium text-foreground">
                          조건에 맞는 카페를 찾지 못했어요
                        </p>
                        <p className="text-sm text-muted-foreground">
                          다른 표현으로 다시 검색해보세요
                        </p>
                      </div>
                    )}
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

const EXAMPLE_QUERIES = [
  '노트북 작업하기 좋은 카페',
  '조용하고 넓은 카페',
  '아침 일찍 여는 카페',
  '혼자 가기 좋은 카페',
] as const;
