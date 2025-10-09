package activity

import (
	"backthynk/internal/core/cache"
	"backthynk/internal/core/events"
	"backthynk/internal/core/models"
	"testing"
	"time"
)

func TestServiceBasicFunctionality(t *testing.T) {
	// Test with disabled service
	t.Run("DisabledService", func(t *testing.T) {
		service := &Service{enabled: false}

		// Initialize should succeed but do nothing
		err := service.Initialize()
		if err != nil {
			t.Errorf("Expected no error for disabled service, got %v", err)
		}

		// HandleEvent should succeed but do nothing
		err = service.HandleEvent(events.Event{
			Type: events.PostCreated,
			Data: events.PostEvent{SpaceID: 1, Timestamp: time.Now().Unix() * 1000},
		})
		if err != nil {
			t.Errorf("Expected no error for disabled service, got %v", err)
		}

		// GetActivityPeriod should return empty response
		req := ActivityPeriodRequest{SpaceID: 1, PeriodMonths: 1}
		resp, err := service.GetActivityPeriod(req)
		if err != nil {
			t.Errorf("Expected no error for disabled service, got %v", err)
		}
		if len(resp.Days) != 0 {
			t.Errorf("Expected empty days for disabled service, got %d", len(resp.Days))
		}
	})

	// Test with enabled service
	t.Run("EnabledService", func(t *testing.T) {
		service := &Service{
			enabled:  true,
			activity: make(map[int]*SpaceActivity),
		}

		// Test event handling
		now := time.Now().Unix() * 1000

		// Create a post
		err := service.HandleEvent(events.Event{
			Type: events.PostCreated,
			Data: events.PostEvent{SpaceID: 1, Timestamp: now},
		})
		if err != nil {
			t.Errorf("Expected no error handling PostCreated event, got %v", err)
		}

		// Check activity was recorded
		service.mu.RLock()
		activity, exists := service.activity[1]
		service.mu.RUnlock()

		if !exists {
			t.Fatal("Expected activity to be created for space 1")
		}

		activity.mu.RLock()
		if activity.Stats.TotalPosts != 1 {
			t.Errorf("Expected 1 post, got %d", activity.Stats.TotalPosts)
		}
		if activity.Stats.TotalActiveDays != 1 {
			t.Errorf("Expected 1 active day, got %d", activity.Stats.TotalActiveDays)
		}
		activity.mu.RUnlock()

		// Delete the post
		err = service.HandleEvent(events.Event{
			Type: events.PostDeleted,
			Data: events.PostEvent{SpaceID: 1, Timestamp: now},
		})
		if err != nil {
			t.Errorf("Expected no error handling PostDeleted event, got %v", err)
		}

		// Check activity was updated
		activity.mu.RLock()
		if activity.Stats.TotalPosts != 0 {
			t.Errorf("Expected 0 posts after deletion, got %d", activity.Stats.TotalPosts)
		}
		activity.mu.RUnlock()
	})

	// Test post moved event
	t.Run("PostMoved", func(t *testing.T) {
		service := &Service{
			enabled:  true,
			activity: make(map[int]*SpaceActivity),
		}

		now := time.Now().Unix() * 1000

		// Create a post in space 1
		err := service.HandleEvent(events.Event{
			Type: events.PostCreated,
			Data: events.PostEvent{SpaceID: 1, Timestamp: now},
		})
		if err != nil {
			t.Errorf("Expected no error handling PostCreated event, got %v", err)
		}

		// Move post from space 1 to space 2
		oldSpaceID := 1
		err = service.HandleEvent(events.Event{
			Type: events.PostMoved,
			Data: events.PostEvent{
				SpaceID:    2,
				OldSpaceID: &oldSpaceID,
				Timestamp:     now,
			},
		})
		if err != nil {
			t.Errorf("Expected no error handling PostMoved event, got %v", err)
		}

		// Check old space activity decreased
		service.mu.RLock()
		activity1, exists1 := service.activity[1]
		activity2, exists2 := service.activity[2]
		service.mu.RUnlock()

		if !exists1 {
			t.Fatal("Expected activity for space 1")
		}
		if !exists2 {
			t.Fatal("Expected activity for space 2")
		}

		activity1.mu.RLock()
		if activity1.Stats.TotalPosts != 0 {
			t.Errorf("Expected 0 posts in old space, got %d", activity1.Stats.TotalPosts)
		}
		activity1.mu.RUnlock()

		activity2.mu.RLock()
		if activity2.Stats.TotalPosts != 1 {
			t.Errorf("Expected 1 post in new space, got %d", activity2.Stats.TotalPosts)
		}
		activity2.mu.RUnlock()
	})
}

