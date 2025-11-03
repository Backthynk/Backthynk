package preview

import (
	"backthynk/internal/config"
	"backthynk/internal/core/events"
	"image"
	"image/color"
	"image/jpeg"
	"os"
	"path/filepath"
	"testing"
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
