// src/config/redis.js — Redis client via ioredis
// Redis serves four roles in this architecture:
//   1. Rate-limit counters (shared across all cluster workers)
//   2. JWT blocklist (invalidated tokens on logout)
//   3. Caching (zone lookups, platform config)
//   4. Pub/sub for Socket.IO adapter in cluster mode
import Redis  from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let _client = null;

export function getRedis() {
  if (!_client) {
    _client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 10) return null; // stop retrying after 10 attempts
        return Math.min(times * 200, 3000);
      },
      lazyConnect: true,
    });
    _client.on('connect',    () => logger.info('✅  Redis connected'));
    _client.on('error',  (e) => logger.error('Redis error:', e.message));
    _client.on('reconnecting', () => logger.warn('Redis reconnecting…'));
  }
  return _client;
}

export async function connectRedis() {
  const client = getRedis();
  //check and only connect again if has not be connect before 
  if(client.status === 'wait' || client.status === 'close'){
    await client.connect();
  }
  return client;
}

// ── Convenience helpers ──

/** Cache a value with TTL in seconds */
export async function cacheSet(key, value, ttlSec = 300) {
  await getRedis().setex(`os:${key}`, ttlSec, JSON.stringify(value));
}

/** Get a cached value (returns null on miss) */
export async function cacheGet(key) {
  const raw = await getRedis().get(`os:${key}`);
  return raw ? JSON.parse(raw) : null;
}

/** Delete cached value */
export async function cacheDel(key) {
  await getRedis().del(`os:${key}`);
}

/** Add a token JTI to the blocklist (for logout invalidation) */
export async function blockToken(jti, expiresInSec) {
  await getRedis().setex(`blocklist:${jti}`, expiresInSec, '1');
}

/** Check if a token is blocked */
export async function isTokenBlocked(jti) {
  return (await getRedis().exists(`blocklist:${jti}`)) === 1;
}