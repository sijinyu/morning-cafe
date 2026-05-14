'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store/auth-store';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const REVIEW_TAGS = [
  '조용함',
  '콘센트많음',
  '주차가능',
  '넓은좌석',
  '뷰맛집',
  '디저트맛집',
  '와이파이빠름',
];

const MAX_CHARS = 100;

interface ReviewSheetProps {
  cafeId: string;
  cafeName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ReviewSheet({
  cafeId,
  cafeName,
  isOpen,
  onClose,
}: ReviewSheetProps) {
  const user = useAuthStore((state) => state.user);
  const [content, setContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function handleTagToggle(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function handleClose() {
    setContent('');
    setSelectedTags([]);
    onClose();
  }

  async function handleSubmit() {
    if (!user) {
      toast.error('로그인이 필요합니다', {
        action: {
          label: '로그인',
          onClick: () => {
            window.location.href = '/login';
          },
        },
      });
      return;
    }

    if (!content.trim()) {
      toast.error('한줄평을 입력해주세요');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from('reviews').insert({
        cafe_id: cafeId,
        user_id: user.id,
        content: content.trim(),
        tags: selectedTags,
      });

      if (error) throw error;

      toast.success('한줄평이 등록되었습니다!');
      handleClose();
    } catch {
      toast.error('한줄평 등록 중 오류가 발생했습니다');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-background shadow-2xl"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-border" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3">
              <div>
                <h2 className="text-lg font-bold">한줄평 남기기</h2>
                <p className="text-sm text-muted-foreground">{cafeName}</p>
              </div>
              <button
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted transition-colors"
                aria-label="닫기"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="px-5 pb-8 space-y-5">
              {/* Login required guard */}
              {!user ? (
                <div className="rounded-2xl bg-muted p-5 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    로그인 후 한줄평을 남길 수 있어요
                  </p>
                  <button
                    onClick={() => {
                      window.location.href = '/login';
                    }}
                    className="rounded-full bg-foreground px-6 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-80"
                  >
                    카카오로 로그인
                  </button>
                </div>
              ) : (
                <>
                  {/* Textarea */}
                  <div className="space-y-1.5">
                    <textarea
                      value={content}
                      onChange={(e) => {
                        if (e.target.value.length <= MAX_CHARS) {
                          setContent(e.target.value);
                        }
                      }}
                      placeholder="이 카페에 대한 솔직한 한줄평을 남겨주세요"
                      rows={3}
                      className={cn(
                        'w-full resize-none rounded-2xl border border-border bg-muted/50 px-4 py-3',
                        'text-sm placeholder:text-muted-foreground/50',
                        'focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all'
                      )}
                    />
                    <div className="flex justify-end">
                      <span
                        className={cn(
                          'text-xs',
                          content.length >= MAX_CHARS
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                        )}
                      >
                        {content.length}/{MAX_CHARS}
                      </span>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      태그 선택 (복수 선택 가능)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {REVIEW_TAGS.map((tag) => {
                        const isSelected = selectedTags.includes(tag);
                        return (
                          <motion.button
                            key={tag}
                            onClick={() => handleTagToggle(tag)}
                            whileTap={{ scale: 0.95 }}
                            className={cn(
                              'rounded-full px-3.5 py-1.5 text-sm font-medium transition-all',
                              isSelected
                                ? 'bg-foreground text-background'
                                : 'border border-border bg-background text-muted-foreground hover:border-foreground/30'
                            )}
                          >
                            {tag}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Submit */}
                  <motion.button
                    onClick={handleSubmit}
                    disabled={submitting || !content.trim()}
                    whileTap={{ scale: 0.97 }}
                    className={cn(
                      'w-full rounded-2xl py-4 text-base font-semibold transition-all',
                      'bg-foreground text-background',
                      'disabled:opacity-40 disabled:cursor-not-allowed'
                    )}
                  >
                    {submitting ? '등록 중...' : '한줄평 등록'}
                  </motion.button>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
