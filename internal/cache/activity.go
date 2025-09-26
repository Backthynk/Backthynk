package cache

import (
	"fmt"
	"sync"
	"time"
)

// ActivityDay represents a single day's activity
type ActivityDay struct {
	Date  string `json:"date"`  // YYYY-MM-DD format
	Count int    `json:"count"` // Number of posts on this day
}

// CategoryActivity represents all activity for a category
type CategoryActivity struct {
	CategoryID int                    `json:"category_id"`
	Days       map[string]int         `json:"days"`        // date -> post count
	Recursive  map[string]int         `json:"recursive"`   // recursive activity including children
	Stats      ActivityStats          `json:"stats"`
	LastUpdate int64                  `json:"last_update"` // Unix timestamp in milliseconds
	Mutex      sync.RWMutex           `json:"-"`
}

// ActivityStats represents aggregated activity statistics
type ActivityStats struct {
	TotalPosts       int   `json:"total_posts"`
	TotalActiveDays  int   `json:"total_active_days"`
	FirstPostTime    int64 `json:"first_post_time"`  // Unix timestamp in milliseconds
	LastPostTime     int64 `json:"last_post_time"`   // Unix timestamp in milliseconds
	RecursivePosts   int   `json:"recursive_posts"`
	RecursiveActiveDays int `json:"recursive_active_days"`
}

// ActivityPeriodRequest represents a request for activity data in a specific period
type ActivityPeriodRequest struct {
	CategoryID    int  `json:"category_id"`
	Recursive     bool `json:"recursive"`
	StartDate     string `json:"start_date"` // YYYY-MM-DD
	EndDate       string `json:"end_date"`   // YYYY-MM-DD
	Period        int  `json:"period"`      // 0 = current, -1 = previous period, etc.
	PeriodMonths  int  `json:"period_months"` // Number of months per period (default 6)
}

// ActivityPeriodResponse represents compact activity data for a period
type ActivityPeriodResponse struct {
	CategoryID    int           `json:"category_id"`
	StartDate     string        `json:"start_date"`
	EndDate       string        `json:"end_date"`
	Period        int           `json:"period"`
	Days          []ActivityDay `json:"days"`          // Only days with activity > 0
	Stats         PeriodStats   `json:"stats"`
	MaxPeriods    int           `json:"max_periods"`   // Total available historical periods
}

// PeriodStats represents statistics for a specific period
type PeriodStats struct {
	TotalPosts      int `json:"total_posts"`
	ActiveDays      int `json:"active_days"`
	MaxDayActivity  int `json:"max_day_activity"`
}

// ActivityCache manages all category activity data in memory
type ActivityCache struct {
	categories map[int]*CategoryActivity // categoryID -> activity
	hierarchy  map[int][]int             // parentID -> []childIDs
	mutex      sync.RWMutex
}

// Global activity cache instance
var activityCache *ActivityCache

// InitActivityCache initializes the global activity cache
func InitActivityCache() *ActivityCache {
	if activityCache == nil {
		activityCache = &ActivityCache{
			categories: make(map[int]*CategoryActivity),
			hierarchy:  make(map[int][]int),
		}
	}
	return activityCache
}

// GetActivityCache returns the global activity cache instance
func GetActivityCache() *ActivityCache {
	if activityCache == nil {
		return InitActivityCache()
	}
	return activityCache
}

// UpdatePostActivity updates the activity cache when a post is created/deleted
func (ac *ActivityCache) UpdatePostActivity(categoryID int, timestamp int64, delta int) error {
	ac.mutex.Lock()
	defer ac.mutex.Unlock()

	// Convert timestamp to date string
	date := time.Unix(timestamp/1000, (timestamp%1000)*1000000).UTC().Format("2006-01-02")

	// Update direct category activity
	if err := ac.updateCategoryActivity(categoryID, date, timestamp, delta); err != nil {
		return err
	}

	// Update the category's own recursive activity (important for recursive mode)
	if err := ac.updateCategoryRecursiveActivity(categoryID, date, delta); err != nil {
		return err
	}

	// Update recursive activity for all parent categories
	return ac.updateParentActivities(categoryID, date, timestamp, delta)
}

