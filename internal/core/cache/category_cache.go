package cache

import (
	"backthynk/internal/core/models"
	"sync"
)

type CategoryCache struct {
	categories map[int]*models.Category
	hierarchy  map[int][]int // parentID -> []childIDs
	mu         sync.RWMutex
}

func NewCategoryCache() *CategoryCache {
	return &CategoryCache{
		categories: make(map[int]*models.Category),
		hierarchy:  make(map[int][]int),
	}
}

func (c *CategoryCache) Set(category *models.Category) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Check if this is an update to an existing category
	if existingCat, exists := c.categories[category.ID]; exists {
		// Remove from old parent hierarchy if parent changed
		if existingCat.ParentID != nil {
			c.removeFromHierarchyUnlocked(*existingCat.ParentID, category.ID)
		}
	}

	// Update hierarchy with new parent
	if category.ParentID != nil {
		// Check if child is already in parent's hierarchy to avoid duplicates
		children := c.hierarchy[*category.ParentID]
		found := false
		for _, childID := range children {
			if childID == category.ID {
				found = true
				break
			}
		}
		if !found {
			c.hierarchy[*category.ParentID] = append(c.hierarchy[*category.ParentID], category.ID)
		}
	}

	c.categories[category.ID] = category
}

func (c *CategoryCache) Get(id int) (*models.Category, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	cat, ok := c.categories[id]
	return cat, ok
}

func (c *CategoryCache) GetAll() []*models.Category {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	result := make([]*models.Category, 0, len(c.categories))
	for _, cat := range c.categories {
		result = append(result, cat)
	}
	return result
}

func (c *CategoryCache) UpdatePostCount(categoryID int, delta int) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if cat, ok := c.categories[categoryID]; ok {
		cat.PostCount += delta

		// Update recursive counts for all ancestors
		c.updateRecursiveCountsUnlocked(categoryID, delta)
	}
}

func (c *CategoryCache) updateRecursiveCountsUnlocked(categoryID int, delta int) {
	// Update self
	if cat, ok := c.categories[categoryID]; ok {
		cat.RecursivePostCount += delta
	}

	// Update all ancestors (parents, grandparents, etc.)
	ancestors := c.getAncestorsUnlocked(categoryID)
	for _, ancestorID := range ancestors {
		if cat, ok := c.categories[ancestorID]; ok {
			cat.RecursivePostCount += delta
		}
	}
}

func (c *CategoryCache) getAncestorsUnlocked(categoryID int) []int {
	var ancestors []int
	current := categoryID
	visited := make(map[int]bool)

	for {
		cat, ok := c.categories[current]
		if !ok || cat.ParentID == nil {
			break
		}

		// Check for circular references
		if visited[*cat.ParentID] {
			break // Circular reference detected, stop
		}

		visited[current] = true
		ancestors = append(ancestors, *cat.ParentID)
		current = *cat.ParentID
	}

	return ancestors
}

func (c *CategoryCache) isDescendantUnlockedWithVisited(childID, parentID int, visited map[int]bool) bool {
	cat, ok := c.categories[childID]
	if !ok || cat.ParentID == nil {
		return false
	}

	if *cat.ParentID == parentID {
		return true
	}

	// Check for circular references
	if visited[*cat.ParentID] {
		return false
	}

	visited[childID] = true
	return c.isDescendantUnlockedWithVisited(*cat.ParentID, parentID, visited)
}

func (c *CategoryCache) GetChildren(parentID int) []int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.getChildrenUnlocked(parentID)
}

func (c *CategoryCache) getChildrenUnlocked(parentID int) []int {
	// Make a copy to avoid returning a slice that could be modified
	children := c.hierarchy[parentID]
	result := make([]int, len(children))
	copy(result, children)
	return result
}

func (c *CategoryCache) GetDescendants(categoryID int) []int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.getDescendantsUnlocked(categoryID)
}

func (c *CategoryCache) getDescendantsUnlocked(categoryID int) []int {
	return c.getDescendantsUnlockedWithVisited(categoryID, make(map[int]bool))
}

func (c *CategoryCache) getDescendantsUnlockedWithVisited(categoryID int, visited map[int]bool) []int {
	var descendants []int

	// Check for circular references
	if visited[categoryID] {
		return descendants
	}

	visited[categoryID] = true
	children := c.getChildrenUnlocked(categoryID)

	for _, childID := range children {
		descendants = append(descendants, childID)
		descendants = append(descendants, c.getDescendantsUnlockedWithVisited(childID, visited)...)
	}

	return descendants
}

func (c *CategoryCache) Delete(categoryID int) {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	// Remove from hierarchy
	if cat, ok := c.categories[categoryID]; ok && cat.ParentID != nil {
		children := c.hierarchy[*cat.ParentID]
		for i, id := range children {
			if id == categoryID {
				c.hierarchy[*cat.ParentID] = append(children[:i], children[i+1:]...)
				break
			}
		}
	}
	
	delete(c.categories, categoryID)
	delete(c.hierarchy, categoryID)
}

func (c *CategoryCache) removeFromHierarchyUnlocked(parentID, childID int) {
	children := c.hierarchy[parentID]
	for i, id := range children {
		if id == childID {
			c.hierarchy[parentID] = append(children[:i], children[i+1:]...)
			break
		}
	}
}

func (c *CategoryCache) RebuildHierarchy() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.hierarchy = make(map[int][]int)
	for _, cat := range c.categories {
		if cat.ParentID != nil {
			c.hierarchy[*cat.ParentID] = append(c.hierarchy[*cat.ParentID], cat.ID)
		}
	}
}

// HandleHierarchyChange efficiently updates recursive post counts when a category is moved
func (c *CategoryCache) HandleHierarchyChange(categoryID int, oldParentID, newParentID *int) {
	c.mu.Lock()
	defer c.mu.Unlock()

	_, ok := c.categories[categoryID]
	if !ok {
		return
	}

	// Get the post count impact from the moved category and all its descendants
	impactCount := c.getDescendantPostCountUnlocked(categoryID)

	// Update old ancestor chain (subtract the impact)
	if oldParentID != nil {
		c.updateAncestorRecursiveCountsUnlocked(*oldParentID, -impactCount)
	}

	// Update new ancestor chain (add the impact)
	if newParentID != nil {
		c.updateAncestorRecursiveCountsUnlocked(*newParentID, impactCount)
	}
}

// getDescendantPostCountUnlocked calculates total posts in category and all descendants
func (c *CategoryCache) getDescendantPostCountUnlocked(categoryID int) int {
	total := 0

	// Add direct posts from this category
	if cat, ok := c.categories[categoryID]; ok {
		total += cat.PostCount
	}

	// Add posts from all descendants
	descendants := c.getDescendantsUnlocked(categoryID)
	for _, descID := range descendants {
		if cat, ok := c.categories[descID]; ok {
			total += cat.PostCount
		}
	}

	return total
}

// updateAncestorRecursiveCountsUnlocked updates recursive post counts for all ancestors
func (c *CategoryCache) updateAncestorRecursiveCountsUnlocked(categoryID int, delta int) {
	ancestors := c.getAncestorsUnlocked(categoryID)
	// Also update the category itself since ancestors walk up from parent
	ancestors = append([]int{categoryID}, ancestors...)

	for _, ancestorID := range ancestors {
		if cat, ok := c.categories[ancestorID]; ok {
			cat.RecursivePostCount += delta
		}
	}
}