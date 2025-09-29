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
	maxFileSizeMB := int64(h.options.Core.MaxFileSizeMB)
	if err := r.ParseMultipartForm(maxFileSizeMB << 20); err != nil {
		http.Error(w, "Failed to parse multipart form", http.StatusBadRequest)
		return
	}
	
	postIDStr := r.FormValue("post_id")
	if postIDStr == "" {
		http.Error(w, "post_id is required", http.StatusBadRequest)
		return
	}
	
	postID, err := strconv.Atoi(postIDStr)
	if err != nil {
		http.Error(w, "Invalid post_id", http.StatusBadRequest)
		return
	}
	
	file, fileHeader, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Failed to get file", http.StatusBadRequest)
		return
	}
	defer file.Close()
	
	// Check file size
	if fileHeader.Size > maxFileSizeMB<<20 {
		http.Error(w, fmt.Sprintf("File size exceeds maximum allowed (%dMB)", h.options.Core.MaxFileSizeMB), http.StatusBadRequest)
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

func (h *UploadHandler) ServeFile(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	filename := vars["filename"]
	
	filePath := filepath.Join(config.GetServiceConfig().Files.StoragePath, config.GetServiceConfig().Files.UploadsSubdir, filename)
	
	// Security check
	absUploadPath, _ := filepath.Abs(filepath.Join(config.GetServiceConfig().Files.StoragePath, config.GetServiceConfig().Files.UploadsSubdir))
	absFilePath, _ := filepath.Abs(filePath)
	
	if !filepath.HasPrefix(absFilePath, absUploadPath) {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}
	
	http.ServeFile(w, r, filePath)
}