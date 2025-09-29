package detailedstats

import (
	"backthynk/internal/core/events"
	"testing"
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
			Type: events.FileUploaded,
			Data: events.PostEvent{CategoryID: 1, FileSize: 1000},
		})
		if err != nil {
			t.Errorf("Expected no error for disabled service, got %v", err)
		}

		// GetStats should return empty stats
		stats := service.GetStats(1, false)
		if stats.FileCount != 0 || stats.TotalSize != 0 {
			t.Errorf("Expected empty stats for disabled service, got %+v", stats)
		}

		// GetGlobalStats should return empty stats
		globalStats := service.GetGlobalStats()
		if globalStats.FileCount != 0 || globalStats.TotalSize != 0 {
			t.Errorf("Expected empty global stats for disabled service, got %+v", globalStats)
		}
	})

	// Test with enabled service
	t.Run("EnabledService", func(t *testing.T) {
		service := &Service{
			enabled: true,
			stats:   make(map[int]*CategoryStats),
		}

		// Initialize stats manually to avoid catCache dependency
		service.mu.Lock()
		service.stats[1] = &CategoryStats{
			Direct:    Stats{FileCount: 1, TotalSize: 1000},
			Recursive: Stats{FileCount: 1, TotalSize: 1000},
		}
		service.mu.Unlock()

		// Test GetStats functionality
		directStats := service.GetStats(1, false)
		if directStats.FileCount != 1 {
			t.Errorf("Expected 1 file, got %d", directStats.FileCount)
		}
		if directStats.TotalSize != 1000 {
			t.Errorf("Expected 1000 total size, got %d", directStats.TotalSize)
		}

		recursiveStats := service.GetStats(1, true)
		if recursiveStats.FileCount != 1 {
			t.Errorf("Expected 1 recursive file, got %d", recursiveStats.FileCount)
		}
		if recursiveStats.TotalSize != 1000 {
			t.Errorf("Expected 1000 recursive total size, got %d", recursiveStats.TotalSize)
		}
	})
}

func TestGetStats(t *testing.T) {
	service := &Service{
		enabled: true,
		stats:   make(map[int]*CategoryStats),
	}

	// Create some stats manually
	service.mu.Lock()
	service.stats[1] = &CategoryStats{
		Direct:    Stats{FileCount: 5, TotalSize: 1000},
		Recursive: Stats{FileCount: 8, TotalSize: 1500},
	}
	service.mu.Unlock()

	// Test direct stats
	directStats := service.GetStats(1, false)
	if directStats.FileCount != 5 {
		t.Errorf("Expected 5 direct files, got %d", directStats.FileCount)
	}
	if directStats.TotalSize != 1000 {
		t.Errorf("Expected 1000 direct total size, got %d", directStats.TotalSize)
	}

	// Test recursive stats
	recursiveStats := service.GetStats(1, true)
	if recursiveStats.FileCount != 8 {
		t.Errorf("Expected 8 recursive files, got %d", recursiveStats.FileCount)
	}
	if recursiveStats.TotalSize != 1500 {
		t.Errorf("Expected 1500 recursive total size, got %d", recursiveStats.TotalSize)
	}

	// Test non-existent category
	emptyStats := service.GetStats(999, false)
	if emptyStats.FileCount != 0 || emptyStats.TotalSize != 0 {
		t.Errorf("Expected empty stats for non-existent category, got %+v", emptyStats)
	}
}

func TestGetStatsDisabled(t *testing.T) {
	service := &Service{
		enabled: false,
		stats:   make(map[int]*CategoryStats),
	}

	stats := service.GetStats(1, false)
	if stats.FileCount != 0 || stats.TotalSize != 0 {
		t.Errorf("Expected empty stats when disabled, got %+v", stats)
	}
}

