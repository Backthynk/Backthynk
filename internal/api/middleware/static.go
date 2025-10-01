package middleware

import (
	"net/http"
	"os"
	"strings"
)

func ServeCompressedAsset(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// Check if client accepts gzip
	acceptsGzip := strings.Contains(r.Header.Get("Accept-Encoding"), "gzip")

	if strings.HasSuffix(path, ".js") {
		// Serve bundled JS
		if acceptsGzip {
			gzPath := "web/static/js/compressed/bundle.js.gz"
			if _, err := os.Stat(gzPath); err == nil {
				w.Header().Set("Content-Encoding", "gzip")
				w.Header().Set("Content-Type", "application/javascript")
				http.ServeFile(w, r, gzPath)
				return
			}
		}

		bundlePath := "web/static/js/compressed/bundle.js"
		if _, err := os.Stat(bundlePath); err == nil {
			w.Header().Set("Content-Type", "application/javascript")
			http.ServeFile(w, r, bundlePath)
			return
		}

		// In production mode, don't serve individual JS files to prevent conflicts
		// Return 404 for individual JS files when bundle exists
		w.WriteHeader(http.StatusNotFound)
		return
	} else if strings.HasSuffix(path, ".css") {		// Serve compressed CSS

		if acceptsGzip {
			gzPath := "web/static/css/compressed/bundle.css.gz"
			if _, err := os.Stat(gzPath); err == nil {
				w.Header().Set("Content-Encoding", "gzip")
				w.Header().Set("Content-Type", "text/css")
				http.ServeFile(w, r, gzPath)
				return
			}
		}

		minPath := "web/static/css/compressed/bundle.css"
		if _, err := os.Stat(minPath); err == nil {
			w.Header().Set("Content-Type", "text/css")
			http.ServeFile(w, r, minPath)
			return
		}
	}

	// Fallback to original (for non-JS/CSS files)
	http.FileServer(http.Dir("web/static/")).ServeHTTP(w, r)
}