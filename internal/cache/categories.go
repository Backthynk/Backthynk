package cache

import (
	"backthynk/internal/models"
	"sync"
	"time"
	"unsafe"
)

// CategoryWithCount extends Category with cached post count
type CategoryWithCount struct {
	models.Category
	PostCount int `json:"post_count"`
}

// CategoryCache manages all category data in memory
type CategoryCache struct {
	categories    map[int]*models.Category // categoryID -> category
	byParent      map[int][]int            // parentID -> []childIDs (nil key for root categories)
	allCategories []models.Category        // cached list of all categories
	postCounts    map[int]int              // categoryID -> post count
	mutex         sync.RWMutex
	lastUpdate    int64 // Unix timestamp in milliseconds
}

var categoryCache *CategoryCache
var categoryCacheOnce sync.Once

// GetCategoryCache returns the global category cache instance
func GetCategoryCache() *CategoryCache {
	categoryCacheOnce.Do(func() {
		categoryCache = &CategoryCache{
			categories:    make(map[int]*models.Category),
			byParent:      make(map[int][]int),
			allCategories: make([]models.Category, 0),
			postCounts:    make(map[int]int),
			lastUpdate:    time.Now().UnixMilli(),
		}
	})
	return categoryCache
}

// RefreshCache rebuilds the entire category cache from database data
func (cc *CategoryCache) RefreshCache(categories []models.Category) error {
	cc.mutex.Lock()
	defer cc.mutex.Unlock()

	// Clear existing cache
	cc.categories = make(map[int]*models.Category)
	cc.byParent = make(map[int][]int)
	cc.allCategories = make([]models.Category, 0, len(categories))
	cc.postCounts = make(map[int]int)

	// Populate cache
	for i := range categories {
		category := &categories[i]
		cc.categories[category.ID] = category
		cc.allCategories = append(cc.allCategories, *category)

		// Build parent-child relationship map
		parentKey := -1 // Use -1 for nil parent to avoid map key issues
		if category.ParentID != nil {
			parentKey = *category.ParentID
		}
		cc.byParent[parentKey] = append(cc.byParent[parentKey], category.ID)
	}

	cc.lastUpdate = time.Now().UnixMilli()
	return nil
}

// GetCategory returns a single category by ID
func (cc *CategoryCache) GetCategory(id int) (*models.Category, bool) {
	cc.mutex.RLock()
	defer cc.mutex.RUnlock()

	category, exists := cc.categories[id]
	if !exists {
		return nil, false
	}

	// Return a copy to prevent external modifications
	categoryCopy := *category
	return &categoryCopy, true
}

// GetCategories returns all categories
func (cc *CategoryCache) GetCategories() []models.Category {
	cc.mutex.RLock()
	defer cc.mutex.RUnlock()

	// Return a copy of all categories
	result := make([]models.Category, len(cc.allCategories))
	copy(result, cc.allCategories)
	return result
}

// GetCategoriesByParent returns categories with a specific parent ID
func (cc *CategoryCache) GetCategoriesByParent(parentID *int) []models.Category {
	cc.mutex.RLock()
	defer cc.mutex.RUnlock()

	parentKey := -1 // Use -1 for nil parent
	if parentID != nil {
		parentKey = *parentID
	}

	childIDs, exists := cc.byParent[parentKey]
	if !exists {
		return []models.Category{}
	}

	result := make([]models.Category, 0, len(childIDs))
	for _, childID := range childIDs {
		if category, exists := cc.categories[childID]; exists {
			result = append(result, *category)
		}
	}

	return result
}

// AddCategory adds a new category to the cache
func (cc *CategoryCache) AddCategory(category *models.Category) {
	cc.mutex.Lock()
	defer cc.mutex.Unlock()

	// Add to main map
	categoryCopy := *category
	cc.categories[category.ID] = &categoryCopy
	cc.allCategories = append(cc.allCategories, categoryCopy)

	// Update parent-child relationships
	parentKey := -1
	if category.ParentID != nil {
		parentKey = *category.ParentID
	}
	cc.byParent[parentKey] = append(cc.byParent[parentKey], category.ID)

	cc.lastUpdate = time.Now().UnixMilli()
}

// UpdateCategory updates an existing category in the cache
func (cc *CategoryCache) UpdateCategory(category *models.Category) {
	cc.mutex.Lock()
	defer cc.mutex.Unlock()

	oldCategory, exists := cc.categories[category.ID]
	if !exists {
		return
	}

	// Check if parent changed
	oldParentKey := -1
	if oldCategory.ParentID != nil {
		oldParentKey = *oldCategory.ParentID
	}

	newParentKey := -1
	if category.ParentID != nil {
		newParentKey = *category.ParentID
	}

	// Update parent-child relationships if parent changed
	if oldParentKey != newParentKey {
		// Remove from old parent's children list
		cc.removeFromParentList(category.ID, oldParentKey)

		// Add to new parent's children list
		cc.byParent[newParentKey] = append(cc.byParent[newParentKey], category.ID)
	}

	// Update category in main map
	categoryCopy := *category
	cc.categories[category.ID] = &categoryCopy

	// Update in all categories slice
	for i := range cc.allCategories {
		if cc.allCategories[i].ID == category.ID {
			cc.allCategories[i] = categoryCopy
			break
		}
	}

	cc.lastUpdate = time.Now().UnixMilli()
}

