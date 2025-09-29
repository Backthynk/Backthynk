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
	db       *storage.DB
	catCache *cache.CategoryCache
	stats    map[int]*CategoryStats // categoryID -> stats
	mu       sync.RWMutex
	enabled  bool
}

type CategoryStats struct {
	Direct    Stats `json:"direct"`
	Recursive Stats `json:"recursive"`
	mu        sync.RWMutex
}

func NewService(db *storage.DB, catCache *cache.CategoryCache, enabled bool) *Service {
	return &Service{
		db:       db,
		catCache: catCache,
		stats:    make(map[int]*CategoryStats),
		enabled:  enabled,
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
		
	case events.FileDeleted:
		data := event.Data.(events.PostEvent)
		s.updateStats(data.CategoryID, -data.FileSize, -1)
		
	case events.PostDeleted:
		data := event.Data.(events.PostEvent)
		if data.FileCount > 0 {
			s.updateStats(data.CategoryID, -data.FileSize, -data.FileCount)
		}
		
	case events.PostMoved:
		data := event.Data.(events.PostEvent)
		if data.FileCount > 0 && data.OldCategoryID != nil {
			s.updateStats(*data.OldCategoryID, -data.FileSize, -data.FileCount)
			s.updateStats(data.CategoryID, data.FileSize, data.FileCount)
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