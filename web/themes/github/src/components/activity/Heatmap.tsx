import { useState } from 'preact/hooks';
import { activityStyles } from '../../styles/activity';
import { generateCalendarDays, generateMonthLabels, formatDayLabel } from './utils';
import type { ActivityData } from '@core/api';

const HeatmapWrapper = activityStyles.heatmapWrapper;
const HeatmapGrid = activityStyles.heatmapGrid;
const HeatmapContent = activityStyles.heatmapContent;
const HeatmapRow = activityStyles.heatmapRow;
const MonthLabel = activityStyles.monthLabel;
const SquaresContainer = activityStyles.squaresContainer;
const HeatmapSquare = activityStyles.heatmapSquare;
const Tooltip = activityStyles.tooltip;

interface HeatmapProps {
  activityData: ActivityData;
}

const SQUARES_PER_ROW = 10;

export function Heatmap({ activityData }: HeatmapProps) {
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    count: number;
    date: string;
  }>({ visible: false, x: 0, y: 0, count: 0, date: '' });

  // Convert activity days array to map for O(1) lookups
  const activityMap: Record<string, number> = {};
  if (activityData.days && Array.isArray(activityData.days)) {
    activityData.days.forEach((day) => {
      activityMap[day.date] = day.count;
    });
  }

  // Generate calendar days
  const days = generateCalendarDays(
    activityData.start_date,
    activityData.end_date,
    activityMap
  );

  // Generate month labels
  const monthLabels = generateMonthLabels(
    activityData.start_date,
    activityData.end_date
  );

  if (days.length === 0) {
    return (
      <HeatmapWrapper>
        <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-tertiary)' }}>
          <p>No activity data available</p>
        </div>
      </HeatmapWrapper>
    );
  }

  // Calculate rows
  const rows = Math.ceil(days.length / SQUARES_PER_ROW);
  const nRowGap = Math.round(30 / SQUARES_PER_ROW);

  const handleMouseEnter = (e: MouseEvent, day: any) => {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    setTooltip({
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top,
      count: day.count,
      date: day.date,
    });
  };

  const handleMouseLeave = () => {
    setTooltip({ visible: false, x: 0, y: 0, count: 0, date: '' });
  };

  return (
    <HeatmapWrapper>
      <HeatmapGrid>
        <HeatmapContent>
          {Array.from({ length: rows }).map((_, rowIndex) => {
            const startIndex = rowIndex * SQUARES_PER_ROW;
            const endIndex = Math.min(startIndex + SQUARES_PER_ROW, days.length);
            const rowDays = days.slice(startIndex, endIndex);

            // Show month label every nRowGap rows
            let monthLabel = '';
            if (rowIndex % nRowGap === 0) {
              const monthIndex = Math.floor(rowIndex / nRowGap);
              if (monthIndex < monthLabels.length) {
                monthLabel = monthLabels[monthIndex];
              }
            }

            return (
              <HeatmapRow key={rowIndex}>
                {monthLabel && <MonthLabel>{monthLabel}</MonthLabel>}
                <SquaresContainer>
                  {rowDays.map((day) => (
                    <HeatmapSquare
                      key={day.date}
                      intensity={day.intensity}
                      onMouseEnter={(e: any) => handleMouseEnter(e, day)}
                      onMouseLeave={handleMouseLeave}
                    />
                  ))}
                </SquaresContainer>
              </HeatmapRow>
            );
          })}
        </HeatmapContent>
      </HeatmapGrid>

      {tooltip.visible && (
        <Tooltip style={{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }}>
          <div>
            <strong>{tooltip.count} {tooltip.count === 1 ? 'post' : 'posts'}</strong>
          </div>
          <div class="tooltip-date">{formatDayLabel(tooltip.date)}</div>
        </Tooltip>
      )}
    </HeatmapWrapper>
  );
}
