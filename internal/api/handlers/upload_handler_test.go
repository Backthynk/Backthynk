package handlers

import (
	"backthynk/internal/config"
	"backthynk/internal/core/cache"
	"backthynk/internal/core/events"
	"backthynk/internal/core/models"
	"backthynk/internal/core/services"
	"backthynk/internal/storage"
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"testing"

	"github.com/gorilla/mux"
)

type uploadTestSetup struct {
	handler        *UploadHandler
	fileService    *services.FileService
	postService    *services.PostService
	db             *storage.DB
	dispatcher     *events.Dispatcher
	spaceCache  *cache.SpaceCache
	options        *config.OptionsConfig
	tempDir        string
	uploadsDir     string
}

func setupUploadTest(t *testing.T) (*uploadTestSetup, func()) {
	// Create temp database directory
	tempDir, err := os.MkdirTemp("", "test-upload-*")
	if err != nil {
		t.Fatal(err)
	}

	// Create temp uploads directory
	uploadsDir, err := os.MkdirTemp("", "test-uploads-*")
	if err != nil {
		os.RemoveAll(tempDir)
		t.Fatal(err)
	}

	// Set service config for tests
	serviceConfig := &config.ServiceConfig{
		Files: struct {
			ConfigFilename   string `json:"configFilename"`
			DatabaseFilename string `json:"databaseFilename"`
			UploadsSubdir    string `json:"uploadsSubdir"`
			StoragePath      string `json:"storagePath"`
		}{
			DatabaseFilename: "test.db",
			UploadsSubdir:    filepath.Base(uploadsDir),
			StoragePath:      filepath.Dir(uploadsDir), // Set parent directory so files are created in temp dir
		},
	}
	config.SetServiceConfigForTest(serviceConfig)

	// Initialize database
	db, err := storage.NewDB(tempDir)
	if err != nil {
		os.RemoveAll(tempDir)
		os.RemoveAll(uploadsDir)
		t.Fatal(err)
	}

	// Setup cache and dispatcher
	spaceCache := cache.NewSpaceCache()
	dispatcher := events.NewDispatcher()

	// Create services
	fileService := services.NewFileService(db, dispatcher)
	postService := services.NewPostService(db, spaceCache, dispatcher)
	spaceService := services.NewSpaceService(db, spaceCache, dispatcher)

	// Initialize cache
	if err := spaceService.InitializeCache(); err != nil {
		t.Fatal(err)
	}

	// Create a test space
	if _, err := spaceService.Create("Test Space", nil, ""); err != nil {
		t.Fatal(err)
	}

	// Create test options with default settings
	options := config.NewTestOptionsConfig()

	// Create handler
	handler := NewUploadHandler(fileService, options)

	setup := &uploadTestSetup{
		handler:       handler,
		fileService:   fileService,
		postService:   postService,
		db:            db,
		dispatcher:    dispatcher,
		spaceCache: spaceCache,
		options:       options,
		tempDir:       tempDir,
		uploadsDir:    uploadsDir,
	}

	// Cleanup function
	cleanup := func() {
		db.Close()
		os.RemoveAll(tempDir)
		os.RemoveAll(uploadsDir)
	}

	return setup, cleanup
}

func createMultipartRequest(t *testing.T, postID string, filename string, content []byte) (*http.Request, *bytes.Buffer) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add post_id field
	if err := writer.WriteField("post_id", postID); err != nil {
		t.Fatal(err)
	}

	// Add file field
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(content); err != nil {
		t.Fatal(err)
	}

	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest("POST", "/api/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	return req, body
}

func TestUploadFile_Success(t *testing.T) {
	setup, cleanup := setupUploadTest(t)
	defer cleanup()

	// Create a test post
	post, err := setup.postService.Create(1, "Test post", nil)
	if err != nil {
		t.Fatal(err)
	}

	// Create upload request
	fileContent := []byte("test image content")
	req, _ := createMultipartRequest(t, strconv.Itoa(post.ID), "test.jpg", fileContent)

	// Execute request
	rr := httptest.NewRecorder()
	setup.handler.UploadFile(rr, req)

	// Check response
	if status := rr.Code; status != http.StatusCreated {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusCreated, status, rr.Body.String())
	}
}

