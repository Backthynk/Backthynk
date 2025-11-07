/**
 * Tests for Activity Cache
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { activityCache, updateActivityDayCount } from '../activityCache';
import { createMockActivityData, resetFactoryCounters } from '../../__tests__/factories';
import type { ActivityData } from '../../api/activity';

describe('Activity Cache', () => {
  beforeEach(() => {
    activityCache.clear();
    resetFactoryCounters();
  });

  describe('Basic Cache Operations', () => {
    it('should store and retrieve activity data', () => {
      const data = createMockActivityData(120);
      const cacheKey = 'activity:1:flat:0:4m';

      activityCache['cache'].set(cacheKey, data);

      const retrieved = activityCache.getData(1, false, 0, 4);
      expect(retrieved).toEqual(data);
    });

    it('should return null for cache miss', () => {
      const retrieved = activityCache.getData(999, false, 0, 4);
      expect(retrieved).toBeNull();
    });

    it('should differentiate between different parameters', () => {
      const flatData = createMockActivityData(60);
      const recursiveData = createMockActivityData(120);

      activityCache['cache'].set('activity:1:flat:0:4m', flatData);
      activityCache['cache'].set('activity:1:recursive:0:4m', recursiveData);

      expect(activityCache.getData(1, false, 0, 4)).toEqual(flatData);
      expect(activityCache.getData(1, true, 0, 4)).toEqual(recursiveData);
    });
  });

  describe('Invalidation', () => {
    beforeEach(() => {
      activityCache['cache'].set('activity:1:flat:0:4m', createMockActivityData());
      activityCache['cache'].set('activity:1:recursive:0:4m', createMockActivityData());
      activityCache['cache'].set('activity:1:flat:-1:4m', createMockActivityData());
      activityCache['cache'].set('activity:2:flat:0:4m', createMockActivityData());
    });

    it('should invalidate all data for a space', () => {
      activityCache.invalidateSpace(1, true);

      expect(activityCache.getData(1, false, 0, 4)).toBeNull();
      expect(activityCache.getData(1, true, 0, 4)).toBeNull();
      expect(activityCache.getData(1, false, -1, 4)).toBeNull();
      expect(activityCache.getData(2, false, 0, 4)).not.toBeNull();
    });

    it('should invalidate only flat view for a space', () => {
      activityCache.invalidateSpace(1, false);

      expect(activityCache.getData(1, false, 0, 4)).toBeNull();
      expect(activityCache.getData(1, true, 0, 4)).not.toBeNull();
    });

    it('should invalidate current period for all spaces', () => {
      activityCache.invalidateCurrentPeriod();

      expect(activityCache.getData(1, false, 0, 4)).toBeNull();
      expect(activityCache.getData(1, true, 0, 4)).toBeNull();
      expect(activityCache.getData(2, false, 0, 4)).toBeNull();
      expect(activityCache.getData(1, false, -1, 4)).not.toBeNull();
    });
  });

  describe('updateActivityDayCount', () => {
    let activityData: ActivityData;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todayTimestamp = Math.floor(today.getTime() / 1000);

    beforeEach(() => {
      // Create activity data with today having 5 posts
      activityData = createMockActivityData(120);
      const todayIndex = activityData.days.findIndex(d => d.date === todayStr);
      if (todayIndex === -1) {
        activityData.days.push({ date: todayStr, count: 5 });
      } else {
        activityData.days[todayIndex].count = 5;
      }
      activityData.stats.total_posts = activityData.days.reduce((sum, d) => sum + d.count, 0);
      activityData.stats.max_day_activity = Math.max(...activityData.days.map(d => d.count));
      activityData.stats.active_days = activityData.days.filter(d => d.count > 0).length;

      // Cache the data for multiple period_months values
      activityCache['cache'].set('activity:1:flat:0:4m', JSON.parse(JSON.stringify(activityData)));
      activityCache['cache'].set('activity:1:flat:0:6m', JSON.parse(JSON.stringify(activityData)));
      activityCache['cache'].set('activity:1:flat:0:12m', JSON.parse(JSON.stringify(activityData)));
    });

    it('should decrement day count when deleting a post', () => {
      updateActivityDayCount(todayTimestamp, -1, 1, false);

      const data = activityCache.getData(1, false, 0, 4);
      expect(data).not.toBeNull();

      const todayData = data!.days.find(d => d.date === todayStr);
      expect(todayData?.count).toBe(4); // 5 - 1
    });

    it('should increment day count when adding a post', () => {
      updateActivityDayCount(todayTimestamp, 1, 1, false);

      const data = activityCache.getData(1, false, 0, 4);
      const todayData = data!.days.find(d => d.date === todayStr);
      expect(todayData?.count).toBe(6); // 5 + 1
    });

    it('should update total_posts in stats', () => {
      const originalTotal = activityData.stats.total_posts;
      updateActivityDayCount(todayTimestamp, -2, 1, false);

      const data = activityCache.getData(1, false, 0, 4);
      expect(data!.stats.total_posts).toBe(originalTotal - 2);
    });

    it('should update max_day_activity if needed', () => {
      // Set today to be the max
      const data = activityCache.getData(1, false, 0, 4)!;
      data.days.forEach(d => d.count = d.date === todayStr ? 10 : 3);
      data.stats.max_day_activity = 10;
      activityCache['cache'].set('activity:1:flat:0:4m', data);

      // Decrement today's count
      updateActivityDayCount(todayTimestamp, -5, 1, false);

      const updatedData = activityCache.getData(1, false, 0, 4)!;
      expect(updatedData.stats.max_day_activity).toBe(5); // Recalculated max
    });

    it('should update active_days when count goes to zero', () => {
      // Create data where today has count of 1
      const data = activityCache.getData(1, false, 0, 4)!;
      const todayIndex = data.days.findIndex(d => d.date === todayStr);
      data.days[todayIndex].count = 1;
      const originalActiveDays = data.stats.active_days;
      activityCache['cache'].set('activity:1:flat:0:4m', data);

      // Decrement to 0
      updateActivityDayCount(todayTimestamp, -1, 1, false);

      const updatedData = activityCache.getData(1, false, 0, 4)!;
      expect(updatedData.days[todayIndex].count).toBe(0);
      expect(updatedData.stats.active_days).toBe(originalActiveDays - 1);
    });

    it('should update active_days when count goes from zero to positive', () => {
      // Create data where today has count of 0
      const data = activityCache.getData(1, false, 0, 4)!;
      const todayIndex = data.days.findIndex(d => d.date === todayStr);
      data.days[todayIndex].count = 0;
      const originalActiveDays = data.stats.active_days;
      activityCache['cache'].set('activity:1:flat:0:4m', data);

      // Increment from 0
      updateActivityDayCount(todayTimestamp, 1, 1, false);

      const updatedData = activityCache.getData(1, false, 0, 4)!;
      expect(updatedData.days[todayIndex].count).toBe(1);
      expect(updatedData.stats.active_days).toBe(originalActiveDays + 1);
    });

    it('should update all period_months variants', () => {
      updateActivityDayCount(todayTimestamp, -1, 1, false);

      const data4m = activityCache.getData(1, false, 0, 4);
      const data6m = activityCache.getData(1, false, 0, 6);
      const data12m = activityCache.getData(1, false, 0, 12);

      expect(data4m!.days.find(d => d.date === todayStr)?.count).toBe(4);
      expect(data6m!.days.find(d => d.date === todayStr)?.count).toBe(4);
      expect(data12m!.days.find(d => d.date === todayStr)?.count).toBe(4);
    });

    it('should handle day not in cache gracefully', () => {
      const futureTimestamp = todayTimestamp + 86400 * 30; // 30 days in future
      expect(() => updateActivityDayCount(futureTimestamp, -1, 1, false)).not.toThrow();
    });

    it('should never go below zero for day count', () => {
      // Set day count to 1
      const data = activityCache.getData(1, false, 0, 4)!;
      const todayIndex = data.days.findIndex(d => d.date === todayStr);
      data.days[todayIndex].count = 1;
      activityCache['cache'].set('activity:1:flat:0:4m', data);

      // Try to decrement by 5 (should cap at 0)
      updateActivityDayCount(todayTimestamp, -5, 1, false);

      const updatedData = activityCache.getData(1, false, 0, 4)!;
      expect(updatedData.days[todayIndex].count).toBe(0);
    });
  });
});
