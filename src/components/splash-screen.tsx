'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCafeStore } from '@/lib/store/cafe-store';

// 모듈 레벨 — 한 번 dismiss되면 페이지 이동해도 다시 안 뜸
let splashDismissed = false;

export function SplashScreen() {
  const cafesReady = useCafeStore((s) => s.cafes.length > 0);
  const [visible, setVisible] = useState(!splashDismissed);

  useEffect(() => {
    if (splashDismissed) return;
    // ponytail: 데이터 로드 완료 시 0.5초 후 dismiss, 최대 2초 강제 dismiss
    const dismiss = () => {
      splashDismissed = true;
      setVisible(false);
    };
    const maxTimer = setTimeout(dismiss, 2000);
    let readyTimer: ReturnType<typeof setTimeout> | undefined;
    if (cafesReady) {
      readyTimer = setTimeout(dismiss, 500);
    }
    return () => {
      clearTimeout(maxTimer);
      if (readyTimer) clearTimeout(readyTimer);
    };
  }, [cafesReady]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-white"
        >
          <img
            src="/splash-character.png"
            alt="모닝카페"
            width={160}
            height={160}
            style={{ width: 160, height: 160, objectFit: 'contain' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
