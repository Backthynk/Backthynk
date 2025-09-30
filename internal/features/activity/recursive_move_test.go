package activity

import (
	"backthynk/internal/core/cache"
	"backthynk/internal/core/events"
	"backthynk/internal/core/models"
	"testing"
	"time"
)

func TestPostMoveRecursiveParentActivityUpdate(t *testing.T) {
	// Setup cache with hierarchy: Parent -> Child -> Grandchild
	catCache := cache.NewCategoryCache()

	parent := &models.Category{ID: 1, Name: "Parent", ParentID: nil}
	child := &models.Category{ID: 2, Name: "Child", ParentID: &[]int{1}[0]}
	grandchild := &models.Category{ID: 3, Name: "Grandchild", ParentID: &[]int{2}[0]}
	anotherParent := &models.Category{ID: 4, Name: "AnotherParent", ParentID: nil}

	catCache.Set(parent)
	catCache.Set(child)
	catCache.Set(grandchild)
	catCache.Set(anotherParent)

	service := &Service{
		enabled:  true,
		activity: make(map[int]*CategoryActivity),
		catCache: catCache,
	}

	now := time.Now().Unix() * 1000

	// Test Case 1: Move post from grandchild to anotherParent
	// This should update recursive activity for parent and child categories
	t.Run("MoveFromGrandchildToAnotherParent", func(t *testing.T) {
		// Create initial post in grandchild using PostCreated event
		err := service.HandleEvent(events.Event{
			Type: events.PostCreated,
			Data: events.PostEvent{
				PostID:     1,
				CategoryID: grandchild.ID,
				Timestamp:  now,
			},
		})
		if err != nil {
			t.Fatalf("Expected no error handling PostCreated event, got %v", err)
		}

		// Verify initial recursive activity propagated up the hierarchy
		service.mu.RLock()
		parentActivity, parentExists := service.activity[parent.ID]
		childActivity, childExists := service.activity[child.ID]
		grandchildActivity, grandchildExists := service.activity[grandchild.ID]
		service.mu.RUnlock()

		if !parentExists || !childExists || !grandchildExists {
			t.Fatal("Expected activities to be created for all categories in hierarchy")
		}

		// Check initial state - all ancestors should have recursive activity
		parentActivity.mu.RLock()
		if parentActivity.Stats.RecursivePosts != 1 {
			t.Errorf("Expected parent to have 1 recursive post initially, got %d", parentActivity.Stats.RecursivePosts)
		}
		parentActivity.mu.RUnlock()

		childActivity.mu.RLock()
		if childActivity.Stats.RecursivePosts != 1 {
			t.Errorf("Expected child to have 1 recursive post initially, got %d", childActivity.Stats.RecursivePosts)
		}
		childActivity.mu.RUnlock()

		grandchildActivity.mu.RLock()
		if grandchildActivity.Stats.TotalPosts != 1 {
			t.Errorf("Expected grandchild to have 1 total post initially, got %d", grandchildActivity.Stats.TotalPosts)
		}
		grandchildActivity.mu.RUnlock()

		// Simulate post move: from grandchild to anotherParent
		oldCategoryID := grandchild.ID
		err = service.HandleEvent(events.Event{
			Type: events.PostMoved,
			Data: events.PostEvent{
				PostID:        1,
				CategoryID:    anotherParent.ID,
				OldCategoryID: &oldCategoryID,
				Timestamp:     now,
			},
		})

		if err != nil {
			t.Fatalf("Expected no error handling PostMoved event, got %v", err)
		}

		// Verify activity was removed from the old hierarchy
		parentActivity.mu.RLock()
		if parentActivity.Stats.RecursivePosts != 0 {
			t.Errorf("Expected parent to have 0 recursive posts after move, got %d", parentActivity.Stats.RecursivePosts)
		}
		parentActivity.mu.RUnlock()

		childActivity.mu.RLock()
		if childActivity.Stats.RecursivePosts != 0 {
			t.Errorf("Expected child to have 0 recursive posts after move, got %d", childActivity.Stats.RecursivePosts)
		}
		childActivity.mu.RUnlock()

		grandchildActivity.mu.RLock()
		if grandchildActivity.Stats.TotalPosts != 0 {
			t.Errorf("Expected grandchild to have 0 total posts after move, got %d", grandchildActivity.Stats.TotalPosts)
		}
		grandchildActivity.mu.RUnlock()

		// Verify activity was added to the new category
		service.mu.RLock()
		anotherParentActivity, exists := service.activity[anotherParent.ID]
		service.mu.RUnlock()

		if !exists {
			t.Fatal("Expected activity for anotherParent after post move")
		}

		anotherParentActivity.mu.RLock()
		if anotherParentActivity.Stats.TotalPosts != 1 {
			t.Errorf("Expected anotherParent to have 1 total post after move, got %d", anotherParentActivity.Stats.TotalPosts)
		}
		if anotherParentActivity.Stats.RecursivePosts != 1 {
			t.Errorf("Expected anotherParent to have 1 recursive post after move, got %d", anotherParentActivity.Stats.RecursivePosts)
		}
		anotherParentActivity.mu.RUnlock()
	})

	// Test Case 2: Move post within hierarchy (child to parent)
	t.Run("MoveWithinHierarchy", func(t *testing.T) {
		// Reset service
		service.activity = make(map[int]*CategoryActivity)

		tomorrow := now + 86400000 // Next day

		// Create initial post in child using PostCreated event
		err := service.HandleEvent(events.Event{
			Type: events.PostCreated,
			Data: events.PostEvent{
				PostID:     2,
				CategoryID: child.ID,
				Timestamp:  tomorrow,
			},
		})
		if err != nil {
			t.Fatalf("Expected no error handling PostCreated event, got %v", err)
		}

		// Verify initial state
		service.mu.RLock()
		parentActivity := service.activity[parent.ID]
		childActivity := service.activity[child.ID]
		service.mu.RUnlock()

		parentActivity.mu.RLock()
		initialParentRecursive := parentActivity.Stats.RecursivePosts
		parentActivity.mu.RUnlock()

		childActivity.mu.RLock()
		initialChildTotal := childActivity.Stats.TotalPosts
		childActivity.mu.RUnlock()

		if initialParentRecursive != 1 {
			t.Errorf("Expected parent to have 1 recursive post initially, got %d", initialParentRecursive)
		}
		if initialChildTotal != 1 {
			t.Errorf("Expected child to have 1 total post initially, got %d", initialChildTotal)
		}

		// Move post from child to parent
		oldCategoryID := child.ID
		err = service.HandleEvent(events.Event{
			Type: events.PostMoved,
			Data: events.PostEvent{
				PostID:        2,
				CategoryID:    parent.ID,
				OldCategoryID: &oldCategoryID,
				Timestamp:     tomorrow,
			},
		})

		if err != nil {
			t.Fatalf("Expected no error handling PostMoved event, got %v", err)
		}

		// Verify parent now has both direct and recursive activity
		parentActivity.mu.RLock()
		if parentActivity.Stats.TotalPosts != 1 {
			t.Errorf("Expected parent to have 1 total post after move, got %d", parentActivity.Stats.TotalPosts)
		}
		if parentActivity.Stats.RecursivePosts != 1 {
			t.Errorf("Expected parent to have 1 recursive post after move, got %d", parentActivity.Stats.RecursivePosts)
		}
		parentActivity.mu.RUnlock()

		// Verify child no longer has the post
		childActivity.mu.RLock()
		if childActivity.Stats.TotalPosts != 0 {
			t.Errorf("Expected child to have 0 total posts after move, got %d", childActivity.Stats.TotalPosts)
		}
		if childActivity.Stats.RecursivePosts != 0 {
			t.Errorf("Expected child to have 0 recursive posts after move, got %d", childActivity.Stats.RecursivePosts)
		}
		childActivity.mu.RUnlock()
	})

	// Test Case 3: Multiple posts and complex moves
	t.Run("MultiplePostsComplexMoves", func(t *testing.T) {
		// Reset service
		service.activity = make(map[int]*CategoryActivity)

		dayAfterTomorrow := now + 2*86400000

		// Create multiple posts in different categories using events
		// 2 posts in grandchild
		service.HandleEvent(events.Event{
			Type: events.PostCreated,
			Data: events.PostEvent{PostID: 3, CategoryID: grandchild.ID, Timestamp: dayAfterTomorrow},
		})
		service.HandleEvent(events.Event{
			Type: events.PostCreated,
			Data: events.PostEvent{PostID: 4, CategoryID: grandchild.ID, Timestamp: dayAfterTomorrow},
		})
		// 1 post in child
		service.HandleEvent(events.Event{
			Type: events.PostCreated,
			Data: events.PostEvent{PostID: 5, CategoryID: child.ID, Timestamp: dayAfterTomorrow},
		})

		// Verify initial recursive counts
		service.mu.RLock()
		parentActivity := service.activity[parent.ID]
		service.mu.RUnlock()

		parentActivity.mu.RLock()
		if parentActivity.Stats.RecursivePosts != 3 {
			t.Errorf("Expected parent to have 3 recursive posts initially, got %d", parentActivity.Stats.RecursivePosts)
		}
		parentActivity.mu.RUnlock()

		// Move 1 post from grandchild to anotherParent
		oldCategoryID := grandchild.ID
		err := service.HandleEvent(events.Event{
			Type: events.PostMoved,
			Data: events.PostEvent{
				PostID:        3,
				CategoryID:    anotherParent.ID,
				OldCategoryID: &oldCategoryID,
				Timestamp:     dayAfterTomorrow,
			},
		})

		if err != nil {
			t.Fatalf("Expected no error handling PostMoved event, got %v", err)
		}

		// Verify parent recursive count decreased by 1
		parentActivity.mu.RLock()
		if parentActivity.Stats.RecursivePosts != 2 {
			t.Errorf("Expected parent to have 2 recursive posts after move, got %d", parentActivity.Stats.RecursivePosts)
		}
		parentActivity.mu.RUnlock()

		// Verify grandchild count decreased
		service.mu.RLock()
		grandchildActivity := service.activity[grandchild.ID]
		service.mu.RUnlock()

		grandchildActivity.mu.RLock()
		if grandchildActivity.Stats.TotalPosts != 1 {
			t.Errorf("Expected grandchild to have 1 total post after move, got %d", grandchildActivity.Stats.TotalPosts)
		}
		grandchildActivity.mu.RUnlock()

		// Verify anotherParent got the post
		service.mu.RLock()
		anotherParentActivity := service.activity[anotherParent.ID]
		service.mu.RUnlock()

		anotherParentActivity.mu.RLock()
		if anotherParentActivity.Stats.TotalPosts != 1 {
			t.Errorf("Expected anotherParent to have 1 total post after move, got %d", anotherParentActivity.Stats.TotalPosts)
		}
		anotherParentActivity.mu.RUnlock()
	})
}

