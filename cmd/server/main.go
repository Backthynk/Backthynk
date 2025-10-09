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

	// Initialize space cache
	spaceCache := cache.NewSpaceCache()

	// Initialize core services
	spaceService := services.NewSpaceService(db, spaceCache, dispatcher)
	postService := services.NewPostService(db, spaceCache, dispatcher)
	fileService := services.NewFileService(db, dispatcher)

	// Initialize space cache
	if err := spaceService.InitializeCache(); err != nil {
		log.Fatal("Failed to initialize space cache:", err)
	}

	// Initialize features
	opts := config.GetOptionsConfig()

	// Detailed Stats feature
	var detailedStatsService *detailedstats.Service
	if opts.Features.DetailedStats.Enabled {
		detailedStatsService = detailedstats.NewService(db, spaceCache, true)
		if err := detailedStatsService.Initialize(); err != nil {
			log.Fatal("Failed to initialize detailed stats:", err)
		}
		dispatcher.Subscribe(events.FileUploaded, detailedStatsService.HandleEvent)
		dispatcher.Subscribe(events.FileDeleted, detailedStatsService.HandleEvent)
		dispatcher.Subscribe(events.PostDeleted, detailedStatsService.HandleEvent)
		dispatcher.Subscribe(events.PostMoved, detailedStatsService.HandleEvent)
		dispatcher.Subscribe(events.SpaceUpdated, detailedStatsService.HandleEvent)
	}

	// Activity feature
	var activityService *activity.Service
	if opts.Features.Activity.Enabled {
		activityService = activity.NewService(db, spaceCache, true)
		if err := activityService.Initialize(); err != nil {
			log.Fatal("Failed to initialize activity:", err)
		}
		dispatcher.Subscribe(events.PostCreated, activityService.HandleEvent)
		dispatcher.Subscribe(events.PostDeleted, activityService.HandleEvent)
		dispatcher.Subscribe(events.PostMoved, activityService.HandleEvent)
		dispatcher.Subscribe(events.SpaceUpdated, activityService.HandleEvent)
	}

	// Initialize API router
	apiRouter := api.NewRouter(
		spaceService,
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

/*

Todo now: 

1. Finish to clean the front-end code, list the last bugs and fix them.


5. Ajouter un moyen simple de lancer l'application sur docker (en mode production)
max - 1. Ajouter un setup script to configure the app when starting
max . New readme adapted to current version


Todo later:

1. The activity is based on time UTC (which is "ok" if your timezone is based near UTC time but at UTC+9 your today's activity won't start before 9am)
-> we compute everything in the back-end : maybe the solution would be to compute activity hour to hour. 
It will take more space in the cache but it would work for every timezone. -> we will have to make sure the entire activity is fetch once per space in the front-end -> to avoid as much as possible recomputing things 

2. Setup zip compression for space/settings/posts/activity get methods with TTL LRU and invalidation when post is added/deleted && space is added/delete
3. compression pour le index.html file avec caching

4. Setup a stats page where information about traffic/network/hardware usage, errors, warnings

5. Add a feature to have an api that gives all right when added in the browser (all methods to change the state of the app.)
if the token is system is enabled and it's not entered in the cookies or somehwere then on the client side hide everything.

6. When 4 is done then add a feature to make private/public a space (it will be a recursive feature), if set then you can only see space's content if the token is in the cookies.


*/