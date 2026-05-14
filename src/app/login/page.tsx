'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Coffee } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store/auth-store';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, signInWithKakao } = useAuthStore();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  async function handleKakaoLogin() {
    try {
      await signInWithKakao();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다.');
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6">
      <Coffee className="h-16 w-16 text-amber-600" />
      <div className="text-center">
        <h1 className="text-2xl font-bold">모닝카페</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          서울 얼리버드 카페 찾기
        </p>
      </div>
      <Button
        onClick={handleKakaoLogin}
        disabled={loading}
        className="mt-4 h-12 w-full max-w-xs rounded-xl bg-[#FEE500] text-[#191919] hover:bg-[#FDD835] font-semibold"
      >
        카카오로 시작하기
      </Button>
    </div>
  );
}
