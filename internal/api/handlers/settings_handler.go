package handlers

import (
	"backthynk/internal/config"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
)

type SettingsHandler struct{}

func NewSettingsHandler() *SettingsHandler {
	return &SettingsHandler{}
}

func (h *SettingsHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	options := config.GetOptionsConfig()

	// Convert to frontend format
	response := map[string]interface{}{
		"maxFileSizeMB":             options.Core.MaxFileSizeMB,
		"maxContentLength":          options.Core.MaxContentLength,
		"maxFilesPerPost":           options.Core.MaxFilesPerPost,
		"retroactivePostingEnabled": options.Features.RetroactivePosting.Enabled,
		"retroactivePostingTimeFormat": options.Features.RetroactivePosting.TimeFormat,
		"activityEnabled":           options.Features.Activity.Enabled,
		"fileStatsEnabled":          options.Features.DetailedStats.Enabled,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *SettingsHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}
	
	// Load current options
	options := config.GetOptionsConfig()
	
	// Update core settings
	if val, ok := req["maxFileSizeMB"].(float64); ok {
		options.Core.MaxFileSizeMB = int(val)
	}
	if val, ok := req["maxContentLength"].(float64); ok {
		options.Core.MaxContentLength = int(val)
	}
	if val, ok := req["maxFilesPerPost"].(float64); ok {
		options.Core.MaxFilesPerPost = int(val)
	}

	// Update feature settings
	if val, ok := req["activityEnabled"].(bool); ok {
		options.Features.Activity.Enabled = val
	}
	if val, ok := req["fileStatsEnabled"].(bool); ok {
		options.Features.DetailedStats.Enabled = val
	}
	if val, ok := req["retroactivePostingEnabled"].(bool); ok {
		options.Features.RetroactivePosting.Enabled = val
	}
	if val, ok := req["retroactivePostingTimeFormat"].(string); ok {
		// Validate time format
		if val == "12h" || val == "24h" {
			options.Features.RetroactivePosting.TimeFormat = val
		}
	}
	
	// Validate settings
	if err := h.validateSettings(options); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	// Save to file
	data, err := json.MarshalIndent(options, "", "  ")
	if err != nil {
		http.Error(w, "Failed to marshal settings", http.StatusInternalServerError)
		return
	}
	
	if err := os.WriteFile("options.json", data, config.FilePermissions); err != nil {
		http.Error(w, fmt.Sprintf("Failed to save settings: %v", err), http.StatusInternalServerError)
		return
	}
	
	// Return in frontend format
	response := map[string]interface{}{
		"maxFileSizeMB":                    options.Core.MaxFileSizeMB,
		"maxContentLength":                 options.Core.MaxContentLength,
		"maxFilesPerPost":                  options.Core.MaxFilesPerPost,
		"retroactivePostingEnabled":        options.Features.RetroactivePosting.Enabled,
		"retroactivePostingTimeFormat":     options.Features.RetroactivePosting.TimeFormat,
		"activityEnabled":                  options.Features.Activity.Enabled,
		"fileStatsEnabled":                 options.Features.DetailedStats.Enabled,
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *SettingsHandler) validateSettings(options *config.OptionsConfig) error {
	if options.Core.MaxFileSizeMB < 1 || options.Core.MaxFileSizeMB > 10240 {
		return fmt.Errorf("maxFileSizeMB must be between 1 and 10240")
	}
	
	if options.Core.MaxContentLength < 100 || options.Core.MaxContentLength > 50000 {
		return fmt.Errorf("maxContentLength must be between 100 and 50000")
	}
	
	if options.Core.MaxFilesPerPost < 1 || options.Core.MaxFilesPerPost > 50 {
		return fmt.Errorf("maxFilesPerPost must be between 1 and 50")
	}
	
	return nil
}