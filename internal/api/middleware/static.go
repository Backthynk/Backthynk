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
	} else if strings.HasSuffix(path, ".css") {
		// Serve compressed CSS
		cssFile := path[strings.LastIndex(path, "/")+1:]
		
		if acceptsGzip {
			gzPath := "web/static/css/compressed/" + cssFile + ".gz"
			if _, err := os.Stat(gzPath); err == nil {
				w.Header().Set("Content-Encoding", "gzip")
				w.Header().Set("Content-Type", "text/css")
				http.ServeFile(w, r, gzPath)
				return
			}
		}
		
		minPath := "web/static/css/compressed/" + cssFile
		if _, err := os.Stat(minPath); err == nil {
			w.Header().Set("Content-Type", "text/css")
			http.ServeFile(w, r, minPath)
			return
		}
	}
	
	// Fallback to original
	http.FileServer(http.Dir("web/static/")).ServeHTTP(w, r)
}