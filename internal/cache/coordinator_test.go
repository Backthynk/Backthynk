package cache

import (
	"backthynk/internal/models"
	"testing"
	"time"
)

func TestCacheCoordinator_InitializeHierarchy(t *testing.T) {
	coordinator := GetCacheCoordinator()

	categories := []models.Category{
		{ID: 1, Name: "Technology", ParentID: nil, Depth: 0},
		{ID: 2, Name: "Software", ParentID: intPtr(1), Depth: 1},
		{ID: 3, Name: "Hardware", ParentID: intPtr(1), Depth: 1},
		{ID: 4, Name: "Programming", ParentID: intPtr(2), Depth: 2},
	}

	err := coordinator.InitializeHierarchy(categories)
	if err != nil {
		t.Fatalf("InitializeHierarchy failed: %v", err)
	}

	stats := coordinator.GetStats()
	if stats["hierarchy_categories"].(int) == 0 {
		t.Error("Hierarchy should have categories")
	}

	if stats["parent_mappings"].(int) != 3 { // 3 categories have parents
		t.Errorf("Expected 3 parent mappings, got %d", stats["parent_mappings"].(int))
	}
}

func TestCacheCoordinator_PostOperations(t *testing.T) {
	coordinator := GetCacheCoordinator()
	postCountCache := GetPostCountCache()

	// Setup test hierarchy
	categories := []models.Category{
		{ID: 1, Name: "Technology", ParentID: nil, Depth: 0},
		{ID: 2, Name: "Software", ParentID: intPtr(1), Depth: 1},
	}

	err := coordinator.InitializeHierarchy(categories)
	if err != nil {
		t.Fatalf("Failed to initialize hierarchy: %v", err)
	}

	// Set initial counts
	postCountCache.SetPostCount(1, 10)
	postCountCache.SetPostCount(2, 5)

	initialTech := postCountCache.GetPostCountRecursive(1)
	initialSoftware := postCountCache.GetPostCount(2)

	// Test post creation
	coordinator.ProcessEvent(CacheEvent{
		Type:       EventPostCreated,
		CategoryID: 2,
		Timestamp:  time.Now().UnixMilli(),
	})

	// Wait for processing
	time.Sleep(100 * time.Millisecond)

	afterSoftware := postCountCache.GetPostCount(2)
	afterTech := postCountCache.GetPostCountRecursive(1)

	if afterSoftware != initialSoftware+1 {
		t.Errorf("Post creation failed: expected %d, got %d", initialSoftware+1, afterSoftware)
	}

	if afterTech != initialTech+1 {
		t.Errorf("Recursive count not updated: expected %d, got %d", initialTech+1, afterTech)
	}
}

func TestCacheCoordinator_PostMove(t *testing.T) {
	coordinator := GetCacheCoordinator()
	postCountCache := GetPostCountCache()

	// Setup test hierarchy
	categories := []models.Category{
		{ID: 1, Name: "Technology", ParentID: nil, Depth: 0},
		{ID: 2, Name: "Software", ParentID: intPtr(1), Depth: 1},
		{ID: 3, Name: "Hardware", ParentID: intPtr(1), Depth: 1},
	}

	err := coordinator.InitializeHierarchy(categories)
	if err != nil {
		t.Fatalf("Failed to initialize hierarchy: %v", err)
	}

	// Set initial counts
	postCountCache.SetPostCount(2, 5) // Software
	postCountCache.SetPostCount(3, 3) // Hardware

	initialSoftware := postCountCache.GetPostCount(2)
	initialHardware := postCountCache.GetPostCount(3)

	// Test post move
	coordinator.ProcessEvent(CacheEvent{
		Type:       EventPostMoved,
		CategoryID: 2, // From Software
		Timestamp:  time.Now().UnixMilli(),
		Data:       3, // To Hardware
	})

	time.Sleep(100 * time.Millisecond)

	afterSoftware := postCountCache.GetPostCount(2)
	afterHardware := postCountCache.GetPostCount(3)

	if afterSoftware != initialSoftware-1 {
		t.Errorf("Post move source failed: expected %d, got %d", initialSoftware-1, afterSoftware)
	}

	if afterHardware != initialHardware+1 {
		t.Errorf("Post move target failed: expected %d, got %d", initialHardware+1, afterHardware)
	}
}

