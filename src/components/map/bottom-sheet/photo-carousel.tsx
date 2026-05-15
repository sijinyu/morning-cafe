'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhotoCarouselProps {
  photos: string[];
  loading: boolean;
  cafeName: string;
  placeUrl: string | null;
}

export function PhotoCarousel({ photos, loading, cafeName, placeUrl }: PhotoCarouselProps) {
  const [photoIdx, setPhotoIdx] = useState(0);

  return (
    <div className="relative h-40 rounded-2xl overflow-hidden bg-muted/50">
      {loading ? (
        <div className="flex h-full items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground" />
        </div>
      ) : photos.length > 0 ? (
        <>
          <motion.div
            className="flex h-full"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={(_, info) => {
              const threshold = 50;
              if (info.offset.x < -threshold) {
                setPhotoIdx((i) => Math.min(i + 1, photos.length - 1));
              } else if (info.offset.x > threshold) {
                setPhotoIdx((i) => Math.max(i - 1, 0));
              }
            }}
            animate={{ x: `-${photoIdx * (100 / photos.length)}%` }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={{ width: `${photos.length * 100}%`, touchAction: 'pan-y' }}
          >
            {photos.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt={`${cafeName} 사진 ${i + 1}`}
                className="h-full object-cover pointer-events-none"
                style={{ width: `${100 / photos.length}%` }}
                draggable={false}
              />
            ))}
          </motion.div>
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
