'use client';

import { useRef, useState } from 'react';
import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhotoCarouselProps {
  photos: string[];
  loading: boolean;
  cafeName: string;
  placeUrl: string | null;
}

/**
 * Touch-based swipeable photo carousel.
 * Uses native touch events instead of framer-motion drag for reliable
 * single-slide navigation (no double-skip, no momentum glitch).
 */
export function PhotoCarousel({ photos, loading, cafeName, placeUrl }: PhotoCarouselProps) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const touchRef = useRef<{ startX: number; startY: number; swiping: boolean } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0]!;
    touchRef.current = { startX: touch.clientX, startY: touch.clientY, swiping: false };
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!touchRef.current) return;
    const touch = e.touches[0]!;
    const dx = touch.clientX - touchRef.current.startX;
    const dy = touch.clientY - touchRef.current.startY;

    // If horizontal movement is dominant, mark as swiping to prevent vertical scroll
    if (!touchRef.current.swiping && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      touchRef.current.swiping = true;
    }

    // Live preview: shift the track during drag
    if (touchRef.current.swiping && trackRef.current) {
      const baseOffset = -photoIdx * 100;
      const containerWidth = trackRef.current.parentElement?.clientWidth ?? 1;
      const pctDelta = (dx / containerWidth) * 100;
      trackRef.current.style.transition = 'none';
      trackRef.current.style.transform = `translateX(${baseOffset + pctDelta}%)`;
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!touchRef.current) return;
    const touch = e.changedTouches[0]!;
    const dx = touch.clientX - touchRef.current.startX;
    const threshold = 40;

    // Snap to the correct slide with transition
    if (trackRef.current) {
      trackRef.current.style.transition = 'transform 0.3s ease-out';
    }

    if (touchRef.current.swiping) {
      if (dx < -threshold && photoIdx < photos.length - 1) {
        setPhotoIdx(photoIdx + 1);
      } else if (dx > threshold && photoIdx > 0) {
        setPhotoIdx(photoIdx - 1);
      } else {
        // Snap back
        if (trackRef.current) {
          trackRef.current.style.transform = `translateX(${-photoIdx * 100}%)`;
        }
      }
    }
    touchRef.current = null;
  }

  // Sync transform when photoIdx changes (from state update)
  const trackStyle: React.CSSProperties = {
    display: 'flex',
    width: `${photos.length * 100}%`,
    height: '100%',
    transform: `translateX(${-photoIdx * 100}%)`,
    transition: 'transform 0.3s ease-out',
  };

  return (
    <div className="relative h-40 rounded-2xl overflow-hidden bg-muted/50">
      {loading ? (
        <div className="flex h-full items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground" />
        </div>
      ) : photos.length > 0 ? (
        <>
          <div
            ref={trackRef}
            style={trackStyle}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {photos.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt={`${cafeName} 사진 ${i + 1}`}
                className="h-full object-cover pointer-events-none"
                style={{ width: `${100 / photos.length}%`, flexShrink: 0 }}
                draggable={false}
              />
            ))}
          </div>
          {/* Dots indicator */}
          {photos.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {photos.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-200',
                    i === photoIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/50',
                  )}
                />
              ))}
            </div>
          )}
          {placeUrl && (
            <a
              href={`${placeUrl}#photo`}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-[10px] text-white backdrop-blur-sm"
            >
              <ImageIcon className="h-3 w-3" />
              더보기
            </a>
          )}
        </>
      ) : (
        <a
          href={placeUrl ? `${placeUrl}#photo` : '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-full flex-col items-center justify-center gap-1"
        >
          <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
          <span className="text-xs text-muted-foreground">카카오맵 사진 보기</span>
        </a>
      )}
    </div>
  );
}
