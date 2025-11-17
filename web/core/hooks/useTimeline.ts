/**
 * useTimeline Hook
 *
 * Centralized state and fetching logic for timeline posts.
 * This hook encapsulates all the complex logic for:
 * - Managing timeline posts state
 * - Fetching and caching posts data
 * - Handling recursive vs flat views
 * - Pagination and loading more posts
 * - Computing "has more" based on space post counts
 * - Loading states
 *
 * Themes can use this hook to render timeline components without duplicating logic.
 */

import { useEffect, useState } from 'preact/hooks';
import type { Space, Post } from '../api';
import {
  posts,
  resetPosts,
  appendPosts,
  isLoadingPosts,
} from '../state/posts';
import { getSpaceById, getTotalPostCount } from '../state/spaces';
import { fetchPostsCached } from '../cache/postsCache';
import { posts as postsConfig } from '../config';

export interface TimelineHookData {
  /** List of posts for the timeline */
  posts: Post[];
  /** Whether posts are currently loading */
  isLoading: boolean;
  /** Whether there are more posts to load */
  hasMore: boolean;
  /** Current offset for pagination */
  offset: number;
  /** Whether we're in recursive mode */
  isRecursive: boolean;
  /** Load more posts */
  loadMore: () => void;
  /** Reload timeline from beginning */
  reload: () => Promise<void>;
}

export interface UseTimelineOptions {
  /** Number of posts per page (default: from config) */
  postsPerPage?: number;
}

/**
 * Hook to get timeline posts data and pagination controls
 * @param spaceId - The current space ID (null for "All Spaces" view)
 * @param recursive - Whether to fetch posts recursively
 * @param options - Optional configuration
 * @returns Timeline data and controls
 */
export function useTimeline(
  spaceId: number | null,
  recursive = false,
  options: UseTimelineOptions = {}
): TimelineHookData {
  const limit = options.postsPerPage || postsConfig.postsPerPage;
  const [offset, setOffset] = useState(0);

  // Load posts when space or recursive mode changes
  useEffect(() => {
    loadPosts();
  }, [spaceId, recursive]);

  /**
   * Load posts from beginning (reset state)
   */
  const loadPosts = async () => {
    resetPosts();
    isLoadingPosts.value = true;
    setOffset(0);

    try {
      const result = await fetchPostsCached(spaceId, limit, 0, true, recursive);
      appendPosts(result.posts);
      setOffset(result.posts.length);

      if (result.fromCache) {
        console.log('[useTimeline] Loaded from cache');
      }
    } catch (error) {
      console.error('[useTimeline] Failed to fetch posts:', error);
    } finally {
      isLoadingPosts.value = false;
    }
  };

  /**
   * Load more posts (pagination)
   */
  const loadMore = () => {
    if (isLoadingPosts.value) return;

    isLoadingPosts.value = true;

    fetchPostsCached(spaceId, limit, offset, true, recursive)
      .then((result) => {
        appendPosts(result.posts);
        setOffset(offset + result.posts.length);

        if (result.fromCache) {
          console.log('[useTimeline] Loaded more from cache');
        }
      })
      .catch((error) => {
        console.error('[useTimeline] Failed to fetch more posts:', error);
      })
      .finally(() => {
        isLoadingPosts.value = false;
      });
  };

  /**
   * Determine if there are more posts using space post counts
   */
  const hasMore = (() => {
    if (spaceId === null) {
      // "All Spaces" view - use total post count across all spaces
      const totalPosts = getTotalPostCount();
      return posts.value.length < totalPosts;
    }

    const space = getSpaceById(spaceId);
    if (!space) return false;

    const totalPostsInSpace = recursive ? space.recursive_post_count : space.post_count;
    return posts.value.length < totalPostsInSpace;
  })();

  return {
    posts: posts.value,
    isLoading: isLoadingPosts.value,
    hasMore,
    offset,
    isRecursive: recursive,
    loadMore,
    reload: loadPosts,
  };
}

/**
 * Reset the timeline state to defaults
 * Useful when navigating away from timeline views
 */
export function resetTimeline(): void {
  resetPosts();
}
