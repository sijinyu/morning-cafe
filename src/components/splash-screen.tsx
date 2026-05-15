'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SplashScreenProps {
  ready: boolean;
}

export function SplashScreen({ ready }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => setVisible(false), 500);
    return () => clearTimeout(timer);
  }, [ready]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#FFF8F0] dark:bg-[#111] overflow-hidden"
        >
          {/* 큰 핀 마커 — 화면 중앙, 오브제처럼 */}
          <motion.div
            className="relative"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <svg
              width="120"
              height="156"
              viewBox="0 0 100 130"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* 핀 그림자 */}
              <ellipse cx="50" cy="126" rx="20" ry="4" className="fill-black/5 dark:fill-white/5" />
              {/* 핀 몸체 */}
              <path
                d="M50 122C50 122 10 68 10 40C10 18.5 27.9 1 50 1C72.1 1 90 18.5 90 40C90 68 50 122 50 122Z"
                className="fill-amber-500 dark:fill-amber-400"
              />
              {/* 안쪽 원 */}
              <circle cx="50" cy="40" r="24" className="fill-[#3D2613] dark:fill-[#2A1A0D]" />
              {/* 커피잔 — 미니멀 */}
              <rect x="38" y="33" width="18" height="15" rx="3" className="fill-[#FFF8F0] dark:fill-[#F5E6D3]" />
              <rect x="40" y="38" width="14" height="8" rx="2" className="fill-amber-700 dark:fill-amber-600" />
              {/* 손잡이 */}
              <path
                d="M56 36C59 36 61 39 61 41.5C61 44 59 47 56 47"
                fill="none"
                className="stroke-[#FFF8F0] dark:stroke-[#F5E6D3]"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </motion.div>

          {/* 타이포 — 대담하고 미니멀 */}
          <motion.div
            className="mt-8 flex flex-col items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-[28px] font-black tracking-[-0.04em] text-[#1A1A1A] dark:text-[#F5F5F5] uppercase">
              Morning Coffee
            </h1>
            <p className="mt-1.5 text-[11px] font-medium tracking-[0.25em] text-[#999] dark:text-[#666] uppercase">
              Seoul · Since 2026
            </p>
          </motion.div>

          {/* 하단 로딩 — 얇은 라인 */}
          <motion.div
            className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            <div className="h-[1px] w-24 overflow-hidden bg-black/[0.06] dark:bg-white/[0.06]">
              <motion.div
                className="h-full bg-amber-500/70 dark:bg-amber-400/70"
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
