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

        // Check counts were decremented - read from signal, not old references
        const updatedSpace3 = spacesSignal.value.find(s => s.id === 3)!;
        const updatedSpace2 = spacesSignal.value.find(s => s.id === 2)!;
        const updatedSpace1 = spacesSignal.value.find(s => s.id === 1)!;

        expect(updatedSpace3.post_count).toBe(4);
        expect(updatedSpace3.recursive_post_count).toBe(4);
        expect(updatedSpace2.recursive_post_count).toBe(19);
        expect(updatedSpace1.recursive_post_count).toBe(29);

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
        const todayTimestamp = today.getTime();

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
        const todayTimestamp = today.getTime();

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

        // All ancestors should have recursive_post_count decremented - read from signal
        const updated = spacesSignal.value;
        expect(updated.find(s => s.id === 5)!.recursive_post_count).toBe(19); // Space 5
        expect(updated.find(s => s.id === 4)!.recursive_post_count).toBe(39); // Space 4
        expect(updated.find(s => s.id === 3)!.recursive_post_count).toBe(59); // Space 3
        expect(updated.find(s => s.id === 2)!.recursive_post_count).toBe(79); // Space 2
        expect(updated.find(s => s.id === 1)!.recursive_post_count).toBe(99); // Space 1
      });

      it('should update child space when deleting from parent in recursive mode', async () => {
        // Scenario: viewing /backthynk in recursive mode, delete post from /backthynk/ideas
        // Both backthynk AND ideas should be updated
        const backthynk = createMockSpace({ id: 1, parent_id: null, post_count: 10, recursive_post_count: 30 });
        const ideas = createMockSpace({ id: 2, parent_id: 1, post_count: 20, recursive_post_count: 20 });
        spacesSignal.value = [backthynk, ideas];

        // Post belongs to ideas (child space)
        const post = createMockPost({ id: 1, space_id: 2 });
        posts.value = [post];

        // Delete while viewing backthynk (parent) with recursive mode
        // NOTE: spaceId is the viewing context (backthynk), but post is in ideas
        await deletePostAction({ postId: 1, spaceId: 1, recursive: true });

        const updated = spacesSignal.value;
        const updatedBackthynk = updated.find(s => s.id === 1)!;
        const updatedIdeas = updated.find(s => s.id === 2)!;

        // Child space (ideas) should be updated - this is the key fix!
        expect(updatedIdeas.post_count).toBe(19); // 20 - 1
        expect(updatedIdeas.recursive_post_count).toBe(19); // 20 - 1

        // Parent space (backthynk) should also be updated
        expect(updatedBackthynk.recursive_post_count).toBe(29); // 30 - 1
      });

      it('should update child space activity when deleting from parent in recursive mode', async () => {
        const backthynk = createMockSpace({ id: 1, parent_id: null, post_count: 10, recursive_post_count: 30 });
        const ideas = createMockSpace({ id: 2, parent_id: 1, post_count: 20, recursive_post_count: 20 });
        spacesSignal.value = [backthynk, ideas];

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const todayTimestamp = today.getTime();

        // Create activity for both spaces
        const activityBackthynk = createMockActivityData(120);
        const activityIdeas = createMockActivityData(120);

        let todayIndex1 = activityBackthynk.days.findIndex(d => d.date === todayStr);
        if (todayIndex1 === -1) {
          activityBackthynk.days.push({ date: todayStr, count: 10 });
        } else {
          activityBackthynk.days[todayIndex1].count = 10;
        }
        activityBackthynk.stats.total_posts = activityBackthynk.days.reduce((sum, d) => sum + d.count, 0);

        let todayIndex2 = activityIdeas.days.findIndex(d => d.date === todayStr);
        if (todayIndex2 === -1) {
          activityIdeas.days.push({ date: todayStr, count: 20 });
        } else {
          activityIdeas.days[todayIndex2].count = 20;
        }
        activityIdeas.stats.total_posts = activityIdeas.days.reduce((sum, d) => sum + d.count, 0);

        activityCache['cache'].set('activity:1:flat:0:4m', JSON.parse(JSON.stringify(activityBackthynk)));
        activityCache['cache'].set('activity:1:recursive:0:4m', JSON.parse(JSON.stringify(activityBackthynk)));
        activityCache['cache'].set('activity:2:flat:0:4m', JSON.parse(JSON.stringify(activityIdeas)));
        activityCache['cache'].set('activity:2:recursive:0:4m', JSON.parse(JSON.stringify(activityIdeas)));

        // Post belongs to ideas
        const post = createMockPost({ id: 1, space_id: 2, created: todayTimestamp });
        posts.value = [post];

        // Delete while viewing backthynk in recursive mode
        await deletePostAction({ postId: 1, spaceId: 1, recursive: true });

        // Child space (ideas) activity should be updated
        const updatedIdeasActivity = activityCache.getData(2, false, 0, 4);
        expect(updatedIdeasActivity).not.toBeNull();
        const updatedIdeasToday = updatedIdeasActivity!.days.find(d => d.date === todayStr);
        expect(updatedIdeasToday?.count).toBe(19); // 20 - 1

        // Parent space (backthynk) recursive activity should also be updated
        const updatedBackthynkRecursiveActivity = activityCache.getData(1, true, 0, 4);
        expect(updatedBackthynkRecursiveActivity).not.toBeNull();
        const updatedBackthynkToday = updatedBackthynkRecursiveActivity!.days.find(d => d.date === todayStr);
        expect(updatedBackthynkToday?.count).toBe(9); // 10 - 1
      });
    });

    describe('Space 0 (All Spaces) updates', () => {
      it('should update space 0 post counts when deleting a post from a specific space', async () => {
        const space0 = createMockSpace({ id: 0, parent_id: null, post_count: 100, recursive_post_count: 100 });
        const space1 = createMockSpace({ id: 1, parent_id: null, post_count: 50, recursive_post_count: 50 });
        const space2 = createMockSpace({ id: 2, parent_id: null, post_count: 50, recursive_post_count: 50 });
        spacesSignal.value = [space0, space1, space2];

        const post = createMockPost({ id: 1, space_id: 1 });
        posts.value = [post];

        await deletePostAction({ postId: 1, spaceId: 1 });

        const updated = spacesSignal.value;
        const updatedSpace0 = updated.find(s => s.id === 0)!;
        const updatedSpace1 = updated.find(s => s.id === 1)!;

        // Space 0 should be decremented
        expect(updatedSpace0.post_count).toBe(99);
        expect(updatedSpace0.recursive_post_count).toBe(99);

        // Space 1 should also be decremented
        expect(updatedSpace1.post_count).toBe(49);
        expect(updatedSpace1.recursive_post_count).toBe(49);
      });

      it('should update space 0 activity when deleting a post from a specific space', async () => {
        const space0 = createMockSpace({ id: 0, parent_id: null, post_count: 100, recursive_post_count: 100 });
        const space1 = createMockSpace({ id: 1, parent_id: null, post_count: 50, recursive_post_count: 50 });
        spacesSignal.value = [space0, space1];

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const todayTimestamp = today.getTime();

        // Create activity data for space 0
        const activityData = createMockActivityData(120);
        let todayIndex = activityData.days.findIndex(d => d.date === todayStr);
        if (todayIndex === -1) {
          activityData.days.push({ date: todayStr, count: 100 });
        } else {
          activityData.days[todayIndex].count = 100;
        }
        activityData.stats.total_posts = activityData.days.reduce((sum, d) => sum + d.count, 0);

        activityCache['cache'].set('activity:0:flat:0:4m', JSON.parse(JSON.stringify(activityData)));

        const post = createMockPost({ id: 1, space_id: 1, created: todayTimestamp });
        posts.value = [post];

        await deletePostAction({ postId: 1, spaceId: 1 });

        // Space 0 activity should be decremented
        const updatedActivity = activityCache.getData(0, false, 0, 4);
        expect(updatedActivity).not.toBeNull();
        const updatedToday = updatedActivity!.days.find(d => d.date === todayStr);
        expect(updatedToday?.count).toBe(99); // 100 - 1
      });

      it('should update space 0 when deleting in All Spaces mode (spaceId null)', async () => {
        const space0 = createMockSpace({ id: 0, parent_id: null, post_count: 100, recursive_post_count: 100 });
        const space1 = createMockSpace({ id: 1, parent_id: null, post_count: 50, recursive_post_count: 50 });
        spacesSignal.value = [space0, space1];

        const post = createMockPost({ id: 1, space_id: 1 });
        posts.value = [post];

        // Delete with spaceId = null (All Spaces view)
        await deletePostAction({ postId: 1, spaceId: null });

        const updated = spacesSignal.value;
        const updatedSpace0 = updated.find(s => s.id === 0)!;
        const updatedSpace1 = updated.find(s => s.id === 1)!;

        // Space 0 should be decremented even when spaceId is null
        expect(updatedSpace0.post_count).toBe(99);
        expect(updatedSpace0.recursive_post_count).toBe(99);

        // Space 1 (where the post actually belongs) should also be decremented
        expect(updatedSpace1.post_count).toBe(49);
        expect(updatedSpace1.recursive_post_count).toBe(49);
      });

      it('should update space 0 activity when deleting in All Spaces mode (spaceId null)', async () => {
        const space0 = createMockSpace({ id: 0, parent_id: null, post_count: 100, recursive_post_count: 100 });
        const space1 = createMockSpace({ id: 1, parent_id: null, post_count: 50, recursive_post_count: 50 });
        spacesSignal.value = [space0, space1];

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const todayTimestamp = today.getTime();

        // Create activity for both space 0 and space 1
        const activityData0 = createMockActivityData(120);
        const activityData1 = createMockActivityData(120);

        let todayIndex0 = activityData0.days.findIndex(d => d.date === todayStr);
        if (todayIndex0 === -1) {
          activityData0.days.push({ date: todayStr, count: 100 });
        } else {
          activityData0.days[todayIndex0].count = 100;
        }
        activityData0.stats.total_posts = activityData0.days.reduce((sum, d) => sum + d.count, 0);

        let todayIndex1 = activityData1.days.findIndex(d => d.date === todayStr);
        if (todayIndex1 === -1) {
          activityData1.days.push({ date: todayStr, count: 50 });
        } else {
          activityData1.days[todayIndex1].count = 50;
        }
        activityData1.stats.total_posts = activityData1.days.reduce((sum, d) => sum + d.count, 0);

        activityCache['cache'].set('activity:0:flat:0:4m', JSON.parse(JSON.stringify(activityData0)));
        activityCache['cache'].set('activity:1:flat:0:4m', JSON.parse(JSON.stringify(activityData1)));

        const post = createMockPost({ id: 1, space_id: 1, created: todayTimestamp });
        posts.value = [post];

        // Delete with spaceId = null (All Spaces view)
        await deletePostAction({ postId: 1, spaceId: null });

        // Space 0 activity should be decremented
        const updatedActivity0 = activityCache.getData(0, false, 0, 4);
        expect(updatedActivity0).not.toBeNull();
        const updatedToday0 = updatedActivity0!.days.find(d => d.date === todayStr);
        expect(updatedToday0?.count).toBe(99); // 100 - 1

        // Space 1 activity should also be decremented
        const updatedActivity1 = activityCache.getData(1, false, 0, 4);
        expect(updatedActivity1).not.toBeNull();
        const updatedToday1 = updatedActivity1!.days.find(d => d.date === todayStr);
        expect(updatedToday1?.count).toBe(49); // 50 - 1
      });

      it('should update space 0 when deleting in All Spaces mode (spaceId undefined)', async () => {
        const space0 = createMockSpace({ id: 0, parent_id: null, post_count: 100, recursive_post_count: 100 });
        const space1 = createMockSpace({ id: 1, parent_id: null, post_count: 50, recursive_post_count: 50 });
        spacesSignal.value = [space0, space1];

        const post = createMockPost({ id: 1, space_id: 1 });
        posts.value = [post];

        // Delete with spaceId = undefined (All Spaces view)
        await deletePostAction({ postId: 1, spaceId: undefined });

        const updated = spacesSignal.value;
        const updatedSpace0 = updated.find(s => s.id === 0)!;
        const updatedSpace1 = updated.find(s => s.id === 1)!;

        // Space 0 should be decremented even when spaceId is undefined
        expect(updatedSpace0.post_count).toBe(99);
        expect(updatedSpace0.recursive_post_count).toBe(99);

        // Space 1 (where the post actually belongs) should also be decremented
        expect(updatedSpace1.post_count).toBe(49);
        expect(updatedSpace1.recursive_post_count).toBe(49);
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

        // Read updated spaces from signal
        const updated = spacesSignal.value;
        const updatedSpace1 = updated.find(s => s.id === 1)!;
        const updatedSpace2 = updated.find(s => s.id === 2)!;
        const updatedSpace3 = updated.find(s => s.id === 3)!;
        const updatedSpace4 = updated.find(s => s.id === 4)!;

        // Old chain (1, 2) should be decremented
        expect(updatedSpace2.post_count).toBe(9);
        expect(updatedSpace2.recursive_post_count).toBe(9);
        expect(updatedSpace1.recursive_post_count).toBe(19);

        // New chain (3, 4) should be incremented
        expect(updatedSpace4.post_count).toBe(6);
        expect(updatedSpace4.recursive_post_count).toBe(6);
        expect(updatedSpace3.recursive_post_count).toBe(16);
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
        const todayTimestamp = today.getTime();

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

      it('should invalidate activity for destination space when cache does not exist', async () => {
        const space1 = createMockSpace({ id: 1, post_count: 10 });
        const space2 = createMockSpace({ id: 2, post_count: 5 });
        spacesSignal.value = [space1, space2];

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const todayTimestamp = today.getTime();

        // Only cache activity for space 1 (source), not space 2 (destination)
        const activity1 = createMockActivityData(120);
        let todayIndex1 = activity1.days.findIndex(d => d.date === todayStr);
        if (todayIndex1 === -1) {
          activity1.days.push({ date: todayStr, count: 5 });
        } else {
          activity1.days[todayIndex1].count = 5;
        }
        activityCache['cache'].set('activity:1:flat:0:4m', JSON.parse(JSON.stringify(activity1)));

        // Space 2 has NO cached activity

        const post = createMockPost({ id: 1, space_id: 1, created: todayTimestamp });
        posts.value = [post];

        await movePostAction({ postId: 1, newSpaceId: 2, currentSpaceId: 1 });

        // Space 1 should be decremented
        const updated1 = activityCache.getData(1, false, 0, 4);
        expect(updated1!.days.find(d => d.date === todayStr)?.count).toBe(4);

        // Space 2 should still be null (invalidated, will fetch fresh on next view)
        const updated2 = activityCache.getData(2, false, 0, 4);
        expect(updated2).toBeNull();
      });

      it('should update activity for parent chains when moving between hierarchies', async () => {
        // Two hierarchies: 1 -> 2 and 3 -> 4
        const space1 = createMockSpace({ id: 1, parent_id: null, recursive_post_count: 20 });
        const space2 = createMockSpace({ id: 2, parent_id: 1, post_count: 10, recursive_post_count: 10 });
        const space3 = createMockSpace({ id: 3, parent_id: null, recursive_post_count: 15 });
        const space4 = createMockSpace({ id: 4, parent_id: 3, post_count: 5, recursive_post_count: 5 });
        spacesSignal.value = [space1, space2, space3, space4];

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const todayTimestamp = today.getTime();

        // Setup activity for all spaces
        [1, 2, 3, 4].forEach(id => {
          const activity = createMockActivityData(120);
          let todayIndex = activity.days.findIndex(d => d.date === todayStr);
          if (todayIndex === -1) {
            activity.days.push({ date: todayStr, count: 5 });
          } else {
            activity.days[todayIndex].count = 5;
          }
          activityCache['cache'].set(`activity:${id}:flat:0:4m`, JSON.parse(JSON.stringify(activity)));
          activityCache['cache'].set(`activity:${id}:recursive:0:4m`, JSON.parse(JSON.stringify(activity)));
        });

        const post = createMockPost({ id: 1, space_id: 2, created: todayTimestamp });
        posts.value = [post];

        // Move post from space 2 (under 1) to space 4 (under 3)
        await movePostAction({ postId: 1, newSpaceId: 4, currentSpaceId: 2 });

        // Old hierarchy (1, 2) should be decremented
        const updated1Flat = activityCache.getData(1, false, 0, 4);
        const updated1Recursive = activityCache.getData(1, true, 0, 4);
        const updated2Flat = activityCache.getData(2, false, 0, 4);

        expect(updated2Flat!.days.find(d => d.date === todayStr)?.count).toBe(4); // 5 - 1
        expect(updated1Flat!.days.find(d => d.date === todayStr)?.count).toBe(4); // parent flat view decremented
        expect(updated1Recursive!.days.find(d => d.date === todayStr)?.count).toBe(4); // parent recursive decremented

        // New hierarchy (3, 4) should be incremented
        const updated3Flat = activityCache.getData(3, false, 0, 4);
        const updated3Recursive = activityCache.getData(3, true, 0, 4);
        const updated4Flat = activityCache.getData(4, false, 0, 4);

        expect(updated4Flat!.days.find(d => d.date === todayStr)?.count).toBe(6); // 5 + 1
        expect(updated3Flat!.days.find(d => d.date === todayStr)?.count).toBe(6); // parent flat view incremented
        expect(updated3Recursive!.days.find(d => d.date === todayStr)?.count).toBe(6); // parent recursive incremented
      });

      it('should invalidate destination when only source has cached activity', async () => {
        // Only source space has cached activity, destination does not
        const space1 = createMockSpace({ id: 1, post_count: 10 });
        const space2 = createMockSpace({ id: 2, post_count: 5 });
        spacesSignal.value = [space1, space2];

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const todayTimestamp = today.getTime();

        // Only cache activity for space 1
        const activity1 = createMockActivityData(120);
        let todayIndex1 = activity1.days.findIndex(d => d.date === todayStr);
        if (todayIndex1 === -1) {
          activity1.days.push({ date: todayStr, count: 5 });
        } else {
          activity1.days[todayIndex1].count = 5;
        }
        activityCache['cache'].set('activity:1:flat:0:4m', JSON.parse(JSON.stringify(activity1)));
        activityCache['cache'].set('activity:1:recursive:0:4m', JSON.parse(JSON.stringify(activity1)));

        // Space 2 has NO cached activity

        const post = createMockPost({ id: 1, space_id: 1, created: todayTimestamp });
        posts.value = [post];

        await movePostAction({ postId: 1, newSpaceId: 2, currentSpaceId: 1 });

        // Source should be updated
        const updated1 = activityCache.getData(1, false, 0, 4);
        expect(updated1!.days.find(d => d.date === todayStr)?.count).toBe(4);

        // Destination should be null (was invalidated because no cache existed)
        const updated2 = activityCache.getData(2, false, 0, 4);
        expect(updated2).toBeNull();
      });

      it('should invalidate destination parent when parent has no cached activity', async () => {
        // Destination has activity, but its parent does not
        const space1 = createMockSpace({ id: 1, parent_id: null, post_count: 10 });
        const space2 = createMockSpace({ id: 2, parent_id: null, post_count: 5 });
        const space3 = createMockSpace({ id: 3, parent_id: 2, post_count: 3 });
        spacesSignal.value = [space1, space2, space3];

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const todayTimestamp = today.getTime();

        // Cache activity for spaces 1 and 3, but NOT space 2 (parent of 3)
        [1, 3].forEach(id => {
          const activity = createMockActivityData(120);
          let todayIndex = activity.days.findIndex(d => d.date === todayStr);
          if (todayIndex === -1) {
            activity.days.push({ date: todayStr, count: 5 });
          } else {
            activity.days[todayIndex].count = 5;
          }
          activityCache['cache'].set(`activity:${id}:flat:0:4m`, JSON.parse(JSON.stringify(activity)));
          activityCache['cache'].set(`activity:${id}:recursive:0:4m`, JSON.parse(JSON.stringify(activity)));
        });

        const post = createMockPost({ id: 1, space_id: 1, created: todayTimestamp });
        posts.value = [post];

        // Move from 1 to 3 (which has parent 2)
        await movePostAction({ postId: 1, newSpaceId: 3, currentSpaceId: 1 });

        // Source should be updated
        const updated1 = activityCache.getData(1, false, 0, 4);
        expect(updated1!.days.find(d => d.date === todayStr)?.count).toBe(4);

        // Destination should be updated
        const updated3 = activityCache.getData(3, false, 0, 4);
        expect(updated3!.days.find(d => d.date === todayStr)?.count).toBe(6);

        // Parent (2) should be null (was invalidated because no cache existed)
        const updated2 = activityCache.getData(2, false, 0, 4);
        expect(updated2).toBeNull();
      });

      it('should handle moving between deep hierarchies with partial cache', async () => {
        // Deep hierarchies: 1 -> 2 -> 3 and 4 -> 5 -> 6
        // Only some spaces have cached activity
        const space1 = createMockSpace({ id: 1, parent_id: null, recursive_post_count: 30 });
        const space2 = createMockSpace({ id: 2, parent_id: 1, recursive_post_count: 20 });
        const space3 = createMockSpace({ id: 3, parent_id: 2, post_count: 10, recursive_post_count: 10 });
        const space4 = createMockSpace({ id: 4, parent_id: null, recursive_post_count: 30 });
        const space5 = createMockSpace({ id: 5, parent_id: 4, recursive_post_count: 20 });
        const space6 = createMockSpace({ id: 6, parent_id: 5, post_count: 10, recursive_post_count: 10 });
        spacesSignal.value = [space1, space2, space3, space4, space5, space6];

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const todayTimestamp = today.getTime();

        // Only cache activity for spaces 1, 2, 3 (source chain), not 4, 5, 6 (destination chain)
        [1, 2, 3].forEach(id => {
          const activity = createMockActivityData(120);
          let todayIndex = activity.days.findIndex(d => d.date === todayStr);
          if (todayIndex === -1) {
            activity.days.push({ date: todayStr, count: 10 });
          } else {
            activity.days[todayIndex].count = 10;
          }
          activityCache['cache'].set(`activity:${id}:flat:0:4m`, JSON.parse(JSON.stringify(activity)));
          activityCache['cache'].set(`activity:${id}:recursive:0:4m`, JSON.parse(JSON.stringify(activity)));
        });

        const post = createMockPost({ id: 1, space_id: 3, created: todayTimestamp });
        posts.value = [post];

        // Move from 3 to 6 (different deep hierarchies)
        await movePostAction({ postId: 1, newSpaceId: 6, currentSpaceId: 3 });

        // Source chain should be updated
        expect(activityCache.getData(3, false, 0, 4)!.days.find(d => d.date === todayStr)?.count).toBe(9);
        expect(activityCache.getData(2, true, 0, 4)!.days.find(d => d.date === todayStr)?.count).toBe(9);
        expect(activityCache.getData(1, true, 0, 4)!.days.find(d => d.date === todayStr)?.count).toBe(9);

        // Destination chain should be null (invalidated because no cache)
        expect(activityCache.getData(6, false, 0, 4)).toBeNull();
        expect(activityCache.getData(5, true, 0, 4)).toBeNull();
        expect(activityCache.getData(4, true, 0, 4)).toBeNull();
      });

      it('should handle moving within same parent (between siblings)', async () => {
        // Siblings: 1 -> [2, 3]
        const space1 = createMockSpace({ id: 1, parent_id: null, recursive_post_count: 30 });
        const space2 = createMockSpace({ id: 2, parent_id: 1, post_count: 10, recursive_post_count: 10 });
        const space3 = createMockSpace({ id: 3, parent_id: 1, post_count: 10, recursive_post_count: 10 });
        spacesSignal.value = [space1, space2, space3];

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const todayTimestamp = today.getTime();

        // Cache activity for all
        [1, 2, 3].forEach(id => {
          const activity = createMockActivityData(120);
          let todayIndex = activity.days.findIndex(d => d.date === todayStr);
          if (todayIndex === -1) {
            activity.days.push({ date: todayStr, count: 10 });
          } else {
            activity.days[todayIndex].count = 10;
          }
          activityCache['cache'].set(`activity:${id}:flat:0:4m`, JSON.parse(JSON.stringify(activity)));
          activityCache['cache'].set(`activity:${id}:recursive:0:4m`, JSON.parse(JSON.stringify(activity)));
        });

        const post = createMockPost({ id: 1, space_id: 2, created: todayTimestamp });
        posts.value = [post];

        // Move from sibling 2 to sibling 3
        await movePostAction({ postId: 1, newSpaceId: 3, currentSpaceId: 2 });

        // Source sibling should be decremented
        expect(activityCache.getData(2, false, 0, 4)!.days.find(d => d.date === todayStr)?.count).toBe(9);

        // Destination sibling should be incremented
        expect(activityCache.getData(3, false, 0, 4)!.days.find(d => d.date === todayStr)?.count).toBe(11);

        // Parent flat view should NOT change (post never belonged to parent directly)
        const updated1Flat = activityCache.getData(1, false, 0, 4)!.days.find(d => d.date === todayStr)?.count;
        expect(updated1Flat).toBe(10); // Unchanged - post was in child, not parent

        // Parent recursive view gets both -1 and +1, but they happen sequentially
        // So it ends up being decremented first, then incremented, resulting in net 0 change
        // But since operations are sequential: 10 - 1 = 9, then 9 + 1 = 10
        const updated1Recursive = activityCache.getData(1, true, 0, 4)!.days.find(d => d.date === todayStr)?.count;
        expect(updated1Recursive).toBe(10); // Back to original after -1 +1
      });

      it('should handle moving to top-level space (no parent)', async () => {
        // 1 -> 2 and 3 (top-level)
        const space1 = createMockSpace({ id: 1, parent_id: null, recursive_post_count: 20 });
        const space2 = createMockSpace({ id: 2, parent_id: 1, post_count: 10, recursive_post_count: 10 });
        const space3 = createMockSpace({ id: 3, parent_id: null, post_count: 5, recursive_post_count: 5 });
        spacesSignal.value = [space1, space2, space3];

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const todayTimestamp = today.getTime();

        // Cache activity for all
        [1, 2, 3].forEach(id => {
          const activity = createMockActivityData(120);
          let todayIndex = activity.days.findIndex(d => d.date === todayStr);
          if (todayIndex === -1) {
            activity.days.push({ date: todayStr, count: 10 });
          } else {
            activity.days[todayIndex].count = 10;
          }
          activityCache['cache'].set(`activity:${id}:flat:0:4m`, JSON.parse(JSON.stringify(activity)));
          activityCache['cache'].set(`activity:${id}:recursive:0:4m`, JSON.parse(JSON.stringify(activity)));
        });

        const post = createMockPost({ id: 1, space_id: 2, created: todayTimestamp });
        posts.value = [post];

        // Move from child (2) to top-level (3)
        await movePostAction({ postId: 1, newSpaceId: 3, currentSpaceId: 2 });

        // Source and its parent should be decremented
        expect(activityCache.getData(2, false, 0, 4)!.days.find(d => d.date === todayStr)?.count).toBe(9);
        expect(activityCache.getData(1, true, 0, 4)!.days.find(d => d.date === todayStr)?.count).toBe(9);

        // Destination (top-level, no parent to update) should be incremented
        expect(activityCache.getData(3, false, 0, 4)!.days.find(d => d.date === todayStr)?.count).toBe(11);
      });

      it('should handle moving from top-level to nested space', async () => {
        // 1 (top-level) and 2 -> 3
        const space1 = createMockSpace({ id: 1, parent_id: null, post_count: 10, recursive_post_count: 10 });
        const space2 = createMockSpace({ id: 2, parent_id: null, recursive_post_count: 20 });
        const space3 = createMockSpace({ id: 3, parent_id: 2, post_count: 10, recursive_post_count: 10 });
        spacesSignal.value = [space1, space2, space3];

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const todayTimestamp = today.getTime();

        // Cache activity for all
        [1, 2, 3].forEach(id => {
          const activity = createMockActivityData(120);
          let todayIndex = activity.days.findIndex(d => d.date === todayStr);
          if (todayIndex === -1) {
            activity.days.push({ date: todayStr, count: 10 });
          } else {
            activity.days[todayIndex].count = 10;
          }
          activityCache['cache'].set(`activity:${id}:flat:0:4m`, JSON.parse(JSON.stringify(activity)));
          activityCache['cache'].set(`activity:${id}:recursive:0:4m`, JSON.parse(JSON.stringify(activity)));
        });

        const post = createMockPost({ id: 1, space_id: 1, created: todayTimestamp });
        posts.value = [post];

        // Move from top-level (1) to nested (3)
        await movePostAction({ postId: 1, newSpaceId: 3, currentSpaceId: 1 });

        // Source (top-level, no parent) should be decremented
        expect(activityCache.getData(1, false, 0, 4)!.days.find(d => d.date === todayStr)?.count).toBe(9);

        // Destination and its parent should be incremented
        expect(activityCache.getData(3, false, 0, 4)!.days.find(d => d.date === todayStr)?.count).toBe(11);
        expect(activityCache.getData(2, true, 0, 4)!.days.find(d => d.date === todayStr)?.count).toBe(11);
      });

      it('should not update space 0 activity when moving (same timestamp)', async () => {
        // Space 0 should not change because post stays in system with same timestamp
        const space0 = createMockSpace({ id: 0, parent_id: null, post_count: 100, recursive_post_count: 100 });
        const space1 = createMockSpace({ id: 1, parent_id: null, post_count: 50 });
        const space2 = createMockSpace({ id: 2, parent_id: null, post_count: 50 });
        spacesSignal.value = [space0, space1, space2];

        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const todayTimestamp = today.getTime();

        // Cache activity for all including space 0
        [0, 1, 2].forEach(id => {
          const activity = createMockActivityData(120);
          let todayIndex = activity.days.findIndex(d => d.date === todayStr);
          if (todayIndex === -1) {
            activity.days.push({ date: todayStr, count: 100 });
          } else {
            activity.days[todayIndex].count = 100;
          }
          activityCache['cache'].set(`activity:${id}:flat:0:4m`, JSON.parse(JSON.stringify(activity)));
        });

        const post = createMockPost({ id: 1, space_id: 1, created: todayTimestamp });
        posts.value = [post];

        await movePostAction({ postId: 1, newSpaceId: 2, currentSpaceId: 1 });

        // Space 0 should remain unchanged (post still in system with same date)
        expect(activityCache.getData(0, false, 0, 4)!.days.find(d => d.date === todayStr)?.count).toBe(100);

        // Individual spaces should be updated
        expect(activityCache.getData(1, false, 0, 4)!.days.find(d => d.date === todayStr)?.count).toBe(99);
        expect(activityCache.getData(2, false, 0, 4)!.days.find(d => d.date === todayStr)?.count).toBe(101);
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
