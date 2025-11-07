/**
 * Tests for Space Actions
 * Testing state management, cache invalidation
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

describe('Space Actions', () => {
  beforeEach(() => {
    resetFactoryCounters();
    spacesSignal.value = [];
    currentSpaceSignal.value = null;
    spaceStatsCache.clear();
    activityCache.clear();
    vi.clearAllMocks();
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

    describe('Complex scenarios', () => {
      it('should handle deleting middle space in deep hierarchy', async () => {
        // Hierarchy: 1 -> 2 -> 3 -> 4 -> 5
        const space1 = createMockSpace({ id: 1, parent_id: null, recursive_post_count: 100 });
        const space2 = createMockSpace({ id: 2, parent_id: 1, recursive_post_count: 80 });
        const space3 = createMockSpace({ id: 3, parent_id: 2, recursive_post_count: 60 });
        const space4 = createMockSpace({ id: 4, parent_id: 3, recursive_post_count: 40 });
        const space5 = createMockSpace({ id: 5, parent_id: 4, recursive_post_count: 20 });

        spacesSignal.value = [space1, space2, space3, space4, space5];

        // Delete space 3 (and its children 4, 5)
        await deleteSpaceAction({ spaceId: 3, spaceName: 'Space 3' });

        // Spaces 3, 4, 5 should be deleted
        expect(spacesSignal.value.length).toBe(2);
        expect(spacesSignal.value.map(s => s.id)).toEqual([1, 2]);

        // The mutations happen in place, so check original objects
        // Space 2 had recursive_post_count 80, space 3 had 60 recursively
        // So space 2 should now be 80 - 60 = 20
        expect(space2.recursive_post_count).toBe(20); // 80 - 60
        expect(space1.recursive_post_count).toBe(40); // 100 - 60
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
});
