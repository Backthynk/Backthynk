import { signal } from '@preact/signals';
import type { Post } from '../api';
import { posts as postsConfig } from '../config';

/**
 * Query parameters that define a unique posts query (excluding pagination)
 * FUTURE: Add hasLinks and hasAttachments when implementing filtered queries
 */
export interface PostsQuery {
  spaceId: number | null;
  recursive: boolean;
  // FUTURE: Uncomment when implementing filtered queries
  // hasLinks?: boolean;
  // hasAttachments?: boolean;
}

/**
 * Generate a query key for posts state isolation
 * This ensures posts from different queries don't cross-contaminate
 */
export function generateQueryKey(query: PostsQuery): string {
  const { spaceId, recursive } = query;
  // FUTURE: When adding hasLinks/hasAttachments, update the key:
  // return `${spaceId ?? 'all'}:${recursive ? 'rec' : 'flat'}:${hasLinks ? 'links' : ''}:${hasAttachments ? 'attach' : ''}`;
  return `${spaceId ?? 'all'}:${recursive ? 'rec' : 'flat'}`;
}

/**
 * Query-scoped posts state
 * Each query (spaceId + recursive + future filters) has its own isolated post list
 */
export const postsByQuery = signal<Map<string, Post[]>>(new Map());

/**
 * Loading states per query
 */
export const loadingByQuery = signal<Map<string, boolean>>(new Map());

/**
 * Pagination offsets per query
 */
export const offsetByQuery = signal<Map<string, number>>(new Map());

// Legacy global state for backwards compatibility (will be removed)
export const isLoadingPosts = signal<boolean>(false);
export const isRecursiveView = signal<boolean>(false);
export const postsPerPage = postsConfig.postsPerPage;

/**
 * Get posts for a specific query
 */
export const getPostsForQuery = (query: PostsQuery): Post[] => {
  const key = generateQueryKey(query);
  return postsByQuery.value.get(key) || [];
};

/**
 * Set posts for a specific query
 */
export const setPostsForQuery = (query: PostsQuery, posts: Post[]): void => {
  const key = generateQueryKey(query);
  const newMap = new Map(postsByQuery.value);
  newMap.set(key, posts);
  postsByQuery.value = newMap;
};

/**
 * Get loading state for a specific query
 */
export const isLoadingQuery = (query: PostsQuery): boolean => {
  const key = generateQueryKey(query);
  return loadingByQuery.value.get(key) || false;
};

/**
 * Set loading state for a specific query
 */
export const setLoadingForQuery = (query: PostsQuery, loading: boolean): void => {
  const key = generateQueryKey(query);
  const newMap = new Map(loadingByQuery.value);
  newMap.set(key, loading);
  loadingByQuery.value = newMap;
};

/**
 * Get offset for a specific query
 */
export const getOffsetForQuery = (query: PostsQuery): number => {
  const key = generateQueryKey(query);
  return offsetByQuery.value.get(key) || 0;
};

/**
 * Set offset for a specific query
 */
export const setOffsetForQuery = (query: PostsQuery, offset: number): void => {
  const key = generateQueryKey(query);
  const newMap = new Map(offsetByQuery.value);
  newMap.set(key, offset);
  offsetByQuery.value = newMap;
};

/**
 * Reset posts for a specific query
 */
export const resetPostsForQuery = (query: PostsQuery): void => {
  setPostsForQuery(query, []);
  setOffsetForQuery(query, 0);
  setLoadingForQuery(query, false);
};

/**
 * Append posts to a specific query
 */
export const appendPostsToQuery = (query: PostsQuery, newPosts: Post[]): void => {
  const postsToAppend = newPosts || [];
  const currentPosts = getPostsForQuery(query);
  setPostsForQuery(query, [...currentPosts, ...postsToAppend]);
  setOffsetForQuery(query, getOffsetForQuery(query) + postsToAppend.length);
};

/**
 * Remove a post from all queries (used in delete/move operations)
 */
export const removePostFromAllQueries = (postId: number): void => {
  const newMap = new Map(postsByQuery.value);
  for (const [key, posts] of newMap.entries()) {
    newMap.set(key, posts.filter(p => p.id !== postId));
  }
  postsByQuery.value = newMap;
};

/**
 * Update a post in all queries (used in update operations)
 */
export const updatePostInAllQueries = (updatedPost: Post): void => {
  const newMap = new Map(postsByQuery.value);
  for (const [key, posts] of newMap.entries()) {
    newMap.set(key, posts.map(p => p.id === updatedPost.id ? updatedPost : p));
  }
  postsByQuery.value = newMap;
};

/**
 * Legacy functions for backwards compatibility
 * DEPRECATED: Use query-specific functions instead
 */
export const posts = signal<Post[]>([]);
export const currentOffset = signal<number>(0);

export const resetPosts = () => {
  posts.value = [];
  currentOffset.value = 0;
  isLoadingPosts.value = false;
};

export const appendPosts = (newPosts: Post[]) => {
  const postsToAppend = newPosts || [];
  posts.value = [...posts.value, ...postsToAppend];
  currentOffset.value += postsToAppend.length;
};

/**
 * Check if a post has rich content (files, attachments, or link previews)
 * Posts with rich content require full cache invalidation for space stats
 */
export function postHasRichContent(post: Post): boolean {
  return !!(
    (post.files && post.files.length > 0) ||
    (post.attachments && post.attachments.length > 0) ||
    (post.link_previews && post.link_previews.length > 0)
  );
}
