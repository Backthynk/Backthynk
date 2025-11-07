/**
 * Mock API and Utilities
 * Provides mocked versions of API calls and utility functions for testing
 */

import { vi } from 'vitest';
import type { Post } from '../api/posts';
import type { Space, SpaceStats } from '../api/spaces';
import type { ActivityData } from '../api/activity';

/**
 * Mock API responses storage
 */
export const mockApiData = {
  posts: [] as Post[],
  spaces: [] as Space[],
  spaceStats: new Map<string, SpaceStats>(),
  activityData: new Map<string, ActivityData>(),
};

/**
 * Reset all mock API data
 */
export function resetMockApiData() {
  mockApiData.posts = [];
  mockApiData.spaces = [];
  mockApiData.spaceStats.clear();
  mockApiData.activityData.clear();
}

/**
 * Mock API functions for posts
 */
export const mockPostsApi = {
  deletePost: vi.fn((postId: number) => {
    mockApiData.posts = mockApiData.posts.filter(p => p.id !== postId);
    return Promise.resolve();
  }),

  movePost: vi.fn((postId: number, newSpaceId: number) => {
    const post = mockApiData.posts.find(p => p.id === postId);
    if (post) {
      post.space_id = newSpaceId;
      return Promise.resolve(post);
    }
    return Promise.resolve(null);
  }),

  fetchPosts: vi.fn((spaceId: number | null, limit: number, offset: number, withMeta: boolean, recursive: boolean) => {
    let filteredPosts = mockApiData.posts;
    if (spaceId !== null && spaceId !== 0) {
      filteredPosts = mockApiData.posts.filter(p => p.space_id === spaceId);
    }
    const posts = filteredPosts.slice(offset, offset + limit);
    return Promise.resolve({ posts });
  }),
};

/**
 * Mock API functions for spaces
 */
export const mockSpacesApi = {
  deleteSpace: vi.fn((spaceId: number) => {
    // Find all descendant spaces
    const toDelete = new Set<number>([spaceId]);
    let changed = true;
    while (changed) {
      changed = false;
      mockApiData.spaces.forEach(space => {
        if (space.parent_id !== null && toDelete.has(space.parent_id) && !toDelete.has(space.id)) {
          toDelete.add(space.id);
          changed = true;
        }
      });
    }

    // Delete all spaces
    mockApiData.spaces = mockApiData.spaces.filter(s => !toDelete.has(s.id));
    return Promise.resolve();
  }),

  updateSpace: vi.fn((spaceId: number, payload: any) => {
    const space = mockApiData.spaces.find(s => s.id === spaceId);
    if (space) {
      Object.assign(space, payload);
      return Promise.resolve(space);
    }
    return Promise.resolve(null);
  }),

  createSpace: vi.fn((payload: any) => {
    const newSpace: Space = {
      id: Math.max(0, ...mockApiData.spaces.map(s => s.id)) + 1,
      name: payload.name,
      description: payload.description ?? '',
      parent_id: payload.parent_id ?? null,
      post_count: 0,
      recursive_post_count: 0,
      created: Math.floor(Date.now() / 1000),
    };
    mockApiData.spaces.push(newSpace);
    return Promise.resolve(newSpace);
  }),

  fetchSpaceStats: vi.fn((spaceId: number, recursive: boolean) => {
    const key = `${spaceId}:${recursive}`;
    return Promise.resolve(mockApiData.spaceStats.get(key) || null);
  }),
};

/**
 * Mock API functions for activity
 */
export const mockActivityApi = {
  fetchActivityData: vi.fn((spaceId: number, recursive: boolean, period: number, periodMonths: number) => {
    const key = `${spaceId}:${recursive}:${period}:${periodMonths}`;
    return Promise.resolve(mockApiData.activityData.get(key) || null);
  }),
};

/**
 * Mock router for navigation testing
 */
export const mockRouter = {
  route: vi.fn((path: string) => {
    console.log(`[MockRouter] Navigating to: ${path}`);
  }),
};

/**
 * Mock components
 */
export const mockComponents = {
  showSuccess: vi.fn((message: string) => {
    console.log(`[Success] ${message}`);
  }),

  showError: vi.fn((message: string) => {
    console.error(`[Error] ${message}`);
  }),
};

/**
 * Setup API mocks
 * Call this in beforeEach to replace actual API calls with mocks
 */
export function setupApiMocks() {
  // Mock the API modules
  vi.mock('../api/posts', () => ({
    deletePost: mockPostsApi.deletePost,
    movePost: mockPostsApi.movePost,
    fetchPosts: mockPostsApi.fetchPosts,
  }));

  vi.mock('../api/spaces', () => ({
    deleteSpace: mockSpacesApi.deleteSpace,
    updateSpace: mockSpacesApi.updateSpace,
    createSpace: mockSpacesApi.createSpace,
    fetchSpaceStats: mockSpacesApi.fetchSpaceStats,
  }));

  vi.mock('../api/activity', () => ({
    fetchActivityData: mockActivityApi.fetchActivityData,
  }));

  vi.mock('../components', () => ({
    showSuccess: mockComponents.showSuccess,
    showError: mockComponents.showError,
  }));
}

/**
 * Reset all API mocks
 */
export function resetApiMocks() {
  mockPostsApi.deletePost.mockClear();
  mockPostsApi.movePost.mockClear();
  mockPostsApi.fetchPosts.mockClear();
  mockSpacesApi.deleteSpace.mockClear();
  mockSpacesApi.updateSpace.mockClear();
  mockSpacesApi.createSpace.mockClear();
  mockSpacesApi.fetchSpaceStats.mockClear();
  mockActivityApi.fetchActivityData.mockClear();
  mockRouter.route.mockClear();
  mockComponents.showSuccess.mockClear();
  mockComponents.showError.mockClear();
}
