package handlers

import (
	"backthynk/internal/config"
	"backthynk/internal/services"
	"backthynk/internal/storage"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/gorilla/mux"
)

type UploadHandler struct {
	db         *storage.DB
	uploadPath string
	settingsHandler *SettingsHandler
	fileStatsService *services.FileStatsService
}

func NewUploadHandler(db *storage.DB, uploadPath string, settingsHandler *SettingsHandler, fileStatsService *services.FileStatsService) *UploadHandler {
	return &UploadHandler{
		db: db,
		uploadPath: uploadPath,
		settingsHandler: settingsHandler,
		fileStatsService: fileStatsService,
	}
}

func (h *UploadHandler) UploadFile(w http.ResponseWriter, r *http.Request) {
	// Load settings to get max file size
	options, err := h.settingsHandler.LoadOptions()
	if err != nil {
		http.Error(w, "Failed to load settings", http.StatusInternalServerError)
		return
	}

	maxFileSizeMB := int64(options.MaxFileSizeMB)
	if err := r.ParseMultipartForm(maxFileSizeMB << 20); err != nil { // Dynamic limit based on settings
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

	// Verify post exists
	_, err = h.db.GetPost(postID)
	if err != nil {
		http.Error(w, "Post not found", http.StatusNotFound)
		return
	}

	// Check current file count for this post
	attachments, err := h.db.GetAttachmentsByPost(postID)
	if err == nil && len(attachments) >= options.MaxFilesPerPost {
		http.Error(w, fmt.Sprintf("Post already has maximum number of files (%d)", options.MaxFilesPerPost), http.StatusBadRequest)
		return
	}

	file, fileHeader, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Failed to get file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Create unique filename
	timestamp := time.Now().Unix()
	filename := fmt.Sprintf("%d_%s", timestamp, fileHeader.Filename)
	filePath := filepath.Join(h.uploadPath, filename)

	// Ensure upload directory exists
	if err := os.MkdirAll(h.uploadPath, config.DirectoryPermissions); err != nil {
		http.Error(w, "Failed to create upload directory", http.StatusInternalServerError)
		return
	}

	// Save file
	dst, err := os.Create(filePath)
	if err != nil {
		http.Error(w, "Failed to create file", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	size, err := io.Copy(dst, file)
	if err != nil {
		os.Remove(filePath) // cleanup on error
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}

	// Check file size against limit
	maxFileSize := maxFileSizeMB << 20 // Convert MB to bytes
	if size > maxFileSize {
		os.Remove(filePath) // cleanup
		http.Error(w, fmt.Sprintf("File size exceeds maximum allowed (%dMB)", options.MaxFileSizeMB), http.StatusBadRequest)
		return
	}

	// Detect file type
	fileType := mime.TypeByExtension(filepath.Ext(fileHeader.Filename))
	if fileType == "" {
		fileType = "application/octet-stream"
	}

	// Save to database
	attachment, err := h.db.CreateAttachment(postID, fileHeader.Filename, filename, fileType, size)
	if err != nil {
		os.Remove(filePath) // cleanup on error
		http.Error(w, "Failed to save attachment info", http.StatusInternalServerError)
		return
	}

	// Get post to find category ID for file statistics cache update
	post, err := h.db.GetPost(postID)
	if err == nil && h.fileStatsService != nil {
		// Update file statistics cache
		if err := h.fileStatsService.OnFileUploaded(post.CategoryID, size); err != nil {
			// Log warning but don't fail the upload
			fmt.Printf("Warning: failed to update file statistics cache: %v\n", err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(attachment)
}

func (h *UploadHandler) ServeFile(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	filename := vars["filename"]

	filePath := filepath.Join(h.uploadPath, filename)

	// Security check - ensure file is within upload directory
	absUploadPath, err := filepath.Abs(h.uploadPath)
	if err != nil {
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	absFilePath, err := filepath.Abs(filePath)
	if err != nil {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	if !filepath.HasPrefix(absFilePath, absUploadPath) {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	// Set appropriate headers
	fileType := mime.TypeByExtension(filepath.Ext(filename))
	if fileType != "" {
		w.Header().Set("Content-Type", fileType)
	}

	http.ServeFile(w, r, filePath)
}