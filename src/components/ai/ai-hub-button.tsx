'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AiHubModal } from './ai-hub-modal';

export function AiHubButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        className="absolute md:bottom-[9rem] left-4 z-10"
        style={{ bottom: 'calc(var(--bottom-nav-height) + 8rem)' }}
      >
        <motion.button
          whileTap={{ scale: 0.95 }}
          transition={{ duration: 0.12, type: 'tween' }}
          onClick={() => setOpen(true)}
          aria-label="AI 카페 열기"
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3.5 py-2',
            'bg-foreground text-background shadow-md',
            'text-[13px] font-semibold',
            'transition-opacity hover:opacity-90 active:opacity-80',
            'border border-foreground/10',
          )}
        >
          <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
          AI
        </motion.button>
      </div>

      <AiHubModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
