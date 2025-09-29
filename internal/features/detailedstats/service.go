package detailedstats

import (
	"backthynk/internal/core/cache"
	"backthynk/internal/core/events"
	"backthynk/internal/storage"
	"log"
	"sync"
)

type Stats struct {
	FileCount int64 `json:"file_count"`
	TotalSize int64 `json:"total_size"`
}

type Service struct {
	db        *storage.DB
	catCache  *cache.CategoryCache
	stats     map[int]*CategoryStats     // categoryID -> stats
	postFiles map[int]map[int]*FileInfo  // categoryID -> postID -> file info
	mu        sync.RWMutex
	enabled   bool
}

type FileInfo struct {
	FileCount int64
	TotalSize int64
}

type CategoryStats struct {
	Direct    Stats `json:"direct"`
	Recursive Stats `json:"recursive"`
	mu        sync.RWMutex
}

func NewService(db *storage.DB, catCache *cache.CategoryCache, enabled bool) *Service {
	return &Service{
		db:        db,
		catCache:  catCache,
		stats:     make(map[int]*CategoryStats),
		postFiles: make(map[int]map[int]*FileInfo),
		enabled:   enabled,
	}
}

func (s *Service) Initialize() error {
	if !s.enabled {
		return nil
	}

	log.Println("Initializing detailed stats cache...")

	// Load all file stats from database
	fileStats, err := s.db.GetAllFileStats()
	if err != nil {
		return err
	}

	// Build direct stats
	for catID, stats := range fileStats {
		s.stats[catID] = &CategoryStats{
			Direct: Stats{
				FileCount: stats.FileCount,
				TotalSize: stats.TotalSize,
			},
		}
	}

	// Load post-file relationships for accurate post movement tracking
	postFileStats, err := s.db.GetAllPostFileStats()
	if err != nil {
		return err
	}

	// Initialize postFiles map with existing data
	s.mu.Lock()
	for _, pfs := range postFileStats {
		if _, ok := s.postFiles[pfs.CategoryID]; !ok {
			s.postFiles[pfs.CategoryID] = make(map[int]*FileInfo)
		}
		s.postFiles[pfs.CategoryID][pfs.PostID] = &FileInfo{
			FileCount: pfs.FileCount,
			TotalSize: pfs.TotalSize,
		}
	}
	s.mu.Unlock()

	// Calculate recursive stats
	categories := s.catCache.GetAll()
	for _, cat := range categories {
		s.calculateRecursiveStats(cat.ID)
	}

	log.Println("Detailed stats cache initialized")
	return nil
}

func (s *Service) calculateRecursiveStats(categoryID int) {
	if !s.enabled {
		return
	}
	
	stats, ok := s.stats[categoryID]
	if !ok {
		stats = &CategoryStats{}
		s.stats[categoryID] = stats
	}
	
	stats.mu.Lock()
	defer stats.mu.Unlock()
	
	// Start with direct stats
	stats.Recursive = stats.Direct
	
	// Add descendant stats
	descendants := s.catCache.GetDescendants(categoryID)
	for _, descID := range descendants {
		if descStats, ok := s.stats[descID]; ok {
			descStats.mu.RLock()
			stats.Recursive.FileCount += descStats.Direct.FileCount
			stats.Recursive.TotalSize += descStats.Direct.TotalSize
			descStats.mu.RUnlock()
		}
	}
}

func (s *Service) HandleEvent(event events.Event) error {
	if !s.enabled {
		return nil
	}
	
	switch event.Type {
	case events.FileUploaded:
		data := event.Data.(events.PostEvent)
		s.updateStats(data.CategoryID, data.FileSize, 1)
		s.trackFileByPost(data.CategoryID, data.PostID, data.FileSize, 1)

	case events.FileDeleted:
		data := event.Data.(events.PostEvent)
		s.updateStats(data.CategoryID, -data.FileSize, -1)
		s.trackFileByPost(data.CategoryID, data.PostID, -data.FileSize, -1)
		
	case events.PostDeleted:
		data := event.Data.(events.PostEvent)
		if data.FileCount > 0 {
			s.updateStats(data.CategoryID, -data.FileSize, -data.FileCount)
		}

	case events.PostMoved:
		data := event.Data.(events.PostEvent)
		if data.OldCategoryID != nil {
			// For post moves, we need to calculate how many files are being moved
			// by looking at what files exist for this post in our internal stats
			s.handlePostMoved(data.PostID, *data.OldCategoryID, data.CategoryID)
		}

	case events.CategoryUpdated:
		data := event.Data.(events.CategoryEvent)
		// When a category is moved, we need to recalculate recursive stats
		// for the old and new parent hierarchies
		if data.OldParentID != data.NewParentID {
			s.handleCategoryHierarchyChange(data.CategoryID, data.OldParentID, data.NewParentID)
		}
	}
	
	return nil
}

