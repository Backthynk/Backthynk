import { ComponentChildren, RefObject, ComponentType } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { createPortal } from 'preact/compat';

/**
 * Props for styled components that can be provided by themes
 */
export interface ModalComponents {
  Overlay: ComponentType<any>;
  Container: ComponentType<any>;
  Header?: ComponentType<any>;
  Title?: ComponentType<any>;
  CloseButton?: ComponentType<any>;
  Content: ComponentType<any>;
  Footer?: ComponentType<any>;
}

export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ComponentChildren;
  footer?: ComponentChildren;
  size?: 'small' | 'medium' | 'timeline' | 'large';
  onOverlayClick?: () => void;
  modalContainerRef?: RefObject<HTMLDivElement>;
  modalHeight?: number | 'auto';
  components: ModalComponents;
}

/**
 * Base Modal Component (Core)
 *
 * This component contains all the modal logic and behavior without any styling.
 * Themes provide the visual components through the `components` prop.
 */
export function BaseModal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'medium',
  onOverlayClick,
  modalContainerRef,
  modalHeight = 'auto',
  components
}: BaseModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const internalContainerRef = useRef<HTMLDivElement>(null);

  const containerRef = modalContainerRef || internalContainerRef;
  const { Overlay, Container, Header, Title, CloseButton, Content, Footer } = components;

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
    if (e.target === e.currentTarget) {
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
        {title && Header && Title && CloseButton && (
          <Header>
            <Title>{title}</Title>
            <CloseButton onClick={onClose}>
              <i class="fas fa-times" />
            </CloseButton>
          </Header>
        )}
        <Content>{children}</Content>
        {footer && Footer && <Footer>{footer}</Footer>}
      </Container>
    </Overlay>,
    document.body
  );
}
