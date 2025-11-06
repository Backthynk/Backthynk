package preview

import (
	"backthynk/internal/config"
	"backthynk/internal/core/events"
	"image"
	"image/color"
	"image/jpeg"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"
)

func createTestImage(path string, width, height int) error {
	img := image.NewRGBA(image.Rect(0, 0, width, height))

	// Fill with a gradient
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			c := color.RGBA{
				R: uint8(x % 256),
				G: uint8(y % 256),
				B: uint8((x + y) % 256),
				A: 255,
			}
			img.Set(x, y, c)
		}
	}

	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()

	return jpeg.Encode(file, img, &jpeg.Options{Quality: 90})
}

func TestIsPreviewSupported(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "test-preview-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	opts := config.NewTestOptionsConfig()
	dispatcher := events.NewDispatcher()
	service := NewService(tempDir, dispatcher, opts)

	tests := []struct {
		filename string
		expected bool
	}{
		{"test.jpg", true},
		{"test.jpeg", true},
		{"test.png", true},
		{"test.gif", true},
		{"test.webp", true},
		{"test.txt", false},
		{"test.pdf", false}, // PDF is in supported list but not enabled by default in test config
		{"test.doc", false},
	}

	for _, tt := range tests {
		result := service.IsPreviewSupported(tt.filename)
		if result != tt.expected {
			t.Errorf("IsPreviewSupported(%s) = %v, expected %v", tt.filename, result, tt.expected)
		}
	}
}

func TestGetPreviewPath(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "test-preview-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	opts := config.NewTestOptionsConfig()
	dispatcher := events.NewDispatcher()
	service := NewService(tempDir, dispatcher, opts)

	tests := []struct {
		filename     string
		size         string
		expectedPath string
	}{
		{"test.jpg", "large", "previews/test_preview_large.jpg"},
		{"test.png", "medium", "previews/test_preview_medium.jpg"},
		{"file.jpeg", "small", "previews/file_preview_small.jpg"},
		// Test size normalization
		{"test.jpg", "big", "previews/test_preview_large.jpg"},
		{"test.png", "med", "previews/test_preview_medium.jpg"},
	}

	for _, tt := range tests {
		result := service.GetPreviewPath(tt.filename, tt.size)
		if result != tt.expectedPath {
			t.Errorf("GetPreviewPath(%s, %s) = %s, expected %s", tt.filename, tt.size, result, tt.expectedPath)
		}
	}
}

func TestGeneratePreview(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "test-preview-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	opts := config.NewTestOptionsConfig()
	dispatcher := events.NewDispatcher()
	service := NewService(tempDir, dispatcher, opts)

	// Create a test image
	testImagePath := filepath.Join(tempDir, "test.jpg")
	if err := createTestImage(testImagePath, 1000, 800); err != nil {
		t.Fatal(err)
	}

	// Generate preview
	previewPath, err := service.GeneratePreview(testImagePath, "test.jpg", "large")
	if err != nil {
		t.Fatalf("Failed to generate preview: %v", err)
	}

	if previewPath == "" {
		t.Fatal("Expected preview path to be returned")
	}

	// Check that preview file exists
	fullPreviewPath := filepath.Join(tempDir, previewPath)
	if _, err := os.Stat(fullPreviewPath); os.IsNotExist(err) {
		t.Errorf("Preview file does not exist: %s", fullPreviewPath)
	}
}

func TestGeneratePreview_AllSizes(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "test-preview-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	opts := config.NewTestOptionsConfig()
	dispatcher := events.NewDispatcher()
	service := NewService(tempDir, dispatcher, opts)

	// Create a test image
	testImagePath := filepath.Join(tempDir, "test.jpg")
	if err := createTestImage(testImagePath, 1000, 800); err != nil {
		t.Fatal(err)
	}

	// Generate previews for all sizes
	sizes := []string{"large", "medium", "small"}
	for _, size := range sizes {
		previewPath, err := service.GeneratePreview(testImagePath, "test.jpg", size)
		if err != nil {
			t.Fatalf("Failed to generate %s preview: %v", size, err)
		}

		// Check that preview file exists
		fullPreviewPath := filepath.Join(tempDir, previewPath)
		if _, err := os.Stat(fullPreviewPath); os.IsNotExist(err) {
			t.Errorf("Preview file does not exist for size %s: %s", size, fullPreviewPath)
		}
	}
}

func TestPreviewExists(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "test-preview-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	opts := config.NewTestOptionsConfig()
	dispatcher := events.NewDispatcher()
	service := NewService(tempDir, dispatcher, opts)

	// Create a test image
	testImagePath := filepath.Join(tempDir, "test.jpg")
	if err := createTestImage(testImagePath, 1000, 800); err != nil {
		t.Fatal(err)
	}

	// Preview should not exist initially
	previewPath := service.GetPreviewPath("test.jpg", "large")
	if service.PreviewExists(previewPath) {
		t.Error("Preview should not exist before generation")
	}

	// Generate preview
	generatedPath, err := service.GeneratePreview(testImagePath, "test.jpg", "large")
	if err != nil {
		t.Fatal(err)
	}

	// Preview should now exist
	if !service.PreviewExists(generatedPath) {
		t.Error("Preview should exist after generation")
	}
}

