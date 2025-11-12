/**
 * useActivity Hook
 *
 * Centralized state and fetching logic for activity tracking.
 * This hook encapsulates all the complex logic for:
 * - Managing activity period navigation (current, previous periods)
 * - Fetching and caching activity data for spaces
 * - Handling recursive vs flat views
 * - Computing navigation bounds (can navigate prev/next)
 * - Coordinating with the activity cache layer
 * - Loading states
 * - Period date calculations and formatting
 *
 * Themes can use this hook to render activity components without duplicating logic.
 */

import { computed } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { Space } from '../api';
import type { ActivityData } from '../api/activity';
import {
  currentActivityPeriod,
  activityCache,
  isLoadingActivity,
  activitySpaceId,
  activityRecursiveMode,
  canNavigatePrev,
  canNavigateNext,
  resetActivityState,
} from '../state/activity';
import { isRecursiveMode } from '../state/spaces';
import { clientConfig } from '../state/settings';
import { fetchActivityDataCached } from '../cache/activityCache';
import { calculateActivityPeriodDates, formatPeriodLabel } from '../utils';

export interface ActivityHookData {
  /** Activity data for the current period (null if loading or no data) */
  activityData: ActivityData | null;
  /** Whether activity data is currently loading */
  isLoading: boolean;
  /** Current period offset (0 = current, -1 = previous, etc.) */
  period: number;
  /** Whether we can navigate to previous period */
  canNavigatePrev: boolean;
  /** Whether we can navigate to next period */
  canNavigateNext: boolean;
  /** Whether we're in recursive mode */
  isRecursive: boolean;
  /** Start date of the current period (YYYY-MM-DD) */
  startDate: string;
  /** End date of the current period (YYYY-MM-DD) */
  endDate: string;
  /** Formatted period label (e.g., "Jul 2025 – Oct 2025") */
  periodLabel: string;
  /** Navigate to a different period */
  navigatePeriod: (direction: 1 | -1) => void;
  /** Reload current period's data */
  reload: () => Promise<void>;
  /** Whether activity feature is enabled in config */
  isEnabled: boolean;
}

export interface UseActivityOptions {
  /** Number of months per period (default: from config) */
  periodMonths?: number;
}

/**
 * Hook to get activity data and navigation controls
 * @param space - The current space (null for "All Spaces" view)
 * @param options - Optional configuration
 * @returns Computed activity data and navigation controls
 */
export function useActivity(
  space: Space | null,
  options: UseActivityOptions = {}
): ActivityHookData {
  const activityEnabled = clientConfig.value.activity;
  const periodMonths = options.periodMonths || 4;

  // Get recursive mode from global state
  const isRecursive = space ? isRecursiveMode(space.id) : false;

  // Load activity data when space, recursive mode, or period changes
  useEffect(() => {
    if (activityEnabled) {
      loadActivityData();
    }
  }, [space?.id, isRecursive, currentActivityPeriod.value, activityEnabled]);

  // Update activity state when space or recursive mode changes
  useEffect(() => {
    if (!activityEnabled) {
      return;
    }

    if (space) {
      const previousSpaceId = activitySpaceId.value;
      activitySpaceId.value = space.id;
      activityRecursiveMode.value = isRecursive;

      // Only reset period when space changes (not when recursive mode changes)
      if (previousSpaceId !== space.id) {
        currentActivityPeriod.value = 0;
      }
    } else {
      currentActivityPeriod.value = 0;
      activitySpaceId.value = 0; // All spaces
      activityRecursiveMode.value = false;
    }
  }, [space?.id, isRecursive, activityEnabled]);

  /**
   * Load activity data from cache or API
   */
  const loadActivityData = async () => {
    // Prevent duplicate calls
    if (isLoadingActivity.value) {
      return;
    }

    isLoadingActivity.value = true;

    try {
      const spaceId = space?.id || 0;
      const recursive = isRecursive;

      const result = await fetchActivityDataCached(
        spaceId,
        recursive,
        currentActivityPeriod.value,
        periodMonths
      );

      if (result.data) {
        activityCache.value = result.data;
      } else {
        // If fetch failed, set empty cache
        activityCache.value = null;
      }
    } catch (error) {
      console.error('Failed to load activity data:', error);
      activityCache.value = null;
    } finally {
      isLoadingActivity.value = false;
    }
  };

  /**
   * Navigate to a different period (previous or next)
   */
  const navigatePeriod = (direction: 1 | -1) => {
    const newPeriod = currentActivityPeriod.value + direction;

    // Check bounds
    const cache = activityCache.value;
    if (cache) {
      const maxPeriods = cache.max_periods !== undefined ? cache.max_periods : 24;
      if (newPeriod > 0 || newPeriod < -maxPeriods) {
        return; // Out of bounds
      }
    } else {
      // Basic bounds check without cache
      if (newPeriod > 0 || newPeriod < -24) {
        return; // Out of bounds
      }
    }

    currentActivityPeriod.value = newPeriod;
  };

  // Compute date range for current period
  const dateRange = computed(() => {
    const cache = activityCache.value;
    if (cache) {
      return { start_date: cache.start_date, end_date: cache.end_date };
    }
    return calculateActivityPeriodDates(currentActivityPeriod.value, periodMonths);
  });

  // Compute formatted period label
  const periodLabel = computed(() => {
    const range = dateRange.value;
    return formatPeriodLabel(range.start_date, range.end_date);
  });

  return {
    activityData: activityCache.value,
    isLoading: isLoadingActivity.value,
    period: currentActivityPeriod.value,
    canNavigatePrev: canNavigatePrev.value,
    canNavigateNext: canNavigateNext.value,
    isRecursive,
    startDate: dateRange.value.start_date,
    endDate: dateRange.value.end_date,
    periodLabel: periodLabel.value,
    navigatePeriod,
    reload: loadActivityData,
    isEnabled: activityEnabled,
  };
}

/**
 * Reset the activity state to defaults
 * Useful when navigating away from activity views
 */
export function resetActivity(): void {
  resetActivityState();
}
