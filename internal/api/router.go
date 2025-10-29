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
	spaceService *services.SpaceService,
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
	spaceHandler := handlers.NewSpaceHandler(spaceService)
	postHandler := handlers.NewPostHandler(postService, fileService, opts)
	uploadHandler := handlers.NewUploadHandler(fileService, opts)
	linkPreviewHandler := handlers.NewLinkPreviewHandler(fileService)
	settingsHandler := handlers.NewSettingsHandler()
	logsHandler := handlers.NewLogsHandler()
	spaHandler := handlers.NewSPAHandler("web/themes", spaceService)
	
	// API routes
	api := r.PathPrefix("/api").Subrouter()
	
	// Spaces
	api.HandleFunc("/spaces", spaceHandler.GetSpaces).Methods("GET")
	api.HandleFunc("/spaces", spaceHandler.CreateSpace).Methods("POST")
	api.HandleFunc("/spaces/by-parent", spaceHandler.GetSpacesByParent).Methods("GET")
	api.HandleFunc("/spaces/{id}", spaceHandler.GetSpace).Methods("GET")
	api.HandleFunc("/spaces/{id}", spaceHandler.UpdateSpace).Methods("PUT")
	api.HandleFunc("/spaces/{id}", spaceHandler.DeleteSpace).Methods("DELETE")
	
	// Posts
	api.HandleFunc("/posts", postHandler.CreatePost).Methods("POST")
	api.HandleFunc("/posts/{id}", postHandler.GetPost).Methods("GET")
	api.HandleFunc("/posts/{id}", postHandler.DeletePost).Methods("DELETE")
	api.HandleFunc("/posts/{id}/move", postHandler.MovePost).Methods("PUT")
	api.HandleFunc("/spaces/{id}/posts", postHandler.GetPostsBySpace).Methods("GET")
	
	// Files
	api.HandleFunc("/upload", uploadHandler.UploadFile).Methods("POST")
	api.HandleFunc("/link-preview", handlers.FetchLinkPreview).Methods("POST")
	api.HandleFunc("/posts/{id}/link-previews", linkPreviewHandler.GetLinkPreviewsByPost).Methods("GET")
	
	// Settings
	api.HandleFunc("/settings", settingsHandler.GetSettings).Methods("GET")
	api.HandleFunc("/settings", settingsHandler.UpdateSettings).Methods("PUT")

	// Logs
	api.HandleFunc("/logs", logsHandler.GetLogs).Methods("GET")
	
	// Feature routes (registered only if enabled)
	if detailedStats != nil {
		detailedStatsHandler := detailedstats.NewHandler(detailedStats)
		detailedStatsHandler.RegisterRoutes(r)
	}
	
	if activityService != nil {
		activityHandler := activity.NewHandler(activityService)
		activityHandler.RegisterRoutes(r)
	}
	
	// Uploads
	r.HandleFunc("/uploads/{filename}", uploadHandler.ServeFile).Methods("GET")

	// SPA - catch all routes and serve theme-based frontend
	r.PathPrefix("/").Handler(spaHandler).Methods("GET")

	return r
}