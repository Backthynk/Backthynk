package detailedstats

import (
	"backthynk/internal/api/middleware"
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
	if (config.GetAppMode() == config.APP_MODE_DEV) {
		api.Use(middleware.DevMiddleware)
	}

	api.HandleFunc("/space-stats/{id}", h.GetSpaceStats).Methods("GET")
}

type StatsResponse struct {
	SpaceID int   `json:"space_id"`
	Recursive  bool  `json:"recursive"`
	FileCount  int64 `json:"file_count"`
	TotalSize  int64 `json:"total_size"`
}

func (h *Handler) GetSpaceStats(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	spaceID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, config.ErrInvalidSpaceID, http.StatusBadRequest)
		return
	}
	
	recursive := r.URL.Query().Get("recursive") == "true"
	
	var stats *Stats
	if spaceID == 0 { // Global stats
		stats = h.service.GetGlobalStats()
	} else {
		stats = h.service.GetStats(spaceID, recursive)
	}
	
	response := StatsResponse{
		SpaceID: spaceID,
		Recursive:  recursive,
		FileCount:  stats.FileCount,
		TotalSize:  stats.TotalSize,
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}