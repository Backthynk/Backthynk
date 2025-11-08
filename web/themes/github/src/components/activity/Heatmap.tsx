import { useState, useEffect } from 'preact/hooks';
import { activityStyles } from '../../styles/activity';
import { generateCalendarDays, generateMonthLabels, formatFullDate } from '@core/utils';
import type { ActivityData } from '@core/api';
import { useTooltip } from '@core/components';
import { activity as activityConfig } from '../../config';

const HeatmapWrapper = activityStyles.heatmapWrapper;
const HeatmapGrid = activityStyles.heatmapGrid;
const HeatmapContent = activityStyles.heatmapContent;
const HeatmapRow = activityStyles.heatmapRow;
const MonthLabel = activityStyles.monthLabel;
const SquaresContainer = activityStyles.squaresContainer;
const HeatmapSquare = activityStyles.heatmapSquare;

interface HeatmapProps {
  activityData: ActivityData;
}

const useResponsiveCellsPerLine = () => {
  const [cellsPerLine, setCellsPerLine] = useState(
    window.innerWidth >= 1260 ? activityConfig.cellsPerLine : 10
  );

  useEffect(() => {
    const handleResize = () => {
      setCellsPerLine(window.innerWidth >= 1260 ? activityConfig.cellsPerLine : 10);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return cellsPerLine;
};

export function Heatmap({ activityData }: HeatmapProps) {
   const { show, hide, TooltipPortal } = useTooltip();
   const SQUARES_PER_ROW = useResponsiveCellsPerLine();

  // Convert activity days array to map for O(1) lookups
  const activityMap: Record<string, number> = {};
  if (activityData.days && Array.isArray(activityData.days)) {
    activityData.days.forEach((day) => {
      activityMap[day.date] = day.count;
    });
  }

  // Generate calendar days
  let days = generateCalendarDays(
    activityData.start_date,
    activityData.end_date,
    activityMap
  );

  // Generate month labels
  let monthLabels = generateMonthLabels(
    activityData.start_date,
    activityData.end_date
  );

  // If no days generated (empty date range), create placeholder grid to maintain height
  if (days.length === 0 && activityData.start_date && activityData.end_date) {
    // Calculate actual number of days between start and end date
    try {
      const start = new Date(activityData.start_date + 'T00:00:00Z');
      const end = new Date(activityData.end_date + 'T00:00:00Z');

      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const current = new Date(start);
        const tempDays = [];

        while (current <= end) {
          const dateKey = current.toISOString().split('T')[0];
          tempDays.push({
            date: dateKey,
            count: 0,
            intensity: 0,
            month: current.getUTCMonth(),
            day: current.getUTCDate(),
          });
          current.setUTCDate(current.getUTCDate() + 1);
        }

        days = tempDays;
      }
    } catch (error) {
      console.error('Error generating placeholder days:', error);
    }
  }

  // Calculate rows
  const rows = Math.ceil(days.length / SQUARES_PER_ROW);
  const nRowGap = Math.round(30 / SQUARES_PER_ROW);

  const handleMouseEnter = (e: MouseEvent, day: any) => {
    show(e.currentTarget as HTMLElement, {
      title: `${day.count} ${day.count === 1 ? 'post' : 'posts'}`,
      lines: [formatFullDate(day.date)]
    });
  };

  const handleMouseLeave = () => {
    hide();
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

      {TooltipPortal}
    </HeatmapWrapper>
  );
}
