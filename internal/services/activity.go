package services

import (
	"backthynk/internal/cache"
	"backthynk/internal/models"
	"backthynk/internal/storage"
	"fmt"
	"log"
	"time"
)

// ActivityService handles activity cache operations with database integration
type ActivityService struct {
	db    *storage.DB
	cache *cache.ActivityCache
}

// NewActivityService creates a new activity service
func NewActivityService(db *storage.DB) *ActivityService {
	return &ActivityService{
		db:    db,
		cache: cache.GetActivityCache(),
	}
}

// InitializeCache builds the activity cache from existing database data
func (s *ActivityService) InitializeCache() error {
	log.Println("Initializing activity cache...")
	start := time.Now()

	// Get all categories to build hierarchy
	categories, err := s.db.GetCategories()
	if err != nil {
		return fmt.Errorf("failed to get categories: %w", err)
	}

	// Build hierarchy map
	hierarchy := make(map[int][]int) // parentID -> []childIDs
	parentMap := make(map[int]int)   // childID -> parentID

	for _, cat := range categories {
		if cat.ParentID != nil {
			hierarchy[*cat.ParentID] = append(hierarchy[*cat.ParentID], cat.ID)
			parentMap[cat.ID] = *cat.ParentID
		}
	}

	// Get all posts for activity calculation
	allPosts, err := s.getAllPostsForCache()
	if err != nil {
		return fmt.Errorf("failed to get posts for cache: %w", err)
	}

	log.Printf("Processing %d posts across %d categories...", len(allPosts), len(categories))

	// Group posts by category
	postsByCategory := make(map[int][]cache.PostData)
	for _, post := range allPosts {
		postsByCategory[post.CategoryID] = append(postsByCategory[post.CategoryID], post)
	}

	// Initialize cache for each category (direct activity only first)
	for _, cat := range categories {
		posts := postsByCategory[cat.ID]
		if err := s.cache.RefreshCategory(cat.ID, posts); err != nil {
			log.Printf("Warning: failed to refresh cache for category %d: %v", cat.ID, err)
		}
	}

	// Build recursive activity data in correct order: deepest children first
	// Sort categories by depth (deepest first) so children are processed before parents
	sortedCategories := make([]models.Category, len(categories))
	copy(sortedCategories, categories)

	// Sort by depth descending (deepest first)
	for i := 0; i < len(sortedCategories)-1; i++ {
		for j := i + 1; j < len(sortedCategories); j++ {
			if sortedCategories[i].Depth < sortedCategories[j].Depth {
				sortedCategories[i], sortedCategories[j] = sortedCategories[j], sortedCategories[i]
			}
		}
	}

	// Build recursive activity in depth order
	for _, cat := range sortedCategories {
		if err := s.buildRecursiveActivity(cat.ID, hierarchy, postsByCategory); err != nil {
			log.Printf("Warning: failed to build recursive activity for category %d: %v", cat.ID, err)
		}
	}

	elapsed := time.Since(start)
	stats := s.cache.GetCacheStats()
	log.Printf("Activity cache initialized in %v. Stats: %+v", elapsed, stats)

	return nil
}

// buildRecursiveActivity builds recursive activity data for a category
func (s *ActivityService) buildRecursiveActivity(categoryID int, hierarchy map[int][]int, postsByCategory map[int][]cache.PostData) error {
	activity := s.cache.GetCategoryActivity(categoryID)
	if activity == nil {
		return fmt.Errorf("category %d not found in cache", categoryID)
	}

	activity.Mutex.Lock()
	defer activity.Mutex.Unlock()

	// Start with direct activity
	activity.Recursive = make(map[string]int)
	for date, count := range activity.Days {
		activity.Recursive[date] = count
	}

	recursivePosts := activity.Stats.TotalPosts
	recursiveActiveDays := len(activity.Days)

	// Add descendant activity
	descendants := s.getDescendants(categoryID, hierarchy)
	for _, descendantID := range descendants {
		descendantActivity := s.cache.GetCategoryActivity(descendantID)
		if descendantActivity != nil {
			descendantActivity.Mutex.RLock()
			for date, count := range descendantActivity.Days {
				activity.Recursive[date] += count
			}
			recursivePosts += descendantActivity.Stats.TotalPosts
			descendantActivity.Mutex.RUnlock()
		}
	}

	// Count unique active days for recursive stats
	recursiveActiveDays = len(activity.Recursive)

	// Update recursive stats
	activity.Stats.RecursivePosts = recursivePosts
	activity.Stats.RecursiveActiveDays = recursiveActiveDays

	return nil
}

