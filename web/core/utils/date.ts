// Date formatting utilities adapted from _oldweb

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
