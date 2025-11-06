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
