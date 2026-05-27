'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SwUpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleUpdate = (registration: ServiceWorkerRegistration) => {
      const waiting = registration.waiting;
      if (waiting) {
        setWaitingWorker(waiting);
      }
    };

    navigator.serviceWorker.ready.then((registration) => {
      // 이미 대기 중인 SW가 있으면
      if (registration.waiting) {
        setWaitingWorker(registration.waiting);
      }

      // 새 SW가 설치되면 감지
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
          }
        });
      });
    });

    // SW가 controllerchange 이벤트 발생하면 새로고침
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);

  if (!waitingWorker) return null;

  function handleUpdate() {
    waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
  }

  return (
    <div
      className={cn(
        'fixed top-4 left-1/2 -translate-x-1/2 z-[200]',
        'flex items-center gap-3 rounded-2xl px-4 py-3',
        'bg-foreground text-background shadow-lg',
        'animate-in slide-in-from-top-4 fade-in duration-300',
      )}
    >
      <RefreshCw className="h-4 w-4 flex-shrink-0" />
      <span className="text-sm font-medium">새 버전이 있습니다</span>
      <button
        onClick={handleUpdate}
        className="rounded-full bg-background text-foreground px-3 py-1 text-xs font-semibold hover:opacity-90 transition-opacity"
      >
        업데이트
      </button>
    </div>
  );
}
