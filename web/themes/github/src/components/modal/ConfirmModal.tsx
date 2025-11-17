import { useState } from 'preact/hooks';
import { Modal } from './Modal';
import { formStyles } from '../../styles/modal';

const Button = formStyles.button;

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
  richContent?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  richContent = false,
}: ConfirmModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      // If there's an error, keep the modal open and reset loading
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  const footer = (
    <>
      <Button className="secondary" onClick={handleClose} disabled={isLoading}>
        {cancelText}
      </Button>
      <Button className={variant} onClick={handleConfirm} disabled={isLoading}>
        {isLoading ? (
          <>
            <i class="fas fa-spinner fa-spin" style={{ marginRight: '8px' }} />
            {confirmText}
          </>
        ) : (
          confirmText
        )}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      footer={footer}
      size="small"
    >
      {richContent ? (
        <div
          style={{ margin: 0, color: 'var(--text-primary)', lineHeight: '1.5' }}
          dangerouslySetInnerHTML={{ __html: message }}
        />
      ) : (
        <p style={{ margin: 0, color: 'var(--text-primary)', lineHeight: '1.5' }}>
          {message}
        </p>
      )}
    </Modal>
  );
}