func TestGeneratePreview_DisabledFeature(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "test-preview-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	opts := config.NewTestOptionsConfig()
	opts.Features.Preview.Enabled = false

	dispatcher := events.NewDispatcher()
	service := NewService(tempDir, dispatcher, opts)

	// Create a test image
	testImagePath := filepath.Join(tempDir, "test.jpg")
	if err := createTestImage(testImagePath, 1000, 800); err != nil {
		t.Fatal(err)
	}

	// Try to generate preview - should fail
	_, err = service.GeneratePreview(testImagePath, "test.jpg", "large")
	if err == nil {
		t.Error("Expected error when preview feature is disabled")
	}
}

func TestCleanupPreviews(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "test-preview-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	opts := config.NewTestOptionsConfig()
	dispatcher := events.NewDispatcher()
	service := NewService(tempDir, dispatcher, opts)

	// Create a test image
	testImagePath := filepath.Join(tempDir, "test.jpg")
	if err := createTestImage(testImagePath, 1000, 800); err != nil {
		t.Fatal(err)
	}

	// Generate previews for all sizes
	sizes := []string{"large", "medium", "small"}
	for _, size := range sizes {
		_, err := service.GeneratePreview(testImagePath, "test.jpg", size)
		if err != nil {
			t.Fatal(err)
		}
	}

	// Cleanup previews
	if err := service.CleanupPreviews("test.jpg"); err != nil {
		t.Fatalf("Failed to cleanup previews: %v", err)
	}

	// Verify all previews are deleted
	for _, size := range sizes {
		previewPath := service.GetPreviewPath("test.jpg", size)
		if service.PreviewExists(previewPath) {
			t.Errorf("Preview should be deleted after cleanup: %s", previewPath)
		}
	}
}

func TestSizeNormalization(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "test-preview-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	opts := config.NewTestOptionsConfig()
	dispatcher := events.NewDispatcher()
	service := NewService(tempDir, dispatcher, opts)

	// Create a test image
	testImagePath := filepath.Join(tempDir, "test.jpg")
	if err := createTestImage(testImagePath, 1000, 800); err != nil {
		t.Fatal(err)
	}

	// Generate preview with "big" size
	previewPathBig, err := service.GeneratePreview(testImagePath, "test.jpg", "big")
	if err != nil {
		t.Fatalf("Failed to generate preview with 'big' size: %v", err)
	}

	// Generate preview with "large" size
	previewPathLarge, err := service.GeneratePreview(testImagePath, "test2.jpg", "large")
	if err != nil {
		t.Fatalf("Failed to generate preview with 'large' size: %v", err)
	}

	// Both should use the same canonical size in their filenames
	if filepath.Base(previewPathBig) != "test_preview_large.jpg" {
		t.Errorf("Expected 'big' to normalize to 'large' in filename, got: %s", previewPathBig)
	}

	if filepath.Base(previewPathLarge) != "test2_preview_large.jpg" {
		t.Errorf("Expected 'large' to remain 'large' in filename, got: %s", previewPathLarge)
	}

	// Test that "med" normalizes to "medium"
	previewPathMed, err := service.GeneratePreview(testImagePath, "test3.jpg", "med")
	if err != nil {
		t.Fatalf("Failed to generate preview with 'med' size: %v", err)
	}

	if filepath.Base(previewPathMed) != "test3_preview_medium.jpg" {
		t.Errorf("Expected 'med' to normalize to 'medium' in filename, got: %s", previewPathMed)
	}
}

func TestConcurrentPreviewGeneration(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "test-preview-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	opts := config.NewTestOptionsConfig()

	// Track how many times the preview was actually generated
	// by counting the PreviewGenerated events
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

	// Launch 10 concurrent requests for the same preview
	const numGoroutines = 10
	errChan := make(chan error, numGoroutines)
	pathChan := make(chan string, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func() {
			// Add a small random delay to increase chances of overlap
			time.Sleep(time.Duration(i) * time.Millisecond)
			path, err := service.GeneratePreview(testImagePath, "test.jpg", "large")
			if err != nil {
				errChan <- err
				return
			}
			pathChan <- path
		}()
	}

	// Collect all results
	paths := make([]string, 0, numGoroutines)
	for i := 0; i < numGoroutines; i++ {
		select {
		case err := <-errChan:
			t.Fatalf("Preview generation failed: %v", err)
		case path := <-pathChan:
			paths = append(paths, path)
		}
	}

	// Verify all paths are the same
	if len(paths) != numGoroutines {
		t.Fatalf("Expected %d paths, got %d", numGoroutines, len(paths))
	}

	firstPath := paths[0]
	for i, path := range paths {
		if path != firstPath {
			t.Errorf("Path mismatch at index %d: got %s, expected %s", i, path, firstPath)
		}
	}

	// The critical test: verify the preview was only generated once
	// Give a moment for any in-flight events to be processed
	time.Sleep(10 * time.Millisecond)
	finalCount := atomic.LoadInt32(&generationCount)
	if finalCount != 1 {
		t.Errorf("Expected preview to be generated exactly once, but it was generated %d times", finalCount)
	}

	// Verify the preview file actually exists
	fullPreviewPath := filepath.Join(tempDir, firstPath)
	if _, err := os.Stat(fullPreviewPath); os.IsNotExist(err) {
		t.Errorf("Preview file does not exist: %s", fullPreviewPath)
	}
}

