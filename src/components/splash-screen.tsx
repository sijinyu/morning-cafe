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
          {/* 핀 마커 + 커피 스플래시 */}
          <div className="relative mb-6">
            {/* 커피 스플래시 점 — 핀 주변 작은 원들, 떨어지는 애니메이션 */}
            {[
              { x: -32, y: -10, size: 6, delay: 0 },
              { x: 36, y: -6, size: 5, delay: 0.3 },
              { x: -24, y: 30, size: 4, delay: 0.6 },
              { x: 30, y: 24, size: 5, delay: 0.15 },
              { x: 0, y: -30, size: 4, delay: 0.45 },
            ].map((dot, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-[#5C3A1E] dark:bg-[#A67B5B]"
                style={{
                  width: dot.size,
                  height: dot.size,
                  left: `calc(50% + ${dot.x}px)`,
                  top: `calc(50% + ${dot.y}px)`,
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 0.7, 0.5, 0],
                  scale: [0, 1.2, 1, 0.6],
                  y: [0, 6, 14, 22],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: dot.delay,
                  ease: 'easeOut',
                }}
              />
            ))}

            {/* 핀 마커 SVG — 핀 안에 커피잔 */}
            <motion.svg
              width="100"
              height="130"
              viewBox="0 0 100 130"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              {/* 핀 몸체 — 둥근 상단 + 뾰족한 하단 */}
              <path
                d="M50 126C50 126 10 72 10 42C10 19.9 27.9 2 50 2C72.1 2 90 19.9 90 42C90 72 50 126 50 126Z"
                fill="#F59E0B"
              />
              {/* 핀 하이라이트 (glossy) */}
              <ellipse
                cx="38"
                cy="28"
                rx="18"
                ry="14"
                fill="white"
                opacity="0.18"
              />
              {/* 핀 안의 원 — 커피 배경 */}
              <circle cx="50" cy="42" r="24" fill="#5C3A1E" />
              {/* 커피잔 (핀 내부) */}
              <rect x="37" y="35" width="20" height="16" rx="3" fill="#FFF8F0" />
              {/* 커피 액체 */}
              <rect x="39" y="40" width="16" height="9" rx="2" fill="#A0652A" />
              {/* 손잡이 */}
              <path
                d="M57 38C60 38 62 41 62 43C62 45 60 48 57 48"
                fill="none"
                stroke="#FFF8F0"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </motion.svg>
          </div>

          {/* 로고 텍스트 */}
          <motion.h1
            className="text-2xl font-black tracking-tight text-[#F59E0B] dark:text-[#FBBF24]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            모닝커피
          </motion.h1>

          {/* 서브 텍스트 */}
          <motion.p
            className="mt-2 text-sm text-muted-foreground"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            서울의 아침을 깨우는 카페
          </motion.p>

          {/* Loading... 텍스트 + 프로그레스 바 */}
          <motion.div
            className="mt-8 flex flex-col items-center gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <span className="text-xs font-medium text-muted-foreground/70 tracking-wider">
              Loading...
            </span>
            {/* 프로그레스 바 */}
            <div className="h-1 w-32 overflow-hidden rounded-full bg-[#F59E0B]/15 dark:bg-[#FBBF24]/15">
              <motion.div
                className="h-full rounded-full bg-[#F59E0B] dark:bg-[#FBBF24]"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{
                  duration: 2,
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
