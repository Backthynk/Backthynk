// Date formatting utilities

/**
 * Format a date string to locale format (e.g., "Jan 2025" or "Jan 1, 2025")
 */
export function formatMonthYear(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00Z');
    if (isNaN(date.getTime())) return dateStr;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a date string to full locale format (e.g., "Monday, January 1, 2025")
 */
export function formatFullDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00Z');
    if (isNaN(date.getTime())) return dateStr;

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Calculate date range for activity periods
 * @param period - Period offset (0 = current, negative = past)
 * @param periodMonths - Number of months per period
 * @returns Object with start_date and end_date in YYYY-MM-DD format
 */
export function calculateActivityPeriodDates(period: number, periodMonths: number): { start_date: string; end_date: string } {
  const now = new Date();

  if (period === 0) {
    // Current period: end is today, start is first day of (periodMonths - 1) months ago
    const end = now;
    const start = new Date(Date.UTC(
      now.getFullYear(),
      now.getMonth() - (periodMonths - 1),
      1
    ));

    return {
      start_date: start.toISOString().split('T')[0],
      end_date: end.toISOString().split('T')[0]
    };
  }

  // Past periods
  const currentPeriodStart = new Date(Date.UTC(
    now.getFullYear(),
    now.getMonth() - (periodMonths - 1),
    1
  ));
  const periodStart = new Date(Date.UTC(
    currentPeriodStart.getUTCFullYear(),
    currentPeriodStart.getUTCMonth() + (periodMonths * period),
    1
  ));
  const periodEnd = new Date(Date.UTC(
    periodStart.getUTCFullYear(),
    periodStart.getUTCMonth() + periodMonths,
    0 // Last day of the previous month
  ));

  return {
    start_date: periodStart.toISOString().split('T')[0],
    end_date: periodEnd.toISOString().split('T')[0]
  };
}

export function formatRelativeDate(timestamp: number): string {
  if (!timestamp || isNaN(timestamp)) return 'Unknown date';

  // Handle both seconds and milliseconds timestamps
  // If timestamp > 10 billion, it's likely already in milliseconds
  const isMilliseconds = timestamp > 10000000000;
  const date = new Date(isMilliseconds ? timestamp : timestamp * 1000);

  if (isNaN(date.getTime())) return 'Invalid date';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffMinutes = Math.floor(diffMs / (60 * 1000));

  if (diffMinutes < 1) return 'now';
  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return diffDays === 1 ? '1d' : `${diffDays}d`;

  // More than 6 days ago - show date
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}

export function formatFullDateTime(timestamp: number): string {
  if (!timestamp || isNaN(timestamp)) return 'Unknown date';

  // Handle both seconds and milliseconds timestamps
  // If timestamp > 10 billion, it's likely already in milliseconds
  const isMilliseconds = timestamp > 10000000000;
  const date = new Date(isMilliseconds ? timestamp : timestamp * 1000);

  if (isNaN(date.getTime())) return 'Invalid date';

  // Detect user's 12/24 hour preference from their locale
  const testFormat = date.toLocaleTimeString('en-US');
  const is24Hour = !testFormat.match(/AM|PM/i);

  const timeOptions: Intl.DateTimeFormatOptions = is24Hour
    ? { hour: '2-digit', minute: '2-digit', hour12: false }
    : { hour: 'numeric', minute: '2-digit', hour12: true };

  const dateOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };

  const time = date.toLocaleTimeString('en-US', timeOptions);
  const dateStr = date.toLocaleDateString('en-US', dateOptions);

  return `${time} - ${dateStr}`;
}
