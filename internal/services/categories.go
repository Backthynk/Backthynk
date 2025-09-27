package services

import (
	"backthynk/internal/cache"
	"backthynk/internal/models"
	"backthynk/internal/storage"
	"fmt"
	"log"
	"time"
)

type CategoryService struct {
	db           *storage.DB
	cache        *cache.CategoryCache
	cacheEnabled bool
}

func NewCategoryService(db *storage.DB, cacheEnabled bool) *CategoryService {
	return &CategoryService{
		db:           db,
		cache:        cache.GetCategoryCache(),
		cacheEnabled: cacheEnabled,
	}
}

// SetCacheEnabled updates the cache enabled setting
func (cs *CategoryService) SetCacheEnabled(enabled bool) {
	cs.cacheEnabled = enabled
}

// InitializeCache loads all categories from database into cache
func (cs *CategoryService) InitializeCache() error {
	if !cs.cacheEnabled {
		return nil
	}

	log.Println("Initializing category cache...")
	start := time.Now()

	categories, err := cs.db.GetCategories()
	if err != nil {
		return fmt.Errorf("failed to load categories for cache: %w", err)
	}

	log.Printf("Processing %d categories...", len(categories))

	err = cs.cache.RefreshCache(categories)
	if err != nil {
		return err
	}

	// Initialize post counts as well
	err = cs.InitializePostCounts()
	if err != nil {
		log.Printf("Warning: failed to initialize post counts: %v", err)
	}

	elapsed := time.Since(start)
	stats := cs.cache.GetCacheStats()
	log.Printf("Category cache initialized in %v. Stats: %+v", elapsed, stats)

	return nil
}

// GetCategory returns a category by ID, using cache if enabled and available
func (cs *CategoryService) GetCategory(id int) (*models.Category, error) {
	if cs.cacheEnabled {
		if category, found := cs.cache.GetCategory(id); found {
			return category, nil
		}
		// If not in cache, fall back to database (cache should have been initialized at startup)
	}

	// Fall back to database
	return cs.db.GetCategory(id)
}

// GetCategories returns all categories, using cache if enabled and available
func (cs *CategoryService) GetCategories() ([]models.Category, error) {
	if cs.cacheEnabled {
		return cs.cache.GetCategories(), nil
	}

	// Fall back to database
	return cs.db.GetCategories()
}

// GetCategoriesByParent returns categories by parent ID, using cache if enabled and available
func (cs *CategoryService) GetCategoriesByParent(parentID *int) ([]models.Category, error) {
	if cs.cacheEnabled {
		return cs.cache.GetCategoriesByParent(parentID), nil
	}

	// Fall back to database
	return cs.db.GetCategoriesByParent(parentID)
}

// CreateCategory creates a new category and updates the cache if enabled
func (cs *CategoryService) CreateCategory(name string, parentID *int, description string) (*models.Category, error) {
	// Create in database first
	category, err := cs.db.CreateCategory(name, parentID, description)
	if err != nil {
		return nil, err
	}

	// Update cache if enabled
	if cs.cacheEnabled {
		cs.cache.AddCategory(category)
	}

	return category, nil
}

// UpdateCategory updates a category and updates the cache if enabled
func (cs *CategoryService) UpdateCategory(id int, name string, description string, newParentID *int) (*models.Category, error) {
	// Update in database first
	category, err := cs.db.UpdateCategory(id, name, description, newParentID)
	if err != nil {
		return nil, err
	}

	// Update cache if enabled
	if cs.cacheEnabled {
		cs.cache.UpdateCategory(category)
	}

	return category, nil
}

// DeleteCategory deletes a category and removes it from cache if enabled
func (cs *CategoryService) DeleteCategory(id int) error {
	// Delete from database first
	err := cs.db.DeleteCategory(id)
	if err != nil {
		return err
	}

	// Remove from cache if enabled
	if cs.cacheEnabled {
		cs.cache.RemoveCategory(id)
	}

	return nil
}

// GetCacheStats returns cache statistics if caching is enabled
func (cs *CategoryService) GetCacheStats() map[string]interface{} {
	if !cs.cacheEnabled {
		return map[string]interface{}{
			"cache_enabled": false,
		}
	}

	stats := cs.cache.GetCacheStats()
	stats["cache_enabled"] = true
	return stats
}

