import { BaseConfirmModal, BaseConfirmModalProps, ConfirmModalButtonProps } from '@core/components/modal/BaseConfirmModal';
import { formStyles, modalStyles } from '../../styles/modal';
import { styled } from 'goober';

const StyledButton = formStyles.button;

// Re-export the same props interface from core
export type ConfirmModalProps = Omit<BaseConfirmModalProps, 'components'>;

// Button wrapper that converts variant prop to className
const Button = ({ variant = 'primary', ...props }: ConfirmModalButtonProps) => (
  <StyledButton className={variant} {...props} />
);

// Button group for footer
const ButtonGroup = styled('div')`
  display: contents;
`;

// Loading icon component
const LoadingIcon = () => (
  <i class="fas fa-spinner fa-spin" style={{ marginRight: '8px' }} />
);

// Message container
const MessageContainer = styled('div')`
  margin: 0;
  color: var(--text-primary);
  line-height: 1.5;

  p {
    margin: 0;
  }
`;

/**
 * GitHub Theme Confirm Modal
 *
 * This wraps the core BaseConfirmModal with GitHub-specific styling.
 */
export function ConfirmModal(props: ConfirmModalProps) {
  return (
    <BaseConfirmModal
      {...props}
      components={{
        Overlay: modalStyles.overlay,
        Container: modalStyles.container,
        Header: modalStyles.header,
        Title: modalStyles.title,
        CloseButton: modalStyles.closeButton,
        Content: modalStyles.content,
        Footer: modalStyles.footer,
        Button,
        ButtonGroup,
        LoadingIcon,
        MessageContainer,
      }}
    />
  );
}
