type CacheEntry<T> = {
  value: T;
  createdAt: number;
  expiresAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();
const pendingRequests = new Map<string, Promise<unknown>>();

export function getCachedValue<T>(key: string): T | null {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() >= entry.expiresAt) {
    cache.delete(key);
    return null;
  }

  return entry.value as T;
}

export function setCachedValue<T>(
  key: string,
  value: T,
  ttlMilliseconds: number,
): T {
  const now = Date.now();

  cache.set(key, {
    value,
    createdAt: now,
    expiresAt: now + ttlMilliseconds,
  });

  return value;
}

export function deleteCachedValue(key: string): void {
  cache.delete(key);
}

export function clearMarketCache(): void {
  cache.clear();
}

export function getCacheAge(key: string): number | null {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  return Date.now() - entry.createdAt;
}

export async function withMarketCache<T>({
  key,
  ttlMilliseconds,
  request,
  forceRefresh = false,
}: {
  key: string;
  ttlMilliseconds: number;
  request: () => Promise<T>;
  forceRefresh?: boolean;
}): Promise<T> {
  if (!forceRefresh) {
    const cached = getCachedValue<T>(key);

    if (cached !== null) {
      return cached;
    }
  }

  const existingRequest = pendingRequests.get(key);

  if (existingRequest) {
    return existingRequest as Promise<T>;
  }

  const pending = request()
    .then((value) => {
      setCachedValue(key, value, ttlMilliseconds);
      return value;
    })
    .finally(() => {
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, pending);

  return pending;
}
