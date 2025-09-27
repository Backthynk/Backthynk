package services

import (
	"backthynk/internal/cache"
	"backthynk/internal/models"
	"testing"
	"time"
)

func TestCacheManager_AllCachesEnabled(t *testing.T) {
	config := CacheConfig{
		CategoryCacheEnabled: true,
		ActivityEnabled:      true,
		FileStatsEnabled:     true,
	}

	cm := NewCacheManager(nil, config)

	// Verify configuration
	stats := cm.GetCacheStats()
	if !stats["category_cache_enabled"].(bool) {
		t.Error("Category cache should be enabled")
	}
	if !stats["activity_enabled"].(bool) {
		t.Error("Activity cache should be enabled")
	}
	if !stats["file_stats_enabled"].(bool) {
		t.Error("File stats cache should be enabled")
	}

	// Test that coordinator has correct flags
	coordinatorStats := stats["coordinator"].(map[string]interface{})
	if !coordinatorStats["coordinator_active"].(bool) {
		t.Error("Coordinator should be active")
	}
}

func TestCacheManager_PartialCachesEnabled(t *testing.T) {
	config := CacheConfig{
		CategoryCacheEnabled: true,
		ActivityEnabled:      false,
		FileStatsEnabled:     true,
	}

	cm := NewCacheManager(nil, config)

	stats := cm.GetCacheStats()
	if !stats["category_cache_enabled"].(bool) {
		t.Error("Category cache should be enabled")
	}
	if stats["activity_enabled"].(bool) {
		t.Error("Activity cache should be disabled")
	}
	if !stats["file_stats_enabled"].(bool) {
		t.Error("File stats cache should be enabled")
	}

	// Should have post count cache (always enabled)
	if _, exists := stats["post_count_cache"]; !exists {
		t.Error("Post count cache should always be present")
	}

	// Should not have activity cache in stats
	if _, exists := stats["activity_cache"]; exists {
		t.Error("Activity cache should not be in stats when disabled")
	}
}

func TestCacheManager_OnlyMandatoryCacheEnabled(t *testing.T) {
	config := CacheConfig{
		CategoryCacheEnabled: false,
		ActivityEnabled:      false,
		FileStatsEnabled:     false,
	}

	cm := NewCacheManager(nil, config)

	stats := cm.GetCacheStats()
	if stats["category_cache_enabled"].(bool) {
		t.Error("Category cache should be disabled")
	}
	if stats["activity_enabled"].(bool) {
		t.Error("Activity cache should be disabled")
	}
	if stats["file_stats_enabled"].(bool) {
		t.Error("File stats cache should be disabled")
	}

	// Should only have post count cache and coordinator
	expectedKeys := []string{"post_count_cache", "coordinator", "category_cache_enabled", "activity_enabled", "file_stats_enabled"}
	for _, key := range expectedKeys {
		if _, exists := stats[key]; !exists {
			t.Errorf("Expected key '%s' missing from stats", key)
		}
	}

	// Should not have optional cache stats
	unexpectedKeys := []string{"category_cache", "activity_cache", "file_stats_cache"}
	for _, key := range unexpectedKeys {
		if _, exists := stats[key]; exists {
			t.Errorf("Unexpected key '%s' found in stats when cache disabled", key)
		}
	}
}