func TestCacheCoordinator_CategoryMove(t *testing.T) {
	coordinator := GetCacheCoordinator()
	postCountCache := GetPostCountCache()

	// Setup test hierarchy
	categories := []models.Category{
		{ID: 1, Name: "Technology", ParentID: nil, Depth: 0},
		{ID: 2, Name: "Software", ParentID: intPtr(1), Depth: 1},
		{ID: 3, Name: "Hardware", ParentID: nil, Depth: 0},
		{ID: 4, Name: "Programming", ParentID: intPtr(2), Depth: 2},
	}

	err := coordinator.InitializeHierarchy(categories)
	if err != nil {
		t.Fatalf("Failed to initialize hierarchy: %v", err)
	}

	// Set initial counts
	postCountCache.SetPostCount(1, 10) // Technology
	postCountCache.SetPostCount(2, 5)  // Software
	postCountCache.SetPostCount(3, 8)  // Hardware
	postCountCache.SetPostCount(4, 3)  // Programming

	initialTech := postCountCache.GetPostCountRecursive(1)
	initialHardware := postCountCache.GetPostCountRecursive(3)
	programmingCount := postCountCache.GetPostCount(4)

	// Move Programming from Software/Technology to Hardware
	coordinator.ProcessEvent(CacheEvent{
		Type:        EventCategoryMoved,
		CategoryID:  4, // Programming
		OldParentID: intPtr(2), // Software
		NewParentID: intPtr(3), // Hardware
		Timestamp:   time.Now().UnixMilli(),
	})

	time.Sleep(200 * time.Millisecond)

	afterTech := postCountCache.GetPostCountRecursive(1)
	afterHardware := postCountCache.GetPostCountRecursive(3)

	expectedTech := initialTech - programmingCount
	expectedHardware := initialHardware + programmingCount

	if afterTech != expectedTech {
		t.Errorf("Technology recursive count after move: expected %d, got %d", expectedTech, afterTech)
	}

	if afterHardware != expectedHardware {
		t.Errorf("Hardware recursive count after move: expected %d, got %d", expectedHardware, afterHardware)
	}
}

func TestCacheCoordinator_FileOperations(t *testing.T) {
	coordinator := GetCacheCoordinator()
	fileStatsCache := GetFileStatsCache()

	// Enable file stats cache for this test
	coordinator.SetCacheFlags(true, true, true)

	// Setup test hierarchy
	categories := []models.Category{
		{ID: 1, Name: "Technology", ParentID: nil, Depth: 0},
		{ID: 2, Name: "Software", ParentID: intPtr(1), Depth: 1},
	}

	err := coordinator.InitializeHierarchy(categories)
	if err != nil {
		t.Fatalf("Failed to initialize hierarchy: %v", err)
	}

	fileSize := int64(1024000) // 1MB

	// Test file addition
	coordinator.ProcessEvent(CacheEvent{
		Type:       EventFileAdded,
		CategoryID: 2,
		Timestamp:  time.Now().UnixMilli(),
		FileSize:   fileSize,
	})

	time.Sleep(100 * time.Millisecond)

	stats := fileStatsCache.GetCategoryFileStats(2)
	if stats == nil {
		t.Fatal("File stats should be created")
	}

	stats.Mutex.RLock()
	directCount := stats.Direct.FileCount
	directSize := stats.Direct.TotalSize
	stats.Mutex.RUnlock()

	if directCount != 1 {
		t.Errorf("Expected file count 1, got %d", directCount)
	}

	if directSize != fileSize {
		t.Errorf("Expected file size %d, got %d", fileSize, directSize)
	}

	// Test file deletion
	coordinator.ProcessEvent(CacheEvent{
		Type:       EventFileDeleted,
		CategoryID: 2,
		Timestamp:  time.Now().UnixMilli(),
		FileSize:   fileSize,
	})

	time.Sleep(100 * time.Millisecond)

	stats.Mutex.RLock()
	afterCount := stats.Direct.FileCount
	afterSize := stats.Direct.TotalSize
	stats.Mutex.RUnlock()

	if afterCount != 0 {
		t.Errorf("Expected file count 0 after deletion, got %d", afterCount)
	}

	if afterSize != 0 {
		t.Errorf("Expected file size 0 after deletion, got %d", afterSize)
	}
}

func TestCacheCoordinator_DisabledCaches(t *testing.T) {
	coordinator := GetCacheCoordinator()
	postCountCache := GetPostCountCache()

	// Disable optional caches
	coordinator.SetCacheFlags(false, false, false)

	// Setup test hierarchy
	categories := []models.Category{
		{ID: 1, Name: "Technology", ParentID: nil, Depth: 0},
		{ID: 2, Name: "Software", ParentID: intPtr(1), Depth: 1},
	}

	err := coordinator.InitializeHierarchy(categories)
	if err != nil {
		t.Fatalf("Failed to initialize hierarchy: %v", err)
	}

	// Set initial counts
	postCountCache.SetPostCount(1, 10)
	postCountCache.SetPostCount(2, 5)

	initialCount := postCountCache.GetPostCount(2)

	// Test that mandatory cache still works
	coordinator.ProcessEvent(CacheEvent{
		Type:       EventPostCreated,
		CategoryID: 2,
		Timestamp:  time.Now().UnixMilli(),
	})

	time.Sleep(100 * time.Millisecond)

	afterCount := postCountCache.GetPostCount(2)
	if afterCount != initialCount+1 {
		t.Errorf("Mandatory cache should still work: expected %d, got %d", initialCount+1, afterCount)
	}

	// Test that optional cache operations don't crash
	coordinator.ProcessEvent(CacheEvent{
		Type:       EventFileAdded,
		CategoryID: 2,
		Timestamp:  time.Now().UnixMilli(),
		FileSize:   1024000,
	})

	time.Sleep(100 * time.Millisecond)

	// Should not crash - verify post count cache still works
	finalCount := postCountCache.GetPostCount(2)
	if finalCount != afterCount {
		t.Errorf("Post count should be unchanged after disabled cache operation: expected %d, got %d", afterCount, finalCount)
	}
}

func intPtr(i int) *int {
	return &i
}