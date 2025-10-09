package activity

import (
	"backthynk/internal/core/cache"
	"backthynk/internal/core/events"
	"backthynk/internal/core/models"
	"backthynk/internal/storage"
	"testing"
	"time"
)

// TestFirstLastPostTimeOnCreate tests that FirstPostTime and LastPostTime
// are correctly maintained when creating posts
func TestFirstLastPostTimeOnCreate(t *testing.T) {
	service := &Service{
		enabled:  true,
		activity: make(map[int]*SpaceActivity),
	}

	now := time.Now().Unix() * 1000
	yesterday := now - 86400000 // 1 day ago
	tomorrow := now + 86400000  // 1 day in future

	// Create first post (middle timestamp)
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{SpaceID: 1, Timestamp: now},
	})

	service.mu.RLock()
	activity := service.activity[1]
	service.mu.RUnlock()

	activity.mu.RLock()
	if activity.Stats.FirstPostTime != now {
		t.Errorf("Expected FirstPostTime %d, got %d", now, activity.Stats.FirstPostTime)
	}
	if activity.Stats.LastPostTime != now {
		t.Errorf("Expected LastPostTime %d, got %d", now, activity.Stats.LastPostTime)
	}
	activity.mu.RUnlock()

	// Create retroactive post (should update FirstPostTime)
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{SpaceID: 1, Timestamp: yesterday},
	})

	activity.mu.RLock()
	if activity.Stats.FirstPostTime != yesterday {
		t.Errorf("Expected FirstPostTime to update to %d (yesterday), got %d", yesterday, activity.Stats.FirstPostTime)
	}
	if activity.Stats.LastPostTime != now {
		t.Errorf("Expected LastPostTime to remain %d, got %d", now, activity.Stats.LastPostTime)
	}
	activity.mu.RUnlock()

	// Create future post (should update LastPostTime)
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{SpaceID: 1, Timestamp: tomorrow},
	})

	activity.mu.RLock()
	if activity.Stats.FirstPostTime != yesterday {
		t.Errorf("Expected FirstPostTime to remain %d (yesterday), got %d", yesterday, activity.Stats.FirstPostTime)
	}
	if activity.Stats.LastPostTime != tomorrow {
		t.Errorf("Expected LastPostTime to update to %d (tomorrow), got %d", tomorrow, activity.Stats.LastPostTime)
	}
	activity.mu.RUnlock()
}