func TestPostMoveRecursiveActivityDayTracking(t *testing.T) {
	// Test that daily activity tracking works correctly with post moves
	catCache := cache.NewCategoryCache()

	parent := &models.Category{ID: 1, Name: "Parent", ParentID: nil}
	child := &models.Category{ID: 2, Name: "Child", ParentID: &[]int{1}[0]}
	other := &models.Category{ID: 3, Name: "Other", ParentID: nil}

	catCache.Set(parent)
	catCache.Set(child)
	catCache.Set(other)

	service := &Service{
		enabled:  true,
		activity: make(map[int]*CategoryActivity),
		catCache: catCache,
	}

	// Use different days for testing
	day1 := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC).UnixMilli()
	day2 := time.Date(2024, 1, 2, 12, 0, 0, 0, time.UTC).UnixMilli()

	// Create posts on different days using events
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{PostID: 6, CategoryID: child.ID, Timestamp: day1},
	})
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{PostID: 7, CategoryID: child.ID, Timestamp: day2},
	})

	// Verify parent has recursive activity on both days
	service.mu.RLock()
	parentActivity := service.activity[parent.ID]
	service.mu.RUnlock()

	parentActivity.mu.RLock()
	day1Str := time.Unix(day1/1000, 0).Format("2006-01-02")
	day2Str := time.Unix(day2/1000, 0).Format("2006-01-02")

	if parentActivity.Recursive[day1Str] != 1 {
		t.Errorf("Expected parent to have 1 post on day 1, got %d", parentActivity.Recursive[day1Str])
	}
	if parentActivity.Recursive[day2Str] != 1 {
		t.Errorf("Expected parent to have 1 post on day 2, got %d", parentActivity.Recursive[day2Str])
	}
	if parentActivity.Stats.RecursiveActiveDays != 2 {
		t.Errorf("Expected parent to have 2 recursive active days, got %d", parentActivity.Stats.RecursiveActiveDays)
	}
	parentActivity.mu.RUnlock()

	// Move day 1 post to other category
	oldCategoryID := child.ID
	err := service.HandleEvent(events.Event{
		Type: events.PostMoved,
		Data: events.PostEvent{
			PostID:        1,
			CategoryID:    other.ID,
			OldCategoryID: &oldCategoryID,
			Timestamp:     day1,
		},
	})

	if err != nil {
		t.Fatalf("Expected no error handling PostMoved event, got %v", err)
	}

	// Verify parent lost day 1 activity but kept day 2
	parentActivity.mu.RLock()
	if _, exists := parentActivity.Recursive[day1Str]; exists {
		t.Error("Expected parent to lose day 1 activity after move")
	}
	if parentActivity.Recursive[day2Str] != 1 {
		t.Errorf("Expected parent to keep day 2 activity, got %d", parentActivity.Recursive[day2Str])
	}
	if parentActivity.Stats.RecursiveActiveDays != 1 {
		t.Errorf("Expected parent to have 1 recursive active day after move, got %d", parentActivity.Stats.RecursiveActiveDays)
	}
	parentActivity.mu.RUnlock()

	// Verify other category got day 1 activity
	service.mu.RLock()
	otherActivity := service.activity[other.ID]
	service.mu.RUnlock()

	otherActivity.mu.RLock()
	if otherActivity.Days[day1Str] != 1 {
		t.Errorf("Expected other to have 1 post on day 1, got %d", otherActivity.Days[day1Str])
	}
	if otherActivity.Stats.TotalActiveDays != 1 {
		t.Errorf("Expected other to have 1 total active day, got %d", otherActivity.Stats.TotalActiveDays)
	}
	otherActivity.mu.RUnlock()
}