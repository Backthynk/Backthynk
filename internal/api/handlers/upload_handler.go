package handlers

import (
	"backthynk/internal/config"
	"backthynk/internal/core/services"
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"

	"github.com/gorilla/mux"
)

type UploadHandler struct {
	fileService *services.FileService
	options     *config.OptionsConfig
}

func NewUploadHandler(fileService *services.FileService, options *config.OptionsConfig) *UploadHandler {
	return &UploadHandler{
		fileService: fileService,
		options:     options,
	}
}

func (h *UploadHandler) UploadFile(w http.ResponseWriter, r *http.Request) {
	// Check if file upload is enabled
	if !h.options.Features.FileUpload.Enabled {
		http.Error(w, config.ErrFileUploadDisabled, http.StatusForbidden)
		return
	}

	maxFileSizeMB := int64(h.options.Features.FileUpload.MaxFileSizeMB)
	if err := r.ParseMultipartForm(maxFileSizeMB << 20); err != nil {
		http.Error(w, config.ErrFailedToParseForm, http.StatusBadRequest)
		return
	}

	postIDStr := r.FormValue("post_id")
	if postIDStr == "" {
		http.Error(w, config.ErrPostIDRequired, http.StatusBadRequest)
		return
	}

	postID, err := strconv.Atoi(postIDStr)
	if err != nil {
		http.Error(w, config.ErrInvalidPostID, http.StatusBadRequest)
		return
	}

	file, fileHeader, err := r.FormFile("file")
	if err != nil {
		http.Error(w, config.ErrFailedToGetFile, http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Check file size
	if fileHeader.Size > maxFileSizeMB<<20 {
		http.Error(w, fmt.Sprintf(config.ErrFmtFileSizeExceedsMax, h.options.Features.FileUpload.MaxFileSizeMB), http.StatusBadRequest)
		return
	}

	// Validate file extension
	ext := filepath.Ext(fileHeader.Filename)
	if ext != "" {
		ext = ext[1:] // Remove the leading dot
	}
	if !h.isExtensionAllowed(ext) {
		http.Error(w, fmt.Sprintf(config.ErrFmtFileExtensionNotAllowed, ext), http.StatusBadRequest)
		return
	}

	attachment, err := h.fileService.UploadFile(postID, file, fileHeader.Filename, fileHeader.Size)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(attachment)
}

func (h *UploadHandler) isExtensionAllowed(ext string) bool {
	ext = filepath.Ext("." + ext)
	if ext != "" {
		ext = ext[1:] // Remove the leading dot
	}
	ext = filepath.Clean(ext) // Clean the extension

	for _, allowed := range h.options.Features.FileUpload.AllowedExtensions {
		if ext == allowed {
			return true
		}
	}
	return false
}

func (h *UploadHandler) ServeFile(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	filename := vars["filename"]
	
	filePath := filepath.Join(config.GetServiceConfig().Files.StoragePath, config.GetServiceConfig().Files.UploadsSubdir, filename)
	
	// Security check
	absUploadPath, _ := filepath.Abs(filepath.Join(config.GetServiceConfig().Files.StoragePath, config.GetServiceConfig().Files.UploadsSubdir))
	absFilePath, _ := filepath.Abs(filePath)
	
	if !filepath.HasPrefix(absFilePath, absUploadPath) {
		http.Error(w, config.ErrAccessDenied, http.StatusForbidden)
		return
	}
	
	http.ServeFile(w, r, filePath)
}