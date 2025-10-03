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
	categoryID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, config.ErrInvalidCategoryID, http.StatusBadRequest)
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
	
	periodMonths := 4 // Default
	if monthsStr := query.Get("period_months"); monthsStr != "" {
		if m, err := strconv.Atoi(monthsStr); err == nil && m > 0 {
			periodMonths = m
		}
	}
	
	req := ActivityPeriodRequest{
		CategoryID:   categoryID,
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