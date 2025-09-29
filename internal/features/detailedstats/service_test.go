package detailedstats

import (
	"backthynk/internal/core/events"
	"testing"
)

func TestServiceBasicFunctionality(t *testing.T) {
	// Test with disabled service
	t.Run("DisabledService", func(t *testing.T) {
		service := &Service{enabled: false}

		// Initialize should succeed but do nothing
		err := service.Initialize()
		if err != nil {
			t.Errorf("Expected no error for disabled service, got %v", err)
		}

		// HandleEvent should succeed but do nothing
		err = service.HandleEvent(events.Event{
			Type: events.FileUploaded,
			Data: events.PostEvent{CategoryID: 1, FileSize: 1000},
		})
		if err != nil {
			t.Errorf("Expected no error for disabled service, got %v", err)
		}

		// GetStats should return empty stats
		stats := service.GetStats(1, false)
		if stats.FileCount != 0 || stats.TotalSize != 0 {
			t.Errorf("Expected empty stats for disabled service, got %+v", stats)
		}

		// GetGlobalStats should return empty stats
		globalStats := service.GetGlobalStats()
		if globalStats.FileCount != 0 || globalStats.TotalSize != 0 {
			t.Errorf("Expected empty global stats for disabled service, got %+v", globalStats)
		}
	})

	// Test with enabled service
	t.Run("EnabledService", func(t *testing.T) {
		service := &Service{
			enabled: true,
			stats:   make(map[int]*CategoryStats),
		}

		// Initialize stats manually to avoid catCache dependency
		service.mu.Lock()
		service.stats[1] = &CategoryStats{
			Direct:    Stats{FileCount: 1, TotalSize: 1000},
			Recursive: Stats{FileCount: 1, TotalSize: 1000},
		}
		service.mu.Unlock()

		// Test GetStats functionality
		directStats := service.GetStats(1, false)
		if directStats.FileCount != 1 {
			t.Errorf("Expected 1 file, got %d", directStats.FileCount)
		}
		if directStats.TotalSize != 1000 {
			t.Errorf("Expected 1000 total size, got %d", directStats.TotalSize)
		}

		recursiveStats := service.GetStats(1, true)
		if recursiveStats.FileCount != 1 {
			t.Errorf("Expected 1 recursive file, got %d", recursiveStats.FileCount)
		}
		if recursiveStats.TotalSize != 1000 {
			t.Errorf("Expected 1000 recursive total size, got %d", recursiveStats.TotalSize)
		}
	})
}

func TestGetStats(t *testing.T) {
	service := &Service{
		enabled: true,
		stats:   make(map[int]*CategoryStats),
	}

	// Create some stats manually
	service.mu.Lock()
	service.stats[1] = &CategoryStats{
		Direct:    Stats{FileCount: 5, TotalSize: 1000},
		Recursive: Stats{FileCount: 8, TotalSize: 1500},
	}
	service.mu.Unlock()

	// Test direct stats
	directStats := service.GetStats(1, false)
	if directStats.FileCount != 5 {
		t.Errorf("Expected 5 direct files, got %d", directStats.FileCount)
	}
	if directStats.TotalSize != 1000 {
		t.Errorf("Expected 1000 direct total size, got %d", directStats.TotalSize)
	}

	// Test recursive stats
	recursiveStats := service.GetStats(1, true)
	if recursiveStats.FileCount != 8 {
		t.Errorf("Expected 8 recursive files, got %d", recursiveStats.FileCount)
	}
	if recursiveStats.TotalSize != 1500 {
		t.Errorf("Expected 1500 recursive total size, got %d", recursiveStats.TotalSize)
	}

	// Test non-existent category
	emptyStats := service.GetStats(999, false)
	if emptyStats.FileCount != 0 || emptyStats.TotalSize != 0 {
		t.Errorf("Expected empty stats for non-existent category, got %+v", emptyStats)
	}
}

func TestGetStatsDisabled(t *testing.T) {
	service := &Service{
		enabled: false,
		stats:   make(map[int]*CategoryStats),
	}

	stats := service.GetStats(1, false)
	if stats.FileCount != 0 || stats.TotalSize != 0 {
		t.Errorf("Expected empty stats when disabled, got %+v", stats)
	}
}

