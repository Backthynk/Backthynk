package cache

import (
	"backthynk/internal/core/models"
	"sync"
)

type SpaceCache struct {
	spaces map[int]*models.Space
	hierarchy  map[int][]int // parentID -> []childIDs
	mu         sync.RWMutex
}

func NewSpaceCache() *SpaceCache {
	return &SpaceCache{
		spaces: make(map[int]*models.Space),
		hierarchy:  make(map[int][]int),
	}
}

func (c *SpaceCache) Set(space *models.Space) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Check if this is an update to an existing space
	if existingCat, exists := c.spaces[space.ID]; exists {
		// Remove from old parent hierarchy if parent changed
		if existingCat.ParentID != nil {
			c.removeFromHierarchyUnlocked(*existingCat.ParentID, space.ID)
		}
	}

	// Update hierarchy with new parent
	if space.ParentID != nil {
		// Check if child is already in parent's hierarchy to avoid duplicates
		children := c.hierarchy[*space.ParentID]
		found := false
		for _, childID := range children {
			if childID == space.ID {
				found = true
				break
			}
		}
		if !found {
			c.hierarchy[*space.ParentID] = append(c.hierarchy[*space.ParentID], space.ID)
		}
	}

	c.spaces[space.ID] = space
}

func (c *SpaceCache) Get(id int) (*models.Space, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	cat, ok := c.spaces[id]
	return cat, ok
}

func (c *SpaceCache) GetAll() []*models.Space {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	result := make([]*models.Space, 0, len(c.spaces))
	for _, cat := range c.spaces {
		result = append(result, cat)
	}
	return result
}

func (c *SpaceCache) UpdatePostCount(spaceID int, delta int) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if cat, ok := c.spaces[spaceID]; ok {
		cat.PostCount += delta

		// Update recursive counts for all ancestors
		c.updateRecursiveCountsUnlocked(spaceID, delta)
	}
}

func (c *SpaceCache) updateRecursiveCountsUnlocked(spaceID int, delta int) {
	// Update self
	if cat, ok := c.spaces[spaceID]; ok {
		cat.RecursivePostCount += delta
	}

	// Update all ancestors (parents, grandparents, etc.)
	ancestors := c.getAncestorsUnlocked(spaceID)
	for _, ancestorID := range ancestors {
		if cat, ok := c.spaces[ancestorID]; ok {
			cat.RecursivePostCount += delta
		}
	}
}

func (c *SpaceCache) GetAncestors(spaceID int) []int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.getAncestorsUnlocked(spaceID)
}

func (c *SpaceCache) getAncestorsUnlocked(spaceID int) []int {
	var ancestors []int
	current := spaceID
	visited := make(map[int]bool)

	for {
		cat, ok := c.spaces[current]
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

func (c *SpaceCache) isDescendantUnlockedWithVisited(childID, parentID int, visited map[int]bool) bool {
	cat, ok := c.spaces[childID]
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

func (c *SpaceCache) GetChildren(parentID int) []int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.getChildrenUnlocked(parentID)
}

func (c *SpaceCache) getChildrenUnlocked(parentID int) []int {
	// Make a copy to avoid returning a slice that could be modified
	children := c.hierarchy[parentID]
	result := make([]int, len(children))
	copy(result, children)
	return result
}

func (c *SpaceCache) GetDescendants(spaceID int) []int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.getDescendantsUnlocked(spaceID)
}

func (c *SpaceCache) getDescendantsUnlocked(spaceID int) []int {
	return c.getDescendantsUnlockedWithVisited(spaceID, make(map[int]bool))
}

func (c *SpaceCache) getDescendantsUnlockedWithVisited(spaceID int, visited map[int]bool) []int {
	var descendants []int

	// Check for circular references
	if visited[spaceID] {
		return descendants
	}

	visited[spaceID] = true
	children := c.getChildrenUnlocked(spaceID)

	for _, childID := range children {
		descendants = append(descendants, childID)
		descendants = append(descendants, c.getDescendantsUnlockedWithVisited(childID, visited)...)
	}

	return descendants
}

func (c *SpaceCache) Delete(spaceID int) {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	// Remove from hierarchy
	if cat, ok := c.spaces[spaceID]; ok && cat.ParentID != nil {
		children := c.hierarchy[*cat.ParentID]
		for i, id := range children {
			if id == spaceID {
				c.hierarchy[*cat.ParentID] = append(children[:i], children[i+1:]...)
				break
			}
		}
	}
	
	delete(c.spaces, spaceID)
	delete(c.hierarchy, spaceID)
}

func (c *SpaceCache) removeFromHierarchyUnlocked(parentID, childID int) {
	children := c.hierarchy[parentID]
	for i, id := range children {
		if id == childID {
			c.hierarchy[parentID] = append(children[:i], children[i+1:]...)
			break
		}
	}
}

func (c *SpaceCache) RebuildHierarchy() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.hierarchy = make(map[int][]int)
	for _, cat := range c.spaces {
		if cat.ParentID != nil {
			c.hierarchy[*cat.ParentID] = append(c.hierarchy[*cat.ParentID], cat.ID)
		}
	}
}

// HandleHierarchyChange efficiently updates recursive post counts when a space is moved
func (c *SpaceCache) HandleHierarchyChange(spaceID int, oldParentID, newParentID *int) {
	c.mu.Lock()
	defer c.mu.Unlock()

	_, ok := c.spaces[spaceID]
	if !ok {
		return
	}

	// Get the post count impact from the moved space and all its descendants
	impactCount := c.getDescendantPostCountUnlocked(spaceID)

	// Update old ancestor chain (subtract the impact)
	if oldParentID != nil {
		c.updateAncestorRecursiveCountsUnlocked(*oldParentID, -impactCount)
	}

	// Update new ancestor chain (add the impact)
	if newParentID != nil {
		c.updateAncestorRecursiveCountsUnlocked(*newParentID, impactCount)
	}
}

// getDescendantPostCountUnlocked calculates total posts in space and all descendants
func (c *SpaceCache) getDescendantPostCountUnlocked(spaceID int) int {
	total := 0

	// Add direct posts from this space
	if cat, ok := c.spaces[spaceID]; ok {
		total += cat.PostCount
	}

	// Add posts from all descendants
	descendants := c.getDescendantsUnlocked(spaceID)
	for _, descID := range descendants {
		if cat, ok := c.spaces[descID]; ok {
			total += cat.PostCount
		}
	}

	return total
}

// updateAncestorRecursiveCountsUnlocked updates recursive post counts for all ancestors
func (c *SpaceCache) updateAncestorRecursiveCountsUnlocked(spaceID int, delta int) {
	ancestors := c.getAncestorsUnlocked(spaceID)
	// Also update the space itself since ancestors walk up from parent
	ancestors = append([]int{spaceID}, ancestors...)

	for _, ancestorID := range ancestors {
		if cat, ok := c.spaces[ancestorID]; ok {
			cat.RecursivePostCount += delta
		}
	}
}