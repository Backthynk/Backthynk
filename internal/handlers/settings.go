package handlers

import (
	"backthynk/internal/config"
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
				MaxFileSizeMB:            config.DefaultMaxFileSizeMB,
				MaxContentLength:         config.DefaultMaxContentLength,
				MaxFilesPerPost:          config.DefaultMaxFilesPerPost,
				ActivityEnabled:          config.DefaultActivityEnabled,
				FileStatsEnabled:         config.DefaultFileStatsEnabled,
				RetroactivePostingEnabled: config.DefaultRetroactivePostingEnabled,
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

	return os.WriteFile(h.configPath, data, config.FilePermissions)
}

func (h *SettingsHandler) validateOptions(options models.Options) error {
	// Validate max file size (1MB to 10GB)
	if options.MaxFileSizeMB < config.MinFileSizeMB || options.MaxFileSizeMB > config.MaxFileSizeMB {
		return fmt.Errorf(config.ErrFileSizeValidation)
	}

	// Validate max content length (100 to 50,000)
	if options.MaxContentLength < config.MinContentLength || options.MaxContentLength > config.MaxContentLength {
		return fmt.Errorf(config.ErrContentLengthValidation)
	}

	// Validate max files per post (1 to 50)
	if options.MaxFilesPerPost < config.MinFilesPerPost || options.MaxFilesPerPost > config.MaxFilesPerPost {
		return fmt.Errorf(config.ErrFilesPerPostValidation)
	}

	return nil
}