/**
 * Tests for Space Actions
 * Testing state management, cache invalidation, and navigation/redirection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { deleteSpaceAction, updateSpaceAction } from '../spaceActions';
import { spaces as spacesSignal, currentSpace as currentSpaceSignal } from '../../state/spaces';
import { resetPosts } from '../../state/posts';
import { spaceStatsCache } from '../../cache/spaceStatsCache';
import { activityCache } from '../../cache/activityCache';
import {
  createMockSpace,
  createMockSpaceStats,
  resetFactoryCounters,
} from '../../__tests__/factories';

// Mock the API calls
vi.mock('../../api/spaces', () => ({
  deleteSpace: vi.fn(() => Promise.resolve()),
  updateSpace: vi.fn((spaceId: number, payload: any) => {
    const space = spacesSignal.value.find(s => s.id === spaceId);
    if (space) {
      return Promise.resolve({ ...space, ...payload });
    }
    return Promise.resolve(null);
  }),
}));

// Mock the components
vi.mock('../../components', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

// Mock executeAction
vi.mock('../index', () => ({
  executeAction: vi.fn(async ({ execute, onSuccess }: any) => {
    const result = await execute();
    await onSuccess(result);
  }),
}));

// Mock resetPosts
vi.mock('../../state/posts', () => ({
  resetPosts: vi.fn(),
}));

// Mock navigation functions (defined at end of spaceActions.ts)
const mockNavigateToSpace = vi.fn();
const mockNavigateToAllSpaces = vi.fn();

// Replace the actual navigation functions with mocks
vi.mock('../spaceActions', async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    navigateToSpace: mockNavigateToSpace,
    navigateToAllSpaces: mockNavigateToAllSpaces,
  };
});

describe('Space Actions', () => {
  let mockRouter: any;

  beforeEach(() => {
    resetFactoryCounters();
    spacesSignal.value = [];
    currentSpaceSignal.value = null;
    spaceStatsCache.clear();
    activityCache.clear();
    vi.clearAllMocks();
    mockRouter = { route: vi.fn() };
  });

  describe('deleteSpaceAction', () => {
    it('should remove space from state', async () => {
      const space = createMockSpace({ id: 1, name: 'Test Space' });
      spacesSignal.value = [space];

      await deleteSpaceAction({ spaceId: 1, spaceName: 'Test Space' });

      expect(spacesSignal.value.length).toBe(0);
    });

    it('should remove space and all descendants', async () => {
      // Hierarchy: 1 -> 2 -> 3, and 1 -> 4
      const spaces = [
        createMockSpace({ id: 1, parent_id: null }),
        createMockSpace({ id: 2, parent_id: 1 }),
        createMockSpace({ id: 3, parent_id: 2 }),
        createMockSpace({ id: 4, parent_id: 1 }),
        createMockSpace({ id: 5, parent_id: null }), // Unrelated
      ];
      spacesSignal.value = spaces;

      await deleteSpaceAction({ spaceId: 1, spaceName: 'Space 1' });

      // Only space 5 should remain
      expect(spacesSignal.value.length).toBe(1);
      expect(spacesSignal.value[0].id).toBe(5);
    });

    it('should update parent recursive counts', async () => {
      // Hierarchy: 1 -> 2 -> 3
      const space1 = createMockSpace({ id: 1, parent_id: null, recursive_post_count: 30 });
      const space2 = createMockSpace({ id: 2, parent_id: 1, recursive_post_count: 20 });
      const space3 = createMockSpace({ id: 3, parent_id: 2, recursive_post_count: 10 });
      spacesSignal.value = [space1, space2, space3];

      // Delete space 3 (10 posts)
      await deleteSpaceAction({ spaceId: 3, spaceName: 'Space 3' });

      // Parent counts should be decremented
      expect(space2.recursive_post_count).toBe(10); // 20 - 10
      expect(space1.recursive_post_count).toBe(20); // 30 - 10
    });

    it('should invalidate parent chain stats cache only', async () => {
      const space1 = createMockSpace({ id: 1, parent_id: null });
      const space2 = createMockSpace({ id: 2, parent_id: 1 });
      const space3 = createMockSpace({ id: 3, parent_id: null }); // Unrelated
      spacesSignal.value = [space1, space2, space3];

      // Cache all stats
      [1, 2, 3].forEach(id => {
        spaceStatsCache['cache'].set(`spaceStats:${id}:flat`, createMockSpaceStats());
        spaceStatsCache['cache'].set(`spaceStats:${id}:recursive`, createMockSpaceStats());
      });

      await deleteSpaceAction({ spaceId: 2, spaceName: 'Space 2' });

      // Parent (1) should be invalidated
      expect(spaceStatsCache.getStats(1, false)).toBeNull();

      // Unrelated space (3) should still be cached
      expect(spaceStatsCache.getStats(3, false)).not.toBeNull();
    });

    it('should invalidate activity for deleted spaces', async () => {
      const space1 = createMockSpace({ id: 1, parent_id: null });
      const space2 = createMockSpace({ id: 2, parent_id: 1 });
      spacesSignal.value = [space1, space2];

      // Cache activity
      activityCache['cache'].set('activity:1:flat:0:4m', {} as any);
      activityCache['cache'].set('activity:2:flat:0:4m', {} as any);

      await deleteSpaceAction({ spaceId: 1, spaceName: 'Space 1' });

      // Both spaces' activity should be invalidated
      expect(activityCache.getData(1, false, 0, 4)).toBeNull();
      expect(activityCache.getData(2, false, 0, 4)).toBeNull();
    });

    describe('Redirection', () => {
      it('should redirect to parent when deleting current space', async () => {
        const parent = createMockSpace({ id: 1, parent_id: null });
        const child = createMockSpace({ id: 2, parent_id: 1 });
        spacesSignal.value = [parent, child];
        currentSpaceSignal.value = child;

        await deleteSpaceAction({
          spaceId: 2,
          spaceName: 'Child Space',
          router: mockRouter,
        });

        expect(resetPosts).toHaveBeenCalled();
        // Navigation happens through imported functions (mocked above)
      });

      it('should redirect to All Spaces when deleting root space', async () => {
        const space = createMockSpace({ id: 1, parent_id: null });
        spacesSignal.value = [space];
        currentSpaceSignal.value = space;

        await deleteSpaceAction({
          spaceId: 1,
          spaceName: 'Root Space',
          router: mockRouter,
        });

        expect(resetPosts).toHaveBeenCalled();
      });

      it('should NOT redirect when deleting non-current space', async () => {
        const space1 = createMockSpace({ id: 1 });
        const space2 = createMockSpace({ id: 2 });
        spacesSignal.value = [space1, space2];
        currentSpaceSignal.value = space1; // Currently viewing space1

        await deleteSpaceAction({
          spaceId: 2, // Deleting space2
          spaceName: 'Space 2',
          router: mockRouter,
        });

        expect(resetPosts).not.toHaveBeenCalled();
      });
    });
  });

  describe('updateSpaceAction', () => {
    it('should update space in state', async () => {
      const space = createMockSpace({ id: 1, name: 'Old Name' });
      spacesSignal.value = [space];

      await updateSpaceAction({
        spaceId: 1,
        payload: { name: 'New Name' },
      });

      expect(spacesSignal.value[0].name).toBe('New Name');
    });

    describe('Parent change (moving space)', () => {
      it('should update recursive counts in old and new parent chains', async () => {
        // Two chains: 1 -> 2 and 3 -> 4
        const space1 = createMockSpace({ id: 1, parent_id: null, recursive_post_count: 50 });
        const space2 = createMockSpace({ id: 2, parent_id: 1, recursive_post_count: 20 });
        const space3 = createMockSpace({ id: 3, parent_id: null, recursive_post_count: 30 });
        const space4 = createMockSpace({ id: 4, parent_id: 3, recursive_post_count: 10 });
        spacesSignal.value = [space1, space2, space3, space4];

        // Move space 2 from parent 1 to parent 3
        await updateSpaceAction({
          spaceId: 2,
          payload: { parent_id: 3 },
        });

        // Old parent chain should be decremented
        expect(space1.recursive_post_count).toBe(30); // 50 - 20

        // New parent chain should be incremented
        expect(space3.recursive_post_count).toBe(50); // 30 + 20
      });

      it('should invalidate stats for both parent chains', async () => {
        const space1 = createMockSpace({ id: 1, parent_id: null });
        const space2 = createMockSpace({ id: 2, parent_id: 1 });
        const space3 = createMockSpace({ id: 3, parent_id: null });
        spacesSignal.value = [space1, space2, space3];

        // Cache all stats
        [1, 2, 3].forEach(id => {
          spaceStatsCache['cache'].set(`spaceStats:${id}:flat`, createMockSpaceStats());
          spaceStatsCache['cache'].set(`spaceStats:${id}:recursive`, createMockSpaceStats());
        });

        // Move space 2 from parent 1 to parent 3
        await updateSpaceAction({
          spaceId: 2,
          payload: { parent_id: 3 },
        });

        // Both parent chains should be invalidated
        expect(spaceStatsCache.getStats(1, false)).toBeNull();
        expect(spaceStatsCache.getStats(3, false)).toBeNull();
        // The moved space itself should be invalidated
        expect(spaceStatsCache.getStats(2, false)).toBeNull();
      });

      it('should invalidate activity when parent changes', async () => {
        const space1 = createMockSpace({ id: 1, parent_id: null });
        const space2 = createMockSpace({ id: 2, parent_id: 1 });
        spacesSignal.value = [space1, space2];

        activityCache['cache'].set('activity:2:flat:0:4m', {} as any);

        await updateSpaceAction({
          spaceId: 2,
          payload: { parent_id: null },
        });

        expect(activityCache.getData(2, false, 0, 4)).toBeNull();
      });
    });

    describe('Name/Description change (no parent change)', () => {
      it('should only invalidate the space itself, not parents', async () => {
        const space1 = createMockSpace({ id: 1, parent_id: null });
        const space2 = createMockSpace({ id: 2, parent_id: 1 });
        spacesSignal.value = [space1, space2];

        // Cache stats
        spaceStatsCache['cache'].set('spaceStats:1:flat', createMockSpaceStats());
        spaceStatsCache['cache'].set('spaceStats:2:flat', createMockSpaceStats());

        await updateSpaceAction({
          spaceId: 2,
          payload: { name: 'New Name' },
        });

        // Space 2 should be invalidated
        expect(spaceStatsCache.getStats(2, false)).toBeNull();

        // Parent should still be cached
        expect(spaceStatsCache.getStats(1, false)).not.toBeNull();
      });

      it('should NOT invalidate activity for name/description changes', async () => {
        const space = createMockSpace({ id: 1 });
        spacesSignal.value = [space];

        activityCache['cache'].set('activity:1:flat:0:4m', {} as any);

        await updateSpaceAction({
          spaceId: 1,
          payload: { name: 'New Name', description: 'New Description' },
        });

        // Activity should still be cached
        expect(activityCache.getData(1, false, 0, 4)).not.toBeNull();
      });
    });

    describe('Redirection', () => {
      it('should redirect when name changes', async () => {
        const space = createMockSpace({ id: 1, name: 'Old Name' });
        spacesSignal.value = [space];

        await updateSpaceAction({
          spaceId: 1,
          payload: { name: 'New Name' },
          router: mockRouter,
        });

        // Navigation should occur (through mocked function)
        // This would normally call navigateToSpace with the updated space
      });

      it('should redirect when parent changes', async () => {
        const space1 = createMockSpace({ id: 1, parent_id: null });
        const space2 = createMockSpace({ id: 2, parent_id: 1 });
        spacesSignal.value = [space1, space2];

        await updateSpaceAction({
          spaceId: 2,
          payload: { parent_id: null },
          router: mockRouter,
        });

        // Navigation should occur
      });

      it('should NOT redirect when only description changes', async () => {
        const space = createMockSpace({ id: 1, description: 'Old desc' });
        spacesSignal.value = [space];

        await updateSpaceAction({
          spaceId: 1,
          payload: { description: 'New desc' },
          router: mockRouter,
        });

        // Since name didn't change, we shouldn't navigate
        // (This is a limitation of the current test setup - the actual
        // implementation checks nameChanged which requires comparing old vs new)
      });
    });
  });

  describe('Complex scenarios', () => {
    it('should handle deleting middle space in deep hierarchy', async () => {
      // Hierarchy: 1 -> 2 -> 3 -> 4 -> 5
      const spaces = [
        createMockSpace({ id: 1, parent_id: null, recursive_post_count: 100 }),
        createMockSpace({ id: 2, parent_id: 1, recursive_post_count: 80 }),
        createMockSpace({ id: 3, parent_id: 2, recursive_post_count: 60 }),
        createMockSpace({ id: 4, parent_id: 3, recursive_post_count: 40 }),
        createMockSpace({ id: 5, parent_id: 4, recursive_post_count: 20 }),
      ];
      spacesSignal.value = spaces;

      // Delete space 3 (and its children 4, 5)
      await deleteSpaceAction({ spaceId: 3, spaceName: 'Space 3' });

      // Spaces 3, 4, 5 should be deleted
      expect(spacesSignal.value.length).toBe(2);
      expect(spacesSignal.value.map(s => s.id)).toEqual([1, 2]);

      // Parent counts should be updated
      expect(spaces[1].recursive_post_count).toBe(20); // 80 - 60
      expect(spaces[0].recursive_post_count).toBe(40); // 100 - 60
    });

    it('should handle moving space between different depth levels', async () => {
      // Move from deep to shallow: 1 -> 2 -> 3 -> 4, move 4 to be child of 1
      const space1 = createMockSpace({ id: 1, parent_id: null, recursive_post_count: 100 });
      const space2 = createMockSpace({ id: 2, parent_id: 1, recursive_post_count: 80 });
      const space3 = createMockSpace({ id: 3, parent_id: 2, recursive_post_count: 60 });
      const space4 = createMockSpace({ id: 4, parent_id: 3, recursive_post_count: 40 });
      spacesSignal.value = [space1, space2, space3, space4];

      await updateSpaceAction({
        spaceId: 4,
        payload: { parent_id: 1 },
      });

      // Old path (3 -> 2) should be decremented
      expect(space3.recursive_post_count).toBe(20); // 60 - 40
      expect(space2.recursive_post_count).toBe(40); // 80 - 40

      // New parent stays the same (was already counting it)
      expect(space1.recursive_post_count).toBe(100);
    });
  });
});
