'use client';

import { useEffect } from 'react';
import { isNativeApp } from '@/lib/capacitor';

export function StatusBarConfig() {
  useEffect(() => {
    if (!isNativeApp()) return;

    import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
      StatusBar.setStyle({ style: Style.Light });
      StatusBar.setOverlaysWebView({ overlay: true });
    });
  }, []);

  return null;
}
