'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, Bookmark, Send, Clock, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: '지도', icon: Map },
  { href: '/favorites', label: '찜', icon: Bookmark },
  { href: '/stamp', label: '스탬프', icon: Award },
  { href: '/recent', label: '최근', icon: Clock },
  { href: '/report', label: '제보', icon: Send },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="메인 네비게이션" className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl md:hidden" style={{ paddingBottom: 'var(--safe-area-bottom)' }}>
      <div className="flex h-14 items-center justify-around">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-4 py-1 text-[10px] font-medium transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'stroke-[2.5px]')} />
              <span className={cn(active && 'font-semibold')}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