// getDescendants returns all descendant category IDs
func (s *ActivityService) getDescendants(categoryID int, hierarchy map[int][]int) []int {
	var descendants []int
	children := hierarchy[categoryID]

	for _, childID := range children {
		descendants = append(descendants, childID)
		// Recursively get grandchildren
		grandchildren := s.getDescendants(childID, hierarchy)
		descendants = append(descendants, grandchildren...)
	}

	return descendants
}

// getAllPostsForCache retrieves minimal post data needed for activity cache
func (s *ActivityService) getAllPostsForCache() ([]cache.PostData, error) {
	query := "SELECT id, category_id, created FROM posts ORDER BY created"
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []cache.PostData
	for rows.Next() {
		var post cache.PostData
		err := rows.Scan(&post.ID, &post.CategoryID, &post.Created)
		if err != nil {
			return nil, fmt.Errorf("failed to scan post: %w", err)
		}
		posts = append(posts, post)
	}

	return posts, nil
}

// OnPostCreated updates the cache when a post is created
func (s *ActivityService) OnPostCreated(categoryID int, timestamp int64) error {
	if err := s.cache.UpdatePostActivity(categoryID, timestamp, 1); err != nil {
		log.Printf("Warning: failed to update activity cache for post creation: %v", err)
	}

	// Update parent categories' recursive activity
	return s.updateParentRecursiveActivity(categoryID, timestamp, 1)
}

// OnPostDeleted updates the cache when a post is deleted
func (s *ActivityService) OnPostDeleted(categoryID int, timestamp int64) error {
	if err := s.cache.UpdatePostActivity(categoryID, timestamp, -1); err != nil {
		log.Printf("Warning: failed to update activity cache for post deletion: %v", err)
	}

	// Update parent categories' recursive activity
	return s.updateParentRecursiveActivity(categoryID, timestamp, -1)
}

// updateParentRecursiveActivity updates recursive activity for parent categories
func (s *ActivityService) updateParentRecursiveActivity(categoryID int, timestamp int64, delta int) error {
	// Get parent category
	query := "SELECT parent_id FROM categories WHERE id = ?"
	var parentID *int
	err := s.db.QueryRow(query, categoryID).Scan(&parentID)
	if err != nil {
		if err.Error() == "sql: no rows in result set" {
			return nil // No parent
		}
		return err
	}

	if parentID == nil {
		return nil // No parent
	}

	// Convert timestamp to date
	date := time.Unix(timestamp/1000, (timestamp%1000)*1000000).UTC().Format("2006-01-02")

	// Update parent's recursive activity
	parentActivity := s.cache.GetCategoryActivity(*parentID)
	if parentActivity != nil {
		parentActivity.Mutex.Lock()
		if parentActivity.Recursive == nil {
			parentActivity.Recursive = make(map[string]int)
		}

		oldCount := parentActivity.Recursive[date]
		newCount := oldCount + delta

		if newCount <= 0 {
			delete(parentActivity.Recursive, date)
		} else {
			parentActivity.Recursive[date] = newCount
		}

		parentActivity.Stats.RecursivePosts += delta
		if oldCount == 0 && newCount > 0 {
			parentActivity.Stats.RecursiveActiveDays++
		} else if oldCount > 0 && newCount <= 0 {
			parentActivity.Stats.RecursiveActiveDays--
		}

		parentActivity.LastUpdate = time.Now().UnixMilli()
		parentActivity.Mutex.Unlock()
	}

	// Recursively update grandparents
	return s.updateParentRecursiveActivity(*parentID, timestamp, delta)
}

