package activity

import (
	"backthynk/internal/core/cache"
	"backthynk/internal/core/events"
	"backthynk/internal/storage"
	"sync"
	"time"
)

type Service struct {
	db       *storage.DB
	catCache *cache.SpaceCache
	activity map[int]*SpaceActivity // spaceID -> activity
	mu       sync.RWMutex
	enabled  bool
}

type SpaceActivity struct {
	Days       map[string]int     // YYYY-MM-DD -> count
	Recursive  map[string]int     // Recursive activity
	Timestamps map[string][]int64 // YYYY-MM-DD -> list of timestamps for that day
	Stats      ActivityStats
	mu         sync.RWMutex
}

type ActivityStats struct {
	TotalPosts              int
	TotalActiveDays         int
	FirstPostTime           int64
	LastPostTime            int64
	RecursivePosts          int
	RecursiveActiveDays     int
	RecursiveFirstPostTime  int64
	RecursiveLastPostTime   int64
}


func NewService(db *storage.DB, catCache *cache.SpaceCache, enabled bool) *Service {
	return &Service{
		db:       db,
		catCache: catCache,
		activity: make(map[int]*SpaceActivity),
		enabled:  enabled,
	}
}

func (s *Service) Initialize() error {
	if !s.enabled {
		return nil
	}

	// Load all posts for activity calculation
	posts, err := s.db.GetAllPostsHeader()
	if err != nil {
		return err
	}
	
	// Group posts by space
	postsBySpace := make(map[int][]storage.PostData)
	for _, post := range posts {
		postsBySpace[post.SpaceID] = append(postsBySpace[post.SpaceID], post)
	}
	
	// Initialize activity for each space
	for catID, posts := range postsBySpace {
		s.refreshSpace(catID, posts)
	}
	
	// Calculate recursive activity
	spaces := s.catCache.GetAll()
	for _, cat := range spaces {
		s.calculateRecursiveActivity(cat.ID)
	}

	return nil
}

func (s *Service) refreshSpace(spaceID int, posts []storage.PostData) {
	if !s.enabled {
		return
	}

	activity := &SpaceActivity{
		Days:       make(map[string]int),
		Recursive:  make(map[string]int),
		Timestamps: make(map[string][]int64),
		Stats:      ActivityStats{},
	}

	for _, post := range posts {
		date := time.Unix(post.Created/1000, 0).Format("2006-01-02")
		activity.Days[date]++
		activity.Timestamps[date] = append(activity.Timestamps[date], post.Created)
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
	s.activity[spaceID] = activity
	s.mu.Unlock()
}

func (s *Service) calculateRecursiveActivity(spaceID int) {
	if !s.enabled {
		return
	}

	s.mu.RLock()
	activity, ok := s.activity[spaceID]
	s.mu.RUnlock()

	if !ok {
		activity = &SpaceActivity{
			Days:       make(map[string]int),
			Recursive:  make(map[string]int),
			Timestamps: make(map[string][]int64),
			Stats:      ActivityStats{},
		}
		s.mu.Lock()
		s.activity[spaceID] = activity
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
	recursiveFirstPostTime := activity.Stats.FirstPostTime
	recursiveLastPostTime := activity.Stats.LastPostTime

	// Add descendant activity
	if s.catCache == nil {
		activity.Stats.RecursivePosts = recursivePosts
		activity.Stats.RecursiveActiveDays = len(activity.Recursive)
		activity.Stats.RecursiveFirstPostTime = recursiveFirstPostTime
		activity.Stats.RecursiveLastPostTime = recursiveLastPostTime
		return
	}

	descendants := s.catCache.GetDescendants(spaceID)
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

			// Track earliest and latest post times
			if descActivity.Stats.FirstPostTime > 0 {
				if recursiveFirstPostTime == 0 || descActivity.Stats.FirstPostTime < recursiveFirstPostTime {
					recursiveFirstPostTime = descActivity.Stats.FirstPostTime
				}
			}
			if descActivity.Stats.LastPostTime > 0 {
				if recursiveLastPostTime == 0 || descActivity.Stats.LastPostTime > recursiveLastPostTime {
					recursiveLastPostTime = descActivity.Stats.LastPostTime
				}
			}

			descActivity.mu.RUnlock()
		}
	}

	activity.Stats.RecursivePosts = recursivePosts
	activity.Stats.RecursiveActiveDays = len(activity.Recursive)
	activity.Stats.RecursiveFirstPostTime = recursiveFirstPostTime
	activity.Stats.RecursiveLastPostTime = recursiveLastPostTime
}


