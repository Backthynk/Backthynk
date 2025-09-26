package main

import (
	"backthynk/internal/config"
	"backthynk/internal/handlers"
	"backthynk/internal/services"
	"backthynk/internal/storage"
	"log"
	"net/http"
	"path/filepath"

	"github.com/gorilla/mux"
)

func main() {
	// Load configuration
	settingsHandler := handlers.NewSettingsHandler(config.ConfigFilename)
	options, err := settingsHandler.LoadOptions()
	if err != nil {
		log.Fatal("Failed to load options:", err)
	}

	// Initialize database
	db, err := storage.NewDB(options.StoragePath)
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer db.Close()

	// Initialize activity service and cache (if enabled)
	var activityService *services.ActivityService
	if options.ActivityEnabled {
		activityService = services.NewActivityService(db)
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
		fileStatsService = services.NewFileStatsService(db)
		if err := fileStatsService.InitializeCache(); err != nil {
			log.Printf("Warning: Failed to initialize file statistics cache: %v", err)
		}
		log.Println("File statistics system enabled")
	} else {
		log.Println("File statistics system disabled")
	}

	// Initialize handlers
	categoryHandler := handlers.NewCategoryHandler(db, activityService, fileStatsService)
	postHandler := handlers.NewPostHandler(db, settingsHandler, activityService, fileStatsService)
	uploadHandler := handlers.NewUploadHandler(db, filepath.Join(options.StoragePath, config.UploadsSubdir), settingsHandler, fileStatsService)
	linkPreviewHandler := handlers.NewLinkPreviewHandler(db)
	categoryStatsHandler := handlers.NewCategoryStatsHandler(db, activityService, fileStatsService)

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
	r.PathPrefix("/static/").Handler(http.StripPrefix("/static/", http.FileServer(http.Dir("web/static/"))))

	// Serve main page - lowest priority
	r.HandleFunc("/", serveIndex).Methods("GET")
	r.HandleFunc("/{path:.*}", serveIndex).Methods("GET") // SPA fallback

	log.Println("Server starting on :" + config.DefaultServerPort)
	log.Fatal(http.ListenAndServe(":" + config.DefaultServerPort, r))
}

func serveIndex(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "web/templates/index.html")
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