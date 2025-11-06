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
