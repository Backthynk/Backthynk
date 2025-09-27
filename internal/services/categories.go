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
