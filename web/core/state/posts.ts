import { signal } from '@preact/signals';
import type { Post } from '../api';

// Global state for posts
export const posts = signal<Post[]>([]);
export const hasMorePosts = signal<boolean>(false);
export const isLoadingPosts = signal<boolean>(false);
export const isRecursiveView = signal<boolean>(false);

// Pagination state
export const currentOffset = signal<number>(0);
export const postsPerPage = 20;

export const resetPosts = () => {
  posts.value = [];
  hasMorePosts.value = false;
  currentOffset.value = 0;
  isLoadingPosts.value = false;
};

export const appendPosts = (newPosts: Post[], hasMore: boolean) => {
  posts.value = [...posts.value, ...newPosts];
  hasMorePosts.value = hasMore;
  currentOffset.value += newPosts.length;
};