func TestUpdateActivity(t *testing.T) {
	service := &Service{
		enabled:  true,
		activity: make(map[int]*SpaceActivity),
	}

	now := time.Now().Unix() * 1000

	// Test creating new activity
	service.updateActivity(1, now, 1)

	service.mu.RLock()
	activity, exists := service.activity[1]
	service.mu.RUnlock()

	if !exists {
		t.Fatal("Expected activity to be created")
	}

	activity.mu.RLock()
	if activity.Stats.TotalPosts != 1 {
		t.Errorf("Expected 1 post, got %d", activity.Stats.TotalPosts)
	}
	if activity.Stats.TotalActiveDays != 1 {
		t.Errorf("Expected 1 active day, got %d", activity.Stats.TotalActiveDays)
	}
	activity.mu.RUnlock()

	// Test adding to same day
	service.updateActivity(1, now, 2)

	activity.mu.RLock()
	if activity.Stats.TotalPosts != 3 {
		t.Errorf("Expected 3 posts, got %d", activity.Stats.TotalPosts)
	}
	if activity.Stats.TotalActiveDays != 1 {
		t.Errorf("Expected 1 active day, got %d", activity.Stats.TotalActiveDays)
	}
	activity.mu.RUnlock()

	// Test adding to different day
	tomorrow := now + 86400000 // 1 day later
	service.updateActivity(1, tomorrow, 1)

	activity.mu.RLock()
	if activity.Stats.TotalPosts != 4 {
		t.Errorf("Expected 4 posts, got %d", activity.Stats.TotalPosts)
	}
	if activity.Stats.TotalActiveDays != 2 {
		t.Errorf("Expected 2 active days, got %d", activity.Stats.TotalActiveDays)
	}
	activity.mu.RUnlock()

	// Test decrementing to zero
	service.updateActivity(1, now, -3)

	activity.mu.RLock()
	if activity.Stats.TotalPosts != 1 {
		t.Errorf("Expected 1 post after decrement, got %d", activity.Stats.TotalPosts)
	}
	if activity.Stats.TotalActiveDays != 1 {
		t.Errorf("Expected 1 active day after removing one day, got %d", activity.Stats.TotalActiveDays)
	}

	// Check that the day with zero count was removed
	date := time.Unix(now/1000, 0).Format("2006-01-02")
	if _, exists := activity.Days[date]; exists {
		t.Error("Expected date to be removed when count reaches zero")
	}
	activity.mu.RUnlock()
}

func TestCalculatePeriodDates(t *testing.T) {
	service := &Service{}

	testCases := []struct {
		name         string
		period       int
		periodMonths int
		expectError  bool
	}{
		{
			name:         "Current period",
			period:       0,
			periodMonths: 4,
			expectError:  false,
		},
		{
			name:         "Past period",
			period:       1,
			periodMonths: 6,
			expectError:  false,
		},
		{
			name:         "Far past period",
			period:       5,
			periodMonths: 12,
			expectError:  false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			startDate, endDate := service.calculatePeriodDates(tc.period, tc.periodMonths)

			if startDate == "" || endDate == "" {
				t.Error("Expected non-empty start and end dates")
			}

			// Basic validation that start is before end
			if startDate > endDate {
				t.Errorf("Expected start date %s to be before end date %s", startDate, endDate)
			}

			// Validate date format
			_, err := time.Parse("2006-01-02", startDate)
			if err != nil {
				t.Errorf("Invalid start date format: %v", err)
			}

			_, err = time.Parse("2006-01-02", endDate)
			if err != nil {
				t.Errorf("Invalid end date format: %v", err)
			}
		})
	}
}

