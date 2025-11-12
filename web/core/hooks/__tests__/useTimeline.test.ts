/**
 * Tests for useTimeline Hook
 * Testing timeline state management, post fetching, and pagination
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/preact';
import { useTimeline } from '../useTimeline';
import {
  posts,
  isLoadingPosts,
} from '../../state/posts';
import { spaces as spacesSignal } from '../../state/spaces';
import { createMockSpace, createMockPost, resetFactoryCounters } from '../../__tests__/factories';
import type { PostsResponse } from '../../api/posts';
import * as postsCacheModule from '../../cache/postsCache';

// Mock the posts cache module
vi.mock('../../cache/postsCache', () => ({
  fetchPostsCached: vi.fn(),
}));

describe('useTimeline', () => {
  const mockPost1 = createMockPost({ id: 1, content: 'Post 1' });
  const mockPost2 = createMockPost({ id: 2, content: 'Post 2' });
  const mockPost3 = createMockPost({ id: 3, content: 'Post 3' });

  const mockPostsResponse: PostsResponse = {
    posts: [mockPost1, mockPost2],
    total: 2,
    offset: 0,
    limit: 20,
  };

  beforeEach(() => {
    resetFactoryCounters();
    spacesSignal.value = [];
    posts.value = [];
    isLoadingPosts.value = false;

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should return empty posts array initially', () => {
      const { result } = renderHook(() => useTimeline(1, false));
      expect(result.current.posts).toEqual([]);
    });

    it('should start at offset 0', () => {
      const { result } = renderHook(() => useTimeline(1, false));
      expect(result.current.offset).toBe(0);
    });

    it('should track recursive mode correctly', () => {
      const { result: resultFlat } = renderHook(() => useTimeline(1, false));
      expect(resultFlat.current.isRecursive).toBe(false);

      const { result: resultRecursive } = renderHook(() => useTimeline(1, true));
      expect(resultRecursive.current.isRecursive).toBe(true);
    });
  });

  describe('data fetching', () => {
    it('should fetch posts on mount', async () => {
      const fetchMock = vi.mocked(postsCacheModule.fetchPostsCached);
      fetchMock.mockResolvedValue({ ...mockPostsResponse, fromCache: false });

      const space = createMockSpace({ id: 1, post_count: 2, recursive_post_count: 2 });
      spacesSignal.value = [space];

      renderHook(() => useTimeline(1, false));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(1, 20, 0, true, false);
      });
    });

    it('should update posts signal when data is fetched', async () => {
      const fetchMock = vi.mocked(postsCacheModule.fetchPostsCached);
      fetchMock.mockResolvedValue({ ...mockPostsResponse, fromCache: false });

      const space = createMockSpace({ id: 1, post_count: 2, recursive_post_count: 2 });
      spacesSignal.value = [space];

      const { result } = renderHook(() => useTimeline(1, false));

      await waitFor(() => {
        expect(result.current.posts).toHaveLength(2);
        expect(result.current.posts[0].id).toBe(1);
        expect(result.current.posts[1].id).toBe(2);
      });
    });

    it('should re-fetch when spaceId changes', async () => {
      const fetchMock = vi.mocked(postsCacheModule.fetchPostsCached);
      fetchMock.mockResolvedValue({ ...mockPostsResponse, fromCache: false });

      const space1 = createMockSpace({ id: 1, post_count: 2, recursive_post_count: 2 });
      const space2 = createMockSpace({ id: 2, post_count: 2, recursive_post_count: 2 });
      spacesSignal.value = [space1, space2];

      const { rerender } = renderHook(
        ({ spaceId }) => useTimeline(spaceId, false),
        { initialProps: { spaceId: 1 } }
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(1, 20, 0, true, false);
      });

      // Change space
      rerender({ spaceId: 2 });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(2, 20, 0, true, false);
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });
    });

    it('should re-fetch when recursive mode changes', async () => {
      const fetchMock = vi.mocked(postsCacheModule.fetchPostsCached);
      fetchMock.mockResolvedValue({ ...mockPostsResponse, fromCache: false });

      const space = createMockSpace({ id: 1, post_count: 2, recursive_post_count: 5 });
      spacesSignal.value = [space];

      const { rerender } = renderHook(
        ({ recursive }) => useTimeline(1, recursive),
        { initialProps: { recursive: false } }
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(1, 20, 0, true, false);
      });

      // Enable recursive mode
      rerender({ recursive: true });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(1, 20, 0, true, true);
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle fetch errors gracefully', async () => {
      const fetchMock = vi.mocked(postsCacheModule.fetchPostsCached);
      fetchMock.mockRejectedValue(new Error('Network error'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const space = createMockSpace({ id: 1, post_count: 2, recursive_post_count: 2 });
      spacesSignal.value = [space];

      const { result } = renderHook(() => useTimeline(1, false));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.posts).toHaveLength(0);
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should fetch posts for "All Spaces" view (spaceId = null)', async () => {
      const fetchMock = vi.mocked(postsCacheModule.fetchPostsCached);
      fetchMock.mockResolvedValue({ ...mockPostsResponse, fromCache: false });

      renderHook(() => useTimeline(null, false));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(null, 20, 0, true, false);
      });
    });

    it('should use custom postsPerPage from options', async () => {
      const fetchMock = vi.mocked(postsCacheModule.fetchPostsCached);
      fetchMock.mockResolvedValue({ ...mockPostsResponse, fromCache: false });

      const space = createMockSpace({ id: 1, post_count: 2, recursive_post_count: 2 });
      spacesSignal.value = [space];

      renderHook(() => useTimeline(1, false, { postsPerPage: 10 }));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(1, 10, 0, true, false);
      });
    });
  });

  describe('pagination', () => {
    it('should compute hasMore based on space post count', async () => {
      const fetchMock = vi.mocked(postsCacheModule.fetchPostsCached);
      fetchMock.mockResolvedValue({ ...mockPostsResponse, fromCache: false });

      // Space has 10 posts, but we only loaded 2
      const space = createMockSpace({ id: 1, post_count: 10, recursive_post_count: 10 });
      spacesSignal.value = [space];

      const { result } = renderHook(() => useTimeline(1, false));

      await waitFor(() => {
        expect(result.current.posts).toHaveLength(2);
        expect(result.current.hasMore).toBe(true);
      });
    });

    it('should compute hasMore as false when all posts are loaded', async () => {
      const fetchMock = vi.mocked(postsCacheModule.fetchPostsCached);
      fetchMock.mockResolvedValue({ ...mockPostsResponse, fromCache: false });

      // Space has 2 posts, and we loaded 2
      const space = createMockSpace({ id: 1, post_count: 2, recursive_post_count: 2 });
      spacesSignal.value = [space];

      const { result } = renderHook(() => useTimeline(1, false));

      await waitFor(() => {
        expect(result.current.posts).toHaveLength(2);
        expect(result.current.hasMore).toBe(false);
      });
    });

    it('should use recursive_post_count when in recursive mode', async () => {
      const fetchMock = vi.mocked(postsCacheModule.fetchPostsCached);
      fetchMock.mockResolvedValue({ ...mockPostsResponse, fromCache: false });

      // Space has 2 flat posts, but 10 recursive posts
      const space = createMockSpace({ id: 1, post_count: 2, recursive_post_count: 10 });
      spacesSignal.value = [space];

      const { result } = renderHook(() => useTimeline(1, true));

      await waitFor(() => {
        expect(result.current.posts).toHaveLength(2);
        expect(result.current.hasMore).toBe(true); // 2 < 10
      });
    });

    it('should load more posts when loadMore is called', async () => {
      const fetchMock = vi.mocked(postsCacheModule.fetchPostsCached);

      // First fetch returns 2 posts
      fetchMock.mockResolvedValueOnce({ ...mockPostsResponse, fromCache: false });

      // Second fetch (loadMore) returns 1 more post
      const morePostsResponse: PostsResponse = {
        posts: [mockPost3],
        total: 3,
        offset: 2,
        limit: 20,
      };
      fetchMock.mockResolvedValueOnce({ ...morePostsResponse, fromCache: false });

      const space = createMockSpace({ id: 1, post_count: 3, recursive_post_count: 3 });
      spacesSignal.value = [space];

      const { result } = renderHook(() => useTimeline(1, false));

      // Wait for initial fetch
      await waitFor(() => {
        expect(result.current.posts).toHaveLength(2);
      });

      expect(result.current.hasMore).toBe(true);

      // Load more
      result.current.loadMore();

      await waitFor(() => {
        expect(result.current.posts).toHaveLength(3);
        expect(fetchMock).toHaveBeenCalledWith(1, 20, 2, true, false);
      });
    });

    it('should update offset after loading more', async () => {
      const fetchMock = vi.mocked(postsCacheModule.fetchPostsCached);
      fetchMock.mockResolvedValueOnce({ ...mockPostsResponse, fromCache: false });

      const morePostsResponse: PostsResponse = {
        posts: [mockPost3],
        total: 3,
        offset: 2,
        limit: 20,
      };
      fetchMock.mockResolvedValueOnce({ ...morePostsResponse, fromCache: false });

      const space = createMockSpace({ id: 1, post_count: 3, recursive_post_count: 3 });
      spacesSignal.value = [space];

      const { result } = renderHook(() => useTimeline(1, false));

      await waitFor(() => {
        expect(result.current.offset).toBe(2);
      });

      result.current.loadMore();

      await waitFor(() => {
        expect(result.current.offset).toBe(3);
      });
    });

    it('should not load more if already loading', async () => {
      const fetchMock = vi.mocked(postsCacheModule.fetchPostsCached);

      // Make fetch slow to test concurrent calls
      fetchMock.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({ ...mockPostsResponse, fromCache: false }), 100)
        )
      );

      const space = createMockSpace({ id: 1, post_count: 10, recursive_post_count: 10 });
      spacesSignal.value = [space];

      const { result } = renderHook(() => useTimeline(1, false));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Call loadMore multiple times quickly
      result.current.loadMore();
      result.current.loadMore();
      result.current.loadMore();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should only have been called once for initial load + once for loadMore
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should return hasMore as false for "All Spaces" view', async () => {
      const fetchMock = vi.mocked(postsCacheModule.fetchPostsCached);
      fetchMock.mockResolvedValue({ ...mockPostsResponse, fromCache: false });

      const { result } = renderHook(() => useTimeline(null, false));

      await waitFor(() => {
        expect(result.current.posts).toHaveLength(2);
        expect(result.current.hasMore).toBe(false); // Pagination disabled for "All Spaces"
      });
    });

    it('should return hasMore as false if space not found', async () => {
      const fetchMock = vi.mocked(postsCacheModule.fetchPostsCached);
      fetchMock.mockResolvedValue({ ...mockPostsResponse, fromCache: false });

      spacesSignal.value = []; // No spaces

      const { result } = renderHook(() => useTimeline(1, false));

      await waitFor(() => {
        expect(result.current.hasMore).toBe(false);
      });
    });
  });

  describe('reload function', () => {
    it('should provide a reload function', async () => {
      const fetchMock = vi.mocked(postsCacheModule.fetchPostsCached);
      fetchMock.mockResolvedValue({ ...mockPostsResponse, fromCache: false });

      const space = createMockSpace({ id: 1, post_count: 2, recursive_post_count: 2 });
      spacesSignal.value = [space];

      const { result } = renderHook(() => useTimeline(1, false));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      // Call reload
      await result.current.reload();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenLastCalledWith(1, 20, 0, true, false);
    });

    it('should reset offset when reloading', async () => {
      const fetchMock = vi.mocked(postsCacheModule.fetchPostsCached);
      fetchMock.mockResolvedValueOnce({ ...mockPostsResponse, fromCache: false });

      const morePostsResponse: PostsResponse = {
        posts: [mockPost3],
        total: 3,
        offset: 2,
        limit: 20,
      };
      fetchMock.mockResolvedValueOnce({ ...morePostsResponse, fromCache: false });
      fetchMock.mockResolvedValueOnce({ ...mockPostsResponse, fromCache: false });

      const space = createMockSpace({ id: 1, post_count: 3, recursive_post_count: 3 });
      spacesSignal.value = [space];

      const { result } = renderHook(() => useTimeline(1, false));

      await waitFor(() => {
        expect(result.current.offset).toBe(2);
      });

      // Load more
      result.current.loadMore();

      await waitFor(() => {
        expect(result.current.offset).toBe(3);
      });

      // Reload
      await result.current.reload();

      await waitFor(() => {
        expect(result.current.offset).toBe(2); // Reset to initial
      });
    });
  });

  describe('loading states', () => {
    it('should set isLoading during fetch', async () => {
      const fetchMock = vi.mocked(postsCacheModule.fetchPostsCached);

      let resolvePromise: (value: any) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      fetchMock.mockReturnValue(promise as any);

      const space = createMockSpace({ id: 1, post_count: 2, recursive_post_count: 2 });
      spacesSignal.value = [space];

      const { result } = renderHook(() => useTimeline(1, false));

      // Should be loading
      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      // Resolve the promise
      resolvePromise!({ ...mockPostsResponse, fromCache: false });

      // Should finish loading
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });
});
