package handlers

import (
	"backthynk/internal/config"
	"backthynk/internal/core/models"
	"backthynk/internal/core/services"
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"

	"github.com/gorilla/mux"
)

var validSpaceNameRegex = regexp.MustCompile(config.SpaceNamePattern)

type SpaceHandler struct {
	service *services.SpaceService
}

func NewSpaceHandler(service *services.SpaceService) *SpaceHandler {
	return &SpaceHandler{service: service}
}

func (h *SpaceHandler) GetSpaces(w http.ResponseWriter, r *http.Request) {
	spaces := h.service.GetAll()
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(spaces)
}

func (h *SpaceHandler) GetSpace(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, config.ErrInvalidSpaceID, http.StatusBadRequest)
		return
	}

	space, err := h.service.Get(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(space)
}

func (h *SpaceHandler) GetSpacesByParent(w http.ResponseWriter, r *http.Request) {
	parentIDStr := r.URL.Query().Get("parent_id")

	var parentID *int
	if parentIDStr != "" {
		id, err := strconv.Atoi(parentIDStr)
		if err != nil {
			http.Error(w, config.ErrInvalidParentID, http.StatusBadRequest)
			return
		}
		parentID = &id
	}
	
	allSpaces := h.service.GetAll()
	var filtered []*models.Space
	
	for _, cat := range allSpaces {
		if parentID == nil && cat.ParentID == nil {
			filtered = append(filtered, cat)
		} else if parentID != nil && cat.ParentID != nil && *cat.ParentID == *parentID {
			filtered = append(filtered, cat)
		}
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(filtered)
}

func (h *SpaceHandler) CreateSpace(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		ParentID    *int   `json:"parent_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, config.ErrInvalidJSON, http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, config.ErrNameRequired, http.StatusBadRequest)
		return
	}

	// Validate space name format
	if !validSpaceNameRegex.MatchString(req.Name) {
		http.Error(w, config.ErrSpaceNameInvalidFormat, http.StatusBadRequest)
		return
	}

	space, err := h.service.Create(req.Name, req.ParentID, req.Description)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(space)
}

func (h *SpaceHandler) UpdateSpace(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, config.ErrInvalidSpaceID, http.StatusBadRequest)
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		ParentID    *int   `json:"parent_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, config.ErrInvalidJSON, http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, config.ErrNameRequired, http.StatusBadRequest)
		return
	}

	// Validate space name format
	if !validSpaceNameRegex.MatchString(req.Name) {
		http.Error(w, config.ErrSpaceNameInvalidFormat, http.StatusBadRequest)
		return
	}

	space, err := h.service.Update(id, req.Name, req.Description, req.ParentID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(space)
}

func (h *SpaceHandler) DeleteSpace(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, config.ErrInvalidSpaceID, http.StatusBadRequest)
		return
	}

	if err := h.service.Delete(id); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}