// GetActivityPeriod returns activity data for a specific period
func (s *ActivityService) GetActivityPeriod(req cache.ActivityPeriodRequest) (*cache.ActivityPeriodResponse, error) {
	// Set default period months if not specified
	if req.PeriodMonths == 0 {
		req.PeriodMonths = 6
	}

	return s.cache.GetActivityPeriod(req)
}

// RefreshCategoryCache rebuilds cache for a specific category (useful for data consistency)
func (s *ActivityService) RefreshCategoryCache(categoryID int) error {
	// Get all posts for this category
	query := "SELECT id, category_id, created FROM posts WHERE category_id = ? ORDER BY created"
	rows, err := s.db.Query(query, categoryID)
	if err != nil {
		return err
	}
	defer rows.Close()

	var posts []cache.PostData
	for rows.Next() {
		var post cache.PostData
		err := rows.Scan(&post.ID, &post.CategoryID, &post.Created)
		if err != nil {
			return fmt.Errorf("failed to scan post: %w", err)
		}
		posts = append(posts, post)
	}

	return s.cache.RefreshCategory(categoryID, posts)
}

// GetGlobalActivityPeriod returns aggregated activity data across all categories for a specific time period
func (s *ActivityService) GetGlobalActivityPeriod(period int, periodMonths int, startDate string, endDate string) (*cache.ActivityPeriodResponse, error) {
	// Get all categories to aggregate their activity
	categories, err := s.db.GetCategories()
	if err != nil {
		return nil, fmt.Errorf("failed to get categories: %w", err)
	}

	// Build a map to aggregate activity by day
	aggregatedActivity := make(map[string]int)
	totalPosts := 0

	// Process each category
	for _, category := range categories {
		req := cache.ActivityPeriodRequest{
			CategoryID:   category.ID,
			Recursive:    false, // We'll process each category individually
			Period:       period,
			PeriodMonths: periodMonths,
			StartDate:    startDate,
			EndDate:      endDate,
		}

		response, err := s.GetActivityPeriod(req)
		if err != nil {
			// Log error but continue with other categories
			log.Printf("Warning: failed to get activity for category %d: %v", category.ID, err)
			continue
		}

		totalPosts += response.Stats.TotalPosts

		// Aggregate the activity days
		for _, day := range response.Days {
			aggregatedActivity[day.Date] += day.Count
		}
	}

	// Convert aggregated activity back to ActivityDay slice
	var days []cache.ActivityDay
	maxDayActivity := 0
	for date, count := range aggregatedActivity {
		if count > 0 { // Only include days with activity
			days = append(days, cache.ActivityDay{
				Date:  date,
				Count: count,
			})
			if count > maxDayActivity {
				maxDayActivity = count
			}
		}
	}

	// Calculate period dates using the same logic as individual categories
	periodStartDate, periodEndDate := s.calculatePeriodDates(period, periodMonths)
	if startDate != "" {
		periodStartDate = startDate
	}
	if endDate != "" {
		periodEndDate = endDate
	}

	// Create stats
	stats := cache.PeriodStats{
		TotalPosts:     totalPosts,
		ActiveDays:     len(days),
		MaxDayActivity: maxDayActivity,
	}

	return &cache.ActivityPeriodResponse{
		CategoryID: -1, // Special ID for global
		StartDate:  periodStartDate,
		EndDate:    periodEndDate,
		Period:     period,
		Days:       days,
		Stats:      stats,
		MaxPeriods: 0,
	}, nil
}

// calculatePeriodDates calculates start and end dates for a given period
func (s *ActivityService) calculatePeriodDates(period, periodMonths int) (string, string) {
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
