'use client';

import { useRouter } from 'next/navigation';
import { User, LogOut, Settings, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/store/auth-store';
import { toast } from 'sonner';

function getDisplayName(user: { user_metadata?: Record<string, unknown> } | null): string {
  if (!user) return '';
  const meta = user.user_metadata ?? {};
  const name = meta['full_name'] ?? meta['name'] ?? meta['preferred_username'];
  return typeof name === 'string' ? name : '사용자';
}

function getAvatarUrl(user: { user_metadata?: Record<string, unknown> } | null): string | null {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  const url = meta['avatar_url'] ?? meta['picture'];
  return typeof url === 'string' ? url : null;
}

export default function MyPage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuthStore();

  async function handleSignOut() {
    try {
      await signOut();
      toast.success('로그아웃 되었습니다.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '로그아웃 중 오류가 발생했습니다.');
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <User className="h-10 w-10 text-muted-foreground/50" />
        </div>
        <h1 className="text-xl font-bold">마이페이지</h1>
        <p className="text-sm text-muted-foreground">
          로그인하고 즐겨찾기, 리뷰, 제보 기능을 이용하세요
        </p>
        <Button
          onClick={() => router.push('/login')}
          variant="outline"
          className="mt-2 rounded-full px-8"
        >
          카카오로 로그인
        </Button>
      </div>
    );
  }

  const displayName = getDisplayName(user);
  const avatarUrl = getAvatarUrl(user);

  return (
    <div className="flex h-full flex-col">
      {/* Profile section */}
      <div className="flex flex-col items-center gap-4 px-6 pb-8 pt-12">
        <div className="relative h-20 w-20 overflow-hidden rounded-full bg-muted">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <User className="h-10 w-10 text-muted-foreground/50" />
            </div>
          )}
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold">{displayName}</p>
          <p className="text-sm text-muted-foreground">{user.email ?? ''}</p>
        </div>
      </div>

      {/* Menu list */}
      <div className="flex-1 px-4">
        <div className="overflow-hidden rounded-2xl border bg-card">
          <button
            className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/50"
            onClick={() => toast.info('준비 중인 기능입니다.')}
          >
            <Settings className="h-5 w-5 text-muted-foreground" />
            <span className="flex-1 text-sm font-medium">설정</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          </button>
          <div className="mx-5 h-px bg-border" />
          <button
            className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/50"
            onClick={handleSignOut}
          >
            <LogOut className="h-5 w-5 text-destructive" />
            <span className="flex-1 text-sm font-medium text-destructive">로그아웃</span>
          </button>
        </div>
      </div>
    </div>
  );
}
