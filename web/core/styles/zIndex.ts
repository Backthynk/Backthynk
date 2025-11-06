/**
 * Centralized Z-Index Management
 *
 * This file defines all z-index values used throughout the application
 * to ensure proper stacking order and prevent layering conflicts.
 *
 * Layers (from lowest to highest):
 * - Base (0-99): Regular content, post elements
 * - UI Elements (100-999): Tooltips, context menus
 * - Overlays (1000-9999): Image viewer
 * - Modals (10000-10999): Modal overlays and content
 * - Notifications (11000+): Toasts, alerts that should always be visible
 */

export const zIndex = {
  // Base content layers (0-99)
  postImage: 1,
  postLoadingBar: 50,

  // UI elements (100-999)
  tooltip: 999,
  contextMenu: 1000,

  // Overlays (1000-9999)
  imageViewer: 9998,

  // Modals (10000-10999)
  modalOverlay: 10000,
  modalDropdown: 10001, // Dropdowns within modals (e.g., SpaceSelector)

  // Notifications (11000+)
  alert: 11000, // DropdownAlert should always be visible, even above modals
} as const;

// Type for autocomplete support
export type ZIndex = typeof zIndex[keyof typeof zIndex];