/**
 * Smart Cache System
 *
 * Professional caching layer with:
 * - TTL (time-to-live) based expiration
 * - LRU (Least Recently Used) eviction
 * - Invalidation patterns
 * - Action system integration
 */

export interface CacheConfig {
  /** Maximum number of cache entries before LRU eviction kicks in */
  maxSize: number;
  /** Time to live in milliseconds (0 = infinite) */
  ttl: number;
  /** Enable debug logging */
  debug?: boolean;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  lastAccessed: number;
}

export type InvalidationPattern = string | RegExp | ((key: string) => boolean);

/**
 * Generic cache manager with TTL and LRU eviction
 */
export class CacheManager<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private config: Required<CacheConfig>;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: config.maxSize ?? 100,
      ttl: config.ttl ?? 5 * 60 * 1000, // 5 minutes default
      debug: config.debug ?? false,
    };
  }

  /**
   * Get a value from cache
   * Returns null if expired or not found
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.log('MISS', key);
      return null;
    }

    // Check if expired
    if (this.config.ttl > 0 && Date.now() - entry.timestamp > this.config.ttl) {
      this.log('EXPIRED', key);
      this.cache.delete(key);
      return null;
    }

    // Update last accessed time for LRU
    entry.lastAccessed = Date.now();
    this.log('HIT', key);
    return entry.data;
  }

  /**
   * Set a value in cache
   * Triggers LRU eviction if cache is full
   */
  set(key: string, data: T): void {
    // Evict oldest entry if cache is full
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
    });

    this.log('SET', key);
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  invalidate(pattern: InvalidationPattern): void {
    const keys = Array.from(this.cache.keys());
    const keysToDelete: string[] = [];

    for (const key of keys) {
      let shouldDelete = false;

      if (typeof pattern === 'string') {
        // Exact match or prefix match with wildcard
        if (pattern.endsWith('*')) {
          shouldDelete = key.startsWith(pattern.slice(0, -1));
        } else {
          shouldDelete = key === pattern;
        }
      } else if (pattern instanceof RegExp) {
        shouldDelete = pattern.test(key);
      } else if (typeof pattern === 'function') {
        shouldDelete = pattern(key);
      }

      if (shouldDelete) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.log('INVALIDATE', key);
    }

    if (keysToDelete.length > 0) {
      this.log('INVALIDATED', `${keysToDelete.length} entries`);
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.log('CLEAR', `${size} entries`);
  }

  /**
   * Get all cache entries (for iteration/updates)
   */
  entries(): IterableIterator<[string, T]> {
    const entries: [string, T][] = [];
    for (const [key, entry] of this.cache.entries()) {
      // Check if expired
      if (this.config.ttl > 0 && Date.now() - entry.timestamp > this.config.ttl) {
        continue;
      }
      entries.push([key, entry.data]);
    }
    return entries[Symbol.iterator]();
  }

  /**
   * Get cache statistics
   */
  stats(): {
    size: number;
    maxSize: number;
    ttl: number;
    keys: string[];
  } {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      ttl: this.config.ttl,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Update cache configuration
   */
  configure(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.log('EVICT (LRU)', oldestKey);
    }
  }

  /**
   * Debug logging
   */
  private log(action: string, detail: string): void {
    if (this.config.debug) {
      console.log(`[Cache] ${action}:`, detail);
    }
  }
}

/**
 * Create a cache manager with default or custom config
 */
export function createCache<T = any>(config?: Partial<CacheConfig>): CacheManager<T> {
  return new CacheManager<T>(config);
}
