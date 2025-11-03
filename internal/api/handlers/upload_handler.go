package handlers

import (
	"backthynk/internal/config"
	"backthynk/internal/core/services"
	"backthynk/internal/features/preview"
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"

	"github.com/gorilla/mux"
)

type UploadHandler struct {
	fileService    *services.FileService
	previewService *preview.Service
	options        *config.OptionsConfig
}

func NewUploadHandler(fileService *services.FileService, previewService *preview.Service, options *config.OptionsConfig) *UploadHandler {
	return &UploadHandler{
		fileService:    fileService,
		previewService: previewService,
		options:        options,
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

	// Check if MaxFilesPerPost limit is reached
	currentAttachments, err := h.fileService.GetAttachmentCount(postID)
	if err != nil {
		http.Error(w, "Failed to check attachment count", http.StatusInternalServerError)
		return
	}

	if currentAttachments >= h.options.Features.FileUpload.MaxFilesPerPost {
		http.Error(w, fmt.Sprintf("Maximum files per post limit reached (%d)", h.options.Features.FileUpload.MaxFilesPerPost), http.StatusBadRequest)
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

	uploadPath := filepath.Join(config.GetServiceConfig().Files.StoragePath, config.GetServiceConfig().Files.UploadsSubdir)
	filePath := filepath.Join(uploadPath, filename)

	// Security check
	absUploadPath, _ := filepath.Abs(uploadPath)
	absFilePath, _ := filepath.Abs(filePath)

	if !filepath.HasPrefix(absFilePath, absUploadPath) {
		http.Error(w, config.ErrAccessDenied, http.StatusForbidden)
		return
	}

	// Check if preview is requested
	size := r.URL.Query().Get("size")
	if size != "" && h.previewService != nil && h.options.Features.Preview.Enabled {
		// Check if preview is supported for this file
		if h.previewService.IsPreviewSupported(filename) {
			// Get the preview path
			previewPath := h.previewService.GetPreviewPath(filename, size)

			// Check if preview already exists
			if h.previewService.PreviewExists(previewPath) {
				// Serve the existing preview
				fullPreviewPath := filepath.Join(uploadPath, previewPath)
				http.ServeFile(w, r, fullPreviewPath)
				return
			}

			// Generate the preview on-demand
			generatedPath, err := h.previewService.GeneratePreview(filePath, filename, size)
			if err != nil {
				// If preview generation fails, serve the original file
				http.ServeFile(w, r, filePath)
				return
			}

			// Serve the newly generated preview
			fullPreviewPath := filepath.Join(uploadPath, generatedPath)
			http.ServeFile(w, r, fullPreviewPath)
			return
		}
		// If preview not supported, fall through to serve original file
	}

	// Serve the original file
	http.ServeFile(w, r, filePath)
}