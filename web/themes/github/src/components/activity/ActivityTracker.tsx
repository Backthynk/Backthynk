import { useActivity } from '@core/hooks/useActivity';
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
  const {
    activityData,
    isLoading,
    canNavigatePrev,
    canNavigateNext,
    periodLabel,
    navigatePeriod,
    startDate,
    endDate,
    isEnabled,
  } = useActivity(currentSpace, {
    periodMonths: activityConfig.periodMonths,
  });

  // Don't render if activity is disabled
  if (!isEnabled) {
    return null;
  }

  // Create empty activity data for initial loading state
  const emptyActivityData: any = {
    days: [],
    start_date: startDate,
    end_date: endDate,
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
          onClick={() => navigatePeriod(-1)}
          disabled={!canNavigatePrev || isLoading}
        >
          <i class="fas fa-chevron-left" />
        </NavButton>
        <PeriodLabel>
          {periodLabel}
        </PeriodLabel>
        <NavButton
          onClick={() => navigatePeriod(1)}
          disabled={!canNavigateNext || isLoading}
        >
          <i class="fas fa-chevron-right" />
        </NavButton>
      </PeriodNav>

      {/* Heatmap with loading overlay */}
      <div style={{ position: 'relative' }}>
        {activityData ? (
          <Heatmap activityData={activityData} />
        ) : (
          <Heatmap activityData={emptyActivityData} />
        )}

        {/* Loading overlay on top */}
        {isLoading && (
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