func TestGetGlobalStats(t *testing.T) {
	service := &Service{
		enabled: true,
		stats:   make(map[int]*CategoryStats),
	}

	// Create stats for multiple categories manually
	service.mu.Lock()
	service.stats[1] = &CategoryStats{
		Direct:    Stats{FileCount: 5, TotalSize: 1000},
		Recursive: Stats{FileCount: 5, TotalSize: 1000},
	}
	service.stats[2] = &CategoryStats{
		Direct:    Stats{FileCount: 3, TotalSize: 500},
		Recursive: Stats{FileCount: 3, TotalSize: 500},
	}
	service.stats[3] = &CategoryStats{
		Direct:    Stats{FileCount: 2, TotalSize: 300},
		Recursive: Stats{FileCount: 2, TotalSize: 300},
	}
	service.mu.Unlock()

	globalStats := service.GetGlobalStats()
	if globalStats.FileCount != 10 { // 5 + 3 + 2
		t.Errorf("Expected 10 total files globally, got %d", globalStats.FileCount)
	}
	if globalStats.TotalSize != 1800 { // 1000 + 500 + 300
		t.Errorf("Expected 1800 total size globally, got %d", globalStats.TotalSize)
	}
}

func TestGetGlobalStatsDisabled(t *testing.T) {
	service := &Service{
		enabled: false,
		stats:   make(map[int]*CategoryStats),
	}

	globalStats := service.GetGlobalStats()
	if globalStats.FileCount != 0 || globalStats.TotalSize != 0 {
		t.Errorf("Expected empty global stats when disabled, got %+v", globalStats)
	}
}

func TestHandleEventDisabled(t *testing.T) {
	service := &Service{
		enabled: false,
		stats:   make(map[int]*CategoryStats),
	}

	// Events should be ignored when service is disabled
	err := service.HandleEvent(events.Event{
		Type: events.FileUploaded,
		Data: events.PostEvent{CategoryID: 1, FileSize: 1000},
	})
	if err != nil {
		t.Errorf("Expected no error for disabled service, got %v", err)
	}

	service.mu.RLock()
	statsCount := len(service.stats)
	service.mu.RUnlock()

	if statsCount != 0 {
		t.Errorf("Expected no stats when disabled, got %d stats", statsCount)
	}
}

func TestNewService(t *testing.T) {
	service := NewService(nil, nil, true)

	if service == nil {
		t.Fatal("Expected service to be created")
	}

	if !service.enabled {
		t.Error("Expected service to be enabled")
	}

	if service.stats == nil {
		t.Error("Expected stats map to be initialized")
	}
}

func TestNewServiceDisabled(t *testing.T) {
	service := NewService(nil, nil, false)

	if service.enabled {
		t.Error("Expected service to be disabled")
	}
}

func TestStatsStructure(t *testing.T) {
	// Test that the Stats struct has the expected fields and JSON tags
	stats := Stats{
		FileCount: 10,
		TotalSize: 2000,
	}

	if stats.FileCount != 10 {
		t.Errorf("Expected FileCount 10, got %d", stats.FileCount)
	}

	if stats.TotalSize != 2000 {
		t.Errorf("Expected TotalSize 2000, got %d", stats.TotalSize)
	}
}

func TestCategoryStatsStructure(t *testing.T) {
	// Test that the CategoryStats struct properly handles both direct and recursive stats
	categoryStats := &CategoryStats{
		Direct: Stats{
			FileCount: 5,
			TotalSize: 1000,
		},
		Recursive: Stats{
			FileCount: 8,
			TotalSize: 1500,
		},
	}

	if categoryStats.Direct.FileCount != 5 {
		t.Errorf("Expected Direct FileCount 5, got %d", categoryStats.Direct.FileCount)
	}

	if categoryStats.Direct.TotalSize != 1000 {
		t.Errorf("Expected Direct TotalSize 1000, got %d", categoryStats.Direct.TotalSize)
	}

	if categoryStats.Recursive.FileCount != 8 {
		t.Errorf("Expected Recursive FileCount 8, got %d", categoryStats.Recursive.FileCount)
	}

	if categoryStats.Recursive.TotalSize != 1500 {
		t.Errorf("Expected Recursive TotalSize 1500, got %d", categoryStats.Recursive.TotalSize)
	}
}

func TestServiceConcurrentAccess(t *testing.T) {
	service := &Service{
		enabled: true,
		stats:   make(map[int]*CategoryStats),
	}

	// Initialize some stats
	service.mu.Lock()
	service.stats[1] = &CategoryStats{
		Direct:    Stats{FileCount: 5, TotalSize: 1000},
		Recursive: Stats{FileCount: 5, TotalSize: 1000},
	}
	service.mu.Unlock()

	// Test concurrent reads
	done := make(chan bool, 10)

	for i := 0; i < 10; i++ {
		go func() {
			stats := service.GetStats(1, false)
			if stats.FileCount != 5 {
				t.Errorf("Expected 5 files in concurrent read, got %d", stats.FileCount)
			}
			done <- true
		}()
	}

	// Wait for all goroutines to complete
	for i := 0; i < 10; i++ {
		<-done
	}
}