// updateCategoryActivity updates activity for a specific category
func (ac *ActivityCache) updateCategoryActivity(categoryID int, date string, timestamp int64, delta int) error {
	activity := ac.categories[categoryID]
	if activity == nil {
		activity = &CategoryActivity{
			CategoryID: categoryID,
			Days:       make(map[string]int),
			Recursive:  make(map[string]int),
			Stats:      ActivityStats{},
			LastUpdate: time.Now().UnixMilli(),
		}
		ac.categories[categoryID] = activity
	}

	activity.Mutex.Lock()
	defer activity.Mutex.Unlock()

	// Update daily count
	oldCount := activity.Days[date]
	newCount := oldCount + delta

	if newCount <= 0 {
		delete(activity.Days, date)
	} else {
		activity.Days[date] = newCount
	}

	// Update stats
	activity.Stats.TotalPosts += delta

	// Update active days count
	if oldCount == 0 && newCount > 0 {
		activity.Stats.TotalActiveDays++
	} else if oldCount > 0 && newCount <= 0 {
		activity.Stats.TotalActiveDays--
	}

	// Update first/last post times
	if delta > 0 { // Adding post
		if activity.Stats.FirstPostTime == 0 || timestamp < activity.Stats.FirstPostTime {
			activity.Stats.FirstPostTime = timestamp
		}
		if timestamp > activity.Stats.LastPostTime {
			activity.Stats.LastPostTime = timestamp
		}
	}

	activity.LastUpdate = time.Now().UnixMilli()
	return nil
}

// updateCategoryRecursiveActivity updates the category's own recursive activity
func (ac *ActivityCache) updateCategoryRecursiveActivity(categoryID int, date string, delta int) error {
	activity := ac.categories[categoryID]
	if activity == nil {
		return nil // Category not in cache yet
	}

	activity.Mutex.Lock()
	defer activity.Mutex.Unlock()

	// Initialize recursive map if not present
	if activity.Recursive == nil {
		activity.Recursive = make(map[string]int)
		// Copy existing direct activity to recursive
		for date, count := range activity.Days {
			activity.Recursive[date] = count
		}
	}

	// Update recursive daily count
	oldRecursiveCount := activity.Recursive[date]
	newRecursiveCount := oldRecursiveCount + delta

	if newRecursiveCount <= 0 {
		delete(activity.Recursive, date)
	} else {
		activity.Recursive[date] = newRecursiveCount
	}

	// Update recursive stats
	activity.Stats.RecursivePosts += delta

	// Update recursive active days count
	if oldRecursiveCount == 0 && newRecursiveCount > 0 {
		activity.Stats.RecursiveActiveDays++
	} else if oldRecursiveCount > 0 && newRecursiveCount <= 0 {
		activity.Stats.RecursiveActiveDays--
	}

	activity.LastUpdate = time.Now().UnixMilli()
	return nil
}

// updateParentActivities updates recursive activity for parent categories
func (ac *ActivityCache) updateParentActivities(categoryID int, date string, timestamp int64, delta int) error {
	// This would need to be implemented with knowledge of category hierarchy
	// For now, we'll implement this in the storage layer
	return nil
}

