import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mergeSpaceStatsOnMove, invalidateActivityOnMove } from '../cacheMergeUtils';
import { spaceStatsCache } from '../../spaceStatsCache';
import { activityCache } from '../../activityCache';
import type { SpaceStats } from '../../../api/spaces';

// Mock the state module with all required exports
vi.mock('../../../state/spaceStats', () => ({
  setSpaceStats: vi.fn(),
  clearAllSpaceStats: vi.fn(),
  clearSpaceStats: vi.fn(),
  getSpaceStats: vi.fn(() => null),
  isLoadingStats: vi.fn(() => false),
  setStatsLoading: vi.fn(),
}));

describe('cacheMergeUtils', () => {
  beforeEach(() => {
    // Clear all caches before each test
    spaceStatsCache.clear();
    activityCache.clear();
    vi.clearAllMocks();
  });

  describe('mergeSpaceStatsOnMove', () => {
    it('should subtract stats from old parent chain', () => {
      // Setup: Create a parent chain with cached stats
      const parent1Stats: SpaceStats = {
        space_id: 1,
        recursive: true,
        file_count: 100,
        total_size: 1000,
      };
      const parent2Stats: SpaceStats = {
        space_id: 2,
        recursive: true,
        file_count: 150,
        total_size: 1500,
      };

      // Manually set stats in cache
      spaceStatsCache['cache'].set('spaceStats:1:recursive', parent1Stats);
      spaceStatsCache['cache'].set('spaceStats:2:recursive', parent2Stats);

      // Mock getSpaceById to return parent chain: 2 -> 1 -> null
      const getSpaceById = vi.fn((id: number) => {
        if (id === 1) return { id: 1, parent_id: null };
        if (id === 2) return { id: 2, parent_id: 1 };
        return undefined;
      });

      // Move space 3 from under parent 2 (removing 20 files, 200 bytes)
      mergeSpaceStatsOnMove(
        3,
        2, // old parent
        null, // new parent (moving to root)
        { file_count: 20, total_size: 200 },
        getSpaceById
      );

      // Verify stats were decremented in old parent chain (read from cache directly)
      const updated2 = spaceStatsCache['cache'].get('spaceStats:2:recursive');
      const updated1 = spaceStatsCache['cache'].get('spaceStats:1:recursive');

      expect(updated2).toEqual({
        space_id: 2,
        recursive: true,
        file_count: 130, // 150 - 20
        total_size: 1300, // 1500 - 200
      });

      expect(updated1).toEqual({
        space_id: 1,
        recursive: true,
        file_count: 80, // 100 - 20
        total_size: 800, // 1000 - 200
      });
    });

    it('should add stats to new parent chain', () => {
      // Setup: Create a parent chain with cached stats
      const parent4Stats: SpaceStats = {
        space_id: 4,
        recursive: true,
        file_count: 50,
        total_size: 500,
      };
      const parent5Stats: SpaceStats = {
        space_id: 5,
        recursive: true,
        file_count: 80,
        total_size: 800,
      };

      spaceStatsCache['cache'].set('spaceStats:4:recursive', parent4Stats);
      spaceStatsCache['cache'].set('spaceStats:5:recursive', parent5Stats);

      // Mock getSpaceById to return parent chain: 5 -> 4 -> null
      const getSpaceById = vi.fn((id: number) => {
        if (id === 4) return { id: 4, parent_id: null };
        if (id === 5) return { id: 5, parent_id: 4 };
        return undefined;
      });

      // Move space 6 to under parent 5 (adding 15 files, 150 bytes)
      mergeSpaceStatsOnMove(
        6,
        null, // old parent (was root)
        5, // new parent
        { file_count: 15, total_size: 150 },
        getSpaceById
      );

      // Verify stats were incremented in new parent chain (read from cache directly)
      const updated5 = spaceStatsCache['cache'].get('spaceStats:5:recursive');
      const updated4 = spaceStatsCache['cache'].get('spaceStats:4:recursive');

      expect(updated5).toEqual({
        space_id: 5,
        recursive: true,
        file_count: 95, // 80 + 15
        total_size: 950, // 800 + 150
      });

      expect(updated4).toEqual({
        space_id: 4,
        recursive: true,
        file_count: 65, // 50 + 15
        total_size: 650, // 500 + 150
      });
    });

    it('should handle moving space between different parent chains', () => {
      // Setup: Two separate parent chains
      const oldParent1: SpaceStats = {
        space_id: 10,
        recursive: true,
        file_count: 200,
        total_size: 2000,
      };
      const oldParent2: SpaceStats = {
        space_id: 11,
        recursive: true,
        file_count: 300,
        total_size: 3000,
      };
      const newParent1: SpaceStats = {
        space_id: 20,
        recursive: true,
        file_count: 100,
        total_size: 1000,
      };
      const newParent2: SpaceStats = {
        space_id: 21,
        recursive: true,
        file_count: 150,
        total_size: 1500,
      };

      spaceStatsCache['cache'].set('spaceStats:10:recursive', oldParent1);
      spaceStatsCache['cache'].set('spaceStats:11:recursive', oldParent2);
      spaceStatsCache['cache'].set('spaceStats:20:recursive', newParent1);
      spaceStatsCache['cache'].set('spaceStats:21:recursive', newParent2);

      // Mock getSpaceById: 11 -> 10 -> null, 21 -> 20 -> null
      const getSpaceById = vi.fn((id: number) => {
        if (id === 10) return { id: 10, parent_id: null };
        if (id === 11) return { id: 11, parent_id: 10 };
        if (id === 20) return { id: 20, parent_id: null };
        if (id === 21) return { id: 21, parent_id: 20 };
        return undefined;
      });

      // Move space 12 from 11 to 21
      mergeSpaceStatsOnMove(
        12,
        11, // old parent
        21, // new parent
        { file_count: 25, total_size: 250 },
        getSpaceById
      );

      // Verify old parent chain was decremented (read from cache directly)
      expect(spaceStatsCache['cache'].get('spaceStats:11:recursive')).toEqual({
        space_id: 11,
        recursive: true,
        file_count: 275, // 300 - 25
        total_size: 2750, // 3000 - 250
      });
      expect(spaceStatsCache['cache'].get('spaceStats:10:recursive')).toEqual({
        space_id: 10,
        recursive: true,
        file_count: 175, // 200 - 25
        total_size: 1750, // 2000 - 250
      });

      // Verify new parent chain was incremented (read from cache directly)
      expect(spaceStatsCache['cache'].get('spaceStats:21:recursive')).toEqual({
        space_id: 21,
        recursive: true,
        file_count: 175, // 150 + 25
        total_size: 1750, // 1500 + 250
      });
      expect(spaceStatsCache['cache'].get('spaceStats:20:recursive')).toEqual({
        space_id: 20,
        recursive: true,
        file_count: 125, // 100 + 25
        total_size: 1250, // 1000 + 250
      });
    });

    it('should not crash if parent stats are not cached', () => {
      // No cached stats for parents
      const getSpaceById = vi.fn((id: number) => {
        if (id === 1) return { id: 1, parent_id: null };
        if (id === 2) return { id: 2, parent_id: 1 };
        return undefined;
      });

      // Should not throw
      expect(() => {
        mergeSpaceStatsOnMove(
          3,
          2,
          null,
          { file_count: 10, total_size: 100 },
          getSpaceById
        );
      }).not.toThrow();

      // Stats should still be empty (no merge happened - read from cache directly)
      expect(spaceStatsCache['cache'].get('spaceStats:2:recursive')).toBeFalsy();
      expect(spaceStatsCache['cache'].get('spaceStats:1:recursive')).toBeFalsy();
    });

    it('should prevent negative stats after subtraction', () => {
      // Setup with low stats
      const parentStats: SpaceStats = {
        space_id: 1,
        recursive: true,
        file_count: 10,
        total_size: 100,
      };

      spaceStatsCache['cache'].set('spaceStats:1:recursive', parentStats);

      const getSpaceById = vi.fn((id: number) => {
        if (id === 1) return { id: 1, parent_id: null };
        return undefined;
      });

      // Try to subtract more than available
      mergeSpaceStatsOnMove(
        2,
        1,
        null,
        { file_count: 20, total_size: 200 }, // More than parent has
        getSpaceById
      );

      // Should clamp to 0 (read from cache directly)
      const updated = spaceStatsCache['cache'].get('spaceStats:1:recursive');
      expect(updated).toEqual({
        space_id: 1,
        recursive: true,
        file_count: 0, // Math.max(0, 10 - 20)
        total_size: 0, // Math.max(0, 100 - 200)
      });
    });

    it('should only affect recursive views, not flat views', () => {
      // Setup both flat and recursive stats
      const flatStats: SpaceStats = {
        space_id: 1,
        recursive: false,
        file_count: 50,
        total_size: 500,
      };
      const recursiveStats: SpaceStats = {
        space_id: 1,
        recursive: true,
        file_count: 100,
        total_size: 1000,
      };

      spaceStatsCache['cache'].set('spaceStats:1:flat', flatStats);
      spaceStatsCache['cache'].set('spaceStats:1:recursive', recursiveStats);

      const getSpaceById = vi.fn((id: number) => {
        if (id === 1) return { id: 1, parent_id: null };
        return undefined;
      });

      mergeSpaceStatsOnMove(
        2,
        1,
        null,
        { file_count: 20, total_size: 200 },
        getSpaceById
      );

      // Flat view should be unchanged (read from cache directly)
      expect(spaceStatsCache['cache'].get('spaceStats:1:flat')).toEqual(flatStats);

      // Recursive view should be updated (read from cache directly)
      expect(spaceStatsCache['cache'].get('spaceStats:1:recursive')).toEqual({
        space_id: 1,
        recursive: true,
        file_count: 80,
        total_size: 800,
      });
    });
  });

  describe('invalidateActivityOnMove', () => {
    beforeEach(() => {
      // Setup some activity cache entries
      const mockActivity = {
        days: [],
        start_date: '2025-01-01',
        end_date: '2025-12-31',
        stats: { total_posts: 0, active_days: 0, max_day_activity: 0 },
        max_periods: 12,
      };

      // Create various cache entries for different spaces and views
      activityCache['cache'].set('activity:1:flat:0:4m', mockActivity);
      activityCache['cache'].set('activity:1:recursive:0:4m', mockActivity);
      activityCache['cache'].set('activity:2:flat:0:4m', mockActivity);
      activityCache['cache'].set('activity:2:recursive:0:4m', mockActivity);
      activityCache['cache'].set('activity:3:flat:0:4m', mockActivity);
      activityCache['cache'].set('activity:3:recursive:0:4m', mockActivity);
      activityCache['cache'].set('activity:0:recursive:0:4m', mockActivity);
    });

    it('should invalidate recursive views for old parent chain', () => {
      const getSpaceById = vi.fn((id: number) => {
        if (id === 1) return { id: 1, parent_id: null };
        if (id === 2) return { id: 2, parent_id: 1 };
        return undefined;
      });

      invalidateActivityOnMove(2, null, getSpaceById);

      // Old parent chain recursive views should be invalidated (check cache directly)
      expect(activityCache['cache'].get('activity:2:recursive:0:4m')).toBeFalsy();
      expect(activityCache['cache'].get('activity:1:recursive:0:4m')).toBeFalsy();

      // Flat views should remain (check cache directly)
      expect(activityCache['cache'].get('activity:2:flat:0:4m')).toBeTruthy();
      expect(activityCache['cache'].get('activity:1:flat:0:4m')).toBeTruthy();
    });

    it('should invalidate recursive views for new parent chain', () => {
      const getSpaceById = vi.fn((id: number) => {
        if (id === 2) return { id: 2, parent_id: null };
        if (id === 3) return { id: 3, parent_id: 2 };
        return undefined;
      });

      invalidateActivityOnMove(null, 3, getSpaceById);

      // New parent chain recursive views should be invalidated (check cache directly)
      expect(activityCache['cache'].get('activity:3:recursive:0:4m')).toBeFalsy();
      expect(activityCache['cache'].get('activity:2:recursive:0:4m')).toBeFalsy();

      // Flat views should remain (check cache directly)
      expect(activityCache['cache'].get('activity:3:flat:0:4m')).toBeTruthy();
      expect(activityCache['cache'].get('activity:2:flat:0:4m')).toBeTruthy();
    });

    it('should invalidate both old and new parent chains', () => {
      const getSpaceById = vi.fn((id: number) => {
        if (id === 1) return { id: 1, parent_id: null };
        if (id === 2) return { id: 2, parent_id: 1 };
        if (id === 3) return { id: 3, parent_id: null };
        return undefined;
      });

      // Move from parent 2 to parent 3
      invalidateActivityOnMove(2, 3, getSpaceById);

      // Both chains' recursive views should be invalidated (check cache directly)
      expect(activityCache['cache'].get('activity:2:recursive:0:4m')).toBeFalsy();
      expect(activityCache['cache'].get('activity:1:recursive:0:4m')).toBeFalsy();
      expect(activityCache['cache'].get('activity:3:recursive:0:4m')).toBeFalsy();

      // All flat views should remain (check cache directly)
      expect(activityCache['cache'].get('activity:1:flat:0:4m')).toBeTruthy();
      expect(activityCache['cache'].get('activity:2:flat:0:4m')).toBeTruthy();
      expect(activityCache['cache'].get('activity:3:flat:0:4m')).toBeTruthy();
    });

    it('should invalidate "All Spaces" (spaceId=0) recursive view', () => {
      const getSpaceById = vi.fn((id: number) => {
        if (id === 1) return { id: 1, parent_id: null };
        return undefined;
      });

      invalidateActivityOnMove(1, null, getSpaceById);

      // "All Spaces" recursive view should be invalidated
      expect(activityCache.getData(0, true, 0, 4)).toBeNull();
    });

    it('should handle null parent IDs gracefully', () => {
      const getSpaceById = vi.fn((id: number) => {
        if (id === 1) return { id: 1, parent_id: null };
        return undefined;
      });

      // Moving from root to root (no parents)
      expect(() => {
        invalidateActivityOnMove(null, null, getSpaceById);
      }).not.toThrow();

      // Moving from parent to root
      expect(() => {
        invalidateActivityOnMove(1, null, getSpaceById);
      }).not.toThrow();

      // Moving from root to parent
      expect(() => {
        invalidateActivityOnMove(null, 1, getSpaceById);
      }).not.toThrow();
    });

    it('should traverse full parent chain to root', () => {
      const getSpaceById = vi.fn((id: number) => {
        if (id === 1) return { id: 1, parent_id: null };
        if (id === 2) return { id: 2, parent_id: 1 };
        if (id === 3) return { id: 3, parent_id: 2 };
        if (id === 4) return { id: 4, parent_id: 3 };
        return undefined;
      });

      // Setup deep hierarchy caches
      const mockActivity = {
        days: [],
        start_date: '2025-01-01',
        end_date: '2025-12-31',
        stats: { total_posts: 0, active_days: 0, max_day_activity: 0 },
        max_periods: 12,
      };
      activityCache['cache'].set('activity:4:recursive:0:4m', mockActivity);

      invalidateActivityOnMove(4, null, getSpaceById);

      // Should have traversed entire chain: 4 -> 3 -> 2 -> 1 -> null
      expect(getSpaceById).toHaveBeenCalledWith(4);
      expect(getSpaceById).toHaveBeenCalledWith(3);
      expect(getSpaceById).toHaveBeenCalledWith(2);
      expect(getSpaceById).toHaveBeenCalledWith(1);
    });
  });
});
