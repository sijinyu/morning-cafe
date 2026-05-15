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
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#FFF8F0] dark:bg-[#1a1410] overflow-hidden"
        >
          {/* 배경 데코 — 큰 원형 + 별 scatter (키치 레트로) */}
          <div className="absolute inset-0 pointer-events-none">
            {/* 큰 앰버 원 — 화면 중앙 뒤에 은은하게 */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-amber-300/10 dark:bg-amber-500/5" />
            {/* 작은 데코 별/점들 scatter */}
            {[
              { x: '15%', y: '20%', size: 32, rotate: 15 },
              { x: '80%', y: '15%', size: 24, rotate: -20 },
              { x: '10%', y: '75%', size: 20, rotate: 45 },
              { x: '85%', y: '70%', size: 28, rotate: -10 },
              { x: '50%', y: '10%', size: 16, rotate: 30 },
              { x: '25%', y: '88%', size: 22, rotate: -35 },
            ].map((star, i) => (
              <motion.svg
                key={i}
                width={star.size}
                height={star.size}
                viewBox="0 0 24 24"
                className="absolute text-amber-400/20 dark:text-amber-500/10"
                style={{ left: star.x, top: star.y }}
                initial={{ opacity: 0, rotate: star.rotate, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.6 }}
              >
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" fill="currentColor" />
              </motion.svg>
            ))}
          </div>

          {/* 메인 히어로: 큰 커피잔 + 핀 마커 콤보 */}
          <div className="relative mb-5 z-10">
            {/* 커피 스플래시 — 방울들이 톡톡 튀는 애니메이션 */}
            {[
              { x: -40, y: -16, size: 8, delay: 0 },
              { x: 44, y: -8, size: 6, delay: 0.25 },
              { x: -30, y: 40, size: 5, delay: 0.5 },
              { x: 38, y: 34, size: 7, delay: 0.15 },
              { x: -8, y: -36, size: 5, delay: 0.4 },
              { x: 20, y: -32, size: 4, delay: 0.6 },
            ].map((dot, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-amber-600/60 dark:bg-amber-400/40"
                style={{
                  width: dot.size,
                  height: dot.size,
                  left: `calc(50% + ${dot.x}px)`,
                  top: `calc(50% + ${dot.y}px)`,
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 0.8, 0.5, 0],
                  scale: [0, 1.4, 1, 0.5],
                  y: [0, -4, 8, 20],
                }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                  delay: dot.delay,
                  ease: 'easeOut',
                }}
              />
            ))}

            {/* 핀 마커 SVG — 핀 안에 커피잔, 더 큼직하게 */}
            <motion.svg
              width="110"
              height="140"
              viewBox="0 0 100 130"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              initial={{ scale: 0.6, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut', type: 'spring', damping: 12 }}
            >
              {/* 핀 그림자 */}
              <ellipse cx="50" cy="124" rx="16" ry="4" fill="#D4A574" opacity="0.3" />
              {/* 핀 몸체 */}
              <path
                d="M50 120C50 120 12 70 12 42C12 21 28.5 4 50 4C71.5 4 88 21 88 42C88 70 50 120 50 120Z"
                fill="#F59E0B"
              />
              {/* glossy 하이라이트 */}
              <ellipse cx="36" cy="26" rx="16" ry="12" fill="white" opacity="0.25" />
              {/* 핀 테두리 */}
              <path
                d="M50 120C50 120 12 70 12 42C12 21 28.5 4 50 4C71.5 4 88 21 88 42C88 70 50 120 50 120Z"
                fill="none"
                stroke="#D97706"
                strokeWidth="2"
              />
              {/* 안쪽 원 */}
              <circle cx="50" cy="42" r="22" fill="#5C3A1E" />
              <circle cx="50" cy="42" r="22" fill="none" stroke="#78350F" strokeWidth="1.5" />
              {/* 커피잔 */}
              <rect x="38" y="35" width="18" height="15" rx="3" fill="#FFF8F0" />
              {/* 커피 액체 */}
              <rect x="40" y="40" width="14" height="8" rx="2" fill="#B45309" />
              {/* 잔 하이라이트 */}
              <rect x="41" y="36" width="6" height="2" rx="1" fill="white" opacity="0.4" />
              {/* 손잡이 */}
              <path
                d="M56 38C59 38 61 40.5 61 43C61 45.5 59 48 56 48"
                fill="none"
                stroke="#FFF8F0"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {/* 김 (작은 웨이브) */}
              <path d="M44 33C44 31 46 31 46 29" stroke="#FFF8F0" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
              <path d="M49 32C49 30 51 30 51 28" stroke="#FFF8F0" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
            </motion.svg>
          </div>

          {/* 로고 — 볼드 + 레트로 느낌 */}
          <motion.div
            className="z-10 flex flex-col items-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <h1 className="text-3xl font-black tracking-tight text-[#B45309] dark:text-amber-400">
              MORNING COFFEE
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-px w-8 bg-amber-400/40" />
              <span className="text-[11px] font-bold tracking-[0.2em] text-amber-600/60 dark:text-amber-400/50 uppercase">
                Seoul Early Bird Cafe Map
              </span>
              <div className="h-px w-8 bg-amber-400/40" />
            </div>
          </motion.div>

          {/* 서브 텍스트 */}
          <motion.p
            className="mt-3 text-sm text-amber-800/50 dark:text-amber-300/40 z-10"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            서울의 아침을 깨우는 카페
          </motion.p>

          {/* 로딩 바 — 하단 */}
          <motion.div
            className="mt-10 flex flex-col items-center gap-2.5 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <span className="text-[10px] font-semibold text-amber-700/40 dark:text-amber-400/30 tracking-[0.15em] uppercase">
              Loading
            </span>
            <div className="h-1 w-36 overflow-hidden rounded-full bg-amber-500/15 dark:bg-amber-400/10">
              <motion.div
                className="h-full rounded-full bg-amber-500 dark:bg-amber-400"
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
