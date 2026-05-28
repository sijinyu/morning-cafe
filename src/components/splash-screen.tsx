'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

// 모듈 레벨 — 한 번 dismiss되면 페이지 이동해도 다시 안 뜸
let splashDismissed = false;

interface SplashScreenProps {
  ready: boolean;
}

export function SplashScreen({ ready }: SplashScreenProps) {
  const [visible, setVisible] = useState(!splashDismissed);

  useEffect(() => {
    if (!ready || splashDismissed) return;
    const timer = setTimeout(() => {
      splashDismissed = true;
      setVisible(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [ready]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="fixed inset-0 z-[100] overflow-hidden"
        >
          <Image
            src="/splash.png"
            alt="모닝커피 — 서울의 아침을 깨우는 카페"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />

          {/* 하단 로딩 라인 */}
          <motion.div
            className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <div className="h-[2px] w-16 overflow-hidden rounded-full bg-white/20">
              <motion.div
                className="h-full rounded-full bg-white/60"
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
