package cache

import (
	"backthynk/internal/models"
	"log"
	"sync"
	"time"
)

// CacheEvent represents different types of cache invalidation events
type CacheEvent struct {
	Type      CacheEventType
	CategoryID int
	OldParentID *int
	NewParentID *int
	PostID    int
	Timestamp int64
	FileSize  int64
	Data      interface{}
}

type CacheEventType int

const (
	EventCategoryCreated CacheEventType = iota
	EventCategoryUpdated
	EventCategoryDeleted
	EventCategoryMoved
	EventPostCreated
	EventPostDeleted
	EventPostMoved
	EventFileAdded
	EventFileDeleted
)

// CacheCoordinator manages all cache consistency and ensures atomic updates
type CacheCoordinator struct {
	categoryCache   *CategoryCache
	postCountCache  *PostCountCache
	activityCache   *ActivityCache
	fileStatsCache  *FileStatsCache

	// Cache enable flags
	categoryCacheEnabled  bool
	activityEnabled       bool
	fileStatsEnabled      bool

	// Hierarchy state
	hierarchy       map[int][]int // parentID -> []childIDs
	parentMap       map[int]int   // childID -> parentID
	hierarchyMutex  sync.RWMutex

	// Event processing
	eventQueue      chan CacheEvent
	eventWorkers    int
	stopWorkers     chan bool
	workerWg        sync.WaitGroup

	mutex           sync.RWMutex
}

var coordinator *CacheCoordinator
var coordinatorOnce sync.Once

// GetCacheCoordinator returns the global cache coordinator instance
func GetCacheCoordinator() *CacheCoordinator {
	coordinatorOnce.Do(func() {
		coordinator = &CacheCoordinator{
			categoryCache:         GetCategoryCache(),
			postCountCache:        GetPostCountCache(),
			activityCache:         GetActivityCache(),
			fileStatsCache:        GetFileStatsCache(),
			categoryCacheEnabled:  true, // Default enabled
			activityEnabled:       true, // Default enabled
			fileStatsEnabled:      true, // Default enabled
			hierarchy:             make(map[int][]int),
			parentMap:             make(map[int]int),
			eventQueue:            make(chan CacheEvent, 1000), // Buffered for performance
			eventWorkers:          3, // Multiple workers for parallel processing
			stopWorkers:           make(chan bool),
		}
		coordinator.startEventWorkers()
	})
	return coordinator
}

// SetCacheFlags sets which caches are enabled
func (cc *CacheCoordinator) SetCacheFlags(categoryCache, activity, fileStats bool) {
	cc.mutex.Lock()
	defer cc.mutex.Unlock()

	cc.categoryCacheEnabled = categoryCache
	cc.activityEnabled = activity
	cc.fileStatsEnabled = fileStats

	log.Printf("Cache coordinator flags updated - Category: %v, Activity: %v, FileStats: %v",
		categoryCache, activity, fileStats)
}

// InitializeHierarchy sets up the category hierarchy for all caches
func (cc *CacheCoordinator) InitializeHierarchy(categories []models.Category) error {
	cc.hierarchyMutex.Lock()
	defer cc.hierarchyMutex.Unlock()

	// Reset hierarchy maps
	cc.hierarchy = make(map[int][]int)
	cc.parentMap = make(map[int]int)

	// Build hierarchy from categories
	for _, cat := range categories {
		if cat.ParentID != nil {
			parentID := *cat.ParentID
			cc.hierarchy[parentID] = append(cc.hierarchy[parentID], cat.ID)
			cc.parentMap[cat.ID] = parentID
		}
	}

	// Update all enabled caches with the hierarchy
	cc.postCountCache.SetHierarchy(cc.hierarchy) // Post count cache is always enabled

	if cc.activityEnabled {
		cc.activityCache.SetHierarchy(cc.hierarchy, cc.parentMap)
	}

	log.Printf("Cache coordinator hierarchy initialized with %d categories", len(categories))
	return nil
}

// ProcessEvent queues an event for processing
func (cc *CacheCoordinator) ProcessEvent(event CacheEvent) {
	select {
	case cc.eventQueue <- event:
		// Event queued successfully
	default:
		// Queue is full, process synchronously to avoid data loss
		log.Printf("Warning: Cache event queue full, processing synchronously")
		cc.processEventSync(event)
	}
}

// startEventWorkers starts background workers to process cache events
func (cc *CacheCoordinator) startEventWorkers() {
	for i := 0; i < cc.eventWorkers; i++ {
		cc.workerWg.Add(1)
		go cc.eventWorker()
	}
}