func TestCalculateMaxPeriods(t *testing.T) {
	service := &Service{}

	testCases := []struct {
		name          string
		firstPostTime int64
		periodMonths  int
		expectMin     int
	}{
		{
			name:          "No first post",
			firstPostTime: 0,
			periodMonths:  4,
			expectMin:     0,
		},
		{
			name:          "Recent first post",
			firstPostTime: time.Now().AddDate(0, -2, 0).Unix() * 1000,
			periodMonths:  4,
			expectMin:     0,
		},
		{
			name:          "Old first post",
			firstPostTime: time.Now().AddDate(-2, 0, 0).Unix() * 1000,
			periodMonths:  4,
			expectMin:     5, // 24 months / 4 months = 6 periods
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			maxPeriods := service.calculateMaxPeriods(tc.firstPostTime, tc.periodMonths)

			if maxPeriods < tc.expectMin {
				t.Errorf("Expected at least %d max periods, got %d", tc.expectMin, maxPeriods)
			}
		})
	}
}

func TestGetActivityPeriodBasic(t *testing.T) {
	service := &Service{
		enabled:  true,
		activity: make(map[int]*SpaceActivity),
	}

	// Test non-existent space
	req := ActivityPeriodRequest{
		SpaceID:   999,
		PeriodMonths: 1,
	}

	resp, err := service.GetActivityPeriod(req)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if resp.SpaceID != 999 {
		t.Errorf("Expected space ID 999, got %d", resp.SpaceID)
	}

	if len(resp.Days) != 0 {
		t.Errorf("Expected empty days for non-existent space, got %d", len(resp.Days))
	}

	// Test global activity (spaceID = 0)
	req.SpaceID = 0

	resp, err = service.GetActivityPeriod(req)
	if err != nil {
		t.Fatalf("Expected no error for global activity, got %v", err)
	}

	if resp.SpaceID != 0 {
		t.Errorf("Expected space ID 0 for global, got %d", resp.SpaceID)
	}
}

func TestUpdateRecursiveActivity(t *testing.T) {
	service := &Service{
		enabled:  true,
		activity: make(map[int]*SpaceActivity),
	}

	// First create activity using updateActivity
	now := time.Now().Unix() * 1000
	service.updateActivity(1, now, 1)

	date := time.Unix(now/1000, 0).Format("2006-01-02")

	// Now test updateRecursiveActivity
	service.updateRecursiveActivity(1, date, 1, now)

	service.mu.RLock()
	activity, exists := service.activity[1]
	service.mu.RUnlock()

	if !exists {
		t.Fatal("Expected activity to exist")
	}

	activity.mu.RLock()
	if activity.Stats.RecursivePosts != 2 { // 1 from updateActivity + 1 from updateRecursiveActivity
		t.Errorf("Expected 2 recursive posts, got %d", activity.Stats.RecursivePosts)
	}
	if activity.Stats.RecursiveActiveDays != 1 {
		t.Errorf("Expected 1 recursive active day, got %d", activity.Stats.RecursiveActiveDays)
	}

	count, exists := activity.Recursive[date]
	if !exists || count != 2 {
		t.Errorf("Expected recursive count 2 for date %s, got %d", date, count)
	}
	activity.mu.RUnlock()

	// Test decrementing
	service.updateRecursiveActivity(1, date, -1, now)

	activity.mu.RLock()
	if activity.Stats.RecursivePosts != 1 {
		t.Errorf("Expected 1 recursive post after decrement, got %d", activity.Stats.RecursivePosts)
	}
	if activity.Stats.RecursiveActiveDays != 1 {
		t.Errorf("Expected 1 recursive active day after decrement, got %d", activity.Stats.RecursiveActiveDays)
	}

	count, exists = activity.Recursive[date]
	if !exists || count != 1 {
		t.Errorf("Expected recursive count 1 after decrement for date %s, got %d", date, count)
	}
	activity.mu.RUnlock()

	// Test decrementing to zero
	service.updateRecursiveActivity(1, date, -1, now)

	activity.mu.RLock()
	if activity.Stats.RecursivePosts != 0 {
		t.Errorf("Expected 0 recursive posts after final decrement, got %d", activity.Stats.RecursivePosts)
	}
	if activity.Stats.RecursiveActiveDays != 0 {
		t.Errorf("Expected 0 recursive active days after final decrement, got %d", activity.Stats.RecursiveActiveDays)
	}

	if _, exists := activity.Recursive[date]; exists {
		t.Error("Expected date to be removed from recursive when count reaches zero")
	}
	activity.mu.RUnlock()
}

