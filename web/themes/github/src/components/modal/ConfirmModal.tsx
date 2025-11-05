import { Modal } from './Modal';
import { formStyles } from './styles';

const Button = formStyles.button;

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
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
}: ConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const footer = (
    <>
      <Button className="secondary" onClick={onClose}>
        {cancelText}
      </Button>
      <Button className={variant} onClick={handleConfirm}>
        {confirmText}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      footer={footer}
      size="small"
    >
      <p style={{ margin: 0, color: 'var(--text-primary)', lineHeight: '1.5' }}>
        {message}
      </p>
    </Modal>
  );
}
