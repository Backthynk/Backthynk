/**
 * Cache Merge Utilities
 *
 * Smart cache merging for space hierarchy changes.
 * Instead of invalidating caches when a space moves, we merge the data
 * from the old parent chain into the new parent chain.
 */

import { spaceStatsCache } from '../spaceStatsCache';
import { activityCache } from '../activityCache';
import type { SpaceStats } from '../../api/spaces';
import type { ActivityData } from '../../api/activity';
import { setSpaceStats } from '../../state/spaceStats';

/**
 * Merge space stats when a space moves from one parent to another
 *
 * Strategy:
 * - Old parent chain: Subtract the moved space's stats
 * - New parent chain: Add the moved space's stats
 * - If cache entry doesn't exist for a parent, skip (will be fetched on demand)
 *
 * @param spaceId - The space being moved
 * @param oldParentId - Previous parent ID (can be null for root)
 * @param newParentId - New parent ID (can be null for root)
 * @param spaceStats - The stats of the space being moved (for recursive calculations)
 * @param getSpaceById - Function to get space by ID for traversing parent chain
 */
export function mergeSpaceStatsOnMove(
  spaceId: number,
  oldParentId: number | null,
  newParentId: number | null,
  spaceStats: { file_count: number; total_size: number },
  getSpaceById: (id: number) => { id: number; parent_id: number | null } | undefined
): void {
  // Only process recursive views since flat views don't change
  // when a child space moves

  // Process old parent chain - SUBTRACT the moved space's contribution
  if (oldParentId !== null && oldParentId !== undefined) {
    let currentParentId: number | null = oldParentId;

    while (currentParentId !== null) {
      // Read directly from cache, not from reactive state
      const cacheKey = `spaceStats:${currentParentId}:recursive`;
      const cached = spaceStatsCache['cache'].get(cacheKey);

      if (cached) {
        // Create updated stats by subtracting the moved space's contribution
        const updatedStats: SpaceStats = {
          ...cached,
          file_count: Math.max(0, cached.file_count - spaceStats.file_count),
          total_size: Math.max(0, cached.total_size - spaceStats.total_size),
        };

        // Update the cache entry with new stats
        spaceStatsCache['cache'].set(cacheKey, updatedStats);

        // Also update reactive state
        setSpaceStats(currentParentId, true, updatedStats);
      }

      // Move to next parent
      const currentParent = getSpaceById(currentParentId);
      currentParentId = currentParent?.parent_id ?? null;
    }
  }

  // Process new parent chain - ADD the moved space's contribution
  if (newParentId !== null && newParentId !== undefined) {
    let currentParentId: number | null = newParentId;

    while (currentParentId !== null) {
      // Read directly from cache, not from reactive state
      const cacheKey = `spaceStats:${currentParentId}:recursive`;
      const cached = spaceStatsCache['cache'].get(cacheKey);

      if (cached) {
        // Create updated stats by adding the moved space's contribution
        const updatedStats: SpaceStats = {
          ...cached,
          file_count: cached.file_count + spaceStats.file_count,
          total_size: cached.total_size + spaceStats.total_size,
        };

        // Update the cache entry with new stats
        spaceStatsCache['cache'].set(cacheKey, updatedStats);

        // Also update reactive state
        setSpaceStats(currentParentId, true, updatedStats);
      }

      // Move to next parent
      const currentParent = getSpaceById(currentParentId);
      currentParentId = currentParent?.parent_id ?? null;
    }
  }
}

/**
 * Merge activity cache when a space moves from one parent to another
 *
 * This is more complex than stats because activity data has:
 * - Per-day counts
 * - Multiple period configurations
 * - Aggregated statistics
 *
 * Strategy:
 * - We can't reliably merge activity data because:
 *   1. Different spaces might have different activity patterns per day
 *   2. We don't know which posts belong to which space in the aggregated data
 *   3. The stats (max_day_activity, active_days) are computed across all data
 * - Instead, we selectively invalidate:
 *   1. KEEP flat views (space's own activity doesn't change)
 *   2. INVALIDATE recursive views for both parent chains
 *
 * @param oldParentId - Previous parent ID (can be null for root)
 * @param newParentId - New parent ID (can be null for root)
 * @param getSpaceById - Function to get space by ID for traversing parent chain
 */
export function invalidateActivityOnMove(
  oldParentId: number | null,
  newParentId: number | null,
  getSpaceById: (id: number) => { id: number; parent_id: number | null } | undefined
): void {
  // Invalidate recursive views for old parent chain
  if (oldParentId !== null && oldParentId !== undefined) {
    let currentParentId: number | null = oldParentId;

    while (currentParentId !== null) {
      // Only invalidate recursive views (not flat views)
      // Use the cache directly to invalidate only recursive views
      activityCache['cache'].invalidate(`activity:${currentParentId}:recursive:*`);

      // Move to next parent
      const currentParent = getSpaceById(currentParentId);
      currentParentId = currentParent?.parent_id ?? null;
    }
  }

  // Invalidate recursive views for new parent chain
  if (newParentId !== null && newParentId !== undefined) {
    let currentParentId: number | null = newParentId;

    while (currentParentId !== null) {
      // Only invalidate recursive views (not flat views)
      // Use the cache directly to invalidate only recursive views
      activityCache['cache'].invalidate(`activity:${currentParentId}:recursive:*`);

      // Move to next parent
      const currentParent = getSpaceById(currentParentId);
      currentParentId = currentParent?.parent_id ?? null;
    }
  }

  // Also invalidate "All Spaces" (spaceId=0) recursive view
  activityCache['cache'].invalidate('activity:0:recursive:*');
}

/**
 * Handle cache updates when only space metadata changes (name/description)
 * No cache invalidation needed - just update the space object in state
 */
export function handleMetadataOnlyUpdate(): void {
  // No cache invalidation needed for metadata-only updates
  // The space stats and activity data remain the same
  // Only the space object itself in state is updated (handled by caller)
}
