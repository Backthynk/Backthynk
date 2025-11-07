import { signal } from '@preact/signals';
import type { Post } from '../api';
import { posts as postsConfig } from '../config';

// Global state for posts
export const posts = signal<Post[]>([]);
export const isLoadingPosts = signal<boolean>(false);
export const isRecursiveView = signal<boolean>(false);

// Pagination state
export const currentOffset = signal<number>(0);
export const postsPerPage = postsConfig.postsPerPage;

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
