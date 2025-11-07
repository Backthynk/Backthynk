import { signal, computed } from '@preact/signals';
import type { ActivityData } from '../api';

// Current activity period (0 = current, -1 = previous period, etc.)
export const currentActivityPeriod = signal<number>(0);

// Cached activity data for current space/period
export const activityCache = signal<ActivityData | null>(null);

// Loading state for activity data
export const isLoadingActivity = signal<boolean>(false);

// Current space ID for activity (0 = all spaces)
export const activitySpaceId = signal<number>(0);

// Recursive mode for activity
export const activityRecursiveMode = signal<boolean>(false);

// Computed: Check if we can navigate to previous period
export const canNavigatePrev = computed(() => {
  const cache = activityCache.value;
  if (!cache) return false;

  const maxPeriods = cache.max_periods !== undefined ? cache.max_periods : 24;
  return currentActivityPeriod.value > -maxPeriods;
});

// Computed: Check if we can navigate to next period (can't go beyond current)
export const canNavigateNext = computed(() => {
  return currentActivityPeriod.value < 0;
});


// Reset activity state (useful when switching spaces)
export function resetActivityState(): void {
  currentActivityPeriod.value = 0;
  activityCache.value = null;
  isLoadingActivity.value = false;
}