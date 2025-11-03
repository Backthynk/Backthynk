package preview

import (
	"backthynk/internal/config"
	"backthynk/internal/core/cache"
	"backthynk/internal/core/events"
	"backthynk/internal/core/services"
	"backthynk/internal/storage"
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"os"
	"path/filepath"
	"testing"
)

// Integration test for file upload with attachments and preview generation
func TestFileUploadWithPreviewIntegration(t *testing.T) {
	// Setup test environment
	tempDir, err := os.MkdirTemp("", "test-integration-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	uploadsDir := filepath.Join(tempDir, "uploads")
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Set service config for test
	serviceConfig := &config.ServiceConfig{}
	serviceConfig.Files.DatabaseFilename = "test.db"
	serviceConfig.Files.UploadsSubdir = "uploads"
	serviceConfig.Files.StoragePath = tempDir
	config.SetServiceConfigForTest(serviceConfig)

	// Initialize database
	db, err := storage.NewDB(tempDir)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	// Setup services
	dispatcher := events.NewDispatcher()
	spaceCache := cache.NewSpaceCache()
	spaceService := services.NewSpaceService(db, spaceCache, dispatcher)
	postService := services.NewPostService(db, spaceCache, dispatcher)
	fileService := services.NewFileService(db, dispatcher)

	// Initialize cache and create test space
	if err := spaceService.InitializeCache(); err != nil {
		t.Fatal(err)
	}

	if _, err := spaceService.Create("Test Space", nil, ""); err != nil {
		t.Fatal(err)
	}

	// Create a test post
	post, err := postService.Create(1, "Test post with attachments", nil)
	if err != nil {
		t.Fatal(err)
	}

	// Create a test image
	testImage := createTestImageData(200, 150)

	// Upload the image
	attachment, err := fileService.UploadFile(post.ID, bytes.NewReader(testImage), "test.jpg", int64(len(testImage)))
	if err != nil {
		t.Fatalf("Failed to upload file: %v", err)
	}

	// Verify attachment was created
	if attachment.ID == 0 {
		t.Error("Expected attachment to have an ID")
	}
	if attachment.PostID != post.ID {
		t.Errorf("Expected attachment post_id=%d, got %d", post.ID, attachment.PostID)
	}

	// Verify file exists on disk
	uploadedFilePath := filepath.Join(uploadsDir, attachment.FilePath)
	if _, err := os.Stat(uploadedFilePath); os.IsNotExist(err) {
		t.Errorf("Uploaded file does not exist: %s", uploadedFilePath)
	}

	t.Logf("Successfully uploaded attachment ID=%d for post ID=%d", attachment.ID, post.ID)
}

// Test on-demand preview generation for supported file types
func TestOnDemandPreviewGeneration(t *testing.T) {
	// Setup test environment
	tempDir, err := os.MkdirTemp("", "test-preview-demand-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	uploadsDir := filepath.Join(tempDir, "uploads")
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Create test options
	opts := config.NewTestOptionsConfig()
	dispatcher := events.NewDispatcher()
	previewService := NewService(uploadsDir, dispatcher, opts)

	// Create a test image file
	testImagePath := filepath.Join(uploadsDir, "test.jpg")
	testImage := createTestImageData(800, 600)
	if err := os.WriteFile(testImagePath, testImage, 0644); err != nil {
		t.Fatal(err)
	}

	// Test: Preview doesn't exist yet
	previewPath := previewService.GetPreviewPath("test.jpg", "large")
	if previewService.PreviewExists(previewPath) {
		t.Error("Preview should not exist before generation")
	}

	// Generate preview on-demand
	generatedPath, err := previewService.GeneratePreview(testImagePath, "test.jpg", "large")
	if err != nil {
		t.Fatalf("Failed to generate preview: %v", err)
	}

	// Verify preview was created
	if !previewService.PreviewExists(generatedPath) {
		t.Error("Preview should exist after generation")
	}

	// Verify preview file exists on disk
	fullPreviewPath := filepath.Join(uploadsDir, generatedPath)
	if _, err := os.Stat(fullPreviewPath); os.IsNotExist(err) {
		t.Errorf("Preview file does not exist: %s", fullPreviewPath)
	}

	// Test: Requesting preview again should return existing preview (no regeneration)
	generatedPath2, err := previewService.GeneratePreview(testImagePath, "test.jpg", "large")
	if err != nil {
		t.Fatalf("Failed to get existing preview: %v", err)
	}

	if generatedPath != generatedPath2 {
		t.Error("Should return same preview path for existing preview")
	}

	t.Log("Successfully tested on-demand preview generation")
}

// Test preview requests for unsupported file types
func TestPreviewRequestsUnsupportedFiles(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "test-unsupported-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	uploadsDir := filepath.Join(tempDir, "uploads")
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		t.Fatal(err)
	}

	opts := config.NewTestOptionsConfig()
	dispatcher := events.NewDispatcher()
	previewService := NewService(uploadsDir, dispatcher, opts)

	// Create an unsupported file (text file)
	testFilePath := filepath.Join(uploadsDir, "document.txt")
	if err := os.WriteFile(testFilePath, []byte("test content"), 0644); err != nil {
		t.Fatal(err)
	}

	// Check if preview is supported
	if previewService.IsPreviewSupported("document.txt") {
		t.Error("Text files should not be supported for preview")
	}

	// Try to generate preview (should fail gracefully)
	_, err = previewService.GeneratePreview(testFilePath, "document.txt", "large")
	if err == nil {
		t.Error("Expected error when generating preview for unsupported file")
	}

	// Verify no preview was created
	previewPath := previewService.GetPreviewPath("document.txt", "large")
	if previewService.PreviewExists(previewPath) {
		t.Error("Preview should not exist for unsupported file")
	}

	t.Log("Successfully tested unsupported file handling")
}

// Test HTTP endpoint for serving files with preview parameter
func TestServeFileWithPreviewParameter(t *testing.T) {
	// This test would require setting up the full HTTP handler
	// For now, we'll test the logic separately
	t.Skip("Full HTTP integration test - implement if needed")
}

// Test PDF preview generation
func TestPDFPreviewGeneration(t *testing.T) {
	t.Skip("Skipped: UniPDF requires a license for PDF creation in tests. PDF preview reading functionality is implemented and will work with real PDFs.")
}

// Test preview generation for all supported sizes
func TestPreviewAllSizes(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "test-all-sizes-*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	uploadsDir := filepath.Join(tempDir, "uploads")
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		t.Fatal(err)
	}

	opts := config.NewTestOptionsConfig()
	dispatcher := events.NewDispatcher()
	previewService := NewService(uploadsDir, dispatcher, opts)

	// Create a test image
	testImagePath := filepath.Join(uploadsDir, "test.jpg")
	testImage := createTestImageData(1000, 800)
	if err := os.WriteFile(testImagePath, testImage, 0644); err != nil {
		t.Fatal(err)
	}

	// Test all sizes
	sizes := []string{"large", "medium", "small"}
	for _, size := range sizes {
		previewPath, err := previewService.GeneratePreview(testImagePath, "test.jpg", size)
		if err != nil {
			t.Errorf("Failed to generate %s preview: %v", size, err)
			continue
		}

		if !previewService.PreviewExists(previewPath) {
			t.Errorf("Preview should exist for size %s", size)
		}

		t.Logf("Successfully generated %s preview", size)
	}
}

// Helper functions

func createTestImageData(width, height int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, width, height))

	// Fill with a gradient
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			c := color.RGBA{
				R: uint8((x * 255) / width),
				G: uint8((y * 255) / height),
				B: 128,
				A: 255,
			}
			img.Set(x, y, c)
		}
	}

	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 90}); err != nil {
		return nil
	}

	return buf.Bytes()
}


