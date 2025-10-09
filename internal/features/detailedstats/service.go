package detailedstats

import (
	"backthynk/internal/core/cache"
	"backthynk/internal/core/events"
	"backthynk/internal/storage"
	"sync"
)

type Stats struct {
	FileCount int64 `json:"file_count"`
	TotalSize int64 `json:"total_size"`
}

type Service struct {
	db        *storage.DB
	catCache  *cache.SpaceCache
	stats     map[int]*SpaceStats     // spaceID -> stats
	postFiles map[int]map[int]*FileInfo  // spaceID -> postID -> file info
	mu        sync.RWMutex
	enabled   bool
}

type FileInfo struct {
	FileCount int64
	TotalSize int64
}

type SpaceStats struct {
	Direct    Stats `json:"direct"`
	Recursive Stats `json:"recursive"`
	mu        sync.RWMutex
}

func NewService(db *storage.DB, catCache *cache.SpaceCache, enabled bool) *Service {
	return &Service{
		db:        db,
		catCache:  catCache,
		stats:     make(map[int]*SpaceStats),
		postFiles: make(map[int]map[int]*FileInfo),
		enabled:   enabled,
	}
}

func (s *Service) Initialize() error {
	if !s.enabled {
		return nil
	}

	// Load all file stats from database
	fileStats, err := s.db.GetAllFileStats()
	if err != nil {
		return err
	}

	// Build direct stats
	for catID, stats := range fileStats {
		s.stats[catID] = &SpaceStats{
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
		if _, ok := s.postFiles[pfs.SpaceID]; !ok {
			s.postFiles[pfs.SpaceID] = make(map[int]*FileInfo)
		}
		s.postFiles[pfs.SpaceID][pfs.PostID] = &FileInfo{
			FileCount: pfs.FileCount,
			TotalSize: pfs.TotalSize,
		}
	}
	s.mu.Unlock()

	// Calculate recursive stats
	spaces := s.catCache.GetAll()
	for _, cat := range spaces {
		s.calculateRecursiveStats(cat.ID)
	}

	return nil
}

func (s *Service) calculateRecursiveStats(spaceID int) {
	if !s.enabled {
		return
	}
	
	stats, ok := s.stats[spaceID]
	if !ok {
		stats = &SpaceStats{}
		s.stats[spaceID] = stats
	}
	
	stats.mu.Lock()
	defer stats.mu.Unlock()
	
	// Start with direct stats
	stats.Recursive = stats.Direct
	
	// Add descendant stats
	descendants := s.catCache.GetDescendants(spaceID)
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
		s.updateStats(data.SpaceID, data.FileSize, 1)
		s.trackFileByPost(data.SpaceID, data.PostID, data.FileSize, 1)

	case events.FileDeleted:
		data := event.Data.(events.PostEvent)
		s.updateStats(data.SpaceID, -data.FileSize, -1)
		s.trackFileByPost(data.SpaceID, data.PostID, -data.FileSize, -1)
		
	case events.PostDeleted:
		data := event.Data.(events.PostEvent)
		if data.FileCount > 0 {
			s.updateStats(data.SpaceID, -data.FileSize, -data.FileCount)
		}

	case events.PostMoved:
		data := event.Data.(events.PostEvent)
		if data.OldSpaceID != nil {
			// For post moves, we need to calculate how many files are being moved
			// by looking at what files exist for this post in our internal stats
			s.handlePostMoved(data.PostID, *data.OldSpaceID, data.SpaceID)
		}

	case events.SpaceUpdated:
		data := event.Data.(events.SpaceEvent)
		// When a space is moved, we need to recalculate recursive stats
		// for the old and new parent hierarchies
		if data.OldParentID != data.NewParentID {
			s.handleSpaceHierarchyChange(data.SpaceID, data.OldParentID, data.NewParentID)
		}

	case events.SpaceDeleted:
		data := event.Data.(events.SpaceEvent)
		s.handleSpaceDeleted(data.SpaceID, data.AffectedPosts, data.OldParentID)
	}
	
	return nil
}