// TestFirstLastPostTimeOnDelete tests that FirstPostTime and LastPostTime
// are correctly recalculated when deleting posts
func TestFirstLastPostTimeOnDelete(t *testing.T) {
	service := &Service{
		enabled:  true,
		activity: make(map[int]*SpaceActivity),
	}

	day1 := time.Now().AddDate(0, 0, -3).Unix() * 1000 // 3 days ago
	day2 := time.Now().AddDate(0, 0, -2).Unix() * 1000 // 2 days ago
	day3 := time.Now().AddDate(0, 0, -1).Unix() * 1000 // yesterday

	// Create 3 posts
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{SpaceID: 1, Timestamp: day2},
	})
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{SpaceID: 1, Timestamp: day1},
	})
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{SpaceID: 1, Timestamp: day3},
	})

	service.mu.RLock()
	activity := service.activity[1]
	service.mu.RUnlock()

	activity.mu.RLock()
	if activity.Stats.FirstPostTime != day1 {
		t.Errorf("Expected FirstPostTime %d, got %d", day1, activity.Stats.FirstPostTime)
	}
	if activity.Stats.LastPostTime != day3 {
		t.Errorf("Expected LastPostTime %d, got %d", day3, activity.Stats.LastPostTime)
	}
	if activity.Stats.TotalPosts != 3 {
		t.Errorf("Expected 3 total posts, got %d", activity.Stats.TotalPosts)
	}
	activity.mu.RUnlock()

	// Delete the oldest post (should update FirstPostTime)
	service.HandleEvent(events.Event{
		Type: events.PostDeleted,
		Data: events.PostEvent{SpaceID: 1, Timestamp: day1},
	})

	activity.mu.RLock()
	if activity.Stats.FirstPostTime != day2 {
		t.Errorf("After deleting oldest, expected FirstPostTime %d, got %d", day2, activity.Stats.FirstPostTime)
	}
	if activity.Stats.LastPostTime != day3 {
		t.Errorf("Expected LastPostTime to remain %d, got %d", day3, activity.Stats.LastPostTime)
	}
	if activity.Stats.TotalPosts != 2 {
		t.Errorf("Expected 2 total posts, got %d", activity.Stats.TotalPosts)
	}
	activity.mu.RUnlock()

	// Delete the newest post (should update LastPostTime)
	service.HandleEvent(events.Event{
		Type: events.PostDeleted,
		Data: events.PostEvent{SpaceID: 1, Timestamp: day3},
	})

	activity.mu.RLock()
	if activity.Stats.FirstPostTime != day2 {
		t.Errorf("Expected FirstPostTime to remain %d, got %d", day2, activity.Stats.FirstPostTime)
	}
	if activity.Stats.LastPostTime != day2 {
		t.Errorf("After deleting newest, expected LastPostTime %d, got %d", day2, activity.Stats.LastPostTime)
	}
	if activity.Stats.TotalPosts != 1 {
		t.Errorf("Expected 1 total post, got %d", activity.Stats.TotalPosts)
	}
	activity.mu.RUnlock()

	// Delete the last post (should reset both to 0)
	service.HandleEvent(events.Event{
		Type: events.PostDeleted,
		Data: events.PostEvent{SpaceID: 1, Timestamp: day2},
	})

	activity.mu.RLock()
	if activity.Stats.FirstPostTime != 0 {
		t.Errorf("After deleting all posts, expected FirstPostTime 0, got %d", activity.Stats.FirstPostTime)
	}
	if activity.Stats.LastPostTime != 0 {
		t.Errorf("After deleting all posts, expected LastPostTime 0, got %d", activity.Stats.LastPostTime)
	}
	if activity.Stats.TotalPosts != 0 {
		t.Errorf("Expected 0 total posts, got %d", activity.Stats.TotalPosts)
	}
	activity.mu.RUnlock()
}

// TestFirstLastPostTimeOnMove tests that FirstPostTime and LastPostTime
// are correctly updated when moving posts between spaces
func TestFirstLastPostTimeOnMove(t *testing.T) {
	service := &Service{
		enabled:  true,
		activity: make(map[int]*SpaceActivity),
	}

	day1 := time.Now().AddDate(0, 0, -3).Unix() * 1000
	day2 := time.Now().AddDate(0, 0, -2).Unix() * 1000
	day3 := time.Now().AddDate(0, 0, -1).Unix() * 1000

	// Create posts in space 1
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{SpaceID: 1, Timestamp: day1},
	})
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{SpaceID: 1, Timestamp: day3},
	})

	// Move the oldest post to space 2
	oldCat := 1
	service.HandleEvent(events.Event{
		Type: events.PostMoved,
		Data: events.PostEvent{
			SpaceID:    2,
			OldSpaceID: &oldCat,
			Timestamp:     day1,
		},
	})

	service.mu.RLock()
	activity1 := service.activity[1]
	activity2 := service.activity[2]
	service.mu.RUnlock()

	// Space 1 should now have only day3 post
	activity1.mu.RLock()
	if activity1.Stats.FirstPostTime != day3 {
		t.Errorf("Space 1: expected FirstPostTime %d, got %d", day3, activity1.Stats.FirstPostTime)
	}
	if activity1.Stats.LastPostTime != day3 {
		t.Errorf("Space 1: expected LastPostTime %d, got %d", day3, activity1.Stats.LastPostTime)
	}
	if activity1.Stats.TotalPosts != 1 {
		t.Errorf("Space 1: expected 1 post, got %d", activity1.Stats.TotalPosts)
	}
	activity1.mu.RUnlock()

	// Space 2 should now have only day1 post
	activity2.mu.RLock()
	if activity2.Stats.FirstPostTime != day1 {
		t.Errorf("Space 2: expected FirstPostTime %d, got %d", day1, activity2.Stats.FirstPostTime)
	}
	if activity2.Stats.LastPostTime != day1 {
		t.Errorf("Space 2: expected LastPostTime %d, got %d", day1, activity2.Stats.LastPostTime)
	}
	if activity2.Stats.TotalPosts != 1 {
		t.Errorf("Space 2: expected 1 post, got %d", activity2.Stats.TotalPosts)
	}
	activity2.mu.RUnlock()

	// Add a middle post to space 2
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{SpaceID: 2, Timestamp: day2},
	})

	activity2.mu.RLock()
	if activity2.Stats.FirstPostTime != day1 {
		t.Errorf("Space 2: expected FirstPostTime %d, got %d", day1, activity2.Stats.FirstPostTime)
	}
	if activity2.Stats.LastPostTime != day2 {
		t.Errorf("Space 2: expected LastPostTime %d, got %d", day2, activity2.Stats.LastPostTime)
	}
	if activity2.Stats.TotalPosts != 2 {
		t.Errorf("Space 2: expected 2 posts, got %d", activity2.Stats.TotalPosts)
	}
	activity2.mu.RUnlock()
}

