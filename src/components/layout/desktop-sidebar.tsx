'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, Heart, Send, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: '지도', icon: Map },
  { href: '/favorites', label: '즐겨찾기', icon: Heart },
  { href: '/recent', label: '최근 본 카페', icon: Clock },
  { href: '/report', label: '제보하기', icon: Send },
] as const;

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-border md:bg-background">
      {/* Logo — 클릭 시 홈으로 */}
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5 hover:opacity-80 transition-opacity">
        <Image src="/icons/icon-96.png" alt="모닝커피" width={28} height={28} className="rounded-lg" />
        <span className="text-lg font-bold tracking-tight">모닝커피</span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
