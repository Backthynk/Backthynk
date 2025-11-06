import { useEffect } from 'preact/hooks';
import {
  currentActivityPeriod,
  activityCache,
  isLoadingActivity,
  activitySpaceId,
  activityRecursiveMode,
  canNavigatePrev,
  canNavigateNext,
  activityPeriodMonths,
  shouldShowActivity,
  isRecursiveMode,
  recursiveSpaces,
} from '@core/state';

import { clientConfig } from '@core/state';
import { fetchActivityData } from '@core/api';
import type { Space } from '@core/api';
import { activityStyles } from '../../styles/activity';
import { TitleBreadcrumb } from '../shared/TitleBreadcrumb';
import { Heatmap } from './Heatmap';
import { formatPeriodLabel } from './utils';

const Container = activityStyles.container;
const PeriodNav = activityStyles.periodNav;
const NavButton = activityStyles.navButton;
const PeriodLabel = activityStyles.periodLabel;
const Footer = activityStyles.footer;
const Legend = activityStyles.legend;
const LegendSquare = activityStyles.legendSquare;
const LegendLabel = activityStyles.legendLabel;
const SkeletonHeatmap = activityStyles.skeletonHeatmap;
const SkeletonRow = activityStyles.skeletonRow;
const SkeletonMonthLabel = activityStyles.skeletonMonthLabel;
const SkeletonSquares = activityStyles.skeletonSquares;
const SkeletonSquare = activityStyles.skeletonSquare;

interface ActivityTrackerProps {
  currentSpace: Space | null;
}

export function ActivityTracker({ currentSpace }: ActivityTrackerProps) {
  const config = clientConfig.value;

  // Don't render if activity is disabled or window too small
  if (!config.activity || !shouldShowActivity.value) {
    return null;
  }

  // Get recursive mode from global state
  const isRecursive = currentSpace ? isRecursiveMode(currentSpace.id) : false;

  // Load activity data when space, recursive mode, or period changes
  useEffect(() => {
    loadActivityData();
  }, [currentSpace?.id, isRecursive, currentActivityPeriod.value, activityPeriodMonths.value, recursiveSpaces.value]);

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
      const periodMonths = activityPeriodMonths.value;

      const data = await fetchActivityData(
        spaceId,
        recursive,
        currentActivityPeriod.value,
        periodMonths
      );

      if (data) {
        activityCache.value = data;
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

  return (
    <Container>
      {/* Space Breadcrumb */}
      <div style={{ marginBottom: '12px' }}>
        <TitleBreadcrumb
          spaceId={activitySpaceId.value}
          size="small"
        />
      </div>

      {/* Period Navigation */}
      <PeriodNav>
        <NavButton
          onClick={() => handleNavigatePeriod(-1)}
          disabled={!canNavigatePrev.value}
        >
          <i class="fas fa-chevron-left" />
        </NavButton>
        <PeriodLabel>
          {cache
            ? formatPeriodLabel(cache.start_date, cache.end_date)
            : 'Loading...'}
        </PeriodLabel>
        <NavButton
          onClick={() => handleNavigatePeriod(1)}
          disabled={!canNavigateNext.value}
        >
          <i class="fas fa-chevron-right" />
        </NavButton>
      </PeriodNav>

      {/* Heatmap or Loading */}
      {cache ? (
        <>
          <div style={{ position: 'relative', opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
            <Heatmap activityData={cache} />
          </div>

          {/* Legend */}
          <Footer style={{ marginTop: '2rem' }}>
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
        </>
      ) : loading ? (
        <>
          {/* Skeleton Heatmap Placeholder */}
          <SkeletonHeatmap>
            {Array.from({ length: activityPeriodMonths.value * 10 }).map((_, rowIndex) => (
              <SkeletonRow key={rowIndex}>
                {rowIndex % 10 === 0 && <SkeletonMonthLabel />}
                <SkeletonSquares>
                  {Array.from({ length: 10 }).map((_, squareIndex) => (
                    <SkeletonSquare
                      key={squareIndex}
                      style={{ '--index': squareIndex } as any}
                    />
                  ))}
                </SkeletonSquares>
              </SkeletonRow>
            ))}
          </SkeletonHeatmap>

          {/* Legend (visible during loading) */}
          <Footer style={{ marginTop: '2rem' }}>
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
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>
          <p>No activity data available</p>
        </div>
      )}
    </Container>
  );
}
