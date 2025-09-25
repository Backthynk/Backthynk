package handlers

import (
	"backthynk/internal/cache"
	"backthynk/internal/config"
	"backthynk/internal/services"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
)

type CategoryStatsHandler struct {
	activityService  *services.ActivityService
	fileStatsService *services.FileStatsService
}

func NewCategoryStatsHandler(activityService *services.ActivityService, fileStatsService *services.FileStatsService) *CategoryStatsHandler {
	return &CategoryStatsHandler{
		activityService:  activityService,
		fileStatsService: fileStatsService,
	}
}

// CategoryStatsResponse provides comprehensive category statistics
type CategoryStatsResponse struct {
	CategoryID  int                      `json:"category_id"`
	Recursive   bool                     `json:"recursive"`
	PostCount   int                      `json:"post_count"`
	FileCount   int64                    `json:"file_count"`
	TotalSize   int64                    `json:"total_size"`
	LastUpdated int64                    `json:"last_updated"`
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

	// Get activity data for post count
	activityReq := cache.ActivityPeriodRequest{
		CategoryID:   categoryID,
		Recursive:    recursive,
		PeriodMonths: 6,
		Period:       0,
	}

	var postCount int
	var fileCount int64
	var totalSize int64
	var lastActivityUpdate int64
	var lastFileStatsUpdate int64

	if categoryID == config.ALL_CATEGORIES_ID {
		// ALL_CATEGORIES_ID means global stats across all categories
		if h.activityService != nil {
			activityData, err := h.activityService.GetGlobalActivityPeriod(0, 6, "", "")
			if err == nil {
				postCount = activityData.Stats.TotalPosts
			}
			lastActivityUpdate = time.Now().UnixMilli()
		}

		if h.fileStatsService != nil {
			fileStatsData, err := h.fileStatsService.GetGlobalFileStats()
			if err == nil {
				fileCount = fileStatsData.FileCount
				totalSize = fileStatsData.TotalSize
			}
			lastFileStatsUpdate = time.Now().UnixMilli()
		}
	} else {
		if h.activityService != nil {
			activityData, err := h.activityService.GetActivityPeriod(activityReq)
			if err == nil {
				postCount = activityData.Stats.TotalPosts
			}

			lastActivityUpdate = time.Now().UnixMilli() // Use current time as fallback
		}

		// Get file statistics
		fileStatsReq := cache.FileStatsRequest{
			CategoryID: categoryID,
			Recursive:  recursive,
		}

		if h.fileStatsService != nil {
			fileStats, err := h.fileStatsService.GetFileStats(fileStatsReq)
			if err == nil {
				fileCount = fileStats.Stats.FileCount
				totalSize = fileStats.Stats.TotalSize
				lastFileStatsUpdate = fileStats.LastUpdate
			}
		}
	}

	// Use the most recent update time
	lastUpdated := lastActivityUpdate
	if lastFileStatsUpdate > lastUpdated {
		lastUpdated = lastFileStatsUpdate
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