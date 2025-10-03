package main

import (
	"backthynk/internal/api"
	"backthynk/internal/config"
	"backthynk/internal/core/cache"
	"backthynk/internal/core/events"
	"backthynk/internal/core/logger"
	"backthynk/internal/core/services"
	"backthynk/internal/features/activity"
	"backthynk/internal/features/detailedstats"
	"backthynk/internal/storage"
	"log"
	"net/http"
)

func main() {
	// Load configuration
	if err := config.LoadServiceConfig(); err != nil {
		log.Fatal("Failed to load service config:", err)
	}

	if err := config.LoadOptionsConfig(); err != nil {
		log.Fatal("Failed to load options config:", err)
	}

	// Initialize logger
	serviceConfig := config.GetServiceConfig()
	if err := logger.Initialize(
		serviceConfig.Files.StoragePath,
		serviceConfig.Logging.DisplayLogs,
		serviceConfig.Logging.EnableRequestLogs,
	); err != nil {
		log.Fatal("Failed to initialize logger:", err)
	}
	defer logger.GetLogger().Close()

	logger.Info("Starting BackThynk server")

	// Initialize database
	db, err := storage.NewDB(serviceConfig.Files.StoragePath)
	if err != nil {
		logger.Errorf("Failed to initialize database: %v", err)
		log.Fatal("Failed to initialize database:", err)
	}
	defer db.Close()
	
	// Initialize event dispatcher
	dispatcher := events.NewAsyncDispatcher()
	
	// Initialize category cache
	categoryCache := cache.NewCategoryCache()
	
	// Initialize core services
	categoryService := services.NewCategoryService(db, categoryCache, dispatcher)
	postService := services.NewPostService(db, categoryCache, dispatcher)
	fileService := services.NewFileService(db, dispatcher)
	
	// Initialize category cache
	if err := categoryService.InitializeCache(); err != nil {
		logger.Errorf("Failed to initialize category cache: %v", err)
		log.Fatal("Failed to initialize category cache:", err)
	}
	logger.Infof("Initialized category cache with %d categories", len(categoryCache.GetAll()))

	// Initialize features
	opts := config.GetOptionsConfig()

	// Detailed Stats feature
	var detailedStatsService *detailedstats.Service
	if opts.Features.DetailedStats.Enabled {
		detailedStatsService = detailedstats.NewService(db, categoryCache, true)
		if err := detailedStatsService.Initialize(); err != nil {
			logger.Warningf("Failed to initialize detailed stats: %v", err)
		}
		dispatcher.Subscribe(events.FileUploaded, detailedStatsService.HandleEvent)
		dispatcher.Subscribe(events.FileDeleted, detailedStatsService.HandleEvent)
		dispatcher.Subscribe(events.PostDeleted, detailedStatsService.HandleEvent)
		dispatcher.Subscribe(events.PostMoved, detailedStatsService.HandleEvent)
		dispatcher.Subscribe(events.CategoryUpdated, detailedStatsService.HandleEvent)
		logger.Info("Detailed stats feature enabled")
	}

	// Activity feature
	var activityService *activity.Service
	if opts.Features.Activity.Enabled {
		activityService = activity.NewService(db, categoryCache, true)
		if err := activityService.Initialize(); err != nil {
			logger.Warningf("Failed to initialize activity: %v", err)
		}
		dispatcher.Subscribe(events.PostCreated, activityService.HandleEvent)
		dispatcher.Subscribe(events.PostDeleted, activityService.HandleEvent)
		dispatcher.Subscribe(events.PostMoved, activityService.HandleEvent)
		dispatcher.Subscribe(events.CategoryUpdated, activityService.HandleEvent)
		logger.Info("Activity tracking feature enabled")
	}
	
	// Initialize API router
	apiRouter := api.NewRouter(
		categoryService,
		postService,
		fileService,
		detailedStatsService,
		activityService,
		opts,
		config.GetServiceConfig(),
	)
	
	// Start server
	logger.Infof("Server starting on :%s", serviceConfig.Server.Port)
	if err := http.ListenAndServe(":"+serviceConfig.Server.Port, apiRouter); err != nil {
		logger.Errorf("Server failed: %v", err)
		log.Fatal("Server failed:", err)
	}
}