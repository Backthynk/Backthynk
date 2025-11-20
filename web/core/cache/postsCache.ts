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
  // FUTURE: Uncomment when implementing filtered queries
  // hasLinks?: boolean;
  // hasAttachments?: boolean;
}

export interface CachedPostsResult extends PostsResponse {
  fromCache: boolean;
}

/**
 * Generate a cache key from query parameters
 * Cache includes pagination (offset/limit) unlike state keys
 */
function generateCacheKey(params: PostsCacheKey): string {
  const { spaceId, recursive, offset, limit } = params;
  // FUTURE: When adding hasLinks/hasAttachments, update the key:
  // const linkFilter = hasLinks ? ':links' : '';
  // const attachFilter = hasAttachments ? ':attach' : '';
  // return `posts:${spaceId ?? 'all'}:${recursive ? 'recursive' : 'flat'}${linkFilter}${attachFilter}:${offset}:${limit}`;
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
    limit: number = postsConfig.postsPerPage,
    offset: number = 0,
    withMeta: boolean = true,
    recursive: boolean = false
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
   * Remove a post from all cache entries
   * Used when deleting a post - updates cache instead of invalidating
   */
  removePostFromCache(postId: number): void {
    const allEntries = this.cache.entries();

    for (const [key, data] of allEntries) {
      const filteredPosts = data.posts.filter((p: any) => p.id !== postId);

      // Only update if post was actually removed
      if (filteredPosts.length !== data.posts.length) {
        this.cache.set(key, {
          ...data,
          posts: filteredPosts,
        });
      }
    }
  }

  /**
   * Update a post in all cache entries
   * Used when updating post data - updates cache instead of invalidating
   */
  updatePostInCache(updatedPost: { id: number; [key: string]: any }): void {
    const allEntries = this.cache.entries();

    for (const [key, data] of allEntries) {
      const updatedPosts = data.posts.map((p: any) =>
        p.id === updatedPost.id ? { ...p, ...updatedPost } : p
      );

      // Only update if post was found
      const hasPost = data.posts.some((p: any) => p.id === updatedPost.id);
      if (hasPost) {
        this.cache.set(key, {
          ...data,
          posts: updatedPosts,
        });
      }
    }
  }

  /**
   * Add a post to cache entries for a specific space
   * Smart logic: only add if the post should appear in chronological order
   *
   * @param post - The post to add
   * @param spaceId - The space ID to add the post to
   * @param recursive - Whether to add to recursive views as well
   * @param postsPerPage - Max posts per page (to check if cache is full)
   */
  addPostToCache(
    post: { id: number; created: number; [key: string]: any },
    spaceId: number,
    recursive: boolean,
    postsPerPage: number
  ): void {
    const allEntries = this.cache.entries();

    for (const [key, data] of allEntries) {
      // Parse the cache key to determine if this entry is relevant
      // Format: posts:${spaceId}:${recursive ? 'recursive' : 'flat'}:${offset}:${limit}
      const parts = key.split(':');
      if (parts.length < 5 || parts[0] !== 'posts') continue;

      const cacheSpaceId = parts[1] === 'all' ? null : parseInt(parts[1], 10);
      const cacheRecursive = parts[2] === 'recursive';

      // Determine if this cache entry should contain this post
      let shouldInclude = false;

      if (cacheSpaceId === null) {
        // "All Spaces" view - always include if conditions are met
        shouldInclude = true;
      } else if (cacheSpaceId === spaceId) {
        // Direct space match - include for both flat and recursive
        shouldInclude = true;
      } else if (cacheRecursive && recursive) {
        // TODO: Check if cacheSpaceId is a parent of spaceId
        // For now, skip this complex check - recursive parent chain updates
        // will be naturally fetched on next load
        continue;
      } else {
        continue;
      }

      if (!shouldInclude) continue;

      // Check if we should add the post to this cache entry
      const currentPosts = data.posts;
      const isFull = currentPosts.length >= postsPerPage;
      const hasMore = data.hasMore ?? true;

      // Get the last (oldest) post in the current cache
      const lastPost = currentPosts.length > 0 ? currentPosts[currentPosts.length - 1] : null;
      const isNewerThanLast = !lastPost || post.created > lastPost.created;

      // Add post only if:
      // 1. Cache is not full, OR
      // 2. Post is newer than the last post, OR
      // 3. We've fetched all posts (no more to fetch)
      if (!isFull || isNewerThanLast || !hasMore) {
        // Insert post in chronological order (newest first)
        const newPosts = [...currentPosts, post].sort((a, b) => b.created - a.created);

        this.cache.set(key, {
          ...data,
          posts: newPosts,
        });
      }
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
  limit: number = postsConfig.postsPerPage,
  offset: number = 0,
  withMeta: boolean = true,
  recursive: boolean = false
): Promise<CachedPostsResult> {
  return postsCache.fetchPosts(spaceId, limit, offset, withMeta, recursive);
}
