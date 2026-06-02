'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AiTaglineProps {
  cafeId: string;
  cafeName: string;
  strengths: string[];
  facilities: string[];
  rating: { score: number; count: number } | null;
  reviews: { contents?: string }[];
}

// ---------------------------------------------------------------------------
// localStorage cache helpers (7 days TTL)
// ---------------------------------------------------------------------------

const CACHE_KEY_PREFIX = 'ai-tagline:';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getCachedTagline(cafeId: string): string | null {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${cafeId}`);
    if (!raw) return null;
    const { tagline, expiresAt } = JSON.parse(raw) as { tagline: string; expiresAt: number };
    if (Date.now() > expiresAt) {
      localStorage.removeItem(`${CACHE_KEY_PREFIX}${cafeId}`);
      return null;
    }
    return tagline;
  } catch {
    return null;
  }
}

function setCachedTagline(cafeId: string, tagline: string): void {
  try {
    localStorage.setItem(
      `${CACHE_KEY_PREFIX}${cafeId}`,
      JSON.stringify({ tagline, expiresAt: Date.now() + CACHE_TTL_MS }),
    );
  } catch {
    // localStorage full — ignore
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiTagline({ cafeId, cafeName, strengths, facilities, rating, reviews }: AiTaglineProps) {
  const [tagline, setTagline] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hasData = strengths.length > 0 || facilities.length > 0 || !!rating;

  // Check localStorage cache on mount / cafeId change
  useEffect(() => {
    const cached = getCachedTagline(cafeId);
    setTagline(cached);
    setLoading(false);
  }, [cafeId]);

  const fetchTagline = useCallback(async () => {
    if (!hasData) return;

    setLoading(true);

    const reviewSnippets = reviews
      .map((r) => r.contents)
      .filter((c): c is string => !!c && c.length > 10)
      .slice(0, 3);

    try {
      const res = await fetch('/api/ai-tagline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cafeId,
          name: cafeName,
          strengths,
          facilities,
          rating,
          reviewSnippets,
        }),
      });
      const data: { tagline?: string } = await res.json();
      if (data.tagline) {
        setTagline(data.tagline);
        setCachedTagline(cafeId, data.tagline);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [cafeId, cafeName, strengths, facilities, rating, reviews, hasData]);

  // Cached tagline — show immediately
  if (tagline) {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <Sparkles className="h-3 w-3 flex-shrink-0 text-amber-400" />
        <p className="text-[12px] text-muted-foreground leading-snug">{tagline}</p>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <Sparkles className="h-3 w-3 flex-shrink-0 text-amber-400" />
        <div className={cn('h-3.5 w-32 rounded-full bg-muted animate-pulse')} />
      </div>
    );
  }

  // No cache, no data — hide entirely
  if (!hasData) return null;

  // Manual trigger button
  return (
    <button
      type="button"
      onClick={fetchTagline}
      className="flex items-center gap-1 mt-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
    >
      <Sparkles className="h-3 w-3 flex-shrink-0 text-amber-400/60" />
      <span>AI 한줄평 보기</span>
    </button>
  );
}