// TestRefreshSpaceCorrectness tests that refreshSpace properly initializes
// FirstPostTime and LastPostTime from a list of posts
func TestRefreshSpaceCorrectness(t *testing.T) {
	db := &storage.DB{} // Mock DB, not used in this test
	catCache := cache.NewSpaceCache()
	service := NewService(db, catCache, true)

	day1 := time.Now().AddDate(0, 0, -5).Unix() * 1000
	day2 := time.Now().AddDate(0, 0, -3).Unix() * 1000
	day3 := time.Now().AddDate(0, 0, -1).Unix() * 1000

	posts := []storage.PostData{
		{SpaceID: 1, Created: day2},
		{SpaceID: 1, Created: day1}, // oldest
		{SpaceID: 1, Created: day3}, // newest
	}

	service.refreshSpace(1, posts)

	service.mu.RLock()
	activity, ok := service.activity[1]
	service.mu.RUnlock()

	if !ok {
		t.Fatal("Expected activity to be created")
	}

	activity.mu.RLock()
	defer activity.mu.RUnlock()

	if activity.Stats.FirstPostTime != day1 {
		t.Errorf("Expected FirstPostTime %d (oldest), got %d", day1, activity.Stats.FirstPostTime)
	}
	if activity.Stats.LastPostTime != day3 {
		t.Errorf("Expected LastPostTime %d (newest), got %d", day3, activity.Stats.LastPostTime)
	}
	if activity.Stats.TotalPosts != 3 {
		t.Errorf("Expected 3 posts, got %d", activity.Stats.TotalPosts)
	}
}

// TestRecursiveStatsWithTimestamps tests that recursive stats don't break
// when timestamps are being tracked
func TestRecursiveStatsWithTimestamps(t *testing.T) {
	db := &storage.DB{}
	catCache := cache.NewSpaceCache()

	parent := &models.Space{ID: 1, Name: "Parent", ParentID: nil}
	child := &models.Space{ID: 2, Name: "Child", ParentID: &[]int{1}[0]}

	catCache.Set(parent)
	catCache.Set(child)

	service := NewService(db, catCache, true)

	day1 := time.Now().AddDate(0, 0, -3).Unix() * 1000
	day2 := time.Now().AddDate(0, 0, -1).Unix() * 1000

	// Create post in parent
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{SpaceID: 1, Timestamp: day2},
	})

	// Create post in child
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{SpaceID: 2, Timestamp: day1},
	})

	// Recalculate recursive activity
	service.calculateRecursiveActivity(1)

	service.mu.RLock()
	parentActivity := service.activity[1]
	service.mu.RUnlock()

	parentActivity.mu.RLock()
	defer parentActivity.mu.RUnlock()

	// Parent should have 1 direct post
	if parentActivity.Stats.TotalPosts != 1 {
		t.Errorf("Expected parent to have 1 direct post, got %d", parentActivity.Stats.TotalPosts)
	}

	// Parent should have 2 recursive posts
	if parentActivity.Stats.RecursivePosts != 2 {
		t.Errorf("Expected parent to have 2 recursive posts, got %d", parentActivity.Stats.RecursivePosts)
	}
}