func TestCacheManager_IntegratedOperations(t *testing.T) {
	config := CacheConfig{
		CategoryCacheEnabled: true,
		ActivityEnabled:      true,
		FileStatsEnabled:     true,
	}

	cm := NewCacheManager(nil, config)
	coordinator := cm.Coordinator()

	// Setup test hierarchy
	categories := []models.Category{
		{ID: 1, Name: "Technology", ParentID: nil, Depth: 0},
		{ID: 2, Name: "Software", ParentID: intPtr(1), Depth: 1},
		{ID: 3, Name: "Hardware", ParentID: intPtr(1), Depth: 1},
		{ID: 4, Name: "Programming", ParentID: intPtr(2), Depth: 2},
	}

	err := coordinator.InitializeHierarchy(categories)
	if err != nil {
		t.Fatalf("Failed to initialize hierarchy: %v", err)
	}

	// Set initial post counts FRESH for each test
	postCountCache := cache.GetPostCountCache()

	// Test comprehensive operations
	t.Run("Post Operations", func(t *testing.T) {
		initialTech := postCountCache.GetPostCountRecursive(1)
		initialSoftware := postCountCache.GetPostCount(2)

		// Create post
		coordinator.ProcessEvent(cache.CacheEvent{
			Type:       cache.EventPostCreated,
			CategoryID: 2,
			Timestamp:  time.Now().UnixMilli(),
		})

		time.Sleep(100 * time.Millisecond)

		afterSoftware := postCountCache.GetPostCount(2)
		afterTech := postCountCache.GetPostCountRecursive(1)

		if afterSoftware != initialSoftware+1 {
			t.Errorf("Software post count: expected %d, got %d", initialSoftware+1, afterSoftware)
		}
		if afterTech != initialTech+1 {
			t.Errorf("Technology recursive count: expected %d, got %d", initialTech+1, afterTech)
		}
	})

	t.Run("File Operations", func(t *testing.T) {
		fileStatsCache := cache.GetFileStatsCache()

		coordinator.ProcessEvent(cache.CacheEvent{
			Type:       cache.EventFileAdded,
			CategoryID: 2,
			Timestamp:  time.Now().UnixMilli(),
			FileSize:   2048000, // 2MB
		})

		time.Sleep(100 * time.Millisecond)

		stats := fileStatsCache.GetCategoryFileStats(2)
		if stats == nil {
			t.Error("File stats should be created")
		} else {
			stats.Mutex.RLock()
			count := stats.Direct.FileCount
			size := stats.Direct.TotalSize
			stats.Mutex.RUnlock()

			if count == 0 {
				t.Error("File count should be > 0")
			}
			if size == 0 {
				t.Error("File size should be > 0")
			}
		}
	})

	t.Run("Category Move", func(t *testing.T) {
		// Reset counts to known state for this test (accounting for previous test changes)
		postCountCache.SetPostCount(1, 20) // Technology
		postCountCache.SetPostCount(2, 15) // Software
		postCountCache.SetPostCount(3, 10) // Hardware
		postCountCache.SetPostCount(4, 8)  // Programming

		initialTech := postCountCache.GetPostCountRecursive(1)     // Should be 20+15+10+8 = 53
		initialSoftware := postCountCache.GetPostCountRecursive(2) // Should be 15+8 = 23
		initialHardware := postCountCache.GetPostCountRecursive(3) // Should be 10
		programmingCount := postCountCache.GetPostCount(4)         // Should be 8

		t.Logf("Before move: Tech=%d, Software=%d, Hardware=%d, Programming=%d",
			initialTech, initialSoftware, initialHardware, programmingCount)

		// Move Programming from Software to Hardware
		coordinator.ProcessEvent(cache.CacheEvent{
			Type:        cache.EventCategoryMoved,
			CategoryID:  4,
			OldParentID: intPtr(2), // Software
			NewParentID: intPtr(3), // Hardware
			Timestamp:   time.Now().UnixMilli(),
		})

		time.Sleep(200 * time.Millisecond)

		afterTech := postCountCache.GetPostCountRecursive(1)
		afterSoftware := postCountCache.GetPostCountRecursive(2)
		afterHardware := postCountCache.GetPostCountRecursive(3)

		t.Logf("After move: Tech=%d, Software=%d, Hardware=%d", afterTech, afterSoftware, afterHardware)

		// Expected after move:
		// Technology: 53 (unchanged - still contains all categories)
		// Software: 15 (lost programming)
		// Hardware: 18 (gained programming: 10 + 8)

		if afterTech != 53 {
			t.Errorf("Technology recursive count should remain 53, got %d", afterTech)
		}
		if afterSoftware != 15 {
			t.Errorf("Software recursive count should be 15 after losing programming, got %d", afterSoftware)
		}
		if afterHardware != 18 {
			t.Errorf("Hardware recursive count should be 18 after gaining programming, got %d", afterHardware)
		}
	})
}

func TestCacheManager_CacheToggling(t *testing.T) {
	config := CacheConfig{
		CategoryCacheEnabled: true,
		ActivityEnabled:      true,
		FileStatsEnabled:     true,
	}

	cm := NewCacheManager(nil, config)

	// Test setting cache flags
	cm.SetCacheEnabled(false, false, false)

	stats := cm.GetCacheStats()
	if stats["category_cache_enabled"].(bool) {
		t.Error("Category cache should be disabled after toggle")
	}
	if stats["activity_enabled"].(bool) {
		t.Error("Activity cache should be disabled after toggle")
	}
	if stats["file_stats_enabled"].(bool) {
		t.Error("File stats cache should be disabled after toggle")
	}

	// Test re-enabling
	cm.SetCacheEnabled(true, true, true)

	stats = cm.GetCacheStats()
	if !stats["category_cache_enabled"].(bool) {
		t.Error("Category cache should be enabled after toggle")
	}
	if !stats["activity_enabled"].(bool) {
		t.Error("Activity cache should be enabled after toggle")
	}
	if !stats["file_stats_enabled"].(bool) {
		t.Error("File stats cache should be enabled after toggle")
	}
}

func TestCacheManager_ServiceGetters(t *testing.T) {
	config := CacheConfig{
		CategoryCacheEnabled: true,
		ActivityEnabled:      true,
		FileStatsEnabled:     true,
	}

	cm := NewCacheManager(nil, config)

	// Test all service getters
	if cm.CategoryService() == nil {
		t.Error("CategoryService should not be nil")
	}
	if cm.PostCountService() == nil {
		t.Error("PostCountService should not be nil")
	}
	if cm.FileStatsService() == nil {
		t.Error("FileStatsService should not be nil")
	}
	if cm.ActivityService() == nil {
		t.Error("ActivityService should not be nil")
	}
	if cm.Coordinator() == nil {
		t.Error("Coordinator should not be nil")
	}

	// Test that services are properly configured
	categoryStats := cm.CategoryService().GetCacheStats()
	if !categoryStats["cache_enabled"].(bool) {
		t.Error("Category service should have cache enabled")
	}

	activityStats := cm.ActivityService().GetCacheStats()
	if !activityStats["cache_enabled"].(bool) {
		t.Error("Activity service should have cache enabled")
	}
}

func intPtr(i int) *int {
	return &i
}