import { useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { expandedSpaces, toggleSpaceExpanded, hasChildren, getSpaceById, isRecursiveMode, isEligibleForRecursive, toggleRecursiveMode, spaces as spacesSignal } from '@core/state';
import { generateSlug } from '@core/utils';
import { spacesContainerStyles } from '../../styles/spaces-container';
import type { Space } from '@core/api';
import { deleteSpace } from '@core/api';
import { showSuccess, showError } from '@core/components';
import { SpaceActionMenu } from '../companion/SpaceActionMenu';
import { UpdateSpaceModal } from '../companion/UpdateSpaceModal';
import { ConfirmModal } from '../modal/ConfirmModal';

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const handleDelete = async (spaceId: number) => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    try {
      await deleteSpace(space.id);
      // Update local state
      spacesSignal.value = spacesSignal.value.filter((s) => s.id !== space.id);
      showSuccess(`Space "${space.name}" deleted successfully!`);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to delete space:', error);
      showError('Failed to delete space. Please try again.');
    }
  };

  const handleModalSuccess = () => {
    // No specific action needed on success - state is updated by the modal
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
          onSuccess={handleModalSuccess}
          space={space}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <ConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={confirmDelete}
          title="Delete Space"
          message={`Are you sure you want to delete "${space.name}"? This action cannot be undone.`}
          confirmText="Delete"
          variant="danger"
        />
      )}
    </StyledSpaceItem>
  );
}
