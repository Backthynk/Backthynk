/**
 * Space Stats State
 *
 * Reactive state layer for space statistics.
 * This provides signal-based reactivity for UI components while the cache layer handles data fetching/storage.
 */

import { signal } from '@preact/signals';
import type { SpaceStats } from '../api/spaces';

/**
 * Reactive signal store for space stats
 * Key format: "spaceId:recursive"
 */
export const spaceStatsStore = signal<Map<string, SpaceStats>>(new Map());

/**
 * Loading state for space stats
 * Key format: "spaceId:recursive"
 */
export const spaceStatsLoadingStore = signal<Set<string>>(new Set());

/**
 * Generate a stats key from space ID and recursive flag
 */
function generateStatsKey(spaceId: number, recursive: boolean): string {
  return `${spaceId}:${recursive ? 'recursive' : 'flat'}`;
}

/**
 * Get space stats from reactive state
 */
export function getSpaceStats(spaceId: number, recursive: boolean): SpaceStats | null {
  const key = generateStatsKey(spaceId, recursive);
  return spaceStatsStore.value.get(key) || null;
}

/**
 * Set space stats in reactive state
 */
export function setSpaceStats(spaceId: number, recursive: boolean, stats: SpaceStats | null): void {
  const key = generateStatsKey(spaceId, recursive);
  const newStore = new Map(spaceStatsStore.value);

  if (stats === null) {
    newStore.delete(key);
  } else {
    newStore.set(key, stats);
  }

  // Update signal to trigger reactivity
  spaceStatsStore.value = newStore;
}

/**
 * Check if stats are currently loading
 */
export function isLoadingStats(spaceId: number, recursive: boolean): boolean {
  const key = generateStatsKey(spaceId, recursive);
  return spaceStatsLoadingStore.value.has(key);
}

/**
 * Set loading state for space stats
 */
export function setStatsLoading(spaceId: number, recursive: boolean, loading: boolean): void {
  const key = generateStatsKey(spaceId, recursive);
  const newStore = new Set(spaceStatsLoadingStore.value);

  if (loading) {
    newStore.add(key);
  } else {
    newStore.delete(key);
  }

  // Update signal to trigger reactivity
  spaceStatsLoadingStore.value = newStore;
}

/**
 * Clear all space stats from state
 */
export function clearAllSpaceStats(): void {
  spaceStatsStore.value = new Map();
  spaceStatsLoadingStore.value = new Set();
}

/**
 * Clear stats for a specific space
 */
export function clearSpaceStats(spaceId: number, includeRecursive = true): void {
  const newStore = new Map(spaceStatsStore.value);

  if (includeRecursive) {
    // Clear both flat and recursive
    newStore.delete(generateStatsKey(spaceId, false));
    newStore.delete(generateStatsKey(spaceId, true));
  } else {
    // Only clear flat
    newStore.delete(generateStatsKey(spaceId, false));
  }

  spaceStatsStore.value = newStore;
}