// RefreshCache manually refreshes the cache from database
func (cs *CategoryService) RefreshCache() error {
	if !cs.cacheEnabled {
		return fmt.Errorf("cache is not enabled")
	}

	return cs.InitializeCache()
}

// GetCategoryWithCount returns a category with its cached post count if caching is enabled
func (cs *CategoryService) GetCategoryWithCount(id int) (*cache.CategoryWithCount, error) {
	if cs.cacheEnabled {
		if categoryWithCount, found := cs.cache.GetCategoryWithCount(id); found {
			return categoryWithCount, nil
		}
		// If not in cache, fall back to database query
	}

	// Fall back to database query
	category, err := cs.db.GetCategory(id)
	if err != nil {
		return nil, err
	}

	// Get post count from database
	postCount, err := cs.getPostCountFromDB(id)
	if err != nil {
		return nil, err
	}

	return &cache.CategoryWithCount{
		Category:  *category,
		PostCount: postCount,
	}, nil
}

// GetCategoriesWithCount returns all categories with their cached post counts if caching is enabled
func (cs *CategoryService) GetCategoriesWithCount() ([]cache.CategoryWithCount, error) {
	if cs.cacheEnabled {
		return cs.cache.GetCategoriesWithCount(), nil
	}

	// Fall back to database query
	categories, err := cs.db.GetCategories()
	if err != nil {
		return nil, err
	}

	result := make([]cache.CategoryWithCount, len(categories))
	for i, category := range categories {
		postCount, err := cs.getPostCountFromDB(category.ID)
		if err != nil {
			return nil, err
		}

		result[i] = cache.CategoryWithCount{
			Category:  category,
			PostCount: postCount,
		}
	}

	return result, nil
}

// getPostCountFromDB gets the post count for a category from the database
func (cs *CategoryService) getPostCountFromDB(categoryID int) (int, error) {
	query := "SELECT COUNT(*) FROM posts WHERE category_id = ?"
	var count int
	err := cs.db.QueryRow(query, categoryID).Scan(&count)
	return count, err
}

// InitializePostCounts loads post counts from database into cache
func (cs *CategoryService) InitializePostCounts() error {
	if !cs.cacheEnabled {
		return nil
	}

	log.Println("Initializing category post counts cache...")
	start := time.Now()

	// Get post counts for all categories
	query := "SELECT category_id, COUNT(*) FROM posts GROUP BY category_id"
	rows, err := cs.db.Query(query)
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

	// Set post counts in cache
	categories := cs.cache.GetCategories()
	for _, category := range categories {
		count := countMap[category.ID] // Will be 0 if not found
		cs.cache.SetPostCount(category.ID, count)
	}

	elapsed := time.Since(start)
	log.Printf("Category post counts cache initialized in %v. %d categories processed", elapsed, len(categories))

	return nil
}

// OnPostCreated updates the cache when a post is created
func (cs *CategoryService) OnPostCreated(categoryID int) {
	if cs.cacheEnabled {
		cs.cache.UpdatePostCount(categoryID, 1)
	}
}

// OnPostDeleted updates the cache when a post is deleted
func (cs *CategoryService) OnPostDeleted(categoryID int) {
	if cs.cacheEnabled {
		cs.cache.UpdatePostCount(categoryID, -1)
	}
}

// OnPostMoved updates the cache when a post is moved between categories
func (cs *CategoryService) OnPostMoved(fromCategoryID, toCategoryID int) {
	if cs.cacheEnabled {
		cs.cache.UpdatePostCount(fromCategoryID, -1)
		cs.cache.UpdatePostCount(toCategoryID, 1)
	}
}

// GetPostCount returns the post count for a category, using cache if enabled
func (cs *CategoryService) GetPostCount(categoryID int, recursive bool) (int, error) {
	if cs.cacheEnabled && !recursive {
		// For non-recursive, we can use the cached count directly
		return cs.cache.GetPostCount(categoryID), nil
	}

	// For recursive or when cache is disabled, use database
	return cs.db.GetPostCountByCategoryRecursive(categoryID, recursive)
}

// GetTotalPostCount returns the total post count across all categories
func (cs *CategoryService) GetTotalPostCount() (int, error) {
	if cs.cacheEnabled {
		// Sum all cached post counts
		categories := cs.cache.GetCategories()
		totalCount := 0
		for _, category := range categories {
			totalCount += cs.cache.GetPostCount(category.ID)
		}
		return totalCount, nil
	}

	// Fall back to database
	return cs.db.GetTotalPostCount()
}
