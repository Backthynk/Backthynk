package activity

import (
	"backthynk/internal/core/cache"
	"backthynk/internal/core/events"
	"backthynk/internal/storage"
	"log"
	"sync"
	"time"
)

type Service struct {
	db       *storage.DB
	catCache *cache.CategoryCache
	activity map[int]*CategoryActivity // categoryID -> activity
	mu       sync.RWMutex
	enabled  bool
}

type CategoryActivity struct {
	Days      map[string]int // YYYY-MM-DD -> count
	Recursive map[string]int // Recursive activity
	Stats     ActivityStats
	mu        sync.RWMutex
}

type ActivityStats struct {
	TotalPosts          int
	TotalActiveDays     int
	FirstPostTime       int64
	LastPostTime        int64
	RecursivePosts      int
	RecursiveActiveDays int
}


func NewService(db *storage.DB, catCache *cache.CategoryCache, enabled bool) *Service {
	return &Service{
		db:       db,
		catCache: catCache,
		activity: make(map[int]*CategoryActivity),
		enabled:  enabled,
	}
}

func (s *Service) Initialize() error {
	if !s.enabled {
		return nil
	}
	
	log.Println("Initializing activity cache...")
	
	// Load all posts for activity calculation
	posts, err := s.db.GetAllPostsForActivity()
	if err != nil {
		return err
	}
	
	// Group posts by category
	postsByCategory := make(map[int][]storage.PostData)
	for _, post := range posts {
		postsByCategory[post.CategoryID] = append(postsByCategory[post.CategoryID], post)
	}
	
	// Initialize activity for each category
	for catID, posts := range postsByCategory {
		s.refreshCategory(catID, posts)
	}
	
	// Calculate recursive activity
	categories := s.catCache.GetAll()
	for _, cat := range categories {
		s.calculateRecursiveActivity(cat.ID)
	}
	
	log.Println("Activity cache initialized")
	return nil
}

func (s *Service) refreshCategory(categoryID int, posts []storage.PostData) {
	if !s.enabled {
		return
	}
	
	activity := &CategoryActivity{
		Days:      make(map[string]int),
		Recursive: make(map[string]int),
		Stats:     ActivityStats{},
	}
	
	for _, post := range posts {
		date := time.Unix(post.Created/1000, 0).Format("2006-01-02")
		activity.Days[date]++
		activity.Stats.TotalPosts++
		
		if activity.Stats.FirstPostTime == 0 || post.Created < activity.Stats.FirstPostTime {
			activity.Stats.FirstPostTime = post.Created
		}
		if post.Created > activity.Stats.LastPostTime {
			activity.Stats.LastPostTime = post.Created
		}
	}
	
	activity.Stats.TotalActiveDays = len(activity.Days)
	
	// Initialize recursive with direct data
	for date, count := range activity.Days {
		activity.Recursive[date] = count
	}
	activity.Stats.RecursivePosts = activity.Stats.TotalPosts
	activity.Stats.RecursiveActiveDays = activity.Stats.TotalActiveDays
	
	s.mu.Lock()
	s.activity[categoryID] = activity
	s.mu.Unlock()
}

func (s *Service) calculateRecursiveActivity(categoryID int) {
	if !s.enabled {
		return
	}
	
	s.mu.RLock()
	activity, ok := s.activity[categoryID]
	s.mu.RUnlock()
	
	if !ok {
		activity = &CategoryActivity{
			Days:      make(map[string]int),
			Recursive: make(map[string]int),
			Stats:     ActivityStats{},
		}
		s.mu.Lock()
		s.activity[categoryID] = activity
		s.mu.Unlock()
	}
	
	activity.mu.Lock()
	defer activity.mu.Unlock()
	
	// Start with direct activity
	activity.Recursive = make(map[string]int)
	for date, count := range activity.Days {
		activity.Recursive[date] = count
	}
	
	recursivePosts := activity.Stats.TotalPosts
	
	// Add descendant activity
	if s.catCache == nil {
		activity.Stats.RecursivePosts = recursivePosts
		activity.Stats.RecursiveActiveDays = len(activity.Recursive)
		return
	}

	descendants := s.catCache.GetDescendants(categoryID)
	for _, descID := range descendants {
		s.mu.RLock()
		descActivity, ok := s.activity[descID]
		s.mu.RUnlock()
		
		if ok {
			descActivity.mu.RLock()
			for date, count := range descActivity.Days {
				activity.Recursive[date] += count
			}
			recursivePosts += descActivity.Stats.TotalPosts
			descActivity.mu.RUnlock()
		}
	}
	
	activity.Stats.RecursivePosts = recursivePosts
	activity.Stats.RecursiveActiveDays = len(activity.Recursive)
}


