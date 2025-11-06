/**
 * Post Actions
 *
 * Centralized handlers for post-related actions with cascading effects
 */

import { deletePost as apiDeletePost, movePost as apiMovePost, type Post } from '../api/posts';
import { showSuccess, showError } from '../components';
import { executeAction } from './index';
import { posts, isLoadingPosts, currentOffset } from '../state/posts';
import { spaces, getSpaceById } from '../state/spaces';
import { fetchPostsCached } from '../cache/postsCache';
import { posts as postsConfig, cache as cacheConfig } from '../config';

export interface DeletePostOptions {
  postId: number;
  /** Current space context for smart refetch */
  spaceId?: number | null;
  recursive?: boolean;
}

export interface MovePostOptions {
  postId: number;
  newSpaceId: number;
  /** Current space context for view updates */
  currentSpaceId?: number | null;
  recursive?: boolean;
}

/**
 * Delete a post with confirmation, state updates, and smart refetch
 */
export async function deletePostAction(options: DeletePostOptions): Promise<void> {
  const { postId, spaceId, recursive = false } = options;

  await executeAction({
    confirmation: {
      title: 'Delete post',
      message: 'Are you sure you want to delete this post? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    },
    execute: async () => {
      await apiDeletePost(postId);
    },
    onSuccess: async () => {
      // Remove from local state
      posts.value = posts.value.filter((p) => p.id !== postId);

      // Update space post counts in global state
      if (spaceId !== null && spaceId !== undefined) {
        const space = getSpaceById(spaceId);
        if (space) {
          // Decrement post count for this space
          space.post_count = Math.max(0, space.post_count - 1);

          // Decrement recursive count for this space and all parents
          let currentSpace: typeof space | undefined = space;
          while (currentSpace) {
            currentSpace.recursive_post_count = Math.max(0, currentSpace.recursive_post_count - 1);
            if (currentSpace.parent_id !== null) {
              currentSpace = getSpaceById(currentSpace.parent_id);
            } else {
              break;
            }
          }

          // Trigger spaces signal update
          spaces.value = [...spaces.value];
        }
      }

      // Smart refetch logic: check if we should fetch more posts
      const remainingPosts = posts.value.length;
      const threshold = Math.floor(postsConfig.postsPerPage * cacheConfig.posts.smartRefetchThreshold);

      // Determine if more posts exist using space post counts
      let totalPostsInView = 0;
      if (spaceId !== null && spaceId !== undefined) {
        const space = getSpaceById(spaceId);
        if (space) {
          totalPostsInView = recursive ? space.recursive_post_count : space.post_count;
        }
      }

      const morePostsExist = totalPostsInView > remainingPosts;

      if (
        remainingPosts < threshold &&
        morePostsExist &&
        !isLoadingPosts.value &&
        spaceId !== undefined
      ) {
        console.log('[PostActions] Smart refetch triggered after deletion');
        console.log(`  Remaining: ${remainingPosts}, Threshold: ${threshold}, Total in space: ${totalPostsInView}`);
        isLoadingPosts.value = true;

        try {
          const result = await fetchPostsCached(
            spaceId,
            postsConfig.postsPerPage,
            currentOffset.value,
            true,
            recursive
          );

          posts.value = [...posts.value, ...result.posts];
          currentOffset.value += result.posts.length;
        } catch (error) {
          console.error('Failed to refetch posts:', error);
        } finally {
          isLoadingPosts.value = false;
        }
      }

      showSuccess('Post deleted successfully');
    },
    onError: (error) => {
      console.error('Failed to delete post:', error);
      showError('Failed to delete post. Please try again.');
    },
    // Invalidate all posts cache since we don't know which views contain this post
    cacheInvalidation: { type: 'all' },
  });
}

/**
 * Move a post to a different space with automatic state updates and smart refetch
 */
export async function movePostAction(options: MovePostOptions): Promise<void> {
  const { postId, newSpaceId, currentSpaceId, recursive = false } = options;

  await executeAction<Post | null>({
    execute: async () => {
      return await apiMovePost(postId, newSpaceId);
    },
    onSuccess: async (updatedPost) => {
      if (!updatedPost) return;

      // Update space post counts in global state
      const oldSpaceId = posts.value.find(p => p.id === updatedPost.id)?.space_id;
      const newSpaceId = updatedPost.space_id;

      if (oldSpaceId !== undefined && oldSpaceId !== newSpaceId) {
        // Decrement from old space
        const oldSpace = getSpaceById(oldSpaceId);
        if (oldSpace) {
          oldSpace.post_count = Math.max(0, oldSpace.post_count - 1);

          // Decrement recursive count for old space and all parents
          let currentSpace: typeof oldSpace | undefined = oldSpace;
          while (currentSpace) {
            currentSpace.recursive_post_count = Math.max(0, currentSpace.recursive_post_count - 1);
            if (currentSpace.parent_id !== null) {
              currentSpace = getSpaceById(currentSpace.parent_id);
            } else {
              break;
            }
          }
        }

        // Increment in new space
        const newSpace = getSpaceById(newSpaceId);
        if (newSpace) {
          newSpace.post_count += 1;

          // Increment recursive count for new space and all parents
          let currentSpace: typeof newSpace | undefined = newSpace;
          while (currentSpace) {
            currentSpace.recursive_post_count += 1;
            if (currentSpace.parent_id !== null) {
              currentSpace = getSpaceById(currentSpace.parent_id);
            } else {
              break;
            }
          }
        }

        // Trigger spaces signal update
        spaces.value = [...spaces.value];
      }

      // Check if post should be removed from current view
      const shouldRemoveFromView =
        currentSpaceId !== null &&
        currentSpaceId !== undefined &&
        !recursive &&
        updatedPost.space_id !== currentSpaceId;

      if (shouldRemoveFromView) {
        // Remove from view
        posts.value = posts.value.filter((p) => p.id !== updatedPost.id);

        // Smart refetch logic with space post counts
        const remainingPosts = posts.value.length;
        const threshold = Math.floor(postsConfig.postsPerPage * cacheConfig.posts.smartRefetchThreshold);

        // Determine if more posts exist using space post counts
        let totalPostsInView = 0;
        if (currentSpaceId !== null) {
          const space = getSpaceById(currentSpaceId);
          if (space) {
            totalPostsInView = recursive ? space.recursive_post_count : space.post_count;
          }
        }

        const morePostsExist = totalPostsInView > remainingPosts;

        if (
          remainingPosts < threshold &&
          morePostsExist &&
          !isLoadingPosts.value
        ) {
          console.log('[PostActions] Smart refetch triggered after move');
          console.log(`  Remaining: ${remainingPosts}, Threshold: ${threshold}, Total in space: ${totalPostsInView}`);
          isLoadingPosts.value = true;

          try {
            const result = await fetchPostsCached(
              currentSpaceId,
              postsConfig.postsPerPage,
              currentOffset.value,
              true,
              recursive
            );

            posts.value = [...posts.value, ...result.posts];
            currentOffset.value += result.posts.length;
          } catch (error) {
            console.error('Failed to refetch posts:', error);
          } finally {
            isLoadingPosts.value = false;
          }
        }
      } else {
        // Update the post in place
        posts.value = posts.value.map((p) =>
          p.id === updatedPost.id ? updatedPost : p
        );
      }

      showSuccess('Post moved successfully');
    },
    onError: (error) => {
      console.error('Failed to move post:', error);
      showError('Failed to move post. Please try again.');
    },
    // Invalidate cache for affected spaces
    cacheInvalidation: { type: 'all' },
  });
}
