'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StickyNote, ChevronDown, ChevronUp } from 'lucide-react';

interface MemoSectionProps {
  cafeId: string;
  getMemo: (id: string) => string;
  setMemo: (id: string, text: string) => void;
}

export function MemoSection({ cafeId, getMemo, setMemo }: MemoSectionProps) {
  const [memoOpen, setMemoOpen] = useState(false);
  const [memoText, setMemoText] = useState(() => getMemo(cafeId));

  return (
    <div>
      <button
        onClick={() => setMemoOpen((v) => !v)}
        className="flex w-full items-center justify-between py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4" />
          <span>내 메모</span>
          {getMemo(cafeId) && !memoOpen && (
            <span className="text-xs text-foreground/60 truncate max-w-[160px]">{getMemo(cafeId)}</span>
          )}
        </div>
        {memoOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      <AnimatePresence>
        {memoOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-1 rounded-2xl bg-muted/50 p-3">
              <textarea
                value={memoText}
                onChange={(e) => setMemoText(e.target.value)}
                onBlur={() => setMemo(cafeId, memoText)}
                placeholder="이 카페에 대한 메모를 남겨보세요..."
                className="w-full resize-none rounded-xl bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                rows={3}
              />
              <div className="mt-1.5 flex justify-end">
                <button
                  onClick={() => {
                    setMemo(cafeId, memoText);
                    setMemoOpen(false);
                  }}
                  className="rounded-lg bg-foreground px-3 py-1 text-xs font-medium text-background"
                >
                  저장
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
