'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SplashScreenProps {
  /** 데이터 로딩 완료 여부 */
  ready: boolean;
}

export function SplashScreen({ ready }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!ready) return;
    // 데이터 로딩 완료 후 0.5초 뒤 페이드아웃
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
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#FFF8F0] dark:bg-[#1a1410]"
        >
          {/* 커피잔 + 김 애니메이션 */}
          <div className="relative mb-6">
            {/* 김 (steam) — 3개 */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex gap-2">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1 rounded-full bg-amber-600/30 dark:bg-amber-400/30"
                  initial={{ height: 0, opacity: 0, y: 0 }}
                  animate={{
                    height: [0, 16, 24, 16, 0],
                    opacity: [0, 0.6, 0.8, 0.4, 0],
                    y: [0, -8, -18, -26, -32],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.4,
                    ease: 'easeOut',
                  }}
                />
              ))}
            </div>

            {/* 커피잔 SVG */}
            <motion.svg
              width="72"
              height="60"
              viewBox="0 0 72 60"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              {/* 머그 본체 */}
              <rect
                x="10"
                y="10"
                width="40"
                height="36"
                rx="6"
                className="fill-amber-700 dark:fill-amber-600"
              />
              {/* 커피 액체 */}
              <rect
                x="14"
                y="22"
                width="32"
                height="20"
                rx="4"
                className="fill-amber-900/80 dark:fill-amber-800"
              />
              {/* 손잡이 */}
              <path
                d="M50 20C56 20 60 25 60 30C60 35 56 40 50 40"
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
                className="stroke-amber-700 dark:stroke-amber-600"
              />
              {/* 하이라이트 */}
              <ellipse
                cx="24"
                cy="18"
                rx="8"
                ry="4"
                className="fill-white/20"
              />
            </motion.svg>
          </div>

          {/* 로고 텍스트 */}
          <motion.h1
            className="text-2xl font-bold text-amber-900 dark:text-amber-100"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            모닝커피
          </motion.h1>

          {/* 서브 텍스트 */}
          <motion.p
            className="mt-2 text-sm text-amber-700/70 dark:text-amber-300/60"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            서울의 아침을 깨우는 카페
          </motion.p>

          {/* 로딩 점 */}
          <motion.div
            className="mt-8 flex gap-1.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-amber-600/50 dark:bg-amber-400/50"
                animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
