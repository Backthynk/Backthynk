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
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/mux"
)

type postTestSetup struct {
	postHandler     *PostHandler
	categoryHandler *CategoryHandler
	postService     *services.PostService
	categoryService *services.CategoryService
	fileService     *services.FileService
	db              *storage.DB
	cache           *cache.CategoryCache
	dispatcher      *events.Dispatcher
	options         *config.OptionsConfig
	tempDir         string
}

func setupPostTest() (*postTestSetup, error) {
	// Initialize minimal service config for tests
	testConfig := &config.ServiceConfig{
		Files: struct {
			ConfigFilename   string `json:"configFilename"`
			DatabaseFilename string `json:"databaseFilename"`
			UploadsSubdir    string `json:"uploadsSubdir"`
			StoragePath      string `json:"storagePath"`
		}{
			DatabaseFilename: "test.db",
		},
	}
	config.SetServiceConfigForTest(testConfig)

	// Setup test database with temp directory for SQLite file
	tempDir, err := os.MkdirTemp("", "backthynk_post_test_*")
	if err != nil {
		return nil, err
	}

	db, err := storage.NewDB(tempDir)
	if err != nil {
		os.RemoveAll(tempDir)
		return nil, err
	}

	// The database is already initialized with tables in NewDB

	// Setup cache and dispatcher
	categoryCache := cache.NewCategoryCache()
	dispatcher := events.NewDispatcher()

	// Setup services
	categoryService := services.NewCategoryService(db, categoryCache, dispatcher)
	postService := services.NewPostService(db, categoryCache, dispatcher)
	fileService := services.NewFileService(db, dispatcher)

	// Initialize cache
	if err := categoryService.InitializeCache(); err != nil {
		return nil, err
	}

	// Setup test options
	options := &config.OptionsConfig{
		Core: struct {
			MaxContentLength          int  `json:"maxContentLength"`
			MaxFileSizeMB             int  `json:"maxFileSizeMB"`
			MaxFilesPerPost           int  `json:"maxFilesPerPost"`
			RetroactivePostingEnabled bool `json:"retroactivePostingEnabled"`
		}{
			MaxContentLength:          1000,
			MaxFileSizeMB:             10,
			MaxFilesPerPost:           5,
			RetroactivePostingEnabled: true,
		},
		Features: struct {
			Activity struct {
				Enabled      bool `json:"enabled"`
				PeriodMonths int  `json:"periodMonths"`
			} `json:"activity"`
			DetailedStats struct {
				Enabled        bool `json:"enabled"`
			} `json:"detailedStats"`
		}{
			Activity: struct {
				Enabled      bool `json:"enabled"`
				PeriodMonths int  `json:"periodMonths"`
			}{
				Enabled:      true,
				PeriodMonths: 4,
			},
			DetailedStats: struct {
				Enabled        bool `json:"enabled"`
			}{
				Enabled: true,
			},
		},
	}

	// Setup handlers
	postHandler := NewPostHandler(postService, fileService, options)
	categoryHandler := NewCategoryHandler(categoryService)

	return &postTestSetup{
		postHandler:     postHandler,
		categoryHandler: categoryHandler,
		postService:     postService,
		categoryService: categoryService,
		fileService:     fileService,
		db:              db,
		cache:           categoryCache,
		dispatcher:      dispatcher,
		options:         options,
		tempDir:         tempDir,
	}, nil
}

func (setup *postTestSetup) cleanup() {
	if setup.db != nil {
		setup.db.Close()
	}
	if setup.tempDir != "" {
		os.RemoveAll(setup.tempDir)
	}
}

