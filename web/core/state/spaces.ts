import { signal, computed } from '@preact/signals';
import { generateSlug } from '../utils';
import type { Space } from '../api';

// Global state for spaces
export const spaces = signal<Space[]>([]);
export const currentSpace = signal<Space | null>(null);
export const expandedSpaces = signal<Set<number>>(new Set());
export const recursiveSpaces = signal<Set<number>>(new Set());

// Computed values
export const rootSpaces = computed(() => {
  return spaces.value.filter((space) => space.parent_id === null);
});

export const getSpaceById = (id: number): Space | undefined => {
  return spaces.value.find((space) => space.id === id);
};

export const getChildSpaces = (parentId: number): Space[] => {
  return spaces.value.filter((space) => space.parent_id === parentId);
};

export const hasChildren = (spaceId: number): boolean => {
  return spaces.value.some((space) => space.parent_id === spaceId);
};

// Utility functions for loading persisted state
export const loadExpandedSpaces = () => {
  const saved = localStorage.getItem('expandedSpaces');
  if (saved) {
    try {
      expandedSpaces.value = new Set(JSON.parse(saved));
    } catch (error) {
      console.error('Failed to load expanded spaces:', error);
    }
  }
};

export const getLastSpaceId = (): number | null => {
  const saved = localStorage.getItem('lastSpace');
  return saved ? parseInt(saved, 10) : null;
};

export const loadRecursiveModes = () => {
  const saved = localStorage.getItem('recursiveSpaces');
  if (saved) {
    try {
      recursiveSpaces.value = new Set(JSON.parse(saved));
    } catch (error) {
      console.error('Failed to load recursive modes:', error);
    }
  }
};

// Check if a space is in recursive mode
export const isRecursiveMode = (spaceId: number): boolean => {
  return recursiveSpaces.value.has(spaceId);
};

// Check if a space is eligible for recursive mode (has children)
export const isEligibleForRecursive = (spaceId: number | null | undefined): boolean => {
  if (!spaceId) return false;
  return hasChildren(spaceId);
};

// Get all descendant space IDs for a given space (for recursive fetching)
export const getDescendantSpaceIds = (spaceId: number): number[] => {
  const result: number[] = [];
  const children = getChildSpaces(spaceId);

  for (const child of children) {
    result.push(child.id);
    result.push(...getDescendantSpaceIds(child.id));
  }

  return result;
};

// ============================================================================
// Space Breadcrumb Functions
// ============================================================================

/**
 * Get the full breadcrumb path for a space (e.g., "Parent / Child")
 */
export const getSpaceBreadcrumb = (spaceId: number): string => {
  const space = spaces.value.find(s => s.id === spaceId);
  if (!space) return '';

  const breadcrumbs: string[] = [];
  let current: Space | undefined = space;

  while (current) {
    breadcrumbs.unshift(current.name);
    if (current.parent_id === null) break;
    const parentId: number = current.parent_id;
    current = spaces.value.find(s => s.id === parentId);
  }

  return breadcrumbs.join(' / ');
};

// ============================================================================
// Space Stats Functions
// ============================================================================

/**
 * Calculate total post count across all spaces
 */
export const getTotalPostCount = (): number => {
  return spaces.value.reduce((sum, s) => sum + (s.post_count || 0), 0);
};

/**
 * Get post count for a specific space (respects recursive mode)
 */
export const getSpacePostCount = (space: Space): number => {
  return isRecursiveMode(space.id)
    ? space.recursive_post_count || 0
    : space.post_count || 0;
};

/**
 * Get the earliest creation date across all spaces
 */
export const getEarliestSpaceCreationDate = (): number | null => {
  const allSpaces = spaces.value;
  if (allSpaces.length === 0) return null;

  const earliestSpace = allSpaces.reduce((earliest, current) => {
    if (!earliest || current.created < earliest.created) {
      return current;
    }
    return earliest;
  });

  return earliestSpace.created;
};

// ============================================================================
// Space Validation Functions
// ============================================================================

/**
 * Check if a space name/slug already exists at the same level
 * @param name - The space name to check
 * @param parentId - The parent space ID (null for root level)
 * @param excludeSpaceId - Space ID to exclude from the check (for updates)
 */
export const checkDuplicateSlug = (
  name: string,
  parentId: number | null,
  excludeSpaceId?: number
): { isDuplicate: boolean; conflictingSpace?: Space } => {
  const slug = generateSlug(name);
  const allSpaces = spaces.value;

  // Find spaces with the same parent
  const siblings = allSpaces.filter((s) => {
    const isSameParent = s.parent_id === parentId;
    const isNotExcluded = excludeSpaceId === undefined || s.id !== excludeSpaceId;
    return isSameParent && isNotExcluded;
  });

  // Check if any sibling has the same slug
  const duplicate = siblings.find((s) => generateSlug(s.name) === slug);

  return {
    isDuplicate: !!duplicate,
    conflictingSpace: duplicate,
  };
};

/**
 * Validate parent selection for a space
 * @param parentId - The parent space ID to validate
 * @param currentSpaceId - Current space ID (for update operations to prevent circular references)
 */
export const validateParentSpace = (
  parentId: number | null,
  currentSpaceId?: number
): { isValid: boolean; error?: string } => {
  if (parentId === null) {
    return { isValid: true };
  }

  // Prevent setting parent to itself (for updates)
  if (currentSpaceId !== undefined && parentId === currentSpaceId) {
    return { isValid: false, error: 'Cannot set a space as its own parent' };
  }

  const parentSpace = spaces.value.find((s) => s.id === parentId);
  if (!parentSpace) {
    return { isValid: false, error: 'Invalid parent space' };
  }

  // Prevent circular reference (for updates)
  if (currentSpaceId !== undefined) {
    const isDescendant = (spaceId: number, potentialAncestorId: number): boolean => {
      const s = spaces.value.find((sp) => sp.id === spaceId);
      if (!s || s.parent_id === null) return false;
      if (s.parent_id === potentialAncestorId) return true;
      return isDescendant(s.parent_id, potentialAncestorId);
    };

    if (isDescendant(parentId, currentSpaceId)) {
      return {
        isValid: false,
        error: 'Cannot set a descendant space as parent (would create circular reference)',
      };
    }
  }

  // Check depth constraint (max 2 levels: root -> level 1 -> level 2)
  if (parentSpace.parent_id !== null) {
    const grandparent = spaces.value.find((s) => s.id === parentSpace.parent_id);
    if (grandparent && grandparent.parent_id !== null) {
      return {
        isValid: false,
        error: 'Cannot create/move space: maximum depth (2 levels) would be exceeded',
      };
    }
  }

  return { isValid: true };
};

/**
 * Check if a space can be a parent (not at max depth)
 */
export const canBeParent = (spaceId: number): boolean => {
  const space = spaces.value.find((s) => s.id === spaceId);
  if (!space) return false;

  // If it has no parent, it's at level 0 (root), so it can have children
  if (space.parent_id === null) return true;

  // If it has a parent, check if that parent is at root level
  const parent = spaces.value.find((s) => s.id === space.parent_id);
  return parent?.parent_id === null;
};