func (s *Service) updateStats(categoryID int, sizeDelta int64, countDelta int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	stats, ok := s.stats[categoryID]
	if !ok {
		stats = &CategoryStats{}
		s.stats[categoryID] = stats
	}
	
	stats.mu.Lock()
	stats.Direct.TotalSize += sizeDelta
	stats.Direct.FileCount += int64(countDelta)
	
	// Ensure non-negative
	if stats.Direct.TotalSize < 0 {
		stats.Direct.TotalSize = 0
	}
	if stats.Direct.FileCount < 0 {
		stats.Direct.FileCount = 0
	}
	stats.mu.Unlock()
	
	// Update recursive stats for all parents
	s.updateParentRecursiveStats(categoryID, sizeDelta, countDelta)
}

func (s *Service) updateParentRecursiveStats(categoryID int, sizeDelta int64, countDelta int) {
	// Update self
	if stats, ok := s.stats[categoryID]; ok {
		stats.mu.Lock()
		stats.Recursive.TotalSize += sizeDelta
		stats.Recursive.FileCount += int64(countDelta)

		if stats.Recursive.TotalSize < 0 {
			stats.Recursive.TotalSize = 0
		}
		if stats.Recursive.FileCount < 0 {
			stats.Recursive.FileCount = 0
		}
		stats.mu.Unlock()
	}

	// Update ancestors by walking up the parent chain
	current := categoryID
	for {
		// Get parent of current category
		cat, ok := s.catCache.Get(current)
		if !ok || cat.ParentID == nil {
			break
		}

		parentID := *cat.ParentID
		if stats, ok := s.stats[parentID]; ok {
			stats.mu.Lock()
			stats.Recursive.TotalSize += sizeDelta
			stats.Recursive.FileCount += int64(countDelta)

			if stats.Recursive.TotalSize < 0 {
				stats.Recursive.TotalSize = 0
			}
			if stats.Recursive.FileCount < 0 {
				stats.Recursive.FileCount = 0
			}
			stats.mu.Unlock()
		} else {
			// Create stats entry for parent
			parentStats := &CategoryStats{}
			parentStats.Recursive.TotalSize = sizeDelta
			parentStats.Recursive.FileCount = int64(countDelta)
			if parentStats.Recursive.TotalSize < 0 {
				parentStats.Recursive.TotalSize = 0
			}
			if parentStats.Recursive.FileCount < 0 {
				parentStats.Recursive.FileCount = 0
			}
			s.stats[parentID] = parentStats
		}

		current = parentID
	}
}

func (s *Service) GetStats(categoryID int, recursive bool) *Stats {
	if !s.enabled {
		return &Stats{}
	}
	
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	stats, ok := s.stats[categoryID]
	if !ok {
		return &Stats{}
	}
	
	stats.mu.RLock()
	defer stats.mu.RUnlock()
	
	if recursive {
		return &stats.Recursive
	}
	return &stats.Direct
}

func (s *Service) GetGlobalStats() *Stats {
	if !s.enabled {
		return &Stats{}
	}
	
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	total := &Stats{}
	for _, stats := range s.stats {
		stats.mu.RLock()
		total.FileCount += stats.Direct.FileCount
		total.TotalSize += stats.Direct.TotalSize
		stats.mu.RUnlock()
	}

	return total
}

