import { useEffect, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { styled } from 'goober';
import { ComponentChildren } from 'preact';
import { zIndex } from '../styles/zIndex';

const MenuContainer = styled('div')`
  position: fixed;
  min-width: 128px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  z-index: ${zIndex.contextMenu};
  animation: fadeInScale 0.15s ease-out;

  @keyframes fadeInScale {
    0% {
      opacity: 0;
      transform: scale(0.95);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }
`;

const MenuContent = styled('div')`
  padding: 0.25rem 0;
`;

export const MenuItem = styled('button')`
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  transition: background 0.2s ease;
  text-align: left;

  &:hover {
    background: var(--bg-hover);
  }

  &.danger {
    color: #dc2626;

    &:hover {
      background: rgba(220, 38, 38, 0.1);
    }
  }

  i {
    font-size: 0.75rem;
    margin-right: 0.5rem;
    width: 1rem;
  }
`;

export const MenuDivider = styled('div')`
  height: 1px;
  background: var(--border-primary);
  margin: 0.25rem 0;
`;

export interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  children: ComponentChildren;
}

export function ContextMenu({ x, y, onClose, children }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as Node;
    // Get the actual DOM element from goober ref (goober stores it in 'base')
    const menuElement = (menuRef.current as any)?.base || menuRef.current;

    if (menuElement && !menuElement.contains(target)) {
      onClose();
    }
  };

  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  // Use mousedown instead of click for more reliable detection
  // Add a small delay to avoid catching the same event that opened the menu
  const timer = setTimeout(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
  }, 0);

  return () => {
    clearTimeout(timer);
    document.removeEventListener('mousedown', handleClickOutside);
    document.removeEventListener('keydown', handleEscape);
  };
}, [onClose]);

  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (!menuRef.current) return;

    // Get the actual DOM element from goober ref
    const menuElement = (menuRef.current as any)?.base || menuRef.current;
    if (!menuElement || typeof menuElement.getBoundingClientRect !== 'function') return;

    const rect = menuElement.getBoundingClientRect();

    let adjustedX = x;
    let adjustedY = y;

    // Keep menu within viewport horizontally
    if (adjustedX + rect.width > window.innerWidth - 8) {
      adjustedX = window.innerWidth - rect.width - 8;
    }
    if (adjustedX < 8) {
      adjustedX = 8;
    }

    // Keep menu within viewport vertically
    if (adjustedY + rect.height > window.innerHeight - 8) {
      adjustedY = window.innerHeight - rect.height - 8;
    }
    if (adjustedY < 8) {
      adjustedY = 8;
    }

    menuElement.style.left = `${adjustedX}px`;
    menuElement.style.top = `${adjustedY}px`;
  }, [x, y]);

  return createPortal(
    <MenuContainer ref={menuRef} style={{ left: x, top: y }}>
      <MenuContent>{children}</MenuContent>
    </MenuContainer>,
    document.body
  );
}
