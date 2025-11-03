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
} from '@core/state';

import { clientConfig } from '@core/state';
import { fetchActivityData } from '@core/api';
import type { Space } from '@core/api';
import { activityStyles } from '../../styles/activity';
import { SpaceBreadcrumb } from './SpaceBreadcrumb';
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

  // Load activity data when space changes or period changes
  useEffect(() => {
    loadActivityData();
  }, [currentSpace?.id, currentSpace?.recursiveMode, currentActivityPeriod.value, activityPeriodMonths.value]);

  // Reset activity state when space changes
  useEffect(() => {
    if (currentSpace) {
      currentActivityPeriod.value = 0;
      activitySpaceId.value = currentSpace.id;
      activityRecursiveMode.value = currentSpace.recursiveMode || false;
    } else {
      currentActivityPeriod.value = 0;
      activitySpaceId.value = 0; // All spaces
      activityRecursiveMode.value = false;
    }
  }, [currentSpace?.id]);

  const loadActivityData = async () => {
    // Prevent duplicate calls
    if (isLoadingActivity.value) {
      return;
    }

    isLoadingActivity.value = true;

    try {
      const spaceId = currentSpace?.id || 0;
      const recursive = currentSpace?.recursiveMode || false;
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
      <SpaceBreadcrumb
        spaceId={activitySpaceId.value}
        recursiveMode={activityRecursiveMode.value}
      />

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
          <Footer>
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
          <Footer>
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
