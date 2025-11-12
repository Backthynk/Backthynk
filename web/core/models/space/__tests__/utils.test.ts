import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getSpaceDepth, getDescendantIds, buildSpaceOptions } from '../utils';
import * as state from '@core/state';

// Mock the state module
vi.mock('@core/state', () => ({
  spaces: { value: [] },
  getSpaceById: vi.fn(),
}));

describe('Space Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSpaceDepth', () => {
    it('should return 0 for root space (no parent)', () => {
      const mockSpace = { id: 1, name: 'Root', parent_id: null };
      vi.mocked(state.getSpaceById).mockReturnValue(mockSpace);

      expect(getSpaceDepth(1)).toBe(0);
    });

    it('should return 1 for first level child', () => {
      const rootSpace = { id: 1, name: 'Root', parent_id: null };
      const childSpace = { id: 2, name: 'Child', parent_id: 1 };

      vi.mocked(state.getSpaceById)
        .mockReturnValueOnce(childSpace)
        .mockReturnValueOnce(rootSpace);

      expect(getSpaceDepth(2)).toBe(1);
    });

    it('should return 2 for second level child (grandchild)', () => {
      const rootSpace = { id: 1, name: 'Root', parent_id: null };
      const childSpace = { id: 2, name: 'Child', parent_id: 1 };
      const grandchildSpace = { id: 3, name: 'Grandchild', parent_id: 2 };

      vi.mocked(state.getSpaceById)
        .mockReturnValueOnce(grandchildSpace)
        .mockReturnValueOnce(childSpace)
        .mockReturnValueOnce(rootSpace);

      expect(getSpaceDepth(3)).toBe(2);
    });
  });

  describe('getDescendantIds', () => {
    beforeEach(() => {
      // Reset spaces.value for each test
      state.spaces.value = [];
    });

    it('should return empty array for space with no children', () => {
      state.spaces.value = [
        { id: 1, name: 'Root', parent_id: null },
        { id: 2, name: 'Other', parent_id: null },
      ];

      expect(getDescendantIds(1)).toEqual([]);
    });

    it('should return direct children only', () => {
      state.spaces.value = [
        { id: 1, name: 'Root', parent_id: null },
        { id: 2, name: 'Child1', parent_id: 1 },
        { id: 3, name: 'Child2', parent_id: 1 },
      ];

      const descendants = getDescendantIds(1);
      expect(descendants).toHaveLength(2);
      expect(descendants).toContain(2);
      expect(descendants).toContain(3);
    });

    it('should return all descendants recursively', () => {
      state.spaces.value = [
        { id: 1, name: 'Root', parent_id: null },
        { id: 2, name: 'Child', parent_id: 1 },
        { id: 3, name: 'Grandchild', parent_id: 2 },
        { id: 4, name: 'Other', parent_id: null },
      ];

      const descendants = getDescendantIds(1);
      expect(descendants).toHaveLength(2);
      expect(descendants).toContain(2);
      expect(descendants).toContain(3);
    });

    it('should handle multiple branches', () => {
      state.spaces.value = [
        { id: 1, name: 'Root', parent_id: null },
        { id: 2, name: 'Child1', parent_id: 1 },
        { id: 3, name: 'Child2', parent_id: 1 },
        { id: 4, name: 'Grandchild1', parent_id: 2 },
        { id: 5, name: 'Grandchild2', parent_id: 3 },
      ];

      const descendants = getDescendantIds(1);
      expect(descendants).toHaveLength(4);
      expect(descendants).toContain(2);
      expect(descendants).toContain(3);
      expect(descendants).toContain(4);
      expect(descendants).toContain(5);
    });
  });

  describe('buildSpaceOptions', () => {
    beforeEach(() => {
      state.spaces.value = [];
    });

    it('should return only root option when no spaces exist', () => {
      state.spaces.value = [];
      const options = buildSpaceOptions();

      expect(options).toHaveLength(1);
      expect(options[0]).toEqual({
        value: null,
        label: 'None (Root Space)',
        depth: 0,
      });
    });

    it('should list root spaces with depth 0', () => {
      state.spaces.value = [
        { id: 1, name: 'Space A', parent_id: null },
        { id: 2, name: 'Space B', parent_id: null },
      ];

      const options = buildSpaceOptions();

      expect(options).toHaveLength(3); // Root option + 2 spaces
      expect(options[1]).toEqual({
        value: 1,
        label: 'Space A',
        depth: 0,
      });
      expect(options[2]).toEqual({
        value: 2,
        label: 'Space B',
        depth: 0,
      });
    });

    it('should include children with depth 1 and proper labels', () => {
      state.spaces.value = [
        { id: 1, name: 'Parent', parent_id: null },
        { id: 2, name: 'Child', parent_id: 1 },
      ];

      const options = buildSpaceOptions();

      expect(options).toHaveLength(3);
      expect(options[1]).toEqual({
        value: 1,
        label: 'Parent',
        depth: 0,
      });
      expect(options[2]).toEqual({
        value: 2,
        label: 'Parent / Child',
        depth: 1,
      });
    });

    it('should include grandchildren with depth 2 and proper labels', () => {
      state.spaces.value = [
        { id: 1, name: 'Root', parent_id: null },
        { id: 2, name: 'Child', parent_id: 1 },
        { id: 3, name: 'Grandchild', parent_id: 2 },
      ];

      const options = buildSpaceOptions();

      expect(options).toHaveLength(4);
      expect(options[3]).toEqual({
        value: 3,
        label: 'Root / Child / Grandchild',
        depth: 2,
      });
    });

    it('should exclude specified space and its descendants', () => {
      state.spaces.value = [
        { id: 1, name: 'Root1', parent_id: null },
        { id: 2, name: 'Root2', parent_id: null },
        { id: 3, name: 'Child', parent_id: 2 },
        { id: 4, name: 'Grandchild', parent_id: 3 },
      ];

      const options = buildSpaceOptions(3); // Exclude Child

      const values = options.map(o => o.value);
      expect(values).not.toContain(3); // Child excluded
      expect(values).not.toContain(4); // Grandchild excluded
      expect(values).toContain(1); // Root1 included
      expect(values).toContain(2); // Root2 included
    });

    it('should limit parent depth for spaces with children', () => {
      state.spaces.value = [
        { id: 1, name: 'Root', parent_id: null },
        { id: 2, name: 'Level1', parent_id: 1 },
        { id: 3, name: 'Level2', parent_id: 2 },
        { id: 4, name: 'ChildOfExcluded', parent_id: 3 },
      ];

      vi.mocked(state.getSpaceById).mockImplementation((id: number) => {
        return state.spaces.value.find(s => s.id === id);
      });

      // Exclude space 3 which has child (space 4)
      // Since space 3 has a child at depth 1 relative to it,
      // parent can only be at depth 0 (root only)
      const options = buildSpaceOptions(3);

      // Should only include root spaces as potential parents
      const nonRootOptions = options.filter(o => o.value !== null);
      const maxDepth = Math.max(...nonRootOptions.map(o => o.depth || 0));
      expect(maxDepth).toBe(0);
    });

    it('should show all depths when showAllDepths is true', () => {
      state.spaces.value = [
        { id: 1, name: 'Root', parent_id: null },
        { id: 2, name: 'Level1', parent_id: 1 },
        { id: 3, name: 'Level2', parent_id: 2 },
      ];

      const options = buildSpaceOptions(undefined, true);

      expect(options).toHaveLength(4); // Root option + 3 spaces
      expect(options.map(o => o.value)).toEqual([null, 1, 2, 3]);
    });

    it('should handle multiple root spaces with hierarchies', () => {
      state.spaces.value = [
        { id: 1, name: 'Root1', parent_id: null },
        { id: 2, name: 'Root2', parent_id: null },
        { id: 3, name: 'Child1', parent_id: 1 },
        { id: 4, name: 'Child2', parent_id: 2 },
      ];

      const options = buildSpaceOptions();

      expect(options).toHaveLength(5);
      expect(options.map(o => o.label)).toEqual([
        'None (Root Space)',
        'Root1',
        'Root1 / Child1',
        'Root2',
        'Root2 / Child2',
      ]);
    });

    it('should set correct depth values for hierarchical options', () => {
      state.spaces.value = [
        { id: 1, name: 'Root', parent_id: null },
        { id: 2, name: 'Child', parent_id: 1 },
        { id: 3, name: 'Grandchild', parent_id: 2 },
      ];

      const options = buildSpaceOptions();

      const rootOption = options.find(o => o.value === null);
      const rootSpace = options.find(o => o.value === 1);
      const childSpace = options.find(o => o.value === 2);
      const grandchildSpace = options.find(o => o.value === 3);

      expect(rootOption?.depth).toBe(0);
      expect(rootSpace?.depth).toBe(0);
      expect(childSpace?.depth).toBe(1);
      expect(grandchildSpace?.depth).toBe(2);
    });
  });
});
