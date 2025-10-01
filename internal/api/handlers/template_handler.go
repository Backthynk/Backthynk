package handlers

import (
	"backthynk/internal/config"
	"backthynk/internal/core/services"
	"html/template"
	"net/http"
	"strings"
)

type TemplateHandler struct {
	categoryService *services.CategoryService
}

func NewTemplateHandler(categoryService *services.CategoryService) *TemplateHandler {
	return &TemplateHandler{categoryService: categoryService}
}

type PageData struct {
	Title       string
	Description string
	URL         string
	Category    interface{}
	Breadcrumb  string
}

func (h *TemplateHandler) ServePage(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	pageData := PageData{
		Title:       "Backthynk - Personal Micro Blog",
		Description: "Personal micro blog platform",
		URL:         r.Host + path,
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