func TestSpaceUpdatedEvent(t *testing.T) {
	service := &Service{
		enabled:  true,
		activity: make(map[int]*SpaceActivity),
		catCache: nil, // Disable cache for simple test
	}

	// Test that SpaceUpdated events are handled without errors
	t.Run("EventHandlingBasic", func(t *testing.T) {
		err := service.HandleEvent(events.Event{
			Type: events.SpaceUpdated,
			Data: events.SpaceEvent{
				SpaceID:  1,
				OldParentID: nil,
				NewParentID: &[]int{2}[0],
			},
		})

		if err != nil {
			t.Errorf("Expected no error handling SpaceUpdated event, got %v", err)
		}
	})

	// Test with cache - just verify the methods are called
	t.Run("EventHandlingWithCache", func(t *testing.T) {
		catCache := cache.NewSpaceCache()

		// Set up a simple hierarchy
		cat1 := &models.Space{ID: 1, Name: "Parent", ParentID: nil}
		cat2 := &models.Space{ID: 2, Name: "Child", ParentID: &[]int{1}[0]}

		catCache.Set(cat1)
		catCache.Set(cat2)

		service.catCache = catCache

		// Create some activity in space 2
		now := time.Now().Unix() * 1000
		service.updateActivity(2, now, 1)

		// Trigger SpaceUpdated event (move space 2 to root)
		err := service.HandleEvent(events.Event{
			Type: events.SpaceUpdated,
			Data: events.SpaceEvent{
				SpaceID:  2,
				OldParentID: &[]int{1}[0],
				NewParentID: nil,
			},
		})

		if err != nil {
			t.Errorf("Expected no error handling SpaceUpdated event with cache, got %v", err)
		}

		// Just verify that activity was recalculated (should not crash)
		service.mu.RLock()
		activity1, exists1 := service.activity[1]
		activity2, exists2 := service.activity[2]
		service.mu.RUnlock()

		if exists1 {
			activity1.mu.RLock()
			t.Logf("Space 1 recursive posts: %d", activity1.Stats.RecursivePosts)
			activity1.mu.RUnlock()
		}

		if exists2 {
			activity2.mu.RLock()
			t.Logf("Space 2 total posts: %d, recursive posts: %d", activity2.Stats.TotalPosts, activity2.Stats.RecursivePosts)
			if activity2.Stats.TotalPosts != 1 {
				t.Errorf("Expected 1 total post in space 2, got %d", activity2.Stats.TotalPosts)
			}
			activity2.mu.RUnlock()
		} else {
			t.Error("Expected space 2 activity to exist")
		}
	})
}

