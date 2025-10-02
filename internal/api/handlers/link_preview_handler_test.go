package handlers

import (
	"backthynk/internal/config"
	"backthynk/internal/core/cache"
	"backthynk/internal/core/events"
	"backthynk/internal/core/services"
	"backthynk/internal/storage"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"testing"

	"github.com/gorilla/mux"
)

type linkPreviewTestSetup struct {
	postHandler         *PostHandler
	linkPreviewHandler  *LinkPreviewHandler
	postService         *services.PostService
	categoryService     *services.CategoryService
	fileService         *services.FileService
	db                  *storage.DB
	cache               *cache.CategoryCache
	dispatcher          *events.Dispatcher
	options             *config.OptionsConfig
	tempDir             string
}

func setupLinkPreviewTest() (*linkPreviewTestSetup, error) {
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
	tempDir, err := os.MkdirTemp("", "backthynk_link_preview_test_*")
	if err != nil {
		return nil, err
	}

	db, err := storage.NewDB(tempDir)
	if err != nil {
		os.RemoveAll(tempDir)
		return nil, err
	}

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
			MaxContentLength int `json:"maxContentLength"`
			MaxFileSizeMB    int `json:"maxFileSizeMB"`
			MaxFilesPerPost  int `json:"maxFilesPerPost"`
		}{
			MaxContentLength: 1000,
			MaxFileSizeMB:    10,
			MaxFilesPerPost:  5,
		},
		Features: struct {
			Activity struct {
				Enabled      bool `json:"enabled"`
				PeriodMonths int  `json:"periodMonths"`
			} `json:"activity"`
			DetailedStats struct {
				Enabled bool `json:"enabled"`
			} `json:"detailedStats"`
			RetroactivePosting struct {
				Enabled    bool   `json:"enabled"`
				TimeFormat string `json:"timeFormat"`
			} `json:"retroactivePosting"`
			Markdown struct {
				Enabled bool `json:"enabled"`
			} `json:"markdown"`
		}{
			Activity: struct {
				Enabled      bool `json:"enabled"`
				PeriodMonths int  `json:"periodMonths"`
			}{
				Enabled:      true,
				PeriodMonths: 4,
			},
			DetailedStats: struct {
				Enabled bool `json:"enabled"`
			}{
				Enabled: true,
			},
			RetroactivePosting: struct {
				Enabled    bool   `json:"enabled"`
				TimeFormat string `json:"timeFormat"`
			}{
				Enabled:    true,
				TimeFormat: "24h",
			},
			Markdown: struct {
				Enabled bool `json:"enabled"`
			}{
				Enabled: false,
			},
		},
	}

	// Setup handlers
	postHandler := NewPostHandler(postService, fileService, options)
	linkPreviewHandler := NewLinkPreviewHandler(fileService)

	return &linkPreviewTestSetup{
		postHandler:        postHandler,
		linkPreviewHandler: linkPreviewHandler,
		postService:        postService,
		categoryService:    categoryService,
		fileService:        fileService,
		db:                 db,
		cache:              categoryCache,
		dispatcher:         dispatcher,
		options:            options,
		tempDir:            tempDir,
	}, nil
}

func (setup *linkPreviewTestSetup) cleanup() {
	if setup.db != nil {
		setup.db.Close()
	}
	if setup.tempDir != "" {
		os.RemoveAll(setup.tempDir)
	}
}

