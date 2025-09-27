package cache

import (
	"testing"
)

func TestPostCountCache_BasicOperations(t *testing.T) {
	cache := GetPostCountCache()

	// Test setting post count
	cache.SetPostCount(1, 10)
	cache.SetPostCount(2, 5)

	// Test getting post count
	count1 := cache.GetPostCount(1)
	if count1 != 10 {
		t.Errorf("Expected count 10, got %d", count1)
	}

	count2 := cache.GetPostCount(2)
	if count2 != 5 {
		t.Errorf("Expected count 5, got %d", count2)
	}

	// Test non-existent category
	count3 := cache.GetPostCount(999)
	if count3 != 0 {
		t.Errorf("Expected count 0 for non-existent category, got %d", count3)
	}
}

func TestPostCountCache_UpdateOperations(t *testing.T) {
	cache := GetPostCountCache()

	// Set initial count
	cache.SetPostCount(1, 10)

	// Test positive update
	cache.UpdatePostCount(1, 5)
	count := cache.GetPostCount(1)
	if count != 15 {
		t.Errorf("Expected count 15 after +5 update, got %d", count)
	}

	// Test negative update
	cache.UpdatePostCount(1, -3)
	count = cache.GetPostCount(1)
	if count != 12 {
		t.Errorf("Expected count 12 after -3 update, got %d", count)
	}

	// Test negative update that would go below zero
	cache.UpdatePostCount(1, -20)
	count = cache.GetPostCount(1)
	if count != 0 {
		t.Errorf("Expected count 0 (clamped) after large negative update, got %d", count)
	}
}

func TestPostCountCache_RecursiveCounting(t *testing.T) {
	cache := GetPostCountCache()

	// Setup hierarchy: 1 -> 2 -> 3
	//                     -> 4
	hierarchy := map[int][]int{
		1: {2},
		2: {3, 4},
	}
	cache.SetHierarchy(hierarchy)

	// Set post counts
	cache.SetPostCount(1, 10) // Root
	cache.SetPostCount(2, 5)  // Child of 1
	cache.SetPostCount(3, 3)  // Child of 2
	cache.SetPostCount(4, 2)  // Child of 2

	// Test recursive counting
	recursive1 := cache.GetPostCountRecursive(1)
	expected1 := 10 + 5 + 3 + 2 // 20
	if recursive1 != expected1 {
		t.Errorf("Category 1 recursive count: expected %d, got %d", expected1, recursive1)
	}

	recursive2 := cache.GetPostCountRecursive(2)
	expected2 := 5 + 3 + 2 // 10
	if recursive2 != expected2 {
		t.Errorf("Category 2 recursive count: expected %d, got %d", expected2, recursive2)
	}

	recursive3 := cache.GetPostCountRecursive(3)
	expected3 := 3 // No children
	if recursive3 != expected3 {
		t.Errorf("Category 3 recursive count: expected %d, got %d", expected3, recursive3)
	}

	// Test category without hierarchy
	recursive999 := cache.GetPostCountRecursive(999)
	if recursive999 != 0 {
		t.Errorf("Non-existent category recursive count: expected 0, got %d", recursive999)
	}
}

func TestPostCountCache_ComplexHierarchy(t *testing.T) {
	cache := GetPostCountCache()

	// Setup more complex hierarchy:
	//   1
	//  / \
	// 2   3
	// |   |\
	// 4   5 6
	//     |
	//     7
	hierarchy := map[int][]int{
		1: {2, 3},
		2: {4},
		3: {5, 6},
		5: {7},
	}
	cache.SetHierarchy(hierarchy)

	// Set post counts
	cache.SetPostCount(1, 10) // Root
	cache.SetPostCount(2, 8)  // Child of 1
	cache.SetPostCount(3, 6)  // Child of 1
	cache.SetPostCount(4, 4)  // Child of 2
	cache.SetPostCount(5, 3)  // Child of 3
	cache.SetPostCount(6, 2)  // Child of 3
	cache.SetPostCount(7, 1)  // Child of 5

	// Test recursive counting at different levels
	recursive1 := cache.GetPostCountRecursive(1)
	expected1 := 10 + 8 + 6 + 4 + 3 + 2 + 1 // 34
	if recursive1 != expected1 {
		t.Errorf("Category 1 (root) recursive count: expected %d, got %d", expected1, recursive1)
	}

	recursive3 := cache.GetPostCountRecursive(3)
	expected3 := 6 + 3 + 2 + 1 // 12 (includes 5, 6, 7)
	if recursive3 != expected3 {
		t.Errorf("Category 3 recursive count: expected %d, got %d", expected3, recursive3)
	}

	recursive5 := cache.GetPostCountRecursive(5)
	expected5 := 3 + 1 // 4 (includes 7)
	if recursive5 != expected5 {
		t.Errorf("Category 5 recursive count: expected %d, got %d", expected5, recursive5)
	}

	recursive7 := cache.GetPostCountRecursive(7)
	expected7 := 1 // Leaf node
	if recursive7 != expected7 {
		t.Errorf("Category 7 (leaf) recursive count: expected %d, got %d", expected7, recursive7)
	}
}

func TestPostCountCache_AllCounts(t *testing.T) {
	cache := GetPostCountCache()

	// Clear and set test data
	cache.RefreshCache(map[int]int{
		1: 10,
		2: 20,
		3: 30,
	})

	allCounts := cache.GetAllCounts()

	if len(allCounts) != 3 {
		t.Errorf("Expected 3 categories, got %d", len(allCounts))
	}

	if allCounts[1] != 10 || allCounts[2] != 20 || allCounts[3] != 30 {
		t.Errorf("Incorrect counts in GetAllCounts: %+v", allCounts)
	}

	totalCount := cache.GetTotalPostCount()
	expectedTotal := 60
	if totalCount != expectedTotal {
		t.Errorf("Expected total count %d, got %d", expectedTotal, totalCount)
	}
}

func TestPostCountCache_CacheStats(t *testing.T) {
	cache := GetPostCountCache()

	// Set some test data
	cache.SetPostCount(1, 100)
	cache.SetPostCount(2, 200)

	stats := cache.GetCacheStats()

	if !stats["memory_efficient"].(bool) {
		t.Error("Cache should be marked as memory efficient")
	}

	if stats["categories_cached"].(int) < 2 {
		t.Errorf("Should have at least 2 categories cached, got %d", stats["categories_cached"].(int))
	}

	if stats["cache_size_bytes"].(int64) <= 0 {
		t.Error("Cache size should be > 0")
	}

	if stats["cache_size_mb"].(float64) <= 0 {
		t.Error("Cache size in MB should be > 0")
	}
}

func TestPostCountCache_EmptyState(t *testing.T) {
	cache := GetPostCountCache()

	// Test with empty cache
	cache.RefreshCache(map[int]int{})

	if !cache.IsEmpty() {
		t.Error("Cache should be empty after refreshing with empty map")
	}

	totalCount := cache.GetTotalPostCount()
	if totalCount != 0 {
		t.Errorf("Total count should be 0 for empty cache, got %d", totalCount)
	}

	allCounts := cache.GetAllCounts()
	if len(allCounts) != 0 {
		t.Errorf("All counts should be empty, got %d entries", len(allCounts))
	}
}