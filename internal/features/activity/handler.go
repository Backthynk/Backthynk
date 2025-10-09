package activity

import (
	"backthynk/internal/config"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(router *mux.Router) {
	if !h.service.enabled {
		return
	}
	
	api := router.PathPrefix("/api").Subrouter()
	api.HandleFunc("/activity/{id}", h.GetActivityPeriod).Methods("GET")
}

func (h *Handler) GetActivityPeriod(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	spaceID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, config.ErrInvalidSpaceID, http.StatusBadRequest)
		return
	}
	
	// Parse query parameters
	query := r.URL.Query()
	
	recursive := query.Get("recursive") == "true"
	
	period := 0
	if periodStr := query.Get("period"); periodStr != "" {
		if p, err := strconv.Atoi(periodStr); err == nil {
			period = p
		}
	}
	
	// Get period months from options config, fallback to query param or default
	periodMonths := 4 // Default fallback
	options := config.GetOptionsConfig()
	if options != nil && options.Features.Activity.PeriodMonths > 0 {
		periodMonths = options.Features.Activity.PeriodMonths
	}

	// Allow override via query parameter
	if monthsStr := query.Get("period_months"); monthsStr != "" {
		if m, err := strconv.Atoi(monthsStr); err == nil && m > 0 {
			periodMonths = m
		}
	}
	
	req := ActivityPeriodRequest{
		SpaceID:   spaceID,
		Recursive:    recursive,
		StartDate:    query.Get("start_date"),
		EndDate:      query.Get("end_date"),
		Period:       period,
		PeriodMonths: periodMonths,
	}
	
	response, err := h.service.GetActivityPeriod(req)
	if err != nil {
		http.Error(w, config.ErrFailedToGetActivity+err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}