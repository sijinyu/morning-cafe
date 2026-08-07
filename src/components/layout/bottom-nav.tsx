'use client';

import { Map, Bookmark, Send, BookOpen, Award } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

// 스탬프는 리텐션 훅(도장깨기)의 진입점 — 네비에 없으면 존재를 알 수 없어 추가.
const NAV_ITEMS = [
  { href: '/' as const, labelKey: 'map' as const, icon: Map },
  { href: '/guides' as const, labelKey: 'guides' as const, icon: BookOpen },
  { href: '/stamp' as const, labelKey: 'stamp' as const, icon: Award },
  { href: '/favorites' as const, labelKey: 'favorites' as const, icon: Bookmark },
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
                // 5탭이라 px 고정 대신 flex-1로 균등 분배한다.
                'flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] font-medium transition-colors',
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
