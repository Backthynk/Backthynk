/**
 * Global Confirmation Modal
 *
 * This component should be rendered once at the app root level.
 * It listens to the global confirmation state and displays modals as needed.
 */

import { ComponentType } from 'preact';
import { confirmationState } from '../../actions';
import { BaseConfirmModalProps } from './BaseConfirmModal';

export interface GlobalConfirmModalProps {
  /**
   * The ConfirmModal component to use (should be provided by the theme)
   */
  ConfirmModalComponent: ComponentType<Omit<BaseConfirmModalProps, 'components'>>;
}

export function GlobalConfirmModal({ ConfirmModalComponent }: GlobalConfirmModalProps) {
  const state = confirmationState.value;

  if (!state.isOpen || !state.config) {
    return null;
  }

  return (
    <ConfirmModalComponent
      isOpen={state.isOpen}
      onClose={() => state.onCancel?.()}
      onConfirm={async () => {
        if (state.onConfirm) {
          await state.onConfirm();
        }
      }}
      title={state.config.title}
      message={state.config.message}
      confirmText={state.config.confirmText}
      cancelText={state.config.cancelText}
      variant={state.config.variant}
      richContent={state.config.richContent}
    />
  );
}
