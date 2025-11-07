/**
 * Space Actions
 *
 * Centralized handlers for space-related actions with cascading effects
 * Includes both API actions (delete, update) and UI state actions (expand, recursive, select)
 */

import {
  deleteSpace as apiDeleteSpace,
  updateSpace as apiUpdateSpace,
  createSpace as apiCreateSpace,
  type Space,
  type UpdateSpacePayload,
  type CreateSpacePayload
} from '../api/spaces';
import {
  spaces as spacesSignal,
  getSpaceById,
  getDescendantSpaceIds,
  expandedSpaces,
  recursiveSpaces,
  currentSpace as currentSpaceSignal,
} from '../state/spaces';
import { invalidateSpaceStats, prefetchSpaceStats } from '../cache/spaceStatsCache';
import { invalidateSpaceStatsForParentChain } from '../utils/cacheHelpers';
import { invalidateActivityForSpace } from '../cache/activityCache';
import { showSuccess, showError } from '../components';
import { executeAction } from './index';
import { resetPosts } from '../state/posts';
import { generateSlug } from '../utils';

export interface DeleteSpaceOptions {
  spaceId: number;
  spaceName: string;
  /** Router instance for navigation after deletion */
  router?: any;
  onSuccess?: () => void;
}

export interface UpdateSpaceOptions {
  spaceId: number;
  payload: UpdateSpacePayload;
  /** Router instance for navigation after update (name/parent change) */
  router?: any;
  onSuccess?: (updatedSpace: Space) => void;
}

export interface AddSpaceOptions {
  payload: CreateSpacePayload;
  onSuccess?: (newSpace: Space) => void;
}

/**
 * Add/Create a new space with automatic state updates and parent count increments
 */
export async function addSpaceAction(options: AddSpaceOptions): Promise<void> {
  const { payload, onSuccess } = options;

  await executeAction<Space | null>({
    execute: async () => {
      return await apiCreateSpace(payload);
    },
    onSuccess: async (newSpace) => {
      if (!newSpace) return;

      // Add the new space to state
      spacesSignal.value = [...spacesSignal.value, newSpace];

      // Update parent spaces' recursive counts if this space has a parent
      const parentId = newSpace.parent_id;
      if (parentId !== null && parentId !== undefined) {
        let currentParent = getSpaceById(parentId);
        while (currentParent) {
          // New space contributes its recursive_post_count to all ancestors
          currentParent.recursive_post_count += newSpace.recursive_post_count;
          if (currentParent.parent_id !== null) {
            currentParent = getSpaceById(currentParent.parent_id);
          } else {
            break;
          }
        }
      }

      showSuccess(`Space "${newSpace.name}" created successfully!`);

      if (onSuccess) {
        onSuccess(newSpace);
      }
    },
    onError: (error) => {
      console.error('Failed to create space:', error);
      showError('Failed to create space. Please try again.');
    },
    // No cache invalidation needed for new spaces
    cacheInvalidation: { type: 'none' },
  });
}

/**
 * Delete a space with confirmation, cache invalidation, cascading updates, and redirection
 */
