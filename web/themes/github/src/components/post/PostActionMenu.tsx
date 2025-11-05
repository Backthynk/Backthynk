import { ContextMenu, MenuItem } from '@core/components';

interface PostActionMenuProps {
  postId: number;
  x: number;
  y: number;
  onClose: () => void;
  onDelete?: (postId: number) => void;
  onMove?: (postId: number) => void;
}

export function PostActionMenu({ postId, x, y, onClose, onDelete, onMove }: PostActionMenuProps) {
  const handleMove = () => {
    onMove?.(postId);
    onClose();
  };

  const handleDelete = () => {
    onDelete?.(postId);
    onClose();
  };

  return (
    <ContextMenu x={x} y={y} onClose={onClose}>
      <MenuItem onClick={handleMove}>
        <i class="fas fa-exchange-alt" />
        Move
      </MenuItem>
      <MenuItem className="danger" onClick={handleDelete}>
        <i className="fas fa-trash-alt" />
        Delete
      </MenuItem>
    </ContextMenu>
  );
}