func TestPostHandler_CreatePostWithLinkPreviews(t *testing.T) {
	setup, err := setupLinkPreviewTest()
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
		requestBody    map[string]interface{}
		expectedStatus int
		expectError    bool
		validateData   bool
	}{
		{
			name: "Valid post with single link preview",
			requestBody: map[string]interface{}{
				"category_id": category.ID,
				"content":     "Check out this link: https://example.com",
				"link_previews": []map[string]interface{}{
					{
						"url":         "https://example.com",
						"title":       "Example Website",
						"description": "This is an example website",
						"image_url":   "https://example.com/image.jpg",
						"site_name":   "Example.com",
					},
				},
			},
			expectedStatus: http.StatusCreated,
			expectError:    false,
			validateData:   true,
		},
		{
			name: "Valid post with multiple link previews",
			requestBody: map[string]interface{}{
				"category_id": category.ID,
				"content":     "Multiple links: https://example.com and https://test.com",
				"link_previews": []map[string]interface{}{
					{
						"url":         "https://example.com",
						"title":       "Example Website",
						"description": "This is an example website",
						"image_url":   "https://example.com/image.jpg",
						"site_name":   "Example.com",
					},
					{
						"url":         "https://test.com",
						"title":       "Test Website",
						"description": "This is a test website",
						"image_url":   "https://test.com/image.png",
						"site_name":   "Test.com",
					},
				},
			},
			expectedStatus: http.StatusCreated,
			expectError:    false,
			validateData:   true,
		},
		{
			name: "Valid post with link preview missing some fields",
			requestBody: map[string]interface{}{
				"category_id": category.ID,
				"content":     "Link with minimal data: https://minimal.com",
				"link_previews": []map[string]interface{}{
					{
						"url":   "https://minimal.com",
						"title": "Minimal Website",
						// description, image_url, site_name are missing
					},
				},
			},
			expectedStatus: http.StatusCreated,
			expectError:    false,
			validateData:   true,
		},
		{
			name: "Valid post with empty link previews array",
			requestBody: map[string]interface{}{
				"category_id":   category.ID,
				"content":       "Post without link previews",
				"link_previews": []map[string]interface{}{},
			},
			expectedStatus: http.StatusCreated,
			expectError:    false,
			validateData:   false,
		},
		{
			name: "Valid post without link_previews field",
			requestBody: map[string]interface{}{
				"category_id": category.ID,
				"content":     "Post without link_previews field",
			},
			expectedStatus: http.StatusCreated,
			expectError:    false,
			validateData:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.requestBody)
			req := httptest.NewRequest("POST", "/api/posts", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			setup.postHandler.CreatePost(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if !tt.expectError && w.Code == http.StatusCreated {
				var createdPost struct {
					ID         int    `json:"id"`
					CategoryID int    `json:"category_id"`
					Content    string `json:"content"`
					Created    int64  `json:"created"`
				}
				if err := json.Unmarshal(w.Body.Bytes(), &createdPost); err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				if createdPost.ID == 0 {
					t.Error("Expected non-zero ID for created post")
				}

				// Validate link preview data if expected
				if tt.validateData {
					// Retrieve the post with attachments to check link previews
					postWithAttachments, err := setup.fileService.GetPostWithAttachments(createdPost.ID)
					if err != nil {
						t.Fatalf("Failed to retrieve post with attachments: %v", err)
					}

					expectedLinkPreviews := tt.requestBody["link_previews"].([]map[string]interface{})
					actualLinkPreviews := postWithAttachments.LinkPreviews

					if len(actualLinkPreviews) != len(expectedLinkPreviews) {
						t.Errorf("Expected %d link previews, got %d", len(expectedLinkPreviews), len(actualLinkPreviews))
					}

					// Validate each link preview
					for i, expectedLP := range expectedLinkPreviews {
						if i >= len(actualLinkPreviews) {
							break
						}
						actualLP := actualLinkPreviews[i]

						if actualLP.URL != expectedLP["url"].(string) {
							t.Errorf("Expected URL %s, got %s", expectedLP["url"], actualLP.URL)
						}

						if expectedTitle, ok := expectedLP["title"].(string); ok {
							if actualLP.Title != expectedTitle {
								t.Errorf("Expected title %s, got %s", expectedTitle, actualLP.Title)
							}
						}

						if expectedDesc, ok := expectedLP["description"].(string); ok {
							if actualLP.Description != expectedDesc {
								t.Errorf("Expected description %s, got %s", expectedDesc, actualLP.Description)
							}
						}

						if expectedImage, ok := expectedLP["image_url"].(string); ok {
							if actualLP.ImageURL != expectedImage {
								t.Errorf("Expected image_url %s, got %s", expectedImage, actualLP.ImageURL)
							}
						}

						if expectedSite, ok := expectedLP["site_name"].(string); ok {
							if actualLP.SiteName != expectedSite {
								t.Errorf("Expected site_name %s, got %s", expectedSite, actualLP.SiteName)
							}
						}
					}
				}
			}
		})
	}
}

