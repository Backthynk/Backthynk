/**
 * Tests for Post Actions
 * Testing state management, cache invalidation, and smart refetch logic
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { deletePostAction, movePostAction } from '../postActions';
import { posts, resetPosts } from '../../state/posts';
import { spaces as spacesSignal } from '../../state/spaces';
import { spaceStatsCache } from '../../cache/spaceStatsCache';
import { activityCache } from '../../cache/activityCache';
import {
  createMockPost,
  createMockPostWithFiles,
  createMockPostWithLinks,
  createMockSpace,
  createMockActivityData,
  createMockSpaceStats,
  resetFactoryCounters,
} from '../../__tests__/factories';

// Mock the API calls
vi.mock('../../api/posts', () => ({
  deletePost: vi.fn(() => Promise.resolve()),
  movePost: vi.fn((postId: number, newSpaceId: number) => {
    const post = posts.value.find(p => p.id === postId);
    if (post) {
      return Promise.resolve({ ...post, space_id: newSpaceId });
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
}));

describe('Post Actions', () => {
  beforeEach(() => {
    resetPosts();
    resetFactoryCounters();
    spacesSignal.value = [];
    spaceStatsCache.clear();
    activityCache.clear();
    vi.clearAllMocks();
  });

  describe('deletePostAction', () => {
    describe('Text-only posts (no rich content)', () => {
      it('should update post_count and recursive_post_count in state', async () => {
        // Setup: Create space hierarchy: 1 -> 2 -> 3
        const space1 = createMockSpace({ id: 1, parent_id: null, post_count: 10, recursive_post_count: 30 });
        const space2 = createMockSpace({ id: 2, parent_id: 1, post_count: 15, recursive_post_count: 20 });
        const space3 = createMockSpace({ id: 3, parent_id: 2, post_count: 5, recursive_post_count: 5 });
        spacesSignal.value = [space1, space2, space3];

        // Create a text-only post in space 3
        const post = createMockPost({ id: 1, space_id: 3, content: 'Text only' });
        posts.value = [post];

        await deletePostAction({ postId: 1, spaceId: 3 });

        // Check counts were decremented
        expect(space3.post_count).toBe(4);
        expect(space3.recursive_post_count).toBe(4);
        expect(space2.recursive_post_count).toBe(19);
        expect(space1.recursive_post_count).toBe(29);

        // Post should be removed from state
        expect(posts.value.length).toBe(0);
      });

      it('should NOT invalidate space stats cache for text-only posts', async () => {
        const space = createMockSpace({ id: 1, post_count: 10, recursive_post_count: 10 });
        spacesSignal.value = [space];

        // Cache some stats in both cache and state
        const stats = createMockSpaceStats({ total_files: 5 });
        const { setSpaceStats } = await import('../../state/spaceStats');
        spaceStatsCache['cache'].set('spaceStats:1:flat', stats);
        setSpaceStats(1, false, stats);

        const post = createMockPost({ id: 1, space_id: 1 });
        posts.value = [post];

        await deletePostAction({ postId: 1, spaceId: 1 });

        // Stats should still be cached (not invalidated)
        expect(spaceStatsCache.getStats(1, false)).toEqual(stats);
      });

      it('should update activity cache directly for text-only posts', async () => {
        const space = createMockSpace({ id: 1, post_count: 10 });
        spacesSignal.value = [space];

        // Create activity cache with today having 5 posts
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const todayTimestamp = Math.floor(today.getTime() / 1000);

        const activityData = createMockActivityData(120);

        // Ensure today exists in the activity data
        let todayIndex = activityData.days.findIndex(d => d.date === todayStr);
        if (todayIndex === -1) {
          // Add today if not present
          activityData.days.push({ date: todayStr, count: 5 });
          todayIndex = activityData.days.length - 1;
        } else {
          activityData.days[todayIndex].count = 5;
        }

        // Recalculate stats
        activityData.stats.total_posts = activityData.days.reduce((sum, d) => sum + d.count, 0);

        activityCache['cache'].set('activity:1:flat:0:4m', JSON.parse(JSON.stringify(activityData)));

        const post = createMockPost({ id: 1, space_id: 1, created: todayTimestamp });
        posts.value = [post];

        await deletePostAction({ postId: 1, spaceId: 1 });

        // Activity count should be decremented (not invalidated)
        const updatedActivity = activityCache.getData(1, false, 0, 4);
        expect(updatedActivity).not.toBeNull();
        const updatedToday = updatedActivity!.days.find(d => d.date === todayStr);
        expect(updatedToday?.count).toBe(4); // 5 - 1
      });
    });

    describe('Posts with rich content (files/links)', () => {
      it('should invalidate space stats cache for posts with files', async () => {
        const space1 = createMockSpace({ id: 1, parent_id: null, post_count: 5, recursive_post_count: 10 });
        const space2 = createMockSpace({ id: 2, parent_id: 1, post_count: 5, recursive_post_count: 5 });
        spacesSignal.value = [space1, space2];

        // Cache stats
        spaceStatsCache['cache'].set('spaceStats:1:flat', createMockSpaceStats());
        spaceStatsCache['cache'].set('spaceStats:1:recursive', createMockSpaceStats());
        spaceStatsCache['cache'].set('spaceStats:2:flat', createMockSpaceStats());
        spaceStatsCache['cache'].set('spaceStats:2:recursive', createMockSpaceStats());

        const post = createMockPostWithFiles(2, { id: 1, space_id: 2 });
        posts.value = [post];

        await deletePostAction({ postId: 1, spaceId: 2 });

        // Stats for space 2 and its parent (1) should be invalidated
        expect(spaceStatsCache.getStats(2, false)).toBeNull();
        expect(spaceStatsCache.getStats(2, true)).toBeNull();
        expect(spaceStatsCache.getStats(1, false)).toBeNull();
        expect(spaceStatsCache.getStats(1, true)).toBeNull();
      });

      it('should invalidate space stats cache for posts with link previews', async () => {
        const space = createMockSpace({ id: 1, post_count: 5 });
        spacesSignal.value = [space];

        spaceStatsCache['cache'].set('spaceStats:1:flat', createMockSpaceStats());

        const post = createMockPostWithLinks(1, { id: 1, space_id: 1 });
        posts.value = [post];

        await deletePostAction({ postId: 1, spaceId: 1 });

        expect(spaceStatsCache.getStats(1, false)).toBeNull();
      });

      it('should still update activity cache directly even with rich content', async () => {
        const space = createMockSpace({ id: 1, post_count: 10 });
        spacesSignal.value = [space];

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const todayTimestamp = Math.floor(today.getTime() / 1000);

        const activityData = createMockActivityData(120);

        // Ensure today exists
        let todayIndex = activityData.days.findIndex(d => d.date === todayStr);
        if (todayIndex === -1) {
          activityData.days.push({ date: todayStr, count: 5 });
        } else {
          activityData.days[todayIndex].count = 5;
        }

        activityData.stats.total_posts = activityData.days.reduce((sum, d) => sum + d.count, 0);

        activityCache['cache'].set('activity:1:flat:0:4m', JSON.parse(JSON.stringify(activityData)));

        const post = createMockPostWithFiles(1, { id: 1, space_id: 1, created: todayTimestamp });
        posts.value = [post];

        await deletePostAction({ postId: 1, spaceId: 1 });

        const updatedActivity = activityCache.getData(1, false, 0, 4);
        const updatedToday = updatedActivity!.days.find(d => d.date === todayStr);
        expect(updatedToday?.count).toBe(4);
      });
    });

    describe('Recursive count propagation', () => {
      it('should propagate count changes through entire parent chain', async () => {
        // Deep hierarchy: 1 -> 2 -> 3 -> 4 -> 5
        const spaces = [
          createMockSpace({ id: 1, parent_id: null, recursive_post_count: 100 }),
          createMockSpace({ id: 2, parent_id: 1, recursive_post_count: 80 }),
          createMockSpace({ id: 3, parent_id: 2, recursive_post_count: 60 }),
          createMockSpace({ id: 4, parent_id: 3, recursive_post_count: 40 }),
          createMockSpace({ id: 5, parent_id: 4, post_count: 20, recursive_post_count: 20 }),
        ];
        spacesSignal.value = spaces;

        const post = createMockPost({ id: 1, space_id: 5 });
        posts.value = [post];

        await deletePostAction({ postId: 1, spaceId: 5 });

        // All ancestors should have recursive_post_count decremented
        expect(spaces[4].recursive_post_count).toBe(19); // Space 5
        expect(spaces[3].recursive_post_count).toBe(39); // Space 4
        expect(spaces[2].recursive_post_count).toBe(59); // Space 3
        expect(spaces[1].recursive_post_count).toBe(79); // Space 2
        expect(spaces[0].recursive_post_count).toBe(99); // Space 1
      });
    });
  });

  describe('movePostAction', () => {
    describe('Text-only posts', () => {
      it('should update counts in both old and new space chains', async () => {
        // Two separate chains: 1 -> 2 and 3 -> 4
        const space1 = createMockSpace({ id: 1, parent_id: null, recursive_post_count: 20 });
        const space2 = createMockSpace({ id: 2, parent_id: 1, post_count: 10, recursive_post_count: 10 });
        const space3 = createMockSpace({ id: 3, parent_id: null, recursive_post_count: 15 });
        const space4 = createMockSpace({ id: 4, parent_id: 3, post_count: 5, recursive_post_count: 5 });
        spacesSignal.value = [space1, space2, space3, space4];

        const post = createMockPost({ id: 1, space_id: 2 });
        posts.value = [post];

        // Move from space 2 to space 4
        await movePostAction({ postId: 1, newSpaceId: 4, currentSpaceId: 2 });

        // Old chain (1, 2) should be decremented
        expect(space2.post_count).toBe(9);
        expect(space2.recursive_post_count).toBe(9);
        expect(space1.recursive_post_count).toBe(19);

        // New chain (3, 4) should be incremented
        expect(space4.post_count).toBe(6);
        expect(space4.recursive_post_count).toBe(6);
        expect(space3.recursive_post_count).toBe(16);
      });

      it('should NOT invalidate stats cache for text-only posts', async () => {
        const space1 = createMockSpace({ id: 1, post_count: 10 });
        const space2 = createMockSpace({ id: 2, post_count: 5 });
        spacesSignal.value = [space1, space2];

        // Cache stats in both cache and state
        const { setSpaceStats } = await import('../../state/spaceStats');
        const stats1 = createMockSpaceStats();
        const stats2 = createMockSpaceStats();
        spaceStatsCache['cache'].set('spaceStats:1:flat', stats1);
        setSpaceStats(1, false, stats1);
        spaceStatsCache['cache'].set('spaceStats:2:flat', stats2);
        setSpaceStats(2, false, stats2);

        const post = createMockPost({ id: 1, space_id: 1 });
        posts.value = [post];

        await movePostAction({ postId: 1, newSpaceId: 2, currentSpaceId: 1 });

        // Stats should still be cached
        expect(spaceStatsCache.getStats(1, false)).not.toBeNull();
        expect(spaceStatsCache.getStats(2, false)).not.toBeNull();
      });

      it('should update activity cache for both spaces', async () => {
        const space1 = createMockSpace({ id: 1, post_count: 10 });
        const space2 = createMockSpace({ id: 2, post_count: 5 });
        spacesSignal.value = [space1, space2];

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const todayTimestamp = Math.floor(today.getTime() / 1000);

        // Setup activity for both spaces
        const activity1 = createMockActivityData(120);
        const activity2 = createMockActivityData(120);

        // Ensure today exists in both
        let todayIndex1 = activity1.days.findIndex(d => d.date === todayStr);
        if (todayIndex1 === -1) {
          activity1.days.push({ date: todayStr, count: 5 });
        } else {
          activity1.days[todayIndex1].count = 5;
        }

        let todayIndex2 = activity2.days.findIndex(d => d.date === todayStr);
        if (todayIndex2 === -1) {
          activity2.days.push({ date: todayStr, count: 3 });
        } else {
          activity2.days[todayIndex2].count = 3;
        }

        activityCache['cache'].set('activity:1:flat:0:4m', JSON.parse(JSON.stringify(activity1)));
        activityCache['cache'].set('activity:2:flat:0:4m', JSON.parse(JSON.stringify(activity2)));

        const post = createMockPost({ id: 1, space_id: 1, created: todayTimestamp });
        posts.value = [post];

        await movePostAction({ postId: 1, newSpaceId: 2, currentSpaceId: 1 });

        // Space 1 should be decremented
        const updated1 = activityCache.getData(1, false, 0, 4);
        expect(updated1!.days.find(d => d.date === todayStr)?.count).toBe(4);

        // Space 2 should be incremented
        const updated2 = activityCache.getData(2, false, 0, 4);
        expect(updated2!.days.find(d => d.date === todayStr)?.count).toBe(4);
      });
    });

    describe('Posts with rich content', () => {
      it('should invalidate stats for both parent chains', async () => {
        const space1 = createMockSpace({ id: 1, parent_id: null, recursive_post_count: 20 });
        const space2 = createMockSpace({ id: 2, parent_id: 1, post_count: 10, recursive_post_count: 10 });
        const space3 = createMockSpace({ id: 3, parent_id: null, recursive_post_count: 15 });
        const space4 = createMockSpace({ id: 4, parent_id: 3, post_count: 5, recursive_post_count: 5 });
        spacesSignal.value = [space1, space2, space3, space4];

        // Cache all stats
        [1, 2, 3, 4].forEach(id => {
          spaceStatsCache['cache'].set(`spaceStats:${id}:flat`, createMockSpaceStats());
          spaceStatsCache['cache'].set(`spaceStats:${id}:recursive`, createMockSpaceStats());
        });

        const post = createMockPostWithFiles(1, { id: 1, space_id: 2 });
        posts.value = [post];

        await movePostAction({ postId: 1, newSpaceId: 4, currentSpaceId: 2 });

        // Old chain (1, 2) should be invalidated
        expect(spaceStatsCache.getStats(1, false)).toBeNull();
        expect(spaceStatsCache.getStats(2, false)).toBeNull();

        // New chain (3, 4) should be invalidated
        expect(spaceStatsCache.getStats(3, false)).toBeNull();
        expect(spaceStatsCache.getStats(4, false)).toBeNull();
      });
    });
  });
});
