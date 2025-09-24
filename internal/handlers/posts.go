package handlers

import (
	"backthynk/internal/config"
	"backthynk/internal/models"
	"backthynk/internal/services"
	"backthynk/internal/storage"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

type PostHandler struct {
	db              *storage.DB
	settingsHandler *SettingsHandler
	activityService *services.ActivityService
	fileStatsService *services.FileStatsService
}

func NewPostHandler(db *storage.DB, settingsHandler *SettingsHandler, activityService *services.ActivityService, fileStatsService *services.FileStatsService) *PostHandler {
	return &PostHandler{
		db:              db,
		settingsHandler: settingsHandler,
		activityService: activityService,
		fileStatsService: fileStatsService,
	}
}

func (h *PostHandler) CreatePost(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CategoryID   int                        `json:"category_id"`
		Content      string                     `json:"content"`
		LinkPreviews []LinkPreviewResponse     `json:"link_previews,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if req.Content == "" {
		http.Error(w, "Content is required", http.StatusBadRequest)
		return
	}

	if req.CategoryID <= 0 {
		http.Error(w, "Valid category_id is required", http.StatusBadRequest)
		return
	}

	// Load settings and validate content length
	if h.settingsHandler != nil {
		options, err := h.settingsHandler.LoadOptions()
		if err == nil {
			if len(req.Content) > options.MaxContentLength {
				http.Error(w, fmt.Sprintf("Content exceeds maximum length of %d characters", options.MaxContentLength), http.StatusBadRequest)
				return
			}
		}
	}

	post, err := h.db.CreatePost(req.CategoryID, req.Content)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Update activity cache
	if h.activityService != nil {
		if err := h.activityService.OnPostCreated(post.CategoryID, post.Created); err != nil {
			// Log error but don't fail the request
			fmt.Printf("Warning: failed to update activity cache: %v\n", err)
		}
	}

	// Extract and save link previews from content
	var linkPreviewsToSave []LinkPreviewResponse
	
	// If link previews were provided in the request, use those
	if len(req.LinkPreviews) > 0 {
		linkPreviewsToSave = req.LinkPreviews
	} else {
		// Otherwise, extract URLs from content and fetch previews
		urls := ExtractURLsFromText(req.Content)
		linkPreviewHandler := NewLinkPreviewHandler(h.db)
		
		for _, url := range urls {
			preview, err := linkPreviewHandler.extractMetadata(url)
			if err == nil {
				linkPreviewsToSave = append(linkPreviewsToSave, *preview)
			}
		}
	}

	// Save link previews to database
	for _, preview := range linkPreviewsToSave {
		linkPreview := &models.LinkPreview{
			PostID:      post.ID,
			URL:         preview.URL,
			Title:       preview.Title,
			Description: preview.Description,
			ImageURL:    preview.ImageURL,
			SiteName:    preview.SiteName,
		}
		
		if err := h.db.CreateLinkPreview(linkPreview); err != nil {
			// Log error but don't fail the post creation
			// Could add logging here
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(post)
}

func (h *PostHandler) GetPostsByCategory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	categoryID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid category ID", http.StatusBadRequest)
		return
	}

	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")
	withMeta := r.URL.Query().Get("with_meta") == "true"
	recursive := r.URL.Query().Get("recursive") == "true"

	limit := config.DefaultPostLimit // default
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= config.MaxPostLimit {
			limit = l
		}
	}

	offset := config.DefaultOffset // default
	if offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	posts, err := h.db.GetPostsByCategoryRecursive(categoryID, recursive, limit, offset)
	if err != nil {
		http.Error(w, "Failed to get posts", http.StatusInternalServerError)
		return
	}

	if withMeta {
		totalCount, err := h.db.GetPostCountByCategoryRecursive(categoryID, recursive)
		if err != nil {
			http.Error(w, "Failed to get post count", http.StatusInternalServerError)
			return
		}

		response := map[string]interface{}{
			"posts":       posts,
			"total_count": totalCount,
			"offset":      offset,
			"limit":       limit,
			"has_more":    offset+len(posts) < totalCount,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	} else {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(posts)
	}
}

func (h *PostHandler) GetPost(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	post, err := h.db.GetPost(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(post)
}

func (h *PostHandler) DeletePost(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	// Get post details before deletion for cache updates
	var categoryID int
	var created int64
	var attachments []models.Attachment

	post, err := h.db.GetPost(id)
	if err == nil {
		categoryID = post.CategoryID
		created = post.Created

		// Get attachments for file statistics cache update
		if h.fileStatsService != nil {
			attachments, _ = h.db.GetAttachmentsByPost(id)
		}
	}

	err = h.db.DeletePost(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	// Update activity cache
	if h.activityService != nil && categoryID > 0 {
		if err := h.activityService.OnPostDeleted(categoryID, created); err != nil {
			// Log error but don't fail the request
			fmt.Printf("Warning: failed to update activity cache: %v\n", err)
		}
	}

	// Update file statistics cache for deleted attachments
	if h.fileStatsService != nil && categoryID > 0 {
		for _, attachment := range attachments {
			if err := h.fileStatsService.OnFileDeleted(categoryID, attachment.FileSize); err != nil {
				// Log error but don't fail the request
				fmt.Printf("Warning: failed to update file statistics cache: %v\n", err)
			}
		}
	}

	w.WriteHeader(http.StatusNoContent)
}