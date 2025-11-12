import { spaces, getSpaceById } from '@core/state';

export interface SelectOption {
  value: string | number | null;
  label: string;
  depth?: number;
}

/**
 * Calculate the depth of a space in the hierarchy
 * @returns 0 for root spaces, 1 for children, 2 for grandchildren
 */
export function getSpaceDepth(spaceId: number): number {
  let depth = 0;
  let current = getSpaceById(spaceId);
  while (current?.parent_id !== null && current?.parent_id !== undefined) {
    depth++;
    current = getSpaceById(current.parent_id);
  }
  return depth;
}

/**
 * Get all descendant space IDs recursively
 * @returns Array of all descendant space IDs
 */
export function getDescendantIds(spaceId: number): number[] {
  const allSpaces = spaces.value;
  const descendants: number[] = [];
  const children = allSpaces.filter((s) => s.parent_id === spaceId);

  for (const child of children) {
    descendants.push(child.id);
    descendants.push(...getDescendantIds(child.id));
  }

  return descendants;
}

/**
 * Build space options for a hierarchical select dropdown
 * @param excludeSpaceId - Space ID to exclude along with its descendants
 * @param showAllDepths - If true, show all depth levels. If false, only show spaces that can be parents
 * @returns Array of select options with hierarchy represented by depth
 */
export function buildSpaceOptions(
  excludeSpaceId?: number,
  showAllDepths: boolean = false
): SelectOption[] {
  const allSpaces = spaces.value;
  const options: SelectOption[] = [{ value: null, label: 'None (Root Space)', depth: 0 }];

  // If we're updating a space, calculate how deep it currently is
  // and what the maximum allowed depth for potential parents is
  let excludedIds: number[] = [];
  let maxParentDepth = 2; // Default max depth is 2 (root -> level1 -> level2)

  if (excludeSpaceId) {
    // Exclude the space itself and all its descendants
    excludedIds = [excludeSpaceId, ...getDescendantIds(excludeSpaceId)];

    // Calculate max allowed parent depth based on space's descendants
    // Max total depth allowed is 2 (root=0, level1=1, level2=2)
    // So if moving a space, we need: parent_depth + 1 (space) + max_child_depth <= 2
    const hasChildren = allSpaces.some(s => s.parent_id === excludeSpaceId);

    if (hasChildren) {
      // Find the maximum depth among descendants
      const descendantIds = getDescendantIds(excludeSpaceId);
      let maxDescendantRelativeDepth = 0;

      for (const descId of descendantIds) {
        // Calculate depth relative to excludeSpaceId
        let relativeDepth = 0;
        let current = getSpaceById(descId);
        while (current && current.id !== excludeSpaceId) {
          relativeDepth++;
          if (current.parent_id === null) break;
          current = getSpaceById(current.parent_id);
        }
        maxDescendantRelativeDepth = Math.max(maxDescendantRelativeDepth, relativeDepth);
      }

      // If space has descendants that are maxDescendantRelativeDepth deep,
      // then parent can be at most depth (2 - 1 - maxDescendantRelativeDepth)
      // Example: space has child (depth 1), so parent can be at depth 2 - 1 - 1 = 0 (root only)
      // Example: space has no children, so parent can be at depth 2 - 1 - 0 = 1
      maxParentDepth = Math.max(0, 2 - 1 - maxDescendantRelativeDepth);
    } else {
      // No children, so parent can be at depth 1 (space becomes depth 2)
      maxParentDepth = 1;
    }
  }

  // Get root spaces (no parent)
  const rootSpaces = allSpaces.filter((s) => s.parent_id === null && !excludedIds.includes(s.id));

  // Add root spaces and their children based on allowed depth
  rootSpaces.forEach((rootSpace) => {
    options.push({
      value: rootSpace.id,
      label: rootSpace.name,
      depth: 0,
    });

    // Only add children if maxParentDepth >= 1
    if (maxParentDepth >= 1 || showAllDepths) {
      // Add level 1 children with depth
      const children = allSpaces.filter((s) => s.parent_id === rootSpace.id && !excludedIds.includes(s.id));
      children.forEach((child) => {
        options.push({
          value: child.id,
          label: `${rootSpace.name} / ${child.name}`,
          depth: 1,
        });

        // Only add grandchildren if maxParentDepth >= 2 or showAllDepths is true
        if (maxParentDepth >= 2 || showAllDepths) {
          const grandchildren = allSpaces.filter((s) => s.parent_id === child.id && !excludedIds.includes(s.id));
          grandchildren.forEach((grandchild) => {
            options.push({
              value: grandchild.id,
              label: `${rootSpace.name} / ${child.name} / ${grandchild.name}`,
              depth: 2,
            });
          });
        }
      });
    }
  });

  return options;
}
