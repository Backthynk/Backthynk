package services

import (
	"backthynk/internal/cache"
	"backthynk/internal/models"
	"backthynk/internal/storage"
	"fmt"
	"log"
	"time"
)

// FileStatsService handles file statistics cache operations with database integration
type FileStatsService struct {
	db    *storage.DB
	cache *cache.FileStatsCache
}

// NewFileStatsService creates a new file statistics service
func NewFileStatsService(db *storage.DB) *FileStatsService {
	return &FileStatsService{
		db:    db,
		cache: cache.GetFileStatsCache(),
	}
}

// InitializeCache builds the file statistics cache from existing database data
func (s *FileStatsService) InitializeCache() error {
	log.Println("Initializing file statistics cache...")
	start := time.Now()

	// Get all categories to build hierarchy
	categories, err := s.db.GetCategories()
	if err != nil {
		return fmt.Errorf("failed to get categories: %w", err)
	}

	// Build hierarchy map
	hierarchy := make(map[int][]int) // parentID -> []childIDs
	parentMap := make(map[int]int)   // childID -> parentID

	for _, cat := range categories {
		if cat.ParentID != nil {
			hierarchy[*cat.ParentID] = append(hierarchy[*cat.ParentID], cat.ID)
			parentMap[cat.ID] = *cat.ParentID
		}
	}

	// Get all attachments for file statistics calculation
	allAttachments, err := s.getAllAttachmentsForCache()
	if err != nil {
		return fmt.Errorf("failed to get attachments for cache: %w", err)
	}

	log.Printf("Processing %d attachments across %d categories...", len(allAttachments), len(categories))

	// Group attachments by category
	attachmentsByCategory := make(map[int][]cache.AttachmentData)
	for _, attachment := range allAttachments {
		attachmentsByCategory[attachment.CategoryID] = append(attachmentsByCategory[attachment.CategoryID], attachment)
	}

	// Initialize cache for each category (direct statistics only first)
	for _, cat := range categories {
		attachments := attachmentsByCategory[cat.ID]
		if err := s.cache.RefreshCategory(cat.ID, attachments); err != nil {
			log.Printf("Warning: failed to refresh file stats cache for category %d: %v", cat.ID, err)
		}
	}

	// Build recursive file statistics in correct order: deepest children first
	// Sort categories by depth (deepest first) so children are processed before parents
	sortedCategories := make([]models.Category, len(categories))
	copy(sortedCategories, categories)

	// Sort by depth descending (deepest first)
	for i := 0; i < len(sortedCategories)-1; i++ {
		for j := i + 1; j < len(sortedCategories); j++ {
			if sortedCategories[i].Depth < sortedCategories[j].Depth {
				sortedCategories[i], sortedCategories[j] = sortedCategories[j], sortedCategories[i]
			}
		}
	}

	// Build recursive file statistics in depth order
	for _, cat := range sortedCategories {
		if err := s.buildRecursiveFileStats(cat.ID, hierarchy, attachmentsByCategory); err != nil {
			log.Printf("Warning: failed to build recursive file stats for category %d: %v", cat.ID, err)
		}
	}

	elapsed := time.Since(start)
	stats := s.cache.GetCacheStats()
	log.Printf("File statistics cache initialized in %v. Stats: %+v", elapsed, stats)

	return nil
}

// buildRecursiveFileStats builds recursive file statistics for a category
func (s *FileStatsService) buildRecursiveFileStats(categoryID int, hierarchy map[int][]int, attachmentsByCategory map[int][]cache.AttachmentData) error {
	stats := s.cache.GetCategoryFileStats(categoryID)
	if stats == nil {
		return fmt.Errorf("category %d not found in file stats cache", categoryID)
	}

	stats.Mutex.Lock()
	defer stats.Mutex.Unlock()

	// Start with direct file statistics
	stats.Recursive = cache.FileStatsSummary{
		FileCount: stats.Direct.FileCount,
		TotalSize: stats.Direct.TotalSize,
	}

	// Add descendant file statistics
	descendants := s.getDescendants(categoryID, hierarchy)
	for _, descendantID := range descendants {
		descendantStats := s.cache.GetCategoryFileStats(descendantID)
		if descendantStats != nil {
			descendantStats.Mutex.RLock()
			stats.Recursive.FileCount += descendantStats.Direct.FileCount
			stats.Recursive.TotalSize += descendantStats.Direct.TotalSize
			descendantStats.Mutex.RUnlock()
		}
	}

	return nil
}

// getDescendants returns all descendant category IDs
func (s *FileStatsService) getDescendants(categoryID int, hierarchy map[int][]int) []int {
	var descendants []int
	children := hierarchy[categoryID]

	for _, childID := range children {
		descendants = append(descendants, childID)
		// Recursively get grandchildren
		grandchildren := s.getDescendants(childID, hierarchy)
		descendants = append(descendants, grandchildren...)
	}

	return descendants
}

