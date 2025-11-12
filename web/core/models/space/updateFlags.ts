/**
 * Bitwise flags for space update change detection
 *
 * This allows precise tracking of what changed in a space update operation,
 * enabling optimized cache handling and state updates.
 */

// Change type flags (powers of 2 for bitwise operations)
export enum SpaceChangeFlags {
  NONE = 0,
  NAME = 1 << 0,          // 0001 - Name changed (affects URL, breadcrumbs)
  DESCRIPTION = 1 << 1,   // 0010 - Description changed (metadata only)
  PARENT = 1 << 2,        // 0100 - Parent changed (affects hierarchy, counts, caches)

  // Composite flags for common scenarios
  METADATA_ONLY = DESCRIPTION,
  PATH_CHANGE = NAME | PARENT,
  ALL = NAME | DESCRIPTION | PARENT,
}

/**
 * Detect what changed in a space update
 */
export function detectSpaceChanges(
  oldSpace: { name: string; description: string; parent_id: number | null },
  payload: { name?: string; description?: string; parent_id?: number | null }
): SpaceChangeFlags {
  let flags = SpaceChangeFlags.NONE;

  // Check name change
  if (payload.name !== undefined && payload.name !== oldSpace.name) {
    flags |= SpaceChangeFlags.NAME;
  }

  // Check description change
  if (payload.description !== undefined && payload.description !== oldSpace.description) {
    flags |= SpaceChangeFlags.DESCRIPTION;
  }

  // Check parent change
  if (payload.parent_id !== undefined && payload.parent_id !== oldSpace.parent_id) {
    flags |= SpaceChangeFlags.PARENT;
  }

  return flags;
}

/**
 * Check if a specific change occurred
 */
export function hasChange(flags: SpaceChangeFlags, checkFlag: SpaceChangeFlags): boolean {
  return (flags & checkFlag) === checkFlag;
}

/**
 * Check if any of the specified changes occurred
 */
export function hasAnyChange(flags: SpaceChangeFlags, ...checkFlags: SpaceChangeFlags[]): boolean {
  return checkFlags.some(flag => hasChange(flags, flag));
}

/**
 * Check if all of the specified changes occurred
 */
export function hasAllChanges(flags: SpaceChangeFlags, ...checkFlags: SpaceChangeFlags[]): boolean {
  return checkFlags.every(flag => hasChange(flags, flag));
}

/**
 * Get human-readable list of changes
 */
export function describeChanges(flags: SpaceChangeFlags): string[] {
  const changes: string[] = [];

  if (hasChange(flags, SpaceChangeFlags.NAME)) {
    changes.push('name');
  }
  if (hasChange(flags, SpaceChangeFlags.DESCRIPTION)) {
    changes.push('description');
  }
  if (hasChange(flags, SpaceChangeFlags.PARENT)) {
    changes.push('parent');
  }

  return changes;
}
