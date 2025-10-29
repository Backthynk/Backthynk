import { signal, computed } from '@preact/signals';
import type { ActivityData } from '../api';
import { windowSize } from './ui';

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

// Computed: Number of months to display based on window height
export const activityPeriodMonths = computed(() => {
  const height = windowSize.value.height;
  if (height >= 1000) return 4;
  if (height >= 875) return 3;
  return 2;
});

export const activityContainerHeightRem = computed(() => {
  const height = windowSize.value.height;
  if (height >= 1000) return 22;
  if (height >= 875) return 18;
  return 15;
});

// Computed: Whether to show activity tracker based on window height
export const shouldShowActivity = computed(() => windowSize.value.height >= 750);

// Reset activity state (useful when switching spaces)
export function resetActivityState(): void {
  currentActivityPeriod.value = 0;
  activityCache.value = null;
  isLoadingActivity.value = false;
}