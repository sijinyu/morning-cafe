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
    if (!cafesReady || splashDismissed) return;
    const timer = setTimeout(() => {
      splashDismissed = true;
      setVisible(false);
    }, 500);
    return () => clearTimeout(timer);
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
