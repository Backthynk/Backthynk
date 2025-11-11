import { useEffect } from 'preact/hooks';
import {
  currentActivityPeriod,
  activityCache,
  isLoadingActivity,
  activitySpaceId,
  activityRecursiveMode,
  canNavigatePrev,
  canNavigateNext,
  isRecursiveMode,
  recursiveSpaces,
} from '@core/state';

import { clientConfig } from '@core/state';
import { fetchActivityDataCached } from '@core/cache/activityCache';
import { formatPeriodLabel, calculateActivityPeriodDates } from '@core/utils';
import type { Space } from '@core/api';
import { activityStyles } from '../../styles/activity';
import { Heatmap } from './Heatmap';
import { activity as activityConfig } from '../../config';

const Container = activityStyles.container;
const PeriodNav = activityStyles.periodNav;
const NavButton = activityStyles.navButton;
const PeriodLabel = activityStyles.periodLabel;
const HeatmapLoadingOverlay = activityStyles.heatmapLoadingOverlay;
const HeatmapSpinner = activityStyles.heatmapSpinner;
const Footer = activityStyles.footer;
const Legend = activityStyles.legend;
const LegendSquare = activityStyles.legendSquare;
const LegendLabel = activityStyles.legendLabel;

interface ActivityTrackerProps {
  currentSpace: Space | null;
}

export function ActivityTracker({ currentSpace }: ActivityTrackerProps) {
  const config = clientConfig.value;

  // Don't render if activity is disabled
  if (!config.activity) {
    return null;
  }

  // Get recursive mode from global state
  const isRecursive = currentSpace ? isRecursiveMode(currentSpace.id) : false;

  // Load activity data when space, recursive mode, or period changes
  useEffect(() => {
    loadActivityData();
  }, [currentSpace?.id, isRecursive, currentActivityPeriod.value, recursiveSpaces.value]);

  // Update activity state when space or recursive mode changes
  useEffect(() => {
    if (currentSpace) {
      const previousSpaceId = activitySpaceId.value;
      activitySpaceId.value = currentSpace.id;
      activityRecursiveMode.value = isRecursive;

      // Only reset period when space changes (not when recursive mode changes)
      if (previousSpaceId !== currentSpace.id) {
        currentActivityPeriod.value = 0;
      }
    } else {
      currentActivityPeriod.value = 0;
      activitySpaceId.value = 0; // All spaces
      activityRecursiveMode.value = false;
    }
  }, [currentSpace?.id, isRecursive]);

  const loadActivityData = async () => {
    // Prevent duplicate calls
    if (isLoadingActivity.value) {
      return;
    }

    isLoadingActivity.value = true;

    try {
      const spaceId = currentSpace?.id || 0;
      const recursive = isRecursive;
      const periodMonths = activityConfig.periodMonths;

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

  const handleNavigatePeriod = (direction: number) => {
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

  const cache = activityCache.value;
  const loading = isLoadingActivity.value;

  // Use cache dates if available, otherwise calculate expected dates
  const dateRange = cache
    ? { start_date: cache.start_date, end_date: cache.end_date }
    : calculateActivityPeriodDates(currentActivityPeriod.value, activityConfig.periodMonths);

  // Create empty activity data for initial loading state
  const emptyActivityData: any = {
    days: [],
    start_date: dateRange.start_date,
    end_date: dateRange.end_date,
    stats: {
      total_posts: 0,
      active_days: 0,
      max_day_activity: 0
    },
    max_periods: 0
  };

  return (
    <Container>
      {/* Period Navigation - Always visible */}
      <PeriodNav>
        <NavButton
          onClick={() => handleNavigatePeriod(-1)}
          disabled={!canNavigatePrev.value || loading}
        >
          <i class="fas fa-chevron-left" />
        </NavButton>
        <PeriodLabel>
          {formatPeriodLabel(dateRange.start_date, dateRange.end_date)}
        </PeriodLabel>
        <NavButton
          onClick={() => handleNavigatePeriod(1)}
          disabled={!canNavigateNext.value || loading}
        >
          <i class="fas fa-chevron-right" />
        </NavButton>
      </PeriodNav>

      {/* Heatmap with loading overlay */}
      <div style={{ position: 'relative' }}>
        {cache ? (
          <Heatmap activityData={cache} />
        ) : (
          <Heatmap activityData={emptyActivityData} />
        )}

        {/* Loading overlay on top */}
        {loading && (
          <HeatmapLoadingOverlay>
            <HeatmapSpinner />
          </HeatmapLoadingOverlay>
        )}
      </div>

      {/* Legend - Always visible */}
      <Footer style={{ marginTop: '1rem' }}>
        <Legend>
          <LegendLabel>Less</LegendLabel>
          <LegendSquare intensity={0} />
          <LegendSquare intensity={1} />
          <LegendSquare intensity={2} />
          <LegendSquare intensity={3} />
          <LegendSquare intensity={4} />
          <LegendLabel>More</LegendLabel>
        </Legend>
      </Footer>
    </Container>
  );
}