// eventWorker processes events from the queue
func (cc *CacheCoordinator) eventWorker() {
	defer cc.workerWg.Done()

	for {
		select {
		case event := <-cc.eventQueue:
			cc.processEventSync(event)
		case <-cc.stopWorkers:
			return
		}
	}
}

// processEventSync synchronously processes a cache event
func (cc *CacheCoordinator) processEventSync(event CacheEvent) {
	switch event.Type {
	case EventCategoryCreated:
		cc.handleCategoryCreated(event)
	case EventCategoryUpdated:
		cc.handleCategoryUpdated(event)
	case EventCategoryDeleted:
		cc.handleCategoryDeleted(event)
	case EventCategoryMoved:
		cc.handleCategoryMoved(event)
	case EventPostCreated:
		cc.handlePostCreated(event)
	case EventPostDeleted:
		cc.handlePostDeleted(event)
	case EventPostMoved:
		cc.handlePostMoved(event)
	case EventFileAdded:
		cc.handleFileAdded(event)
	case EventFileDeleted:
		cc.handleFileDeleted(event)
	default:
		log.Printf("Warning: Unknown cache event type: %v", event.Type)
	}
}

// handleCategoryCreated handles category creation events
func (cc *CacheCoordinator) handleCategoryCreated(event CacheEvent) {
	category, ok := event.Data.(*models.Category)
	if !ok {
		log.Printf("Error: Invalid data type for category created event")
		return
	}

	// Update hierarchy
	cc.updateHierarchyForNewCategory(category)

	// Initialize empty caches for the new category
	cc.postCountCache.SetPostCount(category.ID, 0)

	log.Printf("Cache coordinator: Category %d created", category.ID)
}

// handleCategoryUpdated handles category update events (including parent changes)
func (cc *CacheCoordinator) handleCategoryUpdated(event CacheEvent) {
	category, ok := event.Data.(*models.Category)
	if !ok {
		log.Printf("Error: Invalid data type for category updated event")
		return
	}

	// Check if parent changed
	oldParentID := event.OldParentID
	newParentID := category.ParentID

	if !parentIDsEqual(oldParentID, newParentID) {
		// Parent changed - this is a move operation
		cc.handleCategoryMoveOperation(category.ID, oldParentID, newParentID)
	}

	log.Printf("Cache coordinator: Category %d updated", category.ID)
}

// handleCategoryDeleted handles category deletion events
func (cc *CacheCoordinator) handleCategoryDeleted(event CacheEvent) {
	categoryID := event.CategoryID

	// Remove from hierarchy
	cc.removeFromHierarchy(categoryID)

	// Clear all caches for this category
	cc.postCountCache.UpdatePostCount(categoryID, -cc.postCountCache.GetPostCount(categoryID))

	log.Printf("Cache coordinator: Category %d deleted", categoryID)
}

// handleCategoryMoved handles when a category's parent changes
func (cc *CacheCoordinator) handleCategoryMoved(event CacheEvent) {
	cc.handleCategoryMoveOperation(event.CategoryID, event.OldParentID, event.NewParentID)
}

// handleCategoryMoveOperation performs the actual category move operation
func (cc *CacheCoordinator) handleCategoryMoveOperation(categoryID int, oldParentID, newParentID *int) {
	cc.hierarchyMutex.Lock()
	defer cc.hierarchyMutex.Unlock()

	// Get all descendants to know what needs recursive cache updates
	descendants := cc.getAllDescendants(categoryID)

	// Get counts that will be moved (for parent cache updates)
	recursivePostCount := cc.postCountCache.GetPostCountRecursive(categoryID)

	// Update hierarchy
	cc.removeFromParentList(categoryID, oldParentID)
	cc.addToParentList(categoryID, newParentID)

	// Update parent map
	if newParentID != nil {
		cc.parentMap[categoryID] = *newParentID
	} else {
		delete(cc.parentMap, categoryID)
	}

	// Update all cache hierarchies
	cc.postCountCache.SetHierarchy(cc.hierarchy)
	cc.activityCache.SetHierarchy(cc.hierarchy, cc.parentMap)

	// Update recursive counts in old parent chain
	if oldParentID != nil {
		cc.updateParentCountsRecursive(*oldParentID, -recursivePostCount)
	}

	// Update recursive counts in new parent chain
	if newParentID != nil {
		cc.updateParentCountsRecursive(*newParentID, recursivePostCount)
	}

	// Update activity cache hierarchy for moved category and descendants
	cc.refreshActivityHierarchy(append(descendants, categoryID))

	log.Printf("Cache coordinator: Category %d moved from parent %v to %v (affected %d descendants)",
		categoryID, oldParentID, newParentID, len(descendants))
}

