'use client';

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { isNativeApp } from '@/lib/capacitor';

export function OfflineScreen() {
  const t = useTranslations('offline');
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;

    function handleOnline() {
      setOffline(false);
    }
    function handleOffline() {
      setOffline(true);
    }

    // 초기 상태 체크
    if (!navigator.onLine) {
      setOffline(true);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-background">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <WifiOff className="h-10 w-10 text-muted-foreground" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-lg font-bold text-foreground">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('description')}
        </p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
      >
        <RefreshCw className="h-4 w-4" />
        {t('retry')}
      </button>
    </div>
  );
}
