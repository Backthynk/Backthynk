/**
 * Posts Cache Layer
 *
 * Intelligent caching for posts with:
 * - Space-aware cache keys
 * - Pagination support
 * - Recursive view handling
 * - Smart invalidation
 */

import { createCache, type CacheManager } from './index';
import { fetchPosts as apiFetchPosts, type PostsResponse } from '../api/posts';
import { posts as postsConfig, cache as cacheConfig } from '../config';

export interface PostsCacheKey {
  spaceId: number | null;
  recursive: boolean;
  offset: number;
  limit: number;
}

export interface CachedPostsResult extends PostsResponse {
  fromCache: boolean;
}

/**
 * Generate a cache key from query parameters
 */
function generateCacheKey(params: PostsCacheKey): string {
  const { spaceId, recursive, offset, limit } = params;
  return `posts:${spaceId ?? 'all'}:${recursive ? 'recursive' : 'flat'}:${offset}:${limit}`;
}

/**
 * Posts cache manager singleton
 */
class PostsCacheManager {
  private cache: CacheManager<PostsResponse>;
  private enabled = true;

  constructor() {
    // Initialize with config values
    this.cache = createCache<PostsResponse>({
      maxSize: cacheConfig.posts.maxSize,
      ttl: cacheConfig.posts.ttl,
      debug: cacheConfig.posts.debug,
    });
  }

  /**
   * Fetch posts with caching
   */
  async fetchPosts(
    spaceId: number | null,
    limit = postsConfig.postsPerPage,
    offset = 0,
    withMeta = true,
    recursive = false
  ): Promise<CachedPostsResult> {
    const cacheKey = generateCacheKey({ spaceId, recursive, offset, limit });

    // Try to get from cache first
    if (this.enabled) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return { ...cached, fromCache: true };
      }
    }

    // Cache miss - fetch from API
    const result = await apiFetchPosts(spaceId, limit, offset, withMeta, recursive);

    // Store in cache
    if (this.enabled) {
      this.cache.set(cacheKey, result);
    }

    return { ...result, fromCache: false };
  }

  /**
   * Invalidate cache for a specific space
   * Examples:
   * - invalidateSpace(5) -> invalidates all queries for space 5
   * - invalidateSpace(5, true) -> invalidates space 5 and all recursive queries
   */
  invalidateSpace(spaceId: number | null, includeRecursive = true): void {
    const spaceStr = spaceId === null ? 'all' : spaceId.toString();

    if (includeRecursive) {
      // Invalidate both flat and recursive views
      this.cache.invalidate(`posts:${spaceStr}:*`);
    } else {
      // Only invalidate flat view
      this.cache.invalidate(`posts:${spaceStr}:flat:*`);
    }
  }

  /**
   * Invalidate all recursive views that might include this space
   * Useful when a post is deleted/moved in a space
   */
  invalidateRecursiveViews(): void {
    this.cache.invalidate(/posts:.*:recursive:.*/);
  }

  /**
   * Invalidate all posts cache
   */
  invalidateAll(): void {
    this.cache.invalidate('posts:*');
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
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
    return this.cache.stats();
  }

  /**
   * Configure cache parameters
   */
  configure(config: { maxSize?: number; ttl?: number; debug?: boolean }): void {
    this.cache.configure(config);
  }
}

// Export singleton instance
export const postsCache = new PostsCacheManager();

// Export convenience function
export async function fetchPostsCached(
  spaceId: number | null,
  limit?: number,
  offset?: number,
  withMeta?: boolean,
  recursive?: boolean
): Promise<CachedPostsResult> {
  return postsCache.fetchPosts(spaceId, limit, offset, withMeta, recursive);
}
