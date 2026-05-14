'use client';

import { Map, Heart, MessageSquarePlus, User, Coffee, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', icon: Map, label: '지도' },
  { href: '/favorites', icon: Heart, label: '즐겨찾기' },
  { href: '/report', icon: MessageSquarePlus, label: '제보하기' },
  { href: '/mypage', icon: User, label: '마이페이지' },
] as const;

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:bg-background">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Coffee className="h-6 w-6 text-amber-600" />
        <div>
          <h1 className="text-lg font-bold tracking-tight">모닝카페</h1>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Sun className="h-3 w-3" />
            서울 얼리버드 카페 찾기
          </p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
