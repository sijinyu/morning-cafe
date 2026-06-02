'use client';

import { useCallback, useEffect, useRef } from 'react';
import { isNativeApp } from '@/lib/capacitor';

/**
 * Native local notification hook for Capacitor apps.
 * Schedules "cafe open in 30 min" reminders via @capacitor/local-notifications.
 * Web browsers use the existing use-notifications.ts (Web Notifications API) instead.
 */

interface ScheduleOptions {
  cafeId: string;
  cafeName: string;
  /** Opening time string e.g. "06:30", "07:00" */
  openingTime: string;
}

// Stable numeric ID derived from cafeId string (for Capacitor notification ID)
function hashCafeId(cafeId: string): number {
  let hash = 0;
  for (let i = 0; i < cafeId.length; i++) {
    hash = (hash * 31 + cafeId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function parseTime(time: string): { hours: number; minutes: number } | null {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return { hours: parseInt(match[1], 10), minutes: parseInt(match[2], 10) };
}

/**
 * Calculate the next notification date (30 minutes before opening, tomorrow if already past)
 */
function getNextNotificationDate(openingTime: string): Date | null {
  const parsed = parseTime(openingTime);
  if (!parsed) return null;

  const now = new Date();
  const target = new Date();
  target.setHours(parsed.hours, parsed.minutes, 0, 0);

  // 30 minutes before opening
  target.setMinutes(target.getMinutes() - 30);

  // If the notification time has already passed today, schedule for tomorrow
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  return target;
}

export function useNativeNotifications() {
  const pluginRef = useRef<typeof import('@capacitor/local-notifications') | null>(null);

  useEffect(() => {
    if (!isNativeApp()) return;

    import('@capacitor/local-notifications')
      .then((mod) => {
        pluginRef.current = mod;
      })
      .catch(() => {
        // Plugin not available — silently degrade
      });
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isNativeApp() || !pluginRef.current) return false;

    try {
      const { LocalNotifications } = pluginRef.current;
      const result = await LocalNotifications.requestPermissions();
      return result.display === 'granted';
    } catch {
      return false;
    }
  }, []);

  const scheduleNotification = useCallback(
    async ({ cafeId, cafeName, openingTime }: ScheduleOptions) => {
      if (!isNativeApp() || !pluginRef.current) return;

      const { LocalNotifications } = pluginRef.current;
      const notifDate = getNextNotificationDate(openingTime);
      if (!notifDate) return;

      const notifId = hashCafeId(cafeId);

      try {
        // Cancel any existing notification for this cafe
        await LocalNotifications.cancel({ notifications: [{ id: notifId }] });

        await LocalNotifications.schedule({
          notifications: [
            {
              id: notifId,
              title: `${cafeName} 곧 오픈!`,
              body: `찜한 카페가 30분 후(${openingTime}) 문을 엽니다`,
              schedule: { at: notifDate },
              extra: { cafeId },
            },
          ],
        });
      } catch (err) {
        console.error('[native-notifications] Schedule failed:', err);
      }
    },
    [],
  );

  const cancelNotification = useCallback(async (cafeId: string) => {
    if (!isNativeApp() || !pluginRef.current) return;

    const { LocalNotifications } = pluginRef.current;
    const notifId = hashCafeId(cafeId);

    try {
      await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
    } catch (err) {
      console.error('[native-notifications] Cancel failed:', err);
    }
  }, []);

  return {
    requestPermission,
    scheduleNotification,
    cancelNotification,
    isNative: isNativeApp(),
  };
}
