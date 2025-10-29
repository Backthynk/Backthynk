package handlers

import (
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
}

func NewSPAHandler(themesBasePath string) *SPAHandler {
	return &SPAHandler{
		themesBasePath: themesBasePath,
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

	// This is a route, serve index.html for SPA routing
	indexPath := filepath.Join(distPath, "index.html")
	h.serveFile(w, r, indexPath)
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
