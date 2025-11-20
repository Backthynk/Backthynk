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

import { useEffect } from 'preact/hooks';
import { useComputed } from '@preact/signals';
import type { Post } from '../api';
import {
  type PostsQuery,
  getPostsForQuery,
  resetPostsForQuery,
  appendPostsToQuery,
  isLoadingQuery,
  setLoadingForQuery,
  getOffsetForQuery,
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
 *
 * FUTURE: When adding hasLinks/hasAttachments filters, add them as parameters here
 * and include them in the query object
 */
export function useTimeline(
  spaceId: number | null,
  recursive = false,
  options: UseTimelineOptions = {}
): TimelineHookData {
  const limit = options.postsPerPage || postsConfig.postsPerPage;

  // Helper to get current query - always returns fresh query based on current props
  // FUTURE: Add hasLinks and hasAttachments to this query object
  const getQuery = (): PostsQuery => ({
    spaceId,
    recursive,
    // FUTURE: Uncomment when implementing filters
    // hasLinks: options.hasLinks,
    // hasAttachments: options.hasAttachments,
  });

  // Use computed to reactively get posts for this specific query
  const queryPosts = useComputed(() => getPostsForQuery(getQuery()));
  const queryLoading = useComputed(() => isLoadingQuery(getQuery()));
  const queryOffset = useComputed(() => getOffsetForQuery(getQuery()));

  // Load posts when space or recursive mode changes
  useEffect(() => {
    loadPosts();
  }, [spaceId, recursive]);

  /**
   * Load posts from beginning (reset state)
   */
  const loadPosts = async () => {
    const query = getQuery();
    resetPostsForQuery(query);
    setLoadingForQuery(query, true);

    try {
      const result = await fetchPostsCached(spaceId, limit, 0, true, recursive);
      appendPostsToQuery(query, result.posts);

      if (result.fromCache) {
        console.log('[useTimeline] Loaded from cache');
      }
    } catch (error) {
      console.error('[useTimeline] Failed to fetch posts:', error);
    } finally {
      setLoadingForQuery(query, false);
    }
  };

  /**
   * Load more posts (pagination)
   */
  const loadMore = () => {
    const query = getQuery();
    if (isLoadingQuery(query)) return;

    setLoadingForQuery(query, true);

    const currentOffset = getOffsetForQuery(query);

    fetchPostsCached(spaceId, limit, currentOffset, true, recursive)
      .then((result) => {
        appendPostsToQuery(query, result.posts);

        if (result.fromCache) {
          console.log('[useTimeline] Loaded more from cache');
        }
      })
      .catch((error) => {
        console.error('[useTimeline] Failed to fetch more posts:', error);
      })
      .finally(() => {
        setLoadingForQuery(query, false);
      });
  };

  /**
   * Determine if there are more posts using space post counts
   */
  const hasMore = (() => {
    const currentPosts = getPostsForQuery(getQuery());

    if (spaceId === null) {
      // "All Spaces" view - use total post count across all spaces
      const totalPosts = getTotalPostCount();
      return currentPosts.length < totalPosts;
    }

    const space = getSpaceById(spaceId);
    if (!space) return false;

    const totalPostsInSpace = recursive ? space.recursive_post_count : space.post_count;
    return currentPosts.length < totalPostsInSpace;
  })();

  return {
    posts: queryPosts.value,
    isLoading: queryLoading.value,
    hasMore,
    offset: queryOffset.value,
    isRecursive: recursive,
    loadMore,
    reload: loadPosts,
  };
}

/**
 * Reset the timeline state to defaults
 * Useful when navigating away from timeline views
 */
export function resetTimeline(spaceId: number | null, recursive = false): void {
  // FUTURE: When adding hasLinks/hasAttachments, pass them here too
  const query: PostsQuery = { spaceId, recursive };
  resetPostsForQuery(query);
}
