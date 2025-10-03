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
		"maxContentLength":                 options.Core.MaxContentLength,
		"siteTitle":                        options.Metadata.Title,
		"siteDescription":                  options.Metadata.Description,
		"retroactivePostingEnabled":        options.Features.RetroactivePosting.Enabled,
		"retroactivePostingTimeFormat":     options.Features.RetroactivePosting.TimeFormat,
		"activityEnabled":                  options.Features.Activity.Enabled,
		"activityPeriodMonths":             options.Features.Activity.PeriodMonths,
		"fileStatsEnabled":                 options.Features.DetailedStats.Enabled,
		"markdownEnabled":                  options.Features.Markdown.Enabled,
		"fileUploadEnabled":                options.Features.FileUpload.Enabled,
		"maxFileSizeMB":                    options.Features.FileUpload.MaxFileSizeMB,
		"maxFilesPerPost":                  options.Features.FileUpload.MaxFilesPerPost,
		"allowedFileExtensions":            options.Features.FileUpload.AllowedExtensions,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *SettingsHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var req map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, config.ErrInvalidJSON, http.StatusBadRequest)
		return
	}

	// Load current options
	options := config.GetOptionsConfig()

	// Update core settings
	if val, ok := req["maxContentLength"].(float64); ok {
		options.Core.MaxContentLength = int(val)
	}

	// Update metadata settings
	if val, ok := req["siteTitle"].(string); ok {
		options.Metadata.Title = val
	}
	if val, ok := req["siteDescription"].(string); ok {
		options.Metadata.Description = val
	}

	// Update feature settings
	if val, ok := req["activityEnabled"].(bool); ok {
		options.Features.Activity.Enabled = val
	}
	if val, ok := req["activityPeriodMonths"].(float64); ok {
		options.Features.Activity.PeriodMonths = int(val)
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
	if val, ok := req["markdownEnabled"].(bool); ok {
		options.Features.Markdown.Enabled = val
	}

	// Update file upload settings
	if val, ok := req["fileUploadEnabled"].(bool); ok {
		options.Features.FileUpload.Enabled = val
	}
	if val, ok := req["maxFileSizeMB"].(float64); ok {
		options.Features.FileUpload.MaxFileSizeMB = int(val)
	}
	if val, ok := req["maxFilesPerPost"].(float64); ok {
		options.Features.FileUpload.MaxFilesPerPost = int(val)
	}
	if val, ok := req["allowedFileExtensions"].([]interface{}); ok {
		extensions := make([]string, 0, len(val))
		for _, ext := range val {
			if str, ok := ext.(string); ok {
				extensions = append(extensions, str)
			}
		}
		options.Features.FileUpload.AllowedExtensions = extensions
	}

	// Validate settings
	if err := h.validateSettings(options); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Save to file
	data, err := json.MarshalIndent(options, "", "  ")
	if err != nil {
		http.Error(w, config.ErrFailedToMarshalSettings, http.StatusInternalServerError)
		return
	}

	serviceConfig := config.GetServiceConfig()
	if err := os.WriteFile(serviceConfig.Files.ConfigFilename, data, config.FilePermissions); err != nil {
		http.Error(w, fmt.Sprintf(config.ErrFmtFailedToSaveSettings, err), http.StatusInternalServerError)
		return
	}

	// Return in frontend format
	response := map[string]interface{}{
		"maxContentLength":                 options.Core.MaxContentLength,
		"siteTitle":                        options.Metadata.Title,
		"siteDescription":                  options.Metadata.Description,
		"retroactivePostingEnabled":        options.Features.RetroactivePosting.Enabled,
		"retroactivePostingTimeFormat":     options.Features.RetroactivePosting.TimeFormat,
		"activityEnabled":                  options.Features.Activity.Enabled,
		"activityPeriodMonths":             options.Features.Activity.PeriodMonths,
		"fileStatsEnabled":                 options.Features.DetailedStats.Enabled,
		"markdownEnabled":                  options.Features.Markdown.Enabled,
		"fileUploadEnabled":                options.Features.FileUpload.Enabled,
		"maxFileSizeMB":                    options.Features.FileUpload.MaxFileSizeMB,
		"maxFilesPerPost":                  options.Features.FileUpload.MaxFilesPerPost,
		"allowedFileExtensions":            options.Features.FileUpload.AllowedExtensions,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *SettingsHandler) validateSettings(options *config.OptionsConfig) error {
	if options.Features.FileUpload.MaxFileSizeMB < config.MinFileSizeMB || options.Features.FileUpload.MaxFileSizeMB > config.MaxFileSizeMB {
		return fmt.Errorf(config.ErrValidationMaxFileSizeRange)
	}

	if options.Core.MaxContentLength < config.MinContentLength || options.Core.MaxContentLength > config.MaxContentLength {
		return fmt.Errorf(config.ErrValidationMaxContentLengthRange)
	}

	if options.Features.FileUpload.MaxFilesPerPost < config.MinFilesPerPost || options.Features.FileUpload.MaxFilesPerPost > config.MaxFilesPerPost {
		return fmt.Errorf(config.ErrValidationMaxFilesPerPostRange)
	}

	if len(options.Metadata.Title) < config.MinTitleLength || len(options.Metadata.Title) > config.MaxTitleLength {
		return fmt.Errorf(config.ErrValidationSiteTitleRange)
	}

	if len(options.Metadata.Description) > config.MaxDescriptionLength {
		return fmt.Errorf(config.ErrValidationSiteDescriptionMax)
	}

	return nil
}