// handleCategoryHierarchyChange handles when a category is moved to a different parent
func (s *Service) handleCategoryHierarchyChange(categoryID int, oldParentID, newParentID *int) {
	if !s.enabled {
		return
	}

	// Get direct stats for the moved category and all its descendants
	descendants := s.catCache.GetDescendants(categoryID)
	affectedCategories := append([]int{categoryID}, descendants...)

	var totalFilesImpacted int64
	var totalSizeImpacted int64

	// Calculate total impact from the moved category tree
	s.mu.RLock()
	for _, catID := range affectedCategories {
		if stats, ok := s.stats[catID]; ok {
			stats.mu.RLock()
			totalFilesImpacted += stats.Direct.FileCount
			totalSizeImpacted += stats.Direct.TotalSize
			stats.mu.RUnlock()
		}
	}
	s.mu.RUnlock()

	// Update old parent hierarchy (subtract the moved category's impact)
	if oldParentID != nil {
		s.updateParentRecursiveStatsForHierarchy(*oldParentID, -totalSizeImpacted, -int(totalFilesImpacted))
	}

	// Update new parent hierarchy (add the moved category's impact)
	if newParentID != nil {
		s.updateParentRecursiveStatsForHierarchy(*newParentID, totalSizeImpacted, int(totalFilesImpacted))
	}

	// Recalculate recursive stats for the moved category tree since parent relationships changed
	for _, catID := range affectedCategories {
		s.calculateRecursiveStats(catID)
	}
}

// updateParentRecursiveStatsForHierarchy updates recursive stats for a parent and all its ancestors
func (s *Service) updateParentRecursiveStatsForHierarchy(startCategoryID int, sizeDelta int64, countDelta int) {
	current := startCategoryID

	s.mu.Lock()
	defer s.mu.Unlock()

	for {
		// Update current category's recursive stats
		if stats, ok := s.stats[current]; ok {
			stats.mu.Lock()
			stats.Recursive.TotalSize += sizeDelta
			stats.Recursive.FileCount += int64(countDelta)

			if stats.Recursive.TotalSize < 0 {
				stats.Recursive.TotalSize = 0
			}
			if stats.Recursive.FileCount < 0 {
				stats.Recursive.FileCount = 0
			}
			stats.mu.Unlock()
		} else {
			// Create stats entry for this category
			newStats := &CategoryStats{}
			newStats.Recursive.TotalSize = sizeDelta
			newStats.Recursive.FileCount = int64(countDelta)
			if newStats.Recursive.TotalSize < 0 {
				newStats.Recursive.TotalSize = 0
			}
			if newStats.Recursive.FileCount < 0 {
				newStats.Recursive.FileCount = 0
			}
			s.stats[current] = newStats
		}

		// Get parent of current category
		cat, ok := s.catCache.Get(current)
		if !ok || cat.ParentID == nil {
			break
		}

		current = *cat.ParentID
	}
}

// trackFileByPost tracks files by post ID for accurate post movement handling
func (s *Service) trackFileByPost(categoryID, postID int, sizeDelta int64, countDelta int) {
	if _, ok := s.postFiles[categoryID]; !ok {
		s.postFiles[categoryID] = make(map[int]*FileInfo)
	}

	if _, ok := s.postFiles[categoryID][postID]; !ok {
		s.postFiles[categoryID][postID] = &FileInfo{}
	}

	fileInfo := s.postFiles[categoryID][postID]
	fileInfo.FileCount += int64(countDelta)
	fileInfo.TotalSize += sizeDelta

	// Clean up if no files left
	if fileInfo.FileCount <= 0 && fileInfo.TotalSize <= 0 {
		delete(s.postFiles[categoryID], postID)
		if len(s.postFiles[categoryID]) == 0 {
			delete(s.postFiles, categoryID)
		}
	}
}

// handlePostMoved handles when a post is moved between categories
func (s *Service) handlePostMoved(postID, oldCategoryID, newCategoryID int) {
	// Find the files for this post in the old category
	var fileCount int64
	var totalSize int64

	s.mu.Lock()
	if postFiles, ok := s.postFiles[oldCategoryID]; ok {
		if fileInfo, ok := postFiles[postID]; ok {
			fileCount = fileInfo.FileCount
			totalSize = fileInfo.TotalSize

			// Remove from old category tracking
			delete(postFiles, postID)
			if len(postFiles) == 0 {
				delete(s.postFiles, oldCategoryID)
			}

			// Add to new category tracking
			if _, ok := s.postFiles[newCategoryID]; !ok {
				s.postFiles[newCategoryID] = make(map[int]*FileInfo)
			}
			s.postFiles[newCategoryID][postID] = &FileInfo{
				FileCount: fileCount,
				TotalSize: totalSize,
			}
		}
	}
	s.mu.Unlock()

	// Update stats if there were files to move
	if fileCount > 0 || totalSize > 0 {
		s.updateStats(oldCategoryID, -totalSize, -int(fileCount))
		s.updateStats(newCategoryID, totalSize, int(fileCount))
	}
}