import { useLocation } from 'preact-iso';
import { expandedSpaces, toggleSpaceExpanded, hasChildren, getSpaceById, isRecursiveMode } from '@core/state';
import { generateSlug } from '@core/utils';
import { spacesContainerStyles } from '../../styles/spaces-container';
import type { Space } from '@core/api';

const SpaceRow = spacesContainerStyles.spaceRow;
const ExpandButton = spacesContainerStyles.expandButton;
const SpaceName = spacesContainerStyles.spaceName;
const PostCount = spacesContainerStyles.postCount;
const Children = spacesContainerStyles.children;
const StyledSpaceItem = spacesContainerStyles.spaceItem;

interface SpaceItemProps {
  space: Space;
  depth?: number;
  sortedChildren: Space[];
  renderSpace: (space: Space, depth: number, parentRecursive?: boolean, index?: number, total?: number) => any;
  showPostCount?: boolean;
  parentRecursive?: boolean;
  isFirstChild?: boolean;
  isLastChild?: boolean;
  isOnlyChild?: boolean;
}

export function SpaceItem({ space, depth = 0, sortedChildren, renderSpace, showPostCount = false, parentRecursive = false, isFirstChild = false, isLastChild = false, isOnlyChild = false }: SpaceItemProps) {
  const location = useLocation();
  const expanded = expandedSpaces.value;
  const isExpanded = expanded.has(space.id);
  const hasChildrenSpaces = hasChildren(space.id);
  const recursivePostCount = space.recursive_post_count || 0;

  // Get space path for URL
  const getSpacePath = (space: Space): string => {
    const path: string[] = [];
    let current: Space | null = space;
    while (current) {
      path.unshift(generateSlug(current.name));
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

  const isRecursive = isSelected && isRecursiveMode(space.id);
  const isChildOfRecursive = parentRecursive && !isSelected;
  const hasExpandedChildren = isExpanded && sortedChildren.length > 0;

  // Build class names for recursive children
  let childRecursiveClass = '';
  if (isChildOfRecursive) {
    if (isOnlyChild) {
      childRecursiveClass = 'child-recursive child-recursive-only';
    } else if (isFirstChild) {
      childRecursiveClass = 'child-recursive child-recursive-first';
    } else if (isLastChild) {
      childRecursiveClass = 'child-recursive child-recursive-last';
    } else {
      childRecursiveClass = 'child-recursive';
    }
  }

  // Add has-expanded-children class if this child has expanded children
  if (hasExpandedChildren && isChildOfRecursive) {
    childRecursiveClass += ' has-expanded-children';
  }

  // Add has-children class for recursive parent with children
  const hasChildrenClass = isRecursive && hasExpandedChildren ? 'has-children' : '';

  return (
    <StyledSpaceItem className={isChildOfRecursive ? 'no-gap' : ''}>
      <SpaceRow
        className={`${isSelected ? 'selected' : ''} ${isRecursive ? 'recursive' : ''} ${hasChildrenClass} ${childRecursiveClass}`}
        style={{ paddingLeft: `${0.75 + depth * 0.625}rem` }}
        onClick={handleRowClick}
        onDblClick={handleDoubleClick}
      >
        {hasChildrenSpaces ? (
          <ExpandButton onClick={(e: MouseEvent) => {
            e.stopPropagation();
            toggleSpaceExpanded(space.id);
          }}
          >
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
          {sortedChildren.map((child, index) =>
            renderSpace(child, depth + 1, isRecursive || parentRecursive, index, sortedChildren.length)
          )}
        </Children>
      )}
    </StyledSpaceItem>
  );
}
