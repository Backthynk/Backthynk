import { describe, it, expect } from 'vitest';
import {
  SpaceChangeFlags,
  detectSpaceChanges,
  hasChange,
  hasAnyChange,
  hasAllChanges,
  describeChanges,
} from '../spaceUpdateFlags';

describe('spaceUpdateFlags', () => {
  const mockOldSpace = {
    name: 'Original Name',
    description: 'Original Description',
    parent_id: 1,
  };

  describe('detectSpaceChanges', () => {
    it('should detect no changes when payload is empty', () => {
      const flags = detectSpaceChanges(mockOldSpace, {});
      expect(flags).toBe(SpaceChangeFlags.NONE);
    });

    it('should detect name change only', () => {
      const flags = detectSpaceChanges(mockOldSpace, { name: 'New Name' });
      expect(flags).toBe(SpaceChangeFlags.NAME);
    });

    it('should detect description change only', () => {
      const flags = detectSpaceChanges(mockOldSpace, { description: 'New Description' });
      expect(flags).toBe(SpaceChangeFlags.DESCRIPTION);
    });

    it('should detect parent change only', () => {
      const flags = detectSpaceChanges(mockOldSpace, { parent_id: 2 });
      expect(flags).toBe(SpaceChangeFlags.PARENT);
    });

    it('should detect multiple changes with bitwise OR', () => {
      const flags = detectSpaceChanges(mockOldSpace, {
        name: 'New Name',
        description: 'New Description',
      });
      expect(flags).toBe(SpaceChangeFlags.NAME | SpaceChangeFlags.DESCRIPTION);
    });

    it('should detect all changes', () => {
      const flags = detectSpaceChanges(mockOldSpace, {
        name: 'New Name',
        description: 'New Description',
        parent_id: 2,
      });
      expect(flags).toBe(SpaceChangeFlags.ALL);
    });

    it('should not detect change if value is the same', () => {
      const flags = detectSpaceChanges(mockOldSpace, {
        name: 'Original Name',
        description: 'Original Description',
        parent_id: 1,
      });
      expect(flags).toBe(SpaceChangeFlags.NONE);
    });

    it('should detect parent change from non-null to null', () => {
      const flags = detectSpaceChanges(mockOldSpace, { parent_id: null });
      expect(flags).toBe(SpaceChangeFlags.PARENT);
    });

    it('should detect parent change from null to non-null', () => {
      const oldSpace = { ...mockOldSpace, parent_id: null };
      const flags = detectSpaceChanges(oldSpace, { parent_id: 1 });
      expect(flags).toBe(SpaceChangeFlags.PARENT);
    });
  });

  describe('hasChange', () => {
    it('should return true if specific flag is set', () => {
      const flags = SpaceChangeFlags.NAME | SpaceChangeFlags.DESCRIPTION;
      expect(hasChange(flags, SpaceChangeFlags.NAME)).toBe(true);
      expect(hasChange(flags, SpaceChangeFlags.DESCRIPTION)).toBe(true);
    });

    it('should return false if specific flag is not set', () => {
      const flags = SpaceChangeFlags.NAME | SpaceChangeFlags.DESCRIPTION;
      expect(hasChange(flags, SpaceChangeFlags.PARENT)).toBe(false);
    });

    it('should work with composite flags', () => {
      const flags = SpaceChangeFlags.NAME | SpaceChangeFlags.PARENT;
      expect(hasChange(flags, SpaceChangeFlags.PATH_CHANGE)).toBe(true);
    });
  });

  describe('hasAnyChange', () => {
    it('should return true if any flag is set', () => {
      const flags = SpaceChangeFlags.NAME;
      expect(hasAnyChange(flags, SpaceChangeFlags.NAME, SpaceChangeFlags.DESCRIPTION)).toBe(true);
    });

    it('should return false if none of the flags are set', () => {
      const flags = SpaceChangeFlags.NAME;
      expect(hasAnyChange(flags, SpaceChangeFlags.DESCRIPTION, SpaceChangeFlags.PARENT)).toBe(false);
    });
  });

  describe('hasAllChanges', () => {
    it('should return true if all flags are set', () => {
      const flags = SpaceChangeFlags.NAME | SpaceChangeFlags.DESCRIPTION;
      expect(hasAllChanges(flags, SpaceChangeFlags.NAME, SpaceChangeFlags.DESCRIPTION)).toBe(true);
    });

    it('should return false if not all flags are set', () => {
      const flags = SpaceChangeFlags.NAME;
      expect(hasAllChanges(flags, SpaceChangeFlags.NAME, SpaceChangeFlags.DESCRIPTION)).toBe(false);
    });
  });

  describe('describeChanges', () => {
    it('should return empty array for no changes', () => {
      expect(describeChanges(SpaceChangeFlags.NONE)).toEqual([]);
    });

    it('should describe single change', () => {
      expect(describeChanges(SpaceChangeFlags.NAME)).toEqual(['name']);
    });

    it('should describe multiple changes', () => {
      const flags = SpaceChangeFlags.NAME | SpaceChangeFlags.PARENT;
      const changes = describeChanges(flags);
      expect(changes).toContain('name');
      expect(changes).toContain('parent');
      expect(changes.length).toBe(2);
    });

    it('should describe all changes', () => {
      const changes = describeChanges(SpaceChangeFlags.ALL);
      expect(changes).toContain('name');
      expect(changes).toContain('description');
      expect(changes).toContain('parent');
      expect(changes.length).toBe(3);
    });
  });

  describe('Bitwise operations', () => {
    it('should support bitwise OR for combining flags', () => {
      const combined = SpaceChangeFlags.NAME | SpaceChangeFlags.DESCRIPTION;
      expect(hasChange(combined, SpaceChangeFlags.NAME)).toBe(true);
      expect(hasChange(combined, SpaceChangeFlags.DESCRIPTION)).toBe(true);
      expect(hasChange(combined, SpaceChangeFlags.PARENT)).toBe(false);
    });

    it('should support bitwise AND for checking flags', () => {
      const flags = SpaceChangeFlags.NAME | SpaceChangeFlags.DESCRIPTION;
      expect((flags & SpaceChangeFlags.NAME) === SpaceChangeFlags.NAME).toBe(true);
      expect((flags & SpaceChangeFlags.PARENT) === SpaceChangeFlags.PARENT).toBe(false);
    });

    it('should support composite flags', () => {
      // PATH_CHANGE = NAME | PARENT
      const pathChangeFlags = SpaceChangeFlags.NAME | SpaceChangeFlags.PARENT;
      expect(hasChange(pathChangeFlags, SpaceChangeFlags.PATH_CHANGE)).toBe(true);

      // Only NAME is set, not both
      expect(hasChange(SpaceChangeFlags.NAME, SpaceChangeFlags.PATH_CHANGE)).toBe(false);
    });
  });
});