// RemoveCategory removes a category from the cache
func (cc *CategoryCache) RemoveCategory(categoryID int) {
	cc.mutex.Lock()
	defer cc.mutex.Unlock()

	category, exists := cc.categories[categoryID]
	if !exists {
		return
	}

	// Remove from parent-child relationships
	parentKey := -1
	if category.ParentID != nil {
		parentKey = *category.ParentID
	}
	cc.removeFromParentList(categoryID, parentKey)

	// Remove from main map
	delete(cc.categories, categoryID)

	// Remove from all categories slice
	for i := len(cc.allCategories) - 1; i >= 0; i-- {
		if cc.allCategories[i].ID == categoryID {
			cc.allCategories = append(cc.allCategories[:i], cc.allCategories[i+1:]...)
			break
		}
	}

	// Remove any children lists this category might have had
	delete(cc.byParent, categoryID)

	cc.lastUpdate = time.Now().UnixMilli()
}

// removeFromParentList removes a category ID from its parent's children list
func (cc *CategoryCache) removeFromParentList(categoryID int, parentKey int) {
	if children, exists := cc.byParent[parentKey]; exists {
		for i, childID := range children {
			if childID == categoryID {
				cc.byParent[parentKey] = append(children[:i], children[i+1:]...)
				break
			}
		}

		// Clean up empty lists
		if len(cc.byParent[parentKey]) == 0 {
			delete(cc.byParent, parentKey)
		}
	}
}

// GetCacheStats returns category cache statistics for monitoring
func (cc *CategoryCache) GetCacheStats() map[string]interface{} {
	cc.mutex.RLock()
	defer cc.mutex.RUnlock()

	totalMemoryBytes := int64(0)
	categoriesCount := len(cc.categories)

	// Calculate base cache overhead
	totalMemoryBytes += int64(unsafe.Sizeof(*cc))
	totalMemoryBytes += int64(len(cc.categories)) * int64(unsafe.Sizeof(models.Category{}))
	totalMemoryBytes += int64(len(cc.allCategories)) * int64(unsafe.Sizeof(models.Category{}))

	// Memory for parent-child maps
	for _, children := range cc.byParent {
		totalMemoryBytes += int64(len(children)) * int64(unsafe.Sizeof(int(0)))
	}

	return map[string]interface{}{
		"categories_cached": categoriesCount,
		"parent_child_maps": len(cc.byParent),
		"cache_size_bytes":  totalMemoryBytes,
		"cache_size_mb":     float64(totalMemoryBytes) / (1024 * 1024),
		"last_update":       cc.lastUpdate,
		"memory_efficient":  true,
	}
}

// IsEmpty returns true if the cache is empty
func (cc *CategoryCache) IsEmpty() bool {
	cc.mutex.RLock()
	defer cc.mutex.RUnlock()
	return len(cc.categories) == 0
}

// GetCategoryCount returns the number of categories in the cache
func (cc *CategoryCache) GetCategoryCount() int {
	cc.mutex.RLock()
	defer cc.mutex.RUnlock()
	return len(cc.categories)
}

// GetCategoryWithCount returns a category with its cached post count
func (cc *CategoryCache) GetCategoryWithCount(id int) (*CategoryWithCount, bool) {
	cc.mutex.RLock()
	defer cc.mutex.RUnlock()

	category, exists := cc.categories[id]
	if !exists {
		return nil, false
	}

	postCount := cc.postCounts[id]

	return &CategoryWithCount{
		Category:  *category,
		PostCount: postCount,
	}, true
}

// GetCategoriesWithCount returns all categories with their cached post counts
func (cc *CategoryCache) GetCategoriesWithCount() []CategoryWithCount {
	cc.mutex.RLock()
	defer cc.mutex.RUnlock()

	result := make([]CategoryWithCount, 0, len(cc.allCategories))
	for _, category := range cc.allCategories {
		postCount := cc.postCounts[category.ID]
		result = append(result, CategoryWithCount{
			Category:  category,
			PostCount: postCount,
		})
	}
	return result
}

// UpdatePostCount updates the post count for a category
func (cc *CategoryCache) UpdatePostCount(categoryID int, delta int) {
	cc.mutex.Lock()
	defer cc.mutex.Unlock()

	cc.postCounts[categoryID] += delta
	if cc.postCounts[categoryID] < 0 {
		cc.postCounts[categoryID] = 0
	}
	cc.lastUpdate = time.Now().UnixMilli()
}

// SetPostCount sets the post count for a category (used during initialization)
func (cc *CategoryCache) SetPostCount(categoryID int, count int) {
	cc.mutex.Lock()
	defer cc.mutex.Unlock()

	cc.postCounts[categoryID] = count
	cc.lastUpdate = time.Now().UnixMilli()
}

// GetPostCount returns the cached post count for a category
func (cc *CategoryCache) GetPostCount(categoryID int) int {
	cc.mutex.RLock()
	defer cc.mutex.RUnlock()

	return cc.postCounts[categoryID]
}
