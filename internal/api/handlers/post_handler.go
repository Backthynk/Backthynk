package handlers

import (
	"backthynk/internal/config"
	"backthynk/internal/core/models"
	"backthynk/internal/core/services"
	"backthynk/internal/core/utils"
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"

	"github.com/gorilla/mux"
)

type PostHandler struct {
	postService *services.PostService
	fileService *services.FileService
	options     *config.OptionsConfig
}

type PostLinkPreview struct {
	URL         string `json:"url"`
	Title       string `json:"title"`
	Description string `json:"description"`
	ImageURL    string `json:"image_url"`
	SiteName    string `json:"site_name"`
}

func NewPostHandler(postService *services.PostService, fileService *services.FileService, options *config.OptionsConfig) *PostHandler {
	return &PostHandler{
		postService: postService,
		fileService: fileService,
		options:     options,
	}
}

func (h *PostHandler) CreatePost(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CategoryID      int                 `json:"category_id"`
		Content         string              `json:"content"`
		LinkPreviews    []PostLinkPreview   `json:"link_previews,omitempty"`
		CustomTimestamp *int64              `json:"custom_timestamp,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, config.ErrInvalidJSON, http.StatusBadRequest)
		return
	}

	if req.Content == "" {
		http.Error(w, config.ErrContentRequired, http.StatusBadRequest)
		return
	}

	if req.CategoryID <= 0 {
		http.Error(w, config.ErrValidCategoryIDRequired, http.StatusBadRequest)
		return
	}
	
	// Validate content length
	if len(req.Content) > h.options.Core.MaxContentLength {
		http.Error(w, fmt.Sprintf(config.ErrFmtContentExceedsMaxLength, h.options.Core.MaxContentLength), http.StatusBadRequest)
		return
	}
	
	// Validate custom timestamp if provided
	if req.CustomTimestamp != nil {
		if !h.options.Features.RetroactivePosting.Enabled {
			http.Error(w, config.ErrRetroactivePostingDisabled, http.StatusBadRequest)
			return
		}

		if *req.CustomTimestamp < config.MinRetroactivePostTimestamp {
			http.Error(w, config.ErrTimestampTooEarly, http.StatusBadRequest)
			return
		}
	}
	
	post, err := h.postService.Create(req.CategoryID, req.Content, req.CustomTimestamp)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	// Save link previews
	for _, preview := range req.LinkPreviews {
		h.fileService.SaveLinkPreview(post.ID, preview)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(post)
}

func (h *PostHandler) GetPost(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, config.ErrInvalidPostID, http.StatusBadRequest)
		return
	}

	post, err := h.fileService.GetPostWithAttachments(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	// Process content on-the-fly for the response
	if h.options != nil && h.options.Features.Markdown.Enabled {
		post.Content = utils.ProcessMarkdown(post.Content)
	}

	// Filter attachments by allowed extensions
	h.filterAttachments(post)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(post)
}

func (h *PostHandler) DeletePost(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, config.ErrInvalidPostID, http.StatusBadRequest)
		return
	}
	
	if err := h.postService.Delete(id); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	
	w.WriteHeader(http.StatusNoContent)
}

func (h *PostHandler) MovePost(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	postID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, config.ErrInvalidPostID, http.StatusBadRequest)
		return
	}

	var req struct {
		CategoryID int `json:"category_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, config.ErrInvalidJSON, http.StatusBadRequest)
		return
	}

	if req.CategoryID <= 0 {
		http.Error(w, config.ErrValidCategoryIDRequired, http.StatusBadRequest)
		return
	}

	if err := h.postService.Move(postID, req.CategoryID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Return updated post
	post, err := h.fileService.GetPostWithAttachments(postID)
	if err != nil {
		http.Error(w, config.ErrFailedToRetrievePost, http.StatusInternalServerError)
		return
	}

	// Process content on-the-fly for the response
	if h.options != nil && h.options.Features.Markdown.Enabled {
		post.Content = utils.ProcessMarkdown(post.Content)
	}

	// Filter attachments by allowed extensions
	h.filterAttachments(post)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(post)
}

func (h *PostHandler) GetPostsByCategory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	categoryID, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, config.ErrInvalidCategoryID, http.StatusBadRequest)
		return
	}

	// Parse query params
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")
	withMeta := r.URL.Query().Get("with_meta") == "true"
	recursive := r.URL.Query().Get("recursive") == "true"

	limit := config.DefaultPostLimit
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= config.MaxPostLimit {
			limit = l
		}
	}

	offset := 0
	if offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	var posts []models.PostWithAttachments
	var totalCount int

	if categoryID == 0 { // All categories
		posts, err = h.postService.GetAllPosts(limit, offset)
		if withMeta {
			totalCount, _ = h.fileService.GetTotalPostCount()
		}
	} else {
		posts, err = h.postService.GetByCategory(categoryID, recursive, limit, offset)
		if withMeta {
			// Get count from cache
			if cat, ok := h.postService.GetCategoryFromCache(categoryID); ok {
				if recursive {
					totalCount = cat.RecursivePostCount
				} else {
					totalCount = cat.PostCount
				}
			}
		}
	}

	if err != nil {
		http.Error(w, config.ErrFailedToGetPosts, http.StatusInternalServerError)
		return
	}

	// Filter attachments for all posts
	for i := range posts {
		h.filterAttachments(&posts[i])
	}

	if withMeta {
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

// filterAttachments filters attachments based on allowed extensions when file upload is enabled
func (h *PostHandler) filterAttachments(post *models.PostWithAttachments) {
	if !h.options.Features.FileUpload.Enabled || len(h.options.Features.FileUpload.AllowedExtensions) == 0 {
		return
	}

	var filteredAttachments []models.Attachment
	for _, att := range post.Attachments {
		ext := filepath.Ext(att.Filename)
		if ext != "" {
			ext = ext[1:] // Remove the leading dot
		}

		// Check if extension is allowed
		allowed := false
		for _, allowedExt := range h.options.Features.FileUpload.AllowedExtensions {
			if ext == allowedExt {
				allowed = true
				break
			}
		}

		if allowed {
			filteredAttachments = append(filteredAttachments, att)
		}
	}

	post.Attachments = filteredAttachments
}