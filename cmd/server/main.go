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
	// Ensure config files exist (interactive setup if needed)
	if err := config.EnsureConfigFiles(); err != nil {
		log.Fatal("Failed to setup configuration:", err)
	}

	// Load configuration
	if err := config.LoadSharedConfig(); err != nil {
		log.Fatal("Failed to load shared config:", err)
	}

	if err := config.LoadServiceConfig(); err != nil {
		log.Fatal("Failed to load service config:", err)
	}

	if err := config.LoadOptionsConfig(); err != nil {
		log.Fatal("Failed to load options config:", err)
	}

	// Display configuration paths
	config.PrintConfigPaths()

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

	// Initialize database
	db, err := storage.NewDB(serviceConfig.Files.StoragePath)
	if err != nil {
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
		log.Fatal("Failed to initialize category cache:", err)
	}

	// Initialize features
	opts := config.GetOptionsConfig()

	// Detailed Stats feature
	var detailedStatsService *detailedstats.Service
	if opts.Features.DetailedStats.Enabled {
		detailedStatsService = detailedstats.NewService(db, categoryCache, true)
		if err := detailedStatsService.Initialize(); err != nil {
			log.Fatal("Failed to initialize detailed stats:", err)
		}
		dispatcher.Subscribe(events.FileUploaded, detailedStatsService.HandleEvent)
		dispatcher.Subscribe(events.FileDeleted, detailedStatsService.HandleEvent)
		dispatcher.Subscribe(events.PostDeleted, detailedStatsService.HandleEvent)
		dispatcher.Subscribe(events.PostMoved, detailedStatsService.HandleEvent)
		dispatcher.Subscribe(events.CategoryUpdated, detailedStatsService.HandleEvent)
	}

	// Activity feature
	var activityService *activity.Service
	if opts.Features.Activity.Enabled {
		activityService = activity.NewService(db, categoryCache, true)
		if err := activityService.Initialize(); err != nil {
			log.Fatal("Failed to initialize activity:", err)
		}
		dispatcher.Subscribe(events.PostCreated, activityService.HandleEvent)
		dispatcher.Subscribe(events.PostDeleted, activityService.HandleEvent)
		dispatcher.Subscribe(events.PostMoved, activityService.HandleEvent)
		dispatcher.Subscribe(events.CategoryUpdated, activityService.HandleEvent)
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

	// Display startup info with features summary and RAM usage
	config.PrintStartupInfo(serviceConfig.Server.Port, opts)

	// Start server
	if err := http.ListenAndServe(":"+serviceConfig.Server.Port, apiRouter); err != nil {
		log.Fatal("Server failed:", err)
	}
}