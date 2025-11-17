import { ComponentChildren, ComponentType } from 'preact';
import { useState } from 'preact/hooks';
import { BaseModal, ModalComponents } from './BaseModal';

/**
 * Props for styled button component
 */
export interface ConfirmModalButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: ComponentChildren;
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface ConfirmModalComponents extends ModalComponents {
  Button: ComponentType<any>;
  ButtonGroup: ComponentType<any>;
  LoadingIcon?: ComponentType<any>;
  MessageContainer: ComponentType<any>;
}

export interface BaseConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
  richContent?: boolean;
  components: ConfirmModalComponents;
}

/**
 * Base Confirm Modal Component (Core)
 *
 * This component contains all the confirmation modal logic without any styling.
 * Themes provide the visual components through the `components` prop.
 */
export function BaseConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  richContent = false,
  components
}: BaseConfirmModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { Button, ButtonGroup, LoadingIcon, MessageContainer, ...modalComponents } = components;

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  const footer = (
    <ButtonGroup>
      <Button onClick={handleClose} disabled={isLoading} variant="secondary">
        {cancelText}
      </Button>
      <Button onClick={handleConfirm} disabled={isLoading} variant={variant}>
        {isLoading ? (
          <>
            {LoadingIcon && <LoadingIcon />}
            {confirmText}
          </>
        ) : (
          confirmText
        )}
      </Button>
    </ButtonGroup>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      footer={footer}
      size="small"
      components={modalComponents}
    >
      <MessageContainer>
        {richContent ? (
          <div dangerouslySetInnerHTML={{ __html: message }} />
        ) : (
          <p>{message}</p>
        )}
      </MessageContainer>
    </BaseModal>
  );
}
