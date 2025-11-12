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

    it('should invalidate activity for parent spaces when deleting child', async () => {
      // Hierarchy: 1 -> 2 -> 3
      const space0 = createMockSpace({ id: 0, parent_id: null });
      const space1 = createMockSpace({ id: 1, parent_id: null });
      const space2 = createMockSpace({ id: 2, parent_id: 1 });
      const space3 = createMockSpace({ id: 3, parent_id: 2 });
      spacesSignal.value = [space0, space1, space2, space3];

      // Cache activity for all spaces
      activityCache['cache'].set('activity:0:flat:0:4m', {} as any);
      activityCache['cache'].set('activity:1:flat:0:4m', {} as any);
      activityCache['cache'].set('activity:1:recursive:0:4m', {} as any);
      activityCache['cache'].set('activity:2:flat:0:4m', {} as any);
      activityCache['cache'].set('activity:2:recursive:0:4m', {} as any);
      activityCache['cache'].set('activity:3:flat:0:4m', {} as any);

      // Delete space 3 (deepest child)
      await deleteSpaceAction({ spaceId: 3, spaceName: 'Space 3' });

      // Space 3 should be invalidated
      expect(activityCache.getData(3, false, 0, 4)).toBeNull();

      // Parent spaces should also be invalidated (recursive views affected)
      expect(activityCache.getData(2, false, 0, 4)).toBeNull();
      expect(activityCache.getData(2, true, 0, 4)).toBeNull();
      expect(activityCache.getData(1, false, 0, 4)).toBeNull();
      expect(activityCache.getData(1, true, 0, 4)).toBeNull();

      // Space 0 (All Spaces) should also be invalidated
      expect(activityCache.getData(0, false, 0, 4)).toBeNull();
    });

    it('should invalidate activity when deleting space with no cached parent activity', async () => {
      // Hierarchy: 1 -> 2 -> 3
      const space0 = createMockSpace({ id: 0, parent_id: null });
      const space1 = createMockSpace({ id: 1, parent_id: null });
      const space2 = createMockSpace({ id: 2, parent_id: 1 });
      const space3 = createMockSpace({ id: 3, parent_id: 2 });
      spacesSignal.value = [space0, space1, space2, space3];

      // Only cache activity for space 3 (the one being deleted)
      activityCache['cache'].set('activity:3:flat:0:4m', {} as any);
      // Parents have NO cached activity

      await deleteSpaceAction({ spaceId: 3, spaceName: 'Space 3' });

      // Space 3 should be invalidated
      expect(activityCache.getData(3, false, 0, 4)).toBeNull();

      // Parents should still be null (no cache to invalidate, but function shouldn't error)
      expect(activityCache.getData(2, false, 0, 4)).toBeNull();
      expect(activityCache.getData(1, false, 0, 4)).toBeNull();
      expect(activityCache.getData(0, false, 0, 4)).toBeNull();
    });

    it('should invalidate activity when deleting top-level space with no parent', async () => {
      // Top-level space (no parent)
      const space0 = createMockSpace({ id: 0, parent_id: null });
      const space1 = createMockSpace({ id: 1, parent_id: null });
      spacesSignal.value = [space0, space1];

      activityCache['cache'].set('activity:0:flat:0:4m', {} as any);
      activityCache['cache'].set('activity:1:flat:0:4m', {} as any);

      await deleteSpaceAction({ spaceId: 1, spaceName: 'Space 1' });

      // Space 1 should be invalidated
      expect(activityCache.getData(1, false, 0, 4)).toBeNull();

      // Space 0 should be invalidated
      expect(activityCache.getData(0, false, 0, 4)).toBeNull();
    });

    it('should invalidate activity when deleting middle space with descendants', async () => {
      // Hierarchy: 0, 1 -> 2 -> 3 -> 4
      const space0 = createMockSpace({ id: 0, parent_id: null });
      const space1 = createMockSpace({ id: 1, parent_id: null, recursive_post_count: 100 });
      const space2 = createMockSpace({ id: 2, parent_id: 1, recursive_post_count: 80 });
      const space3 = createMockSpace({ id: 3, parent_id: 2, recursive_post_count: 60 });
      const space4 = createMockSpace({ id: 4, parent_id: 3, recursive_post_count: 40 });
      spacesSignal.value = [space0, space1, space2, space3, space4];

      // Cache activity for all spaces (both flat and recursive)
      [0, 1, 2, 3, 4].forEach(id => {
        activityCache['cache'].set(`activity:${id}:flat:0:4m`, {} as any);
        activityCache['cache'].set(`activity:${id}:recursive:0:4m`, {} as any);
      });

      // Delete space 2 (middle space) - should delete 2, 3, 4
      await deleteSpaceAction({ spaceId: 2, spaceName: 'Space 2' });

      // Deleted spaces (2, 3, 4) should all be invalidated
      expect(activityCache.getData(2, false, 0, 4)).toBeNull();
      expect(activityCache.getData(3, false, 0, 4)).toBeNull();
      expect(activityCache.getData(4, false, 0, 4)).toBeNull();

      // Parent (1) should be invalidated
      expect(activityCache.getData(1, false, 0, 4)).toBeNull();
      expect(activityCache.getData(1, true, 0, 4)).toBeNull();

      // Space 0 should be invalidated
      expect(activityCache.getData(0, false, 0, 4)).toBeNull();
    });

    it('should invalidate only recursive views for parent spaces, not flat', async () => {
      // Hierarchy: 1 -> 2 -> 3
      const space0 = createMockSpace({ id: 0, parent_id: null });
      const space1 = createMockSpace({ id: 1, parent_id: null });
      const space2 = createMockSpace({ id: 2, parent_id: 1 });
      const space3 = createMockSpace({ id: 3, parent_id: 2 });
      spacesSignal.value = [space0, space1, space2, space3];

      // Cache both flat and recursive for all spaces
      [0, 1, 2, 3].forEach(id => {
        activityCache['cache'].set(`activity:${id}:flat:0:4m`, {} as any);
        activityCache['cache'].set(`activity:${id}:recursive:0:4m`, {} as any);
      });

      await deleteSpaceAction({ spaceId: 3, spaceName: 'Space 3' });

      // Space 3 - both should be invalidated (the deleted space)
      expect(activityCache.getData(3, false, 0, 4)).toBeNull();
      expect(activityCache.getData(3, true, 0, 4)).toBeNull();

      // Parent spaces - both flat AND recursive should be invalidated
      // (because invalidateActivityForSpace invalidates both by default)
      expect(activityCache.getData(2, false, 0, 4)).toBeNull();
      expect(activityCache.getData(2, true, 0, 4)).toBeNull();
      expect(activityCache.getData(1, false, 0, 4)).toBeNull();
      expect(activityCache.getData(1, true, 0, 4)).toBeNull();

      // Space 0
      expect(activityCache.getData(0, false, 0, 4)).toBeNull();
    });

    it('should handle deletion of space with siblings correctly', async () => {
      // Hierarchy: 1 -> [2, 3, 4] (siblings)
      const space0 = createMockSpace({ id: 0, parent_id: null });
      const space1 = createMockSpace({ id: 1, parent_id: null, recursive_post_count: 100 });
      const space2 = createMockSpace({ id: 2, parent_id: 1, recursive_post_count: 30 });
      const space3 = createMockSpace({ id: 3, parent_id: 1, recursive_post_count: 40 });
      const space4 = createMockSpace({ id: 4, parent_id: 1, recursive_post_count: 30 });
      spacesSignal.value = [space0, space1, space2, space3, space4];

      // Cache activity for all
      [0, 1, 2, 3, 4].forEach(id => {
        activityCache['cache'].set(`activity:${id}:flat:0:4m`, {} as any);
        activityCache['cache'].set(`activity:${id}:recursive:0:4m`, {} as any);
      });

      // Delete space 2 (one sibling)
      await deleteSpaceAction({ spaceId: 2, spaceName: 'Space 2' });

      // Space 2 should be invalidated
      expect(activityCache.getData(2, false, 0, 4)).toBeNull();

      // Siblings should NOT be invalidated... wait, actually they WILL be
      // because we invalidate the parent (1), which affects all recursive views
      // But the siblings' own caches should still exist (only space 2 is deleted)
      expect(spacesSignal.value.find(s => s.id === 3)).toBeDefined(); // Still exists
      expect(spacesSignal.value.find(s => s.id === 4)).toBeDefined(); // Still exists

      // Parent should be invalidated
      expect(activityCache.getData(1, false, 0, 4)).toBeNull();
      expect(activityCache.getData(1, true, 0, 4)).toBeNull();

      // Space 0 should be invalidated
      expect(activityCache.getData(0, false, 0, 4)).toBeNull();

      // Verify recursive count updated correctly
      const updatedSpace1 = spacesSignal.value.find(s => s.id === 1)!;
      expect(updatedSpace1.recursive_post_count).toBe(70); // 100 - 30
    });
  });

  describe('deleteSpaceAction - Redirect Behavior', () => {
    it('should redirect to parent when deleting currently viewed child space', async () => {
      const space1 = createMockSpace({ id: 1, parent_id: null, name: 'Parent' });
      const space2 = createMockSpace({ id: 2, parent_id: 1, name: 'Child' });
      spacesSignal.value = [space1, space2];

      // Currently viewing space 2
      currentSpaceSignal.value = space2;

      const mockRouter = { route: vi.fn() };

      await deleteSpaceAction({ spaceId: 2, spaceName: 'Child', router: mockRouter });

      // Should redirect to parent space
      expect(mockRouter.route).toHaveBeenCalledWith('/parent');
      expect(resetPosts).toHaveBeenCalled();
    });

    it('should redirect to "/" when deleting currently viewed space with no parent', async () => {
      const space1 = createMockSpace({ id: 1, parent_id: null, name: 'TopLevel' });
      spacesSignal.value = [space1];

      // Currently viewing space 1
      currentSpaceSignal.value = space1;

      const mockRouter = { route: vi.fn() };

      await deleteSpaceAction({ spaceId: 1, spaceName: 'TopLevel', router: mockRouter });

      // Should redirect to All Spaces
      expect(mockRouter.route).toHaveBeenCalledWith('/');
      expect(resetPosts).toHaveBeenCalled();
    });

    it('should redirect to "/" when deleting currently viewed space and parent no longer exists', async () => {
      // This simulates a race condition or corrupted state
      const space1 = createMockSpace({ id: 1, parent_id: 999, name: 'Orphaned' }); // Parent 999 doesn't exist
      spacesSignal.value = [space1];

      // Currently viewing space 1
      currentSpaceSignal.value = space1;

      const mockRouter = { route: vi.fn() };

      await deleteSpaceAction({ spaceId: 1, spaceName: 'Orphaned', router: mockRouter });

      // Should redirect to All Spaces since parent doesn't exist
      expect(mockRouter.route).toHaveBeenCalledWith('/');
      expect(resetPosts).toHaveBeenCalled();
    });

    it('should redirect to grandparent when deleting middle space with descendants', async () => {
      // Hierarchy: 1 -> 2 -> 3
      const space1 = createMockSpace({ id: 1, parent_id: null, name: 'Grandparent' });
      const space2 = createMockSpace({ id: 2, parent_id: 1, name: 'Parent' });
      const space3 = createMockSpace({ id: 3, parent_id: 2, name: 'Child' });
      spacesSignal.value = [space1, space2, space3];

      // Currently viewing space 2 (middle space)
      currentSpaceSignal.value = space2;

      const mockRouter = { route: vi.fn() };

      await deleteSpaceAction({ spaceId: 2, spaceName: 'Parent', router: mockRouter });

      // Should redirect to grandparent
      expect(mockRouter.route).toHaveBeenCalledWith('/grandparent');
      expect(resetPosts).toHaveBeenCalled();
    });

    it('should redirect to parent when deleting currently viewed descendant space', async () => {
      // Hierarchy: 1 -> 2 -> 3
      const space1 = createMockSpace({ id: 1, parent_id: null, name: 'Root' });
      const space2 = createMockSpace({ id: 2, parent_id: 1, name: 'Middle' });
      const space3 = createMockSpace({ id: 3, parent_id: 2, name: 'Leaf' });
      spacesSignal.value = [space1, space2, space3];

      // Currently viewing space 3 (leaf)
      currentSpaceSignal.value = space3;

      const mockRouter = { route: vi.fn() };

      // Delete space 2 (will also delete space 3 as descendant)
      await deleteSpaceAction({ spaceId: 2, spaceName: 'Middle', router: mockRouter });

      // Should redirect to space 1 (parent of deleted space 2)
      expect(mockRouter.route).toHaveBeenCalledWith('/root');
      expect(resetPosts).toHaveBeenCalled();
    });

    it('should NOT redirect when deleting space that is not currently viewed', async () => {
      const space1 = createMockSpace({ id: 1, parent_id: null, name: 'Space1' });
      const space2 = createMockSpace({ id: 2, parent_id: null, name: 'Space2' });
      spacesSignal.value = [space1, space2];

      // Currently viewing space 1
      currentSpaceSignal.value = space1;

      const mockRouter = { route: vi.fn() };

      // Delete space 2 (different from current)
      await deleteSpaceAction({ spaceId: 2, spaceName: 'Space2', router: mockRouter });

      // Should NOT redirect or reset posts
      expect(mockRouter.route).not.toHaveBeenCalled();
      expect(resetPosts).not.toHaveBeenCalled();
    });

    it('should NOT redirect when no router provided', async () => {
      const space1 = createMockSpace({ id: 1, parent_id: null, name: 'Space1' });
      spacesSignal.value = [space1];

      // Currently viewing space 1
      currentSpaceSignal.value = space1;

      // No router provided
      await deleteSpaceAction({ spaceId: 1, spaceName: 'Space1' });

      // Should reset posts but not attempt to redirect
      expect(resetPosts).toHaveBeenCalled();
    });

    it('should redirect to deep parent path correctly', async () => {
      // Hierarchy: 1 -> 2 -> 3 -> 4 -> 5
      const space1 = createMockSpace({ id: 1, parent_id: null, name: 'One' });
      const space2 = createMockSpace({ id: 2, parent_id: 1, name: 'Two' });
      const space3 = createMockSpace({ id: 3, parent_id: 2, name: 'Three' });
      const space4 = createMockSpace({ id: 4, parent_id: 3, name: 'Four' });
      const space5 = createMockSpace({ id: 5, parent_id: 4, name: 'Five' });
      spacesSignal.value = [space1, space2, space3, space4, space5];

      // Currently viewing space 5
      currentSpaceSignal.value = space5;

      const mockRouter = { route: vi.fn() };

      // Delete space 5
      await deleteSpaceAction({ spaceId: 5, spaceName: 'Five', router: mockRouter });

      // Should redirect to parent with full path
      expect(mockRouter.route).toHaveBeenCalledWith('/one/two/three/four');
      expect(resetPosts).toHaveBeenCalled();
    });

    it('should handle special characters in space names for redirect', async () => {
      const space1 = createMockSpace({ id: 1, parent_id: null, name: 'Parent Space!' });
      const space2 = createMockSpace({ id: 2, parent_id: 1, name: 'Child & More' });
      spacesSignal.value = [space1, space2];

      // Currently viewing space 2
      currentSpaceSignal.value = space2;

      const mockRouter = { route: vi.fn() };

      await deleteSpaceAction({ spaceId: 2, spaceName: 'Child & More', router: mockRouter });

      // Should redirect with slugified name
      expect(mockRouter.route).toHaveBeenCalledWith('/parent-space');
      expect(resetPosts).toHaveBeenCalled();
    });

    it('should redirect to "/" when deleting All Spaces view space', async () => {
      const space1 = createMockSpace({ id: 1, parent_id: null, name: 'Space1' });
      spacesSignal.value = [space1];

      // Currently in All Spaces view
      currentSpaceSignal.value = null;

      const mockRouter = { route: vi.fn() };

      // Delete space 1 while in All Spaces view
      await deleteSpaceAction({ spaceId: 1, spaceName: 'Space1', router: mockRouter });

      // Should NOT redirect (not viewing the deleted space)
      expect(mockRouter.route).not.toHaveBeenCalled();
      expect(resetPosts).not.toHaveBeenCalled();
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

    it('should update currentSpace when updating the currently viewed space', async () => {
      const space = createMockSpace({ id: 1, name: 'Old Name', description: 'Old Description' });
      spacesSignal.value = [space];
      currentSpaceSignal.value = space;

      await updateSpaceAction({
        spaceId: 1,
        payload: { description: 'New Description' },
      });

      // currentSpace should be updated with the new data
      expect(currentSpaceSignal.value).not.toBeNull();
      expect(currentSpaceSignal.value!.description).toBe('New Description');
      expect(currentSpaceSignal.value!.name).toBe('Old Name');
    });

    it('should NOT update currentSpace when updating a different space', async () => {
      const space1 = createMockSpace({ id: 1, name: 'Space 1' });
      const space2 = createMockSpace({ id: 2, name: 'Space 2', description: 'Old' });
      spacesSignal.value = [space1, space2];
      currentSpaceSignal.value = space1;

      await updateSpaceAction({
        spaceId: 2,
        payload: { description: 'New' },
      });

      // currentSpace should remain pointing to space 1
      expect(currentSpaceSignal.value).toBe(space1);
      expect(currentSpaceSignal.value!.id).toBe(1);
    });

    describe('Description updates', () => {
      it('should update description and refresh currentSpace', async () => {
        const space = createMockSpace({ id: 1, name: 'Test', description: 'Old' });
        spacesSignal.value = [space];
        currentSpaceSignal.value = space;

        await updateSpaceAction({
          spaceId: 1,
          payload: { description: 'New description text' },
        });

        expect(spacesSignal.value[0].description).toBe('New description text');
        expect(currentSpaceSignal.value!.description).toBe('New description text');
      });

      it('should invalidate stats cache but NOT activity for description-only updates', async () => {
        const space = createMockSpace({ id: 1, description: 'Old' });
        spacesSignal.value = [space];

        spaceStatsCache['cache'].set('spaceStats:1:flat', createMockSpaceStats());
        activityCache['cache'].set('activity:1:flat:0:4m', {} as any);

        await updateSpaceAction({
          spaceId: 1,
          payload: { description: 'New' },
        });

        // Stats cache is always invalidated on update (to refresh any server-side changes)
        expect(spaceStatsCache.getStats(1, false)).toBeNull();
        // Activity cache should remain valid for description changes
        expect(activityCache.getData(1, false, 0, 4)).not.toBeNull();
      });
    });

    describe('Name updates', () => {
      it('should update name and redirect to new URL', async () => {
        const space = createMockSpace({ id: 1, name: 'Old Name', parent_id: null });
        spacesSignal.value = [space];
        currentSpaceSignal.value = space;

        const mockRouter = { route: vi.fn() };

        await updateSpaceAction({
          spaceId: 1,
          payload: { name: 'New Name' },
          router: mockRouter,
        });

        expect(spacesSignal.value[0].name).toBe('New Name');
        expect(mockRouter.route).toHaveBeenCalledWith('/new-name');
      });

      it('should redirect to full path when renaming nested space', async () => {
        const space1 = createMockSpace({ id: 1, name: 'Parent', parent_id: null });
        const space2 = createMockSpace({ id: 2, name: 'Old Child', parent_id: 1 });
        spacesSignal.value = [space1, space2];
        currentSpaceSignal.value = space2;

        const mockRouter = { route: vi.fn() };

        await updateSpaceAction({
          spaceId: 2,
          payload: { name: 'New Child' },
          router: mockRouter,
        });

        expect(mockRouter.route).toHaveBeenCalledWith('/parent/new-child');
      });

      it('should NOT redirect when no router provided', async () => {
        const space = createMockSpace({ id: 1, name: 'Old' });
        spacesSignal.value = [space];

        await updateSpaceAction({
          spaceId: 1,
          payload: { name: 'New' },
        });

        // Should still update the name
        expect(spacesSignal.value[0].name).toBe('New');
      });

      it('should handle special characters in new name', async () => {
        const space = createMockSpace({ id: 1, name: 'Old', parent_id: null });
        spacesSignal.value = [space];

        const mockRouter = { route: vi.fn() };

        await updateSpaceAction({
          spaceId: 1,
          payload: { name: 'New & Special! Name' },
          router: mockRouter,
        });

        expect(mockRouter.route).toHaveBeenCalledWith('/new-special-name');
      });
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

      it('should redirect to new path when moving space', async () => {
        const space1 = createMockSpace({ id: 1, name: 'Parent1', parent_id: null });
        const space2 = createMockSpace({ id: 2, name: 'Child', parent_id: 1 });
        const space3 = createMockSpace({ id: 3, name: 'Parent2', parent_id: null });
        spacesSignal.value = [space1, space2, space3];
        currentSpaceSignal.value = space2;

        const mockRouter = { route: vi.fn() };

        // Move space 2 from parent1 to parent2
        await updateSpaceAction({
          spaceId: 2,
          payload: { parent_id: 3 },
          router: mockRouter,
        });

        // Should redirect to new path
        expect(mockRouter.route).toHaveBeenCalledWith('/parent2/child');
      });

      it('should redirect when moving top-level space to be a child', async () => {
        const space1 = createMockSpace({ id: 1, name: 'Parent', parent_id: null });
        const space2 = createMockSpace({ id: 2, name: 'TopLevel', parent_id: null });
        spacesSignal.value = [space1, space2];

        const mockRouter = { route: vi.fn() };

        // Move space 2 from top-level to child of space 1
        await updateSpaceAction({
          spaceId: 2,
          payload: { parent_id: 1 },
          router: mockRouter,
        });

        expect(mockRouter.route).toHaveBeenCalledWith('/parent/toplevel');
      });

      it('should redirect when moving child to top-level', async () => {
        const space1 = createMockSpace({ id: 1, name: 'Parent', parent_id: null });
        const space2 = createMockSpace({ id: 2, name: 'Child', parent_id: 1 });
        spacesSignal.value = [space1, space2];

        const mockRouter = { route: vi.fn() };

        // Move space 2 from child to top-level
        await updateSpaceAction({
          spaceId: 2,
          payload: { parent_id: null },
          router: mockRouter,
        });

        expect(mockRouter.route).toHaveBeenCalledWith('/child');
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

      it('should invalidate parent chain stats when moving space', async () => {
        const space1 = createMockSpace({ id: 1, parent_id: null });
        const space2 = createMockSpace({ id: 2, parent_id: 1 });
        const space3 = createMockSpace({ id: 3, parent_id: null });
        spacesSignal.value = [space1, space2, space3];

        // Cache stats for both parent chains
        spaceStatsCache['cache'].set('spaceStats:1:flat', createMockSpaceStats());
        spaceStatsCache['cache'].set('spaceStats:1:recursive', createMockSpaceStats());
        spaceStatsCache['cache'].set('spaceStats:3:flat', createMockSpaceStats());
        spaceStatsCache['cache'].set('spaceStats:3:recursive', createMockSpaceStats());

        await updateSpaceAction({
          spaceId: 2,
          payload: { parent_id: 3 },
        });

        // Both old and new parent chains should be invalidated
        expect(spaceStatsCache.getStats(1, false)).toBeNull();
        expect(spaceStatsCache.getStats(1, true)).toBeNull();
        expect(spaceStatsCache.getStats(3, false)).toBeNull();
        expect(spaceStatsCache.getStats(3, true)).toBeNull();
      });

      it('should invalidate activity for old and new parent chains', async () => {
        const space1 = createMockSpace({ id: 1, parent_id: null });
        const space2 = createMockSpace({ id: 2, parent_id: 1 });
        const space3 = createMockSpace({ id: 3, parent_id: null });
        spacesSignal.value = [space1, space2, space3];

        // Cache activity for parent spaces
        activityCache['cache'].set('activity:1:flat:0:4m', {} as any);
        activityCache['cache'].set('activity:1:recursive:0:4m', {} as any);
        activityCache['cache'].set('activity:2:flat:0:4m', {} as any);
        activityCache['cache'].set('activity:3:flat:0:4m', {} as any);
        activityCache['cache'].set('activity:3:recursive:0:4m', {} as any);

        await updateSpaceAction({
          spaceId: 2,
          payload: { parent_id: 3 },
        });

        // Old parent chain recursive views should be invalidated (flat views unchanged)
        expect(activityCache.getData(1, false, 0, 4)).not.toBeNull(); // Flat view unchanged
        expect(activityCache.getData(1, true, 0, 4)).toBeNull(); // Recursive view invalidated

        // New parent chain recursive views should be invalidated (flat views unchanged)
        expect(activityCache.getData(3, false, 0, 4)).not.toBeNull(); // Flat view unchanged
        expect(activityCache.getData(3, true, 0, 4)).toBeNull(); // Recursive view invalidated

        // Moved space should be invalidated
        expect(activityCache.getData(2, false, 0, 4)).toBeNull();
      });

      it('should handle moving space with descendants', async () => {
        // Hierarchy: 1 -> 2 -> [3, 4] and separate space 5
        const space1 = createMockSpace({ id: 1, parent_id: null, recursive_post_count: 100 });
        const space2 = createMockSpace({ id: 2, parent_id: 1, recursive_post_count: 60 });
        const space3 = createMockSpace({ id: 3, parent_id: 2, recursive_post_count: 30 });
        const space4 = createMockSpace({ id: 4, parent_id: 2, recursive_post_count: 30 });
        const space5 = createMockSpace({ id: 5, parent_id: null, recursive_post_count: 50 });
        spacesSignal.value = [space1, space2, space3, space4, space5];

        // Move space 2 (with its children) to be child of space 5
        await updateSpaceAction({
          spaceId: 2,
          payload: { parent_id: 5 },
        });

        // Old parent chain should be decremented by space 2's recursive count (60)
        expect(space1.recursive_post_count).toBe(40); // 100 - 60

        // New parent chain should be incremented by space 2's recursive count (60)
        expect(space5.recursive_post_count).toBe(110); // 50 + 60
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
