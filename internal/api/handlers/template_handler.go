package handlers

import (
	"backthynk/internal/config"
	"backthynk/internal/core/models"
	"backthynk/internal/core/services"
	"html/template"
	"net/http"
	"net/url"
	"strings"
)

type TemplateHandler struct {
	categoryService *services.CategoryService
	options         *config.OptionsConfig
	serviceConfig   *config.ServiceConfig
}

func NewTemplateHandler(categoryService *services.CategoryService, options *config.OptionsConfig, serviceConfig *config.ServiceConfig) *TemplateHandler {
	return &TemplateHandler{
		categoryService: categoryService,
		options:         options,
		serviceConfig:   serviceConfig,
	}
}

type PageData struct {
	Title              string
	Description        string
	URL                string
	Category           interface{}
	CategoryBreadcrumb string
	MarkdownEnabled    bool
}

func (h *TemplateHandler) ServePage(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	pageData := PageData{
		Title:           h.options.Metadata.Title,
		Description:     h.options.Metadata.Description,
		URL:             r.Host + path,
		MarkdownEnabled: h.options.Features.Markdown.Enabled,
	}

	// Check if this is a category path
	if IsCategoryPath(path) {
		category := h.resolveCategoryFromPath(path)
		if category != nil {
			// Set breadcrumb as title
			pageData.Title = h.categoryService.GetCategoryBreadcrumb(category.ID)
			pageData.CategoryBreadcrumb = pageData.Title

			// Use category description if available, otherwise fallback to service description
			if category.Description != "" {
				pageData.Description = category.Description
			}

			pageData.Category = category
		}
	}

	// Use compressed template in production mode
	templatePath := "web/templates/index.html"
	if config.IsProduction() {
		templatePath = "web/templates/compressed/index.html"
	}

	// Parse and execute template
	h.renderTemplate(w, templatePath, pageData)
}

func (h *TemplateHandler) renderTemplate(w http.ResponseWriter, templatePath string, data PageData) {
	tmpl, err := template.ParseFiles(templatePath)
	if err != nil {
		http.Error(w, "Template parsing error", http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := tmpl.Execute(w, data); err != nil {
		http.Error(w, "Template execution error", http.StatusInternalServerError)
		return
	}
}

func (h *TemplateHandler) resolveCategoryFromPath(path string) *models.Category {
	// Remove leading slash and decode URL
	path = strings.TrimPrefix(path, "/")
	decodedPath, err := url.QueryUnescape(path)
	if err != nil {
		decodedPath = path
	}

	// Split path into segments
	segments := strings.Split(decodedPath, "/")
	if len(segments) == 0 {
		return nil
	}

	// Traverse the path to find the target category
	var currentParentID *int

	for i, segment := range segments {
		cat := h.categoryService.FindByNameAndParent(segment, currentParentID)
		if cat == nil {
			return nil
		}

		// If this is the last segment, return this category
		if i == len(segments)-1 {
			return cat
		}

		// Otherwise, set this category as the parent for the next iteration
		currentParentID = &cat.ID
	}

	return nil
}

func IsCategoryPath(path string) bool {
	if path == "/" {
		return false
	}

	reservedRoutes := []string{"api", "static", "uploads", "settings"}
	for _, route := range reservedRoutes {
		if strings.HasPrefix(path, "/"+route) {
			return false
		}
	}

	return true
}