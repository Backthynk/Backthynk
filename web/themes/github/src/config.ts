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
} as const;
