package handlers

import (
	"backthynk/internal/cache"
	"backthynk/internal/config"
	"backthynk/internal/services"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

type ActivityHandler struct {
	activityService *services.ActivityService
}

func NewActivityHandler(activityService *services.ActivityService) *ActivityHandler {
	return &ActivityHandler{
		activityService: activityService,
	}
}

// GetActivityPeriod handles GET /api/activity/{id}
// Query parameters:
// - recursive: true/false (default: false)
// - period: 0 (current), -1, -2, etc. for historical periods (default: 0)
// - period_months: number of months per period (default: 4)
// - start_date: YYYY-MM-DD (optional, overrides period calculation)
// - end_date: YYYY-MM-DD (optional, overrides period calculation)
func (h *ActivityHandler) GetActivityPeriod(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	categoryIDStr := vars["id"]

	categoryID, err := strconv.Atoi(categoryIDStr)
	if err != nil {
		http.Error(w, "Invalid category ID", http.StatusBadRequest)
		return
	}

	// Parse query parameters
	query := r.URL.Query()

	recursive := false
	if query.Get("recursive") == "true" {
		recursive = true
	}

	period := 0
	if periodStr := query.Get("period"); periodStr != "" {
		if p, err := strconv.Atoi(periodStr); err == nil {
			period = p
		}
	}

	periodMonths := config.DefaultActivityPeriodMonths
	if monthsStr := query.Get("period_months"); monthsStr != "" {
		if m, err := strconv.Atoi(monthsStr); err == nil && m > 0 {
			periodMonths = m
		}
	}

	startDate := query.Get("start_date")
	endDate := query.Get("end_date")

	// Create unified request for all categories (including ALL_CATEGORIES_ID)
	req := cache.ActivityPeriodRequest{
		CategoryID:   categoryID,
		Recursive:    recursive,
		StartDate:    startDate,
		EndDate:      endDate,
		Period:       period,
		PeriodMonths: periodMonths,
	}

	// Get activity data (unified method handles both specific categories and ALL_CATEGORIES_ID)
	response, err := h.activityService.GetActivityPeriod(req)
	if err != nil {
		http.Error(w, "Failed to get activity data: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}