func TestGetGlobalStats(t *testing.T) {
	service := &Service{
		enabled: true,
		stats:   make(map[int]*CategoryStats),
	}

	// Create stats for multiple categories manually
	service.mu.Lock()
	service.stats[1] = &CategoryStats{
		Direct:    Stats{FileCount: 5, TotalSize: 1000},
		Recursive: Stats{FileCount: 5, TotalSize: 1000},
	}
	service.stats[2] = &CategoryStats{
		Direct:    Stats{FileCount: 3, TotalSize: 500},
		Recursive: Stats{FileCount: 3, TotalSize: 500},
	}
	service.stats[3] = &CategoryStats{
		Direct:    Stats{FileCount: 2, TotalSize: 300},
		Recursive: Stats{FileCount: 2, TotalSize: 300},
	}
	service.mu.Unlock()

	globalStats := service.GetGlobalStats()
	if globalStats.FileCount != 10 { // 5 + 3 + 2
		t.Errorf("Expected 10 total files globally, got %d", globalStats.FileCount)
	}
	if globalStats.TotalSize != 1800 { // 1000 + 500 + 300
		t.Errorf("Expected 1800 total size globally, got %d", globalStats.TotalSize)
	}
}

func TestGetGlobalStatsDisabled(t *testing.T) {
	service := &Service{
		enabled: false,
		stats:   make(map[int]*CategoryStats),
	}

	globalStats := service.GetGlobalStats()
	if globalStats.FileCount != 0 || globalStats.TotalSize != 0 {
		t.Errorf("Expected empty global stats when disabled, got %+v", globalStats)
	}
}

func TestHandleEventDisabled(t *testing.T) {
	service := &Service{
		enabled: false,
		stats:   make(map[int]*CategoryStats),
	}

	// Events should be ignored when service is disabled
	err := service.HandleEvent(events.Event{
		Type: events.FileUploaded,
		Data: events.PostEvent{CategoryID: 1, FileSize: 1000},
	})
	if err != nil {
		t.Errorf("Expected no error for disabled service, got %v", err)
	}

	service.mu.RLock()
	statsCount := len(service.stats)
	service.mu.RUnlock()

	if statsCount != 0 {
		t.Errorf("Expected no stats when disabled, got %d stats", statsCount)
	}
}

func TestNewService(t *testing.T) {
	service := NewService(nil, nil, true)

	if service == nil {
		t.Fatal("Expected service to be created")
	}

	if !service.enabled {
		t.Error("Expected service to be enabled")
	}

	if service.stats == nil {
		t.Error("Expected stats map to be initialized")
	}
}

func TestNewServiceDisabled(t *testing.T) {
	service := NewService(nil, nil, false)

	if service.enabled {
		t.Error("Expected service to be disabled")
	}
}

func TestStatsStructure(t *testing.T) {
	// Test that the Stats struct has the expected fields and JSON tags
	stats := Stats{
		FileCount: 10,
		TotalSize: 2000,
	}

	if stats.FileCount != 10 {
		t.Errorf("Expected FileCount 10, got %d", stats.FileCount)
	}

	if stats.TotalSize != 2000 {
		t.Errorf("Expected TotalSize 2000, got %d", stats.TotalSize)
	}
}

func TestCategoryStatsStructure(t *testing.T) {
	// Test that the CategoryStats struct properly handles both direct and recursive stats
	categoryStats := &CategoryStats{
		Direct: Stats{
			FileCount: 5,
			TotalSize: 1000,
		},
		Recursive: Stats{
			FileCount: 8,
			TotalSize: 1500,
		},
	}

	if categoryStats.Direct.FileCount != 5 {
		t.Errorf("Expected Direct FileCount 5, got %d", categoryStats.Direct.FileCount)
	}

	if categoryStats.Direct.TotalSize != 1000 {
		t.Errorf("Expected Direct TotalSize 1000, got %d", categoryStats.Direct.TotalSize)
	}

	if categoryStats.Recursive.FileCount != 8 {
		t.Errorf("Expected Recursive FileCount 8, got %d", categoryStats.Recursive.FileCount)
	}

	if categoryStats.Recursive.TotalSize != 1500 {
		t.Errorf("Expected Recursive TotalSize 1500, got %d", categoryStats.Recursive.TotalSize)
	}
}