func TestUploadFile_DisabledFeature(t *testing.T) {
	setup, cleanup := setupUploadTest(t)
	defer cleanup()

	// Disable file upload
	setup.handler.options = config.NewTestOptionsConfig().WithFileUploadEnabled(false)

	// Create a test post
	postService := setup.postService
	post, err := postService.Create(1, "Test post", nil)
	if err != nil {
		t.Fatal(err)
	}

	// Create upload request
	fileContent := []byte("test image content")
	req, _ := createMultipartRequest(t, strconv.Itoa(post.ID), "test.jpg", fileContent)

	// Execute request
	rr := httptest.NewRecorder()
	setup.handler.UploadFile(rr, req)

	// Check response - should be forbidden
	if status := rr.Code; status != http.StatusForbidden {
		t.Errorf("Expected status %d (Forbidden), got %d. Body: %s", http.StatusForbidden, status, rr.Body.String())
	}

	// Verify error message
	expectedMsg := "File upload is disabled"
	if body := rr.Body.String(); body != expectedMsg+"\n" {
		t.Errorf("Expected error message '%s', got '%s'", expectedMsg, body)
	}
}

func TestUploadFile_DisallowedExtension(t *testing.T) {
	setup, cleanup := setupUploadTest(t)
	defer cleanup()

	// Set allowed extensions to only jpg and png
	setup.handler.options = config.NewTestOptionsConfig().WithAllowedExtensions([]string{"jpg", "png"})

	// Create a test post
	postService := setup.postService
	post, err := postService.Create(1, "Test post", nil)
	if err != nil {
		t.Fatal(err)
	}

	// Try to upload a .exe file
	fileContent := []byte("malicious content")
	req, _ := createMultipartRequest(t, strconv.Itoa(post.ID), "malware.exe", fileContent)

	// Execute request
	rr := httptest.NewRecorder()
	setup.handler.UploadFile(rr, req)

	// Check response - should be bad request
	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("Expected status %d (Bad Request), got %d. Body: %s", http.StatusBadRequest, status, rr.Body.String())
	}

	// Verify error message contains extension info
	body := rr.Body.String()
	if !contains(body, "extension") && !contains(body, "not allowed") {
		t.Errorf("Expected error message about extension, got: %s", body)
	}
}

func TestUploadFile_AllowedExtension(t *testing.T) {
	setup, cleanup := setupUploadTest(t)
	defer cleanup()

	// Set allowed extensions
	setup.handler.options = config.NewTestOptionsConfig().WithAllowedExtensions([]string{"jpg", "png", "pdf"})

	// Create a test post
	postService := setup.postService
	post, err := postService.Create(1, "Test post", nil)
	if err != nil {
		t.Fatal(err)
	}

	// Test each allowed extension
	allowedFiles := []string{"image.jpg", "photo.png", "document.pdf"}
	for _, filename := range allowedFiles {
		fileContent := []byte("test content")
		req, _ := createMultipartRequest(t, strconv.Itoa(post.ID), filename, fileContent)

		rr := httptest.NewRecorder()
		setup.handler.UploadFile(rr, req)

		if status := rr.Code; status != http.StatusCreated {
			t.Errorf("File %s: Expected status %d, got %d. Body: %s", filename, http.StatusCreated, status, rr.Body.String())
		}
	}
}

func TestUploadFile_ExceedsMaxSize(t *testing.T) {
	setup, cleanup := setupUploadTest(t)
	defer cleanup()

	// Set max file size to 1MB
	setup.handler.options = config.NewTestOptionsConfig().WithMaxFileSizeMB(1)

	// Create a test post
	postService := setup.postService
	post, err := postService.Create(1, "Test post", nil)
	if err != nil {
		t.Fatal(err)
	}

	// Create a file larger than 1MB (2MB)
	largeContent := make([]byte, 2*1024*1024)
	req, _ := createMultipartRequest(t, strconv.Itoa(post.ID), "large.jpg", largeContent)

	// Execute request
	rr := httptest.NewRecorder()
	setup.handler.UploadFile(rr, req)

	// Check response - should be bad request
	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("Expected status %d (Bad Request), got %d. Body: %s", http.StatusBadRequest, status, rr.Body.String())
	}

	// Verify error message mentions size
	body := rr.Body.String()
	if !contains(body, "size") && !contains(body, "exceeds") {
		t.Errorf("Expected error message about file size, got: %s", body)
	}
}

func TestUploadFile_WithinMaxSize(t *testing.T) {
	setup, cleanup := setupUploadTest(t)
	defer cleanup()

	// Set max file size to 5MB
	setup.handler.options = config.NewTestOptionsConfig().WithMaxFileSizeMB(5)

	// Create a test post
	postService := setup.postService
	post, err := postService.Create(1, "Test post", nil)
	if err != nil {
		t.Fatal(err)
	}

	// Create a file smaller than 5MB (1MB)
	content := make([]byte, 1*1024*1024)
	req, _ := createMultipartRequest(t, strconv.Itoa(post.ID), "medium.jpg", content)

	// Execute request
	rr := httptest.NewRecorder()
	setup.handler.UploadFile(rr, req)

	// Check response - should succeed
	if status := rr.Code; status != http.StatusCreated {
		t.Errorf("Expected status %d, got %d. Body: %s", http.StatusCreated, status, rr.Body.String())
	}
}

