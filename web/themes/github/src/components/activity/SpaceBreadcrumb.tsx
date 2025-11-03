import { spaces, isRecursiveMode } from '@core/state';
import type { Space } from '@core/api';
import { activityStyles } from '../../styles/activity';

const Breadcrumb = activityStyles.breadcrumb;

interface SpaceBreadcrumbProps {
  spaceId: number;
  recursiveMode?: boolean; // Optional now, we'll get it from state
}

// Helper function to get all descendant spaces recursively
function getAllDescendantSpaces(parentId: number, allSpaces: Space[]): Space[] {
  const descendants: Space[] = [];
  const directChildren = allSpaces.filter((cat) => cat.parent_id === parentId);

  for (const child of directChildren) {
    descendants.push(child); // Add this child
    descendants.push(...getAllDescendantSpaces(child.id, allSpaces)); // Add its descendants
  }

  return descendants;
}

export function SpaceBreadcrumb({ spaceId, recursiveMode: recursiveModeProp }: SpaceBreadcrumbProps) {
  const allSpaces = spaces.value;
  // Use prop if provided (for backwards compatibility), otherwise get from global state
  const recursiveMode = recursiveModeProp !== undefined ? recursiveModeProp : isRecursiveMode(spaceId);

  // If spaceId is 0, show "All Spaces"
  if (spaceId === 0) {
    return (
      <Breadcrumb>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          All Spaces
        </span>
      </Breadcrumb>
    );
  }

  // Find current space
  const currentSpace = allSpaces.find((s) => s.id === spaceId);
  if (!currentSpace) {
    return (
      <Breadcrumb>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Unknown Space
        </span>
      </Breadcrumb>
    );
  }

  // Build breadcrumb path from current space up to root
  const breadcrumbPath: Space[] = [];
  let space: Space | undefined = currentSpace;

  while (space) {
    breadcrumbPath.unshift(space);
    if (space.parent_id && allSpaces) {
      space = allSpaces.find((cat) => cat.id === space!.parent_id);
    } else {
      space = undefined;
    }
  }

  // Generate breadcrumb HTML - show only last 2 spaces if depth > 2
  let breadcrumbElements: any[] = [];

  if (breadcrumbPath.length > 2) {
    // Show "... >" followed by the last 2 spaces
    const lastTwo = breadcrumbPath.slice(-2);
    const parentBeforeLast = breadcrumbPath[breadcrumbPath.length - 3];

    breadcrumbElements.push(
      <span
        key="ellipsis"
        class="breadcrumb-link"
        onClick={() => {
          // TODO: Navigate to parent space
          console.log('Navigate to space:', parentBeforeLast.id);
        }}
      >
        ...
      </span>
    );

    breadcrumbElements.push(
      <span key="sep-ellipsis" class="breadcrumb-separator">
        {'>'}
      </span>
    );

    lastTwo.forEach((cat, index) => {
      const isLast = index === lastTwo.length - 1;

      if (isLast) {
        breadcrumbElements.push(
          <span key={`space-${cat.id}`} style={{ fontWeight: 600 }}>
            {cat.name}
          </span>
        );
      } else {
        breadcrumbElements.push(
          <span
            key={`space-${cat.id}`}
            class="breadcrumb-link"
            onClick={() => {
              // TODO: Navigate to space
              console.log('Navigate to space:', cat.id);
            }}
          >
            {cat.name}
          </span>
        );
        breadcrumbElements.push(
          <span key={`sep-${cat.id}`} class="breadcrumb-separator">
            {'>'}
          </span>
        );
      }
    });
  } else {
    // Show all spaces if depth <= 2
    breadcrumbPath.forEach((cat, index) => {
      const isLast = index === breadcrumbPath.length - 1;

      if (isLast) {
        breadcrumbElements.push(
          <span key={`space-${cat.id}`} style={{ fontWeight: 600 }}>
            {cat.name}
          </span>
        );
      } else {
        breadcrumbElements.push(
          <span
            key={`space-${cat.id}`}
            class="breadcrumb-link"
            onClick={() => {
              // TODO: Navigate to space
              console.log('Navigate to space:', cat.id);
            }}
          >
            {cat.name}
          </span>
        );
        breadcrumbElements.push(
          <span key={`sep-${cat.id}`} class="breadcrumb-separator">
            {'>'}
          </span>
        );
      }
    });
  }

  // Add recursive badge if in recursive mode
  if (recursiveMode) {
    const descendants = getAllDescendantSpaces(currentSpace.id, allSpaces);
    if (descendants.length > 0) {
      const displayCount = descendants.length > 9 ? '9+' : descendants.length.toString();

      // Build tooltip with space names
      const maxDisplay = 9;
      const spacesToShow = descendants.slice(0, maxDisplay);
      const remaining = descendants.length - maxDisplay;

      let tooltipLines = [`Exploring recursively:\n${currentSpace.name}`];
      spacesToShow.forEach(space => {
        tooltipLines.push(`  • ${space.name}`);
      });
      if (remaining > 0) {
        tooltipLines.push(`  ...and ${remaining} more`);
      }
      const tooltip = tooltipLines.join('\n');

      breadcrumbElements.push(
        <span key="sep-recursive" class="breadcrumb-separator">
          /
        </span>
      );
      breadcrumbElements.push(
        <span key="recursive-badge" class="recursive-badge" data-tooltip={tooltip}>
          {displayCount}
        </span>
      );
    }
  }

  return <Breadcrumb>{breadcrumbElements}</Breadcrumb>;
}
