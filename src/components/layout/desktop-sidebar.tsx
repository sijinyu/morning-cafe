'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, Bookmark, Send, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: '지도', icon: Map },
  { href: '/favorites', label: '찜', icon: Bookmark },
  { href: '/recent', label: '최근 본 카페', icon: Clock },
  { href: '/report', label: '제보하기', icon: Send },
] as const;

export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-border/50 md:bg-background md:opacity-90">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5 hover:opacity-80 transition-opacity">
        <Image src="/icons/icon-96.png" alt="모닝카페" width={28} height={28} className="rounded-lg border border-black/20" />
        <span className="text-lg font-extrabold tracking-tight">모닝카페</span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-foreground/[0.06] text-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground',
              )}
            >
              <Icon className={cn('h-[18px] w-[18px]', active && 'stroke-[2.5px]')} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* 후원 — Buy Me a Coffee 계정 준비 후 활성화
      <div className="px-3 pb-4">
        <a
          href="https://buymeacoffee.com/sijinyu"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground transition-colors"
        >
          <span>&#9749;</span>
          응원하기
        </a>
      </div>
      */}
    </aside>
  );
}
