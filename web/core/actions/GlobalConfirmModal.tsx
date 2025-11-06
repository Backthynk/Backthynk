/**
 * Global Confirmation Modal
 *
 * This component should be rendered once at the app root level.
 * It listens to the global confirmation state and displays modals as needed.
 */

import { confirmationState } from './index';
import { ConfirmModal } from '../../themes/github/src/components/modal/ConfirmModal';

export function GlobalConfirmModal() {
  const state = confirmationState.value;

  if (!state.isOpen || !state.config) {
    return null;
  }

  return (
    <ConfirmModal
      isOpen={state.isOpen}
      onClose={() => state.onCancel?.()}
      onConfirm={() => state.onConfirm?.()}
      title={state.config.title}
      message={state.config.message}
      confirmText={state.config.confirmText}
      cancelText={state.config.cancelText}
      variant={state.config.variant}
    />
  );
}
