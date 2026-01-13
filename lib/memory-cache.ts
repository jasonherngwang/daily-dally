type CacheEntry<T> = { expiresAt: number; value: T };

// In-memory cache (best-effort). Useful for dev and warm server instances.
// Not a substitute for shared KV caching in production.
const globalKey = '__daily_dally_memory_cache__';

function getStore(): Map<string, CacheEntry<unknown>> {
  const g = globalThis as unknown as Record<string, unknown>;
  const existing = g[globalKey];
  if (existing && existing instanceof Map) {
    return existing as Map<string, CacheEntry<unknown>>;
  }
  const next = new Map<string, CacheEntry<unknown>>();
  g[globalKey] = next;
  return next;
}

export function memoryCacheGet<T>(key: string): T | null {
  const store = getStore();
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function memoryCacheSet<T>(key: string, value: T, ttlMs: number) {
  const store = getStore();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

