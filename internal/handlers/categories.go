package handlers

import (
	"backthynk/internal/storage"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
)

type CategoryHandler struct {
	db *storage.DB
}

func NewCategoryHandler(db *storage.DB) *CategoryHandler {
	return &CategoryHandler{db: db}
}

func (h *CategoryHandler) GetCategories(w http.ResponseWriter, r *http.Request) {
	// Check if stats are requested
	withStats := r.URL.Query().Get("with_stats") == "true"

	if withStats {
		categories, err := h.db.GetCategoriesWithStats()
		if err != nil {
			http.Error(w, "Failed to get categories with stats", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(categories)
	} else {
		categories, err := h.db.GetCategories()
		if err != nil {
			http.Error(w, "Failed to get categories", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(categories)
	}
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
		Name     string `json:"name"`
		ParentID *int   `json:"parent_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "Name is required", http.StatusBadRequest)
		return
	}

	category, err := h.db.CreateCategory(req.Name, req.ParentID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
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