'use client';

import { useState, useCallback, useMemo } from 'react';
import { Sparkles, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { useShallow } from 'zustand/react/shallow';
import { useCafeStore } from '@/lib/store/cafe-store';
import { type Cafe } from '@/lib/types/cafe';
import { haversineKm } from '@/lib/cafe-utils';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import { ChipSelector } from './shared/chip-selector';
import { AiResultCard } from './shared/ai-result-card';
import type {
  TasteFinderPurpose,
  TasteFinderMood,
  TasteFinderFacility,
  AiRecommendResponse,
  AiResult,
} from '@/lib/ai/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PURPOSES: readonly TasteFinderPurpose[] = ['작업/공부', '독서', '수다/미팅', '데이트', '혼카'];
const MOODS: readonly TasteFinderMood[] = ['조용한', '활기찬', '아늑한', '모던한'];
const FACILITIES: readonly TasteFinderFacility[] = ['콘센트', '와이파이', '주차', '넓은 좌석'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SearchState = 'idle' | 'loading' | 'results' | 'error' | 'rate-limited';

interface AiTasteFinderProps {
  onClose: () => void;
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

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AiTasteFinder({ onClose }: AiTasteFinderProps) {
  const { filteredCafes, cafes, userLocation } = useCafeStore(
    useShallow((s) => ({
      filteredCafes: s.filteredCafes,
      cafes: s.cafes,
      userLocation: s.userLocation,
    })),
  );
  const setSelectedCafe = useCafeStore((s) => s.setSelectedCafe);

  const [purpose, setPurpose] = useState<TasteFinderPurpose | null>(null);
  const [mood, setMood] = useState<TasteFinderMood | null>(null);
  const [facilities, setFacilities] = useState<TasteFinderFacility[]>([]);
  const [state, setState] = useState<SearchState>('idle');
  const [results, setResults] = useState<AiRecommendResponse | null>(null);

  // Build cafes-by-id map for resolving results
  const cafesById = useMemo(() => {
    const map = new Map<string, Cafe>();
    for (const c of cafes) map.set(c.id, c);
    return map;
  }, [cafes]);

  const toggleFacility = useCallback((f: TasteFinderFacility) => {
    setFacilities((prev) =>
      prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f],
    );
  }, []);

  const canSubmit = purpose !== null && mood !== null;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || state === 'loading') return;

    setState('loading');
    setResults(null);

    trackEvent('ai_taste_finder_submit', {
      purpose: purpose!,
      mood: mood!,
      facilities: facilities.join(','),
    });

    // Pick nearest 50 cafes within 5km, or first 50 if no GPS
    let cafesForApi: Cafe[];
    if (userLocation) {
      cafesForApi = filteredCafes
        .map((c) => ({
          cafe: c,
          dist: haversineKm(userLocation.lat, userLocation.lng, c.latitude, c.longitude),
        }))
        .filter(({ dist }) => dist <= 5)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 50)
        .map(({ cafe }) => cafe);
    } else {
      cafesForApi = filteredCafes.slice(0, 50);
    }

    try {
      const res = await fetch('/api/ai-recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'taste-finder',
          purpose,
          mood,
          facilities,
          userLat: userLocation?.lat,
          userLng: userLocation?.lng,
          cafes: cafesForApi.map((c) => ({
            id: c.id,
            name: c.name,
            address: c.road_address ?? c.address,
            opening_time: c.opening_time,
            hours_by_day: c.hours_by_day,
            category: c.category,
          })),
        }),
      });

      if (res.status === 429) {
        setState('rate-limited');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: AiRecommendResponse = await res.json();
      setResults(data);
      setState('results');
      trackEvent('ai_taste_finder_results', { count: data.results?.length ?? 0 });
    } catch {
      setState('error');
      trackEvent('ai_taste_finder_error', {});
    }
  }, [canSubmit, state, purpose, mood, facilities, filteredCafes, userLocation]);

  const handleSelectCafe = useCallback(
    (cafe: Cafe) => {
      setSelectedCafe(cafe);
      trackEvent('ai_taste_finder_select', { cafe_name: cafe.name });
      onClose();
    },
    [setSelectedCafe, onClose],
  );

  const resolvedResults: { result: AiResult; cafe: Cafe }[] =
    results?.results
      ?.map((r) => ({ result: r, cafe: cafesById.get(r.id) }))
      .filter((item): item is { result: AiResult; cafe: Cafe } => item.cafe !== undefined) ?? [];

  return (
    <div className="flex flex-col gap-5 px-4 pb-6 pt-4">
      {/* Chip selectors */}
      <ChipSelector
        label="목적"
        options={PURPOSES}
        selected={purpose}
        onChange={setPurpose}
      />

      <ChipSelector
        label="분위기"
        options={MOODS}
        selected={mood}
        onChange={setMood}
      />

      <ChipSelector
        label="필수시설 (다중 선택)"
        options={FACILITIES}
        selected={facilities}
        onChange={toggleFacility}
        multiple
      />

      {/* GPS status hint */}
      {!userLocation && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50/60 dark:bg-amber-900/10 px-3 py-2">
          <MapPin className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-[12px] text-amber-700 dark:text-amber-400">
            위치 권한을 허용하면 가까운 카페를 우선 추천해요
          </p>
        </div>
      )}

      {/* Submit button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.1, type: 'tween' }}
        onClick={handleSubmit}
        disabled={!canSubmit || state === 'loading'}
        className={cn(
          'flex w-full items-center justify-center gap-2 rounded-2xl py-4',
          'text-[15px] font-bold transition-all',
          canSubmit && state !== 'loading'
            ? 'bg-foreground text-background hover:opacity-90'
            : 'bg-muted text-muted-foreground cursor-not-allowed',
        )}
      >
        <Sparkles className="h-4 w-4" />
        {state === 'loading' ? '찾는 중...' : '추천 받기'}
      </motion.button>

      {/* Loading skeletons */}
      {state === 'loading' && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Rate limited */}
      {state === 'rate-limited' && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-[15px] font-medium text-amber-600 dark:text-amber-400">AI 요청이 많아요</p>
          <p className="text-sm text-muted-foreground">1분 후 다시 시도해주세요</p>
          <button
            onClick={() => setState('idle')}
            className="mt-1 rounded-full border border-border/60 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            돌아가기
          </button>
        </div>
      )}

      {/* Error state */}
      {state === 'error' && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <p className="text-[15px] font-medium text-foreground">잠시 후 다시 시도해주세요</p>
          <button
            onClick={handleSubmit}
            className="mt-1 rounded-full border border-border/60 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* Results */}
      {state === 'results' && (
        <div className="flex flex-col gap-3">
          {results?.summary && (
            <p className="text-sm leading-relaxed text-muted-foreground">{results.summary}</p>
          )}
          {resolvedResults.length > 0 ? (
            resolvedResults.map(({ result, cafe }, idx) => (
              <AiResultCard
                key={cafe.id}
                cafe={cafe}
                reason={result.reason}
                score={result.score}
                index={idx}
                onSelect={handleSelectCafe}
              />
            ))
          ) : (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <p className="text-[15px] font-medium text-foreground">
                조건에 맞는 카페를 찾지 못했어요
              </p>
              <p className="text-sm text-muted-foreground">다른 조건으로 다시 검색해보세요</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
