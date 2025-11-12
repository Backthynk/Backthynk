/**
 * Post Actions
 *
 * Centralized handlers for post-related actions with cascading effects
 */

import { deletePost as apiDeletePost, movePost as apiMovePost, type Post } from '../api/posts';
import { type Space } from '../api/spaces';
import { showSuccess, showError } from '../components';
import { executeAction } from './index';
import { posts, isLoadingPosts, currentOffset, postHasRichContent } from '../state/posts';
import { spaces, getSpaceById } from '../state/spaces';
import { fetchPostsCached } from '../cache/postsCache';
import { posts as postsConfig, cache as cacheConfig } from '../config';
import { updateActivityDayCount, invalidateActivityForSpace } from '../cache/activityCache';
import { invalidateSpaceStatsForParentChain } from '../utils/cacheHelpers';
import { activityCache as activitySignal, activitySpaceId, activityRecursiveMode } from '../state/activity';

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

  // Get post data before deletion to check if it has rich content
  const post = posts.value.find((p) => p.id === postId);
  const hasRichContent = post ? postHasRichContent(post) : false;
  const postCreatedTimestamp = post?.created || 0;
  const actualSpaceId = post?.space_id; // The actual space the post belongs to

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
      // Create a map of updated spaces (immutable updates)
      const updatedSpaces = new Map<number, Space>();

      // ALWAYS update the space where the post actually belongs (actualSpaceId)
      if (actualSpaceId !== null && actualSpaceId !== undefined) {
        const actualSpace = getSpaceById(actualSpaceId);
        if (actualSpace) {
          // Decrement both flat and recursive counts for the post's actual space
          updatedSpaces.set(actualSpaceId, {
            ...actualSpace,
            post_count: Math.max(0, actualSpace.post_count - 1),
            recursive_post_count: Math.max(0, actualSpace.recursive_post_count - 1)
          });

          // Decrement recursive count for all parent spaces of the actual space
          let currentSpace: Space | undefined = actualSpace;
          while (currentSpace && currentSpace.parent_id !== null) {
            currentSpace = getSpaceById(currentSpace.parent_id);
            if (currentSpace) {
              // If already updated, get from map, otherwise clone from current state
              const existing = updatedSpaces.get(currentSpace.id) || currentSpace;
              updatedSpaces.set(currentSpace.id, {
                ...existing,
                recursive_post_count: Math.max(0, existing.recursive_post_count - 1)
              });
            }
          }

          // Smart cache invalidation: only invalidate space stats if post has rich content
          if (hasRichContent) {
            // Post has attachments/links - invalidate space stats for parent chain
            invalidateSpaceStatsForParentChain(actualSpaceId, getSpaceById);
          }
        }
      }

      // Always update space 0 (All Spaces) when deleting a post, regardless of current view
      const allSpacesSpace = getSpaceById(0);
      if (allSpacesSpace) {
        updatedSpaces.set(0, {
          ...allSpacesSpace,
          post_count: Math.max(0, allSpacesSpace.post_count - 1),
          recursive_post_count: Math.max(0, allSpacesSpace.recursive_post_count - 1)
        });
      }

      // Update the spaces array with new space objects (creates new reference for signal)
      if (updatedSpaces.size > 0) {
        spaces.value = spaces.value.map(s => updatedSpaces.get(s.id) || s);
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

      // Smart activity cache update: update the day count directly instead of invalidating
      if (postCreatedTimestamp && actualSpaceId !== null && actualSpaceId !== undefined) {
        // Update activity for the space where the post actually belongs (flat view)
        const updatedFlatData = updateActivityDayCount(postCreatedTimestamp, -1, actualSpaceId, false);

        // Update activity for the space (recursive view)
        const updatedRecursiveData = updateActivityDayCount(postCreatedTimestamp, -1, actualSpaceId, true);

        // If we're currently viewing this space's activity, update the signal to trigger re-render
        if (activitySpaceId.value === actualSpaceId) {
          if (activityRecursiveMode.value && updatedRecursiveData) {
            activitySignal.value = updatedRecursiveData;
          } else if (!activityRecursiveMode.value && updatedFlatData) {
            activitySignal.value = updatedFlatData;
          }
        }

        // Update for all parent spaces (both flat and recursive views)
        let currentSpace = getSpaceById(actualSpaceId);
        while (currentSpace && currentSpace.parent_id !== null) {
          const parentSpace = getSpaceById(currentSpace.parent_id);
          if (parentSpace) {
            const parentFlatData = updateActivityDayCount(postCreatedTimestamp, -1, parentSpace.id, false);
            const parentRecursiveData = updateActivityDayCount(postCreatedTimestamp, -1, parentSpace.id, true);

            // If we're currently viewing this parent space's activity, update the signal
            if (activitySpaceId.value === parentSpace.id) {
              if (activityRecursiveMode.value && parentRecursiveData) {
                activitySignal.value = parentRecursiveData;
              } else if (!activityRecursiveMode.value && parentFlatData) {
                activitySignal.value = parentFlatData;
              }
            }

            currentSpace = parentSpace;
          } else {
            break;
          }
        }

        // Always update space 0 (All Spaces) activity, regardless of current view
        const allSpacesFlatData = updateActivityDayCount(postCreatedTimestamp, -1, 0, false);
        if (activitySpaceId.value === 0 && !activityRecursiveMode.value && allSpacesFlatData) {
          activitySignal.value = allSpacesFlatData;
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

  // Get post data before moving to check if it has rich content
  const post = posts.value.find((p) => p.id === postId);
  const hasRichContent = post ? postHasRichContent(post) : false;
  const postCreatedTimestamp = post?.created || 0;

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
        const updatedSpaces = new Map<number, Space>();

        // Decrement from old space
        const oldSpace = getSpaceById(oldSpaceId);
        if (oldSpace) {
          updatedSpaces.set(oldSpaceId, {
            ...oldSpace,
            post_count: Math.max(0, oldSpace.post_count - 1),
            recursive_post_count: Math.max(0, oldSpace.recursive_post_count - 1)
          });

          // Decrement recursive count for old space's parents
          let currentSpace: Space | undefined = oldSpace;
          while (currentSpace && currentSpace.parent_id !== null) {
            currentSpace = getSpaceById(currentSpace.parent_id);
            if (currentSpace) {
              // If already updated, get from map, otherwise clone from current state
              const existing = updatedSpaces.get(currentSpace.id) || currentSpace;
              updatedSpaces.set(currentSpace.id, {
                ...existing,
                recursive_post_count: Math.max(0, existing.recursive_post_count - 1)
              });
            }
          }
        }

        // Increment in new space
        const newSpace = getSpaceById(newSpaceId);
        if (newSpace) {
          // If already updated from old space chain, get from map
          const existing = updatedSpaces.get(newSpaceId) || newSpace;
          updatedSpaces.set(newSpaceId, {
            ...existing,
            post_count: existing.post_count + 1,
            recursive_post_count: existing.recursive_post_count + 1
          });

          // Increment recursive count for new space's parents
          let currentSpace: Space | undefined = newSpace;
          while (currentSpace && currentSpace.parent_id !== null) {
            currentSpace = getSpaceById(currentSpace.parent_id);
            if (currentSpace) {
              const existing = updatedSpaces.get(currentSpace.id) || currentSpace;
              updatedSpaces.set(currentSpace.id, {
                ...existing,
                recursive_post_count: existing.recursive_post_count + 1
              });
            }
          }
        }

        // Space 0 (All Spaces) counts don't change on move (post stays in system)
        // No need to update space 0 for moves, only for add/delete operations

        // Update the spaces array with new space objects (creates new reference for signal)
        spaces.value = spaces.value.map(s => updatedSpaces.get(s.id) || s);

        // Smart cache invalidation: only invalidate space stats if post has rich content
        if (hasRichContent) {
          // Post has attachments/links - invalidate both old and new parent chains
          if (oldSpaceId !== undefined) {
            invalidateSpaceStatsForParentChain(oldSpaceId, getSpaceById);
          }
          invalidateSpaceStatsForParentChain(newSpaceId, getSpaceById);
        }
        // Otherwise, the in-memory state updates above are sufficient
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

      // Smart activity cache update: moving = remove from old space + add to new space
      if (postCreatedTimestamp && oldSpaceId !== undefined && oldSpaceId !== newSpaceId) {
        // Decrement activity for old space (both flat and recursive)
        const oldFlatData = updateActivityDayCount(postCreatedTimestamp, -1, oldSpaceId, false);
        const oldRecursiveData = updateActivityDayCount(postCreatedTimestamp, -1, oldSpaceId, true);

        // Update signal if viewing old space
        if (activitySpaceId.value === oldSpaceId) {
          if (activityRecursiveMode.value && oldRecursiveData) {
            activitySignal.value = oldRecursiveData;
          } else if (!activityRecursiveMode.value && oldFlatData) {
            activitySignal.value = oldFlatData;
          }
        }

        // Decrement for old space's parents (both flat and recursive)
        let currentSpace = getSpaceById(oldSpaceId);
        while (currentSpace && currentSpace.parent_id !== null) {
          const parentSpace = getSpaceById(currentSpace.parent_id);
          if (parentSpace) {
            const parentFlatData = updateActivityDayCount(postCreatedTimestamp, -1, parentSpace.id, false);
            const parentRecursiveData = updateActivityDayCount(postCreatedTimestamp, -1, parentSpace.id, true);

            if (activitySpaceId.value === parentSpace.id) {
              if (activityRecursiveMode.value && parentRecursiveData) {
                activitySignal.value = parentRecursiveData;
              } else if (!activityRecursiveMode.value && parentFlatData) {
                activitySignal.value = parentFlatData;
              }
            }

            currentSpace = parentSpace;
          } else {
            break;
          }
        }

        // Increment activity for new space (both flat and recursive)
        const newFlatData = updateActivityDayCount(postCreatedTimestamp, 1, newSpaceId, false);
        const newRecursiveData = updateActivityDayCount(postCreatedTimestamp, 1, newSpaceId, true);

        // If cache doesn't exist for new space, invalidate to ensure fresh data on next view
        if (!newFlatData && !newRecursiveData) {
          invalidateActivityForSpace(newSpaceId);
        }

        // Update signal if viewing new space
        if (activitySpaceId.value === newSpaceId) {
          if (activityRecursiveMode.value && newRecursiveData) {
            activitySignal.value = newRecursiveData;
          } else if (!activityRecursiveMode.value && newFlatData) {
            activitySignal.value = newFlatData;
          }
        }

        // Increment for new space's parents (both flat and recursive)
        currentSpace = getSpaceById(newSpaceId);
        while (currentSpace && currentSpace.parent_id !== null) {
          const parentSpace = getSpaceById(currentSpace.parent_id);
          if (parentSpace) {
            const parentFlatData = updateActivityDayCount(postCreatedTimestamp, 1, parentSpace.id, false);
            const parentRecursiveData = updateActivityDayCount(postCreatedTimestamp, 1, parentSpace.id, true);

            // If cache doesn't exist for parent, invalidate it
            if (!parentFlatData && !parentRecursiveData) {
              invalidateActivityForSpace(parentSpace.id);
            }

            if (activitySpaceId.value === parentSpace.id) {
              if (activityRecursiveMode.value && parentRecursiveData) {
                activitySignal.value = parentRecursiveData;
              } else if (!activityRecursiveMode.value && parentFlatData) {
                activitySignal.value = parentFlatData;
              }
            }

            currentSpace = parentSpace;
          } else {
            break;
          }
        }

        // Note: Space 0 (All Spaces) activity doesn't change on move since the post
        // creation timestamp stays the same and the post remains in the system
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