func (s *Service) updateStats(spaceID int, sizeDelta int64, countDelta int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	stats, ok := s.stats[spaceID]
	if !ok {
		stats = &SpaceStats{}
		s.stats[spaceID] = stats
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
	s.updateParentRecursiveStats(spaceID, sizeDelta, countDelta)
}

func (s *Service) updateParentRecursiveStats(spaceID int, sizeDelta int64, countDelta int) {
	// Update self
	if stats, ok := s.stats[spaceID]; ok {
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

	// If catCache is nil (e.g., in tests), we can only update this one level
	if s.catCache == nil {
		return
	}

	// Update ancestors by walking up the parent chain
	current := spaceID
	for {
		// Get parent of current space
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
			parentStats := &SpaceStats{}
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

func (s *Service) GetStats(spaceID int, recursive bool) *Stats {
	if !s.enabled {
		return &Stats{}
	}
	
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	stats, ok := s.stats[spaceID]
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

// handleSpaceHierarchyChange handles when a space is moved to a different parent
func (s *Service) handleSpaceHierarchyChange(spaceID int, oldParentID, newParentID *int) {
	if !s.enabled {
		return
	}

	// Get direct stats for the moved space and all its descendants
	descendants := s.catCache.GetDescendants(spaceID)
	affectedSpaces := append([]int{spaceID}, descendants...)

	var totalFilesImpacted int64
	var totalSizeImpacted int64

	// Calculate total impact from the moved space tree
	s.mu.RLock()
	for _, catID := range affectedSpaces {
		if stats, ok := s.stats[catID]; ok {
			stats.mu.RLock()
			totalFilesImpacted += stats.Direct.FileCount
			totalSizeImpacted += stats.Direct.TotalSize
			stats.mu.RUnlock()
		}
	}
	s.mu.RUnlock()

	// Update old parent hierarchy (subtract the moved space's impact)
	if oldParentID != nil {
		s.updateParentRecursiveStatsForHierarchy(*oldParentID, -totalSizeImpacted, -int(totalFilesImpacted))
	}

	// Update new parent hierarchy (add the moved space's impact)
	if newParentID != nil {
		s.updateParentRecursiveStatsForHierarchy(*newParentID, totalSizeImpacted, int(totalFilesImpacted))
	}

	// Recalculate recursive stats for the moved space tree since parent relationships changed
	for _, catID := range affectedSpaces {
		s.calculateRecursiveStats(catID)
	}
}

// updateParentRecursiveStatsForHierarchy updates recursive stats for a parent and all its ancestors
func (s *Service) updateParentRecursiveStatsForHierarchy(startSpaceID int, sizeDelta int64, countDelta int) {
	current := startSpaceID

	s.mu.Lock()
	defer s.mu.Unlock()

	for {
		// Update current space's recursive stats
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
			// Create stats entry for this space
			newStats := &SpaceStats{}
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

		// Get parent of current space
		cat, ok := s.catCache.Get(current)
		if !ok || cat.ParentID == nil {
			break
		}

		current = *cat.ParentID
	}
}

// trackFileByPost tracks files by post ID for accurate post movement handling
func (s *Service) trackFileByPost(spaceID, postID int, sizeDelta int64, countDelta int) {
	if _, ok := s.postFiles[spaceID]; !ok {
		s.postFiles[spaceID] = make(map[int]*FileInfo)
	}

	if _, ok := s.postFiles[spaceID][postID]; !ok {
		s.postFiles[spaceID][postID] = &FileInfo{}
	}

	fileInfo := s.postFiles[spaceID][postID]
	fileInfo.FileCount += int64(countDelta)
	fileInfo.TotalSize += sizeDelta

	// Clean up if no files left
	if fileInfo.FileCount <= 0 && fileInfo.TotalSize <= 0 {
		delete(s.postFiles[spaceID], postID)
		if len(s.postFiles[spaceID]) == 0 {
			delete(s.postFiles, spaceID)
		}
	}
}

// updateParentRecursiveStatsFromParent updates recursive stats starting from a specific parent space
// This is used when we know the parent ID but the child space is already removed from cache
func (s *Service) updateParentRecursiveStatsFromParent(startParentID int, sizeDelta int64, countDelta int) {
	current := startParentID

	for {
		// Update current space's recursive stats
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
			// Create stats entry for this space
			newStats := &SpaceStats{}
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

		// Get parent of current space
		// If catCache is nil (e.g., in tests), we can only update this one level
		if s.catCache == nil {
			break
		}

		cat, ok := s.catCache.Get(current)
		if !ok || cat.ParentID == nil {
			break
		}

		current = *cat.ParentID
	}
}

// handleSpaceDeleted handles when a space and potentially its subspaces are deleted
func (s *Service) handleSpaceDeleted(spaceID int, affectedPosts []int, parentID *int) {
	if !s.enabled {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// Get the stats of the space before deletion to update parent recursive stats
	if stats, exists := s.stats[spaceID]; exists {
		// Get the direct stats that need to be subtracted from parent spaces
		stats.mu.RLock()
		deletedFileCount := stats.Direct.FileCount
		deletedTotalSize := stats.Direct.TotalSize
		stats.mu.RUnlock()

		// Update parent recursive stats by subtracting the deleted space's direct stats
		// Use the parent information from the event since the space is already removed from cache
		if (deletedFileCount > 0 || deletedTotalSize > 0) && parentID != nil {
			s.updateParentRecursiveStatsFromParent(*parentID, -deletedTotalSize, -int(deletedFileCount))
		}
	}

	// Remove stats for the deleted space
	delete(s.stats, spaceID)

	// Remove post file tracking for the deleted space
	delete(s.postFiles, spaceID)

	// Note: For subspaces, the space service sends separate SpaceDeleted events
	// for each subspace, so this method will be called for each one individually
}

// handlePostMoved handles when a post is moved between spaces
func (s *Service) handlePostMoved(postID, oldSpaceID, newSpaceID int) {
	// Find the files for this post in the old space
	var fileCount int64
	var totalSize int64

	s.mu.Lock()
	if postFiles, ok := s.postFiles[oldSpaceID]; ok {
		if fileInfo, ok := postFiles[postID]; ok {
			fileCount = fileInfo.FileCount
			totalSize = fileInfo.TotalSize

			// Remove from old space tracking
			delete(postFiles, postID)
			if len(postFiles) == 0 {
				delete(s.postFiles, oldSpaceID)
			}

			// Add to new space tracking
			if _, ok := s.postFiles[newSpaceID]; !ok {
				s.postFiles[newSpaceID] = make(map[int]*FileInfo)
			}
			s.postFiles[newSpaceID][postID] = &FileInfo{
				FileCount: fileCount,
				TotalSize: totalSize,
			}
		}
	}
	s.mu.Unlock()

	// Update stats if there were files to move
	if fileCount > 0 || totalSize > 0 {
		s.updateStats(oldSpaceID, -totalSize, -int(fileCount))
		s.updateStats(newSpaceID, totalSize, int(fileCount))
	}
}