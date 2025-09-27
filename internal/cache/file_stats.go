package cache

import (
	"sync"
	"time"
	"unsafe"
)

// FileStatsCache handles file statistics for categories with hot updates
type FileStatsCache struct {
	categories map[int]*CategoryFileStats // categoryID -> stats
	mutex      sync.RWMutex
}

// CategoryFileStats stores file statistics for a category
type CategoryFileStats struct {
	CategoryID int              `json:"category_id"`
	Direct     FileStatsSummary `json:"direct"`
	Recursive  FileStatsSummary `json:"recursive"`
	LastUpdate int64            `json:"last_update"`
	Mutex      sync.RWMutex     `json:"-"`
}

// FileStatsSummary contains aggregated file statistics
type FileStatsSummary struct {
	FileCount int64 `json:"file_count"`
	TotalSize int64 `json:"total_size"`
}

// FileStatsRequest represents a request for file statistics
type FileStatsRequest struct {
	CategoryID int  `json:"category_id"`
	Recursive  bool `json:"recursive"`
}

// FileStatsResponse represents the response for file statistics
type FileStatsResponse struct {
	CategoryID int              `json:"category_id"`
	Recursive  bool             `json:"recursive"`
	Stats      FileStatsSummary `json:"stats"`
	LastUpdate int64            `json:"last_update"`
}

var fileStatsCache *FileStatsCache
var fileStatsCacheOnce sync.Once

// GetFileStatsCache returns the global file statistics cache instance
func GetFileStatsCache() *FileStatsCache {
	fileStatsCacheOnce.Do(func() {
		fileStatsCache = &FileStatsCache{
			categories: make(map[int]*CategoryFileStats),
		}
	})
	return fileStatsCache
}

// GetCategoryFileStats returns file statistics for a category
func (c *FileStatsCache) GetCategoryFileStats(categoryID int) *CategoryFileStats {
	c.mutex.RLock()
	defer c.mutex.RUnlock()
	return c.categories[categoryID]
}

// RefreshCategory rebuilds file statistics for a specific category
func (c *FileStatsCache) RefreshCategory(categoryID int, attachments []AttachmentData) error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	stats := &CategoryFileStats{
		CategoryID: categoryID,
		Direct:     FileStatsSummary{},
		Recursive:  FileStatsSummary{},
		LastUpdate: time.Now().UnixMilli(),
	}

	// Calculate direct statistics
	for _, attachment := range attachments {
		stats.Direct.FileCount++
		stats.Direct.TotalSize += attachment.FileSize
	}

	c.categories[categoryID] = stats
	return nil
}

// UpdateFileStats updates file statistics when files are added/removed
func (c *FileStatsCache) UpdateFileStats(categoryID int, fileSizeDelta int64, fileCountDelta int64) error {
	c.mutex.RLock()
	stats := c.categories[categoryID]
	c.mutex.RUnlock()

	if stats == nil {
		// Initialize if not exists
		c.mutex.Lock()
		stats = &CategoryFileStats{
			CategoryID: categoryID,
			Direct:     FileStatsSummary{},
			Recursive:  FileStatsSummary{},
			LastUpdate: time.Now().UnixMilli(),
		}
		c.categories[categoryID] = stats
		c.mutex.Unlock()
	}

	stats.Mutex.Lock()
	defer stats.Mutex.Unlock()

	// Update direct stats
	stats.Direct.FileCount += fileCountDelta
	stats.Direct.TotalSize += fileSizeDelta

	// Update the category's own recursive stats (important for recursive mode)
	// Initialize recursive stats if they don't exist
	if stats.Recursive.FileCount == 0 && stats.Recursive.TotalSize == 0 && stats.Direct.FileCount > 0 {
		// Copy direct stats to recursive for first time initialization
		stats.Recursive.FileCount = stats.Direct.FileCount
		stats.Recursive.TotalSize = stats.Direct.TotalSize
	} else {
		// Update recursive stats with delta
		stats.Recursive.FileCount += fileCountDelta
		stats.Recursive.TotalSize += fileSizeDelta
	}

	stats.LastUpdate = time.Now().UnixMilli()

	// Ensure non-negative values for both direct and recursive
	if stats.Direct.FileCount < 0 {
		stats.Direct.FileCount = 0
	}
	if stats.Direct.TotalSize < 0 {
		stats.Direct.TotalSize = 0
	}
	if stats.Recursive.FileCount < 0 {
		stats.Recursive.FileCount = 0
	}
	if stats.Recursive.TotalSize < 0 {
		stats.Recursive.TotalSize = 0
	}

	return nil
}

// GetFileStats returns file statistics for a category
func (c *FileStatsCache) GetFileStats(req FileStatsRequest) (*FileStatsResponse, error) {
	c.mutex.RLock()
	stats := c.categories[req.CategoryID]
	c.mutex.RUnlock()

	if stats == nil {
		// Return empty stats if category not found
		return &FileStatsResponse{
			CategoryID: req.CategoryID,
			Recursive:  req.Recursive,
			Stats:      FileStatsSummary{},
			LastUpdate: 0,
		}, nil
	}

	stats.Mutex.RLock()
	defer stats.Mutex.RUnlock()

	var resultStats FileStatsSummary
	if req.Recursive {
		resultStats = stats.Recursive
	} else {
		resultStats = stats.Direct
	}

	return &FileStatsResponse{
		CategoryID: req.CategoryID,
		Recursive:  req.Recursive,
		Stats:      resultStats,
		LastUpdate: stats.LastUpdate,
	}, nil
}

// GetCacheStats returns file statistics cache statistics
func (c *FileStatsCache) GetCacheStats() map[string]interface{} {
	c.mutex.RLock()
	defer c.mutex.RUnlock()

	totalFiles := int64(0)
	totalSize := int64(0)
	categoriesCount := len(c.categories)
	totalMemoryBytes := int64(0)

	// Calculate base cache overhead
	totalMemoryBytes += int64(unsafe.Sizeof(*c))
	totalMemoryBytes += int64(len(c.categories)) * int64(unsafe.Sizeof(uintptr(0))) // map entry overhead

	for _, stats := range c.categories {
		stats.Mutex.RLock()

		// Count file stats
		totalFiles += stats.Direct.FileCount
		totalSize += stats.Direct.TotalSize

		// Calculate memory usage for this category
		categoryMemory := int64(unsafe.Sizeof(*stats))

		// Add memory for the FileStats structures
		categoryMemory += int64(unsafe.Sizeof(stats.Direct))
		categoryMemory += int64(unsafe.Sizeof(stats.Recursive))

		totalMemoryBytes += categoryMemory
		stats.Mutex.RUnlock()
	}

	return map[string]interface{}{
		"categories_cached":  categoriesCount,
		"total_files_cached": totalFiles,
		"total_size_cached":  totalSize,
		"cache_size_bytes":   totalMemoryBytes,
		"cache_size_mb":      float64(totalMemoryBytes) / (1024 * 1024),
		"memory_efficient":   true,
	}
}

// AttachmentData represents minimal attachment data for cache operations
type AttachmentData struct {
	ID         int   `json:"id"`
	PostID     int   `json:"post_id"`
	CategoryID int   `json:"category_id"`
	FileSize   int64 `json:"file_size"`
}
