import { ContextMenu, MenuItem, MenuDivider } from '@core/components';
import { isEligibleForRecursive, isRecursiveMode } from '@core/state';
import { styled } from 'goober';

const RecursiveBadge = styled('span')`
  font-size: 9px;
  font-weight: 600;
  color: var(--accent-recursive);
  background: var(--accent-recursive-hover);
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-right: 0.5rem;
`;

interface SpaceActionMenuProps {
  spaceId: number;
  x: number;
  y: number;
  onClose: () => void;
  onEnableRecursive?: (spaceId: number) => void;
  onUpdate?: (spaceId: number) => void;
  onDelete?: (spaceId: number) => void;
}

export function SpaceActionMenu({
  spaceId,
  x,
  y,
  onClose,
  onEnableRecursive,
  onUpdate,
  onDelete,
}: SpaceActionMenuProps) {
  const canToggleRecursive = isEligibleForRecursive(spaceId);
  const isRecursive = isRecursiveMode(spaceId);

  const handleEnableRecursive = () => {
    onEnableRecursive?.(spaceId);
    onClose();
  };

  const handleUpdate = () => {
    onUpdate?.(spaceId);
    onClose();
  };

  const handleDelete = () => {
    onDelete?.(spaceId);
    onClose();
  };

  return (
    <ContextMenu x={x} y={y} onClose={onClose}>
      {canToggleRecursive && (
        <>
          <MenuItem onClick={handleEnableRecursive}>
            <RecursiveBadge>R</RecursiveBadge>
            {isRecursive ? 'Disable Recursive' : 'Enable Recursive'}
          </MenuItem>
          <MenuDivider />
        </>
      )}
      <MenuItem onClick={handleUpdate}>
        <i class="fas fa-edit" />
        Update space
      </MenuItem>
      <MenuItem className="danger" onClick={handleDelete}>
        <i class="fas fa-trash-alt" />
        Delete space
      </MenuItem>
    </ContextMenu>
  );
}
