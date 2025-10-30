import { useEffect, useRef } from 'preact/hooks';
import { postStyles } from '../../styles/post';

const ActionMenu = postStyles.actionMenu;
const MenuButton = postStyles.menuButton;

interface PostActionMenuProps {
  postId: number;
  onClose: () => void;
  onDelete?: (postId: number) => void;
  onMove?: (postId: number) => void;
}

export function PostActionMenu({ postId, onClose, onDelete, onMove }: PostActionMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleMove = () => {
    onMove?.(postId);
    onClose();
  };

  const handleDelete = () => {
    onDelete?.(postId);
    onClose();
  };

  return (
    <ActionMenu ref={menuRef}>
      <div style={{ padding: '0.25rem 0' }}>
        <MenuButton onClick={handleMove}>
          <i class="fas fa-exchange-alt" />
          Move
        </MenuButton>
        <MenuButton class="danger" onClick={handleDelete}>
          <i class="fas fa-trash-alt" />
          Delete
        </MenuButton>
      </div>
    </ActionMenu>
  );
}
