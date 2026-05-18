import type { Metadata } from 'next';
import Link from 'next/link';
import { MapPin, Clock, ExternalLink, Map } from 'lucide-react';
import { fetchCafesByGu, fetchAllGus } from '@/lib/supabase/queries';
import { formatOpeningTime, getOpeningBadgeStyle } from '@/lib/cafe-utils';
import { cn } from '@/lib/utils';
import type { Cafe } from '@/lib/types/cafe';

export const revalidate = 86400; // 24h ISR

interface PageProps {
  params: Promise<{ gu: string }>;
}

export async function generateStaticParams() {
  const gus = await fetchAllGus();
  return gus.map((gu) => ({ gu }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { gu } = await params;
  const decodedGu = decodeURIComponent(gu);
  const cafes = await fetchCafesByGu(decodedGu);
  const count = cafes.length;

  const title = `${decodedGu} 아침 카페 ${count}곳 — 모닝커피`;
  const description = `${decodedGu}에서 아침 일찍 여는 카페 ${count}곳. 6시, 7시 오픈 카페를 확인하세요.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'ko_KR',
      siteName: '모닝커피',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `/cafes/${encodeURIComponent(decodedGu)}`,
    },
  };
}

/** Parse opening_time to minutes for grouping. */
function parseMinutes(openingTime: string | null): number | null {
  if (!openingTime) return null;
  const parts = openingTime.split(':');
  return parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
}

interface TimeGroup {
  label: string;
  cafes: Cafe[];
}

function groupByTime(cafes: Cafe[]): TimeGroup[] {
  const before6: Cafe[] = [];
  const sixToSeven: Cafe[] = [];
  const sevenToEight: Cafe[] = [];

  for (const cafe of cafes) {
    const minutes = parseMinutes(cafe.opening_time);
    if (minutes === null) continue;
    if (minutes < 360) {
      before6.push(cafe);
    } else if (minutes < 420) {
      sixToSeven.push(cafe);
    } else {
      sevenToEight.push(cafe);
    }
  }

  const groups: TimeGroup[] = [];
  if (before6.length > 0) groups.push({ label: '6시 이전 오픈', cafes: before6 });
  if (sixToSeven.length > 0) groups.push({ label: '6시~7시 오픈', cafes: sixToSeven });
  if (sevenToEight.length > 0) groups.push({ label: '7시~8시 오픈', cafes: sevenToEight });

  return groups;
}

export default async function GuPage({ params }: PageProps) {
  const { gu } = await params;
  const decodedGu = decodeURIComponent(gu);
  const cafes = await fetchCafesByGu(decodedGu);
  const allGus = await fetchAllGus();
  const otherGus = allGus.filter((g) => g !== decodedGu);
  const timeGroups = groupByTime(cafes);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border px-5 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{decodedGu} 아침 카페</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              아침 일찍 여는 카페 {cafes.length}곳
            </p>
          </div>
          <Link
            href={`/?gu=${encodeURIComponent(decodedGu)}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
          >
            <Map className="h-4 w-4" />
            지도에서 보기
          </Link>
        </div>
      </header>

      {/* Cafe list */}
      <div className="flex-1 overflow-y-auto">
        {cafes.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
            <MapPin className="h-10 w-10 stroke-1" />
            <p className="text-sm">{decodedGu}에 등록된 아침 카페가 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {timeGroups.map((group) => (
              <section key={group.label} className="py-4">
                <h2 className="mb-3 px-5 text-sm font-semibold text-muted-foreground">
                  {group.label} ({group.cafes.length})
                </h2>
                <ul className="divide-y divide-border/50">
                  {group.cafes.map((cafe) => (
                    <CafeCard key={cafe.id} cafe={cafe} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {/* Other districts */}
        {otherGus.length > 0 && (
          <section className="border-t border-border px-5 py-6">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              다른 구 둘러보기
            </h2>
            <div className="flex flex-wrap gap-2">
              {otherGus.map((g) => (
                <Link
                  key={g}
                  href={`/cafes/${encodeURIComponent(g)}`}
                  className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-amber-400 hover:text-amber-600"
                >
                  {g}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function CafeCard({ cafe }: { cafe: Cafe }) {
  const displayAddress = cafe.road_address ?? cafe.address;

  return (
    <li>
      <Link
        href={`/cafe/${cafe.id}`}
        className="flex items-start gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold truncate">{cafe.name}</span>
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
          <p className="flex items-center gap-1 text-xs text-muted-foreground truncate">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            {displayAddress}
          </p>
          {cafe.place_url && (
            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
              <ExternalLink className="h-3 w-3" />
              카카오맵
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}
