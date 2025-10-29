package handlers

import (
	"backthynk/internal/core/models"
	"backthynk/internal/core/services"
	"backthynk/internal/core/utils"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

const (
	DefaultTheme  = "github"
	ThemeCookieName = "backthynk_theme"
)

type SPAHandler struct {
	themesBasePath string
	spaceService   *services.SpaceService
}

func NewSPAHandler(themesBasePath string, spaceService *services.SpaceService) *SPAHandler {
	return &SPAHandler{
		themesBasePath: themesBasePath,
		spaceService:   spaceService,
	}
}

// getThemeFromRequest extracts theme from cookie, defaults to "github"
func (h *SPAHandler) getThemeFromRequest(r *http.Request) string {
	cookie, err := r.Cookie(ThemeCookieName)
	if err != nil || cookie.Value == "" {
		return DefaultTheme
	}

	// Validate theme exists
	themePath := filepath.Join(h.themesBasePath, cookie.Value, "dist")
	if _, err := os.Stat(themePath); err != nil {
		return DefaultTheme
	}

	return cookie.Value
}

// ServeHTTP serves the SPA - either static assets or index.html for routes
func (h *SPAHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	theme := h.getThemeFromRequest(r)
	distPath := filepath.Join(h.themesBasePath, theme, "dist")
	path := r.URL.Path

	// Try to serve the file from dist
	fullPath := filepath.Join(distPath, path)

	// Check if file exists
	info, err := os.Stat(fullPath)
	if err == nil && !info.IsDir() {
		// File exists, serve it
		h.serveFile(w, r, fullPath)
		return
	}

	// Check if this is an asset request (has file extension)
	if strings.Contains(filepath.Base(path), ".") {
		// Asset not found
		http.NotFound(w, r)
		return
	}

	// This is a route, serve index.html for SPA routing with injected data
	indexPath := filepath.Join(distPath, "index.html")
	h.serveIndexWithData(w, r, indexPath)
}

func (h *SPAHandler) serveFile(w http.ResponseWriter, r *http.Request, path string) {
	file, err := os.Open(path)
	if err != nil {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}
	defer file.Close()

	// Get content type based on extension
	ext := filepath.Ext(path)
	contentType := getContentType(ext)
	if contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}

	// Serve the file
	io.Copy(w, file)
}

func getContentType(ext string) string {
	types := map[string]string{
		".html": "text/html; charset=utf-8",
		".css":  "text/css; charset=utf-8",
		".js":   "application/javascript; charset=utf-8",
		".json": "application/json; charset=utf-8",
		".png":  "image/png",
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".gif":  "image/gif",
		".svg":  "image/svg+xml",
		".ico":  "image/x-icon",
		".woff": "font/woff",
		".woff2": "font/woff2",
		".ttf":  "font/ttf",
		".eot":  "application/vnd.ms-fontobject",
	}
	return types[ext]
}

// serveIndexWithData serves the index.html with injected spaces data and SEO content
func (h *SPAHandler) serveIndexWithData(w http.ResponseWriter, r *http.Request, indexPath string) {
	// Read the index.html template
	content, err := os.ReadFile(indexPath)
	if err != nil {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	// Fetch all spaces from the service
	spaces := h.spaceService.GetAll()

	// Create JSON data for hydration
	spacesJSON, err := json.Marshal(spaces)
	if err != nil {
		spacesJSON = []byte("[]")
	}

	// Create the script tag to inject spaces data
	initialDataScript := `<script>window.__INITIAL_DATA__={spaces:` + string(spacesJSON) + `};</script>`

	// Generate SEO-friendly HTML for spaces
	spacesHTML := h.generateSpacesHTML(spaces)

	// Inject the data into the HTML
	htmlStr := string(content)

	// Inject the initial data script before the closing </head> tag
	htmlStr = strings.Replace(htmlStr, "</head>", initialDataScript+"</head>", 1)

	// Inject the spaces HTML and loading animation in the body
	bodyInjection := h.getLoadingAnimationHTML() + spacesHTML
	htmlStr = strings.Replace(htmlStr, `<div id="app"></div>`, bodyInjection, 1)

	// Serve the modified HTML
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(htmlStr))
}

// generateSpacesHTML generates SEO-friendly HTML structure for spaces
func (h *SPAHandler) generateSpacesHTML(spaces []*models.Space) string {
	if len(spaces) == 0 {
		return ""
	}

	var buf bytes.Buffer
	buf.WriteString(`<div id="ssr-spaces" style="position:absolute;left:-9999px;top:-9999px;" aria-hidden="true">`)

	// Group spaces by parent
	rootSpaces := []*models.Space{}

	for _, space := range spaces {
		if space.ParentID == nil {
			rootSpaces = append(rootSpaces, space)
		}
	}

	// Render root spaces
	for _, space := range rootSpaces {
		h.renderSpaceHTML(&buf, space)
	}

	buf.WriteString(`</div>`)
	return buf.String()
}

// renderSpaceHTML recursively renders space HTML structure
func (h *SPAHandler) renderSpaceHTML(buf *bytes.Buffer, space *models.Space) {
	slug := utils.GenerateSlug(space.Name)
	buf.WriteString(`<div class="space" data-id="`)
	buf.WriteString(fmt.Sprintf("%d", space.ID))
	buf.WriteString(`" data-slug="`)
	buf.WriteString(slug)
	buf.WriteString(`"><h3>`)
	buf.WriteString(space.Name)
	buf.WriteString(`</h3>`)

	if space.Description != "" {
		buf.WriteString(`<p>`)
		buf.WriteString(space.Description)
		buf.WriteString(`</p>`)
	}

	buf.WriteString(`</div>`)
}

// getLoadingAnimationHTML returns the loading animation HTML
func (h *SPAHandler) getLoadingAnimationHTML() string {
	return `<div id="loading" style="position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#fff;z-index:9999;">
    <svg viewBox="0 0 300 100" width="200" height="100">
      <line x1="0" y1="80" x2="300" y2="80" stroke="#ccc" stroke-width="2" />
      <g id="cat" transform="translate(0,0)">
        <ellipse cx="50" cy="60" rx="25" ry="15" fill="#ffbb33"/>
        <circle cx="75" cy="50" r="10" fill="#ffbb33"/>
        <circle cx="73" cy="48" r="2" fill="#000"/>
        <circle cx="78" cy="48" r="2" fill="#000"/>
        <rect x="35" y="70" width="5" height="10" fill="#ff9933">
          <animateTransform attributeName="transform" type="rotate"
            values="0 37.5 70;20 37.5 70;0 37.5 70;-20 37.5 70;0 37.5 70" dur="0.5s" repeatCount="indefinite" />
        </rect>
        <rect x="55" y="70" width="5" height="10" fill="#ff9933">
          <animateTransform attributeName="transform" type="rotate"
            values="0 57.5 70;-20 57.5 70;0 57.5 70;20 57.5 70;0 57.5 70" dur="0.5s" repeatCount="indefinite" />
        </rect>
        <path d="M25,60 Q15,50 10,55" stroke="#ff9933" stroke-width="4" fill="none">
          <animate attributeName="d" dur="0.6s" repeatCount="indefinite"
            values="M25,60 Q15,50 10,55;M25,60 Q15,70 10,65;M25,60 Q15,50 10,55" />
        </path>
        <animateMotion dur="4s" repeatCount="indefinite" path="M0,0 L250,0" />
      </g>
    </svg>
  </div>
  <div id="app" style="opacity:0;transition:opacity 0.3s ease-in-out;" class="hidden"></div>`
}