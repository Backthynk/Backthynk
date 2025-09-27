package services

import (
	"backthynk/internal/cache"
	"backthynk/internal/storage"
	"fmt"
	"log"
)

// CacheManager coordinates all cache-enabled services and ensures proper initialization
type CacheManager struct {
	coordinator         *cache.CacheCoordinator
	categoryService     *CategoryService
	postCountService    *PostCountService
	fileStatsService    *FileStatsService
	activityService     *ActivityService

	// Cache enable flags
	categoryCacheEnabled  bool
	activityEnabled       bool
	fileStatsEnabled      bool
}

// CacheConfig holds cache configuration
type CacheConfig struct {
	CategoryCacheEnabled bool
	ActivityEnabled      bool
	FileStatsEnabled     bool
}

// NewCacheManager creates a new cache manager with specified cache configurations
func NewCacheManager(db *storage.DB, config CacheConfig) *CacheManager {
	// Create services in the correct dependency order
	categoryService := NewCategoryService(db, config.CategoryCacheEnabled)
	postCountService := NewPostCountService(db, categoryService)
	fileStatsService := NewFileStatsService(db, categoryService)
	activityService := NewActivityService(db, categoryService)

	// Set individual cache flags
	activityService.SetCacheEnabled(config.ActivityEnabled)

	coordinator := cache.GetCacheCoordinator()
	coordinator.SetCacheFlags(config.CategoryCacheEnabled, config.ActivityEnabled, config.FileStatsEnabled)

	return &CacheManager{
		coordinator:           coordinator,
		categoryService:       categoryService,
		postCountService:      postCountService,
		fileStatsService:      fileStatsService,
		activityService:       activityService,
		categoryCacheEnabled:  config.CategoryCacheEnabled,
		activityEnabled:       config.ActivityEnabled,
		fileStatsEnabled:      config.FileStatsEnabled,
	}
}

// InitializeAllCaches initializes all enabled caches in the correct order
func (cm *CacheManager) InitializeAllCaches() error {
	log.Println("Starting cache initialization...")

	// 1. Initialize category cache first (it provides hierarchy) - only if enabled
	if cm.categoryCacheEnabled {
		log.Println("Initializing category cache...")
		if err := cm.categoryService.InitializeCache(); err != nil {
			return fmt.Errorf("failed to initialize category cache: %w", err)
		}
	} else {
		log.Println("Category cache disabled, skipping initialization")
	}

	// 2. Initialize post count cache (always mandatory - depends on category hierarchy)
	log.Println("Initializing post count cache...")
	if err := cm.postCountService.InitializeCache(); err != nil {
		return fmt.Errorf("failed to initialize post count cache: %w", err)
	}

	// 3. Initialize activity cache (optional - depends on category hierarchy)
	if cm.activityEnabled {
		log.Println("Initializing activity cache...")
		if err := cm.activityService.InitializeCache(); err != nil {
			return fmt.Errorf("failed to initialize activity cache: %w", err)
		}
	} else {
		log.Println("Activity cache disabled, skipping initialization")
	}

	// 4. Initialize file stats cache (optional - depends on category hierarchy)
	if cm.fileStatsEnabled {
		log.Println("Initializing file stats cache...")
		if err := cm.fileStatsService.InitializeCache(); err != nil {
			return fmt.Errorf("failed to initialize file stats cache: %w", err)
		}
	} else {
		log.Println("File stats cache disabled, skipping initialization")
	}

	log.Println("All enabled caches initialized successfully")
	return nil
}

// RefreshAllCaches refreshes all enabled caches from database
func (cm *CacheManager) RefreshAllCaches() error {
	log.Println("Refreshing all enabled caches...")

	// Refresh in the same order as initialization
	if cm.categoryCacheEnabled {
		if err := cm.categoryService.RefreshCache(); err != nil {
			return fmt.Errorf("failed to refresh category cache: %w", err)
		}
	}

	// Post count cache is always mandatory
	if err := cm.postCountService.RefreshCache(); err != nil {
		return fmt.Errorf("failed to refresh post count cache: %w", err)
	}

	if cm.activityEnabled {
		if err := cm.activityService.RefreshCache(); err != nil {
			return fmt.Errorf("failed to refresh activity cache: %w", err)
		}
	}

	// File stats cache refresh is category-specific, so we'll skip global refresh
	if cm.fileStatsEnabled {
		log.Println("Note: File stats cache refresh is category-specific")
	}

	log.Println("All enabled caches refreshed successfully")
	return nil
}

// GetCacheStats returns statistics for all caches
func (cm *CacheManager) GetCacheStats() map[string]interface{} {
	stats := make(map[string]interface{})

	stats["category_cache_enabled"] = cm.categoryCacheEnabled
	stats["activity_enabled"] = cm.activityEnabled
	stats["file_stats_enabled"] = cm.fileStatsEnabled
	stats["coordinator"] = cm.coordinator.GetStats()

	// Always include post count cache (mandatory)
	stats["post_count_cache"] = cm.postCountService.GetCacheStats()

	if cm.categoryCacheEnabled {
		stats["category_cache"] = cm.categoryService.GetCacheStats()
	}

	if cm.fileStatsEnabled {
		stats["file_stats_cache"] = cm.fileStatsService.GetCacheStats()
	}

	if cm.activityEnabled {
		stats["activity_cache"] = cm.activityService.GetCacheStats()
	}

	return stats
}

// SetCacheEnabled enables or disables caching for specific cache types
func (cm *CacheManager) SetCacheEnabled(categoryCache, activity, fileStats bool) {
	cm.categoryCacheEnabled = categoryCache
	cm.activityEnabled = activity
	cm.fileStatsEnabled = fileStats

	cm.categoryService.SetCacheEnabled(categoryCache)
	cm.activityService.SetCacheEnabled(activity)

	log.Printf("Cache settings updated - Category: %v, Activity: %v, FileStats: %v",
		categoryCache, activity, fileStats)
}

// Getters for individual services
func (cm *CacheManager) CategoryService() *CategoryService {
	return cm.categoryService
}

func (cm *CacheManager) PostCountService() *PostCountService {
	return cm.postCountService
}

func (cm *CacheManager) FileStatsService() *FileStatsService {
	return cm.fileStatsService
}

func (cm *CacheManager) ActivityService() *ActivityService {
	return cm.activityService
}

func (cm *CacheManager) Coordinator() *cache.CacheCoordinator {
	return cm.coordinator
}

// Stop gracefully stops all cache operations
func (cm *CacheManager) Stop() {
	log.Println("Stopping cache manager...")
	cm.coordinator.Stop()
	log.Println("Cache manager stopped")
}