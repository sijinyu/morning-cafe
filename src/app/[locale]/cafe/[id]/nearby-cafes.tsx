import Link from 'next/link';
import { MapPin, Clock, ChevronRight } from 'lucide-react';
import { formatOpeningTime, getOpeningBadgeStyle } from '@/lib/cafe-utils';
import { cn } from '@/lib/utils';
import type { Cafe } from '@/lib/types/cafe';

interface NearbyCafesProps {
  cafes: Cafe[];
  gu: string;
  /** 같은 구의 전체 카페 수 — "N곳 모두 보기" 링크에 사용 */
  totalInGu: number;
  labels: {
    title: string;
    /** 예: "강남구 아침 카페 43곳 모두 보기" */
    moreLink: string;
  };
}

/**
 * 카페 상세 하단의 "근처 아침 카페" 내부 링크 섹션.
 *
 * 네이버 검색 유입이 카페 상세에 랜딩한 뒤 카카오맵으로 바로 이탈하던 흐름에
 * 다음 목적지를 제공한다. 서버 컴포넌트 — 링크가 HTML에 포함되어야 SEO
 * 크롤링에도 기여한다.
 */
export function NearbyCafes({ cafes, gu, totalInGu, labels }: NearbyCafesProps) {
  if (cafes.length === 0) return null;

  return (
    <section className="border-t border-border pt-5">
      <h2 className="mb-3 px-5 text-sm font-semibold text-foreground">{labels.title}</h2>

      <ul className="divide-y divide-border/50">
        {cafes.map((cafe) => (
          <li key={cafe.id}>
            <Link
              href={`/cafe/${cafe.id}`}
              className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold">{cafe.name}</span>
                  {cafe.opening_time && (
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap',
                        getOpeningBadgeStyle(cafe.opening_time),
                      )}
                    >
                      <Clock className="mr-0.5 h-2.5 w-2.5" />
                      {formatOpeningTime(cafe.opening_time)}
                    </span>
                  )}
                </div>
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  {cafe.road_address ?? cafe.address}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>

      {totalInGu > cafes.length && (
        <div className="px-5 pt-3">
          <Link
            href={`/cafes/${encodeURIComponent(gu)}`}
            className="flex items-center justify-center gap-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-red-400 hover:text-red-600"
          >
            {labels.moreLink}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </section>
  );
}
