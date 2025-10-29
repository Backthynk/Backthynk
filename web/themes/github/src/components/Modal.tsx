import { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { modalStyles } from '../styles/modal';

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
}

export function Modal({ isOpen, onClose, title, children, footer, size = 'medium' }: ModalProps) {
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

  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  return (
    <Overlay ref={overlayRef} onClick={handleOverlayClick}>
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
    </Overlay>
  );
}
