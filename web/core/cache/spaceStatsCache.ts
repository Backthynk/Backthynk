/**
 * Space Stats Cache Layer
 *
 * Intelligent caching for space statistics with:
 * - Space-aware cache keys
 * - Recursive view handling
 * - Smart invalidation
 * - Config-aware fetching
 */

import { createCache, type CacheManager } from './index';
import { fetchSpaceStats as apiFetchSpaceStats, type SpaceStats } from '../api/spaces';
import { cache as cacheConfig } from '../config';
import { clientConfig } from '../state/settings';
import { isRecursiveMode } from '../state/spaces';
import {
  setSpaceStats as setSpaceStatsState,
  setStatsLoading,
  clearAllSpaceStats as clearAllSpaceStatsState,
  clearSpaceStats as clearSpaceStatsState,
  getSpaceStats as getSpaceStatsFromState,
  isLoadingStats as isLoadingStatsFromState,
} from '../state/spaceStats';

export interface SpaceStatsCacheKey {
  spaceId: number;
  recursive: boolean;
}

export interface CachedSpaceStatsResult {
  stats: SpaceStats | null;
  fromCache: boolean;
}

/**
 * Generate a cache key from query parameters
 */
function generateCacheKey(params: SpaceStatsCacheKey): string {
  const { spaceId, recursive } = params;
  return `spaceStats:${spaceId}:${recursive ? 'recursive' : 'flat'}`;
}

/**
 * Space stats cache manager singleton
 */
class SpaceStatsCacheManager {
  private cache: CacheManager<SpaceStats>;
  private loadingKeys = new Set<string>();
  private enabled = true;

  constructor() {
    // Initialize with config values
    this.cache = createCache<SpaceStats>({
      maxSize: cacheConfig.spaceStats.maxSize,
      ttl: cacheConfig.spaceStats.ttl,
      debug: cacheConfig.spaceStats.debug,
    });
  }

  /**
   * Get space stats from cache (reads from reactive state)
   */
  getStats(spaceId: number, recursive: boolean): SpaceStats | null {
    if (!this.enabled) {
      return null;
    }

    // Read from reactive state instead of cache directly
    return getSpaceStatsFromState(spaceId, recursive);
  }

  /**
   * Check if stats are currently loading (reads from reactive state)
   */
  isLoadingStats(spaceId: number, recursive: boolean): boolean {
    // Read from reactive state instead of Set directly
    return isLoadingStatsFromState(spaceId, recursive);
  }

  /**
   * Fetch and cache space stats
   */
  async fetchStats(
    spaceId: number,
    recursive: boolean
  ): Promise<CachedSpaceStatsResult> {
    // Don't fetch if stats are disabled
    if (!clientConfig.value.space_stats) {
      return { stats: null, fromCache: false };
    }

    const cacheKey = generateCacheKey({ spaceId, recursive });

    // Try to get from cache first
    if (this.enabled) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        // Sync to reactive state
        setSpaceStatsState(spaceId, recursive, cached);
        return { stats: cached, fromCache: true };
      }
    }

    // Check if already loading
    if (this.loadingKeys.has(cacheKey)) {
      // Return null while loading, caller can check isLoadingStats
      return { stats: null, fromCache: false };
    }

    // Mark as loading in both cache and state
    this.loadingKeys.add(cacheKey);
    setStatsLoading(spaceId, recursive, true);

    try {
      // Cache miss - fetch from API
      const stats = await apiFetchSpaceStats(spaceId, recursive);

      // Store in cache and reactive state
      if (stats && this.enabled) {
        this.cache.set(cacheKey, stats);
        setSpaceStatsState(spaceId, recursive, stats);
      }

      return { stats, fromCache: false };
    } catch (err) {
      console.error(`Failed to fetch space stats for space ${spaceId}:`, err);
      return { stats: null, fromCache: false };
    } finally {
      // Remove from loading in both cache and state
      this.loadingKeys.delete(cacheKey);
      setStatsLoading(spaceId, recursive, false);
    }
  }

  /**
   * Get or fetch space stats (returns cached if available, fetches if not)
   */
  async getOrFetchStats(
    spaceId: number,
    recursive: boolean
  ): Promise<SpaceStats | null> {
    const cached = this.getStats(spaceId, recursive);
    if (cached) {
      return cached;
    }

    const result = await this.fetchStats(spaceId, recursive);
    return result.stats;
  }

  /**
   * Invalidate stats for a specific space
   */
  invalidateSpace(spaceId: number, includeRecursive = true): void {
    if (includeRecursive) {
      // Invalidate both flat and recursive views
      this.cache.invalidate(`spaceStats:${spaceId}:*`);
    } else {
      // Only invalidate flat view
      this.cache.invalidate(`spaceStats:${spaceId}:flat`);
    }

    // Also clear from reactive state
    clearSpaceStatsState(spaceId, includeRecursive);
  }

  /**
   * Invalidate all recursive views
   * Useful when a change affects multiple spaces
   */
  invalidateRecursiveViews(): void {
    this.cache.invalidate(/spaceStats:.*:recursive/);
  }

  /**
   * Invalidate all cached stats
   */
  invalidateAll(): void {
    this.cache.invalidate('spaceStats:*');
    // Also clear from reactive state
    clearAllSpaceStatsState();
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
    this.loadingKeys.clear();
    // Also clear reactive state
    clearAllSpaceStatsState();
  }

  /**
   * Enable or disable caching
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  /**
   * Get cache statistics
   */
  stats() {
    return {
      ...this.cache.stats(),
      loading: Array.from(this.loadingKeys),
    };
  }

  /**
   * Configure cache parameters
   */
  configure(config: { maxSize?: number; ttl?: number; debug?: boolean }): void {
    this.cache.configure(config);
  }
}

// Export singleton instance
export const spaceStatsCache = new SpaceStatsCacheManager();

// Export convenience functions
export async function fetchSpaceStats(
  spaceId: number,
  recursive: boolean
): Promise<CachedSpaceStatsResult> {
  return spaceStatsCache.fetchStats(spaceId, recursive);
}

export async function getOrFetchSpaceStats(
  spaceId: number,
  recursive: boolean
): Promise<SpaceStats | null> {
  return spaceStatsCache.getOrFetchStats(spaceId, recursive);
}

export function getSpaceStats(spaceId: number, recursive: boolean): SpaceStats | null {
  return spaceStatsCache.getStats(spaceId, recursive);
}

export function isLoadingStats(spaceId: number, recursive: boolean): boolean {
  return spaceStatsCache.isLoadingStats(spaceId, recursive);
}

export function invalidateSpaceStats(spaceId: number): void {
  spaceStatsCache.invalidateSpace(spaceId);
}

export function invalidateAllStats(): void {
  spaceStatsCache.invalidateAll();
}

export function prefetchSpaceStats(spaceId: number): void {
  // Determine recursive mode automatically
  const recursive = isRecursiveMode(spaceId);
  // Fire and forget
  spaceStatsCache.fetchStats(spaceId, recursive);
}
