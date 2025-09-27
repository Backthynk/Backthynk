package handlers

import (
	"backthynk/internal/config"
	"backthynk/internal/models"
	"backthynk/internal/storage"
	"fmt"
	"html/template"
	"net/http"
	"regexp"
	"strings"
)

type TemplateHandler struct {
	db *storage.DB
}

func NewTemplateHandler(db *storage.DB) *TemplateHandler {
	return &TemplateHandler{db: db}
}

type PageData struct {
	Title       string
	Description string
	URL         string
	Category    *models.Category
	Breadcrumb  string
}

// ServeCategoryPage serves a category page with proper SEO meta tags
func (h *TemplateHandler) ServeCategoryPage(w http.ResponseWriter, r *http.Request, path string) {
	// Find category by path
	category, breadcrumb := h.findCategoryByPath(path)

	var pageData PageData
	if category != nil {
		// Build page data for category
		pageData = PageData{
			Title:       fmt.Sprintf(config.SEOPageTitleTemplate, category.Name, config.AppName),
			Description: h.buildCategoryDescription(category, breadcrumb),
			URL:         r.Host + path,
			Category:    category,
			Breadcrumb:  breadcrumb,
		}
	} else {
		// Category not found, default data
		pageData = PageData{
			Title:       fmt.Sprintf(config.SEODefaultTitle, config.AppName, config.AppTagline),
			Description: config.AppDescription,
			URL:         r.Host + path,
		}
	}

	// Parse and execute template
	h.renderTemplate(w, "web/templates/index.html", pageData)
}

func (h *TemplateHandler) findCategoryByPath(path string) (*models.Category, string) {
	// Get all categories
	categories, err := h.db.GetCategories()
	if err != nil {
		return nil, ""
	}

	pathParts := strings.Split(strings.Trim(path, "/"), "/")
	if len(pathParts) == 0 || (len(pathParts) == 1 && pathParts[0] == "") {
		return nil, ""
	}

	// Navigate through category hierarchy
	var currentCategory *models.Category
	var breadcrumbParts []string

	// Filter top-level categories
	var currentLevel []models.Category
	for _, cat := range categories {
		if cat.ParentID == nil {
			currentLevel = append(currentLevel, cat)
		}
	}

	for _, pathPart := range pathParts {
		if pathPart == "" {
			continue
		}

		// Convert URL format back to category name (underscores to spaces)
		decodedPart := strings.ReplaceAll(pathPart, "_", " ")

		found := false
		for _, cat := range currentLevel {
			if strings.EqualFold(cat.Name, decodedPart) {
				currentCategory = &cat
				breadcrumbParts = append(breadcrumbParts, cat.Name)

				// Get children for next level
				currentLevel = []models.Category{}
				for _, childCat := range categories {
					if childCat.ParentID != nil && *childCat.ParentID == cat.ID {
						currentLevel = append(currentLevel, childCat)
					}
				}
				found = true
				break
			}
		}

		if !found {
			return nil, ""
		}
	}

	return currentCategory, strings.Join(breadcrumbParts, " > ")
}

func (h *TemplateHandler) buildCategoryDescription(category *models.Category, breadcrumb string) string {
	// If category has description, use it
	if category != nil && category.Description != "" {
		return category.Description
	}

	// Otherwise, build generic description
	return fmt.Sprintf(config.SEOCategoryDescription, breadcrumb)
}

func (h *TemplateHandler) renderTemplate(w http.ResponseWriter, templatePath string, data PageData) {
	// Check if we're in production mode and use minified template if available
	if config.IsProduction() {
		minifiedPath := strings.Replace(templatePath, "web/templates/", "web/templates/compressed/", 1)
		if _, err := template.ParseFiles(minifiedPath); err == nil {
			templatePath = minifiedPath
		}
	}

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

// Helper function to check if path is a valid category path
func IsCategoryPath(path string) bool {
	if path == "/" {
		return false
	}
	for _, v := range config.ReservedRoutes {
		if v == path {
			return false;
		}
	}

	// Must start with / and contain valid characters for category names
	validPath := regexp.MustCompile(`^/[a-zA-Z0-9\s/]+$`)
	return validPath.MatchString(path) && !strings.Contains(path, "//")
}