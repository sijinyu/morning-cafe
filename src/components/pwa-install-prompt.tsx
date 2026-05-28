'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Share, Plus, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { isNativeApp } from '@/lib/capacitor';

const DISMISSED_KEY = 'pwa-install-dismissed';
const DISMISS_DAYS = 14;

/** 이미 standalone(홈화면 추가)으로 실행 중인지 */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as unknown as { standalone: boolean }).standalone === true)
  );
}

function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
}

function isAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android/.test(navigator.userAgent);
}

function wasDismissedRecently(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = localStorage.getItem(DISMISSED_KEY);
  if (!raw) return false;
  const dismissed = Number(raw);
  return Date.now() - dismissed < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);
  // Android: Chrome beforeinstallprompt 이벤트
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // 네이티브 앱이면 표시 안 함
    if (isNativeApp()) return;
    // standalone이면 표시 안 함
    if (isStandalone()) return;
    if (wasDismissedRecently()) return;

    // 첫 방문은 기다렸다가 표시 (3초 후)
    const timer = setTimeout(() => {
      setVisible(true);
    }, 3000);

    // Android Chrome: beforeinstallprompt 캡처
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }
    dismiss();
  }, [deferredPrompt, dismiss]);

  if (!visible) return null;

  const ios = isIOS();
  const android = isAndroid() && deferredPrompt;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-16 left-3 right-3 z-[55] md:bottom-4 md:left-auto md:right-4 md:max-w-sm"
        >
          <div className="rounded-2xl border border-border bg-background/95 p-4 shadow-xl backdrop-blur-sm">
            {/* 닫기 */}
            <button
              type="button"
              onClick={dismiss}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>

            {ios ? (
              /* iOS Safari 안내 */
              <div className="space-y-2.5 pr-6">
                <p className="text-sm font-semibold">앱처럼 사용하기</p>
                <div className="flex items-start gap-3 text-xs text-muted-foreground leading-relaxed">
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-1.5">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-muted">
                        <Share className="h-3 w-3" />
                      </span>
                      하단 <span className="font-medium text-foreground">공유</span> 버튼 탭
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-muted">
                        <Plus className="h-3 w-3" />
                      </span>
                      <span className="font-medium text-foreground">홈 화면에 추가</span> 선택
                    </p>
                  </div>
                </div>
              </div>
            ) : android ? (
              /* Android Chrome — 바로 설치 */
              <div className="space-y-3 pr-6">
                <p className="text-sm font-semibold">앱으로 설치할 수 있어요</p>
                <button
                  type="button"
                  onClick={handleInstall}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-medium text-white hover:bg-amber-600 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  홈 화면에 추가
                </button>
              </div>
            ) : (
              /* 기타 브라우저 */
              <div className="space-y-2 pr-6">
                <p className="text-sm font-semibold">앱처럼 사용하기</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  브라우저 메뉴에서 <span className="font-medium text-foreground">&quot;홈 화면에 추가&quot;</span> 또는 <span className="font-medium text-foreground">&quot;앱 설치&quot;</span>를 선택하세요.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Chrome beforeinstallprompt 타입 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
