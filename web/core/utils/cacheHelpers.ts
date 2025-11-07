/**
 * Cache Helper Utilities
 *
 * These helpers are separated to avoid circular dependencies between cache and state modules
 */

import type { Space } from '../api/spaces';
import { spaceStatsCache } from '../cache/spaceStatsCache';

/**
 * Invalidate space stats for an entire parent chain (space + all ancestors)
 * Used when changes affect recursive counts (e.g., post with rich content deleted/moved)
 *
 * @param spaceId - The space ID to start invalidation from
 * @param getSpaceById - Function to retrieve a space by ID (passed to avoid circular dependency)
 */
export function invalidateSpaceStatsForParentChain(
  spaceId: number,
  getSpaceById: (id: number) => Space | undefined
): void {
  let currentSpace = getSpaceById(spaceId);
  while (currentSpace) {
    // Invalidate both flat and recursive views for this space
    spaceStatsCache.invalidateSpace(currentSpace.id, true);

    if (currentSpace.parent_id !== null && currentSpace.parent_id !== undefined) {
      currentSpace = getSpaceById(currentSpace.parent_id);
    } else {
      break;
    }
  }
}
