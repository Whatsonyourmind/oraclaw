/**
 * ORACLE Caching Service
 * Story 5.3 - TTL-based LRU cache for free tier optimization
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  accessedAt: number;
}

interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
}

type CacheCategory = 'predictions' | 'simulations' | 'calibration' | 'gemini';

const CATEGORY_TTL: Record<CacheCategory, number> = {
  predictions: 5 * 60 * 1000, // 5 minutes
  simulations: 30 * 60 * 1000, // 30 minutes
  calibration: 60 * 60 * 1000, // 1 hour
  gemini: 15 * 60 * 1000, // 15 minutes
};

export class OracleCacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: config.maxSize || 1000,
      defaultTTL: config.defaultTTL || 15 * 60 * 1000, // 15 minutes default
    };
  }

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update access time for LRU
    entry.accessedAt = Date.now();

    return entry.value as T;
  }

  /**
   * Set value in cache with optional TTL
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    // Evict if at capacity
    if (this.cache.size >= this.config.maxSize) {
      this.evictLRU();
    }

    const ttl = ttlMs || this.config.defaultTTL;
    const now = Date.now();

    this.cache.set(key, {
      value,
      expiresAt: now + ttl,
      accessedAt: now,
    });
  }

  /**
   * Set value with category-based TTL
   */
  setByCategory<T>(category: CacheCategory, key: string, value: T): void {
    const fullKey = `${category}:${key}`;
    const ttl = CATEGORY_TTL[category];
    this.set(fullKey, value, ttl);
  }

  /**
   * Get value by category
   */
  getByCategory<T>(category: CacheCategory, key: string): T | null {
    const fullKey = `${category}:${key}`;
    return this.get<T>(fullKey);
  }

  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Delete all keys matching a prefix
   */
  deleteByPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all entries for a category
   */
  clearCategory(category: CacheCategory): number {
    return this.deleteByPrefix(`${category}:`);
  }

  /**
   * Clear all expired entries
   */
  clearExpired(): number {
    const now = Date.now();
    let count = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    categories: Record<string, number>;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    const categories: Record<string, number> = {};
    let oldestEntry: number | null = null;
    let newestEntry: number | null = null;

    for (const [key, entry] of this.cache.entries()) {
      // Count by category
      const category = key.split(':')[0];
      categories[category] = (categories[category] || 0) + 1;

      // Track oldest/newest
      if (oldestEntry === null || entry.accessedAt < oldestEntry) {
        oldestEntry = entry.accessedAt;
      }
      if (newestEntry === null || entry.accessedAt > newestEntry) {
        newestEntry = entry.accessedAt;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      categories,
      oldestEntry,
      newestEntry,
    };
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Get or set with factory function
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Get or set with category-based TTL
   */
  async getOrSetByCategory<T>(
    category: CacheCategory,
    key: string,
    factory: () => Promise<T>
  ): Promise<T> {
    const cached = this.getByCategory<T>(category, key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.setByCategory(category, key, value);
    return value;
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessedAt < oldestTime) {
        oldestTime = entry.accessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Generate cache key from object
   */
  static generateKey(obj: Record<string, any>): string {
    return JSON.stringify(obj, Object.keys(obj).sort());
  }
}

// Singleton instance
export const oracleCacheService = new OracleCacheService();

// Helper functions for common cache operations
export function cacheKey(...parts: (string | number)[]): string {
  return parts.join(':');
}

export function hashObject(obj: Record<string, any>): string {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}
