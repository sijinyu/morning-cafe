/**
 * Standalone native notification utilities (non-hook).
 * Can be called from any context (hooks, event handlers, etc.)
 */
import { isNativeApp } from '@/lib/capacitor';

// ponytail: FNV-1a 32비트 해시 — 31-base보다 분산 균일, 충돌 감소
function hashCafeId(cafeId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < cafeId.length; i++) {
    hash ^= cafeId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 0x7FFFFFFF; // 양수 보장
}

function parseTime(time: string): { hours: number; minutes: number } | null {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return { hours: parseInt(match[1], 10), minutes: parseInt(match[2], 10) };
}

function getNextNotificationDate(openingTime: string): Date | null {
  const parsed = parseTime(openingTime);
  if (!parsed) return null;

  const now = new Date();
  const target = new Date();
  target.setHours(parsed.hours, parsed.minutes, 0, 0);
  target.setMinutes(target.getMinutes() - 30);

  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  return target;
}

export async function scheduleNativeNotification(
  cafeId: string,
  cafeName: string,
  openingTime: string,
): Promise<void> {
  if (!isNativeApp()) return;

  try {
    const { LocalNotifications } = await import(
      '@capacitor/local-notifications'
    );
    const notifDate = getNextNotificationDate(openingTime);
    if (!notifDate) return;

    const notifId = hashCafeId(cafeId);

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
}

export async function cancelNativeNotification(
  cafeId: string,
): Promise<void> {
  if (!isNativeApp()) return;

  try {
    const { LocalNotifications } = await import(
      '@capacitor/local-notifications'
    );
    const notifId = hashCafeId(cafeId);
    await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
  } catch (err) {
    console.error('[native-notifications] Cancel failed:', err);
  }
}
