'use client';

import { useEffect, useRef } from 'react';
import { isNativeApp } from '@/lib/capacitor';

/**
 * Initialize push notification registration on native apps.
 * - Requests permission 5 seconds after mount (reduce user friction)
 * - Registers APNs token and sends to server for future server-push
 * - Handles notification tap → deeplink to /?cafeId=xxx
 */
export function PushInit() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!isNativeApp() || initializedRef.current) return;
    initializedRef.current = true;

    const timer = setTimeout(async () => {
      try {
        const { PushNotifications } = await import(
          '@capacitor/push-notifications'
        );

        // Request permission
        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive !== 'granted') return;

        // Register with APNs
        await PushNotifications.register();

        // Listen for registration success → send token to server
        PushNotifications.addListener('registration', async (token) => {
          try {
            const favorites = JSON.parse(
              localStorage.getItem('morning-cafe-favorites') || '[]',
            );
            await fetch('/api/push-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: token.value,
                platform: 'ios',
                favoriteCafeIds: Array.isArray(favorites) ? favorites : [],
              }),
            });
          } catch (err) {
            console.error('[push-init] Token save failed:', err);
          }
        });

        PushNotifications.addListener('registrationError', (err) => {
          console.error('[push-init] Registration error:', err);
        });

        // Handle notification tap → deeplink
        PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (action) => {
            const cafeId = action.notification.data?.cafeId;
            if (cafeId && typeof window !== 'undefined') {
              window.location.href = `/?cafeId=${cafeId}`;
            }
          },
        );
      } catch (err) {
        console.error('[push-init] Init failed:', err);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  // Also handle local notification taps
  useEffect(() => {
    if (!isNativeApp()) return;

    let cleanup: (() => void) | undefined;

    import('@capacitor/local-notifications')
      .then(({ LocalNotifications }) => {
        const listener = LocalNotifications.addListener(
          'localNotificationActionPerformed',
          (action) => {
            const cafeId = action.notification.extra?.cafeId;
            if (cafeId && typeof window !== 'undefined') {
              window.location.href = `/?cafeId=${cafeId}`;
            }
          },
        );

        cleanup = () => {
          listener.then((l) => l.remove());
        };
      })
      .catch(() => {});

    return () => {
      cleanup?.();
    };
  }, []);

  return null;
}