// handlePostCreated handles post creation events
func (cc *CacheCoordinator) handlePostCreated(event CacheEvent) {
	categoryID := event.CategoryID
	timestamp := event.Timestamp

	// Update post count cache (always enabled)
	cc.postCountCache.UpdatePostCount(categoryID, 1)

	// Update activity cache only if enabled
	if cc.activityEnabled {
		if err := cc.activityCache.UpdatePostActivity(categoryID, timestamp, 1); err != nil {
			log.Printf("Error updating activity cache for post creation: %v", err)
		}
	}

	log.Printf("Cache coordinator: Post created in category %d", categoryID)
}

// handlePostDeleted handles post deletion events
func (cc *CacheCoordinator) handlePostDeleted(event CacheEvent) {
	categoryID := event.CategoryID
	timestamp := event.Timestamp

	// Update post count cache (always enabled)
	cc.postCountCache.UpdatePostCount(categoryID, -1)

	// Update activity cache only if enabled
	if cc.activityEnabled {
		if err := cc.activityCache.UpdatePostActivity(categoryID, timestamp, -1); err != nil {
			log.Printf("Error updating activity cache for post deletion: %v", err)
		}
	}

	log.Printf("Cache coordinator: Post deleted from category %d", categoryID)
}

// handlePostMoved handles post move events
func (cc *CacheCoordinator) handlePostMoved(event CacheEvent) {
	fromCategoryID := event.CategoryID
	toCategoryID := int(event.Data.(int))
	timestamp := event.Timestamp

	// Update post count cache (always enabled)
	cc.postCountCache.UpdatePostCount(fromCategoryID, -1)
	cc.postCountCache.UpdatePostCount(toCategoryID, 1)

	// Update activity cache only if enabled
	if cc.activityEnabled {
		if err := cc.activityCache.UpdatePostActivity(fromCategoryID, timestamp, -1); err != nil {
			log.Printf("Error updating activity cache for post move (from): %v", err)
		}
		if err := cc.activityCache.UpdatePostActivity(toCategoryID, timestamp, 1); err != nil {
			log.Printf("Error updating activity cache for post move (to): %v", err)
		}
	}

	log.Printf("Cache coordinator: Post moved from category %d to %d", fromCategoryID, toCategoryID)
}

// handleFileAdded handles file addition events
func (cc *CacheCoordinator) handleFileAdded(event CacheEvent) {
	categoryID := event.CategoryID
	fileSize := event.FileSize

	// Update file stats cache only if enabled
	if cc.fileStatsEnabled {
		if err := cc.fileStatsCache.UpdateFileStats(categoryID, fileSize, 1); err != nil {
			log.Printf("Error updating file stats cache for file addition: %v", err)
		}

		// Update parent file stats recursively
		cc.updateParentFileStatsRecursive(categoryID, fileSize, 1)
	}

	log.Printf("Cache coordinator: File added to category %d (size: %d bytes)", categoryID, fileSize)
}

// handleFileDeleted handles file deletion events
func (cc *CacheCoordinator) handleFileDeleted(event CacheEvent) {
	categoryID := event.CategoryID
	fileSize := event.FileSize

	// Update file stats cache only if enabled
	if cc.fileStatsEnabled {
		if err := cc.fileStatsCache.UpdateFileStats(categoryID, -fileSize, -1); err != nil {
			log.Printf("Error updating file stats cache for file deletion: %v", err)
		}

		// Update parent file stats recursively
		cc.updateParentFileStatsRecursive(categoryID, -fileSize, -1)
	}

	log.Printf("Cache coordinator: File deleted from category %d (size: %d bytes)", categoryID, fileSize)
}

// Helper methods

// updateHierarchyForNewCategory updates hierarchy when a new category is created
func (cc *CacheCoordinator) updateHierarchyForNewCategory(category *models.Category) {
	cc.hierarchyMutex.Lock()
	defer cc.hierarchyMutex.Unlock()

	if category.ParentID != nil {
		parentID := *category.ParentID
		cc.hierarchy[parentID] = append(cc.hierarchy[parentID], category.ID)
		cc.parentMap[category.ID] = parentID
	}

	// Update all cache hierarchies
	cc.postCountCache.SetHierarchy(cc.hierarchy)
	cc.activityCache.SetHierarchy(cc.hierarchy, cc.parentMap)
}