func TestRecursiveModeMaxPeriods(t *testing.T) {
	catCache := cache.NewSpaceCache()

	// Set up a hierarchy: Parent (ID: 1) -> Child (ID: 2)
	parentID := 1
	cat1 := &models.Space{ID: 1, Name: "Parent", ParentID: nil}
	cat2 := &models.Space{ID: 2, Name: "Child", ParentID: &parentID}

	catCache.Set(cat1)
	catCache.Set(cat2)

	service := &Service{
		enabled:  true,
		activity: make(map[int]*SpaceActivity),
		catCache: catCache,
	}

	// Create old post in child space (2 years ago)
	twoYearsAgo := time.Now().AddDate(-2, 0, 0).Unix() * 1000
	service.updateActivity(2, twoYearsAgo, 1)

	// No posts in parent space directly

	// Calculate recursive activity
	service.calculateRecursiveActivity(1)
	service.calculateRecursiveActivity(2)

	// Test non-recursive mode: should have maxPeriods = 0 since parent has no direct posts
	t.Run("NonRecursiveMode", func(t *testing.T) {
		req := ActivityPeriodRequest{
			SpaceID:   1,
			Recursive:    false,
			Period:       0,
			PeriodMonths: 4,
		}

		resp, err := service.GetActivityPeriod(req)
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}

		if resp.MaxPeriods != 0 {
			t.Errorf("Expected maxPeriods = 0 in non-recursive mode (no direct posts), got %d", resp.MaxPeriods)
		}
	})

	// Test recursive mode: should have maxPeriods > 0 since child has old posts
	t.Run("RecursiveMode", func(t *testing.T) {
		req := ActivityPeriodRequest{
			SpaceID:   1,
			Recursive:    true,
			Period:       0,
			PeriodMonths: 4,
		}

		resp, err := service.GetActivityPeriod(req)
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}

		// With posts from 2 years ago and 4-month periods, we should have at least 5 periods
		// (24 months / 4 months = 6 periods, but might be 5 depending on timing)
		if resp.MaxPeriods < 5 {
			t.Errorf("Expected maxPeriods >= 5 in recursive mode (child has 2-year-old posts), got %d", resp.MaxPeriods)
		}

		t.Logf("MaxPeriods in recursive mode: %d", resp.MaxPeriods)
	})

	// Test that we can navigate to past periods in recursive mode
	t.Run("NavigateToPastPeriods", func(t *testing.T) {
		req := ActivityPeriodRequest{
			SpaceID:   1,
			Recursive:    true,
			Period:       -5, // Go back 5 periods
			PeriodMonths: 4,
		}

		resp, err := service.GetActivityPeriod(req)
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}

		// Should return valid response with correct period
		if resp.Period != -5 {
			t.Errorf("Expected period = -5, got %d", resp.Period)
		}

		// Should have valid date range
		if resp.StartDate == "" || resp.EndDate == "" {
			t.Error("Expected non-empty start and end dates")
		}

		t.Logf("Period -5: %s to %s, Days: %d", resp.StartDate, resp.EndDate, len(resp.Days))
	})
}

