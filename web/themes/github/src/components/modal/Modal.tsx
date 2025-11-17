import { BaseModal, BaseModalProps } from '@core/components/modal/BaseModal';
import { modalStyles } from '../../styles/modal';

// Re-export the same props interface from core
export type ModalProps = Omit<BaseModalProps, 'components'>;

/**
 * GitHub Theme Modal
 *
 * This wraps the core BaseModal with GitHub-specific styling.
 */
export function Modal(props: ModalProps) {
  return (
    <BaseModal
      {...props}
      components={{
        Overlay: modalStyles.overlay,
        Container: modalStyles.container,
        Header: modalStyles.header,
        Title: modalStyles.title,
        CloseButton: modalStyles.closeButton,
        Content: modalStyles.content,
        Footer: modalStyles.footer,
      }}
    />
  );
}