/**
 * Core Modal Components
 *
 * These components provide the modal abstraction layer without any styling.
 * Themes should wrap these components and provide styled components via the `components` prop.
 */

export { BaseModal } from './BaseModal';
export type { BaseModalProps, ModalComponents } from './BaseModal';

export { BaseConfirmModal } from './BaseConfirmModal';
export type { BaseConfirmModalProps, ConfirmModalComponents, ConfirmModalButtonProps } from './BaseConfirmModal';

export { GlobalConfirmModal } from './GlobalConfirmModal';
export type { GlobalConfirmModalProps } from './GlobalConfirmModal';