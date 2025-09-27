package main

import (
	"backthynk/internal/config"
	"backthynk/internal/handlers"
	"backthynk/internal/services"
	"backthynk/internal/storage"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/gorilla/mux"
)

func main() {
	// Load service configuration
	if err := config.LoadServiceConfig(); err != nil {
		log.Fatal("Failed to load service.json:", err)
	}

	// Load configuration (temporarily without category service)
	settingsHandler := handlers.NewSettingsHandler(config.ConfigFilename(), nil)
	options, err := settingsHandler.LoadOptions()
	if err != nil {
		log.Fatal("Failed to load options:", err)
	}

	// Initialize database
	db, err := storage.NewDB(config.StoragePath())
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer db.Close()

	// Initialize category service and cache FIRST (other services depend on it)
	var categoryService *services.CategoryService
	categoryService = services.NewCategoryService(db, options.CategoryCacheEnabled)
	if options.CategoryCacheEnabled {
		if err := categoryService.InitializeCache(); err != nil {
			log.Printf("Warning: Failed to initialize category cache: %v", err)
		}
		log.Println("Category cache system enabled")
	} else {
		log.Println("Category cache system disabled")
	}

	// Initialize activity service and cache (if enabled)
	var activityService *services.ActivityService
	if options.ActivityEnabled {
		activityService = services.NewActivityService(db, categoryService)
		if err := activityService.InitializeCache(); err != nil {
			log.Printf("Warning: Failed to initialize activity cache: %v", err)
		}
		log.Println("Activity system enabled")
	} else {
		log.Println("Activity system disabled")
	}

	// Initialize file statistics service and cache (if enabled)
	var fileStatsService *services.FileStatsService
	if options.FileStatsEnabled {
		fileStatsService = services.NewFileStatsService(db, categoryService)
		if err := fileStatsService.InitializeCache(); err != nil {
			log.Printf("Warning: Failed to initialize file statistics cache: %v", err)
		}
		log.Println("File statistics system enabled")
	} else {
		log.Println("File statistics system disabled")
	}

	// Update settings handler with category service for dynamic cache updates
	settingsHandler = handlers.NewSettingsHandler(config.ConfigFilename(), categoryService)

	// Initialize handlers
	categoryHandler := handlers.NewCategoryHandler(db, categoryService, activityService, fileStatsService)
	postHandler := handlers.NewPostHandler(db, settingsHandler, categoryService, activityService, fileStatsService)
	uploadHandler := handlers.NewUploadHandler(db, filepath.Join(config.StoragePath(), config.UploadsSubdir()), settingsHandler, fileStatsService)
	linkPreviewHandler := handlers.NewLinkPreviewHandler(db)
	categoryStatsHandler := handlers.NewCategoryStatsHandler(db, activityService, fileStatsService)
	templateHandler := handlers.NewTemplateHandler(db, categoryService)

	// Activity handler (only if activity is enabled)
	var activityHandler *handlers.ActivityHandler
	if activityService != nil {
		activityHandler = handlers.NewActivityHandler(activityService)
	}

	// Setup router
	r := mux.NewRouter()

	// CORS middleware first
	r.Use(corsMiddleware)

	// API routes - highest priority
	api := r.PathPrefix("/api").Subrouter()

	// Categories
	api.HandleFunc("/categories", categoryHandler.GetCategories).Methods("GET")
	api.HandleFunc("/categories", categoryHandler.CreateCategory).Methods("POST")
	api.HandleFunc("/categories/by-parent", categoryHandler.GetCategoriesByParent).Methods("GET")
	api.HandleFunc("/category-stats/{id}", categoryStatsHandler.GetCategoryStats).Methods("GET")
	api.HandleFunc("/categories/{id}", categoryHandler.GetCategory).Methods("GET")
	api.HandleFunc("/categories/{id}", categoryHandler.UpdateCategory).Methods("PUT")
	api.HandleFunc("/categories/{id}", categoryHandler.DeleteCategory).Methods("DELETE")

	// Posts
	api.HandleFunc("/posts", postHandler.CreatePost).Methods("POST")
	api.HandleFunc("/posts/{id}", postHandler.GetPost).Methods("GET")
	api.HandleFunc("/posts/{id}", postHandler.DeletePost).Methods("DELETE")
	api.HandleFunc("/posts/{id}/move", postHandler.MovePost).Methods("PUT")
	api.HandleFunc("/categories/{id}/posts", postHandler.GetPostsByCategory).Methods("GET")

	// Link previews
	api.HandleFunc("/link-preview", linkPreviewHandler.FetchLinkPreview).Methods("POST")
	api.HandleFunc("/posts/{id}/link-previews", linkPreviewHandler.GetLinkPreviewsByPost).Methods("GET")

	// Activity (only if enabled)
	if activityHandler != nil {
		api.HandleFunc("/activity/{id}", activityHandler.GetActivityPeriod).Methods("GET")
	}

	// File upload and serving
	api.HandleFunc("/upload", uploadHandler.UploadFile).Methods("POST")
	r.HandleFunc("/uploads/{filename}", uploadHandler.ServeFile).Methods("GET")

	// Settings
	api.HandleFunc("/settings", settingsHandler.GetSettings).Methods("GET")
	api.HandleFunc("/settings", settingsHandler.UpdateSettings).Methods("PUT")

	// Static files
	r.PathPrefix("/static/").Handler(http.StripPrefix("/static/", createStaticFileHandler()))

	// Serve main page - lowest priority
	r.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		serveIndex(w, r, templateHandler)
	}).Methods("GET")
	r.HandleFunc("/{path:.*}", func(w http.ResponseWriter, r *http.Request) {
		serveIndex(w, r, templateHandler)
	}).Methods("GET") // SPA fallback

	log.Println("Server starting on :" + config.ServerPort())
	log.Fatal(http.ListenAndServe(":"+config.ServerPort(), r))
}

