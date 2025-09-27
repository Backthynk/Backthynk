package handlers

import (
	"backthynk/internal/cache"
	"backthynk/internal/config"
	"backthynk/internal/services"
	"backthynk/internal/storage"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
)

type CategoryStatsHandler struct {
	db               *storage.DB
	activityService  *services.ActivityService
	fileStatsService *services.FileStatsService
}

func NewCategoryStatsHandler(db *storage.DB, activityService *services.ActivityService, fileStatsService *services.FileStatsService) *CategoryStatsHandler {
	return &CategoryStatsHandler{
		db:               db,
		activityService:  activityService,
		fileStatsService: fileStatsService,
	}
}

// CategoryStatsResponse provides comprehensive category statistics
type CategoryStatsResponse struct {
	CategoryID  int   `json:"category_id"`
	Recursive   bool  `json:"recursive"`
	PostCount   int   `json:"post_count"`
	FileCount   int64 `json:"file_count"`
	TotalSize   int64 `json:"total_size"`
	LastUpdated int64 `json:"last_updated"`
}

// GetCategoryStats handles GET /api/category-stats/{id}
// Query parameters:
// - recursive: true/false (default: false)
func (h *CategoryStatsHandler) GetCategoryStats(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	categoryIDStr := vars["id"]

	categoryID, err := strconv.Atoi(categoryIDStr)
	if err != nil {
		http.Error(w, "Invalid category ID", http.StatusBadRequest)
		return
	}

	// Parse query parameters
	query := r.URL.Query()
	recursive := query.Get("recursive") == "true"

	var postCount int
	var fileCount int64
	var totalSize int64
	var lastFileStatsUpdate int64

	// Get post count directly from database (forever data, not period-based)
	if categoryID == config.ALL_CATEGORIES_ID {
		// ALL_CATEGORIES_ID means global stats across all categories
		if count, err := h.db.GetTotalPostCount(); err == nil {
			postCount = count
		}

		if h.fileStatsService != nil {
			fileStatsData, err := h.fileStatsService.GetGlobalFileStats()
			if err == nil {
				fileCount = fileStatsData.FileCount
				totalSize = fileStatsData.TotalSize
				lastFileStatsUpdate = time.Now().UnixMilli() // Use current time for global stats
			}
		}
	} else {
		// Get post count for specific category (with or without recursive)
		if count, err := h.db.GetPostCountByCategoryRecursive(categoryID, recursive); err == nil {
			postCount = count
		}

		// Get file statistics
		if h.fileStatsService != nil {
			fileStatsReq := cache.FileStatsRequest{
				CategoryID: categoryID,
				Recursive:  recursive,
			}

			fileStats, err := h.fileStatsService.GetFileStats(fileStatsReq)
			if err == nil {
				fileCount = fileStats.Stats.FileCount
				totalSize = fileStats.Stats.TotalSize
				lastFileStatsUpdate = fileStats.LastUpdate
			}
		}
	}

	// Use file stats update time, or current time as fallback
	lastUpdated := lastFileStatsUpdate
	if lastUpdated == 0 {
		lastUpdated = time.Now().UnixMilli()
	}

	response := CategoryStatsResponse{
		CategoryID:  categoryID,
		Recursive:   recursive,
		PostCount:   postCount,
		FileCount:   fileCount,
		TotalSize:   totalSize,
		LastUpdated: lastUpdated,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
