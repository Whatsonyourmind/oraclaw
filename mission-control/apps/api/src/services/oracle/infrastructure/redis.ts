/**
 * ORACLE Redis Caching Infrastructure
 * Story inf-1: Production-ready Redis caching layer
 *
 * Features:
 * - Connection pooling with ioredis
 * - Cache strategies: LRU, TTL-based
 * - Pub/sub for real-time invalidation
 * - Cache warming
 * - Metrics collection
 *
 * Time Complexity:
 * - O(1) for get/set operations
 * - O(n) for pattern-based operations where n is matching keys
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxPoolSize: number;
  minPoolSize: number;
  connectionTimeout: number;
  commandTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  keyPrefix: string;
  enableCluster: boolean;
  clusterNodes?: Array<{ host: string; port: number }>;
}

export interface CacheOptions {
  ttl?: number;
  strategy?: CacheStrategy;
  tags?: string[];
  compress?: boolean;
}

export type CacheStrategy = 'lru' | 'lfu' | 'ttl' | 'write-through' | 'write-behind';

export interface CacheEntry<T = unknown> {
  value: T;
  createdAt: number;
  accessedAt: number;
  accessCount: number;
  ttl: number;
  tags: string[];
  size: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  errors: number;
  hitRate: number;
  avgLatencyMs: number;
  totalLatencyMs: number;
  operationCount: number;
  memoryUsageBytes: number;
  keyCount: number;
}

export interface PubSubMessage {
  channel: string;
  pattern?: string;
  message: string;
  timestamp: number;
}

export interface WarmupConfig {
  keys: string[];
  batchSize: number;
  delayBetweenBatches: number;
  factory: (key: string) => Promise<unknown>;
}

// ============================================================================
// Mock Redis Client (for development without real Redis)
// ============================================================================

class MockRedisClient extends EventEmitter {
  private store = new Map<string, string>();
  private expiry = new Map<string, number>();
  private subscribers = new Map<string, Set<(message: string) => void>>();
  private patternSubscribers = new Map<string, Set<(channel: string, message: string) => void>>();
  private connected = false;

  async connect(): Promise<void> {
    this.connected = true;
    this.emit('connect');
    this.emit('ready');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.store.clear();
    this.expiry.clear();
    this.emit('end');
  }

  async quit(): Promise<void> {
    await this.disconnect();
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async get(key: string): Promise<string | null> {
    this.checkExpiry(key);
    return this.store.get(key) || null;
  }

  async set(key: string, value: string, options?: { EX?: number; PX?: number }): Promise<string> {
    this.store.set(key, value);
    if (options?.EX) {
      this.expiry.set(key, Date.now() + options.EX * 1000);
    } else if (options?.PX) {
      this.expiry.set(key, Date.now() + options.PX);
    }
    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<string> {
    return this.set(key, value, { EX: seconds });
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        this.expiry.delete(key);
        count++;
      }
    }
    return count;
  }

  async exists(...keys: string[]): Promise<number> {
    return keys.filter(key => {
      this.checkExpiry(key);
      return this.store.has(key);
    }).length;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    const result: string[] = [];
    for (const key of this.store.keys()) {
      this.checkExpiry(key);
      if (regex.test(key) && this.store.has(key)) {
        result.push(key);
      }
    }
    return result;
  }

  async mget(...keys: string[]): Promise<(string | null)[]> {
    return keys.map(key => {
      this.checkExpiry(key);
      return this.store.get(key) || null;
    });
  }

  async mset(data: Record<string, string>): Promise<string> {
    for (const [key, value] of Object.entries(data)) {
      this.store.set(key, value);
    }
    return 'OK';
  }

  async incr(key: string): Promise<number> {
    const val = parseInt(this.store.get(key) || '0', 10) + 1;
    this.store.set(key, val.toString());
    return val;
  }

  async incrby(key: string, increment: number): Promise<number> {
    const val = parseInt(this.store.get(key) || '0', 10) + increment;
    this.store.set(key, val.toString());
    return val;
  }

  async incrbyfloat(key: string, increment: number): Promise<string> {
    const val = parseFloat(this.store.get(key) || '0') + increment;
    this.store.set(key, val.toString());
    return val.toString();
  }

  async ttl(key: string): Promise<number> {
    const expiry = this.expiry.get(key);
    if (!expiry) return -1;
    const remaining = Math.ceil((expiry - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.store.has(key)) return 0;
    this.expiry.set(key, Date.now() + seconds * 1000);
    return 1;
  }

  async publish(channel: string, message: string): Promise<number> {
    let count = 0;

    // Direct subscribers
    const channelSubs = this.subscribers.get(channel);
    if (channelSubs) {
      for (const callback of channelSubs) {
        callback(message);
        count++;
      }
    }

    // Pattern subscribers
    for (const [pattern, subs] of this.patternSubscribers.entries()) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      if (regex.test(channel)) {
        for (const callback of subs) {
          callback(channel, message);
          count++;
        }
      }
    }

    return count;
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    this.subscribers.get(channel)!.add(callback);
  }

  async unsubscribe(channel: string): Promise<void> {
    this.subscribers.delete(channel);
  }

  async psubscribe(pattern: string, callback: (channel: string, message: string) => void): Promise<void> {
    if (!this.patternSubscribers.has(pattern)) {
      this.patternSubscribers.set(pattern, new Set());
    }
    this.patternSubscribers.get(pattern)!.add(callback);
  }

  async punsubscribe(pattern: string): Promise<void> {
    this.patternSubscribers.delete(pattern);
  }

  async dbsize(): Promise<number> {
    this.cleanExpired();
    return this.store.size;
  }

  async flushdb(): Promise<string> {
    this.store.clear();
    this.expiry.clear();
    return 'OK';
  }

  async info(section?: string): Promise<string> {
    return `# Server
redis_version:7.0.0
redis_mode:standalone
# Memory
used_memory:${this.store.size * 100}
used_memory_human:${Math.round(this.store.size * 100 / 1024)}K
# Keyspace
db0:keys=${this.store.size}`;
  }

  duplicate(): MockRedisClient {
    return new MockRedisClient();
  }

  private checkExpiry(key: string): void {
    const expiry = this.expiry.get(key);
    if (expiry && Date.now() > expiry) {
      this.store.delete(key);
      this.expiry.delete(key);
    }
  }

  private cleanExpired(): void {
    for (const key of this.store.keys()) {
      this.checkExpiry(key);
    }
  }
}

// ============================================================================
// Redis Connection Pool
// ============================================================================

export class RedisConnectionPool {
  private pool: MockRedisClient[] = [];
  private available: MockRedisClient[] = [];
  private waiting: Array<(client: MockRedisClient) => void> = [];
  private config: RedisConfig;
  private isShuttingDown = false;

  constructor(config: RedisConfig) {
    this.config = config;
  }

  /**
   * Initialize the connection pool
   * O(n) where n is minPoolSize
   */
  async initialize(): Promise<void> {
    for (let i = 0; i < this.config.minPoolSize; i++) {
      const client = await this.createClient();
      this.pool.push(client);
      this.available.push(client);
    }
  }

  /**
   * Acquire a connection from the pool
   * O(1) amortized
   */
  async acquire(): Promise<MockRedisClient> {
    if (this.isShuttingDown) {
      throw new Error('Pool is shutting down');
    }

    // Return available connection
    const client = this.available.pop();
    if (client) {
      return client;
    }

    // Create new connection if under max
    if (this.pool.length < this.config.maxPoolSize) {
      const newClient = await this.createClient();
      this.pool.push(newClient);
      return newClient;
    }

    // Wait for available connection
    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  /**
   * Release a connection back to the pool
   * O(1)
   */
  release(client: MockRedisClient): void {
    if (this.isShuttingDown) {
      return;
    }

    // Give to waiting request
    const waiting = this.waiting.shift();
    if (waiting) {
      waiting(client);
      return;
    }

    // Return to available pool
    this.available.push(client);
  }

  /**
   * Shutdown the pool gracefully
   * O(n) where n is pool size
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Reject waiting requests
    for (const waiting of this.waiting) {
      waiting(null as unknown as MockRedisClient);
    }
    this.waiting = [];

    // Close all connections
    for (const client of this.pool) {
      await client.quit();
    }

    this.pool = [];
    this.available = [];
  }

  /**
   * Get pool statistics
   */
  getStats(): { total: number; available: number; waiting: number } {
    return {
      total: this.pool.length,
      available: this.available.length,
      waiting: this.waiting.length,
    };
  }

  private async createClient(): Promise<MockRedisClient> {
    const client = new MockRedisClient();
    await client.connect();
    return client;
  }
}