func TestRecursiveFirstPostTimeTracking(t *testing.T) {
	catCache := cache.NewSpaceCache()

	// Set up hierarchy
	parentID := 1
	cat1 := &models.Space{ID: 1, Name: "Parent", ParentID: nil}
	cat2 := &models.Space{ID: 2, Name: "Child", ParentID: &parentID}

	catCache.Set(cat1)
	catCache.Set(cat2)

	service := &Service{
		enabled:  true,
		activity: make(map[int]*SpaceActivity),
		catCache: catCache,
	}

	// Create posts at different times
	oneYearAgo := time.Now().AddDate(-1, 0, 0).Unix() * 1000
	twoYearsAgo := time.Now().AddDate(-2, 0, 0).Unix() * 1000

	// Parent has a post from 1 year ago
	service.updateActivity(1, oneYearAgo, 1)

	// Child has a post from 2 years ago (older)
	service.updateActivity(2, twoYearsAgo, 1)

	// Calculate recursive activity
	service.calculateRecursiveActivity(2) // Child first
	service.calculateRecursiveActivity(1) // Then parent

	// Check parent's recursive first post time
	service.mu.RLock()
	parentActivity := service.activity[1]
	service.mu.RUnlock()

	parentActivity.mu.RLock()
	defer parentActivity.mu.RUnlock()

	// Parent's direct first post time should be from 1 year ago
	if parentActivity.Stats.FirstPostTime != oneYearAgo {
		t.Errorf("Expected parent direct FirstPostTime = %d, got %d", oneYearAgo, parentActivity.Stats.FirstPostTime)
	}

	// Parent's recursive first post time should be from 2 years ago (from child)
	if parentActivity.Stats.RecursiveFirstPostTime != twoYearsAgo {
		t.Errorf("Expected parent recursive FirstPostTime = %d (from child), got %d", twoYearsAgo, parentActivity.Stats.RecursiveFirstPostTime)
	}

	t.Logf("Parent direct FirstPostTime: %d", parentActivity.Stats.FirstPostTime)
	t.Logf("Parent recursive FirstPostTime: %d", parentActivity.Stats.RecursiveFirstPostTime)
}

