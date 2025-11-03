import { signal, computed } from '@preact/signals';
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

// State management functions
export const toggleSpaceExpanded = (spaceId: number) => {
  const current = new Set(expandedSpaces.value);
  if (current.has(spaceId)) {
    current.delete(spaceId);
  } else {
    current.add(spaceId);
  }
  expandedSpaces.value = current;

  // Persist to localStorage
  localStorage.setItem('expandedSpaces', JSON.stringify([...current]));
};

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

export const selectSpace = (space: Space | null) => {
  currentSpace.value = space;
  if (space) {
    localStorage.setItem('lastSpace', String(space.id));
  } else {
    localStorage.removeItem('lastSpace');
  }
};

export const getLastSpaceId = (): number | null => {
  const saved = localStorage.getItem('lastSpace');
  return saved ? parseInt(saved, 10) : null;
};

// Calculate recursive post count for a space (includes all child spaces)
export const getRecursivePostCount = (spaceId: number): number => {
  const space = getSpaceById(spaceId);
  if (!space) return 0;

  let total = space.post_count || 0;

  // Add post counts from all descendants recursively
  const children = getChildSpaces(spaceId);
  for (const child of children) {
    total += getRecursivePostCount(child.id);
  }

  return total;
};

// Expand all parent spaces for a given space
export const expandParentSpaces = (spaceId: number) => {
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
};

// Check if a space is in recursive mode
export const isRecursiveMode = (spaceId: number): boolean => {
  return recursiveSpaces.value.has(spaceId);
};

// Toggle recursive mode for a space
export const toggleRecursiveMode = (spaceId: number) => {
  const current = new Set(recursiveSpaces.value);
  if (current.has(spaceId)) {
    current.delete(spaceId);
  } else {
    current.add(spaceId);
  }
  recursiveSpaces.value = current;

  // Persist to localStorage
  localStorage.setItem('recursiveSpaces', JSON.stringify([...current]));
};

// Load recursive modes from localStorage
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
