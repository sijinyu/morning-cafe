export function isNativeApp(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window as unknown as Record<string, unknown>).Capacitor !== undefined
  );
}
