import { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { modalStyles } from './styles';

const Overlay = modalStyles.overlay;
const Container = modalStyles.container;
const Header = modalStyles.header;
const Title = modalStyles.title;
const CloseButton = modalStyles.closeButton;
const Content = modalStyles.content;
const Footer = modalStyles.footer;

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ComponentChildren;
  footer?: ComponentChildren;
  size?: 'small' | 'medium' | 'large';
  onOverlayClick?: () => void; // Custom handler for overlay/backdrop clicks
}

export function Modal({ isOpen, onClose, title, children, footer, size = 'medium', onOverlayClick }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClickEvent = (e: any) => {
    // Only close if clicking directly on the overlay (not on the modal content)
    if (e.target === e.currentTarget) {
      // Use custom handler if provided, otherwise use default onClose
      if (onOverlayClick) {
        onOverlayClick();
      } else {
        onClose();
      }
    }
  };

  return createPortal(
    <Overlay ref={overlayRef} onClick={handleOverlayClickEvent}>
      <Container className={size}>
        <Header>
          <Title>{title}</Title>
          <CloseButton onClick={onClose}>
            <i class="fas fa-times" />
          </CloseButton>
        </Header>
        <Content>{children}</Content>
        {footer && <Footer>{footer}</Footer>}
      </Container>
    </Overlay>,
    document.body
  );
}