func serveIndex(w http.ResponseWriter, r *http.Request, templateHandler *handlers.TemplateHandler) {
	// Check if this is a category path for SEO
	path := r.URL.Path

	if path != "/" && isCategoryPath(path) {
		// This might be a category path, serve with SEO data
		serveCategoryPage(w, r, path, templateHandler)
		return
	}

	// Serve regular index with default template data
	templateHandler.ServeCategoryPage(w, r, path)
}

// Check if path could be a category path
func isCategoryPath(path string) bool {
	if path == "/" {
		return false
	}

	// Check against reserved routes
	pathParts := strings.Split(strings.Trim(path, "/"), "/")
	if len(pathParts) > 0 && config.IsReservedRoute(pathParts[0]) {
		return false
	}

	// Simple validation: starts with /, contains only valid category characters (including underscores)
	return len(path) > 1 && !strings.Contains(path, "//") &&
		regexp.MustCompile(`^/[a-zA-Z0-9\s_/-]+$`).MatchString(path)
}

// Serve category page with SEO data
func serveCategoryPage(w http.ResponseWriter, r *http.Request, path string, templateHandler *handlers.TemplateHandler) {
	// Use template handler for proper SEO
	templateHandler.ServeCategoryPage(w, r, path)
}

// createStaticFileHandler creates a file server that serves minified assets in production
func createStaticFileHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path

		// Check if client accepts gzip encoding
		acceptsGzip := strings.Contains(r.Header.Get("Accept-Encoding"), "gzip")

		// In production mode, serve optimized assets
		if config.IsProduction() {
			if strings.HasSuffix(path, ".js") {
				// For JS files, serve the bundled version (gzipped if available and client accepts)
				if acceptsGzip {
					gzipBundlePath := "web/static/js/compressed/bundle.js.gz"
					if _, err := os.Stat(gzipBundlePath); err == nil {
						w.Header().Set("Content-Encoding", "gzip")
						w.Header().Set("Content-Type", "application/javascript")
						http.ServeFile(w, r, gzipBundlePath)
						return
					}
				}
				// Fallback to regular minified bundle
				bundlePath := "web/static/js/compressed/bundle.js"
				if _, err := os.Stat(bundlePath); err == nil {
					w.Header().Set("Content-Type", "application/javascript")
					http.ServeFile(w, r, bundlePath)
					return
				}
			} else if strings.HasSuffix(path, ".css") {
				// For CSS files, serve gzipped version if available and client accepts
				cssFileName := filepath.Base(path)
				if acceptsGzip {
					gzipCSSPath := "web/static/css/compressed/" + cssFileName + ".gz"
					if _, err := os.Stat(gzipCSSPath); err == nil {
						w.Header().Set("Content-Encoding", "gzip")
						w.Header().Set("Content-Type", "text/css")
						http.ServeFile(w, r, gzipCSSPath)
						return
					}
				}
				// Fallback to regular minified CSS
				minifiedPath := "web/static/css/compressed/" + cssFileName
				if _, err := os.Stat(minifiedPath); err == nil {
					w.Header().Set("Content-Type", "text/css")
					http.ServeFile(w, r, minifiedPath)
					return
				}
			}
		}

		// Fallback to original file
		http.FileServer(http.Dir("web/static/")).ServeHTTP(w, r)
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
