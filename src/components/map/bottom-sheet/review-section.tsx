'use client';

import { Star, ThumbsUp, MessageCircle } from 'lucide-react';
import type { ReviewItem } from '@/app/api/place-detail/route';

interface ReviewSectionProps {
  reviews: ReviewItem[];
  placeUrl: string | null;
}

export function ReviewSection({ reviews, placeUrl }: ReviewSectionProps) {
  if (reviews.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 py-2 text-sm font-medium text-muted-foreground">
        <MessageCircle className="h-4 w-4" />
        <span>리뷰</span>
      </div>
      <div className="rounded-2xl bg-muted/50 px-4 py-3 space-y-3">
        {reviews.map((review, i) => (
          <div key={i} className={i > 0 ? 'border-t border-border/50 pt-3' : ''}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground">{review.nickname}</span>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }, (_, j) => (
                  <Star
                    key={j}
                    className={`h-3 w-3 ${j < review.starRating ? 'fill-amber-400 stroke-amber-400' : 'stroke-muted-foreground/40 fill-none'}`}
                  />
                ))}
              </div>
              {review.date && (
                <span className="text-[11px] text-muted-foreground ml-auto">{review.date}</span>
              )}
            </div>
            <p className="mt-1 text-sm text-foreground/80 leading-relaxed line-clamp-3">{review.contents}</p>
            {review.likeCount > 0 && (
              <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                <ThumbsUp className="h-3 w-3" />
                <span>{review.likeCount}</span>
              </div>
            )}
          </div>
        ))}
        {placeUrl && (
          <a
            href={placeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors pt-1"
          >
            카카오맵에서 리뷰 더보기
          </a>
        )}
      </div>
    </div>
  );
}
