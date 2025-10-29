import { useLocation } from 'preact-iso';
import { expandedSpaces, toggleSpaceExpanded, hasChildren, getSpaceById, getRecursivePostCount } from '@core/state';
import { sidebarStyles } from '../../styles/sidebar';
import type { Space } from '@core/api';

const SpaceRow = sidebarStyles.spaceRow;
const ExpandButton = sidebarStyles.expandButton;
const SpaceName = sidebarStyles.spaceName;
const PostCount = sidebarStyles.postCount;
const Children = sidebarStyles.children;
const StyledSpaceItem = sidebarStyles.spaceItem;

interface SpaceItemProps {
  space: Space;
  depth?: number;
  sortedChildren: Space[];
  renderSpace: (space: Space, depth: number) => any;
  showPostCount?: boolean;
}

export function SpaceItem({ space, depth = 0, sortedChildren, renderSpace, showPostCount = false }: SpaceItemProps) {
  const location = useLocation();
  const expanded = expandedSpaces.value;
  const isExpanded = expanded.has(space.id);
  const hasChildrenSpaces = hasChildren(space.id);
  const recursivePostCount = getRecursivePostCount(space.id);

  // Get space path for URL
  const getSpacePath = (space: Space): string => {
    const path: string[] = [];
    let current: Space | null = space;
    while (current) {
      path.unshift(current.name.toLowerCase().replace(/\s+/g, '-'));
      if (current.parent_id) {
        current = getSpaceById(current.parent_id) || null;
      } else {
        break;
      }
    }
    return '/' + path.join('/');
  };

  // Check if space is selected
  const spacePath = getSpacePath(space);
  const isSelected = location.url === spacePath;

  let clickTimeout: ReturnType<typeof setTimeout> | null = null;

  const handleRowClick = (e: MouseEvent) => {
    // Don't navigate if clicking on expand button
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // Delay single click to detect double-click
    if (clickTimeout) {
      clearTimeout(clickTimeout);
      clickTimeout = null;
      return;
    }

    clickTimeout = setTimeout(() => {
      clickTimeout = null;
      // If the space is already selected, navigate to root
      if (isSelected) {
        location.route('/');
      } else {
        location.route(spacePath);
      }
    }, 150);
  };

  const handleDoubleClick = (e: MouseEvent) => {
    // Don't navigate on double click
    e.preventDefault();
    e.stopPropagation();

    // Clear single click timeout
    if (clickTimeout) {
      clearTimeout(clickTimeout);
      clickTimeout = null;
    }

    // Toggle expansion if has children
    if (hasChildrenSpaces) {
      toggleSpaceExpanded(space.id);
    }
  };

  return (
    <StyledSpaceItem>
      <SpaceRow
        className={isSelected ? 'selected' : ''}
        style={{ paddingLeft: `${0.75 + depth * 0.625}rem` }}
        onClick={handleRowClick}
        onDblClick={handleDoubleClick}
      >
        {hasChildrenSpaces ? (
          <ExpandButton onClick={(e: MouseEvent) => {
            e.stopPropagation();
            toggleSpaceExpanded(space.id);
          }}>
            <i class={`fas fa-chevron-${isExpanded ? 'down' : 'right'}`} />
          </ExpandButton>
        ) : (
          <div style={{ width: '1rem' }} />
        )}
        <SpaceName>
          <i class="fas fa-folder" />
          <span>{space.name}</span>
        </SpaceName>
        {showPostCount && recursivePostCount > 0 && (
          <PostCount>{recursivePostCount}</PostCount>
        )}
      </SpaceRow>
      {isExpanded && sortedChildren.length > 0 && (
        <Children>
          {sortedChildren.map((child) => renderSpace(child, depth + 1))}
        </Children>
      )}
    </StyledSpaceItem>
  );
}
