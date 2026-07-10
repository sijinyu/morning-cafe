'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { locales } from '@/i18n/config';

// 다음 언어로 순환할 때 버튼에 표시할 라벨 (다음 언어의 이름)
const NEXT_LABEL: Record<string, string> = { ko: 'EN', en: '日本語', ja: '한국어' };

export function LocaleToggle() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const idx = locales.indexOf(locale as (typeof locales)[number]);
  const nextLocale = locales[(idx + 1) % locales.length];

  return (
    <button
      onClick={() => router.replace(pathname, { locale: nextLocale })}
      className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-xs text-muted-foreground hover:bg-foreground/[0.03] hover:text-foreground transition-colors"
    >
      <span className="text-sm">🌐</span>
      {NEXT_LABEL[locale]}
    </button>
  );
}
