'use client';

import { Map, Heart, MessageSquarePlus, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', icon: Map, label: '지도' },
  { href: '/favorites', icon: Heart, label: '즐겨찾기' },
  { href: '/report', icon: MessageSquarePlus, label: '제보' },
  { href: '/mypage', icon: User, label: '마이' },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 backdrop-blur-lg md:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-colors',
                isActive
                  ? 'text-foreground font-semibold'
                  : 'text-muted-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
