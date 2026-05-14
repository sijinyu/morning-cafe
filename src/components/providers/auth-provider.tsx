'use client';

import { useEffect, type ReactNode } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    const unsubscribe = initialize();
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [initialize]);

  return <>{children}</>;
}
