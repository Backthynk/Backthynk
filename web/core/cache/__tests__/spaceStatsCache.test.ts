/**
 * Tests for Space Stats Cache
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { spaceStatsCache } from '../spaceStatsCache';
import { invalidateSpaceStatsForParentChain } from '../../utils/cacheHelpers';
import { createMockSpaceStats, createMockSpace, resetFactoryCounters } from '../../__tests__/factories';
import { spaces as spacesSignal } from '../../state/spaces';

// Mock the spaces state
vi.mock('../../state/spaces', async () => {
  const actual = await vi.importActual('../../state/spaces');
  return {
    ...actual,
    getSpaceById: (id: number) => spacesSignal.value.find(s => s.id === id),
  };
});

describe('Space Stats Cache', () => {
  beforeEach(() => {
    spaceStatsCache.clear();
    spacesSignal.value = [];
    resetFactoryCounters();
  });

  describe('Basic Cache Operations', () => {
    it('should store and retrieve stats', async () => {
      const stats = createMockSpaceStats({ total_files: 10 });
      const cacheKey = 'spaceStats:1:flat';

      // Manually set in cache
      spaceStatsCache['cache'].set(cacheKey, stats);

      // Should retrieve from cache
      const retrieved = spaceStatsCache.getStats(1, false);
      expect(retrieved).toEqual(stats);
    });

    it('should return null for cache miss', () => {
      const retrieved = spaceStatsCache.getStats(999, false);
      expect(retrieved).toBeNull();
    });

    it('should differentiate between flat and recursive views', async () => {
      const flatStats = createMockSpaceStats({ total_files: 5 });
      const recursiveStats = createMockSpaceStats({ total_files: 15 });

      spaceStatsCache['cache'].set('spaceStats:1:flat', flatStats);
      spaceStatsCache['cache'].set('spaceStats:1:recursive', recursiveStats);

      expect(spaceStatsCache.getStats(1, false)).toEqual(flatStats);
      expect(spaceStatsCache.getStats(1, true)).toEqual(recursiveStats);
    });
  });

  describe('Invalidation', () => {
    beforeEach(() => {
      // Setup some cached data
      spaceStatsCache['cache'].set('spaceStats:1:flat', createMockSpaceStats({ total_files: 5 }));
      spaceStatsCache['cache'].set('spaceStats:1:recursive', createMockSpaceStats({ total_files: 10 }));
      spaceStatsCache['cache'].set('spaceStats:2:flat', createMockSpaceStats({ total_files: 3 }));
      spaceStatsCache['cache'].set('spaceStats:2:recursive', createMockSpaceStats({ total_files: 7 }));
    });

    it('should invalidate both flat and recursive views', () => {
      spaceStatsCache.invalidateSpace(1, true);

      expect(spaceStatsCache.getStats(1, false)).toBeNull();
      expect(spaceStatsCache.getStats(1, true)).toBeNull();
      expect(spaceStatsCache.getStats(2, false)).not.toBeNull();
    });

    it('should invalidate only flat view', () => {
      spaceStatsCache.invalidateSpace(1, false);

      expect(spaceStatsCache.getStats(1, false)).toBeNull();
      expect(spaceStatsCache.getStats(1, true)).not.toBeNull();
    });

    it('should invalidate all stats', () => {
      spaceStatsCache.invalidateAll();

      expect(spaceStatsCache.getStats(1, false)).toBeNull();
      expect(spaceStatsCache.getStats(1, true)).toBeNull();
      expect(spaceStatsCache.getStats(2, false)).toBeNull();
      expect(spaceStatsCache.getStats(2, true)).toBeNull();
    });
  });

  describe('invalidateSpaceStatsForParentChain', () => {
    beforeEach(() => {
      // Create a space hierarchy: 1 -> 2 -> 3 -> 4
      const space1 = createMockSpace({ id: 1, parent_id: null });
      const space2 = createMockSpace({ id: 2, parent_id: 1 });
      const space3 = createMockSpace({ id: 3, parent_id: 2 });
      const space4 = createMockSpace({ id: 4, parent_id: 3 });

      spacesSignal.value = [space1, space2, space3, space4];

      // Cache stats for all spaces
      [1, 2, 3, 4].forEach(id => {
        spaceStatsCache['cache'].set(`spaceStats:${id}:flat`, createMockSpaceStats());
        spaceStatsCache['cache'].set(`spaceStats:${id}:recursive`, createMockSpaceStats());
      });
    });

    it('should invalidate entire parent chain', () => {
      // Invalidate from space 4 (should invalidate 4, 3, 2, 1)
      invalidateSpaceStatsForParentChain(4, (id: number) => spacesSignal.value.find(s => s.id === id));

      expect(spaceStatsCache.getStats(4, false)).toBeNull();
      expect(spaceStatsCache.getStats(4, true)).toBeNull();
      expect(spaceStatsCache.getStats(3, false)).toBeNull();
      expect(spaceStatsCache.getStats(3, true)).toBeNull();
      expect(spaceStatsCache.getStats(2, false)).toBeNull();
      expect(spaceStatsCache.getStats(2, true)).toBeNull();
      expect(spaceStatsCache.getStats(1, false)).toBeNull();
      expect(spaceStatsCache.getStats(1, true)).toBeNull();
    });

    it('should handle root space', () => {
      // Invalidate from space 1 (root, no parents)
      invalidateSpaceStatsForParentChain(1, (id: number) => spacesSignal.value.find(s => s.id === id));

      expect(spaceStatsCache.getStats(1, false)).toBeNull();
      expect(spaceStatsCache.getStats(1, true)).toBeNull();
      // Others should still be cached
      expect(spaceStatsCache.getStats(2, false)).not.toBeNull();
    });

    it('should handle middle of chain', () => {
      // Invalidate from space 3 (should invalidate 3, 2, 1, but not 4)
      invalidateSpaceStatsForParentChain(3, (id: number) => spacesSignal.value.find(s => s.id === id));

      expect(spaceStatsCache.getStats(3, false)).toBeNull();
      expect(spaceStatsCache.getStats(2, false)).toBeNull();
      expect(spaceStatsCache.getStats(1, false)).toBeNull();
      expect(spaceStatsCache.getStats(4, false)).not.toBeNull();
    });

    it('should handle non-existent space gracefully', () => {
      expect(() => invalidateSpaceStatsForParentChain(999, (id: number) => spacesSignal.value.find(s => s.id === id))).not.toThrow();
    });
  });
});
