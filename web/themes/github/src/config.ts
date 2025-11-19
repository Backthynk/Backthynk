/**
 * Theme-specific configuration for the GitHub theme
 */

/**
 * Activity navigation settings
 */
export const activity = {
  /**
   * Maximum number of periods to show in activity navigation
   */
  maxPeriods: 7,

  /**
   * Number of months to display in the heatmap
   */
  periodMonths: 4,

  /**
   * Number of cells (days) per line in the heatmap
   */
  cellsPerLine: 15,
} as const;

/**
 * UI behavior settings
 */
export const ui = {
  /**
   * Animation and transition durations (in milliseconds)
   */
  animation: {
    modalTransition: 200,
    dropdownTransition: 150,
  },
  /**
   * Image gallery display settings
   */
  imageGallery: {
    /**
     * Maximum height for galleries with 1-2 images (in pixels)
     */
    maxHeight: 350,
    /**
     * Gap between images in grid layouts (in pixels)
     */
    gap: 3,
  },
} as const;

/**
 * Keyboard shortcuts configuration
 */
export const keyboard = {
  /**
   * Toggle recursive mode shortcut
   */
  toggleRecursive: {
    key: 'r',
    requireCtrl: false,
    requireAlt: false,
    requireMeta: false,
    requireShift: false,
  },
} as const;