func TestIncrementalRecursiveTimestampUpdates(t *testing.T) {
	catCache := cache.NewSpaceCache()

	// Set up hierarchy: grandparent -> parent -> child
	parentID := 2
	grandparentID := 1
	cat1 := &models.Space{ID: 1, Name: "Grandparent", ParentID: nil}
	cat2 := &models.Space{ID: 2, Name: "Parent", ParentID: &grandparentID}
	cat3 := &models.Space{ID: 3, Name: "Child", ParentID: &parentID}

	catCache.Set(cat1)
	catCache.Set(cat2)
	catCache.Set(cat3)

	service := &Service{
		enabled:  true,
		activity: make(map[int]*SpaceActivity),
		catCache: catCache,
	}

	// Define timestamps: oldest to newest
	oldestTime := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC).Unix() * 1000
	middleTime := time.Date(2024, 6, 1, 0, 0, 0, 0, time.UTC).Unix() * 1000
	newestTime := time.Date(2025, 10, 9, 0, 0, 0, 0, time.UTC).Unix() * 1000

	// Step 1: Add middle post to child - this should set initial recursive timestamps
	service.updateActivity(3, middleTime, 1)

	// Verify child has correct timestamps
	childActivity := service.activity[3]
	childActivity.mu.RLock()
	if childActivity.Stats.RecursiveFirstPostTime != middleTime {
		t.Errorf("Child RecursiveFirstPostTime should be %d, got %d", middleTime, childActivity.Stats.RecursiveFirstPostTime)
	}
	if childActivity.Stats.RecursiveLastPostTime != middleTime {
		t.Errorf("Child RecursiveLastPostTime should be %d, got %d", middleTime, childActivity.Stats.RecursiveLastPostTime)
	}
	childActivity.mu.RUnlock()

	// Verify parent inherited child's timestamps
	parentActivity := service.activity[2]
	parentActivity.mu.RLock()
	if parentActivity.Stats.RecursiveFirstPostTime != middleTime {
		t.Errorf("Parent RecursiveFirstPostTime should be %d (from child), got %d", middleTime, parentActivity.Stats.RecursiveFirstPostTime)
	}
	if parentActivity.Stats.RecursiveLastPostTime != middleTime {
		t.Errorf("Parent RecursiveLastPostTime should be %d (from child), got %d", middleTime, parentActivity.Stats.RecursiveLastPostTime)
	}
	parentActivity.mu.RUnlock()

	// Verify grandparent inherited child's timestamps
	grandparentActivity := service.activity[1]
	grandparentActivity.mu.RLock()
	if grandparentActivity.Stats.RecursiveFirstPostTime != middleTime {
		t.Errorf("Grandparent RecursiveFirstPostTime should be %d (from child), got %d", middleTime, grandparentActivity.Stats.RecursiveFirstPostTime)
	}
	if grandparentActivity.Stats.RecursiveLastPostTime != middleTime {
		t.Errorf("Grandparent RecursiveLastPostTime should be %d (from child), got %d", middleTime, grandparentActivity.Stats.RecursiveLastPostTime)
	}
	grandparentActivity.mu.RUnlock()

	// Step 2: Add retroactive post (older) to parent
	service.updateActivity(2, oldestTime, 1)

	// Verify parent's first timestamp moved back
	parentActivity.mu.RLock()
	if parentActivity.Stats.RecursiveFirstPostTime != oldestTime {
		t.Errorf("After retroactive post, Parent RecursiveFirstPostTime should be %d, got %d", oldestTime, parentActivity.Stats.RecursiveFirstPostTime)
	}
	if parentActivity.Stats.RecursiveLastPostTime != middleTime {
		t.Errorf("After retroactive post, Parent RecursiveLastPostTime should still be %d, got %d", middleTime, parentActivity.Stats.RecursiveLastPostTime)
	}
	parentActivity.mu.RUnlock()

	// Verify grandparent's first timestamp also moved back
	grandparentActivity.mu.RLock()
	if grandparentActivity.Stats.RecursiveFirstPostTime != oldestTime {
		t.Errorf("After retroactive post, Grandparent RecursiveFirstPostTime should be %d, got %d", oldestTime, grandparentActivity.Stats.RecursiveFirstPostTime)
	}
	if grandparentActivity.Stats.RecursiveLastPostTime != middleTime {
		t.Errorf("After retroactive post, Grandparent RecursiveLastPostTime should still be %d, got %d", middleTime, grandparentActivity.Stats.RecursiveLastPostTime)
	}
	grandparentActivity.mu.RUnlock()

	// Step 3: Add newest post to grandparent
	service.updateActivity(1, newestTime, 1)

	// Verify grandparent's last timestamp moved forward
	grandparentActivity.mu.RLock()
	if grandparentActivity.Stats.RecursiveFirstPostTime != oldestTime {
		t.Errorf("After newest post, Grandparent RecursiveFirstPostTime should still be %d, got %d", oldestTime, grandparentActivity.Stats.RecursiveFirstPostTime)
	}
	if grandparentActivity.Stats.RecursiveLastPostTime != newestTime {
		t.Errorf("After newest post, Grandparent RecursiveLastPostTime should be %d, got %d", newestTime, grandparentActivity.Stats.RecursiveLastPostTime)
	}
	grandparentActivity.mu.RUnlock()

	// Step 4: Verify maxPeriods calculation uses recursive timestamps correctly
	req := ActivityPeriodRequest{
		SpaceID:      1,
		Recursive:    true,
		Period:       0,
		PeriodMonths: 3,
	}

	response, err := service.GetActivityPeriod(req)
	if err != nil {
		t.Fatalf("GetActivityPeriod failed: %v", err)
	}

	// MaxPeriods should be calculated from oldestTime (not middleTime or newestTime)
	expectedMaxPeriods := service.calculateMaxPeriods(oldestTime, 3)
	if response.MaxPeriods != expectedMaxPeriods {
		t.Errorf("MaxPeriods should be %d (based on oldest time %d), got %d", expectedMaxPeriods, oldestTime, response.MaxPeriods)
	}

	t.Logf("Final state - Grandparent RecursiveFirstPostTime: %d, RecursiveLastPostTime: %d, MaxPeriods: %d",
		grandparentActivity.Stats.RecursiveFirstPostTime,
		grandparentActivity.Stats.RecursiveLastPostTime,
		response.MaxPeriods)
}