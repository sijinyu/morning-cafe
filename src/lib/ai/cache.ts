interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export function createAiCache<T>(ttlMs: number = 30 * 60 * 1000) {
  const cache = new Map<string, CacheEntry<T>>();

  return {
    get(key: string): T | null {
      const entry = cache.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
      }
      return entry.data;
    },

    set(key: string, data: T): void {
      cache.set(key, { data, expiresAt: Date.now() + ttlMs });
    },

    /** Simple hash from a string for cache key generation. */
    hash(input: string): string {
      let h = 0;
      for (let i = 0; i < input.length; i++) {
        h = ((h << 5) - h + input.charCodeAt(i)) | 0;
      }
      return String(h);
    },
  };
}
