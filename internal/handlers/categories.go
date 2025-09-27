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
	db               *storage.DB
	categoryService  *services.CategoryService
	activityService  *services.ActivityService
	fileStatsService *services.FileStatsService
	postCountService *services.PostCountService
}

func NewCategoryHandler(db *storage.DB, categoryService *services.CategoryService, activityService *services.ActivityService, fileStatsService *services.FileStatsService, postCountService *services.PostCountService) *CategoryHandler {
	return &CategoryHandler{
		db:               db,
		categoryService:  categoryService,
		activityService:  activityService,
		fileStatsService: fileStatsService,
		postCountService: postCountService,
	}
}

func (h *CategoryHandler) GetCategories(w http.ResponseWriter, r *http.Request) {
	categories, err := h.categoryService.GetCategories()
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

	categories, err := h.categoryService.GetCategoriesByParent(parentID)
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

	category, err := h.categoryService.CreateCategory(req.Name, req.ParentID, req.Description)
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

	category, err := h.categoryService.GetCategory(id)
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
	oldCategory, err := h.categoryService.GetCategory(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	category, err := h.categoryService.UpdateCategory(id, req.Name, req.Description, req.ParentID)
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

	// Handle cache updates
	if parentChanged {
		fmt.Printf("Category %d parent changed from %v to %v - invalidating hierarchy-dependent caches\n", id, oldCategory.ParentID, req.ParentID)

		// Services without incremental updates need full reinitialize
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

		// PostCountService needs reinitialize because recursive counts depend on hierarchy
		if h.postCountService != nil {
			if err := h.postCountService.InitializeCache(); err != nil {
				fmt.Printf("Warning: failed to reinitialize post count cache: %v\n", err)
			}
		}
	}

	// Always update category cache incrementally (handles both name/parent changes)
	h.categoryService.UpdateCategoryCache(category)

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

	err = h.categoryService.DeleteCategory(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	// Category deletion affects hierarchy - invalidate all hierarchy-dependent caches
	fmt.Printf("Category %d deleted - invalidating hierarchy-dependent caches\n", id)

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

	if h.postCountService != nil {
		if err := h.postCountService.InitializeCache(); err != nil {
			fmt.Printf("Warning: failed to reinitialize post count cache: %v\n", err)
		}
	}

	w.WriteHeader(http.StatusNoContent)
}
