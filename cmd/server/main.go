package main

import (
	"backthynk/internal/handlers"
	"backthynk/internal/storage"
	"log"
	"net/http"

	"github.com/gorilla/mux"
)

func main() {
	// Initialize database
	db, err := storage.NewDB("storage")
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer db.Close()

	// Initialize handlers
	categoryHandler := handlers.NewCategoryHandler(db)
	postHandler := handlers.NewPostHandler(db)
	uploadHandler := handlers.NewUploadHandler(db, "storage/uploads")
	linkPreviewHandler := handlers.NewLinkPreviewHandler(db)

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
	api.HandleFunc("/category-stats/{id}", categoryHandler.GetCategoryStats).Methods("GET")
	api.HandleFunc("/categories/{id}", categoryHandler.GetCategory).Methods("GET")
	api.HandleFunc("/categories/{id}", categoryHandler.DeleteCategory).Methods("DELETE")

	// Posts
	api.HandleFunc("/posts", postHandler.CreatePost).Methods("POST")
	api.HandleFunc("/posts/{id}", postHandler.GetPost).Methods("GET")
	api.HandleFunc("/posts/{id}", postHandler.DeletePost).Methods("DELETE")
	api.HandleFunc("/categories/{id}/posts", postHandler.GetPostsByCategory).Methods("GET")

	// Link previews
	api.HandleFunc("/link-preview", linkPreviewHandler.FetchLinkPreview).Methods("POST")
	api.HandleFunc("/posts/{id}/link-previews", linkPreviewHandler.GetLinkPreviewsByPost).Methods("GET")

	// File upload and serving
	api.HandleFunc("/upload", uploadHandler.UploadFile).Methods("POST")
	r.HandleFunc("/uploads/{filename}", uploadHandler.ServeFile).Methods("GET")

	// Static files
	r.PathPrefix("/static/").Handler(http.StripPrefix("/static/", http.FileServer(http.Dir("web/static/"))))

	// Serve main page - lowest priority
	r.HandleFunc("/", serveIndex).Methods("GET")
	r.HandleFunc("/{path:.*}", serveIndex).Methods("GET") // SPA fallback

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", r))
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