func TestConcurrentDifferentSizes(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "test-preview-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	opts := config.NewTestOptionsConfig()
	dispatcher := events.NewDispatcher()
	service := NewService(tempDir, dispatcher, opts)

	// Create a test image
	testImagePath := filepath.Join(tempDir, "test.jpg")
	if err := createTestImage(testImagePath, 1000, 800); err != nil {
		t.Fatal(err)
	}

	sizes := []string{"large", "medium", "small"}
	const goroutinesPerSize = 5

	type result struct {
		size string
		path string
		err  error
	}

	results := make(chan result, len(sizes)*goroutinesPerSize)

	// Launch concurrent requests for different sizes
	for _, size := range sizes {
		for i := 0; i < goroutinesPerSize; i++ {
			go func(s string) {
				path, err := service.GeneratePreview(testImagePath, "test.jpg", s)
				results <- result{size: s, path: path, err: err}
			}(size)
		}
	}

	// Collect results by size
	pathsBySize := make(map[string][]string)
	for i := 0; i < len(sizes)*goroutinesPerSize; i++ {
		res := <-results
		if res.err != nil {
			t.Fatalf("Failed to generate %s preview: %v", res.size, res.err)
		}
		pathsBySize[res.size] = append(pathsBySize[res.size], res.path)
	}

	// Verify each size has consistent paths
	for size, paths := range pathsBySize {
		if len(paths) != goroutinesPerSize {
			t.Errorf("Expected %d paths for size %s, got %d", goroutinesPerSize, size, len(paths))
			continue
		}

		firstPath := paths[0]
		for i, path := range paths {
			if path != firstPath {
				t.Errorf("Path mismatch for size %s at index %d: got %s, expected %s", size, i, path, firstPath)
			}
		}

		// Verify the file exists
		fullPath := filepath.Join(tempDir, firstPath)
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			t.Errorf("Preview file does not exist for size %s: %s", size, fullPath)
		}
	}

	// Verify all three different size previews were created
	if len(pathsBySize) != len(sizes) {
		t.Errorf("Expected %d different preview sizes, got %d", len(sizes), len(pathsBySize))
	}
}

// TestHighConcurrencyStressTest verifies deduplication under heavy concurrent load
func TestHighConcurrencyStressTest(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping stress test in short mode")
	}

	tempDir, err := os.MkdirTemp("", "test-preview-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	opts := config.NewTestOptionsConfig()

	// Track how many times the preview was actually generated
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

	// Launch 100 concurrent requests for the same preview
	const numGoroutines = 100
	errChan := make(chan error, numGoroutines)
	pathChan := make(chan string, numGoroutines)

	// Use a sync.WaitGroup to ensure all goroutines start around the same time
	startChan := make(chan struct{})

	for i := 0; i < numGoroutines; i++ {
		go func() {
			<-startChan // Wait for signal to start
			path, err := service.GeneratePreview(testImagePath, "test.jpg", "large")
			if err != nil {
				errChan <- err
				return
			}
			pathChan <- path
		}()
	}

	// Signal all goroutines to start at once
	close(startChan)

	// Collect all results
	paths := make([]string, 0, numGoroutines)
	for i := 0; i < numGoroutines; i++ {
		select {
		case err := <-errChan:
			t.Fatalf("Preview generation failed: %v", err)
		case path := <-pathChan:
			paths = append(paths, path)
		case <-time.After(5 * time.Second):
			t.Fatal("Test timed out waiting for preview generation")
		}
	}

	// Verify all paths are identical
	firstPath := paths[0]
	for i, path := range paths {
		if path != firstPath {
			t.Errorf("Path mismatch at index %d: got %s, expected %s", i, path, firstPath)
		}
	}

	// The critical test: verify the preview was only generated once
	time.Sleep(10 * time.Millisecond)
	finalCount := atomic.LoadInt32(&generationCount)
	if finalCount != 1 {
		t.Errorf("Expected preview to be generated exactly once, but it was generated %d times (out of %d concurrent requests)", finalCount, numGoroutines)
	}

	t.Logf("Successfully handled %d concurrent requests with only 1 actual preview generation", numGoroutines)
}