func (s *Service) updateActivity(spaceID int, timestamp int64, delta int) {
	date := time.Unix(timestamp/1000, 0).Format("2006-01-02")

	s.mu.Lock()
	activity, ok := s.activity[spaceID]
	if !ok {
		activity = &SpaceActivity{
			Days:       make(map[string]int),
			Recursive:  make(map[string]int),
			Timestamps: make(map[string][]int64),
			Stats:      ActivityStats{},
		}
		s.activity[spaceID] = activity
	}
	s.mu.Unlock()

	activity.mu.Lock()

	// Update direct activity
	oldCount := activity.Days[date]
	newCount := oldCount + delta

	if newCount <= 0 {
		delete(activity.Days, date)
		delete(activity.Timestamps, date)
	} else {
		activity.Days[date] = newCount
	}

	// Update timestamp tracking
	if delta > 0 {
		// Adding posts
		for i := 0; i < delta; i++ {
			activity.Timestamps[date] = append(activity.Timestamps[date], timestamp)
		}
	} else if delta < 0 {
		// Removing posts
		timestamps := activity.Timestamps[date]
		// Remove matching timestamps (most recent occurrences)
		toRemove := -delta
		for i := len(timestamps) - 1; i >= 0 && toRemove > 0; i-- {
			if timestamps[i] == timestamp {
				timestamps = append(timestamps[:i], timestamps[i+1:]...)
				toRemove--
			}
		}
		// If no exact matches found, remove the last ones
		for toRemove > 0 && len(timestamps) > 0 {
			timestamps = timestamps[:len(timestamps)-1]
			toRemove--
		}
		if len(timestamps) > 0 {
			activity.Timestamps[date] = timestamps
		} else {
			delete(activity.Timestamps, date)
		}
	}

	// Update stats
	activity.Stats.TotalPosts += delta

	if oldCount == 0 && newCount > 0 {
		activity.Stats.TotalActiveDays++
	} else if oldCount > 0 && newCount <= 0 {
		activity.Stats.TotalActiveDays--
	}

	// Recalculate FirstPostTime and LastPostTime from all timestamps
	activity.Stats.FirstPostTime = 0
	activity.Stats.LastPostTime = 0

	for _, timestamps := range activity.Timestamps {
		for _, ts := range timestamps {
			if activity.Stats.FirstPostTime == 0 || ts < activity.Stats.FirstPostTime {
				activity.Stats.FirstPostTime = ts
			}
			if ts > activity.Stats.LastPostTime {
				activity.Stats.LastPostTime = ts
			}
		}
	}

	activity.mu.Unlock()

	// Update recursive for self and parents (after releasing the lock)
	s.updateRecursiveActivity(spaceID, date, delta, timestamp)
}

// updateRecursiveActivity updates recursive activity stats for a space and all its ancestors.
// It performs incremental updates to avoid full recalculation on every post addition/deletion.
// The timestamp parameter is used to efficiently update RecursiveFirstPostTime and RecursiveLastPostTime
// without needing to scan all descendant posts.
func (s *Service) updateRecursiveActivity(spaceID int, date string, delta int, timestamp int64) {
	// Update self
	s.mu.RLock()
	activity, ok := s.activity[spaceID]
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

		// Update recursive timestamp boundaries incrementally
		if delta > 0 && timestamp > 0 {
			// Adding posts - expand boundaries if needed
			if activity.Stats.RecursiveFirstPostTime == 0 || timestamp < activity.Stats.RecursiveFirstPostTime {
				activity.Stats.RecursiveFirstPostTime = timestamp
			}
			if timestamp > activity.Stats.RecursiveLastPostTime {
				activity.Stats.RecursiveLastPostTime = timestamp
			}
		}

		activity.mu.Unlock()
	}

	// Update ancestors by walking up the parent chain
	if s.catCache == nil {
		return
	}

	current := spaceID
	for {
		// Get parent of current space
		cat, ok := s.catCache.Get(current)
		if !ok || cat.ParentID == nil {
			break
		}

		parentID := *cat.ParentID

		s.mu.Lock()
		parentActivity, ok := s.activity[parentID]
		if !ok {
			// Create activity record for parent if it doesn't exist
			parentActivity = &SpaceActivity{
				Days:       make(map[string]int),
				Recursive:  make(map[string]int),
				Timestamps: make(map[string][]int64),
				Stats:      ActivityStats{},
			}
			s.activity[parentID] = parentActivity
		}
		s.mu.Unlock()

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

		// Update recursive timestamp boundaries incrementally
		if delta > 0 && timestamp > 0 {
			// Adding posts - expand boundaries if needed
			if parentActivity.Stats.RecursiveFirstPostTime == 0 || timestamp < parentActivity.Stats.RecursiveFirstPostTime {
				parentActivity.Stats.RecursiveFirstPostTime = timestamp
			}
			if timestamp > parentActivity.Stats.RecursiveLastPostTime {
				parentActivity.Stats.RecursiveLastPostTime = timestamp
			}
		}

		parentActivity.mu.Unlock()

		current = parentID
	}
}

