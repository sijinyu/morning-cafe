'use client';
import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

interface AuthState {
  user: User | null;
  loading: boolean;
  initialize: () => (() => void);
  signInWithKakao: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  initialize() {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ user: session?.user ?? null, loading: false });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null, loading: false });
    });

    // Return unsubscribe — callers may ignore this, but it is available.
    return () => subscription.unsubscribe();
  },

  async signInWithKakao() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: window.location.origin,
      },
    });
    if (error) {
      throw new Error(`카카오 로그인 실패: ${error.message}`);
    }
  },

  async signOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(`로그아웃 실패: ${error.message}`);
    }
    set({ user: null });
  },
}));
