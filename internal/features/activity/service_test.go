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
			Data: events.PostEvent{CategoryID: 1, Timestamp: time.Now().Unix() * 1000},
		})
		if err != nil {
			t.Errorf("Expected no error for disabled service, got %v", err)
		}

		// GetActivityPeriod should return empty response
		req := ActivityPeriodRequest{CategoryID: 1, PeriodMonths: 1}
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
			activity: make(map[int]*CategoryActivity),
		}

		// Test event handling
		now := time.Now().Unix() * 1000

		// Create a post
		err := service.HandleEvent(events.Event{
			Type: events.PostCreated,
			Data: events.PostEvent{CategoryID: 1, Timestamp: now},
		})
		if err != nil {
			t.Errorf("Expected no error handling PostCreated event, got %v", err)
		}

		// Check activity was recorded
		service.mu.RLock()
		activity, exists := service.activity[1]
		service.mu.RUnlock()

		if !exists {
			t.Fatal("Expected activity to be created for category 1")
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
			Data: events.PostEvent{CategoryID: 1, Timestamp: now},
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
			activity: make(map[int]*CategoryActivity),
		}

		now := time.Now().Unix() * 1000

		// Create a post in category 1
		err := service.HandleEvent(events.Event{
			Type: events.PostCreated,
			Data: events.PostEvent{CategoryID: 1, Timestamp: now},
		})
		if err != nil {
			t.Errorf("Expected no error handling PostCreated event, got %v", err)
		}

		// Move post from category 1 to category 2
		oldCategoryID := 1
		err = service.HandleEvent(events.Event{
			Type: events.PostMoved,
			Data: events.PostEvent{
				CategoryID:    2,
				OldCategoryID: &oldCategoryID,
				Timestamp:     now,
			},
		})
		if err != nil {
			t.Errorf("Expected no error handling PostMoved event, got %v", err)
		}

		// Check old category activity decreased
		service.mu.RLock()
		activity1, exists1 := service.activity[1]
		activity2, exists2 := service.activity[2]
		service.mu.RUnlock()

		if !exists1 {
			t.Fatal("Expected activity for category 1")
		}
		if !exists2 {
			t.Fatal("Expected activity for category 2")
		}

		activity1.mu.RLock()
		if activity1.Stats.TotalPosts != 0 {
			t.Errorf("Expected 0 posts in old category, got %d", activity1.Stats.TotalPosts)
		}
		activity1.mu.RUnlock()

		activity2.mu.RLock()
		if activity2.Stats.TotalPosts != 1 {
			t.Errorf("Expected 1 post in new category, got %d", activity2.Stats.TotalPosts)
		}
		activity2.mu.RUnlock()
	})
}

func TestUpdateActivity(t *testing.T) {
	service := &Service{
		enabled:  true,
		activity: make(map[int]*CategoryActivity),
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
		activity: make(map[int]*CategoryActivity),
	}

	// Test non-existent category
	req := ActivityPeriodRequest{
		CategoryID:   999,
		PeriodMonths: 1,
	}

	resp, err := service.GetActivityPeriod(req)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if resp.CategoryID != 999 {
		t.Errorf("Expected category ID 999, got %d", resp.CategoryID)
	}

	if len(resp.Days) != 0 {
		t.Errorf("Expected empty days for non-existent category, got %d", len(resp.Days))
	}

	// Test global activity (categoryID = 0)
	req.CategoryID = 0

	resp, err = service.GetActivityPeriod(req)
	if err != nil {
		t.Fatalf("Expected no error for global activity, got %v", err)
	}

	if resp.CategoryID != 0 {
		t.Errorf("Expected category ID 0 for global, got %d", resp.CategoryID)
	}
}

func TestUpdateRecursiveActivity(t *testing.T) {
	service := &Service{
		enabled:  true,
		activity: make(map[int]*CategoryActivity),
	}

	// First create activity using updateActivity
	now := time.Now().Unix() * 1000
	service.updateActivity(1, now, 1)

	date := time.Unix(now/1000, 0).Format("2006-01-02")

	// Now test updateRecursiveActivity
	service.updateRecursiveActivity(1, date, 1)

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
	service.updateRecursiveActivity(1, date, -1)

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
	service.updateRecursiveActivity(1, date, -1)

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

func TestCategoryUpdatedEvent(t *testing.T) {
	service := &Service{
		enabled:  true,
		activity: make(map[int]*CategoryActivity),
		catCache: nil, // Disable cache for simple test
	}

	// Test that CategoryUpdated events are handled without errors
	t.Run("EventHandlingBasic", func(t *testing.T) {
		err := service.HandleEvent(events.Event{
			Type: events.CategoryUpdated,
			Data: events.CategoryEvent{
				CategoryID:  1,
				OldParentID: nil,
				NewParentID: &[]int{2}[0],
			},
		})

		if err != nil {
			t.Errorf("Expected no error handling CategoryUpdated event, got %v", err)
		}
	})

	// Test with cache - just verify the methods are called
	t.Run("EventHandlingWithCache", func(t *testing.T) {
		catCache := cache.NewCategoryCache()

		// Set up a simple hierarchy
		cat1 := &models.Category{ID: 1, Name: "Parent", ParentID: nil}
		cat2 := &models.Category{ID: 2, Name: "Child", ParentID: &[]int{1}[0]}

		catCache.Set(cat1)
		catCache.Set(cat2)

		service.catCache = catCache

		// Create some activity in category 2
		now := time.Now().Unix() * 1000
		service.updateActivity(2, now, 1)

		// Trigger CategoryUpdated event (move category 2 to root)
		err := service.HandleEvent(events.Event{
			Type: events.CategoryUpdated,
			Data: events.CategoryEvent{
				CategoryID:  2,
				OldParentID: &[]int{1}[0],
				NewParentID: nil,
			},
		})

		if err != nil {
			t.Errorf("Expected no error handling CategoryUpdated event with cache, got %v", err)
		}

		// Just verify that activity was recalculated (should not crash)
		service.mu.RLock()
		activity1, exists1 := service.activity[1]
		activity2, exists2 := service.activity[2]
		service.mu.RUnlock()

		if exists1 {
			activity1.mu.RLock()
			t.Logf("Category 1 recursive posts: %d", activity1.Stats.RecursivePosts)
			activity1.mu.RUnlock()
		}

		if exists2 {
			activity2.mu.RLock()
			t.Logf("Category 2 total posts: %d, recursive posts: %d", activity2.Stats.TotalPosts, activity2.Stats.RecursivePosts)
			if activity2.Stats.TotalPosts != 1 {
				t.Errorf("Expected 1 total post in category 2, got %d", activity2.Stats.TotalPosts)
			}
			activity2.mu.RUnlock()
		} else {
			t.Error("Expected category 2 activity to exist")
		}
	})
}