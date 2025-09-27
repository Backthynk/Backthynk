package cache

import (
	"sync"
	"time"
	"unsafe"
)

// PostCountCache manages post counts for categories with hot updates
type PostCountCache struct {
	counts      map[int]int // categoryID -> post count
	hierarchy   map[int][]int // parentID -> []childIDs
	mutex       sync.RWMutex
	lastUpdate  int64 // Unix timestamp in milliseconds
}

var postCountCache *PostCountCache
var postCountCacheOnce sync.Once

// GetPostCountCache returns the global post count cache instance
func GetPostCountCache() *PostCountCache {
	postCountCacheOnce.Do(func() {
		postCountCache = &PostCountCache{
			counts:     make(map[int]int),
			hierarchy:  make(map[int][]int),
			lastUpdate: time.Now().UnixMilli(),
		}
	})
	return postCountCache
}

// RefreshCache rebuilds the entire post count cache from database data
func (pcc *PostCountCache) RefreshCache(counts map[int]int) error {
	pcc.mutex.Lock()
	defer pcc.mutex.Unlock()

	// Clear existing cache
	pcc.counts = make(map[int]int)

	// Populate cache
	for categoryID, count := range counts {
		pcc.counts[categoryID] = count
	}

	pcc.lastUpdate = time.Now().UnixMilli()
	return nil
}

// SetHierarchy sets the category hierarchy for recursive counting
func (pcc *PostCountCache) SetHierarchy(hierarchy map[int][]int) {
	pcc.mutex.Lock()
	defer pcc.mutex.Unlock()

	pcc.hierarchy = make(map[int][]int)
	for parentID, children := range hierarchy {
		pcc.hierarchy[parentID] = make([]int, len(children))
		copy(pcc.hierarchy[parentID], children)
	}
}

// GetPostCount returns the cached post count for a category
func (pcc *PostCountCache) GetPostCount(categoryID int) int {
	pcc.mutex.RLock()
	defer pcc.mutex.RUnlock()

	return pcc.counts[categoryID] // Returns 0 if not found
}

// GetPostCountRecursive returns the cached post count for a category including all descendants
func (pcc *PostCountCache) GetPostCountRecursive(categoryID int) int {
	pcc.mutex.RLock()
	defer pcc.mutex.RUnlock()

	// Start with the category's own count
	total := pcc.counts[categoryID]

	// Recursively add counts from all descendants
	total += pcc.getDescendantCounts(categoryID)

	return total
}

// getDescendantCounts recursively calculates post counts for all descendants
// Note: This method assumes the caller already holds the read lock
func (pcc *PostCountCache) getDescendantCounts(categoryID int) int {
	total := 0

	// Get direct children
	children, exists := pcc.hierarchy[categoryID]
	if !exists {
		return 0
	}

	// Add counts from direct children and their descendants
	for _, childID := range children {
		total += pcc.counts[childID]                    // Direct count
		total += pcc.getDescendantCounts(childID)       // Recursive descendants
	}

	return total
}

// SetPostCount sets the post count for a category (used during initialization)
func (pcc *PostCountCache) SetPostCount(categoryID int, count int) {
	pcc.mutex.Lock()
	defer pcc.mutex.Unlock()

	pcc.counts[categoryID] = count
	pcc.lastUpdate = time.Now().UnixMilli()
}

// UpdatePostCount updates the post count for a category
func (pcc *PostCountCache) UpdatePostCount(categoryID int, delta int) {
	pcc.mutex.Lock()
	defer pcc.mutex.Unlock()

	pcc.counts[categoryID] += delta
	if pcc.counts[categoryID] < 0 {
		pcc.counts[categoryID] = 0
	}
	pcc.lastUpdate = time.Now().UnixMilli()
}

// GetAllCounts returns a copy of all post counts
func (pcc *PostCountCache) GetAllCounts() map[int]int {
	pcc.mutex.RLock()
	defer pcc.mutex.RUnlock()

	result := make(map[int]int, len(pcc.counts))
	for categoryID, count := range pcc.counts {
		result[categoryID] = count
	}
	return result
}

// GetTotalPostCount returns the sum of all cached post counts
func (pcc *PostCountCache) GetTotalPostCount() int {
	pcc.mutex.RLock()
	defer pcc.mutex.RUnlock()

	total := 0
	for _, count := range pcc.counts {
		total += count
	}
	return total
}

// GetCacheStats returns post count cache statistics
func (pcc *PostCountCache) GetCacheStats() map[string]interface{} {
	pcc.mutex.RLock()
	defer pcc.mutex.RUnlock()

	totalMemoryBytes := int64(0)
	categoriesCount := len(pcc.counts)

	// Calculate base cache overhead
	totalMemoryBytes += int64(unsafe.Sizeof(*pcc))
	totalMemoryBytes += int64(len(pcc.counts)) * int64(unsafe.Sizeof(int(0))*2) // key + value

	return map[string]interface{}{
		"categories_cached": categoriesCount,
		"cache_size_bytes":  totalMemoryBytes,
		"cache_size_mb":     float64(totalMemoryBytes) / (1024 * 1024),
		"last_update":       pcc.lastUpdate,
		"memory_efficient":  true,
	}
}

// IsEmpty returns true if the cache is empty
func (pcc *PostCountCache) IsEmpty() bool {
	pcc.mutex.RLock()
	defer pcc.mutex.RUnlock()
	return len(pcc.counts) == 0
}