export async function deleteSpaceAction(options: DeleteSpaceOptions): Promise<void> {
  const { spaceId, spaceName, router, onSuccess } = options;

  // Get space data before deletion for proper cleanup
  const space = getSpaceById(spaceId);
  const descendantIds = space ? getDescendantSpaceIds(spaceId) : [];
  const allDeletedSpaceIds = [spaceId, ...descendantIds];
  const parentId = space?.parent_id;

  await executeAction({
    confirmation: {
      title: 'Delete Space',
      message: `Are you sure you want to delete "${spaceName}"? This will also delete all child spaces and their posts. This action cannot be undone.`,
      confirmText: 'Delete',
      variant: 'danger',
    },
    execute: async () => {
      await apiDeleteSpace(spaceId);
    },
    onSuccess: async () => {
      // The deleted space's recursive_post_count already includes all descendants
      // So we only need to use the top-level deleted space's count
      let totalRecursivePostsDeleted = 0;
      if (space) {
        totalRecursivePostsDeleted = space.recursive_post_count;
      }

      // Update parent spaces' recursive counts
      if (parentId !== null && parentId !== undefined) {
        let currentParent = getSpaceById(parentId);
        while (currentParent) {
          currentParent.recursive_post_count = Math.max(
            0,
            currentParent.recursive_post_count - totalRecursivePostsDeleted
          );
          if (currentParent.parent_id !== null) {
            currentParent = getSpaceById(currentParent.parent_id);
          } else {
            break;
          }
        }
      }

      // Remove deleted space and all descendants from state
      spacesSignal.value = spacesSignal.value.filter(
        (s) => !allDeletedSpaceIds.includes(s.id)
      );

      // Smart cache invalidation: only invalidate parent chain stats
      if (parentId !== null && parentId !== undefined) {
        invalidateSpaceStatsForParentChain(parentId, getSpaceById);
      }

      // Invalidate activity cache for all deleted spaces
      allDeletedSpaceIds.forEach(id => invalidateActivityForSpace(id));

      // Handle redirection if currently viewing any of the deleted spaces
      const currentlyViewingDeletedSpace =
        currentSpaceSignal.value && allDeletedSpaceIds.includes(currentSpaceSignal.value.id);

      if (currentlyViewingDeletedSpace) {
        resetPosts();

        if (router) {
          // Redirect to parent space if exists, otherwise to "All Spaces"
          if (parentId !== null && parentId !== undefined) {
            const parentSpace = getSpaceById(parentId);
            if (parentSpace) {
              navigateToSpace(parentSpace, router);
            } else {
              navigateToAllSpaces(router);
            }
          } else {
            navigateToAllSpaces(router);
          }
        }
      }

      showSuccess(`Space "${spaceName}" deleted successfully!`);

      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      console.error('Failed to delete space:', error);
      showError('Failed to delete space. Please try again.');
    },
    // Invalidate all posts cache since we don't know which views contain these posts
    cacheInvalidation: { type: 'all' },
  });
}

/**
 * Update a space with automatic state updates, smart cache invalidation, and redirection
 */
export async function updateSpaceAction(options: UpdateSpaceOptions): Promise<void> {
  const { spaceId, payload, router, onSuccess } = options;

  // Get old space data for comparison
  const oldSpace = getSpaceById(spaceId);
  const oldParentId = oldSpace?.parent_id;
  const oldName = oldSpace?.name;
  const newParentId = payload.parent_id;
  const nameChanged = payload.name !== undefined && payload.name !== oldName;

  // Check if parent changed (outside of executeAction to use in cacheInvalidation)
  const parentChanged = oldParentId !== newParentId && newParentId !== undefined;

  await executeAction<Space | null>({
    execute: async () => {
      return await apiUpdateSpace(spaceId, payload);
    },
    onSuccess: async (updatedSpace) => {
      if (!updatedSpace) return;

      if (parentChanged && oldSpace) {
        // Moving space in hierarchy - update recursive counts
        const spaceRecursiveCount = oldSpace.recursive_post_count;

        // Decrement from old parent chain
        if (oldParentId !== null && oldParentId !== undefined) {
          let currentParent = getSpaceById(oldParentId);
          while (currentParent) {
            currentParent.recursive_post_count = Math.max(
              0,
              currentParent.recursive_post_count - spaceRecursiveCount
            );
            if (currentParent.parent_id !== null) {
              currentParent = getSpaceById(currentParent.parent_id);
            } else {
              break;
            }
          }
        }

        // Increment in new parent chain
        if (newParentId !== null && newParentId !== undefined) {
          let currentParent = getSpaceById(newParentId);
          while (currentParent) {
            currentParent.recursive_post_count += spaceRecursiveCount;
            if (currentParent.parent_id !== null) {
              currentParent = getSpaceById(currentParent.parent_id);
            } else {
              break;
            }
          }
        }

        // Smart cache invalidation: only invalidate recursive views for affected parent chains
        if (oldParentId !== null && oldParentId !== undefined) {
          invalidateSpaceStatsForParentChain(oldParentId, getSpaceById);
        }
        if (newParentId !== null && newParentId !== undefined) {
          invalidateSpaceStatsForParentChain(newParentId, getSpaceById);
        }
      }

      // Update the space in state
      spacesSignal.value = spacesSignal.value.map((s) =>
        s.id === spaceId ? updatedSpace : s
      );

      // Invalidate and refetch stats for the updated space itself
      invalidateSpaceStats(spaceId);
      prefetchSpaceStats(spaceId);

      // Invalidate activity cache for this space if parent changed (affects recursive views)
      if (parentChanged) {
        invalidateActivityForSpace(spaceId);
      }

      showSuccess('Space updated successfully!');

      // Redirect to updated space if name/description/parent changed and router provided
      if (router && (nameChanged || parentChanged)) {
        navigateToSpace(updatedSpace, router);
      }

      if (onSuccess) {
        onSuccess(updatedSpace);
      }
    },
    onError: (error) => {
      console.error('Failed to update space:', error);
      showError('Failed to update space. Please try again.');
    },
    // Invalidate cache if parent changed (affects recursive views)
    cacheInvalidation: parentChanged
      ? { type: 'all' }
      : { type: 'none' },
  });
}

