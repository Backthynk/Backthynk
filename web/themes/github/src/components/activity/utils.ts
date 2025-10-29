/**
 * Activity tracker utility functions
 */

// Activity level thresholds
export const ACTIVITY_THRESHOLDS = {
  low: 1,
  medium: 3,
  high: 5,
};

// Get intensity level from post count
export function getIntensityLevel(count: number): number {
  if (count === 0) return 0;
  if (count === ACTIVITY_THRESHOLDS.low) return 1;
  if (count <= ACTIVITY_THRESHOLDS.medium) return 2;
  if (count <= ACTIVITY_THRESHOLDS.high) return 3;
  return 4; // Very high
}

// Format period label (e.g., "Jul 2025 – Oct 2025")
export function formatPeriodLabel(startDate: string, endDate: string): string {
  if (!startDate || !endDate) {
    return 'No activity period';
  }

  try {
    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 'No activity period';
    }

    const startMonth = start.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
    const endMonth = end.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });

    return `${startMonth} – ${endMonth}`;
  } catch (error) {
    return 'No activity period';
  }
}

// Format day for tooltip
export function formatDayLabel(date: string): string {
  try {
    const d = new Date(date + 'T00:00:00Z');
    if (isNaN(d.getTime())) return date;

    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch (error) {
    return date;
  }
}

// Generate calendar days for the heatmap
export interface CalendarDay {
  date: string;
  count: number;
  intensity: number;
  month: number;
  day: number;
}

export function generateCalendarDays(
  startDate: string,
  endDate: string,
  activityMap: Record<string, number>
): CalendarDay[] {
  const days: CalendarDay[] = [];

  if (!startDate || !endDate) {
    return days;
  }

  try {
    const current = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');

    if (isNaN(current.getTime()) || isNaN(end.getTime())) {
      return days;
    }

    while (current <= end) {
      const dateKey = current.toISOString().split('T')[0];
      const count = activityMap[dateKey] || 0;
      const intensity = getIntensityLevel(count);

      days.push({
        date: dateKey,
        count,
        intensity,
        month: current.getUTCMonth(),
        day: current.getUTCDate(),
      });

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return days;
  } catch (error) {
    console.error('Error generating calendar days:', error);
    return days;
  }
}

// Generate unique month labels for the period
export function generateMonthLabels(startDate: string, endDate: string): string[] {
  const monthsSet = new Set<string>();

  if (!startDate || !endDate) {
    return [];
  }

  try {
    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T00:00:00Z');

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return [];
    }

    const current = new Date(start);

    while (current <= end) {
      const monthLabel = current.toLocaleDateString('en-US', {
        month: 'short',
        timeZone: 'UTC',
      });
      monthsSet.add(monthLabel);
      current.setUTCMonth(current.getUTCMonth() + 1);
      current.setUTCDate(1); // Reset to first day of month
    }

    return Array.from(monthsSet);
  } catch (error) {
    console.error('Error generating month labels:', error);
    return [];
  }
}