func TestUploadFile_InvalidPostID(t *testing.T) {
	setup, cleanup := setupUploadTest(t)
	defer cleanup()

	// Create upload request with invalid post ID
	fileContent := []byte("test content")
	req, _ := createMultipartRequest(t, "invalid", "test.jpg", fileContent)

	// Execute request
	rr := httptest.NewRecorder()
	setup.handler.UploadFile(rr, req)

	// Check response - should be bad request
	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("Expected status %d (Bad Request), got %d", http.StatusBadRequest, status)
	}
}

func TestUploadFile_MissingPostID(t *testing.T) {
	setup, cleanup := setupUploadTest(t)
	defer cleanup()

	// Create multipart request without post_id
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, _ := writer.CreateFormFile("file", "test.jpg")
	part.Write([]byte("test content"))
	writer.Close()

	req := httptest.NewRequest("POST", "/api/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	// Execute request
	rr := httptest.NewRecorder()
	setup.handler.UploadFile(rr, req)

	// Check response - should be bad request
	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("Expected status %d (Bad Request), got %d", http.StatusBadRequest, status)
	}
}

func TestUploadFile_MissingFile(t *testing.T) {
	setup, cleanup := setupUploadTest(t)
	defer cleanup()

	// Create a test post
	postService := setup.postService
	post, err := postService.Create(1, "Test post", nil)
	if err != nil {
		t.Fatal(err)
	}

	// Create multipart request without file
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	writer.WriteField("post_id", strconv.Itoa(post.ID))
	writer.Close()

	req := httptest.NewRequest("POST", "/api/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	// Execute request
	rr := httptest.NewRecorder()
	setup.handler.UploadFile(rr, req)

	// Check response - should be bad request
	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("Expected status %d (Bad Request), got %d", http.StatusBadRequest, status)
	}
}

func TestServeFile_Success(t *testing.T) {
	setup, cleanup := setupUploadTest(t)
	defer cleanup()

	// Create a test post
	postService := setup.postService
	post, err := postService.Create(1, "Test post", nil)
	if err != nil {
		t.Fatal(err)
	}

	// Upload a file first
	fileContent := []byte("test file content")
	uploadReq, _ := createMultipartRequest(t, strconv.Itoa(post.ID), "test.jpg", fileContent)
	uploadRR := httptest.NewRecorder()
	setup.handler.UploadFile(uploadRR, uploadReq)

	if uploadRR.Code != http.StatusCreated {
		t.Fatal("Failed to upload test file")
	}

	// Parse the response to get the filename
	var attachment models.Attachment
	if err := parseJSON(uploadRR.Body, &attachment); err != nil {
		t.Fatal(err)
	}

	// Now try to serve the file
	req := httptest.NewRequest("GET", "/uploads/"+attachment.FilePath, nil)
	req = mux.SetURLVars(req, map[string]string{"filename": attachment.FilePath})

	rr := httptest.NewRecorder()
	setup.handler.ServeFile(rr, req)

	// Check response
	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, status)
	}

	// Verify content
	served, _ := io.ReadAll(rr.Body)
	if !bytes.Equal(served, fileContent) {
		t.Errorf("Served content doesn't match uploaded content")
	}
}

func TestIsExtensionAllowed(t *testing.T) {
	setup, cleanup := setupUploadTest(t)
	defer cleanup()

	// Set specific allowed extensions
	setup.handler.options = config.NewTestOptionsConfig().WithAllowedExtensions([]string{"jpg", "png", "pdf"})

	tests := []struct {
		ext      string
		expected bool
	}{
		{"jpg", true},
		{"png", true},
		{"pdf", true},
		{"JPG", false}, // Case sensitive
		{"exe", false},
		{"doc", false},
		{"", false},
	}

	for _, tt := range tests {
		result := setup.handler.isExtensionAllowed(tt.ext)
		if result != tt.expected {
			t.Errorf("Extension '%s': expected %v, got %v", tt.ext, tt.expected, result)
		}
	}
}

// Helper functions

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > len(substr) && (s[:len(substr)] == substr || s[len(s)-len(substr):] == substr || findSubstring(s, substr)))
}

func findSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func parseJSON(body io.Reader, v interface{}) error {
	data, err := io.ReadAll(body)
	if err != nil {
		return err
	}
	return json.Unmarshal(data, v)
}
