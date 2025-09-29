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
	"testing"

	"github.com/gorilla/mux"
	_ "github.com/mattn/go-sqlite3"
)

type categoryTestSetup struct {
	handler     *CategoryHandler
	service     *services.CategoryService
	db          *storage.DB
	cache       *cache.CategoryCache
	dispatcher  *events.Dispatcher
}

func setupCategoryTest() (*categoryTestSetup, error) {
	// Create a temporary directory for the test
	tempDir := "/tmp/backthynk_test_" + fmt.Sprintf("%d", os.Getpid())
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		return nil, err
	}

	// Initialize test config files
	serviceConfigContent := `{
		"server": {"port": "8080"},
		"files": {
			"configFilename": "options.json",
			"databaseFilename": "test.db",
			"uploadsSubdir": "uploads",
			"storagePath": "` + tempDir + `"
		}
	}`

	if err := os.WriteFile(tempDir+"/service.json", []byte(serviceConfigContent), 0644); err != nil {
		return nil, err
	}

	// Change to temp directory and load config
	originalDir, _ := os.Getwd()
	os.Chdir(tempDir)
	defer os.Chdir(originalDir)

	// Load config
	if err := config.LoadServiceConfig(); err != nil {
		return nil, err
	}

	// Setup test database
	db, err := storage.NewDB(tempDir)
	if err != nil {
		return nil, err
	}

	// Setup cache and dispatcher
	categoryCache := cache.NewCategoryCache()
	dispatcher := events.NewDispatcher()

	// Setup service
	categoryService := services.NewCategoryService(db, categoryCache, dispatcher)

	// Initialize cache
	if err := categoryService.InitializeCache(); err != nil {
		return nil, err
	}

	// Setup handler
	handler := NewCategoryHandler(categoryService)

	return &categoryTestSetup{
		handler:    handler,
		service:    categoryService,
		db:         db,
		cache:      categoryCache,
		dispatcher: dispatcher,
	}, nil
}

func (setup *categoryTestSetup) cleanup() {
	if setup.db != nil {
		setup.db.Close()
	}
	// Clean up test directory
	tempDir := "/tmp/backthynk_test_" + fmt.Sprintf("%d", os.Getpid())
	os.RemoveAll(tempDir)
}