func TestPostHandler_CreatePost(t *testing.T) {
	setup, err := setupPostTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test category
	category, err := setup.categoryService.Create("Test Category", nil, "Test desc")
	if err != nil {
		t.Fatalf("Failed to create test category: %v", err)
	}

	tests := []struct {
		name           string
		requestBody    interface{}
		expectedStatus int
		expectError    bool
	}{
		{
			name: "Valid post creation",
			requestBody: map[string]interface{}{
				"category_id": category.ID,
				"content":     "This is a test post",
			},
			expectedStatus: http.StatusCreated,
			expectError:    false,
		},
		{
			name: "Valid post with link previews",
			requestBody: map[string]interface{}{
				"category_id": category.ID,
				"content":     "Post with link preview",
				"link_previews": []map[string]interface{}{
					{
						"url":         "https://example.com",
						"title":       "Example Site",
						"description": "Example description",
						"site_name":   "Example",
					},
				},
			},
			expectedStatus: http.StatusCreated,
			expectError:    false,
		},
		{
			name: "Valid post with custom timestamp",
			requestBody: map[string]interface{}{
				"category_id":      category.ID,
				"content":          "Post with custom timestamp",
				"custom_timestamp": time.Date(2023, 1, 1, 12, 0, 0, 0, time.UTC).UnixMilli(),
			},
			expectedStatus: http.StatusCreated,
			expectError:    false,
		},
		{
			name: "Missing content",
			requestBody: map[string]interface{}{
				"category_id": category.ID,
			},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name: "Empty content",
			requestBody: map[string]interface{}{
				"category_id": category.ID,
				"content":     "",
			},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name: "Missing category_id",
			requestBody: map[string]interface{}{
				"content": "Test content",
			},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name: "Invalid category_id",
			requestBody: map[string]interface{}{
				"category_id": 999,
				"content":     "Test content",
			},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name: "Content too long",
			requestBody: map[string]interface{}{
				"category_id": category.ID,
				"content":     strings.Repeat("a", 1001), // Exceeds MaxContentLength
			},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name: "Invalid custom timestamp (too old)",
			requestBody: map[string]interface{}{
				"category_id":      category.ID,
				"content":          "Test content",
				"custom_timestamp": 946684799000, // Before year 2000
			},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name:           "Invalid JSON",
			requestBody:    "invalid json",
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var body []byte
			if str, ok := tt.requestBody.(string); ok {
				body = []byte(str)
			} else {
				body, _ = json.Marshal(tt.requestBody)
			}

			req := httptest.NewRequest("POST", "/api/posts", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			setup.postHandler.CreatePost(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if !tt.expectError && w.Code == http.StatusCreated {
				var createdPost models.Post
				if err := json.Unmarshal(w.Body.Bytes(), &createdPost); err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				if createdPost.ID == 0 {
					t.Error("Expected non-zero ID for created post")
				}

				if req, ok := tt.requestBody.(map[string]interface{}); ok {
					if content, exists := req["content"]; exists && createdPost.Content != content {
						t.Errorf("Expected content %s, got %s", content, createdPost.Content)
					}
				}
			}
		})
	}
}

func TestPostHandler_GetPost(t *testing.T) {
	setup, err := setupPostTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test data
	category, err := setup.categoryService.Create("Test Category", nil, "Test desc")
	if err != nil {
		t.Fatalf("Failed to create test category: %v", err)
	}
	post, _ := setup.postService.Create(category.ID, "Test post content", nil)

	tests := []struct {
		name           string
		postID         string
		expectedStatus int
		expectError    bool
	}{
		{
			name:           "Valid post ID",
			postID:         strconv.Itoa(post.ID),
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
		{
			name:           "Invalid post ID format",
			postID:         "invalid",
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name:           "Non-existent post ID",
			postID:         "999",
			expectedStatus: http.StatusNotFound,
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/posts/"+tt.postID, nil)
			req = mux.SetURLVars(req, map[string]string{"id": tt.postID})
			w := httptest.NewRecorder()

			setup.postHandler.GetPost(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if !tt.expectError {
				var returnedPost models.PostWithAttachments
				if err := json.Unmarshal(w.Body.Bytes(), &returnedPost); err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				if returnedPost.ID != post.ID {
					t.Errorf("Expected post ID %d, got %d", post.ID, returnedPost.ID)
				}
				if returnedPost.Content != post.Content {
					t.Errorf("Expected content %s, got %s", post.Content, returnedPost.Content)
				}
			}
		})
	}
}

func TestPostHandler_DeletePost(t *testing.T) {
	setup, err := setupPostTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test data
	category, err := setup.categoryService.Create("Test Category", nil, "Test desc")
	if err != nil {
		t.Fatalf("Failed to create test category: %v", err)
	}
	post, _ := setup.postService.Create(category.ID, "Test post content", nil)

	tests := []struct {
		name           string
		postID         string
		expectedStatus int
		expectError    bool
	}{
		{
			name:           "Valid post deletion",
			postID:         strconv.Itoa(post.ID),
			expectedStatus: http.StatusNoContent,
			expectError:    false,
		},
		{
			name:           "Invalid post ID format",
			postID:         "invalid",
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name:           "Non-existent post ID",
			postID:         "999",
			expectedStatus: http.StatusNotFound,
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("DELETE", "/api/posts/"+tt.postID, nil)
			req = mux.SetURLVars(req, map[string]string{"id": tt.postID})
			w := httptest.NewRecorder()

			setup.postHandler.DeletePost(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			// For successful deletions, verify the post is actually deleted
			if !tt.expectError && w.Code == http.StatusNoContent {
				req2 := httptest.NewRequest("GET", "/api/posts/"+tt.postID, nil)
				req2 = mux.SetURLVars(req2, map[string]string{"id": tt.postID})
				w2 := httptest.NewRecorder()
				setup.postHandler.GetPost(w2, req2)

				if w2.Code != http.StatusNotFound {
					t.Error("Expected post to be deleted, but it still exists")
				}
			}
		})
	}
}

func TestPostHandler_MovePost(t *testing.T) {
	setup, err := setupPostTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test data
	category1, _ := setup.categoryService.Create("Category 1", nil, "Category 1 desc")
	category2, _ := setup.categoryService.Create("Category 2", nil, "Category 2 desc")
	post, _ := setup.postService.Create(category1.ID, "Test post content", nil)

	tests := []struct {
		name           string
		postID         string
		requestBody    interface{}
		expectedStatus int
		expectError    bool
	}{
		{
			name:   "Valid post move",
			postID: strconv.Itoa(post.ID),
			requestBody: map[string]interface{}{
				"category_id": category2.ID,
			},
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
		{
			name:   "Invalid post ID format",
			postID: "invalid",
			requestBody: map[string]interface{}{
				"category_id": category2.ID,
			},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name:   "Non-existent post",
			postID: "999",
			requestBody: map[string]interface{}{
				"category_id": category2.ID,
			},
			expectedStatus: http.StatusInternalServerError,
			expectError:    true,
		},
		{
			name:   "Invalid category_id",
			postID: strconv.Itoa(post.ID),
			requestBody: map[string]interface{}{
				"category_id": 999,
			},
			expectedStatus: http.StatusInternalServerError,
			expectError:    true,
		},
		{
			name:   "Missing category_id",
			postID: strconv.Itoa(post.ID),
			requestBody: map[string]interface{}{},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name:           "Invalid JSON",
			postID:         strconv.Itoa(post.ID),
			requestBody:    "invalid json",
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var body []byte
			if str, ok := tt.requestBody.(string); ok {
				body = []byte(str)
			} else {
				body, _ = json.Marshal(tt.requestBody)
			}

			req := httptest.NewRequest("PUT", "/api/posts/"+tt.postID+"/move", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			req = mux.SetURLVars(req, map[string]string{"id": tt.postID})
			w := httptest.NewRecorder()

			setup.postHandler.MovePost(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if !tt.expectError && w.Code == http.StatusOK {
				var movedPost models.PostWithAttachments
				if err := json.Unmarshal(w.Body.Bytes(), &movedPost); err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				if req, ok := tt.requestBody.(map[string]interface{}); ok {
					if categoryID, exists := req["category_id"]; exists {
						var expectedID int
						switch v := categoryID.(type) {
						case int:
							expectedID = v
						case float64:
							expectedID = int(v)
						default:
							t.Errorf("Unexpected type for category_id: %T", v)
							return
						}
						if movedPost.CategoryID != expectedID {
							t.Errorf("Expected category ID %d, got %d", expectedID, movedPost.CategoryID)
						}
					}
				}
			}
		})
	}
}

func TestPostHandler_GetPostsByCategory(t *testing.T) {
	setup, err := setupPostTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test data
	parent, _ := setup.categoryService.Create("Parent Category", nil, "Parent desc")
	child, _ := setup.categoryService.Create("Child Category", &parent.ID, "Child desc")

	// Create posts
	setup.postService.Create(parent.ID, "Post in parent", nil)
	setup.postService.Create(child.ID, "Post in child", nil)
	setup.postService.Create(child.ID, "Another post in child", nil)

	tests := []struct {
		name           string
		categoryID     string
		queryParams    string
		expectedStatus int
		expectedCount  int
		expectError    bool
	}{
		{
			name:           "Get posts from parent category (non-recursive)",
			categoryID:     strconv.Itoa(parent.ID),
			queryParams:    "",
			expectedStatus: http.StatusOK,
			expectedCount:  1, // Only post1
			expectError:    false,
		},
		{
			name:           "Get posts from parent category (recursive)",
			categoryID:     strconv.Itoa(parent.ID),
			queryParams:    "?recursive=true",
			expectedStatus: http.StatusOK,
			expectedCount:  3, // post1, post2, post3
			expectError:    false,
		},
		{
			name:           "Get posts from child category",
			categoryID:     strconv.Itoa(child.ID),
			queryParams:    "",
			expectedStatus: http.StatusOK,
			expectedCount:  2, // post2, post3
			expectError:    false,
		},
		{
			name:           "Get all posts (category 0)",
			categoryID:     "0",
			queryParams:    "",
			expectedStatus: http.StatusOK,
			expectedCount:  3, // All posts
			expectError:    false,
		},
		{
			name:           "Get posts with metadata",
			categoryID:     strconv.Itoa(child.ID),
			queryParams:    "?with_meta=true",
			expectedStatus: http.StatusOK,
			expectedCount:  2,
			expectError:    false,
		},
		{
			name:           "Get posts with limit",
			categoryID:     strconv.Itoa(child.ID),
			queryParams:    "?limit=1",
			expectedStatus: http.StatusOK,
			expectedCount:  1,
			expectError:    false,
		},
		{
			name:           "Get posts with offset",
			categoryID:     strconv.Itoa(child.ID),
			queryParams:    "?limit=1&offset=1",
			expectedStatus: http.StatusOK,
			expectedCount:  1,
			expectError:    false,
		},
		{
			name:           "Invalid category ID format",
			categoryID:     "invalid",
			queryParams:    "",
			expectedStatus: http.StatusBadRequest,
			expectedCount:  0,
			expectError:    true,
		},
		{
			name:           "Non-existent category",
			categoryID:     "999",
			queryParams:    "",
			expectedStatus: http.StatusOK,
			expectedCount:  0,
			expectError:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := "/api/categories/" + tt.categoryID + "/posts" + tt.queryParams
			req := httptest.NewRequest("GET", url, nil)
			req = mux.SetURLVars(req, map[string]string{"id": tt.categoryID})
			w := httptest.NewRecorder()

			setup.postHandler.GetPostsByCategory(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if !tt.expectError {
				responseBody := w.Body.Bytes()

				// Check if response is metadata format or simple post array
				if strings.Contains(tt.queryParams, "with_meta=true") {
					var response map[string]interface{}
					if err := json.Unmarshal(responseBody, &response); err != nil {
						t.Fatalf("Failed to unmarshal metadata response: %v", err)
					}

					posts, ok := response["posts"].([]interface{})
					if !ok {
						t.Fatal("Expected posts array in metadata response")
					}

					if len(posts) != tt.expectedCount {
						t.Errorf("Expected %d posts, got %d", tt.expectedCount, len(posts))
					}

					// Verify metadata fields
					if _, hasTotal := response["total_count"]; !hasTotal {
						t.Error("Expected total_count in metadata response")
					}
					if _, hasOffset := response["offset"]; !hasOffset {
						t.Error("Expected offset in metadata response")
					}
					if _, hasLimit := response["limit"]; !hasLimit {
						t.Error("Expected limit in metadata response")
					}
				} else {
					var posts []models.PostWithAttachments
					if err := json.Unmarshal(responseBody, &posts); err != nil {
						t.Fatalf("Failed to unmarshal posts response: %v", err)
					}

					if len(posts) != tt.expectedCount {
						t.Errorf("Expected %d posts, got %d", tt.expectedCount, len(posts))
					}
				}
			}
		})
	}
}

func TestPostHandler_ConcurrentOperations(t *testing.T) {
	setup, err := setupPostTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test category
	category, err := setup.categoryService.Create("Test Category", nil, "Test desc")
	if err != nil {
		t.Fatalf("Failed to create test category: %v", err)
	}

	// Test concurrent post creation
	numGoroutines := 10
	done := make(chan error, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func(i int) {
			requestBody := map[string]interface{}{
				"category_id": category.ID,
				"content":     fmt.Sprintf("Concurrent post %d", i),
			}

			body, _ := json.Marshal(requestBody)
			req := httptest.NewRequest("POST", "/api/posts", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			setup.postHandler.CreatePost(w, req)

			if w.Code != http.StatusCreated {
				done <- fmt.Errorf("concurrent create failed with status %d", w.Code)
				return
			}
			done <- nil
		}(i)
	}

	// Wait for all goroutines
	for i := 0; i < numGoroutines; i++ {
		if err := <-done; err != nil {
			t.Errorf("Concurrent operation failed: %v", err)
		}
	}

	// Verify all posts were created
	req := httptest.NewRequest("GET", "/api/categories/"+strconv.Itoa(category.ID)+"/posts", nil)
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(category.ID)})
	w := httptest.NewRecorder()
	setup.postHandler.GetPostsByCategory(w, req)

	var posts []models.PostWithAttachments
	json.Unmarshal(w.Body.Bytes(), &posts)

	if len(posts) != numGoroutines {
		t.Errorf("Expected %d posts after concurrent creates, got %d", numGoroutines, len(posts))
	}
}

func TestPostHandler_DataConsistency(t *testing.T) {
	setup, err := setupPostTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test categories
	category1, _ := setup.categoryService.Create("Category 1", nil, "Category 1 desc")
	category2, _ := setup.categoryService.Create("Category 2", nil, "Category 2 desc")

	// Create posts
	post1, _ := setup.postService.Create(category1.ID, "Post 1", nil)
	post2, _ := setup.postService.Create(category1.ID, "Post 2", nil)
	post3, _ := setup.postService.Create(category2.ID, "Post 3", nil)

	// Test 1: Verify category post counts are updated correctly
	cat1, _ := setup.categoryService.Get(category1.ID)
	cat2, _ := setup.categoryService.Get(category2.ID)

	if cat1.PostCount != 2 {
		t.Errorf("Expected category 1 to have 2 posts, got %d", cat1.PostCount)
	}
	if cat2.PostCount != 1 {
		t.Errorf("Expected category 2 to have 1 post, got %d", cat2.PostCount)
	}

	// Test 2: Move post and verify counts
	requestBody := map[string]interface{}{
		"category_id": category2.ID,
	}
	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("PUT", "/api/posts/"+strconv.Itoa(post1.ID)+"/move", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(post1.ID)})
	w := httptest.NewRecorder()
	setup.postHandler.MovePost(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected successful move, got %d", w.Code)
	}

	// Verify updated counts
	cat1, _ = setup.categoryService.Get(category1.ID)
	cat2, _ = setup.categoryService.Get(category2.ID)

	if cat1.PostCount != 1 {
		t.Errorf("Expected category 1 to have 1 post after move, got %d", cat1.PostCount)
	}
	if cat2.PostCount != 2 {
		t.Errorf("Expected category 2 to have 2 posts after move, got %d", cat2.PostCount)
	}

	// Test 3: Delete post and verify counts
	req = httptest.NewRequest("DELETE", "/api/posts/"+strconv.Itoa(post2.ID), nil)
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(post2.ID)})
	w = httptest.NewRecorder()
	setup.postHandler.DeletePost(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("Expected successful deletion, got %d", w.Code)
	}

	// Verify updated count
	cat1, _ = setup.categoryService.Get(category1.ID)
	if cat1.PostCount != 0 {
		t.Errorf("Expected category 1 to have 0 posts after deletion, got %d", cat1.PostCount)
	}

	// Test 4: Verify post retrieval consistency
	req = httptest.NewRequest("GET", "/api/categories/"+strconv.Itoa(category2.ID)+"/posts", nil)
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(category2.ID)})
	w = httptest.NewRecorder()
	setup.postHandler.GetPostsByCategory(w, req)

	var posts []models.PostWithAttachments
	json.Unmarshal(w.Body.Bytes(), &posts)

	if len(posts) != 2 {
		t.Errorf("Expected 2 posts in category 2, got %d", len(posts))
	}

	// Verify specific posts exist
	foundIDs := make(map[int]bool)
	for _, post := range posts {
		foundIDs[post.ID] = true
	}

	if !foundIDs[post1.ID] {
		t.Error("Expected to find moved post1 in category 2")
	}
	if !foundIDs[post3.ID] {
		t.Error("Expected to find original post3 in category 2")
	}
}

