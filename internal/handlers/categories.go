package handlers

import (
	"backthynk/internal/services"
	"backthynk/internal/storage"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

type CategoryHandler struct {
	db                *storage.DB
	activityService   *services.ActivityService
	fileStatsService  *services.FileStatsService
}

func NewCategoryHandler(db *storage.DB, activityService *services.ActivityService, fileStatsService *services.FileStatsService) *CategoryHandler {
	return &CategoryHandler{
		db:               db,
		activityService:  activityService,
		fileStatsService: fileStatsService,
	}
}

func (h *CategoryHandler) GetCategories(w http.ResponseWriter, r *http.Request) {
	categories, err := h.db.GetCategories()
	if err != nil {
		http.Error(w, "Failed to get categories", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(categories)
}

func (h *CategoryHandler) GetCategoriesByParent(w http.ResponseWriter, r *http.Request) {
	parentIDStr := r.URL.Query().Get("parent_id")
	var parentID *int

	if parentIDStr != "" {
		id, err := strconv.Atoi(parentIDStr)
		if err != nil {
			http.Error(w, "Invalid parent_id", http.StatusBadRequest)
			return
		}
		parentID = &id
	}

	categories, err := h.db.GetCategoriesByParent(parentID)
	if err != nil {
		http.Error(w, "Failed to get categories", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(categories)
}

func (h *CategoryHandler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		ParentID    *int   `json:"parent_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "Name is required", http.StatusBadRequest)
		return
	}

	category, err := h.db.CreateCategoryWithDescription(req.Name, req.ParentID, req.Description)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Initialize activity cache for the new category
	if h.activityService != nil {
		if err := h.activityService.RefreshCategoryCache(category.ID); err != nil {
			// Log error but don't fail the request
			fmt.Printf("Warning: failed to initialize activity cache for new category %d: %v\n", category.ID, err)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(category)
}

func (h *CategoryHandler) GetCategory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid category ID", http.StatusBadRequest)
		return
	}

	category, err := h.db.GetCategory(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(category)
}

func (h *CategoryHandler) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid category ID", http.StatusBadRequest)
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		ParentID    *int   `json:"parent_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "Name is required", http.StatusBadRequest)
		return
	}

	// Get old category info before updating to know the old parent
	oldCategory, err := h.db.GetCategory(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	category, err := h.db.UpdateCategory(id, req.Name, req.Description, req.ParentID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Check if parent actually changed
	parentChanged := false
	if oldCategory.ParentID == nil && req.ParentID != nil {
		parentChanged = true
	} else if oldCategory.ParentID != nil && req.ParentID == nil {
		parentChanged = true
	} else if oldCategory.ParentID != nil && req.ParentID != nil && *oldCategory.ParentID != *req.ParentID {
		parentChanged = true
	}

	// Only invalidate caches if parent actually changed
	if parentChanged {
		fmt.Printf("Category %d parent changed from %v to %v - invalidating caches\n", id, oldCategory.ParentID, req.ParentID)

		// Reinitialize all caches because hierarchy changed
		if h.activityService != nil {
			if err := h.activityService.InitializeCache(); err != nil {
				fmt.Printf("Warning: failed to reinitialize activity cache: %v\n", err)
			}
		}

		if h.fileStatsService != nil {
			if err := h.fileStatsService.InitializeCache(); err != nil {
				fmt.Printf("Warning: failed to reinitialize file stats cache: %v\n", err)
			}
		}
	} else {
		// Only name or description changed - no cache invalidation needed
		fmt.Printf("Category %d name/description updated (parent unchanged) - no cache invalidation needed\n", id)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(category)
}

func (h *CategoryHandler) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid category ID", http.StatusBadRequest)
		return
	}

	err = h.db.DeleteCategory(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}