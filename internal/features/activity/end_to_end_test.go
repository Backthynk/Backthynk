package activity

import (
	"backthynk/internal/core/cache"
	"backthynk/internal/core/events"
	"backthynk/internal/core/models"
	"backthynk/internal/storage"
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/mux"
)

// TestEndToEndActivityLifecycle simulates a complete real-world scenario:
// 1. Multiple categories with hierarchy
// 2. Posts created over time (including retroactive)
// 3. Posts moved between categories
// 4. Posts deleted (including first and last posts)
// 5. Verify activity stats remain consistent throughout
func TestEndToEndActivityLifecycle(t *testing.T) {
	db := &storage.DB{}
	catCache := cache.NewCategoryCache()

	// Setup category hierarchy
	root := &models.Category{ID: 1, Name: "Root", ParentID: nil}
	child1 := &models.Category{ID: 2, Name: "Child1", ParentID: &[]int{1}[0]}
	child2 := &models.Category{ID: 3, Name: "Child2", ParentID: &[]int{1}[0]}
	grandchild := &models.Category{ID: 4, Name: "Grandchild", ParentID: &[]int{2}[0]}

	catCache.Set(root)
	catCache.Set(child1)
	catCache.Set(child2)
	catCache.Set(grandchild)

	service := NewService(db, catCache, true)
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	// Define timestamps
	now := time.Now().Unix() * 1000
	timestamps := map[string]int64{
		"1_year_ago":   now - (365 * 86400000),
		"6_months_ago": now - (180 * 86400000),
		"3_months_ago": now - (90 * 86400000),
		"1_month_ago":  now - (30 * 86400000),
		"1_week_ago":   now - (7 * 86400000),
		"yesterday":    now - 86400000,
		"today":        now,
	}

	// Phase 1: Initial post creation
	t.Run("Phase1_InitialCreation", func(t *testing.T) {
		// Create posts in root category
		service.HandleEvent(events.Event{
			Type: events.PostCreated,
			Data: events.PostEvent{CategoryID: 1, Timestamp: timestamps["1_year_ago"]},
		})
		service.HandleEvent(events.Event{
			Type: events.PostCreated,
			Data: events.PostEvent{CategoryID: 1, Timestamp: timestamps["today"]},
		})

		// Create posts in child1
		service.HandleEvent(events.Event{
			Type: events.PostCreated,
			Data: events.PostEvent{CategoryID: 2, Timestamp: timestamps["6_months_ago"]},
		})
		service.HandleEvent(events.Event{
			Type: events.PostCreated,
			Data: events.PostEvent{CategoryID: 2, Timestamp: timestamps["1_month_ago"]},
		})

		// Create posts in child2
		service.HandleEvent(events.Event{
			Type: events.PostCreated,
			Data: events.PostEvent{CategoryID: 3, Timestamp: timestamps["3_months_ago"]},
		})

		// Create posts in grandchild
		service.HandleEvent(events.Event{
			Type: events.PostCreated,
			Data: events.PostEvent{CategoryID: 4, Timestamp: timestamps["1_week_ago"]},
		})

		// Verify root direct activity
		resp := getActivity(t, router, 1, false)
		if resp.Stats.TotalPosts != 2 {
			t.Errorf("Root: expected 2 direct posts, got %d", resp.Stats.TotalPosts)
		}

		// Verify root recursive activity (should include all descendants)
		resp = getActivity(t, router, 1, true)
		if resp.Stats.TotalPosts != 6 {
			t.Errorf("Root recursive: expected 6 total posts, got %d", resp.Stats.TotalPosts)
		}

		// Verify child1 recursive (should include grandchild)
		resp = getActivity(t, router, 2, true)
		if resp.Stats.TotalPosts != 3 {
			t.Errorf("Child1 recursive: expected 3 posts (2 direct + 1 grandchild), got %d", resp.Stats.TotalPosts)
		}
	})

	// Phase 2: Retroactive post creation
	t.Run("Phase2_RetroactivePost", func(t *testing.T) {
		// Add a very old post to root
		veryOld := timestamps["1_year_ago"] - (365 * 86400000) // 2 years ago
		service.HandleEvent(events.Event{
			Type: events.PostCreated,
			Data: events.PostEvent{CategoryID: 1, Timestamp: veryOld},
		})

		resp := getActivity(t, router, 1, false)

		// Check that FirstPostTime was updated
		service.mu.RLock()
		activity := service.activity[1]
		service.mu.RUnlock()

		activity.mu.RLock()
		if activity.Stats.FirstPostTime != veryOld {
			t.Errorf("Root: FirstPostTime should be updated to %d, got %d", veryOld, activity.Stats.FirstPostTime)
		}

		// MaxPeriods should increase
		if resp.MaxPeriods < 5 {
			t.Errorf("Root: MaxPeriods should be at least 5 for 2-year span, got %d", resp.MaxPeriods)
		}
		activity.mu.RUnlock()
	})

	// Phase 3: Move posts between categories
	t.Run("Phase3_MovePost", func(t *testing.T) {
		// Move a post from child1 to child2
		oldCat := 2
		service.HandleEvent(events.Event{
			Type: events.PostMoved,
			Data: events.PostEvent{
				CategoryID:    3,
				OldCategoryID: &oldCat,
				Timestamp:     timestamps["6_months_ago"],
			},
		})

		// Child1 should now have 1 direct post (lost the 6_months_ago post)
		resp := getActivity(t, router, 2, false)
		if resp.Stats.TotalPosts != 1 {
			t.Errorf("Child1 after move: expected 1 direct post, got %d", resp.Stats.TotalPosts)
		}

		// Child2 should now have 2 posts
		resp = getActivity(t, router, 3, false)
		if resp.Stats.TotalPosts != 2 {
			t.Errorf("Child2 after move: expected 2 posts, got %d", resp.Stats.TotalPosts)
		}

		// Root recursive should still have 7 posts (3 direct + 4 from descendants)
		resp = getActivity(t, router, 1, true)
		if resp.Stats.TotalPosts != 7 {
			t.Errorf("Root recursive after move: expected 7 posts, got %d", resp.Stats.TotalPosts)
		}
	})

	// Phase 4: Delete first and last posts
	t.Run("Phase4_DeleteEdgePosts", func(t *testing.T) {
		// Get initial state
		service.mu.RLock()
		activity := service.activity[1]
		service.mu.RUnlock()

		activity.mu.RLock()
		initialFirst := activity.Stats.FirstPostTime
		initialLast := activity.Stats.LastPostTime
		activity.mu.RUnlock()

		// Delete the oldest post (2 years ago)
		veryOld := timestamps["1_year_ago"] - (365 * 86400000)
		service.HandleEvent(events.Event{
			Type: events.PostDeleted,
			Data: events.PostEvent{CategoryID: 1, Timestamp: veryOld},
		})

		activity.mu.RLock()
		if activity.Stats.FirstPostTime == initialFirst {
			t.Error("Root: FirstPostTime should be updated after deleting oldest post")
		}
		if activity.Stats.LastPostTime != initialLast {
			t.Error("Root: LastPostTime should remain unchanged after deleting oldest")
		}
		newFirst := activity.Stats.FirstPostTime
		activity.mu.RUnlock()

		// Delete the newest post (today)
		service.HandleEvent(events.Event{
			Type: events.PostDeleted,
			Data: events.PostEvent{CategoryID: 1, Timestamp: timestamps["today"]},
		})

		activity.mu.RLock()
		if activity.Stats.FirstPostTime != newFirst {
			t.Error("Root: FirstPostTime should remain unchanged after deleting newest")
		}
		if activity.Stats.LastPostTime == initialLast {
			t.Error("Root: LastPostTime should be updated after deleting newest post")
		}
		activity.mu.RUnlock()

		// Verify through API
		resp := getActivity(t, router, 1, false)
		if resp.Stats.TotalPosts != 1 {
			t.Errorf("Root after deletions: expected 1 post, got %d", resp.Stats.TotalPosts)
		}
	})

	// Phase 5: Delete all posts and verify cleanup
	t.Run("Phase5_DeleteAllPosts", func(t *testing.T) {
		// Delete remaining post in root
		service.HandleEvent(events.Event{
			Type: events.PostDeleted,
			Data: events.PostEvent{CategoryID: 1, Timestamp: timestamps["1_year_ago"]},
		})

		service.mu.RLock()
		activity := service.activity[1]
		service.mu.RUnlock()

		activity.mu.RLock()
		if activity.Stats.FirstPostTime != 0 {
			t.Errorf("Root with no posts: FirstPostTime should be 0, got %d", activity.Stats.FirstPostTime)
		}
		if activity.Stats.LastPostTime != 0 {
			t.Errorf("Root with no posts: LastPostTime should be 0, got %d", activity.Stats.LastPostTime)
		}
		if activity.Stats.TotalPosts != 0 {
			t.Errorf("Root with no posts: TotalPosts should be 0, got %d", activity.Stats.TotalPosts)
		}
		if activity.Stats.TotalActiveDays != 0 {
			t.Errorf("Root with no posts: TotalActiveDays should be 0, got %d", activity.Stats.TotalActiveDays)
		}
		activity.mu.RUnlock()

		// Verify through API
		resp := getActivity(t, router, 1, false)
		if resp.Stats.TotalPosts != 0 {
			t.Errorf("Root API with no posts: expected 0 posts, got %d", resp.Stats.TotalPosts)
		}
		if resp.MaxPeriods != 0 {
			t.Errorf("Root API with no posts: MaxPeriods should be 0, got %d", resp.MaxPeriods)
		}
	})

	// Phase 6: Verify global activity is consistent
	t.Run("Phase6_GlobalActivityConsistency", func(t *testing.T) {
		resp := getActivity(t, router, 0, false)

		// Count remaining posts across all categories
		// Root: 0, Child1: 1, Child2: 2, Grandchild: 1 = 4 total
		expectedTotal := 4
		if resp.Stats.TotalPosts != expectedTotal {
			t.Errorf("Global activity: expected %d posts, got %d", expectedTotal, resp.Stats.TotalPosts)
		}
	})
}

// Helper function to get activity from API
// Uses a very wide date range to capture all activity (2 years in past, 1 year in future)
func getActivity(t *testing.T, router *mux.Router, categoryID int, recursive bool) ActivityPeriodResponse {
	t.Helper()

	now := time.Now()
	startDate := now.AddDate(-2, 0, 0).Format("2006-01-02") // 2 years ago
	endDate := now.AddDate(1, 0, 0).Format("2006-01-02")    // 1 year in future

	url := "/api/activity/"
	if categoryID == 0 {
		url += "0"
	} else {
		url += string(rune('0' + categoryID))
	}

	url += "?start_date=" + startDate + "&end_date=" + endDate
	if recursive {
		url += "&recursive=true"
	}

	req := httptest.NewRequest("GET", url, nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != 200 {
		t.Fatalf("API request failed with status %d for URL %s", w.Code, url)
	}

	var response ActivityPeriodResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	return response
}