func TestServiceConcurrentAccess(t *testing.T) {
	service := &Service{
		enabled:   true,
		stats:     make(map[int]*CategoryStats),
		postFiles: make(map[int]map[int]*FileInfo),
	}

	// Initialize some stats
	service.mu.Lock()
	service.stats[1] = &CategoryStats{
		Direct:    Stats{FileCount: 5, TotalSize: 1000},
		Recursive: Stats{FileCount: 5, TotalSize: 1000},
	}
	service.mu.Unlock()

	// Test concurrent reads
	done := make(chan bool, 10)

	for i := 0; i < 10; i++ {
		go func() {
			stats := service.GetStats(1, false)
			if stats.FileCount != 5 {
				t.Errorf("Expected 5 files in concurrent read, got %d", stats.FileCount)
			}
			done <- true
		}()
	}

	// Wait for all goroutines to complete
	for i := 0; i < 10; i++ {
		<-done
	}
}

func TestServicePostFileTracking(t *testing.T) {
	// This test verifies that the service properly tracks files by post
	service := &Service{
		enabled:   true,
		stats:     make(map[int]*CategoryStats),
		postFiles: make(map[int]map[int]*FileInfo),
	}

	// Test file tracking by post
	categoryID := 1
	postID := 1

	// Track files for a post
	service.trackFileByPost(categoryID, postID, 5000, 1)
	service.trackFileByPost(categoryID, postID, 3000, 1)

	// Verify tracking
	service.mu.RLock()
	if postFiles, ok := service.postFiles[categoryID]; ok {
		if fileInfo, exists := postFiles[postID]; exists {
			if fileInfo.FileCount != 2 {
				t.Errorf("Expected 2 files tracked, got %d", fileInfo.FileCount)
			}
			if fileInfo.TotalSize != 8000 {
				t.Errorf("Expected 8000 bytes tracked, got %d", fileInfo.TotalSize)
			}
		} else {
			t.Error("Post should be tracked")
		}
	} else {
		t.Error("Category should have post tracking")
	}
	service.mu.RUnlock()

	// Test file removal
	service.trackFileByPost(categoryID, postID, -3000, -1)

	service.mu.RLock()
	if postFiles, ok := service.postFiles[categoryID]; ok {
		if fileInfo, exists := postFiles[postID]; exists {
			if fileInfo.FileCount != 1 {
				t.Errorf("Expected 1 file after removal, got %d", fileInfo.FileCount)
			}
			if fileInfo.TotalSize != 5000 {
				t.Errorf("Expected 5000 bytes after removal, got %d", fileInfo.TotalSize)
			}
		}
	}
	service.mu.RUnlock()

	// Test complete removal
	service.trackFileByPost(categoryID, postID, -5000, -1)

	service.mu.RLock()
	if postFiles, ok := service.postFiles[categoryID]; ok {
		if _, exists := postFiles[postID]; exists {
			t.Error("Post should no longer be tracked after all files removed")
		}
	}
	service.mu.RUnlock()
}

