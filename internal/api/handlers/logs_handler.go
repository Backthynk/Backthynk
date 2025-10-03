package handlers

import (
	"backthynk/internal/core/logger"
	"encoding/json"
	"net/http"
	"strconv"
)

type LogsHandler struct{}

func NewLogsHandler() *LogsHandler {
	return &LogsHandler{}
}

// GetLogs handles GET /api/logs
// Query parameters:
// - filter: "warnings", "errors", or "both" (default: "both")
// - value: number of last lines to retrieve (default: 100)
func (h *LogsHandler) GetLogs(w http.ResponseWriter, r *http.Request) {
	// Parse filter parameter
	filter := r.URL.Query().Get("filter")
	if filter == "" {
		filter = "both"
	}

	// Validate filter parameter
	if filter != "warnings" && filter != "errors" && filter != "both" {
		http.Error(w, "Invalid filter parameter. Must be 'warnings', 'errors', or 'both'", http.StatusBadRequest)
		return
	}

	// Parse value parameter
	valueStr := r.URL.Query().Get("value")
	value := 100 // default
	if valueStr != "" {
		var err error
		value, err = strconv.Atoi(valueStr)
		if err != nil || value <= 0 {
			http.Error(w, "Invalid value parameter. Must be a positive integer", http.StatusBadRequest)
			return
		}
	}

	// Get logger instance
	l := logger.GetLogger()
	if l == nil {
		http.Error(w, "Logger not initialized", http.StatusInternalServerError)
		return
	}

	// Read logs
	logs, err := l.ReadLogs(filter, value)
	if err != nil {
		http.Error(w, "Failed to read logs: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Return logs
	response := map[string]interface{}{
		"filter": filter,
		"value":  value,
		"logs":   logs,
		"count":  len(logs),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
