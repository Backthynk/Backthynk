package activity

import (
	"backthynk/internal/core/cache"
	"backthynk/internal/core/events"
	"backthynk/internal/core/models"
	"backthynk/internal/storage"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/mux"
)

// TestAPIActivityAfterPostOperations tests that the API returns correct activity
// data after various post operations (create, delete, move)
func TestAPIActivityAfterPostOperations(t *testing.T) {
	service := &Service{
		enabled:  true,
		activity: make(map[int]*CategoryActivity),
	}
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	now := time.Now().Unix() * 1000
	day1 := now - (3 * 86400000) // 3 days ago
	day2 := now - (2 * 86400000) // 2 days ago
	day3 := now - (1 * 86400000) // yesterday

	// Create posts
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{CategoryID: 1, Timestamp: day1},
	})
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{CategoryID: 1, Timestamp: day2},
	})
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{CategoryID: 1, Timestamp: day3},
	})

	// Test 1: Check initial state via API
	req := httptest.NewRequest("GET", "/api/activity/1", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status 200, got %d", w.Code)
	}

	var response ActivityPeriodResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Stats.TotalPosts != 3 {
		t.Errorf("Expected 3 total posts, got %d", response.Stats.TotalPosts)
	}

	// Test 2: Delete oldest post and verify API
	service.HandleEvent(events.Event{
		Type: events.PostDeleted,
		Data: events.PostEvent{CategoryID: 1, Timestamp: day1},
	})

	req = httptest.NewRequest("GET", "/api/activity/1", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Stats.TotalPosts != 2 {
		t.Errorf("After delete, expected 2 total posts, got %d", response.Stats.TotalPosts)
	}

	// Test 3: Move a post and verify both categories via API
	oldCat := 1
	service.HandleEvent(events.Event{
		Type: events.PostMoved,
		Data: events.PostEvent{
			CategoryID:    2,
			OldCategoryID: &oldCat,
			Timestamp:     day2,
		},
	})

	// Check category 1
	req = httptest.NewRequest("GET", "/api/activity/1", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Stats.TotalPosts != 1 {
		t.Errorf("Category 1: expected 1 post after move, got %d", response.Stats.TotalPosts)
	}

	// Check category 2
	req = httptest.NewRequest("GET", "/api/activity/2", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Stats.TotalPosts != 1 {
		t.Errorf("Category 2: expected 1 post after move, got %d", response.Stats.TotalPosts)
	}
}

// TestAPIMaxPeriodsCalculation tests that MaxPeriods is correctly calculated
// based on the actual FirstPostTime in the category
func TestAPIMaxPeriodsCalculation(t *testing.T) {
	service := &Service{
		enabled:  true,
		activity: make(map[int]*CategoryActivity),
	}
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	now := time.Now().Unix() * 1000
	oneYearAgo := now - (365 * 86400000)
	twoYearsAgo := now - (730 * 86400000)

	// Create old post (2 years ago)
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{CategoryID: 1, Timestamp: twoYearsAgo},
	})

	// Create newer post (1 year ago)
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{CategoryID: 1, Timestamp: oneYearAgo},
	})

	// Check MaxPeriods with periodMonths=4 (should be ~24/4 = 6 periods)
	req := httptest.NewRequest("GET", "/api/activity/1?period_months=4", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	var response ActivityPeriodResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.MaxPeriods < 5 {
		t.Errorf("Expected at least 5 periods for 2-year-old post, got %d", response.MaxPeriods)
	}

	initialMaxPeriods := response.MaxPeriods

	// Delete the oldest post - MaxPeriods should decrease
	service.HandleEvent(events.Event{
		Type: events.PostDeleted,
		Data: events.PostEvent{CategoryID: 1, Timestamp: twoYearsAgo},
	})

	req = httptest.NewRequest("GET", "/api/activity/1?period_months=4", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.MaxPeriods >= initialMaxPeriods {
		t.Errorf("After deleting oldest post, MaxPeriods should decrease from %d, got %d", initialMaxPeriods, response.MaxPeriods)
	}

	if response.MaxPeriods < 2 {
		t.Errorf("Expected at least 2 periods for 1-year-old post, got %d", response.MaxPeriods)
	}

	// Delete all posts - MaxPeriods should be 0
	service.HandleEvent(events.Event{
		Type: events.PostDeleted,
		Data: events.PostEvent{CategoryID: 1, Timestamp: oneYearAgo},
	})

	req = httptest.NewRequest("GET", "/api/activity/1?period_months=4", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.MaxPeriods != 0 {
		t.Errorf("After deleting all posts, MaxPeriods should be 0, got %d", response.MaxPeriods)
	}
}

// TestAPIRecursiveActivity tests that recursive activity is correctly calculated
// and returned through the API
func TestAPIRecursiveActivity(t *testing.T) {
	db := &storage.DB{}
	catCache := cache.NewCategoryCache()

	parent := &models.Category{ID: 1, Name: "Parent", ParentID: nil}
	child := &models.Category{ID: 2, Name: "Child", ParentID: &[]int{1}[0]}

	catCache.Set(parent)
	catCache.Set(child)

	service := NewService(db, catCache, true)
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	now := time.Now().Unix() * 1000

	// Create post in parent
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{CategoryID: 1, Timestamp: now},
	})

	// Create posts in child
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{CategoryID: 2, Timestamp: now},
	})
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{CategoryID: 2, Timestamp: now},
	})

	// Check parent with recursive=false (only direct posts)
	req := httptest.NewRequest("GET", "/api/activity/1?recursive=false", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	var response ActivityPeriodResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Stats.TotalPosts != 1 {
		t.Errorf("Parent non-recursive: expected 1 post, got %d", response.Stats.TotalPosts)
	}

	// Check parent with recursive=true (should include child posts)
	req = httptest.NewRequest("GET", "/api/activity/1?recursive=true", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Stats.TotalPosts != 3 {
		t.Errorf("Parent recursive: expected 3 posts (1 parent + 2 child), got %d", response.Stats.TotalPosts)
	}

	// Delete child post and verify recursive count updates
	service.HandleEvent(events.Event{
		Type: events.PostDeleted,
		Data: events.PostEvent{CategoryID: 2, Timestamp: now},
	})

	req = httptest.NewRequest("GET", "/api/activity/1?recursive=true", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Stats.TotalPosts != 2 {
		t.Errorf("Parent recursive after delete: expected 2 posts, got %d", response.Stats.TotalPosts)
	}
}

// TestAPIGlobalActivity tests that global activity (categoryID=0) works correctly
func TestAPIGlobalActivity(t *testing.T) {
	service := &Service{
		enabled:  true,
		activity: make(map[int]*CategoryActivity),
	}
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	now := time.Now().Unix() * 1000

	// Create posts in different categories
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{CategoryID: 1, Timestamp: now},
	})
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{CategoryID: 2, Timestamp: now},
	})
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{CategoryID: 3, Timestamp: now},
	})

	// Check global activity
	req := httptest.NewRequest("GET", "/api/activity/0", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	var response ActivityPeriodResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.CategoryID != 0 {
		t.Errorf("Expected category ID 0, got %d", response.CategoryID)
	}

	if response.Stats.TotalPosts != 3 {
		t.Errorf("Global: expected 3 total posts, got %d", response.Stats.TotalPosts)
	}

	// Delete post and verify global count updates
	service.HandleEvent(events.Event{
		Type: events.PostDeleted,
		Data: events.PostEvent{CategoryID: 2, Timestamp: now},
	})

	req = httptest.NewRequest("GET", "/api/activity/0", nil)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Stats.TotalPosts != 2 {
		t.Errorf("Global after delete: expected 2 posts, got %d", response.Stats.TotalPosts)
	}
}