func TestCategoryHandler_GetCategories(t *testing.T) {
	setup, err := setupCategoryTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test categories
	cat1, _ := setup.service.Create("Category 1", nil, "Description 1")
	setup.service.Create("Category 2", nil, "Description 2")
	setup.service.Create("Subcategory", &cat1.ID, "Subcategory desc")

	req := httptest.NewRequest("GET", "/api/categories", nil)
	w := httptest.NewRecorder()

	setup.handler.GetCategories(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var categories []*models.Category
	if err := json.Unmarshal(w.Body.Bytes(), &categories); err != nil {
		t.Fatalf("Failed to unmarshal response: %v", err)
	}

	if len(categories) != 3 {
		t.Errorf("Expected 3 categories, got %d", len(categories))
	}

	// Verify content-type
	if w.Header().Get("Content-Type") != "application/json" {
		t.Errorf("Expected application/json content type")
	}

	// Verify categories are returned with proper structure
	foundNames := make(map[string]bool)
	for _, cat := range categories {
		foundNames[cat.Name] = true
		if cat.Name == "Category 1" && cat.ParentID != nil {
			t.Errorf("Category 1 should have nil parent")
		}
		if cat.Name == "Subcategory" && (cat.ParentID == nil || *cat.ParentID != cat1.ID) {
			t.Errorf("Subcategory should have Category 1 as parent")
		}
	}

	expectedNames := []string{"Category 1", "Category 2", "Subcategory"}
	for _, name := range expectedNames {
		if !foundNames[name] {
			t.Errorf("Expected to find category: %s", name)
		}
	}
}

func TestCategoryHandler_GetCategory(t *testing.T) {
	setup, err := setupCategoryTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test category
	cat, _ := setup.service.Create("Test Category", nil, "Test Description")

	tests := []struct {
		name           string
		categoryID     string
		expectedStatus int
		expectError    bool
	}{
		{
			name:           "Valid category ID",
			categoryID:     strconv.Itoa(cat.ID),
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
		{
			name:           "Invalid category ID format",
			categoryID:     "invalid",
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name:           "Non-existent category ID",
			categoryID:     "999",
			expectedStatus: http.StatusNotFound,
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/categories/"+tt.categoryID, nil)
			w := httptest.NewRecorder()

			// Setup mux vars
			req = mux.SetURLVars(req, map[string]string{"id": tt.categoryID})

			setup.handler.GetCategory(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if !tt.expectError {
				var returnedCat models.Category
				if err := json.Unmarshal(w.Body.Bytes(), &returnedCat); err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				if returnedCat.ID != cat.ID {
					t.Errorf("Expected category ID %d, got %d", cat.ID, returnedCat.ID)
				}
				if returnedCat.Name != cat.Name {
					t.Errorf("Expected category name %s, got %s", cat.Name, returnedCat.Name)
				}
			}
		})
	}
}

func TestCategoryHandler_GetCategoriesByParent(t *testing.T) {
	setup, err := setupCategoryTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test categories
	parent1, _ := setup.service.Create("Parent 1", nil, "Parent 1 desc")
	parent2, _ := setup.service.Create("Parent 2", nil, "Parent 2 desc")
	setup.service.Create("Child 1", &parent1.ID, "Child 1 desc")
	setup.service.Create("Child 2", &parent1.ID, "Child 2 desc")
	setup.service.Create("Child 3", &parent2.ID, "Child 3 desc")

	tests := []struct {
		name           string
		parentID       string
		expectedCount  int
		expectedStatus int
		expectError    bool
	}{
		{
			name:           "Get root categories (no parent_id)",
			parentID:       "",
			expectedCount:  2, // parent1 and parent2
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
		{
			name:           "Get children of parent1",
			parentID:       strconv.Itoa(parent1.ID),
			expectedCount:  2, // child1 and child2
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
		{
			name:           "Get children of parent2",
			parentID:       strconv.Itoa(parent2.ID),
			expectedCount:  1, // child3
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
		{
			name:           "Invalid parent_id format",
			parentID:       "invalid",
			expectedCount:  0,
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name:           "Non-existent parent",
			parentID:       "999",
			expectedCount:  0,
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			url := "/api/categories/by-parent"
			if tt.parentID != "" {
				url += "?parent_id=" + tt.parentID
			}

			req := httptest.NewRequest("GET", url, nil)
			w := httptest.NewRecorder()

			setup.handler.GetCategoriesByParent(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if !tt.expectError {
				var categories []*models.Category
				if err := json.Unmarshal(w.Body.Bytes(), &categories); err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				if len(categories) != tt.expectedCount {
					t.Errorf("Expected %d categories, got %d", tt.expectedCount, len(categories))
				}
			}
		})
	}
}

func TestCategoryHandler_CreateCategory(t *testing.T) {
	setup, err := setupCategoryTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create a parent category for testing
	parent, _ := setup.service.Create("Parent Category", nil, "Parent desc")

	tests := []struct {
		name           string
		requestBody    interface{}
		expectedStatus int
		expectError    bool
	}{
		{
			name: "Valid category creation",
			requestBody: map[string]interface{}{
				"name":        "Test Category",
				"description": "Test Description",
			},
			expectedStatus: http.StatusCreated,
			expectError:    false,
		},
		{
			name: "Valid category with parent",
			requestBody: map[string]interface{}{
				"name":        "Child Category",
				"description": "Child Description",
				"parent_id":   parent.ID,
			},
			expectedStatus: http.StatusCreated,
			expectError:    false,
		},
		{
			name: "Missing name",
			requestBody: map[string]interface{}{
				"description": "Test Description",
			},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name: "Empty name",
			requestBody: map[string]interface{}{
				"name":        "",
				"description": "Test Description",
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

			req := httptest.NewRequest("POST", "/api/categories", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			setup.handler.CreateCategory(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if !tt.expectError && w.Code == http.StatusCreated {
				var createdCat models.Category
				if err := json.Unmarshal(w.Body.Bytes(), &createdCat); err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				if req, ok := tt.requestBody.(map[string]interface{}); ok {
					if name, exists := req["name"]; exists && createdCat.Name != name {
						t.Errorf("Expected name %s, got %s", name, createdCat.Name)
					}
					if desc, exists := req["description"]; exists && createdCat.Description != desc {
						t.Errorf("Expected description %s, got %s", desc, createdCat.Description)
					}
				}

				if createdCat.ID == 0 {
					t.Error("Expected non-zero ID for created category")
				}
			}
		})
	}
}

func TestCategoryHandler_UpdateCategory(t *testing.T) {
	setup, err := setupCategoryTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test categories
	cat, _ := setup.service.Create("Original Category", nil, "Original desc")
	parent, _ := setup.service.Create("Parent Category", nil, "Parent desc")

	tests := []struct {
		name           string
		categoryID     string
		requestBody    interface{}
		expectedStatus int
		expectError    bool
	}{
		{
			name:       "Valid update",
			categoryID: strconv.Itoa(cat.ID),
			requestBody: map[string]interface{}{
				"name":        "Updated Category",
				"description": "Updated Description",
			},
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
		{
			name:       "Update with parent",
			categoryID: strconv.Itoa(cat.ID),
			requestBody: map[string]interface{}{
				"name":        "Updated with Parent",
				"description": "Updated Description",
				"parent_id":   parent.ID,
			},
			expectedStatus: http.StatusOK,
			expectError:    false,
		},
		{
			name:       "Invalid category ID",
			categoryID: "invalid",
			requestBody: map[string]interface{}{
				"name":        "Updated Category",
				"description": "Updated Description",
			},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name:       "Non-existent category",
			categoryID: "999",
			requestBody: map[string]interface{}{
				"name":        "Updated Category",
				"description": "Updated Description",
			},
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name:       "Empty name",
			categoryID: strconv.Itoa(cat.ID),
			requestBody: map[string]interface{}{
				"name":        "",
				"description": "Updated Description",
			},
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

			req := httptest.NewRequest("PUT", "/api/categories/"+tt.categoryID, bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			req = mux.SetURLVars(req, map[string]string{"id": tt.categoryID})
			w := httptest.NewRecorder()

			setup.handler.UpdateCategory(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			if !tt.expectError && w.Code == http.StatusOK {
				var updatedCat models.Category
				if err := json.Unmarshal(w.Body.Bytes(), &updatedCat); err != nil {
					t.Fatalf("Failed to unmarshal response: %v", err)
				}

				if req, ok := tt.requestBody.(map[string]interface{}); ok {
					if name, exists := req["name"]; exists && updatedCat.Name != name {
						t.Errorf("Expected name %s, got %s", name, updatedCat.Name)
					}
				}
			}
		})
	}
}

func TestCategoryHandler_DeleteCategory(t *testing.T) {
	setup, err := setupCategoryTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create test categories
	parent, _ := setup.service.Create("Parent Category", nil, "Parent desc")
	setup.service.Create("Child Category", &parent.ID, "Child desc")

	tests := []struct {
		name           string
		categoryID     string
		expectedStatus int
		expectError    bool
	}{
		{
			name:           "Delete parent category (should cascade)",
			categoryID:     strconv.Itoa(parent.ID),
			expectedStatus: http.StatusNoContent,
			expectError:    false,
		},
		{
			name:           "Invalid category ID",
			categoryID:     "invalid",
			expectedStatus: http.StatusBadRequest,
			expectError:    true,
		},
		{
			name:           "Non-existent category",
			categoryID:     "999",
			expectedStatus: http.StatusNotFound,
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("DELETE", "/api/categories/"+tt.categoryID, nil)
			req = mux.SetURLVars(req, map[string]string{"id": tt.categoryID})
			w := httptest.NewRecorder()

			setup.handler.DeleteCategory(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, w.Code)
			}

			// For successful deletions, verify the category is actually deleted
			if !tt.expectError && w.Code == http.StatusNoContent {
				id, _ := strconv.Atoi(tt.categoryID)
				_, err := setup.service.Get(id)
				if err == nil {
					t.Error("Expected category to be deleted, but it still exists")
				}
			}
		})
	}
}

func TestCategoryHandler_CircularReferenceProtection(t *testing.T) {
	setup, err := setupCategoryTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create a chain of categories
	cat1, _ := setup.service.Create("Category 1", nil, "Cat 1")
	cat2, _ := setup.service.Create("Category 2", &cat1.ID, "Cat 2")
	cat3, _ := setup.service.Create("Category 3", &cat2.ID, "Cat 3")

	// Try to create a circular reference: cat1 -> cat3 (which would create cat1 -> cat3 -> cat2 -> cat1)
	requestBody := map[string]interface{}{
		"name":        "Category 1 Updated",
		"description": "Updated",
		"parent_id":   cat3.ID,
	}

	body, _ := json.Marshal(requestBody)
	req := httptest.NewRequest("PUT", "/api/categories/"+strconv.Itoa(cat1.ID), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(cat1.ID)})
	w := httptest.NewRecorder()

	setup.handler.UpdateCategory(w, req)

	// This should either fail with BadRequest or succeed with proper circular reference handling
	if w.Code != http.StatusBadRequest && w.Code != http.StatusOK {
		t.Errorf("Expected either 400 or 200 status, got %d", w.Code)
	}

	// If it succeeded, verify no infinite loops occur when getting categories
	if w.Code == http.StatusOK {
		// Test that GetCategories doesn't hang
		req2 := httptest.NewRequest("GET", "/api/categories", nil)
		w2 := httptest.NewRecorder()

		// This should complete without hanging
		setup.handler.GetCategories(w2, req2)

		if w2.Code != http.StatusOK {
			t.Errorf("GetCategories failed after potential circular reference: %d", w2.Code)
		}
	}
}

func TestCategoryHandler_ConcurrentOperations(t *testing.T) {
	setup, err := setupCategoryTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create initial category
	parent, _ := setup.service.Create("Parent", nil, "Parent desc")

	// Test concurrent creates
	numGoroutines := 10
	done := make(chan error, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func(i int) {
			requestBody := map[string]interface{}{
				"name":        fmt.Sprintf("Concurrent Category %d", i),
				"description": fmt.Sprintf("Description %d", i),
				"parent_id":   parent.ID,
			}

			body, _ := json.Marshal(requestBody)
			req := httptest.NewRequest("POST", "/api/categories", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			setup.handler.CreateCategory(w, req)

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

	// Verify all categories were created
	req := httptest.NewRequest("GET", "/api/categories", nil)
	w := httptest.NewRecorder()
	setup.handler.GetCategories(w, req)

	var categories []*models.Category
	json.Unmarshal(w.Body.Bytes(), &categories)

	// Should have 1 parent + 10 children = 11 total
	if len(categories) != 11 {
		t.Errorf("Expected 11 categories after concurrent creates, got %d", len(categories))
	}
}

func TestCategoryHandler_DataConsistency(t *testing.T) {
	setup, err := setupCategoryTest()
	if err != nil {
		t.Fatalf("Failed to setup test: %v", err)
	}
	defer setup.cleanup()

	// Create categories and verify consistent state
	parent, _ := setup.service.Create("Parent", nil, "Parent desc")
	child1, _ := setup.service.Create("Child 1", &parent.ID, "Child 1 desc")
	setup.service.Create("Child 2", &parent.ID, "Child 2 desc")

	// Test 1: Verify hierarchy consistency
	req := httptest.NewRequest("GET", "/api/categories/by-parent?parent_id="+strconv.Itoa(parent.ID), nil)
	w := httptest.NewRecorder()
	setup.handler.GetCategoriesByParent(w, req)

	var children []*models.Category
	json.Unmarshal(w.Body.Bytes(), &children)

	if len(children) != 2 {
		t.Errorf("Expected 2 children, got %d", len(children))
	}

	// Test 2: Verify depth calculation
	grandchild, _ := setup.service.Create("Grandchild", &child1.ID, "Grandchild desc")

	req = httptest.NewRequest("GET", "/api/categories/"+strconv.Itoa(grandchild.ID), nil)
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(grandchild.ID)})
	w = httptest.NewRecorder()
	setup.handler.GetCategory(w, req)

	var retrievedGrandchild models.Category
	json.Unmarshal(w.Body.Bytes(), &retrievedGrandchild)

	if retrievedGrandchild.Depth != 2 {
		t.Errorf("Expected grandchild depth 2, got %d", retrievedGrandchild.Depth)
	}

	// Test 3: Verify deletion cascade
	req = httptest.NewRequest("DELETE", "/api/categories/"+strconv.Itoa(parent.ID), nil)
	req = mux.SetURLVars(req, map[string]string{"id": strconv.Itoa(parent.ID)})
	w = httptest.NewRecorder()
	setup.handler.DeleteCategory(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("Expected successful deletion, got %d", w.Code)
	}

	// Verify all related categories are deleted
	req = httptest.NewRequest("GET", "/api/categories", nil)
	w = httptest.NewRecorder()
	setup.handler.GetCategories(w, req)

	var remainingCategories []*models.Category
	json.Unmarshal(w.Body.Bytes(), &remainingCategories)

	if len(remainingCategories) != 0 {
		t.Errorf("Expected 0 categories after cascade delete, got %d", len(remainingCategories))
	}
}