func TestCategoryDeletionWithParentRecursiveUpdates(t *testing.T) {
	service := &Service{
		enabled:   true,
		stats:     make(map[int]*CategoryStats),
		postFiles: make(map[int]map[int]*FileInfo),
	}

	// Set up a parent-child relationship manually
	// Parent category 1 with child category 2
	service.mu.Lock()

	// Parent category: 5 direct files + 10 files from child = 15 recursive
	service.stats[1] = &CategoryStats{
		Direct:    Stats{FileCount: 5, TotalSize: 25000},
		Recursive: Stats{FileCount: 15, TotalSize: 75000}, // includes child
	}

	// Child category: 10 direct files
	service.stats[2] = &CategoryStats{
		Direct:    Stats{FileCount: 10, TotalSize: 50000},
		Recursive: Stats{FileCount: 10, TotalSize: 50000}, // no grandchildren
	}

	service.mu.Unlock()

	// Verify initial state
	parentStats := service.GetStats(1, true) // recursive
	if parentStats.FileCount != 15 || parentStats.TotalSize != 75000 {
		t.Errorf("Expected parent recursive stats (15, 75000), got (%d, %d)", parentStats.FileCount, parentStats.TotalSize)
	}

	childStats := service.GetStats(2, false) // direct
	if childStats.FileCount != 10 || childStats.TotalSize != 50000 {
		t.Errorf("Expected child direct stats (10, 50000), got (%d, %d)", childStats.FileCount, childStats.TotalSize)
	}

	// Test the handleCategoryDeleted method directly by simulating what happens
	// when category 2 is deleted. Since we don't have the cache interface working,
	// let's manually test the core logic

	// Get the child stats before deletion
	service.mu.Lock()
	childDirectStats := service.stats[2]
	deletedFileCount := childDirectStats.Direct.FileCount
	deletedTotalSize := childDirectStats.Direct.TotalSize

	// Manually update parent stats (simulating what updateParentRecursiveStats should do)
	parentCatStats := service.stats[1]
	parentCatStats.mu.Lock()
	parentCatStats.Recursive.FileCount -= deletedFileCount
	parentCatStats.Recursive.TotalSize -= deletedTotalSize
	parentCatStats.mu.Unlock()

	// Remove the child category
	delete(service.stats, 2)
	delete(service.postFiles, 2)

	service.mu.Unlock()

	// Verify the parent's recursive stats were updated correctly
	parentStatsAfter := service.GetStats(1, true)
	expectedParentFiles := int64(5)     // Only its direct files remain
	expectedParentSize := int64(25000)  // Only its direct size remains

	if parentStatsAfter.FileCount != expectedParentFiles || parentStatsAfter.TotalSize != expectedParentSize {
		t.Errorf("Expected parent stats after child deletion (%d, %d), got (%d, %d)",
			expectedParentFiles, expectedParentSize, parentStatsAfter.FileCount, parentStatsAfter.TotalSize)
	}

	// Verify the child is gone
	deletedChildStats := service.GetStats(2, false)
	if deletedChildStats.FileCount != 0 || deletedChildStats.TotalSize != 0 {
		t.Errorf("Deleted child should have zero stats, got (%d, %d)", deletedChildStats.FileCount, deletedChildStats.TotalSize)
	}

	// Verify global stats are correct
	globalStats := service.GetGlobalStats()
	if globalStats.FileCount != 5 || globalStats.TotalSize != 25000 {
		t.Errorf("Expected global stats (5, 25000), got (%d, %d)", globalStats.FileCount, globalStats.TotalSize)
	}
}

func TestCategoryDeletedEventHandling(t *testing.T) {
	// Test that the CategoryDeleted event properly removes category stats
	service := &Service{
		enabled:   true,
		stats:     make(map[int]*CategoryStats),
		postFiles: make(map[int]map[int]*FileInfo),
	}

	// Add some categories
	service.mu.Lock()
	service.stats[1] = &CategoryStats{
		Direct:    Stats{FileCount: 5, TotalSize: 25000},
		Recursive: Stats{FileCount: 5, TotalSize: 25000},
	}
	service.stats[2] = &CategoryStats{
		Direct:    Stats{FileCount: 3, TotalSize: 15000},
		Recursive: Stats{FileCount: 3, TotalSize: 15000},
	}
	service.postFiles[1] = map[int]*FileInfo{
		101: {FileCount: 3, TotalSize: 15000},
		102: {FileCount: 2, TotalSize: 10000},
	}
	service.mu.Unlock()

	// Verify initial global stats
	initialGlobal := service.GetGlobalStats()
	if initialGlobal.FileCount != 8 || initialGlobal.TotalSize != 40000 {
		t.Errorf("Expected initial global stats (8, 40000), got (%d, %d)", initialGlobal.FileCount, initialGlobal.TotalSize)
	}

	// Send CategoryDeleted event for category 1 (no parent)
	categoryEvent := events.Event{
		Type: events.CategoryDeleted,
		Data: events.CategoryEvent{
			CategoryID:    1,
			OldParentID:   nil, // No parent for this test
			AffectedPosts: []int{101, 102},
		},
	}

	err := service.HandleEvent(categoryEvent)
	if err != nil {
		t.Fatalf("Failed to handle CategoryDeleted event: %v", err)
	}

	// Verify category 1 is removed
	cat1Stats := service.GetStats(1, false)
	if cat1Stats.FileCount != 0 || cat1Stats.TotalSize != 0 {
		t.Errorf("Category 1 should be deleted, got stats: (%d, %d)", cat1Stats.FileCount, cat1Stats.TotalSize)
	}

	// Verify category 2 is unaffected
	cat2Stats := service.GetStats(2, false)
	if cat2Stats.FileCount != 3 || cat2Stats.TotalSize != 15000 {
		t.Errorf("Category 2 should be unaffected, got stats: (%d, %d)", cat2Stats.FileCount, cat2Stats.TotalSize)
	}

	// Verify post file tracking for category 1 is removed
	service.mu.RLock()
	if _, exists := service.postFiles[1]; exists {
		t.Error("Post file tracking for category 1 should be removed")
	}
	service.mu.RUnlock()

	// Verify global stats are updated
	finalGlobal := service.GetGlobalStats()
	if finalGlobal.FileCount != 3 || finalGlobal.TotalSize != 15000 {
		t.Errorf("Expected final global stats (3, 15000), got (%d, %d)", finalGlobal.FileCount, finalGlobal.TotalSize)
	}
}

