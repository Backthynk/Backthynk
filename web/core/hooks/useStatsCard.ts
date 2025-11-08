/**
 * useStatsCard Hook
 *
 * Centralized state and fetching logic for space statistics cards.
 * This hook encapsulates all the complex logic for:
 * - Computing post counts (total vs space-specific, recursive vs flat)
 * - Computing subspace counts (root vs children vs descendants)
 * - Fetching and managing file statistics
 * - Loading states
 *
 * Themes can use this hook to render stats cards without duplicating logic.
 */

import { computed } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { Space } from '../api';
import {
  getTotalPostCount,
  getSpacePostCount,
  getOrFetchSpaceStats,
  getSpaceStats,
  isLoadingStats,
  isRecursiveMode,
  getChildSpaces,
  getDescendantSpaceIds,
  rootSpaces
} from '../state';
import { clientConfig } from '../state/settings';

export interface StatsCardData {
  /** Number of posts (respects recursive mode) */
  postCount: number;
  /** Number of subspaces (respects recursive mode) */
  subspaceCount: number;
  /** Number of files attached to posts */
  fileCount: number;
  /** Total size of files in bytes */
  fileSize: number;
  /** Whether we're in recursive mode */
  isRecursive: boolean;
  /** Whether stats are currently loading */
  isLoading: boolean;
  /** Whether the card should be shown (has data) */
  shouldShow: boolean;
}

/**
 * Hook to get stats card data and handle fetching logic
 * @param space - The current space (null for "All Spaces" view)
 * @returns Computed stats card data
 */
export function useStatsCard(space: Space | null): StatsCardData {
  const spaceStatsEnabled = clientConfig.value.space_stats;

  // Calculate post count
  const postCount = computed(() => {
    if (!space) {
      return getTotalPostCount();
    }
    return getSpacePostCount(space);
  });

  // Calculate subspace count
  const subspaceCount = computed(() => {
    if (!space) {
      // When no space is selected, show count of root spaces
      return rootSpaces.value.length;
    }

    // When recursive mode is enabled, count all descendants recursively
    if (isRecursiveMode(space.id)) {
      const descendantIds = getDescendantSpaceIds(space.id);
      return descendantIds.length;
    }

    // Otherwise, count only direct children
    const directChildren = getChildSpaces(space.id);
    return directChildren.length;
  });

  // Stats fetching is handled in the selectSpace action to prevent data blink
  // The action pre-fetches stats BEFORE changing space, setting loading state synchronously
  // We still need to handle recursive mode changes here and initial load for "All Spaces"
  useEffect(() => {
    if (!spaceStatsEnabled || postCount.value === 0) {
      return;
    }

    // Only fetch on recursive mode change (not on space change)
    // Space change is handled by selectSpace action
    if (space) {
      const recursive = isRecursiveMode(space.id);
      getOrFetchSpaceStats(space.id, recursive);
    } else {
      // For "All Spaces" view (space = null), fetch global stats (spaceId = 0)
      getOrFetchSpaceStats(0, false);
    }
  }, [space ? isRecursiveMode(space.id) : false, postCount.value, spaceStatsEnabled]);

  // Get file stats
  const fileStats = computed(() => {
    // Return 0s if stats disabled or no posts (don't fetch)
    if (!spaceStatsEnabled || postCount.value === 0) {
      return {
        count: 0,
        size: 0,
      };
    }

    const spaceStatsData = !space
      ? getSpaceStats(0, false)
      : getSpaceStats(space.id, isRecursiveMode(space.id));

    return {
      count: spaceStatsData?.file_count || 0,
      size: spaceStatsData?.total_size || 0,
    };
  });

  const isRecursive = !!(space && isRecursiveMode(space.id));

  const loading = computed(() => {
    // Don't show loading if stats disabled or no posts
    if (!spaceStatsEnabled || postCount.value === 0) {
      return false;
    }

    const spaceId = space?.id || 0;
    const recursive = !space ? false : isRecursiveMode(space?.id || 0);
    const isLoading = isLoadingStats(spaceId, recursive);
    const hasStats = getSpaceStats(spaceId, recursive);
    // Show loading if actively loading OR if we have no stats yet
    return isLoading || !hasStats;
  });

  // Determine if the card should be shown
  const shouldShow = computed(() => {
    // Don't show if stats are disabled
    if (!spaceStatsEnabled) {
      return false;
    }
    // Don't show if there are no posts or subspaces
    return postCount.value > 0 || subspaceCount.value > 0;
  });

  return {
    postCount: postCount.value,
    subspaceCount: subspaceCount.value,
    fileCount: fileStats.value.count,
    fileSize: fileStats.value.size,
    isRecursive,
    isLoading: loading.value,
    shouldShow: shouldShow.value,
  };
}