// removeFromHierarchy removes a category from the hierarchy
func (cc *CacheCoordinator) removeFromHierarchy(categoryID int) {
	cc.hierarchyMutex.Lock()
	defer cc.hierarchyMutex.Unlock()

	// Find and remove from parent's children list
	if parentID, exists := cc.parentMap[categoryID]; exists {
		cc.removeFromParentList(categoryID, &parentID)
		delete(cc.parentMap, categoryID)
	}

	// Remove any children lists this category might have had
	delete(cc.hierarchy, categoryID)

	// Update all cache hierarchies
	cc.postCountCache.SetHierarchy(cc.hierarchy)
	cc.activityCache.SetHierarchy(cc.hierarchy, cc.parentMap)
}

// removeFromParentList removes a category from its parent's children list
func (cc *CacheCoordinator) removeFromParentList(categoryID int, parentID *int) {
	if parentID == nil {
		return
	}

	children := cc.hierarchy[*parentID]
	for i, childID := range children {
		if childID == categoryID {
			cc.hierarchy[*parentID] = append(children[:i], children[i+1:]...)
			break
		}
	}

	// Clean up empty lists
	if len(cc.hierarchy[*parentID]) == 0 {
		delete(cc.hierarchy, *parentID)
	}
}

// addToParentList adds a category to its parent's children list
func (cc *CacheCoordinator) addToParentList(categoryID int, parentID *int) {
	if parentID == nil {
		return
	}

	cc.hierarchy[*parentID] = append(cc.hierarchy[*parentID], categoryID)
}

// getAllDescendants returns all descendant category IDs for a given category
func (cc *CacheCoordinator) getAllDescendants(categoryID int) []int {
	var descendants []int

	children, exists := cc.hierarchy[categoryID]
	if !exists {
		return descendants
	}

	for _, childID := range children {
		descendants = append(descendants, childID)
		descendants = append(descendants, cc.getAllDescendants(childID)...)
	}

	return descendants
}

// updateParentCountsRecursive updates post counts recursively up the parent chain
// This is needed when categories are moved to adjust parent recursive counts
func (cc *CacheCoordinator) updateParentCountsRecursive(categoryID int, delta int) {
	// The post count cache handles recursive counting automatically when hierarchy is updated
	// But for category moves, we need to trigger a hierarchy refresh to recalculate
	// recursive counts properly. The cache's SetHierarchy call above should handle this.

	// Note: This method is primarily a placeholder for future manual recursive updates
	// if needed, but the current design relies on the cache's own recursive calculation
	// after hierarchy updates.
}

// updateParentFileStatsRecursive updates file stats recursively up the parent chain
func (cc *CacheCoordinator) updateParentFileStatsRecursive(categoryID int, sizeDelta int64, countDelta int64) {
	cc.hierarchyMutex.RLock()
	parentID, hasParent := cc.parentMap[categoryID]
	cc.hierarchyMutex.RUnlock()

	if !hasParent {
		return
	}

	// Update parent's recursive file stats
	stats := cc.fileStatsCache.GetCategoryFileStats(parentID)
	if stats != nil {
		stats.Mutex.Lock()
		stats.Recursive.FileCount += countDelta
		stats.Recursive.TotalSize += sizeDelta
		stats.LastUpdate = time.Now().UnixMilli()
		stats.Mutex.Unlock()
	}

	// Continue up the chain
	cc.updateParentFileStatsRecursive(parentID, sizeDelta, countDelta)
}

// refreshActivityHierarchy refreshes activity cache hierarchy for specific categories
func (cc *CacheCoordinator) refreshActivityHierarchy(categoryIDs []int) {
	// The activity cache hierarchy is already updated by SetHierarchy
	// Additional specific refresh logic can be added here if needed
}

// parentIDsEqual compares two parent IDs (which can be nil)
func parentIDsEqual(a, b *int) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

// Stop gracefully stops the cache coordinator
func (cc *CacheCoordinator) Stop() {
	close(cc.stopWorkers)
	cc.workerWg.Wait()
	close(cc.eventQueue)
	log.Println("Cache coordinator stopped")
}

// GetStats returns coordination statistics
func (cc *CacheCoordinator) GetStats() map[string]interface{} {
	cc.hierarchyMutex.RLock()
	hierarchySize := len(cc.hierarchy)
	parentMapSize := len(cc.parentMap)
	cc.hierarchyMutex.RUnlock()

	return map[string]interface{}{
		"hierarchy_categories": hierarchySize,
		"parent_mappings":      parentMapSize,
		"event_queue_size":     len(cc.eventQueue),
		"event_workers":        cc.eventWorkers,
		"coordinator_active":   true,
	}
}