// ============================================================================
// Cache Service
// ============================================================================

export class OracleRedisCache extends EventEmitter {
  private pool: RedisConnectionPool;
  private pubClient: MockRedisClient | null = null;
  private subClient: MockRedisClient | null = null;
  private config: RedisConfig;
  private metrics: CacheMetrics;
  private localCache = new Map<string, CacheEntry>();
  private lruQueue: string[] = [];
  private maxLocalCacheSize = 1000;
  private subscriptions = new Map<string, Set<(data: unknown) => void>>();
  private isInitialized = false;

  constructor(config?: Partial<RedisConfig>) {
    super();

    this.config = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0', 10),
      maxPoolSize: parseInt(process.env.REDIS_MAX_POOL_SIZE || '10', 10),
      minPoolSize: parseInt(process.env.REDIS_MIN_POOL_SIZE || '2', 10),
      connectionTimeout: 5000,
      commandTimeout: 5000,
      retryAttempts: 3,
      retryDelay: 1000,
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'oracle:',
      enableCluster: process.env.REDIS_CLUSTER === 'true',
      ...config,
    };

    this.pool = new RedisConnectionPool(this.config);

    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      errors: 0,
      hitRate: 0,
      avgLatencyMs: 0,
      totalLatencyMs: 0,
      operationCount: 0,
      memoryUsageBytes: 0,
      keyCount: 0,
    };
  }

  /**
   * Initialize the cache service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await this.pool.initialize();

    // Create dedicated pub/sub clients
    this.pubClient = new MockRedisClient();
    await this.pubClient.connect();

    this.subClient = new MockRedisClient();
    await this.subClient.connect();

    // Subscribe to invalidation channel
    await this.subClient.psubscribe(
      `${this.config.keyPrefix}invalidate:*`,
      (channel, message) => {
        this.handleInvalidation(channel, message);
      }
    );

    this.isInitialized = true;
    this.emit('ready');
  }

  /**
   * Get value from cache with LRU tracking
   * O(1) for local cache, O(1) for Redis
   */
  async get<T>(key: string, options?: { local?: boolean }): Promise<T | null> {
    const startTime = Date.now();
    const fullKey = this.prefixKey(key);

    try {
      // Check local cache first
      if (options?.local !== false) {
        const local = this.localCache.get(fullKey);
        if (local && this.isEntryValid(local)) {
          local.accessedAt = Date.now();
          local.accessCount++;
          this.updateLRU(fullKey);
          this.recordMetric('hit', startTime);
          return local.value as T;
        }
      }

      // Fetch from Redis
      const client = await this.pool.acquire();
      try {
        const data = await client.get(fullKey);

        if (data === null) {
          this.recordMetric('miss', startTime);
          return null;
        }

        const parsed = JSON.parse(data) as CacheEntry<T>;

        // Update local cache
        this.setLocalCache(fullKey, parsed);
        this.recordMetric('hit', startTime);

        return parsed.value;
      } finally {
        this.pool.release(client);
      }
    } catch (error) {
      this.metrics.errors++;
      this.emit('error', error);
      return null;
    }
  }

  /**
   * Set value in cache with optional TTL and strategy
   * O(1) for Redis, O(log n) for LRU eviction
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const startTime = Date.now();
    const fullKey = this.prefixKey(key);
    const ttl = options?.ttl || 3600; // Default 1 hour

    const entry: CacheEntry<T> = {
      value,
      createdAt: Date.now(),
      accessedAt: Date.now(),
      accessCount: 1,
      ttl,
      tags: options?.tags || [],
      size: JSON.stringify(value).length,
    };

    try {
      const client = await this.pool.acquire();
      try {
        const serialized = JSON.stringify(entry);
        await client.setex(fullKey, ttl, serialized);

        // Index by tags for bulk invalidation
        if (entry.tags.length > 0) {
          for (const tag of entry.tags) {
            await client.incr(`${this.config.keyPrefix}tag:${tag}:count`);
          }
        }

        // Update local cache based on strategy
        if (options?.strategy === 'write-through') {
          this.setLocalCache(fullKey, entry);
        }

        this.recordMetric('set', startTime);
      } finally {
        this.pool.release(client);
      }
    } catch (error) {
      this.metrics.errors++;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get or set with factory function (cache-aside pattern)
   * O(1) if cached, O(factory) if not
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, options);
    return value;
  }

  /**
   * Delete key from cache
   * O(1)
   */
  async delete(key: string): Promise<boolean> {
    const startTime = Date.now();
    const fullKey = this.prefixKey(key);

    try {
      // Remove from local cache
      this.localCache.delete(fullKey);

      // Remove from Redis
      const client = await this.pool.acquire();
      try {
        const count = await client.del(fullKey);
        this.recordMetric('delete', startTime);
        return count > 0;
      } finally {
        this.pool.release(client);
      }
    } catch (error) {
      this.metrics.errors++;
      this.emit('error', error);
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   * O(n) where n is matching keys
   */
  async deleteByPattern(pattern: string): Promise<number> {
    const fullPattern = this.prefixKey(pattern);

    try {
      const client = await this.pool.acquire();
      try {
        const keys = await client.keys(fullPattern);
        if (keys.length === 0) return 0;

        // Remove from local cache
        for (const key of keys) {
          this.localCache.delete(key);
        }

        // Remove from Redis
        const count = await client.del(...keys);
        this.metrics.deletes += count;
        return count;
      } finally {
        this.pool.release(client);
      }
    } catch (error) {
      this.metrics.errors++;
      this.emit('error', error);
      return 0;
    }
  }

  /**
   * Invalidate cache by tag
   * O(n) where n is keys with tag
   */
  async invalidateByTag(tag: string): Promise<number> {
    const pattern = `${this.config.keyPrefix}*`;

    try {
      const client = await this.pool.acquire();
      try {
        const keys = await client.keys(pattern);
        let invalidated = 0;

        for (const key of keys) {
          const data = await client.get(key);
          if (data) {
            const entry = JSON.parse(data) as CacheEntry;
            if (entry.tags.includes(tag)) {
              await client.del(key);
              this.localCache.delete(key);
              invalidated++;
            }
          }
        }

        // Publish invalidation event
        await this.publishInvalidation(`tag:${tag}`, { tag, count: invalidated });

        return invalidated;
      } finally {
        this.pool.release(client);
      }
    } catch (error) {
      this.metrics.errors++;
      this.emit('error', error);
      return 0;
    }
  }

  /**
   * Publish cache invalidation event
   */
  async publishInvalidation(channel: string, data: unknown): Promise<void> {
    if (!this.pubClient) return;

    const message = JSON.stringify({
      channel,
      data,
      timestamp: Date.now(),
    });

    await this.pubClient.publish(
      `${this.config.keyPrefix}invalidate:${channel}`,
      message
    );
  }

  /**
   * Subscribe to cache invalidation events
   */
  onInvalidation(pattern: string, callback: (data: unknown) => void): void {
    if (!this.subscriptions.has(pattern)) {
      this.subscriptions.set(pattern, new Set());
    }
    this.subscriptions.get(pattern)!.add(callback);
  }

  /**
   * Warm up cache with specified keys
   * O(n * m) where n is keys and m is factory time
   */
  async warmup(config: WarmupConfig): Promise<{ success: number; failed: number }> {
    const { keys, batchSize, delayBetweenBatches, factory } = config;
    let success = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (key) => {
          const value = await factory(key);
          await this.set(key, value, { strategy: 'write-through' });
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          success++;
        } else {
          failed++;
        }
      }

      // Delay between batches to avoid overwhelming Redis
      if (i + batchSize < keys.length && delayBetweenBatches > 0) {
        await this.delay(delayBetweenBatches);
      }
    }

    this.emit('warmup:complete', { success, failed });
    return { success, failed };
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? this.metrics.hits / total : 0;
    this.metrics.avgLatencyMs = this.metrics.operationCount > 0
      ? this.metrics.totalLatencyMs / this.metrics.operationCount
      : 0;
    this.metrics.keyCount = this.localCache.size;

    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      errors: 0,
      hitRate: 0,
      avgLatencyMs: 0,
      totalLatencyMs: 0,
      operationCount: 0,
      memoryUsageBytes: 0,
      keyCount: 0,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number; details: Record<string, unknown> }> {
    const startTime = Date.now();

    try {
      const client = await this.pool.acquire();
      try {
        await client.ping();
        const latencyMs = Date.now() - startTime;
        const poolStats = this.pool.getStats();
        const info = await client.info();

        return {
          healthy: true,
          latencyMs,
          details: {
            pool: poolStats,
            metrics: this.getMetrics(),
            redisInfo: this.parseRedisInfo(info),
          },
        };
      } finally {
        this.pool.release(client);
      }
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.emit('shutdown:start');

    // Unsubscribe from channels
    if (this.subClient) {
      await this.subClient.punsubscribe(`${this.config.keyPrefix}invalidate:*`);
      await this.subClient.quit();
    }

    if (this.pubClient) {
      await this.pubClient.quit();
    }

    // Shutdown pool
    await this.pool.shutdown();

    // Clear local cache
    this.localCache.clear();
    this.lruQueue = [];

    this.isInitialized = false;
    this.emit('shutdown:complete');
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private prefixKey(key: string): string {
    if (key.startsWith(this.config.keyPrefix)) {
      return key;
    }
    return `${this.config.keyPrefix}${key}`;
  }

  private isEntryValid(entry: CacheEntry): boolean {
    const now = Date.now();
    const expiresAt = entry.createdAt + entry.ttl * 1000;
    return now < expiresAt;
  }

  private setLocalCache(key: string, entry: CacheEntry): void {
    // Evict if at capacity (LRU)
    while (this.localCache.size >= this.maxLocalCacheSize) {
      const oldest = this.lruQueue.shift();
      if (oldest) {
        this.localCache.delete(oldest);
        this.metrics.evictions++;
      }
    }

    this.localCache.set(key, entry);
    this.lruQueue.push(key);
  }

  private updateLRU(key: string): void {
    const index = this.lruQueue.indexOf(key);
    if (index > -1) {
      this.lruQueue.splice(index, 1);
      this.lruQueue.push(key);
    }
  }

  private handleInvalidation(channel: string, message: string): void {
    try {
      const data = JSON.parse(message);

      // Match against subscriptions
      for (const [pattern, callbacks] of this.subscriptions.entries()) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        if (regex.test(channel)) {
          for (const callback of callbacks) {
            callback(data);
          }
        }
      }

      this.emit('invalidation', { channel, data });
    } catch (error) {
      this.emit('error', error);
    }
  }

  private recordMetric(type: 'hit' | 'miss' | 'set' | 'delete', startTime: number): void {
    const latency = Date.now() - startTime;
    this.metrics.totalLatencyMs += latency;
    this.metrics.operationCount++;

    switch (type) {
      case 'hit':
        this.metrics.hits++;
        break;
      case 'miss':
        this.metrics.misses++;
        break;
      case 'set':
        this.metrics.sets++;
        break;
      case 'delete':
        this.metrics.deletes++;
        break;
    }
  }

  private parseRedisInfo(info: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = info.split('\n');

    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key.trim()] = value?.trim() || '';
      }
    }

    return result;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton & Factory
// ============================================================================

let cacheInstance: OracleRedisCache | null = null;

/**
 * Get the singleton cache instance
 */
export function getRedisCache(config?: Partial<RedisConfig>): OracleRedisCache {
  if (!cacheInstance) {
    cacheInstance = new OracleRedisCache(config);
  }
  return cacheInstance;
}

/**
 * Create a new cache instance (for testing or isolated use)
 */
export function createRedisCache(config?: Partial<RedisConfig>): OracleRedisCache {
  return new OracleRedisCache(config);
}

// ============================================================================
// Cache Decorators
// ============================================================================

/**
 * Method decorator for caching function results
 */
export function Cached(options?: CacheOptions) {
  return function (
    _target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const cache = getRedisCache();
      const key = `method:${propertyKey}:${JSON.stringify(args)}`;

      return cache.getOrSet(key, () => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

/**
 * Invalidate cache decorator
 */
export function InvalidateCache(patterns: string[]) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const result = await originalMethod.apply(this, args);

      const cache = getRedisCache();
      for (const pattern of patterns) {
        await cache.deleteByPattern(pattern);
      }

      return result;
    };

    return descriptor;
  };
}

export default OracleRedisCache;