// TestAPIPeriodFiltering tests that date filtering works correctly
func TestAPIPeriodFiltering(t *testing.T) {
	service := &Service{
		enabled:  true,
		activity: make(map[int]*CategoryActivity),
	}
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	// Create posts on different dates
	jan1 := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC).Unix() * 1000
	jan15 := time.Date(2025, 1, 15, 0, 0, 0, 0, time.UTC).Unix() * 1000
	feb1 := time.Date(2025, 2, 1, 0, 0, 0, 0, time.UTC).Unix() * 1000
	feb15 := time.Date(2025, 2, 15, 0, 0, 0, 0, time.UTC).Unix() * 1000

	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{CategoryID: 1, Timestamp: jan1},
	})
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{CategoryID: 1, Timestamp: jan15},
	})
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{CategoryID: 1, Timestamp: feb1},
	})
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{CategoryID: 1, Timestamp: feb15},
	})

	// Test with date range filtering
	req := httptest.NewRequest("GET", "/api/activity/1?start_date=2025-01-10&end_date=2025-02-05", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	var response ActivityPeriodResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	// Should only include jan15 and feb1
	if response.Stats.TotalPosts != 2 {
		t.Errorf("Expected 2 posts in filtered range, got %d", response.Stats.TotalPosts)
	}

	if response.Stats.ActiveDays != 2 {
		t.Errorf("Expected 2 active days in filtered range, got %d", response.Stats.ActiveDays)
	}
}

// TestAPIMaxDayActivity tests that MaxDayActivity is correctly calculated
func TestAPIMaxDayActivity(t *testing.T) {
	service := &Service{
		enabled:  true,
		activity: make(map[int]*CategoryActivity),
	}
	handler := NewHandler(service)
	router := mux.NewRouter()
	handler.RegisterRoutes(router)

	now := time.Now().Unix() * 1000
	yesterday := now - 86400000

	// Create 1 post today
	service.HandleEvent(events.Event{
		Type: events.PostCreated,
		Data: events.PostEvent{CategoryID: 1, Timestamp: now},
	})

	// Create 5 posts yesterday
	for i := 0; i < 5; i++ {
		service.HandleEvent(events.Event{
			Type: events.PostCreated,
			Data: events.PostEvent{CategoryID: 1, Timestamp: yesterday},
		})
	}

	req := httptest.NewRequest("GET", "/api/activity/1", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	var response ActivityPeriodResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if response.Stats.MaxDayActivity != 5 {
		t.Errorf("Expected MaxDayActivity 5, got %d", response.Stats.MaxDayActivity)
	}

	if response.Stats.TotalPosts != 6 {
		t.Errorf("Expected 6 total posts, got %d", response.Stats.TotalPosts)
	}

	if response.Stats.ActiveDays != 2 {
		t.Errorf("Expected 2 active days, got %d", response.Stats.ActiveDays)
	}
}
