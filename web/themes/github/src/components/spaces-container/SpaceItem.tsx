import { useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { expandedSpaces, hasChildren, isRecursiveMode, isEligibleForRecursive, spaces as spacesSignal, currentSpace } from '@core/state';
import { spacesContainerStyles } from '../../styles/spaces-container';
import type { Space } from '@core/api';
import { deleteSpaceAction, toggleSpaceExpanded, toggleRecursiveMode, navigateToSpace, navigateToAllSpaces } from '@core/actions/spaceActions';
import { SpaceActionMenu } from '../companion/SpaceActionMenu';
import { UpdateSpaceModal } from './UpdateSpaceModal';

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
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Check if space is selected by comparing with state signal
  const isSelected = currentSpace.value?.id === space.id;

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
        navigateToAllSpaces(location);
      } else {
        navigateToSpace(space, location);
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

  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Clear any pending single click
    if (clickTimeout) {
      clearTimeout(clickTimeout);
      clickTimeout = null;
    }

    setMenuPosition({
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleEnableRecursive = (spaceId: number) => {
    const targetSpace = spacesSignal.value.find((s) => s.id === spaceId);
    if (targetSpace && isEligibleForRecursive(targetSpace.id)) {
      toggleRecursiveMode(targetSpace.id);
    }
  };

  const handleUpdate = (spaceId: number) => {
    setShowUpdateModal(true);
  };

  const handleDelete = async () => {
    await deleteSpaceAction({
      spaceId: space.id,
      spaceName: space.name,
      router: location,
    });
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
        onContextMenu={handleContextMenu}
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

      {/* Space Action Menu */}
      {menuPosition && (
        <SpaceActionMenu
          spaceId={space.id}
          x={menuPosition.x}
          y={menuPosition.y}
          onClose={() => setMenuPosition(null)}
          onEnableRecursive={handleEnableRecursive}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}

      {/* Update Space Modal */}
      {showUpdateModal && (
        <UpdateSpaceModal
          isOpen={showUpdateModal}
          onClose={() => setShowUpdateModal(false)}
          space={space}
        />
      )}
    </StyledSpaceItem>
  );
}
