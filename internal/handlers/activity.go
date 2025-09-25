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
// - period_months: number of months per period (default: 6)
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

	periodMonths := 6
	if monthsStr := query.Get("period_months"); monthsStr != "" {
		if m, err := strconv.Atoi(monthsStr); err == nil && m > 0 {
			periodMonths = m
		}
	}

	startDate := query.Get("start_date")
	endDate := query.Get("end_date")

	var response *cache.ActivityPeriodResponse

	if categoryID == config.ALL_CATEGORIES_ID {
		// ALL_CATEGORIES_ID means global activity across all categories
		response, err = h.activityService.GetGlobalActivityPeriod(period, periodMonths, startDate, endDate)
		if err != nil {
			http.Error(w, "Failed to get global activity data: "+err.Error(), http.StatusInternalServerError)
			return
		}
	} else {
		// Create request for specific category
		req := cache.ActivityPeriodRequest{
			CategoryID:   categoryID,
			Recursive:    recursive,
			StartDate:    startDate,
			EndDate:      endDate,
			Period:       period,
			PeriodMonths: periodMonths,
		}

		// Get activity data
		response, err = h.activityService.GetActivityPeriod(req)
		if err != nil {
			http.Error(w, "Failed to get activity data: "+err.Error(), http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}