func (s *Service) updateActivity(categoryID int, timestamp int64, delta int) {
	date := time.Unix(timestamp/1000, 0).Format("2006-01-02")
	
	s.mu.Lock()
	activity, ok := s.activity[categoryID]
	if !ok {
		activity = &CategoryActivity{
			Days:      make(map[string]int),
			Recursive: make(map[string]int),
			Stats:     ActivityStats{},
		}
		s.activity[categoryID] = activity
	}
	s.mu.Unlock()
	
	activity.mu.Lock()

	// Update direct activity
	oldCount := activity.Days[date]
	newCount := oldCount + delta

	if newCount <= 0 {
		delete(activity.Days, date)
	} else {
		activity.Days[date] = newCount
	}

	// Update stats
	activity.Stats.TotalPosts += delta

	if oldCount == 0 && newCount > 0 {
		activity.Stats.TotalActiveDays++
	} else if oldCount > 0 && newCount <= 0 {
		activity.Stats.TotalActiveDays--
	}

	activity.mu.Unlock()

	// Update recursive for self and parents (after releasing the lock)
	s.updateRecursiveActivity(categoryID, date, delta)
}

func (s *Service) updateRecursiveActivity(categoryID int, date string, delta int) {
	// Update self
	s.mu.RLock()
	activity, ok := s.activity[categoryID]
	s.mu.RUnlock()

	if ok {
		activity.mu.Lock()
		oldCount := activity.Recursive[date]
		newCount := oldCount + delta

		if newCount <= 0 {
			delete(activity.Recursive, date)
		} else {
			activity.Recursive[date] = newCount
		}

		activity.Stats.RecursivePosts += delta

		if oldCount == 0 && newCount > 0 {
			activity.Stats.RecursiveActiveDays++
		} else if oldCount > 0 && newCount <= 0 {
			activity.Stats.RecursiveActiveDays--
		}
		activity.mu.Unlock()
	}

	// Update ancestors by walking up the parent chain
	if s.catCache == nil {
		return
	}

	current := categoryID
	for {
		// Get parent of current category
		cat, ok := s.catCache.Get(current)
		if !ok || cat.ParentID == nil {
			break
		}

		parentID := *cat.ParentID

		s.mu.RLock()
		parentActivity, ok := s.activity[parentID]
		s.mu.RUnlock()

		if ok {
			parentActivity.mu.Lock()
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
			parentActivity.mu.Unlock()
		}

		current = parentID
	}
}

