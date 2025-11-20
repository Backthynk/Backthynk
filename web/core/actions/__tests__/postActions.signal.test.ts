/**
 * Signal-level tests for Post Actions
 * Testing signal mutations and reference changes to ensure proper re-rendering
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { deletePostAction, movePostAction } from '../postActions';
import {
  type PostsQuery,
  getPostsForQuery,
  setPostsForQuery,
  resetPostsForQuery,
  postsByQuery,
} from '../../state/posts';
import { spaces as spacesSignal } from '../../state/spaces';
import { activityCache as activitySignal, activitySpaceId, activityRecursiveMode } from '../../state/activity';
import { activityCache } from '../../cache/activityCache';
import {
  createMockPost,
  createMockSpace,
  createMockActivityData,
  resetFactoryCounters,
} from '../../__tests__/factories';

// Mock the API calls
vi.mock('../../api/posts', () => ({
  deletePost: vi.fn(() => Promise.resolve()),
  movePost: vi.fn((postId: number, newSpaceId: number) => {
    // Search all queries for the post
    let foundPost = null;
    for (const posts of postsByQuery.value.values()) {
      foundPost = posts.find(p => p.id === postId);
      if (foundPost) break;
    }
    if (foundPost) {
      return Promise.resolve({ ...foundPost, space_id: newSpaceId });
    }
    return Promise.resolve(null);
  }),
}));

// Mock the components
vi.mock('../../components', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

// Mock executeAction to run immediately
vi.mock('../index', () => ({
  executeAction: vi.fn(async ({ execute, onSuccess }: any) => {
    const result = await execute();
    await onSuccess(result);
  }),
}));

// Mock cache functions
vi.mock('../../cache/postsCache', () => ({
  fetchPostsCached: vi.fn(() => Promise.resolve({ posts: [] })),
  postsCache: {
    removePostFromCache: vi.fn(),
    updatePostInCache: vi.fn(),
    addPostToCache: vi.fn(),
  },
}));

describe('Post Actions - Signal-level tests', () => {
  beforeEach(() => {
    // Reset all query-based state
    postsByQuery.value = new Map();
    resetFactoryCounters();
    spacesSignal.value = [];
    activityCache.clear();
    activitySignal.value = null;
    activitySpaceId.value = null;
    activityRecursiveMode.value = false;
    vi.clearAllMocks();
  });

  describe('deletePostAction - Signal mutations', () => {
    it('should create new space object references for proper re-rendering', async () => {
      // Setup: Create space hierarchy: 1 -> 2 -> 3
      const space1 = createMockSpace({ id: 1, parent_id: null, post_count: 10, recursive_post_count: 30 });
      const space2 = createMockSpace({ id: 2, parent_id: 1, post_count: 15, recursive_post_count: 20 });
      const space3 = createMockSpace({ id: 3, parent_id: 2, post_count: 5, recursive_post_count: 5 });
      spacesSignal.value = [space1, space2, space3];

      // Store references to original space objects
      const originalSpace1Ref = spacesSignal.value.find(s => s.id === 1);
      const originalSpace2Ref = spacesSignal.value.find(s => s.id === 2);
      const originalSpace3Ref = spacesSignal.value.find(s => s.id === 3);
      const originalSpacesArrayRef = spacesSignal.value;

      const post = createMockPost({ id: 1, space_id: 3, content: 'Text only' });
      const query: PostsQuery = { spaceId: 3, recursive: false };
      setPostsForQuery(query, [post]);

      await deletePostAction({ postId: 1, spaceId: 3 });

      // The spaces array reference should be NEW (signal mutation)
      expect(spacesSignal.value).not.toBe(originalSpacesArrayRef);

      // The updated space objects should have NEW references (not mutated in place)
      const updatedSpace1 = spacesSignal.value.find(s => s.id === 1);
      const updatedSpace2 = spacesSignal.value.find(s => s.id === 2);
      const updatedSpace3 = spacesSignal.value.find(s => s.id === 3);

      expect(updatedSpace3).not.toBe(originalSpace3Ref); // Direct space - NEW ref
      expect(updatedSpace2).not.toBe(originalSpace2Ref); // Parent - NEW ref
      expect(updatedSpace1).not.toBe(originalSpace1Ref); // Grandparent - NEW ref

      // Verify the values are correct
      expect(updatedSpace3!.post_count).toBe(4);
      expect(updatedSpace3!.recursive_post_count).toBe(4);
      expect(updatedSpace2!.recursive_post_count).toBe(19);
      expect(updatedSpace1!.recursive_post_count).toBe(29);
    });

    it('should update space 0 (All Spaces) with new reference', async () => {
      const space0 = createMockSpace({ id: 0, parent_id: null, post_count: 50, recursive_post_count: 50 });
      const space1 = createMockSpace({ id: 1, parent_id: null, post_count: 10, recursive_post_count: 10 });
      spacesSignal.value = [space0, space1];

      const originalSpace0Ref = spacesSignal.value.find(s => s.id === 0);
      const originalSpace1Ref = spacesSignal.value.find(s => s.id === 1);

      const post = createMockPost({ id: 1, space_id: 1 });
      const query: PostsQuery = { spaceId: 1, recursive: false };
      setPostsForQuery(query, [post]);

      await deletePostAction({ postId: 1, spaceId: 1 });

      const updatedSpace0 = spacesSignal.value.find(s => s.id === 0);
      const updatedSpace1 = spacesSignal.value.find(s => s.id === 1);

      // Both should have new references
      expect(updatedSpace0).not.toBe(originalSpace0Ref);
      expect(updatedSpace1).not.toBe(originalSpace1Ref);

      // Both should be decremented
      expect(updatedSpace0!.post_count).toBe(49);
      expect(updatedSpace0!.recursive_post_count).toBe(49);
      expect(updatedSpace1!.post_count).toBe(9);
      expect(updatedSpace1!.recursive_post_count).toBe(9);
    });

    it('should mutate activity signal with new reference when viewing the space', async () => {
      const space = createMockSpace({ id: 1, post_count: 10 });
      spacesSignal.value = [space];

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const todayTimestamp = today.getTime();

      const activityData = createMockActivityData(120);
      let todayIndex = activityData.days.findIndex(d => d.date === todayStr);
      if (todayIndex === -1) {
        activityData.days.push({ date: todayStr, count: 5 });
      } else {
        activityData.days[todayIndex].count = 5;
      }
      activityData.stats.total_posts = activityData.days.reduce((sum, d) => sum + d.count, 0);

      activityCache['cache'].set('activity:1:flat:0:4m', JSON.parse(JSON.stringify(activityData)));

      // Set viewing context to space 1, flat mode
      activitySpaceId.value = 1;
      activityRecursiveMode.value = false;

      const post = createMockPost({ id: 1, space_id: 1, created: todayTimestamp });
      const query: PostsQuery = { spaceId: 1, recursive: false };
      setPostsForQuery(query, [post]);

      // Store original reference
      const originalActivityRef = activitySignal.value;

      await deletePostAction({ postId: 1, spaceId: 1 });

      // Activity signal should have NEW reference
      expect(activitySignal.value).not.toBe(originalActivityRef);
      expect(activitySignal.value).not.toBeNull();

      // Verify the updated data
      const todayData = activitySignal.value!.days.find(d => d.date === todayStr);
      expect(todayData?.count).toBe(4); // 5 - 1
    });

    it('should mutate activity signal for space 0 when viewing All Spaces', async () => {
      const space0 = createMockSpace({ id: 0, parent_id: null, post_count: 50, recursive_post_count: 50 });
      const space1 = createMockSpace({ id: 1, parent_id: null, post_count: 10, recursive_post_count: 10 });
      spacesSignal.value = [space0, space1];

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const todayTimestamp = today.getTime();

      const activityData = createMockActivityData(120);
      let todayIndex = activityData.days.findIndex(d => d.date === todayStr);
      if (todayIndex === -1) {
        activityData.days.push({ date: todayStr, count: 50 });
      } else {
        activityData.days[todayIndex].count = 50;
      }
      activityData.stats.total_posts = activityData.days.reduce((sum, d) => sum + d.count, 0);

      activityCache['cache'].set('activity:0:flat:0:4m', JSON.parse(JSON.stringify(activityData)));

      // Set viewing context to space 0 (All Spaces), flat mode
      activitySpaceId.value = 0;
      activityRecursiveMode.value = false;

      const post = createMockPost({ id: 1, space_id: 1, created: todayTimestamp });
      const query: PostsQuery = { spaceId: 1, recursive: false };
      setPostsForQuery(query, [post]);

      await deletePostAction({ postId: 1, spaceId: 1 });

      // Activity signal should be updated for space 0
      expect(activitySignal.value).not.toBeNull();
      const todayData = activitySignal.value!.days.find(d => d.date === todayStr);
      expect(todayData?.count).toBe(49); // 50 - 1
    });

    it('should NOT mutate activity signal when viewing a different space', async () => {
      const space1 = createMockSpace({ id: 1, post_count: 10 });
      const space2 = createMockSpace({ id: 2, post_count: 5 });
      spacesSignal.value = [space1, space2];

      const today = new Date();
      const todayTimestamp = today.getTime();

      const activityData = createMockActivityData(120);
      activityCache['cache'].set('activity:1:flat:0:4m', JSON.parse(JSON.stringify(activityData)));

      // Set viewing context to space 2 (different from where we delete)
      activitySpaceId.value = 2;
      activityRecursiveMode.value = false;
      activitySignal.value = null;

      const post = createMockPost({ id: 1, space_id: 1, created: todayTimestamp });
      const query: PostsQuery = { spaceId: 1, recursive: false };
      setPostsForQuery(query, [post]);

      await deletePostAction({ postId: 1, spaceId: 1 });

      // Activity signal should remain null (we're viewing space 2, not 1)
      expect(activitySignal.value).toBeNull();

      // But the cache should still be updated
      const updatedCache = activityCache.getData(1, false, 0, 4);
      expect(updatedCache).not.toBeNull();
    });

    it('should update space 0 when deleting in All Spaces mode (spaceId null)', async () => {
      const space0 = createMockSpace({ id: 0, parent_id: null, post_count: 100, recursive_post_count: 100 });
      const space1 = createMockSpace({ id: 1, parent_id: null, post_count: 50, recursive_post_count: 50 });
      spacesSignal.value = [space0, space1];

      const originalSpace0Ref = spacesSignal.value.find(s => s.id === 0);
      const originalSpace1Ref = spacesSignal.value.find(s => s.id === 1);

      const post = createMockPost({ id: 1, space_id: 1 });
      const query: PostsQuery = { spaceId: null, recursive: false };
      setPostsForQuery(query, [post]);

      // Delete with spaceId = null (All Spaces view)
      await deletePostAction({ postId: 1, spaceId: null });

      const updatedSpace0 = spacesSignal.value.find(s => s.id === 0);
      const updatedSpace1 = spacesSignal.value.find(s => s.id === 1);

      // Both spaces should have new references
      expect(updatedSpace0).not.toBe(originalSpace0Ref);
      expect(updatedSpace1).not.toBe(originalSpace1Ref);

      // Space 0 should be decremented
      expect(updatedSpace0!.post_count).toBe(99);
      expect(updatedSpace0!.recursive_post_count).toBe(99);

      // Space 1 (where the post actually belongs) should also be decremented
      expect(updatedSpace1!.post_count).toBe(49);
      expect(updatedSpace1!.recursive_post_count).toBe(49);
    });

    it('should update space 0 activity when deleting in All Spaces mode and viewing space 0', async () => {
      const space0 = createMockSpace({ id: 0, parent_id: null, post_count: 100, recursive_post_count: 100 });
      const space1 = createMockSpace({ id: 1, parent_id: null, post_count: 50, recursive_post_count: 50 });
      spacesSignal.value = [space0, space1];

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const todayTimestamp = today.getTime();

      const activityData = createMockActivityData(120);
      let todayIndex = activityData.days.findIndex(d => d.date === todayStr);
      if (todayIndex === -1) {
        activityData.days.push({ date: todayStr, count: 100 });
      } else {
        activityData.days[todayIndex].count = 100;
      }
      activityData.stats.total_posts = activityData.days.reduce((sum, d) => sum + d.count, 0);

      activityCache['cache'].set('activity:0:flat:0:4m', JSON.parse(JSON.stringify(activityData)));

      // Set viewing context to space 0 (All Spaces)
      activitySpaceId.value = 0;
      activityRecursiveMode.value = false;

      const post = createMockPost({ id: 1, space_id: 1, created: todayTimestamp });
      const query: PostsQuery = { spaceId: null, recursive: false };
      setPostsForQuery(query, [post]);

      // Delete with spaceId = null (All Spaces view)
      await deletePostAction({ postId: 1, spaceId: null });

      // Activity signal should be updated
      expect(activitySignal.value).not.toBeNull();
      const todayData = activitySignal.value!.days.find(d => d.date === todayStr);
      expect(todayData?.count).toBe(99); // 100 - 1
    });

    it('should update activity for all parent spaces in the chain', async () => {
      // Hierarchy: 1 -> 2 -> 3
      const space1 = createMockSpace({ id: 1, parent_id: null, post_count: 30, recursive_post_count: 30 });
      const space2 = createMockSpace({ id: 2, parent_id: 1, post_count: 20, recursive_post_count: 20 });
      const space3 = createMockSpace({ id: 3, parent_id: 2, post_count: 10, recursive_post_count: 10 });
      spacesSignal.value = [space1, space2, space3];

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const todayTimestamp = today.getTime();

      // Create activity data for all spaces
      for (const spaceId of [1, 2, 3]) {
        const activityData = createMockActivityData(120);
        let todayIndex = activityData.days.findIndex(d => d.date === todayStr);
        if (todayIndex === -1) {
          activityData.days.push({ date: todayStr, count: 10 });
        } else {
          activityData.days[todayIndex].count = 10;
        }
        activityData.stats.total_posts = activityData.days.reduce((sum, d) => sum + d.count, 0);

        // Cache for both flat and recursive
        activityCache['cache'].set(`activity:${spaceId}:flat:0:4m`, JSON.parse(JSON.stringify(activityData)));
        activityCache['cache'].set(`activity:${spaceId}:recursive:0:4m`, JSON.parse(JSON.stringify(activityData)));
      }

      const post = createMockPost({ id: 1, space_id: 3, created: todayTimestamp });
      const query: PostsQuery = { spaceId: 3, recursive: false };
      setPostsForQuery(query, [post]);

      await deletePostAction({ postId: 1, spaceId: 3 });

      // All spaces in the chain should have updated activity cache
      for (const spaceId of [1, 2, 3]) {
        const flatData = activityCache.getData(spaceId, false, 0, 4);
        const recursiveData = activityCache.getData(spaceId, true, 0, 4);

        expect(flatData).not.toBeNull();
        expect(recursiveData).not.toBeNull();

        const flatTodayCount = flatData!.days.find(d => d.date === todayStr)?.count;
        const recursiveTodayCount = recursiveData!.days.find(d => d.date === todayStr)?.count;

        // Note: Current implementation updates both flat and recursive for all spaces in the chain
        // This is correct because updateActivityDayCount is called for each space separately
        // Each space's cache is updated as if the post belonged directly to that space
        expect(flatTodayCount).toBe(9); // 10 - 1
        expect(recursiveTodayCount).toBe(9); // 10 - 1
      }
    });
  });

  describe('movePostAction - Signal mutations', () => {
    it('should create new space object references when moving posts', async () => {
      // Two separate chains: 1 -> 2 and 3 -> 4
      const space1 = createMockSpace({ id: 1, parent_id: null, recursive_post_count: 20 });
      const space2 = createMockSpace({ id: 2, parent_id: 1, post_count: 10, recursive_post_count: 10 });
      const space3 = createMockSpace({ id: 3, parent_id: null, recursive_post_count: 15 });
      const space4 = createMockSpace({ id: 4, parent_id: 3, post_count: 5, recursive_post_count: 5 });
      spacesSignal.value = [space1, space2, space3, space4];

      // Store original references
      const originalRefs = new Map([
        [1, spacesSignal.value.find(s => s.id === 1)],
        [2, spacesSignal.value.find(s => s.id === 2)],
        [3, spacesSignal.value.find(s => s.id === 3)],
        [4, spacesSignal.value.find(s => s.id === 4)],
      ]);

      const post = createMockPost({ id: 1, space_id: 2 });
      const query: PostsQuery = { spaceId: 2, recursive: false };
      setPostsForQuery(query, [post]);

      await movePostAction({ postId: 1, newSpaceId: 4, currentSpaceId: 2 });

      // All affected spaces should have new references
      const updatedSpace1 = spacesSignal.value.find(s => s.id === 1);
      const updatedSpace2 = spacesSignal.value.find(s => s.id === 2);
      const updatedSpace3 = spacesSignal.value.find(s => s.id === 3);
      const updatedSpace4 = spacesSignal.value.find(s => s.id === 4);

      expect(updatedSpace1).not.toBe(originalRefs.get(1));
      expect(updatedSpace2).not.toBe(originalRefs.get(2));
      expect(updatedSpace3).not.toBe(originalRefs.get(3));
      expect(updatedSpace4).not.toBe(originalRefs.get(4));

      // Verify counts
      expect(updatedSpace2!.post_count).toBe(9); // decremented
      expect(updatedSpace1!.recursive_post_count).toBe(19); // decremented
      expect(updatedSpace4!.post_count).toBe(6); // incremented
      expect(updatedSpace3!.recursive_post_count).toBe(16); // incremented
    });

    it('should NOT update space 0 counts on move (post stays in system)', async () => {
      const space0 = createMockSpace({ id: 0, parent_id: null, post_count: 50, recursive_post_count: 50 });
      const space1 = createMockSpace({ id: 1, post_count: 10 });
      const space2 = createMockSpace({ id: 2, post_count: 5 });
      spacesSignal.value = [space0, space1, space2];

      const originalSpace0Ref = spacesSignal.value.find(s => s.id === 0);

      const post = createMockPost({ id: 1, space_id: 1 });
      const query: PostsQuery = { spaceId: 1, recursive: false };
      setPostsForQuery(query, [post]);

      await movePostAction({ postId: 1, newSpaceId: 2, currentSpaceId: 1 });

      const updatedSpace0 = spacesSignal.value.find(s => s.id === 0);

      // Space 0 should have the SAME reference (no changes on move)
      expect(updatedSpace0).toBe(originalSpace0Ref);
      expect(updatedSpace0!.post_count).toBe(50); // unchanged
      expect(updatedSpace0!.recursive_post_count).toBe(50); // unchanged
    });

    it('should mutate activity signals for both old and new spaces', async () => {
      const space1 = createMockSpace({ id: 1, post_count: 10 });
      const space2 = createMockSpace({ id: 2, post_count: 5 });
      spacesSignal.value = [space1, space2];

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const todayTimestamp = today.getTime();

      // Create activity data for both spaces
      for (const spaceId of [1, 2]) {
        const activityData = createMockActivityData(120);
        let todayIndex = activityData.days.findIndex(d => d.date === todayStr);
        if (todayIndex === -1) {
          activityData.days.push({ date: todayStr, count: spaceId === 1 ? 5 : 3 });
        } else {
          activityData.days[todayIndex].count = spaceId === 1 ? 5 : 3;
        }
        activityData.stats.total_posts = activityData.days.reduce((sum, d) => sum + d.count, 0);
        activityCache['cache'].set(`activity:${spaceId}:flat:0:4m`, JSON.parse(JSON.stringify(activityData)));
      }

      const post = createMockPost({ id: 1, space_id: 1, created: todayTimestamp });
      const query: PostsQuery = { spaceId: 1, recursive: false };
      setPostsForQuery(query, [post]);

      await movePostAction({ postId: 1, newSpaceId: 2, currentSpaceId: 1 });

      // Both spaces should have updated activity
      const updated1 = activityCache.getData(1, false, 0, 4);
      const updated2 = activityCache.getData(2, false, 0, 4);

      expect(updated1!.days.find(d => d.date === todayStr)?.count).toBe(4); // 5 - 1
      expect(updated2!.days.find(d => d.date === todayStr)?.count).toBe(4); // 3 + 1
    });
  });

  describe('Posts signal mutations', () => {
    it('should remove post from signal on delete', async () => {
      const space = createMockSpace({ id: 1, post_count: 10 });
      spacesSignal.value = [space];

      const post1 = createMockPost({ id: 1, space_id: 1 });
      const post2 = createMockPost({ id: 2, space_id: 1 });
      const query: PostsQuery = { spaceId: 1, recursive: false };
      setPostsForQuery(query, [post1, post2]);

      const originalPostsRef = getPostsForQuery(query);

      await deletePostAction({ postId: 1, spaceId: 1 });

      // Posts array should have new reference
      const updatedPosts = getPostsForQuery(query);
      expect(updatedPosts).not.toBe(originalPostsRef);
      expect(updatedPosts.length).toBe(1);
      expect(updatedPosts[0].id).toBe(2);
    });

    it('should update post in signal on move', async () => {
      const space1 = createMockSpace({ id: 1, post_count: 10 });
      const space2 = createMockSpace({ id: 2, post_count: 5 });
      spacesSignal.value = [space1, space2];

      const post = createMockPost({ id: 1, space_id: 1 });
      const query: PostsQuery = { spaceId: 1, recursive: true };
      setPostsForQuery(query, [post]);

      const originalPostRef = getPostsForQuery(query)[0];

      await movePostAction({ postId: 1, newSpaceId: 2, currentSpaceId: 1, recursive: true });

      // Post should have new reference with updated space_id
      const updatedPosts = getPostsForQuery(query);
      expect(updatedPosts[0]).not.toBe(originalPostRef);
      expect(updatedPosts[0].space_id).toBe(2);
    });
  });
});
