'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Search, GitCompareArrows, Zap, Train, MessageSquareQuote, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AiTasteFinder } from './ai-taste-finder';
import { AiComparePanel } from './ai-compare-panel';
import { AiDailyPick } from './ai-daily-pick';
import { AiCommutePanel } from './ai-commute-panel';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AiFeature = 'hub' | 'taste-finder' | 'compare' | 'daily-pick' | 'commute';

interface AiHubModalProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    id: 'taste-finder' as const,
    icon: Search,
    title: '내 취향 카페 찾기',
    description: '칩으로 목적·분위기·시설 선택하면 맞춤 추천',
    color: 'text-amber-500',
  },
  {
    id: 'compare' as const,
    icon: GitCompareArrows,
    title: '카페 비교',
    description: '찜/최근 카페 중 2~3개 AI 비교표',
    color: 'text-blue-500',
  },
  {
    id: 'daily-pick' as const,
    icon: Zap,
    title: '오늘의 추천',
    description: '원클릭 — 지금 가기 좋은 카페 1곳',
    color: 'text-emerald-500',
  },
  {
    id: 'commute' as const,
    icon: Train,
    title: '출근길 카페',
    description: '집→카페→직장 최적 경로 추천',
    color: 'text-violet-500',
  },
] as const;

function getFeatureTitle(feature: AiFeature): string {
  switch (feature) {
    case 'hub':
      return 'AI 카페';
    case 'taste-finder':
      return '내 취향 카페 찾기';
    case 'compare':
      return '카페 비교';
    case 'daily-pick':
      return '오늘의 추천';
    case 'commute':
      return '출근길 카페';
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AiHubModal({ open, onClose }: AiHubModalProps) {
  const [activeFeature, setActiveFeature] = useState<AiFeature>('hub');

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (activeFeature !== 'hub') {
          setActiveFeature('hub');
        } else {
          onClose();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, activeFeature, onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => setActiveFeature('hub'), 300);
  }, [onClose]);

  const handleBack = useCallback(() => {
    setActiveFeature('hub');
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="ai-hub-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, type: 'tween' }}
            className="fixed inset-0 z-[59] bg-black/30 backdrop-blur-[2px]"
            onClick={handleClose}
          />

          {/* Modal panel — slides up from bottom, full screen */}
          <motion.div
            key="ai-hub-modal"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.28, type: 'tween', ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-[60] flex flex-col bg-background"
            style={{ paddingTop: 'var(--safe-area-top)', paddingBottom: 'var(--safe-area-bottom)' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3.5 flex-shrink-0">
              {activeFeature !== 'hub' && (
                <button
                  onClick={handleBack}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 transition-colors hover:bg-muted"
                  aria-label="뒤로"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 18 18"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M11 4L6 9L11 14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-muted-foreground"
                    />
                  </svg>
                </button>
              )}
              <div className="flex flex-1 items-center gap-2">
                <Sparkles className="h-4 w-4 flex-shrink-0 text-amber-500" />
                <span className="text-[15px] font-semibold text-foreground">
                  {getFeatureTitle(activeFeature)}
                </span>
              </div>
              <button
                onClick={handleClose}
                aria-label="닫기"
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted/60 transition-colors hover:bg-muted"
              >
                <X className="h-[18px] w-[18px] text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {activeFeature === 'hub' && (
                <div className="flex flex-col gap-3 p-4">
                  <p className="text-sm text-muted-foreground">
                    AI가 맞춤 카페를 찾아드려요
                  </p>

                  {FEATURES.map((feature) => (
                    <button
                      key={feature.id}
                      onClick={() => setActiveFeature(feature.id)}
                      className={cn(
                        'flex items-start gap-4 rounded-2xl border border-border/50 p-4',
                        'text-left transition-all hover:bg-muted/50 active:bg-muted/70',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20',
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-muted/60',
                          feature.color,
                        )}
                      >
                        <feature.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-semibold text-foreground">{feature.title}</p>
                        <p className="mt-0.5 text-[13px] text-muted-foreground">{feature.description}</p>
                      </div>
                    </button>
                  ))}

                  {/* Info card for tagline — auto-shown in bottom sheet */}
                  <div className="rounded-2xl bg-muted/40 px-4 py-3 mt-1">
                    <div className="flex items-center gap-2">
                      <MessageSquareQuote className="h-4 w-4 text-purple-500 flex-shrink-0" />
                      <span className="text-[13px] font-medium text-foreground">카페 한줄 분석</span>
                    </div>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      카페를 선택하면 바텀시트에 AI 태그라인이 자동으로 표시돼요
                    </p>
                  </div>
                </div>
              )}

              {activeFeature === 'taste-finder' && (
                <AiTasteFinder onClose={handleClose} />
              )}

              {activeFeature === 'compare' && (
                <AiComparePanel onClose={handleClose} />
              )}

              {activeFeature === 'daily-pick' && (
                <AiDailyPick onClose={handleClose} />
              )}

              {activeFeature === 'commute' && (
                <AiCommutePanel onClose={handleClose} />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
