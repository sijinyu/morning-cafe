'use client';

import { useState, useEffect } from 'react';
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

  // 맵 마커와 동일한 구조를 스플래시 사이즈로 재현
  // sparkle + glossy pin + cream circle + coffee mug + squiggle tail
  const fill = '#F59E0B';
  const stroke = '#2D3748';
  const cream = '#FFF8F0';
  const coffee = '#92400E';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#FFF8F0] dark:bg-[#111] overflow-hidden"
        >
          {/* 마커 오브제 — 맵 마커와 동일 형태, 스플래시 사이즈 */}
          <motion.div
            className="relative"
            initial={{ scale: 0.85, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <svg
              width="140"
              height="180"
              viewBox="0 0 44 54"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <filter id="splash-ds" x="-30%" y="-20%" width="160%" height="180%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#000" floodOpacity="0.18"/>
                </filter>
              </defs>
              {/* 핀 몸체 — 맵 마커 selected 사이즈 (44x54) */}
              <path
                d="M22 52C22 52 4.7 35.4 4.7 22C4.7 11.6 12.4 3.1 22 3.1C31.6 3.1 39.3 11.6 39.3 22C39.3 35.4 22 52 22 52Z"
                fill={fill}
                stroke={stroke}
                strokeWidth="2"
                filter="url(#splash-ds)"
              />
              {/* Glossy 하이라이트 */}
              <ellipse
                cx="16.3" cy="12" rx="4.4" ry="3"
                fill="#FFFFFF" opacity="0.28"
                transform="rotate(-18 16.3 12)"
              />
              {/* Sparkle */}
              <path
                d="M34.7 9.1L35.8 11.5L38.3 12.6L35.8 13.7L34.7 16.1L33.6 13.7L31.1 12.6L33.6 11.5L34.7 9.1Z"
                fill={cream}
                stroke={stroke}
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
              {/* Cream circle */}
              <circle cx="22" cy="22" r="10.7" fill={cream} stroke={stroke} strokeWidth="1.4" />
              {/* Coffee mug body */}
              <rect x="16.5" y="18.2" width="9.9" height="8.5" rx="1.7" fill="none" stroke={stroke} strokeWidth="1.3" />
              {/* Mug handle */}
              <path
                d="M26.4 20.3C28.3 20.3 29.4 21.2 29.4 22.5C29.4 23.8 28.3 24.7 26.4 24.7"
                stroke={stroke}
                strokeWidth="1.1"
                strokeLinecap="round"
              />
              {/* Coffee liquid */}
              <rect x="17.8" y="22.1" width="7.1" height="2.8" rx="0.6" fill={coffee} opacity="0.9" />
              {/* Squiggle tail */}
              <path
                d="M17.6 39.5C18.9 38.5 19.9 38.5 21 39.5C22 40.4 23 40.4 24.1 39.4"
                stroke={stroke}
                strokeWidth="1.4"
                strokeLinecap="round"
                opacity="0.9"
              />
            </svg>
          </motion.div>

          {/* 하단 로딩 라인 */}
          <motion.div
            className="absolute bottom-12 left-1/2 -translate-x-1/2"
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
