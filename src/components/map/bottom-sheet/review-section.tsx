'use client';

import { useState } from 'react';
import { Star, ThumbsUp, MessageCircle, ExternalLink, ChevronDown, ChevronUp, Newspaper } from 'lucide-react';
import type { ReviewItem, BlogReviewItem } from '@/app/api/place-detail/route';

interface ReviewSectionProps {
  reviews: ReviewItem[];
  blogReviews: BlogReviewItem[];
  placeUrl: string | null;
}

function KakaoReviewCard({ review }: { readonly review: ReviewItem }) {
  return (
    <div>
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
  );
}

function BlogReviewCard({ review }: { readonly review: BlogReviewItem }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Newspaper className="h-3 w-3 text-emerald-500 flex-shrink-0" />
        <span className="text-xs font-medium text-foreground truncate flex-1">{review.author || '블로그'}</span>
        {review.date && (
          <span className="text-[11px] text-muted-foreground flex-shrink-0">{review.date}</span>
        )}
      </div>
      {review.title && (
        <p className="mt-1 text-xs font-medium text-foreground/90 line-clamp-1">{review.title}</p>
      )}
      <p className="mt-0.5 text-sm text-foreground/70 leading-relaxed line-clamp-2">{review.contents}</p>
      {review.originUrl && (
        <a
          href={review.originUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline"
        >
          원문 보기
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      )}
    </div>
  );
}

export function ReviewSection({ reviews, blogReviews, placeUrl }: ReviewSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const totalCount = reviews.length + blogReviews.length;

  if (totalCount === 0) return null;

  // 접힌 상태: kakao 리뷰 최대 2개만
  const previewReviews = reviews.slice(0, 2);
  const hasMore = totalCount > 2;

  return (
    <div>
      <div className="flex items-center gap-2 py-2 text-sm font-medium text-muted-foreground">
        <MessageCircle className="h-4 w-4" />
        <span>리뷰 {totalCount}개</span>
      </div>
      <div className="rounded-2xl bg-muted/50 px-4 py-3 space-y-3">
        {/* 프리뷰 (항상 표시) */}
        {!expanded && previewReviews.map((review, i) => (
          <div key={`k-${i}`} className={i > 0 ? 'border-t border-border/50 pt-3' : ''}>
            <KakaoReviewCard review={review} />
          </div>
        ))}

        {/* 확장 시 전체 리뷰 */}
        {expanded && (
          <>
            {reviews.length > 0 && (
              <div className="space-y-3">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">카카오맵 리뷰</p>
                {reviews.map((review, i) => (
                  <div key={`k-${i}`} className={i > 0 ? 'border-t border-border/50 pt-3' : ''}>
                    <KakaoReviewCard review={review} />
                  </div>
                ))}
              </div>
            )}
            {blogReviews.length > 0 && (
              <div className={`space-y-3 ${reviews.length > 0 ? 'border-t border-border/50 pt-3' : ''}`}>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">블로그 리뷰</p>
                {blogReviews.map((review, i) => (
                  <div key={`b-${i}`} className={i > 0 ? 'border-t border-border/50 pt-3' : ''}>
                    <BlogReviewCard review={review} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* 더보기/접기 버튼 */}
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex w-full items-center justify-center gap-1 pt-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? (
              <>접기 <ChevronUp className="h-3 w-3" /></>
            ) : (
              <>리뷰 {totalCount}개 전체보기 <ChevronDown className="h-3 w-3" /></>
            )}
          </button>
        )}

        {/* 카카오맵 외부 링크 */}
        {placeUrl && (
          <a
            href={placeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors pt-1"
          >
            카카오맵에서 전체 리뷰 보기
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}
