package detailedstats

import (
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
	api.HandleFunc("/category-stats/{id}", h.GetCategoryStats).Methods("GET")
}

type StatsResponse struct {
	CategoryID int   `json:"category_id"`
	Recursive  bool  `json:"recursive"`
	FileCount  int64 `json:"file_count"`
	TotalSize  int64 `json:"total_size"`
}

func (h *Handler) GetCategoryStats(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	categoryID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid category ID", http.StatusBadRequest)
		return
	}
	
	recursive := r.URL.Query().Get("recursive") == "true"
	
	var stats *Stats
	if categoryID == 0 { // Global stats
		stats = h.service.GetGlobalStats()
	} else {
		stats = h.service.GetStats(categoryID, recursive)
	}
	
	response := StatsResponse{
		CategoryID: categoryID,
		Recursive:  recursive,
		FileCount:  stats.FileCount,
		TotalSize:  stats.TotalSize,
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}