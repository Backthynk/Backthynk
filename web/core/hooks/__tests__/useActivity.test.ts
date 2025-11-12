/**
 * Tests for useActivity Hook
 * Testing activity state management, period navigation, and data fetching
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/preact';
import { useActivity } from '../useActivity';
import {
  currentActivityPeriod,
  activityCache,
  isLoadingActivity,
  activitySpaceId,
  activityRecursiveMode,
} from '../../state/activity';
import { spaces as spacesSignal, recursiveSpaces } from '../../state/spaces';
import { clientConfig } from '../../state/settings';
import { createMockSpace, resetFactoryCounters } from '../../__tests__/factories';
import type { ActivityData } from '../../api/activity';
import * as activityCacheModule from '../../cache/activityCache';

// Mock the activity cache module
vi.mock('../../cache/activityCache', () => ({
  fetchActivityDataCached: vi.fn(),
}));

describe('useActivity', () => {
  const mockActivityData: ActivityData = {
    days: [
      { date: '2025-01-01', count: 5 },
      { date: '2025-01-02', count: 3 },
      { date: '2025-01-03', count: 0 },
    ],
    start_date: '2025-01-01',
    end_date: '2025-04-30',
    stats: {
      total_posts: 8,
      active_days: 2,
      max_day_activity: 5,
    },
    max_periods: 24,
  };

  beforeEach(() => {
    resetFactoryCounters();
    spacesSignal.value = [];
    recursiveSpaces.value = new Set();
    currentActivityPeriod.value = 0;
    activityCache.value = null;
    isLoadingActivity.value = false;
    activitySpaceId.value = 0;
    activityRecursiveMode.value = false;
    clientConfig.value = {
      ...clientConfig.value,
      activity: true,
    };

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should return enabled state based on config', () => {
      const space = createMockSpace({ id: 1 });
      spacesSignal.value = [space];

      const { result, rerender } = renderHook(() => useActivity(space));
      expect(result.current.isEnabled).toBe(true);

      // Disable activity
      clientConfig.value = { ...clientConfig.value, activity: false };
      rerender();

      expect(result.current.isEnabled).toBe(false);
    });

    it('should return null activity data initially', () => {
      const space = createMockSpace({ id: 1 });
      spacesSignal.value = [space];

      const { result } = renderHook(() => useActivity(space));
      expect(result.current.activityData).toBe(null);
    });

    it('should start at period 0', () => {
      const space = createMockSpace({ id: 1 });
      const { result } = renderHook(() => useActivity(space));
      expect(result.current.period).toBe(0);
    });

    it('should compute date range even without data', () => {
      const space = createMockSpace({ id: 1 });
      const { result } = renderHook(() => useActivity(space));

      expect(result.current.startDate).toBeTruthy();
      expect(result.current.endDate).toBeTruthy();
      expect(result.current.periodLabel).toBeTruthy();
    });
  });

  describe('data fetching', () => {
    it('should fetch activity data on mount', async () => {
      const fetchMock = vi.mocked(activityCacheModule.fetchActivityDataCached);
      fetchMock.mockResolvedValue({ data: mockActivityData, fromCache: false });

      const space = createMockSpace({ id: 1 });
      spacesSignal.value = [space];

      renderHook(() => useActivity(space));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(1, false, 0, 4);
      });
    });

    it('should update activity cache signal when data is fetched', async () => {
      const fetchMock = vi.mocked(activityCacheModule.fetchActivityDataCached);
      fetchMock.mockResolvedValue({ data: mockActivityData, fromCache: false });

      const space = createMockSpace({ id: 1 });
      spacesSignal.value = [space];

      const { result } = renderHook(() => useActivity(space));

      await waitFor(() => {
        expect(result.current.activityData).toEqual(mockActivityData);
      });
    });

    it('should re-fetch when period changes', async () => {
      const fetchMock = vi.mocked(activityCacheModule.fetchActivityDataCached);
      fetchMock.mockResolvedValue({ data: mockActivityData, fromCache: false });

      const space = createMockSpace({ id: 1 });
      spacesSignal.value = [space];

      const { result } = renderHook(() => useActivity(space));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      // Navigate to previous period
      currentActivityPeriod.value = -1;

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock).toHaveBeenLastCalledWith(1, false, -1, 4);
      });
    });

    it('should re-fetch when space changes', async () => {
      const fetchMock = vi.mocked(activityCacheModule.fetchActivityDataCached);
      fetchMock.mockResolvedValue({ data: mockActivityData, fromCache: false });

      const space1 = createMockSpace({ id: 1 });
      const space2 = createMockSpace({ id: 2 });
      spacesSignal.value = [space1, space2];

      const { rerender } = renderHook(
        ({ space }) => useActivity(space),
        { initialProps: { space: space1 } }
      );

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(1, false, 0, 4);
      });

      // Change space
      rerender({ space: space2 });

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(2, false, 0, 4);
      });
    });

    it('should re-fetch when recursive mode changes', async () => {
      const fetchMock = vi.mocked(activityCacheModule.fetchActivityDataCached);
      fetchMock.mockResolvedValue({ data: mockActivityData, fromCache: false });

      const space = createMockSpace({ id: 1 });
      spacesSignal.value = [space];

      const { rerender } = renderHook(() => useActivity(space));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(1, false, 0, 4);
      });

      // Enable recursive mode
      recursiveSpaces.value = new Set([1]);
      rerender();

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(1, true, 0, 4);
      });
    });

    it('should handle fetch errors gracefully', async () => {
      const fetchMock = vi.mocked(activityCacheModule.fetchActivityDataCached);
      fetchMock.mockResolvedValue({ data: null, fromCache: false });

      const space = createMockSpace({ id: 1 });
      spacesSignal.value = [space];

      const { result } = renderHook(() => useActivity(space));

      await waitFor(() => {
        expect(result.current.activityData).toBe(null);
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should not fetch if activity is disabled', async () => {
      const fetchMock = vi.mocked(activityCacheModule.fetchActivityDataCached);
      clientConfig.value = { ...clientConfig.value, activity: false };

      const space = createMockSpace({ id: 1 });
      spacesSignal.value = [space];

      renderHook(() => useActivity(space));

      // Wait a bit to ensure no fetch happens
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('period navigation', () => {
    it('should navigate to previous period', async () => {
      const fetchMock = vi.mocked(activityCacheModule.fetchActivityDataCached);
      fetchMock.mockResolvedValue({ data: mockActivityData, fromCache: false });

      const space = createMockSpace({ id: 1 });
      spacesSignal.value = [space];

      const { result } = renderHook(() => useActivity(space));

      await waitFor(() => {
        expect(result.current.activityData).toBeTruthy();
      });

      expect(result.current.period).toBe(0);
      expect(result.current.canNavigatePrev).toBe(true);

      // Navigate to previous period
      result.current.navigatePeriod(-1);

      await waitFor(() => {
        expect(result.current.period).toBe(-1);
      });
    });

    it('should navigate to next period', async () => {
      const fetchMock = vi.mocked(activityCacheModule.fetchActivityDataCached);
      fetchMock.mockResolvedValue({ data: mockActivityData, fromCache: false });

      const space = createMockSpace({ id: 1 });
      spacesSignal.value = [space];

      const { result } = renderHook(() => useActivity(space));

      await waitFor(() => {
        expect(result.current.activityData).toBeTruthy();
      });

      // Navigate to previous period first
      result.current.navigatePeriod(-1);

      await waitFor(() => {
        expect(result.current.period).toBe(-1);
      });

      expect(result.current.canNavigateNext).toBe(true);

      // Navigate to next period
      result.current.navigatePeriod(1);

      await waitFor(() => {
        expect(result.current.period).toBe(0);
      });
    });

    it('should not navigate beyond current period (0)', async () => {
      const fetchMock = vi.mocked(activityCacheModule.fetchActivityDataCached);
      fetchMock.mockResolvedValue({ data: mockActivityData, fromCache: false });

      const space = createMockSpace({ id: 1 });
      spacesSignal.value = [space];

      const { result } = renderHook(() => useActivity(space));

      await waitFor(() => {
        expect(result.current.activityData).toBeTruthy();
      });

      expect(result.current.period).toBe(0);
      expect(result.current.canNavigateNext).toBe(false);

      // Try to navigate forward (should not work)
      result.current.navigatePeriod(1);

      // Period should still be 0
      expect(result.current.period).toBe(0);
    });

    it('should respect max_periods from data', async () => {
      const limitedData = {
        ...mockActivityData,
        max_periods: 2, // Only allow 2 periods back
      };

      const fetchMock = vi.mocked(activityCacheModule.fetchActivityDataCached);
      fetchMock.mockResolvedValue({ data: limitedData, fromCache: false });

      const space = createMockSpace({ id: 1 });
      spacesSignal.value = [space];

      const { result } = renderHook(() => useActivity(space));

      await waitFor(() => {
        expect(result.current.activityData).toBeTruthy();
      });

      // Navigate to -2 (should work)
      result.current.navigatePeriod(-1);
      await waitFor(() => expect(result.current.period).toBe(-1));

      result.current.navigatePeriod(-1);
      await waitFor(() => expect(result.current.period).toBe(-2));

      expect(result.current.canNavigatePrev).toBe(false);

      // Try to navigate further back (should not work)
      result.current.navigatePeriod(-1);
      expect(result.current.period).toBe(-2);
    });

    it('should reset period when space changes', async () => {
      const fetchMock = vi.mocked(activityCacheModule.fetchActivityDataCached);
      fetchMock.mockResolvedValue({ data: mockActivityData, fromCache: false });

      const space1 = createMockSpace({ id: 1 });
      const space2 = createMockSpace({ id: 2 });
      spacesSignal.value = [space1, space2];

      const { result, rerender } = renderHook(
        ({ space }) => useActivity(space),
        { initialProps: { space: space1 } }
      );

      await waitFor(() => {
        expect(result.current.activityData).toBeTruthy();
      });

      // Navigate to previous period
      result.current.navigatePeriod(-1);
      await waitFor(() => expect(result.current.period).toBe(-1));

      // Change space - period should reset to 0
      rerender({ space: space2 });

      await waitFor(() => {
        expect(result.current.period).toBe(0);
      });
    });

    it('should NOT reset period when recursive mode changes', async () => {
      const fetchMock = vi.mocked(activityCacheModule.fetchActivityDataCached);
      fetchMock.mockResolvedValue({ data: mockActivityData, fromCache: false });

      const space = createMockSpace({ id: 1 });
      spacesSignal.value = [space];

      const { result, rerender } = renderHook(() => useActivity(space));

      await waitFor(() => {
        expect(result.current.activityData).toBeTruthy();
      });

      // Navigate to previous period
      result.current.navigatePeriod(-1);
      await waitFor(() => expect(result.current.period).toBe(-1));

      // Enable recursive mode - period should stay at -1
      recursiveSpaces.value = new Set([1]);
      rerender();

      expect(result.current.period).toBe(-1);
    });
  });

  describe('recursive mode handling', () => {
    it('should track recursive mode correctly', async () => {
      const fetchMock = vi.mocked(activityCacheModule.fetchActivityDataCached);
      fetchMock.mockResolvedValue({ data: mockActivityData, fromCache: false });

      const space = createMockSpace({ id: 1 });
      spacesSignal.value = [space];

      const { result, rerender } = renderHook(() => useActivity(space));

      expect(result.current.isRecursive).toBe(false);

      // Enable recursive mode
      recursiveSpaces.value = new Set([1]);
      rerender();

      expect(result.current.isRecursive).toBe(true);
    });
  });

  describe('All Spaces view', () => {
    it('should handle null space (All Spaces view)', async () => {
      const fetchMock = vi.mocked(activityCacheModule.fetchActivityDataCached);
      fetchMock.mockResolvedValue({ data: mockActivityData, fromCache: false });

      renderHook(() => useActivity(null));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith(0, false, 0, 4);
      });
    });
  });

  describe('reload function', () => {
    it('should provide a reload function', async () => {
      const fetchMock = vi.mocked(activityCacheModule.fetchActivityDataCached);
      fetchMock.mockResolvedValue({ data: mockActivityData, fromCache: false });

      const space = createMockSpace({ id: 1 });
      spacesSignal.value = [space];

      const { result } = renderHook(() => useActivity(space));

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      // Call reload
      await result.current.reload();

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('period label formatting', () => {
    it('should format period label from data', async () => {
      const fetchMock = vi.mocked(activityCacheModule.fetchActivityDataCached);
      fetchMock.mockResolvedValue({ data: mockActivityData, fromCache: false });

      const space = createMockSpace({ id: 1 });
      spacesSignal.value = [space];

      const { result } = renderHook(() => useActivity(space));

      await waitFor(() => {
        expect(result.current.periodLabel).toBeTruthy();
        expect(result.current.periodLabel).not.toBe('No activity period');
      });
    });
  });
});