func (s *Service) GetActivityPeriod(req ActivityPeriodRequest) (*ActivityPeriodResponse, error) {
	if !s.enabled {
		return &ActivityPeriodResponse{}, nil
	}
	
	// Handle global activity (spaceID == 0)
	if req.SpaceID == 0 {
		return s.getGlobalActivityPeriod(req)
	}
	
	s.mu.RLock()
	activity, ok := s.activity[req.SpaceID]
	s.mu.RUnlock()
	
	if !ok {
		startDate, endDate := s.calculatePeriodDates(req.Period, req.PeriodMonths)
		return &ActivityPeriodResponse{
			SpaceID: req.SpaceID,
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

	// Use recursive first post time when in recursive mode
	firstPostTime := activity.Stats.FirstPostTime
	if req.Recursive && activity.Stats.RecursiveFirstPostTime > 0 {
		firstPostTime = activity.Stats.RecursiveFirstPostTime
	}
	maxPeriods := s.calculateMaxPeriods(firstPostTime, req.PeriodMonths)

	return &ActivityPeriodResponse{
		SpaceID: req.SpaceID,
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
		SpaceID: 0,
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
		s.updateActivity(data.SpaceID, data.Timestamp, 1)

	case events.PostDeleted:
		data := event.Data.(events.PostEvent)
		s.updateActivity(data.SpaceID, data.Timestamp, -1)

	case events.PostMoved:
		data := event.Data.(events.PostEvent)
		if data.OldSpaceID != nil {
			s.updateActivity(*data.OldSpaceID, data.Timestamp, -1)
		}
		s.updateActivity(data.SpaceID, data.Timestamp, 1)

	case events.SpaceUpdated:
		data := event.Data.(events.SpaceEvent)
		s.handleSpaceHierarchyChange(data.SpaceID, data.OldParentID, data.NewParentID)
	}

	return nil
}

func (s *Service) handleSpaceHierarchyChange(spaceID int, oldParentID, newParentID *int) {
	// When a space moves in the hierarchy, we need to recalculate
	// recursive activity for all affected parent spaces

	// First, recalculate for all old ancestors
	if oldParentID != nil {
		s.recalculateAncestorActivity(*oldParentID)
	}

	// Then, recalculate for all new ancestors
	if newParentID != nil {
		s.recalculateAncestorActivity(*newParentID)
	}

	// Finally, recalculate for the moved space itself and all its descendants
	s.recalculateDescendantActivity(spaceID)
}

func (s *Service) recalculateAncestorActivity(spaceID int) {
	if s.catCache == nil {
		return
	}

	// Walk up the parent chain and recalculate each ancestor
	current := spaceID
	for {
		s.calculateRecursiveActivity(current)

		// Get parent of current space
		cat, ok := s.catCache.Get(current)
		if !ok || cat.ParentID == nil {
			break
		}

		current = *cat.ParentID
	}
}

func (s *Service) recalculateDescendantActivity(spaceID int) {
	if s.catCache == nil {
		return
	}

	// Recalculate for the space itself
	s.calculateRecursiveActivity(spaceID)

	// Recalculate for all descendants
	descendants := s.catCache.GetDescendants(spaceID)
	for _, descID := range descendants {
		s.calculateRecursiveActivity(descID)
	}
}