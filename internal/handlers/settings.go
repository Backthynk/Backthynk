package handlers

import (
	"backthynk/internal/models"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

type SettingsHandler struct {
	configPath string
}

func NewSettingsHandler(configPath string) *SettingsHandler {
	return &SettingsHandler{
		configPath: configPath,
	}
}

func (h *SettingsHandler) GetSettings(w http.ResponseWriter, r *http.Request) {
	options, err := h.LoadOptions()
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to load settings: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(options)
}

func (h *SettingsHandler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var newOptions models.Options
	if err := json.NewDecoder(r.Body).Decode(&newOptions); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	// Load current options to preserve storage path
	currentOptions, err := h.LoadOptions()
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to load current settings: %v", err), http.StatusInternalServerError)
		return
	}

	// Preserve storage path from current options (not updatable via API)
	newOptions.StoragePath = currentOptions.StoragePath

	// Validate options
	if err := h.validateOptions(newOptions); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Save options
	if err := h.saveOptions(newOptions); err != nil {
		http.Error(w, fmt.Sprintf("Failed to save settings: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(newOptions)
}

func (h *SettingsHandler) LoadOptions() (models.Options, error) {
	var options models.Options

	file, err := os.Open(h.configPath)
	if err != nil {
		// If file doesn't exist, return defaults
		if os.IsNotExist(err) {
			return models.Options{
				MaxFileSizeMB:    100,
				MaxContentLength: 15000,
				MaxFilesPerPost:  20,
				StoragePath:      "storage",
			}, nil
		}
		return options, err
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return options, err
	}

	err = json.Unmarshal(data, &options)
	return options, err
}

func (h *SettingsHandler) saveOptions(options models.Options) error {
	data, err := json.MarshalIndent(options, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(h.configPath, data, 0644)
}

func (h *SettingsHandler) validateOptions(options models.Options) error {
	// Validate max file size (1MB to 10GB)
	if options.MaxFileSizeMB < 1 || options.MaxFileSizeMB > 10240 {
		return fmt.Errorf("maxFileSizeMB must be between 1 and 10240 (10GB)")
	}

	// Validate max content length (100 to 50,000)
	if options.MaxContentLength < 100 || options.MaxContentLength > 50000 {
		return fmt.Errorf("maxContentLength must be between 100 and 50000")
	}

	// Validate max files per post (1 to 50)
	if options.MaxFilesPerPost < 1 || options.MaxFilesPerPost > 50 {
		return fmt.Errorf("maxFilesPerPost must be between 1 and 50")
	}

	return nil
}