package services

import (
	"backthynk/internal/cache"
	"backthynk/internal/storage"
	"fmt"
	"log"
	"time"
)

type PostCountService struct {
	db              *storage.DB
	cache           *cache.PostCountCache
	coordinator     *cache.CacheCoordinator
	categoryService *CategoryService
}

func NewPostCountService(db *storage.DB, categoryService *CategoryService) *PostCountService {
	return &PostCountService{
		db:              db,
		cache:           cache.GetPostCountCache(),
		coordinator:     cache.GetCacheCoordinator(),
		categoryService: categoryService,
	}
}

// InitializeCache loads all post counts from database into cache
func (pcs *PostCountService) InitializeCache() error {
	log.Println("Initializing post count cache...")
	start := time.Now()

	// Get post counts for all categories
	query := "SELECT category_id, COUNT(*) FROM posts GROUP BY category_id"
	rows, err := pcs.db.Query(query)
	if err != nil {
		return fmt.Errorf("failed to load post counts for cache: %w", err)
	}
	defer rows.Close()

	countMap := make(map[int]int)
	for rows.Next() {
		var categoryID, count int
		err := rows.Scan(&categoryID, &count)
		if err != nil {
			return fmt.Errorf("failed to scan post count: %w", err)
		}
		countMap[categoryID] = count
	}

	// Get categories to build hierarchy
	categories, err := pcs.categoryService.GetCategories()
	if err != nil {
		return fmt.Errorf("failed to get categories for hierarchy: %w", err)
	}

	// Build hierarchy map
	hierarchy := make(map[int][]int) // parentID -> []childIDs
	for _, cat := range categories {
		if cat.ParentID != nil {
			hierarchy[*cat.ParentID] = append(hierarchy[*cat.ParentID], cat.ID)
		}
	}

	// Set hierarchy in cache
	pcs.cache.SetHierarchy(hierarchy)

	// Refresh cache with new data
	err = pcs.cache.RefreshCache(countMap)
	if err != nil {
		return err
	}

	elapsed := time.Since(start)
	stats := pcs.cache.GetCacheStats()
	log.Printf("Post count cache initialized in %v. Stats: %+v", elapsed, stats)

	return nil
}

// GetPostCount returns the post count for a category (non-recursive)
func (pcs *PostCountService) GetPostCount(categoryID int) int {
	return pcs.cache.GetPostCount(categoryID)
}

// GetPostCountRecursive returns the post count for a category including descendants
func (pcs *PostCountService) GetPostCountRecursive(categoryID int) int {
	// Use the fully cached recursive method - no database calls!
	return pcs.cache.GetPostCountRecursive(categoryID)
}

// GetTotalPostCount returns the total post count across all categories
func (pcs *PostCountService) GetTotalPostCount() int {
	return pcs.cache.GetTotalPostCount()
}

// OnPostCreated updates the cache when a post is created
func (pcs *PostCountService) OnPostCreated(categoryID int) {
	pcs.OnPostCreatedWithTimestamp(categoryID, time.Now().UnixMilli())
}

// OnPostCreatedWithTimestamp updates the cache when a post is created with specific timestamp
func (pcs *PostCountService) OnPostCreatedWithTimestamp(categoryID int, timestamp int64) {
	pcs.coordinator.ProcessEvent(cache.CacheEvent{
		Type:       cache.EventPostCreated,
		CategoryID: categoryID,
		Timestamp:  timestamp,
	})
}

// OnPostDeleted updates the cache when a post is deleted
func (pcs *PostCountService) OnPostDeleted(categoryID int) {
	pcs.OnPostDeletedWithTimestamp(categoryID, time.Now().UnixMilli())
}

// OnPostDeletedWithTimestamp updates the cache when a post is deleted with specific timestamp
func (pcs *PostCountService) OnPostDeletedWithTimestamp(categoryID int, timestamp int64) {
	pcs.coordinator.ProcessEvent(cache.CacheEvent{
		Type:       cache.EventPostDeleted,
		CategoryID: categoryID,
		Timestamp:  timestamp,
	})
}

// OnPostMoved updates the cache when a post is moved between categories
func (pcs *PostCountService) OnPostMoved(fromCategoryID, toCategoryID int) {
	pcs.OnPostMovedWithTimestamp(fromCategoryID, toCategoryID, time.Now().UnixMilli())
}

// OnPostMovedWithTimestamp updates the cache when a post is moved between categories with specific timestamp
func (pcs *PostCountService) OnPostMovedWithTimestamp(fromCategoryID, toCategoryID int, timestamp int64) {
	pcs.coordinator.ProcessEvent(cache.CacheEvent{
		Type:       cache.EventPostMoved,
		CategoryID: fromCategoryID,
		Timestamp:  timestamp,
		Data:       toCategoryID,
	})
}

// RefreshCache manually refreshes the cache from database
func (pcs *PostCountService) RefreshCache() error {
	return pcs.InitializeCache()
}

// GetCacheStats returns cache statistics
func (pcs *PostCountService) GetCacheStats() map[string]interface{} {
	stats := pcs.cache.GetCacheStats()
	stats["cache_enabled"] = true
	return stats
}