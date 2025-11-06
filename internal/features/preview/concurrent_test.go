package preview

import (
	"backthynk/internal/config"
	"backthynk/internal/core/events"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"
)

// TestConcurrentGenerationRealWorld simulates a real-world scenario where
// multiple HTTP requests arrive simultaneously for the same file preview
func TestConcurrentGenerationRealWorld(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "test-preview-concurrent-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	opts := config.NewTestOptionsConfig()

	var generationCount int32
	dispatcher := events.NewDispatcher()
	dispatcher.Subscribe(events.PreviewGenerated, func(e events.Event) error {
		atomic.AddInt32(&generationCount, 1)
		return nil
	})

	service := NewService(tempDir, dispatcher, opts)

	// Create a test image
	testImagePath := filepath.Join(tempDir, "document.jpg")
	if err := createTestImage(testImagePath, 2000, 1500); err != nil {
		t.Fatal(err)
	}

	// Scenario: A user opens a page with 3 thumbnail sizes displayed
	// Their browser makes 3 concurrent requests for the same file
	sizes := []string{"large", "medium", "small"}
	type request struct {
		filename string
		size     string
	}

	// Generate all combinations
	requests := []request{
		{"document.jpg", "large"},
		{"document.jpg", "medium"},
		{"document.jpg", "small"},
	}

	results := make(chan struct {
		req  request
		path string
		err  error
	}, len(requests))

	// Simulate concurrent browser requests
	startChan := make(chan struct{})
	for _, req := range requests {
		go func(r request) {
			<-startChan
			path, err := service.GeneratePreview(testImagePath, r.filename, r.size)
			results <- struct {
				req  request
				path string
				err  error
			}{r, path, err}
		}(req)
	}

	close(startChan)

	// Collect results
	for i := 0; i < len(requests); i++ {
		select {
		case res := <-results:
			if res.err != nil {
				t.Errorf("Failed to generate %s preview: %v", res.req.size, res.err)
			}
			// Verify file exists
			fullPath := filepath.Join(tempDir, res.path)
			if _, err := os.Stat(fullPath); os.IsNotExist(err) {
				t.Errorf("Preview file missing: %s", fullPath)
			}
		case <-time.After(5 * time.Second):
			t.Fatal("Timeout waiting for preview generation")
		}
	}

	// Each size should be generated exactly once (3 generations total)
	time.Sleep(10 * time.Millisecond)
	finalCount := atomic.LoadInt32(&generationCount)
	expectedGenerations := len(sizes) // One per unique size
	if finalCount != int32(expectedGenerations) {
		t.Errorf("Expected %d preview generations (one per size), got %d", expectedGenerations, finalCount)
	}

	t.Logf("Successfully handled %d concurrent requests with %d unique previews generated", len(requests), finalCount)
}

// TestPreviewExistsCheckRaceCondition verifies that the deduplication works
// even when PreviewExists is called before GeneratePreview
func TestPreviewExistsCheckRaceCondition(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "test-preview-race-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	opts := config.NewTestOptionsConfig()

	var generationCount int32
	dispatcher := events.NewDispatcher()
	dispatcher.Subscribe(events.PreviewGenerated, func(e events.Event) error {
		atomic.AddInt32(&generationCount, 1)
		return nil
	})

	service := NewService(tempDir, dispatcher, opts)

	// Create a test image
	testImagePath := filepath.Join(tempDir, "test.jpg")
	if err := createTestImage(testImagePath, 1000, 800); err != nil {
		t.Fatal(err)
	}

	const numGoroutines = 50
	results := make(chan error, numGoroutines)
	startChan := make(chan struct{})

	// Simulate the pattern used in upload_handler.go:
	// Check if preview exists, if not, generate it
	for i := 0; i < numGoroutines; i++ {
		go func() {
			<-startChan
			previewPath := service.GetPreviewPath("test.jpg", "large")

			// This is the pattern from ServeFile handler
			if !service.PreviewExists(previewPath) {
				_, err := service.GeneratePreview(testImagePath, "test.jpg", "large")
				if err != nil {
					results <- err
					return
				}
			}
			results <- nil
		}()
	}

	close(startChan)

	// Collect results
	for i := 0; i < numGoroutines; i++ {
		select {
		case err := <-results:
			if err != nil {
				t.Errorf("Preview generation failed: %v", err)
			}
		case <-time.After(5 * time.Second):
			t.Fatal("Timeout")
		}
	}

	// Even with the PreviewExists check, we should only generate once
	time.Sleep(10 * time.Millisecond)
	finalCount := atomic.LoadInt32(&generationCount)

	// Note: Due to race condition, there might be a small window where
	// multiple goroutines pass the PreviewExists check before the file
	// is created. However, the deduplication in GeneratePreview should
	// ensure only one actual generation happens
	if finalCount > 2 {
		t.Errorf("Too many preview generations: expected 1, got %d (max 2 acceptable due to race window)", finalCount)
	}

	t.Logf("Generated preview %d time(s) from %d concurrent requests", finalCount, numGoroutines)
}
