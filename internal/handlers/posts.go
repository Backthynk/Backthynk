package handlers

import (
	"backthynk/internal/models"
	"backthynk/internal/storage"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

type PostHandler struct {
	db *storage.DB
}

func NewPostHandler(db *storage.DB) *PostHandler {
	return &PostHandler{db: db}
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

	post, err := h.db.CreatePost(req.CategoryID, req.Content)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
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

	limit := 20 // default
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	offset := 0 // default
	if offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	posts, err := h.db.GetPostsByCategory(categoryID, limit, offset)
	if err != nil {
		http.Error(w, "Failed to get posts", http.StatusInternalServerError)
		return
	}

	if withMeta {
		totalCount, err := h.db.GetPostCountByCategory(categoryID)
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

	err = h.db.DeletePost(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}