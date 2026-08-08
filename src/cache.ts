/** localStorage cache with TTL, keyed per coordinate grid cell. */

interface CacheEntry<T> {
  savedAt: number;
  value: T;
}

const PREFIX = 'mtm:cache:';

export function cacheGet<T>(key: string, maxAgeMs: number): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.savedAt > maxAgeMs) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, value: T): void {
  const entry: CacheEntry<T> = { savedAt: Date.now(), value };
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Storage full or unavailable — drop our own cache entries and retry once.
    try {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith(PREFIX)) localStorage.removeItem(k);
      }
      localStorage.setItem(PREFIX + key, JSON.stringify(entry));
    } catch {
      // Cache is best-effort; the app works without it.
    }
  }
}
