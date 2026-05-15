'use client';

import { useState, useCallback, useEffect } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ImageIcon, ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhotoCarouselProps {
  photos: string[];
  loading: boolean;
  cafeName: string;
  placeUrl: string | null;
}

function SlideImage({ url, alt }: { url: string; alt: string }) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/80">
        <ImageOff className="h-6 w-6 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-muted">
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-muted-foreground/10" />
            <div className="h-2 w-20 rounded-full bg-muted-foreground/10" />
          </div>
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className={cn(
          'h-full w-full object-cover transition-opacity duration-300',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
        draggable={false}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}

export function PhotoCarousel({ photos, loading, cafeName, placeUrl }: PhotoCarouselProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    dragFree: false,
    containScroll: 'trimSnaps',
  });

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    onSelect();
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  // Reset to first slide when photos change (new cafe selected)
  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.scrollTo(0, true);
    setSelectedIndex(0);
  }, [emblaApi, photos]);

  return (
    <div className="relative aspect-[16/9] w-full rounded-2xl overflow-hidden bg-muted/50">
      {loading ? (
        <div className="h-full w-full animate-pulse bg-muted">
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-muted-foreground/10" />
            <div className="h-2 w-20 rounded-full bg-muted-foreground/10" />
          </div>
        </div>
      ) : photos.length > 0 ? (
        <>
          <div ref={emblaRef} className="h-full overflow-hidden">
            <div className="flex h-full">
              {photos.map((url, i) => (
                <div key={url} className="min-w-0 flex-[0_0_100%] h-full">
                  <SlideImage url={url} alt={`${cafeName} 사진 ${i + 1}`} />
                </div>
              ))}
            </div>
          </div>
          {/* Dots indicator */}
          {photos.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {photos.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-200',
                    i === selectedIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50',
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
