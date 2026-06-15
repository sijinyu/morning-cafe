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
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
          style={{ backgroundColor: '#FFF8F0' }}
        >
          {/* 캐릭터 이미지 — framer-motion 없이 바로 표시 */}
          <img
            src="/splash-character.png"
            alt="모닝카페 캐릭터"
            width={140}
            height={140}
            style={{ width: 140, height: 140, objectFit: 'contain' }}
          />

          {/* 앱 이름 */}
          <h1
            className="mt-5 text-2xl font-bold tracking-tight"
            style={{ color: '#1A1A1A' }}
          >
            모닝카페
          </h1>

          {/* 서브타이틀 */}
          <p
            className="mt-1.5 text-sm"
            style={{ color: '#999' }}
          >
            서울의 아침을 깨우는 카페
          </p>

          {/* 로딩 라인 */}
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2">
            <div
              className="h-[2px] w-16 overflow-hidden rounded-full"
              style={{ backgroundColor: 'rgba(0,0,0,0.08)' }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: '#E8554E' }}
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