func (s *Service) GetActivityPeriod(req ActivityPeriodRequest) (*ActivityPeriodResponse, error) {
	if !s.enabled {
		return &ActivityPeriodResponse{}, nil
	}
	
	// Handle global activity (categoryID == 0)
	if req.CategoryID == 0 {
		return s.getGlobalActivityPeriod(req)
	}
	
	s.mu.RLock()
	activity, ok := s.activity[req.CategoryID]
	s.mu.RUnlock()
	
	if !ok {
		startDate, endDate := s.calculatePeriodDates(req.Period, req.PeriodMonths)
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
	
	activity.mu.RLock()
	defer activity.mu.RUnlock()
	
	// Calculate period dates
	startDate, endDate := s.calculatePeriodDates(req.Period, req.PeriodMonths)
	if req.StartDate != "" {
		startDate = req.StartDate
	}
	if req.EndDate != "" {
		endDate = req.EndDate
	}
	
	// Get activity data
	var dayData map[string]int
	if req.Recursive {
		dayData = activity.Recursive
	} else {
		dayData = activity.Days
	}
	
	// Filter for period
	days := []ActivityDay{}
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
	
	maxPeriods := s.calculateMaxPeriods(activity.Stats.FirstPostTime, req.PeriodMonths)
	
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

func (s *Service) getGlobalActivityPeriod(req ActivityPeriodRequest) (*ActivityPeriodResponse, error) {
	startDate, endDate := s.calculatePeriodDates(req.Period, req.PeriodMonths)
	if req.StartDate != "" {
		startDate = req.StartDate
	}
	if req.EndDate != "" {
		endDate = req.EndDate
	}
	
	aggregatedActivity := make(map[string]int)
	earliestTime := int64(0)
	
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	for _, activity := range s.activity {
		activity.mu.RLock()
		
		if activity.Stats.FirstPostTime > 0 && (earliestTime == 0 || activity.Stats.FirstPostTime < earliestTime) {
			earliestTime = activity.Stats.FirstPostTime
		}
		
		activityData := activity.Days
		if req.Recursive {
			activityData = activity.Recursive
		}
		
		for date, count := range activityData {
			if date >= startDate && date <= endDate {
				aggregatedActivity[date] += count
			}
		}
		
		activity.mu.RUnlock()
	}
	
	// Convert to response format
	var days []ActivityDay
	stats := PeriodStats{}
	
	for date, count := range aggregatedActivity {
		if count > 0 {
			days = append(days, ActivityDay{
				Date:  date,
				Count: count,
			})
			stats.TotalPosts += count
			if count > stats.MaxDayActivity {
				stats.MaxDayActivity = count
			}
		}
	}
	stats.ActiveDays = len(days)
	
	maxPeriods := s.calculateMaxPeriods(earliestTime, req.PeriodMonths)
	
	return &ActivityPeriodResponse{
		CategoryID: 0,
		StartDate:  startDate,
		EndDate:    endDate,
		Period:     req.Period,
		Days:       days,
		Stats:      stats,
		MaxPeriods: maxPeriods,
	}, nil
}

func (s *Service) calculatePeriodDates(period, periodMonths int) (string, string) {
	now := time.Now().UTC()
	
	if period == 0 {
		end := now
		start := now.AddDate(0, -(periodMonths - 1), 0)
		start = time.Date(start.Year(), start.Month(), 1, 0, 0, 0, 0, time.UTC)
		return start.Format("2006-01-02"), end.Format("2006-01-02")
	}
	
	currentPeriodStart := now.AddDate(0, -(periodMonths - 1), 0)
	currentPeriodStart = time.Date(currentPeriodStart.Year(), currentPeriodStart.Month(), 1, 0, 0, 0, 0, time.UTC)
	periodStart := currentPeriodStart.AddDate(0, periodMonths*period, 0)
	periodEnd := periodStart.AddDate(0, periodMonths, -1)
	
	return periodStart.Format("2006-01-02"), periodEnd.Format("2006-01-02")
}

func (s *Service) calculateMaxPeriods(firstPostTime int64, periodMonths int) int {
	if firstPostTime == 0 {
		return 0
	}
	
	firstPost := time.Unix(firstPostTime/1000, 0).UTC()
	now := time.Now().UTC()
	
	monthsDiff := (now.Year()-firstPost.Year())*12 + int(now.Month()-firstPost.Month())
	return monthsDiff / periodMonths
}

func (s *Service) HandleEvent(event events.Event) error {
	if !s.enabled {
		return nil
	}

	switch event.Type {
	case events.PostCreated:
		data := event.Data.(events.PostEvent)
		s.updateActivity(data.CategoryID, data.Timestamp, 1)

	case events.PostDeleted:
		data := event.Data.(events.PostEvent)
		s.updateActivity(data.CategoryID, data.Timestamp, -1)

	case events.PostMoved:
		data := event.Data.(events.PostEvent)
		if data.OldCategoryID != nil {
			s.updateActivity(*data.OldCategoryID, data.Timestamp, -1)
		}
		s.updateActivity(data.CategoryID, data.Timestamp, 1)

	case events.CategoryUpdated:
		data := event.Data.(events.CategoryEvent)
		s.handleCategoryHierarchyChange(data.CategoryID, data.OldParentID, data.NewParentID)
	}

	return nil
}

func (s *Service) handleCategoryHierarchyChange(categoryID int, oldParentID, newParentID *int) {
	// When a category moves in the hierarchy, we need to recalculate
	// recursive activity for all affected parent categories

	// First, recalculate for all old ancestors
	if oldParentID != nil {
		s.recalculateAncestorActivity(*oldParentID)
	}

	// Then, recalculate for all new ancestors
	if newParentID != nil {
		s.recalculateAncestorActivity(*newParentID)
	}

	// Finally, recalculate for the moved category itself and all its descendants
	s.recalculateDescendantActivity(categoryID)
}

func (s *Service) recalculateAncestorActivity(categoryID int) {
	if s.catCache == nil {
		return
	}

	// Walk up the parent chain and recalculate each ancestor
	current := categoryID
	for {
		s.calculateRecursiveActivity(current)

		// Get parent of current category
		cat, ok := s.catCache.Get(current)
		if !ok || cat.ParentID == nil {
			break
		}

		current = *cat.ParentID
	}
}

func (s *Service) recalculateDescendantActivity(categoryID int) {
	if s.catCache == nil {
		return
	}

	// Recalculate for the category itself
	s.calculateRecursiveActivity(categoryID)

	// Recalculate for all descendants
	descendants := s.catCache.GetDescendants(categoryID)
	for _, descID := range descendants {
		s.calculateRecursiveActivity(descID)
	}
}