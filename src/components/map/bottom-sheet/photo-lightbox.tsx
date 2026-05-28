'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import useEmblaCarousel from 'embla-carousel-react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';

interface PhotoLightboxProps {
  readonly photos: readonly string[];
  readonly thumbnails: readonly string[];
  readonly initialIndex: number;
  readonly cafeName: string;
  readonly onClose: () => void;
}

function LightboxImage({
  url,
  thumbnailUrl,
  alt,
  eager,
}: {
  readonly url: string;
  readonly thumbnailUrl: string | undefined;
  readonly alt: string;
  readonly eager: boolean;
}) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <ImageOff className="h-10 w-10 text-white/40" />
      </div>
    );
  }

  return (
    <>
      {/* LQIP: carousel thumbnail (C280x280) as blur placeholder */}
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt=""
          referrerPolicy="no-referrer"
          className={`absolute inset-0 h-full w-full object-contain blur-lg scale-105 transition-opacity duration-500 ${loaded ? 'opacity-0' : 'opacity-100'}`}
          aria-hidden="true"
        />
      )}
      {/* HD image — crossfades in over the blur placeholder */}
      <img
        src={url}
        alt={alt}
        referrerPolicy="no-referrer"
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : 'low'}
        decoding="async"
        className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </>
  );
}

/** Preload HD images for adjacent slides so swipe feels instant.
 *  ±1: high priority, ±2: low priority. */
function usePreloadAdjacentImages(photos: readonly string[], currentIndex: number) {
  useEffect(() => {
    const len = photos.length;
    if (len <= 1) return;

    const links: HTMLLinkElement[] = [];
    const images: HTMLImageElement[] = [];

    for (const offset of [-1, 1]) {
      const idx = ((currentIndex + offset) % len + len) % len;
      const url = photos[idx];
      if (!url || document.querySelector(`link[rel="preload"][href="${CSS.escape(url)}"]`)) continue;
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      (link as HTMLLinkElement & { fetchPriority: string }).fetchPriority = 'high';
      document.head.appendChild(link);
      links.push(link);
    }

    for (const offset of [-2, 2]) {
      const idx = ((currentIndex + offset) % len + len) % len;
      const url = photos[idx];
      if (!url) continue;
      const img = new globalThis.Image();
      img.src = url;
      images.push(img);
    }

    return () => {
      for (const link of links) link.remove();
      for (const img of images) img.src = '';
    };
  }, [photos, currentIndex]);
}

export function PhotoLightbox({ photos, thumbnails, initialIndex, cafeName, onClose }: PhotoLightboxProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    startIndex: initialIndex,
  });
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  // Preload ±2 adjacent HD images for instant swipe
  usePreloadAdjacentImages(photos, currentIndex);

  // Sync current slide index
  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      setCurrentIndex(emblaApi.selectedScrollSnap());
    };

    emblaApi.on('select', onSelect);
    onSelect();

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          scrollPrev();
          break;
        case 'ArrowRight':
          scrollNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, scrollPrev, scrollNext]);

  // Lock body scroll
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (typeof window === 'undefined') {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
        onClick={handleBackdropClick}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/20"
          aria-label="닫기"
        >
          <X className="h-5 w-5 text-white" />
        </button>

        {/* Carousel */}
        <div ref={emblaRef} className="h-full w-full overflow-hidden">
          <div className="flex h-full">
            {photos.map((url, i) => (
              <div key={url} className="relative h-full w-full flex-shrink-0">
                <LightboxImage
                  url={url}
                  thumbnailUrl={thumbnails[i]}
                  alt={`${cafeName} 사진 ${i + 1}`}
                  eager={Math.abs(i - currentIndex) <= 1}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Previous / Next arrows (desktop) */}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={scrollPrev}
              className="absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/10 p-2 backdrop-blur-sm transition-colors hover:bg-white/20 md:flex"
              aria-label="이전 사진"
            >
              <ChevronLeft className="h-6 w-6 text-white" />
            </button>
            <button
              type="button"
              onClick={scrollNext}
              className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/10 p-2 backdrop-blur-sm transition-colors hover:bg-white/20 md:flex"
              aria-label="다음 사진"
            >
              <ChevronRight className="h-6 w-6 text-white" />
            </button>
          </>
        )}

        {/* Counter */}
        {photos.length > 1 && (
          <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1.5 text-sm tabular-nums text-white/80 backdrop-blur-sm">
            {currentIndex + 1} / {photos.length}
          </div>
        )}
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