// GetActivityPeriod returns compact activity data for a specific period
func (ac *ActivityCache) GetActivityPeriod(req ActivityPeriodRequest) (*ActivityPeriodResponse, error) {
	ac.mutex.RLock()
	defer ac.mutex.RUnlock()

	// Handle ALL_CATEGORIES_ID by aggregating across all cached categories
	if req.CategoryID == 0 { // ALL_CATEGORIES_ID
		return ac.getGlobalActivityPeriod(req)
	}

	activity := ac.categories[req.CategoryID]
	if activity == nil {
		// For categories not in cache, still calculate proper period dates
		startDate, endDate := ac.calculatePeriodDates(req.Period, req.PeriodMonths)
		if req.StartDate != "" {
			startDate = req.StartDate
		}
		if req.EndDate != "" {
			endDate = req.EndDate
		}

		return &ActivityPeriodResponse{
			CategoryID: req.CategoryID,
			StartDate:  startDate,
			EndDate:    endDate,
			Period:     req.Period,
			Days:       []ActivityDay{},
			Stats:      PeriodStats{},
			MaxPeriods: 0,
		}, nil
	}

	activity.Mutex.RLock()
	defer activity.Mutex.RUnlock()

	// Calculate period dates if not provided
	startDate, endDate := ac.calculatePeriodDates(req.Period, req.PeriodMonths)
	if req.StartDate != "" {
		startDate = req.StartDate
	}
	if req.EndDate != "" {
		endDate = req.EndDate
	}

	// Get activity data (recursive or direct)
	var dayData map[string]int
	if req.Recursive {
		dayData = activity.Recursive
	} else {
		dayData = activity.Days
	}

	// Filter and compact data for the requested period
	days := make([]ActivityDay, 0)
	stats := PeriodStats{}

	for date, count := range dayData {
		if date >= startDate && date <= endDate && count > 0 {
			days = append(days, ActivityDay{
				Date:  date,
				Count: count,
			})
			stats.TotalPosts += count
			stats.ActiveDays++
			if count > stats.MaxDayActivity {
				stats.MaxDayActivity = count
			}
		}
	}

	// Calculate max periods based on first post time
	maxPeriods := ac.calculateMaxPeriods(activity.Stats.FirstPostTime, req.PeriodMonths)

	return &ActivityPeriodResponse{
		CategoryID: req.CategoryID,
		StartDate:  startDate,
		EndDate:    endDate,
		Period:     req.Period,
		Days:       days,
		Stats:      stats,
		MaxPeriods: maxPeriods,
	}, nil
}

// calculatePeriodDates calculates start and end dates for a given period
func (ac *ActivityCache) calculatePeriodDates(period, periodMonths int) (string, string) {
	now := time.Now().UTC()

	if period == 0 {
		// Current period: last N months up to today
		end := now
		start := now.AddDate(0, -(periodMonths-1), 0)
		start = time.Date(start.Year(), start.Month(), 1, 0, 0, 0, 0, time.UTC)
		return start.Format("2006-01-02"), end.Format("2006-01-02")
	}

	// Historical periods
	currentPeriodStart := now.AddDate(0, -(periodMonths-1), 0)
	currentPeriodStart = time.Date(currentPeriodStart.Year(), currentPeriodStart.Month(), 1, 0, 0, 0, 0, time.UTC)
	periodStart := currentPeriodStart.AddDate(0, periodMonths*period, 0)
	periodEnd := periodStart.AddDate(0, periodMonths, -1)

	return periodStart.Format("2006-01-02"), periodEnd.Format("2006-01-02")
}

// calculateMaxPeriods calculates the maximum number of historical periods available
func (ac *ActivityCache) calculateMaxPeriods(firstPostTime int64, periodMonths int) int {
	if firstPostTime == 0 {
		return 0
	}

	firstPost := time.Unix(firstPostTime/1000, (firstPostTime%1000)*1000000).UTC()
	now := time.Now().UTC()

	monthsDiff := (now.Year()-firstPost.Year())*12 + int(now.Month()-firstPost.Month())
	return monthsDiff / periodMonths
}

// getGlobalActivityPeriod aggregates activity data across all cached categories
func (ac *ActivityCache) getGlobalActivityPeriod(req ActivityPeriodRequest) (*ActivityPeriodResponse, error) {
	// Calculate period dates
	startDate, endDate := ac.calculatePeriodDates(req.Period, req.PeriodMonths)
	if req.StartDate != "" {
		startDate = req.StartDate
	}
	if req.EndDate != "" {
		endDate = req.EndDate
	}

	// Parse period dates for filtering
	periodStart, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return nil, fmt.Errorf("invalid start date: %w", err)
	}
	periodEnd, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return nil, fmt.Errorf("invalid end date: %w", err)
	}

	// Aggregate activity across all categories
	aggregatedActivity := make(map[string]int)
	totalPosts := 0
	activeDays := 0
	maxDayActivity := 0
	earliestTime := int64(0)

	// Iterate through all cached categories
	for _, activity := range ac.categories {
		if activity == nil {
			continue
		}

		activity.Mutex.RLock()

		// Track earliest post time for max_periods calculation
		if activity.Stats.FirstPostTime > 0 && (earliestTime == 0 || activity.Stats.FirstPostTime < earliestTime) {
			earliestTime = activity.Stats.FirstPostTime
		}

		// Aggregate activity data for the period
		activityData := activity.Days
		if req.Recursive {
			activityData = activity.Recursive
		}

		for dateStr, count := range activityData {
			date, err := time.Parse("2006-01-02", dateStr)
			if err != nil {
				continue
			}

			// Only include dates within the period
			if (date.Equal(periodStart) || date.After(periodStart)) &&
				(date.Equal(periodEnd) || date.Before(periodEnd)) {
				aggregatedActivity[dateStr] += count
			}
		}

		activity.Mutex.RUnlock()
	}

	// Convert aggregated data to response format
	var days []ActivityDay
	for date, count := range aggregatedActivity {
		if count > 0 {
			days = append(days, ActivityDay{
				Date:  date,
				Count: count,
			})
			totalPosts += count
			if count > maxDayActivity {
				maxDayActivity = count
			}
		}
	}

	activeDays = len(days)

	// Calculate max_periods from earliest post time
	maxPeriods := ac.calculateMaxPeriods(earliestTime, req.PeriodMonths)

	return &ActivityPeriodResponse{
		CategoryID: 0, // ALL_CATEGORIES_ID
		StartDate:  startDate,
		EndDate:    endDate,
		Period:     req.Period,
		Days:       days,
		Stats: PeriodStats{
			TotalPosts:     totalPosts,
			ActiveDays:     activeDays,
			MaxDayActivity: maxDayActivity,
		},
		MaxPeriods: maxPeriods,
	}, nil
}

