import { ComponentChildren, RefObject } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { modalStyles } from '../../styles/modal';

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
  title?: string;
  children: ComponentChildren;
  footer?: ComponentChildren;
  size?: 'small' | 'medium' | 'timeline' | 'large';
  onOverlayClick?: () => void; // Custom handler for overlay/backdrop clicks
  modalContainerRef?: RefObject<HTMLDivElement>; // Ref to modal container for external control
  modalHeight?: number | 'auto'; // Dynamic height control
}

export function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer, 
  size = 'medium', 
  onOverlayClick,
  modalContainerRef,
  modalHeight = 'auto'
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const internalContainerRef = useRef<HTMLDivElement>(null);
  
  // Use external ref if provided, otherwise use internal
  const containerRef = modalContainerRef || internalContainerRef;

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

  // Apply dynamic height if provided
  useEffect(() => {
    if (containerRef.current) {
      if (modalHeight === 'auto') {
        containerRef.current.style.height = 'auto';
        containerRef.current.style.maxHeight = 'calc(100vh - 8rem)';
      } else if (typeof modalHeight === 'number') {
        containerRef.current.style.height = `${modalHeight}px`;
        containerRef.current.style.maxHeight = 'none';
      }
    }
  }, [modalHeight, containerRef]);

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
      <Container ref={containerRef} className={size}>
        {title && (
          <Header>
            <Title>{title}</Title>
            <CloseButton onClick={onClose}>
              <i class="fas fa-times" />
            </CloseButton>
          </Header>
        )}
        <Content>{children}</Content>
        {footer && <Footer>{footer}</Footer>}
      </Container>
    </Overlay>,
    document.body
  );
}