package handlers

import (
	"backthynk/internal/config"
	"backthynk/internal/core/models"
	"backthynk/internal/core/services"
	"backthynk/internal/embedded"
	"html/template"
	"io/fs"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
)

type TemplateHandler struct {
	spaceService *services.SpaceService
	options         *config.OptionsConfig
	serviceConfig   *config.ServiceConfig
}

func NewTemplateHandler(spaceService *services.SpaceService, options *config.OptionsConfig, serviceConfig *config.ServiceConfig) *TemplateHandler {
	return &TemplateHandler{
		spaceService: spaceService,
		options:         options,
		serviceConfig:   serviceConfig,
	}
}

type PageData struct {
	Title              string
	Description        string
	URL                string
	Space           interface{}
	SpaceBreadcrumb string
	MarkdownEnabled    bool
	Dev                bool
	GithubURL          string
	NewIssueURL        string
}

func (h *TemplateHandler) ServePage(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	sharedCfg := config.GetSharedConfig()
	pageData := PageData{
		Title:           h.options.Metadata.Title,
		Description:     h.options.Metadata.Description,
		URL:             r.Host + path,
		MarkdownEnabled: h.options.Features.Markdown.Enabled,
		Dev:             config.GetAppMode() == config.APP_MODE_DEV,
		GithubURL:       sharedCfg.URLs.GithubURL,
		NewIssueURL:     sharedCfg.URLs.NewIssueURL,
	}

	// Check if this is a space path
	if IsSpacePath(path) {
		space := h.resolveSpaceFromPath(path)
		if space == nil {
			// Space doesn't exist, redirect to home
			http.Redirect(w, r, "/", http.StatusFound)
			return
		}

		// Set breadcrumb as title
		pageData.Title = h.spaceService.GetSpaceBreadcrumb(space.ID)
		pageData.SpaceBreadcrumb = pageData.Title

		// Use space description if available, otherwise fallback to service description
		if space.Description != "" {
			pageData.Description = space.Description
		}

		pageData.Space = space
	}

	if config.GetAppMode() == config.APP_MODE_PROD {
		h.renderEmbeddedTemplate(w, pageData)
	} else {
		templatePath := filepath.Join(sharedCfg.GetWebTemplatesPath(), "index.html")
		h.renderTemplate(w, templatePath, pageData)
	}
}

func (h *TemplateHandler) renderEmbeddedTemplate(w http.ResponseWriter, data PageData) {
	bundleFS, err := embedded.GetBundleFS()
	if err != nil {
		http.Error(w, config.ErrTemplateParsingError, http.StatusInternalServerError)
		return
	}

	templateData, err := fs.ReadFile(bundleFS, "templates/index.html")
	if err != nil {
		http.Error(w, config.ErrTemplateParsingError, http.StatusInternalServerError)
		return
	}

	tmpl, err := template.New("index").Parse(string(templateData))
	if err != nil {
		http.Error(w, config.ErrTemplateParsingError, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := tmpl.Execute(w, data); err != nil {
		http.Error(w, config.ErrTemplateExecutionError, http.StatusInternalServerError)
		return
	}
}

func (h *TemplateHandler) renderTemplate(w http.ResponseWriter, templatePath string, data PageData) {
	tmpl, err := template.ParseFiles(templatePath)
	if err != nil {
		http.Error(w, config.ErrTemplateParsingError, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := tmpl.Execute(w, data); err != nil {
		http.Error(w, config.ErrTemplateExecutionError, http.StatusInternalServerError)
		return
	}
}

func (h *TemplateHandler) resolveSpaceFromPath(path string) *models.Space {
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

	// Traverse the path to find the target space
	var currentParentID *int

	for i, segment := range segments {
		cat := h.spaceService.FindByNameAndParent(segment, currentParentID)
		if cat == nil {
			return nil
		}

		// If this is the last segment, return this space
		if i == len(segments)-1 {
			return cat
		}

		// Otherwise, set this space as the parent for the next iteration
		currentParentID = &cat.ID
	}

	return nil
}

func IsSpacePath(path string) bool {
	if path == "/" {
		return false
	}

	reservedRoutes := []string{config.RouteAPI, config.RouteStatic, config.RouteUploads, config.RouteSettings}
	for _, route := range reservedRoutes {
		if strings.HasPrefix(path, "/"+route) {
			return false
		}
	}

	return true
}