func TestLinkPreviewHandler_GetLinkPreviewsByPost(t *testing.T) {
	setup, err := setupLinkPreviewTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test category and post
	category, err := setup.categoryService.Create("Test Category", nil, "Test desc")
	if err != nil {
		t.Fatalf("Failed to create test category: %v", err)
	}

	// Create post with link previews using the post handler
	requestBody := map[string]interface{}{
		"category_id": category.ID,
		"content":     "Test post with link previews",
		"link_previews": []map[string]interface{}{
			{
				"url":         "https://example.com",
				"title":       "Example Website",
				"description": "This is an example website",
				"image_url":   "https://example.com/image.jpg",
				"site_name":   "Example.com",
			},
			{
				"url":         "https://test.com",
				"title":       "Test Website",
				"description": "This is a test website",
				"image_url":   "https://test.com/image.png",
				"site_name":   "Test.com",
			},
		},
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("POST", "/api/posts", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	setup.postHandler.CreatePost(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("Failed to create test post: %d", w.Code)
	}

	var createdPost struct {
		ID int `json:"id"`
	}
	json.Unmarshal(w.Body.Bytes(), &createdPost)

	tests := []struct {
		name           string
		postID         string
		expectedStatus int
		expectedCount  int
		expectError    bool
	}{
		{
			name:           "Valid post ID with link previews",
			postID:         strconv.Itoa(createdPost.ID),
			expectedStatus: http.StatusOK,
			expectedCount:  2,
			expectError:    false,
		},
		{
			name:           "Invalid post ID format",
			postID:         "invalid",
			expectedStatus: http.StatusBadRequest,
			expectedCount:  0,
			expectError:    true,
		},
		{
			name:           "Non-existent post ID",
			postID:         "999",
			expectedStatus: http.StatusNotFound,
			expectedCount:  0,
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/posts/"+tt.postID+"/link-previews", nil)
			req = mux.SetURLVars(req, map[string]string{"id": tt.postID})
			w := httptest.NewRecorder()

			setup.linkPreviewHandler.GetLinkPreviewsByPost(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if !tt.expectError && w.Code == http.StatusOK {
				var linkPreviews []map[string]interface{}
				if err := json.Unmarshal(w.Body.Bytes(), &linkPreviews); err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				if len(linkPreviews) != tt.expectedCount {
					t.Errorf("Expected %d link previews, got %d", tt.expectedCount, len(linkPreviews))
				}

				// Validate that the link previews contain the expected data
				if len(linkPreviews) > 0 {
					firstPreview := linkPreviews[0]
					if url, ok := firstPreview["url"].(string); !ok || url == "" {
						t.Error("Expected non-empty URL in link preview")
					}
					if title, ok := firstPreview["title"].(string); !ok || title == "" {
						t.Error("Expected non-empty title in link preview")
					}
				}
			}
		})
	}
}

func TestLinkPreviewHandler_FetchLinkPreview(t *testing.T) {
	tests := []struct {
		name           string
		requestBody    map[string]interface{}
		expectedStatus int
		expectError    bool
	}{
		{
			name: "Valid URL",
			requestBody: map[string]interface{}{
				"url": "https://example.com",
			},
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
		{
			name: "Invalid URL",
			requestBody: map[string]interface{}{
				"url": "not-a-url",
			},
			expectedStatus: http.StatusOK, // Returns JSON with error field
			expectError:    true,
		},
		{
			name: "Missing URL",
			requestBody: map[string]interface{}{
				"other_field": "value",
			},
			expectedStatus: http.StatusOK, // URL will be empty string, which is invalid
			expectError:    true,
		},
		{
			name:           "Invalid JSON",
			requestBody:    nil, // Will cause JSON decode error
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var body []byte
			var err error

			if tt.requestBody != nil {
				body, err = json.Marshal(tt.requestBody)
				if err != nil {
					t.Fatalf("Failed to marshal request body: %v", err)
				}
			} else {
				body = []byte("invalid json")
			}

			req := httptest.NewRequest("POST", "/api/link-preview", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			FetchLinkPreview(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if w.Code == http.StatusOK {
				var response LinkPreviewResponse
				if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				if tt.expectError {
					if response.Error == "" {
						t.Error("Expected error in response, but got none")
					}
				} else {
					if response.Error != "" {
						t.Errorf("Expected no error, but got: %s", response.Error)
					}
					if response.URL == "" {
						t.Error("Expected non-empty URL in response")
					}
				}
			}
		})
	}
}