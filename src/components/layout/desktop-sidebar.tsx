'use client';

import Image from 'next/image';
import { Map, Bookmark, Send, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { LocaleToggle } from '@/components/locale-toggle';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/' as const, labelKey: 'map' as const, icon: Map },
  { href: '/favorites' as const, labelKey: 'favorites' as const, icon: Bookmark },
  { href: '/recent' as const, labelKey: 'recentFull' as const, icon: Clock },
  { href: '/report' as const, labelKey: 'reportFull' as const, icon: Send },
];

export function DesktopSidebar() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const tBrand = useTranslations('brand');

  return (
    <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-border/50 md:bg-background md:opacity-90">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 px-5 py-5 hover:opacity-80 transition-opacity">
        <Image src="/icons/icon-96.png" alt={tBrand('name')} width={28} height={28} className="rounded-lg border border-black/20" />
        <span className="text-lg font-extrabold tracking-tight">{tBrand('name')}</span>
      </Link>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
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
              {t(labelKey)}
            </Link>
          );
        })}
      </nav>

      {/* Locale toggle */}
      <div className="px-3 pb-4">
        <LocaleToggle />
      </div>
    </aside>
  );
}