func TestPostHandler_EventDispatchingWithFeatures(t *testing.T) {
	setup, err := setupPostTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Track dispatched events
	var dispatchedEvents []events.Event
	setup.dispatcher.Subscribe(events.PostCreated, func(event events.Event) error {
		dispatchedEvents = append(dispatchedEvents, event)
		return nil
	})
	setup.dispatcher.Subscribe(events.PostDeleted, func(event events.Event) error {
		dispatchedEvents = append(dispatchedEvents, event)
		return nil
	})
	setup.dispatcher.Subscribe(events.PostMoved, func(event events.Event) error {
		dispatchedEvents = append(dispatchedEvents, event)
		return nil
	})

	// Create test category
	category, err := setup.categoryService.Create("Test Category", nil, "Test desc")
	if err != nil {
		t.Fatalf("Failed to create test category: %v", err)
	}

	// Test post creation event
	requestBody := map[string]interface{}{
		"category_id": category.ID,
		"content":     "Test post for event",
	}
	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("POST", "/api/posts", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	setup.postHandler.CreatePost(w, req)

	if len(dispatchedEvents) != 1 || dispatchedEvents[0].Type != events.PostCreated {
		t.Error("Expected PostCreated event to be dispatched")
	}

	var createdPost models.Post
	json.Unmarshal(w.Body.Bytes(), &createdPost)

	// Test post deletion event
	req = httptest.NewRequest("DELETE", "/api/posts/"+strconv.Itoa(createdPost.ID), nil)
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(createdPost.ID)})
	w = httptest.NewRecorder()
	setup.postHandler.DeletePost(w, req)

	if len(dispatchedEvents) != 2 || dispatchedEvents[1].Type != events.PostDeleted {
		t.Error("Expected PostDeleted event to be dispatched")
	}
}