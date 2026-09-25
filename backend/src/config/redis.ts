// src/config/redis.ts
import IORedis from 'ioredis';
import { env } from './env';

/**
 * In-memory mock for Redis when real Redis is unavailable.
 * Implements just enough of the IORedis interface for BullMQ to function
 * in test/development mode without an actual Redis server.
 */
class MockRedis {
  private store = new Map<string, string>();
  public status = 'ready';

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string, ..._args: any[]): Promise<'OK'> {
    this.store.set(key, value);
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
    }
    return count;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async quit(): Promise<'OK'> {
    this.store.clear();
    return 'OK';
  }

  async disconnect(): Promise<void> {
    this.store.clear();
  }

  duplicate(): MockRedis {
    return new MockRedis();
  }

  // BullMQ needs these event methods
  on(_event: string, _cb: (...args: any[]) => void): this {
    return this;
  }

  once(_event: string, _cb: (...args: any[]) => void): this {
    return this;
  }

  removeListener(_event: string, _cb: (...args: any[]) => void): this {
    return this;
  }
}

let redisConnection: IORedis | MockRedis;

/**
 * Returns a Redis connection (real or mock) based on env config.
 */
export function getRedisConnection(): IORedis | MockRedis {
  if (redisConnection) return redisConnection;

  if (env.useMockRedis) {
    console.log('⚠️  Using mock Redis (USE_MOCK_REDIS=true or Redis unavailable)');
    redisConnection = new MockRedis();
  } else {
    redisConnection = new IORedis(env.redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
    });

    redisConnection.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });

    redisConnection.on('connect', () => {
      console.log('✅ Redis connected');
    });
  }

  return redisConnection;
}

export { MockRedis };
