'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface Review {
  id: string;
  content: string;
  tags: string[];
  created_at: string;
}

interface ReviewListProps {
  cafeId: string;
  className?: string;
}

function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '1일 전';
  if (diffDays < 7) return `${diffDays}일 전`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}주 전`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}개월 전`;
  return `${Math.floor(diffDays / 365)}년 전`;
}

export function ReviewList({ cafeId, className }: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchReviews() {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('reviews')
          .select('id, content, tags, created_at')
          .eq('cafe_id', cafeId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (!cancelled) {
          if (error || !data) {
            setReviews([]);
          } else {
            const parsed: Review[] = data.map((row) => ({
              id: row.id as string,
              content: row.content as string,
              tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
              created_at: row.created_at as string,
            }));
            setReviews(parsed);
          }
        }
      } catch {
        if (!cancelled) setReviews([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchReviews();
    return () => {
      cancelled = true;
    };
  }, [cafeId]);

  if (loading) {
    return (
      <div className={cn('space-y-3 px-5', className)}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-2xl bg-muted"
          />
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-2 py-10 text-center',
          className
        )}
      >
        <p className="text-base font-medium text-muted-foreground">
          아직 한줄평이 없어요
        </p>
        <p className="text-sm text-muted-foreground/60">
          첫 번째 한줄평을 남겨보세요!
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3 px-5', className)}>
      {reviews.map((review) => (
        <div
          key={review.id}
          className="rounded-2xl bg-muted/50 px-4 py-3 space-y-2"
        >
          <p className="text-sm leading-relaxed text-foreground">
            {review.content}
          </p>
          {review.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {review.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground border border-border"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground/60">
            {getRelativeTime(review.created_at)}
          </p>
        </div>
      ))}
    </div>
  );
}
