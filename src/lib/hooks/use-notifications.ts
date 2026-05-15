'use client';

import { useSyncExternalStore, useCallback } from 'react';

const STORAGE_KEY = 'morning-cafe-reminders';

export interface ReminderEntry {
  cafeName: string;
  openingTime: string;
}

// In-memory map of active setTimeout handles keyed by cafeId
const timerHandles: Record<string, ReturnType<typeof setTimeout>> = {};

// Cached parsed state from localStorage
let cachedReminders: Record<string, ReminderEntry> | null = null;

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function readStorage(): Record<string, ReminderEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ReminderEntry>;
  } catch {
    return {};
  }
}

function writeStorage(data: Record<string, ReminderEntry>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage quota exceeded or private browsing — silently ignore
  }
}

function getStableSnapshot(): Record<string, ReminderEntry> {
  if (!cachedReminders) {
    cachedReminders = readStorage();
  }
  return cachedReminders;
}

function getServerSnapshot(): Record<string, ReminderEntry> {
  return {};
}

function subscribe(callback: () => void): () => void {
  function handleStorage(e: StorageEvent) {
    if (e.key === STORAGE_KEY) {
      cachedReminders = null;
      callback();
    }
  }

  function handleCustom() {
    cachedReminders = null;
    callback();
  }

  window.addEventListener('storage', handleStorage);
  window.addEventListener('reminders-changed', handleCustom);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('reminders-changed', handleCustom);
  };
}

function notifySubscribers(): void {
  cachedReminders = null;
  window.dispatchEvent(new Event('reminders-changed'));
}

// ---------------------------------------------------------------------------
// Notification scheduling helpers
// ---------------------------------------------------------------------------

/**
 * Parse "HH:MM:SS" or "HH:MM" into { hours, minutes }.
 */
function parseTime(timeStr: string): { hours: number; minutes: number } | null {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0] ?? '', 10);
  const minutes = parseInt(parts[1] ?? '', 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return { hours, minutes };
}

/**
 * Calculate how many milliseconds from now until `hours:minutes` today
 * (or the same time tomorrow if that moment has already passed today),
 * then subtract the `leadMinutes` advance notice.
 *
 * Returns `null` when the resulting fire time is already in the past.
 */
function msUntilNotification(
  hours: number,
  minutes: number,
  leadMinutes = 30,
): number | null {
  const now = new Date();
  const target = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes - leadMinutes,
    0,
    0,
  );

  // If today's notification time is past, aim for tomorrow
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }

  const ms = target.getTime() - now.getTime();
  // Sanity: if still in the past (edge case) don't schedule
  return ms > 0 ? ms : null;
}

function fireNotification(cafeName: string, openingTime: string): void {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    const parsed = parseTime(openingTime);
    const timeLabel = parsed
      ? `${String(parsed.hours).padStart(2, '0')}:${String(parsed.minutes).padStart(2, '0')}`
      : openingTime;

    new Notification(`${cafeName} 오픈 30분 전`, {
      body: `${cafeName}이(가) ${timeLabel}에 오픈합니다. 슬슬 준비해볼까요?`,
      icon: '/icons/icon-192x192.png',
      tag: `morning-cafe-${cafeName}`,
    });
  } catch {
    // Notification constructor can throw in some environments
  }
}

function setTimer(cafeId: string, cafeName: string, openingTime: string): void {
  // Clear any existing timer for this cafe first
  clearTimer(cafeId);

  const parsed = parseTime(openingTime);
  if (!parsed) return;

  const delay = msUntilNotification(parsed.hours, parsed.minutes);
  if (delay === null) return;

  timerHandles[cafeId] = setTimeout(() => {
    fireNotification(cafeName, openingTime);
    // Clean up the handle after it fires
    delete timerHandles[cafeId];
  }, delay);
}

function clearTimer(cafeId: string): void {
  const handle = timerHandles[cafeId];
  if (handle !== undefined) {
    clearTimeout(handle);
    delete timerHandles[cafeId];
  }
}

// ---------------------------------------------------------------------------
// Public API (module-level, used by the hook)
// ---------------------------------------------------------------------------

async function requestPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined') return 'denied';
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

function scheduleReminder(
  cafeId: string,
  cafeName: string,
  openingTime: string,
): void {
  const current = readStorage();
  const updated = { ...current, [cafeId]: { cafeName, openingTime } };
  writeStorage(updated);
  setTimer(cafeId, cafeName, openingTime);
  notifySubscribers();
}

function removeReminder(cafeId: string): void {
  const current = readStorage();
  if (!(cafeId in current)) return;

  const { [cafeId]: _removed, ...rest } = current;
  writeStorage(rest);
  clearTimer(cafeId);
  notifySubscribers();
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNotifications() {
  const reminders = useSyncExternalStore(
    subscribe,
    getStableSnapshot,
    getServerSnapshot,
  );

  const request = useCallback(() => requestPermission(), []);

  const schedule = useCallback(
    (cafeId: string, cafeName: string, openingTime: string) => {
      scheduleReminder(cafeId, cafeName, openingTime);
    },
    [],
  );

  const remove = useCallback((cafeId: string) => {
    removeReminder(cafeId);
  }, []);

  const hasReminder = useCallback(
    (cafeId: string) => cafeId in reminders,
    [reminders],
  );

  return {
    reminders,
    requestPermission: request,
    scheduleReminder: schedule,
    removeReminder: remove,
    hasReminder,
  };
}
