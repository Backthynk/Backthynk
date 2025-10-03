package api

import (
	"backthynk/internal/api/handlers"
	"backthynk/internal/api/middleware"
	"backthynk/internal/config"
	"backthynk/internal/core/services"
	"backthynk/internal/features/activity"
	"backthynk/internal/features/detailedstats"
	"net/http"

	"github.com/gorilla/mux"
)

func NewRouter(
	categoryService *services.CategoryService,
	postService *services.PostService,
	fileService *services.FileService,
	detailedStats *detailedstats.Service,
	activityService *activity.Service,
	opts *config.OptionsConfig,
	serviceConfig *config.ServiceConfig,
) http.Handler {
	r := mux.NewRouter()
	
	// Middleware
	r.Use(middleware.CORS)
	r.Use(middleware.Logging)
	
	// Initialize handlers
	categoryHandler := handlers.NewCategoryHandler(categoryService)
	postHandler := handlers.NewPostHandler(postService, fileService, opts)
	uploadHandler := handlers.NewUploadHandler(fileService, opts)
	linkPreviewHandler := handlers.NewLinkPreviewHandler(fileService)
	settingsHandler := handlers.NewSettingsHandler()
	templateHandler := handlers.NewTemplateHandler(categoryService, opts, serviceConfig)
	
	// API routes
	api := r.PathPrefix("/api").Subrouter()
	
	// Categories
	api.HandleFunc("/categories", categoryHandler.GetCategories).Methods("GET")
	api.HandleFunc("/categories", categoryHandler.CreateCategory).Methods("POST")
	api.HandleFunc("/categories/by-parent", categoryHandler.GetCategoriesByParent).Methods("GET")
	api.HandleFunc("/categories/{id}", categoryHandler.GetCategory).Methods("GET")
	api.HandleFunc("/categories/{id}", categoryHandler.UpdateCategory).Methods("PUT")
	api.HandleFunc("/categories/{id}", categoryHandler.DeleteCategory).Methods("DELETE")
	
	// Posts
	api.HandleFunc("/posts", postHandler.CreatePost).Methods("POST")
	api.HandleFunc("/posts/{id}", postHandler.GetPost).Methods("GET")
	api.HandleFunc("/posts/{id}", postHandler.DeletePost).Methods("DELETE")
	api.HandleFunc("/posts/{id}/move", postHandler.MovePost).Methods("PUT")
	api.HandleFunc("/categories/{id}/posts", postHandler.GetPostsByCategory).Methods("GET")
	
	// Files
	api.HandleFunc("/upload", uploadHandler.UploadFile).Methods("POST")
	api.HandleFunc("/link-preview", handlers.FetchLinkPreview).Methods("POST")
	api.HandleFunc("/posts/{id}/link-previews", linkPreviewHandler.GetLinkPreviewsByPost).Methods("GET")
	
	// Settings
	api.HandleFunc("/settings", settingsHandler.GetSettings).Methods("GET")
	api.HandleFunc("/settings", settingsHandler.UpdateSettings).Methods("PUT")
	
	// Feature routes (registered only if enabled)
	if detailedStats != nil {
		detailedStatsHandler := detailedstats.NewHandler(detailedStats)
		detailedStatsHandler.RegisterRoutes(r)
	}
	
	if activityService != nil {
		activityHandler := activity.NewHandler(activityService)
		activityHandler.RegisterRoutes(r)
	}
	
	// Static files
	r.PathPrefix("/static/").Handler(http.StripPrefix("/static/", createStaticFileHandler()))
	r.HandleFunc("/uploads/{filename}", uploadHandler.ServeFile).Methods("GET")
	
	// SPA routes
	r.PathPrefix("/").HandlerFunc(templateHandler.ServePage).Methods("GET")
	
	return r
}

func createStaticFileHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Production mode handling
		if config.IsProduction() {
			// Serve compressed assets
			middleware.ServeCompressedAsset(w, r)
			return
		}
		// Development mode
		http.FileServer(http.Dir("web/static/")).ServeHTTP(w, r)
	})
}