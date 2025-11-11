/**
 * Tests for useStatsCard Hook
 * Specifically testing that it reacts to signal changes
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/preact';
import { useStatsCard } from '../useStatsCard';
import { spaces as spacesSignal, recursiveSpaces } from '../../state/spaces';
import { createMockSpace, resetFactoryCounters } from '../../__tests__/factories';
import { clientConfig } from '../../state/settings';

describe('useStatsCard', () => {
  beforeEach(() => {
    resetFactoryCounters();
    spacesSignal.value = [];
    recursiveSpaces.value = new Set();
    clientConfig.value = { ...clientConfig.value, space_stats: true };
  });

  it('should re-compute post count when spaces signal changes', () => {
    const space = createMockSpace({ id: 1, post_count: 10, recursive_post_count: 10 });
    spacesSignal.value = [space];

    const { result, rerender } = renderHook(() => useStatsCard(space));

    // Initial post count
    expect(result.current.postCount).toBe(10);

    // Update the spaces signal with new post count
    const updatedSpace = { ...space, post_count: 9, recursive_post_count: 9 };
    spacesSignal.value = [updatedSpace];

    // Re-render the hook
    rerender();

    // Post count should be updated
    expect(result.current.postCount).toBe(9);
  });

  it('should use the latest space object from signal, not the stale prop', () => {
    const space = createMockSpace({ id: 1, post_count: 10, recursive_post_count: 10 });
    spacesSignal.value = [space];

    // Pass the original space object as prop
    const { result, rerender } = renderHook(() => useStatsCard(space));

    expect(result.current.postCount).toBe(10);

    // Update the spaces signal with a NEW object (different reference)
    const newSpaceObject = createMockSpace({ id: 1, post_count: 5, recursive_post_count: 5 });
    spacesSignal.value = [newSpaceObject];

    // Re-render with the SAME stale space prop
    rerender();

    // Should still read the updated count from the signal, not the stale prop
    expect(result.current.postCount).toBe(5);
  });

  it('should handle recursive mode correctly', () => {
    const space = createMockSpace({ id: 1, post_count: 10, recursive_post_count: 20 });
    spacesSignal.value = [space];

    // Start in flat mode
    const { result, rerender } = renderHook(() => useStatsCard(space));
    expect(result.current.postCount).toBe(10);
    expect(result.current.isRecursive).toBe(false);

    // Switch to recursive mode
    recursiveSpaces.value = new Set([1]);
    rerender();

    expect(result.current.postCount).toBe(20);
    expect(result.current.isRecursive).toBe(true);

    // Update counts while in recursive mode
    const updatedSpace = createMockSpace({ id: 1, post_count: 8, recursive_post_count: 15 });
    spacesSignal.value = [updatedSpace];
    rerender();

    expect(result.current.postCount).toBe(15); // Should use recursive count
  });

  it('should return 0 if space is deleted from signal', () => {
    const space = createMockSpace({ id: 1, post_count: 10, recursive_post_count: 10 });
    spacesSignal.value = [space];

    const { result, rerender } = renderHook(() => useStatsCard(space));
    expect(result.current.postCount).toBe(10);

    // Remove the space from the signal
    spacesSignal.value = [];
    rerender();

    // Should return 0 when space is not found
    expect(result.current.postCount).toBe(0);
  });

  it('should work with All Spaces view (space = null)', () => {
    const space1 = createMockSpace({ id: 1, post_count: 10, recursive_post_count: 10 });
    const space2 = createMockSpace({ id: 2, post_count: 15, recursive_post_count: 15 });
    spacesSignal.value = [space1, space2];

    const { result, rerender } = renderHook(() => useStatsCard(null));

    // Should sum all space post counts
    expect(result.current.postCount).toBe(25);

    // Update space counts
    const updatedSpace1 = { ...space1, post_count: 9, recursive_post_count: 9 };
    spacesSignal.value = [updatedSpace1, space2];
    rerender();

    // Should reflect the update
    expect(result.current.postCount).toBe(24);
  });
});
