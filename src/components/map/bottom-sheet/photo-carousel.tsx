'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import { ImageIcon, ImageOff } from 'lucide-react';
import { PhotoLightbox } from './photo-lightbox';

interface PhotoCarouselProps {
  photos: string[];
  loading: boolean;
  cafeName: string;
  placeUrl: string | null;
}

function SlideImage({ url, alt, priority }: { url: string; alt: string; priority: boolean }) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/80">
        <ImageOff className="h-5 w-5 text-muted-foreground/40" />
      </div>
    );
  }

  return (
    <Image
      src={url}
      alt={alt}
      fill
      sizes="144px"
      unoptimized
      referrerPolicy="no-referrer"
      priority={priority}
      className="object-cover"
      onError={() => setError(true)}
    />
  );
}

function SkeletonCards() {
  return (
    <div className="flex gap-2 px-1">
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          className="h-40 w-36 flex-shrink-0 animate-pulse rounded-xl bg-muted"
        >
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-muted-foreground/10" />
            <div className="h-2 w-16 rounded-full bg-muted-foreground/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PhotoCarousel({ photos, loading, cafeName, placeUrl }: PhotoCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    dragFree: true,
    align: 'start',
    containScroll: 'trimSnaps',
  });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Reset scroll position when photos change (new cafe selected)
  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.scrollTo(0, true);
  }, [emblaApi, photos]);

  if (loading) {
    return <SkeletonCards />;
  }

  if (photos.length === 0) {
    return (
      <a
        href={placeUrl ? `${placeUrl}#photo` : '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-40 w-full flex-col items-center justify-center gap-1 rounded-xl bg-muted/50"
      >
        <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
        <span className="text-xs text-muted-foreground">카카오맵 사진 보기</span>
      </a>
    );
  }

  return (
    <div className="relative">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex gap-2">
          {photos.map((url, i) => (
            <div
              key={url}
              role="button"
              tabIndex={0}
              aria-label={`${cafeName} 사진 ${i + 1} 크게 보기`}
              onClick={() => setLightboxIndex(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setLightboxIndex(i);
                }
              }}
              className="relative h-40 w-36 flex-shrink-0 cursor-pointer overflow-hidden rounded-xl bg-muted"
            >
              <SlideImage
                url={url}
                alt={`${cafeName} 사진 ${i + 1}`}
                priority={i === 0}
              />
            </div>
          ))}
        </div>
      </div>
      {/* Photo count badge + 더보기 link */}
      {placeUrl && (
        <a
          href={`${placeUrl}#photo`}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-[10px] text-white backdrop-blur-sm"
        >
          <ImageIcon className="h-3 w-3" />
          {photos.length}장
        </a>
      )}

      {/* Fullscreen lightbox */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          initialIndex={lightboxIndex}
          cafeName={cafeName}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
