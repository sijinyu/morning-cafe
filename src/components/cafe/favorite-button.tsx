'use client';

import { useState } from 'react';
import { Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store/auth-store';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface FavoriteButtonProps {
  cafeId: string;
  initialFavorited: boolean;
  className?: string;
}

export function FavoriteButton({
  cafeId,
  initialFavorited,
  className,
}: FavoriteButtonProps) {
  const user = useAuthStore((state) => state.user);
  const [favorited, setFavorited] = useState(initialFavorited);
  const [pending, setPending] = useState(false);

  async function handleToggle() {
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

    // Optimistic update
    const nextFavorited = !favorited;
    setFavorited(nextFavorited);
    setPending(true);

    try {
      const supabase = createClient();

      if (nextFavorited) {
        const { error } = await supabase
          .from('favorites')
          .insert({ user_id: user.id, cafe_id: cafeId });

        if (error) throw error;
        toast.success('즐겨찾기에 추가되었습니다');
      } else {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('cafe_id', cafeId);

        if (error) throw error;
        toast.success('즐겨찾기에서 제거되었습니다');
      }
    } catch {
      // Revert optimistic update on error
      setFavorited(!nextFavorited);
      toast.error('즐겨찾기 변경 중 오류가 발생했습니다');
    } finally {
      setPending(false);
    }
  }

  return (
    <motion.button
      onClick={handleToggle}
      disabled={pending}
      whileTap={{ scale: 0.85 }}
      animate={{ scale: favorited ? [1, 1.25, 1] : 1 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
        'hover:bg-muted disabled:opacity-50',
        className
      )}
      aria-label={favorited ? '즐겨찾기 제거' : '즐겨찾기 추가'}
    >
      <Heart
        className={cn(
          'h-5 w-5 transition-colors',
          favorited ? 'fill-red-500 stroke-red-500' : 'stroke-muted-foreground'
        )}
      />
    </motion.button>
  );
}