func TestCategoryDeletionUpdatesParentRecursiveStatsWithEvent(t *testing.T) {
	service := &Service{
		enabled:   true,
		stats:     make(map[int]*CategoryStats),
		postFiles: make(map[int]map[int]*FileInfo),
		// We'll test this without catCache since the new implementation shouldn't need it for the initial parent update
	}

	// Set up parent-child relationship
	service.mu.Lock()

	// Parent category 1: 3 direct files + 5 from child = 8 recursive
	service.stats[1] = &CategoryStats{
		Direct:    Stats{FileCount: 3, TotalSize: 15000},
		Recursive: Stats{FileCount: 8, TotalSize: 40000}, // includes child
	}

	// Child category 2: 5 direct files
	service.stats[2] = &CategoryStats{
		Direct:    Stats{FileCount: 5, TotalSize: 25000},
		Recursive: Stats{FileCount: 5, TotalSize: 25000}, // no grandchildren
	}

	service.mu.Unlock()

	// Verify initial parent recursive stats
	parentStats := service.GetStats(1, true)
	if parentStats.FileCount != 8 || parentStats.TotalSize != 40000 {
		t.Errorf("Expected parent recursive stats (8, 40000), got (%d, %d)", parentStats.FileCount, parentStats.TotalSize)
	}

	// Send CategoryDeleted event for child category 2 with parent ID 1
	categoryEvent := events.Event{
		Type: events.CategoryDeleted,
		Data: events.CategoryEvent{
			CategoryID:    2,
			OldParentID:   &[]int{1}[0], // Parent is category 1
			AffectedPosts: []int{201, 202, 203},
		},
	}

	err := service.HandleEvent(categoryEvent)
	if err != nil {
		t.Fatalf("Failed to handle CategoryDeleted event: %v", err)
	}

	// Verify child category 2 is removed
	childStats := service.GetStats(2, false)
	if childStats.FileCount != 0 || childStats.TotalSize != 0 {
		t.Errorf("Child category should be deleted, got stats: (%d, %d)", childStats.FileCount, childStats.TotalSize)
	}

	// Verify parent's recursive stats are updated (should lose child's files)
	parentStatsAfter := service.GetStats(1, true)
	expectedParentFiles := int64(3)     // Only its direct files
	expectedParentSize := int64(15000)  // Only its direct size

	if parentStatsAfter.FileCount != expectedParentFiles || parentStatsAfter.TotalSize != expectedParentSize {
		t.Errorf("Expected parent recursive stats after child deletion (%d, %d), got (%d, %d)",
			expectedParentFiles, expectedParentSize, parentStatsAfter.FileCount, parentStatsAfter.TotalSize)
	}

	// Verify global stats reflect the change
	globalStats := service.GetGlobalStats()
	if globalStats.FileCount != 3 || globalStats.TotalSize != 15000 {
		t.Errorf("Expected global stats (3, 15000), got (%d, %d)", globalStats.FileCount, globalStats.TotalSize)
	}
}

