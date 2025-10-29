import { apiRequest } from './client';

export interface ActivityDay {
  date: string;
  count: number;
}

export interface ActivityStats {
  total_posts: number;
  active_days: number;
  max_day_activity: number;
}

export interface ActivityData {
  days: ActivityDay[];
  start_date: string;
  end_date: string;
  stats: ActivityStats;
  max_periods: number;
}

export async function fetchActivityData(
  spaceId: number,
  recursive: boolean,
  period: number,
  periodMonths: number = 4
): Promise<ActivityData | null> {
  try {
    const params = new URLSearchParams({
      recursive: recursive.toString(),
      period: period.toString(),
      period_months: periodMonths.toString(),
    });

    const response = await apiRequest<ActivityData>(
      `/activity/${spaceId}?${params.toString()}`
    );

    return response;
  } catch (error) {
    console.error('Failed to fetch activity data:', error);
    return null;
  }
}