// RefreshCategory rebuilds activity cache for a specific category
func (ac *ActivityCache) RefreshCategory(categoryID int, posts []PostData) error {
	ac.mutex.Lock()
	defer ac.mutex.Unlock()

	activity := &CategoryActivity{
		CategoryID: categoryID,
		Days:       make(map[string]int),
		Recursive:  make(map[string]int),
		Stats:      ActivityStats{},
		LastUpdate: time.Now().UnixMilli(),
	}

	// Process all posts
	for _, post := range posts {
		date := time.Unix(post.Created/1000, (post.Created%1000)*1000000).UTC().Format("2006-01-02")

		activity.Days[date]++
		activity.Stats.TotalPosts++

		if activity.Stats.FirstPostTime == 0 || post.Created < activity.Stats.FirstPostTime {
			activity.Stats.FirstPostTime = post.Created
		}
		if post.Created > activity.Stats.LastPostTime {
			activity.Stats.LastPostTime = post.Created
		}
	}

	// Count active days
	activity.Stats.TotalActiveDays = len(activity.Days)

	// Initialize recursive data with the same as direct data (will be updated later by buildRecursiveActivity)
	activity.Recursive = make(map[string]int)
	for date, count := range activity.Days {
		activity.Recursive[date] = count
	}
	activity.Stats.RecursivePosts = activity.Stats.TotalPosts
	activity.Stats.RecursiveActiveDays = activity.Stats.TotalActiveDays

	ac.categories[categoryID] = activity
	return nil
}

// PostData represents minimal post data needed for activity calculation
type PostData struct {
	ID         int   `json:"id"`
	CategoryID int   `json:"category_id"`
	Created    int64 `json:"created"`
}

// GetCategoryActivity returns activity data for a specific category
func (ac *ActivityCache) GetCategoryActivity(categoryID int) *CategoryActivity {
	ac.mutex.RLock()
	defer ac.mutex.RUnlock()
	return ac.categories[categoryID]
}

// SetCategoryActivity sets activity data for a specific category (used during initialization)
func (ac *ActivityCache) SetCategoryActivity(categoryID int, activity *CategoryActivity) {
	ac.mutex.Lock()
	defer ac.mutex.Unlock()
	ac.categories[categoryID] = activity
}

// GetCacheStats returns cache statistics for monitoring
func (ac *ActivityCache) GetCacheStats() map[string]interface{} {
	ac.mutex.RLock()
	defer ac.mutex.RUnlock()

	totalDays := 0
	totalPosts := 0
	categoriesCount := len(ac.categories)

	for _, activity := range ac.categories {
		activity.Mutex.RLock()
		totalDays += len(activity.Days)
		totalPosts += activity.Stats.TotalPosts
		activity.Mutex.RUnlock()
	}

	return map[string]interface{}{
		"categories_cached": categoriesCount,
		"total_activity_days": totalDays,
		"total_posts_cached": totalPosts,
		"memory_efficient": true,
	}
}