'use client';

import { Map, Bookmark, Send, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/' as const, labelKey: 'map' as const, icon: Map },
  { href: '/favorites' as const, labelKey: 'favorites' as const, icon: Bookmark },
  { href: '/recent' as const, labelKey: 'recent' as const, icon: Clock },
  { href: '/report' as const, labelKey: 'report' as const, icon: Send },
];

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations('nav');

  return (
    <nav aria-label={t('mainNav')} className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl md:hidden" style={{ paddingBottom: 'var(--safe-area-bottom)' }}>
      <div className="flex h-14 items-center justify-around">
        {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
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
              <span className={cn(active && 'font-semibold')}>{t(labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
