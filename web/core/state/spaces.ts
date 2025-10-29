import { signal, computed } from '@preact/signals';
import type { Space } from '../api';

// Global state for spaces
export const spaces = signal<Space[]>([]);
export const currentSpace = signal<Space | null>(null);
export const expandedSpaces = signal<Set<number>>(new Set());

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
