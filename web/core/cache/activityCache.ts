/**
 * Activity Data Cache Layer
 *
 * Intelligent caching for activity data with:
 * - Space-aware cache keys
 * - Period-based caching
 * - Recursive view handling
 * - Smart invalidation
 * - Config-aware fetching
 */

import { createCache, type CacheManager } from './index';
import { fetchActivityData as apiFetchActivityData, type ActivityData } from '../api/activity';
import { cache as cacheConfig } from '../config';
import { clientConfig } from '../state/settings';

export interface ActivityCacheKey {
  spaceId: number;
  recursive: boolean;
  period: number;
  periodMonths: number;
}

export interface CachedActivityResult {
  data: ActivityData | null;
  fromCache: boolean;
}

/**
 * Generate a cache key from query parameters
 */
function generateCacheKey(params: ActivityCacheKey): string {
  const { spaceId, recursive, period, periodMonths } = params;
  return `activity:${spaceId}:${recursive ? 'recursive' : 'flat'}:${period}:${periodMonths}m`;
}

/**
 * Activity cache manager singleton
 */
class ActivityCacheManager {
  private cache: CacheManager<ActivityData>;
  private loadingKeys = new Set<string>();
  private enabled = true;

  constructor() {
    // Initialize with config values
    this.cache = createCache<ActivityData>({
      maxSize: cacheConfig.activity.maxSize,
      ttl: cacheConfig.activity.ttl,
      debug: cacheConfig.activity.debug,
    });
  }

  /**
   * Get activity data from cache
   */
  getData(
    spaceId: number,
    recursive: boolean,
    period: number,
    periodMonths: number
  ): ActivityData | null {
    if (!this.enabled) {
      return null;
    }

    const cacheKey = generateCacheKey({ spaceId, recursive, period, periodMonths });
    return this.cache.get(cacheKey);
  }

  /**
   * Check if activity data is currently loading
   */
  isLoadingData(
    spaceId: number,
    recursive: boolean,
    period: number,
    periodMonths: number
  ): boolean {
    const cacheKey = generateCacheKey({ spaceId, recursive, period, periodMonths });
    return this.loadingKeys.has(cacheKey);
  }

  /**
   * Fetch and cache activity data
   */
  async fetchData(
    spaceId: number,
    recursive: boolean,
    period: number,
    periodMonths: number
  ): Promise<CachedActivityResult> {
    // Don't fetch if activity is disabled
    if (!clientConfig.value.activity) {
      return { data: null, fromCache: false };
    }

    const cacheKey = generateCacheKey({ spaceId, recursive, period, periodMonths });

    // Try to get from cache first
    if (this.enabled) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return { data: cached, fromCache: true };
      }
    }

    // Check if already loading
    if (this.loadingKeys.has(cacheKey)) {
      // Return null while loading, caller can check isLoadingData
      return { data: null, fromCache: false };
    }

    // Mark as loading
    this.loadingKeys.add(cacheKey);

    try {
      // Cache miss - fetch from API
      const data = await apiFetchActivityData(spaceId, recursive, period, periodMonths);

      // Store in cache
      if (data && this.enabled) {
        this.cache.set(cacheKey, data);
      }

      return { data, fromCache: false };
    } catch (err) {
      console.error(`Failed to fetch activity data for space ${spaceId}:`, err);
      return { data: null, fromCache: false };
    } finally {
      // Remove from loading
      this.loadingKeys.delete(cacheKey);
    }
  }

  /**
   * Get or fetch activity data (returns cached if available, fetches if not)
   */
  async getOrFetchData(
    spaceId: number,
    recursive: boolean,
    period: number,
    periodMonths: number
  ): Promise<ActivityData | null> {
    const cached = this.getData(spaceId, recursive, period, periodMonths);
    if (cached) {
      return cached;
    }

    const result = await this.fetchData(spaceId, recursive, period, periodMonths);
    return result.data;
  }

  /**
   * Invalidate activity data for a specific space
   */
  invalidateSpace(spaceId: number, includeRecursive = true): void {
    if (includeRecursive) {
      // Invalidate both flat and recursive views
      this.cache.invalidate(`activity:${spaceId}:*`);
    } else {
      // Only invalidate flat view
      this.cache.invalidate(`activity:${spaceId}:flat:*`);
    }
  }

  /**
   * Invalidate activity data for a specific space and period
   */
  invalidateSpacePeriod(
    spaceId: number,
    period: number,
    includeRecursive = true
  ): void {
    if (includeRecursive) {
      // Invalidate both flat and recursive views for this period
      this.cache.invalidate(`activity:${spaceId}:*:${period}:*`);
    } else {
      // Only invalidate flat view for this period
      this.cache.invalidate(`activity:${spaceId}:flat:${period}:*`);
    }
  }

  /**
   * Invalidate all recursive views
   * Useful when a change affects multiple spaces
   */
  invalidateRecursiveViews(): void {
    this.cache.invalidate(/activity:.*:recursive:.*/);
  }

  /**
   * Invalidate current period (period 0) for all spaces
   * Useful when new posts are created
   */
  invalidateCurrentPeriod(): void {
    this.cache.invalidate(/activity:.*:.*:0:.*/);
  }

  /**
   * Invalidate all cached activity data
   */
  invalidateAll(): void {
    this.cache.invalidate('activity:*');
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
    this.loadingKeys.clear();
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
export const activityCache = new ActivityCacheManager();

// Export convenience functions
export async function fetchActivityDataCached(
  spaceId: number,
  recursive: boolean,
  period: number,
  periodMonths: number = 4
): Promise<CachedActivityResult> {
  return activityCache.fetchData(spaceId, recursive, period, periodMonths);
}

export async function getOrFetchActivityData(
  spaceId: number,
  recursive: boolean,
  period: number,
  periodMonths: number = 4
): Promise<ActivityData | null> {
  return activityCache.getOrFetchData(spaceId, recursive, period, periodMonths);
}

export function getActivityData(
  spaceId: number,
  recursive: boolean,
  period: number,
  periodMonths: number
): ActivityData | null {
  return activityCache.getData(spaceId, recursive, period, periodMonths);
}

export function isLoadingActivityData(
  spaceId: number,
  recursive: boolean,
  period: number,
  periodMonths: number
): boolean {
  return activityCache.isLoadingData(spaceId, recursive, period, periodMonths);
}

export function invalidateActivityForSpace(spaceId: number): void {
  activityCache.invalidateSpace(spaceId);
}

export function invalidateAllActivity(): void {
  activityCache.invalidateAll();
}

export function invalidateCurrentActivityPeriod(): void {
  activityCache.invalidateCurrentPeriod();
}
