package middleware

import (
	"backthynk/internal/config"
	"backthynk/internal/embedded"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func CreateStaticFileHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sharedCfg := config.GetSharedConfig()

		// Production mode with embedded assets
		if config.GetAppMode() == config.APP_MODE_PROD {
			ServeEmbeddedAsset(w, r)
			return
		}

		// Pre-production mode with bundle folder
		if config.GetAppMode() == config.APP_MODE_PRE_PROD {
			ServeCompressedAsset(w, r, sharedCfg.Paths.Dir.PreProduction)
			return
		}

		// Development mode
		http.FileServer(http.Dir(sharedCfg.GetWebStaticPath())).ServeHTTP(w, r)
	})
}

func ServeEmbeddedAsset(w http.ResponseWriter, r *http.Request) {
	bundleFS, err := embedded.GetBundleFS()
	if err != nil {
		http.Error(w, "Failed to access embedded assets", http.StatusInternalServerError)
		return
	}

	sharedCfg := config.GetSharedConfig()
	staticPath := sharedCfg.Paths.Source.Static

	path := strings.TrimPrefix(r.URL.Path, "/"+staticPath+"/")
	acceptEncoding := r.Header.Get("Accept-Encoding")

	// Try brotli first (best compression)
	if strings.Contains(acceptEncoding, "br") {
		if data, err := fs.ReadFile(bundleFS, staticPath+"/"+path+".br"); err == nil {
			w.Header().Set("Content-Encoding", "br")
			setContentType(w, path)
			w.Write(data)
			return
		}
	}

	// Try gzip next
	if strings.Contains(acceptEncoding, "gzip") {
		if data, err := fs.ReadFile(bundleFS, staticPath+"/"+path+".gz"); err == nil {
			w.Header().Set("Content-Encoding", "gzip")
			setContentType(w, path)
			w.Write(data)
			return
		}
	}

	// Serve uncompressed
	if data, err := fs.ReadFile(bundleFS, staticPath+"/"+path); err == nil {
		setContentType(w, path)
		w.Write(data)
		return
	}

	http.NotFound(w, r)
}

func ServeCompressedAsset(w http.ResponseWriter, r *http.Request, bundleDir string) {
	sharedCfg := config.GetSharedConfig()
	staticPath := sharedCfg.Paths.Source.Static

	path := strings.TrimPrefix(r.URL.Path, "/"+staticPath+"/")
	acceptEncoding := r.Header.Get("Accept-Encoding")

	// Try brotli first
	if strings.Contains(acceptEncoding, "br") {
		brPath := filepath.Join(bundleDir, staticPath, path+".br")
		if file, err := os.Open(brPath); err == nil {
			defer file.Close()
			w.Header().Set("Content-Encoding", "br")
			setContentType(w, path)
			io.Copy(w, file)
			return
		}
	}

	// Try gzip next
	if strings.Contains(acceptEncoding, "gzip") {
		gzPath := filepath.Join(bundleDir, staticPath, path+".gz")
		if file, err := os.Open(gzPath); err == nil {
			defer file.Close()
			w.Header().Set("Content-Encoding", "gzip")
			setContentType(w, path)
			io.Copy(w, file)
			return
		}
	}

	// Serve uncompressed
	filePath := filepath.Join(bundleDir, staticPath, path)
	if file, err := os.Open(filePath); err == nil {
		defer file.Close()
		setContentType(w, path)
		io.Copy(w, file)
		return
	}

	http.NotFound(w, r)
}

func setContentType(w http.ResponseWriter, path string) {
	if strings.HasSuffix(path, ".js") {
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	} else if strings.HasSuffix(path, ".css") {
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
	} else if strings.HasSuffix(path, ".png") {
		w.Header().Set("Content-Type", "image/png")
	} else if strings.HasSuffix(path, ".jpg") || strings.HasSuffix(path, ".jpeg") {
		w.Header().Set("Content-Type", "image/jpeg")
	} else if strings.HasSuffix(path, ".ico") {
		w.Header().Set("Content-Type", "image/x-icon")
	} else if strings.HasSuffix(path, ".svg") {
		w.Header().Set("Content-Type", "image/svg+xml")
	} else {
		w.Header().Set("Content-Type", "application/octet-stream")
	}
}