// getAllAttachmentsForCache retrieves minimal attachment data needed for file statistics cache
func (s *FileStatsService) getAllAttachmentsForCache() ([]cache.AttachmentData, error) {
	query := `
		SELECT a.id, a.post_id, p.category_id, a.file_size
		FROM attachments a
		JOIN posts p ON a.post_id = p.id
		ORDER BY a.id
	`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attachments []cache.AttachmentData
	for rows.Next() {
		var attachment cache.AttachmentData
		err := rows.Scan(&attachment.ID, &attachment.PostID, &attachment.CategoryID, &attachment.FileSize)
		if err != nil {
			return nil, fmt.Errorf("failed to scan attachment: %w", err)
		}
		attachments = append(attachments, attachment)
	}

	return attachments, nil
}

// OnFileUploaded updates the cache when a file is uploaded
func (s *FileStatsService) OnFileUploaded(categoryID int, fileSize int64) error {
	if err := s.cache.UpdateFileStats(categoryID, fileSize, 1); err != nil {
		log.Printf("Warning: failed to update file stats cache for file upload: %v", err)
	}

	// Update parent categories' recursive file statistics
	return s.updateParentRecursiveFileStats(categoryID, fileSize, 1)
}

// OnFileDeleted updates the cache when a file is deleted
func (s *FileStatsService) OnFileDeleted(categoryID int, fileSize int64) error {
	if err := s.cache.UpdateFileStats(categoryID, -fileSize, -1); err != nil {
		log.Printf("Warning: failed to update file stats cache for file deletion: %v", err)
	}

	// Update parent categories' recursive file statistics
	return s.updateParentRecursiveFileStats(categoryID, -fileSize, -1)
}

// updateParentRecursiveFileStats updates recursive file statistics for parent categories
func (s *FileStatsService) updateParentRecursiveFileStats(categoryID int, fileSizeDelta int64, fileCountDelta int64) error {
	// Get parent category
	query := "SELECT parent_id FROM categories WHERE id = ?"
	var parentID *int
	err := s.db.QueryRow(query, categoryID).Scan(&parentID)
	if err != nil {
		if err.Error() == "sql: no rows in result set" {
			return nil // No parent
		}
		return err
	}

	if parentID == nil {
		return nil // No parent
	}

	// Update parent's recursive file statistics
	parentStats := s.cache.GetCategoryFileStats(*parentID)
	if parentStats != nil {
		parentStats.Mutex.Lock()
		parentStats.Recursive.FileCount += fileCountDelta
		parentStats.Recursive.TotalSize += fileSizeDelta

		// Ensure non-negative values
		if parentStats.Recursive.FileCount < 0 {
			parentStats.Recursive.FileCount = 0
		}
		if parentStats.Recursive.TotalSize < 0 {
			parentStats.Recursive.TotalSize = 0
		}

		parentStats.LastUpdate = time.Now().UnixMilli()
		parentStats.Mutex.Unlock()
	}

	// Recursively update grandparents
	return s.updateParentRecursiveFileStats(*parentID, fileSizeDelta, fileCountDelta)
}

// GetFileStats returns file statistics for a specific category
func (s *FileStatsService) GetFileStats(req cache.FileStatsRequest) (*cache.FileStatsResponse, error) {
	return s.cache.GetFileStats(req)
}

// RefreshCategoryFileStats rebuilds file statistics cache for a specific category
func (s *FileStatsService) RefreshCategoryFileStats(categoryID int) error {
	// Get all attachments for this category
	query := `
		SELECT a.id, a.post_id, p.category_id, a.file_size
		FROM attachments a
		JOIN posts p ON a.post_id = p.id
		WHERE p.category_id = ?
		ORDER BY a.id
	`
	rows, err := s.db.Query(query, categoryID)
	if err != nil {
		return err
	}
	defer rows.Close()

	var attachments []cache.AttachmentData
	for rows.Next() {
		var attachment cache.AttachmentData
		err := rows.Scan(&attachment.ID, &attachment.PostID, &attachment.CategoryID, &attachment.FileSize)
		if err != nil {
			return fmt.Errorf("failed to scan attachment: %w", err)
		}
		attachments = append(attachments, attachment)
	}

	return s.cache.RefreshCategory(categoryID, attachments)
}

// GetGlobalFileStats returns aggregated file statistics across all categories
func (s *FileStatsService) GetGlobalFileStats() (*cache.FileStatsSummary, error) {
	// Get all categories to aggregate their file statistics
	categories, err := s.db.GetCategories()
	if err != nil {
		return nil, fmt.Errorf("failed to get categories: %w", err)
	}

	var totalFiles int64
	var totalSize int64

	// Process each category
	for _, category := range categories {
		req := cache.FileStatsRequest{
			CategoryID: category.ID,
			Recursive:  false, // We'll process each category individually
		}

		response, err := s.GetFileStats(req)
		if err != nil {
			// Log error but continue with other categories
			log.Printf("Warning: failed to get file stats for category %d: %v", category.ID, err)
			continue
		}

		totalFiles += response.Stats.FileCount
		totalSize += response.Stats.TotalSize
	}

	return &cache.FileStatsSummary{
		FileCount: totalFiles,
		TotalSize: totalSize,
	}, nil
}


