'use client';

import { useState, useEffect, useRef } from 'react';
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
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Check localStorage cache first
    const cached = getCachedTagline(cafeId);
    if (cached) {
      setTagline(cached);
      return;
    }

    // No data to generate a meaningful tagline from
    if (strengths.length === 0 && facilities.length === 0 && !rating) {
      setTagline(null);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setTagline(null);

    const reviewSnippets = reviews
      .map((r) => r.contents)
      .filter((c): c is string => !!c && c.length > 10)
      .slice(0, 3);

    fetch('/api/ai-tagline', {
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
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data: { tagline?: string }) => {
        if (data.tagline) {
          setTagline(data.tagline);
          setCachedTagline(cafeId, data.tagline);
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        if ((err as Error).name !== 'AbortError') {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [cafeId, cafeName, strengths, facilities, rating, reviews]);

  if (!loading && !tagline) return null;

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <Sparkles className="h-3 w-3 flex-shrink-0 text-amber-400" />
      {loading ? (
        <div className={cn('h-3.5 w-32 rounded-full bg-muted animate-pulse')} />
      ) : (
        <p className="text-[12px] text-muted-foreground leading-snug">{tagline}</p>
      )}
    </div>
  );
}
