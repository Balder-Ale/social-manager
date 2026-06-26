/**
 * Redis caching layer with stale-while-revalidate support.
 * Caches OpenRouter responses (trends + hooks) for 10 minutes.
 * Serves stale data while refreshing in the background.
 */

import { createClient, RedisClientType } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min
const STALE_TTL_MS = 60 * 60 * 1000;  // serve stale up to 1h

let client: RedisClientType | null = null;
let connected = false;

async function getClient(): Promise<RedisClientType | null> {
  if (client && connected) return client;
  if (client) {
    try { await client.connect(); connected = true; return client; } catch { return null; }
  }
  try {
    client = createClient({ url: REDIS_URL });
    client.on('error', () => { connected = false; });
    await client.connect();
    connected = true;
    return client;
  } catch {
    return null;
  }
}

type CacheEntry<T> = {
  data: T;
  cachedAt: number;
};

/**
 * Get cached data. Returns null if not cached or stale beyond STALE_TTL.
 * If stale (past CACHE_TTL but within STALE_TTL), returns cached data
 * and signals caller to revalidate.
 */
export async function getCached<T>(key: string): Promise<{
  data: T | null;
  stale: boolean;
}> {
  const redis = await getClient();
  if (!redis) return { data: null, stale: false };

  try {
    const raw = await redis.get(key);
    if (!raw) return { data: null, stale: false };

    const entry: CacheEntry<T> = JSON.parse(raw);
    const age = Date.now() - entry.cachedAt;
    const stale = age > CACHE_TTL_MS;

    if (age > STALE_TTL_MS) {
      await redis.del(key);
      return { data: null, stale: false };
    }

    return { data: entry.data, stale };
  } catch {
    return { data: null, stale: false };
  }
}

/**
 * Store data in cache with current timestamp.
 */
export async function setCache<T>(key: string, data: T): Promise<void> {
  const redis = await getClient();
  if (!redis) return;

  try {
    const entry: CacheEntry<T> = { data, cachedAt: Date.now() };
    await redis.set(key, JSON.stringify(entry));
    // Auto-expire after STALE_TTL
    await redis.expire(key, Math.ceil(STALE_TTL_MS / 1000));
  } catch {
    // cache write failure is non-critical
  }
}

/**
 * Build a deterministic cache key from brandId and topic.
 */
export function buildTrendCacheKey(brandId: string, topic?: string): string {
  return `trends:${brandId}:${(topic || 'general').toLowerCase().replace(/\s+/g, '-')}`;
}