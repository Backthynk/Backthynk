import { spaces } from '@core/state';
import type { Space } from '@core/api';
import { activityStyles } from '../../styles/activity';

const Breadcrumb = activityStyles.breadcrumb;

interface SpaceBreadcrumbProps {
  spaceId: number;
  recursiveMode: boolean;
}

// Helper function to count all descendant spaces recursively
function countDescendantSpaces(parentId: number, allSpaces: Space[]): number {
  let count = 0;
  const directChildren = allSpaces.filter((cat) => cat.parent_id === parentId);

  for (const child of directChildren) {
    count++; // Count this child
    count += countDescendantSpaces(child.id, allSpaces); // Count its descendants
  }

  return count;
}

export function SpaceBreadcrumb({ spaceId, recursiveMode }: SpaceBreadcrumbProps) {
  const allSpaces = spaces.value;

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
    const descendantCount = countDescendantSpaces(currentSpace.id, allSpaces);
    if (descendantCount > 0) {
      const displayCount = descendantCount > 99 ? '99+' : descendantCount;
      const subspacesText = descendantCount === 1 ? 'subspace' : 'subspaces';
      const tooltip = `Exploring ${currentSpace.name} and ${descendantCount} of its ${subspacesText}`;

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