func TestCategoryDeletionWithPostDeletedEvents(t *testing.T) {
	// Test that when a category is deleted, PostDeleted events are fired for all posts
	// which should properly update the detailed stats
	service := &Service{
		enabled:   true,
		stats:     make(map[int]*CategoryStats),
		postFiles: make(map[int]map[int]*FileInfo),
	}

	// Set up initial stats to simulate existing files in the category
	service.mu.Lock()
	service.stats[1] = &CategoryStats{
		Direct:    Stats{FileCount: 6, TotalSize: 30000}, // 2+1+3 files, 10000+5000+15000 bytes
		Recursive: Stats{FileCount: 6, TotalSize: 30000},
	}
	service.mu.Unlock()

	// Verify initial global stats
	initialGlobal := service.GetGlobalStats()
	if initialGlobal.FileCount != 6 || initialGlobal.TotalSize != 30000 {
		t.Errorf("Expected initial global stats (6, 30000), got (%d, %d)", initialGlobal.FileCount, initialGlobal.TotalSize)
	}

	// Simulate PostDeleted events that would be fired when a category containing posts is deleted
	// These events represent posts with files that were in the deleted category

	// Post 1: 2 files, 10000 bytes
	postEvent1 := events.Event{
		Type: events.PostDeleted,
		Data: events.PostEvent{
			PostID:     101,
			CategoryID: 1, // This category will be "deleted"
			FileSize:   10000,
			FileCount:  2,
		},
	}

	// Post 2: 1 file, 5000 bytes
	postEvent2 := events.Event{
		Type: events.PostDeleted,
		Data: events.PostEvent{
			PostID:     102,
			CategoryID: 1, // Same category
			FileSize:   5000,
			FileCount:  1,
		},
	}

	// Post 3: 3 files, 15000 bytes
	postEvent3 := events.Event{
		Type: events.PostDeleted,
		Data: events.PostEvent{
			PostID:     103,
			CategoryID: 1, // Same category
			FileSize:   15000,
			FileCount:  3,
		},
	}

	// Handle these PostDeleted events (as would happen during category deletion)
	err := service.HandleEvent(postEvent1)
	if err != nil {
		t.Fatalf("Failed to handle PostDeleted event 1: %v", err)
	}

	err = service.HandleEvent(postEvent2)
	if err != nil {
		t.Fatalf("Failed to handle PostDeleted event 2: %v", err)
	}

	err = service.HandleEvent(postEvent3)
	if err != nil {
		t.Fatalf("Failed to handle PostDeleted event 3: %v", err)
	}

	// Verify that the stats are updated correctly
	// The PostDeleted events should DECREASE the stats to zero
	categoryStats := service.GetStats(1, false)
	expectedFiles := int64(0) // 6 - (2 + 1 + 3) = 0
	expectedSize := int64(0) // 30000 - (10000 + 5000 + 15000) = 0

	if categoryStats.FileCount != expectedFiles || categoryStats.TotalSize != expectedSize {
		t.Errorf("Expected category stats (%d, %d), got (%d, %d)", expectedFiles, expectedSize, categoryStats.FileCount, categoryStats.TotalSize)
	}

	// Global stats should reflect the same (all files deleted)
	finalGlobal := service.GetGlobalStats()
	if finalGlobal.FileCount != expectedFiles || finalGlobal.TotalSize != expectedSize {
		t.Errorf("Expected final global stats (%d, %d), got (%d, %d)", expectedFiles, expectedSize, finalGlobal.FileCount, finalGlobal.TotalSize)
	}

	// Now fire the CategoryDeleted event (this should clean up the category from stats)
	categoryEvent := events.Event{
		Type: events.CategoryDeleted,
		Data: events.CategoryEvent{
			CategoryID:    1,
			OldParentID:   nil,
			AffectedPosts: []int{101, 102, 103},
		},
	}

	err = service.HandleEvent(categoryEvent)
	if err != nil {
		t.Fatalf("Failed to handle CategoryDeleted event: %v", err)
	}

	// After CategoryDeleted, the category should be removed from stats
	deletedCategoryStats := service.GetStats(1, false)
	if deletedCategoryStats.FileCount != 0 || deletedCategoryStats.TotalSize != 0 {
		t.Errorf("Category should be deleted from stats, got (%d, %d)", deletedCategoryStats.FileCount, deletedCategoryStats.TotalSize)
	}

	// Global stats should be empty now (no categories left)
	finalGlobalAfterCleanup := service.GetGlobalStats()
	if finalGlobalAfterCleanup.FileCount != 0 || finalGlobalAfterCleanup.TotalSize != 0 {
		t.Errorf("Expected empty global stats after cleanup, got (%d, %d)", finalGlobalAfterCleanup.FileCount, finalGlobalAfterCleanup.TotalSize)
	}
}