/**
 * ========================================================================
 * UI STATE ACTIONS
 * ========================================================================
 * These actions manage the UI state for space interactions:
 * - Expanding/collapsing spaces in the tree
 * - Toggling recursive mode for viewing child posts
 * - Selecting/unselecting spaces
 */

/**
 * Toggle expansion state of a space in the tree view
 */
export function toggleSpaceExpanded(spaceId: number): void {
  const current = new Set(expandedSpaces.value);
  if (current.has(spaceId)) {
    current.delete(spaceId);
  } else {
    current.add(spaceId);
  }
  expandedSpaces.value = current;

  // Persist to localStorage
  localStorage.setItem('expandedSpaces', JSON.stringify([...current]));
}

/**
 * Collapse all expanded spaces
 */
export function collapseAllSpaces(): void {
  expandedSpaces.value = new Set();
  localStorage.setItem('expandedSpaces', JSON.stringify([]));
}

/**
 * Expand all parent spaces for a given space (useful for revealing a nested space)
 */
export function expandParentSpaces(spaceId: number): void {
  const space = getSpaceById(spaceId);
  if (!space) return;

  const current = new Set(expandedSpaces.value);
  let currentSpace: Space | undefined = space;

  // Walk up the parent hierarchy and expand all parents
  while (currentSpace && currentSpace.parent_id !== null) {
    const parent = getSpaceById(currentSpace.parent_id);
    if (parent) {
      current.add(parent.id);
      currentSpace = parent;
    } else {
      break;
    }
  }

  expandedSpaces.value = current;
  localStorage.setItem('expandedSpaces', JSON.stringify([...current]));
}

/**
 * Toggle recursive mode for a space
 * When enabled, the timeline shows posts from the space and all its descendants
 */
export function toggleRecursiveMode(spaceId: number): void {
  const current = new Set(recursiveSpaces.value);
  if (current.has(spaceId)) {
    current.delete(spaceId);
  } else {
    current.add(spaceId);
  }
  recursiveSpaces.value = current;

  // Persist to localStorage
  localStorage.setItem('recursiveSpaces', JSON.stringify([...current]));
}

/**
 * Disable recursive mode for all spaces
 */
export function disableAllRecursiveModes(): void {
  recursiveSpaces.value = new Set();
  localStorage.setItem('recursiveSpaces', JSON.stringify([]));
}

/**
 * Select a space (sets it as the current space)
 * Pass null to unselect (show all spaces)
 */
export function selectSpace(space: Space | null): void {
  currentSpaceSignal.value = space;
  if (space) {
    localStorage.setItem('lastSpace', String(space.id));
  } else {
    localStorage.removeItem('lastSpace');
  }
}

/**
 * Unselect the current space (equivalent to selectSpace(null))
 * This shows the "All Spaces" view
 */
export function unselectSpace(): void {
  selectSpace(null);
}

/**
 * ========================================================================
 * NAVIGATION ACTIONS WITH CASCADE EFFECTS
 * ========================================================================
 * These actions handle navigation with automatic cascade effects:
 * - URL changes
 * - Post refetching
 * - State updates
 */

/**
 * Navigate to a space (with cascade effects)
 * This triggers URL change → space selection → post refetch
 *
 * @param space - The space to navigate to
 * @param router - The router instance from preact-iso (location object)
 */
export function navigateToSpace(space: Space, router: any): void {
  // Build space path
  const pathSegments: string[] = [];
  let current: Space | undefined = space;

  while (current) {
    pathSegments.unshift(generateSlug(current.name));
    if (current.parent_id !== null) {
      current = getSpaceById(current.parent_id);
    } else {
      break;
    }
  }

  const path = '/' + pathSegments.join('/');

  // Navigate to the space path (triggers cascade: URL change → currentSpace update → posts refetch)
  router.route(path);

  // Expand parent spaces to show the selected space in the tree
  expandParentSpaces(space.id);
}

/**
 * Navigate to "All Spaces" view (with cascade effects)
 * This triggers URL change → currentSpace = null → show all posts
 *
 * @param router - The router instance from preact-iso (location object)
 */
export function navigateToAllSpaces(router: any): void {
  // Navigate to root (triggers cascade: URL change → currentSpace = null → posts refetch)
  router.route('/');

  // Unselect any currently selected space
  unselectSpace();
}
